// ─────────────────────────────────────────────────────────────────────────────
// Stargate Knowledge Indexer — Saves ALL Stargate knowledge to vault + MCP
// This runs once at startup and after major changes.
// ─────────────────────────────────────────────────────────────────────────────

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import {
  STARGATE_COMPONENTS,
  HYPERAIBOX_FLEET,
  STARGATE_CONTRACTS,
  buildComponentSummary,
  buildCapabilityReport,
} from "./stargate-registry.js";

const VAULT_DIR = path.join(app.getPath("userData"), "session-vault", "stargate");

function ensureVaultDir() {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
}

// ── Index All Components ────────────────────────────────────────────────────

export async function indexAllStargateKnowledge(): Promise<{
  indexed: boolean;
  entries: number;
  errors: string[];
}> {
  ensureVaultDir();
  const errors: string[] = [];
  let entries = 0;

  try {
    // 1. Save component registry
    const registryPath = path.join(VAULT_DIR, "component-registry.json");
    fs.writeFileSync(
      registryPath,
      JSON.stringify({
        timestamp: Date.now(),
        components: STARGATE_COMPONENTS,
        fleet: HYPERAIBOX_FLEET,
        contracts: STARGATE_CONTRACTS,
      }, null, 2),
    );
    entries++;

    // 2. Save summary report
    const summaryPath = path.join(VAULT_DIR, "ecosystem-summary.md");
    fs.writeFileSync(summaryPath, buildComponentSummary());
    entries++;

    // 3. Save capability report
    const capPath = path.join(VAULT_DIR, "bot-capabilities.md");
    fs.writeFileSync(capPath, buildCapabilityReport());
    entries++;

    // 4. Save individual component docs
    for (const comp of STARGATE_COMPONENTS) {
      const compPath = path.join(VAULT_DIR, `component-${comp.id}.json`);
      fs.writeFileSync(compPath, JSON.stringify(comp, null, 2));
      entries++;
    }

    // 5. Save fleet docs
    for (const box of HYPERAIBOX_FLEET) {
      const boxPath = path.join(VAULT_DIR, `hyperaibox-${box.id}.json`);
      fs.writeFileSync(boxPath, JSON.stringify(box, null, 2));
      entries++;
    }

    // 6. Save contract docs
    for (const contract of STARGATE_CONTRACTS) {
      const contractPath = path.join(VAULT_DIR, `contract-${contract.id}.json`);
      fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2));
      entries++;
    }

    // 7. Save diagnostic history
    const historyPath = path.join(VAULT_DIR, "diagnostic-history.jsonl");
    // Append current snapshot
    const snapshot = {
      timestamp: Date.now(),
      components: STARGATE_COMPONENTS.map((c) => ({ id: c.id, status: c.status })),
      fleet: HYPERAIBOX_FLEET.map((b) => ({ id: b.id, status: b.status })),
      downCount: STARGATE_COMPONENTS.filter((c) => c.status === "down" || c.status === "unknown").length,
    };
    fs.appendFileSync(historyPath, JSON.stringify(snapshot) + "\n");
    entries++;

    return { indexed: true, entries, errors };
  } catch (err) {
    errors.push(String(err));
    return { indexed: false, entries, errors };
  }
}

// ── Query Indexed Knowledge ─────────────────────────────────────────────────

export function getIndexedComponent(componentId: string): any {
  ensureVaultDir();
  const compPath = path.join(VAULT_DIR, `component-${componentId}.json`);
  if (!fs.existsSync(compPath)) return null;
  return JSON.parse(fs.readFileSync(compPath, "utf-8"));
}

export function getDiagnosticHistory(limit = 100): any[] {
  ensureVaultDir();
  const historyPath = path.join(VAULT_DIR, "diagnostic-history.jsonl");
  if (!fs.existsSync(historyPath)) return [];
  const lines = fs.readFileSync(historyPath, "utf-8").trim().split("\n").filter(Boolean);
  return lines.slice(-limit).map((l) => JSON.parse(l));
}

export function getDownTrend(): {
  improving: boolean;
  currentDown: number;
  previousDown: number;
  trend: string;
} {
  const history = getDiagnosticHistory(10);
  if (history.length < 2) {
    return {
      improving: false,
      currentDown: history[0]?.downCount ?? 0,
      previousDown: 0,
      trend: "insufficient data",
    };
  }

  const current = history[history.length - 1].downCount;
  const previous = history[history.length - 2].downCount;
  const improving = current < previous;
  const trend = improving
    ? `improving (${previous} → ${current})`
    : current > previous
      ? `degrading (${previous} → ${current})`
      : "stable";

  return { improving, currentDown: current, previousDown: previous, trend };
}

// ── Auto-Index on Startup ─────────────────────────────────────────────────

let hasIndexed = false;

export async function ensureIndexed(): Promise<void> {
  if (hasIndexed) return;
  try {
    const result = await indexAllStargateKnowledge();
    if (result.indexed) {
      console.log(`[StargateIndexer] Indexed ${result.entries} entries`);
      hasIndexed = true;
    } else {
      console.error("[StargateIndexer] Failed:", result.errors);
    }
  } catch (e) {
    console.error("[StargateIndexer] Error:", e);
  }
}
