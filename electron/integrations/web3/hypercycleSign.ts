/**
 * EIP-191 sign a UTF-8 string with the Mosaic-stored EVM wallet (Base / Base Sepolia private key).
 * Used for Hypercycle Basechain `tx-signature` (signed nonce).
 */

import { privateKeyToAccount } from "viem/accounts";
import { withWalletKey } from "./index";

export async function signHypercycleNonceWithWallet(
  nonce: string,
): Promise<{ success: boolean; signature?: string; error?: string }> {
  const trimmed = nonce?.trim();
  if (!trimmed) {
    return { success: false, error: "Nonce is empty." };
  }
  try {
    const signature = await withWalletKey(async (formattedKey) => {
      const account = privateKeyToAccount(formattedKey);
      return account.signMessage({ message: trimmed });
    });
    return { success: true, signature };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "No wallet configured") {
      return {
        success: false,
        error:
          "No wallet private key in Mosaic. Import a Base wallet in Web3 settings to sign Hypercycle requests.",
      };
    }
    return { success: false, error: msg };
  }
}
