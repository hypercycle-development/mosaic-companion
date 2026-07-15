// lib/config.ts — Fleet registry and ambient context
// AXI Principle #7: Ambient context — credentials from env/files, not prompts

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface FleetNode {
  id: string;
  name: string;
  ip: string;
  sshUser: string;
  sshKey: string;
  hbaPort: number;
  tillerPort: number;
  nodeManagerPort: number;
  architecture: string;
  notes: string[];
}

export interface HboxConfig {
  nodes: FleetNode[];
  spoUrl: string;
  sshTimeout: number;
  defaultUser: string;
}

function loadSshKey(): string {
  const defaultKey = join(homedir(), ".ssh", "id_ed25519");
  try {
    readFileSync(defaultKey);
    return defaultKey;
  } catch {
    return "";
  }
}

export const DEFAULT_FLEET: FleetNode[] = [
  {
    id: "c3po",
    name: "C-3PO",
    ip: "192.168.0.150",
    sshUser: "hyperai",
    sshKey: loadSshKey(),
    hbaPort: 8100,
    tillerPort: 9000,
    nodeManagerPort: 8006,
    architecture: "arm64",
    notes: [
      "IP may change after reboot — scan .100-.160",
      "Stale PID file blocks HBA restart",
      "Tiller endpoint: /list (not /health)",
    ],
  },
  {
    id: "r2d2",
    name: "R2D2",
    ip: "192.168.0.38",
    sshUser: "hyperai",
    sshKey: loadSshKey(),
    hbaPort: 8100,
    tillerPort: 9001,
    nodeManagerPort: 8006,
    architecture: "arm64",
    notes: [
      "Stable IP — no DHCP issues",
      "Runs Hermes agent + Stargate MCP bridge",
      "Docker registry on :5000",
    ],
  },
];

export function getConfig(): HboxConfig {
  const spoHost = process.env.SPO_HOST || "192.168.0.112";
  const spoPort = process.env.SPO_PORT || "9100";

  return {
    nodes: DEFAULT_FLEET,
    spoUrl: `http://${spoHost}:${spoPort}`,
    sshTimeout: parseInt(process.env.SSH_TIMEOUT || "5000", 10),
    defaultUser: process.env.SSH_USER || "hyperai",
  };
}

export function getNode(id: string): FleetNode | undefined {
  return getConfig().nodes.find((n) => n.id === id || n.name.toLowerCase() === id.toLowerCase());
}

export function getNodeByIp(ip: string): FleetNode | undefined {
  return getConfig().nodes.find((n) => n.ip === ip);
}

// AXI Principle #5: Definitive empty states
export function unknownNode(id: string): string {
  return `┌─ Node Not Found ─────────────────────────┐\n` +
         `│ "${id}" not in fleet registry${" ".repeat(28 - id.length)}│\n` +
         `├──────────────────────────────────────────┤\n` +
         `│ → Use "hbox-axi status" to list nodes   │\n` +
         `│ → Add node via config or discovery      │\n` +
         `└──────────────────────────────────────────┘`;
}
