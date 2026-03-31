import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from "electron";
import os from "os";

// node-pty is a native module — must be required at runtime
let pty: typeof import("node-pty") | null = null;
try {
  pty = require("node-pty");
} catch (e) {
  console.warn("[IDE] node-pty not available:", (e as Error).message);
}

type IPty = import("node-pty").IPty;

const terminals = new Map<string, IPty>();
let nextId = 1;

function getMainWindow(): BrowserWindow | null {
  const wins = BrowserWindow.getAllWindows();
  return wins.length > 0 ? wins[0] : null;
}

function getDefaultShell(): string {
  if (process.platform === "win32") {
    return process.env.COMSPEC || "powershell.exe";
  }
  return process.env.SHELL || "/bin/bash";
}

export function registerTerminalHandlers(): void {
  ipcMain.handle(
    "ide:pty:create",
    async (_e: IpcMainInvokeEvent, cwd: string): Promise<{ success: boolean; id?: string; error?: string }> => {
      if (!pty) {
        return { success: false, error: "Terminal not available (node-pty not loaded)" };
      }
      try {
        const id = `term-${nextId++}`;
        const shell = getDefaultShell();
        const proc = pty.spawn(shell, [], {
          name: "xterm-256color",
          cols: 80,
          rows: 24,
          cwd,
          env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
        });

        terminals.set(id, proc);

        proc.onData((data: string) => {
          const win = getMainWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send("ide:pty:data", { id, data });
          }
        });

        proc.onExit(({ exitCode }: { exitCode: number }) => {
          terminals.delete(id);
          const win = getMainWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send("ide:pty:exit", { id, code: exitCode });
          }
        });

        return { success: true, id };
      } catch (err: any) {
        return { success: false, error: err?.message ?? "Failed to create terminal" };
      }
    },
  );

  ipcMain.handle(
    "ide:pty:write",
    async (_e: IpcMainInvokeEvent, id: string, data: string): Promise<{ success: boolean; error?: string }> => {
      const proc = terminals.get(id);
      if (!proc) return { success: false, error: "Terminal not found" };
      proc.write(data);
      return { success: true };
    },
  );

  ipcMain.handle(
    "ide:pty:resize",
    async (_e: IpcMainInvokeEvent, id: string, cols: number, rows: number): Promise<{ success: boolean; error?: string }> => {
      const proc = terminals.get(id);
      if (!proc) return { success: false, error: "Terminal not found" };
      try {
        proc.resize(cols, rows);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message ?? "Failed to resize" };
      }
    },
  );

  ipcMain.handle(
    "ide:pty:destroy",
    async (_e: IpcMainInvokeEvent, id: string): Promise<{ success: boolean }> => {
      const proc = terminals.get(id);
      if (proc) {
        proc.kill();
        terminals.delete(id);
      }
      return { success: true };
    },
  );
}

export function cleanupTerminals(): void {
  for (const [id, proc] of terminals) {
    try {
      proc.kill();
    } catch {}
  }
  terminals.clear();
}
