import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { ManifestEndpoint } from '../types';
import { formatUsdcMicro } from '../utils';
import { GatedFeature } from './GatedFeature';

interface TryItPanelProps {
  aimName: string;
  endpoint: ManifestEndpoint;
  nodeEndpointUrl: string;
  onClose: () => void;
}

function isAllowedEndpointUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export const TryItPanel = ({ aimName, endpoint, nodeEndpointUrl, onClose }: TryItPanelProps) => {
  const costOnlyUrl = `${nodeEndpointUrl}/aim/0${endpoint.uri}`;

  // Build initial form values from example call if available
  const exampleBody = endpoint.exampleCalls?.[0]?.body ?? {};
  const inputKeys = endpoint.inputBody ? Object.keys(endpoint.inputBody) : Object.keys(exampleBody);

  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const key of inputKeys) {
      const exVal = (exampleBody as Record<string, unknown>)[key];
      initial[key] = exVal != null ? String(exVal) : '';
    }
    return initial;
  });

  const [estimating, setEstimating] = useState(false);
  const [costResult, setCostResult] = useState<string | null>(null);
  const [costError, setCostError] = useState<string | null>(null);

  const handleEstimate = async () => {
    setEstimating(true);
    setCostResult(null);
    setCostError(null);
    if (!isAllowedEndpointUrl(costOnlyUrl)) {
      setCostError('Invalid endpoint URL: only http/https is permitted');
      setEstimating(false);
      return;
    }
    try {
      const body: Record<string, unknown> = { ...formValues, cost_only: 1 };
      const res = await fetch(costOnlyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json() as { cost?: number };
      if (data.cost != null) {
        setCostResult(formatUsdcMicro(data.cost));
      } else {
        // Fallback to manifest estimate
        const manifestEst = endpoint.costs?.[0]?.estimated;
        setCostResult(manifestEst != null
          ? `~${formatUsdcMicro(manifestEst)} (manifest estimate)`
          : 'Cost not declared');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      const manifestEst = endpoint.costs?.[0]?.estimated;
      setCostError(msg);
      if (manifestEst != null) {
        setCostResult(`~${formatUsdcMicro(manifestEst)} (manifest estimate)`);
      }
    } finally {
      setEstimating(false);
    }
  };

  const panel = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div className="fixed right-0 top-0 h-full w-[420px] max-w-full bg-[var(--surface)] border-l border-[var(--border)] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <h2 className="font-semibold text-[var(--text)] text-sm">Try It</h2>
            <p className="text-xs text-[var(--textMuted)] font-mono mt-0.5">
              {aimName} → {endpoint.uri}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--surfaceAlt)] rounded-full transition-colors text-[var(--textMuted)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">

          {/* Section A: Cost Preview */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-[var(--textMuted)] uppercase tracking-wider">
              Cost Preview
            </h3>

            {/* Input form */}
            {inputKeys.length > 0 ? (
              <div className="space-y-3">
                {inputKeys.map(key => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-[var(--textMuted)] mb-1 font-mono">
                      {key}
                    </label>
                    <input
                      type="text"
                      value={formValues[key] ?? ''}
                      onChange={e => setFormValues(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none font-mono"
                      placeholder={`Enter ${key}…`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--textMuted)] italic">No input parameters defined.</p>
            )}

            {/* Estimate button */}
            <button
              onClick={handleEstimate}
              disabled={estimating}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {estimating && <Loader2 size={14} className="animate-spin" />}
              {estimating ? 'Estimating…' : 'Get Cost Estimate'}
            </button>

            {/* Results */}
            {costResult && (
              <div className="flex items-start gap-2 p-3 bg-[color-mix(in_srgb,var(--success),transparent_90%)] rounded-lg border border-[color-mix(in_srgb,var(--success),transparent_70%)]">
                <CheckCircle size={14} className="text-[var(--success)] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[var(--success)]">Estimated cost</div>
                  <div className="text-sm font-mono font-bold text-[var(--text)]">{costResult}</div>
                </div>
              </div>
            )}

            {costError && (
              <div className="flex items-start gap-2 p-3 bg-[color-mix(in_srgb,var(--danger),transparent_90%)] rounded-lg border border-[color-mix(in_srgb,var(--danger),transparent_70%)]">
                <AlertCircle size={14} className="text-[var(--danger)] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[var(--danger)]">Request failed</div>
                  <div className="text-xs text-[var(--textMuted)] mt-0.5 break-all">{costError}</div>
                </div>
              </div>
            )}
          </div>

          {/* Section B: Execute (gated) */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[var(--textMuted)] uppercase tracking-wider">Execute</h3>
            <GatedFeature tier="pro" label="Execute AIMs with a Pro account">
              <div className="space-y-2">
                <button
                  disabled
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--textMuted)] cursor-not-allowed"
                >
                  Execute
                </button>
                <p className="text-xs text-[var(--textMuted)]">
                  Executing this AIM requires a funded Mosaic wallet.
                </p>
                {/* TODO: full execution requires signed request via Node Manager.
                    See payments-jit plugin for JIT payment orchestration.
                    Will be gated behind Pro tier when monetisation launches. */}
              </div>
            </GatedFeature>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(panel, document.body);
};
