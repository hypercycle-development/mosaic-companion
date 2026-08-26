/**
 * Withdrawal decision logic, deliberately free of any Electron or filesystem
 * dependency so it can be tested directly.
 *
 * Two rules carry the security weight here, and both are easy to get subtly
 * wrong:
 *
 *  1. **Freshness.** A registry signature proves *who* wrote it, never *when*.
 *     Every registry ever signed verifies forever, so an attacker who controls
 *     what the app fetches can replay a pre-withdrawal registry and erase a
 *     withdrawal with no invalid signature anywhere. The monotonic sequence is
 *     what closes that, and it must be checked before a registry is allowed to
 *     touch persisted state.
 *
 *  2. **Reconciliation, not accumulation.** Withdrawals are replaced wholesale
 *     from each registry that passes the freshness gate, so omitting an entry
 *     lifts it. Accumulating instead would make every withdrawal permanent per
 *     client — an erroneous withdrawal, or an addon fixed and re-listed, could
 *     never be undone remotely, which pressures an operator into never using
 *     the mechanism at all.
 */

import semver from "semver";

export interface WithdrawalRecord {
  /** semver range. `"*"` withdraws every version — the default for security. */
  versions: string;
  reason: string;
  severity: "security" | "advisory";
  withdrawnAt: string;
  /** Registry sequence that carried this withdrawal — diagnostics only. */
  sequence: number;
}

export interface RawWithdrawalEntry {
  id?: unknown;
  versions?: unknown;
  reason?: unknown;
  severity?: unknown;
  withdrawnAt?: unknown;
}

/** Cap on publisher-supplied display text before it reaches the UI. Signed,
 * but a compromised key should not get free rein over app copy. */
export const MAX_WITHDRAWAL_REASON = 300;

export const DEFAULT_WITHDRAWAL_REASON = "Withdrawn by the catalogue publisher.";

/**
 * The prefix every withdrawal message carries, wherever it is produced.
 *
 * Two paths report the same fact — `activateAddon` refusing at startup, and
 * `enforceWithdrawals` deactivating mid-session — and they must read
 * identically, or the same withdrawal looks like two different faults. It is
 * also how a withdrawal-shaped `lastError` is recognised when a withdrawal is
 * lifted and the message has to be cleared, without clearing a real activation
 * failure that happens to be sitting there.
 */
export const WITHDRAWAL_ERROR_PREFIX = "Withdrawn by the catalogue publisher: ";

/** Days without a verified catalogue fetch before the UI says so. */
export const CATALOGUE_STALE_AFTER_DAYS = 7;

/**
 * Whether to warn that withdrawal notices cannot currently be received.
 *
 * `null` means no catalogue fetch has ever succeeded, and it deliberately does
 * NOT warn. Until the first catalogue is published that is every user alive, so
 * warning on it would put a security banner in front of the entire install base
 * on day one, about a risk none of them can act on. A null also cannot hide a
 * withdrawal that was already received: withdrawals are only ever persisted by
 * the same `fetchCatalogue` call that records the sync.
 */
export function isCatalogueStale(days: number | null): boolean {
  return days !== null && days >= CATALOGUE_STALE_AFTER_DAYS;
}

/**
 * Is a freshly-fetched registry acceptable against the highest sequence this
 * app has ever verified? Equal is accepted — that is a re-fetch of the same
 * release, not a rollback.
 *
 * A missing/malformed sequence reads as 0, so a legacy registry is accepted
 * only by an app that has never seen a sequenced one. Once a real sequence has
 * been recorded, an unsequenced registry can no longer displace it.
 */
export function isRegistryFresh(sequence: number, highestSeen: number): boolean {
  return sequence >= highestSeen;
}

/**
 * What a 404 at the pinned catalogue location actually means.
 *
 * Before the first catalogue is published, a 404 is the normal and expected
 * state: a key is pinned, so the fetch genuinely happens, and there is simply
 * nothing published there yet. Reporting that as an error makes an empty
 * catalogue read as a broken app.
 *
 * That window closes the first time a catalogue verifies, and this is the
 * distinction the first version of this check missed. Afterwards the app holds
 * persisted proof that a catalogue exists, so a 404 is no longer "nothing is
 * published" — it is the pinned location failing to serve what was there
 * before. That is precisely the threat model `isRegistryFresh` defends
 * against: a network position, a compromised host or a stale CDN edge, here
 * suppressing withdrawals the publisher has since issued. Telling that user
 * nothing is published is untrue, and telling them nothing at all leaves no
 * signal until the staleness banner at CATALOGUE_STALE_AFTER_DAYS — a silent
 * window measured in days.
 *
 * The registry and its signature are reported apart because a half-finished
 * publish — the registry uploaded, its signature not — is a publisher-side
 * fault that must not look like an empty catalogue either.
 *
 * Precondition: at least one of the two flags is true. The caller only reaches
 * here having seen a 404.
 */
export type CatalogueMiss =
  | { kind: "unpublished" }
  | { kind: "missing"; what: "registry" | "signature" | "both" };

export function classifyCatalogueMiss(
  registryMissing: boolean,
  signatureMissing: boolean,
  hasEverVerified: boolean,
): CatalogueMiss {
  if (!hasEverVerified) return { kind: "unpublished" };
  if (registryMissing && signatureMissing) return { kind: "missing", what: "both" };
  return { kind: "missing", what: registryMissing ? "registry" : "signature" };
}

export function readSequence(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Normalise the registry's `withdrawn` array into records keyed by addon id.
 * Malformed entries are skipped individually rather than failing the whole
 * registry — one bad entry must not discard the other withdrawals alongside it.
 *
 * Severity defaults to `security`: an unrecognised or absent severity must
 * never *downgrade* enforcement, because that turns a typo into a silent
 * un-withdrawal.
 */
export function normalizeWithdrawals(
  raw: unknown,
  sequence: number,
  now: () => string = () => new Date().toISOString(),
): Record<string, WithdrawalRecord> {
  if (!Array.isArray(raw)) return {};
  const out: Record<string, WithdrawalRecord> = {};
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as RawWithdrawalEntry;
    if (typeof entry.id !== "string" || entry.id.length === 0) continue;
    const severity: WithdrawalRecord["severity"] = entry.severity === "advisory" ? "advisory" : "security";
    const reason =
      typeof entry.reason === "string" && entry.reason.length > 0
        ? entry.reason.slice(0, MAX_WITHDRAWAL_REASON)
        : DEFAULT_WITHDRAWAL_REASON;
    out[entry.id] = {
      versions: typeof entry.versions === "string" && entry.versions.length > 0 ? entry.versions : "*",
      reason,
      severity,
      withdrawnAt: typeof entry.withdrawnAt === "string" ? entry.withdrawnAt : now(),
      sequence,
    };
  }
  return out;
}

/**
 * Does this withdrawal cover the given installed version?
 *
 * An unparseable range matches — fails **closed**. The alternative is that a
 * typo in a publisher's range silently leaves a withdrawn addon running, which
 * is the failure that actually hurts.
 */
export function matchesVersion(record: WithdrawalRecord, version: string): boolean {
  if (record.versions === "*") return true;
  // Validate both sides explicitly. `semver.satisfies` does NOT throw on
  // malformed input — it returns false — so a try/catch here would fail
  // *open*, silently un-withdrawing an addon because of a publisher's typo.
  // That was a real bug caught by tests/addons/withdrawal.test.ts.
  if (semver.validRange(record.versions) === null) return true;
  if (semver.valid(version) === null) return true;
  return semver.satisfies(version, record.versions);
}

/** The record covering this id+version, if any. */
export function findIn(
  withdrawals: Record<string, WithdrawalRecord>,
  id: string,
  version: string,
): WithdrawalRecord | undefined {
  const record = withdrawals[id];
  if (!record) return undefined;
  return matchesVersion(record, version) ? record : undefined;
}
