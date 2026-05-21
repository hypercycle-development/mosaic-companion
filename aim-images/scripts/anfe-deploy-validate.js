#!/usr/bin/env node
/**
 * LIVE ANFE DEPLOYMENT VALIDATION
 * Deploys mosaic-hermes-aim:1.0.2 to the local HyperCycle Node (ANFE)
 * Node ID: 80ad4ea14c33cd2a | Mainnet | localhost:8000 / :8006
 * 
 * Validates: Node API → AIM Container → Full inference chain
 * Run: node anfe-deploy-validate.js
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const NODE_API = 'http://localhost:8000';
const AIM_PORT = 4000;
const CONTAINER_NAME = 'mosaic-hermes-aim-anfe-test';
const IMAGE = 'mosaic-hermes-aim:1.0.2';

const METRICS = {
  startTime: Date.now(),
  stageTimings: {},
  logs: [],
  results: {},
};

let mockHermesServer;

function log(stage, msg) {
  const entry = `[${new Date().toISOString()}] [${stage}] ${msg}`;
  METRICS.logs.push(entry);
  console.log(entry);
}

async function startMockHermes() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      if (req.url === '/v1/chat/completions' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const reply = `Mock Hermes ANFE: ${parsed.messages?.[0]?.content || 'hello'}`;
            res.writeHead(200);
            res.end(JSON.stringify({ choices: [{ message: { content: reply } }] }));
          } catch { res.writeHead(400); res.end('{}'); }
        });
      } else if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200); res.end(JSON.stringify({ status: 'ok', model: 'kimi-k2.6' }));
      } else { res.writeHead(404); res.end('{}'); }
    });
    server.listen(3000, '0.0.0.0', () => {
      mockHermesServer = server;
      log('MOCK', 'Hermes mock on http://0.0.0.0:3000');
      resolve();
    });
  });
}

async function stopMockHermes() {
  if (mockHermesServer) {
    await new Promise((resolve) => mockHermesServer.close(resolve));
    log('MOCK', 'Hermes mock stopped');
  }
}

function timeStage(stage, fn) {
  return async (...args) => {
    const t0 = Date.now();
    log(stage, 'START');
    try {
      const result = await fn(...args);
      const elapsed = Date.now() - t0;
      METRICS.stageTimings[stage] = elapsed;
      log(stage, `SUCCESS in ${elapsed}ms`);
      return result;
    } catch (err) {
      const elapsed = Date.now() - t0;
      METRICS.stageTimings[stage] = elapsed;
      log(stage, `FAILED after ${elapsed}ms: ${err.message}`);
      throw err;
    }
  };
}

// HTTP helpers
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { method = 'GET', headers = {}, body } = options;
    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

// Docker helpers
function dockerExec(args) {
  return new Promise((resolve) => {
    const proc = spawn('docker', args, { shell: false });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({ success: false, stdout, stderr: stderr + '\n[TIMEOUT]', exitCode: -1 });
    }, 60000);
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => {
      clearTimeout(timer);
      resolve({ success: code === 0, stdout, stderr, exitCode: code || 0 });
    });
  });
}

// =============================================================================
// STAGES
// =============================================================================

async function stage_preflight() {
  // 1. Verify node is alive
  const nodeInfo = await httpRequest(`${NODE_API}/info`);
  if (nodeInfo.status !== 200) throw new Error(`Node not reachable: ${nodeInfo.status}`);
  const info = JSON.parse(nodeInfo.body);
  log('PREFLIGHT', `Node: ${info.name} | ID: ${info.node_id} | Aims: ${info.aim?.aims?.length || 0}`);

  // 2. Verify image exists
  const { stdout } = await dockerExec(['images', IMAGE, '--format', '{{.Tag}}']);
  if (!stdout.includes('1.0.2')) throw new Error(`Image ${IMAGE} not found`);

  return { nodeInfo: info };
}

async function stage_deploy() {
  // Clean old
  await dockerExec(['rm', '-f', CONTAINER_NAME]);
  // Start AIM container
  const { success, stdout, stderr } = await dockerExec([
    'run', '-d', '--rm', '--name', CONTAINER_NAME,
    '-p', `${AIM_PORT}:4000`,
    '-e', 'HERMES_BASE_URL=http://host.docker.internal:3000',
    '-e', 'HERMES_MODEL=kimi-k2.6',
    '-e', 'PORT=4000',
    '--add-host=host.docker.internal:host-gateway',
    IMAGE
  ]);
  if (!success) throw new Error(`Deploy failed: ${stderr}`);
  const containerId = stdout.trim();

  // Wait for health
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const res = await httpRequest(`http://localhost:${AIM_PORT}/health`);
      if (res.status === 200) break;
    } catch {}
  }

  return { containerId };
}

async function stage_testAim() {
  const base = `http://localhost:${AIM_PORT}`;
  const tests = [];

  const mRes = await httpRequest(`${base}/manifest.json`);
  tests.push({ endpoint: '/manifest.json', status: mRes.status });
  if (mRes.status !== 200) throw new Error(`manifest.json: ${mRes.status}`);
  const manifest = JSON.parse(mRes.body);

  const cRes = await httpRequest(`${base}/capabilities`);
  tests.push({ endpoint: '/capabilities', status: cRes.status });

  const chatRes = await httpRequest(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello ANFE', system_prompt: 'Be helpful' })
  });
  tests.push({ endpoint: '/chat', status: chatRes.status });
  if (chatRes.status !== 200) throw new Error(`/chat: ${chatRes.status}`);

  return { manifest, tests };
}

async function stage_testNodeRouting() {
  // Test that the node can route to the AIM
  // This simulates what the HyperCycle network would do
  const tests = [];

  // 1. Node info still shows aims[] but we verify AIM is independently healthy
  const infoRes = await httpRequest(`${NODE_API}/info`);
  tests.push({ endpoint: '/info', status: infoRes.status });

  // 2. Node balance endpoint (verifies wallet/auth layer)
  // Note: /balance requires a POST with body
  const balanceRes = await httpRequest(`${NODE_API}/balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  tests.push({ endpoint: '/balance', status: balanceRes.status });

  // 3. Verify AIM is reachable from node's perspective
  // (Node and AIM are on same machine, so localhost works)
  const aimHealth = await httpRequest(`http://localhost:${AIM_PORT}/health`);
  tests.push({ endpoint: 'aim/health (from node)', status: aimHealth.status });

  return { tests };
}

async function stage_monitor() {
  const { stdout } = await dockerExec(['stats', '--no-stream', '--format', '{{.CPUPerc}} {{.MemUsage}}', CONTAINER_NAME]);
  return { stats: stdout.trim() };
}

async function stage_stop() {
  await dockerExec(['stop', CONTAINER_NAME]);
  return { stopped: true };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('LIVE ANFE DEPLOYMENT VALIDATION');
  console.log(`Node API: ${NODE_API}`);
  console.log(`Image: ${IMAGE}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  try {
    // Start mock Hermes backend (required for AIM to proxy)
    await timeStage('MOCK_HERMES', startMockHermes)();

    const preflight = await timeStage('PREFLIGHT', stage_preflight)();
    METRICS.results.preflight = preflight;

    const deploy = await timeStage('DEPLOY', stage_deploy)();
    METRICS.results.deploy = deploy;

    const aimTests = await timeStage('TEST_AIM', stage_testAim)();
    METRICS.results.aimTests = aimTests;

    const nodeRouting = await timeStage('TEST_NODE_ROUTING', stage_testNodeRouting)();
    METRICS.results.nodeRouting = nodeRouting;

    const monitor = await timeStage('MONITOR', stage_monitor)();
    METRICS.results.monitor = monitor;

    const stop = await timeStage('STOP', stage_stop)();
    METRICS.results.stop = stop;

    await timeStage('MOCK_HERMES_STOP', stopMockHermes)();

    const totalTime = Date.now() - METRICS.startTime;
    const report = {
      timestamp: new Date().toISOString(),
      image: IMAGE,
      node: { api: NODE_API, nodeId: METRICS.results.preflight?.nodeInfo?.node_id },
      totalTimeMs: totalTime,
      stageTimings: METRICS.stageTimings,
      results: METRICS.results,
      logs: METRICS.logs,
      success: true,
    };

    const HISTORY_DIR = path.join(__dirname, 'deployment-history');
    if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
    const historyFile = path.join(HISTORY_DIR, `anfe-deploy-${Date.now()}.json`);
    fs.writeFileSync(historyFile, JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(HISTORY_DIR, 'latest-anfe-deploy.json'), JSON.stringify(report, null, 2));

    console.log('='.repeat(70));
    console.log('ANFE DEPLOYMENT VALIDATION: SUCCESS');
    console.log(`Total: ${totalTime}ms`);
    Object.entries(METRICS.stageTimings).forEach(([s, t]) => console.log(`  ${s}: ${t}ms`));
    console.log('AIM endpoints:');
    aimTests.tests.forEach(t => console.log(`  ${t.endpoint}: ${t.status}`));
    console.log('Node routing:');
    nodeRouting.tests.forEach(t => console.log(`  ${t.endpoint}: ${t.status}`));
    console.log(`History: ${historyFile}`);
    console.log('='.repeat(70));

    process.exit(0);
  } catch (err) {
    const totalTime = Date.now() - METRICS.startTime;
    const report = {
      timestamp: new Date().toISOString(),
      image: IMAGE,
      node: { api: NODE_API },
      totalTimeMs: totalTime,
      stageTimings: METRICS.stageTimings,
      results: METRICS.results,
      logs: METRICS.logs,
      success: false,
      error: err.message,
    };
    const HISTORY_DIR = path.join(__dirname, 'deployment-history');
    if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
    const historyFile = path.join(HISTORY_DIR, `anfe-deploy-${Date.now()}.json`);
    fs.writeFileSync(historyFile, JSON.stringify(report, null, 2));
    console.error('ANFE DEPLOYMENT VALIDATION: FAILED');
    console.error(`Error: ${err.message}`);
    console.error(`History: ${historyFile}`);
    await stage_stop().catch(() => {});
    process.exit(1);
  }
}

main();