/**
 * NFT Verification Backend using Koios API
 * Checks if a Cardano address holds NFTs matching specific policy IDs
 * 
 * Based on cardano-tools skill pattern for Koios client integration
 */

export interface NFTAsset {
  policyId: string;
  assetName: string;
  quantity: string;
  fingerprint?: string;
}

export interface NFTVerificationResult {
  hasAccess: boolean;
  matchedPolicies: string[];
  assets: NFTAsset[];
  error?: string;
}

export interface KoiosConfig {
  network: 'mainnet' | 'preprod' | 'preview';
  apiKey?: string;
  timeoutMs?: number;
}

const KOIOS_ENDPOINTS: Record<string, string> = {
  mainnet: 'https://api.koios.rest/api/v1',
  preprod: 'https://preprod.koios.rest/api/v1',
  preview: 'https://preview.koios.rest/api/v1',
};

/**
 * Verify that a Cardano address holds NFTs for the given policy IDs
 * Uses Koios /address_assets endpoint to query all assets at an address
 * then filters by policy ID prefix match.
 */
export async function verifyPolicyOwnership(
  address: string,
  policyIds: string[],
  config: KoiosConfig = { network: 'mainnet', timeoutMs: 30000 }
): Promise<NFTVerificationResult> {
  if (!address || (!address.startsWith('addr') && !address.startsWith('stake'))) {
    return { hasAccess: false, matchedPolicies: [], assets: [], error: 'Invalid Cardano address (must start with addr or stake)' };
  }

  if (!policyIds || policyIds.length === 0) {
    return { hasAccess: false, matchedPolicies: [], assets: [], error: 'No policy IDs provided' };
  }

  // Normalize policy IDs to lowercase
  const normalizedPolicyIds = policyIds.map(p => p.toLowerCase().trim());

  try {
    const endpoint = KOIOS_ENDPOINTS[config.network] || KOIOS_ENDPOINTS.mainnet;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 30000);

    // Koios /address_assets returns all assets at the address
    const response = await fetch(`${endpoint}/address_assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({ _addresses: [address] }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[NFTVerifier] Koios error ${response.status}: ${errorText}`);
      return { hasAccess: false, matchedPolicies: [], assets: [], error: `Koios API error: ${response.status}` };
    }

    const data = await response.json();

    // Koios returns an array of objects: [{ address, asset_list: [{ policy_id, asset_name, fingerprint, quantity }] }]
    if (!Array.isArray(data) || data.length === 0) {
      return { hasAccess: false, matchedPolicies: [], assets: [], error: 'No assets found at address' };
    }

    const assetList = data[0]?.asset_list || [];
    const matchedPolicies: string[] = [];
    const matchedAssets: NFTAsset[] = [];

    for (const asset of assetList) {
      const assetPolicyId = (asset.policy_id || '').toLowerCase();
      const assetNameHex = asset.asset_name || '';
      const quantity = asset.quantity || '0';

      // Check if this asset's policy ID is in our required list
      if (normalizedPolicyIds.includes(assetPolicyId)) {
        if (!matchedPolicies.includes(assetPolicyId)) {
          matchedPolicies.push(assetPolicyId);
        }
        matchedAssets.push({
          policyId: assetPolicyId,
          assetName: assetNameHex,
          quantity: quantity.toString(),
          fingerprint: asset.fingerprint,
        });
      }
    }

    // Filter: only include assets that look like NFTs (quantity <= 1 is typical for NFTs)
    // BUT: Some legitimate NFT collections have limited editions with quantity > 1
    // Make this filter lenient — accept any positive quantity for policy verification
    const nftAssets = matchedAssets.filter(a => parseInt(a.quantity, 10) > 0);

    const hasAccess = nftAssets.length > 0;

    return {
      hasAccess,
      matchedPolicies: Array.from(new Set(nftAssets.map(a => a.policyId))),
      assets: nftAssets,
    };

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { hasAccess: false, matchedPolicies: [], assets: [], error: 'Request timeout - Koios API took too long' };
    }
    console.error('[NFTVerifier] Error verifying NFT ownership:', error);
    return { hasAccess: false, matchedPolicies: [], assets: [], error: error.message || 'Unknown verification error' };
  }
}

/**
 * Alternative: Use Koios /account_assets for stake address queries
 * Some addresses may be queried more reliably via stake address
 */
export async function verifyPolicyOwnershipByStakeAddress(
  stakeAddress: string,
  policyIds: string[],
  config: KoiosConfig = { network: 'mainnet', timeoutMs: 30000 }
): Promise<NFTVerificationResult> {
  if (!stakeAddress || !stakeAddress.startsWith('stake')) {
    return { hasAccess: false, matchedPolicies: [], assets: [], error: 'Invalid stake address' };
  }

  if (!policyIds || policyIds.length === 0) {
    return { hasAccess: false, matchedPolicies: [], assets: [], error: 'No policy IDs provided' };
  }

  const normalizedPolicyIds = policyIds.map(p => p.toLowerCase().trim());

  try {
    const endpoint = KOIOS_ENDPOINTS[config.network] || KOIOS_ENDPOINTS.mainnet;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 30000);

    const response = await fetch(`${endpoint}/account_assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({ _stake_addresses: [stakeAddress] }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return { hasAccess: false, matchedPolicies: [], assets: [], error: `Koios API error: ${response.status}` };
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return { hasAccess: false, matchedPolicies: [], assets: [], error: 'No assets found for stake address' };
    }

    // account_assets returns: [{ stake_address, asset_list: [...] }]
    const allAssets: any[] = [];
    for (const account of data) {
      if (account.asset_list && Array.isArray(account.asset_list)) {
        allAssets.push(...account.asset_list);
      }
    }

    const matchedPolicies: string[] = [];
    const matchedAssets: NFTAsset[] = [];

    for (const asset of allAssets) {
      const assetPolicyId = (asset.policy_id || '').toLowerCase();
      if (normalizedPolicyIds.includes(assetPolicyId)) {
        if (!matchedPolicies.includes(assetPolicyId)) {
          matchedPolicies.push(assetPolicyId);
        }
        matchedAssets.push({
          policyId: assetPolicyId,
          assetName: asset.asset_name || '',
          quantity: (asset.quantity || '0').toString(),
          fingerprint: asset.fingerprint,
        });
      }
    }

    // Accept any positive quantity for policy verification (not strictly <= 1)
    const nftAssets = matchedAssets.filter(a => parseInt(a.quantity, 10) > 0);
    const hasAccess = nftAssets.length > 0;

    return {
      hasAccess,
      matchedPolicies: Array.from(new Set(nftAssets.map(a => a.policyId))),
      assets: nftAssets,
    };

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { hasAccess: false, matchedPolicies: [], assets: [], error: 'Request timeout' };
    }
    return { hasAccess: false, matchedPolicies: [], assets: [], error: error.message || 'Unknown error' };
  }
}

/**
 * Check a single policy ID quickly
 */
export async function hasPolicyNFT(
  address: string,
  policyId: string,
  config?: KoiosConfig
): Promise<boolean> {
  const result = await verifyPolicyOwnership(address, [policyId], config);
  return result.hasAccess;
}
