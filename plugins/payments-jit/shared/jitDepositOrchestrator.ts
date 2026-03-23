import { PaymentRequiredError, NodeManagerClient } from '../../aim-nodes/shared/nodeManagerClient';
import { IPaymentSigner, PolicyDeniedError, UserRejectedError } from './types';
import { PaymentPolicy } from './policy';
import { getToken } from './tokenRegistry';
import { calculateTopUpAmount } from './topUpCalculator';
import { claimDeposit } from './balanceClaimer';

interface SpendTracker {
  recordSpend(amount: bigint): void;
  getDailySpend(): bigint;
}

// Very simple in-memory spend tracker (could be replaced with localStorage/SQLite backing)
class InMemorySpendTracker implements SpendTracker {
  private spendByDate: Record<string, bigint> = {};

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  recordSpend(amount: bigint): void {
    const key = this.getTodayKey();
    if (!this.spendByDate[key]) {
      this.spendByDate[key] = 0n;
    }
    this.spendByDate[key] += amount;
  }

  getDailySpend(): bigint {
    return this.spendByDate[this.getTodayKey()] || 0n;
  }
}

const globalSpendTracker = new InMemorySpendTracker();

export async function callPaidAimWithJit(args: {
  nodeUrl: string;
  slot: number;
  actionPath: string;
  payload?: any;
  currencyType?: string;
  txDriver?: string;
  costOverrideBaseUnits?: string;
  aimNodesClientFactory: () => NodeManagerClient;
  paymentSigner: IPaymentSigner;
  policy: PaymentPolicy;
  logger?: any;
}): Promise<any> {
  const {
    nodeUrl,
    slot,
    actionPath,
    payload = {},
    currencyType = 'USDC',
    txDriver = 'ethereum',
    costOverrideBaseUnits,
    aimNodesClientFactory,
    paymentSigner,
    policy,
    logger = console,
  } = args;

  const client = aimNodesClientFactory();

  const doAimCall = () =>
    client.callAim({
      slot,
      actionPath,
      payload,
      currencyType,
      txDriver,
    });

  try {
    // Attempt the call
    const res = await doAimCall();
    return res.data;
  } catch (error: any) {
    if (!(error instanceof PaymentRequiredError)) {
      throw error;
    }

    // It's a 402. Let's start the JIT process.
    logger.error(`[JIT] Received 402 Payment Required from ${nodeUrl}. Initiating JIT top-up.`);

    // Fetch cost estimate via cost_only (no auth required)
    let costEstimate: any = null;
    try {
      costEstimate = await client.getCostEstimate({
        slot,
        actionPath,
        payload,
        currencyType,
        txDriver,
      });
      logger.error(`[JIT] Cost estimate received:`, JSON.stringify(costEstimate).slice(0, 300));
    } catch (costErr: any) {
      logger.error(`[JIT] Failed to get cost estimate (will use policy defaults):`, costErr.message);
    }

    // Policy check for currency/driver
    if (!policy.allowedCurrencies.includes(currencyType)) {
      throw new PolicyDeniedError(`Currency ${currencyType} is not allowed by policy.`);
    }
    if (!policy.allowedDrivers.includes(txDriver)) {
      throw new PolicyDeniedError(`Driver ${txDriver} is not allowed by policy.`);
    }

    // Determine target address
    let tmAddress: `0x${string}`;
    let resolvedDriver = txDriver;
    let nodeNetwork = 'mainnet'; // default fallback if info.tm.network is missing

    try {
      const info = await client.getInfo();
      if (!info.tm?.address) {
        throw new Error('Node /info did not return tm.address');
      }
      tmAddress = info.tm.address as `0x${string}`;
      if (info.tm.driver) {
        resolvedDriver = info.tm.driver;
      }
      if (info.tm.network) {
        nodeNetwork = info.tm.network.toLowerCase();
      }
    } catch (e) {
      logger.warn('Failed to fetch node /info. Cannot proceed with JIT.', e);
      throw error; // throw the original 402
    }

    // Determine the expected chainId based on node /info network and driver
    let targetChainId = 1; // Default Ethereum Mainnet
    if (resolvedDriver === 'ethereum') {
      if (nodeNetwork === 'base') targetChainId = 8453;
      else if (nodeNetwork === 'sepolia') targetChainId = 11155111;
      else targetChainId = 1;
    }

    // Ensure the signer is pointing to the correct network required by the node
    await paymentSigner.switchNetwork(targetChainId);
    logger.info(`Switched wallet signer to chainId ${targetChainId} for ${nodeNetwork} (${resolvedDriver})`);

    const chainId = await paymentSigner.getChainId();
    const tokenMeta = getToken(chainId, currencyType);

    // Use cost override if provided (pre-computed from uri_cost), otherwise calculate
    let requiredCost: bigint;
    if (costOverrideBaseUnits) {
      requiredCost = BigInt(costOverrideBaseUnits);
      logger.error(`[JIT] Using cost override: ${requiredCost} base units of ${currencyType}`);
    } else {
      requiredCost = calculateTopUpAmount(error.payment, policy, costEstimate, currencyType);
      logger.error(`[JIT] Calculated required cost: ${requiredCost} base units of ${currencyType}`);
    }

    // Check existing balance on the node before deciding to top up
    const sender = await paymentSigner.getAddress();
    let existingBalance = 0n;
    try {
      const balanceData = await client.getBalance(sender as `0x${string}`);
      logger.error(`[JIT] Balance response:`, JSON.stringify(balanceData).slice(0, 300));
      
      // Parse balance: { balance: { "0xAddr": { "USDC": 12345 } } }
      if (balanceData?.balance) {
        const senderBalances = balanceData.balance[sender] || {};
        const currencyBalance = senderBalances[currencyType] || senderBalances['USDC'] || senderBalances['HyPC'] || 0;
        existingBalance = BigInt(currencyBalance);
      }
      logger.error(`[JIT] Existing balance on node: ${existingBalance} base units of ${currencyType}`);
    } catch (balErr: any) {
      logger.error(`[JIT] Failed to check balance (will proceed with full top-up):`, balErr.message);
    }

    // Node managers require balance to be STRICTLY GREATER than the cost.
    // Use a 0.5% buffer above the exact cost — enough to satisfy "strictly greater" without over-depositing.
    const buffered = requiredCost + (requiredCost * 5n / 1000n);
    const targetBalance = buffered > policy.minTopUp ? buffered : policy.minTopUp;

    // If existing balance is well above the required cost (more than 2x), skip the transfer and retry directly
    if (existingBalance > targetBalance) {
      logger.error(`[JIT] Existing balance (${existingBalance}) > target (${targetBalance}). Skipping top-up, retrying directly.`);
      try {
        const retryRes = await doAimCall();
        return retryRes.data;
      } catch (retryError) {
        if (retryError instanceof PaymentRequiredError) {
          logger.error('[JIT] Still got 402 despite seemingly sufficient balance.');
        }
        throw retryError;
      }
    }

    // Calculate delta: top up to reach the target balance (2x the cost)
    const topUpNeeded = targetBalance - existingBalance;
    // Ensure we meet minimum top-up threshold
    const amount = topUpNeeded > policy.minTopUp ? topUpNeeded : policy.minTopUp;
    logger.error(`[JIT] Top-up needed: ${topUpNeeded} (existing: ${existingBalance}, required: ${requiredCost}, target: ${targetBalance}, sending: ${amount})`);

    if (amount > policy.maxPerTx) {
      throw new PolicyDeniedError(`Calculated top-up ${amount} exceeds maxPerTx ${policy.maxPerTx}`);
    }

    const currentDailySpend = globalSpendTracker.getDailySpend();
    if (currentDailySpend + amount > policy.maxPerDay) {
      throw new PolicyDeniedError(
        `Top-up ${amount} would exceed maxPerDay limit of ${policy.maxPerDay} (current: ${currentDailySpend})`
      );
    }

    // Require confirmation via IPC (Stubbed for now in headless/automated mode)
    if (policy.requireConfirmation) {
      throw new UserRejectedError('requireConfirmation is true but no UI bridge is attached to approve the tx.');
    }

    // Execute transfer
    logger.info(`Sending ERC20 transfer of ${amount} ${currencyType} to ${tmAddress}`);
    const { txHash } = await paymentSigner.sendErc20Transfer({
      tokenAddress: tokenMeta.address,
      to: tmAddress,
      amount,
    });

    globalSpendTracker.recordSpend(amount);

    // Wait for confirmations
    logger.info(`Waiting for ${policy.confirmationsRequired} confirmations for tx ${txHash}...`);
    await paymentSigner.waitForConfirmations({
      txHash,
      confirmations: policy.confirmationsRequired,
    });

    // Claim balance with retry — node manager verifies the on-chain tx
    let claimVerified = false;
    const maxClaimAttempts = 3;
    const claimRetryDelayMs = 10_000; // 10s between retries

    for (let attempt = 1; attempt <= maxClaimAttempts; attempt++) {
      logger.error(`[JIT] Claiming balance via /balance for tx ${txHash} (attempt ${attempt}/${maxClaimAttempts})`);
      try {
        const claimResult = await claimDeposit(nodeUrl, {
          txHash,
          sender: sender as `0x${string}`,
          valueBaseUnits: amount,
          currencyType,
          txDriver: resolvedDriver,
        });

        // Check if the node verified the deposit
        if (claimResult?.verified === 'true' || claimResult?.verified === true) {
          logger.error(`[JIT] ✅ Deposit verified by node: ${claimResult.verification_message}`);
          claimVerified = true;
          break;
        } else {
          logger.error(`[JIT] Claim attempt ${attempt}: verified=${claimResult?.verified}, message=${claimResult?.verification_message}. ${attempt < maxClaimAttempts ? 'Retrying...' : 'Giving up.'}`);
        }
      } catch (claimErr: any) {
        logger.error(`[JIT] Claim attempt ${attempt} failed: ${claimErr.message}. ${attempt < maxClaimAttempts ? 'Retrying...' : 'Giving up.'}`);
      }

      if (attempt < maxClaimAttempts) {
        await new Promise(resolve => setTimeout(resolve, claimRetryDelayMs));
      }
    }

    // Verify balance was credited
    try {
      const verifyBalance = await client.getBalance(sender as `0x${string}`);
      logger.error(`[JIT] Balance after claim:`, JSON.stringify(verifyBalance).slice(0, 300));
    } catch (e) {
      logger.error(`[JIT] Could not verify balance after claim (non-fatal)`);
    }

    if (!claimVerified) {
      logger.error(`[JIT] ⚠️ Deposit claim was not verified after ${maxClaimAttempts} attempts. Proceeding with retry anyway.`);
    }

    logger.info('Claim process complete. Retrying AIM call...');

    // Retry aim call — deposit is now registered via the POST /balance claim above
    try {
      const retryRes = await doAimCall();
      return retryRes.data;
    } catch (retryError) {
      if (retryError instanceof PaymentRequiredError) {
        logger.error('AIM call returned 402 even after successful JIT top-up and claim.', retryError);
        // Extend original error slightly to indicate JIT happened
        retryError.message = `Payment Required (JIT Top-Up completed with tx ${txHash}, but node still rejected)`;
      }
      throw retryError;
    }
  }
}
