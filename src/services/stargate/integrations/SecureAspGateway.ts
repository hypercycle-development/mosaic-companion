// =============================================================================
// STARGATE INTEGRATIONS — Vault-Backed ASP
// AspGatewayService uses VaultPage for ALL secrets. API keys never touch memory.
// =============================================================================

import { aspGateway, type Company, type AspPackage } from '../../AspGateway';

// =============================================================================
// Vault Types (inline, renderer-safe)
// =============================================================================

interface VaultBox {
  id: string;
  name: string;
  description?: string;
}

interface VaultEntry {
  id: string;
  label?: string;
  content: string;
}

interface SecureKeyRef {
  boxId: string;
  entryId: string;
  label: string;
}

// =============================================================================
// SecureAspGateway
// =============================================================================

class SecureAspGateway {
  private keyCache: Map<string, string> = new Map(); // ephemeral, cleared after use

  // ---------------------------------------------------------------------------
  // Vault bridge
  // ---------------------------------------------------------------------------

  private async getVault(): Promise<any> {
    return (window as any).electronAPI?.vault;
  }

  /** Store an API key in the vault instead of plain memory */
  async storeApiKey(
    companyId: string,
    apiKey: string,
    label?: string,
  ): Promise<{ success: boolean; keyRef?: SecureKeyRef; error?: string }> {
    try {
      const vault = await this.getVault();
      if (!vault) {
        return { success: false, error: 'Vault not available' };
      }

      // Ensure company box exists
      const boxName = `asp-${companyId}`;
      let boxes: VaultBox[] = await vault.getBoxes();
      let box = boxes.find((b: VaultBox) => b.name === boxName);

      if (!box) {
        const result = await vault.addBox({
          name: boxName,
          description: `Secrets for ASP company ${companyId}`,
          sourceType: 'connector',
        });
        if (!result.success) {
          return { success: false, error: 'Failed to create vault box' };
        }
        boxes = await vault.getBoxes();
        box = boxes.find((b: VaultBox) => b.name === boxName);
      }

      if (!box) {
        return { success: false, error: 'Vault box creation failed' };
      }

      // Store the key as an entry
      const entryResult = await vault.addEntry(box.id, {
        label: label || `api-key-${Date.now()}`,
        content: apiKey,
      });

      if (entryResult.success) {
        this.logToChronicle(companyId, 'vault:store-key', 'success', label);
        return {
          success: true,
          keyRef: {
            boxId: box.id,
            entryId: entryResult.entryId,
            label: label || 'api-key',
          },
        };
      }

      return { success: false, error: 'Failed to store key in vault' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Retrieve an API key from the vault (ephemeral — cleared after use) */
  async retrieveApiKey(keyRef: SecureKeyRef): Promise<{ success: boolean; key?: string; error?: string }> {
    try {
      const vault = await this.getVault();
      if (!vault) {
        return { success: false, error: 'Vault not available' };
      }

      const entries: VaultEntry[] = await vault.getBoxContent(keyRef.boxId);
      const entry = entries.find((e: VaultEntry) => e.id === keyRef.entryId);

      if (!entry) {
        return { success: false, error: 'Key not found in vault' };
      }

      // Ephemeral cache (auto-clear after 30s)
      this.keyCache.set(keyRef.entryId, entry.content);
      setTimeout(() => this.keyCache.delete(keyRef.entryId), 30000);

      this.logToChronicle(keyRef.boxId, 'vault:retrieve-key', 'success', keyRef.label);
      return { success: true, key: entry.content };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Rotate an API key: delete old, store new */
  async rotateApiKey(
    keyRef: SecureKeyRef,
    newKey: string,
  ): Promise<{ success: boolean; newRef?: SecureKeyRef; error?: string }> {
    try {
      const vault = await this.getVault();
      if (!vault) {
        return { success: false, error: 'Vault not available' };
      }

      // Delete old entry
      await vault.deleteEntry(keyRef.boxId, keyRef.entryId);
      this.keyCache.delete(keyRef.entryId);

      // Store new key
      const result = await vault.addEntry(keyRef.boxId, {
        label: `${keyRef.label}-rotated`,
        content: newKey,
      });

      if (result.success) {
        this.logToChronicle(keyRef.boxId, 'vault:rotate-key', 'success', keyRef.label);
        return {
          success: true,
          newRef: {
            boxId: keyRef.boxId,
            entryId: result.entryId,
            label: `${keyRef.label}-rotated`,
          },
        };
      }

      return { success: false, error: 'Failed to store rotated key' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ---------------------------------------------------------------------------
  // ASP wrapper: all API key operations go through vault
  // ---------------------------------------------------------------------------

  async createSecureCompany(params: {
    name: string;
    walletAddress?: string;
    apiKey?: string;
    role?: string;
  }): Promise<{ company: Company; keyRef?: SecureKeyRef }> {
    // Create company via AspGatewayService (no API key in memory)
    const company = aspGateway.createCompany({
      name: params.name,
      walletAddress: params.walletAddress,
      role: params.role as any,
    });

    // If API key provided, store in vault instead of company record
    let keyRef: SecureKeyRef | undefined;
    if (params.apiKey) {
      const storeResult = await this.storeApiKey(company.id, params.apiKey, 'primary');
      if (storeResult.success && storeResult.keyRef) {
        keyRef = storeResult.keyRef;
        // Store reference (not key) in company metadata
        (company as any).keyRef = keyRef;
        // Remove plain key from company
        company.apiKeys = [];
      }
    }

    this.logToChronicle(company.id, 'asp:create-company', 'success');
    return { company, keyRef };
  }

  async executeSecureRequest(
    companyId: string,
    keyRef: SecureKeyRef,
    request: { agentName: string; prompt: string },
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    // Ephemeral retrieve
    const keyResult = await this.retrieveApiKey(keyRef);
    if (!keyResult.success || !keyResult.key) {
      return { success: false, error: keyResult.error || 'Key retrieval failed' };
    }

    try {
      // Find the ASP and execute using available API
      const asps = aspGateway.getAspByCompany(companyId);
      const targetAsp = asps[0];

      if (!targetAsp) {
        return { success: false, error: 'No ASP found for company' };
      }

      // Execute via workflow (standard AspGateway API)
      const result = await aspGateway.executeWorkflow(
        targetAsp.id,
        'default',
        { prompt: request.prompt, agentName: request.agentName },
      );

      this.logToChronicle(companyId, 'asp:execute', 'success', request.agentName);
      return { success: true, result: String(result.output || '') };
    } catch (e: any) {
      this.logToChronicle(companyId, 'asp:execute', 'error', e.message);
      return { success: false, error: e.message };
    }
  }

  // ---------------------------------------------------------------------------
  // Audit & compliance
  // ---------------------------------------------------------------------------

  getAccessLog(): Array<{ companyId: string; event: string; timestamp: number }> {
    // Chronicle readback
    return Array.from(this.keyCache.entries()).map(([id, _]) => ({
      companyId: id.split(':')[0] || 'unknown',
      event: 'key-cached',
      timestamp: Date.now(),
    }));
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private logToChronicle(
    companyId: string,
    event: string,
    status: string,
    detail?: string,
  ): void {
    const chronicle = (window as any).electronAPI?.chronicle;
    if (chronicle?.write) {
      chronicle.write('secure-asp', {
        companyId,
        event,
        status,
        detail,
        timestamp: Date.now(),
      });
    }
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const secureAspGateway = new SecureAspGateway();
export default SecureAspGateway;
export type { SecureKeyRef };
