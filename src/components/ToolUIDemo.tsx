/**
 * ToolUIDemo — Interactive preview of all Tool UI features.
 *
 * Renders a ToolPanelView with mock data that exercises:
 * - Stat cards, tables, charts, sections, badges
 * - Detail Sidebar (click a table row or "Inspect" button)
 * - Confirmation Modal (click "Delete Node" or "Deploy" button)
 *
 * No WASM tool or IPC required — everything runs with mockData.
 */

import React from "react";
import { ToolPanelView } from "./ToolPanelView";
import type { ToolUIBlock, DetailPanelBlock, ConfirmModalBlock, ToastBlock } from "./tool-ui/types";
import type { ToolManifest } from "../../electron/integrations/sandbox/types";

// =============================================================================
// Mock manifest — defines the panels/tabs the demo tool "has"
// =============================================================================

const DEMO_MANIFEST: ToolManifest = {
  manifestVersion: "1",
  id: "ui-demo",
  version: "1.0.0",
  displayName: "UI Component Demo",
  description: "Interactive preview of sidebar, modal, and all block types",
  runtime: { type: "wasm", entry: "demo.wasm" },
  permissions: { internet: false, allowed_domains: [], files: [], services: [] },
  resources: { memory: "64m", timeout: "30s" },
  tools: {},
  ui: {
    panels: [
      { id: "dashboard", title: "Dashboard", icon: "activity" },
      { id: "sidebar-demo", title: "Detail Sidebar", icon: "layers" },
      { id: "modal-demo", title: "Confirm Modal", icon: "shield" },
      // Hidden panel for drill-down
      { id: "node-detail", title: "Node Detail", hidden: true },
    ],
  },
};

// =============================================================================
// Mock blocks for each panel
// =============================================================================

const dashboardBlocks: ToolUIBlock[] = [
  {
    type: "row",
    gap: 16,
    blocks: [
      { type: "stat-card", label: "Active Nodes", value: "24", subtext: "+3 today", color: "blue", icon: "server" },
      { type: "stat-card", label: "Requests / sec", value: "1,482", subtext: "p99: 42ms", color: "green", icon: "zap" },
      { type: "stat-card", label: "Error Rate", value: "0.12%", subtext: "↓ from 0.3%", color: "red", icon: "shield" },
      { type: "stat-card", label: "Uptime", value: "99.98%", subtext: "30-day avg", color: "purple", icon: "activity" },
    ],
  },
  { type: "divider" },
  {
    type: "section",
    title: "Quick Actions",
    subtitle: "Try clicking the buttons below to see the sidebar and modal",
    icon: "zap",
    blocks: [
      {
        type: "row",
        gap: 12,
        inline: true,
        blocks: [
          {
            type: "button",
            label: "Inspect Node #7",
            variant: "secondary",
            action: {
              tool: "get_node_detail",
              server: "ext:ui-demo",
              args: { nodeId: "node-7", name: "us-east-1a" },
              target: "sidebar",
            },
          },
          {
            type: "button",
            label: "Deploy New Node",
            variant: "primary",
            action: {
              tool: "deploy_node",
              server: "ext:ui-demo",
              args: { region: "eu-west-1" },
              target: "modal",
            },
          },
          {
            type: "button",
            label: "Delete Node #3",
            variant: "danger",
            action: {
              tool: "delete_node",
              server: "ext:ui-demo",
              args: { nodeId: "node-3", name: "ap-south-1a" },
              target: "modal",
            },
          },
        ],
      },
    ],
  },
  { type: "divider" },
  {
    type: "chart",
    chartType: "line",
    title: "Request Volume (24h)",
    xAxis: { label: "Hour" },
    yAxis: { label: "Requests" },
    series: [
      {
        name: "Requests",
        data: [
          { x: "00:00", y: 820 }, { x: "04:00", y: 432 }, { x: "08:00", y: 1100 },
          { x: "12:00", y: 1520 }, { x: "16:00", y: 1380 }, { x: "20:00", y: 980 },
        ],
      },
    ],
  },
];

const sidebarDemoBlocks: ToolUIBlock[] = [
  {
    type: "alert",
    level: "info",
    title: "Detail Sidebar Demo",
    message: "Click any row in the table below to open the detail sidebar on the right. You can also use the \"Inspect\" button.",
  },
  {
    type: "table",
    title: "Cluster Nodes",
    columns: [
      { key: "name", label: "Node Name" },
      { key: "region", label: "Region" },
      { key: "status", label: "Status" },
      { key: "cpu", label: "CPU %", align: "right" },
      { key: "memory", label: "Mem %", align: "right" },
    ],
    rows: [
      { name: "us-east-1a", region: "US East", status: "healthy", cpu: 42, memory: 61, nodeId: "node-1" },
      { name: "eu-west-1b", region: "EU West", status: "healthy", cpu: 38, memory: 55, nodeId: "node-2" },
      { name: "ap-south-1a", region: "AP South", status: "warning", cpu: 87, memory: 79, nodeId: "node-3" },
      { name: "us-west-2c", region: "US West", status: "healthy", cpu: 23, memory: 44, nodeId: "node-4" },
      { name: "eu-central-1a", region: "EU Central", status: "degraded", cpu: 91, memory: 88, nodeId: "node-5" },
    ],
    cellColors: {
      2: { status: "yellow", cpu: "yellow", memory: "yellow" },
      4: { status: "red", cpu: "red", memory: "red" },
    },
    searchable: true,
    searchPlaceholder: "Filter nodes...",
    onRowClick: {
      tool: "get_node_detail",
      server: "ext:ui-demo",
      target: "sidebar",
    },
  },
  { type: "divider" },
  {
    type: "row",
    gap: 12,
    inline: true,
    blocks: [
      {
        type: "button",
        label: "Inspect Node #5 (wide sidebar)",
        variant: "secondary",
        action: {
          tool: "get_node_detail_wide",
          server: "ext:ui-demo",
          args: { nodeId: "node-5", name: "eu-central-1a" },
          target: "sidebar",
        },
      },
    ],
  },
];

const modalDemoBlocks: ToolUIBlock[] = [
  {
    type: "alert",
    level: "info",
    title: "Confirmation Modal Demo",
    message: "Click the buttons below to see different severity levels of the confirmation dialog.",
  },
  {
    type: "section",
    title: "Severity Levels",
    subtitle: "Each button opens a modal with a different severity style",
    icon: "shield",
    blocks: [
      {
        type: "row",
        gap: 16,
        blocks: [
          {
            type: "column",
            blocks: [
              { type: "text", content: "Info", variant: "subheading", color: "blue" },
              { type: "text", content: "For low-risk confirmations", variant: "caption" },
              {
                type: "button",
                label: "Restart Service",
                variant: "primary",
                action: {
                  tool: "confirm_info",
                  server: "ext:ui-demo",
                  target: "modal",
                },
              },
            ],
          },
          {
            type: "column",
            blocks: [
              { type: "text", content: "Warning", variant: "subheading", color: "yellow" },
              { type: "text", content: "For operations that need caution", variant: "caption" },
              {
                type: "button",
                label: "Scale Down Cluster",
                variant: "secondary",
                action: {
                  tool: "confirm_warning",
                  server: "ext:ui-demo",
                  target: "modal",
                },
              },
            ],
          },
          {
            type: "column",
            blocks: [
              { type: "text", content: "Danger", variant: "subheading", color: "red" },
              { type: "text", content: "For destructive / irreversible actions", variant: "caption" },
              {
                type: "button",
                label: "Delete Everything",
                variant: "danger",
                action: {
                  tool: "confirm_danger",
                  server: "ext:ui-demo",
                  target: "modal",
                },
              },
            ],
          },
        ],
      },
    ],
  },
  { type: "divider" },
  {
    type: "section",
    title: "Modal with Detail Blocks",
    subtitle: "The confirmation modal can include extra content between the message and buttons",
    icon: "layers",
    blocks: [
      {
        type: "button",
        label: "Confirm Transaction",
        variant: "primary",
        action: {
          tool: "confirm_with_details",
          server: "ext:ui-demo",
          target: "modal",
        },
      },
    ],
  },
];

// =============================================================================
// Mock action responses — returns overlay blocks based on the action tool name
// =============================================================================

function getMockActionResponse(toolName: string, args: Record<string, unknown>): ToolUIBlock[] {
  const nodeName = (args.name as string) ?? "unknown";
  const nodeId = (args.nodeId as string) ?? "?";

  switch (toolName) {
    case "get_node_detail":
      return [
        { type: "toast", level: "info", message: `Inspecting ${nodeName}`, duration: 2000 } satisfies ToastBlock,
        {
          type: "detail-panel",
          title: nodeName,
          subtitle: `ID: ${nodeId}`,
          width: "medium",
          blocks: [
            {
              type: "row",
              gap: 12,
              blocks: [
                { type: "badge", label: "healthy", color: "green" },
                { type: "badge", label: (args.region as string) ?? "Unknown", color: "blue" },
              ],
              inline: true,
            },
            { type: "divider" },
            {
              type: "card",
              title: "Resource Usage",
              fields: [
                { label: "CPU", value: `${args.cpu ?? 42}%`, icon: "cpu", color: Number(args.cpu ?? 42) > 80 ? "red" : "green" },
                { label: "Memory", value: `${args.memory ?? 61}%`, icon: "database", color: Number(args.memory ?? 61) > 80 ? "red" : "green" },
                { label: "Disk", value: "34%", icon: "database", color: "green" },
                { label: "Network", value: "2.4 Gbps", icon: "globe", color: "blue" },
              ],
            },
            { type: "divider" },
            {
              type: "list",
              items: [
                { text: "Last restart: 12 days ago", icon: "info" },
                { text: "Running 3 tool instances", icon: "success" },
                { text: "7 pending updates", icon: "warning" },
              ],
            },
            { type: "divider" },
            {
              type: "row",
              gap: 8,
              inline: true,
              blocks: [
                {
                  type: "button",
                  label: "Restart",
                  variant: "secondary",
                  action: { tool: "restart_node", server: "ext:ui-demo" },
                },
                {
                  type: "button",
                  label: "Delete Node",
                  variant: "danger",
                  action: {
                    tool: "delete_node",
                    server: "ext:ui-demo",
                    args: { nodeId, name: nodeName },
                    target: "modal",
                  },
                },
              ],
            },
          ],
        } satisfies DetailPanelBlock,
      ];

    case "get_node_detail_wide":
      return [
        { type: "toast", level: "warning", title: "Node Degraded", message: `${nodeName} CPU > 90% — opening expanded view`, duration: 3000 } satisfies ToastBlock,
        {
          type: "detail-panel",
          title: nodeName,
          subtitle: `ID: ${nodeId} — Expanded View`,
          width: "wide",
          blocks: [
            { type: "alert", level: "error", title: "Node Degraded", message: "CPU usage has exceeded 90% for the last 15 minutes. Consider scaling out." },
            { type: "divider" },
            {
              type: "chart",
              chartType: "area",
              title: "CPU Usage (1h)",
              yAxis: { label: "%" },
              series: [{
                name: "CPU",
                data: [
                  { x: "0m", y: 45 }, { x: "10m", y: 52 }, { x: "20m", y: 68 },
                  { x: "30m", y: 78 }, { x: "40m", y: 88 }, { x: "50m", y: 91 }, { x: "60m", y: 93 },
                ],
              }],
            },
            { type: "divider" },
            {
              type: "table",
              title: "Running Processes",
              columns: [
                { key: "pid", label: "PID", mono: true },
                { key: "name", label: "Process" },
                { key: "cpu", label: "CPU %", align: "right" },
                { key: "mem", label: "Mem MB", align: "right" },
              ],
              rows: [
                { pid: "1842", name: "mosaic-worker", cpu: 54, mem: 256 },
                { pid: "2091", name: "wasm-runtime", cpu: 22, mem: 128 },
                { pid: "3017", name: "nginx", cpu: 8, mem: 64 },
                { pid: "4200", name: "postgres", cpu: 7, mem: 512 },
              ],
              cellColors: { 0: { cpu: "red" } },
            },
          ],
        } satisfies DetailPanelBlock,
      ];

    case "restart_node":
      return [
        { type: "toast", level: "success", title: "Node Restarted", message: `${nodeName} is restarting. ETA: ~30 seconds.`, duration: 4000 } satisfies ToastBlock,
      ];

    case "deploy_node":
      return [
        {
          type: "confirm-modal",
          title: "Deploy New Node",
          message: `You are about to deploy a new compute node in ${(args.region as string) ?? "eu-west-1"}. This will incur additional infrastructure costs.`,
          severity: "info",
          confirmLabel: "Deploy",
          cancelLabel: "Cancel",
          details: [
            {
              type: "card",
              title: "Deployment Summary",
              fields: [
                { label: "Region", value: (args.region as string) ?? "eu-west-1", icon: "globe" },
                { label: "Instance Type", value: "c5.xlarge", icon: "cpu" },
                { label: "Estimated Cost", value: "$0.17/hr", icon: "zap", color: "yellow" },
              ],
            },
          ],
          confirmAction: {
            tool: "execute_deploy",
            server: "ext:ui-demo",
            args: { region: args.region },
          },
        } satisfies ConfirmModalBlock,
      ];

    case "delete_node":
      return [
        {
          type: "confirm-modal",
          title: "Delete Node",
          message: `Are you sure you want to permanently delete "${nodeName}" (${nodeId})? This action cannot be undone.`,
          severity: "danger",
          confirmLabel: "Delete Permanently",
          cancelLabel: "Keep Node",
          details: [
            {
              type: "alert",
              level: "warning",
              message: "All running tasks on this node will be terminated. Data that hasn't been replicated may be lost.",
            },
          ],
          confirmAction: {
            tool: "execute_delete",
            server: "ext:ui-demo",
            args: { nodeId },
          },
        } satisfies ConfirmModalBlock,
      ];

    case "confirm_info":
      return [
        {
          type: "confirm-modal",
          title: "Restart Service",
          message: "The service will be briefly unavailable during the restart. Active connections will be gracefully drained.",
          severity: "info",
          confirmLabel: "Restart Now",
          confirmAction: { tool: "execute_restart", server: "ext:ui-demo" },
        } satisfies ConfirmModalBlock,
      ];

    case "confirm_warning":
      return [
        {
          type: "confirm-modal",
          title: "Scale Down Cluster",
          message: "Scaling from 8 nodes to 4 nodes. This may affect performance during peak hours. The operation takes ~5 minutes.",
          severity: "warning",
          confirmLabel: "Scale Down",
          cancelLabel: "Keep Current Size",
          confirmAction: { tool: "execute_scale", server: "ext:ui-demo", args: { nodes: 4 } },
        } satisfies ConfirmModalBlock,
      ];

    case "confirm_danger":
      return [
        {
          type: "confirm-modal",
          title: "Delete All Data",
          message: "This will permanently delete all nodes, configurations, and stored data. This action is irreversible.",
          severity: "danger",
          confirmLabel: "Delete Everything",
          cancelLabel: "Cancel",
          details: [
            { type: "list", items: [
              { text: "24 nodes will be terminated", icon: "error" },
              { text: "156 GB of data will be erased", icon: "error" },
              { text: "All API keys will be revoked", icon: "warning" },
            ]},
          ],
          confirmAction: { tool: "execute_delete_all", server: "ext:ui-demo" },
        } satisfies ConfirmModalBlock,
      ];

    case "confirm_with_details":
      return [
        {
          type: "confirm-modal",
          title: "Confirm Transaction",
          message: "Review the transaction details below before confirming.",
          severity: "warning",
          confirmLabel: "Sign & Send",
          cancelLabel: "Reject",
          details: [
            {
              type: "card",
              title: "Transaction",
              fields: [
                { label: "From", value: "0x1a2b...9f0e", icon: "hash", color: "blue" },
                { label: "To", value: "0x8c7d...3a1b", icon: "hash", color: "purple" },
                { label: "Amount", value: "1,250.00 HYPC", icon: "zap", color: "green" },
                { label: "Gas Fee", value: "0.0042 ETH", icon: "zap", color: "yellow" },
              ],
            },
          ],
          confirmAction: { tool: "execute_tx", server: "ext:ui-demo" },
        } satisfies ConfirmModalBlock,
      ];

    default:
      // Fallback: fire a toast for execute_* actions (post-confirm)
      if (toolName.startsWith("execute_")) {
        const labels: Record<string, [string, string, ToastBlock["level"]]> = {
          execute_deploy:     ["Node Deployed",      "New node is initializing in the target region.",              "success"],
          execute_delete:     ["Node Deleted",       `Node ${nodeId} has been permanently removed.`,               "success"],
          execute_restart:    ["Service Restarted",  "All connections drained. Service is back online.",            "success"],
          execute_scale:      ["Cluster Scaled",     "Scale-down to 4 nodes in progress (~5 min).",                "info"],
          execute_delete_all: ["Data Deleted",       "All nodes, configs, and data have been permanently erased.", "warning"],
          execute_tx:         ["Transaction Sent",   "1,250.00 HYPC sent. Awaiting confirmation.",                 "success"],
        };
        const [title, message, level] = labels[toolName] ?? ["Action Complete", `${toolName} executed successfully.`, "success" as const];
        return [
          { type: "toast", level, title, message, duration: 5000 } satisfies ToastBlock,
        ];
      }
      // Other unknown actions
      return [
        { type: "toast", level: "info", message: `Mock action "${toolName}" executed.` } satisfies ToastBlock,
      ];
  }
}

// =============================================================================
// Mock data provider — function form so ToolPanelView calls it per panel
// =============================================================================

const STATIC_PANELS: Record<string, ToolUIBlock[]> = {
  dashboard: dashboardBlocks,
  "sidebar-demo": sidebarDemoBlocks,
  "modal-demo": modalDemoBlocks,
};

/**
 * Dynamic mock data provider.
 *
 * ToolPanelView's handleAction currently logs mock actions and doesn't re-render.
 * So we override handleAction behavior by hooking into the mockData function when
 * panels request dynamic data. For the static panels, we return the predefined blocks.
 */
function mockDataProvider(panelId: string, _context?: Record<string, unknown>): ToolUIBlock[] | undefined {
  return STATIC_PANELS[panelId];
}

// =============================================================================
// Component
// =============================================================================

export const ToolUIDemo: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
      <ToolPanelView
        toolId="ui-demo"
        manifest={DEMO_MANIFEST}
        mockData={mockDataProvider}
        mockActionHandler={getMockActionResponse}
      />
    </div>
  );
};
