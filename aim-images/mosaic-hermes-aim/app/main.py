import base64
import os
import json

from mosaic_hermes_wrapper import HermesAIMWrapper
from pyhypercycle_aim import JSONResponseCORS, SimpleQueue, aim_uri

PORT = int(os.environ.get("PORT", "4000"))

with open("manifest.json") as f:
    BASE_MANIFEST = json.load(f)


class MosaicHermesAim(SimpleQueue):
    manifest = {}

    def __init__(self):
        base_url = os.environ.get("HERMES_BASE_URL", "http://localhost:3000")
        model = os.environ.get("HERMES_MODEL", BASE_MANIFEST.get("mosaic_aim", {}).get("models", ["kimi-k2.6"])[0])
        self.model = HermesAIMWrapper(base_url, model)
        self.manifest = BASE_MANIFEST.copy()
        # Append endpoints dynamically from decorators (pyhypercycle_aim handles this)

    # ---------------------------------------------------------------
    # GET  /manifest.json  — static manifest
    # ---------------------------------------------------------------
    @aim_uri(
        uri="/manifest.json",
        methods=["GET"],
        endpoint_manifest={
            "input_headers": {},
            "documentation": "Returns AIM manifest metadata"
        },
    )
    async def Manifest(self, request):
        costs = [{"currency": "ProcessingUnits", "min": 0, "max": 0, "estimated_cost": 0}]
        if request.headers.get("cost_only"):
            return JSONResponseCORS({"costs": costs})
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
            "documentation": "Hermes agent chat endpoint. POST JSON body {message, system_prompt?, temperature?, max_tokens?}. Returns {response}."
        },
    )
    async def Chat(self, request):
        body = await request.json()

        message = body.get("message", "")
        system_prompt = body.get("system_prompt", "")
        temperature = body.get("temperature", 0.7)
        max_tokens = body.get("max_tokens", 4096)

        costs = [{"currency": "ProcessingUnits", "min": 0, "max": 0, "estimated_cost": 0}]
        if request.headers.get("cost_only"):
            cost = len(message.split()) * 2  # estimation heuristic
            costs[0]["estimated_cost"] = cost
            return JSONResponseCORS({"costs": costs})

        response, cost = self.model.chat(message, system_prompt)
        costs[0]["estimated_cost"] = max(costs[0]["estimated_cost"], cost)
        costs[0]["used"] = cost
        return JSONResponseCORS(
            {"response": response, "model": self.model.model, "usage": {"prompt_tokens": len(message.split()), "completion_tokens": cost, "total_tokens": len(message.split()) + cost}},
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
            "documentation": "Health check. Returns Hermes agent status."
        },
    )
    async def Health(self, request):
        costs = [{"currency": "ProcessingUnits", "min": 0, "max": 0, "estimated_cost": 0}]
        if request.headers.get("cost_only"):
            return JSONResponseCORS({"costs": costs})

        response, cost = self.model.health()
        costs[0]["estimated_cost"] = max(costs[0]["estimated_cost"], cost)
        costs[0]["used"] = cost
        return JSONResponseCORS({"status": json.loads(response)}, costs=costs)

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
        costs = [{"currency": "ProcessingUnits", "min": 0, "max": 0, "estimated_cost": 0}]
        if request.headers.get("cost_only"):
            return JSONResponseCORS({"costs": costs})

        response, cost = self.model.capabilities()
        costs[0]["estimated_cost"] = max(costs[0]["estimated_cost"], cost)
        costs[0]["used"] = cost
        return JSONResponseCORS({"capabilities": json.loads(response)}, costs=costs)


def main():
    app = MosaicHermesAim()
    app.run(uvicorn_kwargs={"port": PORT, "host": "0.0.0.0"})


if __name__ == "__main__":
    main()
