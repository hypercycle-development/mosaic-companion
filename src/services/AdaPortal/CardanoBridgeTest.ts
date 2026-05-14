/**
 * Runtime Verification Script for Cardano Bridge
 * Call this from DevTools console to verify the bridge is wired correctly:
 * 
 *   await window.testCardanoBridge()
 */

export async function testCardanoBridge(): Promise<Record<string, any>> {
  const results: Record<string, any> = {};

  // 1. Check preload bridge exists
  const hasBridge = typeof window.electronAPI?.cardano?.tokeoDetect === 'function';
  results.bridgeExposed = hasBridge;

  if (!hasBridge) {
    results.error = 'Bridge not exposed in preload. Check electron/preload.ts';
    return results;
  }

  // 2. Test tokeoDetect
  try {
    const detect = await window.electronAPI!.cardano!.tokeoDetect();
    results.tokeoDetect = detect;
    console.log('[Test] tokeoDetect:', detect);
  } catch (e: any) {
    results.tokeoDetect = { error: e.message };
  }

  // 3. Test tokeoQRPairing
  try {
    const qr = await window.electronAPI!.cardano!.tokeoQRPairing([
      'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46', // HPEC DAO PASS
      '454fb57214730cb34f83d7b377308a76ab6e7140ea634a7fc63affa5', // CMHPEC DAO PASS
      'bc963a07e32da4d22b77c8cba7ab9f3df6241f37d7bfc9b0deb48f65', // HyperDegens
    ]);
    results.tokeoQRPairing = qr;
    console.log('[Test] tokeoQRPairing:', qr);
  } catch (e: any) {
    results.tokeoQRPairing = { error: e.message };
  }

  // 4. Test tokeoCheckQR
  try {
    const sessionId = results.tokeoQRPairing?.data?.sessionId;
    const check = await window.electronAPI!.cardano!.tokeoCheckQR(sessionId);
    results.tokeoCheckQR = check;
    console.log('[Test] tokeoCheckQR:', check);
  } catch (e: any) {
    results.tokeoCheckQR = { error: e.message };
  }

  // 5. Test tokeoVerifyCollection
  try {
    const verify = await window.electronAPI!.cardano!.tokeoVerifyCollection([
      'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46',
      '454fb57214730cb34f83d7b377308a76ab6e7140ea634a7fc63affa5',
      'bc963a07e32da4d22b77c8cba7ab9f3df6241f37d7bfc9b0deb48f65',
    ], false);
    results.tokeoVerifyCollection = verify;
    console.log('[Test] tokeoVerifyCollection:', verify);
  } catch (e: any) {
    results.tokeoVerifyCollection = { error: e.message };
  }

  // 6. Test tokeoStatus
  try {
    const status = await window.electronAPI!.cardano!.tokeoStatus();
    results.tokeoStatus = status;
    console.log('[Test] tokeoStatus:', status);
  } catch (e: any) {
    results.tokeoStatus = { error: e.message };
  }

  console.log('[Test] All results:', results);
  return results;
}

// Expose globally for console testing
(window as any).testCardanoBridge = testCardanoBridge;
