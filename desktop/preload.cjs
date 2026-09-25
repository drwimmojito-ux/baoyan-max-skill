const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', Object.freeze({
  loadConsult: () => ipcRenderer.invoke('consult:load'),
  loadSources: () => ipcRenderer.invoke('consult:sources'),
  saveProfile: profile => ipcRenderer.invoke('consult:save-profile', profile),
  saveApiConfig: config => ipcRenderer.invoke('consult:save-api', config),
  clearApiConfig: () => ipcRenderer.invoke('consult:clear-api'),
  clearConsult: () => ipcRenderer.invoke('consult:clear-all'),
  askConsult: request => ipcRenderer.invoke('consult:ask', request),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: state => ipcRenderer.invoke('state:save', state),
  listFiles: () => ipcRenderer.invoke('files:list'),
  chooseFile: (materialId, replaceId) => ipcRenderer.invoke('files:choose', materialId, replaceId),
  saveFileAs: id => ipcRenderer.invoke('files:save-as', id),
  removeFile: id => ipcRenderer.invoke('files:remove', id),
  removeFilesForMaterial: id => ipcRenderer.invoke('files:remove-for-material', id),
  clearFiles: () => ipcRenderer.invoke('files:clear'),
  testNotification: () => ipcRenderer.invoke('reminders:test'),
  checkReminders: () => ipcRenderer.invoke('reminders:check'),
  getInfo: () => ipcRenderer.invoke('app:info'),
  setAutoLaunch: enabled => ipcRenderer.invoke('app:set-auto-launch', enabled),
  openDataDirectory: () => ipcRenderer.invoke('app:open-data-directory'),
  onRemindersUpdated: callback => {
    const listener = (_, reminders) => callback(reminders);
    ipcRenderer.on('reminders:updated', listener);
    return () => ipcRenderer.removeListener('reminders:updated', listener);
  },
  onNavigate: callback => {
    const listener = (_, page) => callback(page);
    ipcRenderer.on('desktop:navigate', listener);
    return () => ipcRenderer.removeListener('desktop:navigate', listener);
  }
}));
