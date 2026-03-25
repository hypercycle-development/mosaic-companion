/**
 * Hypercycle node LLM gateway
 *
 * Step 1: GET …/nonce — sender (+ TODA `currency-type` on direct node).
 * Step 2: POST …/api/aim/0/request — tx-driver, tx-sender, tx-nonce, tx-signature;
 *   JSON body: { messages: [{ role, content }], model }
 * Step 3: POST …/stream — same tx-* headers; JSON body: { token } from step 2 response.
 *
 * **TODA (direct):** node base `http://host` → ports 8000 / 8006 / 4001 on host.
 * **Basechain (hyperpg):** requests go through `https://hyperpg.site/forward/{targetHost}/8000|8006|4001/…`.
 * If you enter only a bare node host (e.g. `http://207.53.252.108`), it is rewritten to that forward
 * form automatically. If you already paste the full `…/forward/IP` URL, it is left as-is.
 */

import type { AIAgentConfig, ChatMessage } from '../types/ai';

/** Port for GET /nonce (appended to configured node base URL). */
export const HYPERCYCLE_NONCE_PORT = 8000;

/** Port for POST /api/aim/0/request (distinct from nonce port 8000). */
export const HYPERCYCLE_AIM_PORT = 8006;

export const HYPERCYCLE_AIM_PATH = '/api/aim/0/request';

/** Port for POST /stream (LLM token stream). */
export const HYPERCYCLE_STREAM_PORT = 4001;

export const HYPERCYCLE_STREAM_PATH = '/stream';

export const HYPERCYCLE_TX_DRIVER_DEFAULT = 'toda_micropay';

/** Placeholder until TODA micropay signing is wired */
export const HYPERCYCLE_TX_SIGNATURE_PLACEHOLDER = 'ndfndsofdn';

/** `tx-driver` for Basechain / hyperpg (EVM-signed nonce). */
export const HYPERCYCLE_TX_DRIVER_BASECHAIN = 'basechain';

export function isHypercycleBasechainConfig(
    config: Pick<AIAgentConfig, 'hypercycleBackend'>
): boolean {
    return config.hypercycleBackend === 'basechain';
}

/** Public hyperpg reverse-proxy origin (path continues with `/forward/{target}/8000` …). */
export const HYPERPG_FORWARD_ORIGIN = 'https://hyperpg.site';

/**
 * Basechain forward root: `https://hyperpg.site/forward/{targetHost}` (no trailing service port).
 * - Full forward URL in settings → returned unchanged (minus trailing slash).
 * - Bare `http(s)://target` or `target` → wrapped so traffic uses hyperpg, not direct `host/8000`.
 */
export function resolveHypercycleBasechainForwardRoot(raw: string): string {
    const t = raw.trim().replace(/\/$/, '');
    if (!t) {
        throw new Error('Hypercycle base URL is required.');
    }
    if (/\/forward\//i.test(t)) {
        return t;
    }
    const href = t.includes('://') ? t : `http://${t}`;
    let u: URL;
    try {
        u = new URL(href);
    } catch {
        throw new Error('Invalid Hypercycle Basechain base URL.');
    }
    if (!u.hostname) {
        throw new Error(
            'Basechain: use a target host/IP, or the full hyperpg URL including /forward/…'
        );
    }
    return `${HYPERPG_FORWARD_ORIGIN}/forward/${u.hostname}`;
}

export interface FetchHypercycleNonceOptions {
    /**
     * Resolved service base for GET /nonce (no `/nonce` suffix).
     * TODA: `http://host:8000`. Basechain: `https://hyperpg.site/forward/ip/8000`.
     */
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
 * Any port in the input is ignored; services use fixed ports 8000 / 8006 / 4001 unless overridden.
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

/** Full origin for the nonce service: `{protocol}//{hostname}:8000`. */
export function resolveHypercycleNonceServiceBaseUrl(nodeBase: string): string {
    const { protocol, hostname } = parseHypercycleNodeBase(nodeBase);
    return `${protocol}//${hostname}:${HYPERCYCLE_NONCE_PORT}`;
}

/** Resolved GET /nonce service base from agent config (TODA vs Basechain). */
export function resolveHypercycleNonceServiceBaseUrlForConfig(
    config: AIAgentConfig
): string {
    const raw = config.baseUrl?.trim();
    if (!raw) {
        throw new Error('Hypercycle base URL is required.');
    }
    if (isHypercycleBasechainConfig(config)) {
        const root = resolveHypercycleBasechainForwardRoot(raw);
        return `${root}/${HYPERCYCLE_NONCE_PORT}`;
    }
    return resolveHypercycleNonceServiceBaseUrl(raw);
}

/**
 * Base URL for AIM requests (port 8006). Uses `hypercycleAimBaseUrl` if set, else derived from
 * `baseUrl` and backend.
 */
export function resolveHypercycleAimBaseUrl(config: AIAgentConfig): string {
    const override = config.hypercycleAimBaseUrl?.trim();
    if (override) return override.replace(/\/$/, '');
    const nodeBase = config.baseUrl?.trim();
    if (!nodeBase) {
        throw new Error(
            'Hypercycle base URL is required to derive the AIM endpoint (port 8006).'
        );
    }
    if (isHypercycleBasechainConfig(config)) {
        const root = resolveHypercycleBasechainForwardRoot(nodeBase);
        return `${root}/${HYPERCYCLE_AIM_PORT}`;
    }
    try {
        const { protocol, hostname } = parseHypercycleNodeBase(nodeBase);
        return `${protocol}//${hostname}:${HYPERCYCLE_AIM_PORT}`.replace(
            /\/$/,
            ''
        );
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid URL.';
        throw new Error(`${msg} (AIM host)`);
    }
}

/** Message shape for POST /api/aim/0/request */
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
    const url = `${base}${HYPERCYCLE_AIM_PATH}`;
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
            model: 'claude-sonnet-4-5-20250929'
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
 * Base URL for POST /stream (port 4001). Override with `hypercycleStreamBaseUrl`, else derived
 * from `baseUrl` and backend.
 */
export function resolveHypercycleStreamBaseUrl(config: AIAgentConfig): string {
    const override = config.hypercycleStreamBaseUrl?.trim();
    if (override) return override.replace(/\/$/, '');
    const nodeBase = config.baseUrl?.trim();
    if (!nodeBase) {
        throw new Error(
            'Hypercycle base URL is required to derive the stream endpoint (port 4001).'
        );
    }
    if (isHypercycleBasechainConfig(config)) {
        const root = resolveHypercycleBasechainForwardRoot(nodeBase);
        return `${root}/${HYPERCYCLE_STREAM_PORT}`;
    }
    try {
        const { protocol, hostname } = parseHypercycleNodeBase(nodeBase);
        return `${protocol}//${hostname}:${HYPERCYCLE_STREAM_PORT}`.replace(
            /\/$/,
            ''
        );
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid URL.';
        throw new Error(`${msg} (stream host)`);
    }
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
