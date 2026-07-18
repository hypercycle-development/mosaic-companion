// =============================================================================
// PRIVACY VAULT DEMO — Arduino TinyML Hackathon Proof of Concept
// =============================================================================
// Thesis: AI can process sensitive user data WITHOUT ever exposing the
// underlying information to the model provider or the network.
//
// MosAIc solves this through three layers:
//   1. LOCAL inference (Ollama / local models) — data never leaves the device
//   2. VAULT boxes with granular agent access control — each agent sees only
//      what the user explicitly grants
//   3. WASM sandboxed tools + MCP skills — even tool code runs restricted
//
// This demo visualises the box-access flow in real time.
// =============================================================================

import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Database,
  Brain,
  Bot,
  CheckCircle,
  XCircle,
  Server,
  Cpu,
  Zap,
  ChevronRight,
  FileText,
  User,
  Key,
  Globe,
  AlertTriangle,
  Activity,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface DemoVaultBox {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  contents: string[];
  sensitivity: "public" | "restricted" | "secret";
}

interface DemoAgent {
  id: string;
  name: string;
  avatar: string;
  model: string;
  provider: string;
  runtime: "local" | "cloud";
  grantedBoxes: string[];
}

// ── Static Data ──────────────────────────────────────────────────────────────

const DEMO_BOXES: DemoVaultBox[] = [
  {
    id: "box-health",
    name: "Health Records",
    icon: <Activity size={18} />,
    color: "rose",
    description: "Heart-rate trends, sleep quality, blood-pressure logs from wearable devices.",
    contents: [
      "Heart rate avg: 62 bpm (last 7 days)",
      "Sleep score: 84/100 — deep sleep 2h 14m",
      "Blood pressure: 118/76 mmHg (morning)",
      "Glucose: 94 mg/dL fasting",
    ],
    sensitivity: "secret",
  },
  {
    id: "box-finance",
    name: "Financial Data",
    icon: <Database size={18} />,
    color: "amber",
    description: "Bank statements, investment portfolios, crypto wallet addresses.",
    contents: [
      "Checking: $4,231.50 | Savings: $12,400.00",
      "ETH wallet: 0x71C...9A3E",
      "Portfolio: 60% stocks, 30% bonds, 10% crypto",
      "Monthly spend: $2,847 (groceries $412, rent $1,200)",
    ],
    sensitivity: "secret",
  },
  {
    id: "box-journal",
    name: "Private Journal",
    icon: <FileText size={18} />,
    color: "indigo",
    description: "Personal diary entries, therapy notes, creative writing.",
    contents: [
      "Therapy session 14-Jul: Discussed work stress coping strategies.",
      "Dream log: Flying over a city made of glass towers.",
      "Gratitude: Three things I'm thankful for today...",
    ],
    sensitivity: "restricted",
  },
  {
    id: "box-midnight",
    name: "Midnight City Skills",
    icon: <Zap size={18} />,
    color: "cyan",
    description: "Privacy-preserving blockchain skills (ZK circuits, Compact contracts).",
    contents: [
      "midnight-compact-core-basic-start",
      "midnight-verify-verify-compact",
      "midnight-tooling-devnet",
      "SAFE Rev Pool Operations",
    ],
    sensitivity: "public",
  },
  {
    id: "box-calendar",
    name: "Calendar & Travel",
    icon: <Globe size={18} />,
    color: "emerald",
    description: "Upcoming trips, meeting schedules, location history.",
    contents: [
      "Flight AA2847 — LHR → JFK — 22 Jul 06:40",
      "Hotel: Marriott Midtown — confirmation #48291",
      "Dentist appt: 19 Jul 14:00",
    ],
    sensitivity: "restricted",
  },
];

const DEMO_AGENTS: DemoAgent[] = [
  {
    id: "agent-health",
    name: "Dr. Ada (Health Coach)",
    avatar: "🩺",
    model: "llama3.2:3b",
    provider: "Ollama (Local)",
    runtime: "local",
    grantedBoxes: ["box-health", "box-calendar"],
  },
  {
    id: "agent-finance",
    name: "FinBot (Wealth Advisor)",
    avatar: "💰",
    model: "qwen2.5-coder:7b",
    provider: "Ollama (Local)",
    runtime: "local",
    grantedBoxes: ["box-finance", "box-calendar"],
  },
  {
    id: "agent-general",
    name: "Mosaic Assistant",
    avatar: "🤖",
    model: "gpt-4o-mini",
    provider: "OpenAI (Cloud)",
    runtime: "cloud",
    grantedBoxes: ["box-midnight"],
  },
  {
    id: "agent-midnight",
    name: "Zero-Knight (ZK Dev)",
    avatar: "⚔️",
    model: "qwen2.5:32b",
    provider: "Ollama (Local)",
    runtime: "local",
    grantedBoxes: ["box-midnight", "box-journal"],
  },
];

// ── Color helpers ────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  rose:    { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400", glow: "shadow-rose-500/20" },
  amber:   { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", glow: "shadow-amber-500/20" },
  indigo:  { bg: "bg-indigo-500/10", border: "border-indigo-500/30", text: "text-indigo-400", glow: "shadow-indigo-500/20" },
  cyan:    { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400", glow: "shadow-cyan-500/20" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", glow: "shadow-emerald-500/20" },
};

// ── Components ───────────────────────────────────────────────────────────────

const SensitivityBadge: React.FC<{ level: string }> = ({ level }) => {
  const map: Record<string, { label: string; cls: string }> = {
    public:     { label: "Public", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
    restricted: { label: "Restricted", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    secret:     { label: "Secret", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  };
  const s = map[level] || map.public;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  );
};

// ── Main Demo Page ───────────────────────────────────────────────────────────

export const PrivacyVaultDemo: React.FC = () => {
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simLog, setSimLog] = useState<string[]>([]);
  const [grantedBoxes, setGrantedBoxes] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    DEMO_AGENTS.forEach((a) => { init[a.id] = [...a.grantedBoxes]; });
    return init;
  });

  const toggleBoxAccess = (agentId: string, boxId: string) => {
    setGrantedBoxes((prev) => {
      const current = new Set(prev[agentId] || []);
      if (current.has(boxId)) current.delete(boxId);
      else current.add(boxId);
      return { ...prev, [agentId]: Array.from(current) };
    });
  };

  const runSimulation = useCallback(async () => {
    if (!selectedAgent || !selectedBox) return;
    setSimulating(true);
    setSimLog([]);
    const agent = DEMO_AGENTS.find((a) => a.id === selectedAgent)!;
    const box = DEMO_BOXES.find((b) => b.id === selectedBox)!;
    const hasAccess = grantedBoxes[agent.id]?.includes(box.id);

    const logs: string[] = [];
    const push = (msg: string) => { logs.push(msg); setSimLog([...logs]); };

    push(`▶️  Agent "${agent.name}" requests box "${box.name}"`);
    await new Promise((r) => setTimeout(r, 600));
    push(`🔍  Runtime: ${agent.provider} (${agent.runtime.toUpperCase()})`);
    await new Promise((r) => setTimeout(r, 600));

    if (agent.runtime === "local") {
      push(`✅  Data stays on-device — no network egress`);
    } else {
      push(`⚠️  Cloud model — data leaves device (privacy risk)`);
    }
    await new Promise((r) => setTimeout(r, 700));

    push(`🔐  Checking vault access for agentId=${agent.id} → boxId=${box.id}`);
    await new Promise((r) => setTimeout(r, 800));

    if (hasAccess) {
      push(`✅  ACCESS GRANTED — ${box.contents.length} entries returned`);
      await new Promise((r) => setTimeout(r, 500));
      box.contents.forEach((c, i) => {
        push(`   📄 entry-${i + 1}: ${c.slice(0, 60)}${c.length > 60 ? "…" : ""}`);
      });
      push(`🛡️  Agent can now process this data — user remains in control`);
    } else {
      push(`❌  ACCESS DENIED — agent does not have boxAccess for "${box.name}"`);
      await new Promise((r) => setTimeout(r, 500));
      push(`🔒  Vault enforces read boundary — zero data leakage`);
    }

    await new Promise((r) => setTimeout(r, 400));
    setSimulating(false);
  }, [selectedAgent, selectedBox, grantedBoxes]);

  const activeAgent = DEMO_AGENTS.find((a) => a.id === selectedAgent);
  const activeBox = DEMO_BOXES.find((b) => b.id === selectedBox);

  return (
    <div className="h-full overflow-y-auto bg-gray-950 text-gray-100">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-gray-900 border-b border-gray-800">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl" />
        </div>
        <div className="relative p-6 max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Privacy-Preserving AI</h1>
              <p className="text-xs text-gray-400">Arduino TinyML Challenge — Proof of Concept</p>
            </div>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed max-w-2xl">
            MosAIc demonstrates that <strong>powerful AI doesn't require exposing personal data</strong>.
            Through local inference + granular vault access, sensitive information stays under user control
            while AI agents process only what they're explicitly allowed to see.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* ── Architecture Diagram ───────────────────────────────────────── */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Cpu size={16} className="text-cyan-400" /> Architecture — Three Privacy Layers
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <LayerCard
              num="1"
              title="Local Inference"
              icon={<Server size={18} className="text-purple-400" />}
              desc="Ollama runs models on your machine. Data never leaves the device. No API keys, no cloud logging."
              color="purple"
            />
            <LayerCard
              num="2"
              title="Vault Access Control"
              icon={<Lock size={18} className="text-indigo-400" />}
              desc="Each agent has a boxAccess list. The vault enforces read boundaries at the OS level."
              color="indigo"
            />
            <LayerCard
              num="3"
              title="Sandboxed Tools"
              icon={<Shield size={18} className="text-emerald-400" />}
              desc="WASM tools run zero-trust. MCP skills declare permissions upfront. No runtime escalation."
              color="emerald"
            />
          </div>
        </section>

        {/* ── Main Interactive Grid ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Vault Boxes */}
          <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Database size={16} className="text-rose-400" /> Vault Boxes (Sensitive Data)
            </h2>
            <div className="space-y-2">
              {DEMO_BOXES.map((box) => {
                const c = COLOR_MAP[box.color] || COLOR_MAP.emerald;
                const isSelected = selectedBox === box.id;
                return (
                  <button
                    key={box.id}
                    onClick={() => setSelectedBox(box.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? `${c.bg} ${c.border} ring-1 ring-offset-0 ring-offset-gray-900 ${c.glow} shadow-lg`
                        : "bg-gray-950/50 border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                        <span className={c.text}>{box.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{box.name}</span>
                          <SensitivityBadge level={box.sensitivity} />
                        </div>
                        <p className="text-[10px] text-gray-500 truncate">{box.description}</p>
                      </div>
                      {isSelected && <ChevronRight size={14} className={c.text} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {activeBox && (
              <div className="mt-4 p-3 rounded-lg bg-gray-950 border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Box Contents Preview</p>
                <div className="space-y-1.5">
                  {activeBox.contents.map((c, i) => (
                    <div key={i} className="text-xs text-gray-300 font-mono bg-gray-900/50 px-2 py-1 rounded border border-gray-800/50 truncate">
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Right: Agents & Access Matrix */}
          <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Bot size={16} className="text-cyan-400" /> AI Agents & Access Control
            </h2>
            <div className="space-y-2">
              {DEMO_AGENTS.map((agent) => {
                const isSelected = selectedAgent === agent.id;
                const isLocal = agent.runtime === "local";
                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "bg-cyan-500/5 border-cyan-500/30 ring-1 ring-cyan-500/20"
                        : "bg-gray-950/50 border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-xl">{agent.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{agent.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isLocal ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                            {isLocal ? "Local" : "Cloud"}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500">
                          {agent.model} · {agent.provider}
                        </p>
                      </div>
                      {isSelected && <ChevronRight size={14} className="text-cyan-400" />}
                    </div>

                    {/* Mini access pills */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {DEMO_BOXES.map((box) => {
                        const hasAccess = grantedBoxes[agent.id]?.includes(box.id);
                        return (
                          <span
                            key={box.id}
                            className={`text-[9px] px-1.5 py-0.5 rounded border ${
                              hasAccess
                                ? "bg-green-500/10 text-green-400 border-green-500/30"
                                : "bg-gray-800 text-gray-600 border-gray-700"
                            }`}
                          >
                            {hasAccess ? "✓" : "✗"} {box.name}
                          </span>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Access Toggle for selected agent */}
            {activeAgent && (
              <div className="mt-4 p-3 rounded-lg bg-gray-950 border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                  Toggle Access for {activeAgent.name}
                </p>
                <div className="space-y-1.5">
                  {DEMO_BOXES.map((box) => {
                    const hasAccess = grantedBoxes[activeAgent.id]?.includes(box.id);
                    return (
                      <button
                        key={box.id}
                        onClick={() => toggleBoxAccess(activeAgent.id, box.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-all ${
                          hasAccess
                            ? "bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20"
                            : "bg-gray-900 text-gray-500 border border-gray-800 hover:border-gray-600"
                        }`}
                      >
                        {hasAccess ? <Unlock size={12} /> : <Lock size={12} />}
                        <span className="flex-1 text-left">{box.name}</span>
                        {hasAccess ? "Granted" : "Denied"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ── Live Simulation ────────────────────────────────────────────── */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Brain size={16} className="text-purple-400" /> Live Access Simulation
            </h2>
            <div className="flex items-center gap-2">
              {activeAgent && activeBox ? (
                <span className="text-[10px] text-gray-400">
                  {activeAgent.name} → {activeBox.name}
                </span>
              ) : (
                <span className="text-[10px] text-gray-600">Select an agent and a box above</span>
              )}
              <button
                onClick={runSimulation}
                disabled={!activeAgent || !activeBox || simulating}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                {simulating ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                Run Simulation
              </button>
            </div>
          </div>

          <div className="bg-black rounded-lg border border-gray-800 p-4 font-mono text-xs min-h-[200px] space-y-1">
            {simLog.length === 0 && !simulating && (
              <div className="text-gray-600 italic flex items-center gap-2">
                <AlertTriangle size={14} />
                Select an agent and a vault box, then click Run Simulation to see the privacy boundary in action.
              </div>
            )}
            {simLog.map((line, i) => (
              <div
                key={i}
                className={`${
                  line.startsWith("✅")
                    ? "text-green-400"
                    : line.startsWith("❌")
                    ? "text-red-400"
                    : line.startsWith("⚠️")
                    ? "text-amber-400"
                    : line.startsWith("🔐") || line.startsWith("🔒")
                    ? "text-indigo-400"
                    : line.startsWith("🛡️")
                    ? "text-cyan-400"
                    : "text-gray-400"
                }`}
              >
                {line}
              </div>
            ))}
            {simulating && (
              <div className="text-gray-600 animate-pulse">▌</div>
            )}
          </div>
        </section>

        {/* ── Midnight City + MCP Integration ────────────────────────────── */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Zap size={16} className="text-cyan-400" /> Battle Tested: Midnight City Skills in Boxes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FeatureCard
              icon={<Key size={16} className="text-cyan-400" />}
              title="ZK Contract Skills"
              desc="Midnight Compact contract generation, compilation, and review tools loaded as vault entries. Agents access them only when granted."
            />
            <FeatureCard
              icon={<Bot size={16} className="text-purple-400" />}
              title="Son of Anton Agents"
              desc="Midnight City digital twins run autonomously. Their memory and skills are stored in vault boxes with fine-grained access."
            />
            <FeatureCard
              icon={<Activity size={16} className="text-emerald-400" />}
              title="MCP Server Bridge"
              desc="Midnight MCP servers expose 21 privacy-preserving tools. MosAIc maps them into the ToolRegistry — same vault rules apply."
            />
          </div>
        </section>

        {/* ── Comparison Table ───────────────────────────────────────────── */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <EyeOff size={16} className="text-rose-400" /> Privacy Comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left py-2 px-3">Approach</th>
                  <th className="text-center py-2 px-3">Data Leaves Device</th>
                  <th className="text-center py-2 px-3">Granular Access</th>
                  <th className="text-center py-2 px-3">User Control</th>
                  <th className="text-center py-2 px-3">Audit Trail</th>
                  <th className="text-center py-2 px-3">Local Models</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                <TableRow
                  label="Standard Cloud AI (ChatGPT, Claude)"
                  data={["✗ Yes", "✗ None", "✗ Low", "✗ None", "✗ No"]}
                  bad
                />
                <TableRow
                  label="On-Device Only (Apple Intelligence)"
                  data={["✓ No", "✗ App-level only", "△ Limited", "△ OS-controlled", "✓ Yes"]}
                />
                <TableRow
                  label="MosAIc Vault + Local AI"
                  data={["✓ No", "✓ Per-box, per-agent", "✓ High", "✓ JSONL chronicle", "✓ Yes"]}
                  good
                />
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="text-center py-6 text-gray-600 text-xs">
          <p>
            Built with MosAIc Companion · Vault module · Ollama local inference · WASM sandbox · MCP skills
          </p>
          <p className="mt-1">
            Stargate Pool · Midnight City · Battery Validator Fleet · HyperCycle Node Manager
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ───────────────────────────────────────────────────────────

function LayerCard({ num, title, icon, desc, color }: {
  num: string; title: string; icon: React.ReactNode; desc: string; color: string;
}) {
  const border = { purple: "border-purple-500/30", indigo: "border-indigo-500/30", emerald: "border-emerald-500/30" }[color] || "border-gray-700";
  const bg = { purple: "bg-purple-500/5", indigo: "bg-indigo-500/5", emerald: "bg-emerald-500/5" }[color] || "bg-gray-900";
  return (
    <div className={`p-3 rounded-lg border ${border} ${bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold text-gray-500">Layer {num}</span>
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-[11px] text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="p-3 rounded-lg bg-gray-950 border border-gray-800 hover:border-gray-700 transition-colors">
      <div className="mb-2">{icon}</div>
      <h3 className="text-xs font-semibold text-white mb-1">{title}</h3>
      <p className="text-[11px] text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function TableRow({ label, data, good, bad }: { label: string; data: string[]; good?: boolean; bad?: boolean }) {
  return (
    <tr className={good ? "bg-green-500/5" : bad ? "bg-red-500/5" : ""}>
      <td className="py-2 px-3 text-gray-300 font-medium">{label}</td>
      {data.map((d, i) => (
        <td key={i} className={`py-2 px-3 text-center ${d.startsWith("✓") ? "text-green-400" : d.startsWith("✗") ? "text-red-400" : "text-amber-400"}`}>
          {d}
        </td>
      ))}
    </tr>
  );
}

export default PrivacyVaultDemo;
