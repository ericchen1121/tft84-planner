const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('eightfold', Object.freeze({
  expand: () => ipcRenderer.send('overlay:expand'),
  collapse: () => ipcRenderer.send('overlay:collapse'),
  quit: () => ipcRenderer.send('overlay:quit'),
  dragStart: () => ipcRenderer.send('overlay:drag-start'),
  dragMove: (dx,dy) => ipcRenderer.send('overlay:drag-move',dx,dy),
  dragEnd: (dx,dy) => ipcRenderer.send('overlay:drag-end',dx,dy),
  onModeChanged: callback => {
    if(typeof callback!=='function')return;
    ipcRenderer.on('overlay:mode',(_event,mode)=>{
      if(!['compact','expanded'].includes(mode))return;
      callback(mode);ipcRenderer.send('overlay:mode-ready',mode);
    });
  },
  onResetInput: callback => {
    if(typeof callback!=='function')return;
    ipcRenderer.on('overlay:reset-input',()=>callback());
  }
}));
