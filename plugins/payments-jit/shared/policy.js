export const defaultEthMainnetPolicy = {
    requireConfirmation: true,
    confirmationsRequired: 1,
    minTopUp: 100n, // 0.0001 USDC (6 decimals) — actual cost comes from cost_only
    maxTopUpPerNode: 10000000n, // 10 USDC
    safetyMultiplier: 1, // Use exact cost from cost_only; no inflation
    maxPerTx: 50000000n, // 50 USDC
    maxPerDay: 200000000n, // 200 USDC tracked locally
    allowNewNodeTopUps: true,
    allowedDrivers: ['ethereum'],
    allowedCurrencies: ['USDC', 'HyPC'],
};
// Headless fallback — used by call_paid_aim when invoked from main process
// after user has already approved via the modal
export const defaultHeadlessPolicy = {
    ...defaultEthMainnetPolicy,
    requireConfirmation: false,
};
