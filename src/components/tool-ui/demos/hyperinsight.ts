/**
 * HyperInsight demo data — static mock panels for the dev-mode demo panel.
 *
 * This module is also the reference implementation for the real HyperInsight
 * WASM tool: the tool's mosaic_render_panel() export will return the same
 * ToolUIBlock structures, populated from live HTTP endpoints.
 */

import type { ToolUIBlock, CellColor, ButtonAction } from "../types";

// ── Shared AIM catalog ──────────────────────────────────────────────────────

const AIMS = [
  { name: "hypercycle/ollama-alternative-aim", id: 84006, totalNodes: 438212, activeNodes: 69, compute: 132.6, cpu: 120, ram: 203.5, vram: 50.9, firstSeen: "2/3/2026", lastSeen: "3/12/2026", revenue: "N/A", description: "a new approach to this aim 😊", pulls: 46, stars: 0, lastUpdated: "7/3/2025" },
  { name: "hypercycle/hyperbox-tiller", id: 84080, totalNodes: 422242, activeNodes: 25, compute: 0, cpu: 498, ram: 357.3, vram: 0, firstSeen: "2/3/2026", lastSeen: "3/12/2026", revenue: "N/A", description: "HyperAppliance Tilling Service", pulls: 1906, stars: 0, lastUpdated: "4/25/2025" },
  { name: "hypercycle/boinc-aim", id: 84065, totalNodes: 227346, activeNodes: 13, compute: 0, cpu: 264, ram: 152.9, vram: 0, firstSeen: "2/3/2026", lastSeen: "3/12/2026", revenue: "N/A", description: "BOINC distributed computing", pulls: 312, stars: 2, lastUpdated: "5/10/2025" },
  { name: "hypercycle/ollama-aim", id: 84095, totalNodes: 123067, activeNodes: 4, compute: 51, cpu: 96, ram: 62.5, vram: 11.9, firstSeen: "2/3/2026", lastSeen: "3/12/2026", revenue: "N/A", description: "No description available.", pulls: 842, stars: 0, lastUpdated: "4/15/2025" },
  { name: "hypercycle/litellm-aim", id: 84083, totalNodes: 101954, activeNodes: 9, compute: 51, cpu: 132, ram: 93.1, vram: 11.9, firstSeen: "2/3/2026", lastSeen: "3/12/2026", revenue: "N/A", description: "LiteLLM proxy for multi-model routing", pulls: 256, stars: 1, lastUpdated: "6/1/2025" },
  { name: "cardano-jor-aim", id: 21659, totalNodes: 26544, activeNodes: 4, compute: 0, cpu: 66, ram: 30.9, vram: 0, firstSeen: "1/28/2026", lastSeen: "3/12/2026", revenue: "N/A", description: "Cardano Jormungandr node", pulls: 89, stars: 0, lastUpdated: "3/15/2025" },
  { name: "hypercycle/cost_tester", id: 84071, totalNodes: 25861, activeNodes: 1, compute: 0, cpu: 24, ram: 15.3, vram: 0, firstSeen: "2/3/2026", lastSeen: "3/12/2026", revenue: "N/A", description: "Cost estimation testing service", pulls: 45, stars: 0, lastUpdated: "2/20/2025" },
  { name: "cog-videox", id: 84092, totalNodes: 19400, activeNodes: 1, compute: 30, cpu: 48, ram: 39.1, vram: 15.9, firstSeen: "2/3/2026", lastSeen: "3/12/2026", revenue: "N/A", description: "Video generation with CogVideoX", pulls: 178, stars: 3, lastUpdated: "5/28/2025" },
  { name: "hypercycle/hyperbox-vpn", id: 84081, totalNodes: 14682, activeNodes: 1, compute: 0, cpu: 24, ram: 15.3, vram: 0, firstSeen: "2/3/2026", lastSeen: "3/12/2026", revenue: "N/A", description: "VPN service for HyperBox", pulls: 67, stars: 0, lastUpdated: "3/1/2025" },
  { name: "hypercycle/ethereum-node", id: 84090, totalNodes: 12500, activeNodes: 1, compute: 0, cpu: 24, ram: 15.3, vram: 0, firstSeen: "2/3/2026", lastSeen: "3/12/2026", revenue: "N/A", description: "Ethereum full node", pulls: 34, stars: 1, lastUpdated: "4/5/2025" },
  { name: "hypercycle/elasticsearch-aim", id: 84088, totalNodes: 11200, activeNodes: 1, compute: 0, cpu: 24, ram: 15.3, vram: 0, firstSeen: "2/3/2026", lastSeen: "3/12/2026", revenue: "N/A", description: "Elasticsearch search engine", pulls: 23, stars: 0, lastUpdated: "3/8/2025" },
  { name: "hypercycle/lightning-aim-gen", id: 84082, totalNodes: 9800, activeNodes: 2, compute: 42.6, cpu: 24, ram: 17.6, vram: 12, firstSeen: "2/3/2026", lastSeen: "3/12/2026", revenue: "N/A", description: "Lightning network AIM generator", pulls: 156, stars: 1, lastUpdated: "6/15/2025" },
] as const;

type AIMEntry = (typeof AIMS)[number];

// ── Helper: build 3-column grid of AIM cards ────────────────────────────────

function buildAimGrid(): ToolUIBlock[] {
  const blocks: ToolUIBlock[] = [];
  for (let i = 0; i < AIMS.length; i += 3) {
    const chunk = AIMS.slice(i, i + 3);
    const row: ToolUIBlock = {
      type: "row",
      blocks: chunk.map((aim): ToolUIBlock => ({
        type: "column",
        blocks: [
          {
            type: "card",
            title: aim.name,
            titleColor: "green" as CellColor,
            titleMono: true,
            subtitle: `ID: ${aim.id}`,
            fields: [
              { label: "Active Nodes", value: String(aim.activeNodes) },
              { label: "Total Nodes", value: aim.totalNodes.toLocaleString() },
              { label: "Revenue", value: aim.revenue, ...(aim.revenue === "N/A" ? { color: "red" as CellColor } : {}) },
            ],
          },
          {
            type: "button",
            label: "View Details →",
            variant: "ghost",
            action: { tool: "__navigate_panel__", server: "ext:__demo__", args: { __panel: "aim-detail", name: aim.name } },
          },
        ],
      })),
    };
    blocks.push(row);
  }
  return blocks;
}

// ── Row click action to navigate to AIM detail ──────────────────────────────

const AIM_ROW_CLICK: ButtonAction = {
  tool: "__navigate_panel__",
  server: "ext:__demo__",
  args: { __panel: "aim-detail" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Panel 1: Leaderboard
// ═══════════════════════════════════════════════════════════════════════════════

const LEADERBOARD: ToolUIBlock[] = [
  // Stat cards
  { type: "row", blocks: [
    { type: "column", blocks: [
      { type: "stat-card", label: "Active AIMs", value: "12", color: "blue",
        tooltip: "Number of AIMs with at least one active node right now.",
        trend: [{ value: 10 }, { value: 8 }, { value: 10 }, { value: 7 }, { value: 9 }, { value: 11 }, { value: 10 }, { value: 12 }],
        icon: "layers" },
    ] },
    { type: "column", blocks: [
      { type: "stat-card", label: "Available AIMs", value: "58", color: "blue",
        tooltip: "Total public AIMs currently available to be deployed.",
        trend: [{ value: 45 }, { value: 48 }, { value: 52 }, { value: 50 }, { value: 55 }, { value: 56 }, { value: 58 }],
        icon: "box" },
    ] },
    { type: "column", blocks: [
      { type: "stat-card", label: "Network Compute (Est.)", value: "247.8 TFLOPS", subtext: "11.9k core-GHz", color: "green",
        tooltip: "Estimated total compute capacity across all active nodes.",
        trend: [{ value: 200 }, { value: 220 }, { value: 210 }, { value: 240 }, { value: 235 }, { value: 245 }, { value: 248 }],
        icon: "zap" },
    ] },
  ] },

  // Node Activity badges
  { type: "row", inline: true, gap: 8, blocks: [
    { type: "text", content: "Node Activity", variant: "label" },
    { type: "badge", label: "136,162 (24h)", color: "green", icon: "zap" },
    { type: "badge", label: "325,026 (7d)", color: "blue", icon: "zap" },
  ] },

  // Leaderboard table
  { type: "table", title: "AIM Leaderboard", searchable: true, searchPlaceholder: "Search AIMs...", onRowClick: AIM_ROW_CLICK, columns: [
    { key: "rank", label: "Rank", align: "center" },
    { key: "name", label: "AIM Name", color: "green", mono: true },
    { key: "nodes", label: "Active Nodes", align: "right" },
    { key: "compute", label: "Compute (TFLOPS)", align: "right", color: "green" },
    { key: "cpu", label: "CPU (cGHz)", align: "right" },
    { key: "ram", label: "RAM (GB)", align: "right" },
    { key: "vram", label: "VRAM (GB)", align: "right", color: "cyan" },
  ], rows: AIMS.map((aim, i) => ({
    rank: `#${i + 1}`,
    name: aim.name,
    nodes: aim.activeNodes,
    compute: aim.compute.toFixed(1),
    cpu: aim.cpu,
    ram: aim.ram.toFixed(1),
    vram: aim.vram.toFixed(1),
  })), cellColors: Object.fromEntries(
    AIMS.map((aim, i) => [i, {
      ...(aim.compute > 0 ? { compute: "green" as CellColor } : {}),
      ...(aim.vram > 0 ? { vram: "cyan" as CellColor } : {}),
    }]).filter(([, v]) => Object.keys(v as object).length > 0)
  ) },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Panel 2: Aims (grid + list views)
// ═══════════════════════════════════════════════════════════════════════════════

const AIMS_LIST_TABLE: ToolUIBlock = {
  type: "table",
  searchable: true,
  searchPlaceholder: "Search AIMs...",
  onRowClick: AIM_ROW_CLICK,
  columns: [
    { key: "rank", label: "Rank", align: "center" },
    { key: "name", label: "AIM Name", color: "green", mono: true },
    { key: "totalNodes", label: "Total Nodes Activated", align: "right" },
    { key: "firstSeen", label: "First Seen", align: "right" },
    { key: "lastSeen", label: "Last Seen", align: "right" },
    { key: "revenue", label: "Total Revenue", align: "right" },
  ],
  rows: AIMS.map((aim, i) => ({
    rank: `#${i + 1}`,
    name: aim.name,
    totalNodes: aim.totalNodes.toLocaleString(),
    firstSeen: aim.firstSeen,
    lastSeen: aim.lastSeen,
    revenue: aim.revenue,
  })),
  cellColors: Object.fromEntries(
    AIMS.map((aim, i) => [i, aim.revenue === "N/A" ? { revenue: "red" as CellColor } : {}])
      .filter(([, v]) => Object.keys(v as object).length > 0)
  ),
};

const AIMS_PANEL: ToolUIBlock[] = [
  { type: "tabs", tabs: [
    { id: "grid", label: "Grid View", blocks: buildAimGrid() },
    { id: "list", label: "List View", blocks: [AIMS_LIST_TABLE] },
  ] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Panel 3: Nodes
// ═══════════════════════════════════════════════════════════════════════════════

const NODES: ToolUIBlock[] = [
  // Node stats
  { type: "row", blocks: [
    { type: "column", blocks: [
      { type: "stat-card", label: "Total Nodes", value: "191", color: "blue", icon: "server",
        tooltip: "Total registered nodes across the network.",
        trend: [{ value: 170 }, { value: 175 }, { value: 180 }, { value: 178 }, { value: 185 }, { value: 190 }, { value: 191 }] },
    ] },
    { type: "column", blocks: [
      { type: "stat-card", label: "Online Nodes", value: "156", color: "green", icon: "activity",
        tooltip: "Nodes currently online and accepting work.",
        trend: [{ value: 140 }, { value: 145 }, { value: 150 }, { value: 148 }, { value: 153 }, { value: 155 }, { value: 156 }] },
    ] },
    { type: "column", blocks: [
      { type: "stat-card", label: "Offline Nodes", value: "35", color: "red", icon: "shield" },
    ] },
    { type: "column", blocks: [
      { type: "stat-card", label: "Avg. Uptime", value: "99.2%", color: "green", icon: "cpu" },
    ] },
  ] },

  // Region badges
  { type: "row", inline: true, gap: 8, blocks: [
    { type: "text", content: "Regions", variant: "label" },
    { type: "badge", label: "US-East: 62", color: "blue", icon: "globe" },
    { type: "badge", label: "EU-West: 48", color: "cyan", icon: "globe" },
    { type: "badge", label: "AP-South: 31", color: "purple", icon: "globe" },
    { type: "badge", label: "US-West: 15", color: "green", icon: "globe" },
  ] },

  // Node table
  { type: "table", title: "Active Nodes", searchable: true, searchPlaceholder: "Search nodes...", columns: [
    { key: "name", label: "Node Name", mono: true },
    { key: "region", label: "Region" },
    { key: "aim", label: "Running AIM", color: "green", mono: true },
    { key: "cpu", label: "CPU %", align: "right" },
    { key: "ram", label: "RAM (GB)", align: "right" },
    { key: "compute", label: "TFLOPS", align: "right", color: "green" },
    { key: "uptime", label: "Uptime", align: "right" },
  ], rows: [
    { name: "hc-node-alpha-01", region: "US-East", aim: "ollama-alternative-aim", cpu: "78%", ram: "28.4", compute: "42.6", uptime: "14d 3h" },
    { name: "hc-node-alpha-02", region: "US-East", aim: "ollama-alternative-aim", cpu: "82%", ram: "30.1", compute: "42.6", uptime: "14d 3h" },
    { name: "hc-node-beta-01", region: "EU-West", aim: "boinc-aim", cpu: "34%", ram: "8.2", compute: "0.0", uptime: "7d 12h" },
    { name: "hc-node-gamma-01", region: "AP-South", aim: "hyperbox-tiller", cpu: "12%", ram: "4.1", compute: "0.0", uptime: "3d 6h" },
    { name: "hc-node-gamma-02", region: "AP-South", aim: "litellm-aim", cpu: "45%", ram: "12.3", compute: "8.5", uptime: "3d 6h" },
    { name: "hc-node-delta-01", region: "US-West", aim: "ollama-aim", cpu: "67%", ram: "22.8", compute: "33.0", uptime: "21d 0h" },
    { name: "hc-node-delta-02", region: "US-West", aim: "lightning-aim-gen", cpu: "55%", ram: "9.6", compute: "21.3", uptime: "10d 4h" },
    { name: "hc-node-epsilon-01", region: "EU-West", aim: "cost_tester", cpu: "8%", ram: "3.2", compute: "0.0", uptime: "28d 15h" },
  ], cellColors: {
    0: { compute: "green" },
    1: { compute: "green" },
    4: { compute: "green" },
    5: { compute: "green" },
    6: { compute: "green" },
  } },

  // Charts
  { type: "chart", chartType: "bar", title: "Compute by Region (TFLOPS)", xAxis: { label: "Region" }, yAxis: { label: "TFLOPS" }, series: [
    { name: "Compute", data: [
      { x: "US-East", y: 280 }, { x: "EU-West", y: 120 }, { x: "AP-South", y: 85 }, { x: "US-West", y: 182 },
    ] },
  ] },
  { type: "chart", chartType: "area", title: "Network Uptime (30d)", series: [
    { name: "Uptime %", data: [
      { x: "Week 1", y: 99.1 }, { x: "Week 2", y: 99.4 }, { x: "Week 3", y: 98.8 }, { x: "Week 4", y: 99.2 },
    ] },
  ] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Panel 4: AIM Detail (single-AIM deep dive, matching HyperInsight AIM pages)
// ═══════════════════════════════════════════════════════════════════════════════

/** Generate a pseudo-random but deterministic trend array from an AIM's base value */
function fakeTrend(base: number, count = 7): { value: number }[] {
  const out: { value: number }[] = [];
  for (let i = 0; i < count; i++) {
    const jitter = Math.round(base * 0.15 * Math.sin(i * 2.1 + base));
    out.push({ value: Math.max(0, base + jitter) });
  }
  return out;
}

/** Generate a pseudo-random weekly chart series from an AIM's base value */
function fakeWeekly(base: number): { x: string; y: number }[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((d, i) => ({
    x: d,
    y: Math.max(0, Math.round(base + base * 0.2 * Math.sin(i * 1.7 + base))),
  }));
}

function buildAimDetail(aim: AIMEntry): ToolUIBlock[] {
  // Fake image size based on ram field
  const imgSizeMB = (aim.ram * 1.85).toFixed(2);
  const imgSize = parseFloat(imgSizeMB) > 1024
    ? `${(parseFloat(imgSizeMB) / 1024).toFixed(2)} GB`
    : `${imgSizeMB} MB`;
  // Fake digest
  const digest = `sha256:${aim.id.toString(16).padStart(8, "0")}${"abcdef0123456789".repeat(4).slice(0, 56)}`;
  // Fake ports
  const ports = aim.compute > 0 ? ["4000", "4001"] : ["4000"];

  return [
    // ── AIM name header ───────────────────────────────────────────────
    { type: "text", content: aim.name, variant: "heading", color: "green", mono: true },
    { type: "text", content: "Performance & Analytics", variant: "caption" },

    // ── Node Activity header row ──────────────────────────────────────
    { type: "row", inline: true, blocks: [
      { type: "column", blocks: [
        { type: "badge", label: `LAST UPDATED  ${aim.lastUpdated}`, color: "green", icon: "clock" },
      ] },
      { type: "column", blocks: [
        { type: "row", inline: true, blocks: [
          { type: "column", blocks: [
            { type: "badge", label: `Node Activity  ${aim.totalNodes.toLocaleString()} (24h)`, color: "cyan", icon: "zap" },
          ] },
          { type: "column", blocks: [
            { type: "badge", label: `${(aim.totalNodes + Math.round(aim.totalNodes * 0.001)).toLocaleString()} (7d)`, color: "cyan", icon: "zap" },
          ] },
        ] },
      ] },
    ] },

    // ── Key metric stat cards ─────────────────────────────────────────
    { type: "row", blocks: [
      { type: "column", blocks: [
        { type: "stat-card", label: "Active Nodes", value: String(aim.activeNodes), color: "blue", icon: "server",
          tooltip: "Nodes currently running this AIM.",
          trend: fakeTrend(aim.activeNodes) },
      ] },
      { type: "column", blocks: [
        { type: "stat-card", label: "Compute (TFLOPS)", value: aim.compute.toFixed(1), color: "green", icon: "zap",
          trend: fakeTrend(Math.round(aim.compute)) },
      ] },
      { type: "column", blocks: [
        { type: "stat-card", label: "CPU (cGHz)", value: String(aim.cpu), color: "blue", icon: "cpu",
          trend: fakeTrend(aim.cpu) },
      ] },
    ] },

    // ── About + metadata row ──────────────────────────────────────────
    { type: "row", blocks: [
      { type: "column", blocks: [
        { type: "text", content: "ABOUT", variant: "label" },
        { type: "text", content: aim.description, variant: "body" },
      ] },
      { type: "column", blocks: [
        { type: "card", fields: [
          { label: "Total Pulls", value: String(aim.pulls), icon: "download", iconColor: "blue" },
          { label: "Stars", value: String(aim.stars), icon: "star", iconColor: "yellow" },
          { label: "Last Updated", value: aim.lastUpdated, icon: "clock", color: "green", iconColor: "green" },
        ] },
      ] },
    ] },

    // ── Release Explorer ──────────────────────────────────────────────
    { type: "section", title: "Release Explorer", subtitle: "View versions, architectures, and requirements", icon: "box", iconColor: "text-orange-500", collapsed: true, blocks: [
      { type: "tabs", tabs: [
        { id: "amd64", label: "linux/amd64", blocks: [
          { type: "row", blocks: [
            // Left column: Requirements & Specs as individual stat-card-style entries
            { type: "column", blocks: [
              { type: "text", content: "REQUIREMENTS & SPECS", variant: "label" },
              { type: "row", blocks: [
                { type: "column", blocks: [
                  { type: "card", fields: [
                    { label: "GPU Memory", value: aim.vram > 0 ? `${aim.vram} GB` : "N/A" },
                  ] },
                ] },
                { type: "column", blocks: [
                  { type: "card", fields: [
                    { label: "Image Size", value: imgSize },
                  ] },
                ] },
              ] },
              { type: "card", fields: [
                { label: "Ports", value: ports.join(", "), icon: "globe" },
              ] },
              { type: "card", fields: [
                { label: "Digest", value: digest },
              ] },
            ] },
            // Right column: Configuration Labels
            { type: "column", blocks: [
              { type: "table", title: "Configuration Labels", searchable: true, searchPlaceholder: "Search labels...", columns: [
                { key: "label", label: "Label", mono: true, color: "yellow" },
                { key: "value", label: "Value" },
              ], rows: [
                { label: "GPUS", value: aim.vram > 0 ? "1" : "0" },
                { label: "ENV_VARS", value: `PORT=4000;PORT_STREAM=4001;OLLAMA_MODEL=${aim.name.split("/").pop()}` },
                { label: "GPU_MEMORY", value: String(aim.vram) },
                { label: "EXTRA_PORT_ENV", value: "PORT_STREAM," },
                { label: "org.opencontainers.image.version", value: "24.04" },
                { label: "org.opencontainers.image.ref.name", value: "ubuntu" },
                { label: "description", value: aim.description },
                { label: "PERSIST_VOLUME", value: "1" },
              ] },
            ] },
          ] },
        ] },
        ...(aim.compute > 0 ? [{ id: "arm64", label: "linux/arm64", blocks: [
          { type: "row" as const, blocks: [
            { type: "column" as const, blocks: [
              { type: "text" as const, content: "REQUIREMENTS & SPECS", variant: "label" as const },
              { type: "row" as const, blocks: [
                { type: "column" as const, blocks: [
                  { type: "card" as const, fields: [
                    { label: "GPU Memory", value: "N/A" },
                  ] },
                ] },
                { type: "column" as const, blocks: [
                  { type: "card" as const, fields: [
                    { label: "Image Size", value: imgSize },
                  ] },
                ] },
              ] },
              { type: "card" as const, fields: [
                { label: "Ports", value: ports.join(", "), icon: "globe" as const },
              ] },
            ] },
            { type: "column" as const, blocks: [
              { type: "table" as const, title: "Configuration Labels", searchable: true, searchPlaceholder: "Search labels...", columns: [
                { key: "label", label: "Label", mono: true, color: "yellow" as const },
                { key: "value", label: "Value" },
              ], rows: [
                { label: "GPUS", value: "0" },
                { label: "GPU_MEMORY", value: "0" },
                { label: "description", value: aim.description },
                { label: "PERSIST_VOLUME", value: "1" },
              ] },
            ] },
          ] },
        ] }] : []),
      ] },
    ] },

    // ── Metric charts (Nodes, TFLOPS, cGHz — matches HyperInsight tabs) ──
    { type: "tabs", tabs: [
      { id: "nodes-chart", label: "Nodes", icon: "server", blocks: [
        { type: "chart", chartType: "area", title: `Active Nodes (1W)`, series: [
          { name: "Nodes", data: fakeWeekly(aim.activeNodes) },
        ] },
      ] },
      { id: "tflops-chart", label: "TFLOPS", icon: "zap", blocks: [
        { type: "chart", chartType: "area", title: `Compute TFLOPS (1W)`, series: [
          { name: "TFLOPS", data: fakeWeekly(Math.round(aim.compute)) },
        ] },
      ] },
      { id: "cghz-chart", label: "cGHz", icon: "cpu", blocks: [
        { type: "chart", chartType: "area", title: `CPU cGHz (1W)`, series: [
          { name: "cGHz", data: fakeWeekly(aim.cpu) },
        ] },
      ] },
    ] },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════════

export const HYPERINSIGHT_MANIFEST = {
  manifestVersion: "1.0.0",
  id: "__demo__",
  version: "0.0.0",
  displayName: "HyperInsight",
  description: "Network analytics and AIM explorer (demo)",
  author: "HyperCycle (dev)",
  license: "MIT",
  runtime: { type: "wasm" as const, entry: "" },
  permissions: { internet: false, allowed_domains: [] as string[], files: [] as string[], services: [] as string[] },
  resources: { memory: "16m", timeout: "10s" },
  tools: {},
  ui: {
    panels: [
      { id: "leaderboard", title: "Leaderboard", icon: "trophy" },
      { id: "aims", title: "Aims", icon: "chart" },
      { id: "nodes", title: "Nodes", icon: "server" },
      { id: "aim-detail", title: "AIM Detail", hidden: true },
    ],
  },
};

const STATIC_PANELS: Record<string, ToolUIBlock[]> = {
  leaderboard: LEADERBOARD,
  aims: AIMS_PANEL,
  nodes: NODES,
};

export function HYPERINSIGHT_PANEL_DATA(
  panelId: string,
  context?: Record<string, unknown>,
): ToolUIBlock[] | undefined {
  if (panelId === "aim-detail") {
    const aimName = context?.name as string | undefined;
    const aim = aimName
      ? AIMS.find((a) => a.name === aimName)
      : AIMS[0];
    if (aim) return buildAimDetail(aim);
    return undefined;
  }
  return STATIC_PANELS[panelId];
}
