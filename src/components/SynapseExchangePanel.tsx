// ============================================
// SYNAPSE EXCHANGE UI PANEL
// Decentralized AI Workforce Interface
// ============================================

import React, { useState, useEffect } from 'react';
import {
  initializeSynapseExchange,
  agentMarketplace,
  marketplaceAdapter,
  agentEconomy,
  leaderboard,
  trainingMarketplace,
  agentPackages,
  nodeIntelligence,
  mcpIntegration,
  type AgentRole,
  type MarketplaceListing,
  type LeaderboardEntry,
  type TrainingListing,
  type AgentPackage,
  type TaskContract
} from '../services/SynapseExchange';

interface SynapseExchangePanelProps {
  onClose?: () => void;
}

type TabType = 'marketplace' | 'leaderboard' | 'training' | 'packages' | 'economy' | 'nodes';

export const SynapseExchangePanel: React.FC<SynapseExchangePanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('marketplace');
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [trainingListings, setTrainingListings] = useState<TrainingListing[]>([]);
  const [packages, setPackages] = useState<AgentPackage[]>([]);
  const [contracts, setContracts] = useState<TaskContract[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<AgentRole | 'all'>('all');
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    initializeSynapseExchange();
    loadData();
  }, []);

  const loadData = () => {
    setSystemStatus(mcpIntegration.getSystemStatus());
    setListings(agentMarketplace.getListings());
    setLeaderboardData(leaderboard.getLeaderboard('overall', 'all_time').entries);
    setTrainingListings(trainingMarketplace.getListings());
    setPackages(agentPackages.getPackages());
    setContracts(agentEconomy.getAllContracts());
    setNodes(nodeIntelligence.getNodes());
  };

  const filteredListings = selectedRole === 'all' 
    ? listings 
    : listings.filter(l => l.roles.includes(selectedRole));

  // Test functions
  const runTests = async () => {
    const results: string[] = [];

    // Test 1: Skill-based hiring
    try {
      const route = await mcpIntegration.routeBySkill({
        requiredRoles: ['marketing'],
        requiredSkills: ['content_creation', 'seo'],
        budget: 200
      });
      results.push(`✅ Test 1 - Skill routing: Selected ${route.selectedAgentId || 'none'}`);
    } catch (e: any) {
      results.push(`❌ Test 1 failed: ${e.message}`);
    }

    // Test 2: Training flow
    try {
      const training = await mcpIntegration.executeTraining('agent_data_001', 'agent_dev_001');
      results.push(`✅ Test 2 - Training: ${training.success ? 'Improved' : 'Failed'}`);
    } catch (e: any) {
      results.push(`❌ Test 2 failed: ${e.message}`);
    }

    // Test 3: Leaderboard
    try {
      const lb = leaderboard.getLeaderboard('marketing', 'all_time');
      results.push(`✅ Test 3 - Leaderboard: ${lb.entries.length} agents ranked`);
    } catch (e: any) {
      results.push(`❌ Test 3 failed: ${e.message}`);
    }

    // Test 4: A2A hiring
    try {
      const contract = mcpIntegration.executeAgentToAgent(
        'agent_marketing_001',
        'agent_dev_001',
        'Build a landing page',
        150
      );
      results.push(`✅ Test 4 - A2A: Contract ${contract.contractId} created`);
    } catch (e: any) {
      results.push(`❌ Test 4 failed: ${e.message}`);
    }

    // Test 5: External marketplace
    try {
      const result = await marketplaceAdapter.executeViaAdapter({
        adapter: 'masumi',
        agentId: 'ext_masumi_001',
        task: 'Create marketing campaign',
        budget: 100
      });
      results.push(`✅ Test 5 - External: ${result.success ? 'Success' : 'Failed'}`);
    } catch (e: any) {
      results.push(`❌ Test 5 failed: ${e.message}`);
    }

    // Test 6: Node routing
    try {
      const nodeRoute = mcpIntegration.routeWithNodePreference(['developer'], 500);
      results.push(`✅ Test 6 - Node routing: Selected ${nodeRoute.selectedAgentId || 'none'}`);
    } catch (e: any) {
      results.push(`❌ Test 6 failed: ${e.message}`);
    }

    setTestResult(results.join('\n'));
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'marketplace', label: 'Marketplace', icon: '🏪' },
    { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
    { id: 'training', label: 'Training', icon: '🎓' },
    { id: 'packages', label: 'Packages', icon: '📦' },
    { id: 'economy', label: 'Economy', icon: '💰' },
    { id: 'nodes', label: 'Nodes', icon: '🖥️' }
  ];

  return (
    <div className="synapse-exchange-panel">
      <div className="synapse-header">
        <div className="synapse-title">
          <span className="synapse-icon">🧠</span>
          <h2>Synapse Exchange</h2>
          <span className="synapse-badge">AI Workforce</span>
        </div>
        {onClose && (
          <button className="synapse-close" onClick={onClose}>×</button>
        )}
      </div>

      <div className="synapse-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`synapse-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="synapse-content">
        {/* MARKETPLACE TAB */}
        {activeTab === 'marketplace' && (
          <div className="tab-content marketplace">
            <div className="role-filter">
              <label>Filter by Role:</label>
              <select 
                value={selectedRole} 
                onChange={(e) => setSelectedRole(e.target.value as any)}
              >
                <option value="all">All Roles</option>
                <option value="marketing">Marketing</option>
                <option value="developer">Developer</option>
                <option value="uiux">UI/UX</option>
                <option value="data_analyst">Data Analyst</option>
                <option value="growth">Growth</option>
              </select>
            </div>
            <div className="listings-grid">
              {filteredListings.map(listing => (
                <div key={listing.listingId} className="listing-card">
                  <div className="listing-header">
                    <span className="listing-name">{listing.agentName}</span>
                    <span className={`availability ${listing.availability}`}>
                      {listing.availability}
                    </span>
                  </div>
                  <div className="listing-roles">
                    {listing.roles.map(role => (
                      <span key={role} className="role-tag">{role}</span>
                    ))}
                  </div>
                  <div className="listing-skills">
                    {listing.primarySkills.map(skill => (
                      <span key={skill} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                  <div className="listing-metrics">
                    <span className="rating">⭐ {listing.rating.toFixed(1)}</span>
                    <span className="success">📈 {(listing.successRate * 100).toFixed(0)}%</span>
                    <span className="price">
                      ${listing.pricing.perTaskMin}-${listing.pricing.perTaskMax}
                    </span>
                    {listing.chain && (
                      <span className={`chain ${listing.chain}`}>
                        {listing.chain === 'ethereum' ? 'Ξ' : '◈'} {listing.chain.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {activeTab === 'leaderboard' && (
          <div className="tab-content leaderboard">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Agent</th>
                  <th>Score</th>
                  <th>Skill</th>
                  <th>Success</th>
                  <th>Rating</th>
                  <th>Node</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardData.slice(0, 10).map(entry => (
                  <tr key={entry.agentId}>
                    <td className="rank">
                      {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                    </td>
                    <td className="agent-name">{entry.agentName}</td>
                    <td className="score">{entry.score.toFixed(2)}</td>
                    <td>{entry.skillScore.toFixed(1)}</td>
                    <td>{(entry.successRate * 100).toFixed(0)}%</td>
                    <td>⭐ {entry.clientRating.toFixed(1)}</td>
                    <td>{(entry.nodeReliability * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TRAINING TAB */}
        {activeTab === 'training' && (
          <div className="tab-content training">
            <div className="training-grid">
              {trainingListings.map(listing => (
                <div key={listing.listingId} className="trainer-card">
                  <div className="trainer-header">
                    <span className="rank">#{listing.rank}</span>
                    <span className="trainer-name">{listing.trainerName}</span>
                  </div>
                  <p className="trainer-desc">{listing.description}</p>
                  <div className="trainer-skills">
                    {listing.skills.map(skill => (
                      <span key={skill} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                  <div className="trainer-footer">
                    <span className="price">${listing.trainingPrice}</span>
                    <span className="stories">{listing.successStories} success stories</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PACKAGES TAB */}
        {activeTab === 'packages' && (
          <div className="tab-content packages">
            <div className="packages-grid">
              {packages.map(pkg => (
                <div key={pkg.packageId} className="package-card">
                  <div className="package-header">
                    <h3>{pkg.name}</h3>
                    <span className="popularity">🔥 {pkg.popularity}</span>
                  </div>
                  <p className="package-desc">{pkg.description}</p>
                  <div className="package-roles">
                    {pkg.roles.map(role => (
                      <span key={role} className="role-tag">{role}</span>
                    ))}
                  </div>
                  <ul className="package-features">
                    {pkg.features.slice(0, 4).map((f, i) => (
                      <li key={i}>✓ {f}</li>
                    ))}
                  </ul>
                  <div className="package-footer">
                    <span className="price">${pkg.pricing}/mo</span>
                    <button className="subscribe-btn">Subscribe</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ECONOMY TAB */}
        {activeTab === 'economy' && (
          <div className="tab-content economy">
            <div className="economy-stats">
              <div className="stat-card">
                <span className="stat-label">Active Contracts</span>
                <span className="stat-value">{contracts.filter(c => !['completed', 'cancelled'].includes(c.status)).length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Completed</span>
                <span className="stat-value">{contracts.filter(c => c.status === 'completed').length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Volume</span>
                <span className="stat-value">
                  ${contracts.reduce((sum, c) => sum + (c.status === 'completed' ? c.budget : 0), 0)} USDC
                </span>
              </div>
            </div>
            <div className="contracts-list">
              <h4>Recent Contracts</h4>
              {contracts.slice(0, 5).map(contract => (
                <div key={contract.contractId} className="contract-item">
                  <span className="contract-id">{contract.contractId.slice(0, 12)}...</span>
                  <span className={`status ${contract.status}`}>{contract.status}</span>
                  <span className="budget">${contract.budget}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NODES TAB */}
        {activeTab === 'nodes' && (
          <div className="tab-content nodes">
            <div className="nodes-grid">
              {nodes.map(node => (
                <div key={node.nodeId} className="node-card">
                  <div className="node-header">
                    <span className={`node-type ${node.type.toLowerCase()}`}>{node.type}</span>
                    <span className="node-id">{node.nodeId}</span>
                  </div>
                  <div className="node-metrics">
                    <div className="metric">
                      <span className="label">Uptime</span>
                      <span className="value">{(node.uptime * 100).toFixed(1)}%</span>
                    </div>
                    <div className="metric">
                      <span className="label">Reliability</span>
                      <span className="value">{(node.reliabilityScore * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="node-licenses">
                    {node.licenses.slice(0, 3).map(lic => (
                      <span key={lic} className="license-tag">{lic}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="synapse-footer">
        <button className="test-btn" onClick={runTests}>
          🧪 Run Integration Tests
        </button>
        {testResult && (
          <pre className="test-result">{testResult}</pre>
        )}
      </div>
    </div>
  );
};

export default SynapseExchangePanel;