/**
 * remove.js — unregister mcp-hello from Mosaic Companion
 *
 * Removes the mcp-hello entry from mcp-plugins.json in the Mosaic userData directory.
 * Run this when you are done with the example.
 *
 * Usage:
 *   node remove.js
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { homedir, platform } from "os";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SERVER_PATH = resolve(__dirname, "server.js");

function getUserDataPath() {
  const home = homedir();
  const app = "mosaic-companion";
  switch (platform()) {
    case "darwin": return join(home, "Library", "Application Support", app);
    case "win32":  return join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), app);
    default:       return join(process.env.XDG_CONFIG_HOME ?? join(home, ".config"), app);
  }
}

const pluginsFile = join(getUserDataPath(), "mcp-plugins.json");

if (!existsSync(pluginsFile)) {
  console.log("No mcp-plugins.json found — nothing to remove.");
  process.exit(0);
}

let plugins = JSON.parse(readFileSync(pluginsFile, "utf8"));
const before = plugins.length;
plugins = plugins.filter(p => !p.args?.includes(SERVER_PATH));

if (plugins.length === before) {
  console.log("mcp-hello is not registered — nothing to remove.");
  process.exit(0);
}

writeFileSync(pluginsFile, JSON.stringify(plugins, null, 2), "utf8");

console.log("✓ Removed mcp-hello from Mosaic.");
console.log("  Click Refresh (↻) in Settings → MCP Servers for the change to take effect.");
