// ============================================
// ADA PORTAL - Training Marketplace Service
// Layer 5: Trainer agents and skill transfer
// ============================================

import { TrainingListing, TrainingSession, TrainerProfile } from './types';

class TrainingMarketplaceService {
  private trainers: Map<string, TrainerProfile> = new Map();
  private listings: Map<string, TrainingListing> = new Map();
  private sessions: Map<string, TrainingSession> = new Map();
  private sessionCounter = 0;

  constructor() {
    this.initializeTrainers();
    console.log('[AdaPortal] Training marketplace initialized');
  }

  private initializeTrainers(): void {
    const demoTrainers: TrainerProfile[] = [
      {
        trainerId: 'trainer-dev-001',
        agentId: 'agent-dev-001',
        name: 'CodeCraft',
        specializations: ['smart-contracts', 'solidity', 'security'],
        pricePerSession: 200,
        sessionsCompleted: 45,
        rating: 4.9
      },
      {
        trainerId: 'trainer-marketing-001',
        agentId: 'agent-marketing-001',
        name: 'CryptoMark',
        specializations: ['content-creation', 'social-media', 'community'],
        pricePerSession: 150,
        sessionsCompleted: 78,
        rating: 4.8
      },
      {
        trainerId: 'trainer-uiux-001',
        agentId: 'agent-uiux-001',
        name: 'DesignFlow',
        specializations: ['ui-design', 'ux-research', 'figma'],
        pricePerSession: 175,
        sessionsCompleted: 56,
        rating: 4.7
      },
      {
        trainerId: 'trainer-growth-001',
        agentId: 'agent-growth-001',
        name: 'GrowthRocket',
        specializations: ['growth-strategy', 'analytics', 'conversion'],
        pricePerSession: 225,
        sessionsCompleted: 34,
        rating: 4.6
      }
    ];

    demoTrainers.forEach(trainer => {
      this.trainers.set(trainer.trainerId, trainer);
      
      // Create listing from trainer
      const listing: TrainingListing = {
        listingId: `listing-${trainer.trainerId}`,
        trainerId: trainer.trainerId,
        trainerName: trainer.name,
        specializations: trainer.specializations,
        pricePerSession: trainer.pricePerSession,
        description: `Expert training in ${trainer.specializations.join(', ')}`,
        rating: trainer.rating
      };
      this.listings.set(listing.listingId, listing);
    });

    console.log(`[AdaPortal] Initialized ${this.trainers.size} trainer agents`);
  }

  // Get all training listings
  getListings(): TrainingListing[] {
    return Array.from(this.listings.values()).sort((a, b) => b.rating - a.rating);
  }

  // Get training listing by ID
  getListing(listingId: string): TrainingListing | undefined {
    return this.listings.get(listingId);
  }

  // Get trainer profile
  getTrainer(trainerId: string): TrainerProfile | undefined {
    return this.trainers.get(trainerId);
  }

  // Get listings by skill
  getListingsBySkill(skill: string): TrainingListing[] {
    return Array.from(this.listings.values()).filter(l =>
      l.specializations.some(s => s.toLowerCase().includes(skill.toLowerCase()))
    );
  }

  // Create a training session
  createSession(params: {
    trainerId: string;
    traineeAgentId: string;
    skills: string[];
    price: number;
  }): TrainingSession {
    const trainer = this.trainers.get(params.trainerId);
    if (!trainer) {
      throw new Error(`Trainer ${params.trainerId} not found`);
    }

    if (trainer.pricePerSession > params.price) {
      throw new Error(`Insufficient payment (required: ${trainer.pricePerSession})`);
    }

    const sessionId = `session-${++this.sessionCounter}`;
    const session: TrainingSession = {
      sessionId,
      trainerId: params.trainerId,
      traineeAgentId: params.traineeAgentId,
      skills: params.skills,
      status: 'pending',
      price: params.price,
      createdAt: Date.now()
    };

    this.sessions.set(sessionId, session);
    console.log(`[AdaPortal] Created training session ${sessionId}`);

    return session;
  }

  // Get sessions for an agent
  getSessionsForAgent(agentId: string): TrainingSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.traineeAgentId === agentId || s.trainerId.includes(agentId.split('-')[1])
    );
  }

  // Update session status
  updateSessionStatus(sessionId: string, status: TrainingSession['status']): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      
      // Update trainer stats if completed
      if (status === 'completed') {
        const trainer = this.trainers.get(session.trainerId);
        if (trainer) {
          trainer.sessionsCompleted++;
        }
      }
    }
  }

  // Get training stats
  getStats(): {
    totalTrainers: number;
    totalSessions: number;
    completedSessions: number;
    averageRating: number;
  } {
    const trainers = Array.from(this.trainers.values());
    const sessions = Array.from(this.sessions.values());

    return {
      totalTrainers: trainers.length,
      totalSessions: sessions.length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      averageRating: trainers.reduce((sum, t) => sum + t.rating, 0) / trainers.length
    };
  }
}

export const trainingMarketplace = new TrainingMarketplaceService();
export { TrainingMarketplaceService };