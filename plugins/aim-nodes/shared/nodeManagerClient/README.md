# NodeManagerClient

This module provides a unified interface to make paid AIM tool calls to Hypercycle Node Managers. It abstracts the complexities of Protocol-2 cryptographic signing, nonce fetching/retry, and handles structured errors (such as translating `402 Payment Required` into easily catchable exceptions).

## Required Config
You must provide the following to create the client or use the MCP wrapper:
- `nodeUrl` (string): e.g. `http://<ip>:8000`
- `currencyType` (string): e.g. `USDC`
- `txDriver` (string): e.g. `ethereum`

## Modes of Operation

### Frontend Mode (`frontend_hypercyclejs`)
In the frontend/renderer environments, we delegate the heavy lifting to `hypercyclejs.aimFetch`. This allows the client to trigger wallet extensions (like MetaMask) automatically.

### Backend Mode (`backend_viem`)
In Node/Electron `main` process or MCP layers where `window.ethereum` does not exist, we manually execute the strict Protocol-2 signing.

**Exact Signature Construction used in backend mode:**
1. Hashed Body = `sha256(JSON.stringify(payload))` (hex output).
2. Protocol-2 String:
   ```text
   {METHOD}
   {URI_PATH}
   {HASHED_BODY}
   {SIGNED_HEADERS}
   ```
   *Note: `SIGNED_HEADERS` are alphabetically sorted keys (starting with `tx-` and `currency-type`, EXCLUDING `tx-signature`) joined with newlines.*

## Example Usage

### Via Client Instance
```ts
import { NodeManagerClient, PaymentRequiredError, InvalidNonceError } from './nodeManagerClient';

const client = new NodeManagerClient({
  baseUrl: 'http://node.url:8000',
  mode: 'backend_viem',
  signer: myViemSignerInstance
});

try {
  const { data } = await client.callAim({
    slot: 0,
    actionPath: 'request',
    payload: { query: 'Hello world' }
  });
  console.log('Success:', data);
} catch (error) {
  if (error instanceof PaymentRequiredError) {
    console.error('Needs funding!', error.payment);
  } else if (error instanceof InvalidNonceError) {
    console.error('Nonce failed even after retry.');
  } else {
    throw error;
  }
}
```

### Via MCP Wrapper
```ts
import { aimCallPaid } from './nodeManagerClient';

try {
  const result = await aimCallPaid({
    nodeUrl: 'http://node.url:8000',
    slot: 0,
    actionPath: 'request',
    payload: { foo: 'bar' },
    mode: 'backend_viem',
    signer: myViemSignerInstance
  });
} catch (error) {
  // Handle 402 deposit logic
}