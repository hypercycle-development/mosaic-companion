#!/usr/bin/env node
/**
 * REAL DEPLOYMENT VALIDATION — UI Pipeline Simulation
 * Executes full AimifierService pipeline against mosaic-hermes-aim:1.0.1
 * Collects timing metrics, stores persistent pipeline history.
 *
 * Run: node deploy-validate.js
 */

const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const http = require('http');

const execAsync = promisify(exec);

// =============================================================================
// TIMING + METRICS COLLECTOR
// =============================================================================
const METRICS = {
  startTime: Date.now(),
  stageTimings: {},
  logs: [],
  results: {},
};

function log(stage, msg) {
  const entry = `[${new Date().toISOString()}] [${stage}] ${msg}`;
  METRICS.logs.push(entry);
  console.log(entry);
}

function timeStage(stage, fn) {
  return async (...args) => {
    const t0 = Date.now();
    log(stage, `START`);
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

// =============================================================================
// MOCK HERMES SERVER (required target for AIM)
// =============================================================================
let mockHermes;
const MOCK_PORT = 13000;

async function startMockHermes() {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.writeHead(204); res.end(); return;
    }
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const reply = `Mock Hermes: ${parsed.messages?.[0]?.content || 'hello'}`;
          res.writeHead(200);
          res.end(JSON.stringify({ choices: [{ message: { content: reply } }] }));
        } catch {
          res.writeHead(400); res.end('{}');
        }
      });
    } else if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200); res.end(JSON.stringify({ status: 'ok', model: 'kimi-k2.6' }));
    } else {
      res.writeHead(404); res.end('{}');
    }
  });
  await new Promise((resolve) => server.listen(MOCK_PORT, '0.0.0.0', resolve));
  mockHermes = server;
  log('MOCK', `Hermes mock running on http://127.0.0.1:${MOCK_PORT}`);
}

async function stopMockHermes() {
  if (mockHermes) {
    await new Promise((resolve) => mockHermes.close(resolve));
    log('MOCK', 'Hermes mock stopped');
  }
}

// =============================================================================
// DOCKER HELPERS
// =============================================================================
function dockerExec(args, options = {}) {
  return new Promise((resolve) => {
    const { cwd, timeout = 300000 } = options;
    const proc = spawn('docker', args, { cwd, shell: false });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({ success: false, stdout, stderr: stderr + '\n[TIMEOUT]', exitCode: -1 });
    }, timeout);
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => {
      clearTimeout(timer);
      resolve({ success: code === 0, stdout, stderr, exitCode: code || 0 });
    });
  });
}

// =============================================================================
// PIPELINE STAGES (mirrors AimifierService logic)
// =============================================================================

const IMAGE_NAME = 'mosaic-hermes-aim';
const IMAGE_TAG = '1.0.2';
const CONTAINER_NAME = 'mosaic-hermes-aim-deploy-test';
const AIM_PORT = 14000;

async function stage_preflight() {
  const { success } = await dockerExec(['version', '--format', '{{.Server.Version}}']);
  if (!success) throw new Error('Docker not available');
  const { stdout } = await dockerExec(['images', IMAGE_NAME, '--format', '{{.Tag}}']);
  if (!stdout.includes(IMAGE_TAG)) throw new Error(`Image ${IMAGE_NAME}:${IMAGE_TAG} not found`);
  return { docker: true, image: `${IMAGE_NAME}:${IMAGE_TAG}` };
}

async function stage_startContainer() {
  // Remove any old test container
  await dockerExec(['rm', '-f', CONTAINER_NAME], { timeout: 10000 });
  const { success, stdout, stderr } = await dockerExec([
    'run', '-d', '--rm', '--name', CONTAINER_NAME,
    '-p', '14000:4000',
    '-e', 'HERMES_BASE_URL=http://host.docker.internal:13000',
    '-e', 'HERMES_MODEL=kimi-k2.6',
    '-e', 'PORT=4000',
    '--add-host=host.docker.internal:host-gateway',
    `${IMAGE_NAME}:${IMAGE_TAG}`
  ], { timeout: 60000 });
  if (!success) throw new Error(`Container start failed: ${stderr}`);
  const containerId = stdout.trim();
  // Wait for health
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const res = await fetch(`http://127.0.0.1:14000/health`);
      if (res.status === 200) break;
    } catch {}
  }
  return { containerId };
}

async function stage_testEndpoints() {
  const base = `http://127.0.0.1:${AIM_PORT}`;
  const tests = [];

  // 1. GET /manifest.json
  const mRes = await fetch(`${base}/manifest.json`);
  tests.push({ endpoint: '/manifest.json', method: 'GET', status: mRes.status });
  if (mRes.status !== 200) throw new Error(`manifest.json returned ${mRes.status}`);
  const manifest = await mRes.json();

  // 2. GET /capabilities
  const cRes = await fetch(`${base}/capabilities`);
  tests.push({ endpoint: '/capabilities', method: 'GET', status: cRes.status });

  // 3. POST /chat
  const chatRes = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello HyperCycle', system_prompt: 'Be helpful' })
  });
  tests.push({ endpoint: '/chat', method: 'POST', status: chatRes.status });
  if (chatRes.status !== 200) throw new Error(`/chat returned ${chatRes.status}`);
  const chatBody = await chatRes.json();

  // 4. cost_only header
  const costRes = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cost-only': 'true' },
    body: JSON.stringify({ message: 'cost test' })
  });
  tests.push({ endpoint: '/chat (cost_only)', method: 'POST', status: costRes.status });

  return { manifest, tests, chatResponse: chatBody.response };
}

async function stage_postDeploy(containerId) {
  // Collect container stats
  const { stdout } = await dockerExec(['stats', '--no-stream', '--format', '{{.CPUPerc}} {{.MemUsage}}', CONTAINER_NAME], { timeout: 10000 });
  return { stats: stdout.trim(), containerId };
}

async function stage_stopContainer() {
  await dockerExec(['stop', CONTAINER_NAME], { timeout: 30000 });
  return { stopped: true };
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  const HISTORY_DIR = path.join(__dirname, 'deployment-history');
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });

  console.log('='.repeat(70));
  console.log('HERMES AIM DEPLOYMENT VALIDATION — REAL UI PIPELINE SIMULATION');
  console.log(`Image: ${IMAGE_NAME}:${IMAGE_TAG}`);
  console.log(`Date:  ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  try {
    // STAGE 0: Mock Hermes
    await timeStage('MOCK_HERMES', startMockHermes)();

    // STAGE 1: PREFLIGHT
    const preflight = await timeStage('PREFLIGHT', stage_preflight)();
    METRICS.results.preflight = preflight;

    // STAGE 2: DEPLOY (start container)
    const deploy = await timeStage('DEPLOY', stage_startContainer)();
    METRICS.results.deploy = deploy;

    // STAGE 3: TEST ENDPOINTS
    const tests = await timeStage('TEST_ENDPOINTS', stage_testEndpoints)();
    METRICS.results.tests = tests;

    // STAGE 4: POST-DEPLOY MONITORING
    const monitor = await timeStage('POST_DEPLOY', stage_postDeploy)(deploy.containerId);
    METRICS.results.monitor = monitor;

    // STAGE 5: STOP
    const stop = await timeStage('STOP', stage_stopContainer)();
    METRICS.results.stop = stop;

    // STAGE 6: Stop mock
    await timeStage('MOCK_HERMES_STOP', stopMockHermes)();

    // Compile report
    const totalTime = Date.now() - METRICS.startTime;
    const report = {
      timestamp: new Date().toISOString(),
      image: `${IMAGE_NAME}:${IMAGE_TAG}`,
      totalTimeMs: totalTime,
      stageTimings: METRICS.stageTimings,
      results: METRICS.results,
      logs: METRICS.logs,
      success: true,
    };

    // Persist history
    const historyFile = path.join(HISTORY_DIR, `deploy-${Date.now()}.json`);
    fs.writeFileSync(historyFile, JSON.stringify(report, null, 2));

    // Also write latest summary
    const summaryFile = path.join(HISTORY_DIR, 'latest-deploy.json');
    fs.writeFileSync(summaryFile, JSON.stringify(report, null, 2));

    console.log('='.repeat(70));
    console.log('DEPLOYMENT VALIDATION: SUCCESS');
    console.log(`Total time: ${totalTime}ms`);
    console.log('Stage timings:');
    Object.entries(METRICS.stageTimings).forEach(([s, t]) => console.log(`  ${s}: ${t}ms`));
    console.log('Endpoint tests:');
    tests.tests.forEach(t => console.log(`  ${t.method} ${t.endpoint}: ${t.status}`));
    console.log(`History saved: ${historyFile}`);
    console.log('='.repeat(70));

    process.exit(0);
  } catch (err) {
    METRICS.results.error = err.message;
    const totalTime = Date.now() - METRICS.startTime;
    const report = {
      timestamp: new Date().toISOString(),
      image: `${IMAGE_NAME}:${IMAGE_TAG}`,
      totalTimeMs: totalTime,
      stageTimings: METRICS.stageTimings,
      results: METRICS.results,
      logs: METRICS.logs,
      success: false,
      error: err.message,
    };
    const HISTORY_DIR = path.join(__dirname, 'deployment-history');
    const historyFile = path.join(HISTORY_DIR, `deploy-${Date.now()}.json`);
    fs.writeFileSync(historyFile, JSON.stringify(report, null, 2));
    console.error('DEPLOYMENT VALIDATION: FAILED');
    console.error(`Error: ${err.message}`);
    console.error(`History saved: ${historyFile}`);
    await stopMockHermes();
    process.exit(1);
  }
}

main();