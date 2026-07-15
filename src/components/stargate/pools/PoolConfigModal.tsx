// =============================================================================
// POOL CONFIG MODAL
// Simple overlay panel for per-pool settings. Each pool defines its own form.
// =============================================================================

import React, { useEffect, useRef } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import type { PoolDefinition } from './types';

export interface PoolConfigModalProps {
  pool: PoolDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (poolId: string, values: Record<string, any>) => void;
}

const PoolConfigModal: React.FC<PoolConfigModalProps> = ({ pool, isOpen, onClose, onSave }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !pool) return null;

  // Default simple config form based on pool id
  const renderForm = () => {
    switch (pool.id) {
      case 'battery':
        return (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-gray-400">Polling Interval (ms)</span>
              <input type="number" defaultValue={5000} className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-emerald-500" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">Auto-restart offline validators</span>
              <select defaultValue="false" className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-emerald-500">
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </label>
          </div>
        );
      case 'compute':
        return (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-gray-400">Max Concurrent Tenants per Box</span>
              <input type="number" defaultValue={2} className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-indigo-500" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">Auto-pause when load above 90%</span>
              <select defaultValue="true" className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </label>
          </div>
        );
      case 'materios':
        return (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-gray-400">Attestor Health URL</span>
              <input type="text" defaultValue="http://127.0.0.1:8080" className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-green-500" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">Polling Interval (ms)</span>
              <input type="number" defaultValue={15000} className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-green-500" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">Committee Explorer URL</span>
              <input type="text" defaultValue="https://fluxpointstudios.com/materios/explorer#committee" className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-green-500" />
            </label>
          </div>
        );
      default:
        return (
          <div className="p-4 text-center rounded-lg bg-gray-900/50 border border-gray-700/30">
            <p className="text-sm text-gray-400">No configurable settings for this pool.</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" ref={ref}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl bg-gray-900 border border-gray-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{pool.name} — Settings</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4">{renderForm()}</div>

        <div className="flex items-center gap-2 p-4 border-t border-gray-800">
          <button
            onClick={() => onSave?.(pool.id, {})}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            <Save size={14} /> Save Changes
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            <RotateCcw size={14} /> Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PoolConfigModal;
