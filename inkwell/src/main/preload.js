const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => {
  const fn = (_e, data) => cb(data);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
};

contextBridge.exposeInMainWorld('inkwell', {
  check: (text) => ipcRenderer.invoke('check', text),
  rewrite: (text, mode) => ipcRenderer.invoke('rewrite', text, mode),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  testClaude: () => ipcRenderer.invoke('settings:testClaude'),
  addToDictionary: (word) => ipcRenderer.invoke('dictionary:add', word),
  removeFromDictionary: (word) => ipcRenderer.invoke('dictionary:remove', word),
  disableRule: (rule) => ipcRenderer.invoke('rule:disable', rule),
  copy: (text) => ipcRenderer.invoke('clipboard:write', text),
  replace: (text) => ipcRenderer.invoke('popup:replace', text),
  closePopup: () => ipcRenderer.invoke('popup:close'),
  openInEditor: (text) => ipcRenderer.invoke('popup:openInEditor', text),
  resizePopup: (h) => ipcRenderer.invoke('popup:resize', h),
  openAccessibility: () => ipcRenderer.invoke('app:openAccessibility'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  onPopupLoad: on('popup:load'),
  onEditorLoad: on('editor:load'),
  onOpenSettings: on('editor:settings'),
  onSettingsChanged: on('settings:changed'),
});
