// HyperAIBOX Node Service
// Manages physical HyperAIBOX nodes as agent toolkits

import {
  HyperAIBOXNode,
  AgentToolkit,
  DEFAULT_HYPERAIBOX_NODES,
  HYPERAIBOX_NODES_KEY,
  AGENT_TOOLKITS_KEY,
} from '../types/nodeConfig';

export class HyperAIBOXService {
  // Get all HyperAIBOX nodes
  static async getNodes(): Promise<HyperAIBOXNode[]> {
    try {
      const stored = localStorage.getItem(HYPERAIBOX_NODES_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      // Return default nodes on first load
      return DEFAULT_HYPERAIBOX_NODES;
    } catch (e) {
      console.error('[HyperAIBOX] Error loading nodes:', e);
      return DEFAULT_HYPERAIBOX_NODES;
    }
  }

  // Save nodes
  static async saveNodes(nodes: HyperAIBOXNode[]): Promise<void> {
    try {
      localStorage.setItem(HYPERAIBOX_NODES_KEY, JSON.stringify(nodes));
      console.log('[HyperAIBOX] Nodes saved:', nodes.length);
    } catch (e) {
      console.error('[HyperAIBOX] Error saving nodes:', e);
    }
  }

  // Update a single node
  static async updateNode(nodeId: string, updates: Partial<HyperAIBOXNode>): Promise<boolean> {
    try {
      const nodes = await this.getNodes();
      const index = nodes.findIndex(n => n.id === nodeId);
      if (index >= 0) {
        nodes[index] = { ...nodes[index], ...updates, lastSeen: Date.now() };
        await this.saveNodes(nodes);
        return true;
      }
      return false;
    } catch (e) {
      console.error('[HyperAIBOX] Error updating node:', e);
      return false;
    }
  }

  // Add a new node
  static async addNode(node: Omit<HyperAIBOXNode, 'id' | 'lastSeen'>): Promise<HyperAIBOXNode> {
    const nodes = await this.getNodes();
    const newNode: HyperAIBOXNode = {
      ...node,
      id: `node-${Date.now()}`,
      lastSeen: 0,
    };
    nodes.push(newNode);
    await this.saveNodes(nodes);
    return newNode;
  }

  // Remove a node
  static async removeNode(nodeId: string): Promise<boolean> {
    try {
      const nodes = await this.getNodes();
      const filtered = nodes.filter(n => n.id !== nodeId);
      await this.saveNodes(filtered);
      return true;
    } catch (e) {
      console.error('[HyperAIBOX] Error removing node:', e);
      return false;
    }
  }

  // Check node status via SSH (would need backend)
  static async checkNodeStatus(node: HyperAIBOXNode): Promise<HyperAIBOXNode> {
    try {
      // In a real implementation, this would make an API call to check SSH status
      // For now, we'll just update the lastSeen timestamp
      const updated: HyperAIBOXNode = {
        ...node,
        status: 'unknown',
        lastSeen: Date.now(),
      };
      return updated;
    } catch (e) {
      console.error('[HyperAIBOX] Error checking node status:', e);
      return { ...node, status: 'offline' };
    }
  }

  // Link an agent to a node
  static async linkAgentToNode(agentId: string, nodeId: string): Promise<boolean> {
    try {
      const nodes = await this.getNodes();
      const node = nodes.find(n => n.id === nodeId);
      if (node && !node.linkedAgents.includes(agentId)) {
        node.linkedAgents.push(agentId);
        node.lastSeen = Date.now();
        await this.saveNodes(nodes);
        return true;
      }
      return false;
    } catch (e) {
      console.error('[HyperAIBOX] Error linking agent:', e);
      return false;
    }
  }

  // Unlink an agent from a node
  static async unlinkAgentFromNode(agentId: string, nodeId: string): Promise<boolean> {
    try {
      const nodes = await this.getNodes();
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        node.linkedAgents = node.linkedAgents.filter(id => id !== agentId);
        node.lastSeen = Date.now();
        await this.saveNodes(nodes);
        return true;
      }
      return false;
    } catch (e) {
      console.error('[HyperAIBOX] Error unlinking agent:', e);
      return false;
    }
  }

  // Get toolkit for an agent
  static async getAgentToolkit(agentId: string): Promise<AgentToolkit | null> {
    try {
      const stored = localStorage.getItem(AGENT_TOOLKITS_KEY);
      if (stored) {
        const toolkits: AgentToolkit[] = JSON.parse(stored);
        return toolkits.find(t => t.agentId === agentId) || null;
      }
      return null;
    } catch (e) {
      console.error('[HyperAIBOX] Error getting toolkit:', e);
      return null;
    }
  }

  // Update toolkit for an agent
  static async updateAgentToolkit(agentId: string, nodes: HyperAIBOXNode[], skills: string[]): Promise<void> {
    try {
      const stored = localStorage.getItem(AGENT_TOOLKITS_KEY);
      const toolkits: AgentToolkit[] = stored ? JSON.parse(stored) : [];
      
      const existingIndex = toolkits.findIndex(t => t.agentId === agentId);
      const toolkit: AgentToolkit = {
        agentId,
        nodes,
        skills,
        lastSynced: Date.now(),
      };

      if (existingIndex >= 0) {
        toolkits[existingIndex] = toolkit;
      } else {
        toolkits.push(toolkit);
      }

      localStorage.setItem(AGENT_TOOLKITS_KEY, JSON.stringify(toolkits));
    } catch (e) {
      console.error('[HyperAIBOX] Error updating toolkit:', e);
    }
  }

  // Get nodes linked to an agent
  static async getNodesForAgent(agentId: string): Promise<HyperAIBOXNode[]> {
    const nodes = await this.getNodes();
    return nodes.filter(n => n.linkedAgents.includes(agentId));
  }

  // Get SSH command for a node
  static getSSHCommand(node: HyperAIBOXNode): string {
    return `ssh ${node.user}@${node.ip}`;
  }

  // Get SCP command to copy files
  static getSCPCommand(node: HyperAIBOXNode, localPath: string, remotePath: string): string {
    return `scp ${localPath} ${node.user}@${node.ip}:${remotePath}`;
  }

  // Format storage info
  static formatStorage(node: HyperAIBOXNode): string {
    const used = node.storage.used;
    const available = node.storage.available;
    const percent = available > 0 ? Math.round((used / available) * 100) : 0;
    return `${used.toFixed(1)}GB / ${available.toFixed(0)}GB (${percent}% used)`;
  }
}

export default HyperAIBOXService;