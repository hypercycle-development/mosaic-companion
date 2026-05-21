import fs from "fs";
import { loadVault, getBox, boxContentPath } from "./index";
import type { BoxContent, VaultEntry } from "./types";

/**
 * Store a secret value into a specified vault box.
 * The value is encrypted with Electron's safeStorage if available.
 */
export function storeSecret(boxId: string, key: string, value: string): {
  success: boolean;
  entryId?: string;
  error?: string;
} {
  try {
    const box = getBox(boxId);
    if (!box) {
      return { success: false, error: `Box ${boxId} not found` };
    }
    const boxPath = boxContentPath(boxId);
    let boxContent: BoxContent;
    if (fs.existsSync(boxPath)) {
      const data = fs.readFileSync(boxPath, "utf8");
      boxContent = JSON.parse(data) as BoxContent;
    } else {
      boxContent = { boxId, entries: [] };
    }
    const entryId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let encrypted = value;
    try {
      const encryptedBuf = (app as any).safeStorage?.encryptString?.(value);
      if (encryptedBuf instanceof Buffer) {
        encrypted = encryptedBuf.toString("base64");
      }
    } catch {
      // no encryption fallback
    }
    const entry: VaultEntry = {
      id: entryId,
      label: key,
      content: typeof encrypted === "string" ? encrypted : value,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    boxContent.entries.push(entry);
    fs.writeFileSync(boxPath, JSON.stringify(boxContent, null, 2), "utf8");
    return { success: true, entryId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
