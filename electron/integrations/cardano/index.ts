/**
 * Cardano Integration for Mosaic Companion
 * Exports: QR Session Manager, NFT Verifier, IPC Handlers
 */

export { qrSessionManager, TokeoQRSessionManager } from './TokeoQRBridge';
export { verifyPolicyOwnership, verifyPolicyOwnershipByStakeAddress, hasPolicyNFT } from './NFTVerifier';
export type { NFTVerificationResult, NFTAsset, KoiosConfig } from './NFTVerifier';
export { registerCardanoIpc } from './ipcHandlers';
// Legacy WebView bridge (kept for compatibility, but no longer used for Chrome)
export {
  bridgeDetectWallets,
  bridgeConnectWallet,
  bridgeSignTx,
  bridgeDisconnect,
  getBridgeState,
  isBridgeConnected,
  createBridgeWindow,
  showBridgeWindow,
  hideBridgeWindow,
  destroyBridgeWindow,
} from './CIP30WebViewBridge';

// Chrome/Brave/Edge bridge — spawns real browser window where extensions inject properly
export {
  isChromeInstalled,
  getChromeCommand,
  discoverChromeWallets,
  detectChromeWallets,
  connectChromeWallet,
  disconnectChromeWallet,
  signTxChrome,
} from './CIP30ChromeBridge';

// Firefox bridge
export {
  isFirefoxInstalled,
  detectFirefoxWallets,
  connectFirefoxWallet,
  disconnectFirefoxWallet,
} from './CIP30FirefoxBridge';
