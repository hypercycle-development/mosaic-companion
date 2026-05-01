/**
 * Hypercycle node LLM gateway
 *
 * Step 1: GET …/nonce — sender (+ TODA `currency-type` on direct node).
 * Step 2: POST …/api/aim/{index}/request (index from `hypercycleAimIndex`; default 0 TODA / 2 Basechain) — tx-driver, …
 *   JSON body: { messages: [{ role, content }], model }
 * Step 3: POST …/stream — same tx-* headers; JSON body: { token } from step 2 response.
 *
 * **Node base:** scheme + host (no path). TODA and Basechain both use direct `http://host:port` URLs.
 * **Balance:** `POST /balance` on the server port; `tx-sender` from `GET /info` (`tm` string or `tm.address`).
 */

import type { AIAgentConfig, ChatMessage } from '../types/ai';

/** Port for GET /nonce (TODA default). */
export const HYPERCYCLE_NONCE_PORT = 8000;

/** Port for POST `/api/aim/{index}/request` (TODA default). */
export const HYPERCYCLE_AIM_PORT = 8006;

/** Default AIM path when index is 0. */
export const HYPERCYCLE_AIM_PATH = '/api/aim/0/request';

/** Port for POST /stream (TODA default). */
export const HYPERCYCLE_STREAM_PORT = 4001;

/** Basechain Hypercycle defaults (server / app / stream). */
export const HYPERCYCLE_BASECHAIN_SERVER_PORT = 8010;
export const HYPERCYCLE_BASECHAIN_APP_PORT = 8016;
export const HYPERCYCLE_BASECHAIN_STREAM_PORT = 4102;

export const HYPERCYCLE_STREAM_PATH = '/stream';

/** GET /info on the server port — includes `tm` (balance `tx-sender`). */
export const HYPERCYCLE_INFO_PATH = '/info';

/** POST /balance on the server port — register prepaid balance after funding. */
export const HYPERCYCLE_BALANCE_PATH = '/balance';

export const HYPERCYCLE_TX_DRIVER_DEFAULT = 'toda_micropay';

/**
 * TODA DQ type hash for TDN (used by Mosaic Hypercycle funding `transfer_toda`, not the symbol).
 */
export const HYPERCYCLE_TODA_TDN_TYPE_HASH =
    '412964f209c966234250eba05d1a118da128925084df9f5459eb9243157e452e73';

/** Placeholder until TODA micropay signing is wired */
export const HYPERCYCLE_TX_SIGNATURE_PLACEHOLDER = 'ndfndsofdn';

/** `tx-driver` for Basechain (EVM-signed nonce). */
export const HYPERCYCLE_TX_DRIVER_BASECHAIN = 'basechain';

export function isHypercycleBasechainConfig(
    config: Pick<AIAgentConfig, 'hypercycleBackend'>
): boolean {
    return config.hypercycleBackend === 'basechain';
}

function clampPort(n: number | undefined, fallback: number): number {
    if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
    const i = Math.floor(n);
    if (i < 1 || i > 65535) return fallback;
    return i;
}

function defaultHypercycleServerPort(
    config: Pick<AIAgentConfig, 'hypercycleBackend'>
): number {
    return isHypercycleBasechainConfig(config)
        ? HYPERCYCLE_BASECHAIN_SERVER_PORT
        : HYPERCYCLE_NONCE_PORT;
}

function defaultHypercycleAppPort(
    config: Pick<AIAgentConfig, 'hypercycleBackend'>
): number {
    return isHypercycleBasechainConfig(config)
        ? HYPERCYCLE_BASECHAIN_APP_PORT
        : HYPERCYCLE_AIM_PORT;
}

function defaultHypercycleStreamPort(
    config: Pick<AIAgentConfig, 'hypercycleBackend'>
): number {
    return isHypercycleBasechainConfig(config)
        ? HYPERCYCLE_BASECHAIN_STREAM_PORT
        : HYPERCYCLE_STREAM_PORT;
}

/** Port for nonce, GET /info, POST /balance. TODA default 8000; Basechain 8010. */
export function getHypercycleServerPort(config: AIAgentConfig): number {
    return clampPort(
        config.hypercycleServerPort,
        defaultHypercycleServerPort(config)
    );
}

/** Port for AIM (`/api/aim/{index}/request`). TODA default 8006; Basechain 8016. */
export function getHypercycleAppPort(config: AIAgentConfig): number {
    return clampPort(config.hypercycleAppPort, defaultHypercycleAppPort(config));
}

const HYPERCYCLE_AIM_INDEX_MAX = 999;

/** When `hypercycleAimIndex` is unset. */
export const HYPERCYCLE_AIM_INDEX_DEFAULT_TODA = 0;
/** When `hypercycleAimIndex` is unset (Basechain LiteLLM gateway). */
export const HYPERCYCLE_AIM_INDEX_DEFAULT_BASECHAIN = 2;

function clampAimIndex(i: number): number {
    if (i < 0) return 0;
    if (i > HYPERCYCLE_AIM_INDEX_MAX) return HYPERCYCLE_AIM_INDEX_MAX;
    return i;
}

function normalizeHypercycleAimIndex(n: number | undefined): number {
    if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
    return clampAimIndex(Math.floor(n));
}

/** AIM route index for `POST /api/aim/{index}/request`. Default 0 (TODA) or 2 (Basechain) when unset. */
export function getHypercycleAimIndex(config: AIAgentConfig): number {
    const raw = config.hypercycleAimIndex;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return isHypercycleBasechainConfig(config)
            ? HYPERCYCLE_AIM_INDEX_DEFAULT_BASECHAIN
            : HYPERCYCLE_AIM_INDEX_DEFAULT_TODA;
    }
    return clampAimIndex(Math.floor(raw));
}

/** Path only, e.g. `/api/aim/2/request`. */
export function getHypercycleAimPath(config: AIAgentConfig): string {
    return `/api/aim/${getHypercycleAimIndex(config)}/request`;
}

/** Port for `/stream`. TODA default 4001; Basechain 4102. */
export function getHypercycleStreamPort(config: AIAgentConfig): number {
    return clampPort(
        config.hypercycleStreamPort,
        defaultHypercycleStreamPort(config)
    );
}

/** `currency-type` for POST /balance: USDC (Basechain), always TDN for TODA. */
export function getHypercycleBalanceCurrencyType(
    config: AIAgentConfig
): string {
    if (isHypercycleBasechainConfig(config)) return 'USDC';
    return 'TDN';
}

/** Default `model` in AIM JSON body (Anthropic id used by the Hypercycle gateway). */
export const HYPERCYCLE_DEFAULT_AIM_MODEL = 'claude-sonnet-4-5-20250929';

const LEGACY_HYPERCYCLE_PLACEHOLDER_MODELS = new Set([
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-4-5-20250929'
]);

/**
 * Stored agents may still have the old placeholder `hypercycle-node`; the gateway expects a real model id.
 */
export function resolveHypercycleAimModel(config: AIAgentConfig): string {
    const m = config.model?.trim() || '';
    if (!m || LEGACY_HYPERCYCLE_PLACEHOLDER_MODELS.has(m.toLowerCase())) {
        return HYPERCYCLE_DEFAULT_AIM_MODEL;
    }
    return m;
}

export interface FetchHypercycleNonceOptions {
    /** Resolved service base for GET /nonce (no `/nonce` suffix): `http://host:port`. */
    nonceServiceBaseUrl: string;
    /** TODA address or `0x` sender for `sender` header */
    sender: string;
    /** Value for `currency-type` when {@link sendCurrencyType} is true (default TDN). */
    currencyType?: string;
    /** When false, omit `currency-type` (Basechain). @default true */
    sendCurrencyType?: boolean;
}

export interface HypercycleNonceResult {
    /** Parsed JSON body when applicable */
    raw: unknown;
    /** Extracted nonce string */
    nonce: string;
}

/**
 * Normalize to TODA address string for Hypercycle `sender`.
 * Strips Twin URL / hostname wrappers (first label = address); otherwise returns the value unchanged.
 */
export function normalizeTodaAddressForHypercycleSender(value: string): string {
    const trimmed = value.trim();
    const label = '([^/?#:]+)'; // first DNS label — TODA address, not assumed hex
    let m = new RegExp(
        `^https?://${label}\\.tq\\.biz\\.todaq\\.net/?$`,
        'i'
    ).exec(trimmed);
    if (m) return m[1];
    m = new RegExp(`^${label}\\.tq\\.biz\\.todaq\\.net$`, 'i').exec(trimmed);
    if (m) return m[1];
    m = new RegExp(
        `^https?://${label}\\.hypercycle\\.biz\\.todaq\\.net/?$`,
        'i'
    ).exec(trimmed);
    if (m) return m[1];
    m = new RegExp(`^${label}\\.hypercycle\\.biz\\.todaq\\.net$`, 'i').exec(
        trimmed
    );
    if (m) return m[1];
    return trimmed;
}

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

async function resolveHypercycleBasechainSender(): Promise<string> {
    if (typeof window === 'undefined' || !window.electronAPI?.tools?.execute) {
        throw new Error(
            'Cannot resolve Basechain sender outside the Mosaic app.'
        );
    }
    const r = await window.electronAPI.tools.execute(
        'web3:get_wallet_address',
        {}
    );
    if (r?.success && r.data != null) {
        const d = r.data as { address?: string };
        const a = d.address?.trim();
        if (a && ETH_ADDRESS_RE.test(a)) return a;
    }
    throw new Error(
        'Basechain Hypercycle needs an Ethereum address. Import a Base wallet in Web3 and use Base or Base Sepolia as the active network.'
    );
}

/** Cached Twin GET /info `address` from Web3 config (no /info call). */
async function getTwinInfoAddressFromWeb3Config(): Promise<string | null> {
    const cfg = await window.electronAPI?.web3?.getConfig?.();
    if (!cfg || typeof cfg !== 'object') return null;
    const raw = (
        cfg as { networks?: { toda?: { twinInfoAddress?: string } } }
    ).networks?.toda?.twinInfoAddress?.trim();
    if (!raw) return null;
    const addr = normalizeTodaAddressForHypercycleSender(raw);
    return addr || null;
}

/** Derive TODA address string from Twin hostname first label (no HTTP). */
async function tryResolveTodaAddressFromTwinHostname(): Promise<string | null> {
    const cfg = await window.electronAPI?.web3?.getConfig?.();
    if (!cfg || typeof cfg !== 'object') return null;
    const host = (
        cfg as { networks?: { toda?: { twinHostname?: string } } }
    ).networks?.toda?.twinHostname?.trim();
    if (!host) return null;
    const addr = normalizeTodaAddressForHypercycleSender(host);
    return addr || null;
}

/**
 * Resolve `sender` for GET /nonce: Basechain = 0x wallet; TODA = Twin /info cache or TODA tool path.
 */
export async function resolveHypercycleSender(
    config: AIAgentConfig
): Promise<string> {
    if (isHypercycleBasechainConfig(config)) {
        return resolveHypercycleBasechainSender();
    }
    return resolveHypercycleTodaSender();
}

async function resolveHypercycleTodaSender(): Promise<string> {
    if (typeof window === 'undefined' || !window.electronAPI?.tools?.execute) {
        throw new Error('Cannot resolve TODA address outside the Mosaic app.');
    }

    const fromTwinInfo = await getTwinInfoAddressFromWeb3Config();
    if (fromTwinInfo) return fromTwinInfo;

    const r = await window.electronAPI.tools.execute(
        'web3:get_wallet_address',
        {}
    );
    if (r?.success && r.data != null) {
        const d = r.data as { address?: string; network?: string };
        if (d.network === 'TODA' && d.address?.trim()) {
            return normalizeTodaAddressForHypercycleSender(d.address);
        }
    }

    const fromHost = await tryResolveTodaAddressFromTwinHostname();
    if (fromHost) return fromHost;

    const err =
        typeof r?.error === 'string'
            ? r.error
            : 'Could not read TODA address from Web3.';
    throw new Error(
        `${err} Save Web3 → TODA (Twin hostname + API key) so the Twin /info address is cached, ` +
            `or switch the active network to TODA. Hypercycle expects the TODA address, not a Twin URL.`
    );
}

/**
 * Parse Hypercycle node base from settings: scheme + hostname only.
 * Any port in the input is ignored; use `hypercycleServerPort` / `hypercycleAppPort` / `hypercycleStreamPort`.
 */
export function parseHypercycleNodeBase(raw: string): {
    protocol: string;
    hostname: string;
} {
    const trimmed = raw.trim().replace(/\/$/, '');
    if (!trimmed) {
        throw new Error('Hypercycle node base URL is empty.');
    }
    const href = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
    let u: URL;
    try {
        u = new URL(href);
    } catch {
        throw new Error('Invalid Hypercycle node base URL.');
    }
    if (!u.hostname) {
        throw new Error('Hypercycle node base URL must include a hostname.');
    }
    return { protocol: u.protocol, hostname: u.hostname };
}

/** Full origin for the nonce service: `{protocol}//{hostname}:{serverPort}`. */
export function resolveHypercycleNonceServiceBaseUrl(
    nodeBase: string,
    serverPort: number = HYPERCYCLE_NONCE_PORT
): string {
    const { protocol, hostname } = parseHypercycleNodeBase(nodeBase);
    return `${protocol}//${hostname}:${serverPort}`;
}

/** Resolved GET /nonce service base from agent config (direct `host:port`, TODA and Basechain). */
export function resolveHypercycleNonceServiceBaseUrlForConfig(
    config: AIAgentConfig
): string {
    const raw = config.baseUrl?.trim();
    if (!raw) {
        throw new Error('Hypercycle base URL is required.');
    }
    const port = getHypercycleServerPort(config);
    return resolveHypercycleNonceServiceBaseUrl(raw, port);
}

/**
 * Base URL for AIM requests (app port: TODA 8006 / Basechain 8016 by default). Derived from `baseUrl` and backend.
 */
export function resolveHypercycleAimBaseUrl(config: AIAgentConfig): string {
    const nodeBase = config.baseUrl?.trim();
    if (!nodeBase) {
        throw new Error(
            'Hypercycle base URL is required to derive the AIM endpoint.'
        );
    }
    const port = getHypercycleAppPort(config);
    try {
        const { protocol, hostname } = parseHypercycleNodeBase(nodeBase);
        return `${protocol}//${hostname}:${port}`.replace(/\/$/, '');
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid URL.';
        throw new Error(`${msg} (AIM host)`);
    }
}

/** Message shape for POST /api/aim/{index}/request */
export interface HypercycleAimMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

/**
 * Map Mosaic chat messages to AIM API `messages` (role + content only).
 */
export function chatMessagesToHypercycleAimMessages(
    messages: ChatMessage[]
): HypercycleAimMessage[] {
    return messages
        .filter(
            (m) =>
                (m.role === 'user' ||
                    m.role === 'assistant' ||
                    m.role === 'system') &&
                typeof m.content === 'string'
        )
        .map((m) => ({
            role: m.role,
            content: m.content
        }));
}

export interface PostHypercycleAimRequestOptions {
    aimBaseUrl: string;
    /** TODA address or 0x — same as nonce `sender` / tx-sender */
    sender: string;
    nonce: string;
    messages: HypercycleAimMessage[];
    model: string;
    txSignature?: string;
    /** @default from {@link getHypercycleTxDriver} at call site */
    txDriver?: string;
    /** AIM path index (`/api/aim/{index}/request`). Omitted → 0. */
    aimIndex?: number;
}

export interface HypercycleAimRequestResult {
    ok: boolean;
    status: number;
    body: unknown;
    rawText: string;
}

/**
 * Step 2: register chat messages + model; returns gateway response (e.g. token for streaming step).
 */
export async function postHypercycleAimRequest(
    options: PostHypercycleAimRequestOptions
): Promise<HypercycleAimRequestResult> {
    const base = options.aimBaseUrl.trim().replace(/\/$/, '');
    const idx = normalizeHypercycleAimIndex(options.aimIndex);
    const url = `${base}/api/aim/${idx}/request`;
    if (!options.messages.length) {
        throw new Error(
            'Hypercycle AIM request requires at least one message.'
        );
    }

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
            'tx-driver':
                options.txDriver?.trim() ?? HYPERCYCLE_TX_DRIVER_DEFAULT,
            'tx-sender': options.sender.trim(),
            'tx-nonce': options.nonce.trim(),
            'tx-signature':
                options.txSignature?.trim() ||
                HYPERCYCLE_TX_SIGNATURE_PLACEHOLDER,
            'User-Agent': 'MosaicCompanion/1.0'
        },
        body: JSON.stringify({
            messages: options.messages,
            model: options.model?.trim() || HYPERCYCLE_DEFAULT_AIM_MODEL
        })
    });

    const rawText = await resp.text();
    let body: unknown = rawText;
    if (rawText.trim()) {
        try {
            body = JSON.parse(rawText) as unknown;
        } catch {
            body = rawText;
        }
    }

    return {
        ok: resp.ok,
        status: resp.status,
        body,
        rawText
    };
}

/**
 * Base URL for POST /stream (TODA 4001 / Basechain 4102 by default). Derived from `baseUrl` and backend.
 */
export function resolveHypercycleStreamBaseUrl(config: AIAgentConfig): string {
    const nodeBase = config.baseUrl?.trim();
    if (!nodeBase) {
        throw new Error(
            'Hypercycle base URL is required to derive the stream endpoint.'
        );
    }
    const port = getHypercycleStreamPort(config);
    try {
        const { protocol, hostname } = parseHypercycleNodeBase(nodeBase);
        return `${protocol}//${hostname}:${port}`.replace(/\/$/, '');
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid URL.';
        throw new Error(`${msg} (stream host)`);
    }
}

function parseInfoJson(body: unknown): unknown {
    if (body == null) return null;
    if (typeof body === 'string') {
        try {
            return JSON.parse(body) as unknown;
        } catch {
            return null;
        }
    }
    return body;
}

function extractTmObject(body: unknown): Record<string, unknown> | null {
    const parsed = parseInfoJson(body);
    if (parsed == null || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    const tm = o.tm ?? o.Tm;
    if (tm != null && typeof tm === 'object')
        return tm as Record<string, unknown>;
    return null;
}

/**
 * `GET /info` may return `tm` as a string or an object with `address` / `host_address` (see node gateway).
 * For balance `tx-sender`, prefer `tm.address` (then legacy fallbacks).
 */
function extractTmFromInfoBody(body: unknown): string | null {
    if (body == null) return null;
    const parsed = parseInfoJson(body);
    if (parsed == null) return null;
    if (typeof parsed === 'string') {
        try {
            return extractTmFromInfoBody(JSON.parse(parsed) as unknown);
        } catch {
            return null;
        }
    }
    if (typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    const tm = o.tm ?? o.Tm;
    if (typeof tm === 'string' && tm.trim()) return tm.trim();
    if (tm != null && typeof tm === 'object') {
        const t = tm as Record<string, unknown>;
        const addr = t.address;
        if (typeof addr === 'string' && addr.trim()) return addr.trim();
        const hostAddr = t.host_address;
        if (typeof hostAddr === 'string' && hostAddr.trim())
            return hostAddr.trim();
    }
    return null;
}

/** Twin URL for in-app `transfer_toda` (`tm.host_address`). */
function extractTmHostAddressFromInfoBody(body: unknown): string | null {
    const tm = extractTmObject(body);
    if (!tm) return null;
    const h = tm.host_address ?? tm.hostAddress;
    if (typeof h === 'string' && h.trim()) return h.trim();
    return null;
}

/** `0x` recipient if `tm.address` is an EVM address (Basechain USDC). */
function extractTmEvmAddressFromInfoBody(body: unknown): string | null {
    const tm = extractTmObject(body);
    if (!tm) return null;
    const addr = tm.address;
    if (typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr.trim())) {
        return addr.trim();
    }
    return null;
}

export interface HypercycleNodeInfoResult {
    ok: boolean;
    status: number;
    /** Resolved `tx-sender` from `GET /info` (`tm` string or `tm.address`). */
    tm?: string;
    /** `tm.host_address` — Twin URL for Mosaic TDN transfer. */
    tmHostAddress?: string;
    /** `tm.address` when it is a `0x` address — USDC recipient hint for Basechain. */
    tmEvmRecipient?: string;
    body: unknown;
    rawText: string;
}

/** `GET {serverBase}/info` on the configured server port. */
export async function fetchHypercycleNodeInfo(
    config: AIAgentConfig
): Promise<HypercycleNodeInfoResult> {
    const base = resolveHypercycleNonceServiceBaseUrlForConfig(config).replace(
        /\/$/,
        ''
    );
    const url = `${base}${HYPERCYCLE_INFO_PATH}`;
    const resp = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: '*/*',
            'User-Agent': 'MosaicCompanion/1.0'
        }
    });
    const rawText = await resp.text();
    let body: unknown = rawText;
    if (rawText.trim()) {
        try {
            body = JSON.parse(rawText) as unknown;
        } catch {
            body = rawText;
        }
    }
    const tm = extractTmFromInfoBody(body) ?? undefined;
    const tmHostAddress = extractTmHostAddressFromInfoBody(body) ?? undefined;
    const tmEvmRecipient = extractTmEvmAddressFromInfoBody(body) ?? undefined;
    return {
        ok: resp.ok,
        status: resp.status,
        tm,
        tmHostAddress,
        tmEvmRecipient,
        body,
        rawText
    };
}

export interface RegisterHypercycleBalanceParams {
    /** Amount sent (e.g. micro-units as in gateway examples). */
    txValue: string;
    /** Basechain: 0x tx hash. TODA: entry file id or binder-resolved id. */
    txId: string;
}

export interface RegisterHypercycleBalanceResult {
    ok: boolean;
    status: number;
    rawText: string;
}

/**
 * Step after funding: POST `/balance` on the server port with tx-* headers.
 * Loads `tx-sender` from `GET /info` field `tm`.
 */
export async function registerHypercycleBalance(
    config: AIAgentConfig,
    params: RegisterHypercycleBalanceParams
): Promise<RegisterHypercycleBalanceResult> {
    const info = await fetchHypercycleNodeInfo(config);
    if (!info.ok) {
        throw new Error(
            `Hypercycle GET /info failed (${info.status}): ${info.rawText.slice(0, 280)}`
        );
    }
    const txSender = info.tm?.trim();
    if (!txSender) {
        throw new Error(
            'Hypercycle /info did not return a usable `tm` (string or object with `address`) for tx-sender. Check the server port and response.'
        );
    }
    const base = resolveHypercycleNonceServiceBaseUrlForConfig(config).replace(
        /\/$/,
        ''
    );
    const url = `${base}${HYPERCYCLE_BALANCE_PATH}`;
    const txValue = params.txValue.trim();
    const txId = params.txId.trim();
    if (!txValue || !txId) {
        throw new Error('tx-value and tx-id are required.');
    }
    const currencyType = getHypercycleBalanceCurrencyType(config);
    const txDriver = getHypercycleTxDriver(config);
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
            'currency-type': currencyType,
            'tx-sender': txSender,
            'tx-value': txValue,
            'tx-driver': txDriver,
            'tx-id': txId,
            'User-Agent': 'MosaicCompanion/1.0'
        },
        body: JSON.stringify({})
    });
    const rawText = await resp.text();
    return { ok: resp.ok, status: resp.status, rawText };
}

/** First string (or object id field) in an `entryFiles` / `entry_files` array on this record only. */
function firstEntryFileFromRecord(o: Record<string, unknown>): string | null {
    const ef = o.entryFiles ?? o.entry_files;
    if (!Array.isArray(ef) || ef.length === 0) return null;
    const first = ef[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
    if (first && typeof first === 'object') {
        const r = first as Record<string, unknown>;
        for (const k of ['id', 'hash', 'fileId', 'entryId']) {
            const v = r[k];
            if (typeof v === 'string' && v.trim()) return v.trim();
        }
    }
    return null;
}

/**
 * Binder payloads are often an array of twists: `{ twistId, data: { entryFiles: ["…hash…"], … } }`.
 * Walk JSON so we match `entryFiles` under `data`, not only at the root.
 */
function findFirstEntryFileIdDeep(value: unknown, depth = 0): string | null {
    if (depth > 12 || value == null) return null;
    if (typeof value === 'object' && !Array.isArray(value)) {
        const hit = firstEntryFileFromRecord(value as Record<string, unknown>);
        if (hit) return hit;
        for (const v of Object.values(value as Record<string, unknown>)) {
            const nested = findFirstEntryFileIdDeep(v, depth + 1);
            if (nested) return nested;
        }
    }
    if (Array.isArray(value)) {
        for (const v of value) {
            const nested = findFirstEntryFileIdDeep(v, depth + 1);
            if (nested) return nested;
        }
    }
    return null;
}

function firstEntryFileFromBinder(obj: unknown): string | null {
    if (obj == null || typeof obj !== 'object') return null;
    const shallow = firstEntryFileFromRecord(obj as Record<string, unknown>);
    if (shallow) return shallow;
    return findFirstEntryFileIdDeep(obj);
}

/**
 * TODA: try to resolve balance `tx-id` as the first `entryFiles` entry from the node binder.
 * Binder JSON is often an array of twists like `{ twistId, data: { entryFiles: ["…"], entryType, … } }`.
 * Tries `GET {serverBase}/binder/{transferId}` (and alternates). Best-effort; paste manually if it fails.
 */
export async function resolveTodaBalanceTxIdFromHypercycleNode(
    config: AIAgentConfig,
    transferId: string
): Promise<string> {
    const id = transferId.trim();
    if (!id) throw new Error('Transfer id is empty.');
    const base = resolveHypercycleNonceServiceBaseUrlForConfig(config).replace(
        /\/$/,
        ''
    );
    const paths = [
        `${base}/binder/${encodeURIComponent(id)}`,
        `${base}/binder/tx/${encodeURIComponent(id)}`,
        `${base}/binder/transaction/${encodeURIComponent(id)}`,
        `${base}/binder/transactions/${encodeURIComponent(id)}`
    ];
    for (const url of paths) {
        const resp = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: '*/*',
                'User-Agent': 'MosaicCompanion/1.0'
            }
        });
        if (!resp.ok) continue;
        const text = await resp.text();
        let body: unknown = text;
        try {
            body = text.trim() ? (JSON.parse(text) as unknown) : text;
        } catch {
            body = text;
        }
        const entry = firstEntryFileFromBinder(body);
        if (entry) return entry;
    }
    throw new Error(
        'Could not read entryFiles from the node binder. Paste the tx-id (first entry file id) from your binder.'
    );
}

export function getHypercycleTxDriver(config: AIAgentConfig): string {
    const o = config.hypercycleTxDriver?.trim();
    if (o) return o;
    return isHypercycleBasechainConfig(config)
        ? HYPERCYCLE_TX_DRIVER_BASECHAIN
        : HYPERCYCLE_TX_DRIVER_DEFAULT;
}

/**
 * `tx-signature` header: manual override, else Basechain EIP-191 sign(nonce), else TODA placeholder.
 */
export async function resolveHypercycleTxSignature(
    config: AIAgentConfig,
    nonce: string
): Promise<string> {
    const manual = config.hypercycleTxSignature?.trim();
    if (manual) return manual;
    if (isHypercycleBasechainConfig(config)) {
        const sign = window.electronAPI?.web3?.signHypercycleNonce;
        if (typeof window === 'undefined' || typeof sign !== 'function') {
            throw new Error(
                'Basechain Hypercycle requires signing the nonce in the Mosaic app with your imported wallet.'
            );
        }
        const r = (await sign(nonce)) as {
            success?: boolean;
            signature?: string;
            error?: string;
        };
        if (!r?.success || !r.signature?.trim()) {
            throw new Error(
                r?.error || 'Failed to sign Hypercycle nonce with wallet.'
            );
        }
        return r.signature.trim();
    }
    return HYPERCYCLE_TX_SIGNATURE_PLACEHOLDER;
}

/** `tx-sender` for /stream when it differs from nonce/AIM (e.g. *.hypercycle.biz.todaq.net). */
export function txSenderForHypercycleStream(
    config: AIAgentConfig,
    primarySender: string
): string {
    return config.hypercycleStreamTxSender?.trim() || primarySender;
}

/**
 * Read session token from AIM POST JSON (field names vary by gateway).
 */
export function extractTokenFromAimResponse(body: unknown): string | null {
    if (body == null) return null;
    if (typeof body === 'string') {
        const t = body.trim();
        if (!t) return null;
        if (/^[a-f0-9-]{36}$/i.test(t)) return t;
        try {
            return extractTokenFromAimResponse(JSON.parse(t) as unknown);
        } catch {
            return null;
        }
    }
    if (typeof body !== 'object') return null;
    const o = body as Record<string, unknown>;
    for (const key of [
        'token',
        'Token',
        'access_token',
        'accessToken',
        'session_token',
        'sessionToken',
        'stream_token',
        'streamToken'
    ]) {
        const v = o[key];
        if (typeof v === 'string' && v.trim()) return v.trim();
    }
    if (o.data != null && typeof o.data === 'object') {
        const inner = extractTokenFromAimResponse(o.data);
        if (inner) return inner;
    }
    return null;
}

export interface HypercycleStreamCallbacks {
    onToken: (chunk: string) => void;
    onComplete: (fullText: string) => void;
    onError: (err: Error) => void;
}

function extractTextDeltaFromStreamJson(obj: unknown): string {
    if (obj == null || typeof obj !== 'object') return '';
    const p = obj as Record<string, unknown>;
    /** Hypercycle /stream SSE: `data: {"done": true}` */
    if (p.done === true) return '';
    /** Hypercycle /stream SSE: `data: {"token": "partial text…"}` */
    if (typeof p.token === 'string') return p.token;
    if (typeof p.text === 'string') return p.text;
    if (typeof p.content === 'string') return p.content;
    if (p.delta && typeof p.delta === 'object') {
        const d = p.delta as Record<string, unknown>;
        if (typeof d.text === 'string') return d.text;
        if (typeof d.content === 'string') return d.content;
    }
    if (
        p.type === 'content_block_delta' &&
        p.delta &&
        typeof p.delta === 'object'
    ) {
        const t = (p.delta as Record<string, unknown>).text;
        if (typeof t === 'string') return t;
    }
    const choices = p.choices;
    if (
        Array.isArray(choices) &&
        choices[0] &&
        typeof choices[0] === 'object'
    ) {
        const ch0 = choices[0] as Record<string, unknown>;
        const delta = ch0.delta as Record<string, unknown> | undefined;
        if (delta && typeof delta.content === 'string') return delta.content;
    }
    const candidates = p.candidates;
    if (
        Array.isArray(candidates) &&
        candidates[0] &&
        typeof candidates[0] === 'object'
    ) {
        const c0 = candidates[0] as Record<string, unknown>;
        const content = c0.content as Record<string, unknown> | undefined;
        const parts = content?.parts as unknown[] | undefined;
        if (Array.isArray(parts) && parts[0] && typeof parts[0] === 'object') {
            const t = (parts[0] as Record<string, unknown>).text;
            if (typeof t === 'string') return t;
        }
    }
    return '';
}

export interface HypercycleStreamPostOptions {
    streamBaseUrl: string;
    sender: string;
    nonce: string;
    token: string;
    txSignature?: string;
    txDriver?: string;
}

function buildHypercycleStreamFetch(options: HypercycleStreamPostOptions): {
    url: string;
    init: RequestInit;
} {
    const base = options.streamBaseUrl.trim().replace(/\/$/, '');
    const url = `${base}${HYPERCYCLE_STREAM_PATH}`;
    return {
        url,
        init: {
            method: 'POST',
            headers: {
                Accept: '*/*',
                'Content-Type': 'application/json',
                'tx-driver': options.txDriver ?? HYPERCYCLE_TX_DRIVER_DEFAULT,
                'tx-sender': options.sender.trim(),
                'tx-nonce': options.nonce.trim(),
                'tx-signature':
                    options.txSignature?.trim() ||
                    HYPERCYCLE_TX_SIGNATURE_PLACEHOLDER,
                'User-Agent': 'MosaicCompanion/1.0'
            },
            body: JSON.stringify({ token: options.token.trim() })
        }
    };
}

/**
 * Verify POST /stream accepts the session (reads one chunk, then cancels). Use in connection tests
 * so we do not wait for the full model output.
 */
export async function probeHypercycleStream(
    options: HypercycleStreamPostOptions
): Promise<void> {
    const { url, init } = buildHypercycleStreamFetch(options);
    const resp = await fetch(url, init);
    const errText = await resp.clone().text();
    if (!resp.ok) {
        throw new Error(
            `Hypercycle stream failed (${resp.status}): ${errText || resp.statusText}`
        );
    }
    if (!resp.body) return;
    const reader = resp.body.getReader();
    try {
        await reader.read();
    } finally {
        await reader.cancel().catch(() => {});
    }
}

/**
 * Step 3: POST /stream with { token }; read SSE `data:` lines. Hypercycle sends
 * `data: {"token":"…"}` per chunk and `data: {"done":true}` to finish; other JSON shapes
 * still fall through for compatibility.
 */
export async function consumeHypercycleStream(options: {
    streamBaseUrl: string;
    sender: string;
    nonce: string;
    token: string;
    txSignature?: string;
    txDriver?: string;
    callbacks: HypercycleStreamCallbacks;
}): Promise<string> {
    const { url, init } = buildHypercycleStreamFetch(options);
    const resp = await fetch(url, init);

    const errText = await resp.clone().text();
    if (!resp.ok) {
        throw new Error(
            `Hypercycle stream failed (${resp.status}): ${errText || resp.statusText}`
        );
    }

    if (!resp.body) {
        const t = errText;
        options.callbacks.onComplete(t);
        return t;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let lineBuffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            lineBuffer += decoder.decode(value, { stream: true });
            const lines = lineBuffer.split('\n');
            lineBuffer = lines.pop() ?? '';

            for (const rawLine of lines) {
                const line = rawLine.replace(/\r$/, '');
                const trimmed = line.trim();
                if (!trimmed) continue;

                if (trimmed.startsWith('data:')) {
                    const data = trimmed.replace(/^data:\s?/, '').trim();
                    if (data === '[DONE]' || data === '[end]') continue;
                    try {
                        const parsed = JSON.parse(data) as unknown;
                        if (
                            parsed != null &&
                            typeof parsed === 'object' &&
                            (parsed as Record<string, unknown>).done === true
                        ) {
                            continue;
                        }
                        const piece = extractTextDeltaFromStreamJson(parsed);
                        if (piece) {
                            full += piece;
                            options.callbacks.onToken(piece);
                        }
                    } catch {
                        if (data) {
                            full += data;
                            options.callbacks.onToken(data);
                        }
                    }
                } else {
                    try {
                        const parsed = JSON.parse(trimmed) as unknown;
                        if (
                            parsed != null &&
                            typeof parsed === 'object' &&
                            (parsed as Record<string, unknown>).done === true
                        ) {
                            continue;
                        }
                        const piece = extractTextDeltaFromStreamJson(parsed);
                        if (piece) {
                            full += piece;
                            options.callbacks.onToken(piece);
                        }
                    } catch {
                        full += trimmed;
                        options.callbacks.onToken(
                            trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`
                        );
                    }
                }
            }
        }

        if (lineBuffer.trim()) {
            const trimmed = lineBuffer.trim();
            let payload = trimmed;
            if (trimmed.startsWith('data:')) {
                payload = trimmed.replace(/^data:\s?/, '').trim();
            }
            try {
                const parsed = JSON.parse(payload) as unknown;
                if (
                    parsed != null &&
                    typeof parsed === 'object' &&
                    (parsed as Record<string, unknown>).done === true
                ) {
                    // stream finished; no text
                } else {
                    const piece = extractTextDeltaFromStreamJson(parsed);
                    if (piece) {
                        full += piece;
                        options.callbacks.onToken(piece);
                    } else if (!trimmed.startsWith('data:')) {
                        full += lineBuffer;
                        options.callbacks.onToken(lineBuffer);
                    }
                }
            } catch {
                full += lineBuffer;
                options.callbacks.onToken(lineBuffer);
            }
        }

        options.callbacks.onComplete(full);
        return full;
    } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        options.callbacks.onError(err);
        throw err;
    }
}

function extractNonce(data: unknown): string | null {
    if (data == null) return null;
    if (typeof data === 'string') {
        const t = data.trim();
        return t || null;
    }
    if (typeof data === 'number' || typeof data === 'boolean') {
        return String(data);
    }
    if (typeof data !== 'object') return null;
    const o = data as Record<string, unknown>;
    for (const key of [
        'nonce',
        'Nonce',
        'request_nonce',
        'requestNonce',
        'value'
    ]) {
        const v = o[key];
        if (typeof v === 'string' && v.trim()) return v.trim();
        if (typeof v === 'number') return String(v);
    }
    if (o.data != null && typeof o.data === 'object') {
        return extractNonce(o.data);
    }
    return null;
}

/**
 * Request a fresh nonce from the Hypercycle node.
 */
export async function fetchHypercycleNonce(
    options: FetchHypercycleNonceOptions
): Promise<HypercycleNonceResult> {
    const base = options.nonceServiceBaseUrl.trim().replace(/\/$/, '');
    const url = `${base}/nonce`;
    const sender = options.sender.trim();
    if (!sender) {
        throw new Error('Hypercycle sender header is required.');
    }

    const sendCurrencyType = options.sendCurrencyType !== false;
    const headers: Record<string, string> = {
        Accept: '*/*',
        'Content-Type': 'application/json',
        sender,
        'User-Agent': 'MosaicCompanion/1.0'
    };
    if (sendCurrencyType) {
        headers['currency-type'] = options.currencyType?.trim() || 'TDN';
    }

    const resp = await fetch(url, {
        method: 'GET',
        headers
    });

    const text = await resp.text();
    if (!resp.ok) {
        throw new Error(
            `Hypercycle nonce failed (${resp.status}): ${text || resp.statusText}`
        );
    }

    let raw: unknown = text;
    if (text.trim()) {
        try {
            raw = JSON.parse(text) as unknown;
        } catch {
            raw = text.trim();
        }
    }

    const nonce = extractNonce(raw);
    if (!nonce) {
        throw new Error(
            'Hypercycle /nonce response did not contain a recognizable nonce. Raw: ' +
                (text.length > 200 ? `${text.slice(0, 200)}…` : text)
        );
    }

    return { raw, nonce };
}
