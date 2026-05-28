import { useState, useCallback } from 'react';
import { RunningAimDetail } from '../types';

interface ConnectContext {
  licenseKey: string;
  runningAims?: RunningAimDetail[];
  nodeName?: string;
}

interface UseNodeConnectReturn {
  connect:      (endpointUrl: string, context: ConnectContext) => Promise<void>;
  disconnect:   (endpointUrl: string) => Promise<void>;
  isConnecting: boolean;
  isConnected:  (endpointUrl: string) => boolean;
  error:        string | null;
}

/**
 * Encapsulates connect/disconnect actions for AIM node endpoints.
 * Delegates to window.electronAPI.nodes.add / remove (aim-nodes plugin).
 * Shared between NodeDetailPanel and AimProfilePage zone components.
 */
export function useNodeConnect(): UseNodeConnectReturn {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Maps endpoint URL → nodeId (for disconnect lookups)
  const [connectedUrls, setConnectedUrls] = useState<Map<string, string>>(new Map());

  const isConnected = useCallback(
    (endpointUrl: string) => connectedUrls.has(endpointUrl),
    [connectedUrls]
  );

  const connect = useCallback(async (endpointUrl: string, context: ConnectContext) => {
    setIsConnecting(true);
    setError(null);

    let host = endpointUrl;
    let port = '8000';

    try {
      if (host.includes('://')) {
        const url = new URL(host);
        host = url.hostname;
        port = url.port || (url.protocol === 'https:' ? '443' : '80');
      } else {
        const parts = host.split(':');
        if (parts.length > 1) {
          host = parts[0];
          port = parts[1];
        }
      }

      const result = await window.electronAPI.nodes.add({
        name: context.nodeName ?? `Node ${context.licenseKey.substring(0, 6)}...`,
        apiHost: host,
        apiPort: port,
        isActive: true,
        licenseKey: context.licenseKey,
      });

      if (!result.success) {
        setError('Failed to connect: ' + (result.error || 'Unknown error'));
        return;
      }

      // Fetch live /info from the node
      let nodeInfo = null;
      try {
        const infoUrl = `http://${host}:${port}/info`;
        const response = await fetch(infoUrl);
        if (response.ok) {
          nodeInfo = await response.json();
        }
      } catch (err) {
        console.warn('[useNodeConnect] Failed to fetch node info directly:', err);
      }

      // Fetch manifests and save aim data
      if (context.runningAims && context.runningAims.length > 0) {
        try {
          const aimsWithManifests = await Promise.all(
            context.runningAims.map(async (aim) => {
              try {
                const manifest = await window.electronAPI.hyperinsight.getAimManifest(
                  context.licenseKey,
                  aim.name
                );
                return { ...aim, manifest };
              } catch {
                return { ...aim, manifest: null };
              }
            })
          );

          await window.electronAPI.aimNodes.saveNodeData(context.licenseKey, {
            aims: aimsWithManifests,
            info: nodeInfo,
          });
        } catch (aimError) {
          console.error('[useNodeConnect] Failed to save node data:', aimError);
        }
      }

      // Record connected URL → nodeId mapping
      const nodes = await window.electronAPI.nodes.get();
      const match = nodes.find((n: { licenseKey?: string; id: string }) => n.licenseKey === context.licenseKey);
      if (match) {
        setConnectedUrls((prev) => new Map(prev).set(endpointUrl, match.id));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError('Failed to connect: ' + msg);
      console.error('[useNodeConnect] connect error:', e);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async (endpointUrl: string) => {
    const nodeId = connectedUrls.get(endpointUrl);
    if (!nodeId) return;

    setIsConnecting(true);
    setError(null);

    try {
      const result = await window.electronAPI.nodes.delete(nodeId);
      if (result.success) {
        setConnectedUrls((prev) => {
          const next = new Map(prev);
          next.delete(endpointUrl);
          return next;
        });
      } else {
        setError('Failed to disconnect: ' + result.error);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError('Error disconnecting: ' + msg);
      console.error('[useNodeConnect] disconnect error:', e);
    } finally {
      setIsConnecting(false);
    }
  }, [connectedUrls]);

  return { connect, disconnect, isConnecting, isConnected, error };
}
