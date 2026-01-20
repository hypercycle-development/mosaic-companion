import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { ContentArea } from "./components/ContentArea";
import { TabStrip } from "./components/TabStrip";
import { BottomBar } from "./components/BottomBar";
import { DemoOverlay } from "./components/DemoOverlay";
import { INTERNAL_HOME_URL, Tab } from "./types/types";
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

  // Helper to get active tab
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

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
    setActiveTabId(newTab.id);
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
    setActiveTabId(id);
  };

  // Update specific tab properties (title, favicon, loading state)
  const handleUpdateTab = (id: string, updates: Partial<Tab>) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, ...updates } : tab))
    );
  };

  // --- Navigation Logic (Applied to Active Tab) ---
  const updateActiveTabHistory = (newHistory: Tab["history"]) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, history: newHistory } : tab
      )
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

  // Handle "AI" inputs from the bottom bar
  const handleBottomBarSubmit = (text: string) => {
    if (text.toLowerCase().includes("demo")) {
      setIsDemoActive(true);
      return;
    }

    if (text.startsWith("http")) {
      navigateTo(text);
    } else {
      navigateTo(`https://www.google.com/search?q=${encodeURIComponent(text)}`);
    }
  };

  if (!isReady) {
    return null;
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden font-sans transition-colors duration-200 selection:bg-[var(--selection)]"
      style={{ backgroundColor: "var(--background)", color: "var(--text)" }}
    >
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

          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 w-full h-full flex flex-col ${
                tab.id === activeTabId ? "z-10" : "z-0 invisible"
              }`}
            >
              <ContentArea
                url={tab.history.present}
                onNavigate={navigateTo}
                settings={{
                  homeUrl,
                  setHomeUrl,
                  customGreeting,
                  setCustomGreeting,
                  showUrlBar: showUrlBar,
                  setShowUrlBar: setShowUrlBar,
                }}
                onUpdateTab={(updates) => handleUpdateTab(tab.id, updates)}
                onStartDemo={() => setIsDemoActive(true)}
              />
            </div>
          ))}
        </div>

        {/* Bottom AI Input Bar */}
        {/* {!isDemoActive && <BottomBar onSubmit={handleBottomBarSubmit} />} */}
      </main>
    </div>
  );
}

export default App;
