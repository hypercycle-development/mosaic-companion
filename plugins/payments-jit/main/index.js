import { callPaidAimWithJit } from '../shared/jitDepositOrchestrator';
import { defaultHeadlessPolicy } from '../shared/policy';
import { InternalWalletPaymentSigner } from './web3Tools';
import { NodeManagerClient } from '../../aim-nodes/shared/nodeManagerClient/NodeManagerClient';
export function registerPaymentsJitIpc(ipcMain) {
    ipcMain.handle('payments-jit:approve_tx_result', (_e, { requestId, approved }) => {
        const handler = global.__paymentJitResolvers?.[requestId];
        if (handler) {
            handler(approved);
            delete global.__paymentJitResolvers[requestId];
        }
        return { success: true };
    });
}
/**
 * High-level tool mapping for MCP framework.
 * Orchestrates Phase 1 NodeManager calls with Phase 2 JIT tops ups.
 */
export async function call_paid_aim(args) {
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
        aimNodesClientFactory: () => new NodeManagerClient({
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
