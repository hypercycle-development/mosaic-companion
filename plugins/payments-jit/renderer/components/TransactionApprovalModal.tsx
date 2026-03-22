import React, { useEffect, useState } from 'react';
import { AlertTriangle, Copy, Check, Loader2 } from 'lucide-react';

export interface ApprovalRequest {
  requestId: string;
  nodeUrl: string;
  to: string;
  token: string;
  amount: string;
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
          
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-center">
            <p className="text-sm text-indigo-300 font-medium mb-1">Amount Requested</p>
            <p className="text-3xl font-bold text-white">
              {request.amount} <span className="text-xl text-indigo-400">{request.token}</span>
            </p>
          </div>

          <div className="space-y-3 bg-gray-950/50 p-4 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center border-b border-gray-800/50 pb-2">
              <span className="text-sm text-gray-500">Destination Node</span>
              <span className="text-sm font-medium text-gray-200 truncate max-w-[180px]">{request.nodeUrl}</span>
            </div>
            
            <div className="flex justify-between items-center border-b border-gray-800/50 pb-2">
              <span className="text-sm text-gray-500">Recipient Address</span>
              <div className="flex items-center gap-2">
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
              <span className="text-sm text-gray-500">Reason</span>
              <span className="text-sm text-gray-300">{request.reason || 'Insufficient balance for tool call'}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Chain ID</span>
              <span className="text-sm font-mono text-gray-300">{request.chainId}</span>
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
