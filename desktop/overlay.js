const api=window.eightfold;
document.querySelector('#collapse')?.addEventListener('click',()=>api.collapse());
document.querySelector('#quit')?.addEventListener('click',()=>api.quit());
const bubble=document.querySelector('#bubble');
if(bubble){
  let start=null,suppressClick=false;
  function finishGesture(cancelled=false){
    const gesture=start;start=null;
    if(!gesture)return;
    suppressClick=cancelled||gesture.moved;
    // Release native capture before a click can hide the transparent window.
    if(bubble.hasPointerCapture(gesture.id))bubble.releasePointerCapture(gesture.id);
    api.dragEnd(gesture.dx,gesture.dy);
  }
  function resetInput(){finishGesture(true);suppressClick=false;}
  bubble.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    resetInput();
    start={id:e.pointerId,x:e.screenX,y:e.screenY,dx:0,dy:0,moved:false};
    api.dragStart();
  });
  bubble.addEventListener('pointermove',e=>{
    if(!start||e.pointerId!==start.id)return;
    const dx=e.screenX-start.x,dy=e.screenY-start.y;
    if(Math.hypot(dx,dy)>5&&!start.moved){
      start.moved=true;
      bubble.setPointerCapture(e.pointerId);
    }
    if(start?.moved){start.dx=dx;start.dy=dy;api.dragMove(dx,dy);}
  });
  bubble.addEventListener('pointerup',e=>{
    if(!start||e.pointerId!==start.id)return;
    if(start.moved){start.dx=e.screenX-start.x;start.dy=e.screenY-start.y;}
    finishGesture();
  });
  bubble.addEventListener('pointercancel',()=>finishGesture(true));
  bubble.addEventListener('lostpointercapture',()=>{if(start)finishGesture(true);});
  bubble.addEventListener('click',()=>{
    if(suppressClick){suppressClick=false;return;}
    resetInput();api.expand();
  });
  bubble.addEventListener('contextmenu',resetInput);
  window.addEventListener('blur',()=>finishGesture(true));
  document.addEventListener('visibilitychange',resetInput);
  api.onResetInput(resetInput);
  api.onModeChanged(mode=>{resetInput();document.body.className=mode==='compact'?'compact':'panel';});
}
