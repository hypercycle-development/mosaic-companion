#!/usr/bin/env python3
"""
OAuth bridge script for Electron/Mosaic-Companion.

Delegates to Hermes' mcp_oauth.py (which delegates to MCP SDK's
OAuthClientProvider) to run the full OAuth 2.1 PKCE flow.

Patches _is_interactive() so the flow works inside Electron's non-TTY
main process. Opens the real browser for user consent.

Usage:
    python3 oauth_bridge.py <server_name> <server_url>

Output (JSON):
    {"ok":true,"token":{"access_token":"...","token_type":"Bearer"}}
    or
    {"ok":false,"error":"..."}
"""
import asyncio
import json
import os
import sys
import traceback

# ---------------------------------------------------------------------------
# Bootstrap Hermes venv + tools into PYTHONPATH
# ---------------------------------------------------------------------------
HERMES_ROOT = os.path.expanduser("~/.hermes/hermes-agent")
VENV_PACKAGES = f"{HERMES_ROOT}/venv/lib/python{sys.version_info.major}.{sys.version_info.minor}/site-packages"
TOOLS_DIR = f"{HERMES_ROOT}/tools"

for p in (VENV_PACKAGES, TOOLS_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

import httpx
from tools.mcp_oauth import (
    HermesTokenStorage,
    build_oauth_auth,
    _is_interactive,
    _can_open_browser,
    _OAUTH_AVAILABLE,
    OAuthNonInteractiveError,
)


def patch_interactivity():
    """Force interactivity so browser-open + callback server work."""
    import tools.mcp_oauth as oauth_mod
    oauth_mod._is_interactive = lambda: True
    oauth_mod._can_open_browser = lambda: True


async def run_oauth_flow(server_name: str, server_url: str) -> dict:
    """Run the OAuth flow and return the token dict.

    Steps:
      1. Patch interactivity
      2. Build OAuthClientProvider (Hermes wrapper around MCP SDK)
      3. Make an authenticated GET request → triggers the full PKCE flow
         (discovery → registration → browser → callback → token)
      4. Read the persisted token from disk
    """
    if not _OAUTH_AVAILABLE:
        return {"ok": False, "error": "MCP SDK OAuth not available. Install 'mcp>=1.26.0'."}

    storage = HermesTokenStorage(server_name)

    # Fast path: token already exists
    existing = await storage.get_tokens()
    if existing and existing.access_token:
        return {
            "ok": True,
            "token": {
                "access_token": existing.access_token,
                "token_type": existing.token_type,
                "refresh_token": getattr(existing, "refresh_token", None),
            },
            "cached": True,
        }

    # No token — run the full flow
    patch_interactivity()

    # Build the auth handler. This configures discovery, client registration,
    # PKCE parameters, and stores everything in HermesTokenStorage.
    auth = build_oauth_auth(server_name, server_url, {})
    if auth is None:
        return {"ok": False, "error": "build_oauth_auth returned None. SDK OAuth unavailable?"}

    # Trigger the OAuth flow by making an authenticated request.
    # The auth object is an httpx.Auth subclass; httpx runs the full
    # async_auth_flow generator on the first request, which does:
    #   → metadata discovery  → client registration  → PKCE
    #   → open browser        → localhost callback   → code exchange
    #   → token storage       → Bearer header injection
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            # A simple GET to the server's root is enough to trigger auth.
            # The server will likely return 401 first, which triggers the flow.
            resp = await client.get(f"{server_url}/mcp", auth=auth, follow_redirects=True)
            # We don't care about the response body — the auth flow has run.
        except Exception as exc:
            # Even exceptions are OK — the auth flow may have completed before
            # the main request errored out. Check disk for the token.
            pass

    # After the auth flow ran, tokens should be on disk
    tokens = await storage.get_tokens()
    if not tokens or not tokens.access_token:
        return {"ok": False, "error": "OAuth flow completed but no token was persisted to disk."}

    return {
        "ok": True,
        "token": {
            "access_token": tokens.access_token,
            "token_type": tokens.token_type,
            "refresh_token": getattr(tokens, "refresh_token", None),
        },
        "cached": False,
    }


async def main():
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "Usage: oauth_bridge.py <server_name> <server_url>"}), flush=True)
        sys.exit(1)

    try:
        result = await run_oauth_flow(sys.argv[1], sys.argv[2])
        print(json.dumps(result), flush=True)
    except Exception as e:
        print(json.dumps({
            "ok": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
        }), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
