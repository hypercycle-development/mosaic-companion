// Test script for RPC Resilience implementation
// Run with: npx ts-node src/services/StargatePool/test-resilience.ts

import {
  calculateBackoffDelay,
  checkRPCEndpoint,
  hotRouteCache,
  withRetry,
  executeWithFallback,
} from './RPCResilience';

import {
  alchemyKeyManager,
  getRPCEndpoints,
} from './AlchemyKeyManager';

import {
  rpcCall,
  isDegradedMode,
  enterDegradedMode,
  exitDegradedMode,
  getDegradedModeStatus,
  doctorCheck,
  resetGlobalCircuit,
  debugCircuitState,
} from './SharedRPCLimiter';

// Test 1: Backoff calculation
console.log('=== Test 1: Exponential Backoff ===');
for (let i = 0; i < 5; i++) {
  const delay = calculateBackoffDelay(1000, i);
  console.log(`  Attempt ${i}: delay = ${Math.round(delay)}ms`);
}

// Test 2: Hot route cache
console.log('\n=== Test 2: Hot Route Cache ===');
hotRouteCache.recordSuccess('base', 'https://base.publicnode.com', 150);
const bestEndpoint = hotRouteCache.getBestEndpoint('base', ['https://base.publicnode.com', 'https://base-rpc.publicnode.com']);
console.log(`  Best endpoint for base: ${bestEndpoint}`);

// Test 3: Alchemy key manager
console.log('\n=== Test 3: Alchemy Key Manager ===');
const migrationStatus = alchemyKeyManager.getMigrationStatus();
console.log(`  Using demo key: ${migrationStatus.usingDemo}`);
console.log(`  Has Ethereum key: ${migrationStatus.hasEthereumKey}`);
console.log(`  Has Base key: ${migrationStatus.hasBaseKey}`);

// Test 4: Degraded mode
console.log('\n=== Test 4: Degraded Mode ===');
console.log(`  Is Ethereum degraded: ${isDegradedMode('ethereum')}`);
console.log(`  Is Base degraded: ${isDegradedMode('base')}`);

// Test 5: RPC endpoints
console.log('\n=== Test 5: RPC Endpoints ===');
const ethEndpoints = getRPCEndpoints('ethereum');
const baseEndpoints = getRPCEndpoints('base');
console.log(`  Ethereum endpoints: ${ethEndpoints.length}`);
console.log(`  Base endpoints: ${baseEndpoints.length}`);

// Test 6: Doctor check (requires network)
async function runDoctorCheck() {
  console.log('\n=== Test 6: Doctor Check ===');
  try {
    const check = await doctorCheck();
    console.log(`  Timestamp: ${new Date(check.timestamp).toISOString()}`);
    console.log(`  Alchemy using demo: ${check.alchemy.usingDemoKey}`);
    console.log(`  Healthy endpoints: ${check.summary.healthy}`);
    console.log(`  Unhealthy endpoints: ${check.summary.unhealthy}`);
    console.log(`  Degraded chains: ${check.summary.degraded}`);
    
    for (const chain of check.chains) {
      console.log(`\n  ${chain.chain.toUpperCase()}:`);
      console.log(`    Degraded: ${chain.degraded}`);
      console.log(`    Endpoints: ${chain.endpoints.length}`);
      for (const ep of chain.endpoints.slice(0, 3)) {
        console.log(`      ${ep.url}: ${ep.healthy ? 'HEALTHY' : 'UNHEALTHY'} (${Math.round(ep.latencyMs)}ms) ${ep.error ? `- ${ep.error}` : ''}`);
      }
    }
  } catch (err) {
    console.log(`  Error: ${err}`);
  }
}

// Run async tests
runDoctorCheck().then(() => {
  console.log('\n=== All tests completed ===');
}).catch(console.error);

// Test 7: Circuit debug
console.log('\n=== Test 7: Circuit Debug ===');
const debug = debugCircuitState();
console.log(debug.split('\n').slice(0, 10).join('\n'));

// Test 8: Retry wrapper
async function testRetry() {
  console.log('\n=== Test 8: Retry Wrapper ===');
  let attemptCount = 0;
  try {
    await withRetry(
      async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Simulated failure');
        }
        return 'success';
      },
      {
        maxRetries: 3,
        baseDelayMs: 100,
        onRetry: (err, attempt, delay) => {
          console.log(`  Retry ${attempt}/3 after ${delay}ms: ${err.message}`);
        },
      }
    );
    console.log('  Retry test passed!');
  } catch (err) {
    console.log(`  Retry test failed: ${err}`);
  }
}

testRetry().catch(console.error);
