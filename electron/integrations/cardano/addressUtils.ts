/**
 * Cardano Address Utilities
 * Converts CBOR-hex encoded addresses (from CIP-30 getUsedAddresses)
 * to bech32 addr1... / addr_test1... format required by Koios API.
 */

let CardanoWasm: any = null;

async function initSerializationLib() {
  if (CardanoWasm) return CardanoWasm;
  try {
    CardanoWasm = await import('@emurgo/cardano-serialization-lib-asmjs');
    return CardanoWasm;
  } catch (e) {
    console.warn('[CardanoAddress] Failed to load serialization lib:', e);
    return null;
  }
}

/**
 * Detect if a string is CBOR hex (starts with hex prefix, no addr/bech32)
 */
function isCBORHexAddress(addr: string): boolean {
  if (!addr) return false;
  // bech32 addresses start with addr1, addr_test1, etc.
  if (addr.startsWith('addr')) return false;
  // CBOR hex is a long hex string (typically 100+ chars for addresses)
  return /^[0-9a-fA-F]+$/.test(addr) && addr.length >= 20;
}

/**
 * Convert a Cardano address (CBOR hex or bech32) to bech32 string.
 * Returns the input unchanged if already bech32.
 * Returns null if conversion fails.
 */
export async function toBech32Address(addr: string): Promise<string | null> {
  if (!addr) return null;

  // Already bech32 — pass through
  if (!isCBORHexAddress(addr)) {
    return addr;
  }

  const wasm = await initSerializationLib();
  if (!wasm) {
    console.warn('[CardanoAddress] WASM init failed, cannot decode CBOR hex');
    return null;
  }

  try {
    const bytes = Buffer.from(addr, 'hex');
    const cardanoAddr = wasm.Address.from_bytes(bytes);
    const bech32 = cardanoAddr.to_bech32();
    return bech32;
  } catch (err: any) {
    // Try old Byron addresses or other encodings
    try {
      const bytes = Buffer.from(addr, 'hex');
      const byronAddr = wasm.ByronAddress.from_bytes(bytes);
      return byronAddr.to_base58();
    } catch {
      console.warn('[CardanoAddress] Failed to decode address:', addr.slice(0, 20) + '...', err.message);
      return null;
    }
  }
}

/**
 * Synchronous fallback: attempts a quick decode.
 * Only works if the serialization lib is already loaded.
 */
export function toBech32AddressSync(addr: string): string | null {
  if (!addr || !isCBORHexAddress(addr)) return addr || null;
  if (!CardanoWasm) return null;
  try {
    const bytes = Buffer.from(addr, 'hex');
    return CardanoWasm.Address.from_bytes(bytes).to_bech32();
  } catch {
    return null;
  }
}
