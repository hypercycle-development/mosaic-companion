# HyperInsight Plugin Overview

This plugin integrates HyperInsight functionality into the Mosaic Browser, allowing users to view AIMs, Leaderboards, Network Statistics, and manage their HyperInsight API connection(*API management is not fully built out yet) directly from the browser.

To test, you may need to run npm install to get the recharts dependency first.
Then start mosaic using *npm run start*(I could not get the api to function as an independent localhost browser frontend). Navigate to Hyperinsight tab in the navbar. 
Api key should provision automatically and data should load within a few seconds. 

## 1. Architecture & Integration

The plugin follows the standard Electron multi-process architecture, split into **Main** and **Renderer** components, and integrates deeply with the host Mosaic application.

### A. Main Process (`main/index.js`)
The backend of the plugin running in the Electron main process.
*   **Responsibilities**:
    *   **IPC Handling**: Listens for events on the `hyperinsight` namespace.
    *   **API Proxy**: Proxies requests to `https://api.hyperinsight.app/v1`.
    *   **Key Management**: Securely stores/retrieves API keys.
*   **Integration**:
    Registered in `mosaic-browser/main.js`:
    ```javascript
    import { registerHyperInsightIpc } from "./plugins/hyperinsight/main/index.js";
    app.whenReady().then(() => {
        registerHyperInsightIpc(ipcMain);
    });
    ```

### B. Renderer Process (`renderer/`)
The frontend UI built with React.
*   **Entry Point**: `renderer/index.tsx` mounts the React application.
*   **Main Component**: `renderer/HyperInsightView.tsx` handles state and routing.
*   **Navigation**:
    Accessible via the internal URL defined in `mosaic-browser/src/types/types.ts`:
    ```typescript
    export const INTERNAL_HYPERINSIGHT_URL = 'mosaic://hyperinsight';
    ```

### C. Integration Bridge (`preload.js`)
Exposes functionality to the renderer via `window.electronAPI.hyperinsight`.
*   **Implementation**:
    In `mosaic-browser/preload.js`:
    ```javascript
    contextBridge.exposeInMainWorld("electronAPI", {
        hyperinsight: {
            getStatus: () => ipcRenderer.invoke("hyperinsight:get-status"),
            ensureKey: () => ipcRenderer.invoke("hyperinsight:ensure-key"),
            // ... mapped methods
        }
    });
    ```

## 2. Essential Functions

### Backend (`main/index.js`)
*   **Authentication**:
    *   `hyperinsight:get-status`: Checks local storage for a valid key.
    *   `hyperinsight:ensure-key`: Registers a new client (`/auth/register-client`) if missing.
    *   `hyperinsight:reset-key`: Clears stored credentials.
*   **Data Fetching**:
    All requests automatically attach the Bearer token.
    *   `hyperinsight:get-aims`: List of AIMs.
    *   `hyperinsight:get-leaderboard`: Top performing AIMs.
    *   `hyperinsight:get-network-stats`: Global compute and node counts.
    *   `hyperinsight:get-network-history`: Historical data for charts.
    *   `hyperinsight:get-aim-details`: Specific AIM metadata and release history.

### Frontend Components (`renderer/`)
*   **`HyperInsightView.tsx`**: Main controller. Manages tabs (Leaderboard, Aims, Nodes).
*   **`AimDetailView.tsx`**: Drill-down view for specific AIMs.
*   **`MetricCard.tsx`**: Dashboard widget with sparkline charts.
*   **`LeaderboardTable.tsx`**: Sortable performance table.

## 3. Data Flow

1.  **Initialization**:
    *   View mounts -> checks `getStatus()`.
    *   If unregistered, calls `ensureKey()` to auto-register.
2.  **Fetching**:
    *   Renderer calls `window.electronAPI.hyperinsight.getAims()`.
    *   IPC invokes Main process handler.
    *   Main process decrypts API key -> calls external API.
    *   JSON response returns to Renderer -> React State updates.

## 4. Data Models & Types

Types are defined globally in `mosaic-browser/global.d.ts`.

### Implicit Data Shapes
*   **Aim Item**:
    *   `name`: string
    *   `totalNodesActivated`: number
    *   `totalRevenue`: number | string
    *   `lastSeen`: string (ISO Date)
*   **Network Stats**:
    *   `totalAimsAvailable`: number
    *   `totalComputeTflops`: number
    *   `totalComputeCghz`: number

## 5. Security & Storage

Security is a priority for managing the API Key.

*   **Storage Location**: `hyperinsight.json` in the user's data directory (`app.getPath('userData')`).
*   **Encryption**:
    *   Keys are **encrypted** using Electron's `safeStorage` API before writing to disk.
    *   Field: `apiKeyEncB64` in the JSON file.
*   **Logic**:
    *   `saveKeyData`: Encrypts the key.
    *   `loadKeyData`: Decrypts on demand for API calls.

## 6. External Dependencies

*   **API Endpoint**: `https://api.hyperinsight.app/v1`
*   **Libraries**:
    *   `recharts`: For data visualization (historical trend graphs).
    *   `lucide-react`: For UI icons (Activity, Server, Trophy).

## 7. File Structure

```
mosaic-browser/plugins/hyperinsight/
├── main/
│   └── index.js           # Backend logic (IPC, API, Encryption)
├── renderer/
│   ├── components/        # React UI components
│   ├── HyperInsightView.tsx # Main Controller
│   └── index.tsx          # Entry Point
├── manifest.json          # Plugin metadata
└── OVERVIEW.md            # This documentation
```
