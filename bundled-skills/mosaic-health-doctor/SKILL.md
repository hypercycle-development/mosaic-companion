---
name: mosaic-health-doctor
description: Proactive health monitoring and diagnostic system for Mosaic Companion. Detects common AI Chat, provider routing, and infrastructure issues before they cause failures.
trigger: Run when starting Mosaic Companion, after configuration changes, or when AI Chat/agent connectivity issues are suspected.
---

# Mosaic Health Doctor 🩺

Proactive diagnostic system that catches common failure patterns before they surface as user-facing errors.

## Quick Health Check

```bash
# Run from mosaic-companion directory
npm run health:check 2>/dev/null || npx ts-node scripts/health-doctor.ts
```

## Automated Detection Patterns

### Pattern 1: Ollama Cloud Auth Misconfiguration ⛅

**Detects:** 401 Unauthorized errors from `api.ollama.com`

**Symptoms:**
- Browser console: `Ollama error (model: X): Unauthorized`
- AI Chat fails with cloud models (Ada, Byron)
- Local Ollama works fine

**Root Cause:** `sendToOllama()` called without Authorization header for cloud endpoints.

**Detection Logic:**
```typescript
// Check ai-agents.json for ollama-cloud without proper auth awareness
const agents = JSON.parse(fs.readFileSync(AGENTS_PATH, 'utf-8'));
const cloudAgents = agents.filter(a => a.provider === 'ollama-cloud');

for (const agent of cloudAgents) {
  // Verify auth header will be sent
  const isOllamaCloud = agent.baseUrl?.includes('api.ollama.com');
  if (isOllamaCloud && !agent.apiKey) {
    warn(`Agent ${agent.name}: Ollama Cloud configured without API key - will 401`);
  }
}
```

**Prevention:** Verify AIService.ts has the auth header fix (lines 192-200).

---

### Pattern 2: Hermes AIM Endpoint Mismatch 🎯

**Detects:** 404 Not Found from `hermes-aim` provider

**Symptoms:**
- Main process: `[MosaicBot/LLM] Call failed (hermes-aim): Error: Hermes 404:`
- Heartbeat failing every 30 minutes
- `hermes` and `hermes-api` work fine

**Root Cause:** `callHermes()` uses `/v1/chat/completions` but `hermes-aim` uses `/chat`.

**Detection Logic:**
```typescript
// Check llm.ts has separate handler for hermes-aim
const llmCode = fs.readFileSync('electron/integrations/mosaicbot/src/main/llm.ts', 'utf-8');

const hasHermesAIMHandler = llmCode.includes('async function callHermesAIM');
const hermesAimRouting = llmCode.match(/case "hermes-aim":\s*\n?\s*return await callHermesAIM/);

if (!hasHermesAIMHandler || !hermesAimRouting) {
  fail('llm.ts missing callHermesAIM() - hermes-aim will 404');
}
```

**Prevention:** Verify separate `callHermesAIM()` function exists and is routed correctly.

---

### Pattern 3: Provider Variant Confusion 🔄

**Detects:** Strict `=== 'hermes'` checks that exclude `hermes-aim` and `hermes-api`

**Symptoms:**
- UI components not recognizing valid Hermes agents
- "Discover & Connect" button disabled incorrectly
- Agents missing from dropdowns

**Detection Logic:**
```typescript
// Scan for strict provider checks
const files = [
  'src/components/HermesAimPanel.tsx',
  'src/components/KanbanDashboard.tsx', 
  'src/components/AIAgentsSettings.tsx',
  'src/services/AIService.ts'
];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  const strictChecks = content.match(/provider === ['"]hermes['"]/g);
  if (strictChecks && !content.includes("hermes-aim") && !content.includes("hermes-api")) {
    warn(`${file}: Strict === 'hermes' check may exclude hermes-aim/hermes-api`);
  }
}
```

**Prevention:** Use `provider.startsWith('hermes')` or explicit OR checks.

---

### Pattern 4: Port/Endpoint Mismatch 📡

**Detects:** Wrong port or endpoint for provider variants

| Provider | Correct Port | Correct Endpoint | Wrong Pattern |
|----------|-------------|------------------|---------------|
| `hermes` | 8642 | `/v1/chat/completions` | Hardcoded 9000 |
| `hermes-api` | 8642 | `/v1/chat/completions` | Hardcoded 9000 |
| `hermes-aim` | **9000** | **`/chat`** | `/v1/chat/completions` |
| `ollama` | 11434 | `/api/chat` | `/v1/chat/completions` |
| `ollama-cloud` | api.ollama.com | `/api/chat` + Bearer | No auth header |

**Detection Logic:**
```typescript
// Check stored agent configs match expected patterns
for (const agent of agents) {
  if (agent.provider === 'hermes-aim') {
    const baseUrl = agent.baseUrl || 'http://127.0.0.1:9000';
    if (!baseUrl.includes('9000') && !baseUrl.includes('9000')) {
      warn(`Agent ${agent.name}: hermes-aim should use port 9000, got ${baseUrl}`);
    }
  }
}
```

---

### Pattern 5: Missing IPC Handlers 🔌

**Detects:** Preload channels without matching main process handlers

**Symptoms:**
- UI buttons appear functional but do nothing
- Silent failures with no error
- `window.electronAPI?.stargate?.X()` returns undefined

**Detection Logic:**
```typescript
// Extract all exposed channels from preload.ts
const preloadChannels = extractIpcChannels('electron/preload.ts');

// Extract all handled channels from main.ts and integration files
const mainChannels = [
  ...extractIpcHandlers('electron/main.ts'),
  ...extractIpcHandlers('electron/integrations/sandbox/index.ts'),
  ...extractIpcHandlers('electron/integrations/mcp/index.ts'),
];

// Find orphans
const orphans = preloadChannels.filter(c => !mainChannels.includes(c));
if (orphans.length > 0) {
  fail(`Dead IPC channels (exposed but not handled): ${orphans.join(', ')}`);
}
```

---

## Health Check Script

Create `scripts/health-doctor.ts`:

```typescript
#!/usr/bin/env ts-node
// Mosaic Health Doctor - Proactive diagnostic system

import fs from 'fs';
import path from 'path';

const MOSAIC_ROOT = path.resolve(__dirname, '..');
const USER_DATA = process.env.HOME + '/.config/mosaic-companion';

interface HealthReport {
  status: 'healthy' | 'degraded' | 'critical';
  checks: CheckResult[];
}

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

async function runHealthCheck(): Promise<HealthReport> {
  const checks: CheckResult[] = [];

  // Check 1: Ollama Cloud Auth Fix
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

  // Check 2: Hermes AIM Endpoint Fix
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

  // Check 3: Provider Variant Awareness
  const strictChecks = (aiService.match(/provider === ['"]hermes['"]/g) || []).length;
  const flexibleChecks = (aiService.match(/provider\.startsWith\(['"]hermes['"]\)/g) || []).length;
  checks.push({
    name: 'Provider Variant Checks',
    status: flexibleChecks >= strictChecks ? 'pass' : 'warn',
    message: `${strictChecks} strict === 'hermes' checks, ${flexibleChecks} flexible startsWith checks. Prefer startsWith for hermes family.`
  });

  // Check 4: Stored Agent Health
  try {
    const agentsPath = path.join(USER_DATA, 'ai-agents.json');
    const agents = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));
    const activeAgents = agents.filter((a: any) => a.isActive);
    
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
  } catch (e) {
    checks.push({
      name: 'Stored Agent Config',
      status: 'warn',
      message: `Cannot read ai-agents.json: ${e}`
    });
  }

  // Determine overall status
  const failures = checks.filter(c => c.status === 'fail').length;
  const warnings = checks.filter(c => c.status === 'warn').length;
  const status = failures > 0 ? 'critical' : warnings > 0 ? 'degraded' : 'healthy';

  return { status, checks };
}

// Run and report
runHealthCheck().then(report => {
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
});
```

---

## Integration Points

### 1. Pre-Commit Hook
```bash
# .husky/pre-commit
npm run health:check || exit 1
```

### 2. Build-Time Verification
```json
// package.json
{
  "scripts": {
    "build": "npm run health:check && tsc && vite build",
    "health:check": "ts-node scripts/health-doctor.ts"
  }
}
```

### 3. Runtime Diagnostics (Stargate Dashboard)
Add a "System Health" card to Stargate that runs these checks on demand:
```typescript
// In Stargate dashboard
const healthStatus = await window.electronAPI?.health?.runDiagnostics();
```

---

## Prevention Matrix

| Issue | Detection | Prevention |
|-------|-----------|------------|
| Ollama Cloud 401 | Verify `isOllamaCloud` auth header | Health check in pre-commit |
| Hermes AIM 404 | Verify `callHermesAIM()` exists | Lint rule for provider handlers |
| Provider strict checks | Scan for `=== 'hermes'` | Type-safe provider enum |
| Port mismatch | Verify agent configs | Config validation on save |
| Dead IPC channels | Cross-reference preload/main | Automated IPC audit |

---

## References
- `mosaic-stargate-hermes-debug` skill - Full debugging guide
- `stargate-debug-playbook` - Diagnostic commands
- Session 2026-06-12 - Ollama Cloud Auth + Hermes AIM 404 fixes