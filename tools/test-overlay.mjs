import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {fitBounds,dragBounds}=require('../desktop/window-state.cjs');
const area={x:0,y:0,width:1920,height:1040};
assert.deepEqual(fitBounds({x:5000,y:-80,width:1120,height:780},area),{x:800,y:0,width:1120,height:780});
assert.deepEqual(fitBounds({x:2000,y:1000},area,true),{x:1856,y:976,width:64,height:64});
const left={x:-1920,y:-200,width:1920,height:1080};
assert.deepEqual(dragBounds({x:10,y:20},-3000,-500,left),{x:-1920,y:-200,width:64,height:64});
assert.deepEqual(fitBounds({width:9999,height:9999},{x:0,y:0,width:640,height:480}),{x:0,y:0,width:640,height:480});
const restored=fitBounds({x:-1900,y:-180,width:1120,height:780},left);
assert.equal(restored.x,-1900);assert.equal(restored.y,-180);
console.log('Overlay bounds pass: off-screen restore, taskbar, negative monitor coordinates, dragging, small displays');

// Run the actual renderer handlers, with pointer capture and lifecycle events.
class Target {
  handlers=new Map();captured=new Set();
  addEventListener(name,fn){const list=this.handlers.get(name)||[];list.push(fn);this.handlers.set(name,list);}
  emit(name,event={}){for(const fn of this.handlers.get(name)||[])fn(event);}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);this.emit('lostpointercapture',{pointerId:id});}
}
const icon=new Target(),win=new Target(),doc=new Target();
let opens=0,dragEnds=0,dragMoves=0,reset;
win.eightfold={
  expand(){assert.equal(icon.captured.size,0,'Native capture released before hiding');opens++;reset();},
  collapse(){},quit(){},dragStart(){},dragMove(){dragMoves++;},dragEnd(){dragEnds++;},
  onResetInput(callback){reset=callback;}
};
doc.querySelector=selector=>selector==='#bubble'?icon:null;
vm.runInNewContext(fs.readFileSync(new URL('../desktop/overlay.js',import.meta.url),'utf8'),{window:win,document:doc});
const pointer=(x=100,y=100,button=0,id=1)=>({screenX:x,screenY:y,button,pointerId:id});
function click(){
  reset();icon.emit('pointerdown',pointer());
  assert.equal(icon.captured.size,0,'A plain click never acquires capture');
  icon.emit('pointerup',pointer());icon.emit('click');
}
for(let i=0;i<40;i++)click();
assert.equal(opens,40,'Repeated collapse/click restores remain active');
icon.emit('pointerdown',pointer());icon.emit('pointermove',pointer(120));
assert.equal(icon.captured.size,1,'Only an actual drag captures the pointer');
icon.emit('pointerup',pointer(120));icon.emit('click');
assert.equal(opens,40,'Drag release does not expand');assert.equal(icon.captured.size,0);
click();assert.equal(opens,41,'Click after drag restores');
for(const interruption of ['pointercancel','lostpointercapture','blur','visibilitychange','reset']){
  icon.emit('pointerdown',pointer());icon.emit('pointermove',pointer(130));
  if(interruption==='blur')win.emit('blur');
  else if(interruption==='visibilitychange')doc.emit('visibilitychange');
  else if(interruption==='reset')reset();
  else icon.emit(interruption,pointer(130));
  assert.equal(icon.captured.size,0,'Interrupted capture released: '+interruption);
  click();
}
assert.equal(opens,46,'Every interrupted gesture recovers on the next click');
icon.emit('pointerdown',pointer(100,100,2));icon.emit('contextmenu');
assert.equal(opens,46,'Right click does not trigger left-click expansion');
click();assert.equal(opens,47);
assert.ok(dragMoves>0&&dragEnds>=47);
console.log('Overlay input pass: 40 repeated restores, capture released before hide, drag/click separation, cancel/lost-capture/blur/visibility/reset recovery, context menu');
