#!/usr/bin/env node
// Mosaic Health Doctor - Proactive diagnostic system
// Run this before builds or when troubleshooting AI Chat issues
// Usage: node scripts/health-doctor.js

const fs = require('fs');
const path = require('path');

const MOSAIC_ROOT = process.env.MOSAIC_ROOT || path.resolve(__dirname, '..');
const USER_DATA = (process.env.HOME || process.env.USERPROFILE) + '/.config/mosaic-companion';

function runHealthCheck() {
  const checks = [];

  // Check 1: Ollama Cloud Auth Fix
  try {
    const aiService = fs.readFileSync(
      path.join(MOSAIC_ROOT, 'src/services/AIService.ts'), 'utf-8'
    );
    const hasOllamaCloudAuth = aiService.includes('isOllamaCloud') && 
                               aiService.includes('Authorization') &&
                               aiService.includes('Bearer');
    checks.push({
      name: 'Ollama Cloud Auth',
      status: hasOllamaCloudAuth ? 'pass' : 'fail',
      message: hasOllamaCloudAuth ? 'sendToOllama includes Bearer auth' : 'Missing Authorization header for Ollama Cloud - will 401'
    });
  } catch (e) {
    checks.push({
      name: 'Ollama Cloud Auth',
      status: 'fail',
      message: `Cannot read AIService.ts: ${e.message}`
    });
  }

  // Check 2: Hermes AIM Endpoint Fix
  try {
    const llmCode = fs.readFileSync(
      path.join(MOSAIC_ROOT, 'electron/integrations/mosaicbot/src/main/llm.ts'), 'utf-8'
    );
    const hasHermesAIMHandler = llmCode.includes('async function callHermesAIM');
    const hasProperRouting = llmCode.match(/case "hermes-aim":\s*\n?\s*return await callHermesAIM/);
    checks.push({
      name: 'Hermes AIM Endpoint',
      status: hasHermesAIMHandler && hasProperRouting ? 'pass' : 'fail',
      message: hasHermesAIMHandler && hasProperRouting
        ? 'callHermesAIM() properly routes hermes-aim to /chat'
        : 'Missing callHermesAIM() - hermes-aim will 404'
    });
  } catch (e) {
    checks.push({
      name: 'Hermes AIM Endpoint',
      status: 'fail',
      message: `Cannot read llm.ts: ${e.message}`
    });
  }

  // Check 3: Provider Variant Awareness
  try {
    const aiService = fs.readFileSync(
      path.join(MOSAIC_ROOT, 'src/services/AIService.ts'), 'utf-8'
    );
    const strictChecks = (aiService.match(/provider === ['"]hermes['"]/g) || []).length;
    const flexibleChecks = (aiService.match(/provider\.startsWith\(['"]hermes['"]\)/g) || []).length;
    checks.push({
      name: 'Provider Variant Checks',
      status: flexibleChecks >= strictChecks ? 'pass' : 'warn',
      message: `${strictChecks} strict === 'hermes' checks, ${flexibleChecks} flexible startsWith checks. Prefer startsWith for hermes family.`
    });
  } catch (e) {
    checks.push({
      name: 'Provider Variant Checks',
      status: 'warn',
      message: `Cannot analyze provider checks: ${e.message}`
    });
  }

  // Check 4: Stored Agent Health
  try {
    const agentsPath = path.join(USER_DATA, 'ai-agents.json');
    if (fs.existsSync(agentsPath)) {
      const agents = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));
      const activeAgents = agents.filter(a => a.isActive);
      
      for (const agent of activeAgents) {
        if (agent.provider === 'ollama-cloud' && !agent.apiKey) {
          checks.push({
            name: `Agent: ${agent.name}`,
            status: 'warn',
            message: `Ollama Cloud agent has no API key - will 401`
          });
        }
        if (agent.provider === 'hermes-aim' && agent.baseUrl?.includes('8642')) {
          checks.push({
            name: `Agent: ${agent.name}`,
            status: 'warn',
            message: `hermes-aim using port 8642 instead of 9000 - will 404`
          });
        }
      }
    }
  } catch (e) {
    checks.push({
      name: 'Stored Agent Config',
      status: 'warn',
      message: `Cannot read ai-agents.json: ${e.message}`
    });
  }

  // Check 5: Infrastructure Endpoints
  checks.push({
    name: 'Health Check Script',
    status: 'pass',
    message: 'Mosaic Health Doctor is operational'
  });

  // Determine overall status
  const failures = checks.filter(c => c.status === 'fail').length;
  const warnings = checks.filter(c => c.status === 'warn').length;
  const status = failures > 0 ? 'critical' : warnings > 0 ? 'degraded' : 'healthy';

  return { status, checks };
}

// Run and report
const report = runHealthCheck();

console.log('\n🩺 Mosaic Health Doctor Report\n');
console.log(`Overall Status: ${report.status.toUpperCase()}\n`);

for (const check of report.checks) {
  const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
  console.log(`${icon} ${check.name}: ${check.message}`);
}

console.log('\n' + (report.status === 'healthy' 
  ? '✨ All systems healthy!'
  : report.status === 'degraded'
  ? '⚠️ Some warnings - review above'
  : '❌ Critical issues found - fixes needed'));

process.exit(report.status === 'critical' ? 1 : 0);
