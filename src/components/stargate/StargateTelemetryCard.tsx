// =============================================================================
// STARGATE TELEMETRY CARD — Live node compute + AIM + Ollama dashboard
// =============================================================================
// Replaces the static node card in the Start tab with real-time gauges.
// Uses Tailwind CSS + lucide-react to match existing Mosaic styling.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { Cpu, HardDrive, MemoryStick, Bot, Activity, Server, ExternalLink, CheckCircle2, XCircle, Loader } from 'lucide-react';
import { enhancedLocalNodeBridge, ExtendedBridgeTelemetry } from '../../services/stargate/EnhancedLocalNodeBridge';
import { BridgeAIM } from '../../services/LocalNodeBridge';

const TelemetryCard: React.FC = () => {
  const [telemetry, setTelemetry] = useState<ExtendedBridgeTelemetry | null>(null);

  useEffect(() => {
    enhancedLocalNodeBridge.refresh().then(setTelemetry);
    enhancedLocalNodeBridge.startPolling();
    const unsub = enhancedLocalNodeBridge.onUpdate(setTelemetry);
    return () => {
      enhancedLocalNodeBridge.stopPolling();
      unsub();
    };
  }, []);

  if (!telemetry) {
    return (
      <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 opacity-70">
        <h4 className="font-medium text-white">Node Telemetry</h4>
        <p className="text-sm text-gray-400 mt-1">Local HyperCycle node not detected</p>
      </div>
    );
  }

  const computeGrade = telemetry.memoryFreeGB >= 8 ? 'High' : telemetry.memoryFreeGB >= 4 ? 'Medium' : 'Standard';
  const gradeColor = computeGrade === 'High' ? 'text-green-400' : computeGrade === 'Medium' ? 'text-yellow-400' : 'text-gray-400';

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700/50">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-cyan-400">Node Telemetry</h4>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 ${gradeColor}`}>{computeGrade}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Gauge label="CPU" value={telemetry.cpuPercent} icon={<Cpu size={14} />} colorClass="text-cyan-400" />
        <Gauge label="Memory" used={telemetry.memoryUsedGB} total={telemetry.memoryUsedGB + telemetry.memoryFreeGB} icon={<MemoryStick size={14} />} colorClass="text-purple-400" unit="GB" />
        <Gauge label="Disk" used={telemetry.diskUsedGB} total={telemetry.diskUsedGB + telemetry.diskFreeGB} icon={<HardDrive size={14} />} colorClass="text-blue-400" unit="GB" />
        <Gauge label="AIM Slots" used={telemetry.runningAims.length} total={telemetry.totalAimSlots} icon={<Bot size={14} />} colorClass="text-green-400" />
      </div>

      {telemetry.runningAims.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Running AIMs ({telemetry.runningAims.length}/{telemetry.totalAimSlots})</p>
          <div className="flex flex-wrap gap-1.5">
            {telemetry.runningAims.map((aim) => (
              <span
                key={aim.imageId}
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  aim.status === 'running'
                    ? 'border-green-500/30 text-green-400 bg-green-500/10'
                    : 'border-gray-600 text-gray-400 bg-gray-800'
                }`}
                title={`Port: ${aim.port} | Slot: ${aim.slot}`}
              >
                {aim.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {telemetry.ollamaModels.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Ollama Models ({telemetry.ollamaModels.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {telemetry.ollamaModels.map((model) => (
              <span
                key={model.name}
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  model.loaded
                    ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10'
                    : 'border-gray-600 text-gray-400 bg-gray-800'
                }`}
              >
                {model.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {telemetry.merklizerReachable ? (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle2 size={12} /> Merkelizer
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <XCircle size={12} /> Merkelizer
          </span>
        )}
        {telemetry.hermesInstances.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-purple-400">
            <Server size={12} /> Hermes ×{telemetry.hermesInstances.length}
          </span>
        )}
      </div>
    </div>
  );
};

const Gauge: React.FC<{
  label: string;
  value?: number;
  used?: number;
  total?: number;
  icon: React.ReactNode;
  colorClass: string;
  unit?: string;
}> = ({ label, value, used, total, icon, colorClass, unit }) => {
  const pct =
    value != null
      ? value
      : total != null && total > 0 && used != null
      ? (used / total) * 100
      : 0;
  const isBytes = label === 'Memory' || label === 'Disk';
  const text = isBytes
    ? `${used?.toFixed(1) || 0} / ${total?.toFixed(1) || 0} ${unit || 'GB'}`
    : label === 'AIM Slots'
    ? `${used || 0} / ${total || 8}`
    : `${pct.toFixed(0)}%`;

  const barColor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-cyan-400';

  return (
    <div className="bg-gray-900/60 rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={colorClass}>{icon}</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-sm font-semibold text-white mb-1.5">{text}</div>
      <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
};

export default TelemetryCard;
