import { registerFilesystemHandlers } from "./filesystem";
import { registerTerminalHandlers, cleanupTerminals } from "./terminal";
import { registerProjectHandlers } from "./project";

export function initIDE(): void {
  registerFilesystemHandlers();
  registerTerminalHandlers();
  registerProjectHandlers();
  console.log("[IDE] Integration initialized");
}

export function cleanupIDE(): void {
  cleanupTerminals();
}
