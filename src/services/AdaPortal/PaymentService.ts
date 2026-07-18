// ============================================
// ADA PORTAL - Payment Service
// End-to-end payment orchestration for Hire Agents & Bundles
// Uses viem for EVM blockchain interactions
// ============================================

import { createPublicClient, http, parseUnits, formatUnits, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';
import { erc20Abi } from 'viem';

// ============================================
// TYPES
// ============================================

export type PaymentStatus = 'idle' | 'checking_balance' | 'insufficient_funds' | 'awaiting_confirmation' | 'building_tx' | 'signing' | 'broadcasting' | 'pending' | 'confirmed' | 'failed';
export type PaymentWalletType = 'evm' | 'cardano' | 'none';

export interface PaymentRequest {
  amount: number;           // in USDC (human-readable, e.g. 50.00)
  recipient: string;        // recipient address (0x...)
  description: string;      // e.g. "Hire agent CryptoMark"
  metadata?: Record<string, unknown>;
}

export interface PaymentReceipt {
  txHash: string;
  status: 'confirmed' | 'failed' | 'pending';
  amount: number;
  recipient: string;
  timestamp: number;
  description: string;
  chainId: number;
  token: 'USDC';
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  success: boolean;
  receipt?: PaymentReceipt;
  error?: string;
  status: PaymentStatus;
}

export interface PaymentWalletInfo {
  type: PaymentWalletType;
  address: string | null;
  chainId: number | null;
  balanceUsdc?: string;
  balanceEth?: string;
  connected: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const USDC_DECIMALS = 6;
const MIN_USDC_BALANCE = 0.01; // minimum to consider "has balance"

// ERC-20 transfer ABI fragment
const ERC20_TRANSFER_ABI = {
  type: 'function',
  name: 'transfer',
  inputs: [
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ],
  outputs: [{ name: '', type: 'bool' }],
  stateMutability: 'nonpayable'
} as const;

const ERC20_BALANCE_ABI = {
  type: 'function',
  name: 'balanceOf',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view'
} as const;

// ============================================
// PUBLIC CLIENT (read-only, Base)
// ============================================

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://base.publicnode.com'),
});

// ============================================
// WALLET DETECTION
// ============================================

function detectWallet(): PaymentWalletInfo {
  // Priority 1: window.ethereum (MetaMask, etc.)
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return { type: 'evm', address: null, chainId: null, connected: false };
  }
  // Priority 2: window.mosaic?.wallet
  if (typeof window !== 'undefined' && (window as any).mosaic?.wallet) {
    return { type: 'evm', address: null, chainId: null, connected: false };
  }
  // Priority 3: Mosaic Electron stored wallet (safeStorage-backed viem wallet)
  if (typeof window !== 'undefined' && (window as any).electronAPI?.web3?.getAddress) {
    return { type: 'evm', address: null, chainId: null, connected: false };
  }
  // Priority 4: Cardano via Electron bridge
  if (typeof window !== 'undefined' && (window as any).electronAPI?.cardano) {
    return { type: 'cardano', address: null, chainId: null, connected: false };
  }
  return { type: 'none', address: null, chainId: null, connected: false };
}

async function getEvmAddress(): Promise<string | null> {
  try {
    // Priority 1: window.ethereum (MetaMask, injected wallet)
    const ethereum = (window as any).ethereum;
    if (ethereum) {
      const accounts = await ethereum.request({ method: 'eth_accounts' });
      return accounts?.[0] || null;
    }
    // Priority 2: Mosaic Electron stored wallet (safeStorage-backed)
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.web3?.getAddress) {
      const result = await electronAPI.web3.getAddress();
      if (result?.success && result?.data?.address) {
        return result.data.address;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function getCardanoAddress(): Promise<string | null> {
  try {
    const result = await (window as any).electronAPI?.cardano?.getWalletAssets?.();
    if (result?.success && result?.data?.address) {
      return result.data.address;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeToolTxHash(toolResult: any): string | null {
  if (!toolResult) return null;
  // Direct structured return: { txHash: '0x...', ... }
  if (typeof toolResult.txHash === 'string') return toolResult.txHash;
  if (typeof toolResult.hash === 'string') return toolResult.hash;
  // String-return fallback: 'Tx Hash: 0x...'
  if (typeof toolResult === 'string') {
    const match = toolResult.match(/Tx Hash:\s*(0x[a-fA-F0-9]+)/i);
    return match?.[1] || null;
  }
  return null;
}

// ============================================
// BALANCE CHECKING
// ============================================

async function getUsdcBalance(address: string): Promise<string> {
  try {
    const balance = await (publicClient as any).readContract({
      address: USDC_BASE,
      abi: erc20Abi as any,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });
    return formatUnits(balance as bigint, USDC_DECIMALS);
  } catch (e: any) {
    console.error('[PaymentService] USDC balance read failed:', e.message);
    return '0';
  }
}

async function getEthBalance(address: string): Promise<string> {
  try {
    const balance = await publicClient.getBalance({ address: address as `0x${string}` });
    return formatUnits(balance, 18);
  } catch (e: any) {
    console.error('[PaymentService] ETH balance read failed:', e.message);
    return '0';
  }
}

// ============================================
// PAYMENT SERVICE CLASS
// ============================================

class PaymentService {
  private status: PaymentStatus = 'idle';
  private statusListeners: Set<(status: PaymentStatus) => void> = new Set();
  private receiptListeners: Set<(receipt: PaymentReceipt) => void> = new Set();

  // Event subscriptions
  onStatusChange(callback: (status: PaymentStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  onReceipt(callback: (receipt: PaymentReceipt) => void): () => void {
    this.receiptListeners.add(callback);
    return () => this.receiptListeners.delete(callback);
  }

  private setStatus(status: PaymentStatus) {
    this.status = status;
    this.statusListeners.forEach(cb => cb(status));
  }

  getStatus(): PaymentStatus {
    return this.status;
  }

  // ============================================
  // WALLET DETECTION
  // ============================================

  async detectWallet(): Promise<PaymentWalletInfo> {
    const detected = detectWallet();
    if (detected.type === 'evm') {
      const address = await getEvmAddress();
      if (address) {
        const chainId = await this.getEvmChainId();
        const usdc = await getUsdcBalance(address);
        const eth = await getEthBalance(address);
        return { type: 'evm', address, chainId, balanceUsdc: usdc, balanceEth: eth, connected: true };
      }
    }
    if (detected.type === 'cardano') {
      const address = await getCardanoAddress();
      if (address) {
        return { type: 'cardano', address, chainId: null, connected: true };
      }
    }
    return detected;
  }

  private async getEvmChainId(): Promise<number | null> {
    try {
      const ethereum = (window as any).ethereum;
      if (ethereum) {
        const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
        return parseInt(chainIdHex, 16);
      }
      // For Mosaic Electron stored wallet, assume Base (8453)
      // since the tool handles chain internally
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.web3?.getAddress) return 8453;
      return null;
    } catch {
      return null;
    }
  }

  // ============================================
  // BALANCE CHECK
  // ============================================

  async checkBalance(address: string, requiredUsdc: number): Promise<{ sufficient: boolean; currentUsdc: string; currentEth: string }> {
    this.setStatus('checking_balance');
    const usdc = await getUsdcBalance(address);
    const eth = await getEthBalance(address);
    const sufficient = parseFloat(usdc) >= requiredUsdc && parseFloat(eth) > 0.0001;
    if (!sufficient) {
      this.setStatus('insufficient_funds');
    }
    return { sufficient, currentUsdc: usdc, currentEth: eth };
  }

  // ============================================
  // NETWORK SWITCH (Base) — browser wallets only
  // ============================================

  async ensureBaseChain(): Promise<boolean> {
    // Browser injected wallet: enforce/switch active chain
    try {
      const ethereum = (window as any).ethereum;
      if (ethereum) {
        const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
        const chainId = parseInt(chainIdHex, 16);
        if (chainId === 8453) return true;
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x2105' }], // 8453 in hex
        });
        return true;
      }
    } catch (e: any) {
      if (e.code === 4902) {
        try {
          const ethereum = (window as any).ethereum;
          if (ethereum) {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base Mainnet',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://base.publicnode.com', 'https://base-rpc.publicnode.com'],
                blockExplorerUrls: ['https://basescan.org'],
              }],
            });
            return true;
          }
        } catch {
          return false;
        }
      }
      return false;
    }
    // Electron stored wallet: tool backend handles Base internally
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.web3?.getAddress) return true;
    return false;
  }

  // ============================================
  // EXECUTE PAYMENT
  // ============================================

  async executePayment(request: PaymentRequest): Promise<PaymentResult> {
    this.setStatus('building_tx');

    try {
      const wallet = await this.detectWallet();
      if (wallet.type === 'none' || !wallet.connected || !wallet.address) {
        return { success: false, status: 'failed', error: 'No wallet connected. Please connect MetaMask or an EVM wallet first.' };
      }
      if (wallet.type === 'cardano') {
        return { success: false, status: 'failed', error: 'Cardano wallet detected. Please connect an EVM wallet (MetaMask) to pay in USDC on Base.' };
      }

      // Ensure we're on Base
      const onBase = await this.ensureBaseChain();
      if (!onBase) {
        return { success: false, status: 'failed', error: 'Could not switch to Base chain. Please switch manually in your wallet.' };
      }

      // Check balance
      const balanceCheck = await this.checkBalance(wallet.address, request.amount);
      if (!balanceCheck.sufficient) {
        return {
          success: false,
          status: 'insufficient_funds',
          error: `Insufficient funds. You have ${balanceCheck.currentUsdc} USDC but need ${request.amount} USDC. Also ensure you have ETH for gas (${balanceCheck.currentEth} ETH).`
        };
      }

      this.setStatus('signing');

      // ── Path A: Browser injected wallet (window.ethereum) ──────────────────
      const ethereum = (window as any).ethereum;
      if (ethereum) {
        const amountWei = parseUnits(request.amount.toString(), USDC_DECIMALS);
        const data = encodeFunctionData({
          abi: [ERC20_TRANSFER_ABI],
          functionName: 'transfer',
          args: [request.recipient as `0x${string}`, amountWei],
        });
        const txHash = await ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: wallet.address,
            to: USDC_BASE,
            data,
            value: '0x0',
          }],
        });

        this.setStatus('broadcasting');
        console.log('[PaymentService] TX broadcast (browser):', txHash);

        // Wait for confirmation
        this.setStatus('pending');
        const receipt = await (publicClient as any).waitForTransactionReceipt({ hash: txHash });

        if (receipt.status === 'success') {
          const paymentReceipt: PaymentReceipt = {
            txHash,
            status: 'confirmed',
            amount: request.amount,
            recipient: request.recipient,
            timestamp: Date.now(),
            description: request.description,
            chainId: 8453,
            token: 'USDC',
            metadata: request.metadata,
          };

          this.receiptListeners.forEach(cb => cb(paymentReceipt));
          this.setStatus('confirmed');
          return { success: true, status: 'confirmed', receipt: paymentReceipt };
        } else {
          this.setStatus('failed');
          return { success: false, status: 'failed', error: 'Transaction reverted on-chain.' };
        }
      }

      // ── Path B: Mosaic Electron stored wallet ──────────────────────────────
      const electronAPI = (window as any).electronAPI;
      const exec = electronAPI?.tools?.execute;
      if (exec) {
        const decimals = USDC_DECIMALS; // 6
        const transferResult: any = await exec('web3:transfer_token', {
          contractAddress: USDC_BASE,
          recipient: request.recipient,
          amount: request.amount,
          decimals,
        });

        const txHash = normalizeToolTxHash(transferResult);
        if (!txHash) {
          this.setStatus('failed');
          return { success: false, status: 'failed', error: 'Token transfer failed: no tx hash returned.' };
        }

        this.setStatus('broadcasting');
        console.log('[PaymentService] TX broadcast (electron):', txHash);

        // Wait for confirmation
        this.setStatus('pending');
        const receipt = await (publicClient as any).waitForTransactionReceipt({ hash: txHash });

        if (receipt.status === 'success') {
          const paymentReceipt: PaymentReceipt = {
            txHash,
            status: 'confirmed',
            amount: request.amount,
            recipient: request.recipient,
            timestamp: Date.now(),
            description: request.description,
            chainId: 8453,
            token: 'USDC',
            metadata: request.metadata,
          };

          this.receiptListeners.forEach(cb => cb(paymentReceipt));
          this.setStatus('confirmed');
          return { success: true, status: 'confirmed', receipt: paymentReceipt };
        } else {
          this.setStatus('failed');
          return { success: false, status: 'failed', error: 'Transaction reverted on-chain.' };
        }
      }

      this.setStatus('failed');
      return { success: false, status: 'failed', error: 'No available wallet provider to sign the transaction.' };

    } catch (e: any) {
      console.error('[PaymentService] Payment failed:', e);
      this.setStatus('failed');
      return { success: false, status: 'failed', error: e.message || 'Payment failed' };
    }
  }

  // ============================================
  // QUICK PAY (agent hire / bundle purchase)
  // ============================================

  async payForAgent(agentId: string, agentName: string, amount: number, sellerAddress: string): Promise<PaymentResult> {
    return this.executePayment({
      amount,
      recipient: sellerAddress,
      description: `Hire agent: ${agentName}`,
      metadata: { type: 'agent_hire', agentId, agentName },
    });
  }

  async payForBundle(packageId: string, packageName: string, amount: number, sellerAddress: string): Promise<PaymentResult> {
    return this.executePayment({
      amount,
      recipient: sellerAddress,
      description: `Bundle purchase: ${packageName}`,
      metadata: { type: 'bundle_purchase', packageId, packageName },
    });
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const paymentService = new PaymentService();
export { PaymentService };
