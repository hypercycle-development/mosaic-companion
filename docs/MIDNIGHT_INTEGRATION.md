# Midnight Wallet MCP Integration

This branch integrates the [Midnight Wallet CLI](https://github.com/nel349/midnight-wallet-cli) with Mosaic Companion via the Model Context Protocol (MCP).

## What is Midnight?

Midnight is a zero-knowledge (ZK) blockchain platform for private smart contracts and DeFi. The Midnight Wallet CLI is a standalone Node.js tool that provides:

- Wallet management (generate, list, use, remove)
- Balance checking (unshielded + shielded NIGHT tokens)
- Transfers (public and private)
- Contract deployment and interaction
- Local network management via Docker
- **Built-in MCP server** for AI agent integration

## Integration Approach

Unlike other MCP servers in Mosaic which use bridge scripts (Node.js/Python wrappers), the Midnight wallet is a **first-class MCP server** published as an npm package. The integration:

1. **Package dependency**: `midnight-wallet-cli` is added to `package.json`
2. **Auto-registration**: The MCP plugin system automatically registers `midnight-wallet` as a server
3. **Flexible execution**: Falls back to `npx` if the package isn't installed globally

## Available MCP Tools

When connected, the Midnight wallet exposes 30+ tools:

| Tool | Description |
|------|-------------|
| `midnight_wallet_generate` | Create a named wallet |
| `midnight_wallet_list` | List all wallets |
| `midnight_wallet_use` | Set active wallet |
| `midnight_wallet_info` | Show wallet details |
| `midnight_balance` | Check NIGHT balance |
| `midnight_transfer` | Send NIGHT tokens |
| `midnight_airdrop` | Fund wallet from genesis (localnet) |
| `midnight_contract_deploy` | Deploy a compiled contract |
| `midnight_contract_call` | Call a circuit on a deployed contract |
| `midnight_contract_state` | Query deployed contract ledger state |
| `midnight_localnet_up` | Start local network |
| `midnight_localnet_stop` | Stop local network |
| ... | See full list in [README](https://github.com/nel349/midnight-wallet-cli#mcp-server-for-ai-agents) |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MIDNIGHT_NETWORK` | Default network (undeployed/preprod/preview) | (empty) |

### Adding as a Plugin (Manual)

If auto-registration doesn't work, you can add it manually in the MCP Servers panel:

```json
{
  "name": "midnight-wallet",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "midnight-wallet-cli@latest", "--mcp"]
}
```

## Usage in Mosaic Agents

Once the server is connected, Mosaic AI agents can invoke Midnight operations:

```typescript
// Example: Generate a wallet
const result = await window.electronAPI.mcpCallTool(
  "midnight-wallet",
  "midnight_wallet_generate",
  { name: "alice" }
);

// Example: Check balance
const balance = await window.electronAPI.mcpCallTool(
  "midnight-wallet",
  "midnight_balance",
  { full: true }
);

// Example: Transfer tokens (returns pending token)
const tx = await window.electronAPI.mcpCallTool(
  "midnight-wallet",
  "midnight_transfer",
  { to: "mn_addr_...", amount: "100" }
);
// Then confirm:
await window.electronAPI.mcpCallTool(
  "midnight-wallet",
  "midnight_confirm_operation",
  { token: tx.token }
);
```

## DApp Connector

The wallet also exposes a WebSocket server (`midnight serve`) that implements the same `ConnectedAPI` as the Lace browser wallet. This allows DApps to connect without a browser extension.

## Skill Resources

The MCP server provides markdown resources for agent training:

- `midnight-wallet://skill/core` — Intent routing + safety rules (~830 tokens)
- `midnight-wallet://skill/full` — Canonical flows, error recovery (~2.3k tokens)

## Network Support

| Network | Description |
|---------|-------------|
| `undeployed` | Local network via Docker |
| `preprod` | Midnight pre-production testnet |
| `preview` | Midnight preview testnet |

## Installation

If you need to install the wallet CLI globally for testing:

```bash
npm install -g midnight-wallet-cli
```

Or use directly via npx:

```bash
npx midnight-wallet-cli@latest --help
```

## References

- [Midnight Wallet CLI Repository](https://github.com/nel349/midnight-wallet-cli)
- [Midnight Blockchain Documentation](https://docs.midnight.network/)
- [MCP Specification](https://modelcontextprotocol.io/)
