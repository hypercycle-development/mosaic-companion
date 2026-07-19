---
name: project-migrator
description: Migrate projects between environments (local→Stargate, dev→prod, HyperAIBox→cloud). Handle config transformation, dependency mapping, and validation.
version: 1.0.0
trigger: When moving projects between environments, deploying to HyperAIBox, or migrating configs
---

# Project Migrator Skill

## What It Does

Moving projects between environments is error-prone. This skill automates:
- **Environment detection** — Identify source/target environment type
- **Config transformation** — Rewrite paths, ports, endpoints
- **Dependency mapping** — What services must exist in target?
- **Data migration** — SQLite, file assets, env vars
- **Validation** — Smoke tests post-migration

## Environment Types

| Type | Indicators | Common Issues |
|------|------------|---------------|
| Local Dev | localhost, 127.0.0.1, file:// | Hardcoded paths, dev servers |
| Docker | container names, internal DNS | Service discovery, volumes |
| Stargate Pool | 192.168.0.x, HyperAIBox | IP changes after reboot |
| Cloud | https://, load balancers | SSL, CORS, auth |

## Migration Patterns

### Pattern 1: Local → Stargate

When moving from dev laptop to HyperAIBox:

```typescript
const migration = await planMigration({
  source: { type: 'local', path: '~/my-project' },
  target: { type: 'stargate', node: 'c3po' },
  appType: 'nodejs' // or 'python', 'docker'
});

// Returns:
{
  configChanges: [
    { file: '.env', from: 'DATABASE_URL=localhost:5432', to: 'DATABASE_URL=192.168.0.150:5432' },
    { file: 'package.json', from: 'start: "node server.js"', to: 'start: "pm2 start server.js"' }
  ],
  dependencies: ['postgresql', 'redis'],
  portMapping: { 3000: 8000 }, // host → container
  validation: ['curl http://192.168.0.150:8000/health']
}
```

### Pattern 2: Config Cascade

Many projects have layered configs:

```
.env                    # Secrets (never migrate)
.env.local              # Dev overrides
.env.production         # Target environment
config/default.yaml     # Base config
config/{env}.yaml       # Environment overrides
```

Migration strategy:
1. Read base + source env
2. Generate target env from rules
3. Keep secrets in vault, not in code

## MCP Tools

### migrate_analyze

**Input**:
```json
{
  "sourcePath": "~/my-app",
  "targetType": "stargate",
  "targetNode": "c3po",
  "appType": "nodejs"
}
```

**Output**:
```json
{
  "compatibility": "green", // green|yellow|red
  "issues": [
    { "severity": "warning", "message": "Uses localhost:3000 — will need port mapping" },
    { "severity": "error", "message": "Hardcoded /home/user/data path" }
  ],
  "configFiles": [".env", "config.yaml", "docker-compose.yml"],
  "dataVolumes": ["./data", "./uploads"],
  "estimatedTime": "15 minutes"
}
```

### migrate_execute

**Input**:
```json
{
  "sourcePath": "~/my-app",
  "targetType": "stargate",
  "targetNode": "c3po",
  "transforms": [
    { "type": "env", "var": "DATABASE_URL", "value": "postgres://192.168.0.150:5432/mydb" },
    { "type": "sed", "file": "server.js", "from": "localhost", "to": "0.0.0.0" }
  ],
  "dryRun": false
}
```

**Output**:
```json
{
  "success": true,
  "filesModified": 4,
  "commandsRun": [
    "rsync -avz ~/my-app hyperai@192.168.0.150:/opt/apps/",
    "ssh hyperai@192.168.0.150 'cd /opt/apps/my-app && npm install'",
    "ssh hyperai@192.168.0.150 'cd /opt/apps/my-app && pm2 start'"
  ],
  "validationResult": { "passed": true, "responseTime": 120 }
}
```

## Stargate-Specific Patterns

### Port Allocation

Stargate nodes have reserved ports:

| Port Range | Purpose |
|------------|---------|
| 8000-8005 | Node Manager + AIM slots |
| 8100 | HBA Agent |
| 9000-9003 | Tiller AIM containers |
| 9100 | SPO (if running on node) |

When migrating, map your app to available ports:

```typescript
const portMap = await allocatePorts({
  node: 'c3po',
  requested: [3000, 3001],
  available: [7000, 7001] // fallback
});
```

### Service Discovery

In Stargate, services move. Use SPO for discovery:

```typescript
// Instead of hardcoded IP
const dbHost = await spoResolve('my-database');
// Returns: 192.168.0.150 or current IP
```

### Persistent Storage

HyperAIBox uses overlayroot. For persistence:
- Use `/home/hyperai/data/` (bind-mounted)
- Or external PostgreSQL/Redis
- Never rely on container filesystem

## Validation Checklist

Post-migration checks:

- [ ] App starts without errors
- [ ] Health endpoint responds
- [ ] Database migrations run
- [ ] File uploads work (if applicable)
- [ ] Logs write to expected location
- [ ] Environment variables injected
- [ ] Reverse proxy routes correctly
- [ ] SSL certificates valid (if HTTPS)

## Rollback Plan

Always preserve rollback capability:

```typescript
await createSnapshot({
  node: 'c3po',
  app: 'my-app',
  tag: 'pre-migration-v2'
});

// If migration fails:
await rollback({ node: 'c3po', tag: 'pre-migration-v2' });
```

## Integration with AXI Tools

Use `hbox-axi` and `spo-axi` for actual deployment:

```bash
# Check node health first
hbox-axi status --node c3po

# Deploy via SPO
spo-axi deploy my-app --node c3po --scale 2

# Monitor
spo-axi logs my-app --follow
```

## Related Skills

- `axi-executor` — Run AXI tools for deployment
- `hyperaibox-fleet-manager` — Node diagnostics
- `mosaic-stargate` — Stargate Pool patterns
- `pattern-extractor` — Learn from migration patterns
