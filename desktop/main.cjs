const {app,BrowserWindow,ipcMain,screen,globalShortcut,shell,Menu,Tray,nativeImage} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {fitBounds,dragBounds} = require('./window-state.cjs');
const {OverlayWindow} = require('./overlay-window.cjs');
let panel,overlay,tray,quitting=false,dragStart,saveTimer,raiseTimer,paintedMode;
const smoke=process.argv.includes('--smoke-test');
const file=name=>path.join(__dirname,name);
const settingsPath=()=>path.join(app.getPath('userData'),'overlay-window.json');
const shellURL=pathToFileURL(file('shell.html')).href;
const solverURL=pathToFileURL(path.join(__dirname,'../dist/index.html')).href;
function trusted(event){
  return panel&&!panel.isDestroyed()&&event.sender===panel.webContents&&
    event.senderFrame===panel.webContents.mainFrame&&event.senderFrame.url===shellURL;
}
function areaFor(bounds){return screen.getDisplayMatching(bounds).workArea;}
function persist(){
  if(!overlay||panel.isDestroyed())return;overlay.remember();
  try{fs.writeFileSync(settingsPath(),JSON.stringify({panel:overlay.expanded,bubble:overlay.compact}));}
  catch(err){console.error('Cannot save window position:',err.message);}
}
function scheduleSave(){if(!overlay||overlay.transitioning)return;overlay.remember();clearTimeout(saveTimer);saveTimer=setTimeout(persist,300);}
function setMode(mode){
  if(!overlay||quitting)return;dragStart=null;
  panel.webContents.send('overlay:reset-input');overlay.setMode(mode);persist();
}
function collapse(){setMode('compact');}
function expand(){setMode('expanded');}
function toggle(){overlay.mode==='compact'?expand():collapse();}
function createTray(){
  const pixels=Buffer.alloc(32*32*4);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const ring=(cx,cy,rx,ry)=>Math.abs(((x-cx)/rx)**2+((y-cy)/ry)**2-1)<.43;
    const gold=ring(15.5,10,6,5)||ring(15.5,21,7,6),i=(y*32+x)*4;
    pixels[i]=gold?135:30;pixels[i+1]=gold?205:17;pixels[i+2]=gold?241:11;pixels[i+3]=255;
  }
  try{
    tray=new Tray(nativeImage.createFromBitmap(pixels,{width:32,height:32}));
    tray.setToolTip('Eightfold '+app.getVersion()+' — 點擊展開求解器');
    tray.on('click',expand);tray.on('double-click',expand);
    tray.setContextMenu(Menu.buildFromTemplate([
      {label:'展開求解器 / Open',click:expand},{label:'縮成圖示 / Collapse',click:collapse},
      {type:'separator'},{label:'離開 / Quit',click:()=>app.quit()}
    ]));
  }catch(err){console.warn('System tray unavailable:',err.message);}
}
function createWindow(){
  let saved={};try{saved=JSON.parse(fs.readFileSync(settingsPath(),'utf8'));}catch{}
  const area=screen.getPrimaryDisplay().workArea,expanded=fitBounds(saved.panel||{},area);
  const compact=fitBounds(saved.bubble||{x:area.x+area.width-84,y:area.y+Math.round(area.height*.35)},area,true);
  panel=new BrowserWindow({...expanded,title:'Eightfold TFT Overlay '+app.getVersion(),show:false,
    frame:false,backgroundColor:'#0b111e',fullscreenable:false,autoHideMenuBar:true,
    minWidth:Math.min(760,area.width),minHeight:Math.min(520,area.height),
    webPreferences:{preload:file('preload.cjs'),nodeIntegration:false,contextIsolation:true,
      sandbox:true,backgroundThrottling:false,webviewTag:false}});
  overlay=new OverlayWindow(panel,{expanded,compact,areaFor,onMode:mode=>{
    paintedMode=null;panel.webContents.send('overlay:mode',mode);
  }});
  panel.setAlwaysOnTop(true,'pop-up-menu');
  if(smoke){
    panel.webContents.on('console-message',e=>console.log('RENDERER:',e.level,e.message));
    panel.webContents.on('did-fail-load',(_e,code,description,url)=>console.error('LOAD FAILED:',code,description,url));
  }
  panel.webContents.setWindowOpenHandler(({url})=>{
    if(/^https?:\/\//i.test(url))shell.openExternal(url).catch(console.error);return {action:'deny'};
  });
  panel.webContents.on('will-navigate',(e,url)=>{if((url||e.url)!==shellURL)e.preventDefault();});
  panel.webContents.on('will-frame-navigate',e=>{if(![shellURL,solverURL,'about:blank'].includes(e.url))e.preventDefault();});
  panel.on('move',scheduleSave);panel.on('resize',scheduleSave);
  panel.on('blur',()=>{
    clearTimeout(raiseTimer);
    raiseTimer=setTimeout(()=>{if(!quitting&&!panel.isDestroyed()&&overlay.mode==='compact')overlay.raise();},100);
  });
  panel.on('close',e=>{if(!quitting){e.preventDefault();collapse();}});
  panel.webContents.on('context-menu',()=>{
    if(overlay.mode==='compact')Menu.buildFromTemplate([
      {label:'展開求解器 / Open',click:expand},{label:'離開 / Quit',click:()=>app.quit()}
    ]).popup({window:panel});
  });
  createTray();
  panel.loadFile(file('shell.html')).then(()=>smoke?runSmoke():expand()).catch(err=>{console.error(err);app.exit(1);});
  if(!globalShortcut.register('Alt+Shift+T',toggle))console.warn('Alt+Shift+T is occupied. Use the floating icon or system tray.');
}
function moveIcon(dx,dy){
  if(overlay.mode!=='compact'||!dragStart||!Number.isFinite(dx)||!Number.isFinite(dy))return;
  const candidate={...dragStart,x:dragStart.x+dx,y:dragStart.y+dy};
  panel.setBounds(dragBounds(dragStart,dx,dy,areaFor(candidate)));
}
ipcMain.on('overlay:expand',e=>{if(trusted(e))expand();});
ipcMain.on('overlay:collapse',e=>{if(trusted(e))collapse();});
ipcMain.on('overlay:quit',e=>{if(trusted(e))app.quit();});
ipcMain.on('overlay:mode-ready',(e,mode)=>{if(trusted(e)&&mode===overlay.mode)paintedMode=mode;});
ipcMain.on('overlay:drag-start',e=>{if(trusted(e)&&overlay.mode==='compact')dragStart=panel.getBounds();});
ipcMain.on('overlay:drag-move',(e,dx,dy)=>{if(trusted(e))moveIcon(dx,dy);});
ipcMain.on('overlay:drag-end',(e,dx,dy)=>{if(trusted(e)){moveIcon(dx,dy);dragStart=null;persist();}});
async function runSmoke(){
  let game;
  try{
    const assert=require('node:assert/strict'),tick=(ms=60)=>new Promise(r=>setTimeout(r,ms));
    const wait=async(predicate,label)=>{const deadline=Date.now()+4000;while(!predicate()&&Date.now()<deadline)await tick(40);assert.ok(predicate(),label);};
    const ready=mode=>wait(()=>overlay.mode===mode&&paintedMode===mode&&panel.isVisible(),'Visible rendered '+mode+' mode');
    const findSolver=()=>panel.webContents.mainFrame.frames.find(f=>f.url.split('#')[0]===solverURL);
    const solver=findSolver(),handle=panel.getNativeWindowHandle().toString('hex');assert.ok(solver,'Bundled solver iframe loaded');
    const input=(type,x,y,point)=>{
      const b=panel.getBounds();panel.webContents.sendInputEvent({type,x,y,button:'left',clickCount:1,
        globalX:point?.x??b.x+x,globalY:point?.y??b.y+y,modifiers:type==='mouseMove'?['leftButtonDown']:[]});
    };
    expand();await ready('expanded');const area=areaFor(panel.getBounds());
    game=new BrowserWindow({...area,show:false,frame:false,backgroundColor:'#172330',title:'Borderless foreground regression',webPreferences:{sandbox:true,nodeIntegration:false}});
    for(let cycle=0;cycle<20;cycle++){
      panel.focus();await tick();const width=panel.getBounds().width;
      input('mouseDown',width-72,20);await tick();input('mouseUp',width-72,20);
      await ready('compact');assert.equal(panel.getBounds().width,64);assert.equal(panel.getBounds().height,64);
      game.show();game.focus();await tick(180);
      assert.equal(game.isFocused(),true,'Icon must not steal foreground focus');
      assert.equal(panel.isVisible(),true,'Icon visible with borderless foreground window');assert.equal(panel.isAlwaysOnTop(),true);
      assert.equal(panel.getNativeWindowHandle().toString('hex'),handle,'Same native window after minus');
      panel.focus();await tick();input('mouseDown',32,32);await tick();input('mouseUp',32,32);
      await ready('expanded');assert.equal(findSolver(),solver,'Solver retained across mode switches');
    }
    collapse();await ready('compact');panel.focus();await tick();
    const origin=panel.getBounds(),point={x:origin.x+46,y:origin.y+32};
    input('mouseDown',32,32);await tick();input('mouseMove',46,32,point);await tick();input('mouseUp',32,32,point);await tick();
    assert.equal(overlay.mode,'compact','Dragging does not open solver');
    input('mouseDown',32,32);await tick();input('mouseUp',32,32);await ready('expanded');
    assert.equal(panel.webContents.getLastWebPreferences().sandbox,true);assert.ok(tray&&!tray.isDestroyed(),'Recovery tray exists');
    game.destroy();game=null;
    console.log('OVERLAY SMOKE PASS: 20 actual minus/icon cycles with borderless foreground focus, same visible HWND, retained solver, drag/click, recovery tray, sandbox');app.quit();
  }catch(err){console.error('OVERLAY SMOKE FAIL',err);if(game&&!game.isDestroyed())game.destroy();app.exit(1);}
}
if(!app.requestSingleInstanceLock())app.quit();
else{app.on('second-instance',()=>{if(overlay)expand();});app.whenReady().then(createWindow);app.on('activate',()=>{if(overlay)expand();});}
app.on('before-quit',()=>{quitting=true;clearTimeout(saveTimer);clearTimeout(raiseTimer);persist();globalShortcut.unregisterAll();if(tray&&!tray.isDestroyed())tray.destroy();});
app.on('window-all-closed',()=>app.quit());
