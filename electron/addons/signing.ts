/**
 * Pinned publisher public keys + registry signature verification (§6.7).
 * Ed25519, via Node's built-in `crypto` — no new dependency for signing.
 *
 * The app trusts a small pinned *list* of public keys, not one hardcoded
 * key, so a future rotation is additive (§6.7's rotation procedure).
 *
 * IMPORTANT: there is **no production key yet** — real key generation,
 * GitHub Actions secrets, and authenticated production distribution are all
 * still deferred (see the `mosaic-addons` README's GO-LIVE TODO). So
 * `PRODUCTION_PUBLISHER_KEYS` is deliberately empty and a packaged build
 * trusts nothing: every registry signature fails to verify, which is the
 * correct behaviour while no signed catalogue is published.
 *
 * The two keys below are **dev/test only and must never be trusted in a
 * packaged build**, because the *private* half of each is committed to a
 * repository:
 *   - `4b7d6575` — this repo's own dev/test key. Its private half is in
 *     `tests/addons/fixtures/test-signing-key.json`, in this public repo.
 *   - `78e2469a` — the `mosaic-addons` repo's test key, private half in
 *     `fixtures/test-signing-key.json` there (public once that repo is).
 *
 * Trusting either in a release build would mean anyone could sign a
 * registry the app accepts — and an accepted registry leads, via
 * `confirmInstall`, to running an addon's `main/index.js` in the main
 * process. Hence the `app.isPackaged` gate, which fails closed.
 */

import { app } from "electron";
import { createPublicKey, createHash, verify as cryptoVerify } from "crypto";

export interface TrustedPublisherKey {
  /** First 8 hex chars of sha256(SPKI DER public key bytes) — computed once at generation. */
  keyId: string;
  /** Ed25519 public key, SPKI/PEM. */
  publicKey: string;
  /** ISO date or app-version string — documentation only, not range-checked. */
  introducedAt: string;
  /** Set once a later release stops shipping this key — documentation only. */
  retiredAt: string | null;
}

/**
 * Real publisher keys. Empty until the production `mosaic-addons` key is
 * generated under §6.7's custody procedure and pinned here as its own dated
 * entry. Adding the first entry is what turns the signed catalogue on.
 */
export const PRODUCTION_PUBLISHER_KEYS: TrustedPublisherKey[] = [];

/**
 * Dev/test keys — trusted **only** in a non-packaged build. Both private
 * halves are committed in repositories (see the file header), so these can
 * never be trust anchors for a real user.
 */
export const DEV_ONLY_PUBLISHER_KEYS: TrustedPublisherKey[] = [
  {
    keyId: "4b7d6575",
    publicKey:
      "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAuAeK+e8ptNSBQ/+OVvZCsJ/A8ymeVyGpm/F+exyP/Kk=\n-----END PUBLIC KEY-----\n",
    introducedAt: "2026-07-15-dev-placeholder",
    retiredAt: null,
  },
  {
    // mosaic-addons repo's own test key (fixtures/test-signing-key.json
    // there) — not production. Trusted here so the real (private, testing)
    // addon-registry.json signed with it actually verifies.
    keyId: "78e2469a",
    publicKey:
      "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA9RhG7X2lcBlC7twv/emkK4tISJhtyGxQqjbOD5J4cs8=\n-----END PUBLIC KEY-----\n",
    introducedAt: "2026-07-15-mosaic-addons-test-key",
    retiredAt: null,
  },
];

/**
 * The keys this build actually trusts. Fails closed: if `app` is somehow
 * unavailable (imported outside Electron) `isPackaged` reads as `undefined`
 * and we treat the build as packaged, so only production keys apply — and
 * there are none yet.
 */
export function trustedPublisherKeys(): TrustedPublisherKey[] {
  const packaged = app?.isPackaged ?? true;
  return packaged ? PRODUCTION_PUBLISHER_KEYS : [...PRODUCTION_PUBLISHER_KEYS, ...DEV_ONLY_PUBLISHER_KEYS];
}

export interface RegistrySignatureEnvelope {
  keyId: string;
  signature: string; // base64
}

export interface VerifyRegistryResult {
  verified: boolean;
  keyId?: string;
  reason?: string;
}

/**
 * Verify `bytes` (the raw `addon-registry.json` file contents) against
 * `envelope`. Looks up `envelope.keyId` in the pinned list — **not found →
 * reject immediately**, no fallback to trying every pinned key, no silent
 * accept (§6.7). Only a passing signature check trusts the registry.
 */
export function verifyRegistry(bytes: Buffer | string, envelope: RegistrySignatureEnvelope): VerifyRegistryResult {
  if (!envelope || typeof envelope.keyId !== "string" || typeof envelope.signature !== "string") {
    return { verified: false, reason: "Malformed signature envelope" };
  }

  const pinned = trustedPublisherKeys().find((k) => k.keyId === envelope.keyId);
  if (!pinned) {
    return { verified: false, reason: `Unrecognized signing key "${envelope.keyId}"` };
  }

  let signatureBuf: Buffer;
  try {
    signatureBuf = Buffer.from(envelope.signature, "base64");
  } catch {
    return { verified: false, keyId: pinned.keyId, reason: "Malformed signature encoding" };
  }

  try {
    const keyObject = createPublicKey(pinned.publicKey);
    const data = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes;
    // Ed25519 verification via Node's crypto.verify — algorithm must be
    // `null` for Ed25519/Ed448 (the curve fixes the hash internally).
    const ok = cryptoVerify(null, data, keyObject, signatureBuf);
    if (!ok) return { verified: false, keyId: pinned.keyId, reason: "Signature does not match" };
    return { verified: true, keyId: pinned.keyId };
  } catch (error) {
    return { verified: false, keyId: pinned.keyId, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Exposed for test fixtures only — computes a keyId the same way key
 * generation does, so a test can double-check a generated key's id. */
export function computeKeyId(publicKeyPem: string): string {
  const keyObject = createPublicKey(publicKeyPem);
  const der = keyObject.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("hex").slice(0, 8);
}
