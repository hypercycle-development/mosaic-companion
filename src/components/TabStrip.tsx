import React from "react";
import { X, Plus, Globe, Home, Settings, Loader2 } from "lucide-react";
import { Tab, INTERNAL_HOME_URL, INTERNAL_SETTINGS_URL } from "../types/types";
import { WindowControls } from "./WindowControls";

interface TabStripProps {
  tabs: Tab[];
  activeTabId: string;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  onNewTab: () => void;
  showWindowControls?: boolean;
}

export const TabStrip: React.FC<TabStripProps> = ({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onNewTab,
  showWindowControls = true,
}) => {
  const renderTabIcon = (tab: Tab) => {
    // 1. Loading State with pulsing animation
    if (tab.isLoading) {
      // Show pulsing favicon if available, otherwise spinner
      if (tab.favicon) {
        return (
          <div className="relative">
            <img
              src={tab.favicon}
              alt=""
              className="w-3.5 h-3.5 object-contain animate-pulse opacity-60"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={10} className="animate-spin text-indigo-500" />
            </div>
          </div>
        );
      }
      return <Loader2 size={14} className="animate-spin text-indigo-500" />;
    }

    // 2. Internal Pages
    if (tab.history.present === INTERNAL_HOME_URL) return <Home size={14} />;
    if (tab.history.present === INTERNAL_SETTINGS_URL)
      return <Settings size={14} />;

    // 3. Website Favicon
    if (tab.favicon) {
      return (
        <img
          src={tab.favicon}
          alt=""
          className="w-3.5 h-3.5 object-contain transition-opacity duration-200"
          onError={(e) => {
            // Fallback if favicon fails to load
            (e.target as HTMLImageElement).style.display = "none";
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove(
              "hidden",
            );
          }}
        />
      );
    }

    // 4. Fallback Generic Icon
    return <Globe size={14} />;
  };

  const getTabTitle = (tab: Tab) => {
    if (tab.title && tab.title !== "New Tab") return tab.title;

    // Fallback logic if title isn't set yet
    if (tab.history.present === INTERNAL_HOME_URL) return "Home";
    if (tab.history.present === INTERNAL_SETTINGS_URL) return "Settings";
    try {
      const url = new URL(tab.history.present);
      return url.hostname;
    } catch {
      return "New Tab";
    }
  };

  return (
    <div
      className="flex items-center h-10 bg-gray-200 dark:bg-gray-950 px-2 pt-2 gap-1 select-none border-b border-gray-300 dark:border-gray-800 shrink-0"
      style={
        showWindowControls
          ? ({ WebkitAppRegion: "drag" } as React.CSSProperties)
          : undefined
      }
    >
      {/* Tabs area - not draggable */}
      <div
        className="flex items-center gap-1 overflow-x-auto flex-1"
        style={
          showWindowControls
            ? ({ WebkitAppRegion: "no-drag" } as React.CSSProperties)
            : undefined
        }
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSwitchTab(tab.id)}
              className={`
                  group relative flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[200px] h-full rounded-t-lg cursor-pointer transition-all duration-200 border-t border-x
                  ${
                    isActive
                      ? "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-800 border-b-white dark:border-b-gray-900"
                      : "bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-300/50 dark:hover:bg-gray-800 border-transparent hover:border-gray-300/30 dark:hover:border-gray-700/30"
                  }
                `}
            >
              <span
                className={`flex items-center justify-center w-4 h-4 opacity-70 ${
                  isActive ? "text-indigo-500 dark:text-indigo-400" : ""
                }`}
              >
                {renderTabIcon(tab)}
                {/* Hidden fallback icon for when img fails */}
                {tab.favicon && !tab.isLoading && (
                  <Globe size={14} className="hidden" />
                )}
              </span>

              <span className="text-xs font-medium truncate flex-1">
                {getTabTitle(tab)}
              </span>

              {/* Loading Progress Indicator */}
              {tab.isLoading && tab.loadProgress !== undefined && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-transparent overflow-hidden rounded-b-lg">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-150 ease-out"
                    style={{ width: `${tab.loadProgress}%` }}
                  />
                </div>
              )}

              <button
                onClick={(e) => onCloseTab(tab.id, e)}
                className={`
                    p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all
                    ${tabs.length === 1 ? "hidden" : ""}
                  `}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        <button
          onClick={onNewTab}
          className="p-1.5 ml-1 rounded-md text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-800 transition-colors"
          title="New Tab"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Draggable spacer - allows window dragging from empty area */}
      {showWindowControls && (
        <div
          className="flex-1 h-full min-w-8 bg-gray-800/60 cursor-grab rounded"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        />
      )}

      {/* Window Controls - only show when not using default title bar */}
      {showWindowControls && (
        <div
          className="flex items-center pl-2"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <WindowControls />
        </div>
      )}
    </div>
  );
};
