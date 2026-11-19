const {fitBounds} = require('./window-state.cjs');
// Both sizes retain one visible HWND; no transfer to a hidden secondary window.
class OverlayWindow {
  constructor(win,{expanded,compact,areaFor,onMode}) {
    this.win=win;this.expanded=expanded;this.compact=compact;
    this.areaFor=areaFor;this.onMode=onMode;this.mode='expanded';this.transitioning=false;
  }
  remember(){if(!this.transitioning)this[this.mode]=this.win.getBounds();}
  raise(){this.win.setAlwaysOnTop(true,'pop-up-menu');this.win.moveTop();}
  setMode(next){
    if(!['expanded','compact'].includes(next))throw Error('Invalid overlay mode');
    if(this.win.isVisible())this.remember();
    const compact=next==='compact',target=fitBounds(this[next],this.areaFor(this[next]),compact);
    this.transitioning=true;
    try{
      this.mode=next;
      if(compact){this.win.setMinimumSize(64,64);this.win.setMaximumSize(64,64);}
      else{this.win.setMaximumSize(32767,32767);this.win.setMinimumSize(Math.min(760,this.areaFor(target).width),Math.min(520,this.areaFor(target).height));}
      this.win.setBounds(target,false);this[next]=this.win.getBounds();this.onMode(next);
      if(!this.win.isVisible())compact?this.win.showInactive():this.win.show();
      this.raise();if(!compact)this.win.focus();
    }finally{this.transitioning=false;}
  }
}
module.exports={OverlayWindow};
