import React, { useEffect, useState } from 'react';
import { AlertTriangle, Copy, Check, Loader2, Cpu, Zap } from 'lucide-react';

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
  /** Estimated gas cost, e.g. "~0.000032 ETH" */
  gasEstimate?: string;
  chainId: number;
  reason?: string;
  policySnapshot?: string;
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

          {/* Detail rows */}
          <div className="space-y-3 bg-gray-950/50 p-4 rounded-xl border border-gray-800">

            {/* Destination Node */}
            <div className="flex justify-between items-center border-b border-gray-800/50 pb-2">
              <span className="text-sm text-gray-500 shrink-0">Destination Node</span>
              <span className="text-sm font-medium text-gray-200 truncate max-w-[180px] text-right ml-4">{request.nodeUrl}</span>
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

            {/* Recipient Address */}
            <div className="flex justify-between items-center border-b border-gray-800/50 pb-2">
              <span className="text-sm text-gray-500 shrink-0">Recipient Address</span>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm font-mono text-gray-300">
                  {request.to.slice(0, 8)}...{request.to.slice(-6)}
                </span>
                <button
                  onClick={copyAddress}
                  className="text-gray-500 hover:text-white transition-colors shrink-0"
                  title="Copy address"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Network */}
            <div className="flex justify-between items-center border-b border-gray-800/50 pb-2">
              <span className="text-sm text-gray-500 shrink-0">Network</span>
              <span className="text-sm font-medium text-gray-200 text-right ml-4">
                {request.networkName ?? `Chain ${request.chainId}`}
              </span>
            </div>

            {/* Gas Estimate */}
            {request.gasEstimate && (
              <div className="flex justify-between items-center border-b border-gray-800/50 pb-2">
                <span className="text-sm text-gray-500 shrink-0 flex items-center gap-1.5">
                  <Zap size={12} className="text-yellow-400" /> Gas Estimate
                </span>
                <span className="text-sm font-mono text-gray-300 text-right ml-4">{request.gasEstimate}</span>
              </div>
            )}

            {/* Reason */}
            <div className="flex justify-between items-start">
              <span className="text-sm text-gray-500 shrink-0">Reason</span>
              <span className="text-sm text-gray-300 text-right flex-1 ml-4 leading-snug break-words min-w-0">
                {request.reason || 'Insufficient balance for tool call'}
              </span>
            </div>

          </div>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          <p className="text-xs text-gray-500 text-center italic">
            This counts toward your daily limit.
            {request.policySnapshot && ` (${request.policySnapshot})`}
          </p>
        </div>

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
