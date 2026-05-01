export interface PaymentPolicy {
  requireConfirmation: boolean;
  confirmationsRequired: number;
  minTopUp: bigint;
  maxTopUpPerNode: bigint;
  safetyMultiplier: number;
  maxPerTx: bigint;
  maxPerDay: bigint;
  allowNewNodeTopUps: boolean;
  allowedDrivers: string[];
  allowedCurrencies: string[];
}

export const defaultEthMainnetPolicy: PaymentPolicy = {
  requireConfirmation: true,
  confirmationsRequired: 1,
  minTopUp: 100n, // 0.0001 USDC (6 decimals) — actual cost comes from cost_only
  maxTopUpPerNode: 10_000_000n, // 10 USDC
  safetyMultiplier: 1, // Use exact cost from cost_only; no inflation
  maxPerTx: 50_000_000n, // 50 USDC
  maxPerDay: 200_000_000n, // 200 USDC tracked locally
  allowNewNodeTopUps: true,
  allowedDrivers: ['ethereum'],
  allowedCurrencies: ['USDC', 'HyPC'],
};

// Headless fallback — used by call_paid_aim when invoked from main process
// after user has already approved via the modal
export const defaultHeadlessPolicy: PaymentPolicy = {
  ...defaultEthMainnetPolicy,
  requireConfirmation: false,
};
