// ============================================
// 1AM WALLET WEBVIEW BRIDGE
// Electron-safe wallet detection via <webview>
// ============================================
//
// Problem: Browser extensions (1AM Wallet) can't inject into Electron's
// renderer when loading local files. They only inject into real web pages
// loaded in webviews or BrowserViews.
//
// Solution: Load a minimal bridge HTML in a hidden <webview>. The bridge page
// detects window.oneam, then posts messages back to the parent renderer.
//
// Usage in AdaPortalPanel.tsx:
//   import { OneAmWebviewBridge } from '../services/OneAmWebviewBridge';
//   <OneAmWebviewBridge onWalletDetected={...} />

const BRIDGE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>1AM Bridge</title>
  <script>
    // --- Bridge Logic ---
    const BRIDGE_VERSION = '1.0.0';
    let api = null;

    function postToParent(type, payload) {
      if (window.opener) {
        window.opener.postMessage({ source: '1am-bridge', type, payload }, '*');
      }
      // Also try Electron's IPC if available in the bridge context
      if (window.require) {
        try {
          const { ipcRenderer } = window.require('electron');
          ipcRenderer.sendToHost('1am-bridge', { type, payload });
        } catch (e) {}
      }
    }

    // --- Detection ---
    function detectWallet() {
      const provider = window.oneam || window.midnight;
      if (provider) {
        postToParent('detected', {
          name: '1AM Wallet',
          version: provider.version || 'unknown',
          is1AM: !!provider.is1AM,
        });
        return true;
      }
      postToParent('not-detected', {});
      return false;
    }

    // --- Connection ---
    async function connectWallet() {
      try {
        const provider = window.oneam || window.midnight;
        if (!provider) {
          postToParent('connect-error', { error: 'Wallet not detected' });
          return;
        }
        api = await provider.enable();
        const addresses = await api.getUsedAddresses();
        const address = addresses?.[0] || null;
        const network = await api.getNetworkId().catch(() => 'unknown');

        postToParent('connected', {
          address,
          network,
          name: '1AM Wallet',
        });
      } catch (err) {
        postToParent('connect-error', { error: err.message || 'Connection failed' });
      }
    }

    // --- Data Fetching ---
    async function fetchData() {
      if (!api) {
        postToParent('data-error', { error: 'Not connected' });
        return;
      }
      try {
        const balance = await api.getBalance();
        let night = 0, dust = 0;
        try { night = await api.getNightBalance(); } catch (e) {}
        try { dust = await api.getDustBalance(); } catch (e) {}

        postToParent('data', {
          lovelace: balance.lovelace || 0,
          night,
          dust,
          assets: balance.tokens || [],
        });
      } catch (err) {
        postToParent('data-error', { error: err.message });
      }
    }

    // --- Transaction Signing ---
    async function signTx(txHex, partialSign) {
      if (!api) {
        postToParent('sign-error', { error: 'Not connected' });
        return;
      }
      try {
        const signed = await api.signTx(txHex, partialSign);
        postToParent('signed', { signedTx: signed });
      } catch (err) {
        postToParent('sign-error', { error: err.message });
      }
    }

    async function submitTx(txHex) {
      if (!api) {
        postToParent('submit-error', { error: 'Not connected' });
        return;
      }
      try {
        const txHash = await api.submitTx(txHex);
        postToParent('submitted', { txHash });
      } catch (err) {
        postToParent('submit-error', { error: err.message });
      }
    }

    // --- Listen for commands from parent ---
    window.addEventListener('message', (event) => {
      const { data } = event;
      if (!data || data.source !== '1am-parent') return;

      switch (data.command) {
        case 'detect': detectWallet(); break;
        case 'connect': connectWallet(); break;
        case 'disconnect': api = null; postToParent('disconnected', {}); break;
        case 'fetchData': fetchData(); break;
        case 'signTx': signTx(data.txHex, data.partialSign); break;
        case 'submitTx': submitTx(data.txHex); break;
      }
    });

    // --- Auto-detect on load ---
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(detectWallet, 500); // Give extension time to inject
    });
  </script>
</head>
<body style="margin:0;padding:0;background:transparent;">
  <!-- Invisible bridge page -->
  <div id="status" style="display:none;">1AM Bridge</div>
</body>
</html>
`;

export { BRIDGE_HTML };
