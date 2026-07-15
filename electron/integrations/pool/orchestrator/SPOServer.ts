// =============================================================================
// SPO HTTP SERVER — Stargate Pool Orchestrator Server
// Wraps StargatePoolOrchestrator in an HTTP server on port 9100.
// Handles HBA heartbeats, box registration, tilling operations, and pool queries.
// =============================================================================

import http from "http";
import url from "url";
import { stargatePoolOrchestrator } from "./StargatePoolOrchestrator.js";
import type { PoolBoxTelemetry, PoolBoxRegistration } from "./StargatePoolOrchestrator.js";

let server: http.Server | null = null;

export function startSPOServer(port: number = 9100): http.Server {
  if (server) {
    console.log("[SPO Server] Already running");
    return server;
  }

  server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Content-Type", "application/json");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url || "", true);
    const pathname = parsedUrl.pathname || "";

    try {
      // ── Health Check ──────────────────────────────────────────────────
      if (pathname === "/api/health" && req.method === "GET") {
        res.writeHead(200);
        res.end(JSON.stringify({ status: "ok", service: "spo", version: "1.0.0", timestamp: Date.now() }));
        return;
      }

      // ── HBA Heartbeat ─────────────────────────────────────────────────
      if (pathname === "/api/heartbeat" && req.method === "POST") {
        const body = await readBody(req);
        const telemetry: PoolBoxTelemetry = JSON.parse(body);
        stargatePoolOrchestrator.handleHeartbeat(telemetry);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, received: Date.now() }));
        return;
      }

      // ── HBA Heartbeat (per-box endpoint used by real HBA agents) ──
      const heartbeatMatch = pathname.match(/^\/api\/v1\/boxes\/(.+)\/heartbeat$/);
      if (heartbeatMatch && req.method === "POST") {
        const boxId = decodeURIComponent(heartbeatMatch[1]);
        const body = await readBody(req);
        const telemetry: PoolBoxTelemetry = JSON.parse(body);
        stargatePoolOrchestrator.handleHeartbeat(telemetry);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, received: Date.now(), boxId }));
        return;
      }

      // ── Box Registration ────────────────────────────────────────────
      if (pathname === "/api/register" && req.method === "POST") {
        const body = await readBody(req);
        const registration: PoolBoxRegistration = JSON.parse(body);
        const result = stargatePoolOrchestrator.registerBox(registration);
        res.writeHead(result.success ? 200 : 400);
        res.end(JSON.stringify(result));
        return;
      }

      // ── Box Unregister ─────────────────────────────────────────────
      if (pathname === "/api/unregister" && req.method === "POST") {
        const body = await readBody(req);
        const { boxId } = JSON.parse(body);
        const success = stargatePoolOrchestrator.unregisterBox(boxId);
        res.writeHead(200);
        res.end(JSON.stringify({ success }));
        return;
      }

      // ── List Boxes ────────────────────────────────────────────────────
      if (pathname === "/api/v1/boxes" && req.method === "GET") {
        const boxes = stargatePoolOrchestrator.listBoxes();
        res.writeHead(200);
        res.end(JSON.stringify({ boxes, count: boxes.length, timestamp: Date.now() }));
        return;
      }

      // ── Get Single Box ──────────────────────────────────────────────
      const boxMatch = pathname.match(/^\/api\/v1\/boxes\/(.+)$/);
      if (boxMatch && req.method === "GET") {
        const boxId = decodeURIComponent(boxMatch[1]);
        const box = stargatePoolOrchestrator.getBox(boxId);
        if (box) {
          res.writeHead(200);
          res.end(JSON.stringify(box));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "Box not found" }));
        }
        return;
      }

      // ── Tilling: Provision ──────────────────────────────────────────
      if (pathname === "/api/v1/tilling/provision" && req.method === "POST") {
        const body = await readBody(req);
        const payload = JSON.parse(body);
        // Forward to TillingProvisioner — for now return success
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, tenantId: payload.tenant_id, status: "provisioning" }));
        return;
      }

      // ── Tilling: Stop ─────────────────────────────────────────────────
      if (pathname === "/api/v1/tilling/stop" && req.method === "POST") {
        const body = await readBody(req);
        const { tenantId } = JSON.parse(body);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, tenantId, status: "stopped" }));
        return;
      }

      // ── Tilling: Sessions ───────────────────────────────────────────
      if (pathname === "/api/v1/tilling/sessions" && req.method === "GET") {
        const userWallet = parsedUrl.query.userWallet as string | undefined;
        const sessions = stargatePoolOrchestrator.getBookings(userWallet);
        // Convert bookings to tilling sessions
        const tillingSessions = sessions.map((b) => ({
          tenantId: b.tenantId,
          status: b.status === "active" ? "active" : "stopped",
          boxId: b.boxId,
          wallet: b.userWallet,
          pricePerHour: b.pricePerHour,
          durationHours: b.durationHours,
          totalCost: b.totalCost,
          createdAt: b.createdAt,
          expiresAt: b.expiresAt,
          locked: false,
          nodeManagerAlive: b.status === "active",
        }));
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, sessions: tillingSessions }));
        return;
      }

      // ── Tilling: Resume ─────────────────────────────────────────────
      if (pathname === "/api/v1/tilling/resume" && req.method === "POST") {
        const body = await readBody(req);
        const { tenantId } = JSON.parse(body);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, tenantId, status: "active" }));
        return;
      }

      // ── Tilling: Lock ───────────────────────────────────────────────
      if (pathname === "/api/v1/tilling/lock" && req.method === "POST") {
        const body = await readBody(req);
        const { tenantId, locked } = JSON.parse(body);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, tenantId, locked }));
        return;
      }

      // ── Tilling: Create (per tenant) ──────────────────────────────────
      const createMatch = pathname.match(/^\/api\/v1\/tilling\/(.+)\/create$/);
      if (createMatch && req.method === "POST") {
        const tenantId = decodeURIComponent(createMatch[1]);
        const body = await readBody(req);
        const payload = JSON.parse(body);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          tenantId,
          status: "created",
          message: payload.message || "Session created",
        }));
        return;
      }

      // ── Tilling: Message (per tenant) ────────────────────────────────
      const messageMatch = pathname.match(/^\/api\/v1\/tilling\/(.+)\/message$/);
      if (messageMatch && req.method === "GET") {
        const tenantId = decodeURIComponent(messageMatch[1]);
        const { number, license, chypc } = parsedUrl.query as Record<string, string>;
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          tenantId,
          number,
          license,
          chypc,
          status: "message_processed",
        }));
        return;
      }

      // ── Tilling: Update (per tenant) ─────────────────────────────────
      const updateMatch = pathname.match(/^\/api\/v1\/tilling\/(.+)\/update$/);
      if (updateMatch && req.method === "POST") {
        const tenantId = decodeURIComponent(updateMatch[1]);
        const body = await readBody(req);
        const payload = JSON.parse(body);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          tenantId,
          status: payload.status || "updated",
        }));
        return;
      }

      // ── Pool Status ───────────────────────────────────────────────────
      if (pathname === "/api/pool" && req.method === "GET") {
        const boxes = stargatePoolOrchestrator.listBoxes();
        const available = stargatePoolOrchestrator.getAvailableBoxes();
        res.writeHead(200);
        res.end(JSON.stringify({
          boxes: boxes.length,
          online: boxes.filter((b) => b.status === "online").length,
          available: available.length,
          totalTenants: boxes.reduce((sum, b) => sum + b.tenantCount, 0),
          timestamp: Date.now(),
        }));
        return;
      }

      // ── 404 ─────────────────────────────────────────────────────────
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found", path: pathname, method: req.method }));

    } catch (error: any) {
      console.error("[SPO Server] Error:", error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message || "Internal server error" }));
    }
  });

  // Guard against EADDRINUSE crashing the whole Electron app —
  // a standalone SPO (systemd spo-server.service) may already own the port.
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[SPO Server] Port ${port} already in use (external SPO running) — embedded server disabled`);
      server = null;
    } else {
      console.error("[SPO Server] Error:", err);
    }
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[SPO Server] 🚀 Running on http://0.0.0.0:${port}`);
    console.log(`[SPO Server] Health: http://localhost:${port}/api/health`);
    console.log(`[SPO Server] Boxes:  http://localhost:${port}/api/v1/boxes`);
    console.log(`[SPO Server] Pool:   http://localhost:${port}/api/pool`);
  });

  return server;
}

export function stopSPOServer(): void {
  if (server) {
    server.close(() => {
      console.log("[SPO Server] Stopped");
    });
    server = null;
  }
}

export function getSPOServer(): http.Server | null {
  return server;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
