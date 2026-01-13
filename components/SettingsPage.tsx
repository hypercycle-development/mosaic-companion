import React from "react";
import { Save, Eye, Layout } from "lucide-react";

interface SettingsPageProps {
  homeUrl: string;
  setHomeUrl: (url: string) => void;
  customGreeting: string;
  setCustomGreeting: (text: string) => void;
  showUrlBar?: boolean;
  setShowUrlBar?: (show: boolean) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  homeUrl,
  setHomeUrl,
  customGreeting,
  setCustomGreeting,
  showUrlBar,
  setShowUrlBar,
}) => {
  return (
    <div className="max-w-4xl mx-auto p-8 md:p-12 animate-in slide-in-from-bottom-4 duration-300 text-gray-100 font-sans">
      <h1 className="text-3xl font-bold text-white mb-8 border-b border-gray-800 pb-4 tracking-tight">
        System Configuration
      </h1>

      <div className="space-y-8">
        {/* Interface Section */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
            <Layout size={20} />
            Interface Settings
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-200 font-medium block">
                  Classic Navigation Bar
                </span>
                <p className="text-sm text-gray-500">
                  Show the traditional top address bar. Disabled by default for
                  immersion.
                </p>
              </div>
              <button
                onClick={() => setShowUrlBar && setShowUrlBar(!showUrlBar)}
                className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900
                        ${showUrlBar ? "bg-indigo-600" : "bg-gray-700"}
                    `}
              >
                <span
                  className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
                        ${showUrlBar ? "translate-x-6" : "translate-x-1"}
                    `}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Startup Section */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400">
            On Startup
          </h2>
          <div className="space-y-4">
            <label className="block">
              <span className="text-gray-200 font-medium">
                Default Landing URL
              </span>
              <p className="text-sm text-gray-500 mb-2">
                The page that opens when you click Home or open a new tab.
              </p>
              <input
                type="text"
                value={homeUrl}
                onChange={(e) => setHomeUrl(e.target.value)}
                className="w-full max-w-lg px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 placeholder-gray-600"
                placeholder="browser://home"
              />
            </label>
          </div>
        </section>

        {/* Updates Section */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400">
            Updates
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-gray-200 font-medium block">
                Software Updates
              </span>
              <p className="text-sm text-gray-500">
                Check if a new version of Mosaic Browser is available.
              </p>
            </div>
            <button
              onClick={() => {
                if (window.electronAPI?.checkForUpdates) {
                  window.electronAPI.checkForUpdates();
                }
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              Check for Updates
            </button>
          </div>
        </section>

        <div className="flex justify-end pt-8">
          <button className="flex items-center gap-2 px-6 py-2 bg-green-600/10 text-green-400 border border-green-600/30 rounded-lg font-mono text-xs tracking-widest hover:bg-green-600/20 transition-colors">
            <Save size={14} />
            CONFIGURATION_SYNCED
          </button>
        </div>
      </div>
    </div>
  );
};
