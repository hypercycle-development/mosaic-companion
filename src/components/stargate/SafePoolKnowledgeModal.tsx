import React, { useState } from "react";
import { 
  X, 
  Truck, 
  Wallet, 
  Zap, 
  Bot, 
  Shield, 
  Globe,
  ChevronRight,
  Play,
  Users,
  Cpu
} from "lucide-react";

interface SafePoolKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSimulation?: () => void;
  onStartSoftLaunch?: () => void;
}

const SafePoolKnowledgeModal: React.FC<SafePoolKnowledgeModalProps> = ({ isOpen, onClose, onStartSimulation, onStartSoftLaunch }) => {
  const [activeSection, setActiveSection] = useState<"how" | "revenue" | "triggers" | "test">("how");

  if (!isOpen) return null;

  const sections = {
    how: {
      icon: <Bot size={20} />,
      title: "How It Works",
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      borderColor: "border-cyan-500/30",
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">1</div>
            <div>
              <p className="font-medium text-white">Post Load</p>
              <p className="text-sm text-gray-400">Shipper posts freight → Shipper Agent broadcasts to matching Driver Twins</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-sm">2</div>
            <div>
              <p className="font-medium text-white">AI Matching</p>
              <p className="text-sm text-gray-400">Driver Twins bid → Matching Engine scores → Best match wins</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-sm">3</div>
            <div>
              <p className="font-medium text-white">Negotiate</p>
              <p className="text-sm text-gray-400">A2A protocol negotiates price (avg 2.3 rounds, max 3)</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">4</div>
            <div>
              <p className="font-medium text-white">Escrow Lock</p>
              <p className="text-sm text-gray-400">Shipper deposits USDC → Smart contract holds funds until delivery</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-sm">5</div>
            <div>
              <p className="font-medium text-white">Execute</p>
              <p className="text-sm text-gray-400">Driver transports → GPS tracking → Uploads proof of delivery</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30">
            <div className="w-8 h-8 rounded-full bg-green-500/30 flex items-center justify-center text-green-400 font-bold text-sm">6</div>
            <div>
              <p className="font-medium text-green-400">Instant Payment</p>
              <p className="text-sm text-gray-300">Driver gets <span className="text-green-400 font-bold">96.5%</span> in <span className="text-green-400 font-bold">under 30s</span> → Node gets 1.5% → Platform gets 1.5%</p>
            </div>
          </div>
        </div>
      )
    },
    revenue: {
      icon: <Wallet size={20} />,
      title: "Revenue Model",
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30",
      content: (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-500/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400">Total Fee</span>
              <span className="text-2xl font-bold text-green-400">3.5%</span>
            </div>
            <div className="text-xs text-gray-500 mb-3">(vs AnyVan 15%)</div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-300">Driver keeps</span>
                </div>
                <span className="text-sm font-bold text-green-400">96.5%</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-300">Platform</span>
                </div>
                <span className="text-sm font-bold text-blue-400">1.5%</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="text-sm text-gray-300">Node Operator</span>
                </div>
                <span className="text-sm font-bold text-purple-400">1.5%</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-sm text-gray-300">Tiller Rewards</span>
                </div>
                <span className="text-sm font-bold text-orange-400">0.5%</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <p className="text-sm text-gray-300 mb-2">
              <span className="text-purple-400 font-medium">💡 Node Revenue Sharing:</span> Node operators earn passive income from every transaction.
            </p>
            <p className="text-xs text-gray-500">
              More nodes = more coverage = more revenue. Nodes can spawn new nodes for regional expansion.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 text-center">
              <p className="text-2xl font-bold text-green-400">£15,750</p>
              <p className="text-xs text-gray-500">Monthly revenue @ 1,000 loads</p>
            </div>
            
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 text-center">
              <p className="text-2xl font-bold text-blue-400">£51,750</p>
              <p className="text-xs text-gray-500">Shipper savings vs AnyVan</p>
            </div>
          </div>
        </div>
      )
    },
    triggers: {
      icon: <Zap size={20} />,
      title: "Vault Triggers",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30",
      content: (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <div className="p-1.5 rounded bg-green-500/20">
              <Bot size={14} className="text-green-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white text-sm">New Load Posted</p>
              <p className="text-xs text-gray-400">Agent auto-matches immediately using constraint scoring</p>
            </div>
            <span className="text-xs text-green-400 px-2 py-1 rounded bg-green-500/10">AUTO</span>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <div className="p-1.5 rounded bg-blue-500/20">
              <Wallet size={14} className="text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white text-sm">Bid Received</p>
              <p className="text-xs text-gray-400">Agent scores and ranks using multi-factor algorithm</p>
            </div>
            <span className="text-xs text-blue-400 px-2 py-1 rounded bg-blue-500/10">SCORE</span>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <div className="p-1.5 rounded bg-yellow-500/20">
              <Zap size={14} className="text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white text-sm">Negotiation Timeout</p>
              <p className="text-xs text-gray-400">Auto-accepts best offer if within 5% of target</p>
            </div>
            <span className="text-xs text-yellow-400 px-2 py-1 rounded bg-yellow-500/10">TIMEOUT</span>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <div className="p-1.5 rounded bg-purple-500/20">
              <Shield size={14} className="text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white text-sm">Delivery Confirmed</p>
              <p className="text-xs text-gray-400">Releases escrow &amp; triggers instant USDC payment</p>
            </div>
            <span className="text-xs text-purple-400 px-2 py-1 rounded bg-purple-500/10">PAY</span>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <div className="p-1.5 rounded bg-red-500/20">
              <Globe size={14} className="text-red-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white text-sm">Dispute Raised</p>
              <p className="text-xs text-gray-400">Escalates to human with full transaction log</p>
            </div>
            <span className="text-xs text-red-400 px-2 py-1 rounded bg-red-500/10">ESCALATE</span>
          </div>
        </div>
      )
    },
    test: {
      icon: <Play size={20} />,
      title: "Ready to Test?",
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      borderColor: "border-cyan-500/30",
      content: (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Cpu size={24} className="text-cyan-400" />
              </div>
              <div>
                <p className="font-bold text-white">Infrastructure Ready</p>
                <p className="text-sm text-gray-400">C-3PO has 128 tiller slots available</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded bg-gray-800/50">
                <p className="text-xl font-bold text-green-400">✓</p>
                <p className="text-xs text-gray-500">Driver Digital Twin</p>
              </div>
              <div className="p-2 rounded bg-gray-800/50">
                <p className="text-xl font-bold text-green-400">✓</p>
                <p className="text-xs text-gray-500">Shipper Agent</p>
              </div>
              <div className="p-2 rounded bg-gray-800/50">
                <p className="text-xl font-bold text-green-400">✓</p>
                <p className="text-xs text-gray-500">Matching Engine</p>
              </div>
              <div className="p-2 rounded bg-gray-800/50">
                <p className="text-xl font-bold text-green-400">✓</p>
                <p className="text-xs text-gray-500">Settlement Service</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-white">Testing Options:</p>
            
            <button 
              onClick={() => {
                if (onStartSimulation) {
                  onStartSimulation();
                  onClose();
                } else {
                  alert('Simulated Mode: Create 50 synthetic loads to test matching algorithms without real drivers.');
                }
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all text-left"
            >
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Bot size={18} className="text-cyan-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white text-sm">Simulated Mode</p>
                <p className="text-xs text-gray-500">No drivers needed. Test with 50 fake loads.</p>
              </div>
              <ChevronRight size={16} className="text-gray-500" />
            </button>
            
            <button 
              onClick={() => {
                if (onStartSoftLaunch) {
                  onStartSoftLaunch();
                  onClose();
                } else {
                  alert('Soft Launch: Recruit 10 beta drivers from your network to run real loads with manual supervision.');
                }
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-green-500/50 hover:bg-green-500/5 transition-all text-left"
            >
              <div className="p-2 rounded-lg bg-green-500/20">
                <Users size={18} className="text-green-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white text-sm">Soft Launch</p>
                <p className="text-xs text-gray-500">Need 10 beta drivers. Real loads, supervised.</p>
              </div>
              <ChevronRight size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <p className="text-xs text-gray-500 text-center">
              <span className="text-cyan-400">💡 Recommendation:</span> Start with simulated mode to verify algorithms, then recruit 10 drivers for soft launch.
            </p>
          </div>
        </div>
      )
    }
  };

  const currentSection = sections[activeSection];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 bg-gradient-to-r from-green-900/20 to-emerald-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Truck size={24} className="text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">SAFE Rev Pool</h2>
                <p className="text-sm text-gray-400">Knowledge Base</p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-800">
          {(Object.keys(sections) as Array<keyof typeof sections>).map((key) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-all ${
                activeSection === key
                  ? `${sections[key].color} ${sections[key].bgColor} border-b-2 ${sections[key].borderColor}`
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
              }`}
            >
              {sections[key].icon}
              {sections[key].title}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {currentSection.content}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-950/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              128 slots ready on C-3PO
            </div>
            
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafePoolKnowledgeModal;