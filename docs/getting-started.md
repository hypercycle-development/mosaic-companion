# Getting Started with Mosaic

Install Mosaic, connect a free AI model, and find your way around — no
technical background needed. About 15 minutes, start to finish.

## 1. Install Mosaic

Download the installer for your system from the
[download page](https://releases.hyperpg.site/mosaic/) (or the
[GitHub releases page](https://github.com/hypercycle-development/mosaic-companion/releases)).

### Linux / Ubuntu (easiest)

1. Download the `.deb` for your machine — a normal PC or laptop is **x64**; a
   Raspberry Pi or other ARM device is **arm64**.
2. Double-click the downloaded file and click **Install** in App Center — or,
   in a terminal: `sudo apt install ~/Downloads/mosaic-companion_*.deb`
3. Press the Super (Windows) key, type "Mosaic", open **Mosaic Companion**.

Prefer a portable app? Use the AppImage instead: make it executable
(right-click → Properties → allow executing, or `chmod +x`) and double-click.
If it won't start on a newer distro, install FUSE first:
`sudo apt install libfuse2`.

### macOS

1. Check your chip:  → **About This Mac**. "Apple M1/M2/M3/M4" → download the
   **Apple Silicon** `.dmg`; "Intel" → the **Intel** one.
2. Open the `.dmg`, drag **Mosaic Companion** into **Applications**, eject.
3. **First launch — important.** Mosaic isn't signed with Apple yet, so don't
   double-click the first time. Right-click the app → **Open** → **Open**.

> **Mac says the app is "damaged" or blocked?** That's macOS being cautious
> about unsigned apps, not a problem with your download. Either open
> **System Settings → Privacy & Security** and click **Open Anyway**, or run
> this in Terminal and launch again:
>
> ```bash
> xattr -cr /Applications/mosaic-companion.app
> ```
>
> These steps are temporary until Mosaic ships signed builds.

### Windows

1. Download the `Setup.exe`. (Edge may flag the download — click **···** next
   to the file → **Keep** → **Keep anyway**.)
2. Double-click it. If SmartScreen appears: **More info** → **Run anyway**.
   The warning appears because the app isn't code-signed yet — normal for
   open-source software.
3. The app installs and opens automatically; later, find it in the Start Menu.

## 2. The setup wizard

The first time Mosaic opens, a short wizard walks you through a welcome, a
feature overview, and **adding your first AI agent** — that last screen is
where the key from the next step goes.

You can't get this wrong:

- Clicked **Skip for now**? Add an agent anytime under **Configuration → AI
  Agents → Add Agent** (same fields as the wizard).
- Want the wizard back? **Configuration → Replay Onboarding**.
- An "agent" is just an AI model plus your key for it. You can add several
  and switch between them.

## 3. Get a free Gemini API key

Google's AI Studio gives you a free key for the Gemini models — no credit
card needed.

1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in with a
   Google account.
2. Find **"Get API key"** in the bottom-left sidebar, then **"Create API
   key"** (top right).
3. Choose **"Create Project"**, name it something like "Mosaic", click
   Create, then the final **"Create Key"** button.
4. Click the partial key text (e.g. `...kJsY`) to reveal the full key and copy
   it. **Treat it like a password.**

## 4. Connect Gemini to Mosaic

In the wizard's agent screen (or **Configuration → AI Agents → Add Agent**):

| Field    | Value |
| -------- | ----- |
| Provider | **Custom Endpoint** |
| Name     | Anything you like — e.g. `Gemini` |
| Model    | `gemini-3-flash-preview` |
| Base URL | `https://generativelanguage.googleapis.com/v1beta/openai` |
| API Key  | paste the key from step 3 |

Then: switch **Active** ON (green) → **Test Connection** → look for
*"Connection established successfully!"* → **Save** (or **Continue**).

**Test failed?**

- *"Quota exceeded"* — free keys have small daily limits and occasionally
  start rate-limited. Your key is fine; wait a bit and test again.
- *"Invalid key / unauthorized"* — re-paste the entire key with no extra
  spaces or line breaks.
- *"Model not found"* — Google renames models over time; check the current
  list at [ai.google.dev](https://ai.google.dev/gemini-api/docs/models) and
  use the newest "flash" model name.

## 5. Say hello & find your way around

Click **AI Chat** in the left sidebar (open it with the ☰ button, top-left)
and say hello to your new agent.

| Section | What it's for |
| ------- | ------------- |
| **AI Chat** | One-on-one chat with your AI agents — the main chat. |
| **Mosaic Bot** | A built-in background assistant with long-term memory. |
| **Chat Rooms** | Shared rooms for several people and agents. Needs a chat server — safe to ignore at first. |
| **MCP Servers** | Optional plug-ins that give agents extra tools. |
| **Web 3** | Connect a crypto wallet, set transfer limits. Only relevant if you use crypto. |
| **Vault** | Encrypted boxes for notes and secrets — you choose which agents can read each box. |
| **HyperInsight** | Browse services and nodes on the HyperCycle network. |
| **IDE** | Built-in code editor. For programmers. |
| **Tool Sandbox** | Install small, safely-sandboxed tools agents can run. |
| **Configuration** | Settings — including AI Agents, where keys and models live. |

💡 Mosaic works like a browser: the **+** button at the top opens everything
in tabs. Panels like "Neural Bridges" or "HyperCycle Grid" are preview
features — you can safely ignore them.

## 6. Staying up to date

Mosaic checks for updates on startup and tells you when a new version is out;
on Linux and macOS it opens the download page — install the new version the
same way as step 1. Your settings, agents, and vault stay put. You can also
check manually: **Configuration → Check for Updates**.

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| Agent doesn't answer | Check **Configuration → AI Agents**: is the agent's **Active** toggle green, and does **Test Connection** pass? |
| "Quota exceeded" | Free Gemini keys have small daily limits — wait and retry. The key itself is fine. |
| "Connection failed" | Re-copy the Model and Base URL from step 4 exactly; re-paste the full key. |
| Mac: "app is damaged" | See the macOS install note above (`xattr -cr …` or "Open Anyway"). |
| AppImage won't start | `chmod +x` the file; on newer Ubuntu `sudo apt install libfuse2`. |
| Something else | [Open an issue](https://github.com/hypercycle-development/mosaic-companion/issues). |
