import { KreaClient, getKreaClient } from "../services/krea/KreaClient";

/**
 * Import Krea image-generation skill into Vault as a Taste-Skill entry.
 */

export async function importKreaSkillToVault(): Promise<{
  success: boolean;
  entry?: any;
  error?: string;
}> {
  try {
    const vaultApi = (window as any).electronAPI?.vault;
    if (!vaultApi) {
      return { success: false, error: "Vault API not available" };
    }

    // Get or create "Taste-Skills" box
    const boxes = await vaultApi.getBoxes();
    let box = boxes.find((b: any) => b.name === "Taste-Skills");

    if (!box) {
      const created = await vaultApi.addBox({
        name: "Taste-Skills",
        description: "Taste-Skill repository entries with dial metadata",
        sourceType: "github",
      });
      if (!created.success) {
        return { success: false, error: "Failed to create Taste-Skills vault box" };
      }
      box = created.box;
    }

    // Check if Krea already exists
    const entries = await vaultApi.getBoxContent(box.id);
    const existing = entries.find(
      (e: any) => e.metadata?.installName === "krea-image-generation"
    );
    if (existing) {
      return { success: true, entry: existing, error: "Krea already imported" };
    }

    // Create Vault entry for Krea skill
    const result = await vaultApi.addEntry(box.id, {
      content: `# Krea Image Generation\n\nKrea AI is a foundation model trained from scratch to balance aesthetic quality and fine control.\n\n## Tools\n- krea_generate_image\n- krea_style_transfer\n- krea_check_status\n\n## Parameters\n| Param | Type | Default | Range |\n|-------|------|---------|-------|\n| prompt | string | required | — |\n| aspect_ratio | string | 1:1 | 1:1, 16:9, 9:16, 4:3 |\n| creativity | number | 0.5 | 0.0-1.0 |\n| negative_prompt | string | "" | — |\n| style_reference | string | "" | image URL |\n| moodboard | string[] | [] | up to 4 URLs |\n| num_images | int | 1 | 1-4 |\n| seed | int | random | — |\n| output_format | string | png | png, jpeg, webp |\n\n## Setup\nRequires KREA_API_KEY env var or hermes config set krea.api_key`,
      label: "Krea Image Generation",
        metadata: {
          installName: "krea-image-generation",
          category: "creative",
          sourceRepo: "hermes-agent/skills",
          isTasteSkill: true,
          version: "1.0.0",
          outputType: "images" as const,
          lastPreset: "exploratory-creative",
          dials: {
            designVariance: 5,
            motionIntensity: 0,
            visualDensity: 4,
          },
        },
    });

    return result;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export default importKreaSkillToVault;
