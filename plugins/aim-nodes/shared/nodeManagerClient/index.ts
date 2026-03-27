import { NodeManagerClient } from './NodeManagerClient';
import { INodeSigner, Address } from './types';

export * from './types';
export * from './errors';
export * from './signature';
export * from './NodeManagerClient';

export interface AimCallPaidOptions {
  nodeUrl: string;
  slot: number;
  actionPath: string;
  payload?: any;
  mode: 'frontend_hypercyclejs' | 'backend_viem';
  currencyType?: string;
  txDriver?: string;
  signer?: INodeSigner;
  sender?: Address;
}

/**
 * High-level wrapper for an MCP tool to easily execute a paid AIM call.
 * Internally instantiates a NodeManagerClient and performs the callAim flow.
 * Throws PaymentRequiredError on 402 for downstream orchestration to catch.
 */
export async function aimCallPaid({
  nodeUrl,
  slot,
  actionPath,
  payload = {},
  mode,
  currencyType = 'USDC',
  txDriver = 'ethereum',
  signer,
  sender,
}: AimCallPaidOptions): Promise<any> {
  const client = new NodeManagerClient({
    baseUrl: nodeUrl,
    mode,
    signer,
    defaultCurrencyType: currencyType,
    defaultTxDriver: txDriver,
  });

  const response = await client.callAim({
    slot,
    actionPath,
    payload,
    sender,
  });

  return response.data;
}
