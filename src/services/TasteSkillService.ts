/**
 * Taste-Skill Service
 *
 * Manages Taste-Skill format skills from Leonxlnx/taste-skill repository.
 * Provides integration between Vault storage and the Skills marketplace.
 */

import { parseTasteSkill, type ParsedTasteSkill } from "../utils/tasteSkillParser";

export interface TasteSkillInfo {
  id: string;
  name: string;
  installName: string;
  category: string;
  description: string;
  dials: {
    designVariance: number;
    motionIntensity: number;
    visualDensity: number;
  };
  triggers: string[];
  presets: Array<{
    name: string;
    variance: number;
    motion: number;
    density: number;
  }>;
  outputType: string;
  isInstalled: boolean;
  vaultEntryId?: string;
}

export interface TasteSkillVaultEntry {
  id: string;
  label: string;
  content: string;
  metadata?: {
    isTasteSkill?: boolean;
    installName?: string;
    category?: string;
    dials?: {
      designVariance: number;
      motionIntensity: number;
      visualDensity: number;
    };
    outputType?: string;
    triggers?: string[];
    presets?: Array<{
      name: string;
      variance: number;
      motion: number;
      density: number;
    }>;
    lastPreset?: string;
  };
}

const TASTE_SKILL_VAULT_BOX_NAME = 'taste-skills';

class TasteSkillService {
  private availableSkills: Map<string, TasteSkillInfo> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    console.log('[TasteSkillService] Initializing...');
    this.initialized = true;
  }

  /**
   * Check if Taste-Skills vault box exists
   */
  async hasVaultBox(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.electronAPI?.vault?.getBoxes) {
      return false;
    }
    try {
      const boxes = await window.electronAPI.vault.getBoxes();
      return boxes.some((b: any) => b.name?.toLowerCase() === TASTE_SKILL_VAULT_BOX_NAME);
    } catch (e) {
      console.warn('[TasteSkillService] Error checking vault box:', e);
      return false;
    }
  }

  /**
   * Get or create the Taste-Skills vault box
   */
  async getOrCreateVaultBox(): Promise<{ id: string; name: string } | null> {
    if (typeof window === 'undefined' || !window.electronAPI?.vault?.getBoxes) {
      return null;
    }
    try {
      const boxes = await window.electronAPI.vault.getBoxes();
      let box = boxes.find((b: any) => b.name?.toLowerCase() === TASTE_SKILL_VAULT_BOX_NAME);
      
      if (!box) {
        const newBox = await window.electronAPI.vault.addBox({
          name: 'Taste-Skills',
          description: 'Taste-Skill format skills from Leonxlnx/taste-skill'
        });
        box = newBox;
        console.log('[TasteSkillService] Created Taste-Skills vault box:', box?.id);
      }
      
      return box ? { id: box.id, name: box.name } : null;
    } catch (e) {
      console.error('[TasteSkillService] Error creating vault box:', e);
      return null;
    }
  }

  /**
   * Get available skills from Vault
   * Returns Taste-Skills that have been imported to the Vault
   */
  async getAvailableSkills(): Promise<TasteSkillInfo[]> {
    if (typeof window === 'undefined' || !window.electronAPI?.vault?.getBoxes) {
      console.warn('[TasteSkillService] Vault API not available');
      return [];
    }

    try {
      const boxes = await window.electronAPI.vault.getBoxes();
      const box = boxes.find((b: any) => b.name?.toLowerCase() === TASTE_SKILL_VAULT_BOX_NAME);
      
      if (!box?.id) {
        console.log('[TasteSkillService] No Taste-Skills vault box found');
        return [];
      }

      const entries: TasteSkillVaultEntry[] = await window.electronAPI.vault.getBoxContent(box.id);
      
      if (!entries || entries.length === 0) {
        console.log('[TasteSkillService] No Taste-Skill entries in vault');
        return [];
      }

      const skills: TasteSkillInfo[] = entries
        .filter((entry: TasteSkillVaultEntry) => entry.metadata?.isTasteSkill)
        .map((entry: TasteSkillVaultEntry) => ({
          id: entry.id,
          name: entry.label || entry.metadata?.installName || 'Unnamed Taste-Skill',
          installName: entry.metadata?.installName || entry.label || 'unknown',
          category: entry.metadata?.category || 'design',
          description: entry.content || '',
          dials: entry.metadata?.dials || {
            designVariance: 0.5,
            motionIntensity: 0.5,
            visualDensity: 0.5
          },
          triggers: entry.metadata?.triggers || [],
          presets: entry.metadata?.presets || [],
          outputType: entry.metadata?.outputType || 'code',
          isInstalled: true,
          vaultEntryId: entry.id
        }));

      // Update cache
      skills.forEach(skill => {
        this.availableSkills.set(skill.id, skill);
      });

      console.log(`[TasteSkillService] Loaded ${skills.length} Taste-Skills from Vault`);
      return skills;
    } catch (e) {
      console.error('[TasteSkillService] Error getting available skills:', e);
      return [];
    }
  }

  /**
   * Get a single Taste-Skill by ID
   */
  async getSkillById(skillId: string): Promise<TasteSkillInfo | null> {
    // Check cache first
    if (this.availableSkills.has(skillId)) {
      return this.availableSkills.get(skillId)!;
    }

    // Refresh from vault
    const skills = await this.getAvailableSkills();
    return skills.find(s => s.id === skillId) || null;
  }

  /**
   * Get Taste-Skills by category
   */
  async getSkillsByCategory(category: string): Promise<TasteSkillInfo[]> {
    const skills = await this.getAvailableSkills();
    return skills.filter(s => s.category === category);
  }

  /**
   * Get Taste-Skill categories
   */
  async getCategories(): Promise<string[]> {
    const skills = await this.getAvailableSkills();
    const categories = new Set<string>();
    skills.forEach(s => categories.add(s.category));
    return Array.from(categories).sort();
  }

  /**
   * Update skill dials
   */
  async updateSkillDials(
    skillId: string, 
    dials: { designVariance: number; motionIntensity: number; visualDensity: number }
  ): Promise<boolean> {
    const skill = await this.getSkillById(skillId);
    if (!skill?.vaultEntryId) {
      console.warn('[TasteSkillService] Cannot update dials: skill not found or no vault entry');
      return false;
    }

    const box = await this.getOrCreateVaultBox();
    if (!box?.id) {
      console.warn('[TasteSkillService] Cannot update dials: no vault box');
      return false;
    }

    try {
      await window.electronAPI.vault.updateEntry(box.id, skill.vaultEntryId, {
        metadata: {
          ...skill,
          dials
        }
      });
      
      // Update cache
      skill.dials = dials;
      this.availableSkills.set(skillId, skill);
      
      return true;
    } catch (e) {
      console.error('[TasteSkillService] Error updating dials:', e);
      return false;
    }
  }

  /**
   * Get the total count of available Taste-Skills
   */
  async getSkillCount(): Promise<number> {
    const skills = await this.getAvailableSkills();
    return skills.length;
  }

  /**
   * Check if any Taste-Skills are available
   */
  async hasAvailableSkills(): Promise<boolean> {
    const count = await this.getSkillCount();
    return count > 0;
  }

  /**
   * Clear the skill cache
   */
  clearCache(): void {
    this.availableSkills.clear();
    console.log('[TasteSkillService] Cache cleared');
  }
}

export const tasteSkillService = new TasteSkillService();
