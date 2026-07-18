#!/usr/bin/env python3
"""
=============================================================================
HYPERAIBOX AGENT (HBA) — Stargate Pool Cloud Agent
=============================================================================
Lightweight agent running on each HyperAIBox that reports telemetry
to the Stargate Pool Orchestrator and accepts provisioning commands.

Usage:
    python3 hba_agent.py --config /etc/stargate/hba.json
    
Or as a systemd service:
    systemctl enable stargate-hba
    systemctl start stargate-hba

Features:
    • Polls local Node Manager (:8006/api/info) for live telemetry
    • Reports telemetry to Stargate Pool Orchestrator every 30s
    • Accepts provisioning commands via HTTP endpoint
    • Manages Docker tenant lifecycle (create/destroy/extend)
    • WireGuard client integration (future)
=============================================================================
"""

import os
import sys
import json
import time
import uuid
import hashlib
import argparse
import threading
import subprocess
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

try:
    import requests
except ImportError:
    requests = None

# ============================================================================
# CONFIGURATION
# ============================================================================

DEFAULT_CONFIG = {
    "box_id": None,                    # Auto-generated if not set
    "box_name": "",                    # e.g., "R2D2", "C-3PO"
    "orchestrator_url": "",            # SPO endpoint (HTTP)
    "api_secret": "",                  # Shared secret for auth
    "heartbeat_interval": 30,          # Seconds between heartbeats
    "nm_api_host": "localhost",        # Node Manager API host
    "nm_api_port": 8006,               # Node Manager API port
    "local_api_port": 8100,            # HBA's own API port (for commands)
    "docker_socket": "/var/run/docker.sock",
    "tenant_base_image": "ubuntu:22.04",
    "log_level": "INFO",
    "pool_id": "stargate-pool-alpha",   # Which pool this box belongs to
    "region": "unknown",                # e.g., "us-east", "eu-west"
    "owner_wallet": "",                 # Cardano/Base wallet of box owner
    "commission_percent": 0.57,       # Owner's share (57% = $2.00 of $3.50)
    "max_concurrent_tenants": 2,        # Based on hardware capacity
    "public_access": True,              # Allow public rentals
    "nft_gated": False,                 # Require ANFE to rent
    "allowed_collections": [],         # e.g., ["HPEC-DAO-PASS"]
}


# ============================================================================
# LOGGER
# ============================================================================

def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        fmt = "%(asctime)s | %(levelname)-7s | %(message)s"
        handler.setFormatter(logging.Formatter(fmt, datefmt="%Y-%m-%d %H:%M:%S"))
        logger.addHandler(handler)
    return logger


# ============================================================================
# TELEMETRY COLLECTOR
# ============================================================================

class TelemetryCollector:
    """Polls local Node Manager and system for telemetry."""
    
    def __init__(self, nm_host: str, nm_port: int, logger: logging.Logger):
        # Try both /api/info (port 8006) and /info (port 8000)
        # Port 8000 is the actual Node Manager API
        self.nm_url = f"http://{nm_host}:{nm_port}/api/info"
        self.nm_fallback_url = f"http://{nm_host}:{nm_port}/info"
        self.logger = logger
    
    def collect(self) -> Dict[str, Any]:
        """Gather all telemetry data."""
        telemetry = {
            "timestamp": int(time.time()),
            "box_id": None,
            "status": "unknown",
            "node_manager": {},
            "system": {},
            "docker": {},
            "tenants": [],
        }
        
        # 1. Node Manager telemetry (try both endpoints)
        try:
            nm_data = self._fetch_nm_info()
            telemetry["node_manager"] = nm_data
            telemetry["status"] = nm_data.get("status", "unknown")
            telemetry["box_id"] = nm_data.get("node_id") or nm_data.get("license")
        except Exception as e:
            self.logger.warning(f"NM fetch failed: {e}")
            telemetry["status"] = "nm_unavailable"
        
        # 2. System telemetry (fallback if NM fails)
        try:
            telemetry["system"] = self._fetch_system_info()
        except Exception as e:
            self.logger.warning(f"System fetch failed: {e}")
        
        # 3. Docker telemetry
        try:
            telemetry["docker"] = self._fetch_docker_info()
        except Exception as e:
            self.logger.warning(f"Docker fetch failed: {e}")
        
        return telemetry
    
    def _fetch_nm_info(self) -> Dict[str, Any]:
        """Fetch from Node Manager /api/info or /info."""
        urls_to_try = [self.nm_url, self.nm_fallback_url]
        
        for url in urls_to_try:
            try:
                if requests:
                    resp = requests.get(url, timeout=5)
                    if resp.status_code == 200:
                        return resp.json()
                else:
                    result = subprocess.run(
                        ["curl", "-s", "--max-time", "5", url],
                        capture_output=True, text=True, timeout=10
                    )
                    if result.returncode == 0:
                        return json.loads(result.stdout)
            except Exception:
                continue
        
        raise RuntimeError(f"All NM URLs failed: {urls_to_try}")
    
    def _fetch_system_info(self) -> Dict[str, Any]:
        """Get CPU, memory, disk via /proc."""
        info = {}
        
        # CPU
        try:
            with open("/proc/cpuinfo") as f:
                content = f.read()
                cores = content.count("processor")
                info["cpu_cores"] = cores
                # Try to get model
                for line in content.split("\n")[:20]:
                    if "model name" in line:
                        info["cpu_model"] = line.split(":")[1].strip()
                        break
        except Exception:
            info["cpu_cores"] = os.cpu_count() or 1
        
        # Memory
        try:
            with open("/proc/meminfo") as f:
                lines = f.readlines()
                for line in lines:
                    if line.startswith("MemTotal:"):
                        kb = int(line.split()[1])
                        info["memory_total_gb"] = round(kb / 1024 / 1024, 2)
                    elif line.startswith("MemAvailable:"):
                        kb = int(line.split()[1])
                        info["memory_available_gb"] = round(kb / 1024 / 1024, 2)
        except Exception:
            pass
        
        # Disk
        try:
            result = subprocess.run(
                ["df", "-B1", "/"],
                capture_output=True, text=True, timeout=5
            )
            lines = result.stdout.strip().split("\n")
            if len(lines) >= 2:
                parts = lines[1].split()
                info["disk_total_gb"] = round(int(parts[1]) / 1024**3, 2)
                info["disk_free_gb"] = round(int(parts[3]) / 1024**3, 2)
        except Exception:
            pass
        
        # Uptime
        try:
            with open("/proc/uptime") as f:
                uptime_sec = float(f.read().split()[0])
                info["uptime_hours"] = round(uptime_sec / 3600, 2)
        except Exception:
            pass
        
        # Load average
        try:
            with open("/proc/loadavg") as f:
                load = f.read().split()
                info["load_1m"] = float(load[0])
        except Exception:
            pass
        
        return info
    
    def _fetch_docker_info(self) -> Dict[str, Any]:
        """Get Docker container stats."""
        info = {
            "running_containers": 0,
            "total_containers": 0,
            "images": 0,
        }
        
        try:
            result = subprocess.run(
                ["docker", "ps", "-q"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                info["running_containers"] = len(result.stdout.strip().split("\n")) if result.stdout.strip() else 0
            
            result2 = subprocess.run(
                ["docker", "ps", "-aq"],
                capture_output=True, text=True, timeout=10
            )
            if result2.returncode == 0:
                info["total_containers"] = len(result2.stdout.strip().split("\n")) if result2.stdout.strip() else 0
        except Exception:
            pass
        
        return info


# ============================================================================
# TENANT MANAGER (Docker-based isolation)
# ============================================================================

class TenantManager:
    """Manages Docker containers for tenant isolation."""
    
    def __init__(self, docker_socket: str, base_image: str, logger: logging.Logger):
        self.docker_socket = docker_socket
        self.base_image = base_image
        self.logger = logger
        self.active_tenants: Dict[str, Dict[str, Any]] = {}
    
    def list_tenants(self) -> List[Dict[str, Any]]:
        """List all tenant containers."""
        tenants = []
        try:
            result = subprocess.run(
                ["docker", "ps", "-a", "--filter", "label=stargate.tenant=true",
                 "--format", "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0 and result.stdout.strip():
                for line in result.stdout.strip().split("\n"):
                    parts = line.split("\t")
                    if len(parts) >= 4:
                        tenants.append({
                            "container_id": parts[0],
                            "name": parts[1],
                            "status": parts[2],
                            "image": parts[3],
                        })
        except Exception as e:
            self.logger.warning(f"Failed to list tenants: {e}")
        return tenants
    
    def provision(self, tenant_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new tenant container. Supports tilling mode for Node Factories."""
        
        # Check if this is a tilling provision
        if config.get("tilling_mode", False):
            return self.provision_tilling(tenant_id, config)
        
        # Standard compute tenant
        self.logger.info(f"Provisioning tenant {tenant_id}")
        
        cpu = config.get("cpu", 2)
        memory_gb = config.get("memory_gb", 8)
        image = config.get("image", self.base_image)
        ssh_key = config.get("ssh_public_key", "")
        
        container_name = f"tenant-{tenant_id[:8]}"
        
        # Build command
        cmd = [
            "docker", "run", "-d",
            "--name", container_name,
            "--label", "stargate.tenant=true",
            "--label", f"stargate.tenant.id={tenant_id}",
            "--cpus", str(cpu),
            "--memory", f"{memory_gb}g",
            "--memory-swap", f"{memory_gb}g",
            "--pids-limit", "1000",
            "--security-opt", "no-new-privileges:true",
            "--cap-drop", "ALL",
            "--cap-add", "CHOWN",
            "--cap-add", "SETGID",
            "--cap-add", "SETUID",
            "--network", "bridge",
        ]
        
        # Volume for persistent data
        volume_name = f"tenant-{tenant_id[:8]}-data"
        subprocess.run(
            ["docker", "volume", "create", volume_name],
            capture_output=True, timeout=30
        )
        cmd.extend(["-v", f"{volume_name}:/workspace"])
        
        # SSH key injection
        if ssh_key:
            cmd.extend(["-e", f"SSH_PUBLIC_KEY={ssh_key}"])
        
        cmd.append(image)
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if result.returncode != 0:
                raise RuntimeError(f"Docker run failed: {result.stderr}")
            
            container_id = result.stdout.strip()
            
            tenant_info = {
                "tenant_id": tenant_id,
                "container_id": container_id,
                "name": container_name,
                "status": "provisioning",
                "created_at": int(time.time()),
                "config": config,
            }
            self.active_tenants[tenant_id] = tenant_info
            self.logger.info(f"Tenant {tenant_id} provisioned: {container_id}")
            return tenant_info
            
        except Exception as e:
            self.logger.error(f"Provisioning failed: {e}")
            raise
    
    def provision_tilling(self, tenant_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Provision a Node Factory tilling session.
        
        The HyperAIBox already runs Node Manager natively on :8000.
        We verify it's healthy, then start a tilling monitor container
        that reports earnings/uptime to the SPO.
        """
        self.logger.info(f"Provisioning tilling session {tenant_id}")
        
        license_id = config.get("license_id", "")
        owner_wallet = config.get("owner_wallet", "")
        network = config.get("network", "base")
        spo_url = config.get("spo_url", "")
        
        container_name = f"till-{tenant_id[:8]}"
        
        # ── Step 1: Verify existing Node Manager is healthy ──
        import urllib.request
        import socket
        
        # Check port 8000 is open (Node Manager runs natively on HyperAIBox)
        nm_alive = False
        try:
            with socket.create_connection(("127.0.0.1", 8000), timeout=5):
                nm_alive = True
        except:
            pass
        
        # Also verify it's responding with /info
        if nm_alive:
            try:
                with urllib.request.urlopen("http://127.0.0.1:8000/info", timeout=5) as resp:
                    nm_alive = resp.status == 200
            except:
                nm_alive = False
        
        if not nm_alive:
            raise RuntimeError(
                "Node Manager is not responding on :8000. "
                "Tilling requires an active Hypercycle Node Manager."
            )
        
        self.logger.info(f"Node Manager verified healthy on :8000")
        
        # ── Step 2: Start Tilling Monitor Agent ──
        # This container tracks earnings and reports to SPO
        monitor_cmd = [
            "docker", "run", "-d",
            "--name", f"{container_name}-monitor",
            "--label", "stargate.tenant=true",
            "--label", f"stargate.tenant.id={tenant_id}",
            "--label", "stargate.tilling.monitor=true",
            "--network", "host",
            "-e", f"TENANT_ID={tenant_id}",
            "-e", f"LICENSE_ID={license_id}",
            "-e", f"OWNER_WALLET={owner_wallet}",
            "-e", f"NETWORK={network}",
            "-e", f"SPO_URL={spo_url or ''}",
            "-e", "HEARTBEAT_INTERVAL=30",
            "python:3.11-slim",
            "python", "-c", self._get_monitor_script(),
        ]
        
        try:
            result = subprocess.run(monitor_cmd, capture_output=True, text=True, timeout=60)
            if result.returncode != 0:
                raise RuntimeError(f"Monitor start failed: {result.stderr}")
            
            monitor_container_id = result.stdout.strip()
            self.logger.info(f"Tilling Monitor started: {monitor_container_id}")
            
        except Exception as e:
            self.logger.error(f"Tilling provision failed: {e}")
            raise
        
        # ── Step 3: Record session ──
        tenant_info = {
            "tenant_id": tenant_id,
            "monitor_container_id": monitor_container_id,
            "name": container_name,
            "status": "tilling",
            "mode": "tilling",
            "license_id": license_id,
            "owner_wallet": owner_wallet,
            "network": network,
            "node_manager_url": "http://localhost:8000",
            "node_manager_alive": True,
            "created_at": int(time.time()),
            "config": config,
        }
        self.active_tenants[tenant_id] = tenant_info
        self.logger.info(f"Tilling session {tenant_id} active on box")
        return tenant_info
    
    def _get_monitor_script(self) -> str:
        """Return embedded Python monitor script for Tilling.
        
        Dynamically discovers Tiller port (9000 or 9001) and queries
        /list for actual tilling status (slots, active tillers).
        """
        return '''
import os, time, json, urllib.request

TENANT_ID = os.environ.get("TENANT_ID", "")
LICENSE_ID = os.environ.get("LICENSE_ID", "")
OWNER_WALLET = os.environ.get("OWNER_WALLET", "")
SPO_URL = os.environ.get("SPO_URL", "")
INTERVAL = int(os.environ.get("HEARTBEAT_INTERVAL", "30"))

TILLER_PORTS = [9000, 9001, 9002, 9003]

def discover_tiller_port():
    """Find which port the hyperbox-tiller AIM is actually listening on."""
    for port in TILLER_PORTS:
        try:
            with urllib.request.urlopen(f"http://localhost:{port}/list", timeout=3) as resp:
                if resp.status == 200:
                    return port, json.loads(resp.read().decode())
        except:
            continue
    return None, None

def send_heartbeat():
    if not SPO_URL:
        return
    try:
        # Check Node Manager health (use /info — HyperCycle NM returns 405 on /health)
        nm_alive = False
        try:
            with urllib.request.urlopen("http://localhost:8000/info", timeout=5) as resp:
                nm_alive = resp.status == 200
        except:
            pass
        
        # Discover Tiller port and get actual status
        tiller_port, tiller_status = discover_tiller_port()
        aim_alive = tiller_port is not None
        
        available_slots = 0
        active_tillers = []
        tilling_active = False
        
        if tiller_status:
            available_slots = tiller_status.get("available", 0)
            active_tillers = tiller_status.get("tillers", [])
            tilling_active = len(active_tillers) > 0
        
        report = {
            "tenant_id": TENANT_ID,
            "license_id": LICENSE_ID,
            "node_manager_alive": nm_alive,
            "aim_alive": aim_alive,
            "tiller_port": tiller_port,
            "available_slots": available_slots,
            "active_tillers_count": len(active_tillers),
            "tilling_active": tilling_active,
            "active_tillers": [
                {
                    "number": t.get("number"),
                    "license": t.get("license"),
                    "priority": t.get("priority"),
                    "address": t.get("address"),
                    "time_left": t.get("time_left"),
                }
                for t in active_tillers[:5]  # Limit to 5 in heartbeat
            ],
            "uptime_seconds": int(time.time()),
            "requests_served": 0,
            "estimated_earnings_hypc": 0.0,
        }
        
        req = urllib.request.Request(
            f"{SPO_URL}/api/v1/tilling/heartbeat",
            data=json.dumps(report).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f"[TillingMonitor] Heartbeat failed: {e}")

while True:
    send_heartbeat()
    time.sleep(INTERVAL)
'''
    
    def destroy(self, tenant_id: str) -> bool:
        """Destroy a tenant container."""
        tenant = self.active_tenants.get(tenant_id)
        is_tilling = tenant and tenant.get("mode") == "tilling"
        self.logger.info(f"Destroying tenant {tenant_id} (tilling={is_tilling})")
        
        if is_tilling and tenant:
            return self._destroy_tilling(tenant_id, tenant)
        
        container_name = f"tenant-{tenant_id[:8]}"
        
        try:
            subprocess.run(
                ["docker", "stop", "-t", "10", container_name],
                capture_output=True, timeout=20
            )
            subprocess.run(
                ["docker", "rm", container_name],
                capture_output=True, timeout=20
            )
            
            # Remove volume
            volume_name = f"tenant-{tenant_id[:8]}-data"
            subprocess.run(
                ["docker", "volume", "rm", volume_name],
                capture_output=True, timeout=20
            )
            
            if tenant_id in self.active_tenants:
                del self.active_tenants[tenant_id]
            
            self.logger.info(f"Tenant {tenant_id} destroyed")
            return True
            
        except Exception as e:
            self.logger.error(f"Destroy failed: {e}")
            return False
    
    def _destroy_tilling(self, tenant_id: str, tenant: Dict[str, Any]) -> bool:
        """Destroy tilling session: stop monitor container, Node Manager stays."""
        monitor_container = tenant.get("monitor_container_id", f"till-{tenant_id[:8]}-monitor")
        
        # Stop monitor container (Node Manager stays running for other sessions)
        try:
            subprocess.run(
                ["docker", "stop", "-t", "10", monitor_container],
                capture_output=True, timeout=20
            )
            subprocess.run(
                ["docker", "rm", monitor_container],
                capture_output=True, timeout=20
            )
        except Exception:
            pass
        
        if tenant_id in self.active_tenants:
            del self.active_tenants[tenant_id]
        
        self.logger.info(f"Tilling session {tenant_id} destroyed (monitor stopped)")
        return True
    
    def get_status(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get tenant container status."""
        container_name = f"tenant-{tenant_id[:8]}"
        try:
            result = subprocess.run(
                ["docker", "inspect", "--format",
                 "{{.State.Status}}|{{.State.Running}}|{{.State.StartedAt}}|{{.NetworkSettings.IPAddress}}",
                 container_name],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                parts = result.stdout.strip().split("|")
                return {
                    "tenant_id": tenant_id,
                    "status": parts[0] if len(parts) > 0 else "unknown",
                    "running": parts[1] == "true" if len(parts) > 1 else False,
                    "started_at": parts[2] if len(parts) > 2 else None,
                    "ip_address": parts[3] if len(parts) > 3 else None,
                }
        except Exception:
            pass
        return None


# ============================================================================
# HBA HTTP API (Accepts commands from SPO)
# ============================================================================

class HBAAPI:
    """Minimal HTTP API for receiving commands from orchestrator."""
    
    def __init__(self, port: int, tenant_manager: TenantManager, logger: logging.Logger):
        self.port = port
        self.tenant_manager = tenant_manager
        self.logger = logger
        self.running = False
    
    def start(self):
        """Start HTTP server in a thread."""
        try:
            from http.server import HTTPServer, BaseHTTPRequestHandler
            import urllib.parse
            
            tenant_mgr = self.tenant_manager
            logger = self.logger
            
            class Handler(BaseHTTPRequestHandler):
                def log_message(self, fmt, *args):
                    logger.debug(fmt % args)
                
                def do_GET(self):
                    parsed = urllib.parse.urlparse(self.path)
                    path = parsed.path
                    
                    if path == "/health":
                        self._respond(200, {"status": "ok", "agent": "hba", "version": "1.0.0"})
                    elif path == "/tenants":
                        tenants = tenant_mgr.list_tenants()
                        self._respond(200, {"tenants": tenants})
                    else:
                        self._respond(404, {"error": "not found"})
                
                def do_POST(self):
                    parsed = urllib.parse.urlparse(self.path)
                    path = parsed.path
                    content_len = int(self.headers.get("Content-Length", 0))
                    body = self.rfile.read(content_len).decode("utf-8")
                    
                    try:
                        data = json.loads(body) if body else {}
                    except json.JSONDecodeError:
                        self._respond(400, {"error": "invalid json"})
                        return
                    
                    if path == "/provision":
                        tenant_id = data.get("tenant_id", str(uuid.uuid4()))
                        # Tilling mode passes config at top level, not nested
                        config = data.get("config", {})
                        if data.get("tilling_mode", False):
                            config = data  # Use entire payload as config for tilling
                        try:
                            info = tenant_mgr.provision(tenant_id, config)
                            self._respond(200, {"success": True, "tenant": info})
                        except Exception as e:
                            self._respond(500, {"success": False, "error": str(e)})
                    
                    elif path == "/destroy":
                        tenant_id = data.get("tenant_id", "")
                        success = tenant_mgr.destroy(tenant_id)
                        self._respond(200, {"success": success})
                    
                    else:
                        self._respond(404, {"error": "not found"})
                
                def _respond(self, code: int, data: Dict):
                    self.send_response(code)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(data).encode())
            
            def run_server():
                server = HTTPServer(("", self.port), Handler)
                self.logger.info(f"HBA API listening on port {self.port}")
                while self.running:
                    try:
                        server.handle_request()
                    except Exception as e:
                        logger.error(f"Server error: {e}")
            
            self.running = True
            self.thread = threading.Thread(target=run_server, daemon=True)
            self.thread.start()
            
        except ImportError:
            self.logger.warning("http.server not available, HBA API disabled")
    
    def stop(self):
        self.running = False


# ============================================================================
# HBA AGENT (Main)
# ============================================================================

class HBAAgent:
    """Main HyperAIBox Agent — reports telemetry, manages tenants."""
    
    def __init__(self, config_path: str):
        self.config = self._load_config(config_path)
        self.logger = setup_logger("HBA", self.config.get("log_level", "INFO"))
        self.box_id = self.config.get("box_id") or self._generate_box_id()
        self.box_name = self.config.get("box_name", self.box_id[:8])
        
        self.telemetry = TelemetryCollector(
            self.config.get("nm_api_host", "localhost"),
            self.config.get("nm_api_port", 8006),
            self.logger
        )
        self.tenant_manager = TenantManager(
            self.config.get("docker_socket", "/var/run/docker.sock"),
            self.config.get("tenant_base_image", "ubuntu:22.04"),
            self.logger
        )
        self.api = HBAAPI(
            self.config.get("local_api_port", 8100),
            self.tenant_manager,
            self.logger
        )
        
        self.running = False
        self.heartbeat_thread: Optional[threading.Thread] = None
    
    def _load_config(self, path: str) -> Dict[str, Any]:
        config = dict(DEFAULT_CONFIG)
        if os.path.exists(path):
            with open(path) as f:
                config.update(json.load(f))
        return config
    
    def _generate_box_id(self) -> str:
        """Generate stable box ID from machine fingerprint."""
        try:
            with open("/etc/machine-id") as f:
                machine_id = f.read().strip()
        except Exception:
            machine_id = str(uuid.getnode())
        return hashlib.sha256(machine_id.encode()).hexdigest()[:16]
    
    def _save_config(self, path: str):
        """Persist config with generated box_id."""
        self.config["box_id"] = self.box_id
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(self.config, f, indent=2)
    
    def _send_heartbeat(self):
        """Report telemetry to orchestrator."""
        url = self.config.get("orchestrator_url", "")
        if not url:
            self.logger.warning("No orchestrator_url configured, heartbeat SKIPPED — check config file path")
            return
        
        self.logger.debug(f"Sending heartbeat to {url}")
        
        telemetry = self.telemetry.collect()
        telemetry["box_id"] = self.box_id
        telemetry["box_name"] = self.box_name
        telemetry["pool_id"] = self.config.get("pool_id", "default")
        telemetry["region"] = self.config.get("region", "unknown")
        telemetry["owner_wallet"] = self.config.get("owner_wallet", "")
        telemetry["commission_percent"] = self.config.get("commission_percent", 0.57)
        telemetry["max_concurrent_tenants"] = self.config.get("max_concurrent_tenants", 2)
        telemetry["public_access"] = self.config.get("public_access", True)
        telemetry["nft_gated"] = self.config.get("nft_gated", False)
        telemetry["tenant_count"] = len(self.tenant_manager.active_tenants)
        
        payload = {
            "type": "heartbeat",
            "timestamp": int(time.time()),
            "data": telemetry,
        }
        
        headers = {}
        api_secret = self.config.get("api_secret", "")
        if api_secret:
            headers["X-HBA-Secret"] = api_secret
        
        try:
            if requests:
                resp = requests.post(
                    f"{url}/api/v1/boxes/{self.box_id}/heartbeat",
                    json=payload,
                    headers=headers,
                    timeout=10
                )
                if resp.status_code == 200:
                    self.logger.info(f"Heartbeat sent to {url}")
                else:
                    self.logger.warning(f"Heartbeat rejected: {resp.status_code}")
            else:
                # Fallback: curl
                cmd = [
                    "curl", "-s", "-X", "POST",
                    "-H", "Content-Type: application/json",
                    "-d", json.dumps(payload),
                    "--max-time", "10",
                    f"{url}/api/v1/boxes/{self.box_id}/heartbeat"
                ]
                if api_secret:
                    cmd.extend(["-H", f"X-HBA-Secret: {api_secret}"])
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                if result.returncode == 0:
                    self.logger.info(f"Heartbeat sent via curl")
                else:
                    self.logger.warning(f"Heartbeat curl failed: {result.stderr}")
        except Exception as e:
            self.logger.warning(f"Heartbeat failed: {e}")
    
    def _heartbeat_loop(self):
        """Background thread: send heartbeats periodically."""
        self.logger.info("Heartbeat thread started")
        interval = self.config.get("heartbeat_interval", 30)
        while self.running:
            try:
                self._send_heartbeat()
            except Exception as e:
                self.logger.error(f"Heartbeat error (will retry in {interval}s): {e}")
            time.sleep(interval)
        self.logger.info("Heartbeat thread stopped")
    
    def start(self):
        """Start the HBA agent."""
        self.logger.info(f"═══════════════════════════════════════════════")
        self.logger.info(f"  HyperAIBox Agent (HBA) v1.0.0")
        self.logger.info(f"  Box: {self.box_name} ({self.box_id})")
        self.logger.info(f"  Pool: {self.config.get('pool_id', 'default')}")
        self.logger.info(f"═══════════════════════════════════════════════")
        
        self.running = True
        self.api.start()
        
        self.heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self.heartbeat_thread.start()
        
        self.logger.info("HBA started. Press Ctrl+C to stop.")
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.logger.info("Received interrupt signal")
        finally:
            self.stop()
    
    def stop(self):
        """Graceful shutdown."""
        self.logger.info("Shutting down HBA...")
        self.running = False
        self.api.stop()
        if self.heartbeat_thread and self.heartbeat_thread.is_alive():
            self.heartbeat_thread.join(timeout=5)
        self.logger.info("HBA stopped.")


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="HyperAIBox Agent (HBA) for Stargate Pool")
    parser.add_argument("--config", "-c", default="/etc/stargate/hba.json",
                        help="Path to config file")
    parser.add_argument("--init", action="store_true",
                        help="Generate initial config and exit")
    parser.add_argument("--box-name", default="",
                        help="Name for this box (e.g., R2D2)")
    parser.add_argument("--orchestrator-url", default="",
                        help="Stargate Pool Orchestrator URL")
    parser.add_argument("--region", default="unknown",
                        help="Geographic region (e.g., us-east, eu-west)")
    parser.add_argument("--owner-wallet", default="",
                        help="Owner wallet address")
    parser.add_argument("--log-level", default="INFO",
                        help="Log level (DEBUG, INFO, WARNING, ERROR)")
    
    args = parser.parse_args()
    
    if args.init:
        config = dict(DEFAULT_CONFIG)
        config["box_name"] = args.box_name or input("Box name (e.g., R2D2): ").strip()
        config["orchestrator_url"] = args.orchestrator_url or input("Orchestrator URL: ").strip()
        config["region"] = args.region or input("Region (e.g., us-east): ").strip()
        config["owner_wallet"] = args.owner_wallet or input("Owner wallet: ").strip()
        config["log_level"] = args.log_level
        
        os.makedirs(os.path.dirname(args.config), exist_ok=True)
        with open(args.config, "w") as f:
            json.dump(config, f, indent=2)
        print(f"Config written to {args.config}")
        print(f"Edit it and run: python3 {__file__} --config {args.config}")
        return
    
    agent = HBAAgent(args.config)
    agent.start()


if __name__ == "__main__":
    main()
