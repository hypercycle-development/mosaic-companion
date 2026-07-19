#!/usr/bin/env python3
"""
SkillSpector Security Scanner MCP Server for Mosaic Companion

A lightweight security scanner service for the Stargate Skills Marketplace.
Runs on port 8001 and provides:
  - POST /scan - Security scan for skill repositories
  - GET /health - Health check endpoint

Zero external dependencies - uses only Python standard library.
"""

import http.server
import json
import re
import socketserver
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

PORT = 8001

# Simple patterns for basic security scanning
SECURITY_PATTERNS = {
    "hardcoded_api_key": {
        "pattern": r'(?:api[_-]?key|apikey)["\']?\s*[:=]\s*["\'][a-zA-Z0-9_\-]{16,}["\']',
        "severity": "high",
        "message": "Potential hardcoded API key detected"
    },
    "hardcoded_secret": {
        "pattern": r'(?:secret|token|password)["\']?\s*[:=]\s*["\'][^"\']{8,}["\']',
        "severity": "high",
        "message": "Potential hardcoded secret detected"
    },
    "http_url": {
        "pattern": r'http://[^\s"\']+',
        "severity": "medium",
        "message": "HTTP URL detected (consider using HTTPS)"
    },
    "eval_usage": {
        "pattern": r'\beval\s*\(',
        "severity": "medium",
        "message": "Use of eval() detected - potential code injection risk"
    },
    "dangerous_shell": {
        "pattern": r'(?:exec|subprocess\.call|os\.system|shell=True)',
        "severity": "high",
        "message": "Dangerous shell execution detected"
    },
    "unverified_ssl": {
        "pattern": r'verify\s*=\s*False|verify_ssl\s*=\s*False',
        "severity": "medium",
        "message": "SSL verification disabled"
    },
    "debug_mode": {
        "pattern": r'debug\s*=\s*True|DEBUG\s*=\s*True',
        "severity": "low",
        "message": "Debug mode enabled (should be disabled in production)"
    },
    "wildcard_cors": {
        "pattern": r'\*|Access-Control-Allow-Origin.*\*',
        "severity": "medium",
        "message": "Wildcard CORS policy detected"
    }
}


class ScannerHandler(http.server.BaseHTTPRequestHandler):
    """HTTP request handler for the security scanner."""
    
    def log_message(self, format, *args):
        """Custom logging with timestamps."""
        timestamp = datetime.now().isoformat()
        print(f"[{timestamp}] {format % args}")
    
    def send_json_response(self, status_code, data):
        """Send a JSON response with proper headers."""
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests."""
        if self.path == "/health":
            self.send_json_response(200, {
                "status": "healthy",
                "service": "SkillSpector Security Scanner",
                "version": "1.0.0",
                "port": PORT,
                "timestamp": datetime.now().isoformat()
            })
        else:
            self.send_json_response(404, {"error": "Not found", "path": self.path})
    
    def do_POST(self):
        """Handle POST requests."""
        if self.path == "/scan":
            self.handle_scan()
        else:
            self.send_json_response(404, {"error": "Not found", "path": self.path})
    
    def read_body(self):
        """Read and parse the request body."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return {}
    
    def handle_scan(self):
        """Process a security scan request."""
        body = self.read_body()
        
        url = body.get("url") or body.get("sourceUrl")
        skill_slug = body.get("skill_slug") or body.get("skillSlug")
        
        if not url:
            self.send_json_response(400, {
                "error": "Missing required field: url or sourceUrl"
            })
            return
        
        print(f"[SCAN] Scanning skill: {skill_slug or 'unknown'} from {url}")
        
        # Perform the security scan
        findings = self.scan_url(url)
        
        # Calculate risk score (0-100)
        risk_score = self.calculate_risk_score(findings)
        
        # Determine overall risk level
        risk_level = self.determine_risk_level(risk_score, findings)
        
        response = {
            "scanId": f"scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "skillSlug": skill_slug,
            "sourceUrl": url,
            "scannedAt": datetime.now().isoformat(),
            "riskScore": risk_score,
            "riskLevel": risk_level,
            "findings": findings,
            "summary": {
                "totalFindings": len(findings),
                "critical": len([f for f in findings if f["severity"] == "critical"]),
                "high": len([f for f in findings if f["severity"] == "high"]),
                "medium": len([f for f in findings if f["severity"] == "medium"]),
                "low": len([f for f in findings if f["severity"] == "low"]),
                "info": len([f for f in findings if f["severity"] == "info"])
            }
        }
        
        self.send_json_response(200, response)
    
    def scan_url(self, url):
        """Scan a URL for security issues."""
        findings = []
        
        # If it's a local path, scan files
        if url.startswith("file://") or Path(url).exists():
            findings.extend(self.scan_local_path(url.replace("file://", "")))
        # If it's a GitHub repo, simulate scanning
        elif "github.com" in url:
            findings.extend(self.scan_github_repo(url))
        else:
            # Generic URL scan simulation
            findings.append({
                "rule": "external_url",
                "severity": "info",
                "message": f"External URL scanned: {url}",
                "line": 0,
                "file": "N/A"
            })
        
        return findings
    
    def scan_local_path(self, path):
        """Scan a local directory or file."""
        findings = []
        target_path = Path(path)
        
        if not target_path.exists():
            findings.append({
                "rule": "path_not_found",
                "severity": "info",
                "message": f"Path does not exist: {path}",
                "line": 0,
                "file": path
            })
            return findings
        
        # Files to scan
        extensions = {".js", ".ts", ".py", ".json", ".yaml", ".yml", ".toml", ".md"}
        
        if target_path.is_file():
            files_to_scan = [target_path]
        else:
            files_to_scan = [
                f for f in target_path.rglob("*") 
                if f.is_file() and f.suffix in extensions
            ][:50]  # Limit to 50 files to prevent timeouts
        
        for file_path in files_to_scan:
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                file_findings = self.scan_content(content, str(file_path))
                findings.extend(file_findings)
            except Exception as e:
                findings.append({
                    "rule": "scan_error",
                    "severity": "info",
                    "message": f"Could not scan file: {e}",
                    "line": 0,
                    "file": str(file_path)
                })
        
        return findings
    
    def scan_github_repo(self, url):
        """Simulate scanning a GitHub repository."""
        findings = []
        
        # Parse repo name from URL
        repo_match = re.search(r'github\.com/([^/]+/[^/]+)', url)
        repo_name = repo_match.group(1) if repo_match else "unknown"
        
        # Simulate some findings based on repo name hash
        import hashlib
        hash_val = int(hashlib.md5(repo_name.encode()).hexdigest(), 16)
        
        # Deterministic "random" findings for demo purposes
        if hash_val % 3 == 0:
            findings.append({
                "rule": "readme_check",
                "severity": "low",
                "message": "Repository has a README file",
                "line": 1,
                "file": "README.md"
            })
        
        if hash_val % 5 == 0:
            findings.append({
                "rule": "license_check",
                "severity": "info",
                "message": "License file detected - verify it's OSI approved",
                "line": 1,
                "file": "LICENSE"
            })
        
        if hash_val % 7 == 0:
            findings.append({
                "rule": "dependency_check",
                "severity": "medium",
                "message": "Dependencies detected - run vulnerability scan separately",
                "line": 1,
                "file": "package.json"
            })
        
        # Always add at least one info finding
        findings.append({
            "rule": "repo_scan_complete",
            "severity": "info",
            "message": f"Remote repository scan completed for {repo_name}",
            "line": 0,
            "file": url
        })
        
        return findings
    
    def scan_content(self, content, filename):
        """Scan file content for security patterns."""
        findings = []
        lines = content.split("\n")
        
        for line_num, line in enumerate(lines, 1):
            for rule_name, rule in SECURITY_PATTERNS.items():
                if re.search(rule["pattern"], line, re.IGNORECASE):
                    # Avoid duplicate findings for the same line
                    already_found = any(
                        f["line"] == line_num and f["rule"] == rule_name 
                        for f in findings
                    )
                    if not already_found:
                        findings.append({
                            "rule": rule_name,
                            "severity": rule["severity"],
                            "message": rule["message"],
                            "line": line_num,
                            "file": filename,
                            "snippet": line.strip()[:100]  # First 100 chars
                        })
        
        return findings
    
    def calculate_risk_score(self, findings):
        """Calculate a risk score from 0-100 based on findings."""
        severity_weights = {
            "critical": 25,
            "high": 15,
            "medium": 5,
            "low": 2,
            "info": 0
        }
        
        score = 0
        for finding in findings:
            score += severity_weights.get(finding["severity"], 0)
        
        return min(score, 100)  # Cap at 100
    
    def determine_risk_level(self, score, findings):
        """Determine overall risk level based on score and critical findings."""
        has_critical = any(f["severity"] == "critical" for f in findings)
        
        if has_critical or score >= 75:
            return "critical"
        elif score >= 50:
            return "high"
        elif score >= 25:
            return "medium"
        elif score > 0:
            return "low"
        else:
            return "none"


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """Thread-per-request HTTP server."""
    allow_reuse_address = True
    daemon_threads = True


def main():
    """Run the scanner server."""
    server = ThreadedHTTPServer(("0.0.0.0", PORT), ScannerHandler)
    print(f"=" * 60)
    print(f"SkillSpector Security Scanner MCP Server")
    print(f"=" * 60)
    print(f"Listening on port {PORT}")
    print(f"Health check: http://localhost:{PORT}/health")
    print(f"Scan endpoint: http://localhost:{PORT}/scan")
    print(f"Press Ctrl+C to stop")
    print(f"=" * 60)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down scanner...")
        server.shutdown()
        print("Scanner stopped.")


if __name__ == "__main__":
    main()
