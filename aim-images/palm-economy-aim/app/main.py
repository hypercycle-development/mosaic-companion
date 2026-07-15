from pyhypercycle_aim import JSONResponseCORS, SimpleQueue, aim_uri
import json, os

class PalmEconomyAIM(SimpleQueue):
    def __init__(self):
        super().__init__()
        self.version = "1.0.0"

    @aim_uri("/health", "GET", is_public=True)
    async def health(self, request):
        return JSONResponseCORS({
            "status": "ok",
            "service": "palm-economy-lead-generator",
            "version": self.version,
            "capabilities": ["discover", "enrich", "create", "dispatch", "track"]
        })

    @aim_uri("/discover", "POST", is_public=True)
    async def discover(self, request):
        data = await request.json()
        return JSONResponseCORS({
            "phase": "discover",
            "method": data.get("method", "maps"),
            "query": data.get("query"),
            "status": "queued",
            "agent": "palm-scout"
        })

    @aim_uri("/enrich", "POST", is_public=True)
    async def enrich(self, request):
        data = await request.json()
        return JSONResponseCORS({
            "phase": "enrich",
            "prospects": data.get("prospects", []),
            "status": "queued",
            "agent": "palm-enricher"
        })

    @aim_uri("/create", "POST", is_public=True)
    async def create(self, request):
        data = await request.json()
        return JSONResponseCORS({
            "phase": "create",
            "campaign_type": data.get("campaign_type", "email"),
            "status": "queued",
            "agent": "palm-creator"
        })

    @aim_uri("/dispatch", "POST", is_public=True)
    async def dispatch(self, request):
        data = await request.json()
        return JSONResponseCORS({
            "phase": "dispatch",
            "channel": data.get("channel", "email"),
            "recipients": data.get("recipients", 0),
            "status": "queued",
            "agent": "palm-dispatcher"
        })

    @aim_uri("/track", "POST", is_public=True)
    async def track(self, request):
        data = await request.json()
        return JSONResponseCORS({
            "phase": "track",
            "campaign_id": data.get("campaign_id"),
            "status": "queued",
            "agent": "palm-tracker"
        })

    @aim_uri("/pipeline", "POST", is_public=True)
    async def pipeline(self, request):
        """Run full pipeline: discover → enrich → create → dispatch → track"""
        data = await request.json()
        return JSONResponseCORS({
            "pipeline": "palm-economy-lead-generator",
            "input": data,
            "stages": ["discover", "enrich", "create", "dispatch", "track"],
            "status": "started",
            "version": self.version
        })

    @aim_uri("/capabilities", "GET", is_public=True)
    async def capabilities(self, request):
        return JSONResponseCORS({
            "capabilities": ["lead-generation", "prospect-discovery", "campaign-creation", "email-dispatch", "crm-tracking"],
            "models": ["palm-economy-v1"],
            "max_tokens": 64000,
            "supports_tools": True,
            "supports_streaming": False,
            "mosaic_aim_version": "1.0.0"
        })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "4000")))
