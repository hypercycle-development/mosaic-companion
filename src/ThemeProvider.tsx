import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_THEMES,
  Theme,
  ThemeKey,
  THEME_LOCAL_STORAGE_KEY,
  findTheme,
} from "./themes";

interface ThemeContextValue {
  theme: Theme;
  themes: Theme[];
  themeKey: ThemeKey;
  setThemeKey: (key: ThemeKey) => Promise<void>;
  isReady: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const persistTheme = async (key: ThemeKey) => {
  try {
    localStorage.setItem(THEME_LOCAL_STORAGE_KEY, key);
  } catch {
    /* ignore */
  }

  try {
    await window.electronAPI?.themes?.set?.(key);
  } catch {
    /* ignore ipc failures */
  }
};

const loadPersistedTheme = async (): Promise<ThemeKey | undefined> => {
  try {
    const ipcValue = await window.electronAPI?.themes?.get?.();
    if (ipcValue && typeof ipcValue.activeTheme === "string") {
      return ipcValue.activeTheme as ThemeKey;
    }
  } catch {
    /* ignore */
  }

  try {
    const stored = localStorage.getItem(
      THEME_LOCAL_STORAGE_KEY
    ) as ThemeKey | null;
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return undefined;
};

const applyThemeToDocument = (theme: Theme) => {
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([token, value]) => {
    root.style.setProperty(`--${token}`, value);
  });
  root.setAttribute("data-theme", theme.key);
  if (
    theme.key === "light" ||
    theme.key === "blue" ||
    theme.key === "solarized"
  ) {
    root.classList.remove("dark");
  } else {
    root.classList.add("dark");
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themes] = useState<Theme[]>(DEFAULT_THEMES);
  const [themeKey, setThemeKeyState] = useState<ThemeKey>(
    DEFAULT_THEMES[0].key
  );
  const [isReady, setIsReady] = useState(false);

  const theme = useMemo(() => findTheme(themeKey), [themeKey]);

  useEffect(() => {
    (async () => {
      const persisted = await loadPersistedTheme();
      if (persisted) {
        setThemeKeyState(persisted);
      }
      setIsReady(true);
    })();
  }, []);

  useEffect(() => {
    applyThemeToDocument(theme);
    persistTheme(theme.key);
  }, [theme]);

  const setThemeKey = useCallback(async (key: ThemeKey) => {
    setThemeKeyState(key);
    await persistTheme(key);
  }, []);

  const value: ThemeContextValue = useMemo(
    () => ({ theme, themes, themeKey, setThemeKey, isReady }),
    [theme, themes, themeKey, setThemeKey, isReady]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
