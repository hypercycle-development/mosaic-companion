// ─────────────────────────────────────────────────────────────────────────────
// Heartbeat runner — schedules periodic LLM calls per agent
// Mirrors src/infra/heartbeat-runner.ts from OpenMosaic
//
// Flow per tick:
//   1. Check active hours → skip if outside window
//   2. Call onReply(ctx) → get LLM response
//   3. Strip HEARTBEAT_OK token variants
//   4. If remaining text > ackMaxChars → deliver as alert via onDeliver()
//   5. Emit event for monitoring
// ─────────────────────────────────────────────────────────────────────────────

import type {
  HeartbeatAgentConfig,
  HeartbeatConfig,
  HeartbeatEvent,
  ActiveHours,
  WakeRequest,
} from "./types.js";
import type { MemorySearchManager } from "../memory/types.js";
import { requestHeartbeatNow, setHeartbeatWakeHandler } from "./wake.js";

// All surface forms of the HEARTBEAT_OK acknowledgement token
const TOKEN_RE = /(\*\*HEARTBEAT_OK\*\*|<b>HEARTBEAT_OK<\/b>|HEARTBEAT_OK)/g;

export type HeartbeatContext = {
  agentId: string;
  prompt: string;
  now: Date;
};

export type HeartbeatReplyFn = (
  ctx: HeartbeatContext,
) => Promise<string | null>;
export type HeartbeatDeliverFn = (
  agentId: string,
  channel: string,
  to: string,
  text: string,
) => Promise<void>;
export type HeartbeatEventListener = (evt: HeartbeatEvent) => void;

export type HeartbeatRunnerOptions = {
  agents: HeartbeatAgentConfig[];
  onReply: HeartbeatReplyFn;
  onDeliver: HeartbeatDeliverFn;
  onEvent?: HeartbeatEventListener;
  memory?: MemorySearchManager;
};

export type HeartbeatRunner = {
  stop(): void;
  triggerNow(agentId?: string): void;
};

type AgentState = {
  agentId: string;
  cfg: HeartbeatConfig;
  lastRunAt: number;
  nextDueAt: number;
  timer: ReturnType<typeof setTimeout> | null;
};

export function startHeartbeatRunner(
  opts: HeartbeatRunnerOptions,
): HeartbeatRunner {
  const states = new Map<string, AgentState>();
  let stopped = false;

  for (const agentCfg of opts.agents) {
    if (!agentCfg.heartbeat.enabled) continue;
    const state: AgentState = {
      agentId: agentCfg.agentId,
      cfg: agentCfg.heartbeat,
      lastRunAt: 0,
      nextDueAt: Date.now() + agentCfg.heartbeat.intervalMs,
      timer: null,
    };
    states.set(agentCfg.agentId, state);
    scheduleAgent(state);
  }

  // Allow external events (exec complete, cron, hooks) to fire heartbeats immediately
  const removeWake = setHeartbeatWakeHandler(
    async (requests: WakeRequest[]) => {
      if (stopped) return;
      const ids = new Set(
        requests.map((r) => r.agentId).filter(Boolean) as string[],
      );
      const targets = ids.size > 0 ? ids : new Set(states.keys());
      for (const id of targets) {
        const state = states.get(id);
        if (state) await runHeartbeat(state);
      }
    },
  );

  function scheduleAgent(state: AgentState): void {
    if (stopped || state.timer) return;
    const delay = Math.max(0, state.nextDueAt - Date.now());
    state.timer = setTimeout(async () => {
      state.timer = null;
      if (!stopped) {
        await runHeartbeat(state);
        state.lastRunAt = Date.now();
        state.nextDueAt = state.lastRunAt + state.cfg.intervalMs;
        scheduleAgent(state);
      }
    }, delay);
  }

  async function runHeartbeat(state: AgentState): Promise<void> {
    const { agentId, cfg } = state;
    const startedAt = Date.now();

    if (cfg.activeHours && !isWithinActiveHours(cfg.activeHours)) {
      emit({
        ts: startedAt,
        agentId,
        status: "skipped",
        reason: "quiet-hours",
      });
      return;
    }

    const basePrompt =
      cfg.prompt ??
      "Check HEARTBEAT.md for pending tasks. If nothing needs attention, reply HEARTBEAT_OK.";

    const prompt = await buildPromptWithMemory(basePrompt, cfg, opts.memory);

    let rawReply: string | null = null;
    try {
      rawReply = await opts.onReply({
        agentId,
        prompt,
        now: new Date(startedAt),
      });
    } catch (err) {
      emit({
        ts: startedAt,
        agentId,
        status: "failed",
        reason: String(err),
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    const durationMs = Date.now() - startedAt;

    if (!rawReply?.trim()) {
      emit({ ts: startedAt, agentId, status: "ok-empty", durationMs });
      return;
    }

    const alert = stripHeartbeatToken(rawReply, cfg.ackMaxChars ?? 300);
    if (alert === null) {
      emit({ ts: startedAt, agentId, status: "ok-token", durationMs });
      return;
    }

    const channel = cfg.channel ?? "ipc";
    const to = cfg.to ?? agentId;
    try {
      await opts.onDeliver(agentId, channel, to, alert);
      emit({
        ts: startedAt,
        agentId,
        status: "sent",
        channel,
        preview: alert.slice(0, 120),
        durationMs,
      });
    } catch (err) {
      emit({
        ts: startedAt,
        agentId,
        status: "failed",
        reason: String(err),
        durationMs,
      });
    }
  }

  function emit(evt: HeartbeatEvent): void {
    opts.onEvent?.(evt);
  }

  return {
    stop() {
      stopped = true;
      removeWake();
      for (const s of states.values()) {
        if (s.timer) clearTimeout(s.timer);
      }
      states.clear();
    },
    triggerNow(agentId?: string) {
      requestHeartbeatNow({ agentId, reason: "action", priority: 3 });
    },
  };
}

/**
 * Search memory and prepend a ## Recalled Memory block to the prompt.
 * No-ops silently if memory is unavailable or the search returns nothing.
 */
async function buildPromptWithMemory(
  base: string,
  cfg: HeartbeatConfig,
  memory: MemorySearchManager | undefined,
): Promise<string> {
  if (!memory || !cfg.memorySearch) return base;

  const ms = cfg.memorySearch;
  const query = ms.query ?? "pending tasks actions reminders";
  const maxResults = ms.maxResults ?? 5;
  const maxChars = ms.maxInjectedChars ?? 2000;

  let chunks: Awaited<ReturnType<MemorySearchManager["search"]>>;
  try {
    chunks = await memory.search(query, { maxResults });
  } catch {
    return base;
  }

  if (!chunks.length) return base;

  const lines: string[] = [];
  let chars = 0;
  for (const c of chunks) {
    const block = `### ${c.source} (score ${c.score.toFixed(2)})\n${c.snippet}`;
    if (chars + block.length > maxChars) break;
    lines.push(block);
    chars += block.length + 1;
  }

  if (!lines.length) return base;

  const memoryBlock = `## Recalled Memory\n\n${lines.join("\n\n")}`;
  return `${memoryBlock}\n\n---\n\n${base}`;
}

/**
 * Strip all HEARTBEAT_OK token variants from a response.
 * Returns null  → remaining text ≤ ackMaxChars (suppress delivery).
 * Returns string → actual alert text worth delivering.
 */
function stripHeartbeatToken(raw: string, ackMaxChars: number): string | null {
  const stripped = raw.replace(TOKEN_RE, "").trim();
  return !stripped || stripped.length <= ackMaxChars ? null : stripped;
}

function isWithinActiveHours(hours: ActiveHours): boolean {
  const now = new Date();
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const startMin = toMin(hours.start);
  const endMin = toMin(hours.end);
  const cur = now.getHours() * 60 + now.getMinutes();
  // Handle wrap-around (e.g. 22:00–06:00)
  return endMin > startMin
    ? cur >= startMin && cur < endMin
    : cur >= startMin || cur < endMin;
}
