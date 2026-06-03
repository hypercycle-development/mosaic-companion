// =============================================================================
// STARGATE COMMUNITY AIM PANEL
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { Bot, ExternalLink, CheckCircle2, XCircle, Loader, AlertTriangle, Plus, Globe, CreditCard, Activity } from 'lucide-react';
import type { AIMInfo } from '../../services/AdaPortal/types';
import { stargateRegistry } from '../../services/StargateSkillRegistry';
import { localNodeBridge, BridgeAIM } from '../../services/LocalNodeBridge';
import { enhancedLocalNodeBridge, ExtendedBridgeTelemetry } from '../../services/stargate/EnhancedLocalNodeBridge';
import { stargateCredits } from '../../services/stargate/StargateCreditsService';

interface RemoteAIMStatus {
  aim: AIMInfo;
  healthStatus: 'online' | 'offline' | 'unknown';
  lastProbed: number | null;
  probeError?: string;
}

interface FallbackAIM {
  found: boolean;
  url: string;
  version?: string;
  port: number;
  name?: string;
  model?: string;
  status?: string;
}

const StargateCommunityAIMPanel: React.FC = () => {
  const [localAIMs, setLocalAIMs] = useState<BridgeAIM[]>([]);
  const [telemetry, setTelemetry] = useState<ExtendedBridgeTelemetry | null>(null);
  const [fallbackAIM, setFallbackAIM] = useState<FallbackAIM | null>(null);
  const [remoteAIMs, setRemoteAIMs] = useState<RemoteAIMStatus[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [activeView, setActiveView] = useState<'all' | 'local' | 'community'>('all');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<AIMInfo>>({
    name: '', description: '', version: '1.0.0', operatorName: '', operatorContact: '',
    endpointUrl: '', healthUrl: '', manifestUrl: '', requestUrl: '',
    pricePerCall: 0.02, priceToken: 'USDC', nodeId: '', licenseId: '', supportedQueries: [],
    origin: 'hypercycle-node-operator'
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [credits, setCredits] = useState<number>(stargateCredits.getBalance());

  const refreshLocal = useCallback(async () => {
    await localNodeBridge.refresh();
    const localAims = localNodeBridge.getLocalAIMs();
    setLocalAIMs(localAims);
    const t = await enhancedLocalNodeBridge.refresh();
    setTelemetry(t);

    if (t && t.runningAims.length === 0 && localAims.length === 0) {
      try {
        const resp = await fetch('http://localhost:9000/health', { method: 'GET' });
        if (resp.ok) {
          const data = await resp.json();
          setFallbackAIM({
            found: true, url: 'http://localhost:9000',
            version: data.aim_version || data.version || 'unknown', port: 9000,
            name: data.name || 'Mosaic Hermes AIM',
            model: data.model || 'unknown', status: data.status || 'ok'
          });
        } else { setFallbackAIM(null); }
      } catch (_e) { setFallbackAIM(null); }
    } else { setFallbackAIM(null); }
  }, []);

  const refreshRemote = useCallback(async () => {
    setRemoteLoading(true);
    const remote = stargateRegistry.getRemoteAIMs();
    const statuses: RemoteAIMStatus[] = await Promise.all(
      remote.map(async (aim) => {
        if (!aim.healthUrl) return { aim, healthStatus: 'unknown', lastProbed: null };
        try {
          const resp = await fetch(aim.healthUrl!, { method: 'GET', signal: AbortSignal.timeout(8000) });
          const data = await resp.json().catch(() => ({}));
          const isOnline = resp.ok && (data.status === 'ok' || data.status === 'healthy' || data.running === true);
          return { aim, healthStatus: isOnline ? 'online' : 'offline', lastProbed: Date.now() };
        } catch (e: any) {
          return { aim, healthStatus: 'offline', lastProbed: Date.now(), probeError: e?.message || 'Network error' };
        }
      })
    );
    setRemoteAIMs(statuses);
    setRemoteLoading(false);
  }, []);

  useEffect(() => {
    refreshLocal().then(() => refreshRemote());
    const localInterval = setInterval(refreshLocal, 30000);
    const remoteInterval = setInterval(refreshRemote, 60000);
    return () => { clearInterval(localInterval); clearInterval(remoteInterval); };
  }, [refreshLocal, refreshRemote]);

  useEffect(() => {
    const i = setInterval(() => setCredits(stargateCredits.getBalance()), 5000);
    return () => clearInterval(i);
  }, []);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.name || !formData.endpointUrl || !formData.requestUrl) {
      setFormError('Name, Endpoint URL, and Request URL are required'); return;
    }
    setFormSubmitting(true);
    try {
      const aim: AIMInfo = {
        name: formData.name!, description: formData.description || 'Community AIM', version: formData.version || '1.0.0',
        operatorName: formData.operatorName || 'Anonymous', operatorContact: formData.operatorContact || '',
        endpointUrl: formData.endpointUrl!, healthUrl: formData.healthUrl || '', manifestUrl: formData.manifestUrl || '',
        requestUrl: formData.requestUrl!, pricePerCall: formData.pricePerCall || 0, priceToken: formData.priceToken || 'USDC',
        nodeId: formData.nodeId || '', licenseId: formData.licenseId || '', supportedQueries: formData.supportedQueries || [],
        origin: formData.origin || 'hypercycle-node-operator', isActive: true, isRemote: true,
        rank: 0, activeNodes: 1, estimatedCostUsdc: formData.pricePerCall || 0
      };
      stargateRegistry.registerRemoteAIM(aim);
      try {
        const existing = JSON.parse(localStorage.getItem('stargate_remote_aims') || '[]') as AIMInfo[];
        existing.push(aim);
        localStorage.setItem('stargate_remote_aims', JSON.stringify(existing));
      } catch (_e) { /*ignore*/ }
      setShowForm(false);
      setFormData({ name: '', description: '', version: '1.0.0', operatorName: '', operatorContact: '', endpointUrl: '', healthUrl: '', manifestUrl: '', requestUrl: '', pricePerCall: 0.02, priceToken: 'USDC', nodeId: '', licenseId: '', supportedQueries: [], origin: 'hypercycle-node-operator' });
      await refreshRemote();
    } catch (e: any) {
      setFormError(`Registration failed: ${e.message || e}`);
    } finally { setFormSubmitting(false); }
  };

  const handleCallAIM = async (aim: AIMInfo) => {
    const price = aim.pricePerCall || 0.02;
    if (credits < price) {
      alert(`Insufficient Stargate Credits. Balance: ${credits.toFixed(4)} USDC. Required: ${price.toFixed(2)} USDC`);
      return;
    }
    const prompt = window.prompt(`Enter query for ${aim.name}:\nSupported: ${(aim.supportedQueries || ['any']).join(', ')}`, 'dao HPEC_DAO_NF1');
    if (!prompt) return;
    try {
      stargateCredits.deduct(price);
      setCredits(stargateCredits.getBalance());
      const resp = await fetch(aim.requestUrl!, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }), signal: AbortSignal.timeout(15000) });
      const data = await resp.json().catch(() => ({}));
      alert(`Result:\n${JSON.stringify(data, null, 2)}\n\nDeducted ${price} USDC. New balance: ${stargateCredits.getBalance().toFixed(4)}`);
    } catch (e: any) { alert(`AIM call failed: ${e.message || e}`); }
  };

  const renderHealthBadge = (status: RemoteAIMStatus['healthStatus']) => {
    switch (status) {
      case 'online': return <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400"><Activity size={10} /> Online</span>;
      case 'offline': return <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400"><XCircle size={10} /> Offline</span>;
      default: return <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400"><Loader size={10} /> Unknown</span>;
    }
  };

  const effectiveRunningCount = (telemetry?.runningAims.length || 0) + (fallbackAIM?.found ? 1 : 0);
  const totalSlots = telemetry?.totalAimSlots || 8;
  const slotUsage = totalSlots > 0 ? effectiveRunningCount / totalSlots : 0;
  const visibleLocal = activeView === 'community' ? [] : activeView === 'local' || activeView === 'all' ? [...localAIMs] : [];
  const visibleRemote = activeView === 'local' ? [] : activeView === 'community' || activeView === 'all' ? remoteAIMs : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">AI Models</h3>
          <p className="text-sm text-gray-400 mt-0.5">Local + Community HyperCycle Node Operator AIMs</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <CreditCard size={12} /> {credits.toFixed(2)} USDC
          </div>
          <span className="text-xs text-gray-500">{localAIMs.length + (fallbackAIM?.found ? 1 : 0)} local &middot; {remoteAIMs.length} community</span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
        {(['all', 'local', 'community'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveView(tab)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${activeView === tab ? 'bg-cyan-500/20 text-cyan-400 font-medium' : 'text-gray-400 hover:text-white'}`}>
            {tab === 'all' ? 'All AIMs' : tab === 'local' ? 'Local AIMs' : 'Community AIMs'}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setShowForm(true)} className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-1 font-medium">
          <Plus size={12} /> Register My AIM
        </button>
      </div>

      {(activeView === 'all' || activeView === 'local') && (
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 bg-gray-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${slotUsage > 0.75 ? 'bg-yellow-500' : 'bg-cyan-400'}`} style={{ width: `${slotUsage * 100}%` }} />
          </div>
          <span className={`text-xs font-medium ${slotUsage > 0.75 ? 'text-yellow-400' : 'text-green-400'}`}>{effectiveRunningCount}/{totalSlots} slots</span>
        </div>
      )}

      {visibleLocal.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Local AIMs</h4>
          <div className="grid gap-3">
            {fallbackAIM?.found && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-900/10">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/20"><Bot size={20} className="text-emerald-400" /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-white">{fallbackAIM.name || 'Mosaic Hermes AIM'}</h4>
                        <span className="text-xs text-emerald-400">{fallbackAIM.version}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">running</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Port {fallbackAIM.port}</span>
                        {fallbackAIM.model && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Model: {fallbackAIM.model}</span>}
                      </div>
                    </div>
                  </div>
                  <a href={fallbackAIM.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-emerald-400 transition-colors"><ExternalLink size={16} /></a>
                </div>
              </div>
            )}
            {visibleLocal.map((aim) => (
              <div key={aim.imageId} className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${aim.status === 'running' ? 'bg-green-500/20' : 'bg-gray-700'}`}>
                      {aim.status === 'running' ? <CheckCircle2 size={20} className="text-green-400" /> : aim.status === 'error' ? <AlertTriangle size={20} className="text-red-400" /> : <Loader size={20} className="text-gray-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-white">{aim.name || 'Unnamed AIM'}</h4>
                        <span className="text-xs text-gray-500">{aim.tag}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${aim.status === 'running' ? 'bg-green-500/20 text-green-400' : aim.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'}`}>{aim.status}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Slot {aim.slot}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Port {aim.port}</span>
                        {aim.whitelisted && <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">Whitelisted</span>}
                      </div>
                    </div>
                  </div>
                  <a href={`http://localhost:${aim.port}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-cyan-400 transition-colors"><ExternalLink size={16} /></a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {visibleRemote.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Community AIMs &middot; HyperCycle Node Operators</h4>
          <div className="grid gap-3">
            {visibleRemote.map((status) => (
              <div key={`${status.aim.name}-${status.aim.endpointUrl}`} className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 hover:border-purple-500/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/20 shrink-0"><Globe size={20} className="text-purple-400" /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-white">{status.aim.name}</h4>
                        {renderHealthBadge(status.healthStatus)}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">Operator: {status.aim.operatorName}</span>
                      </div>
                      {status.aim.description && <p className="text-sm text-gray-400 mt-1">{status.aim.description}</p>}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">v{status.aim.version}</span>
                        {status.aim.licenseId && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">License: {status.aim.licenseId}</span>}
                        {(status.aim.supportedQueries || []).map((q) => <span key={q} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">{q}</span>)}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">{status.aim.pricePerCall?.toFixed(2)} {status.aim.priceToken}/call</span>
                      </div>
                      {status.lastProbed && <div className="text-[10px] text-gray-600 mt-1">Last probed: {new Date(status.lastProbed).toLocaleTimeString()}{status.probeError ? ` &middot; ${status.probeError}` : ''}</div>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 ml-2 shrink-0">
                    <a href={status.aim.endpointUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-cyan-400 transition-colors" title="Open endpoint"><ExternalLink size={16} /></a>
                    {status.healthStatus === 'online' && status.aim.requestUrl && (
                      <button onClick={() => handleCallAIM(status.aim)} className="px-3 py-1.5 text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-white font-medium transition-colors">Use AIM</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(activeView === 'community' || activeView === 'all') && remoteAIMs.length === 0 && !remoteLoading && (
        <div className="text-center py-8 border border-dashed border-gray-800 rounded-xl">
          <Globe size={32} className="mx-auto text-gray-700 mb-2" />
          <p className="text-gray-500 text-sm">No community AIMs registered yet.</p>
          <button onClick={() => setShowForm(true)} className="mt-2 text-purple-400 text-xs hover:underline">Be the first to register your AIM</button>
        </div>
      )}

      {remoteLoading && activeView !== 'local' && (
        <div className="flex items-center justify-center py-8">
          <Loader size={20} className="animate-spin text-gray-500" />
          <span className="text-sm text-gray-500 ml-2">Probing community AIMs...</span>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Register My AIM</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"><XCircle size={18} /></button>
            </div>
            {formError && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{formError}</div>}
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div><label className="block text-xs font-medium text-gray-400 mb-1">AIM Name *</label><input type="text" value={formData.name || ''} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" placeholder="hypc-node-status" required /></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1">Description</label><input type="text" value={formData.description || ''} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" placeholder="What does this AIM do?" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-400 mb-1">Version</label><input type="text" value={formData.version || '1.0.0'} onChange={(e) => setFormData(p => ({ ...p, version: e.target.value }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" /></div>
                <div><label className="block text-xs font-medium text-gray-400 mb-1">Operator Name</label><input type="text" value={formData.operatorName || ''} onChange={(e) => setFormData(p => ({ ...p, operatorName: e.target.value }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" placeholder="Your name or org" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1">Endpoint URL (base) *</label><input type="url" value={formData.endpointUrl || ''} onChange={(e) => setFormData(p => ({ ...p, endpointUrl: e.target.value }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" placeholder="https://node.example.com" required /></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1">Health Check URL</label><input type="url" value={formData.healthUrl || ''} onChange={(e) => setFormData(p => ({ ...p, healthUrl: e.target.value }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" placeholder="https://node.example.com/aim/1/health" /></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1">Request URL (POST) *</label><input type="url" value={formData.requestUrl || ''} onChange={(e) => setFormData(p => ({ ...p, requestUrl: e.target.value }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" placeholder="https://node.example.com/aim/1/request" required /></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1">Manifest URL</label><input type="url" value={formData.manifestUrl || ''} onChange={(e) => setFormData(p => ({ ...p, manifestUrl: e.target.value }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" placeholder="https://node.example.com/aim/1/manifest.json" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-400 mb-1">Price / Call (USDC)</label><input type="number" step="0.001" min="0" value={formData.pricePerCall || 0} onChange={(e) => setFormData(p => ({ ...p, pricePerCall: parseFloat(e.target.value) }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" /></div>
                <div><label className="block text-xs font-medium text-gray-400 mb-1">HyperCycle Node ID</label><input type="text" value={formData.nodeId || ''} onChange={(e) => setFormData(p => ({ ...p, nodeId: e.target.value }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" placeholder="36faf71d..." /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1">License ID</label><input type="text" value={formData.licenseId || ''} onChange={(e) => setFormData(p => ({ ...p, licenseId: e.target.value }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" placeholder="116238994..." /></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1">Supported Queries (comma-separated)</label><input type="text" value={(formData.supportedQueries || []).join(', ')} onChange={(e) => setFormData(p => ({ ...p, supportedQueries: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" placeholder="dao, factory, license, info" /></div>
              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">Cancel</button>
                <button type="submit" disabled={formSubmitting} className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1">{formSubmitting ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}{formSubmitting ? 'Registering...' : 'Register AIM'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StargateCommunityAIMPanel;
