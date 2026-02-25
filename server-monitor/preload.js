const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('monitorApi', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config) => ipcRenderer.invoke('config:set', config),
  fetch: (endpoint, token) => ipcRenderer.invoke('api:fetch', endpoint, token),
  openCursor: () => ipcRenderer.invoke('cursor:open'),
  deployToServer: () => ipcRenderer.invoke('deploy:toServer'),
  deployBackendOnly: () => ipcRenderer.invoke('deploy:backendOnly'),
  deployFrontendOnly: () => ipcRenderer.invoke('deploy:frontendOnly'),
  deployFullForce: () => ipcRenderer.invoke('deploy:fullForce'),
  openSsh: () => ipcRenderer.invoke('ssh:openTerminal'),
  runNpmDeploy: () => ipcRenderer.invoke('deploy:npmRunDeploy'),
  pickFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  pickFile: () => ipcRenderer.invoke('dialog:openFile')
});
