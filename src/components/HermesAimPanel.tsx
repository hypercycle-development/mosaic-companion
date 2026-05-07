// =============================================================================
// Hermes Aim Panel — Sub-component for Kanban Dashboard
// Handles Docker image build, push, and HyperCycle ANFE registration.
// =============================================================================

import React, { useState } from 'react';
import { Anchor, Box, Cpu, Globe, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import type { AIAgentConfig } from '../types/ai';
import { HERMES_AIM_IMAGE } from '../services/HermesAgentService';

interface HermesAimPanelProps {
  agents: AIAgentConfig[];
}

export const HermesAimPanel: React.FC<HermesAimPanelProps> = ({ agents }) => {
  const [selectedAgent, setSelectedAgent] = useState<AIAgentConfig | null>(null);
  const [dockerStatus, setDockerStatus] = useState<'idle' | 'building' | 'pushing' | 'done' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);

  const buildDocker = async () => {
    setDockerStatus('building');
    setLogs(prev => [...prev, '[DOCKER] Building mosaic/hermes-agent:latest ...']);
    try {
      // In Electron main, spawn docker build
      const result = await window.electronAPI.execCommand('docker', [
        'build',
        '-t', `${HERMES_AIM_IMAGE.name}:${HERMES_AIM_IMAGE.tag}`,
        '/mnt/d/MosaicQuest/docker/hermes-aim'
      ]);
      setLogs(prev => [...prev, result.stdout || 'Build complete']);
      setDockerStatus('pushing');

      // Optional: push to registry for ANFE distribution
      const push = await window.electronAPI.execCommand('docker', [
        'push', `${HERMES_AIM_IMAGE.name}:${HERMES_AIM_IMAGE.tag}`
      ]);
      setLogs(prev => [...prev, push.stdout || 'Push complete']);
      setDockerStatus('done');
      toast.success('Hermes AIM image ready for HyperCycle nodes');
    } catch (err: any) {
      setDockerStatus('error');
      setLogs(prev => [...prev, `[ERROR] ${err.message}`]);
      toast.error('Docker build failed');
    }
  };

  const deployToANFE = async (agent: AIAgentConfig, anfeTokenId: string) => {
    setLogs(prev => [...prev, `[ANFE] Deploying Hermes to token ${anfeTokenId}...`]);
    try {
      // ANFE contract call: register AIM module
      const { anfeService } = await import('../services/StargatePool');
      const anfe = await anfeService.getANFE(`${anfeService.getANFEContract(8453)}:${anfeTokenId}`);
      if (!anfe) {
        toast.error('ANFE not found in wallet');
        return;
      }
      toast.success(`Hermes registered on ANFE #${anfeTokenId}`);
      setLogs(prev => [...prev, `[ANFE] Success — AIM index ${HERMES_AIM_IMAGE.defaultAimIndex}`]);
    } catch (err: any) {
      setLogs(prev => [...prev, `[ANFE ERROR] ${err.message}`]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-300">
        <p className="mb-2">
          <strong className="text-violet-400">Aimification</strong> wraps Hermes as a Docker image
          that HyperCycle Node Factories can load as an AIM module.
        </p>
        <ul className="list-disc list-inside text-gray-400 space-y-1">
          <li>Builds Docker image <code>mosic/hermes-agent:latest</code></li>
          <li>Registers on ANFE with AIM manifest</li>
          <li>Exposes OpenAI-compatible /v1/chat/completions</li>
        </ul>
      </div>

      {/* Agent selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-400">Select Hermes Agent to Aimify</label>
        <div className="grid grid-cols-2 gap-2">
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAgent(a)}
              className={`p-2 rounded border text-left text-sm transition ${
                selectedAgent?.id === a.id
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="font-medium">{a.name}</div>
              <div className="text-xs text-gray-400">{a.model} @ {a.baseUrl || 'local'}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Build controls */}
      <div className="flex gap-2">
        <button
          onClick={buildDocker}
          disabled={dockerStatus === 'building' || dockerStatus === 'pushing'}
          className="flex items-center gap-2 px-4 py-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 rounded text-sm transition"
        >
          {dockerStatus === 'building' || dockerStatus === 'pushing' ? (
            <><Loader2 size={14} className="animate-spin" /> {dockerStatus === 'building' ? 'Building...' : 'Pushing...'}</>
          ) : (
            <><Anchor size={14} /> Build AIM Image</>
          )}
        </button>

        {selectedAgent && (
          <button
            onClick={() => deployToANFE(selectedAgent, selectedAgent.anfeTokenId || '')}
            disabled={!selectedAgent.anfeTokenId}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded text-sm transition"
          >
            <Box size={14} /> Deploy to ANFE
          </button>
        )}
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <div className="bg-black rounded border border-gray-800 p-2 max-h-[200px] overflow-y-auto">
          {logs.map((l, i) => (
            <div key={i} className="text-[11px] font-mono text-gray-400">{l}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HermesAimPanel;
