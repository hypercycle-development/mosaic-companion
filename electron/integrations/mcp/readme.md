# Electron MCP Client

A complete example of integrating MCP (Model Context Protocol) into an Electron application using TypeScript. Includes both STDIO and HTTP transport support.

## 📁 Project Structure

```
root/
├── integrations/
│   ├── mcp/
│   │   │── index.ts
│   │   ├── LlmToolCalling.tsx
│   │   ├── MCPClient.tsx
│   │   └── MCPAPI.tsx

```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Development mode (hot reload)
npm run dev

# Build and run
npm run preview

# Package for distribution
npm run package
```

## 🔌 MCP Integration

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                          │
│  ┌───────────────┐         ┌──────────────────────────┐ │
│  │ Main Process  │   IPC   │    Renderer Process      │ │
│  │               │◄───────►│                          │ │
│  │  MCPClient    │         │   React UI               │ │
│  │    │          │         │   - Server management    │ │
│  │    ▼          │         │   - Tool execution       │ │
│  │  ┌──────────┐ │         │   - Resource viewer      │ │
│  │  │ STDIO    │ │         └──────────────────────────┘ │
│  │  │ Transport│ │                                      │
│  │  └────┬─────┘ │                                      │
│  │       │       │                                      │
│  │  ┌────▼─────┐ │                                      │
│  │  │  HTTP    │ │                                      │
│  │  │ Transport│ │                                      │
│  │  └────┬─────┘ │                                      │
│  └───────┼───────┘                                      │
└──────────┼──────────────────────────────────────────────┘
           │
           ▼
┌──────────────────┐    ┌──────────────────┐
│  Local MCP       │    │  Remote MCP      │
│  Server (STDIO)  │    │  Server (HTTP)   │
│  python server.py│    │  Open WebUI      │
└──────────────────┘    └──────────────────┘
```

### Connecting to MCP Servers

#### Via UI

1. Click "+ Add Server"
2. Choose transport type:
   - **HTTP**: For remote servers (Open WebUI, cloud deployments)
   - **STDIO**: For local servers (spawned processes)
3. Enter server details
4. Click "Connect"

#### Via Code (Main Process)

```typescript
import { mcpClient } from "./main";

// Connect to local server via STDIO
await mcpClient.connectStdio({
  name: "my-tools",
  transport: "stdio",
  command: "python",
  args: ["path/to/server.py"],
});

// Connect to remote server via HTTP
await mcpClient.connectHttp({
  name: "remote-tools",
  transport: "http",
  url: "http://localhost:8000/mcp",
  apiKey: "optional-api-key",
});
```

#### Via Code (Renderer Process)

```typescript
// Connect to local server
await window.mcp.connect({
  name: "my-tools",
  transport: "stdio",
  command: "python",
  args: ["server.py"],
});

// Call a tool
const result = await window.mcp.callTool("my-tools", "web_fetch", {
  url: "https://example.com",
});

console.log(result);
// { success: true, result: { content: [{ type: 'text', text: '...' }] } }
```

### Using the Standalone MCP Client Library

The `src/lib/mcp-client.ts` can be used in any Node.js environment:

```typescript
import MCPClient from "./lib/mcp-client";

const client = new MCPClient({ debug: true });

// Connect
await client.connectStdio("server", "python", ["server.py"]);
// or
await client.connectHttp("server", "http://localhost:8000/mcp");

// List capabilities
const tools = await client.listTools("server");
const resources = await client.listResources("server");
const prompts = await client.listPrompts("server");

// Call a tool
const result = await client.callTool("server", "tool_name", { arg: "value" });

// Read a resource
const content = await client.readResource("server", "config://app");

// Get a prompt
const prompt = await client.getPrompt("server", "summarize", {
  content: "...",
});

// Listen for events
client.on("connected", ({ server }) => console.log(`Connected to ${server}`));
client.on("notification", ({ server, method }) =>
  console.log(`${server}: ${method}`)
);

// Disconnect
await client.disconnect("server");
```

## 🤖 LLM Integration Example

The `examples/llm-tool-calling.ts` shows how to use MCP tools with OpenAI or Anthropic:

```bash
# Set API key
export OPENAI_API_KEY="sk-..."
# or
export ANTHROPIC_API_KEY="sk-ant-..."

# Run example
npx ts-node examples/llm-tool-calling.ts
```

This creates an agentic loop where:

1. User sends a query
2. LLM decides which MCP tools to call
3. MCP tools are executed
4. Results are fed back to the LLM
5. LLM generates final response (or calls more tools)

## 📡 Supported Transports

### STDIO (Local Servers)

Best for local development and desktop apps. The Electron main process spawns the MCP server as a child process.

```typescript
await client.connectStdio("server", "python", ["server.py"]);
```

**Pros:**

- No network overhead
- Direct process communication
- Works offline
- Access to local filesystem/resources

**Cons:**

- Requires server executable installed
- Limited to same machine

### HTTP / Streamable HTTP (Remote Servers)

Best for cloud deployments and multi-user scenarios. This is what Open WebUI v0.6.31+ uses natively.

```typescript
await client.connectHttp("server", "http://localhost:8000/mcp", "api-key");
```

**Pros:**

- Remote server support
- Multi-user capable
- Firewall/proxy friendly
- Supports OAuth 2.1

**Cons:**

- Network latency
- Requires server to be running

## 🔒 Security

### Preload Script

The preload script (`src/main/preload.ts`) uses `contextBridge` to safely expose MCP functionality to the renderer without giving direct Node.js access.

### Content Security Policy

The renderer's CSP is configured to:

- Allow connections to localhost (for local MCP servers)
- Allow connections to HTTPS endpoints (for remote servers)
- Prevent XSS attacks

### API Key Storage

**Important:** In production, store API keys securely:

- Use Electron's `safeStorage` for encryption
- Never store in plain text
- Consider using system keychain

## 🛠️ Customization

### Adding Custom Tools

Extend the MCP server with new tools:

```python
# In your MCP server
@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "my_custom_tool":
        # Your implementation
        return [TextContent(type="text", text="Result")]
```

### Custom UI Components

Add new React components for specific tool types:

```tsx
function MyToolUI({ tool, onExecute }) {
  // Custom UI for your tool
}
```

## 📚 Resources

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Open WebUI MCP Docs](https://docs.openwebui.com/features/mcp/)
- [Electron Documentation](https://www.electronjs.org/docs)

## 📄 License

MIT
