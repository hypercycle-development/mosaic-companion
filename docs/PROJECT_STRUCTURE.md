# Project Structure

> A guide for developers working on Mosaic Companion

## Overview

```
mosaic-companion/
├── src/                    # React frontend source
│   ├── components/         # UI components
│   ├── services/           # Business logic
│   ├── types/              # TypeScript definitions
│   └── midnight/           # Web3/Blockchain features
├── electron/               # Electron main process
├── docs/                   # Documentation
├── assets/                 # Static assets (icons, etc.)
└── config/                 # Configuration files
```

## Source Directory

### `src/components/`

| File | Description |
|------|-------------|
| **Chat Components** | |
| `Chatview.tsx` | Main chat interface, message display, input handling |
| `ChatPage.tsx` | Chat page wrapper |
| `ChatHistorySidebar.tsx` | Session history sidebar |
| **Multi-Agent** | |
| `MultiAgentPanel.tsx` | Multi-agent orchestration UI (4 modes) |
| `MultiAgentSelector.tsx` | Agent picker component |
| `MultiAgentPage.tsx` | Standalone multi-agent page |
| **Pages** | |
| `LandingPage.tsx` | Welcome/login page |
| `SettingsPage.tsx` | User settings |
| `ToolPanelView.tsx` | Tool selection panel |
| `MosaicBotPanel.tsx` | AI assistant panel |
| **Tool UI** | |
| `tool-ui/` | Rendering system for tool outputs |
| `ToolUIDemo.tsx` | Tool UI demo page |
| **Utilities** | |
| `Sidebar.tsx` | Navigation sidebar |
| `TopBar.tsx` | Header bar |
| `BottomBar.tsx` | Footer/status bar |
| `WindowControls.tsx` | Custom window controls |

### `src/services/`

| File | Description |
|------|-------------|
| `AIService.ts` | Core AI message handling |
| `AgentOrchestrationService.ts` | Multi-agent execution engine |
| `MultiAgentService.ts` | Multi-agent state management |
| `AgentSoulService.ts` | Agent personality/soul system |
| `ActionParser.ts` | Parse tool actions from AI responses |
| `TTSService.ts` | Text-to-speech |
| `hypercycleAgent.ts` | HyperCycle integration |

### `src/types/`

| File | Description |
|------|-------------|
| `ai.ts` | AI agent config, messages, settings |
| `chat.ts` | Chat message, session types |
| `agentOrchestration.ts` | Multi-agent orchestration types |
| `agentSoul.ts` | Agent soul/personality types |
| `tools.ts` | Tool definitions |

### `src/components/tool-ui/blocks/`

Tool UI block components for rendering tool outputs:

- `ToolAlert.tsx` - Alerts/notifications
- `ToolBadge.tsx` - Badges/tags
- `ToolButton.tsx` - Interactive buttons
- `ToolCard.tsx` - Card containers
- `ToolChart.tsx` - Charts/graphs
- `ToolCode.tsx` - Code blocks with syntax highlighting
- `ToolForm.tsx` - Form inputs
- `ToolImage.tsx` - Image display
- `ToolMarkdown.tsx` - Markdown rendering
- `ToolTable.tsx` - Data tables
- `ToolTabs.tsx` - Tabbed content

## Key Integration Points

### Adding a New Page

1. Create component in `src/components/`
2. Add route in `App.tsx`
3. Add navigation entry in `Sidebar.tsx`

### Adding a New Tool

1. Define tool interface in `src/types/tools.ts`
2. Create tool class in `electron/tools/`
3. Register in tool registry
4. Add UI component in `ToolPanelView.tsx`

### Adding Multi-Agent Support

See [docs/MULTI_AGENT.md](./MULTI_AGENT.md) for detailed integration guide.

## Electron Main Process

### `electron/main.ts`

Entry point - handles:
- Window creation
- IPC handlers
- App lifecycle
- Protocol registration

### `electron/preload.ts`

Bridge between main and renderer:
- Exposes safe APIs via `window.electronAPI`
- Handles file system, notifications, etc.

### `electron/tools/`

Tool implementations:
- `gmail-tool.ts` - Gmail integration
- `web3-tool.ts` - Web3/blockchain
- `vault-tool.ts` - Secret storage

## Development Workflow

### Running Locally

```bash
# Development with hot reload
npm run dev

# Production build
npm run build

# Run Electron app
npm start
```

### Building

```bash
npm run make        # Current platform
npm run make:win    # Windows
npm run make:mac    # macOS
npm run make:linux  # Linux
```

## Common Tasks

### Update Theme

Edit `src/themes.ts` for color schemes, `src/theme.css` for global styles.

### Add Environment Variable

1. Add default in `src/types/ai.ts` or create new type
2. Use `window.electronAPI.getEnv()` in renderer
3. Document in `.env.local.example`

### Debug Logging

```typescript
// Main process
console.log('[Tag]', message);

// Renderer
console.log('[Tag]', message);
```

Logs appear in DevTools console and terminal.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Renderer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Components  │  │  Services   │  │   Types     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │ IPC                              │
├──────────────────────────┼──────────────────────────────────┤
│                     Preload                                 │
│              (window.electronAPI)                           │
├─────────────────────────────────────────────────────────────┤
│                     Main Process                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Window    │  │    IPC     │  │   Tools    │         │
│  │ Management │  │  Handlers  │  │  Registry  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```