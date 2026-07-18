// ─────────────────────────────────────────────────────────────────────────────
// STARGATE COMPONENT REGISTRY — Self-Awareness Manifest
// Every component the bot can see, query, diagnose, and command.
// This is the single source of truth for Stargate mastery.
// ─────────────────────────────────────────────────────────────────────────────

export interface StargateComponent {
  id: string;
  name: string;
  category: "core" | "ui" | "service" | "contract" | "infra" | "skill" | "mcp";
  description: string;
  status: "operational" | "degraded" | "down" | "unknown";
  dependencies: string[];
  healthEndpoint?: string;
  filePath?: string;
  commands: string[]; // What the bot can do with this component
  lastCheck?: number;
}

export interface HyperAIBox {
  id: string;
  name: string;
  ip: string;
  architecture: string;
  hbaPort: number;
  tillerPorts: number[];
  tillerDynamic: boolean;
  aimSlots: number;
  status: "online" | "offline" | "unreachable";
  lastSeen?: number;
  notes: string[];
}

export interface StargateANFE {
  id: string;
  name: string;
  contractAddress: string;
  chain: string;
  chainId: number;
  type: "core" | "module" | "delegation";
  status: "active" | "inactive" | "unknown";
  rpcUrls: string[];
}

// ── The Complete Registry ───────────────────────────────────────────────────

export const STARGATE_COMPONENTS: StargateComponent[] = [
  // Core Services
  {
    id: "stargate-pool-service",
    name: "Stargate Pool Service",
    category: "core",
    description: "NFT-gated compute discovery and delegation. Reads ANFE holdings, delegates to HyperCycle nodes.",
    status: "operational",
    dependencies: ["anfe-service", "wallet-adapter", "hypercycle-contracts"],
    filePath: "src/services/StargatePool/StargatePoolService.ts",
    commands: ["pool:status", "pool:delegate", "pool:list-nodes", "pool:my-anfes"],
  },
  {
    id: "anfe-service",
    name: "ANFE Service",
    category: "core",
    description: "HyperInsight-first + on-chain ANFE verification. ERC-721 balance/ownerOf, metadata parsing.",
    status: "operational",
    dependencies: ["wallet-adapter", "shared-rpc-limiter"],
    filePath: "src/services/StargatePool/ANFEService.ts",
    commands: ["anfe:load-wallet", "anfe:verify", "anfe:metadata", "anfe:delegations"],
  },
  {
    id: "hbox-pool-service",
    name: "HBox Pool Service",
    category: "core",
    description: "HyperAIBox compute node management. Tracks node capacity, slot allocation, AIM deployment.",
    status: "operational",
    dependencies: ["stargate-pool-service"],
    filePath: "src/services/StargatePool/HBoxPoolService.ts",
    commands: ["hbox:list", "hbox:slots", "hbox:deploy-aim"],
  },
  {
    id: "asset-discovery",
    name: "HyperCycle Asset Discovery",
    category: "core",
    description: "Multi-chain scanner for HyperCycle NFTs across Ethereum and Base.",
    status: "operational",
    dependencies: ["anfe-service"],
    filePath: "src/services/StargatePool/HyperCycleAssetDiscovery.ts",
    commands: ["scan:wallet", "scan:chain"],
  },
  {
    id: "merkelizer",
    name: "Merkelizer Service",
    category: "core",
    description: "ANFE verification via Merkle proofs. On-chain + off-chain integrity checking.",
    status: "operational",
    dependencies: ["anfe-service"],
    filePath: "src/services/StargatePool/MerkelizerService.ts",
    commands: ["merkelizer:verify", "merkelizer:status"],
  },
  {
    id: "graph-service",
    name: "The Graph Service",
    category: "core",
    description: "Subgraph queries for ANFE transfers, delegations, and historical data.",
    status: "operational",
    dependencies: ["anfe-service"],
    filePath: "src/services/StargatePool/GraphService.ts",
    commands: ["graph:anfes", "graph:transfers"],
  },
  // UI Components
  {
    id: "stargate-pool-dashboard",
    name: "Stargate Pool Dashboard",
    category: "ui",
    description: "Main UI panel showing ANFEs, compute nodes, delegations, and pool metrics.",
    status: "operational",
    dependencies: ["stargate-pool-service", "anfe-service"],
    filePath: "src/components/stargate/StargatePoolDashboard.tsx",
    commands: ["ui:open-dashboard"],
  },
  {
    id: "stargate-fleet-panel",
    name: "Stargate Fleet Panel",
    category: "ui",
    description: "HyperAIBox fleet overview with slot usage, AIM deployments, and node health.",
    status: "operational",
    dependencies: ["hbox-pool-service"],
    filePath: "src/components/stargate/StargateFleetPanel.tsx",
    commands: ["ui:open-fleet"],
  },
  {
    id: "stargate-aim-panel",
    name: "Stargate AIM Panel",
    category: "ui",
    description: "AIM deployment and management interface for HyperCycle nodes.",
    status: "operational",
    dependencies: ["hbox-pool-service"],
    filePath: "src/components/stargate/StargateAIMPanel.tsx",
    commands: ["ui:open-aim"],
  },
  {
    id: "stargate-skills-marketplace",
    name: "Stargate Skills Marketplace",
    category: "ui",
    description: "Browse and purchase agent skill bundles for Stargate deployment.",
    status: "operational",
    dependencies: ["stargate-skill-registry"],
    filePath: "src/components/stargate/StargateSkillsMarketplacePanel.tsx",
    commands: ["ui:open-marketplace"],
  },
  {
    id: "stargate-community-aim",
    name: "Stargate Community AIM Panel",
    category: "ui",
    description: "Community-submitted AIM modules from HyperCycle operators.",
    status: "operational",
    dependencies: ["stargate-skill-registry"],
    filePath: "src/components/stargate/StargateCommunityAIMPanel.tsx",
    commands: ["ui:open-community"],
  },
  {
    id: "stargate-telemetry-card",
    name: "Stargate Telemetry Card",
    category: "ui",
    description: "Real-time telemetry display for compute node performance.",
    status: "operational",
    dependencies: ["hbox-pool-service"],
    filePath: "src/components/stargate/StargateTelemetryCard.tsx",
    commands: ["ui:open-telemetry"],
  },
  {
    id: "aim-forge-panel",
    name: "AIM Forge Panel",
    category: "ui",
    description: "Build and package custom AIM modules for HyperCycle deployment.",
    status: "operational",
    dependencies: ["hbox-pool-service"],
    filePath: "src/components/stargate/AIMForgePanel.tsx",
    commands: ["ui:open-forge"],
  },
  {
    id: "node-factory-tracker",
    name: "Node Factory Tracker",
    category: "ui",
    description: "Track HyperCycle Node Factory deployments and registrations.",
    status: "operational",
    dependencies: ["stargate-pool-service"],
    filePath: "src/components/stargate/NodeFactoryTrackerPanel.tsx",
    commands: ["ui:open-tracker"],
  },
  {
    id: "midnight-city-command",
    name: "Midnight City Command Panel",
    category: "ui",
    description: "Midnight Network Compact contract deployment and management.",
    status: "operational",
    dependencies: ["midnight-mcp"],
    filePath: "src/components/stargate/MidnightCityCommandPanel.tsx",
    commands: ["ui:open-midnight"],
  },
  {
    id: "taste-skill-dial",
    name: "Taste Skill Dial Panel",
    category: "ui",
    description: "Interactive skill selection and deployment interface.",
    status: "operational",
    dependencies: ["stargate-skill-registry"],
    filePath: "src/components/stargate/TasteSkillDialPanel.tsx",
    commands: ["ui:open-taste"],
  },
  {
    id: "stargate-rankings",
    name: "Stargate Rankings View",
    category: "ui",
    description: "Leaderboard of top-performing agents and compute nodes.",
    status: "operational",
    dependencies: ["stargate-skill-registry"],
    filePath: "src/components/stargate/StargateRankingsView.tsx",
    commands: ["ui:open-rankings"],
  },
  {
    id: "krea-panel",
    name: "Krea Panel",
    category: "ui",
    description: "AI image generation via Krea AI integration.",
    status: "operational",
    dependencies: ["krea-skill"],
    filePath: "src/components/stargate/KreaPanel.tsx",
    commands: ["ui:open-krea"],
  },
  // Registry / Skills
  {
    id: "stargate-skill-registry",
    name: "Stargate Skill Registry",
    category: "service",
    description: "Bridges Hermes skills into Stargate UI. Reads ~/.hermes/skills/ for real data.",
    status: "operational",
    dependencies: ["hermes-skill-loader"],
    filePath: "src/services/StargateSkillRegistry.ts",
    commands: ["registry:list-skills", "registry:list-agents", "registry:list-models"],
  },
  // Smart Contracts
  {
    id: "hypercycle-contracts",
    name: "HyperCycle Contracts",
    category: "contract",
    description: "Canonical contract address registry for Ethereum and Base chains.",
    status: "operational",
    dependencies: [],
    filePath: "src/services/HyperCycleContracts.ts",
    commands: ["contracts:list", "contracts:address"],
  },
  {
    id: "wallet-adapter",
    name: "Wallet Adapter",
    category: "service",
    description: "Mosaic wallet integration for Ethereum and Base chains.",
    status: "operational",
    dependencies: ["hypercycle-contracts"],
    filePath: "src/services/StargatePool/WalletAdapter.ts",
    commands: ["wallet:connect", "wallet:balance", "wallet:address"],
  },
  // MCP Integrations
  {
    id: "midnight-mcp",
    name: "Midnight MCP",
    category: "mcp",
    description: "Midnight Network MCP server for Compact contracts and ZK proofs.",
    status: "operational",
    dependencies: [],
    commands: ["mcp:midnight:status", "mcp:midnight:contracts"],
  },
  {
    id: "hermes-mcp",
    name: "Hermes MCP",
    category: "mcp",
    description: "Hermes Agent tools exposed via MCP: kanban, web search, terminal, etc.",
    status: "operational",
    dependencies: [],
    commands: ["mcp:hermes:tools", "mcp:hermes:skills"],
  },
  {
    id: "midnight-wallet-mcp",
    name: "Midnight Wallet MCP",
    category: "mcp",
    description: "Midnight Wallet operations via MCP.",
    status: "operational",
    dependencies: [],
    commands: ["mcp:wallet:balance"],
  },
  {
    id: "web3-mcp",
    name: "Web3 MCP",
    category: "mcp",
    description: "Blockchain queries and transactions via MCP.",
    status: "operational",
    dependencies: [],
    commands: ["mcp:web3:balance", "mcp:web3:transact"],
  },
  {
    id: "codebase-memory-mcp",
    name: "Codebase Memory MCP",
    category: "mcp",
    description: "Knowledge graph with 194k+ nodes from ~/.hermes. Semantic code search.",
    status: "operational",
    dependencies: [],
    commands: ["mcp:memory:search", "mcp:memory:query"],
  },
  {
    id: "atomicmail-mcp",
    name: "AtomicMail MCP",
    category: "mcp",
    description: "Email operations via JMAP.",
    status: "operational",
    dependencies: [],
    commands: ["mcp:mail:inbox", "mcp:mail:send"],
  },
  // HyperAIBox Infrastructure
  {
    id: "spo-host",
    name: "SPO Host",
    category: "infra",
    description: "Stargate Pool Orchestrator. Manages pool compute allocation and agent scheduling.",
    status: "operational",
    dependencies: [],
    healthEndpoint: "http://192.168.0.112:9100/api/health",
    commands: ["infra:spo:status", "infra:spo:restart"],
  },
  {
    id: "c3po-hba",
    name: "C-3PO HBA",
    category: "infra",
    description: "Primary HyperAIBox (arm64). 128 AIM slots. Hosts tiller on port 9000.",
    status: "operational",
    dependencies: ["spo-host"],
    healthEndpoint: "http://192.168.0.150:8100/health",
    commands: ["infra:c3po:status", "infra:c3po:tiller", "infra:c3po:slots"],
  },
  {
    id: "r2d2-hba",
    name: "R2D2 HBA",
    category: "infra",
    description: "Secondary HyperAIBox (arm64). 8 AIM slots. Hosts tiller on port 9001.",
    status: "operational",
    dependencies: ["spo-host"],
    healthEndpoint: "http://192.168.0.38:8100/health",
    commands: ["infra:r2d2:status", "infra:r2d2:tiller", "infra:r2d2:slots"],
  },
  // Bot Components
  {
    id: "mosaic-orchestrator",
    name: "Mosaic Orchestrator",
    category: "core",
    description: "Multi-agent brain. Coordinates main/coder/local agents with vault + MCP + infra awareness.",
    status: "operational",
    dependencies: ["hermes-mcp", "codebase-memory-mcp", "midnight-mcp"],
    filePath: "electron/integrations/mosaicbot/src/main/orchestrator.ts",
    commands: ["bot:status", "bot:heartbeat", "bot:agents"],
  },
  {
    id: "stargate-doctor-skill",
    name: "Stargate Doctor",
    category: "skill",
    description: "Infrastructure diagnostic skill. Monitors and reports on HyperAIBox fleet health.",
    status: "operational",
    dependencies: ["mosaic-orchestrator"],
    filePath: "electron/integrations/mosaicbot/bundled-skills/stargate-doctor/SKILL.md",
    commands: ["/stargate_doctor:diagnose", "/stargate_doctor:report"],
  },
  {
    id: "auto-skill-importer",
    name: "Auto Skill Importer",
    category: "skill",
    description: "Watches ~/.hermes/skills and auto-imports new skills into Mosaic Bot.",
    status: "operational",
    dependencies: ["mosaic-orchestrator"],
    filePath: "electron/integrations/mosaicbot/src/main/skill-importer.ts",
    commands: ["/auto_skill_importer:scan", "/auto_skill_importer:list"],
  },
  {
    id: "memory-bridge",
    name: "Memory Bridge",
    category: "core",
    description: "Connects bot to codebase-memory MCP. Queries 194k nodes for session context.",
    status: "operational",
    dependencies: ["codebase-memory-mcp"],
    filePath: "electron/integrations/mosaicbot/src/main/memory-bridge.ts",
    commands: ["memory:query", "memory:context", "memory:index"],
  },
];

// ── HyperAIBox Fleet ────────────────────────────────────────────────────────

export const HYPERAIBOX_FLEET: HyperAIBox[] = [
  {
    id: "c-3po",
    name: "C-3PO (Primary)",
    ip: "192.168.0.150",          // LIVE: found on .150 after reboot (was .151)
    architecture: "arm64",
    hbaPort: 8100,
    tillerPorts: [9000],           // LIVE: tiller running on :9000 (128 slots)
    tillerDynamic: false,          // Was dynamically discovered
    aimSlots: 128,
    status: "online",
    lastSeen: Date.now(),
    notes: [
      "Rebooted 2026-07-01 20:17 UTC",
      "IP changed from .151 to .150 after reboot (DHCP)",
      "Tiller on :9000, 128 AIM slots available",
      "Node Manager :8006 responding",
      "HBA agent running (pid 159574)",
      "Also has eth1 on 192.168.1.100",
      "Tailscale IP: 100.92.116.49",
      "Node ID: 80ad4ea14c33cd2a",
      "Hardware: 16GB RAM, 8 CPU, 115GB disk (38GB free)",
      "Uptime: 95.6% over 19,739 heartbeats",
      "License: 2324779898048044",
      "Also runs: Cardano node (:3001), Postgres (:5433), Registry (:5000)",
    ],
  },
  {
    id: "r2d2",
    name: "R2D2 (Secondary)",
    ip: "192.168.0.38",
    architecture: "arm64",
    hbaPort: 8100,
    tillerPorts: [9001],           // LIVE: tiller running on :9001 (8 slots)
    tillerDynamic: false,
    aimSlots: 8,
    status: "online",
    lastSeen: Date.now(),
    notes: [
      "Rebooted 2026-07-01 20:17 UTC",
      "Tiller on :9001, 8 AIM slots available",
      "Node Manager likely responding",
      "HBA agent restarted (pid 57998)",
      "Also runs: Hermes agent, Stargate MCP bridge, Ollama",
      "Tailscale IP: 100.94.115.120",
      "Docker registry (:5000), Materios attestor (:8081)",
    ],
  },
];

export const STARGATE_CONTRACTS: StargateANFE[] = [
  {
    id: "anfe-base",
    name: "ANFE (Base)",
    contractAddress: "0x8c0075D087de9588DdF5c1441dF39828d695bc2f",
    chain: "Base",
    chainId: 8453,
    type: "core",
    status: "active",
    rpcUrls: ["https://base.publicnode.com", "https://rpc.ankr.com/base"],
  },
  {
    id: "node-factory-eth",
    name: "Node Factory (Ethereum)",
    contractAddress: "0x...", // From HyperCycleContracts.ts
    chain: "Ethereum",
    chainId: 1,
    type: "core",
    status: "active",
    rpcUrls: ["https://cloudflare-eth.com", "https://ethereum.publicnode.com"],
  },
  {
    id: "c-aimf",
    name: "c_AIMF (AIM Factory)",
    contractAddress: "0x...",
    chain: "Base",
    chainId: 8453,
    type: "module",
    status: "active",
    rpcUrls: ["https://base.publicnode.com"],
  },
  {
    id: "c-iaib",
    name: "c_IAIb (AI Image Base)",
    contractAddress: "0x...",
    chain: "Base",
    chainId: 8453,
    type: "module",
    status: "active",
    rpcUrls: ["https://base.publicnode.com"],
  },
  {
    id: "c-iaif",
    name: "c_IAIf (AI Image Fine)",
    contractAddress: "0x...",
    chain: "Base",
    chainId: 8453,
    type: "module",
    status: "active",
    rpcUrls: ["https://base.publicnode.com"],
  },
];

// ── Dynamic Health Check ────────────────────────────────────────────────────

export interface HealthCheckResult {
  componentId: string;
  healthy: boolean;
  responseTimeMs: number;
  error?: string;
  lastCheck: number;
}

/**
 * Sync registry status by checking actual health endpoints.
 * This updates component.status based on real-time health checks.
 * 
 * @param timeoutMs - Request timeout in milliseconds (default: 5000)
 * @returns Array of health check results
 */
export async function syncRegistryStatus(timeoutMs = 5000): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];
  
  // Check components with health endpoints
  const checkPromises = STARGATE_COMPONENTS
    .filter((c): c is StargateComponent & { healthEndpoint: string } => !!c.healthEndpoint)
    .map(async (comp) => {
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const response = await fetch(comp.healthEndpoint, { 
          signal: controller.signal 
        });
        
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        
        const isHealthy = response.ok || response.status === 404; // 404 on /health is still "up" for some services
        
        // Update component status
        const prevStatus = comp.status;
        comp.status = isHealthy ? "operational" : "down";
        comp.lastCheck = Date.now();
        
        if (prevStatus !== comp.status) {
          console.log(`[StargateRegistry] ${comp.id}: ${prevStatus} → ${comp.status} (${response.status})`);
        }
        
        results.push({
          componentId: comp.id,
          healthy: isHealthy,
          responseTimeMs: responseTime,
          lastCheck: Date.now(),
        });
      } catch (error) {
        const prevStatus = comp.status;
        comp.status = "down";
        comp.lastCheck = Date.now();
        
        if (prevStatus !== comp.status) {
          console.log(`[StargateRegistry] ${comp.id}: ${prevStatus} → down (error)`);
        }
        
        results.push({
          componentId: comp.id,
          healthy: false,
          responseTimeMs: Date.now() - startTime,
          error: String(error),
          lastCheck: Date.now(),
        });
      }
    });
  
  await Promise.all(checkPromises);
  
  // Also sync HyperAIBox fleet status by checking HBA health
  const fleetChecks = HYPERAIBOX_FLEET.map(async (box) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const hbaHealthUrl = `http://${box.ip}:${box.hbaPort}/health`;
      const response = await fetch(hbaHealthUrl, { signal: controller.signal });
      
      clearTimeout(timeoutId);
      
      const prevStatus = box.status;
      box.status = response.ok ? "online" : "unreachable";
      box.lastSeen = Date.now();
      
      if (prevStatus !== box.status) {
        console.log(`[StargateRegistry] ${box.id}: ${prevStatus} → ${box.status}`);
      }
    } catch (error) {
      const prevStatus = box.status;
      box.status = "unreachable";
      box.lastSeen = Date.now();
      
      if (prevStatus !== box.status) {
        console.log(`[StargateRegistry] ${box.id}: ${prevStatus} → unreachable`);
      }
    }
  });
  
  await Promise.all(fleetChecks);
  
  return results;
}

// ── Query Helpers ───────────────────────────────────────────────────────────

export function getComponentById(id: string): StargateComponent | undefined {
  return STARGATE_COMPONENTS.find((c) => c.id === id);
}

export function getComponentsByCategory(category: StargateComponent["category"]): StargateComponent[] {
  return STARGATE_COMPONENTS.filter((c) => c.category === category);
}

export function getDownComponents(): StargateComponent[] {
  return STARGATE_COMPONENTS.filter((c) => c.status === "down" || c.status === "unknown");
}

/**
 * Get a comprehensive registry status report.
 * Includes current component statuses, fleet status, and health check summaries.
 */
export function getRegistryStatusReport(): {
  timestamp: number;
  components: { total: number; operational: number; degraded: number; down: number; unknown: number };
  fleet: { total: number; online: number; offline: number; unreachable: number };
  downComponents: StargateComponent[];
  infraHealth: HealthCheckResult[];
} {
  const components = STARGATE_COMPONENTS.reduce(
    (acc, c) => {
      acc.total++;
      acc[c.status]++;
      return acc;
    },
    { total: 0, operational: 0, degraded: 0, down: 0, unknown: 0 },
  );

  const fleet = HYPERAIBOX_FLEET.reduce(
    (acc, b) => {
      acc.total++;
      acc[b.status]++;
      return acc;
    },
    { total: 0, online: 0, offline: 0, unreachable: 0 },
  );

  const downComponents = getDownComponents();
  
  // Get components that have health endpoints (infra typically)
  const infraHealth = STARGATE_COMPONENTS
    .filter((c): c is StargateComponent & { healthEndpoint: string; lastCheck: number } => 
      !!c.healthEndpoint && !!c.lastCheck)
    .map(c => ({
      componentId: c.id,
      healthy: c.status === "operational",
      responseTimeMs: 0, // Not tracked in static state
      lastCheck: c.lastCheck!,
    }));

  return {
    timestamp: Date.now(),
    components,
    fleet,
    downComponents,
    infraHealth,
  };
}

export function getInfraComponents(): StargateComponent[] {
  return STARGATE_COMPONENTS.filter((c) => c.category === "infra");
}

export function getMCPs(): StargateComponent[] {
  return STARGATE_COMPONENTS.filter((c) => c.category === "mcp");
}

export function buildComponentSummary(): string {
  const categories = ["core", "ui", "service", "contract", "infra", "mcp", "skill"] as const;
  const lines: string[] = [];
  lines.push("=== STARGATE ECOSYSTEM STATUS ===\n");

  for (const cat of categories) {
    const comps = getComponentsByCategory(cat);
    const down = comps.filter((c) => c.status === "down" || c.status === "unknown");
    lines.push(`${cat.toUpperCase()}: ${comps.length} components (${down.length} down)`);
    for (const c of comps) {
      const icon = c.status === "operational" ? "✅" : c.status === "degraded" ? "🟠" : "🔴";
      lines.push(`  ${icon} ${c.name}`);
    }
    lines.push("");
  }

  const fleet = HYPERAIBOX_FLEET;
  lines.push(`INFRASTRUCTURE FLEET: ${fleet.length} nodes`);
  for (const box of fleet) {
    const icon = box.status === "online" ? "🟢" : "🔴";
    lines.push(`  ${icon} ${box.name} (${box.ip}:${box.hbaPort}) — ${box.aimSlots} AIM slots, ${box.architecture}`);
  }

  return lines.join("\n");
}

export function buildCapabilityReport(): string {
  const lines: string[] = [];
  lines.push("=== MOSAIC BOT STARGATE MASTERY ===\n");

  lines.push("## Commands Available");
  for (const comp of STARGATE_COMPONENTS) {
    if (comp.commands.length > 0) {
      lines.push(`\n${comp.name}:`);
      for (const cmd of comp.commands) {
        lines.push(`  • ${cmd}`);
      }
    }
  }

  lines.push("\n## HyperAIBox Fleet Commands");
  for (const box of HYPERAIBOX_FLEET) {
    lines.push(`\n${box.name} (${box.ip}):`);
    lines.push(`  • infra:${box.id}:status — Check HBA health`);
    lines.push(`  • infra:${box.id}:tiller — Discover tiller port`);
    lines.push(`  • infra:${box.id}:slots — Check AIM slot usage`);
  }

  lines.push("\n## Smart Contract Commands");
  for (const contract of STARGATE_CONTRACTS) {
    lines.push(`  • contract:${contract.id}:balance — Check ANFE balance`);
    lines.push(`  • contract:${contract.id}:delegations — List delegations`);
  }

  return lines.join("\n");
}
