# IDE — Technical Documentation

## Overview

The IDE is MosAIc's built-in code editor, accessible at `browser://ide`. It provides a VS Code-like experience with a file explorer, Monaco Editor, integrated terminal, and an AI assistant panel — all wired into the existing agent infrastructure.

```
User → opens folder → browses files in explorer → edits in Monaco Editor
                     → runs commands in terminal → asks AI for help
```

---

## Architecture

### Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│  Renderer (React/Vite)                                               │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ FileExplorer  │ │  Monaco  │ │TerminalPanel │ │ AIAssistPanel│   │
│  │ (tree view)   │ │  Editor  │ │  (xterm.js)  │ │  (chat)      │   │
│  └──────┬───────┘ └────┬─────┘ └──────┬───────┘ └──────┬───────┘   │
│         │              │               │                │           │
│  ide.fs.*        ide.fs.*        ide.pty.*        agent.send()      │
└─────────┬──────────────┬───────────────┬────────────────┬───────────┘
          │     IPC Bridge (preload.ts)                   │
┌─────────┴──────────────┴───────────────┴────────────────┴───────────┐
│  Main Process (Electron)                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐    │
│  │  filesystem.ts  │  │  terminal.ts   │  │    project.ts       │    │
│  │  Node.js fs     │  │  node-pty      │  │  git, recent dirs   │    │
│  └────────────────┘  └────────────────┘  └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Directories

| Location | Purpose |
|----------|---------|
| `electron/integrations/ide/` | Main process: filesystem, terminal (PTY), project state IPC handlers |
| `src/components/ide/` | Renderer: all IDE React components and state management |

---

## Internal URL

```
browser://ide              — Opens the IDE (shows Welcome view if no project open)
browser://ide?path=/foo    — Opens the IDE with /foo as the project root
```

---

## Main Process IPC Handlers

Registered by `initIDE()` in `electron/integrations/ide/index.ts`, called from `electron/main.ts` on app ready. Cleaned up by `cleanupIDE()` on quit.

### Filesystem (`electron/integrations/ide/filesystem.ts`)

| IPC Channel | Args | Returns | Description |
|-------------|------|---------|-------------|
| `ide:fs:read-dir` | `dirPath` | `{ entries: DirEntry[] }` | List directory contents (hidden files excluded). Sorted: directories first, then alphabetical. |
| `ide:fs:read-file` | `filePath` | `{ content, isBinary? }` | Read file as UTF-8. Returns `isBinary: true` for known binary extensions. Max 5 MB. |
| `ide:fs:write-file` | `filePath, content` | `{ success }` | Write/save file content. |
| `ide:fs:create-file` | `filePath, content?` | `{ success }` | Create new file (fails if exists). Creates parent directories. |
| `ide:fs:create-dir` | `dirPath` | `{ success }` | Create directory (recursive). |
| `ide:fs:delete` | `targetPath` | `{ success }` | Delete file or directory (recursive for dirs). |
| `ide:fs:rename` | `oldPath, newPath` | `{ success }` | Rename/move file or directory. |
| `ide:fs:stat` | `targetPath` | `{ stat: { size, isDirectory, isFile, modifiedMs } }` | Get file metadata. |
| `ide:fs:open-folder` | — | `{ path }` | Native OS folder picker dialog. |

**DirEntry:**

```typescript
{
  name: string;
  type: "file" | "directory" | "symlink";
  size: number;
  modifiedMs: number;
}
```

**Binary extensions** (returned as `isBinary: true`, not read into memory):

`.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.ico`, `.webp`, `.svg`, `.mp3`, `.mp4`, `.wav`, `.ogg`, `.webm`, `.avi`, `.zip`, `.tar`, `.gz`, `.bz2`, `.7z`, `.rar`, `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.exe`, `.dll`, `.so`, `.dylib`, `.wasm`, `.ttf`, `.otf`, `.woff`, `.woff2`, `.sqlite`, `.db`

### Terminal (`electron/integrations/ide/terminal.ts`)

Uses `node-pty` to spawn real shell processes. Supports multiple concurrent terminals.

| IPC Channel | Args | Returns | Description |
|-------------|------|---------|-------------|
| `ide:pty:create` | `cwd` | `{ id }` | Spawn a new terminal in the given directory. Shell: `$SHELL` (Linux/macOS) or `powershell` (Windows). |
| `ide:pty:write` | `id, data` | `{ success }` | Write keystrokes to terminal. |
| `ide:pty:resize` | `id, cols, rows` | `{ success }` | Resize terminal dimensions. |
| `ide:pty:destroy` | `id` | `{ success }` | Kill terminal process. |

**Push events (main → renderer):**

| Event | Payload | Description |
|-------|---------|-------------|
| `ide:pty:data` | `{ id, data }` | Terminal output (stdout/stderr). |
| `ide:pty:exit` | `{ id, code }` | Terminal process exited. |

### Project (`electron/integrations/ide/project.ts`)

| IPC Channel | Args | Returns | Description |
|-------------|------|---------|-------------|
| `ide:project:get-recent` | — | `string[]` | List of recently opened project paths (max 10). |
| `ide:project:save-recent` | `projectPath` | `{ success }` | Add a project to the recent list (moves to top if already present). |
| `ide:project:get-git-status` | `cwd` | `{ files: [{ path, status }] }` | Run `git status --porcelain` and parse output. |
| `ide:project:get-git-branch` | `cwd` | `{ branch }` | Get current git branch name. |

---

## Preload API

Exposed on `window.electronAPI.ide` with three namespaces:

```typescript
window.electronAPI.ide.fs.readDir(dirPath)
window.electronAPI.ide.fs.readFile(filePath)
window.electronAPI.ide.fs.writeFile(filePath, content)
window.electronAPI.ide.fs.createFile(filePath, content?)
window.electronAPI.ide.fs.createDir(dirPath)
window.electronAPI.ide.fs.delete(targetPath)
window.electronAPI.ide.fs.rename(oldPath, newPath)
window.electronAPI.ide.fs.stat(targetPath)
window.electronAPI.ide.fs.openFolder()

window.electronAPI.ide.pty.create(cwd)
window.electronAPI.ide.pty.write(id, data)
window.electronAPI.ide.pty.resize(id, cols, rows)
window.electronAPI.ide.pty.destroy(id)
window.electronAPI.ide.pty.onData(callback)   // returns cleanup function
window.electronAPI.ide.pty.onExit(callback)   // returns cleanup function

window.electronAPI.ide.project.getRecent()
window.electronAPI.ide.project.saveRecent(path)
window.electronAPI.ide.project.getGitStatus(cwd)
window.electronAPI.ide.project.getGitBranch(cwd)
```

---

## Renderer Components

All located in `src/components/ide/`.

### IDEPage.tsx — Main Layout

The top-level component rendered at `browser://ide`. Manages the full IDE layout with resizable panels.

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ [Toolbar: Explorer | Terminal | AI | Open Folder | path]    │
├────────────┬────────────────────────────────┬───────────────┤
│            │  [EditorTabs: file1 | file2]   │               │
│   File     │  ┌──────────────────────────┐  │   AI Assist   │
│  Explorer  │  │     Monaco Editor        │  │   (optional)  │
│            │  └──────────────────────────┘  │               │
│            │  [Terminal tabs: bash | +]      │               │
│            │  ┌──────────────────────────┐  │               │
│            │  │     xterm.js Terminal     │  │               │
│            │  └──────────────────────────┘  │               │
├────────────┴────────────────────────────────┴───────────────┤
│ [StatusBar: branch | language | UTF-8]                      │
└─────────────────────────────────────────────────────────────┘
```

All three side/bottom panels are **resizable via drag handles** and **toggleable**:

| Panel | Toggle | Shortcut |
|-------|--------|----------|
| File Explorer | Toolbar button | `Ctrl+B` |
| Terminal | Toolbar button | `` Ctrl+` `` |
| AI Assist | Toolbar button | `Ctrl+J` |
| Save file | — | `Ctrl+S` |

Supports `?path=` URL parameter to open a specific project on navigation.

If no project is open, shows the **WelcomeView** with an "Open Folder" button and recent projects list.

### FileExplorer.tsx — File Tree

Left sidebar showing the project directory as an expandable tree.

- **Lazy-loaded**: subdirectories load on first expand, not upfront.
- **Sorted**: directories first, then files, both alphabetical.
- **Language-aware icons**: each file displays a colored label based on its extension (e.g. `TS` in blue, `PY` in green, `JS` in yellow). Defined in `utils.ts` via `getFileIconStyle()`.
- **Folder colors**: folders like `src`, `components`, `node_modules`, `tests` have distinct colors. Defined via `getFolderColor()`.
- **Active file highlight**: the currently open file is highlighted in the tree.
- **Refresh**: button in the header reloads the root directory.

**File icon mappings** (subset):

| Extension | Label | Color |
|-----------|-------|-------|
| `.ts`, `.tsx` | TS, TX | Blue |
| `.js`, `.jsx`, `.mjs` | JS, JX | Yellow |
| `.py` | PY | Green |
| `.html` | H | Orange |
| `.css` | C | Light blue |
| `.json` | {} | Yellow |
| `.md` | M | Sky |
| `.rs` | Rs | Orange |
| `.go` | Go | Cyan |
| `.sh` | $ | Green |
| `.java` | J | Red |
| `.rb` | Rb | Red |
| `.sql` | SQ | Yellow |

**Special file name mappings**: `package.json` → green "Np", `Dockerfile` → blue "D", `tsconfig.json` → blue "TS", etc.

**Folder color mappings** (subset):

| Folder | Color |
|--------|-------|
| `src`, `components` | Blue |
| `node_modules` | Dim green |
| `dist`, `build` | Dim yellow |
| `tests`, `__tests__` | Yellow |
| `styles` | Pink |
| `docs` | Sky |
| `assets`, `images` | Purple |
| `electron` | Cyan |

### EditorTabs.tsx — Tab Strip

Horizontal tab bar showing all open files.

- Dirty (unsaved) files marked with a yellow `*` prefix.
- Close button appears on hover.
- Click to switch active file.

### CodeEditor.tsx — Monaco Editor

Wraps `@monaco-editor/react` (the same editor engine that powers VS Code).

- **Syntax highlighting**: automatic for 40+ languages via Monaco's built-in grammars.
- **Language detection**: from file extension via `detectLanguage()` in `utils.ts`.
- **Theme**: `vs-dark`.
- **Save**: `Ctrl+S` triggers file save via IPC.
- **Features**: minimap, bracket pair colorization, smooth scrolling, auto-layout on resize.
- **Empty state**: "No file open" message when no file is selected.

**Editor options:**

```typescript
{
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
  minimap: { enabled: true, maxColumn: 80 },
  tabSize: 2,
  bracketPairColorization: { enabled: true },
  renderWhitespace: "selection",
  cursorSmoothCaretAnimation: "on",
}
```

### TerminalPanel.tsx — Integrated Terminal

Full terminal emulator using `xterm.js` (renderer) + `node-pty` (main process).

- **Multi-terminal**: create multiple terminals with tab management.
- **Auto-create**: first terminal spawns automatically when a project is opened.
- **Auto-fit**: terminal resizes with the panel via `FitAddon` + `ResizeObserver`.
- **Shell**: uses `$SHELL` on Linux/macOS, `powershell` on Windows.
- **Theme**: dark theme matching the IDE.
- **Cleanup**: all PTY processes killed on unmount.

Exposes `sendCommand()` and `createTerminalAndRun()` via `forwardRef`/`useImperativeHandle`.

### AIAssistPanel.tsx — AI Code Assistant

Right sidebar chat panel for code assistance, reusing the project's agent system.

- **Agent selection**: loads configured agents from `window.electronAPI.aiAgents.get()`.
- **Context injection**: automatically includes the current file path and content (truncated to 4000 chars) in the system prompt.
- **Communication**: uses `window.agent.send()` to call `callActiveLLM()` in the main process.
- **Streaming**: not yet streaming (sends full prompt, gets full response).
- **Conversation**: maintains message history within the session.

### IDEStatusBar.tsx — Status Bar

Bottom bar showing:
- Git branch (fetched via `ide:project:get-git-branch`).
- Current file language (from Monaco language detection).
- Encoding (UTF-8).

### WelcomeView.tsx — Welcome Screen

Shown when no project is open. Provides:
- "Open Folder" button (native OS dialog).
- Recent projects list (loaded from `ide:project:get-recent`).

### useIDEStore.ts — State Management

Custom React hook managing all IDE state:

```typescript
{
  projectPath: string | null;
  openFiles: OpenFile[];          // { path, content, language, isDirty }
  activeFilePath: string | null;
  terminals: TerminalInstance[];  // { id, title }
  activeTerminalId: string | null;
  showTerminal: boolean;
  showAIPanel: boolean;
  showFileExplorer: boolean;
}
```

- **Persistence**: panel visibility and project path saved to `localStorage` under `mosaic_ide_state`.
- **File operations**: `openFile()` reads via IPC and auto-detects language; `saveFile()` writes via IPC and clears dirty flag.
- **Recent projects**: automatically saved when a project is opened.

---

## Build Configuration

### Native Module: node-pty

`node-pty` is a native C++ addon that requires platform-specific compilation.

- **esbuild** (`esbuild.config.mjs`): added to `external` array (cannot be bundled).
- **Electron Forge** (`forge.config.js`): added to `asarUnpack` so the native binary is accessible at runtime.

### Monaco Editor

Uses `@monaco-editor/react` which loads Monaco via a built-in CDN loader by default. For offline/packaged builds, configure the Monaco webpack/vite plugin to bundle workers locally.

---

## Configuration Files

| File | Location | Content |
|------|----------|---------|
| `ide-recent-projects.json` | `~/.config/mosaic-companion/` | Array of recently opened project paths (max 10) |

---

## Supported Languages

Monaco Editor provides syntax highlighting for all major languages out of the box. The file explorer shows language-specific icons for 50+ file extensions. Language detection for editor grammar selection covers:

TypeScript, JavaScript, Python, Rust, Go, Java, C, C++, C#, Ruby, PHP, Swift, Kotlin, Shell/Bash, HTML, CSS, SCSS, Less, JSON, YAML, TOML, XML, SQL, GraphQL, Markdown, Lua, R, Dart, Vue, Svelte, Dockerfile, and more.

---

## Key Source Files

| File | Purpose |
|------|---------|
| `electron/integrations/ide/index.ts` | `initIDE()` / `cleanupIDE()` entry points |
| `electron/integrations/ide/filesystem.ts` | Filesystem IPC handlers (read, write, delete, rename, stat, dialog) |
| `electron/integrations/ide/terminal.ts` | PTY management via node-pty |
| `electron/integrations/ide/project.ts` | Recent projects, git status/branch |
| `electron/preload.ts` | `window.electronAPI.ide` bridge (fs, pty, project) |
| `global.d.ts` | TypeScript declarations for the IDE API |
| `src/components/ide/IDEPage.tsx` | Main layout: toolbar, panels, resize handles, keyboard shortcuts |
| `src/components/ide/FileExplorer.tsx` | Lazy-loading directory tree with language-aware icons |
| `src/components/ide/CodeEditor.tsx` | Monaco Editor wrapper |
| `src/components/ide/EditorTabs.tsx` | File tab strip with dirty indicators |
| `src/components/ide/TerminalPanel.tsx` | xterm.js multi-terminal with auto-fit |
| `src/components/ide/AIAssistPanel.tsx` | AI chat sidebar with file context injection |
| `src/components/ide/IDEStatusBar.tsx` | Git branch, language, encoding display |
| `src/components/ide/WelcomeView.tsx` | Open folder + recent projects |
| `src/components/ide/useIDEStore.ts` | State management with localStorage persistence |
| `src/components/ide/utils.ts` | Language detection, file icon styles, folder colors |
| `src/components/ide/types.ts` | IDE-specific TypeScript types |
