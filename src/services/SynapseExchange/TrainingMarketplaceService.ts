// ============================================
// LAYER 5: TRAINING MARKETPLACE SERVICE
// Trainer Agents + Training Economy
// ============================================

import type { TrainingListing, TrainingSession, TrainingType, PerformanceImprovement } from './types';
import { agentMarketplace } from './AgentMarketplaceService';

// Storage
const trainingListings = new Map<string, TrainingListing>();
const trainingSessions = new Map<string, TrainingSession>();
const trainerAgents = new Set<string>();

export class TrainingMarketplaceService {
  constructor() {
    this.initializeTrainers();
  }

  private initializeTrainers(): void {
    // Top agents become trainers
    const topAgents = [
      { agentId: 'agent_dev_001', rank: 1 },
      { agentId: 'agent_uiux_001', rank: 2 },
      { agentId: 'agent_marketing_001', rank: 3 },
      { agentId: 'agent_data_001', rank: 4 },
      { agentId: 'agent_growth_001', rank: 5 }
    ];

    topAgents.forEach(({ agentId, rank }) => {
      const agent = agentMarketplace.getAgent(agentId);
      if (!agent) return;

      trainerAgents.add(agentId);

      // Create training listing
      const listing: TrainingListing = {
        listingId: `train_${agentId}`,
        trainerAgentId: agentId,
        trainerName: agent.name,
        rank,
        trainingPrice: 50 + (rank * 10), // Higher rank = higher price
        trainingType: 'strategy',
        skills: Object.keys(agent.skills).slice(0, 3),
        description: `Learn ${agent.name}'s proven strategies for success in ${agent.roles.join(', ')}`,
        successStories: Math.floor(agent.performance.completedTasks * 0.3)
      };

      trainingListings.set(listing.listingId, listing);
    });

    console.log(`[TrainingMarketplace] Initialized ${trainerAgents.size} trainer agents`);
  }

  // Get all training listings
  getListings(filters?: { trainingType?: TrainingType; minRank?: number }): TrainingListing[] {
    let listings = Array.from(trainingListings.values());

    if (filters?.trainingType) {
      listings = listings.filter(l => l.trainingType === filters.trainingType);
    }
    if (filters?.minRank) {
      listings = listings.filter(l => l.rank <= filters.minRank!);
    }

    return listings.sort((a, b) => a.rank - b.rank);
  }

  // Get listing by ID
  getListing(listingId: string): TrainingListing | null {
    return trainingListings.get(listingId) || null;
  }

  // Get trainer info
  getTrainer(trainerAgentId: string): TrainingListing | null {
    const listing = Array.from(trainingListings.values())
      .find(l => l.trainerAgentId === trainerAgentId);
    return listing || null;
  }

  // Purchase training
  purchaseTraining(buyerAgentId: string, listingId: string): TrainingSession | null {
    const listing = trainingListings.get(listingId);
    if (!listing) {
      console.warn(`[TrainingMarketplace] Listing not found: ${listingId}`);
      return null;
    }

    const session: TrainingSession = {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      buyerAgentId,
      trainerAgentId: listing.trainerAgentId,
      listingId,
      trainingType: listing.trainingType,
      price: listing.trainingPrice,
      status: 'paid',
      improvements: []
    };

    trainingSessions.set(session.sessionId, session);
    console.log(`[TrainingMarketplace] Training purchased: ${buyerAgentId} → ${listing.trainerName} ($${listing.trainingPrice})`);
    return session;
  }

  // Complete training and apply improvements
  completeTraining(sessionId: string, improvements: PerformanceImprovement[]): TrainingSession | null {
    const session = trainingSessions.get(sessionId);
    if (!session) {
      console.warn(`[TrainingMarketplace] Session not found: ${sessionId}`);
      return null;
    }

    session.status = 'completed';
    session.improvements = improvements;
    session.completedAt = Date.now();

    // Apply improvements to buyer agent
    const buyer = agentMarketplace.getAgent(session.buyerAgentId);
    if (buyer) {
      improvements.forEach(imp => {
        switch (imp.metric) {
          case 'successRate':
            buyer.performance.successRate = imp.after;
            break;
          case 'averageRating':
            buyer.performance.averageRating = imp.after;
            break;
          case 'responseTimeMs':
            buyer.performance.responseTimeMs = imp.after;
            break;
        }
      });
      console.log(`[TrainingMarketplace] Applied improvements to ${buyer.name}`);
    }

    console.log(`[TrainingMarketplace] Training completed: ${sessionId}`);
    return session;
  }

  // Simulate training effect (for MVP: strategy transfer)
  applyStrategyTransfer(buyerAgentId: string, trainerAgentId: string): PerformanceImprovement[] {
    const buyer = agentMarketplace.getAgent(buyerAgentId);
    const trainer = agentMarketplace.getAgent(trainerAgentId);

    if (!buyer || !trainer) return [];

    const improvements: PerformanceImprovement[] = [];

    // Copy successful strategies: boost success rate by 10-20%
    const successRateBefore = buyer.performance.successRate;
    const successRateAfter = Math.min(0.98, successRateBefore * (1 + 0.10 + Math.random() * 0.10));
    improvements.push({
      metric: 'successRate',
      before: successRateBefore,
      after: successRateAfter,
      delta: successRateAfter - successRateBefore
    });

    // Improve rating slightly
    const ratingBefore = buyer.performance.averageRating;
    const ratingAfter = Math.min(5, ratingBefore + 0.1 + Math.random() * 0.2);
    improvements.push({
      metric: 'averageRating',
      before: ratingBefore,
      after: ratingAfter,
      delta: ratingAfter - ratingBefore
    });

    // Improve response time
    const responseBefore = buyer.performance.responseTimeMs;
    const responseAfter = responseBefore * (0.85 + Math.random() * 0.10);
    improvements.push({
      metric: 'responseTimeMs',
      before: responseBefore,
      after: responseAfter,
      delta: responseAfter - responseBefore
    });

    // Apply improvements
    buyer.performance.successRate = successRateAfter;
    buyer.performance.averageRating = ratingAfter;
    buyer.performance.responseTimeMs = responseAfter;

    console.log(`[TrainingMarketplace] Applied strategy transfer to ${buyer.name}`);
    return improvements;
  }

  // Get training history for agent
  getTrainingHistory(agentId: string): TrainingSession[] {
    return Array.from(trainingSessions.values())
      .filter(s => s.buyerAgentId === agentId)
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  }

  // Check if agent is trainer
  isTrainer(agentId: string): boolean {
    return trainerAgents.has(agentId);
  }

  // Get all trainers
  getAllTrainers(): TrainingListing[] {
    return Array.from(trainingListings.values()).sort((a, b) => a.rank - b.rank);
  }
}

export const trainingMarketplace = new TrainingMarketplaceService();