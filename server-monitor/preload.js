const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('monitorApi', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config) => ipcRenderer.invoke('config:set', config),
  fetch: (endpoint, token) => ipcRenderer.invoke('api:fetch', endpoint, token)
});
