// ─────────────────────────────────────────────────────────────────────────────
// Electron main process — wires heartbeat, channels, skills, and memory
// ─────────────────────────────────────────────────────────────────────────────

import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import os from "node:os";

import { startHeartbeatRunner } from "./heartbeat/runner.js";
import { requestHeartbeatNow } from "./heartbeat/wake.js";
import { registerChannel } from "./channels/registry.js";
import { deliverMessage } from "./channels/deliver.js";
import { ipcChannelPlugin } from "./channels/adapters/ipc.js";
import { httpChannelPlugin } from "./channels/adapters/http.js";
import { loadSkillEntries, defaultSkillSources } from "./skills/loader.js";
import { buildEligibilityContext, buildSkillSnapshot, resolveSkillCommand } from "./skills/registry.js";
import { getMemoryManager } from "./memory/index.js";

// ── App config ────────────────────────────────────────────────────────────────

const APP_DIR = path.join(os.homedir(), ".myapp");
const WORKSPACE_DIR = process.cwd();

type AppConfig = {
  channels: {
    ipc?: { enabled?: boolean };
    http?: { webhookUrl?: string; enabled?: boolean };
  };
};

const config: AppConfig = {
  channels: {
    ipc: { enabled: true },
    // http: { webhookUrl: "https://your-endpoint/webhook", enabled: true },
  },
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function bootstrap() {
  await app.whenReady();

  // 1. Channels
  registerChannel(ipcChannelPlugin);
  registerChannel(httpChannelPlugin);

  // 2. Skills
  const skillEntries = await loadSkillEntries(defaultSkillSources(APP_DIR, WORKSPACE_DIR));
  const eligibilityCtx = await buildEligibilityContext();
  const skillSnapshot = buildSkillSnapshot(skillEntries, eligibilityCtx);
  console.log(
    `[Skills] ${skillSnapshot.skills.length} loaded:`,
    skillSnapshot.commandSpecs.map((s) => `/${s.name}`).join(", "),
  );

  // 3. Memory
  //
  // Option A — builtin SQLite (no external tools required):
  const memory = await getMemoryManager({
    backend: "builtin",
    config: {
      workspaceDir: WORKSPACE_DIR,
      dbPath: path.join(APP_DIR, "memory", "main.sqlite"),
      // Uncomment to enable vector search:
      // embedding: {
      //   provider: "openai",
      //   apiKey: process.env.OPENAI_API_KEY!,
      // },
      // Or with a local Ollama model:
      // embedding: { provider: "ollama", model: "nomic-embed-text" },
      embedding: { provider: "none" }, // FTS-only by default
      search: {
        vectorWeight: 0.7,
        textWeight: 0.3,
        temporalDecay: { enabled: true, halfLifeDays: 30 },
        mmr: { enabled: true, lambda: 0.7 },
      },
    },
  });
  //
  // Option B — QMD backend with SQLite fallback:
  // const memory = await getMemoryManager({
  //   backend: "qmd",
  //   config: {
  //     workspaceDir: WORKSPACE_DIR,
  //     agentId: "main",
  //     stateDir: APP_DIR,
  //     command: "qmd",
  //     update: { onBoot: true, intervalMs: 5 * 60_000 },
  //   },
  //   fallback: {
  //     workspaceDir: WORKSPACE_DIR,
  //     dbPath: path.join(APP_DIR, "memory", "main.sqlite"),
  //     embedding: { provider: "none" },
  //   },
  // });

  // 4. Heartbeat
  const heartbeat = startHeartbeatRunner({
    agents: [
      {
        agentId: "main",
        heartbeat: {
          enabled: true,
          intervalMs: 30 * 60_000,
          channel: "ipc",
          to: "renderer",
          ackMaxChars: 300,
          activeHours: { start: "09:00", end: "22:00" },
          // Search memory before each heartbeat tick and prepend relevant context
          memorySearch: {
            query: "pending tasks actions reminders",
            maxResults: 5,
            maxInjectedChars: 2000,
          },
        },
      },
    ],

    // Replace with your actual LLM call
    onReply: async ({ agentId, prompt, now }) => {
      console.log(`[Heartbeat] ${agentId} @ ${now.toISOString()}`);
      return "HEARTBEAT_OK";
    },

    onDeliver: async (agentId, channel, to, text) => {
      await deliverMessage({ cfg: config, channel, to, text });
    },

    onEvent: (evt) => {
      console.log(`[Heartbeat] ${evt.agentId} → ${evt.status}`, evt.preview ?? "");
    },

    memory,
  });

  // 5. Window
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
    },
  });
  await win.loadFile("index.html");

  // 6. IPC handlers

  // Renderer sends a user message
  ipcMain.handle("agent:send", async (_e, text: string) => {
    const match = resolveSkillCommand(text, skillSnapshot.commandSpecs);
    if (match) {
      console.log(`[Skill] ${match.spec.skillName}`, match.args);
      return { type: "skill", skill: match.spec.skillName, args: match.args };
    }
    return { type: "message", text };
  });

  // Memory search — called by renderer or agent pipeline
  ipcMain.handle("memory:search", async (_e, query: string, opts?: { maxResults?: number }) => {
    return memory.search(query, opts);
  });

  // Memory file read — for agent tool use
  ipcMain.handle("memory:read", async (_e, relPath: string, from?: number, lines?: number) => {
    return memory.readFile({ relPath, from, lines });
  });

  // Force memory re-index
  ipcMain.handle("memory:sync", async () => {
    await memory.sync({ reason: "manual", force: true });
    return memory.status();
  });

  // Memory status
  ipcMain.handle("memory:status", () => memory.status());

  // Trigger heartbeat from renderer
  ipcMain.handle("heartbeat:trigger", (_e, agentId?: string) => {
    requestHeartbeatNow({ agentId, reason: "action", priority: 3 });
    return { ok: true };
  });

  // Skill list for renderer UI
  ipcMain.handle("skills:list", () =>
    skillSnapshot.commandSpecs.map((s) => ({ name: s.name, description: s.description })),
  );

  app.on("before-quit", async () => {
    heartbeat.stop();
    await memory.close();
  });
}

bootstrap().catch((err) => {
  console.error("Bootstrap failed:", err);
  app.quit();
});
