// Wallet Service - Complete wallet integration with MetaMask and WalletConnect
import { ethers } from "ethers";
import { ChainId, SUPPORTED_CHAINS, HYPERCYCLE_CONTRACTS, HYPERCYCLE_LICENSE_ABI, ANFE_ABI, ERC721_ABI } from "../types/wallet";

export type WalletType = "metamask" | "walletconnect" | "imported";
export type WalletEventType = "accountsChanged" | "chainChanged" | "disconnect";

export interface WalletState {
  address: string | null;
  chainId: ChainId | null;
  balance: string;
  isConnected: boolean;
}

export interface WalletState {
  address: string | null;
  chainId: ChainId | null;
  balance: string;
  isConnected: boolean;
}

// WalletConnect Project ID - replace with real one from https://cloud.walletconnect.com
const WALLETCONNECT_PROJECT_ID = "e5a6b9e6b9b9b9b9b9b9b9b9b9b9b9b9";

class WalletService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private provider: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private walletConnectProvider: any = null;
  private listeners: Map<WalletEventType, Set<(data: unknown) => void>> = new Map();
  private walletType: WalletType | null = null;

  // Check if MetaMask is installed (works in Electron too)
  isMetaMaskInstalled(): boolean {
    if (typeof window === "undefined") return false;
    
    // Check for ethereum provider
    if (window.ethereum) {
      return true;
    }
    
    return false;
  }

  // Get current wallet type
  getWalletType(): WalletType | null {
    return this.walletType;
  }

  // Get stored wallet
  getStoredWallet(): { address: string; encryptedMnemonic?: string } | null {
    const stored = localStorage.getItem("mosaic_wallet");
    return stored ? JSON.parse(stored) : null;
  }

  // Store wallet info
  storeWallet(address: string, encryptedMnemonic?: string): void {
    localStorage.setItem("mosaic_wallet", JSON.stringify({ address, encryptedMnemonic }));
  }

  // Clear stored wallet
  clearStoredWallet(): void {
    localStorage.removeItem("mosaic_wallet");
  }

  // Create new wallet from mnemonic
  async createWalletFromMnemonic(mnemonic: string): Promise<{ address: string }> {
    const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic);
    return { address: wallet.address };
  }

  // Generate random mnemonic
  generateMnemonic(): string {
    const wallet = ethers.Wallet.createRandom();
    return wallet.mnemonic?.phrase || "";
  }

  // Connect with MetaMask
  async connectMetaMask(): Promise<WalletState> {
    console.log("[WalletService] Checking for MetaMask...");
    
    if (!window.ethereum) {
      console.error("[WalletService] No window.ethereum found");
      throw new Error("MetaMask is not installed. Please install MetaMask extension.");
    }

    try {
      console.log("[WalletService] Creating BrowserProvider...");
      this.provider = new ethers.BrowserProvider(window.ethereum, "any");
      
      console.log("[WalletService] Requesting accounts...");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please unlock MetaMask.");
      }
      
      const address = accounts[0];
      console.log("[WalletService] Connected account:", address);
      
      // Get network
      const network = await this.provider.getNetwork();
      const chainId = Number(network.chainId) as ChainId;
      console.log("[WalletService] Chain ID:", chainId);
      
      // Get balance
      const balance = await this.getBalance(address);
      
      this.walletType = "metamask";
      this.setupMetaMaskListeners();
      
      console.log("[WalletService] MetaMask connected successfully!");
      
      return {
        address,
        chainId,
        balance,
        isConnected: true,
      };
    } catch (error) {
      console.error("[WalletService] MetaMask connection error:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to connect MetaMask");
    }
  }

  // Connect with WalletConnect
  async connectWalletConnect(): Promise<WalletState> {
    try {
      // Dynamic import for WalletConnect
      const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
      
      // Initialize WalletConnect provider
      const wcProvider = await EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [1, 8453],
        showQrModal: true,
        methods: ["eth_sendTransaction", "eth_signTransaction", "eth_sign", "personal_sign", "eth_signTypedData"],
        metadata: {
          name: "Mosaic Companion",
          description: "Hypercycle Node Management",
          url: "https://mosaic-companion.app",
          icons: ["https://mosaic-companion.app/icon.png"],
        },
      });
      
      this.walletConnectProvider = wcProvider;

      // Enable connection (shows QR modal)
      const accounts = await wcProvider.enable();
      const address = accounts[0];
      
      // Create ethers provider from WalletConnect
      this.provider = new ethers.BrowserProvider(wcProvider as ethers.Eip1193Provider, "any");
      
      const network = await this.provider.getNetwork();
      const chainId = Number(network.chainId) as ChainId;
      
      const balance = await this.getBalance(address);
      
      this.walletType = "walletconnect";
      this.setupWalletConnectListeners();
      
      return {
        address,
        chainId,
        balance,
        isConnected: true,
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to connect WalletConnect");
    }
  }

  // Import wallet from mnemonic/seed phrase
  async importWallet(mnemonic: string): Promise<WalletState> {
    try {
      // Validate mnemonic
      if (!ethers.Mnemonic.isValidMnemonic(mnemonic)) {
        throw new Error("Invalid seed phrase. Please check and try again.");
      }
      
      // Create wallet from mnemonic
      const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic);
      const address = wallet.address;
      
      // Store wallet info (in production, encrypt the mnemonic!)
      this.storeWallet(address, btoa(mnemonic));
      this.walletType = "imported";
      
      // For imported wallets, we don't have a provider for transactions
      // Balance will be fetched via RPC when needed
      const defaultChainId: ChainId = 1;
      this.provider = new ethers.JsonRpcProvider(SUPPORTED_CHAINS[defaultChainId].rpcUrl);
      
      const balance = await this.getBalance(address);
      
      return {
        address,
        chainId: defaultChainId,
        balance,
        isConnected: true,
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to import wallet");
    }
  }

  // Get balance
  async getBalance(address: string): Promise<string> {
    if (!this.provider) return "0";
    
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch {
      return "0";
    }
  }

  // Get connected address
  async getConnectedAddress(): Promise<string | null> {
    const stored = this.getStoredWallet();
    if (stored?.address) return stored.address;
    
    if (this.provider) {
      try {
        const accounts = await this.provider.listAccounts();
        return accounts[0]?.address || null;
      } catch {
        return null;
      }
    }
    
    return null;
  }

  // Get chain ID
  async getChainId(): Promise<ChainId | null> {
    if (!this.provider) return null;
    
    try {
      const network = await this.provider.getNetwork();
      return Number(network.chainId) as ChainId;
    } catch {
      return null;
    }
  }

  // Switch chain
  async switchChain(chainId: ChainId): Promise<boolean> {
    const provider = window.ethereum || this.walletConnectProvider;
    
    // For imported wallets, just update the local chain ID and provider
    if (!provider) {
      if (this.walletType === "imported") {
        console.log(`[WalletService] Imported wallet - switching to chain ${chainId} via RPC`);
        this.provider = new ethers.JsonRpcProvider(SUPPORTED_CHAINS[chainId].rpcUrl);
        this.emitChainChanged(chainId);
        return true;
      }
      throw new Error("No wallet connected");
    }
    
    const chainIdHex = `0x${chainId.toString(16)}`;
    
    try {
      console.log(`[WalletService] Switching to chain ${chainId} (${chainIdHex})...`);
      
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
      
      console.log(`[WalletService] Switch successful`);
      
      // Update local chain ID immediately for better UX
      this.emitChainChanged(chainId);
      
      return true;
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      console.error(`[WalletService] Switch error:`, err);
      
      // Chain not added - add it
      if (err.code === 4902) {
        console.log(`[WalletService] Chain ${chainId} not added, adding now...`);
        const added = await this.addChain(chainId);
        if (added) {
          // Try switching again after adding
          return this.switchChain(chainId);
        }
        throw new Error(`Failed to add ${SUPPORTED_CHAINS[chainId]?.name || chainId} network`);
      }
      
      throw new Error(err.message || `Failed to switch to ${SUPPORTED_CHAINS[chainId]?.name || chainId}`);
    }
  }

  // Add chain to wallet
  private async addChain(chainId: ChainId): Promise<boolean> {
    const chain = SUPPORTED_CHAINS[chainId];
    if (!chain) return false;
    
    const chainParams = {
      chainId: `0x${chainId.toString(16)}`,
      chainName: chain.name,
      nativeCurrency: chain.nativeCurrency,
      rpcUrls: [chain.rpcUrl],
      blockExplorerUrls: [chain.blockExplorer],
    };
    
    try {
      const provider = window.ethereum || this.walletConnectProvider;
      if (provider) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [chainParams],
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  // Get owned License NFTs or ANFEs based on chain
  async getOwnedLicenses(address: string, chainId?: ChainId): Promise<{ tokenId: string; status: number; height: number }[]> {
    if (!this.provider) return [];
    
    // Use provided chainId or get current
    const targetChainId = chainId || await this.getChainId() || 1;
    const contract = HYPERCYCLE_CONTRACTS.find(c => c.chainId === targetChainId);
    
    if (!contract) {
      console.log(`[WalletService] No contract for chain ${targetChainId}`);
      return [];
    }
    
    console.log(`[WalletService] Reading from ${contract.name} on ${SUPPORTED_CHAINS[targetChainId]?.name}`);
    
    try {
      const contractInstance = new ethers.Contract(contract.address, HYPERCYCLE_LICENSE_ABI, this.provider);
      
      // Get balance
      const balance = await contractInstance.balanceOf(address);
      const count = Number(balance);
      
      console.log(`[WalletService] Found ${count} NFTs for ${address} on chain ${targetChainId}`);
      
      const items: { tokenId: string; status: number; height: number }[] = [];
      
      for (let i = 0; i < count; i++) {
        try {
          // Get token ID at index
          const tokenId = await contractInstance.tokenOfOwnerByIndex(address, i);
          const tokenIdStr = tokenId.toString();
          
          // Get token data (status, height)
          let status = 0;
          let height = 0;
          try {
            const tokenData = await contractInstance.tokenData(tokenId);
            status = tokenData[0];
            height = tokenData[1];
          } catch {
            // tokenData might not be available, use defaults
          }
          
          items.push({
            tokenId: tokenIdStr,
            status,
            height,
          });
          
          console.log(`[WalletService] ${contract.type === 'anfe' ? 'ANFE' : 'License'} ${i}: ID=${tokenIdStr}, status=${status}, height=${height}`);
        } catch (err) {
          console.error(`[WalletService] Error getting token ${i}:`, err);
        }
      }
      
      return items;
    } catch (error) {
      console.error("[WalletService] Failed to get owned NFTs:", error);
      return [];
    }
  }

  // Get ANFE data from Base (AdvancedNodeFactoryEnclosureV2 - ERC-721)
  // ANFEs are ERC-721 tokens created by the factory contract
  async getANFEData(address: string): Promise<{ anfeId: string; licenseId: string; level: number; tranche: string; chypcId: string; status: string }[]> {
    console.log("[WalletService] ========== getANFEData START ==========");
    console.log("[WalletService] Address:", address);
    console.log("[WalletService] ANFE contract is ERC-721 (AdvancedNodeFactoryEnclosureV2)");
    
    if (!this.provider) {
      console.error("[WalletService] No provider set!");
      return [];
    }
    
    // Verify we're on Base chain
    try {
      const network = await this.provider.getNetwork();
      const currentChainId = Number(network.chainId);
      console.log("[WalletService] Current chain from provider:", currentChainId);
      
      if (currentChainId !== 8453) {
        console.error(`[WalletService] Wrong chain! Expected 8453 (Base), got ${currentChainId}`);
        return [];
      }
    } catch (err) {
      console.error("[WalletService] Failed to get network:", err);
    }
    
    const contract = HYPERCYCLE_CONTRACTS.find(c => c.type === 'anfe');
    if (!contract) {
      console.error("[WalletService] No ANFE contract found in config");
      return [];
    }
    
    console.log("[WalletService] ANFE contract:", contract.address);
    
    // Known ANFE IDs from HMS
    const knownANFEs = [
      { id: "2324779898006116", level: 11, tranche: "T3", chypcId: "17735637771" },
      { id: "2324779898048044", level: 11, tranche: "T3", chypcId: "17735642069" },
    ];
    
    // First, try to check ownership of known ANFE IDs using ownerOf
    console.log("[WalletService] Checking known ANFE IDs via ownerOf...");
    
    const ownerABI = ["function ownerOf(uint256 tokenId) view returns (address)"];
    const ownerContract = new ethers.Contract(contract.address, ownerABI, this.provider);
    
    const anfes: { anfeId: string; licenseId: string; level: number; tranche: string; chypcId: string; status: string }[] = [];
    
    for (const anfe of knownANFEs) {
      try {
        console.log(`[WalletService] Checking ownerOf(${anfe.id})...`);
        const owner = await ownerContract.ownerOf(BigInt(anfe.id));
        const ownerLower = owner.toLowerCase();
        const addressLower = address.toLowerCase();
        
        console.log(`[WalletService] ANFE ${anfe.id} owner: ${owner}`);
        
        if (ownerLower === addressLower) {
          console.log(`[WalletService] ✓ ANFE ${anfe.id} owned by user!`);
          anfes.push({
            anfeId: anfe.id,
            licenseId: anfe.id,
            level: anfe.level,
            tranche: anfe.tranche,
            chypcId: anfe.chypcId,
            status: "ALIVE",
          });
        } else {
          console.log(`[WalletService] ANFE ${anfe.id} owned by ${owner}, not user`);
        }
      } catch (err) {
        console.error(`[WalletService] Error checking ANFE ${anfe.id}:`, err);
      }
    }
    
    console.log(`[WalletService] ========== getANFEData END: ${anfes.length} ANFEs ==========`);
    
    if (anfes.length > 0) {
      return anfes;
    }
    
    // Fallback: Try ERC721Enumerable if known IDs didn't work
    console.log("[WalletService] Known IDs didn't work, trying ERC721Enumerable...");
    
    const erc721ABI = [
      "function balanceOf(address owner) view returns (uint256)",
      "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    ];
    
    try {
      const contractInstance = new ethers.Contract(contract.address, erc721ABI, this.provider);
      const balance = await contractInstance.balanceOf(address);
      const count = Number(balance);
      
      console.log(`[WalletService] Balance: ${count} ANFEs`);
      
      for (let i = 0; i < Math.min(count, 10); i++) {
        try {
          const tokenId = await contractInstance.tokenOfOwnerByIndex(address, i);
          const tokenIdStr = tokenId.toString();
          console.log(`[WalletService] ANFE ${i}: ID = ${tokenIdStr}`);
          
          anfes.push({
            anfeId: tokenIdStr,
            licenseId: tokenIdStr,
            level: 11,
            tranche: "T3",
            chypcId: "",
            status: "ALIVE",
          });
        } catch (err) {
          console.error(`[WalletService] tokenOfOwnerByIndex(${i}) failed:`, err);
          break;
        }
      }
      
      console.log(`[WalletService] ========== getANFEData END (enumerable): ${anfes.length} ANFEs ==========`);
    } catch (err) {
      console.error("[WalletService] ERC721Enumerable failed:", err);
    }
    
    return anfes;
  }

  // Get owned NFTs (generic ERC-721)
  async getOwnedNFTs(address: string, contractAddress: string): Promise<string[]> {
    if (!this.provider) return [];
    
    try {
      const contract = new ethers.Contract(contractAddress, ERC721_ABI, this.provider);
      const balance = await contract.balanceOf(address);
      const count = Number(balance);
      
      const tokenIds: string[] = [];
      for (let i = 0; i < count; i++) {
        try {
          const tokenId = await contract.tokenOfOwnerByIndex(address, i);
          tokenIds.push(tokenId.toString());
        } catch {
          break;
        }
      }
      
      return tokenIds;
    } catch (error) {
      console.error("[WalletService] Failed to get owned NFTs:", error);
      return [];
    }
  }

  // Setup MetaMask event listeners
  private setupMetaMaskListeners(): void {
    if (!window.ethereum) return;
    
    window.ethereum.on("accountsChanged", (accounts: string[]) => {
      console.log("[WalletService] accountsChanged:", accounts);
      this.emit("accountsChanged", accounts);
    });
    
    window.ethereum.on("chainChanged", (chainId: string) => {
      console.log("[WalletService] chainChanged:", chainId);
      this.emit("chainChanged", chainId);
    });
    
    window.ethereum.on("disconnect", () => {
      console.log("[WalletService] disconnect");
      this.emit("disconnect", null);
    });
  }

  // Setup WalletConnect event listeners
  private setupWalletConnectListeners(): void {
    if (!this.walletConnectProvider) return;
    
    this.walletConnectProvider.on("accountsChanged", (accounts: string[]) => {
      this.emit("accountsChanged", accounts);
    });
    
    this.walletConnectProvider.on("chainChanged", (chainId: string) => {
      this.emit("chainChanged", chainId);
    });
    
    this.walletConnectProvider.on("disconnect", () => {
      this.emit("disconnect", null);
      this.walletConnectProvider = null;
      this.provider = null;
    });
  }

  // Event emitter
  on(event: WalletEventType, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: WalletEventType, data: unknown): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  // Emit chain changed event for UI update
  private emitChainChanged(chainId: ChainId): void {
    this.emit("chainChanged", `0x${chainId.toString(16)}`);
  }

  // Disconnect wallet
  async disconnect(): Promise<void> {
    if (this.walletConnectProvider) {
      await this.walletConnectProvider.disconnect();
      this.walletConnectProvider = null;
    }
    
    this.provider = null;
    this.walletType = null;
    this.clearStoredWallet();
  }
}

export const walletService = new WalletService();
export default walletService;