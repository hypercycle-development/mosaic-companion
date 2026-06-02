"""
Hermes MCP Tools Server — expose ALL Hermes tools + skills to any MCP client.

Provides a stdio MCP server that lets any MCP client (MosAIc, Claude, Cursor,
Codex, etc.) list and call ALL Hermes built-in tools, MCP tools from connected
servers, plugins, and skills — not just messaging conversations.

Usage:
    hermes mcp serve-tools [OPTIONS]
    hermes mcp serve-tools --verbose
    hermes mcp serve-tools --toolsets "all"
    hermes mcp serve-tools --exclude-toolsets "discord,discord_admin"
    hermes mcp serve-tools --include "terminal,file,web_search,web_extract"

MCP client config (e.g. claude_desktop_config.json):
    {
        "mcpServers": {
            "hermes-tools": {
                "command": "hermes",
                "args": ["mcp", "serve-tools", "--verbose"]
            }
        }
    }

Design decisions:
- Uses FastMCP from the mcp Python package for the server framework
- Each Hermes tool becomes a distinct MCP tool (preserves names)
- Tool calls are dispatched via model_tools.handle_function_call()
- Skill tools (skills_list, skill_view, skill_manage) are just regular tools
- Full skill registry is available including class-level skills
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import traceback
import uuid
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger("hermes.mcp_serve_tools")

# ── Lazy MCP SDK ──────────────────────────────────────────────────────────
_mcp_available = False
try:
    from mcp.server.fastmcp import FastMCP

    _mcp_available = True
except ImportError:
    FastMCP = None  # type: ignore[assignment,misc]


# ── Profile Detection ─────────────────────────────────────────────────────
def _current_profile() -> Optional[str]:
    return os.environ.get("HERMES_PROFILE") or None


# ── Toolset Filtering ─────────────────────────────────────────────────────
def _resolve_enabled_toolsets(
    toolsets_arg: Optional[str] = None,
    exclude: Optional[str] = None,
) -> tuple[Optional[List[str]], Optional[List[str]]]:
    enabled: Optional[List[str]] = None
    disabled: Optional[List[str]] = None

    if toolsets_arg:
        spec = toolsets_arg.strip()
        if spec.lower() in {"all", "*"}:
            enabled = None
        else:
            enabled = [t.strip() for t in spec.split(",") if t.strip()]

    if exclude:
        disabled = [t.strip() for t in exclude.split(",") if t.strip()]

    return enabled, disabled


def _check_toolset_conflicts(tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Rename on collision so all tools make it through to the client."""
    seen: Set[str] = set()
    for tool in tools:
        fn = tool.get("function", tool)
        orig = fn.get("name", "")
        name = orig
        count = 1
        while name in seen:
            name = f"{orig}_{count}"
            count += 1
        if name != orig:
            fn["name"] = name
        seen.add(name)
    return tools


# ── Core Server Builder ───────────────────────────────────────────────────
def create_tool_mcp_server(
    *,
    enabled_toolsets: Optional[List[str]] = None,
    disabled_toolsets: Optional[List[str]] = None,
    include_tools: Optional[List[str]] = None,
    exclude_tools: Optional[List[str]] = None,
) -> Any:
    """Build a FastMCP server that exposes every Hermes tool as an MCP tool."""
    if not _mcp_available or FastMCP is None:
        raise RuntimeError("MCP SDK not installed; run: pip install mcp")

    import inspect
    import types

    mcp = FastMCP("hermes-tools")

    # Bootstrap Hermes tool registry
    _get_defs = None
    _dispatch = None
    try:
        import model_tools  # noqa: F401
        from model_tools import get_tool_definitions, handle_function_call
        _get_defs = get_tool_definitions
        _dispatch = handle_function_call
    except Exception as exc:
        logger.error("Failed to bootstrap Hermes tools: %s", exc)
        traceback.print_exc()

    if _get_defs is None:
        logger.error("Hermes tool bootstrap failed — server will have no tools")

    # Build dynamic tool definitions
    hermes_tools: List[Dict[str, Any]] = []
    if _get_defs:
        kw: Dict[str, Any] = {"quiet_mode": True}
        if enabled_toolsets is not None:
            kw["enabled_toolsets"] = enabled_toolsets
        if disabled_toolsets is not None:
            kw["disabled_toolsets"] = disabled_toolsets
        hermes_tools = _get_defs(**kw)

    # Apply include / exclude name-level filters
    if include_tools:
        inc_set = set(include_tools)
        hermes_tools = [
            t for t in hermes_tools
            if (t.get("function") or {}).get("name", "") in inc_set
        ]
    if exclude_tools:
        ex_set = set(exclude_tools)
        hermes_tools = [
            t for t in hermes_tools
            if (t.get("function") or {}).get("name", "") not in ex_set
        ]

    # Re-dispatch under unique names to avoid collisions
    # (flatten to simple name+description only for the MCP layer)
    hermes_tools = _check_toolset_conflicts(hermes_tools)

    logger.info("Exposing %d Hermes tools via MCP", len(hermes_tools))

    # ── Build dynamic MCP wrappers using proper FastMCP tool() signatures ────
    for htool in hermes_tools:
        func = htool.get("function", htool)
        tool_name = str(func.get("name", ""))
        tool_desc = str(func.get("description", ""))
        params = func.get("parameters", {}) or {}
        properties = params.get("properties", {}) if isinstance(params, dict) else {}
        required = set(params.get("required", [])) if isinstance(params, dict) else set()

        def _make_handler(name: str, dispatch_fn: Any, props: Dict[str, Any], req: Set[str]) -> Any:
            """Create an async function with correct FastMCP/Pydantic signature."""
            # Build a Python signature from the JSON schema so FastMCP can
            # produce the right MCP tool schema and argument model.
            sig_params: List[inspect.Parameter] = []
            for pname, pschema in props.items():
                default = inspect.Parameter.empty if pname in req else None
                annotation = Any
                if isinstance(pschema, dict):
                    ptype = pschema.get("type", "string")
                    if ptype == "string":
                        annotation = str
                    elif ptype == "integer":
                        annotation = int
                    elif ptype == "number":
                        annotation = float
                    elif ptype == "boolean":
                        annotation = bool
                    elif ptype == "array":
                        annotation = list
                    elif ptype == "object":
                        annotation = dict
                sig_params.append(
                    inspect.Parameter(pname, inspect.Parameter.KEYWORD_ONLY,
                                      default=default, annotation=annotation)
                )
            sig = inspect.Signature(sig_params)

            async def _wrapped(**kwargs: Any) -> str:
                task_id = str(uuid.uuid4())[:8]
                # Drop None-valued optional args to avoid schema mismatches
                args = {k: v for k, v in kwargs.items() if v is not None}
                try:
                    result = dispatch_fn(
                        function_name=name,
                        function_args=args,
                        task_id=task_id,
                    )
                except Exception as exc:
                    logger.exception("Tool dispatch error for %s", name)
                    result = json.dumps({
                        "error": str(exc),
                        "traceback": traceback.format_exc(),
                    }, ensure_ascii=False)
                if isinstance(result, str) and len(result) > 400_000:
                    result = result[:380_000] + "\n\n[TRUNCATED: result too large for MCP transport]"
                return result

            # Attach signature for FastMCP introspection
            _wrapped.__name__ = name  # type: ignore[attr-defined]
            _wrapped.__signature__ = sig  # type: ignore[attr-defined]
            _wrapped.__doc__ = tool_desc  # type: ignore[attr-defined]
            return _wrapped

        handler = _make_handler(tool_name, _dispatch, properties, required)
        try:
            mcp.add_tool(handler, name=tool_name, description=tool_desc)
        except Exception as add_exc:
            logger.warning("Skipping tool %s: registration failed: %s", tool_name, add_exc)

    # ── Meta Tools (always present) ─────────────────────────────────────────
    @mcp.tool()
    # Intentionally named with underscores to avoid collisions with any real tool
    def hermes_metadata() -> str:
        """Return metadata about this Hermes-tools MCP server.

        Includes: version, profile, tool count, connected platforms, and
        instructions for discovering skills.
        """
        meta = {
            "server": "hermes-tools-mcp",
            "version": "1.0.0",
            "profile": _current_profile(),
            "tool_count": len(hermes_tools),
            "platforms": os.environ.get("HERMES_GATEWAY_PLATFORMS", "").split(",") if os.environ.get("HERMES_GATEWAY_PLATFORMS") else "cli",
            "instructions": (
                "All active Hermes tools are exposed above. "
                "Use hermes_metadata() to see server info. "
                "Any Hermes tool (skills_list, web_search, terminal, etc.) "
                "is available directly by name."
            ),
        }
        return json.dumps(meta, indent=2)

    @mcp.tool()
    def call_hermes_tool(tool_name: str, arguments: str = "{}") -> str:
        """Call any Hermes tool by name with raw JSON arguments.

        Args:
            tool_name: Exact name of the Hermes tool to call
            arguments: JSON string of arguments (default: "{}")
        """
        if not _dispatch:
            return json.dumps({"error": "Tools not available"})
        try:
            import json as _json
            args = _json.loads(arguments) if arguments else {}
            result = _dispatch(tool_name, args, task_id=str(uuid.uuid4())[:8])
            return result
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    return mcp


# ── Entry Point ───────────────────────────────────────────────────────────
def run_mcp_tools_server(
    *,
    verbose: bool = False,
    toolsets: Optional[str] = None,
    exclude_toolsets: Optional[str] = None,
    include_tools: Optional[str] = None,
    exclude_tools: Optional[str] = None,
) -> None:
    """Start the Hermes Tools MCP server on stdio."""
    if not _mcp_available:
        print(
            "Error: MCP server requires the 'mcp' package.\n"
            f"Install with: {sys.executable} -m pip install 'mcp'",
            file=sys.stderr,
        )
        sys.exit(1)

    if verbose:
        logging.basicConfig(level=logging.DEBUG, stream=sys.stderr)
    else:
        logging.basicConfig(level=logging.WARNING, stream=sys.stderr)

    enabled, disabled = _resolve_enabled_toolsets(
        toolsets_arg=toolsets,
        exclude=exclude_toolsets,
    )
    inc = [t.strip() for t in include_tools.split(",")] if include_tools else None
    exc = [t.strip() for t in exclude_tools.split(",")] if exclude_tools else None

    server = create_tool_mcp_server(
        enabled_toolsets=enabled,
        disabled_toolsets=disabled,
        include_tools=inc,
        exclude_tools=exc,
    )

    import asyncio

    async def _run():
        try:
            await server.run_stdio_async()
        except KeyboardInterrupt:
            pass
        finally:
            logger.info("MCP Tools server shutting down")

    asyncio.run(_run())


# ── CLI argparser helper for main.py ───────────────────────────────────────
def build_serve_tools_parser(subparsers):
    """Add the 'serve-tools' subparser to an existing MCP sub-command parser."""
    p = subparsers.add_parser(
        "serve-tools",
        help="Expose ALL Hermes tools over MCP (skills, terminal, web, file, etc.)",
    )
    p.add_argument("-v", "--verbose", action="store_true", help="Verbose logging on stderr")
    p.add_argument("--toolsets", default="all", help="Comma-separated toolset list or 'all'")
    p.add_argument("--exclude-toolsets", help="Comma-separated toolsets to exclude")
    p.add_argument("--include-tools", help="Only expose specific tools by name")
    p.add_argument("--exclude-tools", help="Exclude specific tools by name")
    return p


if __name__ == "__main__":
    parser = argparse.ArgumentParser("hermes mcp serve-tools")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--toolsets", default="all")
    parser.add_argument("--exclude-toolsets")
    parser.add_argument("--include-tools")
    parser.add_argument("--exclude-tools")
    args = parser.parse_args()
    run_mcp_tools_server(
        verbose=args.verbose,
        toolsets=args.toolsets,
        exclude_toolsets=args.exclude_toolsets,
        include_tools=args.include_tools,
        exclude_tools=args.exclude_tools,
    )
