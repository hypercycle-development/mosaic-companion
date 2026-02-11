import { ipcRenderer } from "electron";

export const gmailAPI: Window['electronAPI']['gmail'] = {
  signIn: () => ipcRenderer.invoke("gmail:sign-in"),
  signOut: () => ipcRenderer.invoke("gmail:sign-out"),
  getStatus: () => ipcRenderer.invoke("gmail:get-status"),
  getEmails: (count) => ipcRenderer.invoke("gmail:get-emails", count),
  getEmailDetails: (messageId) =>
    ipcRenderer.invoke("gmail:get-email-details", messageId),
  searchEmails: (query, count) =>
    ipcRenderer.invoke("gmail:search-emails", query, count),
  markRead: (messageId) => ipcRenderer.invoke("gmail:mark-read", messageId),
  markUnread: (messageId) => ipcRenderer.invoke("gmail:mark-unread", messageId),
  getAutoMarkRead: () => ipcRenderer.invoke("gmail:get-auto-mark-read"),
  setAutoMarkRead: (enabled) =>
    ipcRenderer.invoke("gmail:set-auto-mark-read", enabled),
};
