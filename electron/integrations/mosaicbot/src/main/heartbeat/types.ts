// Mirrors src/infra/heartbeat-runner.ts types + src/infra/heartbeat-wake.ts

export type HeartbeatStatus =
  | "sent"      // Agent produced alert content worth delivering
  | "ok-empty"  // LLM returned nothing
  | "ok-token"  // Only HEARTBEAT_OK token — suppressed
  | "skipped"   // Quiet hours / empty prompt
  | "failed";   // LLM or delivery error

export type HeartbeatEvent = {
  ts: number;
  agentId: string;
  status: HeartbeatStatus;
  reason?: string;
  preview?: string;   // first 120 chars of alert text
  durationMs?: number;
  channel?: string;
};

export type ActiveHours = {
  start: string;   // "HH:MM"
  end: string;     // "HH:MM" — "24:00" means midnight
  timezone?: string;
};

export type HeartbeatMemorySearch = {
  query?: string;           // search query. default: "pending tasks actions reminders"
  maxResults?: number;      // max chunks to retrieve. default: 5
  maxInjectedChars?: number; // truncate memory block at this many chars. default: 2000
};

export type HeartbeatConfig = {
  enabled: boolean;
  intervalMs: number;       // e.g. 30 * 60_000
  channel?: string;         // target channel id. default: "ipc"
  to?: string;              // recipient. default: agentId
  ackMaxChars?: number;     // chars allowed after HEARTBEAT_OK before suppressing. default: 300
  activeHours?: ActiveHours;
  prompt?: string;          // custom prompt override
  memorySearch?: HeartbeatMemorySearch; // prepend recalled memory to the heartbeat prompt
};

export type HeartbeatAgentConfig = {
  agentId: string;
  heartbeat: HeartbeatConfig;
};

export const WAKE_PRIORITY = {
  retry: 0,     // automatic retry after failure
  interval: 1,  // scheduled tick
  default: 2,   // generic on-demand request
  action: 3,    // manual / exec-event / hook (highest)
} as const;

export type WakePriority = (typeof WAKE_PRIORITY)[keyof typeof WAKE_PRIORITY];

export type WakeRequest = {
  agentId?: string;
  reason: string;
  priority: WakePriority;
};
