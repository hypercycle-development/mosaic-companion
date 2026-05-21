# HermesAIMWrapper
# Production shim for aim-py-gen pipeline
# Wraps Hermes HTTP API as python callable returning (content, cost)

import requests
import json
import time

class HermesAIMWrapper:
    """
    Wraps a running Hermes agent (or any OpenAI-compatible endpoint)
    as a HyperCycle AIM module.
    
    Contract:
    - __init__(base_url: str, model: str)
    - chat(message: str, system_prompt: str="") -> (content: str, cost: int)
    - health() -> (json_string: str, cost: int)
    
    Returns (result, cost) tuple where cost = len(result.split())
    for text responses. This is the contract pyhypercycle_aim expects.
    """
    
    def __init__(self, base_url="http://localhost:3000", model="kimi-k2.6"):
        if not base_url:
            raise ValueError("base_url required")
        if not model:
            raise ValueError("model required")
        self.base_url = base_url.rstrip('/')
        self.model = model
        self._session = requests.Session()
        self._health_cache = None
        self._health_cache_time = 0
    
    def _build_messages(self, message: str, system_prompt: str=""):
        msgs = []
        if system_prompt and system_prompt.strip():
            msgs.append({"role": "system", "content": system_prompt})
        msgs.append({"role": "user", "content": message})
        return msgs
    
    def chat(self, message: str, system_prompt: str=""):
        """
        Send message to Hermes and return (content, cost).
        
        Args:
            message: User message text
            system_prompt: Optional system instructions
            
        Returns:
            tuple(str, int): (response_content, word_count_cost)
        """
        payload = {
            "model": self.model,
            "messages": self._build_messages(message, system_prompt),
            "stream": False,
            "max_tokens": 4096,
            "temperature": 0.7
        }
        
        response = self._session.post(
            f"{self.base_url}/v1/chat/completions",
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=120
        )
        response.raise_for_status()
        
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        cost = len(content.split())
        return content, cost
    
    def health(self):
        """
        Check Hermes health and return status JSON.
        
        Returns:
            tuple(str, int): (json_string, 1)
        """
        try:
            resp = self._session.get(
                f"{self.base_url}/health",
                timeout=5
            )
            resp.raise_for_status()
            data = resp.json()
            result = json.dumps({
                "status": data.get("status", "unknown"),
                "provider": data.get("provider", self.model),
                "model": data.get("model", self.model),
                "uptime": data.get("uptime", 0),
                "sessions": data.get("sessions", 0),
                "version": data.get("version", "unknown"),
                "mosaic_aim": True
            })
            return result, 1
        except requests.RequestException as e:
            result = json.dumps({
                "status": "error",
                "error": str(e),
                "mosaic_aim": True
            })
            return result, 1

    def capabilities(self):
        """
        Return AIM capabilities metadata.
        Used by node manager for catalog display.
        
        Returns:
            tuple(str, int): (json_string, 1)
        """
        caps = json.dumps({
            "capabilities": ["chat", "completion", "tool_use", "analysis"],
            "models": [self.model],
            "max_tokens": 4096,
            "supports_streaming": False,
            "supports_tools": True,
            "supports_system_prompt": True,
            "mosaic_aim_version": "1.0.0",
            "mosaic_aim_type": "hermes_bridge"
        })
        return caps, 1
