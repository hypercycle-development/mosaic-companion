import { ipcMain, app, IpcMainInvokeEvent } from "electron";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const MAX_RECENT = 10;

function getRecentPath(): string {
  return path.join(app.getPath("userData"), "ide-recent-projects.json");
}

function readRecent(): string[] {
  try {
    const p = getRecentPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8")) as string[];
    }
  } catch {}
  return [];
}

function writeRecent(recent: string[]): void {
  fs.writeFileSync(getRecentPath(), JSON.stringify(recent, null, 2), "utf8");
}

export function registerProjectHandlers(): void {
  ipcMain.handle(
    "ide:project:get-recent",
    async (): Promise<string[]> => {
      return readRecent();
    },
  );

  ipcMain.handle(
    "ide:project:save-recent",
    async (_e: IpcMainInvokeEvent, projectPath: string): Promise<{ success: boolean }> => {
      const recent = readRecent().filter((p) => p !== projectPath);
      recent.unshift(projectPath);
      if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
      writeRecent(recent);
      return { success: true };
    },
  );

  ipcMain.handle(
    "ide:project:get-git-status",
    async (_e: IpcMainInvokeEvent, cwd: string): Promise<{ success: boolean; files?: Array<{ path: string; status: string }>; error?: string }> => {
      try {
        const output = execSync("git status --porcelain", { cwd, encoding: "utf8", timeout: 5000 });
        const files = output
          .split("\n")
          .filter(Boolean)
          .map((line) => ({
            status: line.substring(0, 2).trim(),
            path: line.substring(3),
          }));
        return { success: true, files };
      } catch (err: any) {
        return { success: false, error: err?.message ?? "Not a git repository" };
      }
    },
  );

  ipcMain.handle(
    "ide:project:get-git-branch",
    async (_e: IpcMainInvokeEvent, cwd: string): Promise<{ success: boolean; branch?: string; error?: string }> => {
      try {
        const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd, encoding: "utf8", timeout: 5000 }).trim();
        return { success: true, branch };
      } catch (err: any) {
        return { success: false, error: err?.message ?? "Not a git repository" };
      }
    },
  );
}
