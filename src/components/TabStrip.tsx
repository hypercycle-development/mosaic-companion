import React from "react";
import { X, Plus, Globe, Home, Settings, Loader2 } from "lucide-react";
import { Tab, INTERNAL_HOME_URL, INTERNAL_SETTINGS_URL } from "../types/types";

interface TabStripProps {
  tabs: Tab[];
  activeTabId: string;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  onNewTab: () => void;
}

export const TabStrip: React.FC<TabStripProps> = ({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onNewTab,
}) => {
  const renderTabIcon = (tab: Tab) => {
    // 1. Loading State
    if (tab.isLoading) {
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
          className="w-3.5 h-3.5 object-contain"
          onError={(e) => {
            // Fallback if favicon fails to load
            (e.target as HTMLImageElement).style.display = "none";
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove(
              "hidden"
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
    <div className="flex items-center h-10 bg-gray-200 dark:bg-gray-950 px-2 pt-2 gap-1 overflow-x-auto select-none border-b border-gray-300 dark:border-gray-800 shrink-0">
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
  );
};
