import { useState, useCallback, useEffect } from "react";

interface ScreenpipeContextData {
  app?: string;
  text?: string;
  timestamp?: string;
}

interface ScreenpipeSearchResult {
  data?: Array<{
    content?: {
      app_name?: string;
      text?: string;
      window_name?: string;
      timestamp?: string;
    };
  }>;
}

export function useScreenpipe() {
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await (window as any).electronAPI?.screenpipe?.getSettings();
        setEnabled(!!settings?.enabled);
        setUrl(settings?.url || "http://localhost:3030");
      } catch {
        setEnabled(false);
        setUrl("http://localhost:3030");
      }
    };
    loadSettings();
  }, []);

  /**
   * Get recent context from Screenpipe
   * @param limit Number of recent items to fetch (default: 3)
   * @returns Array of context data or null if disabled/error
   */
  const getContext = useCallback(
    async (limit: number = 3): Promise<ScreenpipeContextData[] | null> => {
      // Early return if not enabled
      if (!enabled || !url) {
        return null;
      }

      try {
        const baseUrl = url.replace(/\/$/, "");
        const searchUrl = new URL(`${baseUrl}/search`);
        searchUrl.searchParams.append("content_type", "ocr");
        searchUrl.searchParams.append("limit", limit.toString());
        searchUrl.searchParams.append("offset", "0");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(searchUrl.toString(), {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`Screenpipe API error: ${response.status}`);
          return null;
        }

        const result: ScreenpipeSearchResult = await response.json();
        const data = result.data || [];

        if (data.length === 0) {
          return null;
        }

        // Transform to clean format
        return data.map((item) => ({
          app: item.content?.app_name || "unknown",
          text: item.content?.text || "",
          timestamp: item.content?.timestamp || new Date().toISOString(),
        }));
      } catch (error) {
        console.error("Failed to fetch Screenpipe context:", error);
        return null;
      }
    },
    [enabled, url]
  );

  /**
   * Get a summarized context string ready for AI prompts
   * @param limit Number of recent items to fetch (default: 3)
   * @param maxLength Maximum length of text per item (default: 200)
   * @returns Formatted context string or empty string if disabled/error
   */
  const getContextSummary = useCallback(
    async (limit: number = 3, maxLength: number = 200): Promise<string> => {
      const data = await getContext(limit);

      if (!data || data.length === 0) {
        return "";
      }

      const latest = data[0];
      const truncatedText = latest.text.slice(0, maxLength);
      
      return `[Screenpipe Context] User is currently working in "${latest.app}". Recent screen content: "${truncatedText}${latest.text.length > maxLength ? "..." : ""}"`;
    },
    [getContext]
  );

  return {
    enabled,
    getContext,
    getContextSummary,
  };
}
