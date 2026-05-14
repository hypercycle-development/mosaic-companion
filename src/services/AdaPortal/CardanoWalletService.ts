// @ts-nocheck
// ============================================
// CARDANO WALLET SERVICE
// CIP-30 Wallet Integration + NFT Access Control
// ============================================

// NOTE: This service now uses Electron IPC bridge (window.electronAPI.cardano)
// when running in Electron, falling back to window.cardano for browser dev.
// The IPC bridge connects to the CardanoLaceModule in electron main process.

// ============================================
// WALLET TYPES
// ============================================

export type SupportedWallet = 'lace' | 'nami' | 'typhon' | 'yoroi' | 'eternl' | 'flint' | 'gerowallet';

export interface WalletInfo {
  walletName: SupportedWallet;
  displayName: string;
  icon?: string;
  connected: boolean;
  address?: string;
}

export interface WalletAsset {
  policyId: string;
  assetName: string;
  fingerprint: string;
  quantity: number;
  metadata?: {
    name?: string;
    image?: string;
    description?: string;
  };
}

export interface WalletUTXO {
  txHash: string;
  index: number;
  value: {
    coins: number;
    assets: WalletAsset[];
  };
}

export interface NFTAccessPolicy {
  policyId: string;
  collectionName: string;
  required: boolean;
}

export interface NFTVerificationResult {
  verified: boolean;
  ownedNFTs: WalletAsset[];
  matchedPolicies: string[];
  accessLevel: 'none' | 'standard' | 'premium' | 'dao';
  message: string;
}

export interface WalletSession {
  connected: boolean;
  walletName: SupportedWallet | null;
  address: string | null;
  utxos: WalletUTXO[];
  assets: WalletAsset[];
  verified: boolean;
  accessLevel: 'none' | 'standard' | 'premium' | 'dao';
  connectedAt: number | null;
}

// Default access policies - can be configured
const DEFAULT_ACCESS_POLICIES: NFTAccessPolicy[] = [
  {
    policyId: 'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46', // HPEC DAO PASS
    collectionName: 'HPEC DAO PASS',
    required: true
  },
  {
    policyId: '454fb57214730cb34f83d7b377308a76ab6e7140ea634a7fc63affa5', // CMHPEC DAO PASS
    collectionName: 'CMHPEC DAO PASS',
    required: true
  },
  {
    policyId: 'bc963a07e32da4d22b77c8cba7ab9f3df6241f37d7bfc9b0deb48f65', // HyperDegens
    collectionName: 'HyperDegens',
    required: true
  }
];

// ============================================
// WALLET SERVICE CLASS
// ============================================

class CardanoWalletService {
  private session: WalletSession = {
    connected: false,
    walletName: null,
    address: null,
    utxos: [],
    assets: [],
    verified: false,
    accessLevel: 'none',
    connectedAt: null
  };

  private accessPolicies: NFTAccessPolicy[] = DEFAULT_ACCESS_POLICIES;
  private walletAPI: any = null;
  
  // Event callbacks
  private onSessionChange: ((session: WalletSession) => void) | null = null;

  constructor() {
    this.initializeWalletAPI();
  }

  // ============================================
  // WALLET DETECTION (via IPC Bridge)
  // ============================================

  /**
   * Detect installed Cardano wallets via Electron IPC bridge
   * Returns list of available wallets with their info
   */
  getInstalledWallets(): WalletInfo[] {
    // Sync fallback - actual detection happens async via detectWallets
    // This maintains API compatibility while the async detection runs
    return [];
  }

  /**
   * Async wallet detection via Electron IPC
   */
  async detectWalletsAsync(): Promise<WalletInfo[]> {
    try {
      // Use Electron IPC bridge (CIP-30 WebView Bridge)
      if (window.electronAPI?.cardano?.detectWallets) {
        const result = await window.electronAPI.cardano.detectWallets() as any;
        if (result?.success && result?.data?.available && result?.data?.wallets) {
          return result.data.wallets.map((w: any) => ({
            walletName: w.key as SupportedWallet,
            displayName: w.name,
            icon: w.icon,
            connected: false
          }));
        }
      }
      
      // Fallback: try window.cardano directly (browser dev mode)
      // @ts-ignore
      const cardano = window.cardano;
      if (cardano) {
        const wallets: WalletInfo[] = [];
        const walletCheckers: { key: SupportedWallet; name: string }[] = [
          { key: 'lace', name: 'Lace' },
          { key: 'nami', name: 'Nami' },
          { key: 'typhon', name: 'Typhon' },
          { key: 'yoroi', name: 'Yoroi' },
          { key: 'eternl', name: 'Eternl' },
          { key: 'flint', name: 'Flint' },
          { key: 'gerowallet', name: 'GeroWallet' }
        ];
        for (const checker of walletCheckers) {
          if (cardano[checker.key]) {
            wallets.push({ walletName: checker.key, displayName: checker.name, connected: false });
          }
        }
        return wallets;
      }
      
      console.log('[CardanoWallet] No wallet extensions detected');
      return [];
    } catch (error) {
      console.error('[CardanoWallet] Error detecting wallets:', error);
      return [];
    }
  }

  /**
   * Check if Lace wallet is available
   */
  async isLaceAvailable(): Promise<boolean> {
    try {
      const wallets = await this.detectWalletsAsync();
      return wallets.some(w => w.walletName === 'lace');
    } catch {
      return false;
    }
  }

  /**
   * Check if any Cardano wallet is available
   */
  async isAnyWalletAvailable(): Promise<boolean> {
    const wallets = await this.detectWalletsAsync();
    return wallets.length > 0;
  }

  // ============================================
  // WALLET CONNECTION (via IPC Bridge)
  // ============================================

  /**
   * Connect to a Cardano wallet using CIP-30 via Electron IPC
   */
  async connectWallet(walletName?: SupportedWallet): Promise<{ success: boolean; error?: string; session?: WalletSession }> {
    try {
      let targetWallet = walletName || 'lace';
      
      console.log(`[CardanoWallet] Connecting to ${targetWallet} via IPC bridge...`);

      // Use Electron IPC bridge (CIP-30 WebView Bridge)
      if (window.electronAPI?.cardano?.connectWallet) {
        const result = await window.electronAPI.cardano.connectWallet(targetWallet) as any;
        
        if (result?.success) {
          // Build session from result data
          const data = result.data;
          if (data) {
            this.session = {
              connected: data.connected,
              walletName: data.walletName as SupportedWallet,
              address: data.address,
              utxos: [],
              assets: data.assets || [],
              verified: false,
              accessLevel: 'none',
              connectedAt: Date.now()
            };
            
            console.log(`[CardanoWallet] Connected via IPC: ${this.session.address?.substring(0, 20)}...`);
            
            // Fetch wallet data after connect
            await this.fetchWalletData();
            
            return { success: true, session: this.session };
          }
          
          return { success: true, session: this.session };
        } else {
          return { success: false, error: result?.error || 'Connection failed' };
        }
      }
      
      // Fallback: direct window.cardano access (browser dev mode)
      // @ts-ignore
      const cardano = window.cardano;
      if (!cardano) {
        return { success: false, error: 'No Cardano wallet extension detected' };
      }

      // @ts-ignore
      let walletAPI = cardano[targetWallet];
      if (!walletAPI) {
        const available = this.getInstalledWallets();
        if (available.length === 0) {
          return { success: false, error: 'No Cardano wallet extension detected' };
        }
        targetWallet = available[0].walletName;
        // @ts-ignore
        walletAPI = cardano[targetWallet];
      }

      if (!walletAPI) {
        return { success: false, error: 'Wallet API not available' };
      }

      console.log(`[CardanoWallet] Connecting to ${targetWallet}...`);
      const api = await walletAPI.enable();
      
      if (!api) {
        return { success: false, error: 'Wallet authorization denied' };
      }

      this.walletAPI = api;
      const addresses = await api.getUsedAddresses();
      const address = addresses && addresses.length > 0 ? addresses[0] : null;
      
      if (!address) {
        return { success: false, error: 'Could not get wallet address' };
      }

      // Update session
      this.session = {
        connected: true,
        walletName: targetWallet,
        address: address,
        utxos: [],
        assets: [],
        verified: false,
        accessLevel: 'none',
        connectedAt: Date.now()
      };

      console.log(`[CardanoWallet] Connected to ${targetWallet}`);
      console.log(`[CardanoWallet] Address: ${address.substring(0, 20)}...`);

      // Fetch wallet data
      await this.fetchWalletData();

      // Notify listeners
      this.notifySessionChange();

      return { success: true, session: this.session };

    } catch (error: any) {
      console.error('[CardanoWallet] Connection error:', error);
      return { success: false, error: error.message || 'Failed to connect wallet' };
    }
  }

  /**
   * Disconnect from wallet via IPC bridge
   */
  async disconnectWallet(): Promise<void> {
    // Use Electron IPC bridge
    if (window.electronAPI?.cardano?.disconnectWallet) {
      try {
        await window.electronAPI.cardano.disconnectWallet();
      } catch (error) {
        console.error('[CardanoWallet] Error disconnecting via IPC:', error);
      }
    }
    
    this.session = {
      connected: false,
      walletName: null,
      address: null,
      utxos: [],
      assets: [],
      verified: false,
      accessLevel: 'none',
      connectedAt: null
    };
    this.walletAPI = null;
    this.notifySessionChange();
    console.log('[CardanoWallet] Disconnected');
  }

  // ============================================
  // WALLET DATA FETCHING (eUTxO Model via IPC)
  // ============================================

  /**
   * Fetch all wallet data via Electron IPC bridge
   */
  async fetchWalletData(): Promise<{ success: boolean; error?: string }> {
    // Try IPC bridge for assets first (Electron)
    if (window.electronAPI?.cardano?.getWalletAssets) {
      try {
        const result = await window.electronAPI.cardano.getWalletAssets() as any;
        if (result?.success && result.data) {
          this.session.address = result.data.address || this.session.address;
          this.session.assets = result.data.assets || [];
          console.log('[CardanoWallet] Assets fetched via IPC:', this.session.assets.length);
          this.logAssetDetails();
        }
      } catch (error) {
        console.error('[CardanoWallet] Error fetching assets via IPC:', error);
      }
      // Also verify via direct wallet API if available (for UTXOs)
      if (this.walletAPI) {
        try {
          const utxos = await this.walletAPI.getUtxos();
          if (utxos && utxos.length > 0) {
            this.session.utxos = this.parseUTXOs(utxos);
            // Merge direct API assets if IPC returned none
            if (this.session.assets.length === 0) {
              this.session.assets = this.extractAssetsFromUTXOs(this.session.utxos);
            }
          }
        } catch (e) {
          console.warn('[CardanoWallet] Direct UTXO fetch failed:', e);
        }
      }
      await this.verifyNFTAccess();
      this.notifySessionChange();
      return { success: true };
    }

    // Fallback: direct window.cardano access (browser dev mode)
    if (!this.walletAPI) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      console.log('[CardanoWallet] Fetching wallet data...');

      // 1. Get wallet addresses
      const usedAddresses = await this.walletAPI.getUsedAddresses();
      const address = usedAddresses && usedAddresses.length > 0 ? usedAddresses[0] : null;
      this.session.address = address || this.session.address;
      
      // 2. Get UTXOs (Unspent Transaction Outputs)
      // This is the key to Cardano's eUTxO model - assets live inside UTXOs
      const utxos = await this.walletAPI.getUtxos();
      
      if (utxos && utxos.length > 0) {
        // Parse UTXOs into our format
        this.session.utxos = this.parseUTXOs(utxos);
        
        // 3. Extract ALL assets from UTXOs
        // In Cardano eUTxO model, tokens/NFTs exist inside UTXOs
        this.session.assets = this.extractAssetsFromUTXOs(this.session.utxos);
        
        console.log(`[CardanoWallet] Found ${this.session.utxos.length} UTXOs with ${this.session.assets.length} assets`);
        
        // Log asset details for debugging
        this.logAssetDetails();
      } else {
        this.session.utxos = [];
        this.session.assets = [];
        console.log('[CardanoWallet] No UTXOs found in wallet');
      }

      // 4. Verify NFT ownership based on access policies
      await this.verifyNFTAccess();

      this.notifySessionChange();

      return { success: true };

    } catch (error: any) {
      console.error('[CardanoWallet] Error fetching wallet data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse UTXOs from CIP-30 format to our format
   */
  private parseUTXOs(utxos: any[]): WalletUTXO[] {
    return utxos.map((utxo: any) => ({
      txHash: utxo.txHash || utxo.tx_hash,
      index: utxo.index || utxo.output_index,
      value: {
        coins: utxo.value?.coins || utxo.amount?.lovelace || 0,
        assets: this.parseAssets(utxo.value?.assets || utxo.amount?.tokens || [])
      }
    }));
  }

  /**
   * Parse assets from CIP-30 format
   */
  private parseAssets(tokens: any[]): WalletAsset[] {
    if (!tokens || !Array.isArray(tokens)) return [];
    
    return tokens.map((token: any) => ({
      policyId: token.policyId || token.policy_id || '',
      assetName: token.assetName || token.asset_name || '',
      fingerprint: token.fingerprint || '',
      quantity: token.quantity || token.amount || 1,
      metadata: token.metadata
    }));
  }

  /**
   * Extract all assets from UTXOs
   * This is critical: in Cardano eUTxO model, tokens live inside UTXOs
   */
  private extractAssetsFromUTXOs(utxos: WalletUTXO[]): WalletAsset[] {
    const assetMap = new Map<string, WalletAsset>();

    for (const utxo of utxos) {
      for (const asset of utxo.value.assets) {
        const key = `${asset.policyId}.${asset.assetName}`;
        
        if (assetMap.has(key)) {
          // Combine quantities for same asset
          const existing = assetMap.get(key)!;
          existing.quantity += asset.quantity;
        } else {
          assetMap.set(key, { ...asset });
        }
      }
    }

    return Array.from(assetMap.values());
  }

  /**
   * Log asset details for debugging
   */
  private logAssetDetails(): void {
    if (this.session.assets.length === 0) {
      console.log('[CardanoWallet] No assets found in wallet');
      return;
    }

    console.log('[CardanoWallet] Asset summary:');
    
    // Group by policy ID
    const byPolicy = new Map<string, number>();
    for (const asset of this.session.assets) {
      const count = byPolicy.get(asset.policyId) || 0;
      byPolicy.set(asset.policyId, count + 1);
    }

    for (const [policyId, count] of byPolicy) {
      console.log(`  Policy ${policyId.substring(0, 8)}...: ${count} assets`);
    }
  }

  // ============================================
  // NFT VERIFICATION (Access Control)
  // ============================================

  /**
   * Verify NFT ownership based on access policies
   * Checks if wallet contains NFTs matching required policy IDs
   */
  async verifyNFTAccess(): Promise<NFTVerificationResult> {
    const ownedNFTs: WalletAsset[] = [];
    const matchedPolicies: string[] = [];

    // Check each policy requirement
    for (const policy of this.accessPolicies) {
      // Find assets matching this policy ID
      const policyAssets = this.session.assets.filter(
        asset => asset.policyId === policy.policyId
      );

      if (policyAssets.length > 0) {
        matchedPolicies.push(policy.policyId);
        ownedNFTs.push(...policyAssets);
        console.log(`[CardanoWallet] ✓ Found ${policyAssets.length} assets from ${policy.collectionName}`);
      } else {
        console.log(`[CardanoWallet] ✗ No assets found for policy ${policy.collectionName}`);
      }
    }

    // Determine access level
    let accessLevel: 'none' | 'standard' | 'premium' | 'dao' = 'none';
    let verified = false;
    let message = '';

    if (matchedPolicies.length > 0) {
      verified = true;
      
      // Determine tier based on collection
      const hasPremiumCollection = matchedPolicies.some(p => 
        p === this.accessPolicies.find(a => a.collectionName === 'HPEC DAO PASS')?.policyId
      );
      
      if (hasPremiumCollection) {
        accessLevel = 'dao';
        message = 'HPEC DAO PASS verified! Full access granted.';
      } else {
        accessLevel = 'premium';
        message = 'NFT ownership verified. Premium access granted.';
      }
      
      console.log(`[CardanoWallet] ✓ Access granted: ${accessLevel}`);
    } else {
      accessLevel = 'none';
      verified = false;
      message = 'Access restricted to NFT holders. No qualifying NFTs found in wallet.';
      console.log('[CardanoWallet] ✗ Access denied: No qualifying NFTs');
    }

    // Update session
    this.session.verified = verified;
    this.session.accessLevel = accessLevel;

    return {
      verified,
      ownedNFTs,
      matchedPolicies,
      accessLevel,
      message
    };
  }

  /**
   * Get current access level
   */
  getAccessLevel(): 'none' | 'standard' | 'premium' | 'dao' {
    return this.session.accessLevel;
  }

  /**
   * Check if user has gated feature access
   */
  hasGatedAccess(): boolean {
    return this.session.verified && 
           (this.session.accessLevel === 'premium' || this.session.accessLevel === 'dao');
  }

  /**
   * Check if user has DAO-level access
   */
  hasDAOAccess(): boolean {
    return this.session.verified && this.session.accessLevel === 'dao';
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  /**
   * Configure access policies (for future multi-collection support)
   */
  setAccessPolicies(policies: NFTAccessPolicy[]): void {
    this.accessPolicies = policies;
    console.log('[CardanoWallet] Access policies updated:', policies.map(p => p.collectionName).join(', '));
  }

  /**
   * Add a new access policy
   */
  addAccessPolicy(policy: NFTAccessPolicy): void {
    // Check if already exists
    const exists = this.accessPolicies.find(p => p.policyId === policy.policyId);
    if (!exists) {
      this.accessPolicies.push(policy);
      console.log(`[CardanoWallet] Added access policy: ${policy.collectionName}`);
    }
  }

  /**
   * Get configured access policies
   */
  getAccessPolicies(): NFTAccessPolicy[] {
    return [...this.accessPolicies];
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  /**
   * Get current session
   */
  getSession(): WalletSession {
    return { ...this.session };
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.session.connected;
  }

  /**
   * Subscribe to session changes
   */
  onSessionUpdate(callback: (session: WalletSession) => void): void {
    this.onSessionChange = callback;
  }

  /**
   * Notify session change listeners
   */
  private notifySessionChange(): void {
    if (this.onSessionChange) {
      this.onSessionChange(this.getSession());
    }
  }

  /**
   * Initialize wallet API if available
   */
  private initializeWalletAPI(): void {
    // @ts-ignore
    if (window.cardano) {
      console.log('[CardanoWallet] Wallet API initialized');
    }
  }

  // ============================================
  // FUTURE: MULTI-NFT SUPPORT
  // ============================================

  /**
   * Check ownership of multiple NFT collections
   * Ready for future multi-collection support
   */
  async checkMultipleCollections(policyIds: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const policyId of policyIds) {
      const hasAssets = this.session.assets.some(
        asset => asset.policyId === policyId
      );
      results[policyId] = hasAssets;
    }

    return results;
  }

  /**
   * Get DAO membership tier based on NFT holdings
   * Ready for future tiered access
   */
  async getDAOTier(): Promise<{ tier: string; score: number }> {
    const policy = this.accessPolicies.find(p => p.collectionName === 'HPEC DAO PASS');
    if (!policy) {
      return { tier: 'none', score: 0 };
    }

    const daoAssets = this.session.assets.filter(
      a => a.policyId === policy.policyId
    );

    // Tier calculation based on quantity
    if (daoAssets.length >= 3) {
      return { tier: 'gold', score: 3 };
    } else if (daoAssets.length >= 2) {
      return { tier: 'silver', score: 2 };
    } else if (daoAssets.length >= 1) {
      return { tier: 'bronze', score: 1 };
    }

    return { tier: 'none', score: 0 };
  }
}

// ============================================
// EXPORT SINGLETON INSTANCE
// ============================================

export const cardanoWallet = new CardanoWalletService();

// Export class for testing
export { CardanoWalletService };