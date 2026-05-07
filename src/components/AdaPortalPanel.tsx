// @ts-nocheck
// ============================================
// STARGATE - Main UI Panel
// AI Workforce + Compute + Intelligence Platform for Cardano
// ============================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import QRCode from 'qrcode';

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      isConnected?: () => Promise<boolean>;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on?: (event: string, handler: (...args: any[]) => void) => void;
      removeListener?: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

import { 
  initializeAdaPortal,
  agentMarketplace,
  leaderboard,
  trainingMarketplace,
  agentPackages,
  nodeIntelligence,
  mcpIntegration,
  hyperInsight,
  AgentMarketplaceService,
  accessControl,
  AccessCheck,
  stargatePoolService,
  NodeFactory,
  ANFEInfo
} from '../services/AdaPortal';

// Stargate Pool - ANFE Integration
import { 
  anfeService, 
  hboxPoolService,
  walletAdapter,
  merkelizerService,
  ANFE,
  formatANFEForDisplay,
  WalletState,
  WalletANFEs,
  SupportedChain,
  NodeInfo,
} from '../services/StargatePool';
import { MarketplaceListing, LeaderboardEntry, TrainingListing, AgentPackage, ComputeNode, AIMInfo, UserIntent, ComputeTierInfo, AccessLevel } from '../services/AdaPortal/types';
import { skillMarketplace } from '../services/AdaPortal';
import { aspGateway, AspPackage, Company, UsageRecord } from '../services/AspGateway';
import { KanbanDashboard } from './KanbanDashboard';
import { Users, Trophy, GraduationCap, Package, Cpu, Zap, Star, ArrowRight, Search, Filter, RefreshCw, TrendingUp, CheckCircle, XCircle, Loader, Rocket, TrendingUpIcon, Code, Bot, Workflow, Sparkles, Settings, CpuIcon, LayoutDashboard, Wallet, Key, Building2, FolderOutput, Network, Shield, Lock,  Unlock, Layers, Server, Plus } from 'lucide-react';

interface AdaPortalPanelProps {
  url?: string;
  onNavigate?: (url: string) => void;
  onClose?: () => void;
  onHireAgent?: (agentId: string, agentName: string) => void;
  onBookTraining?: (trainerId: string, trainerName: string) => void;
  onGetPackage?: (packageId: string, packageName: string) => void;
  onSelectCompute?: (tier: string) => void;
  onNavigateToChat?: (message: string) => void;
}

type TabId = 'start' | 'marketplace' | 'aims' | 'leaderboard' | 'training' | 'packages' | 'skills' | 'compute' | 'dashboard' | 'stargate' | 'nodes' | 'asp';
type LeaderboardPeriod = 'daily' | 'weekly' | 'all_time';
type ComputeTier = 'standard' | 'high_performance' | 'dedicated';

// Intent options for Start tab
const INTENT_OPTIONS: {
  id: UserIntent;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}[] = [
  {
    id: 'launch_project',
    label: 'Launch Project',
    description: 'Start a new project with AI workforce - agents, compute, and intelligence',
    icon: <Rocket size={24} />,
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
  },
  {
    id: 'grow_dao',
    label: 'Grow DAO',
    description: 'Expand your DAO - community, governance, and token growth',
    icon: <TrendingUpIcon size={24} />,
    color: 'text-green-400',
    bg: 'bg-green-400/10',
  },
  {
    id: 'build_dapp',
    label: 'Build dApp',
    description: 'Deploy smart contracts and decentralized applications',
    icon: <Code size={24} />,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
  {
    id: 'automate_workflows',
    label: 'Automate Workflows',
    description: 'Set up autonomous agents to handle repetitive tasks',
    icon: <Workflow size={24} />,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  {
    id: 'custom',
    label: 'Custom Goal',
    description: 'Define your own objective and let AI configure the stack',
    icon: <Sparkles size={24} />,
    color: 'text-pink-400',
    bg: 'bg-pink-400/10',
  },
];

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'start', label: 'Start', icon: <Rocket size={18} /> },
  { id: 'marketplace', label: 'Hire Agents', icon: <Users size={18} /> },
  { id: 'aims', label: 'AI Models', icon: <Bot size={18} /> },
  { id: 'leaderboard', label: 'Rankings', icon: <Trophy size={18} /> },
  { id: 'training', label: 'Train Agents', icon: <GraduationCap size={18} /> },
  { id: 'packages', label: 'Bundles', icon: <Package size={18} /> },
  { id: 'skills', label: 'Skills', icon: <Zap size={18} /> },
  { id: 'compute', label: 'Compute', icon: <Cpu size={18} /> },
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'stargate', label: 'Stargate Pool', icon: <Zap size={18} /> },
  { id: 'nodes', label: 'Nodes', icon: <Network size={18} /> },
  { id: 'asp', label: 'Deploy System', icon: <Building2 size={18} /> }
];

const computeTiers: { id: ComputeTier; label: string; price: string; specs: string }[] = [
  { id: 'standard', label: 'Standard', price: '$0.50/hr', specs: '8 CPU, 32GB RAM' },
  { id: 'high_performance', label: 'High-Performance', price: '$1.50/hr', specs: '32 CPU, 128GB RAM, 1 GPU' },
  { id: 'dedicated', label: 'Dedicated', price: '$5.00/hr', specs: '64 CPU, 512GB RAM, 4 GPUs' }
];

export const AdaPortalPanel: React.FC<AdaPortalPanelProps> = ({ 
  url,
  onNavigate,
  onClose, 
  onHireAgent, 
  onBookTraining, 
  onGetPackage,
  onSelectCompute,
  onNavigateToChat 
}) => {
  // Determine initial tab from URL
  const getInitialTab = (): TabId => {
    if (!url) return 'start';
    if (url.includes('/start')) return 'start';
    if (url.includes('/skills')) return 'skills';
    if (url.includes('/train')) return 'training';
    if (url.includes('/compute')) return 'compute';
    if (url.includes('/bundles')) return 'packages';
    if (url.includes('/rankings')) return 'leaderboard';
    if (url.includes('/stargate')) return 'stargate';
    if (url.includes('/nodes')) return 'nodes';
    if (url.includes('/asp')) return 'asp';
    return 'start';
  };

  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>('all_time');
  const [leaderboardCategory, setLeaderboardCategory] = useState<string>('overall');
  const [trainingListings, setTrainingListings] = useState<TrainingListing[]>([]);
  const [packages, setPackages] = useState<AgentPackage[]>([]);
  const [nodes, setNodes] = useState<ComputeNode[]>([]);
  const [hboxNodes, setHboxNodes] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [aims, setAims] = useState<AIMInfo[]>([]);
  const [selectedIntent, setSelectedIntent] = useState<UserIntent | null>(null);
  const [executionPlan, setExecutionPlan] = useState<any>(null);
  const [autonomousMode, setAutonomousMode] = useState(false);
  const [selectedComputeTier, setSelectedComputeTier] = useState<ComputeTier | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info'; message: string} | null>(null);
  const [accessCheck, setAccessCheck] = useState<AccessCheck | null>(null);
  const [tokeoConnected, setTokeoConnected] = useState(false);
  const [tokeoAddress, setTokeoAddress] = useState<string | null>(null);
  const [nftPolicyIds, setNftPolicyIds] = useState<string[]>([]);
  const [isConnectingTokeo, setIsConnectingTokeo] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQrData] = useState<{uri: string; sessionId: string} | null>(null);
  const [factories, setFactories] = useState<{factory: NodeFactory; isEligible: boolean; reason?: string}[]>([]);
  const [ethAddress, setEthAddress] = useState<string | null>(null);
  const [isLoadingFactories, setIsLoadingFactories] = useState(false);
  const [anfeInfo, setAnfeInfo] = useState<ANFEInfo | null>(null);
  
  // ANFE State (Stargate Pool v2 - Multi-chain)
  const [walletANFEs, setWalletANFEs] = useState<ANFE[]>([]);
  const [isLoadingANFEs, setIsLoadingANFEs] = useState(false);
  const [selectedANFE, setSelectedANFE] = useState<ANFE | null>(null);
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [showManualANFE, setShowManualANFE] = useState(false);
  const [manualANFEId, setManualANFEId] = useState('');
  const [hyperCycleBalances, setHyperCycleBalances] = useState<{
    symbol: string; name: string; balance: string; chain: string
  }[]>([]);
  // HyperCycle NFT holdings — now per-token ANFEs with Merkelizer data
  const [hyperCycleNFTsDetailed, setHyperCycleNFTsDetailed] = useState<{
    symbol: string; name: string; chain: string; standard: string; nfts: ANFE[]
  }[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // ANFE <-> Agent Bindings (Skill -> Agent -> ANFE deployment model)
  const [anfeAgentBindings, setAnfeAgentBindings] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('stargate_anfe_bindings');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [deployingANFEs, setDeployingANFEs] = useState<Set<string>>(new Set());

  // User AI Agents from ai-agents.json
  const [userAgents, setUserAgents] = useState<any[]>([]);
  const [isLoadingUserAgents, setIsLoadingUserAgents] = useState(false);
  
  // Agent Selection Modal State (used for Hire, Train, Packages, Skills)
  const [showAgentSelectModal, setShowAgentSelectModal] = useState(false);
  const [agentSelectMode, setAgentSelectMode] = useState<'hire' | 'train' | 'package' | 'skill' | null>(null);
  const [selectedUserAgent, setSelectedUserAgent] = useState<any | null>(null);
  const [selectedAgentForDelegation, setSelectedAgentForDelegation] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    console.log('[AdaPortal] loadData: Fetching real data from HyperInsight + user agents...');
    try {
      // 1. Load agents (async — from real user config + HyperInsight AIMs)
      const marketplaceListings = await agentMarketplace.getListings();
      console.log('[AdaPortal] listings loaded:', marketplaceListings.length);
      setListings(marketplaceListings);

      // 2. Load HyperInsight data (AIMs + nodes)
      await hyperInsight.refreshData();
      const hyperAims = hyperInsight.getActiveAIMs();
      console.log(`[AdaPortal] Loaded ${hyperAims.length} AIMs from HyperInsight`);
      setAims(hyperAims);

      const hyperNodes = hyperInsight.getNodes();
      const mappedNodes: ComputeNode[] = hyperNodes.map((n: any, idx: number) => ({
        nodeId: String(n.licenseKey || n.license || idx),
        address: n.name || `Node-${idx}`,
        uptime: n.measuredUptime7d || n.uptimePercent || 0,
        reliability: (n.compositeScore || 0) / 100,
        availableCompute: n.computeTflops || n.computeTFLOPS || 0,
        pricePerHour: 0.15,
        status: n.isAlive ? 'online' : 'offline',
        lastChecked: n.lastProbedAt || new Date().toISOString(),
        platform: 'hyperinsight'
      }));
      setNodes(mappedNodes);

      // 2b. Load local HyperAIBox appliances from sidebar
      try {
        await hboxPoolService.init();
        const hboxes = hboxPoolService.getNodes();
        const mappedHBoxes = hboxes.map((h: any) => ({
          nodeId: h.id,
          address: h.name,
          uptime: h.isLive ? 1 : 0,
          reliability: h.isLive ? 1 : 0,
          availableCompute: 10, // Default compute units for HBox
          pricePerHour: 0.0,
          status: h.status === 'active' ? 'online' : h.status === 'error' ? 'offline' : 'busy',
          lastChecked: new Date().toISOString(),
          platform: 'hyperaibox',
          apiHost: h.apiHost,
          apiPort: h.apiPort,
          licenseKey: h.licenseKey,
          isDelegated: h.isDelegated,
          hasHermes: h.hasHermes,
        }));
        setHboxNodes(mappedHBoxes);
        console.log('[AdaPortal] Loaded', mappedHBoxes.length, 'HyperAIBox appliances');
      } catch (e) {
        console.warn('[AdaPortal] HBox load failed:', e);
        setHboxNodes([]);
      }

      // 3. Leaderboard from HyperInsight
      const unifiedLb = hyperInsight.getUnifiedLeaderboard();
      setLeaderboardData(unifiedLb.map((e, i) => ({
        rank: i + 1,
        agentId: e.id,
        agentName: e.name,
        score: e.score,
        tasksCompleted: e.activeNodes || 0,
        earnings: e.computeTFLOPS || 0,
        avatar: e.type === 'aims' ? '🤖' : '🖥️',
        trend: 'stable' as const
      })));

      // 4. Training/Packages/Skills — still mock, mark them clearly
      setTrainingListings([]);  // TODO: Wire to real training service
      setPackages([]);          // TODO: Wire to real package service
      setSkills([]);            // TODO: Wire to real skills marketplace

      // 5. ANFE / Stargate Pool — load from wallet
      // NOTE: Must call via anfeService; line wrapped in anon IIFE for useCallback scope
      (async () => {
        let addr = null;
        if ((window as any).electronAPI?.web3?.getAddress) {
          try {
            const result = await (window as any).electronAPI.web3.getAddress();
            if (result?.success && result?.data?.address) {
              addr = result.data.address;
            }
          } catch (e) {}
        }
        if (addr) {
          try {
            setIsLoadingANFEs(true);
            const walletANFEs = await anfeService.loadWalletANFEs(addr);
            setWalletANFEs(walletANFEs.anfes || []);
            console.log('[AdaPortal] loadData loaded', walletANFEs.totalCount, 'ANFEs');
          } catch (e) {
            console.warn('[AdaPortal] loadData ANFE load failed:', e);
          } finally {
            setIsLoadingANFEs(false);
          }
        }
      })();

    } catch (e: any) {
      console.error('[AdaPortal] loadData failed:', e);
      setNotification({ type: 'error', message: e.message || 'Failed to load data' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Derive AIM-like models from available skills
  const deriveAimsFromSkills = (skillList: any[]): AIMInfo[] => {
    if (!skillList || skillList.length === 0) {
      return [
        { name: 'Default AIM', version: '1.0.0', description: 'General purpose AI model', isActive: true, origin: 'fallback', rank: 100 }
      ];
    }
    
    // Group skills by category and create AIM representations
    const categories = ['Frontend', 'Backend', 'Marketing', 'AI/ML', 'DevOps', 'Mobile'];
    const aimsFromSkills: AIMInfo[] = categories.map(cat => {
      const catSkills = skillList.filter(s => s.category === cat);
      if (catSkills.length === 0) return null;
      
      const topSkill = catSkills.sort((a, b) => b.installs - a.installs)[0];
      return {
        name: `${cat} AIM`,
        version: '1.0.0',
        description: `Powering ${catSkills.length} skills including ${topSkill.name}`,
        rank: catSkills.length,
        isActive: true,
        origin: 'skills.sh',
        backingAim: topSkill.name,
        computeStrength: Math.min(5, Math.ceil(catSkills.length / 2))
      } as AIMInfo;
    }).filter((a): a is AIMInfo => a !== null);
    
    return aimsFromSkills;
  };

  // Timeout wrapper for async operations to prevent hanging
  const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
    ]);
  };

  useEffect(() => {
    // Wrap entire initialization in try-catch to prevent component crash
    try {
      initializeAdaPortal();
      loadData();
      loadUserAgents();
    } catch (e) {
      console.error('[AdaPortal] Initial load failed:', e);
    }
    
    // Check access and update state - wrapped separately to not block UI
    try {
      accessControl.initialize().then(result => {
        setAccessCheck(result);
        console.log('[AdaPortal] Access granted:', result.level, result.type);
      }).catch(err => {
        console.error('[AdaPortal] Access check failed:', err);
      });
    } catch (e) {
      console.error('[AdaPortal] Access control init failed:', e);
    }

    // Initialize Stargate Pool and check for Ethereum wallet
    // Wrap in try-catch with timeout protection to prevent hanging
    let isMounted = true;
    
    (async () => {
      try {
        // Use timeout wrapper to prevent hangs - 5 second timeout for initialization
        await withTimeout(stargatePoolService.initialize(), 5000, undefined);

        // Clear stale demo factories from localStorage (one-time migration)
        try {
          stargatePoolService.clearAll();
        } catch (e) {
          console.warn('[AdaPortal] Failed to clear stale factories:', e);
        }

        if (!isMounted) return;
        
        // Auto-load Node Factories from blockchain when wallet connects
        // Will query ERC-1155 contracts to find factories owned by wallet
        const existingFactories = await stargatePoolService.getFactories();
        if (existingFactories.length === 0) {
          console.log('[AdaPortal] No factories found, will query blockchain when wallet connects...');
        }
        
        if (!isMounted) return;
        
        let walletAddress: string | null = null;

        // Priority 1: window.ethereum (MetaMask / external wallet) — user's actual connected wallet
        if (!walletAddress && window.ethereum) {
          try {
            const accounts = await withTimeout(window.ethereum.request({ method: 'eth_accounts' }), 3000, []);
            if (accounts && accounts.length > 0) {
              walletAddress = accounts[0];
              console.log('[AdaPortal] Initialized with window.ethereum (MetaMask):', walletAddress.slice(0, 8) + '...');
            }
          } catch (e) {
            console.warn('[AdaPortal] window.ethereum check failed:', e);
          }
        }

        // Priority 2: walletAdapter (window.mosaic.wallet)
        if (!walletAddress && walletAdapter.isAvailable()) {
          try {
            const state = walletAdapter.getState();
            setWalletState(state);
            if (state.isConnected && state.address) {
              walletAddress = state.address;
              console.log('[AdaPortal] Initialized with walletAdapter:', walletAddress.slice(0, 8) + '...');
            }
          } catch (e) {
            console.warn('[AdaPortal] Wallet adapter check failed:', e);
          }
        }

        // Priority 3: Electron stored wallet (mosaic safeStorage) — fallback only
        if (!walletAddress && window.electronAPI?.web3?.getAddress) {
          try {
            const emptyResult = { success: false, data: { address: '' } };
            const result = await withTimeout<{success: boolean; data?: {address?: string}}>(window.electronAPI.web3.getAddress(), 3000, emptyResult);
            // Type guard: check for data property existence
            if (result?.success && result.data?.address) {
              walletAddress = result.data.address;
              console.log('[AdaPortal] Initialized with Electron API wallet (fallback):', walletAddress.slice(0, 8) + '...');
            }
          } catch (e) {
            console.warn('[AdaPortal] Electron API wallet check failed:', e);
          }
        }

        if (!isMounted) return;

        // CRITICAL: Sync wallet address to StargatePoolService
        // This ensures factories can check eligibility based on the connected wallet
        if (walletAddress) {
          // Manually set the wallet address in StargatePoolService for eligibility checks
          (stargatePoolService as any).walletAddress = walletAddress;
          console.log('[AdaPortal] Synced wallet to StargatePoolService:', walletAddress.slice(0, 8) + '...');
        }

        if (!isMounted) return;

        // Load ANFEs and factories if we have a wallet address
        if (walletAddress) {
          setEthAddress(walletAddress);
          setWalletState(walletAdapter.getState());
          
          // Load ANFEs via Graph + Merkelizer - with timeout
          setIsLoadingANFEs(true);
          try {
            console.log('[AdaPortal] Loading ANFEs for wallet:', walletAddress);
            
            // First try Graph with timeout
            // Provide a full WalletANFEs fallback with all required properties
            const emptyWalletANFEs: WalletANFEs = { 
              address: walletAddress || '', 
              anfes: [], 
              totalCount: 0, 
              fetchedAt: Date.now(), 
              byChain: { 1: [], 8453: [] } as Record<SupportedChain, ANFE[]>
            };
            const walletANFEs = await withTimeout<WalletANFEs>(anfeService.loadWalletANFEs(walletAddress), 8000, emptyWalletANFEs);
            console.log('[AdaPortal] Graph result:', walletANFEs.totalCount, 'ANFEs');
            
            // If Graph empty, try RPC fallback (already handled inside loadWalletANFEs)
            // loadWalletANFEs internally does: Graph → RPC → Demo fallback
            let allANFEs = walletANFEs.anfes || [];
            
            if (isMounted) {
              setWalletANFEs(allANFEs);
              console.log('[AdaPortal] Final ANFEs:', allANFEs.length, allANFEs);

              // Show notification with result
              if (allANFEs.length > 0) {
                showNotification('success', `Loaded ${allANFEs.length} ANFE(s)`);
              }
            }

            // ---- Load HyperCycle ERC-20 token balances (HyPC, etc.) ----
            if (isMounted) {
              setIsLoadingBalances(true);
              try {
                const balances = await anfeService.getHyperCycleBalances(walletAddress);
                if (isMounted) {
                  setHyperCycleBalances(balances);
                  console.log('[AdaPortal] HyperCycle balances:', balances.length);
                  if (balances.length > 0) {
                    showNotification('success', `Loaded ${balances.length} HyperCycle token balance(s)`);
                  }
                }

                // ---- Load HyperCycle NFT holdings (detailed per-token ANFEs with Merkelizer) ----
                const nftsDetailed = await anfeService.getHyperCycleNFTsDetailed(walletAddress);
                if (isMounted) {
                  setHyperCycleNFTsDetailed(nftsDetailed);
                  const totalItems = nftsDetailed.reduce((sum, g) => sum + g.nfts.length, 0);
                  console.log('[AdaPortal] HyperCycle NFTs detailed:', totalItems, 'across', nftsDetailed.length, 'groups');
                }
              } catch (e) {
                console.warn('[AdaPortal] HyperCycle balance load failed:', e);
              } finally {
                if (isMounted) setIsLoadingBalances(false);
              }
            }
          } catch (e) {
            console.error('[AdaPortal] ANFE load failed:', e);
            if (isMounted) {
              showNotification('error', 'Failed to load ANFEs');
            }
          }
          if (isMounted) {
            setIsLoadingANFEs(false);
          }
          
          // Also load factories (legacy v1) - with timeout
          try {
            const walletFactories = await withTimeout(stargatePoolService.getFactoriesByWallet(walletAddress), 5000, []);
            if (isMounted) {
              setFactories(walletFactories);
            }
          } catch (e) {
            console.warn('[AdaPortal] Factory load failed:', e);
          }
        }
        
        console.log('[AdaPortal] Stargate Pool initialized');
      } catch (e) {
        console.error('[AdaPortal] Stargate Pool init failed:', e);
      }
      
      // Cleanup on unmount
      return () => {
        isMounted = false;
      };
    })();
  }, []);

  useEffect(() => {
    loadData();
  }, [leaderboardPeriod, leaderboardCategory]);

  // Load user AI Agents from appData
  const loadUserAgents = useCallback(async () => {
    setIsLoadingUserAgents(true);
    console.log('[AdaPortal] Loading user agents...');
    
    try {
      // Method 1: Use the correct aiAgents API from preload
      if (window.electronAPI?.aiAgents?.get) {
        const result = await window.electronAPI.aiAgents.get();
        if (Array.isArray(result) && result.length > 0) {
          setUserAgents(result);
          console.log('[AdaPortal] Loaded', result.length, 'user agents from aiAgents.get()');
          setIsLoadingUserAgents(false);
          return;
        }
      }
      
      // Method 2: Try web3 config API
      if (window.electronAPI?.web3?.getConfig) {
        const configResult = await window.electronAPI.web3.getConfig();
        if (configResult?.success && configResult?.data?.aiAgents) {
          setUserAgents(configResult.data.aiAgents);
          console.log('[AdaPortal] Loaded', configResult.data.aiAgents.length, 'user agents from web3.getConfig');
          setIsLoadingUserAgents(false);
          return;
        }
      }
      
      // Debug: Log what's available
      console.log('[AdaPortal] electronAPI keys:', window.electronAPI ? Object.keys(window.electronAPI) : 'undefined');
      console.log('[AdaPortal] aiAgents API available:', !!window.electronAPI?.aiAgents);
      
      // Final fallback: Empty array
      console.log('[AdaPortal] Could not load user agents - using empty array');
      setUserAgents([]);
    } catch (e) {
      console.error('[AdaPortal] Failed to load user agents:', e);
      setUserAgents([]);
    }
    setIsLoadingUserAgents(false);
  }, []);

  // Listen for wallet changes (imported via clipboard) and auto-reload ANFEs
  useEffect(() => {
    if (!window.electronAPI?.web3?.onWalletImported) return;
    const unsub = window.electronAPI.web3.onWalletImported(() => {
      console.log('[AdaPortal] Wallet imported event received — reloading ANFEs...');
      (async () => {
        let addr = null;
        if ((window as any).electronAPI?.web3?.getAddress) {
          try {
            const result = await (window as any).electronAPI.web3.getAddress();
            if (result?.success && result?.data?.address) {
              addr = result.data.address;
            }
          } catch (e) {}
        }
        if (addr) {
          try {
            setIsLoadingANFEs(true);
            const w = await anfeService.loadWalletANFEs(addr);
            setWalletANFEs(w.anfes || []);
            console.log('[AdaPortal] Wallet-import reload loaded', w.totalCount, 'ANFEs');
          } catch (e) {
            console.warn('[AdaPortal] Wallet-import ANFE reload failed:', e);
          } finally {
            setIsLoadingANFEs(false);
          }
        }
      })();
    });
    return () => unsub();
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    skillMarketplace.refreshSkills();
    loadData();
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [loadData]);

  const handleHireAgent = useCallback((listing: MarketplaceListing) => {
    console.log('[AdaPortal] handleHireAgent called:', listing.agentName);
    if (onHireAgent) {
      onHireAgent(listing.agentId, listing.agentName);
    } else if (onNavigateToChat) {
      onNavigateToChat(`Hire agent ${listing.agentName} for my project`);
    }
    showNotification('success', `Hiring ${listing.agentName}...`);
  }, [onHireAgent, onNavigateToChat]);

  const handleBookTraining = useCallback((listing: TrainingListing) => {
    if (onBookTraining) {
      onBookTraining(listing.trainerId, listing.trainerName);
    } else if (onNavigateToChat) {
      onNavigateToChat(`Book training session with ${listing.trainerName}`);
    }
    showNotification('success', `Booking training with ${listing.trainerName}...`);
  }, [onBookTraining, onNavigateToChat]);

  const handleGetPackage = useCallback((pkg: AgentPackage) => {
    if (onGetPackage) {
      onGetPackage(pkg.packageId, pkg.name);
    } else if (onNavigateToChat) {
      onNavigateToChat(`Get the ${pkg.name} package`);
    }
    showNotification('success', `Acquiring ${pkg.name} package...`);
  }, [onGetPackage, onNavigateToChat]);

  const handleSelectCompute = useCallback((tier: ComputeTier) => {
    setSelectedComputeTier(tier);
    if (onSelectCompute) {
      onSelectCompute(tier);
    } else if (onNavigateToChat) {
      onNavigateToChat(`Allocate ${tier.replace('_', ' ')} compute resources`);
    }
    showNotification('success', `${tier.replace('_', ' ')} compute selected`);
  }, [onSelectCompute, onNavigateToChat]);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // ============== START TAB (Intent-based Entry) ==============
  const renderStart = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">What do you want to achieve?</h2>
        <p className="text-gray-400">Select your goal and let AI configure the perfect workforce</p>
      </div>

      {/* NFT Access - Tokeo Wallet */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-purple-900/30 to-cyan-900/30 border border-purple-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Key size={20} className="text-purple-400" />
            </div>
            <div>
              <h4 className="font-medium text-white">NFT Access</h4>
              <p className="text-xs text-gray-400">Connect wallet to verify NFT holdings for premium access</p>
            </div>
          </div>
          {tokeoConnected ? (
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-green-400" />
              <span className="text-sm text-green-400">Connected</span>
              <span className="text-xs text-gray-500 ml-2">{tokeoAddress?.slice(0, 8)}...</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setIsConnectingTokeo(true);
                  try {
                    const detectResult = await window.electronAPI?.cardano?.tokeoDetect();
                    const detect = detectResult as any;
                    if (detect?.success && detect?.data?.available) {
                      const result = await window.electronAPI?.cardano?.tokeoConnect();
                      const r = result as any;
                      if (r?.success && r?.data?.connected) {
                        setTokeoConnected(true);
                        setTokeoAddress(r.data.address);
                        showNotification('success', 'Tokeo wallet connected!');
                        if (nftPolicyIds.length > 0) {
                          const verifyResult = await window.electronAPI?.cardano?.tokeoVerifyCollection(nftPolicyIds, false);
                          const v = verifyResult as any;
                          if (v?.success && v?.data?.hasAccess) {
                            showNotification('success', 'NFT access verified! Premium features unlocked.');
                          }
                        }
                      } else {
                        showNotification('error', r?.error || 'Failed to connect');
                      }
                    } else {
                      showNotification('error', 'Tokeo not detected. Try QR option.');
                    }
                  } catch (e: any) {
                    showNotification('error', e.message || 'Connection failed');
                  } finally {
                    setIsConnectingTokeo(false);
                  }
                }}
                disabled={isConnectingTokeo}
                className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {isConnectingTokeo ? '...' : 'Extension'}
              </button>
              <button
                onClick={async () => {
                  setIsConnectingTokeo(true);
                  try {
                    const qrResult = await window.electronAPI?.cardano?.tokeoQRPairing();
                    const qr = qrResult as any;
                    if (qr?.success && qr?.data?.uri) {
                      setQrData({ uri: qr.data.uri, sessionId: qr.data.sessionId });
                      setShowQRModal(true);
                      showNotification('info', 'Scan QR with Tokeo mobile app');
                      const pollInterval = setInterval(async () => {
                        const checkResult = await window.electronAPI?.cardano?.tokeoCheckQR();
                        const c = checkResult as any;
                        if (c?.success && c?.data?.connected) {
                          clearInterval(pollInterval);
                          setTokeoConnected(true);
                          setTokeoAddress(c.data.address);
                          setShowQRModal(false);
                          showNotification('success', 'Tokeo mobile connected!');
                          if (nftPolicyIds.length > 0) {
                            const verifyResult = await window.electronAPI?.cardano?.tokeoVerifyCollection(nftPolicyIds, false);
                            const v = verifyResult as any;
                            if (v?.success && v?.data?.hasAccess) {
                              showNotification('success', 'NFT access verified!');
                            }
                          }
                        }
                      }, 3000);
                    } else {
                      showNotification('error', 'Failed to generate QR code');
                    }
                  } catch (e: any) {
                    showNotification('error', e.message || 'QR pairing failed');
                  } finally {
                    setIsConnectingTokeo(false);
                  }
                }}
                disabled={isConnectingTokeo}
                className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                QR
              </button>
            </div>
          )}
        </div>
        
        {/* NFT Policy ID Configuration */}
        {tokeoConnected && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-400">Allowed Policy IDs:</span>
              {nftPolicyIds.length === 0 ? (
                <span className="text-xs text-gray-600">None configured</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {nftPolicyIds.map((pid, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-xs">
                      {pid.slice(0, 8)}...
                    </span>
                  ))}
                </div>
              )}
            </div>
            <input
              type="text"
              placeholder="Enter Policy ID (hex) and press Enter to add"
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const input = e.currentTarget;
                  const policyId = input.value.trim();
                  if (policyId && /^([a-fA-F0-9]{56})$/.test(policyId)) {
                    if (!nftPolicyIds.includes(policyId.toLowerCase())) {
                      setNftPolicyIds([...nftPolicyIds, policyId.toLowerCase()]);
                      accessControl.setNFTConfig({ premiumPolicyIds: [...nftPolicyIds, policyId.toLowerCase()] });
                      input.value = '';
                      
                      // Verify access with new policy
                      const verifyResult = await window.electronAPI?.cardano?.tokeoVerifyCollection([policyId.toLowerCase()], false);
                      const v = verifyResult as any;
                      if (v?.success && v?.data?.hasAccess) {
                        showNotification('success', `NFT found! Policy ID ${policyId.slice(0, 8)}... grants access.`);
                      }
                    }
                  } else if (policyId) {
                    showNotification('error', 'Invalid Policy ID - must be 56 hex characters');
                  }
                }
              }}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Autonomous Mode Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-gray-900/50 border border-gray-800">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${autonomousMode ? 'bg-cyan-500/20' : 'bg-gray-800'}`}>
            <Bot size={20} className={autonomousMode ? 'text-cyan-400' : 'text-gray-500'} />
          </div>
          <div>
            <h4 className="font-medium text-white">Autonomous Mode</h4>
            <p className="text-xs text-gray-500">Agents hire agents and execute full workflow</p>
          </div>
        </div>
        <button
          onClick={() => setAutonomousMode(!autonomousMode)}
          className={`w-12 h-6 rounded-full transition-all ${autonomousMode ? 'bg-cyan-500' : 'bg-gray-700'}`}
        >
          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${autonomousMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Intent Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {INTENT_OPTIONS.map((intent) => (
          <button
            key={intent.id}
            onClick={() => {
              setSelectedIntent(intent.id);
              
              // Build execution plan for selected intent
              let plan: any = null;
              try {
                plan = hyperInsight.buildExecutionPlan({ intent: intent.id as any });
                setExecutionPlan(plan);
              } catch (e) {
                console.log('[AdaPortal] Could not build execution plan:', e);
                setExecutionPlan(null);
              }
              
              // Navigate to appropriate tab based on intent
              switch (intent.id) {
                case 'launch_project':
                case 'build_dapp':
                  setActiveTab('marketplace');
                  break;
                case 'grow_dao':
                  setActiveTab('leaderboard');
                  break;
                case 'automate_workflows':
                  setActiveTab('skills');
                  break;
                default:
                  break;
              }
              
              // Send intent to chat for workflow execution
              if (onNavigateToChat) {
                onNavigateToChat(`I want to ${intent.label.toLowerCase()}. Configure the AI workforce for me.`);
              }
            }}
            className={`p-4 rounded-xl border text-left transition-all ${
              selectedIntent === intent.id
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-lg ${intent.bg} flex items-center justify-center shrink-0`}>
                <span className={intent.color}>{intent.icon}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">{intent.label}</h3>
                <p className="text-sm text-gray-400 mt-1">{intent.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Execution Plan Preview */}
      {executionPlan && (
        <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
          <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Zap size={18} className="text-cyan-400" />
            Recommended AI Stack
          </h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500 text-xs mb-1">Agent</div>
              <div className="text-white font-medium">{executionPlan.agent?.name || 'Auto-select'}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">AIM</div>
              <div className="text-white font-medium truncate">{executionPlan.aim?.name?.split('/')[1] || 'Auto-select'}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">Compute</div>
              <div className="text-white font-medium">{executionPlan.compute?.label || 'Standard'}</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between text-sm">
            <span className="text-gray-500">Estimated cost:</span>
            <span className="text-cyan-400 font-medium">${executionPlan.cost?.toFixed(2) || '0.50'}/hr</span>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3 pt-4 border-t border-gray-800">
        <div className="text-center p-3 rounded-lg bg-gray-900/30">
          <div className="text-xl font-bold text-cyan-400">{listings.length}</div>
          <div className="text-xs text-gray-500">Agents</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-gray-900/30">
          <div className="text-xl font-bold text-purple-400">{aims.length}</div>
          <div className="text-xs text-gray-500">AIMs</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-gray-900/30">
          <div className="text-xl font-bold text-green-400">{skills.length}</div>
          <div className="text-xs text-gray-500">Skills</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-gray-900/30">
          <div className="text-xl font-bold text-amber-400">{nodes.length}</div>
          <div className="text-xs text-gray-500">Nodes</div>
        </div>
      </div>

      {/* Stargate Pool - Multi-chain ANFE Integration */}
      <div className="pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Network size={20} className="text-cyan-400" />
            <h3 className="font-semibold text-white">Stargate Pool</h3>
            <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full">Multi-chain</span>
          </div>
          <div className="flex items-center gap-2">
            {ethAddress ? (
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-400" />
                <span className="text-xs text-gray-400">{ethAddress.slice(0, 6)}...{ethAddress.slice(-4)}</span>
                {/* Show Graph-loaded ANFEs count */}
                {walletANFEs.length > 0 && (
                  <div className="flex items-center gap-1 ml-2 px-2 py-0.5 bg-purple-500/20 rounded-full">
                    <Zap size={10} className="text-purple-400" />
                    <span className="text-xs text-purple-400">{walletANFEs.length} ANFE{walletANFEs.length > 1 ? 's' : ''}</span>
                  </div>
                )}
                {/* Legacy ANFE info */}
                {anfeInfo && anfeInfo.balance > 0 && (
                  <span className="text-xs text-cyan-400">⚡{anfeInfo.totalPower}</span>
                )}
              </div>
            ) : (
              <button
                onClick={async () => {
                  try {
                    let address: string | null = null;

                    // Priority 1: Use Electron API (same as Web3Page) - ensures consistency
                    if (window.electronAPI?.web3?.getAddress) {
                      const result = await window.electronAPI.web3.getAddress();
                      if (result?.success && result?.data?.address) {
                        address = result.data.address;
                        console.log('[AdaPortal] Connected via Electron API:', address.slice(0, 8) + '...');
                      }
                    }

                    // Priority 2: Fallback to walletAdapter (window.mosaic.wallet)
                    if (!address && walletAdapter.isAvailable()) {
                      address = await anfeService.connectWallet();
                      console.log('[AdaPortal] Connected via walletAdapter:', address?.slice(0, 8) + '...');
                    }

                    // Priority 3: Fallback to window.ethereum
                    if (!address && window.ethereum) {
                      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                      if (accounts && accounts.length > 0) {
                        address = accounts[0];
                        console.log('[AdaPortal] Connected via window.ethereum:', address.slice(0, 8) + '...');
                      }
                    }

                    if (!address) {
                      showNotification('error', 'No wallet detected. Please configure wallet in Web3 settings.');
                      return;
                    }

                    // Update state - same address used everywhere
                    setEthAddress(address);
                    setWalletState(walletAdapter.getState());
                    showNotification('success', `Wallet connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
                    
                    // Load ANFEs via Graph + Merkelizer
                    setIsLoadingANFEs(true);
                    try {
                      console.log('[AdaPortal] Loading ANFEs for wallet:', address);
                      
                      // loadWalletANFEs handles Graph → RPC → Demo fallback internally
                      const walletANFEs = await anfeService.loadWalletANFEs(address);
                      console.log('[AdaPortal] ANFE result:', walletANFEs.totalCount, 'ANFEs');
                      
                      setWalletANFEs(walletANFEs.anfes);
                      console.log('[AdaPortal] Final ANFEs:', walletANFEs.anfes.length);
                      showNotification('success', `Loaded ${walletANFEs.anfes.length} ANFE(s)`);
                    } catch (e) {
                      console.error('[AdaPortal] ANFE load failed:', e);
                      showNotification('error', 'Failed to load ANFEs from Graph');
                    }
                    setIsLoadingANFEs(false);
                    
                    // Also sync to StargatePoolService so the pool tab works correctly
                    (stargatePoolService as any).walletAddress = address;
                    
                    // Also load legacy factories (best-effort; don't block UI on failure)
                    try {
                      const walletFactories = await stargatePoolService.getFactoriesByWallet(address);
                      setFactories(walletFactories);
                    } catch (facErr) {
                      console.warn('[AdaPortal] Factory load skipped:', facErr);
                    }
                  } catch (e) {
                    console.error('[AdaPortal] Wallet connect error:', e);
                    showNotification('error', 'Failed to connect wallet');
                  }
                }}
                className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center gap-1"
              >
                <Wallet size={12} />
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        {/* ANFE Cards (from Graph + decoded attributes) */}
        {isLoadingANFEs ? (
          <div className="flex items-center justify-center py-6">
            <Loader size={20} className="text-cyan-400 animate-spin" />
            <span className="ml-2 text-xs text-gray-400">Loading ANFEs from The Graph...</span>
          </div>
        ) : walletANFEs.length > 0 ? (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Shield size={14} className="text-cyan-400" />
              Your ANFEs (Verified via Merkelizer)
            </h4>
            <div className="grid gap-3">
              {walletANFEs.map((anfe) => {
                const display = formatANFEForDisplay(anfe);
                console.log('[AdaPortal] Rendering ANFE:', anfe.id, 'verification:', anfe.verification);
                return (
                  <div 
                    key={anfe.id}
                    onClick={() => setSelectedANFE(anfe)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedANFE?.id === anfe.id
                        ? 'bg-cyan-500/10 border-cyan-500'
                        : 'bg-gray-800/50 border-gray-700 hover:border-cyan-500/50'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-white">#{anfe.tokenId}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          anfe.chainId === 1 ? 'bg-blue-500/20 text-blue-400' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>
                          {anfe.chainName}
                        </span>
                      </div>
                      {/* Merkelizer Info */}
                      <div className="space-y-1">
                        {anfe.verification.valid ? (
                          <>
                            <span className="flex items-center gap-1 text-xs text-green-400">
                              <CheckCircle size={12} />
                              Verified
                            </span>
                            {anfe.verification.nodeFactoryId && (
                              <span className="text-xs text-gray-500 block">Node Factory: {anfe.verification.nodeFactoryId}</span>
                            )}
                            {anfe.verification.tranche && (
                              <span className="text-xs text-cyan-400 block">Tranche: {anfe.verification.tranche}</span>
                            )}
                            {(anfe.verification.uptime !== undefined || anfe.verification.reliability !== undefined) && (
                              <div className="flex gap-2 text-xs">
                                {anfe.verification.uptime !== undefined && (
                                  <span className="text-gray-400">Uptime: {(anfe.verification.uptime * 100).toFixed(1)}%</span>
                                )}
                                {anfe.verification.reliability !== undefined && (
                                  <span className="text-gray-400">Reliability: {(anfe.verification.reliability * 100).toFixed(1)}%</span>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-yellow-400">
                            <Shield size={12} />
                            Unverified
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Attributes */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      {display.level > 0 && (
                        <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
                          Lv.{display.level}
                        </span>
                      )}
                      {display.license !== 'None' && (
                        <span className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded">
                          {display.license}
                        </span>
                      )}
                    </div>
                    
                    {/* AI Modules */}
                    {display.aiModules.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {display.aiModules.slice(0, 4).map((mod, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 text-xs bg-gray-700 rounded text-gray-300">
                            {mod}
                          </span>
                        ))}
                        {display.aiModules.length > 4 && (
                          <span className="text-xs text-gray-500">+{display.aiModules.length - 4}</span>
                        )}
                      </div>
                    )}
                    
                    {/* Merkelizer Node Info */}
                    {anfe.verification.nodeFactoryId && (
                      <div className="mt-2 pt-2 border-t border-gray-700/50">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400">
                              Node Factory:
                            </span>
                            <span className="font-mono text-cyan-400">
                              {anfe.verification.nodeFactoryId}
                            </span>
                          </div>
                          {anfe.verification.tranche && (
                            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                              Tranche {anfe.verification.tranche}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs">
                          {anfe.verification.uptime !== undefined && (
                            <span className="text-gray-400">
                              Uptime: <span className="text-green-400">{(anfe.verification.uptime * 100).toFixed(1)}%</span>
                            </span>
                          )}
                          {anfe.verification.reliability !== undefined && (
                            <span className="text-gray-400">
                              Reliability: <span className="text-cyan-400">{(anfe.verification.reliability * 100).toFixed(1)}%</span>
                            </span>
                          )}
                          {anfe.verification.status && (
                            <span className={`px-1.5 py-0.5 rounded ${
                              anfe.verification.status === 'online' ? 'bg-green-500/20 text-green-400' :
                              anfe.verification.status === 'busy' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {anfe.verification.status}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : !ethAddress ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            <Network size={24} className="mx-auto mb-2 text-cyan-400/40" />
            <p>Connect wallet to view ANFE eligibility</p>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500 text-sm">
            <Network size={24} className="mx-auto mb-2 text-cyan-400/40" />
            <p>No ANFEs found in connected wallet</p>
          </div>
        )}

        {/* Manual ANFE Entry (when no ANFEs) */}
        {!isLoadingANFEs && walletANFEs.length === 0 && (
          <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Key size={14} className="text-cyan-400" />
                Add ANFE Manually
              </h4>
              <button
                onClick={() => setShowManualANFE(!showManualANFE)}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                {showManualANFE ? 'Cancel' : '+ Add'}
              </button>
            </div>
            {showManualANFE && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualANFEId}
                  onChange={(e) => setManualANFEId(e.target.value)}
                  placeholder="Enter ANFE ID (e.g., 1234567890123456)"
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddManualANFE()}
                />
                <button
                  onClick={handleAddManualANFE}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium"
                >
                  Add
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              APIs unavailable. Enter your ANFE ID from your wallet to display manually.
            </p>
          </div>
        )}

        {/* ─── Your HyperCycle ETH Node Factories ─── */}
        {isLoadingBalances ? (
          <div className="flex items-center justify-center py-4">
            <Loader size={16} className="text-cyan-400 animate-spin" />
            <span className="ml-2 text-xs text-gray-400">Loading ETH assets...</span>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Zap size={14} className="text-yellow-400" />
              Your HyperCycle ETH Node Factories
            </h4>

            {/* ETH ERC-20 tokens */}
            {hyperCycleBalances.filter(t => t.chain === 'ethereum').length > 0 && (
              <div className="grid gap-2">
                {hyperCycleBalances
                  .filter(t => t.chain === 'ethereum')
                  .map((t) => (
                    <div key={t.symbol} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{t.symbol}</span>
                        <span className="text-xs text-gray-500">{t.name}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 rounded text-blue-400">ETH</span>
                      </div>
                      <span className="text-sm text-yellow-400 font-mono">{t.balance}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* ETH NFTs (Node Factories, HyPCL, c_HyPC, ERC-1155) */}
            {hyperCycleNFTsDetailed.filter(g => g.chain === 'ethereum').length > 0 ? (
              <div className="space-y-3">
                {hyperCycleNFTsDetailed
                  .filter(g => g.chain === 'ethereum')
                  .map((group) => (
                    <div key={group.symbol} className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-xs font-semibold text-white">{group.symbol}</span>
                        <span className="text-xs text-gray-500">{group.name}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 rounded text-blue-400">ETH</span>
                        <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 rounded text-purple-400">{group.standard}</span>
                      </div>
                      <div className="grid gap-2">
                        {group.nfts.map((nft) => (
                          <div
                            key={nft.id}
                            className="p-3 bg-gray-800/60 rounded-lg border border-gray-700/60 hover:border-blue-500/40 transition-colors cursor-pointer"
                            onClick={() => setSelectedANFE(nft)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-white">#{nft.tokenId}</span>
                                {nft.verification.valid && (
                                  <span className="text-xs px-1.5 py-0.5 bg-green-500/20 rounded text-green-400">Verified</span>
                                )}
                              </div>
                              {nft.verification.status && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  nft.verification.status === 'online' || nft.verification.status === 'alive'
                                    ? 'bg-green-500/20 text-green-400'
                                    : nft.verification.status === 'busy'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {nft.verification.status}
                                </span>
                              )}
                            </div>
                            <div className="space-y-1 text-xs">
                              {nft.verification.nodeFactoryId && (
                                <p className="text-gray-400">Node Factory: <span className="text-white">{nft.verification.nodeFactoryId}</span></p>
                              )}
                              {nft.verification.tranche && (
                                <p className="text-cyan-400">Tranche: {nft.verification.tranche}</p>
                              )}
                              {nft.verification.uptime !== undefined && (
                                <p className="text-gray-400">Uptime: <span className="text-green-400">{(nft.verification.uptime * 100).toFixed(1)}%</span></p>
                              )}
                              {nft.metadata?.name && (
                                <p className="text-gray-500">{nft.metadata.name}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 py-2">No Ethereum node factories detected.</div>
            )}
          </div>
        )}

        {/* ─── Your HyperCycle BASE ANFEs ─── */}
        {isLoadingBalances ? null : (
          <div className="mt-6 space-y-4">
            <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Network size={14} className="text-purple-400" />
              Your HyperCycle BASE ANFEs
            </h4>

            {/* BASE ERC-20 tokens */}
            {hyperCycleBalances.filter(t => t.chain === 'base').length > 0 && (
              <div className="grid gap-2">
                {hyperCycleBalances
                  .filter(t => t.chain === 'base')
                  .map((t) => (
                    <div key={t.symbol} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{t.symbol}</span>
                        <span className="text-xs text-gray-500">{t.name}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 rounded text-purple-400">BASE</span>
                      </div>
                      <span className="text-sm text-yellow-400 font-mono">{t.balance}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* BASE NFTs (ANFEs, modules, licences) */}
            {hyperCycleNFTsDetailed.filter(g => g.chain === 'base').length > 0 ? (
              <div className="space-y-3">
                {hyperCycleNFTsDetailed
                  .filter(g => g.chain === 'base')
                  .map((group) => (
                    <div key={group.symbol} className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-xs font-semibold text-white">{group.symbol}</span>
                        <span className="text-xs text-gray-500">{group.name}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 rounded text-purple-400">BASE</span>
                        <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 rounded text-purple-400">{group.standard}</span>
                      </div>
                      <div className="grid gap-2">
                        {group.nfts.map((nft) => (
                          <div
                            key={nft.id}
                            className="p-3 bg-gray-800/60 rounded-lg border border-gray-700/60 hover:border-purple-500/40 transition-colors cursor-pointer"
                            onClick={() => setSelectedANFE(nft)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-white">#{nft.tokenId}</span>
                                {nft.verification.valid && (
                                  <span className="text-xs px-1.5 py-0.5 bg-green-500/20 rounded text-green-400">Verified</span>
                                )}
                              </div>
                              {nft.verification.status && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  nft.verification.status === 'online' || nft.verification.status === 'alive'
                                    ? 'bg-green-500/20 text-green-400'
                                    : nft.verification.status === 'busy'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {nft.verification.status}
                                </span>
                              )}
                            </div>
                            <div className="space-y-1 text-xs">
                              {nft.verification.nodeFactoryId && (
                                <p className="text-gray-400">Node Factory: <span className="text-white">{nft.verification.nodeFactoryId}</span></p>
                              )}
                              {nft.verification.tranche && (
                                <p className="text-cyan-400">Tranche: {nft.verification.tranche}</p>
                              )}
                              {nft.verification.uptime !== undefined && (
                                <p className="text-gray-400">Uptime: <span className="text-green-400">{(nft.verification.uptime * 100).toFixed(1)}%</span></p>
                              )}
                              {nft.verification.reliability !== undefined && (
                                <p className="text-gray-400">Reliability: <span className="text-cyan-400">{(nft.verification.reliability * 100).toFixed(1)}%</span></p>
                              )}
                              {nft.metadata?.name && (
                                <p className="text-gray-500">{nft.metadata.name}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 py-2">No Base ANFEs detected.</div>
            )}
          </div>
        )}

        {/* Dev Tools (shown when ANFEs are loaded) */}
        {walletANFEs.length > 0 && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-800">
            <button
              onClick={async () => {
                if (ethAddress) {
                  setIsLoadingANFEs(true);
                  try {
                    const walletANFEs = await anfeService.loadWalletANFEs(ethAddress);
                    setWalletANFEs(walletANFEs.anfes);
                    showNotification('success', `Refreshed: ${walletANFEs.totalCount} ANFE(s)`);
                  } catch (e) {
                    showNotification('error', 'Failed to refresh ANFEs');
                  }
                  setIsLoadingANFEs(false);
                }
              }}
              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-1"
            >
              <RefreshCw size={12} />
              Refresh ANFEs
            </button>
            <button
              onClick={async () => {
                if (ethAddress) {
                  // Re-query factories from the blockchain via ANFE service
                  try {
                    anfeService.clearCache();
                    const walletData = await anfeService.loadWalletANFEs(ethAddress);
                    setWalletANFEs(walletData.anfes || []);
                    // Also refresh detailed NFT holdings
                    const nftsDetailed = await anfeService.getHyperCycleNFTsDetailed(ethAddress);
                    setHyperCycleNFTsDetailed(nftsDetailed);
                    const totalNfts = nftsDetailed.reduce((s, g) => s + g.nfts.length, 0);
                    showNotification('success', `Refreshed ${walletData.totalCount} ANFEs, ${totalNfts} NFTs`);
                  } catch (e) {
                    console.warn('[AdaPortal] Refresh from chain failed:', e);
                    showNotification('error', 'On-chain refresh failed');
                  }
                }
              }}
              className="px-3 py-1.5 text-xs bg-cyan-700 hover:bg-cyan-600 rounded-lg transition-colors flex items-center gap-1"
            >
              <Network size={12} />
              Refresh from Chain
            </button>
            <button
              onClick={async () => {
                // Health check
                const health = await anfeService.healthCheck();
                showNotification('info', `HyperInsight: ${health.hyperinsight ? '✓' : '✗'} | RPC: ${health.rpc ? '✓' : '✗'} | Wallet: ${health.wallet ? '✓' : '✗'}`);
              }}
              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Health Check
            </button>
            <button
              onClick={() => {
                anfeService.stopPolling();
                showNotification('info', 'Polling stopped');
              }}
              className="px-3 py-1.5 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
            >
              Stop Polling
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ============== AI MODELS TAB ==============
  const renderAims = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">AI Models (AIMs)</h3>
        <span className="text-sm text-gray-400">{aims.length} models available</span>
      </div>
      
      {aims.length === 0 ? (
        <div className="text-center py-12">
          <Bot size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">No verified AIMs available</p>
          <p className="text-sm text-gray-600 mt-1">Connect to HyperInsight MCP to see AI models</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {aims.slice(0, 20).map((aim, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Bot size={20} className="text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{aim.name || 'Unnamed AIM'}</h4>
                    {aim.description && <p className="text-sm text-gray-400 mt-1">{aim.description}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      {aim.rank && (
                        <span className="text-xs text-cyan-400">Rank: #{aim.rank}</span>
                      )}
                      {aim.origin && (
                        <span className="text-xs text-purple-400">Origin: {aim.origin}</span>
                      )}
                    </div>
                  </div>
                </div>
                {aim.isActive && (
                  <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Active</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ============== DASHBOARD TAB ==============
  const renderDashboard = () => {
    const stats = skillMarketplace.getStats();
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Intelligence Dashboard</h3>
          <button
            onClick={loadData}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
            <div className="text-2xl font-bold text-white">{listings.length}</div>
            <div className="text-sm text-gray-400">Available Agents</div>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
            <div className="text-2xl font-bold text-white">{aims.length}</div>
            <div className="text-sm text-gray-400">Active AIMs</div>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
            <div className="text-2xl font-bold text-white">{stats.totalSkills}</div>
            <div className="text-sm text-gray-400">Skills</div>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
            <div className="text-2xl font-bold text-white">{nodes.length}</div>
            <div className="text-sm text-gray-400">Compute Nodes</div>
          </div>
        </div>

        {/* Multi-Agent Command Center (Kanban Dashboard) */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden" style={{ height: '620px' }}>
          <div className="px-4 pt-4 flex items-center justify-between">
            <h4 className="font-medium text-white flex items-center gap-2">
              <LayoutDashboard size={16} className="text-cyan-400" />
              Multi-Agent Command Center
            </h4>
            <span className="text-xs text-gray-500">Backlog → Ready → Running → Aimified</span>
          </div>
          <div className="h-[calc(100%-40px)]">
            <KanbanDashboard />
          </div>
        </div>
      </div>
    );
  };

  const renderMarketplace = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Hire AI Agents</h3>
        <div className="flex items-center gap-2">
          {userAgents.length > 0 && (
            <button
              onClick={() => {
                setAgentSelectMode('hire');
                setShowAgentSelectModal(true);
              }}
              className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-1"
            >
              <Bot size={12} />
              My AI Agents
            </button>
          )}
          <span className="text-sm text-gray-400">{listings.length} agents available</span>
        </div>
      </div>
      
      <div className="grid gap-3">
        {listings.map(listing => (
          <div key={listing.listingId} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-cyan-500/50 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-white">{listing.agentName}</h4>
                <div className="flex flex-wrap gap-1 mt-1">
                  {listing.roles.map(role => (
                    <span key={role} className="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-gray-300 capitalize">
                      {role.replace('_', ' ')}
                    </span>
                  ))}
                  {listing.attachedSkills?.slice(0, 2).map(skill => (
                    <span key={skill} className="text-xs px-2 py-0.5 bg-green-900/50 border border-green-500/30 rounded-full text-green-400">⚡ {skill.split('-')[0]}</span>
                  ))}
                </div>
                <div className="flex gap-3 mt-2 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Star size={14} className="text-yellow-500" />
                    {listing.rating.toFixed(1)}
                  </span>
                  <span>{listing.successRate * 100}% success</span>
                  <span className="capitalize">{listing.availability}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-cyan-400">${listing.pricing.perTaskMin}+</div>
                <div className="text-xs text-gray-500">per task</div>
              </div>
            </div>
            <button 
              onClick={() => handleHireAgent(listing)}
              className="mt-3 w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ArrowRight size={16} />
              Hire Agent
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  // State for ranking tabs
  const [rankingTab, setRankingTab] = useState<'agents' | 'skills' | 'aims'>('agents');

  const renderLeaderboard = () => {
    const skillStats = skillMarketplace.getStats();
    const topSkills = skillMarketplace.getSkills()
      .sort((a: any, b: any) => (b.installs || 0) - (a.installs || 0))
      .slice(0, 10);
    
    const topAims = hyperInsight.getTopAIMs(10);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Rankings</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => setRankingTab('agents')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                rankingTab === 'agents' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              Agents
            </button>
            <button 
              onClick={() => setRankingTab('skills')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                rankingTab === 'skills' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              Skills ⚡
            </button>
            <button 
              onClick={() => setRankingTab('aims')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                rankingTab === 'aims' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              AIMs 🤖
            </button>
          </div>
        </div>

        {/* Agents Tab */}
        {rankingTab === 'agents' && (
          <>
            <div className="flex gap-2 mb-3">
              {(['daily', 'weekly', 'all_time'] as LeaderboardPeriod[]).map(period => (
                <button 
                  key={period}
                  onClick={() => setLeaderboardPeriod(period)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    leaderboardPeriod === period 
                      ? 'bg-cyan-600 text-white' 
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {period.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              {['overall', 'marketing', 'dev', 'uiux', 'roi'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setLeaderboardCategory(cat)}
                  className={`px-3 py-1 text-xs rounded-full capitalize transition-colors ${
                    leaderboardCategory === cat
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {leaderboardData.slice(0, 10).map((entry, index) => (
                <div key={entry.agentId} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                    index === 1 ? 'bg-gray-400/20 text-gray-300' :
                    index === 2 ? 'bg-amber-600/20 text-amber-500' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {entry.rank}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white">{entry.agentName}</div>
                    <div className="text-xs text-gray-500">
                      Skill: {entry.skillScore} | Success: {entry.successScore}% | Rating: {entry.ratingScore}
                    </div>
                  </div>
                  <div className="text-xl font-bold text-cyan-400">{entry.score}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Skills Tab - from skills.sh */}
        {rankingTab === 'skills' && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400 mb-3">
              Top skills from skills.sh • {skillStats.totalInstalls.toLocaleString()} total installs
            </p>
            {topSkills.map((skill: any, index) => (
              <div key={skill.name} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  index === 0 ? 'bg-green-500/20 text-green-400' :
                  index === 1 ? 'bg-green-400/20 text-green-300' :
                  index === 2 ? 'bg-green-600/20 text-green-500' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-white">{skill.name}</div>
                  <div className="text-xs text-gray-500">
                    {skill.category} • {skill.provider}
                  </div>
                </div>
                <div className="text-lg font-bold text-green-400">⚡ {skill.installs?.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}

        {/* AIMs Tab - from HyperInsight */}
        {rankingTab === 'aims' && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400 mb-3">
              Top AI Models from HyperInsight
            </p>
            {topAims.length === 0 ? (
              <div className="text-center py-8">
                <Bot size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">No AIM data available</p>
                <p className="text-xs text-gray-600 mt-1">Connect to HyperInsight to see AI model rankings</p>
              </div>
            ) : (
              topAims.map((aim, index) => (
                <div key={aim.name} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    index === 0 ? 'bg-purple-500/20 text-purple-400' :
                    index === 1 ? 'bg-purple-400/20 text-purple-300' :
                    index === 2 ? 'bg-purple-600/20 text-purple-500' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white">{aim.name}</div>
                    <div className="text-xs text-gray-500">
                      {aim.description?.slice(0, 50) || 'AI Model'} • Rank: {aim.rank}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-purple-400">{aim.computeTFLOPS || '?'} TFLOPS</div>
                    <div className="text-xs text-gray-500">{aim.activeNodes || 0} nodes</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTraining = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Train Your Agents</h3>
        <div className="flex items-center gap-2">
          {userAgents.length > 0 && (
            <button
              onClick={() => {
                setAgentSelectMode('train');
                setShowAgentSelectModal(true);
              }}
              className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-1"
            >
              <Bot size={12} />
              My AI Agents
            </button>
          )}
          <span className="text-sm text-gray-400">{trainingListings.length} trainers available</span>
        </div>
      </div>

      <div className="grid gap-3">
        {trainingListings.map(listing => (
          <div key={listing.listingId} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-white">{listing.trainerName}</h4>
                <p className="text-sm text-gray-400 mt-1">{listing.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {listing.specializations.map(skill => (
                    <span key={skill} className="text-xs px-2 py-0.5 bg-purple-900/50 rounded-full text-purple-300">
                      {skill}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                  <Star size={14} className="text-yellow-500" />
                  <span>{listing.rating.toFixed(1)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-400">${listing.pricePerSession}</div>
                <div className="text-xs text-gray-500">per session</div>
              </div>
            </div>
            <button 
              onClick={() => handleBookTraining(listing)}
              className="mt-3 w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <GraduationCap size={16} />
              Book Training
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPackages = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Agent Bundles</h3>
        <div className="flex items-center gap-2">
          {userAgents.length > 0 && (
            <button
              onClick={() => {
                setAgentSelectMode('package');
                setShowAgentSelectModal(true);
              }}
              className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-1"
            >
              <Bot size={12} />
              My AI Agents
            </button>
          )}
          <span className="text-sm text-gray-400">{packages.length} packages</span>
        </div>
      </div>

      <div className="grid gap-3">
        {packages.map(pkg => (
          <div key={pkg.packageId} className={`bg-gray-800/50 rounded-lg p-4 border ${pkg.popular ? 'border-green-500/50' : 'border-gray-700'}`}>
            {pkg.popular && (
              <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Popular</span>
            )}
            <h4 className="font-semibold text-white mt-2">{pkg.name}</h4>
            <p className="text-sm text-gray-400 mt-1">{pkg.description}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {pkg.agents.map(agent => (
                <span key={agent.agentId} className="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-gray-300">
                  {agent.name}
                </span>
              ))}
              <span className="text-xs px-2 py-0.5 bg-green-900/30 border border-green-500/30 rounded-full text-green-400">⚡ 3 skills</span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div>
                <div className="text-xl font-bold text-green-400">${pkg.price}</div>
                {pkg.computeAllocation && (
                  <div className="text-xs text-gray-500">{pkg.computeAllocation}h compute included</div>
                )}
              </div>
              <button 
                onClick={() => handleGetPackage(pkg)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Package size={16} />
                Get Package
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSkills = () => {
    const skillStats = skillMarketplace.getStats();
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Skills Marketplace</h3>
          <div className="flex items-center gap-2">
            {userAgents.length > 0 && (
              <button
                onClick={() => {
                  setAgentSelectMode('skill');
                  setShowAgentSelectModal(true);
                }}
                className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 rounded-lg transition-colors flex items-center gap-1"
              >
                <Zap size={12} />
                Attach to My Agent
              </button>
            )}
            <span className="text-sm text-gray-400">{skillStats.totalSkills} skills • {skillStats.totalInstalls.toLocaleString()} ⚡</span>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={`text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {skills.slice(0, 20).map((skill: any) => (
            <div key={skill.name} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 hover:border-cyan-500/30 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white font-medium">{skill.name}</p>
                <span className="text-xs text-cyan-400">{skill.installs.toLocaleString()} ⚡</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{skill.category} • {skill.provider}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCompute = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Compute Access</h3>
        <button 
          onClick={() => onNavigateToChat?.('I need compute resources for my agents')}
          className="px-3 py-1 text-sm bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors"
        >
          Allocate Compute
        </button>
      </div>

      <div className="grid gap-3">
        {computeTiers.map(tier => (
          <div 
            key={tier.id}
            onClick={() => handleSelectCompute(tier.id)}
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              selectedComputeTier === tier.id
                ? 'border-cyan-500 bg-cyan-900/20'
                : 'border-gray-700 bg-gray-800/50 hover:border-cyan-500/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-white">{tier.label}</h4>
                <p className="text-sm text-gray-400">{tier.specs}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-cyan-400">{tier.price}</div>
                {selectedComputeTier === tier.id && (
                  <div className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle size={12} />
                    Selected
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-cyan-400">{nodes.length}</div>
          <div className="text-sm text-gray-400">Total Nodes</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-green-400">
            {nodes.filter(n => n.status === 'online').length}
          </div>
          <div className="text-sm text-gray-400">Online</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-yellow-400">
            {nodes.filter(n => n.reliability >= 0.9).length}
          </div>
          <div className="text-sm text-gray-400">Reliable (90%+)</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-purple-400">
            {nodes.reduce((sum, n) => sum + n.availableCompute, 0)}
          </div>
          <div className="text-sm text-gray-400">Available Units</div>
        </div>
      </div>
    </div>
  );

  const renderNodes = () => {
    const allNodes = [
      ...nodes.map((n) => ({ ...n, _source: 'hyperinsight' as const })),
      ...hboxNodes.map((n) => ({ ...n, _source: 'hyperaibox' as const })),
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Compute Nodes</h3>
          <div className="flex items-center gap-2">
            {hboxNodes.length > 0 && (
              <span className="text-xs px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-full">
                {hboxNodes.length} HBox{hboxNodes.length !== 1 ? 'es' : ''}
              </span>
            )}
            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <RefreshCw size={18} className={`text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {allNodes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Cpu size={32} className="mx-auto mb-2 opacity-50" />
            <p>No compute nodes available</p>
            <p className="text-xs mt-1">Connect your HyperAIBox from the sidebar to deploy agents.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Section header for HyperAIBox nodes */}
            {hboxNodes.length > 0 && (
              <div className="mb-2">
                <h4 className="text-xs font-medium text-violet-400 uppercase tracking-wider mb-2">Your HyperAIBox Appliances</h4>
                {hboxNodes.map((node: any) => (
                  <div key={node.nodeId} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-violet-500/20">
                    <div className="w-3 h-3 rounded-full bg-violet-500" />
                    <div className="flex-1">
                      <div className="font-mono text-sm text-white">{node.address}</div>
                      <div className="text-xs text-gray-500">
                        {node.apiHost}:{node.apiPort} |{' '}
                        {node.licenseKey ? `ANFE #${node.licenseKey}` : 'No license'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {node.hasHermes ? (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded"><CheckCircle size={10} className="inline mr-1" />Hermes</span>
                      ) : (
                        <button
                          onClick={() => {
                            const agent = userAgents[0];
                            if (agent) {
                              showNotification('info', `Deploying Hermes to ${node.address}...`);
                              // In real flow: open HermesAimPanel or trigger Docker build
                            } else {
                              showNotification('warning', 'Select an agent first from the Hire Agents tab');
                            }
                          }}
                          className="px-3 py-1 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded flex items-center gap-1"
                        >
                          <Rocket size={10} /> Deploy
                        </button>
                      )}
                      {!node.isDelegated ? (
                        <button
                          onClick={async () => {
                            try {
                              await hboxPoolService.delegateToStargate(node.nodeId, { accessType: 'public' });
                              showNotification('success', `${node.address} delegated to pool`);
                              handleRefresh();
                            } catch (e: any) {
                              showNotification('error', `Delegation failed: ${e.message}`);
                            }
                          }}
                          className="px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded flex items-center gap-1"
                        >
                          <Network size={10} /> Pool
                        </button>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded"><Zap size={10} className="inline mr-1" />Pooled</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Section header for HyperInsight nodes */}
            {nodes.length > 0 && (
              <div className="mb-2">
                <h4 className="text-xs font-medium text-cyan-400 uppercase tracking-wider mb-2">HyperInsight Network</h4>
                {nodes.map((node) => (
                  <div key={node.nodeId} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                    <div className={`w-3 h-3 rounded-full ${node.status === 'online' ? 'bg-green-500' : node.status === 'busy' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                    <div className="flex-1">
                      <div className="font-mono text-sm text-white">{node.address?.slice(0, 10)}...</div>
                      <div className="text-xs text-gray-500">
                        Uptime: {(node.uptime * 100).toFixed(1)}% | Reliability: {(node.reliability * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white">{node.availableCompute} units</div>
                      <div className="text-xs text-gray-500">${node.pricePerHour}/hr</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ============== STARGATE POOL RENDER ==============
  const renderStargatePool = () => {
    const walletAddress = stargatePoolService.getWalletAddress();

    const getAgentDisplay = (id: string) => {
      const a = userAgents.find((x) => x.id === id);
      return a ? a.name : id.substring(0, 8) + '...';
    };

    const attachAgent = (anfeId: string, agentId: string) => {
      setAnfeAgentBindings((prev) => {
        const next = { ...prev, [anfeId]: agentId };
        try { localStorage.setItem('stargate_anfe_bindings', JSON.stringify(next)); } catch {}
        return next;
      });
      showNotification('success', 'Agent attached to ANFE');
    };

    const detachAgent = (anfeId: string) => {
      setAnfeAgentBindings((prev) => {
        const next = { ...prev };
        delete next[anfeId];
        try { localStorage.setItem('stargate_anfe_bindings', JSON.stringify(next)); } catch {}
        return next;
      });
      showNotification('info', 'Agent detached from ANFE');
    };

    const rarityColor = (r?: string) => {
      switch (r?.toLowerCase()) {
        case 'legendary': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        case 'epic':      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
        case 'rare':      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
        case 'common':    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        default:          return 'bg-gray-700/40 text-gray-400 border-gray-600/30';
      }
    };

    return (
      <div className="space-y-6">
        {/* ── Wallet Header ── */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center border border-yellow-500/20">
                <Wallet size={20} className="text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Stargate Pool</h3>
                <p className="text-xs text-gray-400">
                  {walletAddress
                    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
                    : 'Connect wallet to view ANFEs'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {walletAddress && (
                <button
                  onClick={() => stargatePoolService.disconnectWallet()}
                  className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-gray-400 text-xs flex items-center gap-1"
                  title="Disconnect"
                >
                  <XCircle size={14} /> Disconnect
                </button>
              )}
              {walletAddress ? (
                <button
                  onClick={() => stargatePoolService.initialize()}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={18} className="text-gray-400" />
                </button>
              ) : (
              <button
                onClick={async () => {
                  try {
                    const result = await stargatePoolService.connectWallet();
                    if (result.success && result.address) {
                      setEthAddress(result.address);
                      setWalletState(walletAdapter.getState());
                      setIsLoadingANFEs(true);
                      try {
                        const walletANFEs = await anfeService.loadWalletANFEs(result.address);
                        setWalletANFEs(walletANFEs.anfes);
                        if (walletANFEs.anfes.length > 0) {
                          showNotification('success', `Loaded ${walletANFEs.anfes.length} ANFE(s)`);
                        }
                      } catch (e) {
                        console.warn('[AdaPortal] Stargate ANFE load failed:', e);
                      } finally {
                        setIsLoadingANFEs(false);
                      }
                    }
                  } catch { showNotification('error', 'Failed to connect wallet'); }
                }}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 text-sm"
              >
                <Wallet size={16} /> Connect Wallet
              </button>
              )}
            </div>
          </div>
        </div>

        {/* ── ANFE Card Gallery ── */}
        {walletAddress && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <Layers size={18} className="text-purple-400" />
                Your ANFEs
                <span className="text-xs text-gray-500 ml-1">({walletANFEs.length})</span>
              </h4>
              {isLoadingANFEs && <RefreshCw size={16} className="text-cyan-400 animate-spin" />}
            </div>

            {walletANFEs.length === 0 && !isLoadingANFEs ? (
              <div className="bg-gray-800/30 rounded-xl p-8 border border-gray-700/50 text-center">
                <Zap size={40} className="mx-auto mb-3 text-purple-400/40" />
                <p className="text-gray-400 font-medium">No ANFEs found for this wallet</p>
                <p className="text-xs text-gray-600 mt-1">Hold ANFE NFTs to see them here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {walletANFEs.map((anfe, idx) => {
                  const binding = anfeAgentBindings[anfe.id];
                  return (
                    <div
                      key={anfe.id || idx}
                      className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 hover:border-purple-500/40 transition-all group"
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${rarityColor(anfe.rarity)}`}>
                            <Zap size={24} />
                          </div>
                          <div>
                            <h5 className="font-semibold text-white text-sm leading-tight">{anfe.name || `ANFE #${anfe.tokenId || idx + 1}`}</h5>
                            <div className="text-xs text-gray-400 mt-0.5">{anfe.chain || 'ethereum'} · Level {anfe.level ?? '?'}</div>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${rarityColor(anfe.rarity)}`}>
                          {anfe.rarity || 'Standard'}
                        </span>
                      </div>

                      {/* Attributes */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-gray-900/40 rounded-lg p-2 border border-gray-700/40">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500">Status</div>
                          <div className={`text-xs font-medium mt-0.5 ${anfe.status === 'active' ? 'text-green-400' : 'text-gray-400'}`}>
                            {anfe.status || 'active'}
                          </div>
                        </div>
                        <div className="bg-gray-900/40 rounded-lg p-2 border border-gray-700/40">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500">Compute</div>
                          <div className="text-xs font-medium mt-0.5 text-cyan-400">{anfe.computeUnits || 'Standard'}</div>
                        </div>
                      </div>

                      {/* Agent Attachment */}
                      <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-400 flex items-center gap-1.5">
                            <Bot size={12} className="text-cyan-400" />
                            Attached Agent
                          </span>
                          {binding && (
                            <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                              Live
                            </span>
                          )}
                        </div>

                        {binding ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center shrink-0">
                                <Bot size={14} className="text-cyan-400" />
                              </div>
                              <span className="text-sm text-white truncate">{getAgentDisplay(binding)}</span>
                            </div>
                            <button
                              onClick={() => detachAgent(anfe.id)}
                              className="p-1 hover:bg-red-500/10 rounded text-gray-500 hover:text-red-400 transition-colors shrink-0"
                              title="Detach agent"
                            >
                              <XCircle size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {userAgents.length === 0 ? (
                              <p className="text-xs text-gray-500">No agents available. Create one first.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {userAgents.slice(0, 6).map((agent) => (
                                  <button
                                    key={agent.id}
                                    onClick={() => attachAgent(anfe.id, agent.id)}
                                    className="px-2 py-1 bg-gray-800 hover:bg-cyan-600/20 border border-gray-600 hover:border-cyan-500/40 rounded-md text-xs text-gray-300 hover:text-cyan-300 transition-colors flex items-center gap-1"
                                  >
                                    <Plus size={10} />
                                    {agent.name}
                                  </button>
                                ))}
                                {userAgents.length > 6 && (
                                  <span className="px-2 py-1 text-xs text-gray-500">+{userAgents.length - 6} more</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Deploy / Details row */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => showNotification('info', `ANFE ${anfe.id} details coming soon`)}
                          className="flex-1 py-1.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => {
                            if (!binding) {
                              showNotification('warning', 'Attach an agent first');
                              return;
                            }
                            showNotification('success', `Deploy queued: ${anfe.id}`);
                          }}
                          className="flex-1 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          <Server size={12} />
                          Deploy
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Node Factories (compact) ── */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Server size={16} className="text-cyan-400" />
              Node Deploy System
            </h4>
            <button
              onClick={() => ethAddress ? stargatePoolService.loadNodeFactoriesFromChain(ethAddress) : null}
              disabled={!ethAddress}
              className="text-[11px] px-2 py-1 bg-gray-700/60 hover:bg-gray-600 disabled:opacity-30 disabled:hover:bg-gray-700 text-gray-300 rounded"
            >
              + Load from Chain
            </button>
          </div>

          {factories.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">
              <p>No factories registered. Connect wallet and load from chain.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {factories.map(({ factory, isEligible, reason }) => (
                <div key={factory.factory_id} className="bg-gray-900/40 rounded-lg border border-gray-700/60 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-white">{factory.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isEligible ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                      {isEligible ? 'Eligible' : 'Locked'}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 mb-1">
                    {factory.chain} · {factory.network} · Lv.{factory.min_anfe_level ?? '—'}+
                  </div>
                  <div className="text-[11px] text-gray-500 mb-2">
                    Cap: <span className="text-green-400 font-medium">{factory.available_capacity}</span>/{factory.total_capacity}
                    <span className="ml-1">· {factory.delegation.is_public ? 'Public' : 'NFT-gated'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {factory.skills_supported?.slice(0, 3).map((skill) => (
                      <span key={skill} className="px-1.5 py-0.5 bg-cyan-600/15 text-cyan-400 text-[10px] rounded">{skill}</span>
                    ))}
                    {(factory.skills_supported?.length || 0) > 3 && (
                      <span className="text-[10px] text-gray-500 px-1">+{(factory.skills_supported!.length - 3)}</span>
                    )}
                  </div>
                  {isEligible && (
                    <button
                      onClick={() => showNotification('info', `Selected factory: ${factory.name}`)}
                      className="w-full py-1 text-[11px] bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/20 rounded transition-colors"
                    >
                      Select Factory
                    </button>
                  )}
                  {reason && <div className="mt-1 text-[10px] text-gray-600">{reason}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Dev Tools (compact row) ── */}
        <div className="flex gap-2">
          <button
            onClick={() => ethAddress ? stargatePoolService.loadNodeFactoriesFromChain(ethAddress) : null}
            className="px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600 text-gray-300 text-xs rounded-lg"
          >
            + Load from Chain
          </button>
          <button
            onClick={() => stargatePoolService.clearAll()}
            className="px-3 py-1.5 bg-red-900/30 hover:bg-red-800/40 text-red-400 text-xs rounded-lg"
          >
            Clear All
          </button>
        </div>
      </div>
    );
  };

  // ============== ASP GATEWAY RENDER ==============
  const renderAspGateway = () => {
    const companies = aspGateway.getAllCompanies();
    const packages = aspGateway.getAllAsp();
    const horizonHub = aspGateway.getHorizonHub();

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Deploy System</h3>
          <button 
            onClick={() => showNotification('info', 'ASP creation coming soon')}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
          >
            <FolderOutput size={16} />
            Create ASP
          </button>
        </div>

        {/* HorizonHub System (First Implementation) */}
        {horizonHub && (
          <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 rounded-xl p-4 border border-purple-500/30">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-600/30 rounded-lg">
                <FolderOutput size={24} className="text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-white">{horizonHub.name}</h4>
                  <span className="px-2 py-0.5 bg-green-600/30 text-green-400 text-xs rounded-full">
                    {horizonHub.status}
                  </span>
                  <span className="px-2 py-0.5 bg-blue-600/30 text-blue-400 text-xs rounded-full">
                    {horizonHub.executionMode}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-3">{horizonHub.description}</p>
                
                {/* Agents */}
                <div className="space-y-2 mb-3">
                  {horizonHub.agents.map(agent => (
                    <div key={agent.id} className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${
                        agent.executionPreference === 'cloud' ? 'bg-blue-500' :
                        agent.executionPreference === 'node' ? 'bg-green-500' : 'bg-yellow-500'
                      }`} />
                      <span className="text-sm text-white">{agent.name}</span>
                      <span className="text-xs text-gray-500">({agent.type})</span>
                      <span className="text-xs text-gray-600 ml-auto">{agent.executionPreference}</span>
                    </div>
                  ))}
                </div>

                {/* Compliance Flags */}
                <div className="flex flex-wrap gap-2">
                  {horizonHub.complianceFlags.gdprMode && (
                    <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded">
                      GDPR
                    </span>
                  )}
                  {horizonHub.complianceFlags.dataLoggingEnabled && (
                    <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded">
                      Logging
                    </span>
                  )}
                  {horizonHub.complianceFlags.restrictedExecutionZones.map(zone => (
                    <span key={zone} className="px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded">
                      {zone}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other ASP Packages */}
        {packages.filter(p => p.id !== 'horizonhub-driving-system').length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-400">Other Systems</h4>
            {packages.filter(p => p.id !== 'horizonhub-driving-system').map(asp => (
              <div key={asp.id} className="p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">{asp.name}</div>
                    <div className="text-xs text-gray-500">{asp.description}</div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${
                    asp.status === 'active' ? 'bg-green-600/30 text-green-400' :
                    asp.status === 'pending' ? 'bg-yellow-600/30 text-yellow-400' :
                    'bg-red-600/30 text-red-400'
                  }`}>
                    {asp.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Companies */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-400">Companies</h4>
          {companies.map(company => (
            <div key={company.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
              <div className="p-2 bg-gray-700 rounded-lg">
                <Building2 size={18} className="text-gray-400" />
              </div>
              <div className="flex-1">
                <div className="text-white font-medium">{company.name}</div>
                <div className="text-xs text-gray-500">
                  {company.systems.length} system(s) • {company.role}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1">ASP Gateway</p>
            <p className="text-blue-400/70">
              Companies can upload Agentic System Packages (ASPs) that execute through Stargate routing to NodeFactory or cloud fallbacks. 
              Operator retains full control.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // ============== QR CODE MODAL FOR MOBILE PAIRING ==============
  const QRModal = () => {
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
    const [status, setStatus] = useState<'pending' | 'scanning' | 'connected'>('pending');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const generateQR = async () => {
        try {
          const qrResult = await window.electronAPI?.cardano?.tokeoQRPairing();
          const qr = qrResult as any;
          if (qr?.success && qr?.data?.uri) {
            setStatus('scanning');
            
            // Generate QR code as data URL
            const dataUrl = await QRCode.toDataURL(qr.data.uri, {
              width: 200,
              margin: 2,
              color: { dark: '#000000', light: '#FFFFFF' }
            });
            setQrDataUrl(dataUrl);
            
            // Start polling for connection
            const interval = setInterval(async () => {
              const checkResult = await window.electronAPI?.cardano?.tokeoCheckQR();
              const c = checkResult as any;
              if (c?.success && c?.data?.connected) {
                clearInterval(interval);
                setTokeoConnected(true);
                setTokeoAddress(c.data.address);
                setStatus('connected');
                setTimeout(() => {
                  setShowQRModal(false);
                  showNotification('success', 'Tokeo mobile wallet connected!');
                  if (nftPolicyIds.length > 0) {
                    window.electronAPI?.cardano?.tokeoVerifyCollection(nftPolicyIds, false).then((v: any) => {
                      if (v?.success && v?.data?.hasAccess) {
                        showNotification('success', 'NFT access verified! Premium features unlocked.');
                      }
                    });
                  }
                }, 1500);
              }
            }, 3000);
            setPollInterval(interval);
          }
        } catch (e) {
          console.error('[QRModal] Failed to generate QR:', e);
        }
      };
      
      generateQR();
      
      return () => {
        if (pollInterval) clearInterval(pollInterval);
        window.electronAPI?.cardano?.tokeoCancelQR();
      };
    }, []);

    const handleCancel = () => {
      if (pollInterval) clearInterval(pollInterval);
      window.electronAPI?.cardano?.tokeoCancelQR();
      setShowQRModal(false);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full mx-4 border border-gray-700 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 mx-auto mb-3 flex items-center justify-center">
              <Wallet size={32} className="text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">Scan with Tokeo</h3>
            <p className="text-sm text-gray-400 mt-1">
              {status === 'connected' 
                ? 'Connected!' 
                : 'Open Tokeo app → Wallet → Connect DApp → Scan QR'}
            </p>
          </div>

          {/* QR Code Display */}
          <div className="bg-white rounded-xl p-4 mb-4">
            {status === 'connected' ? (
              <div className="flex items-center justify-center py-8">
                <CheckCircle size={64} className="text-green-500" />
              </div>
            ) : qrDataUrl ? (
              <div className="flex items-center justify-center py-2">
                <img src={qrDataUrl} alt="Scan QR Code" className="w-48 h-48 rounded-lg" />
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader size={32} className="text-gray-400 animate-spin" />
              </div>
            )}
          </div>

          {/* Status indicator */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {status === 'scanning' && (
              <>
                <Loader size={16} className="text-cyan-400 animate-spin" />
                <span className="text-sm text-cyan-400">Waiting for scan...</span>
              </>
            )}
            {status === 'connected' && (
              <>
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-sm text-green-400">Successfully connected!</span>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors"
            >
              {status === 'connected' ? 'Done' : 'Cancel'}
            </button>
            {status === 'scanning' && (
              <button
                onClick={async () => {
                  // Manual retry check
                  const checkResult = await window.electronAPI?.cardano?.tokeoCheckQR();
                  const c = checkResult as any;
                  if (c?.success && c?.data?.connected) {
                    if (pollInterval) clearInterval(pollInterval);
                    setTokeoConnected(true);
                    setTokeoAddress(c.data.address);
                    setStatus('connected');
                    setTimeout(() => {
                      setShowQRModal(false);
                      showNotification('success', 'Tokeo mobile wallet connected!');
                    }, 1500);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                Check
              </button>
            )}
          </div>

          {/* Help text */}
          {status === 'scanning' && (
            <p className="text-xs text-gray-500 text-center mt-3">
              The QR code links your Tokeo mobile wallet to Stargate.<br />
              No funds will be transferred without your confirmation.
            </p>
          )}
        </div>
      </div>
    );
  };

  // ============== AGENT SELECT MODAL ==============
  // Used for Hire Agent, Book Training, Get Package, and Attach Skill
  const AgentSelectModal = () => {
    if (!showAgentSelectModal) return null;

    const getTitle = () => {
      switch (agentSelectMode) {
        case 'hire': return 'Select AI Agent to Hire';
        case 'train': return 'Select AI Agent for Training';
        case 'package': return 'Select AI Agent for Bundle';
        case 'skill': return 'Select AI Agent to Attach Skill';
        default: return 'Select AI Agent';
      }
    };

    const getDescription = () => {
      switch (agentSelectMode) {
        case 'hire': return 'Choose an AI Agent from your configured agents to hire for your project.';
        case 'train': return 'Choose an AI Agent that will receive training from the selected trainer.';
        case 'package': return 'Choose an AI Agent to include in this bundle package.';
        case 'skill': return 'Choose an AI Agent to attach the selected skill to.';
        default: return 'Select an AI Agent from your configuration.';
      }
    };

    const handleAgentSelect = (agent: any) => {
      setSelectedUserAgent(agent);
      // If there are ANFEs available, also show ANFE selection
      if (walletANFEs.length > 0) {
        // Keep modal open for ANFE selection
        showNotification('info', `Selected ${agent.name}. Now select an ANFE to delegate to.`);
      } else {
        // No ANFEs - complete the selection
        handleAgentConfirmed(agent, null);
      }
    };

    // Manual ANFE entry handler
    const handleAddManualANFE = () => {
      const anfeId = manualANFEId.trim();
      if (!anfeId) {
        showNotification('error', 'Please enter an ANFE ID');
        return;
      }
      
      // Create a manual ANFE from the ID
      const manualANFE: ANFE = {
        id: `manual:${anfeId}`,
        tokenId: anfeId,
        contractAddress: '',
        owner: walletAddress || '',
        chainId: 1,
        chainName: 'Ethereum',
        blockNumber: 0,
        blockTimestamp: Date.now(),
        transactionHash: '',
        attributes: {
          core: {
            level: { trait_type: 'Level', value: 11 },
            primaryLicense: { trait_type: 'License', value: 'standard' }
          },
          ai: { aiModules: [] },
          raw: []
        },
        verification: {
          valid: true,
          anfeId: anfeId,
          nodeFactoryId: '',
          tranche: 'T3',
          uptime: 0.988,
          reliability: 0.995,
          status: 'online',
          lastUpdated: Date.now(),
        },
      };
      
      setWalletANFEs(prev => [...prev, manualANFE]);
      setShowManualANFE(false);
      setManualANFEId('');
      showNotification('success', `Added ANFE ${anfeId}`);
      console.log('[AdaPortal] Manual ANFE added:', manualANFE);
    };

    const handleAgentConfirmed = (agent: any, anfe: ANFE | null) => {
      console.log('[AdaPortal] Agent selected:', agent.name, 'ANFE:', anfe?.id || 'none');
      
      switch (agentSelectMode) {
        case 'hire':
          if (onHireAgent) {
            onHireAgent(agent.id, agent.name);
          } else if (onNavigateToChat) {
            onNavigateToChat(`I want to hire my AI agent ${agent.name}. Configure it with ANFE: ${anfe?.id || 'none'}`);
          }
          showNotification('success', `Hiring ${agent.name}...`);
          break;
        case 'train':
          if (onBookTraining) {
            onBookTraining(agent.id, agent.name);
          } else if (onNavigateToChat) {
            onNavigateToChat(`Book training for my AI agent ${agent.name}`);
          }
          showNotification('success', `Booking training for ${agent.name}...`);
          break;
        case 'package':
          if (onGetPackage) {
            onGetPackage(agent.id, agent.name);
          } else if (onNavigateToChat) {
            onNavigateToChat(`Get package for my AI agent ${agent.name}`);
          }
          showNotification('success', `Getting package for ${agent.name}...`);
          break;
        case 'skill':
          if (onNavigateToChat) {
            onNavigateToChat(`Attach skill to my AI agent ${agent.name}`);
          }
          showNotification('success', `Attaching skill to ${agent.name}...`);
          break;
      }
      
      setShowAgentSelectModal(false);
      setSelectedUserAgent(null);
      setSelectedAgentForDelegation(null);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full mx-4 border border-gray-700 shadow-2xl max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-white">{getTitle()}</h3>
              <p className="text-sm text-gray-400 mt-1">{getDescription()}</p>
            </div>
            <button 
              onClick={() => {
                setShowAgentSelectModal(false);
                setSelectedUserAgent(null);
                setSelectedAgentForDelegation(null);
              }}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <XCircle size={20} className="text-gray-400" />
            </button>
          </div>

          {/* User Agents List */}
          {isLoadingUserAgents ? (
            <div className="flex items-center justify-center py-8">
              <Loader size={24} className="text-cyan-400 animate-spin" />
              <span className="ml-2 text-gray-400">Loading your AI Agents...</span>
            </div>
          ) : userAgents.length === 0 ? (
            <div className="text-center py-8">
              <Bot size={48} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">No AI Agents configured</p>
              <p className="text-sm text-gray-600 mt-1">Create agents in AI Agents configuration</p>
              <button
                onClick={() => {
                  setShowAgentSelectModal(false);
                  if (onNavigateToChat) {
                    onNavigateToChat('I want to create a new AI Agent');
                  }
                }}
                className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
              >
                Create New Agent
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {userAgents.map((agent) => (
                <div 
                  key={agent.id}
                  onClick={() => handleAgentSelect(agent)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedUserAgent?.id === agent.id
                      ? 'bg-cyan-500/10 border-cyan-500'
                      : 'bg-gray-800/50 border-gray-700 hover:border-cyan-500/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Bot size={20} className="text-purple-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{agent.name}</h4>
                        <p className="text-xs text-gray-400">{agent.model} • {agent.provider}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {agent.isActive ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Active</span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">Inactive</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Agent Details */}
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      {agent.hypercycleBackend && (
                        <span className="flex items-center gap-1">
                          <Zap size={12} className="text-cyan-400" />
                          {agent.hypercycleBackend}
                        </span>
                      )}
                      <span>Created: {new Date(agent.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ANFE Selection (shown after agent is selected and ANFEs exist) */}
          {selectedUserAgent && walletANFEs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                <Network size={16} className="text-cyan-400" />
                Select ANFE to Delegate (Optional)
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                <button
                  onClick={() => handleAgentConfirmed(selectedUserAgent, null)}
                  className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 text-left transition-colors"
                >
                  <span className="text-white text-sm">No ANFE (Use Cloud)</span>
                  <span className="text-xs text-gray-500 block mt-1">Delegate to cloud fallback</span>
                </button>
                {walletANFEs.map((anfe) => (
                  <button
                    key={anfe.id}
                    onClick={() => handleAgentConfirmed(selectedUserAgent, anfe)}
                    className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 hover:border-cyan-500 text-left transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm">#{anfe.tokenId} - {anfe.chainName}</span>
                      <Zap size={14} className="text-purple-400" />
                    </div>
                    <span className="text-xs text-gray-500 block mt-1">
                      {anfe.attributes?.ai?.aiModules?.slice(0, 2).join(', ') || 'No modules'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No ANFEs Notice */}
          {selectedUserAgent && walletANFEs.length === 0 && (
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-400">
                No ANFEs found in wallet. Agent will use cloud fallback.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 relative">
      {/* QR Modal */}
      {showQRModal && <QRModal />}
      
      {/* Agent Select Modal */}
      {showAgentSelectModal && <AgentSelectModal />}
      
      {/* Notification Toast */}
      {notification && (
        <div className={`absolute top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 ${
          notification.type === 'success' ? 'bg-green-600' :
          notification.type === 'error' ? 'bg-red-600' : 'bg-cyan-600'
        }`}>
          {notification.type === 'success' ? <CheckCircle size={16} /> : 
           notification.type === 'error' ? <XCircle size={16} /> : <Loader size={16} />}
          <span className="text-sm text-white">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Stargate
            </h2>
            <p className="text-xs text-gray-500">AI Workforce + Compute for Cardano</p>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <XCircle size={20} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-2 border-b border-gray-800 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-cyan-600/20 text-cyan-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {activeTab === 'start' && renderStart()}
            {activeTab === 'marketplace' && renderMarketplace()}
            {activeTab === 'aims' && renderAims()}
            {activeTab === 'leaderboard' && renderLeaderboard()}
            {activeTab === 'training' && renderTraining()}
            {activeTab === 'packages' && renderPackages()}
            {activeTab === 'skills' && renderSkills()}
            {activeTab === 'compute' && renderCompute()}
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'stargate' && renderStargatePool()}
            {activeTab === 'nodes' && renderNodes()}
            {activeTab === 'asp' && renderAspGateway()}
          </>
        )}
      </div>

    </div>
  );
};

export default AdaPortalPanel;




