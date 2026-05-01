import { PaymentPolicy } from './policy';

/**
 * Extract cost from a cost_only response.
 * Supports multiple formats:
 *   Format A (flat object): { "HyPC": { "estimated_cost": 3556315, "max": ..., "min": ... } }
 *   Format B (costs array): { "costs": [{ "currency": "USDC", "estimated_cost": 20000 }] }
 */
function extractCostFromCostOnly(costData: any, currencyType: string): bigint {
  if (!costData) return 0n;

  // Format A: flat object keyed by currency name
  const directEntry = costData[currencyType] || costData['HyPC'] || costData['USDC'];
  if (directEntry && typeof directEntry === 'object' && !Array.isArray(directEntry)) {
    const costValue = directEntry.estimated_cost ?? directEntry.max ?? directEntry.used ?? directEntry.fixed ?? 0;
    if (costValue > 0) return BigInt(costValue);
  }

  // Format B: costs array
  if (costData.costs && Array.isArray(costData.costs)) {
    const entry = costData.costs.find((c: any) => c.currency === currencyType)
      || costData.costs.find((c: any) => c.currency === 'HyPC')
      || costData.costs[0];

    if (entry) {
      const costValue = entry.estimated_cost ?? entry.max ?? entry.used ?? 0;
      if (costValue > 0) return BigInt(costValue);
    }
  }

  return 0n;
}

export function calculateTopUpAmount(
  paymentDetails: any,
  policy: PaymentPolicy,
  costOnlyData?: any,
  currencyType: string = 'USDC'
): bigint {
  let requiredMissing = 0n;

  // Priority 1: Use cost_only response data if available (actual cost from node)
  if (costOnlyData) {
    requiredMissing = extractCostFromCostOnly(costOnlyData, currencyType);
  }

  // Priority 2: Fall back to parsing the 402 response body
  if (requiredMissing === 0n && paymentDetails) {
    if (typeof paymentDetails.missing === 'string' || typeof paymentDetails.missing === 'number') {
      requiredMissing = BigInt(paymentDetails.missing);
    } else if (
      (typeof paymentDetails.cost === 'string' || typeof paymentDetails.cost === 'number') &&
      (typeof paymentDetails.balance === 'string' || typeof paymentDetails.balance === 'number')
    ) {
      const missingRaw = BigInt(paymentDetails.cost) - BigInt(paymentDetails.balance);
      if (missingRaw > 0n) {
        requiredMissing = missingRaw;
      }
    } else if (paymentDetails.quote?.max) {
      requiredMissing = BigInt(paymentDetails.quote.max);
    }
  }

  // Apply safety multiplier
  const scaledMissing = requiredMissing * BigInt(policy.safetyMultiplier);

  // Take the maximum of computed cost and the absolute configured minimum
  let topUp = scaledMissing > policy.minTopUp ? scaledMissing : policy.minTopUp;

  // Clamp upper end by the node config limit
  if (topUp > policy.maxTopUpPerNode) {
    topUp = policy.maxTopUpPerNode;
  }

  return topUp;
}
