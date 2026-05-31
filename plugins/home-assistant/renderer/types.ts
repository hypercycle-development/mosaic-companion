export type HaConnectionStatus = "disconnected" | "connecting" | "connected";

export interface HaSettings {
  baseUrl: string;
  hasToken: boolean;
}

// A normalized state_changed event pushed from the main process.
export interface HaStateChange {
  ts: number;
  entityId: string;
  domain: string;
  oldState: string | null;
  newState: string | null;
  attrs: Record<string, unknown>;
  contextUser: string | null;
}

export interface HaEntityStat {
  entityId: string;
  count: number;
  lastTs: number;
}

export interface HaEventStats {
  total: number;
  oldestTs: number | null;
  newestTs: number | null;
  topEntities: HaEntityStat[];
}

export interface HaSuggestion {
  id: string;
  type: "correlation" | "time-of-day";
  description: string;
  confidence: number;
  evidence: Record<string, unknown>;
  draft: {
    alias: string;
    trigger: unknown;
    condition?: unknown;
    action: unknown;
  };
}

// Raw entity shape from GET /api/states (subset we use).
export interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed?: string;
}
