/**
 * EIP-191 sign a UTF-8 string with the Mosaic-stored EVM wallet (Base / Base Sepolia private key).
 * Used for Hypercycle Basechain `tx-signature` (signed nonce).
 */

import { privateKeyToAccount } from "viem/accounts";
import { getWalletKey } from "./index";

export async function signHypercycleNonceWithWallet(
  nonce: string,
): Promise<{ success: boolean; signature?: string; error?: string }> {
  const trimmed = nonce?.trim();
  if (!trimmed) {
    return { success: false, error: "Nonce is empty." };
  }
  const key = getWalletKey();
  if (!key) {
    return {
      success: false,
      error:
        "No wallet private key in Mosaic. Import a Base wallet in Web3 settings to sign Hypercycle requests.",
    };
  }
  try {
    const formattedKey = (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
    const account = privateKeyToAccount(formattedKey);
    const signature = await account.signMessage({ message: trimmed });
    return { success: true, signature };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
