import React, { useState, useRef, useEffect } from "react";
import {
  INTERNAL_CHAT_URL,
  INTERNAL_HOME_URL,
  INTERNAL_MCP_URL,
  INTERNAL_MOSAICBOT_URL,
  INTERNAL_MULTI_CHAT_URL,
  INTERNAL_SETTINGS_URL,
  INTERNAL_WEB3_URL,
  INTERNAL_VAULT_URL,
  INTERNAL_SANDBOX_URL,
  INTERNAL_TOOL_PANEL_PREFIX,
  Tab,
} from "../types/types";
import { LandingPage } from "./LandingPage";
import { SettingsPage } from "./SettingsPage";
import { MosaicBotPanel } from "./MosaicBotPanel";
import { MCPPage } from "./MCPPage";
import { ChatPage } from "./ChatPage";
import { Web3Page } from "./Web3Page";
import { VaultPage } from "./VaultPage";
import { SandboxPage } from "./SandboxPage";
import { ToolPanelView } from "./ToolPanelView";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ChatView } from "./Chatview";
import { HYPERINSIGHT_MANIFEST, HYPERINSIGHT_PANEL_DATA } from "./tool-ui/demos/hyperinsight";

interface ContentAreaProps {
  url: string;
  onNavigate: (url: string) => void;
  theme: any;
  toggleTheme: () => void;
  settings: {
    homeUrl: string;
    setHomeUrl: (url: string) => void;
    customGreeting: string;
    setCustomGreeting: (text: string) => void;
    showUrlBar: boolean;
    setShowUrlBar: (show: boolean) => void;
    onOpenCommandPalette?: () => void;
  };
  onUpdateTab: (updates: Partial<Tab>) => void;
  onStartDemo?: () => void;
  onCreateNewChatTab?: () => void;
  tabId?: string;
}

interface BrowserViewProps {
  url: string;
  onNavigate: (url: string) => void;
  onUpdateTab: (updates: Partial<Tab>) => void;
}

const BrowserView: React.FC<BrowserViewProps> = ({
  url,
  onNavigate,
  onUpdateTab,
}) => {
  const [hasError, setHasError] = useState(false);
  const webviewRef = useRef<any>(null);
  const loadingTimeoutRef = useRef<any>(null);
  const loadProgressRef = useRef<number>(0);

  // Reset error state when URL changes explicitly
  useEffect(() => {
    setHasError(false);
  }, [url]);

  // Effect to attach listeners to webview
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleStartLoading = () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      loadProgressRef.current = 0;
      onUpdateTab({ isLoading: true, loadProgress: 0 });
      setHasError(false);

      // Simulate smooth progress (since Electron webview doesn't expose direct progress)
      const progressInterval = setInterval(() => {
        if (loadProgressRef.current < 90) {
          loadProgressRef.current = Math.min(
            90,
            loadProgressRef.current + Math.random() * 15,
          );
          onUpdateTab({
            isLoading: true,
            loadProgress: loadProgressRef.current,
          });
        } else {
          clearInterval(progressInterval);
        }
      }, 200);

      // Store interval ID for cleanup
      (loadingTimeoutRef.current as any) = progressInterval;
    };

    const handleStopLoading = () => {
      // Clear any progress interval
      if (
        loadingTimeoutRef.current &&
        typeof loadingTimeoutRef.current === "number"
      ) {
        clearInterval(loadingTimeoutRef.current);
      }

      // Complete the progress bar
      onUpdateTab({ isLoading: true, loadProgress: 100 });

      // Debounce the stop loading to prevent flicker on redirects
      const stopTimeout = setTimeout(() => {
        onUpdateTab({ isLoading: false, loadProgress: undefined });
        loadingTimeoutRef.current = null;
      }, 200); // 200ms grace period

      loadingTimeoutRef.current = stopTimeout;
    };

    const handleFailLoad = (e: any) => {
      // errorCode -3 is ABORTED (often harmless redirects, especially on Google)
      // errorCode 0 is OK (sometimes fired incorrectly)
      // Ignore these as they're usually from redirects or navigation cancellations
      if (e.errorCode === -3 || e.errorCode === 0) {
        // Silently ignore - these are harmless navigation aborts
        return;
      }

      // Only log and show errors for actual failures
      console.warn("Webview load failed", e);
      if (loadingTimeoutRef.current) {
        if (typeof loadingTimeoutRef.current === "number") {
          clearInterval(loadingTimeoutRef.current);
        } else {
          clearTimeout(loadingTimeoutRef.current);
        }
        loadingTimeoutRef.current = null;
      }
      onUpdateTab({ isLoading: false, loadProgress: undefined });
      setHasError(true);
    };

    const handleNavigate = (e: any) => {
      if (e.url !== url) {
        onNavigate(e.url);
      }
    };

    const handleNewWindow = (e: any) => {
      if (e.url) {
        webview.loadURL(e.url);
      }
    };

    const handlePageTitleUpdated = (e: any) => {
      onUpdateTab({ title: e.title });
    };

    const handlePageFaviconUpdated = (e: any) => {
      if (e.favicons && e.favicons.length > 0) {
        onUpdateTab({ favicon: e.favicons[0] });
      }
    };

    // Attach listeners
    webview.addEventListener("did-start-loading", handleStartLoading);
    webview.addEventListener("did-stop-loading", handleStopLoading);
    webview.addEventListener("did-fail-load", handleFailLoad);
    webview.addEventListener("did-navigate", handleNavigate);
    webview.addEventListener("did-navigate-in-page", handleNavigate);
    webview.addEventListener("new-window", handleNewWindow);
    webview.addEventListener("page-title-updated", handlePageTitleUpdated);
    webview.addEventListener("page-favicon-updated", handlePageFaviconUpdated);

    return () => {
      // Clean up timeouts/intervals
      if (loadingTimeoutRef.current) {
        if (typeof loadingTimeoutRef.current === "number") {
          clearInterval(loadingTimeoutRef.current);
        } else {
          clearTimeout(loadingTimeoutRef.current);
        }
        loadingTimeoutRef.current = null;
      }

      if (webview) {
        webview.removeEventListener("did-start-loading", handleStartLoading);
        webview.removeEventListener("did-stop-loading", handleStopLoading);
        webview.removeEventListener("did-fail-load", handleFailLoad);
        webview.removeEventListener("did-navigate", handleNavigate);
        webview.removeEventListener("did-navigate-in-page", handleNavigate);
        webview.removeEventListener("new-window", handleNewWindow);
        webview.removeEventListener(
          "page-title-updated",
          handlePageTitleUpdated,
        );
        webview.removeEventListener(
          "page-favicon-updated",
          handlePageFaviconUpdated,
        );
      }
    };
  }, [onNavigate, url, onUpdateTab]);

  return (
    <div className="relative w-full h-full bg-gray-900 flex flex-col">
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
          <div className="max-w-md text-center p-6 bg-gray-800 rounded-xl shadow-lg border border-red-900/30">
            <div className="w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <AlertTriangle />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Failed to Load
            </h3>
            <p className="text-gray-400 mb-6">
              The website <strong>{url}</strong> could not be loaded.
            </p>
            <button
              onClick={() => onNavigate(INTERNAL_HOME_URL)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Back to Safety
            </button>
          </div>
        </div>
      )}

      <webview
        ref={webviewRef}
        src={url}
        className="flex-1 w-full h-full border-none bg-gray-900"
        allowpopups={true}
        webpreferences="allowRunningInsecureContent,experimentalFeatures"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};

export const ContentArea: React.FC<ContentAreaProps> = ({
  url,
  onNavigate,
  settings,
  theme,
  toggleTheme,
  onUpdateTab,
  onStartDemo,
  onCreateNewChatTab,
  tabId,
}) => {
  // Handle Demo Command
  if (url === "demo://start") {
    useEffect(() => {
      if (onStartDemo) {
        onStartDemo();
      }
      onNavigate(INTERNAL_HOME_URL);
    }, [url, onStartDemo, onNavigate]);

    return <div className="bg-black w-full h-full" />;
  }

  // Handle Internal Pages
  if (url === INTERNAL_HOME_URL) {
    useEffect(() => {
      onUpdateTab({
        title: "Mosaic",
        isLoading: false,
        favicon: undefined,
      });
    }, [url]);

    return (
      <LandingPage
        onNavigate={onNavigate}
        customGreeting={settings.customGreeting}
        onOpenCommandPalette={settings.onOpenCommandPalette}
      />
    );
  }

  if (
    url === INTERNAL_SETTINGS_URL ||
    url.startsWith(INTERNAL_SETTINGS_URL + "#")
  ) {
    // Extract hash for scroll section (e.g., #nodes -> "nodes")
    const scrollSection = url.includes("#") ? url.split("#")[1] : undefined;

    useEffect(() => {
      onUpdateTab({
        title: "Settings",
        isLoading: false,
        favicon: undefined,
      });
    }, [url]);

    return (
      <div className="h-full overflow-y-auto bg-gray-950 text-gray-100">
        <SettingsPage
          homeUrl={settings.homeUrl}
          setHomeUrl={settings.setHomeUrl}
          customGreeting={settings.customGreeting}
          setCustomGreeting={settings.setCustomGreeting}
          showUrlBar={settings.showUrlBar}
          setShowUrlBar={settings.setShowUrlBar}
          scrollSection={scrollSection}
        />
      </div>
    );
  }
  if (url === INTERNAL_CHAT_URL) {
    useEffect(() => {
      onUpdateTab({
        title: "AI Chat",
        isLoading: false,
        favicon: undefined,
      });
    }, [url]);

    return (
      <div className="h-full overflow-y-auto bg-gray-950 text-gray-100">
        <ChatView
          onNavigate={onNavigate}
          onCreateNewChatTab={onCreateNewChatTab}
          tabId={tabId}
        />
      </div>
    );
  }

  if (url === INTERNAL_MCP_URL) {
    useEffect(() => {
      onUpdateTab({
        title: "MCP Servers",
        isLoading: false,
        favicon: undefined,
      });
    }, [url]);

    return (
      <div className="h-full overflow-hidden bg-gray-950 text-gray-100">
        <MCPPage />
      </div>
    );
  }

  if (url === INTERNAL_MOSAICBOT_URL) {
    useEffect(() => {
      onUpdateTab({
        title: "Mosaic Bot",
        isLoading: false,
        favicon: undefined,
      });
    }, [url]);

    return (
      <div className="h-full overflow-y-auto bg-gray-950 text-gray-100">
        <MosaicBotPanel />
      </div>
    );
  }

  if (url === INTERNAL_MULTI_CHAT_URL) {
    useEffect(() => {
      onUpdateTab({
        title: "Chat Rooms",
        isLoading: false,
        favicon: undefined,
      });
    }, [url]);
    return (
      <div className="h-full overflow-hidden bg-gray-950 text-gray-100">
        <ChatPage />{" "}
      </div>
    );
  }
  if (url === INTERNAL_WEB3_URL) {
    useEffect(() => {
      onUpdateTab({ title: "Web3", isLoading: false, favicon: undefined });
    }, [url]);

    return (
      <div className="h-full overflow-y-auto bg-gray-950 text-gray-100">
        <Web3Page />
      </div>
    );
  }

  if (url === INTERNAL_VAULT_URL) {
    useEffect(() => {
      onUpdateTab({ title: "Vault", isLoading: false, favicon: undefined });
    }, [url]);

    return (
      <div className="h-full overflow-y-auto bg-gray-950 text-gray-100">
        <VaultPage />
      </div>
    );
  }

  if (url === INTERNAL_SANDBOX_URL) {
    useEffect(() => {
      onUpdateTab({ title: "Tool Sandbox", isLoading: false, favicon: undefined });
    }, [url]);

    return (
      <div className="h-full overflow-y-auto bg-gray-950 text-gray-100">
        <SandboxPage onNavigate={onNavigate} />
      </div>
    );
  }

  if (url.startsWith(INTERNAL_TOOL_PANEL_PREFIX)) {
    const toolId = url.slice(INTERNAL_TOOL_PANEL_PREFIX.length);

    // ─── Dev-mode demo panel ───────────────────────────────────────
    if (toolId === "__demo__") {
      useEffect(() => {
        onUpdateTab({ title: "HyperInsight (Demo)", isLoading: false, favicon: undefined });
      }, [url]);

      return (
        <div className="h-full overflow-y-auto bg-gray-950 text-gray-100">
          <ToolPanelView
            toolId="__demo__"
            manifest={HYPERINSIGHT_MANIFEST}
            mockData={HYPERINSIGHT_PANEL_DATA}
          />
        </div>
      );
    }

    const [manifest, setManifest] = useState<any>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
      const load = async () => {
        const res = await window.electronAPI.toolSandbox.listInstalled();
        if (res.success && res.data) {
          const tool = res.data.find((t: any) => t.manifest.id === toolId);
          if (tool) {
            setManifest(tool.manifest);
            onUpdateTab({ title: tool.manifest.displayName, isLoading: false, favicon: undefined });
          } else {
            setLoadError(`Tool "${toolId}" not found`);
            onUpdateTab({ title: "Tool Panel", isLoading: false, favicon: undefined });
          }
        }
      };
      load();
    }, [url]);

    if (loadError) {
      return (
        <div className="flex items-center justify-center h-64 text-red-400">
          <AlertTriangle size={20} className="mr-2" />
          {loadError}
        </div>
      );
    }

    if (!manifest) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={32} className="animate-spin text-gray-500" />
        </div>
      );
    }

    return (
      <div className="h-full overflow-y-auto bg-gray-950 text-gray-100">
        <ToolPanelView toolId={toolId} manifest={manifest} />
      </div>
    );
  }

  if (url.startsWith("browser://")) {
    useEffect(() => {
      onUpdateTab({
        title: "Internal Page",
        isLoading: false,
        favicon: undefined,
      });
    }, [url]);

    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-gray-900">
        <Loader2 size={48} className="mb-4 text-gray-700" />
        <p>This internal page "{url}" is under construction.</p>
        <button
          onClick={() => onNavigate(INTERNAL_HOME_URL)}
          className="mt-4 text-indigo-500 hover:underline"
        >
          Go Home
        </button>
      </div>
    );
  }

  // Handle External Sites (Webview)
  return (
    <BrowserView url={url} onNavigate={onNavigate} onUpdateTab={onUpdateTab} />
  );
};
