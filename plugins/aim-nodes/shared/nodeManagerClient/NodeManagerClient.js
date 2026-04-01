import { NodeManagerError, PaymentRequiredError, InvalidNonceError } from './errors';
import { stableBodyString, computeHashedBody, buildSignedHeaders, buildProtocol2Message, buildBackendAuthHeaders, } from './signature';
// Import hypercyclejs dynamically or cleanly to support frontend
// Use require or dynamic import for environments lacking window.ethereum
let hypercyclejs;
try {
    hypercyclejs = require('hypercyclejs');
}
catch (e) {
    // Ignored - frontend or handled externally
}
export class NodeManagerClient {
    baseUrl;
    mode;
    signer;
    fetchImpl;
    defaultCurrencyType;
    defaultTxDriver;
    logger;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
        this.mode = options.mode;
        this.signer = options.signer;
        this.fetchImpl = options.fetchImpl || fetch;
        this.defaultCurrencyType = options.defaultCurrencyType || 'USDC';
        this.defaultTxDriver = options.defaultTxDriver || 'ethereum';
        this.logger = options.logger || console;
        if (this.mode === 'backend_viem' && !this.signer) {
            throw new Error('NodeManagerClient requires a signer in backend_viem mode.');
        }
    }
    async getInfo() {
        const url = `${this.baseUrl}/info`;
        const response = await this.fetchImpl(url);
        if (!response.ok) {
            const text = await response.text();
            throw new NodeManagerError(`Failed to fetch info: ${response.status}`, response.status, url, text);
        }
        return response.json();
    }
    async getNonce(sender) {
        const url = `${this.baseUrl}/nonce`;
        const response = await this.fetchImpl(url, {
            method: 'GET',
            headers: {
                'sender': sender,
                'tx-sender': sender,
                'tx-origin': sender,
                'tx-protocol': '2',
                'currency-type': this.defaultCurrencyType,
                'tx-driver': this.defaultTxDriver,
                'hypc-program': '',
                'Content-Type': 'application/json'
            },
        });
        if (!response.ok) {
            const text = await response.text();
            throw new NodeManagerError(`Failed to fetch nonce: ${response.status}`, response.status, url, text);
        }
        const data = await response.json();
        if (!data || typeof data.nonce !== 'string') {
            throw new NodeManagerError('Invalid response format for nonce', response.status, url, data);
        }
        return data.nonce;
    }
    async handleResponseError(response, url) {
        const status = response.status;
        let bodyText = '';
        let bodyJson = null;
        try {
            bodyText = await response.text();
            bodyJson = JSON.parse(bodyText);
        }
        catch (e) {
            // Ignored
        }
        if (status === 402) {
            throw new PaymentRequiredError('Payment Required', status, url, bodyJson || bodyText, this.defaultCurrencyType, this.defaultTxDriver);
        }
        if ((status === 400 || status === 401) && bodyText.toLowerCase().includes('nonce')) {
            throw new InvalidNonceError('Invalid nonce detected', status, url, bodyJson || bodyText);
        }
        throw new NodeManagerError(`Node manager error: ${status}`, status, url, bodyJson || bodyText);
    }
    /**
     * Fetch the user's balance on the node manager for a given currency.
     * Returns the parsed balance response (includes balance per sender per currency).
     */
    async getBalance(sender) {
        const url = `${this.baseUrl}/balance`;
        const response = await this.fetchImpl(url, {
            method: 'GET',
            headers: {
                'tx-sender': sender,
                'tx-origin': sender,
                'currency-type': this.defaultCurrencyType,
                'tx-driver': this.defaultTxDriver,
                'hypc-program': '',
                'ngrok-skip-browser-warning': 'true',
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            const text = await response.text();
            throw new NodeManagerError(`Failed to fetch balance: ${response.status}`, response.status, url, text);
        }
        return response.json();
    }
    /**
     * Fetch cost estimate for an AIM endpoint using cost_only headers.
     * No authentication/nonce/signature required — the node skips auth for cost_only.
     * Returns the parsed cost data from the node.
     */
    async getCostEstimate(args) {
        const { slot, actionPath, payload = {}, currencyType = this.defaultCurrencyType, txDriver = this.defaultTxDriver, } = args;
        const uriPath = `/aim/${slot}/${actionPath.replace(/^\/+/, '')}`;
        const url = `${this.baseUrl}${uriPath}`;
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'cost_only': '1',
            'cost-only': '1',
            'currency-type': currencyType,
            'tx-driver': txDriver,
            'hypc-program': '',
            'ngrok-skip-browser-warning': 'true',
        };
        const bodyString = JSON.stringify(payload);
        const response = await this.fetchImpl(url, {
            method: 'POST',
            headers,
            body: bodyString,
        });
        if (!response.ok) {
            const text = await response.text();
            throw new NodeManagerError(`Failed to fetch cost estimate: ${response.status}`, response.status, url, text);
        }
        return response.json();
    }
    async callAim(args, isRetry = false) {
        const { slot, actionPath, method = 'POST', payload = {}, extraHeaders = {}, currencyType = this.defaultCurrencyType, txDriver = this.defaultTxDriver, costOnly = false, sender: frontendSender, } = args;
        const uriPath = `/aim/${slot}/${actionPath.replace(/^\/+/, '')}`;
        const url = `${this.baseUrl}${uriPath}`;
        // Apply costOnly if specified by conventions
        let requestPayload = { ...payload };
        if (costOnly) {
            requestPayload.costOnly = true;
        }
        try {
            if (this.mode === 'frontend_hypercyclejs') {
                if (!frontendSender) {
                    throw new Error('Sender address must be provided in frontend mode.');
                }
                if (!hypercyclejs || !hypercyclejs.aimFetch) {
                    throw new Error('hypercyclejs is not available for frontend mode.');
                }
                // Action URI manipulation according to hypercyclejs expectations
                const actionUri = `/${actionPath.replace(/^\/+/, '')}`;
                const response = await hypercyclejs.aimFetch(frontendSender, this.baseUrl, String(slot), method, actionUri, extraHeaders, JSON.stringify(requestPayload), {}, // options
                txDriver);
                if (!response.ok) {
                    await this.handleResponseError(response, url);
                }
                const data = await response.json();
                return { status: response.status, data, raw: response };
            }
            else {
                // backend_viem
                const sender = await this.signer.getAddress();
                const nonce = await this.getNonce(sender);
                console.log(`[NMClient] callAim: sender=${sender}, nonce=${nonce}`);
                console.log(`[NMClient] callAim: url=${url}, method=${method}, currencyType=${currencyType}, txDriver=${txDriver}`);
                const headersPreSig = buildBackendAuthHeaders({
                    sender,
                    nonce,
                    currencyType,
                    txDriver,
                    extraHeaders,
                });
                const bodyString = stableBodyString(requestPayload);
                const hashedBody = computeHashedBody(bodyString);
                const signedHeadersStr = buildSignedHeaders(headersPreSig, hashedBody);
                const message = buildProtocol2Message({
                    method,
                    uriPath,
                    signedHeadersStr,
                });
                // Debug: log the full Protocol V2 message and its components
                console.log(`[NMClient] === SIGNATURE DEBUG ===`);
                console.log(`[NMClient] Body string (first 200 chars): ${bodyString.slice(0, 200)}`);
                console.log(`[NMClient] Body hash: ${hashedBody}`);
                console.log(`[NMClient] Signed headers string:\n${signedHeadersStr}`);
                console.log(`[NMClient] Full message to sign:\n${message}`);
                console.log(`[NMClient] === END MESSAGE ===`);
                const signature = await this.signer.signMessage(message);
                // Debug: log signature details
                console.log(`[NMClient] Signature: length=${signature?.length}, value=${signature?.slice(0, 10)}...${signature?.slice(-6)}`);
                if (!signature || signature.length < 130) {
                    console.log(`[NMClient] ⚠️ WARNING: Signature too short! Full: ${signature}`);
                }
                const finalHeaders = { ...headersPreSig, 'tx-signature': signature };
                // Debug: log all tx-* headers being sent
                const txHeaders = Object.entries(finalHeaders).filter(([k]) => k.startsWith('tx-') || k === 'currency-type');
                console.log(`[NMClient] Headers being sent:`, txHeaders.map(([k, v]) => `${k}: ${k === 'tx-signature' ? v.slice(0, 10) + '...' : v}`).join(', '));
                const response = await this.fetchImpl(url, {
                    method,
                    headers: finalHeaders,
                    body: method === 'POST' ? bodyString : undefined,
                });
                console.log(`[NMClient] Response status: ${response.status}`);
                if (!response.ok) {
                    const errorText = await response.clone().text();
                    console.log(`[NMClient] Error response body: ${errorText.slice(0, 300)}`);
                    await this.handleResponseError(response, url);
                }
                const data = await response.json();
                return { status: response.status, data, raw: response };
            }
        }
        catch (error) {
            if (error instanceof InvalidNonceError && !isRetry) {
                // Retry exactly once
                this.logger.warn(`Invalid nonce detected for ${url}. Retrying once.`);
                return this.callAim(args, true);
            }
            throw error;
        }
    }
}
