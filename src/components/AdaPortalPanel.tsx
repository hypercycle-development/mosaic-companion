// ============================================
// STARGATE - Main UI Panel
// AI Workforce + Compute + Intelligence Platform for Cardano
// ============================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

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
  stargatePoolService,
  NodeFactory,
  ANFEInfo
} from '../services/AdaPortal';
import type { AccessCheck, UserIntent, MarketplaceListing, LeaderboardEntry, TrainingListing, AgentPackage, ComputeNode, AIMInfo } from '../services/AdaPortal/types';

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
import { localNodeBridge } from '../services/LocalNodeBridge';
import type { BridgeANFE, BridgeComputeNode } from '../services/LocalNodeBridge';
import { enhancedLocalNodeBridge } from '../services/stargate/EnhancedLocalNodeBridge';
import type { ValidatorPoolStatus, ValidatorNode } from '../services/StargatePool';
import { skillMarketplace } from '../services/AdaPortal';
import { tasteSkillService } from '../services/TasteSkillService';
import { batteryOrgPool, BatteryPoolNode } from '../services/BatteryOrg';
import {
  NFTCollectionGrid,
  NFTAssetModal,
} from './NFTCollectionCards';
import type { ResolvedNFTAsset, ResolvedCollectionGroup } from '../services/AdaPortal/MetadataResolver';
import { metadataResolver } from '../services/AdaPortal/MetadataResolver';
import { aspGateway, AspPackage, Company, UsageRecord } from '../services/AspGateway';
// ===== P2: VAULT-BACKED ASP =====
import { secureAspGateway } from '../services/stargate/integrations';
import { stargateRegistry, type AgentProfile, type BundleConfig, type TrainingJob } from '../services/StargateSkillRegistry';
import { KanbanDashboard } from './KanbanDashboard';
import UnifiedAssetPanel from './UnifiedAssetPanel';
import TasteSkillDialPanel from './stargate/TasteSkillDialPanel';
import StargateSkillsMarketplacePanel from './stargate/StargateSkillsMarketplacePanel';
import NodeFactoryTrackerPanel from './stargate/NodeFactoryTrackerPanel';
import StargatePoolHub from './stargate/StargatePoolHub';
import StargateTelemetryCard from './stargate/StargateTelemetryCard';
import StargateCommunityAIMPanel from './stargate/StargateCommunityAIMPanel';
import MidnightCityCommandPanel from './stargate/MidnightCityCommandPanel';
import { cardanoWallet } from '../services/AdaPortal/CardanoWalletService';
import { OneAmWalletCard } from './stargate/OneAmWalletCard';
import { oneAmWallet } from '../services/OneAmWalletService';
import * as oneAmCli from '../services/OneAmCliService';
import { Users, Trophy, GraduationCap, Package, Cpu, Zap, Star, ArrowRight, Search, Filter, RefreshCw, TrendingUp, CheckCircle, XCircle, Loader, Rocket, TrendingUpIcon, Code, Bot, Workflow, Sparkles, Settings, CpuIcon, LayoutDashboard, Wallet, Key, Building2, FolderOutput, Network, Shield, Lock,  Unlock, Layers, Server, Plus, BookOpen, Download, Wand2, ImagePlus, Pickaxe, Info } from 'lucide-react';

// ---- Module-level helper: ensure wallet is on Base chain ----
async function ensureOnBaseChain(): Promise<void> {
  const state = walletAdapter.getState();
  if (!state.isConnected || state.chainId === 8453) return;
  try {
    console.log('[AdaPortal] Switching wallet from chain', state.chainId, 'to Base (8453)...');
    await walletAdapter.switchNetwork(8453);
    console.log('[AdaPortal] Wallet switched to Base');
  } catch (e) {
    console.warn('[AdaPortal] Failed to auto-switch to Base:', e);
    // Continue anyway — RPC fallback may work
  }
}

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

type TabId = 'start' | 'marketplace' | 'aims' | 'leaderboard' | 'training' | 'packages' | 'skills' | 'compute' | 'dashboard' | 'stargate' | 'midnight' | 'asp';
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
  tab: TabId;
}[] = [
  {
    id: 'launch_project',
    label: 'Hire Agents',
    description: 'Browse and hire AI agents from the marketplace to work on your projects',
    icon: <Users size={24} />,
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    tab: 'marketplace',
  },
  {
    id: 'grow_dao',
    label: 'AI Models',
    description: 'Explore AI models (AIMs) — deploy, manage, and scale intelligent compute',
    icon: <Bot size={24} />,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    tab: 'aims',
  },
  {
    id: 'rankings',
    label: 'Rankings',
    description: 'See top-performing agents, skills, and AI models across the network',
    icon: <Trophy size={24} />,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    tab: 'leaderboard',
  },
  {
    id: 'build_dapp',
    label: 'Train Agents',
    description: 'Train your agents with custom skills, data, and reinforcement learning',
    icon: <GraduationCap size={24} />,
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    tab: 'training',
  },
  {
    id: 'bundles',
    label: 'Bundles',
    description: 'Pre-packaged agent teams with skills — ready to deploy',
    icon: <Package size={24} />,
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    tab: 'packages',
  },
  {
    id: 'automate_workflows',
    label: 'Skills',
    description: 'Discover and install skills for your agents — reusable capabilities and tools',
    icon: <Zap size={24} />,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    tab: 'skills',
  },
  {
    id: 'compute_nodes',
    label: 'Compute & Nodes',
    description: 'Allocate compute power and manage HyperCycle nodes for your AI stack',
    icon: <Cpu size={24} />,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    tab: 'compute',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Overview of your AI workforce, compute usage, and network activity',
    icon: <LayoutDashboard size={24} />,
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
    tab: 'dashboard',
  },
  {
    id: 'stargate_pool',
    label: 'Stargate Pool',
    description: 'Manage your ANFE licenses and deploy agents to HyperCycle compute nodes',
    icon: <Zap size={24} />,
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    tab: 'stargate',
  },
  {
    id: 'deploy_system',
    label: 'Deploy System',
    description: 'Create and manage Application Service Providers (ASPs) for your organization',
    icon: <Building2 size={24} />,
    color: 'text-teal-400',
    bg: 'bg-teal-400/10',
    tab: 'asp',
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
  { id: 'compute', label: 'Compute & Nodes', icon: <Cpu size={18} /> },
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'stargate', label: 'Stargate Pool', icon: <Zap size={18} /> },
  { id: 'midnight', label: 'Midnight City', icon: <Pickaxe size={18} /> },
  { id: 'asp', label: 'Deploy System', icon: <Building2 size={18} /> }
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
    if (url.includes('/compute') || url.includes('/nodes')) return 'compute';
    if (url.includes('/bundles')) return 'packages';
    if (url.includes('/rankings')) return 'leaderboard';
    if (url.includes('/stargate')) return 'stargate';
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
  const [batteryOrgNodes, setBatteryOrgNodes] = useState<BatteryPoolNode[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<any | null>(null);
  const [tasteSkillImporting, setTasteSkillImporting] = useState(false);
  const [tasteSkillVaultBoxId, setTasteSkillVaultBoxId] = useState<string | null>(null);
  const [tasteSkillVaultEntries, setTasteSkillVaultEntries] = useState<VaultEntry[]>([]);
  const [selectedVaultEntry, setSelectedVaultEntry] = useState<VaultEntry | null>(null);
  const [showTasteSkillDetail, setShowTasteSkillDetail] = useState(false);
  const [skillSyncStatus, setSkillSyncStatus] = useState<{ syncing: boolean; result?: any }>({ syncing: false });
  const [selectedTrainer, setSelectedTrainer] = useState<TrainingListing | null>(null);
  const [selectedPackageItem, setSelectedPackageItem] = useState<AgentPackage | null>(null);
  const [aims, setAims] = useState<AIMInfo[]>([]);
  const [selectedIntent, setSelectedIntent] = useState<UserIntent | null>(null);
  const [selectedComputeTier, setSelectedComputeTier] = useState<ComputeTier | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning'; message: string} | null>(null);
  const [accessCheck, setAccessCheck] = useState<AccessCheck | null>(null);
  const [laceConnected, setLaceConnected] = useState(false);
  const [laceAddress, setLaceAddress] = useState<string | null>(null);
  const [isConnectingLace, setIsConnectingLace] = useState(false);
  const [cardanoAssets, setCardanoAssets] = useState<Array<{
    policyId: string;
    assetName: string;
    fingerprint: string;
    quantity: number;
    unit?: string;
  }> | null>(null);

  // 1AM Wallet State (Midnight Network)
  const [oneamConnected, setOneamConnected] = useState(false);
  const [oneamAddress, setOneamAddress] = useState<string | null>(null);
  const [oneamNetwork, setOneamNetwork] = useState<string | null>(null);
  const [oneamBalance, setOneamBalance] = useState<{
    lovelace: number;
    nightTokens: number;
    dustTokens: number;
    shieldedTokens: number;
    unshieldedTokens: number;
    cardanoAda: number;
    assets: any[];
  } | null>(null);
  const [oneamAddresses, setOneamAddresses] = useState<{
    shielded: string[];
    unshielded: string | null;
    dust: string | null;
    cardano: string | null;
  }>({ shielded: [], unshielded: null, dust: null, cardano: null });
  const [oneamTxHistory, setOneamTxHistory] = useState<any[]>([]);
  const [oneamAgentWallets, setOneamAgentWallets] = useState<any[]>([]);
  const [isConnectingOneam, setIsConnectingOneam] = useState(false);
  const [oneamAvailable, setOneamAvailable] = useState(false);

  // Resolved collection groups with metadata + infrastructure
  const [collectionGroups, setCollectionGroups] = useState<ResolvedCollectionGroup[]>([]);
  const [resolvingMetadata, setResolvingMetadata] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<ResolvedNFTAsset | null>(null);
  const [nftPolicyIds, setNftPolicyIds] = useState<string[]>([
    'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46', // HPEC DAO PASS
    '454fb57214730cb34f83d7b377308a76ab6e7140ea634a7fc63affa5', // CMHPEC DAO PASS
    'bc963a07e32da4d22b77c8cba7ab9f3df6241f37d7bfc9b0deb48f65', // HyperDegens
  ]);
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

  // Local Node Bridge (R2D2 directly — no wallet / blockchain needed)
  const [localNodeAvailable, setLocalNodeAvailable] = useState(false);
  const [localANFE, setLocalANFE] = useState<BridgeANFE | null>(null);

  // Validator Fleet telemetry (Battery / CometBFT via EnhancedLocalNodeBridge)
  const [validatorPool, setValidatorPool] = useState<ValidatorPoolStatus | null>(null);
  const [isLoadingValidators, setIsLoadingValidators] = useState(false);

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
  
  // Taste-Skill Service state
  const [tasteSkills, setTasteSkills] = useState<any[]>([]);
  const [isLoadingTasteSkills, setIsLoadingTasteSkills] = useState(false);
  const [tasteSkillError, setTasteSkillError] = useState<string | null>(null);

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

      // 2c. Load Battery Org boxes (new integration)
      try {
        const batteryResult = await batteryOrgPool.init();
        if (batteryResult.success) {
          const batteryNodes = batteryOrgPool.getNodes();
          setBatteryOrgNodes(batteryNodes);
          console.log('[AdaPortal] Loaded', batteryNodes.length, 'Battery Org boxes');
        } else {
          console.warn('[AdaPortal] Battery Org init failed:', batteryResult.error);
          setBatteryOrgNodes([]);
        }
      } catch (e: any) {
        console.warn('[AdaPortal] Battery Org load failed:', e);
        setBatteryOrgNodes([]);
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
      })) as any);

      // 4. Populate Training/Packages/Skills/Agents from StargateSkillRegistry
      const registryAgents = stargateRegistry.getAgents();
      const registryBundles = stargateRegistry.getBundles();
      const registrySkills = stargateRegistry.getSkills();
      const registryModels = stargateRegistry.getModels();
      const registryJobs = stargateRegistry.getTrainingJobs();

      // Populate marketplace listings from built-in agent profiles if empty
      if (listings.length === 0 && registryAgents.length > 0) {
        setListings(registryAgents.map(a => ({
          listingId: a.id,
          agentId: a.id,
          agentName: a.name,
          roles: [a.role.replace('_', ' ') as any],
          primarySkills: a.skills?.slice(0, 3) || ['ai-chat'],
          pricing: {
            model: 'per_task' as any,
            perTaskMin: a.hourlyRate || 0.5,
            perTaskMax: (a.hourlyRate || 0.5) * 5,
            perMinuteMin: 0.1,
            perMinuteMax: 1.0,
          },
          rating: a.rating || 0,
          successRate: a.tasksCompleted > 0 ? 0.95 : 0,
          availability: a.status === 'idle' ? 'available' : a.status === 'busy' ? 'busy' : 'offline',
          nodeSource: a.computeNode || 'local',
          chain: 'multi' as any,
          attachedSkills: a.skills || [],
          skillCount: a.skills?.length || 0,
        })));
      }

      // Populate training jobs
      setTrainingListings(registryJobs.map(j => ({
        listingId: j.id,
        trainerName: j.name || `${j.model} Training`,
        trainerId: j.id,
        description: `Training ${j.model} on ${j.dataset} — Status: ${j.status}`,
        specializations: [j.status, j.model],
        rating: j.status === 'completed' ? 5.0 : j.status === 'running' ? 4.0 : 0,
        pricePerSession: 0.0,
        model: j.model,
        dataset: j.dataset,
        progress: j.progress,
        status: j.status,
      })) as any);

      // Populate agent bundles
      setPackages(registryBundles.map(b => ({
        packageId: b.id,
        name: b.name,
        description: b.description,
        price: b.price,
        popular: b.popular || false,
        agents: b.agents.map((ag, idx) => ({
          agentId: `${b.id}-agent-${idx}`,
          name: ag.role,
          role: ag.role as any, // Map BundleConfig's role string to AgentRole
          included: true, // Required by PackageAgent interface
        })),
        computeAllocation: undefined, // Optional field, not in BundleConfig
      })) as any);

      // Populate skills marketplace
      setSkills(registrySkills.map(s => ({
        name: s.name,
        fullName: `${s.category}/${s.name}`,
        provider: s.category,
        category: s.category,
        installs: s.usageCount || 0,
        description: s.description,
        tags: s.tags,
        installed: s.installed,
      })));

      // Enrich AIMs with registry models if empty
      if (registryModels.length > 0) {
        const modelAims = registryModels.map(m => ({
          name: m.name,
          version: '1.0.0',
          description: `${m.provider} — ${m.status} — ${(m.capability || []).join(', ')}`,
          isActive: m.status === 'loaded',
          origin: m.provider,
          rank: m.status === 'loaded' ? 1 : 50,
          computeStrength: m.local ? 5 : 3,
          modelId: m.id,
        }));
        setAims(prev => {
          if (prev.length > 0) return prev;
          return modelAims;
        });
      }

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
            await ensureOnBaseChain();
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

  // Init guard — prevents duplicate initialization on remount / StrictMode
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    try {
      initializeAdaPortal();
      stargateRegistry.initialize();
      stargateRegistry.seedCommunityAIMs();
      loadData();
      loadUserAgents();
    } catch (e) {
      console.error('[AdaPortal] Initial load failed:', e);
    }
  }, []);

  // HyperCycle Node Manager local bridge — runs even without a wallet
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ok = await localNodeBridge.refresh();
        if (!mounted) return;
        setLocalNodeAvailable(ok);
        if (ok) {
          const anfe = localNodeBridge.getLocalANFE();
          const node = localNodeBridge.getLocalComputeNode();
          const hbox = localNodeBridge.getLocalHBoxNode();
          const aims = localNodeBridge.getLocalAIMs();
          if (anfe) {
            // Augment with flat .aims and .level for the UI card
            const enriched = { ...anfe, aims, level: 11 };
            setLocalANFE(enriched);
            // Merge into walletANFEs so Start + Stargate Pool tabs pick it up
            setWalletANFEs(prev => {
              const filtered = prev.filter(a => !(a as any).isLocal);
              return [...filtered, { ...(anfe as any), isLocal: true }];
            });
          }
          if (node) {
            setNodes(prev => {
              const filtered = prev.filter(n => n.nodeId !== node.nodeId);
              return [...filtered, node] as any;
            });
          }
          if (hbox) {
            setHboxNodes(prev => {
              const filtered = prev.filter((h: any) => h.nodeId !== hbox.nodeId);
              return [...filtered, hbox];
            });
          }
          console.log('[AdaPortal] LocalNodeBridge: node discovered — ANFE:', anfe?.license, '| compute:', node?.availableCompute, 'TFLOPS');
        }
      } catch (e) {
        console.warn('[AdaPortal] LocalNodeBridge failed:', e);
      }
    })();
    const timer = setInterval(() => {
      localNodeBridge.refresh().then(ok => {
        if (!mounted) return;
        setLocalNodeAvailable(ok);
      }).catch(() => {});
    }, 30000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  // 1AM Wallet — state managed via external browser bridge (Chrome + 1AM extension)
  // Bridge is opened on-demand when user clicks "Connect 1AM" — see onClick handler below

  // Enhanced Local Node Bridge — telemetry + Validator Fleet polling
  useEffect(() => {
    let mounted = true;
    const unsub = enhancedLocalNodeBridge.onUpdate((t) => {
      if (!mounted || !t?.validatorPool) return;
      setValidatorPool(t.validatorPool);
    });
    enhancedLocalNodeBridge.startPolling();
    return () => {
      mounted = false;
      unsub();
      enhancedLocalNodeBridge.stopPolling();
    };
  }, []);

  // Load Taste-Skills when Skills tab is active
  useEffect(() => {
    if (activeTab !== 'skills') return;
    
    let mounted = true;
    (async () => {
      try {
        setIsLoadingTasteSkills(true);
        setTasteSkillError(null);
        
        // Initialize the service first
        await tasteSkillService.initialize();
        
        // Load available Taste-Skills from Vault
        const skills = await tasteSkillService.getAvailableSkills();
        
        if (!mounted) return;
        setTasteSkills(skills);
        console.log(`[AdaPortal] Loaded ${skills.length} Taste-Skills from Vault`);
      } catch (e: any) {
        if (!mounted) return;
        console.error('[AdaPortal] Failed to load Taste-Skills:', e);
        setTasteSkillError(e.message || 'Failed to load Taste-Skills');
      } finally {
        if (mounted) setIsLoadingTasteSkills(false);
      }
    })();
    
    return () => { mounted = false; };
  }, [activeTab]);

  useEffect(() => {
    // Check access and update state - wrapped separately to not block UI
    try {
      accessControl.initialize().then(result => {
        setAccessCheck(result);
        if (result?.level && result.level !== 'none') {
          console.log('[AdaPortal] Access granted:', result.level, result.type);
        }
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
          
          // Ensure wallet is on Base chain so on-chain reads use the provider (not flaky RPC)
          await ensureOnBaseChain();
          
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
              setWalletANFEs(prev => {
                const localOnes = prev.filter((a: any) => a.isLocal);
                return [...localOnes, ...allANFEs];
              });
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
      
    })();
  }, []);

  // ---- LOCAL NODE BRIDGE: discover R2D2 on same host ----
  useEffect(() => {
    let isMounted = true;
    const unsub = localNodeBridge.onUpdate(() => {
      if (!isMounted) return;
      const avail = localNodeBridge.isAvailable();
      setLocalNodeAvailable(avail);
        if (avail) {
          const anfe = localNodeBridge.getLocalANFE();
          if (anfe) {
            setLocalANFE(anfe);
            // Merge local ANFE into walletANFEs so Start + Stargate Pool tabs show it
            setWalletANFEs((prev: any[]) => {
              const filtered = prev.filter((a: any) => !a.isLocal);
              return [...filtered, anfe];
            });
          }
        // Inject local node into nodes list
        const localNode = localNodeBridge.getLocalComputeNode();
        if (localNode) {
          setNodes((prev) => {
            const filtered = prev.filter((n) => n.platform !== 'local');
            return [...filtered, localNode as any];
          });
        }
        // Inject local HBox into hboxNodes
        const hbox = localNodeBridge.getLocalHBoxNode();
        if (hbox) {
          setHboxNodes((prev) => {
            const filtered = prev.filter((n: any) => n.nodeId !== hbox.nodeId);
            return [...filtered, hbox];
          });
        }
      }
    });
    localNodeBridge.startPolling();
    return () => {
      isMounted = false;
      unsub();
      localNodeBridge.stopPolling();
    };
  }, []);

  // Debounced leaderboard refresh — only refresh leaderboard data, NOT full wallet scan
  const leaderboardDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (leaderboardDebounceRef.current) clearTimeout(leaderboardDebounceRef.current);
    leaderboardDebounceRef.current = setTimeout(() => {
      // Only refresh HyperInsight leaderboard, skip ANFE/asset discovery
      (async () => {
        try {
          await hyperInsight.refreshData();
          const unifiedLb = hyperInsight.getUnifiedLeaderboard();
          setLeaderboardData(unifiedLb.map((e: any, i: number) => ({
            rank: i + 1,
            agentId: e.id,
            agentName: e.name,
            score: e.score,
            tasksCompleted: e.activeNodes || 0,
            earnings: e.computeTFLOPS || 0,
            avatar: e.type === 'aims' ? '🤖' : '🖥️',
            trend: 'stable' as const
          })) as any);
        } catch (e) {
          console.warn('[AdaPortal] Leaderboard refresh failed:', e);
        }
      })();
    }, 500);
    return () => {
      if (leaderboardDebounceRef.current) clearTimeout(leaderboardDebounceRef.current);
    };
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
    if (onSelectCompute) {
      onSelectCompute(tier);
    } else if (onNavigateToChat) {
      onNavigateToChat(`Allocate ${tier.replace('_', ' ')} compute resources`);
    }
    showNotification('success', `${tier.replace('_', ' ')} compute selected`);
  }, [onSelectCompute, onNavigateToChat]);

  const showNotification = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
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

      {/* ═══ 1AM Wallet Dashboard (Midnight Network) ═══ */}
      <OneAmWalletCard
        connected={oneamConnected}
        address={oneamAddress}
        network={oneamNetwork}
        balance={oneamBalance}
        addresses={oneamAddresses}
        txHistory={oneamTxHistory}
        agentWallets={oneamAgentWallets}
        isConnecting={isConnectingOneam}
        onConnect={async () => {
          setIsConnectingOneam(true);
          try {
            showNotification('info', 'Discovering 1AM CLI wallets...');
            const wallets = await oneAmCli.listWallets();
            if ('error' in wallets) {
              showNotification('error', wallets.error || 'Failed to list wallets');
              return;
            }
            if (wallets.length === 0) {
              showNotification('info', 'No wallets found. Creating default wallet via 1AM CLI...');
              const created = await oneAmCli.createAgentWallet('mosaic-default', {
                setDefault: true,
                insecurePlain: false,
              });
              if ('error' in created) {
                showNotification('error', created.error || 'Wallet creation failed');
                return;
              }
              const w = created.wallet;
              setOneamConnected(true);
              setOneamAddress(w.public?.unshielded?.mainnet || w.public?.unshielded?.preprod || null);
              setOneamNetwork('mainnet');
              setOneamBalance({
                lovelace: 0, nightTokens: 0, dustTokens: 0,
                shieldedTokens: 0, unshieldedTokens: 0, cardanoAda: 0, assets: [],
              });
              setOneamAddresses({
                shielded: w.public?.shielded?.mainnet ? [w.public.shielded.mainnet] : [],
                unshielded: w.public?.unshielded?.mainnet || null,
                dust: w.public?.dust?.mainnet || null,
                cardano: null,
              });
              showNotification('success', `Wallet '${w.name}' created! Use Sync to fetch balances.`);
              return;
            }
            // Use first wallet (or default if available)
            const w = wallets[0];
            setOneamConnected(true);
            setOneamAddress(w.public?.unshielded?.mainnet || w.public?.unshielded?.preprod || null);
            setOneamNetwork('mainnet');
            setOneamBalance({
              lovelace: 0, nightTokens: 0, dustTokens: 0,
              shieldedTokens: 0, unshieldedTokens: 0, cardanoAda: 0, assets: [],
            });
            setOneamAddresses({
              shielded: w.public?.shielded?.mainnet ? [w.public.shielded.mainnet] : [],
              unshielded: w.public?.unshielded?.mainnet || null,
              dust: w.public?.dust?.mainnet || null,
              cardano: null,
            });
            showNotification('success', `1AM wallet '${w.name}' loaded! Click Sync to fetch balances.`);
          } catch (e: any) {
            showNotification('error', e.message || '1AM CLI connection failed');
          } finally {
            setIsConnectingOneam(false);
          }
        }}
        onDisconnect={() => {
          oneAmWallet.disconnect();
          setOneamConnected(false);
          setOneamAddress(null);
          setOneamNetwork(null);
          setOneamBalance(null);
          setOneamAddresses({ shielded: [], unshielded: null, dust: null, cardano: null });
          setOneamTxHistory([]);
          setOneamAgentWallets([]);
          showNotification('info', '1AM Wallet disconnected');
        }}
        onGenerateDust={async () => {
          try {
            showNotification('info', 'Generating DUST...');
            const result = await oneAmWallet.generateDust();
            if (result.success) {
              showNotification('success', `DUST generated! +${result.dustAmount || 0} DUST`);
              // Refresh balance
              const data = await oneAmWallet.fetchWalletData();
              if (data.success) {
                const s = oneAmWallet.getSession();
                setOneamBalance(s.balance);
              }
            } else {
              showNotification('error', result.error || 'DUST generation failed');
            }
          } catch (e: any) {
            showNotification('error', e.message || 'DUST generation failed');
          }
        }}
        onSend={() => showNotification('info', 'Send feature — use 1AM extension for now')}
        onReceive={() => {
          if (oneamAddress || oneamAddresses.shielded.length || oneamAddresses.dust || oneamAddresses.cardano) {
            // The receive modal is rendered inside OneAmWalletCard.
          } else {
            showNotification('info', 'No receiving addresses available yet');
          }
        }}
        onYourDust={() => showNotification('info', `Your DUST: ${oneamBalance?.dustTokens?.toLocaleString() || 0}`)}
        onCreateAgentWallet={(agentId, agentName) => {
          oneAmWallet.createAgentWallet(agentId, agentName);
          setOneamAgentWallets(oneAmWallet.getAgentWallets());
        }}
        onSync={async () => {
          if (!oneamAddress) {
            showNotification('error', 'No wallet address to sync');
            return;
          }
          try {
            showNotification('info', 'Syncing wallet via 1AM CLI...');
            // Determine wallet name from state or use default
            const walletName = oneamAddress ? 'mosaic-default' : undefined;
            if (!walletName) return;
            const result = await oneAmCli.syncWallet(walletName, 'mainnet', { timeout: 300 });
            if ('error' in result) {
              showNotification('error', result.error || 'Sync failed');
              return;
            }
            const snap = result.snapshot;
            setOneamBalance({
              lovelace: snap.availableCoins || 0,
              nightTokens: snap.balances?.NIGHT || 0,
              dustTokens: snap.balances?.DUST || 0,
              shieldedTokens: 0,
              unshieldedTokens: snap.availableCoins || 0,
              cardanoAda: 0,
              assets: Object.entries(snap.balances || {}).map(([k, v]) => ({
                policyId: k,
                assetName: k,
                quantity: typeof v === 'number' ? v : 0,
              })),
            });
            showNotification('success', `Synced! Available coins: ${snap.availableCoins}`);
          } catch (e: any) {
            showNotification('error', e.message || 'Sync failed');
          }
        }}
        showNotification={showNotification}
      />

      {/* ═══ Legacy: Cardano / LACE Wallet (preserved, collapsible) ═══ */}
      {!oneamConnected && (
        <div className="p-3 rounded-xl bg-gradient-to-r from-purple-900/20 to-cyan-900/20 border border-purple-500/20 opacity-80 hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Key size={16} className="text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-white text-sm">Cardano (LACE)</h4>
                <p className="text-xs text-gray-400">Legacy NFT access via Cardano wallet</p>
              </div>
            </div>
            {laceConnected ? (
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-xs text-green-400">{laceAddress?.slice(0, 8)}...</span>
              </div>
            ) : (
              <button
                onClick={async () => {
                  setIsConnectingLace(true);
                  try {
                    const result = await cardanoWallet.connectWallet('lace');
                    if (result.success && result.session?.connected) {
                      setLaceConnected(true);
                      setLaceAddress(result.session.address);
                      showNotification('success', 'LACE wallet connected');
                    }
                  } catch (e: any) {
                    showNotification('error', e.message || 'LACE connection failed');
                  } finally {
                    setIsConnectingLace(false);
                  }
                }}
                disabled={isConnectingLace}
                className="px-2 py-1 rounded bg-purple-600/60 hover:bg-purple-500/60 text-white text-xs disabled:opacity-50"
              >
                {isConnectingLace ? '...' : 'LACE'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Cardano Wallet NFT Collection Cards ── */}
      {laceConnected && collectionGroups.length > 0 && (
        <NFTCollectionGrid
          groups={collectionGroups}
          onAssetClick={(asset) => setSelectedAsset(asset)}
          title="Cardano Collections"
        />
      )}

      {/* Fallback: show old simple cards if metadata resolver failed but assets exist */}
      {laceConnected && !resolvingMetadata && collectionGroups.length === 0 && cardanoAssets && cardanoAssets.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Layers size={18} className="text-blue-400" />
              Cardano Assets
              <span className="text-xs text-gray-500 ml-1">({cardanoAssets.length})</span>
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(() => {
              const byPolicy = new Map<string, typeof cardanoAssets>();
              for (const a of cardanoAssets!) {
                const list = byPolicy.get(a.policyId) || [];
                list.push(a);
                byPolicy.set(a.policyId, list);
              }
              return Array.from(byPolicy.entries()).map(([policyId, assets]) => {
                const matchedPolicy = nftPolicyIds.find(pid => pid === policyId);
                const collectionName = matchedPolicy
                  ? (policyId === 'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46' ? 'HPEC DAO PASS'
                    : policyId === '454fb57214730cb34f83d7b377308a76ab6e7140ea634a7fc63affa5' ? 'CMHPEC DAO PASS'
                    : policyId === 'bc963a07e32da4d22b77c8cba7ab9f3df6241f37d7bfc9b0deb48f65' ? 'HyperDegens'
                    : `Collection ${policyId.slice(0, 8)}...`)
                  : `Policy ${policyId.slice(0, 8)}...`;
                const isVerified = !!matchedPolicy;
                return (
                  <div
                    key={policyId}
                    className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 hover:border-blue-500/40 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center border bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/20">
                          <Layers size={24} className="text-blue-400" />
                        </div>
                        <div>
                          <h5 className="font-semibold text-white text-sm leading-tight">{collectionName}</h5>
                          <div className="text-xs text-gray-400 mt-0.5">cardano · {assets.length} NFT{assets.length > 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      {isVerified && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/20">
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1 pr-1 mb-3">
                      {assets.map((asset, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-gray-900/40">
                          <span className="text-gray-300 truncate" title={asset.assetName}>
                            {asset.assetName || `Asset #${idx + 1}`}
                          </span>
                          <span className="text-blue-400 font-mono ml-2 shrink-0">×{asset.quantity}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
                      <span className="text-xs text-gray-500">
                        Total: <span className="text-blue-400 font-medium">{assets.reduce((sum, a) => sum + a.quantity, 0)}</span> items
                      </span>
                      <a
                        href={`https://pool.pm/${policyId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                      >
                        View on pool.pm <ArrowRight size={10} />
                      </a>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Asset detail modal */}
      <NFTAssetModal
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
      />

      {/* Unified Multi-Chain Asset Panel — ETH + BASE */}
      <UnifiedAssetPanel
        walletAddress={ethAddress || (window.ethereum ? (window.ethereum as any).selectedAddress : null)}
        onConnectWallet={async () => {
          try {
            if (window.ethereum) {
              const accounts = await (window.ethereum as any).request({ method: 'eth_requestAccounts' });
              if (accounts?.[0]) {
                setEthAddress(accounts[0]);
                showNotification('success', 'Wallet connected: ' + accounts[0].slice(0, 6) + '...');
              }
            } else {
              showNotification('error', 'No MetaMask / EVM wallet detected');
            }
          } catch (e: any) {
            showNotification('error', e.message || 'Wallet connection failed');
          }
        }}
        showNotification={showNotification}
      />

      {/* Local HyperAIBox Node Card — always visible, no wallet needed */}
      {localNodeAvailable && localANFE && (
        <div className="p-5 rounded-xl bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-500/30 shadow-lg shadow-purple-500/10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-purple-500/20">
                <Server size={24} className="text-purple-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-base">HyperCycle Node</h4>
                <p className="text-xs text-purple-300/70">{localANFE.name || 'R2D2'} — Local HyperAIBox</p>
              </div>
            </div>
            <span className="text-[10px] px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/20">
              Local Node
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">ANFE License</div>
              <div className="text-sm font-medium text-white mt-0.5">#{localANFE.license}</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Level</div>
              <div className="text-sm font-medium text-cyan-400 mt-0.5">{localANFE.level || 11}</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Compute</div>
              <div className="text-sm font-medium text-green-400 mt-0.5">{localANFE.computeUnits || 'Standard'}</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Uptime</div>
              <div className="text-sm font-medium text-yellow-400 mt-0.5">{localANFE.status === 'active' ? 'Online' : 'Loading'}</div>
            </div>
          </div>

          {/* AIM Status */}
          {Array.isArray(localANFE.aims) && localANFE.aims.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {(localANFE.aims as any[]).slice(0, 4).map((aim, i) => (
                <span key={i} className={`text-[10px] px-2 py-1 rounded-full border ${
                  aim.status === 'running' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                  aim.status === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  'bg-gray-700/30 text-gray-400 border-gray-600/20'
                }`}>
                  {aim.name || aim.image_name || 'AIM'}{aim.slot !== undefined ? ` #${aim.slot}` : ''}
                </span>
              ))}
              {(localANFE.aims as any[]).length > 4 && (
                <span className="text-[10px] px-2 py-1 rounded-full bg-gray-700/30 text-gray-400 border border-gray-600/20">
                  +{(localANFE.aims as any[]).length - 4}
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('compute')}
            className="flex-1 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/20 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
          >
            <Cpu size={14} />
            Nodes
          </button>
            <button
              onClick={() => setActiveTab('stargate')}
              className="flex-1 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/20 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
            >
              <Zap size={14} />
              Stargate
            </button>
          </div>
        </div>
      )}

      {/* Intent Options Grid — Simplified for new users */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {INTENT_OPTIONS.map((intent) => (
          <button
            key={intent.id}
            onClick={() => {
              setSelectedIntent(intent.id);
              setActiveTab(intent.tab as TabId);
              // Intent buttons should navigate to the tab, not to chat
              // The user wants to explore the feature, not chat about it
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

      {/* Node Factory Tracker — CBNO Fleet Monitoring */}
      <NodeFactoryTrackerPanel />

      {/* Local HyperAIBox ANFE — always visible, no wallet needed */}
      {localANFE && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-violet-900/30 to-purple-900/30 border border-violet-500/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Zap size={20} className="text-violet-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{localANFE.name || `HyperAIBox #${localANFE.tokenId}`}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Local</span>
                  <span className="text-xs text-violet-400">{localANFE.chainName}</span>
                  {localANFE.verification?.status === 'online' && (
                    <span className="text-xs text-green-400">• Online</span>
                  )}
                </div>
              </div>
            </div>
            <span className="text-xs font-mono text-gray-400">#{localANFE.tokenId}</span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="p-2 bg-gray-900/40 rounded-lg text-center">
              <div className="text-xs text-gray-500">Compute</div>
              <div className="text-sm text-cyan-400 font-medium">{localANFE.computeUnits}</div>
            </div>
            <div className="p-2 bg-gray-900/40 rounded-lg text-center">
              <div className="text-xs text-gray-500">Uptime</div>
              <div className="text-sm text-green-400 font-medium">
                {((localANFE.verification?.uptime ?? 0) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="p-2 bg-gray-900/40 rounded-lg text-center">
              <div className="text-xs text-gray-500">AIMs</div>
              <div className="text-sm text-yellow-400 font-medium">
                {localANFE.attributes?.ai?.aiModules?.length ?? 0}
              </div>
            </div>
          </div>

          {/* Local AIM list */}
          {localANFE.attributes?.ai?.aiModules && localANFE.attributes.ai.aiModules.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {localANFE.attributes.ai.aiModules.slice(0, 4).map((aim: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-1.5 bg-gray-900/30 rounded-lg">
                  <Server size={12} className={
                    aim.value === 'running' ? 'text-green-400' :
                    aim.value === 'error' ? 'text-red-400' : 'text-yellow-400'
                  } />
                  <span className="text-xs text-white truncate">{aim.trait_type.replace(/^c_/, '')}</span>
                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                    aim.value === 'running' ? 'bg-green-500/20 text-green-400' :
                    aim.value === 'error' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {aim.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('compute')}
              className="flex-1 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg transition-colors"
            >
              View Node
            </button>
            <button
              onClick={() => setActiveTab('stargate')}
              className="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded-lg transition-colors"
            >
              Stargate Pool
            </button>
          </div>
        </div>
      )}

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
                    await ensureOnBaseChain();
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
                        {anfe.verification && anfe.verification.valid ? (
                          <>
                            <span className="flex items-center gap-1 text-xs text-green-400">
                              <CheckCircle size={12} />
                              Verified
                            </span>
                            {anfe.verification && anfe.verification.nodeFactoryId && (
                              <span className="text-xs text-gray-500 block">Node Factory: {anfe.verification.nodeFactoryId}</span>
                            )}
                            {anfe.verification && anfe.verification.tranche && (
                              <span className="text-xs text-cyan-400 block">Tranche: {anfe.verification.tranche}</span>
                            )}
                            {(anfe.verification && (anfe.verification.uptime !== undefined && anfe.verification.uptime !== null || anfe.verification.reliability !== undefined && anfe.verification.reliability !== null)) && (
                              <div className="flex gap-2 text-xs">
                                {anfe.verification && anfe.verification.uptime !== undefined && anfe.verification.uptime !== null && (
                                  <span className="text-gray-400">Uptime: {((anfe.verification.uptime ?? 0) * 100).toFixed(1)}%</span>
                                )}
                                {anfe.verification && anfe.verification.reliability !== undefined && anfe.verification.reliability !== null && (
                                  <span className="text-gray-400">Reliability: {((anfe.verification.reliability ?? 0) * 100).toFixed(1)}%</span>
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
                    {anfe.verification && anfe.verification.nodeFactoryId && (
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
                          {anfe.verification && anfe.verification.tranche && (
                            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                              Tranche {anfe.verification.tranche}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs">
                          {anfe.verification && anfe.verification.uptime !== undefined && anfe.verification.uptime !== null && (
                            <span className="text-gray-400">
                              Uptime: <span className="text-green-400">{((anfe.verification.uptime ?? 0) * 100).toFixed(1)}%</span>
                            </span>
                          )}
                          {anfe.verification && anfe.verification.reliability !== undefined && anfe.verification.reliability !== null && (
                            <span className="text-gray-400">
                              Reliability: <span className="text-cyan-400">{((anfe.verification.reliability ?? 0) * 100).toFixed(1)}%</span>
                            </span>
                          )}
                          {anfe.verification && anfe.verification.status && (
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
                  onKeyDown={(e) => { if (e.key === 'Enter') { const id = manualANFEId.trim(); if (!id) { showNotification('error', 'Please enter an ANFE ID'); return; } const manANFE: any = { id: `manual:${id}`, tokenId: id, contractAddress: '', owner: ethAddress || '', chainId: 1, chainName: 'Ethereum', blockNumber: 0, blockTimestamp: Date.now(), transactionHash: '', attributes: { core: { level: { trait_type: 'Level', value: 11 }, primaryLicense: { trait_type: 'License', value: 'standard' } }, ai: { aiModules: [] }, raw: [] }, verification: { valid: true, anfeId: id, nodeFactoryId: '', tranche: 'T3', uptime: 0.988, reliability: 0.995, status: 'online', lastUpdated: Date.now() } }; setWalletANFEs((prev: any) => [...prev, manANFE]); setShowManualANFE(false); setManualANFEId(''); showNotification('success', `Added ANFE ${id}`); } }}
                />
                <button
                  onClick={() => {
                    const id = manualANFEId.trim();
                    if (!id) { showNotification('error', 'Please enter an ANFE ID'); return; }
                    const manANFE: any = { id: `manual:${id}`, tokenId: id, contractAddress: '', owner: ethAddress || '', chainId: 1, chainName: 'Ethereum', blockNumber: 0, blockTimestamp: Date.now(), transactionHash: '', attributes: { core: { level: { trait_type: 'Level', value: 11 }, primaryLicense: { trait_type: 'License', value: 'standard' } }, ai: { aiModules: [] }, raw: [] }, verification: { valid: true, anfeId: id, nodeFactoryId: '', tranche: 'T3', uptime: 0.988, reliability: 0.995, status: 'online', lastUpdated: Date.now() } };
                    setWalletANFEs((prev: any) => [...prev, manANFE]);
                    setShowManualANFE(false);
                    setManualANFEId('');
                    showNotification('success', `Added ANFE ${id}`);
                  }}
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
                                {nft.verification && nft.verification.valid && (
                                  <span className="text-xs px-1.5 py-0.5 bg-green-500/20 rounded text-green-400">Verified</span>
                                )}
                              </div>
                              {nft.verification && nft.verification.status && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  nft.verification.status === 'online' || nft.verification.status === ('alive' as any)
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
                              {nft.verification && nft.verification.nodeFactoryId && (
                                <p className="text-gray-400">Node Factory: <span className="text-white">{nft.verification.nodeFactoryId}</span></p>
                              )}
                              {nft.verification && nft.verification.tranche && (
                                <p className="text-cyan-400">Tranche: {nft.verification.tranche}</p>
                              )}
                              {nft.verification && nft.verification.uptime !== undefined && nft.verification.uptime !== null && (
                                <p className="text-gray-400">Uptime: <span className="text-green-400">{((nft.verification.uptime ?? 0) * 100).toFixed(1)}%</span></p>
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
                                {nft.verification && nft.verification.valid && (
                                  <span className="text-xs px-1.5 py-0.5 bg-green-500/20 rounded text-green-400">Verified</span>
                                )}
                              </div>
                              {nft.verification && nft.verification.status && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  nft.verification.status === 'online' || nft.verification.status === ('alive' as any)
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
                              {nft.verification && nft.verification.nodeFactoryId && (
                                <p className="text-gray-400">Node Factory: <span className="text-white">{nft.verification.nodeFactoryId}</span></p>
                              )}
                              {nft.verification && nft.verification.tranche && (
                                <p className="text-cyan-400">Tranche: {nft.verification.tranche}</p>
                              )}
                              {nft.verification && nft.verification.uptime !== undefined && nft.verification.uptime !== null && (
                                <p className="text-gray-400">Uptime: <span className="text-green-400">{((nft.verification.uptime ?? 0) * 100).toFixed(1)}%</span></p>
                              )}
                              {nft.verification && nft.verification.reliability !== undefined && nft.verification.reliability !== null && (
                                <p className="text-gray-400">Reliability: <span className="text-cyan-400">{((nft.verification.reliability ?? 0) * 100).toFixed(1)}%</span></p>
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
                    await ensureOnBaseChain();
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
                    await ensureOnBaseChain();
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

  // ============== DASHBOARD TAB ==============
  const renderDashboard = () => {
    const stats = skillMarketplace.getStats();
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Intelligence Dashboard</h3>
            <p className="text-sm text-gray-400 mt-0.5">Overview of your AI workforce, compute, and network activity.</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
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
        <div>
          <h3 className="text-lg font-semibold text-white">Hire AI Agents</h3>
          <p className="text-sm text-gray-400 mt-0.5">Browse the marketplace and hire specialized AI agents for your projects.</p>
        </div>
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
                    {(listing.rating ?? 0).toFixed(1)}
                  </span>
                  <span>{(listing.successRate ?? 0) * 100}% success</span>
                  <span className="capitalize">{listing.availability ?? 'unknown'}</span>
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
          <div>
            <h3 className="text-lg font-semibold text-white">Rankings</h3>
            <p className="text-sm text-gray-400 mt-0.5">See top-performing agents, skills, and AI models across the network.</p>
          </div>
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
        <div>
          <h3 className="text-lg font-semibold text-white">Train Your Agents</h3>
          <p className="text-sm text-gray-400 mt-0.5">Find trainers and improve your agents with custom skills and data.</p>
        </div>
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
          <div
            key={listing.listingId}
            onClick={() => setSelectedTrainer(selectedTrainer?.listingId === listing.listingId ? null : listing)}
            className={`bg-gray-800/50 rounded-lg p-4 border transition-colors cursor-pointer ${
              selectedTrainer?.listingId === listing.listingId
                ? 'border-purple-500 bg-purple-900/10'
                : 'border-gray-700 hover:border-purple-500/30'
            }`}
          >
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
                  <span>{(listing.rating ?? 0).toFixed(1)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-400">${listing.pricePerSession}</div>
                <div className="text-xs text-gray-500">per session</div>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTrainer(listing);
                setAgentSelectMode('train');
                setShowAgentSelectModal(true);
              }}
              disabled={!selectedTrainer || selectedTrainer.listingId !== listing.listingId}
              className="mt-3 w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
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
        <div>
          <h3 className="text-lg font-semibold text-white">Agent Bundles</h3>
          <p className="text-sm text-gray-400 mt-0.5">Pre-packaged agent teams with skills — ready to deploy.</p>
        </div>
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
          <div>
            <h3 className="text-lg font-semibold text-white">Skills Marketplace</h3>
            <p className="text-sm text-gray-400 mt-0.5">Discover and install reusable capabilities for your agents.</p>
          </div>
          <div className="flex items-center gap-2">
            {userAgents.length > 0 && (
              <>
                <button
                  onClick={async () => {
                    if (tasteSkillImporting) return;
                    setTasteSkillImporting(true);
                    try {
                      // 1. Check if Taste-Skills box exists in vault
                      const boxes = await window.electronAPI.vault.getBoxes();
                      let box = boxes.find((b: any) => b.name?.toLowerCase() === 'taste-skills');
                      if (!box) {
                        const newBox = await window.electronAPI.vault.addBox({
                          name: 'Taste-Skills',
                          description: 'Taste-Skill format skills from Leonxlnx/taste-skill'
                        });
                        box = newBox.success ? newBox.box : undefined;
                        if (box) setTasteSkillVaultBoxId(box.id);
                      } else {
                        setTasteSkillVaultBoxId(box.id);
                      }
                      if (!box?.id) throw new Error('Failed to create Taste-Skills vault box');

                      // 2. Import all Taste-Skills from GitHub
                      const { importTasteSkills } = await import('../services/tasteSkillImport');
                      const result = await importTasteSkills(
                        async (boxId: string, entry: any) => {
                          const r = await window.electronAPI.vault.addEntry(boxId, entry);
                          return r?.entry || null;
                        },
                        { boxId: box.id }
                      );

                      showNotification(
                        result.failed === 0 ? 'success' : 'warning',
                        `Taste-Skills imported: ${result.imported} skills loaded, ${result.failed} failed`
                      );

                      // 3. Refresh skill registry
                      skillMarketplace.refreshSkills();
                    } catch (e: any) {
                      console.error('[TasteSkillImport] Error:', e);
                      showNotification('error', `Import failed: ${e.message}`);
                    } finally {
                      setTasteSkillImporting(false);
                    }
                  }}
                  disabled={tasteSkillImporting}
                  className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {tasteSkillImporting ? (
                    <Loader size={12} className="animate-spin" />
                  ) : (
                    <Download size={12} />
                  )}
                  {tasteSkillImporting ? 'Importing...' : 'Import Taste-Skills'}
                </button>
                {/* Import Krea Skill */}
                <button
                  onClick={async () => {
                    try {
                      const { importKreaSkillToVault } = await import('../services/kreaSkillImport');
                      const result = await importKreaSkillToVault();
                      showNotification(
                        result.success ? 'success' : 'warning',
                        result.success
                          ? `Krea skill imported${result.error ? ` (${result.error})` : ''}`
                          : `Krea import failed: ${result.error}`
                      );
                      if (result.success) {
                        // Refresh to show new entry
                        const boxes = await window.electronAPI.vault.getBoxes();
                        const box = boxes.find((b: any) => b.name === 'Taste-Skills');
                        if (box) {
                          const entries = await window.electronAPI.vault.getBoxContent(box.id);
                          setTasteSkillVaultEntries(entries);
                          setTasteSkillVaultBoxId(box.id);
                        }
                      }
                    } catch (e: any) {
                      showNotification('error', `Krea import: ${e.message}`);
                    }
                  }}
                  className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Wand2 size={12} />
                  Import Krea
                </button>
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
                <button
                  onClick={async () => {
                    if (!selectedSkill) {
                      showNotification('info', 'Select a skill first, then click Learn & Save');
                      return;
                    }
                    try {
                      // 1. Check if Skills box exists in vault
                      const boxes = await window.electronAPI.vault.getBoxes();
                      let skillsBox = boxes.find((b: any) => b.name?.toLowerCase() === 'skills');
                      if (!skillsBox) {
                        const newBox = await window.electronAPI.vault.addBox({ name: 'Skills', description: 'Learned agent skills' });
                        skillsBox = newBox.success ? newBox.box : undefined;
                      }
                      // 2. Add skill content to vault
                      await window.electronAPI.vault.addEntry(skillsBox.id, {
                        label: selectedSkill.name,
                        content: selectedSkill.description || `Skill: ${selectedSkill.name}`,
                      });
                      showNotification('success', `Learned "${selectedSkill.name}" — saved to Vault Skills box`);
                    } catch (e: any) {
                      showNotification('error', `Failed to save skill: ${e.message}`);
                    }
                  }}
                  className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-1"
                >
                  <BookOpen size={12} />
                  {selectedSkill ? `Learn: ${selectedSkill.name}` : 'Learn & Save'}
                </button>
              </>
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

        {/* Skill Sync Status */}
        {skillSyncStatus.syncing && (
          <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-3 flex items-center gap-3">
            <Loader size={16} className="text-cyan-400 animate-spin" />
            <span className="text-sm text-cyan-400">Syncing skills to fleet node...</span>
          </div>
        )}
        {skillSyncStatus.result && !skillSyncStatus.syncing && (
          <div className={`border rounded-lg p-3 ${skillSyncStatus.result.success ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
            <div className="text-sm font-medium">
              {skillSyncStatus.result.success ? (
                <span className="text-green-400">✓ Skills activated: {skillSyncStatus.result.activated?.join(', ') || 'none'}</span>
              ) : (
                <span className="text-red-400">✗ Skill sync failed</span>
              )}
            </div>
            {skillSyncStatus.result.logs?.length > 0 && (
              <div className="text-xs text-gray-500 mt-1 max-h-24 overflow-y-auto">
                {skillSyncStatus.result.logs.slice(-5).map((l: string, i: number) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected Skill Actions */}
        {selectedSkill && (
          <div className="bg-gray-800/80 border border-cyan-500/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">{selectedSkill.name}</p>
                <p className="text-xs text-gray-400">{selectedSkill.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!window.electronAPI?.skills?.syncToNode) {
                      showNotification('error', 'Skill sync not available — check Electron bridge');
                      return;
                    }
                    setSkillSyncStatus({ syncing: true });
                    try {
                      const result = await window.electronAPI.skills.syncToNode({
                        skillNames: [selectedSkill.name],
                        nodeId: 'r2d2',  // Default fleet node; user should select
                      });
                      setSkillSyncStatus({ syncing: false, result });
                      showNotification(
                        result.success ? 'success' : 'error',
                        result.success
                          ? `Activated: ${result.activated?.join(', ')}`
                          : `Failed: ${result.failed?.join(', ')}`
                      );
                    } catch (e: any) {
                      setSkillSyncStatus({ syncing: false, result: { success: false, logs: [e.message] } });
                      showNotification('error', `Sync error: ${e.message}`);
                    }
                  }}
                  disabled={skillSyncStatus.syncing}
                  className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Zap size={12} className="inline mr-1" />
                  Deploy to Node
                </button>
                <button
                  onClick={() => setSelectedSkill(null)}
                  className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <XCircle size={14} className="text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {skills.slice(0, 20).map((skill: any) => (
            <div
              key={skill.name}
              onClick={() => setSelectedSkill(selectedSkill?.name === skill.name ? null : skill)}
              className={`bg-gray-800/50 rounded-lg p-3 border transition-colors cursor-pointer ${
                selectedSkill?.name === skill.name
                  ? 'border-cyan-500 bg-cyan-900/10'
                  : 'border-gray-700 hover:border-cyan-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-white font-medium">{skill.name}</p>
                <span className="text-xs text-cyan-400">{skill.installs.toLocaleString()} ⚡</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{skill.category} • {skill.provider}</p>
              {selectedSkill?.name === skill.name && (
                <p className="text-xs text-cyan-400 mt-1">Click "Deploy to Node" to sync this skill to fleet</p>
              )}
            </div>
          ))}
        </div>

        {/* ─── Taste-Skills Vault Section ─── */}
        {tasteSkillVaultBoxId && (
          <div className="mt-6 border-t border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-indigo-400">Taste-Skills Vault</h4>
              <button
                onClick={async () => {
                  try {
                    const entries = await window.electronAPI.vault.getBoxContent(tasteSkillVaultBoxId);
                    setTasteSkillVaultEntries(entries || []);
                  } catch (e) {
                    showNotification('error', 'Failed to load Taste-Skills vault');
                  }
                }}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Refresh
              </button>
            </div>

            {tasteSkillVaultEntries.length === 0 && (
              <p className="text-xs text-gray-500">No Taste-Skills imported yet. Click "Import Taste-Skills" above.</p>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {tasteSkillVaultEntries.map((entry: VaultEntry) => (
                <div
                  key={entry.id}
                  onClick={() => {
                    setSelectedVaultEntry(entry);
                    setShowTasteSkillDetail(true);
                  }}
                  className={`bg-gray-800/50 rounded-lg p-3 border transition-colors cursor-pointer ${
                    selectedVaultEntry?.id === entry.id
                      ? 'border-indigo-500 bg-indigo-900/10'
                      : 'border-gray-700 hover:border-indigo-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white font-medium">{entry.label || entry.metadata?.installName || 'Untitled'}</p>
                    {entry.metadata?.isTasteSkill && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-indigo-900/40 border border-indigo-500/30 rounded text-indigo-300">
                        TASTE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {entry.metadata?.category || 'design'} • {entry.metadata?.outputType || 'code'}
                  </p>
                  {entry.metadata?.dials && (
                    <div className="flex gap-2 mt-2 text-[10px] text-gray-500 font-mono">
                      <span className="text-purple-400">V{entry.metadata.dials.designVariance}</span>
                      <span className="text-blue-400">M{entry.metadata.dials.motionIntensity}</span>
                      <span className="text-green-400">D{entry.metadata.dials.visualDensity}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Dial Detail Panel */}
            {showTasteSkillDetail && selectedVaultEntry && selectedVaultEntry.metadata?.isTasteSkill && (
              <div className="mt-4 bg-gray-900/80 border border-indigo-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white">{selectedVaultEntry.label} — Dial Adjustments</h4>
                  <button
                    onClick={() => setShowTasteSkillDetail(false)}
                    className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <XCircle size={14} className="text-gray-400" />
                  </button>
                </div>

                <TasteSkillDialPanel
                  initialDials={selectedVaultEntry.metadata.dials as any}
                  onChange={async (dials) => {
                    try {
                      await window.electronAPI.vault.updateEntry(tasteSkillVaultBoxId, selectedVaultEntry.id, {
                        metadata: {
                          ...selectedVaultEntry.metadata,
                          dials,
                        },
                      });
                      // Update local state
                      setSelectedVaultEntry({
                        ...selectedVaultEntry,
                        metadata: { ...selectedVaultEntry.metadata, dials },
                      });
                      showNotification('success', 'Dials saved to Vault');
                    } catch (e: any) {
                      showNotification('error', `Failed to save dials: ${e.message}`);
                    }
                  }}
                />

                {/* Preset Auto-Detection */}
                <div className="mt-3 flex gap-2 items-center">
                  <button
                    onClick={async () => {
                      try {
                        const { detectPreset } = await import('../services/tasteSkillPresetDetector');
                        const detected = detectPreset(
                          `${selectedVaultEntry.label} ${selectedVaultEntry.description || ''}`
                        );
                        if (detected && detected.confidence > 0.3) {
                          const newDials = {
                            designVariance: detected.dials.designVariance,
                            motionIntensity: detected.dials.motionIntensity,
                            visualDensity: detected.dials.visualDensity,
                          };
                          await window.electronAPI.vault.updateEntry(tasteSkillVaultBoxId, selectedVaultEntry.id, {
                            metadata: {
                              ...selectedVaultEntry.metadata,
                              dials: newDials,
                              lastPreset: detected.presetName,
                            },
                          });
                          setSelectedVaultEntry({
                            ...selectedVaultEntry,
                            metadata: {
                              ...selectedVaultEntry.metadata,
                              dials: newDials,
                              lastPreset: detected.presetName,
                            },
                          });
                          showNotification(
                            'success',
                            `Auto-detected preset: ${detected.presetName} (${detected.matchedSignals.slice(0, 3).join(', ')})`
                          );
                        } else {
                          showNotification('info', 'No strong preset signals detected');
                        }
                      } catch (e: any) {
                        showNotification('error', `Preset detection failed: ${e.message}`);
                      }
                    }}
                    className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Sparkles size={12} />
                    Auto-Detect Preset
                  </button>
                  {selectedVaultEntry.metadata?.lastPreset && (
                    <span className="text-[10px] text-gray-500">
                      Last: {selectedVaultEntry.metadata.lastPreset}
                    </span>
                  )}
                </div>

                {/* Krea Generation (for image-gen skills) */}
                {selectedVaultEntry.metadata?.outputType === 'images' && (
                  <div className="mt-3 p-3 bg-purple-900/20 border border-purple-500/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Wand2 size={14} className="text-purple-400" />
                      <span className="text-xs font-medium text-purple-300">Krea AI Image Generation</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const { kreaParamsFromPreset } = await import('../services/tasteSkillPresetDetector');
                            const presetName = selectedVaultEntry.metadata?.lastPreset || 'exploratory-creative';
                            const kreaParams = kreaParamsFromPreset(
                              presetName,
                              selectedVaultEntry.label || ''
                            );
                            const result = await (window as any).electronAPI?.krea?.generate?.({
                              prompt: selectedVaultEntry.description || selectedVaultEntry.label || '',
                              creativity: kreaParams.creativity,
                              aspectRatio: kreaParams.aspectRatio,
                              numImages: kreaParams.numImages,
                            });
                            showNotification(
                              result?.success ? 'success' : 'error',
                              result?.success
                                ? `Krea generated ${result.images?.length || 0} image(s)`
                                : result?.error || 'Krea generation failed'
                            );
                          } catch (e: any) {
                            showNotification('error', `Krea: ${e.message}`);
                          }
                        }}
                        className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <ImagePlus size={12} />
                        Generate Image
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        // Attach to selected agent with current dials
                        if (!selectedSkill) {
                          showNotification('info', 'Select a local skill first, then attach with dials');
                          return;
                        }
                        const result = await (window as any).electronAPI?.skills?.buildSystemPrompt?.({
                          baseSystemPrompt: '',
                          skillNames: [selectedVaultEntry.metadata?.installName || selectedVaultEntry.label || ''],
                          dialOverrides: selectedVaultEntry.metadata?.dials,
                        });
                        showNotification(
                          result?.loadedSkills?.length > 0 ? 'success' : 'error',
                          result?.loadedSkills?.length > 0
                            ? `Attached with dials: ${result.loadedSkills.join(', ')}`
                            : 'Failed to attach skill with dials'
                        );
                      } catch (e: any) {
                        showNotification('error', e.message);
                      }
                    }}
                    className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Zap size={12} />
                    Attach with Dials
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── PROVIDER DEFINITIONS (Coming Soon — awaiting API keys) ──
  const providerCatalog = [
    {
      id: 'compute-portal',
      name: 'ComputePortal',
      tagline: 'GPU & VPS instances on-demand',
      categories: ['GPU Compute', 'VPS', 'Storage'],
      status: 'coming_soon' as const,
      websiteUrl: 'https://computeportal.io',
      iconColor: 'text-orange-400',
      borderColor: 'border-orange-500/20',
      bgColor: 'bg-orange-500/10',
    },
    {
      id: 'battery-coin',
      name: 'BatteryCoin',
      tagline: 'Decentralized compute marketplace',
      categories: ['Peer-to-Peer', 'GPU', 'Storage'],
      status: 'coming_soon' as const,
      websiteUrl: '#',
      iconColor: 'text-yellow-400',
      borderColor: 'border-yellow-500/20',
      bgColor: 'bg-yellow-500/10',
    },
    {
      id: 'stargate-pool',
      name: 'Stargate Pool',
      tagline: 'Community compute — your appliances + pooled nodes',
      categories: ['Community', 'HyperAIBox', 'ANFE'],
      status: 'active' as const,
      websiteUrl: '#',
      iconColor: 'text-cyan-400',
      borderColor: 'border-cyan-500/20',
      bgColor: 'bg-cyan-500/10',
    },
  ];

  const renderCompute = () => (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Compute Marketplace</h3>
          <p className="text-sm text-gray-400 mt-0.5">Rent compute from providers or use your own appliances.</p>
        </div>
        <button
          onClick={() => onNavigateToChat?.('I need compute resources for my agents')}
          className="px-3 py-1 text-sm bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors"
        >
          Allocate Compute
        </button>
      </div>

      {/* ── My Compute Stats (Real Data) ── */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-cyan-400">{nodes.length + hboxNodes.length + batteryOrgNodes.length}</div>
          <div className="text-sm text-gray-400">Total Nodes</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-green-400">
            {nodes.filter(n => n.status === 'online').length + hboxNodes.filter((h: any) => h.status === 'online').length + batteryOrgNodes.filter(b => b.status === 'online').length}
          </div>
          <div className="text-sm text-gray-400">Online</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-yellow-400">
            {nodes.filter(n => n.reliability >= 0.9).length + batteryOrgNodes.filter(b => b.tflops > 200).length}
          </div>
          <div className="text-sm text-gray-400">Reliable (90%+)</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-purple-400">
            {nodes.reduce((sum, n) => sum + n.availableCompute, 0) + batteryOrgNodes.reduce((sum, b) => sum + b.tflops, 0)}
          </div>
          <div className="text-sm text-gray-400">Available Units</div>
        </div>
      </div>

      {/* ── Provider Catalog (Architecture UX — Coming Soon) ── */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-3 uppercase tracking-wider">Providers</h4>
        <div className="grid gap-3">
          {providerCatalog.map((provider) => (
            <div
              key={provider.id}
              className={`relative rounded-xl border ${provider.borderColor} ${provider.bgColor} p-4 transition-all`}
            >
              {/* Coming Soon Overlay */}
              {provider.status === 'coming_soon' && (
                <div className="absolute inset-0 rounded-xl bg-gray-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center z-10">
                  <span className="text-xs font-semibold text-amber-400 bg-amber-500/20 border border-amber-500/30 px-3 py-1 rounded-full mb-2">
                    Coming Soon
                  </span>
                  <p className="text-xs text-gray-400">Awaiting API integration</p>
                </div>
              )}

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${provider.bgColor} border ${provider.borderColor} flex items-center justify-center`}>
                    <Server size={20} className={provider.iconColor} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white">{provider.name}</h4>
                      {provider.status === 'active' && (
                        <span className="text-[10px] font-medium text-green-400 bg-green-500/20 border border-green-500/30 px-1.5 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{provider.tagline}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {provider.categories.map((cat) => (
                        <span
                          key={cat}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400 border border-gray-600/30"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {provider.status === 'coming_soon' ? (
                    <button
                      disabled
                      className="px-3 py-1.5 text-xs bg-gray-700/50 text-gray-500 rounded-lg cursor-not-allowed border border-gray-600/30"
                    >
                      Book
                    </button>
                  ) : (
                    <button
                      onClick={() => onNavigateToChat?.(`I want to use ${provider.name} compute`)}
                      className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                    >
                      Book
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Architecture Note ── */}
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-2">
        <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-300">
          <strong>Architecture:</strong> Providers will be plugged in via adapter pattern
          (<code className="text-blue-200">ComputeProviderAdapter</code>). Each provider exposes
          a unified interface: <code className="text-blue-200">listCatalog()</code>,{' '}
          <code className="text-blue-200">getPricing()</code>, <code className="text-blue-200">provision()</code>.
          Affiliate commissions are tracked per booking via referral codes.
        </p>
      </div>
    </div>
  );

  const renderNodes = () => {
    const allNodes = [
      ...nodes.map((n) => ({ ...n, _source: 'hyperinsight' as const })),
      ...hboxNodes.map((n) => ({ ...n, _source: 'hyperaibox' as const })),
      ...batteryOrgNodes.map((n) => ({ ...n, _source: 'batteryorg' as const })),
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Compute Nodes</h3>
            <p className="text-sm text-gray-400 mt-0.5">View and manage HyperCycle compute nodes available to run your AI stack.</p>
          </div>
          <div className="flex items-center gap-2">
            {hboxNodes.length > 0 && (
              <span className="text-xs px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-full">
                {hboxNodes.length} HBox{hboxNodes.length !== 1 ? 'es' : ''}
              </span>
            )}
            {batteryOrgNodes.length > 0 && (
              <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                {batteryOrgNodes.length} Battery Box{batteryOrgNodes.length !== 1 ? 'es' : ''}
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
                        Uptime: {((node.uptime ?? 0) * 100).toFixed(1)}% | Reliability: {((node.reliability ?? 0) * 100).toFixed(0)}%
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

            {/* Section header for Battery Org nodes */}
            {batteryOrgNodes.length > 0 && (
              <div className="mb-2">
                <h4 className="text-xs font-medium text-green-400 uppercase tracking-wider mb-2">Battery Org Compute</h4>
                {batteryOrgNodes.map((node: BatteryPoolNode) => (
                  <div key={node.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-green-500/20">
                    <div className={`w-3 h-3 rounded-full ${node.isAvailable && node.status === 'online' ? 'bg-green-500' : node.status === 'maintenance' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                    <div className="flex-1">
                      <div className="font-mono text-sm text-white">{node.name}</div>
                      <div className="text-xs text-gray-500">
                        {node.location.region} | {node.gpuCount}x {node.gpuModel} | {node.energySource} energy
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-2">
                        <div className="text-sm text-white">{node.tflops} TFLOPS</div>
                        <div className="text-xs text-gray-500">${node.pricePerHourUsd}/hr</div>
                      </div>
                      {node.isAvailable ? (
                        <button
                          onClick={() => {
                            showNotification('success', `Selected ${node.name} for compute`);
                            // In future: trigger job submission to this Battery Box
                          }}
                          className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded flex items-center gap-1"
                        >
                          <Rocket size={10} /> Use
                        </button>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded">{node.status}</span>
                      )}
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
    // Use React state (ethAddress) — always in sync with UI — not stale service field
    const walletAddress = ethAddress;

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
      {/* ── Pool Hub (Selector + Detail) ── */}
      <StargatePoolHub />

        {/* ── Wallet Header ── */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center border border-yellow-500/20">
                <Wallet size={20} className="text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Stargate Pool</h3>
                <p className="text-sm text-gray-400 mt-0.5">Manage your ANFE licenses and deploy agents to HyperCycle compute nodes.</p>
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
                        await ensureOnBaseChain();
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

        {/* Unified Multi-Chain Asset Panel — ETH + BASE */}
        <UnifiedAssetPanel
          walletAddress={ethAddress}
          onConnectWallet={async () => {
            try {
              if (window.ethereum) {
                const accounts = await (window.ethereum as any).request({ method: 'eth_requestAccounts' });
                if (accounts?.[0]) {
                  setEthAddress(accounts[0]);
                  showNotification('success', 'Wallet connected: ' + accounts[0].slice(0, 6) + '...');
                }
              } else {
                showNotification('error', 'No MetaMask / EVM wallet detected');
              }
            } catch (e: any) {
              showNotification('error', e.message || 'Wallet connection failed');
            }
          }}
          showNotification={showNotification}
        />

        {/* ── ANFE Card Gallery ── */}
        {(walletAddress || walletANFEs.length > 0) && (
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
                <p className="text-gray-400 font-medium">No ANFEs found{walletAddress ? ' for this wallet' : ''}</p>
                <p className="text-xs text-gray-600 mt-1">{walletAddress ? 'Hold ANFE NFTs to see them here' : 'Connect wallet or wait for local node to appear'}</p>
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
          <div>
            <h3 className="text-lg font-semibold text-white">Deploy System</h3>
            <p className="text-sm text-gray-400 mt-0.5">Create and manage Application Service Providers (ASPs) for your organization.</p>
          </div>
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
    function handleAddManualANFE() {
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
        owner: ethAddress || '',
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

    const handleAgentConfirmed = async (agent: any, anfe: ANFE | null) => {
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
        case 'train': {
          const skillName = selectedSkill?.name || (selectedTrainer?.listingId ? selectedTrainer.listingId.split('-').pop() : 'general');
          showNotification('info', `Deploying ${agent.name} to training room for "${skillName}"...`);
          try {
            const { deployAgentToTrainingRoom } = await import(
              /* webpackChunkName: "training-deployer" */ '../services/stargate/TrainingRoomDeployer'
            );
            const result = await deployAgentToTrainingRoom(agent.id, agent.name, skillName);
            if (result.success) {
              showNotification('success', `${agent.name} deployed to training room "${result.roomName}"`);
              if (onNavigateToChat) {
                onNavigateToChat(`Navigate to training room "${result.roomName}" for ${agent.name}`);
              }
            } else {
              showNotification('error', `Deployment failed: ${result.error || 'Unknown error'}`);
            }
          } catch (e: any) {
            console.error('[AdaPortal] Deploy to training failed:', e);
            showNotification('error', `Deployment failed: ${e.message}`);
          }
          break;
        }
        case 'package':
          if (onGetPackage) {
            onGetPackage(agent.id, agent.name);
          } else if (onNavigateToChat) {
            onNavigateToChat(`Get package for my AI agent ${agent.name}`);
          }
          showNotification('success', `Getting package for ${agent.name}...`);
          break;
        case 'skill':
          // Actually attach the selected skill to the agent's config
          if (selectedSkill && agent?.id) {
            try {
              const currentAgents = await window.electronAPI.aiAgents.get();
              const targetAgent = currentAgents.find((a: any) => a.id === agent.id);
              if (targetAgent) {
                const existingSkills = targetAgent.skills || [];
                if (!existingSkills.includes(selectedSkill.name)) {
                  const updatedSkills = [...existingSkills, selectedSkill.name];
                  await window.electronAPI.aiAgents.update(agent.id, { skills: updatedSkills });
                  showNotification('success', `Attached "${selectedSkill.name}" to ${agent.name}. The agent will now use this skill in conversations.`);
                } else {
                  showNotification('info', `"${selectedSkill.name}" is already attached to ${agent.name}`);
                }
              }
            } catch (e: any) {
              console.error('[AdaPortal] Failed to attach skill:', e);
              showNotification('error', `Failed to attach skill: ${e.message}`);
            }
          }
          if (onNavigateToChat) {
            onNavigateToChat(`Attach skill "${selectedSkill?.name || ''}" to my AI agent ${agent.name}`);
          }
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
            <p className="text-xs text-gray-500">Decentralized AI Workforce</p>
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
            {activeTab === 'aims' && <StargateCommunityAIMPanel hyperInsightAIMs={aims} />}
            {activeTab === 'leaderboard' && renderLeaderboard()}
            {activeTab === 'training' && renderTraining()}
            {activeTab === 'packages' && renderPackages()}
            {activeTab === 'skills' && (
              <StargateSkillsMarketplacePanel
                onAttachSkill={(skill) => {
                  setSelectedSkill(skill);
                  setAgentSelectMode('skill');
                  setShowAgentSelectModal(true);
                }}
              />
            )}
            {activeTab === 'compute' && <>{renderCompute()}{renderNodes()}</>}
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'stargate' && renderStargatePool()}
            {activeTab === 'midnight' && <MidnightCityCommandPanel />}
            {activeTab === 'asp' && renderAspGateway()}
          </>
        )}
      </div>

    </div>
  );
};

export default AdaPortalPanel;




