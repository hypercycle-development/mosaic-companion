# MosAIc IDE — User Guide

## Getting Started

### Opening the IDE

Click **IDE** in the left sidebar, or navigate to `browser://ide` in the address bar.

### Opening a Project

When you first open the IDE you'll see the **Welcome screen** with two options:

1. **Open Folder** — Click the blue button to choose a folder from your system. This becomes your project root.
2. **Recent Projects** — If you've opened folders before, they appear below. Click any path to reopen it.

You can also open a specific folder by navigating to `browser://ide?path=/path/to/your/project`.

Once a folder is open, the IDE loads with four areas: the file explorer, code editor, terminal, and optionally the AI assistant.

---

## The Interface

```
┌──────────────────────────────────────────────────────────────┐
│  Toolbar                                                     │
├────────────┬─────────────────────────────────┬───────────────┤
│            │  Editor Tabs                    │               │
│   File     │                                 │  AI Assist    │
│  Explorer  │        Code Editor              │  (optional)   │
│            │                                 │               │
│            ├─────────────────────────────────┤               │
│            │        Terminal                  │               │
├────────────┴─────────────────────────────────┴───────────────┤
│  Status Bar                                                  │
└──────────────────────────────────────────────────────────────┘
```

### Toolbar

The top bar has toggle buttons for each panel and a folder picker:

| Button | What it does |
|--------|-------------|
| **Explorer icon** | Show/hide the file explorer |
| **Terminal icon** | Show/hide the terminal |
| **AI icon** | Show/hide the AI assistant (turns blue when active) |
| **Folder icon** | Open a different folder |

The current project path is displayed to the right.

### Resizing Panels

Every panel boundary is **draggable**. Hover over the border between any two panels — the cursor changes to a resize handle. Click and drag to adjust the size.

- **Explorer width**: drag its right edge
- **Terminal height**: drag its top edge
- **AI panel width**: drag its left edge

Your panel visibility preferences are saved automatically and restored next time you open the IDE.

---

## File Explorer

The left panel shows your project files as a tree. It works like VS Code's explorer:

- **Click a folder** to expand or collapse it. Subfolders load on demand — large projects stay fast.
- **Click a file** to open it in the editor.
- **Active file** is highlighted in blue.
- **Refresh button** (top right of the explorer) reloads the directory if files changed externally.

### File Icons

Files display a colored label indicating their type:

| You'll see | File type |
|-----------|-----------|
| **TS** (blue) | TypeScript `.ts` `.tsx` |
| **JS** (yellow) | JavaScript `.js` `.jsx` `.mjs` |
| **PY** (green) | Python `.py` |
| **H** (orange) | HTML `.html` |
| **C** (light blue) | CSS `.css` |
| **{}** (yellow) | JSON `.json` |
| **M** (sky) | Markdown `.md` |
| **$** (green) | Shell scripts `.sh` `.bash` |
| **Rs** (orange) | Rust `.rs` |
| **Go** (cyan) | Go `.go` |

Special files like `package.json`, `Dockerfile`, and `tsconfig.json` have their own distinct icons.

### Folder Colors

Folders are color-coded by purpose:

- **Blue**: `src`, `components`, `lib`
- **Yellow**: `tests`, `__tests__`, `dist`, `build`
- **Green**: `public`, `scripts`
- **Pink**: `styles`
- **Purple**: `assets`, `images`
- **Cyan**: `electron`
- **Sky**: `docs`
- **Dim green**: `node_modules`

---

## Code Editor

The editor is powered by **Monaco Editor** — the same engine that runs VS Code. You get:

- **Syntax highlighting** for 40+ languages, detected automatically from the file extension.
- **Minimap** on the right side for quick navigation.
- **Bracket pair colorization** to match opening/closing brackets.
- **Multiple file tabs** — open as many files as you need. Click a tab to switch, hover to reveal the close button.

### Saving Files

- Press **Ctrl+S** (or **Cmd+S** on Mac) to save the current file.
- Unsaved files show a yellow **\*** in their tab.

### Empty State

If no file is open, the editor shows a message prompting you to select a file from the explorer.

---

## Terminal

The bottom panel is a full terminal emulator. It runs your system shell (`bash`, `zsh`, or PowerShell on Windows) inside the project directory.

### Using the Terminal

- Type commands and press Enter, just like a regular terminal.
- Links in terminal output are clickable.
- The terminal auto-resizes when you resize the panel.

### Multiple Terminals

- Click the **+** button in the terminal tab bar to create a new terminal.
- Click a tab to switch between terminals.
- Hover over a tab and click **x** to close it.

A terminal is created automatically when you open a project. If you close all terminals and need a new one, click **+**.

---

## AI Assistant

The right panel is a chat interface connected to your configured AI agents. It's designed for asking questions about your code.

### Setup

The AI assistant uses the agents you've configured in **Settings > AI Agents**. If you have multiple agents, a dropdown at the top lets you pick which one to use. The agent marked as "active" is selected by default.

If no agent is configured, the panel will tell you to add one in Settings.

### How It Works

1. Type a question or request in the input box at the bottom.
2. Press **Enter** to send (or **Shift+Enter** for a new line).
3. The AI responds with context about your current file — it automatically sees:
   - Which file you have open
   - The file's content (up to 4000 characters)

### Example Prompts

- "What does this function do?"
- "How can I refactor this component?"
- "Write a unit test for the function on line 42"
- "Explain the error in this code"
- "Convert this to TypeScript"

### Tips

- Open the file you want to discuss **before** asking — the AI uses it as context.
- The conversation persists within the session. Closing and reopening the panel clears it.
- For best results, be specific: mention function names, line numbers, or paste error messages.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Toggle file explorer |
| `` Ctrl+` `` | Toggle terminal |
| `Ctrl+J` | Toggle AI assistant |
| `Ctrl+S` | Save current file |

On macOS, use `Cmd` instead of `Ctrl`.

All standard Monaco Editor shortcuts also work inside the code editor (e.g., `Ctrl+D` for select next occurrence, `Ctrl+Shift+K` for delete line, `Ctrl+/` for toggle comment).

---

## Status Bar

The bottom bar shows:

- **Git branch** — the current branch of your project (if it's a git repo).
- **Language** — the detected language of the current file.
- **Encoding** — always UTF-8.

---

## FAQ

**Q: Can I open multiple projects at once?**
A: Open multiple browser tabs — each can navigate to `browser://ide?path=/different/project`.

**Q: Why can't I open a file?**
A: Binary files (images, executables, databases, etc.) are skipped automatically. Files larger than 5 MB are also rejected to keep the editor responsive.

**Q: The terminal isn't working.**
A: The terminal requires `node-pty`, which is a native module. If you're running from source, make sure native dependencies compiled correctly (`npm rebuild`).

**Q: Hidden files don't appear in the explorer.**
A: Files starting with `.` are hidden by default. This matches VS Code's default behavior.

**Q: How do I change the editor font or theme?**
A: The editor uses `vs-dark` theme and JetBrains Mono font by default. Custom theming is not yet exposed in settings.
