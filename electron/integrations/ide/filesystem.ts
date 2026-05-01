import { ipcMain, dialog, BrowserWindow, IpcMainInvokeEvent } from "electron";
import fs from "fs";
import path from "path";

export interface DirEntry {
  name: string;
  type: "file" | "directory" | "symlink";
  size: number;
  modifiedMs: number;
}

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg",
  ".mp3", ".mp4", ".wav", ".ogg", ".webm", ".avi",
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".exe", ".dll", ".so", ".dylib", ".wasm",
  ".ttf", ".otf", ".woff", ".woff2",
  ".sqlite", ".db",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function registerFilesystemHandlers(): void {
  ipcMain.handle(
    "ide:fs:read-dir",
    async (_e: IpcMainInvokeEvent, dirPath: string): Promise<{ success: boolean; entries?: DirEntry[]; error?: string }> => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const result: DirEntry[] = [];
        for (const entry of entries) {
          if (entry.name.startsWith(".")) continue; // skip hidden by default
          const fullPath = path.join(dirPath, entry.name);
          try {
            const stat = fs.statSync(fullPath);
            result.push({
              name: entry.name,
              type: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file",
              size: stat.size,
              modifiedMs: stat.mtimeMs,
            });
          } catch {
            // skip inaccessible entries
          }
        }
        result.sort((a, b) => {
          if (a.type === "directory" && b.type !== "directory") return -1;
          if (a.type !== "directory" && b.type === "directory") return 1;
          return a.name.localeCompare(b.name);
        });
        return { success: true, entries: result };
      } catch (err: any) {
        return { success: false, error: err?.message ?? "Failed to read directory" };
      }
    },
  );

  ipcMain.handle(
    "ide:fs:read-file",
    async (_e: IpcMainInvokeEvent, filePath: string): Promise<{ success: boolean; content?: string; isBinary?: boolean; error?: string }> => {
      try {
        const ext = path.extname(filePath).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) {
          return { success: true, content: "", isBinary: true };
        }
        const stat = fs.statSync(filePath);
        if (stat.size > MAX_FILE_SIZE) {
          return { success: false, error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB, max ${MAX_FILE_SIZE / 1024 / 1024} MB)` };
        }
        const content = fs.readFileSync(filePath, "utf8");
        return { success: true, content };
      } catch (err: any) {
        return { success: false, error: err?.message ?? "Failed to read file" };
      }
    },
  );

  ipcMain.handle(
    "ide:fs:write-file",
    async (_e: IpcMainInvokeEvent, filePath: string, content: string): Promise<{ success: boolean; error?: string }> => {
      try {
        fs.writeFileSync(filePath, content, "utf8");
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message ?? "Failed to write file" };
      }
    },
  );

  ipcMain.handle(
    "ide:fs:create-file",
    async (_e: IpcMainInvokeEvent, filePath: string, content?: string): Promise<{ success: boolean; error?: string }> => {
      try {
        if (fs.existsSync(filePath)) {
          return { success: false, error: "File already exists" };
        }
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content ?? "", "utf8");
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message ?? "Failed to create file" };
      }
    },
  );

  ipcMain.handle(
    "ide:fs:create-dir",
    async (_e: IpcMainInvokeEvent, dirPath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message ?? "Failed to create directory" };
      }
    },
  );

  ipcMain.handle(
    "ide:fs:delete",
    async (_e: IpcMainInvokeEvent, targetPath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const stat = fs.statSync(targetPath);
        if (stat.isDirectory()) {
          fs.rmSync(targetPath, { recursive: true });
        } else {
          fs.unlinkSync(targetPath);
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message ?? "Failed to delete" };
      }
    },
  );

  ipcMain.handle(
    "ide:fs:rename",
    async (_e: IpcMainInvokeEvent, oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        fs.renameSync(oldPath, newPath);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message ?? "Failed to rename" };
      }
    },
  );

  ipcMain.handle(
    "ide:fs:stat",
    async (_e: IpcMainInvokeEvent, targetPath: string): Promise<{ success: boolean; stat?: { size: number; isDirectory: boolean; isFile: boolean; modifiedMs: number }; error?: string }> => {
      try {
        const stat = fs.statSync(targetPath);
        return {
          success: true,
          stat: {
            size: stat.size,
            isDirectory: stat.isDirectory(),
            isFile: stat.isFile(),
            modifiedMs: stat.mtimeMs,
          },
        };
      } catch (err: any) {
        return { success: false, error: err?.message ?? "Failed to stat" };
      }
    },
  );

  ipcMain.handle(
    "ide:fs:open-folder",
    async (): Promise<{ success: boolean; path?: string; error?: string }> => {
      const wins = BrowserWindow.getAllWindows();
      const result = await dialog.showOpenDialog(wins[0] ?? ({} as any), {
        properties: ["openDirectory"],
        title: "Open Folder",
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: "Cancelled" };
      }
      return { success: true, path: result.filePaths[0] };
    },
  );
}
