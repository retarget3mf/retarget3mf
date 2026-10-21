import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import type { AppEvent, DesktopApi } from '../shared/api.ts';

// The only surface the renderer gets: typed calls, no raw ipcRenderer.
const api: DesktopApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('state'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  pickFile: () => ipcRenderer.invoke('file:pick'),
  pickSlicer: (kind) => ipcRenderer.invoke('slicer:pick', kind),
  refreshSlicers: () => ipcRenderer.invoke('slicers:refresh'),
  onEvent: (listener) => {
    const handler = (_e: IpcRendererEvent, event: AppEvent) => listener(event);
    ipcRenderer.on('event', handler);
    void ipcRenderer.invoke('events:drain').then((queued: AppEvent[]) => queued.forEach(listener));
    return () => ipcRenderer.removeListener('event', handler);
  },
  pathForFile: (file) => webUtils.getPathForFile(file),
  inspect: (path) => ipcRenderer.invoke('inspect', path),
  convert: (request) => ipcRenderer.invoke('convert', request),
  cancelConversion: () => ipcRenderer.invoke('convert:cancel'),
  openInSlicer: (path, slicer) => ipcRenderer.invoke('slicer:open', path, slicer),
  showInFolder: (path) => ipcRenderer.invoke('file:show', path),
  exportReport: (result, format) => ipcRenderer.invoke('report:export', result, format),
  listHistory: () => ipcRenderer.invoke('history:list'),
  historyReport: (id) => ipcRenderer.invoke('history:report', id),
  removeHistory: (id, moveFileToTrash) => ipcRenderer.invoke('history:remove', id, moveFileToTrash),
  openSourcePage: (id) => ipcRenderer.invoke('history:source', id),
};

contextBridge.exposeInMainWorld('desktop', api);
