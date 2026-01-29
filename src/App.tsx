import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { ContentArea } from "./components/ContentArea";
import { TabStrip } from "./components/TabStrip";
import { BottomBar, InputMode } from "./components/BottomBar";
import { DemoOverlay } from "./components/DemoOverlay";
import { CommandPalette } from "./components/CommandPalette";
import { SandboxWarningBanner } from "./components/SandboxWarningBanner";
import { INTERNAL_HOME_URL, INTERNAL_CHAT_URL, Tab } from "./types/types";
import { useTheme } from "./ThemeProvider";

function App() {
  // --- Persistent State ---
  const [homeUrl, setHomeUrl] = useState(() => {
    return localStorage.getItem("browser_home_url") || INTERNAL_HOME_URL;
  });
  const [customGreeting, setCustomGreeting] = useState(() => {
    return localStorage.getItem("browser_custom_greeting") || "";
  });
  const [showUrlBar, setShowUrlBar] = useState(() => {
    // Default to FALSE for the AI Companion look
    const stored = localStorage.getItem("browser_show_url_bar");
    return stored === "true";
  });

  const { theme, themeKey, setThemeKey, isReady } = useTheme();

  // Sidebar State (Defaults to Closed)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDemoActive, setIsDemoActive] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [hasAgents, setHasAgents] = useState(false);

  // Input mode state (agent or normal)
  const [inputMode, setInputMode] = useState<InputMode>("normal");

  // Check for configured agents on mount
  useEffect(() => {
    const checkAgents = async () => {
      try {
        const agents = await window.electronAPI.aiAgents.get();
        const activeAgents = agents.filter(
          (a: { isActive: boolean }) => a.isActive,
        );
        setHasAgents(activeAgents.length > 0);
        // If we have agents and user hasn't explicitly chosen, stay in current mode
      } catch {
        setHasAgents(false);
      }
    };
    checkAgents();
  }, []);

  // --- Tab & Session State ---
  const [tabs, setTabs] = useState<Tab[]>(() => {
    // Initial tab
    return [
      {
        id: Date.now().toString(),
        title: "Home",
        history: {
          past: [],
          present: homeUrl,
          future: [],
        },
        isLoading: false,
      },
    ];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);
  const [previousTabId, setPreviousTabId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Helper to get active tab
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Auto-switch to agent mode when on AI Chat page
  useEffect(() => {
    if (activeTab.history.present === INTERNAL_CHAT_URL && hasAgents) {
      setInputMode("agent");
    }
  }, [activeTab.history.present, hasAgents]);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem("browser_home_url", homeUrl);
  }, [homeUrl]);

  useEffect(() => {
    localStorage.setItem("browser_custom_greeting", customGreeting);
  }, [customGreeting]);

  useEffect(() => {
    localStorage.setItem("browser_show_url_bar", String(showUrlBar));
  }, [showUrlBar]);

  // Check for active agents
  useEffect(() => {
    const checkAgents = async () => {
      try {
        const agents = await window.electronAPI?.aiAgents?.get();
        const activeAgents = agents?.filter((a: any) => a.isActive) || [];
        setHasAgents(activeAgents.length > 0);
      } catch (error) {
        console.error("Error checking agents:", error);
        setHasAgents(false);
      }
    };
    checkAgents();
    // Check periodically in case agents are added/removed
    const interval = setInterval(checkAgents, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    const next = themeKey === "dark" ? "light" : "dark";
    setThemeKey(next as typeof themeKey);
  };

  // --- Tab Management ---
  const handleNewTab = () => {
    const newTab: Tab = {
      id: Date.now().toString(),
      title: "New Tab",
      history: { past: [], present: homeUrl, future: [] },
      isLoading: false,
    };
    setTabs((prev) => [...prev, newTab]);
    setPreviousTabId(activeTabId);
    setIsTransitioning(true);
    setActiveTabId(newTab.id);
    setTimeout(() => {
      setIsTransitioning(false);
      setPreviousTabId(null);
    }, 300);
  };

  const handleNewChatTab = (initialMessage?: string) => {
    const newTab: Tab = {
      id: Date.now().toString(),
      title: "AI Chat",
      history: { past: [], present: INTERNAL_CHAT_URL, future: [] },
      isLoading: false,
    };
    setTabs((prev) => [...prev, newTab]);
    setPreviousTabId(activeTabId);
    setIsTransitioning(true);
    setActiveTabId(newTab.id);

    // Store initial message if provided
    if (initialMessage) {
      localStorage.setItem(`chat_pending_message_${newTab.id}`, initialMessage);
    }

    setTimeout(() => {
      setIsTransitioning(false);
      setPreviousTabId(null);
    }, 300);
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent switching to the tab being closed
    if (tabs.length === 1) return; // Don't close last tab

    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);

    if (activeTabId === id) {
      // If we closed the active tab, switch to the last available one
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const handleSwitchTab = (id: string) => {
    if (id === activeTabId) return;
    setPreviousTabId(activeTabId);
    setIsTransitioning(true);
    setActiveTabId(id);
    // Reset transition state after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
      setPreviousTabId(null);
    }, 300);
  };

  // Update specific tab properties (title, favicon, loading state)
  const handleUpdateTab = (id: string, updates: Partial<Tab>) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, ...updates } : tab)),
    );
  };

  // --- Navigation Logic (Applied to Active Tab) ---
  const updateActiveTabHistory = (newHistory: Tab["history"]) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, history: newHistory } : tab,
      ),
    );
  };

  const navigateTo = (url: string) => {
    if (url === activeTab.history.present) return;

    updateActiveTabHistory({
      past: [...activeTab.history.past, activeTab.history.present],
      present: url,
      future: [],
    });
  };

  const goBack = () => {
    if (activeTab.history.past.length === 0) return;
    const previous = activeTab.history.past[activeTab.history.past.length - 1];
    const newPast = activeTab.history.past.slice(0, -1);

    updateActiveTabHistory({
      past: newPast,
      present: previous,
      future: [activeTab.history.present, ...activeTab.history.future],
    });
  };

  const goForward = () => {
    if (activeTab.history.future.length === 0) return;
    const next = activeTab.history.future[0];
    const newFuture = activeTab.history.future.slice(1);

    updateActiveTabHistory({
      past: [...activeTab.history.past, activeTab.history.present],
      present: next,
      future: newFuture,
    });
  };

  const handleRefresh = () => {
    const current = activeTab.history.present;
    updateActiveTabHistory({ ...activeTab.history, present: "" });
    setTimeout(() => {
      updateActiveTabHistory({ ...activeTab.history, present: current });
    }, 10);
  };

  // Handle inputs from the bottom bar
  const handleBottomBarSubmit = (text: string) => {
    if (text.toLowerCase().includes("demo")) {
      setIsDemoActive(true);
      return;
    }

    // If in agent mode, navigate to AI Chat and send message
    if (inputMode === "agent" && hasAgents) {
      // Store the message to be picked up by ChatView
      sessionStorage.setItem("pendingChatMessage", text);
      navigateTo(INTERNAL_CHAT_URL);
      return;
    }

    // Normal mode: URL or search
    if (text.startsWith("http")) {
      navigateTo(text);
    } else {
      navigateTo(`https://www.google.com/search?q=${encodeURIComponent(text)}`);
    }
  };

  // Keyboard shortcut for command palette only
  useEffect(() => {
    // Handle Cmd+K for command palette (renderer-only, highest priority)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open/close command palette (highest priority)
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        e.stopPropagation();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }
    };

    // Use capture phase to catch events early
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isCommandPaletteOpen]);

  if (!isReady) {
    return null;
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden font-sans transition-colors duration-200 selection:bg-[var(--selection)]"
      style={{ backgroundColor: "var(--background)", color: "var(--text)" }}
    >
      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        tabs={tabs}
        activeTabId={activeTabId}
        onNavigate={navigateTo}
        onSwitchTab={handleSwitchTab}
        onNewTab={handleNewTab}
        onNewChatTab={handleNewChatTab}
        onCloseTab={handleCloseTab}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onRefresh={handleRefresh}
        onBack={goBack}
        onForward={goForward}
        canGoBack={activeTab.history.past.length > 0}
        canGoForward={activeTab.history.future.length > 0}
        onSearchInNewTab={(query) => {
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
            query,
          )}`;
          const newTab: Tab = {
            id: Date.now().toString(),
            title: "New Tab",
            history: { past: [], present: searchUrl, future: [] },
            isLoading: false,
          };
          setTabs((prev) => [...prev, newTab]);
          setPreviousTabId(activeTabId);
          setIsTransitioning(true);
          setActiveTabId(newTab.id);
          setTimeout(() => {
            setIsTransitioning(false);
            setPreviousTabId(null);
          }, 300);
        }}
        onSendChatMessage={(message) => {
          handleNewChatTab(message);
        }}
        hasAgents={hasAgents}
      />

      {/* Full Screen Demo Overlay */}
      {isDemoActive && <DemoOverlay onClose={() => setIsDemoActive(false)} />}

      {/* Left Panel */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onNavigate={navigateTo}
        currentUrl={activeTab.history.present}
      />

      {/* Main Browser Area */}
      <main
        className="flex-1 flex flex-col min-w-0 relative overflow-hidden shadow-2xl"
        style={{
          backgroundColor: "var(--surfaceAlt)",
          boxShadow: "0 10px 40px var(--shadow)",
        }}
      >
        {/* Sandbox Warning Banner (Linux only) - at top of main area */}
        <SandboxWarningBanner />

        {/* Conditional Top Bar */}
        {showUrlBar && (
          <div
            className="border-b"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--background)",
            }}
          >
            <TopBar
              currentUrl={activeTab.history.present}
              canGoBack={activeTab.history.past.length > 0}
              canGoForward={activeTab.history.future.length > 0}
              onNavigate={navigateTo}
              onBack={goBack}
              onForward={goForward}
              onRefresh={handleRefresh}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen(true)}
              isLoading={activeTab.isLoading}
              loadProgress={activeTab.loadProgress || 0}
            />
          </div>
        )}

        {/* Tab Strip */}
        {!isDemoActive && (
          <TabStrip
            tabs={tabs}
            activeTabId={activeTabId}
            onSwitchTab={handleSwitchTab}
            onCloseTab={handleCloseTab}
            onNewTab={handleNewTab}
          />
        )}

        {/* Content Area */}
        <div
          className="flex-1 relative overflow-hidden"
          style={{ backgroundColor: "var(--surface)" }}
        >
          {!showUrlBar && !isSidebarOpen && !isDemoActive && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute top-4 left-4 z-50 p-2 rounded-full transition-colors backdrop-blur-md"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--background) 85%, transparent)",
                color: "var(--text)",
                border: `1px solid var(--border)`,
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18" />
              </svg>
            </button>
          )}

          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isPrevious = tab.id === previousTabId;

            return (
              <div
                key={tab.id}
                className={`
                  absolute inset-0 w-full h-full flex flex-col
                  transition-all duration-300 ease-in-out
                  ${
                    isActive
                      ? "z-10 opacity-100 translate-x-0 scale-100"
                      : isPrevious && isTransitioning
                        ? "z-0 opacity-0 -translate-x-4 scale-95"
                        : "z-0 opacity-0 translate-x-4 scale-95 pointer-events-none"
                  }
                `}
              >
                <ContentArea
                  url={tab.history.present}
                  onNavigate={navigateTo}
                  theme={theme}
                  toggleTheme={toggleTheme}
                  settings={{
                    homeUrl,
                    setHomeUrl,
                    customGreeting,
                    setCustomGreeting,
                    showUrlBar: showUrlBar,
                    setShowUrlBar: setShowUrlBar,
                    onOpenCommandPalette: () => setIsCommandPaletteOpen(true),
                  }}
                  onUpdateTab={(updates) => handleUpdateTab(tab.id, updates)}
                  onStartDemo={() => setIsDemoActive(true)}
                  onCreateNewChatTab={handleNewChatTab}
                  tabId={tab.id}
                />
              </div>
            );
          })}
        </div>

        {/* Bottom AI Input Bar - hide when on AI Chat page (ChatView has its own input) */}
        {!isDemoActive && activeTab.history.present !== INTERNAL_CHAT_URL && (
          <BottomBar
            onSubmit={handleBottomBarSubmit}
            mode={inputMode}
            onModeChange={setInputMode}
            hasAgents={hasAgents}
          />
        )}
      </main>
    </div>
  );
}

export default App;
