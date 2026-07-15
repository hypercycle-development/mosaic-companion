#!/usr/bin/env node
// =============================================================================
// STANDALONE SPO SERVER
// Can run independently of Electron for testing.
// Listens on 0.0.0.0:9100 for HBA heartbeats and tilling operations.
// =============================================================================

const http = require("http");
const url = require("url");

// In-memory state (no persistence for standalone mode)
const boxes = new Map();
const registrations = new Map();
const bookings = new Map();

function log(msg) {
  console.log(`[SPO] ${new Date().toISOString()} ${msg}`);
}

const server = http.createServer(async (req, res) => {
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
    // ── Health Check ──
    if (pathname === "/api/health" && req.method === "GET") {
      res.writeHead(200);
      res.end(JSON.stringify({ status: "ok", service: "spo", version: "1.0.0", timestamp: Date.now() }));
      return;
    }

    // ── HBA Heartbeat (legacy flat endpoint) ──
    if (pathname === "/api/heartbeat" && req.method === "POST") {
      const body = await readBody(req);
      const telemetry = JSON.parse(body);
      boxes.set(telemetry.boxId, { ...telemetry, timestamp: Date.now(), status: "online" });
      log(`Heartbeat from ${telemetry.boxName || telemetry.boxId}`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, received: Date.now() }));
      return;
    }

    // ── HBA Heartbeat (per-box endpoint used by real HBA agents) ──
    const heartbeatMatch = pathname.match(/^\/api\/v1\/boxes\/(.+)\/heartbeat$/);
    if (heartbeatMatch && req.method === "POST") {
      const boxId = decodeURIComponent(heartbeatMatch[1]);
      const body = await readBody(req);
      const telemetry = JSON.parse(body);
      boxes.set(boxId, { ...telemetry, timestamp: Date.now(), status: "online" });
      log(`Heartbeat from ${telemetry.boxName || boxId} (via /api/v1/boxes/${boxId}/heartbeat)`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, received: Date.now(), boxId }));
      return;
    }

    // ── Box Registration ──
    if (pathname === "/api/register" && req.method === "POST") {
      const body = await readBody(req);
      const reg = JSON.parse(body);
      registrations.set(reg.boxId, reg);
      boxes.set(reg.boxId, {
        boxId: reg.boxId,
        boxName: reg.boxName,
        localIp: reg.localIp || reg.hbaApiHost,
        timestamp: Date.now(),
        status: "offline",
        nodeManager: {},
        system: {},
        docker: {},
        tenantCount: 0,
      });
      log(`Box registered: ${reg.boxName} (${reg.boxId})`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // ── Box Unregister ──
    if (pathname === "/api/unregister" && req.method === "POST") {
      const body = await readBody(req);
      const { boxId } = JSON.parse(body);
      registrations.delete(boxId);
      boxes.delete(boxId);
      log(`Box unregistered: ${boxId}`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // ── List Boxes ──
    if (pathname === "/api/v1/boxes" && req.method === "GET") {
      const boxList = Array.from(boxes.values());
      res.writeHead(200);
      res.end(JSON.stringify({ boxes: boxList, count: boxList.length, timestamp: Date.now() }));
      return;
    }

    // ── Get Single Box ──
    const boxMatch = pathname.match(/^\/api\/v1\/boxes\/(.+)$/);
    if (boxMatch && req.method === "GET") {
      const boxId = decodeURIComponent(boxMatch[1]);
      const box = boxes.get(boxId);
      if (box) {
        res.writeHead(200);
        res.end(JSON.stringify(box));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Box not found" }));
      }
      return;
    }

    // ── Tilling: Provision ──
    if (pathname === "/api/v1/tilling/provision" && req.method === "POST") {
      const body = await readBody(req);
      const payload = JSON.parse(body);
      log(`Provision request: tenant=${payload.tenant_id}`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, tenantId: payload.tenant_id, status: "provisioning" }));
      return;
    }

    // ── Tilling: Stop ──
    if (pathname === "/api/v1/tilling/stop" && req.method === "POST") {
      const body = await readBody(req);
      const { tenantId } = JSON.parse(body);
      log(`Stop request: tenant=${tenantId}`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, tenantId, status: "stopped" }));
      return;
    }

    // ── Tilling: Sessions ──
    if (pathname === "/api/v1/tilling/sessions" && req.method === "GET") {
      const userWallet = parsedUrl.query.userWallet;
      const sessions = Array.from(bookings.values())
        .filter((b) => !userWallet || b.userWallet === userWallet)
        .map((b) => ({
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
      res.end(JSON.stringify({ success: true, sessions }));
      return;
    }

    // ── Tilling: Resume ──
    if (pathname === "/api/v1/tilling/resume" && req.method === "POST") {
      const body = await readBody(req);
      const { tenantId } = JSON.parse(body);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, tenantId, status: "active" }));
      return;
    }

    // ── Tilling: Lock ──
    if (pathname === "/api/v1/tilling/lock" && req.method === "POST") {
      const body = await readBody(req);
      const { tenantId, locked } = JSON.parse(body);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, tenantId, locked }));
      return;
    }

    // ── Tilling: Create ──
    const createMatch = pathname.match(/^\/api\/v1\/tilling\/(.+)\/create$/);
    if (createMatch && req.method === "POST") {
      const tenantId = decodeURIComponent(createMatch[1]);
      const body = await readBody(req);
      const payload = JSON.parse(body);
      log(`Create: tenant=${tenantId}`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, tenantId, status: "created", message: payload.message }));
      return;
    }

    // ── Tilling: Message ──
    const messageMatch = pathname.match(/^\/api\/v1\/tilling\/(.+)\/message$/);
    if (messageMatch && req.method === "GET") {
      const tenantId = decodeURIComponent(messageMatch[1]);
      const { number, license, chypc } = parsedUrl.query;
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, tenantId, number, license, chypc, status: "message_processed" }));
      return;
    }

    // ── Tilling: Update ──
    const updateMatch = pathname.match(/^\/api\/v1\/tilling\/(.+)\/update$/);
    if (updateMatch && req.method === "POST") {
      const tenantId = decodeURIComponent(updateMatch[1]);
      const body = await readBody(req);
      const payload = JSON.parse(body);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, tenantId, status: payload.status || "updated" }));
      return;
    }

    // ── Pool Status ──
    if (pathname === "/api/pool" && req.method === "GET") {
      const boxList = Array.from(boxes.values());
      res.writeHead(200);
      res.end(JSON.stringify({
        boxes: boxList.length,
        online: boxList.filter((b) => b.status === "online").length,
        available: boxList.filter((b) => b.status === "online").length,
        totalTenants: boxList.reduce((sum, b) => sum + (b.tenantCount || 0), 0),
        timestamp: Date.now(),
      }));
      return;
    }

    // ── 404 ──
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found", path: pathname, method: req.method }));

  } catch (error) {
    log(`Error: ${error.message}`);
    res.writeHead(500);
    res.end(JSON.stringify({ error: error.message || "Internal server error" }));
  }
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const PORT = process.env.SPO_PORT || 9100;
const HOST = process.env.SPO_HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  log(`🚀 SPO Server running on http://${HOST}:${PORT}`);
  log(`Health: http://${HOST}:${PORT}/api/health`);
  log(`Boxes:  http://${HOST}:${PORT}/api/v1/boxes`);
  log(`Pool:   http://${HOST}:${PORT}/api/pool`);
  log(`Heartbeat: POST http://${HOST}:${PORT}/api/heartbeat`);
  log(`Register:  POST http://${HOST}:${PORT}/api/register`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  log("Shutting down...");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  log("Shutting down...");
  server.close(() => {
    process.exit(0);
  });
});
