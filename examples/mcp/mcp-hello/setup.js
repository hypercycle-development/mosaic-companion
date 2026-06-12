/**
 * setup.js — register mcp-hello in Mosaic Companion
 *
 * Writes an entry to mcp-plugins.json in the Mosaic userData directory.
 * Run this once from your terminal or IDE, then restart Mosaic.
 *
 * Usage:
 *   node setup.js
 *
 * To remove:
 *   node remove.js
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { homedir, platform } from "os";
import { randomUUID } from "crypto";
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

let plugins = [];
if (existsSync(pluginsFile)) {
  plugins = JSON.parse(readFileSync(pluginsFile, "utf8"));
}

const existing = plugins.find(p => p.args?.includes(SERVER_PATH));
if (existing) {
  console.log(`Already registered as "${existing.name}" (id: ${existing.id})`);
  console.log("Restart Mosaic if it is running to pick up any server changes.");
  process.exit(0);
}

plugins.push({
  id: randomUUID(),
  name: "mcp-hello",
  description: "System info and time tools — mcp-hello example",
  transport: "stdio",
  command: "node",
  args: [SERVER_PATH],
  autoConnect: true,
});

writeFileSync(pluginsFile, JSON.stringify(plugins, null, 2), "utf8");

console.log(`✓ Registered mcp-hello in Mosaic.`);
console.log(`  Server: ${SERVER_PATH}`);
console.log(`  Click Refresh (↻) in Settings → MCP Servers to activate.`);
