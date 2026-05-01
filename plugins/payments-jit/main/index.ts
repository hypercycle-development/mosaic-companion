import { callPaidAimWithJit } from '../shared/jitDepositOrchestrator';
import { defaultHeadlessPolicy } from '../shared/policy';
import { InternalWalletPaymentSigner } from './web3Tools';
import { NodeManagerClient } from '../../aim-nodes/shared/nodeManagerClient/NodeManagerClient';

export interface CallPaidAimArgs {
  nodeUrl: string;
  slot: number;
  actionPath: string;
  payload?: any;
  currencyType?: string;
  txDriver?: string;
  
  // Wallet config injected from env or store by MCP framework
  privateKey: `0x${string}`;
  chainId: number;
  rpcUrl?: string;

  /** Override the top-up amount (in token base units) instead of auto-calculating from cost_only */
  costOverrideBaseUnits?: string;
}

export function registerPaymentsJitIpc(ipcMain: Electron.IpcMain) {
  ipcMain.handle('payments-jit:approve_tx_result', (_e, { requestId, approved }) => {
    const handler = (global as any).__paymentJitResolvers?.[requestId];
    if (handler) {
      handler(approved);
      delete (global as any).__paymentJitResolvers[requestId];
    }
    return { success: true };
  });
}

/**
 * High-level tool mapping for MCP framework. 
 * Orchestrates Phase 1 NodeManager calls with Phase 2 JIT tops ups.
 */
export async function call_paid_aim(args: CallPaidAimArgs): Promise<any> {
  // Construct the signer. It fulfills BOTH IPaymentSigner (ERC20s) and INodeSigner (SignMessage).
  const signer = new InternalWalletPaymentSigner({
    privateKey: args.privateKey,
    chainId: args.chainId,
    rpcUrl: args.rpcUrl,
  });

  return callPaidAimWithJit({
    nodeUrl: args.nodeUrl,
    slot: args.slot,
    actionPath: args.actionPath,
    payload: args.payload,
    currencyType: args.currencyType,
    txDriver: args.txDriver,
    costOverrideBaseUnits: args.costOverrideBaseUnits,
    // Phase 1 client configured strictly for backend_viem
    aimNodesClientFactory: () =>
      new NodeManagerClient({
        baseUrl: args.nodeUrl,
        mode: 'backend_viem',
        signer: signer,
        defaultCurrencyType: args.currencyType || 'USDC',
        defaultTxDriver: args.txDriver || 'ethereum',
      }),
    paymentSigner: signer,
    policy: defaultHeadlessPolicy, // using headless since we're inside MCP
  });
}
