// ─────────────────────────────────────────────────────────────────────────────
// Priority-based, coalescing wake queue for the heartbeat system
// Mirrors src/infra/heartbeat-wake.ts from OpenMosaic
//
// Multiple callers can request a heartbeat wake simultaneously.
// Requests are coalesced per agentId — only the highest-priority one fires.
// The timer fires after DEFAULT_COALESCE_MS (250 ms) so rapid-fire requests
// collapse into a single execution.
// ─────────────────────────────────────────────────────────────────────────────

import { WAKE_PRIORITY, type WakeRequest } from "./types.js";

const DEFAULT_COALESCE_MS = 250;
const RETRY_COOLDOWN_MS = 1_000; // hard minimum between retries to prevent thrashing

type WakeHandler = (requests: WakeRequest[]) => Promise<void>;

let wakeHandler: WakeHandler | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let timerDueAt = 0;
let timerIsRetry = false;
let pendingRequests: WakeRequest[] = [];

/** Register the function that executes when the wake fires. Returns a disposer. */
export function setHeartbeatWakeHandler(handler: WakeHandler): () => void {
  wakeHandler = handler;
  return () => {
    if (wakeHandler === handler) {
      wakeHandler = null;
      clearTimer();
    }
  };
}

/**
 * Queue a heartbeat wake. Coalesces per agentId — only the highest-priority
 * request for each agent survives to execution.
 */
export function requestHeartbeatNow(req: Partial<WakeRequest> = {}): void {
  const request: WakeRequest = {
    agentId: req.agentId,
    reason: req.reason ?? "default",
    priority: req.priority ?? WAKE_PRIORITY.default,
  };

  const idx = pendingRequests.findIndex((r) => r.agentId === request.agentId);
  if (idx >= 0) {
    if (request.priority > pendingRequests[idx].priority) {
      pendingRequests[idx] = request; // keep highest priority
    }
  } else {
    pendingRequests.push(request);
  }

  scheduleWake(DEFAULT_COALESCE_MS);
}

function scheduleWake(coalesceMs: number, isRetry = false): void {
  const dueAt = Date.now() + coalesceMs;

  // Retry timers hold a hard minimum — a normal request cannot preempt them
  if (timer && timerIsRetry && !isRetry) return;

  // Keep existing timer if it fires sooner
  if (timer && timerDueAt <= dueAt) return;

  clearTimer();
  timerDueAt = dueAt;
  timerIsRetry = isRetry;

  timer = setTimeout(async () => {
    timer = null;
    timerIsRetry = false;
    const reqs = pendingRequests.splice(0);
    if (wakeHandler && reqs.length > 0) {
      try {
        await wakeHandler(reqs);
      } catch {
        scheduleWake(RETRY_COOLDOWN_MS, true);
      }
    }
  }, coalesceMs);
}

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
