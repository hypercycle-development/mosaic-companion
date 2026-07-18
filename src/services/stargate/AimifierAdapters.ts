// =============================================================================
// AIMIFIER ADAPTERS — Electron IPC-backed Concrete Implementations
// Bridges AimifierService interfaces to Electron main process
// =============================================================================

import type {
  DockerAdapter,
  AimPyGenAdapter,
  HermesAdapter,
  NodeManagerAdapter,
} from './AimifierService';

// ---------------------------------------------------------------------------
// Helper: Generic command execution via Electron IPC
// Helper: Generic command execution via Electron IPC (stargate.aimify bridge)

async function aimifyExec(command: string, args: string[], options?: { cwd?: string; timeout?: number }): Promise<{ stdout: string; stderr: string; exitCode: number; success: boolean }> {
  const result = await (window as any).electronAPI.stargate.aimify.exec(command, args, options);
  return result;
}

async function aimifyWriteFile(filePath: string, content: string): Promise<void> {
  await (window as any).electronAPI.stargate.aimify.writeFile(filePath, content);
}

async function aimifyReadFile(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
  return (window as any).electronAPI.stargate.aimify.readFile(filePath);
}

// ---------------------------------------------------------------------------
// ElectronDockerAdapter
// ---------------------------------------------------------------------------

export class ElectronDockerAdapter implements DockerAdapter {
  async isAvailable(): Promise<boolean> {
    try {
      const { exitCode } = await aimifyExec('docker', ['version', '--format', '{{.Server.Version}}']);
      return exitCode === 0;
    } catch {
      return false;
    }
  }

  async *buildImage(contextPath: string, imageName: string, tag: string): AsyncGenerator<string, string, unknown> {
    const { stdout } = await aimifyExec('docker', [
      'build',
      '-t', `${imageName}:${tag}`,
      contextPath,
    ], { timeout: 600000 });
    const lines = stdout.split('\n');
    for (const line of lines) yield line;
    return stdout;
  }

  async *pushImage(imageName: string, tag: string): AsyncGenerator<string, string, unknown> {
    const { stdout } = await aimifyExec('docker', ['push', `${imageName}:${tag}`], { timeout: 300000 });
    const lines = stdout.split('\n');
    for (const line of lines) yield line;
    return stdout;
  }

  async runContainer(
    imageName: string,
    tag: string,
    port: number,
    env: Record<string, string>
  ): Promise<{ containerId: string; logs: string }> {
    const envArgs = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
    const { stdout, exitCode } = await aimifyExec('docker', [
      'run', '-d', '--rm',
      '-p', `${port}:${port}`,
      ...envArgs,
      `${imageName}:${tag}`,
    ]);
    if (exitCode !== 0) throw new Error(`docker run failed: ${stdout}`);
    const containerId = stdout.trim();
    return { containerId, logs: stdout };
  }

  async stopContainer(containerId: string): Promise<void> {
    await aimifyExec('docker', ['stop', containerId], { timeout: 30000 });
  }

  async testEndpoint(url: string, method: string, body?: any, headers?: Record<string, string>): Promise<{ status: number; data: any }> {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }
    const resp = await fetch(url, fetchOptions);
    const data = await resp.json().catch(() => null);
    return { status: resp.status, data };
  }

  async inspectContainer(imageName: string): Promise<{ id: string; image: string; uptime?: string; health?: string; port: number } | null> {
    try {
      const { stdout, exitCode } = await aimifyExec('docker', [
        'ps',
        '--filter', `ancestor=${imageName}`,
        '--format', '{{.ID}}|{{.Image}}|{{.Status}}|{{.Ports}}',
        '-q',
      ]);
      if (exitCode !== 0 || !stdout.trim()) return null;
      const parts = stdout.trim().split('\n')[0].split('|');
      if (parts.length < 4) return null;
      const id = parts[0];
      const image = parts[1];
      const uptime = parts[2];
      const ports = parts[3];
      // Extract mapped port from "0.0.0.0:9000->4000/tcp"
      const portMatch = ports.match(/0\.0\.0\.0:(\d+)->\d+/);
      const port = portMatch ? parseInt(portMatch[1], 10) : 0;
      return { id, image, uptime, health: 'running', port };
    } catch {
      return null;
    }
  }

  async getLocalImageInfo(imageName: string, tag: string): Promise<{ digest?: string; created?: string } | null> {
    try {
      const { stdout, exitCode } = await aimifyExec('docker', [
        'images',
        '--format', '{{.ID}}|{{.CreatedAt}}',
        `${imageName}:${tag}`,
      ]);
      if (exitCode !== 0 || !stdout.trim()) return null;
      const parts = stdout.trim().split('|');
      return { digest: parts[0], created: parts[1] };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// ElectronAimPyGenAdapter
// ---------------------------------------------------------------------------

export class ElectronAimPyGenAdapter implements AimPyGenAdapter {
  private _aimPyGenPath: string;

  constructor(aimPyGenPath: string = '/tmp/aimifier-test') {
    this._aimPyGenPath = aimPyGenPath;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { exitCode } = await aimifyExec('python3', [`${this._aimPyGenPath}/generate.py`, '--help']);
      return exitCode === 0;
    } catch {
      return false;
    }
  }

  async generateConfig(agent: any, projectDir: string): Promise<{ configPath: string }> {
    // Write config.yml
    const configYml = this._buildConfigYml(agent);
    await aimifyWriteFile(`${projectDir}/config.yml`, configYml);

    // Write mosaic_hermes_wrapper.py
    const wrapperPy = this._buildWrapperPy(agent);
    await aimifyWriteFile(`${projectDir}/mosaic_hermes_wrapper.py`, wrapperPy);

    // Write manifest.json
    const manifest = this._buildManifest(agent);
    await aimifyWriteFile(`${projectDir}/manifest.json`, JSON.stringify(manifest, null, 2));

    return { configPath: `${projectDir}/config.yml` };
  }

  async *generateCode(projectName: string, projectDir: string): AsyncGenerator<string, string, unknown> {
    const { stdout, exitCode } = await aimifyExec(
      'python3',
      [`${this._aimPyGenPath}/generate.py`, projectName],
      { cwd: projectDir, timeout: 60000 }
    );
    if (exitCode !== 0) throw new Error(`generate.py failed: ${stdout}`);
    const lines = stdout.split('\n');
    for (const line of lines) yield line;
    return stdout;
  }

  async fixGeneratedCode(projectDir: string): Promise<void> {
    // Fix 1: Replace generated main.py with canonical version
    const mainPy = this._buildMainPy();
    await aimifyWriteFile(`${projectDir}/app/main.py`, mainPy);

    // Fix 2: Copy wrapper into app/
    const wrapperRes = await aimifyReadFile(`${projectDir}/mosaic_hermes_wrapper.py`);
    const wrapperContent = wrapperRes.success ? wrapperRes.content || '' : '';
    await aimifyWriteFile(`${projectDir}/app/mosaic_hermes_wrapper.py`, wrapperContent);

    // Fix 3: Create minimal requirements.txt
    const reqs = this._buildRequirementsTxt();
    await aimifyWriteFile(`${projectDir}/requirements.txt`, reqs);

    // Fix 4: Create .dockerignore
    const dockerignore = this._buildDockerignore();
    await aimifyWriteFile(`${projectDir}/.dockerignore`, dockerignore);

    // Fix 5: Copy Dockerfile from canonical reference
    const dockerfile = this._buildDockerfile();
    await aimifyWriteFile(`${projectDir}/Dockerfile`, dockerfile);
  }

  async validateSpec(projectDir: string): Promise<{ passed: number; warnings: number; errors: number }> {
    // ensure validate_spec.py exists
    const validatorRes = await aimifyReadFile(`${projectDir}/validate_spec.py`);
    if (!validatorRes.success) {
      return { passed: 0, warnings: 0, errors: 1 };
    }

    const { stdout, exitCode } = await aimifyExec(
      'python3',
      [`${projectDir}/validate_spec.py`],
      { cwd: projectDir, timeout: 30000 }
    );
    if (exitCode !== 0) {
      const match = stdout.match(/Errors:\s*(\d+)/);
      const errors = match ? parseInt(match[1], 10) : 1;
      return { passed: 0, warnings: 0, errors };
    }
    const passed = (stdout.match(/\[PASS\]/g) || []).length;
    const warnings = (stdout.match(/\[WARN\]/g) || []).length;
    const errors = (stdout.match(/\[FAIL\]/g) || []).length;
    return { passed, warnings, errors };
  }

  // -------------------------------------------------------------------------
  // Private: Template Builders (canonical reference implementation)
  // -------------------------------------------------------------------------
  private _buildConfigYml(agent: any): string {
    return `project_name: ${agent.id}-aim
project_name_camelcase: ${this._toCamelCase(agent.id)}Aim
project_description: Hermes agent ${agent.name} as HyperCycle AIM
project_port: '4000'
model_name: hermes
model_module: mosaic_hermes_wrapper
model_object: HermesAIMWrapper
model_object_args: base_url, model
endpoints:
  - name: Chat
    uri: /chat
    input_method: POST
    request_parameters:
      - name: message
        shim: text
      - name: system_prompt
        shim: text
    output:
      name: response
      shim: text
`;
  }

  private _buildWrapperPy(agent: any): string {
    return `import json
import os
import sys
import logging

HERMES_SRC = os.environ.get("HERMES_SRC", "/opt/hermes-agent")
if HERMES_SRC not in sys.path:
    sys.path.insert(0, HERMES_SRC)

from run_agent import AIAgent

class HermesAIMWrapper:
    def __init__(self, base_url=None, model=None, port=None):
        self.model_name = (model or os.environ.get("HERMES_MODEL", "${agent.model || 'kimi-k2.6'}")).strip()
        self.base_url = (base_url or os.environ.get("HERMES_BASE_URL", "")).strip() or None
        self.api_key = (os.environ.get("HERMES_API_KEY", "")).strip() or None
        self.provider = (os.environ.get("HERMES_PROVIDER", "")).strip() or None
        self.port = int(port or os.environ.get("PORT", "4000"))
        hermes_home = os.environ.get("HERMES_HOME", "/tmp/.hermes")
        for sub in ["", "sessions", "logs", "skills", "memories"]:
            os.makedirs(os.path.join(hermes_home, sub), exist_ok=True)
        agent_kwargs = {
            "model": self.model_name,
            "base_url": self.base_url,
            "api_key": self.api_key,
            "provider": self.provider if self.provider else None,
            "enabled_toolsets": [
                "terminal", "file", "code_execution", "web", "search",
                "browser", "vision", "skills", "memory", "session_search",
                "delegation", "cronjob", "clarify", "todo",
            ],
            "quiet_mode": True,
            "save_trajectories": False,
            "max_iterations": 30,
            "platform": "api",
            "skip_context_files": True,
            "skip_memory": True,
        }
        try:
            self.agent = AIAgent(**agent_kwargs)
            self._agent_ready = True
        except Exception as e:
            self._agent_ready = False
            self._init_error = str(e)

    def chat(self, message, system_prompt=""):
        if not self._agent_ready:
            return f"Agent initialization failed: {self._init_error}", 1
        try:
            response = self.agent.chat(message)
            cost = len(response.split())
            return response, cost
        except Exception as e:
            return f"Error: {e}", 1

    def health(self):
        status = {
            "status": "ok" if self._agent_ready else "error",
            "model": self.model_name,
            "provider": self.provider or "auto",
            "agent_ready": self._agent_ready,
            "aim_type": "real_embedded_hermes",
            "aim_version": "2.0.0",
            "mosaic_aim": True,
        }
        if not self._agent_ready:
            status["error"] = self._init_error
        return json.dumps(status), 1

    def capabilities(self):
        caps = json.dumps({
            "capabilities": ["chat", "completion", "tool_use", "analysis", "agentic_reasoning"],
            "models": [self.model_name],
            "max_tokens": 64000,
            "supports_streaming": False,
            "supports_tools": True,
            "supports_system_prompt": True,
            "supports_memory": False,
            "mosaic_aim_version": "2.0.0",
            "mosaic_aim_type": "real_embedded_hermes",
        })
        return caps, 1
`;
  }

 private _buildManifest(agent: any): object {
   return {
     name: `${this._toCamelCase(agent.id)}Aim`,
     short_name: 'hermes',
     version: '1.0.0',
     documentation_url: 'https://github.com/YOUR_GITHUB_USERNAME/mosaic-companion',
     license: 'Open',
     terms_of_service: 'https://example.com/tos',
     endpoints: [
       {
         uri: '/chat',
          methods: ['POST'],
         is_public: true,
         documentation: 'Hermes agent chat endpoint',
       },
       {
         uri: '/health',
          methods: ['GET'],
         is_public: true,
         documentation: 'Health check',
       },
       {
         uri: '/capabilities',
          methods: ['GET'],
         is_public: true,
         documentation: 'Capabilities metadata',
       },
        {
          uri: '/costs',
          methods: ['GET'],
          is_public: true,
          documentation: 'Economic routing: cost structure for Node Manager',
        },
        {
          uri: '/',
          methods: ['GET'],
          is_public: true,
          documentation: 'Dashboard root with AIM status, links, config display',
        },
     ],
     mosaic_aim: {
       aim_type: 'hermes_bridge',
       aim_version: '1.0.0',
       hermes_spec_version: '1.0.0',
       capabilities: ['chat', 'completion', 'tool_use', 'analysis'],
       models: [agent.model || 'kimi-k2.6'],
       max_tokens: 4096,
       supports_streaming: false,
       supports_tools: true,
       supports_system_prompt: true,
       supports_memory: false,
       gpu_required: false,
       gpu_memory_gb: 0,
       cost_model: 'per_token',
     },
   };
 }

  private _buildMainPy(): string {
    // Canonical main.py from reference implementation
    return `import os
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
        model = os.environ.get("HERMES_MODEL", "kimi-k2.6")
        self.model = HermesAIMWrapper(base_url, model)
        self.manifest = BASE_MANIFEST.copy()

    @aim_uri(uri="/manifest.json", methods=["GET"], endpoint_manifest={"documentation": "Returns AIM manifest"})
    async def Manifest(self, request):
        costs = [{"currency": "ProcessingUnits", "min": 0, "max": 0, "estimated_cost": 0}]
        if request.headers.get("cost_only"):
            return JSONResponseCORS({"costs": costs})
        costs[0]["used"] = 1
        return JSONResponseCORS(self.manifest, costs=costs)

    @aim_uri(uri="/chat", methods=["POST"], endpoint_manifest={"documentation": "Hermes agent chat"})
    async def Chat(self, request):
        body = await request.json()
        message = body.get("message", "")
        system_prompt = body.get("system_prompt", "")
        costs = [{"currency": "ProcessingUnits", "min": 0, "max": 0, "estimated_cost": 0}]
        if request.headers.get("cost_only"):
            costs[0]["estimated_cost"] = len(message.split()) * 2
            return JSONResponseCORS({"costs": costs})
        response, cost = self.model.chat(message, system_prompt)
        costs[0]["estimated_cost"] = max(costs[0]["estimated_cost"], cost)
        costs[0]["used"] = cost
        return JSONResponseCORS({"response": response, "model": self.model.model}, costs=costs)

    @aim_uri(uri="/health", methods=["GET"], endpoint_manifest={"documentation": "Health check"})
    async def Health(self, request):
        costs = [{"currency": "ProcessingUnits", "min": 0, "max": 0, "estimated_cost": 0}]
        if request.headers.get("cost_only"):
            return JSONResponseCORS({"costs": costs})
        response, cost = self.model.health()
        costs[0]["used"] = cost
        return JSONResponseCORS({"status": json.loads(response)}, costs=costs)

    @aim_uri(uri="/capabilities", methods=["GET"], endpoint_manifest={"documentation": "Capabilities"})
    async def Capabilities(self, request):
        costs = [{"currency": "ProcessingUnits", "min": 0, "max": 0, "estimated_cost": 0}]
        if request.headers.get("cost_only"):
            return JSONResponseCORS({"costs": costs})
        response, cost = self.model.capabilities()
        costs[0]["used"] = cost
        return JSONResponseCORS({"capabilities": json.loads(response)}, costs=costs)

def main():
    app = MosaicHermesAim()
    app.run(uvicorn_kwargs={"port": PORT, "host": "0.0.0.0"})

if __name__ == "__main__":
    main()
`;
  }

  private _buildRequirementsTxt(): string {
    return `starlette<0.30
uvicorn<0.30
anyio<4
httptools
click
h11
python-dotenv
filelock
pyyaml
markupsafe
websockets
requests
urllib3
certifi
charset-normalizer
idna
-e ./pyhypercycle-aim/
`;
  }

  private _buildDockerignore(): string {
    return `__pycache__
*.pyc
*.pyo
*.pyd
.Python
.git
.pytest_cache
*.egg-info
dist
build
.tox
.mypy_cache
.coverage
*.so
*.egg
*.env
.env.*
secrets/
`;
  }

  private _buildDockerfile(): string {
    return `FROM python:3.11-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DEBIAN_FRONTEND=noninteractive

LABEL GPUS=0 GPU_MEMORY=0GB
LABEL maintainer="Mosaic HyperCycle"
LABEL description="Real embedded Hermes AIAgent as HyperCycle AIM v2.0.0"
LABEL version="2.0.0"

# 1. System deps
RUN apt-get update && apt-get install -y --no-install-recommends \\
    git curl ca-certificates build-essential \\
    && rm -rf /var/lib/apt/lists/*

# 2. Clone real hermes-agent from GitHub
RUN git clone --depth 1 https://github.com/NousResearch/hermes-agent.git /opt/hermes-agent \\
    && echo "Hermes clone OK"

# 3. Copy local pyhypercycle_aim
COPY pyhypercycle-aim /opt/pyhypercycle-aim

# 4. Create virtualenv
RUN python3 -m venv /opt/hermes-agent/venv
ENV PATH="/opt/hermes-agent/venv/bin:$PATH"

# 5. Install base deps
RUN pip install --no-cache-dir \\
    starlette==0.29.0 uvicorn==0.29.0 anyio==3.7.1 \\
    httptools click h11 python-dotenv filelock pyyaml \\
    markupsafe websockets requests==2.33.0 urllib3 certifi \\
    charset-normalizer idna web3 websocket-client

# 6. Install hermes-agent core deps
RUN pip install --no-cache-dir \\
    openai==2.24.0 fire==0.7.1 httpx[socks]==0.28.1 \\
    rich==14.3.3 tenacity==9.1.4 ruamel.yaml==0.18.17 \\
    jinja2==3.1.6 pydantic==2.13.4 prompt_toolkit==3.0.52

# 7. Install pyhypercycle_aim
WORKDIR /opt/pyhypercycle-aim
RUN pip install --no-cache-dir -e .

# 8. Copy AIM files into /app
WORKDIR /app
COPY app/ /app/
COPY manifest.json /app/manifest.json
COPY mosaic_hermes_wrapper.py /app/mosaic_hermes_wrapper.py
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

# 9. Fix /container_mount
RUN mkdir -p /container_mount/virtual_disks /container_mount/disk_mounts \\
    && chmod -R 777 /container_mount

# 10. Runtime env
ENV HERMES_SRC=/opt/hermes-agent
ENV HERMES_HOME=/tmp/.hermes
ENV PORT=4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=3 \\
    CMD python3 -c "from mosaic_hermes_wrapper import HermesAIMWrapper; w=HermesAIMWrapper(); s,c=w.health(); print(s)"

EXPOSE 4000

CMD ["python3", "/app/main.py"]
`;
  }

  private _toCamelCase(str: string): string {
    return str.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  }
}

// ---------------------------------------------------------------------------
// ElectronHermesAdapter
// ---------------------------------------------------------------------------

export class ElectronHermesAdapter implements HermesAdapter {
  async checkHealth(baseUrl: string): Promise<{ healthy: boolean; status: any }> {
    try {
      const resp = await fetch(`${baseUrl}/health`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      const data = await resp.json();
      const healthy = resp.status === 200 && data?.status === 'healthy';
      return { healthy, status: data };
    } catch (e: any) {
      return { healthy: false, status: { error: e.message } };
    }
  }

  async chat(baseUrl: string, message: string, systemPrompt?: string): Promise<{ response: string; cost: number }> {
    // Fix: ensure api.ollama.com is used
    const fixedBaseUrl = baseUrl.replace('https://ollama.com', 'https://api.ollama.com');
    const resp = await fetch(`${fixedBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kimi-k2.6',
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: message },
        ],
        stream: false,
        max_tokens: 4096,
      }),
    });
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { response: content, cost: content.split(/\s+/).length };
  }
}

// ---------------------------------------------------------------------------
// ElectronNodeManagerAdapter
// ---------------------------------------------------------------------------

export class ElectronNodeManagerAdapter implements NodeManagerAdapter {
  async registerAIM(nodeUrl: string, manifest: any, imageTag: string): Promise<{ success: boolean; aimIndex?: number; error?: string }> {
    try {
      // FIXED: Use Node Manager API port 8000, not Admin UI port 8006
      const apiUrl = `${nodeUrl}:8000`;
      const resp = await fetch(`${apiUrl}/api/add_aim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: imageTag, tag: imageTag, port: manifest?.project_port || 4000, environment: manifest?.environment || {} }),
      });
      const data = await resp.json();
      if (resp.ok) {
        return { success: true, aimIndex: data.slot || data.aim_index || data.index };
      }
      return { success: false, error: data.error || `HTTP ${resp.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async verifyAIM(nodeUrl: string, aimIndex: number, manifest?: any): Promise<{ running: boolean; health?: any }> {
    try {
      // FIXED: Use the port from manifest or default to 9000 (configurable)
      const aimPort = manifest?.project_port || 9000;
      const resp = await fetch(`http://localhost:${aimPort}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await resp.json();
      return { running: resp.status === 200, health: data };
    } catch (e: any) {
      return { running: false };
    }
  }

  // NEW: Query Node Manager info endpoint
  async queryNodeInfo(nodeUrl: string): Promise<{ ok: boolean; name?: string; aims?: any[]; error?: string }> {
    try {
      const apiUrl = `${nodeUrl}:8000`;
      const resp = await fetch(`${apiUrl}/info`, { method: 'GET' });
      if (resp.ok) {
        const data = await resp.json();
        return {
          ok: true,
          name: data.name,
          aims: data.aim?.aims || [],
        };
      }
      return { ok: false, error: `HTTP ${resp.status}` };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  // NEW: Query local Docker registry for image tag info
  async queryRegistry(tag: string): Promise<{ ok: boolean; digest?: string; tags?: string[]; error?: string }> {
    try {
      // Parse "name:tag" format
      const [imageName, imageTag = 'latest'] = tag.split(':') as [string, string];
      const resp = await fetch(`http://localhost:5000/v2/${imageName}/tags/list`);
      if (resp.ok) {
        const data = await resp.json();
        const tags: string[] = data.tags || [];
        return {
          ok: tags.includes(imageTag),
          tags,
        };
      }
      return { ok: false, error: `HTTP ${resp.status}` };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }
}

// ---------------------------------------------------------------------------
// Adapter Factory
// ---------------------------------------------------------------------------

export function createDefaultAdapters(aimPyGenPath?: string) {
  return {
    docker: new ElectronDockerAdapter(),
    aimPyGen: new ElectronAimPyGenAdapter(aimPyGenPath),
    hermes: new ElectronHermesAdapter(),
    nodeManager: new ElectronNodeManagerAdapter(),
  };
}
