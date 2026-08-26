import React, { useEffect, useState } from 'react';
import { AlertTriangle, Copy, Check, Loader2, Cpu, Zap } from 'lucide-react';

// Stage 7C: HyperInsight score data attached to the payment approval payload
export interface HyperInsightScoreData {
  compositeScore?:      number | null;
  healthScore?:         number | null;
  latencyScore?:        number | null;
  uptimeScore?:         number | null;
  consecutiveFailures?: number | null;
  pollTier?:            string | null;
  lastProbedAt?:        string | null;
  measuredUptime7d?:    number | null;
  manifestVersion?:     string | null;
  releaseTagName?:      string | null;
  updatedAt?:           string | null;
  status?:              string | null;
}

export interface ApprovalRequest {
  requestId: string;
  nodeUrl: string;
  to: string;
  token: string;
  /** Base service cost (plain number, no currency label) */
  amount: string;
  /** Total on-chain deposit = amount + 0.5% buffer */
  depositAmount?: string;
  /** Human-readable AIM tool name, e.g. "lightning-aim-gen:0.1.0" */
  aimName?: string;
  /** Human-readable network name, e.g. "Ethereum", "Base", "Sepolia (Testnet)" */
  networkName?: string;
  chainName?: string;
  chainId?: number;
  /** Estimated gas cost, e.g. "~0.000032 ETH" */
  gasEstimate?: string;
  reason?: string;
  /**
   * Verified id of the add-on that initiated this payment, or absent/null when
   * it came from the user's own chat session. Set main-side from the add-on API
   * dispatcher's resolved identity — never from anything a renderer supplied.
   * Displayed because "who is asking" is the single most decision-relevant fact
   * in an approval, and the modal previously did not carry it at all.
   */
  requestedBy?: string | null;
  policySnapshot?: string;
  existingNodeBalance?: string;
  warning?: string;
  hyperinsightScore?: HyperInsightScoreData | null;
}

// ---------------------------------------------------------------------------
// Stage 7C: relative time helper
// ---------------------------------------------------------------------------

function relativeTime(isoString: string | null | undefined): string {
  if (!isoString) return 'unknown';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

// ---------------------------------------------------------------------------
// Stage 7C: HyperInsight trust panel sub-component
// ---------------------------------------------------------------------------

function HyperInsightTrustPanel({ score }: { score: HyperInsightScoreData }) {
  const composite = score.compositeScore ?? null;
  const barColor  = composite === null  ? 'bg-gray-600'
                  : composite >= 80     ? 'bg-emerald-500'
                  : composite >= 50     ? 'bg-amber-500'
                                        : 'bg-red-500';
  const version = score.releaseTagName ?? score.manifestVersion ?? null;

  return (
    <div className="border-t border-gray-800 pt-4 space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Node Health</p>

      {/* Score bar */}
      {composite !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Health Score</span>
            <span className="font-mono">{composite}/100</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${composite}%` }}
            />
          </div>
        </div>
      )}

      {/* 7-day uptime */}
      {score.measuredUptime7d != null && (
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">7-Day Uptime</span>
          <span className="text-gray-300 font-mono">{Number(score.measuredUptime7d).toFixed(1)}%</span>
        </div>
      )}

      {/* Last verified */}
      {score.lastProbedAt && (
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Last Verified</span>
          <span className="text-gray-300">{relativeTime(score.lastProbedAt)}</span>
        </div>
      )}

      {/* Consecutive failures warning */}
      {(score.consecutiveFailures ?? 0) > 3 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <span>⚠ {score.consecutiveFailures} consecutive probe failures detected</span>
        </div>
      )}

      {/* Version */}
      {version && (
        <div className="text-xs text-gray-600 text-right">Running {version}</div>
      )}

      {/* Footer attribution */}
      <p className="text-xs text-gray-600 italic">Health data from HyperInsight · measured from api servers</p>
    </div>
  );
}

export const TransactionApprovalModal: React.FC = () => {
  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.electronAPI?.paymentsJit) return;

    const unsub = window.electronAPI.paymentsJit.onRequestApproval((req: ApprovalRequest) => {
      setRequest(req);
      setProcessing(false);
      setError(null);
    });

    // unsub is the cleanup function returned by onRequestApproval
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  const respond = async (approved: boolean) => {
    if (!request || processing) return;
    setProcessing(true);
    setError(null);

    try {
      await window.electronAPI.paymentsJit.approveResult(request.requestId, approved);
      setRequest(null);
    } catch (e: any) {
      setError('Failed to submit approval result.');
      setProcessing(false);
    }
  };

  const copyAddress = () => {
    if (request?.to) {
      navigator.clipboard.writeText(request.to);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!request) return null;

  // Derive buffer amount for display breakdown
  const depositAmt = request.depositAmount ?? request.amount;
  const baseAmt = request.amount;
  const showBreakdown =
    request.depositAmount &&
    request.depositAmount !== request.amount &&
    !isNaN(parseFloat(request.depositAmount)) &&
    !isNaN(parseFloat(request.amount));
  const bufferAmt = showBreakdown
    ? (parseFloat(depositAmt) - parseFloat(baseAmt)).toFixed(6)
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 bg-gray-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="text-yellow-500" size={24} />
            Approve Top-Up
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            An automated tool is requesting funds.
          </p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">

          {/* Total deposit amount (prominent) */}
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-center">
            <p className="text-sm text-indigo-300 font-medium mb-1">Total Deposit</p>
            <p className="text-3xl font-bold text-white">
              {depositAmt} <span className="text-xl text-indigo-400">{request.token}</span>
            </p>
            {showBreakdown && (
              <p className="text-xs text-gray-400 mt-1.5">
                {baseAmt} service cost + {bufferAmt} buffer (0.5%)
              </p>
            )}
          </div>

          <div className="space-y-3 bg-gray-950/50 p-4 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center border-b border-gray-800/50 pb-2">
              <span className="text-sm text-gray-500 shrink-0">Destination Node</span>
              <span className="text-sm font-medium text-gray-200 truncate max-w-[220px] ml-4 text-right">{request.nodeUrl}</span>
            </div>

            {/* AIM Tool */}
            {request.aimName && (
              <div className="flex justify-between items-center border-b border-gray-800/50 pb-2">
                <span className="text-sm text-gray-500 shrink-0 flex items-center gap-1.5">
                  <Cpu size={12} className="text-indigo-400" /> AIM Tool
                </span>
                <span className="text-sm font-mono text-indigo-300 truncate max-w-[200px] text-right ml-4">{request.aimName}</span>
              </div>
            )}

            <div className="flex justify-between items-center border-b border-gray-800/50 pb-2">
              <span className="text-sm text-gray-500 shrink-0">Recipient Address</span>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm font-mono text-gray-300">
                  {request.to.slice(0, 8)}...{request.to.slice(-6)}
                </span>
                <button
                  onClick={copyAddress}
                  className="text-gray-500 hover:text-white transition-colors"
                  title="Copy address"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center border-b border-gray-800/50 pb-2">
              <span className="text-sm text-gray-500 shrink-0">Network</span>
              <span className="text-sm font-medium text-gray-300 ml-4 text-right">
                {request.networkName || request.chainName || 'Unknown'} <span className="text-gray-500 font-mono">({request.chainId})</span>
              </span>
            </div>

            {request.existingNodeBalance && (
              <div className="flex justify-between items-center border-b border-gray-800/50 pb-2">
                <span className="text-sm text-gray-500 shrink-0">Node Balance</span>
                <span className="text-sm font-mono text-gray-300 ml-4 text-right">{request.existingNodeBalance}</span>
              </div>
            )}

            {request.gasEstimate && (
              <div className="flex justify-between items-center border-b border-gray-800/50 pb-2">
                <span className="text-sm text-gray-500 shrink-0 flex items-center gap-1.5">
                  <Zap size={12} className="text-yellow-400" /> Est. Gas Fee
                </span>
                <span className="text-sm font-mono text-gray-300 ml-4 text-right">{request.gasEstimate}</span>
              </div>
            )}

            <div className="flex justify-between items-center border-b border-gray-800/50 pb-2">
              <span className="text-sm text-gray-500 shrink-0">Requested by</span>
              {request.requestedBy ? (
                <span className="text-sm font-medium text-amber-400 ml-4 text-right break-all">
                  Add-on: {request.requestedBy}
                </span>
              ) : (
                <span className="text-sm text-gray-300 ml-4 text-right">This app</span>
              )}
            </div>

            <div className="flex justify-between items-start">
              <span className="text-sm text-gray-500 shrink-0">Reason</span>
              <span className="text-sm text-gray-300 ml-4 text-right">{request.reason || 'Insufficient balance for tool call'}</span>
            </div>
          </div>

          {/* Stage 7C: Node health trust panel */}
          {request.hyperinsightScore && (
            <HyperInsightTrustPanel score={request.hyperinsightScore} />
          )}

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          {request.warning && (
            <p className="text-xs text-amber-400 text-center">{request.warning}</p>
          )}

          <p className="text-xs text-gray-500 text-center italic">
            This counts toward your daily limit.
            {request.policySnapshot && ` (${request.policySnapshot})`}
          </p>
        </div>

        {/* Stage 7C: Unhealthy node warning above Approve button */}
        {request.hyperinsightScore &&
         (request.hyperinsightScore.compositeScore ?? 100) < 20 &&
         (request.hyperinsightScore.consecutiveFailures ?? 0) >= 5 && (
          <div className="mx-5 mb-3 bg-red-900/40 border border-red-700/40 rounded-xl px-4 py-2.5">
            <p className="text-xs text-red-300 font-medium">
              This node is currently unhealthy. Proceeding may result in a failed call.
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-5 border-t border-gray-800 bg-gray-900/50 flex gap-3">
          <button
            onClick={() => respond(false)}
            disabled={processing}
            className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => respond(true)}
            disabled={processing}
            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-900/20"
          >
            {processing ? <Loader2 size={18} className="animate-spin" /> : 'Approve Transfer'}
          </button>
        </div>

      </div>
    </div>
  );
};
