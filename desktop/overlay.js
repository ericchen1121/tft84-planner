const api=window.eightfold;
document.querySelector('#collapse')?.addEventListener('click',()=>api.collapse());
document.querySelector('#quit')?.addEventListener('click',()=>api.quit());
const bubble=document.querySelector('#bubble');
if(bubble){
  let start=null,moved=false;
  bubble.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    start={x:e.screenX,y:e.screenY};moved=false;
    bubble.setPointerCapture(e.pointerId);api.dragStart();
  });
  bubble.addEventListener('pointermove',e=>{
    if(!start)return;
    const dx=e.screenX-start.x,dy=e.screenY-start.y;
    if(Math.hypot(dx,dy)>5)moved=true;
    if(moved)api.dragMove(dx,dy);
  });
  bubble.addEventListener('pointerup',e=>{
    if(!start)return;
    api.dragEnd(moved?e.screenX-start.x:0,moved?e.screenY-start.y:0,!moved);
    start=null;
  });
  bubble.addEventListener('pointercancel',()=>{if(start)api.dragEnd(0,0,false);start=null;});
  bubble.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();api.expand();}});
}
