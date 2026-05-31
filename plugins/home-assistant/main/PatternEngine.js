// PatternEngine — mines captured home_events for candidate automation routines.
//
// This is deliberately lightweight and statistical: it surfaces *interesting
// signals* (a sensor that reliably precedes a device turning on; a device that
// changes at a consistent time of day) and hands them to an AI agent to turn
// into a polished, explained automation. The heavy reasoning lives in the
// agent, not here.
//
// Each candidate carries enough evidence (counts, confidence) for the UI and
// the agent to judge it, plus a rough draft automation to seed the design.

const ON_STATES = new Set(["on", "open", "home", "playing", "active", "true", "detected"]);

function isOn(state) {
  return ON_STATES.has(String(state).toLowerCase());
}

// ── Correlation miner ──────────────────────────────────────────────────────
// "When <trigger> turns on, <action> turns on within W seconds."
// Triggers: sensors (binary_sensor/sensor/device_tracker/person).
// Actions: actuators (light/switch/fan/climate/media_player/cover/scene).
const TRIGGER_DOMAINS = new Set(["binary_sensor", "sensor", "device_tracker", "person"]);
const ACTION_DOMAINS = new Set(["light", "switch", "fan", "climate", "media_player", "cover", "scene"]);

function mineCorrelations(events, { windowSec = 120, minSupport = 5, minConfidence = 0.6 } = {}) {
  // events: ascending by ts. Build per-entity "turned on" timelines.
  const actionOns = new Map(); // actionEntity -> [ts,...]
  const triggerOns = new Map(); // triggerEntity -> [ts,...]

  for (const e of events) {
    if (!isOn(e.oldState) && isOn(e.newState)) {
      if (ACTION_DOMAINS.has(e.domain)) {
        if (!actionOns.has(e.entityId)) actionOns.set(e.entityId, []);
        actionOns.get(e.entityId).push(e.ts);
      }
      if (TRIGGER_DOMAINS.has(e.domain)) {
        if (!triggerOns.has(e.entityId)) triggerOns.set(e.entityId, []);
        triggerOns.get(e.entityId).push(e.ts);
      }
    }
  }

  const windowMs = windowSec * 1000;
  const candidates = [];

  for (const [action, actionTimes] of actionOns) {
    if (actionTimes.length < minSupport) continue;
    for (const [trigger, triggerTimes] of triggerOns) {
      if (trigger.split(".")[0] === action.split(".")[0] && trigger === action) continue;
      // Count action-ons that were preceded by this trigger within the window.
      let hits = 0;
      let ti = 0;
      for (const at of actionTimes) {
        // advance trigger pointer to within [at-window, at]
        while (ti < triggerTimes.length && triggerTimes[ti] < at - windowMs) ti++;
        // any trigger in [at-window, at]?
        if (ti < triggerTimes.length && triggerTimes[ti] <= at) hits++;
        else {
          // linear fallback (triggerTimes not monotonic w.r.t. this scan)
          if (triggerTimes.some((tt) => tt >= at - windowMs && tt <= at)) hits++;
        }
      }
      const confidence = hits / actionTimes.length;
      if (hits >= minSupport && confidence >= minConfidence) {
        candidates.push({
          id: `corr:${trigger}->${action}`,
          type: "correlation",
          description: `When ${trigger} turns on, ${action} usually turns on within ${windowSec}s.`,
          confidence: Number(confidence.toFixed(2)),
          evidence: { occurrences: hits, actionTotal: actionTimes.length, windowSec },
          draft: {
            alias: `Auto: ${action.split(".")[1]} on ${trigger.split(".")[1]}`,
            trigger: { platform: "state", entity_id: trigger, to: "on" },
            action: { service: `${action.split(".")[0]}.turn_on`, target: { entity_id: action } },
          },
        });
      }
    }
  }
  return candidates;
}

// ── Time-of-day miner ────────────────────────────────────────────────────────
// "<entity> changes to <state> around HH:MM most days."
function mineTimeOfDay(events, { minSupport = 4, toleranceMin = 30 } = {}) {
  // Group on-transitions per entity, collect minutes-of-day.
  const perEntity = new Map(); // entity -> { minutes:[], domain }
  for (const e of events) {
    if (!isOn(e.oldState) && isOn(e.newState) && ACTION_DOMAINS.has(e.domain)) {
      const d = new Date(e.ts);
      const minute = d.getHours() * 60 + d.getMinutes();
      if (!perEntity.has(e.entityId)) perEntity.set(e.entityId, []);
      perEntity.get(e.entityId).push(minute);
    }
  }

  const candidates = [];
  for (const [entity, minutes] of perEntity) {
    if (minutes.length < minSupport) continue;
    // Find the densest cluster: pick the median, count within tolerance.
    const sorted = [...minutes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const inCluster = minutes.filter((m) => Math.abs(m - median) <= toleranceMin);
    const confidence = inCluster.length / minutes.length;
    if (inCluster.length >= minSupport && confidence >= 0.6) {
      const hh = String(Math.floor(median / 60)).padStart(2, "0");
      const mm = String(median % 60).padStart(2, "0");
      candidates.push({
        id: `tod:${entity}@${hh}${mm}`,
        type: "time-of-day",
        description: `${entity} usually turns on around ${hh}:${mm}.`,
        confidence: Number(confidence.toFixed(2)),
        evidence: { occurrences: inCluster.length, total: minutes.length, aroundTime: `${hh}:${mm}` },
        draft: {
          alias: `Auto: ${entity.split(".")[1]} at ${hh}:${mm}`,
          trigger: { platform: "time", at: `${hh}:${mm}:00` },
          action: { service: `${entity.split(".")[0]}.turn_on`, target: { entity_id: entity } },
        },
      });
    }
  }
  return candidates;
}

// Public: analyze a list of normalized events (from EventStore.getHistory).
// Returns ranked candidates (highest confidence first), capped.
export function findSuggestions(events, opts = {}) {
  if (!Array.isArray(events) || events.length === 0) return [];
  // EventStore returns newest-first; correlation mining wants ascending time.
  const asc = [...events].sort((a, b) => a.ts - b.ts);
  const correlations = mineCorrelations(asc, opts.correlation);
  const timeOfDay = mineTimeOfDay(asc, opts.timeOfDay);
  const all = [...correlations, ...timeOfDay].sort((a, b) => b.confidence - a.confidence);
  const limit = opts.limit ?? 20;
  return all.slice(0, limit);
}
