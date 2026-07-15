# Stargate Vault — Access Guide

## How AI Agents Access the Vault

### Quick Start

```javascript
// 1. Request access
const token = await vault.grant({
  agent: "my-agent-name",
  scope: "all",  // or "category:name" or "skill:name"
  permissions: ["read", "execute"]
});

// 2. Use the token
const skills = await vault.browse({
  category: "ai-agency",
  token: token.vault_token
});
```

### Access Scopes

| Scope | Description | Example |
|-------|-------------|---------|
| `all` | All 283 skills | `vault.grant({scope: "all"})` |
| `category:name` | Skills in category | `vault.grant({scope: "category:midnight"})` |
| `skill:name` | Single skill | `vault.grant({scope: "skill:hypercycle-aim-master"})` |

### Permissions

- `read` — View skill content
- `execute` — Run skill actions
- `admin` — Grant/revoke access (orchestrator only)

### Token Format

```json
{
  "vault_token": "stg_vault_abc123xyz789",
  "agent": "mosaic-bot",
  "scope": "all",
  "permissions": ["read", "execute"],
  "granted_at": "2026-07-03T10:00:00Z",
  "expires_at": "2026-07-04T10:00:00Z",
  "issuer": "stargate-vault"
}
```

### Revoking Access

```javascript
await vault.revoke({
  token: "stg_vault_abc123xyz789",
  reason: "Session ended"
});
```

### Checking Access

```javascript
const status = await vault.check({
  agent: "mosaic-bot",
  skill: "hypercycle-aim-master"
});

// Response
{
  "has_access": true,
  "granted_via": "category:ai-agency",
  "expires": "2026-07-04T10:00:00Z"
}
```
