export type ScreenpipeSettings = {
  enabled: boolean;
  url: string;
  command?: string;
  args?: string[];
  healthPath?: string;
};

interface ScreenpipeSearchResult {
  data?: Array<{
    content?: {
      app_name?: string;
      text?: string;
      window_name?: string;
      timestamp?: string;
    };
    type?: string;
  }>;
}

interface ScreenpipeContext {
  summary: string;
  enabled: boolean;
  error?: string;
}

function joinUrl(base: string, suffix: string) {
  if (!base) return suffix;
  if (!suffix) return base;
  if (base.endsWith("/") && suffix.startsWith("/")) return base + suffix.slice(1);
  if (!base.endsWith("/") && !suffix.startsWith("/")) return base + "/" + suffix;
  return base + suffix;
}

class ScreenpipeClient {
  private baseUrl: string = "";
  private ready: Promise<void> | null = null;

  private async ensureConfigLoaded() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      try {
        const cfg: ScreenpipeSettings = await (window as any).electronAPI.screenpipe.getSettings();
        this.baseUrl = cfg?.url || "";
      } catch {
        this.baseUrl = "";
      }
    })();
    return this.ready;
  }

  async health(pathOverride?: string): Promise<boolean> {
    await this.ensureConfigLoaded();
    if (!this.baseUrl) return false;
    const url = joinUrl(this.baseUrl, pathOverride || "/health");
    try {
      const res = await fetch(url, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async get<T = any>(path: string): Promise<T> {
    await this.ensureConfigLoaded();
    const url = joinUrl(this.baseUrl, path);
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`GET ${url} ${res.status}`);
    return res.json() as Promise<T>;
  }

  async post<T = any>(path: string, body?: any): Promise<T> {
    await this.ensureConfigLoaded();
    const url = joinUrl(this.baseUrl, path);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`POST ${url} ${res.status}`);
    return res.json() as Promise<T>;
  }

  /**
   * Get recent context from Screenpipe for AI chat
   * Returns a summarized context string safe to include in prompts
   */
  async getRecentContext(): Promise<ScreenpipeContext> {
    try {
      // Check if screenpipe is enabled
      const settings: ScreenpipeSettings = await (window as any).electronAPI.screenpipe.getSettings();
      
      if (!settings?.enabled || !settings?.url) {
        return {
          summary: "",
          enabled: false,
        };
      }

      await this.ensureConfigLoaded();
      
      if (!this.baseUrl) {
        return {
          summary: "",
          enabled: false,
          error: "No Screenpipe URL configured",
        };
      }

      // Query recent OCR data
      const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/search`);
      url.searchParams.append("content_type", "ocr");
      url.searchParams.append("limit", "3");
      url.searchParams.append("offset", "0");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          summary: "",
          enabled: true,
          error: `Screenpipe API error: ${response.status}`,
        };
      }

      const result: ScreenpipeSearchResult = await response.json();
      const data = result.data || [];

      if (data.length === 0) {
        return {
          summary: "",
          enabled: true,
        };
      }

      // Create a summarized context (max 300 chars to avoid token bloat)
      const latest = data[0];
      const appName = latest.content?.app_name || "unknown app";
      const text = latest.content?.text || "";
      const truncatedText = text.slice(0, 200);

      const summary = `[Screenpipe Context] User is currently working in "${appName}". Recent screen content: "${truncatedText}${text.length > 200 ? "..." : ""}"`;

      return {
        summary,
        enabled: true,
      };
    } catch (error) {
      console.error("Failed to get Screenpipe context:", error);
      return {
        summary: "",
        enabled: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const Screenpipe = new ScreenpipeClient();
