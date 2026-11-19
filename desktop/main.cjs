const {app, BrowserWindow, ipcMain, screen, globalShortcut, shell, Menu} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {fitBounds, dragBounds} = require('./window-state.cjs');
let panel, bubble, quitting = false, dragStart, saveTimer;
const smoke = process.argv.includes('--smoke-test');
const settingsPath = () => path.join(app.getPath('userData'), 'overlay-window.json');
const file = name => path.join(__dirname, name);
const allowed = new Set(['shell.html', 'bubble.html'].map(name => pathToFileURL(file(name)).href));
function trusted(event) {
  return [panel,bubble].some(w => w && !w.isDestroyed() && event.sender === w.webContents &&
    event.senderFrame === w.webContents.mainFrame && allowed.has(event.senderFrame.url));
}
function areaFor(bounds) {return screen.getDisplayMatching(bounds).workArea;}
function persist() {
  if(!panel || !bubble || panel.isDestroyed() || bubble.isDestroyed())return;
  try {fs.writeFileSync(settingsPath(), JSON.stringify({panel:panel.getBounds(),bubble:bubble.getBounds()}));}
  catch(err) {console.error('Cannot save window position:',err.message);}
}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(persist,300);}
function collapse() {
  if(!panel || !bubble)return;
  dragStart=null;bubble.webContents.send('overlay:reset-input');
  panel.hide();
  bubble.setBounds(fitBounds(bubble.getBounds(),areaFor(bubble.getBounds()),true));
  bubble.showInactive();
  persist();
}
function expand() {
  if(!panel || !bubble)return;
  dragStart=null;bubble.webContents.send('overlay:reset-input');
  bubble.hide();
  panel.setBounds(fitBounds(panel.getBounds(),areaFor(panel.getBounds())));
  panel.show();panel.focus();
}
function toggle(){panel.isVisible()?collapse():expand();}
function secureWindow(win) {
  if(smoke){
    win.webContents.on('console-message',e=>console.log('RENDERER:',e.level,e.message));
    win.webContents.on('did-fail-load',(_e,code,description,url)=>console.error('LOAD FAILED:',code,description,url));
  }
  win.setAlwaysOnTop(true,'floating');
  win.webContents.setWindowOpenHandler(({url})=>{
    if(/^https?:\/\//i.test(url))shell.openExternal(url).catch(console.error);
    return {action:'deny'};
  });
  const shellURL = pathToFileURL(file('shell.html')).href;
  const bubbleURL = pathToFileURL(file('bubble.html')).href;
  const solverURL = pathToFileURL(path.join(__dirname,'../dist/index.html')).href;
  win.webContents.on('will-navigate',(e,url)=>{if(![shellURL,bubbleURL].includes(url))e.preventDefault();});
  win.webContents.on('will-frame-navigate',(e,details)=>{
    // Electron's event object contains navigation details in current releases.
    const url = typeof details==='string' ? details : (details?.url || e.url);
    if(url && ![shellURL,bubbleURL,solverURL,'about:blank'].includes(url))e.preventDefault();
  });
  win.on('move',scheduleSave);win.on('resize',scheduleSave);
}
function createWindows() {
  let saved={};try{saved=JSON.parse(fs.readFileSync(settingsPath(),'utf8'));}catch{}
  const area=screen.getPrimaryDisplay().workArea;
  const panelBounds=fitBounds(saved.panel||{},area);
  const bubbleBounds=fitBounds(saved.bubble||{x:area.x+area.width-84,y:area.y+Math.round(area.height*.35)},area,true);
  const prefs={preload:file('preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,
    backgroundThrottling:false,webviewTag:false};
  panel=new BrowserWindow({...panelBounds,minWidth:Math.min(760,area.width),minHeight:Math.min(520,area.height),
    title:'Eightfold TFT Overlay',show:false,frame:false,backgroundColor:'#0b111e',fullscreenable:false,
    autoHideMenuBar:true,webPreferences:prefs});
  bubble=new BrowserWindow({...bubbleBounds,show:false,frame:false,transparent:true,resizable:false,
    maximizable:false,minimizable:false,fullscreenable:false,skipTaskbar:true,focusable:true,
    hasShadow:false,title:'Eightfold icon',webPreferences:prefs});
  secureWindow(panel);secureWindow(bubble);
  panel.on('close',e=>{if(!quitting){e.preventDefault();collapse();}});
  bubble.on('close',e=>{if(!quitting){e.preventDefault();expand();}});
  bubble.webContents.on('context-menu',()=>Menu.buildFromTemplate([
    {label:'展開求解器 / Open',click:expand},
    {label:'離開 / Quit',click:()=>app.quit()}
  ]).popup({window:bubble}));
  const loadPanel=panel.loadFile(file('shell.html'));
  const loadBubble=bubble.loadFile(file('bubble.html'));
  Promise.all([loadPanel,loadBubble]).then(()=>{
    if(smoke)return runSmoke();
    expand();
  }).catch(err=>{console.error(err);app.exit(1);});
  const shortcutOK=globalShortcut.register('Alt+Shift+T',toggle);
  if(!shortcutOK)console.warn('Alt+Shift+T is occupied. Use the floating icon instead.');
}
function moveBubble(dx,dy) {
  if(!dragStart||!Number.isFinite(dx)||!Number.isFinite(dy))return;
  const candidate={...dragStart,x:dragStart.x+dx,y:dragStart.y+dy};
  bubble.setBounds(dragBounds(dragStart,dx,dy,areaFor(candidate)));
}
ipcMain.on('overlay:expand',e=>{if(trusted(e))expand();});
ipcMain.on('overlay:collapse',e=>{if(trusted(e))collapse();});
ipcMain.on('overlay:quit',e=>{if(trusted(e))app.quit();});
ipcMain.on('overlay:drag-start',e=>{if(trusted(e)&&e.sender===bubble.webContents)dragStart=bubble.getBounds();});
ipcMain.on('overlay:drag-move',(e,dx,dy)=>{if(trusted(e)&&e.sender===bubble.webContents)moveBubble(dx,dy);});
ipcMain.on('overlay:drag-end',(e,dx,dy)=>{
  if(!trusted(e)||e.sender!==bubble.webContents)return;
  moveBubble(dx,dy);dragStart=null;persist();
});
async function runSmoke() {
  try {
    const assert=require('node:assert/strict');
    const visible=async(win,expected,label)=>{
      const deadline=Date.now()+3000;
      while(win.isVisible()!==expected&&Date.now()<deadline)await new Promise(r=>setTimeout(r,40));
      assert.equal(win.isVisible(),expected,label);
    };
    const solverURL=pathToFileURL(path.join(__dirname,'../dist/index.html')).href;
    const findSolver=()=>panel.webContents.mainFrame.frames.find(f=>f.url.split('#')[0]===solverURL);
    const solver=findSolver();
    assert.ok(solver,'Bundled solver iframe loaded. Actual frames: '+panel.webContents.mainFrame.frames.map(f=>f.url).join(', ')+'; expected: '+solverURL);
    expand();await visible(panel,true,'Expanded solver visible');await visible(bubble,false,'Icon hidden while expanded');
    collapse();await visible(panel,false,'Solver hidden while collapsed');await visible(bubble,true,'Collapsed icon visible');
    assert.equal(panel.isAlwaysOnTop(),true);assert.equal(bubble.isAlwaysOnTop(),true);
    expand();await visible(panel,true,'Restored solver visible');assert.equal(findSolver(),solver);
    const tick=()=>new Promise(r=>setTimeout(r,60));
    const input=(type,x=32,y=32,globalPoint)=>{
      const bounds=bubble.getBounds();
      bubble.webContents.sendInputEvent({type,x,y,button:'left',clickCount:1,
        globalX:globalPoint?.x??bounds.x+x,globalY:globalPoint?.y??bounds.y+y,
        modifiers:type==='mouseMove'?['leftButtonDown']:[]});
    };
    // Exercise Chromium pointer/click events, preload IPC and native hide/show together.
    for(let cycle=0;cycle<20;cycle++){
      collapse();await visible(bubble,true,'Icon shown for click cycle '+cycle);
      bubble.focus();await tick();
      input('mouseDown');await tick();input('mouseUp');
      await visible(panel,true,'Left click restores solver, cycle '+cycle);
      await visible(bubble,false,'Icon hides after left click, cycle '+cycle);
      assert.equal(findSolver(),solver,'Solver frame retained through repeated clicks');
    }
    collapse();await visible(bubble,true,'Icon shown for drag regression');bubble.focus();await tick();
    const dragOrigin=bubble.getBounds();
    const dragPoint={x:dragOrigin.x+46,y:dragOrigin.y+32};
    input('mouseDown');await tick();input('mouseMove',46,32,dragPoint);await tick();
    input('mouseUp',32,32,dragPoint);await tick();
    await visible(panel,false,'Dragging must not open solver');
    assert.equal(bubble.isVisible(),true,'Icon remains after dragging');
    input('mouseDown');await tick();input('mouseUp');
    await visible(panel,true,'Left click still works after dragging');
    assert.equal(panel.webContents.getLastWebPreferences().nodeIntegration,false);
    assert.equal(panel.webContents.getLastWebPreferences().sandbox,true);
    console.log('OVERLAY SMOKE PASS: load, always-on-top, 20 native left-click restore cycles, drag then click, retained solver frame, sandbox');
    app.quit();
  }catch(err){console.error('OVERLAY SMOKE FAIL',err);app.exit(1);}
}
if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>{if(panel)expand();});
  app.whenReady().then(createWindows);
  app.on('activate',()=>{if(panel)expand();});
}
app.on('before-quit',()=>{quitting=true;clearTimeout(saveTimer);persist();globalShortcut.unregisterAll();});
app.on('window-all-closed',()=>app.quit());
