// Standalone SPO Server Test
import { startSPOServer, stopSPOServer } from "./electron/integrations/pool/orchestrator/SPOServer.js";

const server = startSPOServer(9100);

// Keep running for 30 seconds then stop
setTimeout(() => {
  console.log("[Test] Stopping SPO server...");
  stopSPOServer();
  process.exit(0);
}, 30000);

console.log("[Test] SPO server test running. Will stop in 30s...");
