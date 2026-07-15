// lib/config.ts — SPO and fleet config

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface SpoConfig {
  spoUrl: string;
  nodes: { id: string; name: string; ip: string }[];
}

export function getConfig(): SpoConfig {
  const spoHost = process.env.SPO_HOST || "192.168.0.112";
  const spoPort = process.env.SPO_PORT || "9100";

  return {
    spoUrl: `http://${spoHost}:${spoPort}`,
    nodes: [
      { id: "c3po", name: "C-3PO", ip: "192.168.0.150" },
      { id: "r2d2", name: "R2D2", ip: "192.168.0.38" },
    ],
  };
}

export function getSshKey(): string {
  const defaultKey = join(homedir(), ".ssh", "id_ed25519");
  try {
    readFileSync(defaultKey);
    return defaultKey;
  } catch {
    return "";
  }
}
