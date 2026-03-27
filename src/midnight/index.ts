/**
 * Midnight MosAic API Server
 * Handles HyperSharePass NFT-gated access to AI agents
 * 
 * Run: npm run dev
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { WebSocketServer, WebSocket } from 'ws';

// Config
const PORT = process.env.PORT || 3001;
const BLOCKFROST_PROJECT_ID = process.env.BLOCKFROST_PROJECT_ID || '';
const HYPERSHARE_PASS_POLICY_ID = 'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46';

// Initialize Blockfrost
const blockfrost = BLOCKFROST_PROJECT_ID 
  ? new BlockFrostAPI({ projectId: BLOCKFROST_PROJECT_ID })
  : null;

// Express app
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Types
interface DelegationRecord {
  walletAddress: string;
  hyperSharePassCount: number;
  nodeFactoryIds: number[];
  anfeIds: number[];
  totalWeight: number;
  access: AccessRights;
  createdAt: number;
  updatedAt: number;
}

interface AccessRights {
  canChat: boolean;
  canCreateAgents: number;
  canDelegate: boolean;
  canRentCompute: boolean;
}

interface NodeFactory {
  id: number;
  type: 'eth' | 'anfe';
  owner: string;
  delegatedTo: string | null;
  isAvailable: boolean;
  specs: NodeSpecs;
}

interface NodeSpecs {
  cpu: string;
  memory: string;
  storage: string;
  gpu?: string;
  aiModel?: string;
}

interface AIAgent {
  id: string;
  owner: string;
  name: string;
  nodeFactoryId: number;
  status: 'active' | 'paused' | 'stopped';
  createdAt: number;
}

// In-memory storage (use Redis in production)
const delegations = new Map<string, DelegationRecord>();
const nodeFactories = new Map<number, NodeFactory>();
const aiAgents = new Map<string, AIAgent>();

// Initialize node factories (mock data for demo)
function initNodeFactories() {
  // 100 HyperCycle ETH Node Factories
  for (let i = 1; i <= 100; i++) {
    nodeFactories.set(i, {
      id: i,
      type: 'eth',
      owner: 'hpec-dao',
      delegatedTo: null,
      isAvailable: true,
      specs: {
        cpu: '8 cores',
        memory: '32GB',
        storage: '500GB SSD',
        aiModel: 'llama3.2'
      }
    });
  }
  
  // 50 Base ANFEs
  for (let i = 101; i <= 150; i++) {
    nodeFactories.set(i, {
      id: i,
      type: 'anfe',
      owner: 'hpec-dao',
      delegatedTo: null,
      isAvailable: true,
      specs: {
        cpu: '16 cores',
        memory: '64GB',
        storage: '1TB NVMe',
        gpu: 'NVIDIA A100',
        aiModel: 'mixtral-8x7b'
      }
    });
  }
}
initNodeFactories();

// ==================
// API Routes
// ==================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Get user's delegation status
app.get('/api/delegation/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const delegation = delegations.get(address);
    
    if (!delegation) {
      // Check on-chain
      const onChainData = await getOnChainDelegation(address);
      if (onChainData) {
        delegations.set(address, onChainData);
        return res.json(onChainData);
      }
      return res.status(404).json({ error: 'No delegation found' });
    }
    
    res.json(delegation);
  } catch (error) {
    console.error('Error fetching delegation:', error);
    res.status(500).json({ error: 'Failed to fetch delegation' });
  }
});

// Verify wallet and get access rights
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { address, wallet, signature, message } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address required' });
    }

    // Fetch NFTs from Blockfrost
    const hyperSharePassCount = await getHyperSharePassCount(address);
    
    // Calculate access
    const access: AccessRights = {
      canChat: hyperSharePassCount > 0,
      canCreateAgents: hyperSharePassCount,
      canDelegate: hyperSharePassCount > 0,
      canRentCompute: hyperSharePassCount >= 10
    };

    // Create or update delegation record
    const delegation: DelegationRecord = {
      walletAddress: address,
      hyperSharePassCount,
      nodeFactoryIds: [],
      anfeIds: [],
      totalWeight: hyperSharePassCount,
      access,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    delegations.set(address, delegation);

    res.json({
      success: true,
      access,
      hyperSharePassCount,
      maxAgents: hyperSharePassCount
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get available node factories
app.get('/api/node-factories', (req, res) => {
  const { type, available } = req.query;
  
  let factories = Array.from(nodeFactories.values());
  
  if (type) {
    factories = factories.filter(f => f.type === type);
  }
  if (available === 'true') {
    factories = factories.filter(f => f.isAvailable);
  }
  
  res.json(factories);
});

// Delegate node factories (Creator Portal)
app.post('/api/delegation/delegate', async (req, res) => {
  try {
    const { walletAddress, nodeFactoryIds, anfeIds } = req.body;
    
    // Verify ownership
    const delegation = delegations.get(walletAddress);
    if (!delegation) {
      return res.status(403).json({ error: 'Wallet not verified' });
    }

    // Check permissions
    if (!delegation.access.canDelegate) {
      return res.status(403).json({ error: 'Not authorized to delegate' });
    }

    // Validate node factories exist and are available
    const errors: string[] = [];
    
    for (const id of nodeFactoryIds || []) {
      const factory = nodeFactories.get(id);
      if (!factory) {
        errors.push(`Node factory ${id} not found`);
      } else if (!factory.isAvailable) {
        errors.push(`Node factory ${id} is not available`);
      } else if (factory.owner !== walletAddress && factory.delegatedTo !== null) {
        errors.push(`Node factory ${id} is already delegated`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Perform delegation
    for (const id of nodeFactoryIds || []) {
      const factory = nodeFactories.get(id)!;
      factory.delegatedTo = walletAddress;
      factory.isAvailable = false;
    }

    // Update delegation record
    delegation.nodeFactoryIds = [...new Set([...delegation.nodeFactoryIds, ...(nodeFactoryIds || [])])];
    delegation.anfeIds = [...new Set([...delegation.anfeIds, ...(anfeIds || [])])];
    delegation.updatedAt = Date.now();
    delegations.set(walletAddress, delegation);

    res.json({
      success: true,
      delegation: {
        nodeFactoryIds: delegation.nodeFactoryIds,
        anfeIds: delegation.anfeIds
      }
    });
  } catch (error) {
    console.error('Delegation error:', error);
    res.status(500).json({ error: 'Delegation failed' });
  }
});

// Undelegate node factories
app.post('/api/delegation/undelegate', async (req, res) => {
  try {
    const { walletAddress, nodeFactoryIds } = req.body;
    
    const delegation = delegations.get(walletAddress);
    if (!delegation) {
      return res.status(404).json({ error: 'Delegation not found' });
    }

    // Remove delegations
    for (const id of nodeFactoryIds || []) {
      const factory = nodeFactories.get(id);
      if (factory && factory.delegatedTo === walletAddress) {
        factory.delegatedTo = null;
        factory.isAvailable = true;
      }
    }

    // Update record
    delegation.nodeFactoryIds = delegation.nodeFactoryIds.filter(id => !(nodeFactoryIds || []).includes(id));
    delegation.updatedAt = Date.now();
    delegations.set(walletAddress, delegation);

    res.json({ success: true, delegation });
  } catch (error) {
    res.status(500).json({ error: 'Undelegate failed' });
  }
});

// Get user's AI agents
app.get('/api/agents/:walletAddress', (req, res) => {
  const { walletAddress } = req.params;
  
  const agents = Array.from(aiAgents.values())
    .filter(a => a.owner === walletAddress);
  
  res.json(agents);
});

// Create AI Agent
app.post('/api/agents/create', async (req, res) => {
  try {
    const { walletAddress, name, nodeFactoryId } = req.body;
    
    const delegation = delegations.get(walletAddress);
    if (!delegation) {
      return res.status(403).json({ error: 'Wallet not verified' });
    }

    // Check agent limit
    if (aiAgents.size >= delegation.access.canCreateAgents) {
      return res.status(403).json({ 
        error: 'Agent limit reached',
        limit: delegation.access.canCreateAgents
      });
    }

    // Check node factory is available
    const factory = nodeFactories.get(nodeFactoryId);
    if (!factory || !factory.isAvailable) {
      return res.status(400).json({ error: 'Node factory not available' });
    }

    // Create agent
    const agent: AIAgent = {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      owner: walletAddress,
      name,
      nodeFactoryId,
      status: 'active',
      createdAt: Date.now()
    };

    aiAgents.set(agent.id, agent);

    // Mark node as in use
    factory.isAvailable = false;
    factory.delegatedTo = walletAddress;

    res.json({ success: true, agent });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// Delete AI Agent
app.delete('/api/agents/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    const { walletAddress } = req.body;
    
    const agent = aiAgents.get(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.owner !== walletAddress) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Free up node factory
    const factory = nodeFactories.get(agent.nodeFactoryId);
    if (factory) {
      factory.isAvailable = true;
      factory.delegatedTo = null;
    }

    aiAgents.delete(agentId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// Get chat session
app.post('/api/chat/session', async (req, res) => {
  try {
    const { walletAddress, agentId } = req.body;
    
    const delegation = delegations.get(walletAddress);
    if (!delegation?.access.canChat) {
      return res.status(403).json({ error: 'Chat access denied' });
    }

    // Create chat session (WebSocket)
    const sessionId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    res.json({
      sessionId,
      wsEndpoint: `ws://localhost:${PORT}/ws/chat/${sessionId}`,
      agentId: agentId || 'default'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create chat session' });
  }
});

// ==================
// Helper Functions
// ==================

async function getHyperSharePassCount(address: string): Promise<number> {
  if (!blockfrost) {
    // Mock for development without Blockfrost
    return 0;
  }

  try {
    const addresses = await blockfrost.addressesAll(address);
    let count = 0;
    
    for (const addr of addresses) {
      const utxos = await blockfrost.addressesUtxos(addr);
      for (const utxo of utxos) {
        for (const asset of utxo.amount) {
          if (asset.unit === HYPERSHARE_PASS_POLICY_ID) {
            count += parseInt(asset.quantity);
          }
          // Check for policy ID format
          if (asset.unit.startsWith(HYPERSHARE_PASS_POLICY_ID)) {
            count += parseInt(asset.quantity);
          }
        }
      }
    }
    
    return count;
  } catch (error) {
    console.error('Blockfrost error:', error);
    return 0;
  }
}

async function getOnChainDelegation(address: string): Promise<DelegationRecord | null> {
  const hyperSharePassCount = await getHyperSharePassCount(address);
  
  if (hyperSharePassCount === 0) {
    return null;
  }

  return {
    walletAddress: address,
    hyperSharePassCount,
    nodeFactoryIds: [],
    anfeIds: [],
    totalWeight: hyperSharePassCount,
    access: {
      canChat: true,
      canCreateAgents: hyperSharePassCount,
      canDelegate: true,
      canRentCompute: hyperSharePassCount >= 10
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

// ==================
// WebSocket Server
// ==================

const wss = new WebSocketServer({ port: PORT + 1 });

wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      // Handle chat messages, agent commands, etc.
      console.log('Received:', message);
    } catch (e) {
      console.error('Invalid message');
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// ==================
// Start Server
// ==================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Midnight MosAic API Server                              ║
║                                                          ║
║  HTTP:   http://localhost:${PORT}                          ║
║  WS:     ws://localhost:${PORT + 1}                        ║
║                                                          ║
║  Endpoints:                                              ║
║  - GET  /health                                          ║
║  - POST /api/auth/verify        → Verify wallet + NFTs    ║
║  - GET  /api/delegation/:addr  → Get delegation status   ║
║  - POST /api/delegation/delegate → Delegate node factory ║
║  - GET  /api/node-factories    → List available nodes    ║
║  - POST /api/agents/create      → Create AI agent        ║
║  - POST /api/chat/session      → Start chat session      ║
╚══════════════════════════════════════════════════════════╝
  `);
});