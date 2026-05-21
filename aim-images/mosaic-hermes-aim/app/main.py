import os
import json
import time

from mosaic_hermes_wrapper import HermesAIMWrapper
from pyhypercycle_aim import JSONResponseCORS, SimpleServer, aim_uri

PORT = int(os.environ.get("PORT", "4000"))
KANBAN_URL = os.environ.get("KANBAN_URL", "http://127.0.0.1:9119")
NODE_ID = os.environ.get("NODE_ID", "80ad4ea14c33cd2a")
LICENSE = os.environ.get("LICENSE", "2324779898006116")

with open("manifest.json") as f:
    BASE_MANIFEST = json.load(f)


def _costs(min_cost=0, max_cost=0, est_cost=0, currency="ProcessingUnits"):
    return [{"currency": currency, "min": min_cost, "max": max_cost, "estimated_cost": est_cost}]


def _cost_response(request, min_cost=0, max_cost=0, est_cost=0, currency="ProcessingUnits"):
    if request.headers.get("cost_only"):
        c = [{"currency": currency, "min": min_cost, "max": max_cost, "estimated_cost": est_cost}]
        return JSONResponseCORS({"costs": c})
    if request.headers.get("costs"):
        c = [{"currency": currency, "min": min_cost, "max": max_cost, "estimated_cost": est_cost}]
        return JSONResponseCORS({"costs": c})
    return None


def _make_dashboard(base_url, model, port, version, kanban_url, uptime_str):
    return '''<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mosaic Hermes AIM - HyperCycle Node</title>
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0f;color:#e0e0e0;max-width:960px;margin:0 auto;padding:24px;line-height:1.6}
h1{color:#00d4aa;border-bottom:2px solid #00d4aa;padding-bottom:10px}
h2{color:#00d4aa}
.status{padding:15px;border-radius:8px;margin:15px 0}
.ok{background:#0a2a1a;border:1px solid #00d4aa}
.warn{background:#2a2510;border:1px solid #ffd700}
.err{background:#2a0a0a;border:1px solid #ff4444}
.card{background:#12121a;border:1px solid #1f1f2e;border-radius:10px;padding:20px;margin:15px 0}
.btn{display:inline-block;padding:10px 20px;background:#00d4aa;color:#0a0a0f;text-decoration:none;border-radius:6px;font-weight:bold;margin:5px 5px 5px 0}
.btn:hover{background:#00ffd4}.btn2{background:#1f1f2e;color:#00d4aa;border:1px solid #00d4aa}
pre{background:#050510;padding:12px;border-radius:6px;overflow:auto;color:#a0ffa0;font-size:0.9em}
code{background:#1a1a2a;padding:2px 6px;border-radius:3px}
input,select{width:100%;padding:10px;margin:8px 0;background:#0a0a0f;color:#e0e0e0;border:1px solid #333;border-radius:4px}
.footer{margin-top:40px;font-size:0.85em;color:#666;border-top:1px solid #1f1f2e;padding-top:15px}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:15px 0}
.metric{background:#0a0a0f;padding:12px;border-radius:6px;text-align:center;border:1px solid #1f1f2e}
.metric-value{font-size:1.5em;font-weight:bold;color:#00d4aa}
.metric-label{font-size:0.75em;color:#888;text-transform:uppercase}
</style></head><body>
<h1>Mosaic Hermes AIM</h1>
<div class="status ok">
<strong>Node:</strong> ''' + NODE_ID + ''' | <strong>Port:</strong> ''' + str(port) + ''' | <strong>Slot:</strong> 0 | <strong>Uptime:</strong> ''' + uptime_str + '''
</div>
<div class="metrics">
<div class="metric"><div class="metric-value">''' + model + '''</div><div class="metric-label">Model</div></div>
<div class="metric"><div class="metric-value">''' + version + '''</div><div class="metric-label">Version</div></div>
<div class="metric"><div class="metric-value" style="color:#00d4aa">&#9679;</div><div class="metric-label">Active</div></div>
</div>
<div class="card">
<h2>Connect to Hermes</h2>
<p>Hermes Agent runs its own dashboard. Open it to create tasks, manage models, and configure deployments.</p>
<a class="btn" href="''' + kanban_url + '''" target="_blank">Open Hermes Kanban</a>
<a class="btn btn2" href="http://localhost:8006" target="_blank">Node Manager</a>
</div>
<div class="card">
<h2>API Endpoints</h2>
<table style="width:100%;border-collapse:collapse">
<tr style="border-bottom:1px solid #333"><td style="padding:8px"><code>GET /</code></td><td style="padding:8px">This dashboard</td></tr>
<tr style="border-bottom:1px solid #333"><td style="padding:8px"><code>POST /chat</code></td><td style="padding:8px">Chat with AI agent</td></tr>
<tr style="border-bottom:1px solid #333"><td style="padding:8px"><code>GET /health</code></td><td style="padding:8px">Backend health status</td></tr>
<tr style="border-bottom:1px solid #333"><td style="padding:8px"><code>GET /manifest.json</code></td><td style="padding:8px">AIM metadata</td></tr>
<tr style="border-bottom:1px solid #333"><td style="padding:8px"><code>GET /capabilities</code></td><td style="padding:8px">Features</td></tr>
<tr style="border-bottom:1px solid #333"><td style="padding:8px"><code>GET /costs</code></td><td style="padding:8px">Cost estimation</td></tr>
</table></div>
<div class="card">' 
<h2>Quick Test</h2>
<pre>curl -X POST http://127.0.0.1:''' + str(port) + '''/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message":"Hello from ANFE"}'</pre>
</div>
<div class="card">
<h2>Backend Configuration</h2>
<pre>Base URL: ''' + base_url + '''
Model: ''' + model + '''
Node ID: ''' + NODE_ID + '''
License: ''' + LICENSE + '''</pre>
<p style="font-size:0.85em;color:#888">To change settings, redeploy with new HERMES_BASE_URL or HERMES_MODEL environment variables.</p>
</div>
<div class="card">
<h2>Node Manager Setup</h2>
<p>For the node to auto-register this AIM, Dr. Robert must update slot 0 in the encrypted config from <code>real-hermes-aim:v2.0.0</code> to:</p>
<pre>localhost:5000/mosaic-hermes-aim:1.0.3</pre>
</div>
<div class="footer">
Mosaic Hermes AIM v''' + version + ''' | HyperCycle ANFE Node ''' + NODE_ID + ''' |
<a href="https://github.com/YOUR_GITHUB_USERNAME/mosaic-companion" style="color:#00d4aa">GitHub</a>
</div></body></html>'''


class MosaicHermesAim(SimpleServer):
    manifest = {}

    def __init__(self):
        base_url = os.environ.get("HERMES_BASE_URL", "http://localhost:3000")
        model = os.environ.get("HERMES_MODEL", BASE_MANIFEST.get("mosaic_aim", {}).get("models", ["kimi-k2.5:cloud"])[0])
        self.model_wrapper = HermesAIMWrapper(base_url, model)
        self.manifest = BASE_MANIFEST.copy()
        self._base_url = base_url
        self._model = model
        self._start_time = time.time()

    # ---------------------------------------------------------------
    # GET  /  — HTML Dashboard
    # ---------------------------------------------------------------
    @aim_uri(
        uri="/",
        methods=["GET"],
        endpoint_manifest={
            "input_headers": {},
            "documentation": "HTML dashboard. Returns cost data when cost_only or costs header is set."
        },
    )
    async def Root(self, request):
        cost_only = _cost_response(request, 0, 0, 0)
        if cost_only:
            return cost_only

        uptime = int(time.time() - self._start_time)
        uptime_str = f"{uptime//3600}h {(uptime%3600)//60}m"
        version = self.manifest.get("version", "1.0.2")
        html = _make_dashboard(self._base_url, self._model, PORT, version, KANBAN_URL, uptime_str)

        from starlette.responses import HTMLResponse
        return HTMLResponse(content=html, status_code=200, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST",
            "Access-Control-Allow-Headers": "*"
        })

    # ---------------------------------------------------------------
    # GET  /costs  — Global cost endpoint for Node Manager
    # ---------------------------------------------------------------
    @aim_uri(
        uri="/costs",
        methods=["GET"],
        endpoint_manifest={
            "input_headers": {},
            "documentation": "Returns global cost structure. Used by Node Manager for economic routing."
        },
    )
    async def Costs(self, request):
        costs = _costs(0, 0, 0)
        return JSONResponseCORS({
            "costs": costs,
            "aim_version": self.manifest.get("version", "1.0.2"),
            "aim_name": self.manifest.get("name", "MosaicHermesAIM")
        }, costs=costs)

    # ---------------------------------------------------------------
    # GET  /manifest.json
    # ---------------------------------------------------------------
    @aim_uri(
        uri="/manifest.json",
        methods=["GET"],
        endpoint_manifest={
            "input_headers": {},
            "documentation": "Returns AIM manifest metadata."
        },
    )
    async def Manifest(self, request):
        cost_only = _cost_response(request, 0, 0, 0)
        if cost_only:
            return cost_only
        costs = _costs(0, 0, 0)
        costs[0]["used"] = 1
        return JSONResponseCORS(self.manifest, costs=costs)

    # ---------------------------------------------------------------
    # POST /chat
    # ---------------------------------------------------------------
    @aim_uri(
        uri="/chat",
        methods=["POST"],
        endpoint_manifest={
            "input_headers": {},
            "documentation": "Chat with Hermes AI agent. POST JSON {message, system_prompt?, temperature?, max_tokens?}."
        },
    )
    async def Chat(self, request):
        cost_only = _cost_response(request, 0, 50, 25)
        if cost_only:
            return cost_only

        body = await request.json()
        message = body.get("message", "")
        system_prompt = body.get("system_prompt", "")

        response, cost = self.model_wrapper.chat(message, system_prompt)
        costs = _costs(0, max(cost * 2, 1), cost)
        costs[0]["used"] = cost
        return JSONResponseCORS(
            {
                "response": response,
                "model": self._model,
                "usage": {
                    "prompt_tokens": len(message.split()),
                    "completion_tokens": cost,
                    "total_tokens": len(message.split()) + cost
                }
            },
            costs=costs
        )

    # ---------------------------------------------------------------
    # GET /health
    # ---------------------------------------------------------------
    @aim_uri(
        uri="/health",
        methods=["GET"],
        endpoint_manifest={
            "input_headers": {},
            "documentation": "Health check. Returns AIM and backend status."
        },
    )
    async def Health(self, request):
        cost_only = _cost_response(request, 0, 1, 1)
        if cost_only:
            return cost_only

        if request.query_params.get("minimal") == "1":
            costs = _costs(0, 0, 0)
            costs[0]["used"] = 0
            return JSONResponseCORS({"status": "ok", "minimal": True}, costs=costs)

        result, cost = self.model_wrapper.health()
        costs = _costs(0, max(cost, 1), cost)
        costs[0]["used"] = cost
        return JSONResponseCORS({"status": json.loads(result)}, costs=costs)

    # ---------------------------------------------------------------
    # GET /capabilities
    # ---------------------------------------------------------------
    @aim_uri(
        uri="/capabilities",
        methods=["GET"],
        endpoint_manifest={
            "input_headers": {},
            "documentation": "Returns AIM capabilities metadata."
        },
    )
    async def Capabilities(self, request):
        cost_only = _cost_response(request, 0, 0, 0)
        if cost_only:
            return cost_only

        result, cost = self.model_wrapper.capabilities()
        costs = _costs(0, max(cost, 1), cost)
        costs[0]["used"] = cost
        return JSONResponseCORS({"capabilities": json.loads(result)}, costs=costs)


def main():
    app = MosaicHermesAim()
    app.run(uvicorn_kwargs={"port": PORT, "host": "0.0.0.0"})


if __name__ == "__main__":
    main()
