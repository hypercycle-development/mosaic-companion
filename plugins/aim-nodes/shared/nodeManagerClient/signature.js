import crypto from 'crypto';
export function stableBodyString(payload) {
    if (payload === undefined)
        return '';
    return JSON.stringify(payload);
}
export function computeHashedBody(bodyString) {
    const hash = crypto.createHash('sha256').update(bodyString, 'utf8').digest('hex');
    return hash;
}
export function buildSignedHeaders(headers, hashedBody) {
    const entries = [];
    // Include tx-* and currency-type in signed headers, but EXCLUDE:
    // - tx-signature (generated from these headers)
    // - tx-id and tx-value (payment proof headers, not part of the signed message)
    const excludeFromSigning = ['tx-signature', 'tx-id', 'tx-value'];
    const signedHeaderKeys = Object.keys(headers).filter((key) => (key.startsWith('tx-') || key === 'currency-type') && !excludeFromSigning.includes(key));
    for (const key of signedHeaderKeys) {
        entries.push([key, headers[key]]);
    }
    // Sort lexicographically by key
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    let result = entries.map(([k, v]) => `${k}: ${v}`).join('\n');
    // Append hash-body AFTER sorted headers (node manager expects it at the end)
    if (hashedBody) {
        result += `\nhash-body: ${hashedBody}`;
    }
    return result;
}
export function buildProtocol2Message({ method, uriPath, signedHeadersStr, }) {
    return `AIM ProtocolV2 Signature:\n${method}\n${uriPath}\n${signedHeadersStr}`;
}
export function buildBackendAuthHeaders({ sender, nonce, currencyType, txDriver, extraHeaders, }) {
    const baseHeaders = {
        'tx-sender': sender,
        'tx-origin': sender,
        'tx-nonce': nonce,
        'tx-protocol': '2',
        'currency-type': currencyType,
        'tx-driver': txDriver,
        'hypc-program': '',
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    if (extraHeaders) {
        // These tx-* headers are allowed as extras (payment proof)
        const allowedTxExtras = ['tx-id', 'tx-value'];
        for (const [key, value] of Object.entries(extraHeaders)) {
            // Prevent overwriting internal auth headers, but allow tx-id and tx-value through
            if (!baseHeaders[key] && (!key.startsWith('tx-') || allowedTxExtras.includes(key))) {
                baseHeaders[key] = value;
            }
        }
    }
    return baseHeaders;
}
