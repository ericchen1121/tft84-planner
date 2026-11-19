const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('eightfold', Object.freeze({
  expand: () => ipcRenderer.send('overlay:expand'),
  collapse: () => ipcRenderer.send('overlay:collapse'),
  quit: () => ipcRenderer.send('overlay:quit'),
  dragStart: () => ipcRenderer.send('overlay:drag-start'),
  dragMove: (dx,dy) => ipcRenderer.send('overlay:drag-move',dx,dy),
  dragEnd: (dx,dy,open) => ipcRenderer.send('overlay:drag-end',dx,dy,open)
}));
