// commands/boxes.ts — Query SPO for registered boxes
// AXI Principle #4: Pre-computed aggregates

import { toon, nextStep, emptyState } from "../lib/toon.js";
import { getConfig } from "../lib/config.js";

interface BoxData {
  id: string;
  name: string;
  ip: string;
  status: string;
  lastHeartbeat?: number;
  slots?: number;
}

export async function boxes(args: { full?: boolean }): Promise<void> {
  const config = getConfig();

  try {
    const res = await fetch(`${config.spoUrl}/api/v1/boxes`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const boxList: BoxData[] = Array.isArray(data) ? data : data.boxes || [];

    if (boxList.length === 0) {
      console.log(emptyState("SPO Boxes", "spo-axi boxes --full"));
      return;
    }

    const online = boxList.filter((b) => b.status === "online" || b.status === "operational").length;

    console.log(toon({
      title: `SPO Boxes (${online}/${boxList.length} online)`,
      headers: args.full
        ? ["ID", "Name", "IP", "Status", "Last HB", "Slots"]
        : ["Name", "Status", "Slots"],
      rows: boxList.map((b) => args.full
        ? [
            b.id,
            b.name || "?",
            b.ip || "?",
            b.status,
            b.lastHeartbeat ? new Date(b.lastHeartbeat).toLocaleTimeString() : "never",
            String(b.slots || "?"),
          ]
        : [b.name || b.id, b.status, String(b.slots || "?")]
      ),
      footer: args.full
        ? `SPO: ${config.spoUrl}`
        : nextStep("spo-axi boxes --full for details"),
    }));
  } catch (e) {
    console.error(`Failed to query SPO: ${(e as Error).message}`);
    console.error(`→ Is SPO running at ${config.spoUrl}?`);
    process.exit(10);
  }
}
