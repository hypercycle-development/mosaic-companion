/**
 * Recipe: Resource Watcher
 *
 * Watches MCP resources for changes and triggers callbacks.
 * Useful for building dashboards, live data feeds, or reactive UIs
 * that update when upstream data changes.
 *
 * Usage:
 *   import { ResourceWatcher } from './recipes/resourceWatcher';
 *
 *   const watcher = new ResourceWatcher(mcp);
 *
 *   watcher.watch('my-server', 'file:///config.json', (contents) => {
 *     console.log('Config changed:', contents);
 *   });
 *
 *   // Polling fallback for servers without subscription support
 *   watcher.poll('my-server', 'db://users/count', 5000, (contents) => {
 *     updateUserCount(contents);
 *   });
 *
 *   // Cleanup
 *   watcher.stopAll();
 */

import type { MCPClient, MCPContent, MCPResource } from "../MCPClient";

// =============================================================================
// Types
// =============================================================================

type ResourceCallback = (contents: MCPContent[]) => void;

interface WatchEntry {
  server: string;
  uri: string;
  callback: ResourceCallback;
  lastContent?: string; // Stringified for change detection
}

interface PollEntry extends WatchEntry {
  intervalId: NodeJS.Timeout;
  intervalMs: number;
}

// =============================================================================
// Resource Watcher
// =============================================================================

export class ResourceWatcher {
  private mcp: MCPClient;
  private watches: Map<string, WatchEntry> = new Map();
  private polls: Map<string, PollEntry> = new Map();
  private listenerCleanups: Array<() => void> = [];

  constructor(mcp: MCPClient) {
    this.mcp = mcp;

    // Listen for resource change notifications from MCP servers
    const handler = ({ server }: { server: string }) => {
      this.onResourcesChanged(server);
    };

    this.mcp.on("resources-changed", handler);
    this.listenerCleanups.push(() =>
      this.mcp.off("resources-changed", handler),
    );
  }

  // ===========================================================================
  // Event-driven watching (uses MCP notifications)
  // ===========================================================================

  /**
   * Watch a resource for changes. When the server emits a
   * `notifications/resources/list_changed` notification, the resource
   * is re-read and the callback fires if the content changed.
   */
  watch(
    serverName: string,
    uri: string,
    callback: ResourceCallback,
  ): string {
    const key = `${serverName}:${uri}`;

    this.watches.set(key, {
      server: serverName,
      uri,
      callback,
    });

    // Do an initial read
    this.readAndNotify(key).catch((err) => {
      console.error(`[ResourceWatcher] Initial read failed for ${key}:`, err);
    });

    return key;
  }

  /**
   * Stop watching a specific resource
   */
  unwatch(key: string): void {
    this.watches.delete(key);
  }

  // ===========================================================================
  // Polling fallback (for servers without subscription support)
  // ===========================================================================

  /**
   * Poll a resource at a fixed interval. Fires callback only when
   * the content changes.
   */
  poll(
    serverName: string,
    uri: string,
    intervalMs: number,
    callback: ResourceCallback,
  ): string {
    const key = `poll:${serverName}:${uri}`;

    const entry: PollEntry = {
      server: serverName,
      uri,
      callback,
      intervalMs,
      intervalId: setInterval(() => {
        this.readAndNotify(key).catch((err) => {
          console.error(`[ResourceWatcher] Poll read failed for ${key}:`, err);
        });
      }, intervalMs),
    };

    this.polls.set(key, entry);

    // Initial read
    this.readAndNotify(key).catch((err) => {
      console.error(
        `[ResourceWatcher] Initial poll read failed for ${key}:`,
        err,
      );
    });

    return key;
  }

  /**
   * Stop polling a specific resource
   */
  stopPoll(key: string): void {
    const entry = this.polls.get(key);
    if (entry) {
      clearInterval(entry.intervalId);
      this.polls.delete(key);
    }
  }

  // ===========================================================================
  // List all resources across servers
  // ===========================================================================

  /**
   * Get all resources from all connected servers
   */
  async listAll(): Promise<Array<MCPResource & { _serverName: string }>> {
    const results: Array<MCPResource & { _serverName: string }> = [];

    for (const server of this.mcp.getConnectedServers()) {
      const resources = await this.mcp.listResources(server);
      for (const resource of resources) {
        results.push({ ...resource, _serverName: server });
      }
    }

    return results;
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Stop all watches, polls, and event listeners
   */
  stopAll(): void {
    this.watches.clear();

    for (const [, entry] of this.polls) {
      clearInterval(entry.intervalId);
    }
    this.polls.clear();

    for (const cleanup of this.listenerCleanups) {
      cleanup();
    }
    this.listenerCleanups = [];
  }

  // ===========================================================================
  // Internal
  // ===========================================================================

  private async onResourcesChanged(serverName: string): Promise<void> {
    // Re-read all watched resources from this server
    for (const [key, entry] of this.watches) {
      if (entry.server === serverName) {
        await this.readAndNotify(key).catch((err) => {
          console.error(
            `[ResourceWatcher] Change read failed for ${key}:`,
            err,
          );
        });
      }
    }
  }

  private async readAndNotify(key: string): Promise<void> {
    const entry = this.watches.get(key) || this.polls.get(key);
    if (!entry) return;

    const result = await this.mcp.readResource(entry.server, entry.uri);
    const contentString = JSON.stringify(result.contents);

    // Only fire callback if content actually changed
    if (contentString !== entry.lastContent) {
      entry.lastContent = contentString;
      entry.callback(result.contents);
    }
  }
}
