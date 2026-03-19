/**
 * Minimal preload for secure wallet import window.
 * Exposes only the submit function — no other API.
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("secureWalletImport", {
  submit: async (privateKey: string) => {
    const r = await ipcRenderer.invoke("web3:import-wallet-secure", privateKey);
    if (r?.success) ipcRenderer.send("web3:wallet-imported");
    return r;
  },
});
