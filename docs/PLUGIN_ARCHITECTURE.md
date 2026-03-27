# MosAic Companion - Plugin Architecture

This project uses a plugin architecture for modular features.

---

## 🧩 Plugins

| Plugin | Description | Route |
|--------|-------------|-------|
| `hyperinsight` | AIM dashboard, leaderboards, network stats | `mosaic://hyperinsight` |
| `aim-nodes` | Node Manager client, MCP server | Integrated |
| `payments-jit` | Just-in-time crypto payments | Integrated |
| `cardano-wallet` | Cardano wallet with HyperSharePass NFT support | `mosaic://cardano` |
| `eth-wallet` | ETH/BASE wallet with ANFE support | `mosaic://ethwallet` |
| `ollama-models` | Local LLM model management | `mosaic://ollama` |
| `multi-agent` | Multi-agent orchestration | `mosaic://multiagent` |

---

## 📁 Plugin Structure

```
plugins/
├── {plugin-name}/
│   ├── manifest.json       # Plugin metadata
│   ├── main/
│   │   └── index.ts        # IPC handlers (Electron main)
│   └── renderer/
│       └── index.tsx       # React component (Electron renderer)
```

---

## 🔌 Creating a New Plugin

### 1. Create manifest.json

```json
{
  "id": "my-plugin",
  "version": "1.0.0",
  "name": "My Plugin",
  "description": "Description of what it does",
  "ipcNamespace": "myplugin",
  "route": "mosaic://myplugin",
  "icon": "star"
}
```

### 2. Create Main Process Handler

```typescript
// plugins/my-plugin/main/index.ts
import { ipcMain } from 'electron';
import Store from 'electron-store';

const store = new Store({ name: 'my-plugin' });

export function registerMyPluginIpc() {
  ipcMain.handle('myplugin:get-data', async () => {
    return store.get('data', {});
  });

  ipcMain.handle('myplugin:set-data', async (_event, data) => {
    store.set('data', data);
    return { success: true };
  });

  console.log('[MyPlugin] IPC handlers registered');
}
```

### 3. Create Renderer Component

```typescript
// plugins/my-plugin/renderer/index.tsx
import React, { useState, useEffect } from 'react';

export function MyPluginView() {
  const [data, setData] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (window.electronAPI?.myplugin) {
      const result = await window.electronAPI.myplugin['get-data']();
      setData(result);
    }
  };

  return (
    <div className="my-plugin">
      {/* Your UI here */}
    </div>
  );
}

export default MyPluginView;
```

### 4. Register in Electron

```typescript
// In electron/main.ts:
import { registerMyPluginIpc } from './plugins/my-plugin/main/index';

app.whenReady().then(() => {
  registerMyPluginIpc();
});
```

### 5. Add to Preload

```typescript
// In electron/preload.ts:
import { registerMyPluginIpc } from './plugins/my-plugin/main/index';

contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing APIs
  myplugin: {
    'get-data': () => ipcRenderer.invoke('myplugin:get-data'),
    'set-data': (data) => ipcRenderer.invoke('myplugin:set-data', data),
  },
});
```

---

## 🔗 Plugin Communication

Plugins communicate via IPC:

```typescript
// Renderer → Main
const result = await window.electronAPI.myplugin['get-data']();

// Main → Renderer (via event)
ipcMain.send('myplugin:event', data);

// Renderer listens
window.electronAPI.myplugin.onEvent?.((data) => {
  // Handle event
});
```

---

## 📦 Backup Files

Original implementations are preserved in `.backup/`:

```
.backup/
├── components/     # React components
├── services/       # Service classes
├── types/          # TypeScript types
└── integrations/   # Electron integrations
```

---

## 🛠️ Plugin Development Tips

1. **Use electron-store** for persistence
2. **Namespace IPC calls** with plugin ID
3. **Handle missing API gracefully** (check `window.electronAPI?.myplugin`)
4. **Keep components small** - one plugin = one feature
5. **Export both named and default** from renderer

---

*Last updated: March 2026*