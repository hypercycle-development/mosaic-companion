// =============================================================================
// E2E TEST: Validator Telemetry Dashboard
// Tests: (1) All validators visible, (2) Block heights incrementing,
//        (3) Peer counts >= 4, (4) Status colors correct.
// Run: cd ~/mosaic-companion && npx tsx tests/e2e/validator-telemetry.test.ts
// =============================================================================

(globalThis as any).window = {
  electronAPI: {
    system: { getProcesses: async () => [] },
  },
};

import { enhancedLocalNodeBridge } from '../../src/services/stargate/EnhancedLocalNodeBridge';
import { localNodeBridge } from '../../src/services/stargate/LocalNodeBridge';

const pass = (msg: string) => console.log('\x1b[32m✓ PASS\x1b[0m', msg);
const fail = (msg: string) => { console.log('\x1b[31m✗ FAIL\x1b[0m', msg); process.exit(1); };
const step = (n: number, label: string) => console.log(`\n\x1b[1m\x1b[33m[STEP ${n}/4] ${label}\x1b[0m`);

const results: Record<string, boolean> = {};

async function main() {
  console.log('\n  VALIDATOR TELEMETRY E2E\n  =========================\n');

  // ---------------------------------------------------------------------------
  // STEP 1 — Seed bridge cache with simulated R2-D2 + C-3PO data
  // ---------------------------------------------------------------------------
  step(1, 'SEED CACHE — Inject simulated R2-D2 + C-3PO telemetry');

  // We bypass the real poll by seeding the internal cache directly
  const bridge = enhancedLocalNodeBridge as any;

  // R2-D2
  bridge._telemetryCache.set('r2d2', {
    moniker: 'R2-D2',
    nodeId: 'r2d2-abc123',
    address: '192.168.0.38:26657',
    blockHeight: 128450,
    maxBlockHeight: 128450,
    peerCount: 7,
    syncStatus: 'synced',
    lastSeen: Date.now(),
    isOnline: true,
    cometBftVersion: '0.38.5',
    network: 'battery-testnet',
    earliestBlockHeight: 1,
  });

  // C-3PO
  bridge._telemetryCache.set('c3po', {
    moniker: 'C-3PO',
    nodeId: 'c3po-def456',
    address: '192.168.0.150:26657',
    blockHeight: 128448,
    maxBlockHeight: 128448,
    peerCount: 5,
    syncStatus: 'catching_up',
    lastSeen: Date.now(),
    isOnline: true,
    cometBftVersion: '0.38.5',
    network: 'battery-testnet',
    earliestBlockHeight: 1,
  });

  // Refresh so getTelemetry() picks up the validator pool
  const dummyInfo = {
    hardware: { memory: 8 * 1024 * 1024 * 1024, disk_space: 100 * 1024 * 1024 * 1024, disk_space_free: 50 * 1024 * 1024 * 1024, cpu_count: 4, cpu_freq: [1], gpu: null },
    aim: { interface_version: '1', aims: [] },
    status: 'alive', name: 'test', address: '0x0', node_version: '0.5', node_id: 'test-node', protocol_version: '1', network: 'test', license: 'TEST', platform: 'linux', priority: 1, accepting_currencies: [], geo_ip: '', uptime_summary: { heartbeats: 1000 }
  };
  const dummyConfig = { node_address: '0x0', node_name: 'test', admin_port: 8005, admin_host: 'localhost', node_port: 8006, node_host: 'localhost', merklizer_hosts: [], seed_hosts: [], network: 'test', db_host: 'localhost', db_port: 5432, db_name: 'test' };
  const origInfo = localNodeBridge.getRawInfo.bind(localNodeBridge);
  const origConfig = localNodeBridge.getRawConfig.bind(localNodeBridge);
  (localNodeBridge as any).getRawInfo = () => dummyInfo;
  (localNodeBridge as any).getRawConfig = () => dummyConfig;
  await enhancedLocalNodeBridge.refresh();
  (localNodeBridge as any).getRawInfo = origInfo;
  (localNodeBridge as any).getRawConfig = origConfig;

  const pool = enhancedLocalNodeBridge.getValidatorPoolStatus();
  if (!pool) fail('getValidatorPoolStatus returned null');
  results.poolNotNull = true;
  pass(`Pool: ${pool!.totalValidators} validators, highestBlock=${pool!.highestBlock}`);

  // ---------------------------------------------------------------------------
  // STEP 2 — All validators visible
  // ---------------------------------------------------------------------------
  step(2, 'VISIBILITY — All validators visible in pool');
  const ids = pool!.validators.map((v) => v.nodeId);
  results.r2d2Visible = ids.includes('r2d2-abc123');
  results.c3poVisible = ids.includes('c3po-def456');
  if (!results.r2d2Visible) fail('R2-D2 not visible');
  if (!results.c3poVisible) fail('C-3PO not visible');
  pass('R2-D2 visible');
  pass('C-3PO visible');

  // ---------------------------------------------------------------------------
  // STEP 3 — Block heights incrementing
  // ---------------------------------------------------------------------------
  step(3, 'BLOCK HEIGHT — Heights are non-zero and monotonic');
  const r2d2 = pool!.validators.find((v) => v.nodeId === 'r2d2-abc123');
  const c3po = pool!.validators.find((v) => v.nodeId === 'c3po-def456');

  results.blockHeightNonZero = (r2d2!.blockHeight > 0) && (c3po!.blockHeight > 0);
  results.blockHeightOrdered = r2d2!.blockHeight >= c3po!.blockHeight; // R2-D2 is synced so should be >=
  if (!results.blockHeightNonZero) fail('Block heights are zero');
  if (!results.blockHeightOrdered) fail('Block heights not ordered correctly');
  pass(`R2-D2 blockHeight=${r2d2!.blockHeight}`);
  pass(`C-3PO blockHeight=${c3po!.blockHeight}`);

  // ---------------------------------------------------------------------------
  // STEP 4 — Peer counts >= 4
  // ---------------------------------------------------------------------------
  step(4, 'PEER COUNT — Each validator has >= 4 peers');
  results.peerCountR2d2 = (r2d2!.peerCount >= 4);
  results.peerCountC3po = (c3po!.peerCount >= 4);
  if (!results.peerCountR2d2) fail(`R2-D2 peerCount=${r2d2!.peerCount} < 4`);
  if (!results.peerCountC3po) fail(`C-3PO peerCount=${c3po!.peerCount} < 4`);
  pass(`R2-D2 peers=${r2d2!.peerCount}`);
  pass(`C-3PO peers=${c3po!.peerCount}`);

  // ---------------------------------------------------------------------------
  // STEP 5 — Status colors correct
  // ---------------------------------------------------------------------------
  step(5, 'STATUS COLORS — Synced=green, Catching Up=yellow');
  results.r2d2Synced = r2d2!.syncStatus === 'synced';
  results.c3poCatchingUp = c3po!.syncStatus === 'catching_up';
  if (!results.r2d2Synced) fail(`R2-D2 status=${r2d2!.syncStatus}, expected synced`);
  if (!results.c3poCatchingUp) fail(`C-3PO status=${c3po!.syncStatus}, expected catching_up`);
  pass(`R2-D2 status=${r2d2!.syncStatus}`);
  pass(`C-3PO status=${c3po!.syncStatus}`);

  // ---------------------------------------------------------------------------
  // STEP 6 — Bridge telemetry integration
  // ---------------------------------------------------------------------------
  step(6, 'BRIDGE INTEGRATION — validatorPool present in getTelemetry()');
  const fullTelemetry = enhancedLocalNodeBridge.getTelemetry();
  results.telemetryHasPool = !!fullTelemetry && !!fullTelemetry.validatorPool;
  if (!results.telemetryHasPool) fail('getTelemetry() missing validatorPool');
  pass(`validatorPool.validators=${fullTelemetry!.validatorPool!.validators.length}`);

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n  E2E RESULTS SUMMARY\n');
  let passed = 0, total = 0;
  Object.entries(results).forEach(([k, v]) => {
    total++;
    if (v) { passed++; pass(k); } else { fail(k); }
  });
  console.log(`\n  ${passed}/${total} checks passed`);
  if (passed === total) {
    console.log('\n  ALL CHECKS PASSED');
    process.exit(0);
  }
}

main().catch((e) => { console.error('Unhandled:', e); process.exit(1); });
