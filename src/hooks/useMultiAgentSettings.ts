/**
 * Persistent Multi-Agent Settings Hook
 * Manages user preferences for multi-agent mode
 */

import { useState, useEffect, useCallback } from 'react';
import { OrchestrationMode } from '../services/MultiAgentService';

const STORAGE_KEY = 'mosaic_multi_agent_settings';

export interface MultiAgentSettings {
  enabled: boolean;
  mode: OrchestrationMode;
  autoCollapse: boolean;
  showTimeline: boolean;
  enableSynthesis: boolean;
}

const DEFAULT_SETTINGS: MultiAgentSettings = {
  enabled: false,
  mode: 'sequential',
  autoCollapse: true,
  showTimeline: true,
  enableSynthesis: true,
};

/**
 * Load settings from localStorage
 */
export const loadSettings = (): MultiAgentSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('[MultiAgentSettings] Failed to load:', e);
  }
  return DEFAULT_SETTINGS;
};

/**
 * Save settings to localStorage
 */
export const saveSettings = (settings: MultiAgentSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[MultiAgentSettings] Failed to save:', e);
  }
};

/**
 * Hook for managing multi-agent settings
 */
export const useMultiAgentSettings = () => {
  const [settings, setSettings] = useState<MultiAgentSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load on mount
  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    setIsLoaded(true);
  }, []);

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof MultiAgentSettings>(
    key: K,
    value: MultiAgentSettings[K]
  ) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }, []);

  // Toggle enabled state
  const toggleEnabled = useCallback(() => {
    updateSetting('enabled', !settings.enabled);
  }, [settings.enabled, updateSetting]);

  // Set mode
  const setMode = useCallback((mode: OrchestrationMode) => {
    updateSetting('mode', mode);
  }, [updateSetting]);

  // Reset to defaults
  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    isLoaded,
    updateSetting,
    toggleEnabled,
    setMode,
    reset,
    isEnabled: settings.enabled,
    mode: settings.mode,
  };
};

export default useMultiAgentSettings;