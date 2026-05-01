import { Address } from './types';

export interface ClaimArgs {
  txHash: Address;
  sender: Address;
  valueBaseUnits: bigint;
  currencyType?: string;
  txDriver?: string;
}

/**
 * Executes the balance claim against the Node Manager.
 * 
 * Based on the working hypercyclejs flow, the claim is a POST /balance with:
 * - tx-id, tx-value, tx-sender, tx-origin as HEADERS
 * - EMPTY body (Content-Length: 0)
 * - currency-type, tx-driver, hypc-program as additional headers
 * 
 * The node verifies the on-chain transaction and credits the balance.
 * Response includes "verified": "true" and "verification_message": "Processed: Valid Payment" on success.
 */
export async function claimDeposit(
  nodeUrl: string,
  args: ClaimArgs,
  fetchImpl: typeof fetch = fetch
): Promise<any> {
  const url = `${nodeUrl.replace(/\/+$/, '')}/balance`;

  // All claim data goes in HEADERS, NOT in the body
  const headers: Record<string, string> = {
    'tx-id': args.txHash,
    'tx-value': args.valueBaseUnits.toString(),
    'tx-sender': args.sender,
    'tx-origin': args.sender,
    'currency-type': args.currencyType || 'USDC',
    'tx-driver': args.txDriver || 'ethereum',
    'hypc-program': '',
    'ngrok-skip-browser-warning': 'true',
  };

  console.error?.(`[BalanceClaimer] POST ${url} with headers: tx-id=${args.txHash.slice(0, 12)}..., tx-value=${args.valueBaseUnits}, currency=${args.currencyType}`);

  const res = await fetchImpl(url, {
    method: 'POST',
    headers,
    // Empty body — the working implementation sends Content-Length: 0
  });

  let responseData: any = null;
  try {
    responseData = await res.json();
  } catch {
    // Response might not be JSON
  }

  if (res.ok) {
    const verified = responseData?.verified === 'true' || responseData?.verified === true;
    console.error?.(`[BalanceClaimer] Claim response: status=${res.status}, verified=${verified}, message=${responseData?.verification_message || 'N/A'}`);
    
    if (verified) {
      console.error?.('[BalanceClaimer] ✅ Deposit verified and credited by node');
    } else {
      console.error?.('[BalanceClaimer] ⚠️ Claim returned 200 but verified=false. Node may still be processing.');
    }

    return responseData;
  }

  const errorText = JSON.stringify(responseData) || `HTTP ${res.status}`;
  throw new Error(
    `Failed to claim deposit on Node Manager via /balance. Status: ${res.status}. Response: ${errorText}`
  );
}
