// =============================================================================
// AIM FORGE SERVICE — Guided AIM Builder + Generator + Deploy Orchestrator
// Turns a user-filled tree into real aim-py-gen compatible project files.
// =============================================================================

import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Types — AIM Forge Data Model
// ---------------------------------------------------------------------------

export interface AIMForgeEndpoint {
  id: string;
  name: string;
  uri: string;
  method: 'POST' | 'GET';
  isPublic: boolean;
  doc: string;
  inputs: AIMForgeInput[];
  output: AIMForgeOutput;
}

export interface AIMForgeInput {
  id: string;
  name: string;
  shim: string;
  label: string;
  testValue: string;
  testShim: string;
}

export interface AIMForgeOutput {
  name: string;
  shim: string;
  label: string;
  testValue: string;
  testShim: string;
}

export interface AIMForgeContainerConfig {
  baseImage: string;
  exposePort: number;
  envVars: Record<string, string>;
  persistDirectory: string;
}

export interface AIMForgeManifest {
  name: string;
  version: string;
  description: string;
  license: string;
  docUrl: string;
  estimatedCostPerCall: number;
  estimatedCostToken: string;
}

export interface AIMForgeProject {
  projectName: string;
  description: string;
  version: string;
  port: number;
  modelType: 'generic' | 'hermes';
  // Generic model fields
  modelName?: string;        // pip package name
  modelModule?: string;      // python module
  modelObject?: string;      // class name
  modelObjectArgs?: string;  // python tuple/dict literal
  modelDocUrl?: string;
  // Hermes-specific fields
  hermesModel?: string;
  hermesProvider?: string;
  hermesBaseUrl?: string;
  hermesApiKey?: string;
  endpoints: AIMForgeEndpoint[];
  container: AIMForgeContainerConfig;
  manifest: AIMForgeManifest;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface AIMForgeGenerationResult {
  success: boolean;
  files: GeneratedFile[];
  projectDir: string;
  error?: string;
}

export interface AIMForgeBuildResult {
  success: boolean;
  imageTag?: string;
  containerId?: string;
  logs: string[];
  error?: string;
}

export interface AIMForgeDeployResult {
  success: boolean;
  slot?: number;
  nodeUrl?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Shim Catalog (subset of hypercycle-aimifier skill)
// ---------------------------------------------------------------------------

export const SHIM_CATALOG: { value: string; label: string; description: string }[] = [
  { value: 'text', label: 'Text', description: 'Plain string pass-through' },
  { value: 'map.text', label: 'Map Text', description: 'Extract {"text": "..."} from dict' },
  { value: 'shims.file.file_to_text', label: 'File → Text', description: 'Read text file from path' },
  { value: 'shims.file.file_to_base64', label: 'File → Base64', description: 'Binary file to base64' },
  { value: 'shims.audio.base64_to_wav', label: 'Base64 → WAV', description: 'Decode audio from base64' },
  { value: 'shims.audio.wav_to_base64', label: 'WAV → Base64', description: 'Encode audio to base64' },
  { value: 'shims.image.base64_to_jpg', label: 'Base64 → JPG', description: 'Decode image from base64' },
  { value: 'shims.text.text_and_cost', label: 'Text + Cost', description: 'Return (string, cost) tuple' },
];

// ---------------------------------------------------------------------------
// Default Templates
// ---------------------------------------------------------------------------

const DEFAULT_HERMES_WRAPPER_PY = `import json, logging, os, sys

# Auto-detect hermes-agent repo across known paths
HERMES_PATHS = [
    "/container_mount",
    "/opt/hermes-agent",
    "/hermes",
    "/home/mauricio/hermes",
]

HERMES_SRC = None
for p in HERMES_PATHS:
    if os.path.isdir(os.path.join(p, "hermes_tools")) or os.path.isfile(os.path.join(p, "run_agent.py")):
        HERMES_SRC = p
        break

if HERMES_SRC and HERMES_SRC not in sys.path:
    sys.path.insert(0, HERMES_SRC)

class HermesAIMWrapper:
    def __init__(self):
        self.model = os.environ.get("HERMES_MODEL", "kimi-k2.6")
        self.provider = os.environ.get("HERMES_PROVIDER", "ollama")
        self.base_url = os.environ.get("HERMES_BASE_URL") or None
        self.api_key = os.environ.get("HERMES_API_KEY") or None
        self._agent = None
        self._ready = False
        self._err = None

    def _ensure_agent(self):
        if self._ready or self._agent is not None:
            return
        os.makedirs("/tmp/.hermes", exist_ok=True)
        try:
            from run_agent import AIAgent
            self._agent = AIAgent(
                model=self.model,
                provider=self.provider,
                base_url=self.base_url,
                api_key=self.api_key,
                enabled_toolsets=["terminal","file","code_execution","web","search","browser","vision","skills"],
                quiet_mode=True,
                save_trajectories=False,
                max_iterations=30,
                platform="api",
                skip_context_files=True,
                skip_memory=True,
            )
            # Fix Ollama base_url override inside container
            if self.provider == "ollama" and self.base_url:
                try:
                    self._agent.client.base_url = self.base_url
                except Exception:
                    pass
            self._ready = True
        except Exception as e:
            self._err = str(e)

    def chat(self, message, system_prompt=""):
        self._ensure_agent()
        if not self._ready:
            return f"Agent init failed: {self._err}", 1
        response = self._agent.chat(message)
        return response, len(response.split())

    def health(self):
        status = {
            "status": "ok",
            "model": self.model,
            "agent_ready": self._ready,
            "aim_type": "real_embedded_hermes",
            "aim_version": "2.0.0",
        }
        if not self._ready and self._err:
            status["status"] = "error"
            status["error"] = self._err
        return json.dumps(status), 1

    def capabilities(self):
        caps = {
            "capabilities": ["chat","completion","tool_use","analysis","agentic_reasoning"],
            "models": [self.model],
            "max_tokens": 64000,
            "supports_tools": True,
            "supports_streaming": False,
            "mosaic_aim_version": "2.0.0",
        }
        return json.dumps(caps), 1

    def costs(self):
        return json.dumps({
            "costs": [{"endpoint": "/chat", "estimated_cost": 1.0}]
        }), 1
`;

const DEFAULT_MAIN_PY_HERMES = `import os, sys
from pyhypercycle_aim import JSONResponseCORS, SimpleQueue, aim_uri
from mosaic_hermes_wrapper import HermesAIMWrapper

class MosaicHermesAIM(SimpleQueue):
    def __init__(self):
        super().__init__()
        self.wrapper = HermesAIMWrapper()

    @aim_uri("/health", "GET", is_public=True)
    async def health(self, request):
        return JSONResponseCORS(self.wrapper.health()[0])

    @aim_uri("/chat", "POST", is_public=True)
    async def chat(self, request):
        data = await request.json()
        msg = data.get("message", "")
        sys = data.get("system_prompt", "")
        resp, cost = self.wrapper.chat(msg, sys)
        return JSONResponseCORS({"response": resp, "cost": cost, "model": self.wrapper.model})

    @aim_uri("/capabilities", "GET", is_public=True)
    async def capabilities(self, request):
        return JSONResponseCORS(self.wrapper.capabilities()[0])

    @aim_uri("/costs", "GET", is_public=True)
    async def costs(self, request):
        return JSONResponseCORS(self.wrapper.costs()[0])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "4000")))
`;

// ---------------------------------------------------------------------------
// Service Implementation
// ---------------------------------------------------------------------------

export class AIMForgeService extends EventEmitter {
  private _currentProject: AIMForgeProject | null = null;

  // -------------------------------------------------------------------------
  // Project Lifecycle
  // -------------------------------------------------------------------------

  createDefaultProject(name: string): AIMForgeProject {
    const project: AIMForgeProject = {
      projectName: this._validateName(name),
      description: `HyperCycle AIM module: ${name}`,
      version: '1.0.0',
      port: 4000,
      modelType: 'generic',
      modelName: 'transformers',
      modelModule: 'transformers',
      modelObject: 'AutoModelForCausalLM',
      modelObjectArgs: '("gpt2")',
      modelDocUrl: 'https://huggingface.co/gpt2',
      endpoints: [
        {
          id: crypto.randomUUID(),
          name: 'Generate',
          uri: '/generate',
          method: 'POST',
          isPublic: true,
          doc: 'Generate text from a prompt',
          inputs: [
            { id: crypto.randomUUID(), name: 'prompt', shim: 'text', label: 'Input prompt', testValue: '"Hello world"', testShim: 'text' }
          ],
          output: { name: 'result', shim: 'text', label: 'Generated text', testValue: '', testShim: 'text' }
        }
      ],
      container: {
        baseImage: 'python:3.11-slim-bookworm',
        exposePort: 4000,
        envVars: {},
        persistDirectory: '/container_mount',
      },
      manifest: {
        name: this._validateName(name),
        version: '1.0.0',
        description: `HyperCycle AIM module: ${name}`,
        license: 'MIT',
        docUrl: '',
        estimatedCostPerCall: 0.01,
        estimatedCostToken: 'ProcessingUnits',
      }
    };
    this._currentProject = project;
    return project;
  }

  createHermesProject(name: string, model: string = 'kimi-k2.6', provider: string = 'ollama'): AIMForgeProject {
    const project: AIMForgeProject = {
      projectName: this._validateName(name),
      description: `Hermes Agent AIM: ${name}`,
      version: '2.0.0',
      port: 4000,
      modelType: 'hermes',
      hermesModel: model,
      hermesProvider: provider,
      hermesBaseUrl: provider === 'ollama' ? 'http://172.17.0.1:11434' : '',
      hermesApiKey: '',
      endpoints: [
        {
          id: crypto.randomUUID(),
          name: 'Chat',
          uri: '/chat',
          method: 'POST',
          isPublic: true,
          doc: 'Chat with the embedded Hermes AI agent',
          inputs: [
            { id: crypto.randomUUID(), name: 'message', shim: 'text', label: 'User message', testValue: '"Hello"', testShim: 'text' },
            { id: crypto.randomUUID(), name: 'system_prompt', shim: 'text', label: 'System prompt (optional)', testValue: '""', testShim: 'text' }
          ],
          output: { name: 'response', shim: 'shims.text.text_and_cost', label: 'Agent response', testValue: '', testShim: 'shims.text.text_and_cost' }
        }
      ],
      container: {
        baseImage: 'python:3.11-slim-bookworm',
        exposePort: 4000,
        envVars: {
          HERMES_MODEL: model,
          HERMES_PROVIDER: provider,
          HERMES_BASE_URL: provider === 'ollama' ? 'http://172.17.0.1:11434' : '',
          PYTHONPATH: '/opt/hermes-agent',
          PORT: '4000',
        },
        persistDirectory: '/container_mount',
      },
      manifest: {
        name: this._validateName(name),
        version: '2.0.0',
        description: `Embedded Hermes AI Agent AIM: ${name}`,
        license: 'MIT',
        docUrl: 'https://github.com/NousResearch/hermes-agent',
        estimatedCostPerCall: 0.02,
        estimatedCostToken: 'ProcessingUnits',
      }
    };
    this._currentProject = project;
    return project;
  }

  getCurrentProject(): AIMForgeProject | null {
    return this._currentProject;
  }

  updateProject(project: AIMForgeProject): void {
    this._currentProject = project;
  }

  // -------------------------------------------------------------------------
  // File Generation
  // -------------------------------------------------------------------------

  async generateFiles(project: AIMForgeProject): Promise<AIMForgeGenerationResult> {
    try {
      const files: GeneratedFile[] = [];

      if (project.modelType === 'hermes') {
        files.push(...this._generateHermesFiles(project));
      } else {
        files.push(...this._generateGenericFiles(project));
      }

      // Validate project name ends with -aim
      const name = project.projectName;
      if (!name.endsWith('-aim')) {
        return { success: false, files: [], projectDir: '', error: 'Project name must end with -aim' };
      }

      // All projects get these supporting files
      files.push(this._generateRequirementsTxt(project));
      files.push(this._generateDockerfile(project));
      files.push(this._generateManifestJson(project));
      files.push(this._generateTestPy(project));

      // Compute project directory (will be set properly by IPC handler)
      const projectDir = `projects/${name}`;

      return { success: true, files, projectDir };
    } catch (err: any) {
      return { success: false, files: [], projectDir: '', error: err.message || String(err) };
    }
  }

  // -------------------------------------------------------------------------
  // IPC Helpers — these call Electron main via the preload bridge
  // -------------------------------------------------------------------------

  async writeProjectToDisk(projectDir: string, files: GeneratedFile[]): Promise<{ success: boolean; error?: string }> {
    const api = (window as any).electronAPI;
    if (!api?.stargate?.aimify?.writeFile) {
      return { success: false, error: 'AIM Forge IPC not available — is preload.ts updated?' };
    }

    for (const file of files) {
      const fullPath = `${projectDir}/${file.path}`;
      const result = await api.stargate.aimify.writeFile(fullPath, file.content);
      if (!result.success) {
        return { success: false, error: `Failed to write ${file.path}: ${result.error}` };
      }
    }
    return { success: true };
  }

  async pickDirectory(): Promise<string | null> {
    const api = (window as any).electronAPI;
    if (!api?.dialog?.openDirectory) {
      return null;
    }
    return api.dialog.openDirectory();
  }

  async buildDocker(projectDir: string, imageName: string, tag: string): Promise<AIMForgeBuildResult> {
    const api = (window as any).electronAPI;
    if (!api?.stargate?.aimify?.exec) {
      return { success: false, logs: [], error: 'AIM Forge exec IPC not available' };
    }

    const result = await api.stargate.aimify.exec('docker', ['build', '-t', `${imageName}:${tag}`, '.'], {
      cwd: projectDir,
      timeout: 300000,
    });

    const logs = (result.stdout || '').split('\n').filter(Boolean);
    if (!result.success) {
      logs.push(...(result.stderr || '').split('\n').filter(Boolean));
      return { success: false, logs, error: `Docker build failed with exit code ${result.exitCode}` };
    }

    return { success: true, imageTag: `${imageName}:${tag}`, logs };
  }

  async deployToNode(nodeUrl: string, manifest: any, imageTag: string): Promise<AIMForgeDeployResult> {
    const api = (window as any).electronAPI;
    if (!api?.stargate?.registerAIM) {
      return { success: false, error: 'stargate:registerAIM IPC not available' };
    }

    const result = await api.stargate.registerAIM({
      nodeUrl,
      manifest,
      imageTag,
    });

    if (result?.success) {
      return { success: true, slot: result.aimIndex, nodeUrl };
    }
    return { success: false, error: result?.error || 'Node registration failed' };
  }

  // -------------------------------------------------------------------------
  // Private Generators
  // -------------------------------------------------------------------------

  private _generateGenericFiles(project: AIMForgeProject): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    // config.yml
    const configYaml = this._buildConfigYaml(project);
    files.push({ path: 'config.yml', content: configYaml });

    // app/main.py (placeholder — would need aim-py-gen invocation in real usage)
    // For the guided builder, we generate a basic Uvicorn scaffold
    const mainPy = this._buildGenericMainPy(project);
    files.push({ path: 'app/main.py', content: mainPy });

    return files;
  }

  private _generateHermesFiles(project: AIMForgeProject): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    // Hermes wrapper
    files.push({ path: 'app/mosaic_hermes_wrapper.py', content: DEFAULT_HERMES_WRAPPER_PY });

    // main.py
    files.push({ path: 'app/main.py', content: DEFAULT_MAIN_PY_HERMES });

    // config.yml (metadata for reference even in Hermes mode)
    const configYaml = this._buildConfigYaml(project);
    files.push({ path: 'config.yml', content: configYaml });

    return files;
  }

  private _buildConfigYaml(project: AIMForgeProject): string {
    const epLines = project.endpoints.map(ep => {
      const params = ep.inputs.map(p => `      - name: ${p.name}\n        shim: ${p.shim}\n        label: "${p.label}"\n        test: '${p.testValue}'\n        test_shim: ${p.testShim}`).join('\n');
      return `  - name: ${ep.name}\n    uri: ${ep.uri}\n    input_method: ${ep.method}\n    is_public: "${ep.isPublic ? 'y' : 'n'}"\n    method: ${ep.name.toLowerCase().replace(/\s+/g, '_')}\n    request_parameters:\n${params}\n    output:\n      name: ${ep.output.name}\n      shim: ${ep.output.shim}\n      label: "${ep.output.label}"\n      test: "${ep.output.testValue}"\n      test_shim: ${ep.output.testShim}\n    documentation: ${ep.doc}`;
    }).join('\n');

    return `project_name: ${project.projectName}
project_description: ${project.description}
project_port: "${project.port}"
${project.modelType === 'generic' ? `model_name: ${project.modelName}
model_module: ${project.modelModule}
model_object: ${project.modelObject}
model_object_args: ${project.modelObjectArgs}
doc_url: ${project.modelDocUrl || ''}` : 'model_name: hermes-agent\nmodel_module: mosaic_hermes_wrapper\nmodel_object: HermesAIMWrapper\nmodel_object_args: ()\ndoc_url: https://github.com/NousResearch/hermes-agent'}
endpoints:
${epLines}
`;
  }

  private _buildGenericMainPy(project: AIMForgeProject): string {
    const endpointHandlers = project.endpoints.map(ep => {
      const inputReads = ep.inputs.map(inp => `        ${inp.name} = data.get("${inp.name}", "")`).join('\n');
      return `
    @aim_uri("${ep.uri}", "${ep.method}", is_public=${ep.isPublic})
    async def ${ep.name.toLowerCase().replace(/\s+/g, '_')}(self, request):
        data = await request.json() if request.method == "POST" else dict(request.query_params)
${inputReads}
        # TODO: invoke model here
        result = f"Echo: {${ep.inputs[0]?.name || 'input'}}"
        cost = len(result.split())
        return JSONResponseCORS({"result": result, "cost": cost})
`;
    }).join('\n');

    return `from pyhypercycle_aim import JSONResponseCORS, SimpleQueue, aim_uri

class ${this._toClassName(project.projectName)}(SimpleQueue):
    def __init__(self):
        super().__init__()
        # TODO: initialize model here
${endpointHandlers}

if __name__ == "__main__":
    import uvicorn, os
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "${project.port}")))
`;
  }

  private _generateRequirementsTxt(project: AIMForgeProject): GeneratedFile {
    const lines: string[] = [];
    if (project.modelType === 'generic') {
      lines.push(project.modelName || 'transformers');
      lines.push('torch', 'accelerate', 'protobuf', 'scipy');
    }
    lines.push('pyhypercycle_aim');
    lines.push('starlette<0.30');
    lines.push('uvicorn<0.30');
    lines.push('anyio<4');
    if (project.modelType === 'hermes') {
      lines.push('httpx[socks]==0.28.1');
      lines.push('openai==2.24.0');
      lines.push('rich==14.3.3');
      lines.push('tenacity==9.1.4');
      lines.push('ruamel.yaml==0.18.17');
      lines.push('pydantic==2.13.4');
      lines.push('jinja2==3.1.6');
      lines.push('prompt_toolkit==3.0.52');
      lines.push('fire==0.7.1');
    }
    return { path: 'requirements.txt', content: lines.join('\n') + '\n' };
  }

  private _generateDockerfile(project: AIMForgeProject): GeneratedFile {
    const isHermes = project.modelType === 'hermes';
    const base = project.container.baseImage || 'python:3.11-slim-bookworm';
    const port = project.container.exposePort || project.port || 4000;

    let df = `FROM ${base}
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates build-essential \\
    && rm -rf /var/lib/apt/lists/*
`;

    if (isHermes) {
      df += `RUN git clone --depth 1 https://github.com/NousResearch/hermes-agent.git /opt/hermes-agent
`;
    }

    df += `RUN pip install --no-cache-dir starlette==0.29.0 uvicorn==0.29.0 anyio==3.7.1 \\
    httptools click h11 python-dotenv filelock pyyaml markupsafe websockets \\
    requests==2.33.0 urllib3 certifi charset-normalizer idna web3 websocket-client
`;

    if (isHermes) {
      df += `RUN pip install --no-cache-dir openai==2.24.0 fire==0.7.1 httpx[socks]==0.28.1 \\
    rich==14.3.3 tenacity==9.1.4 ruamel.yaml==0.18.17 jinja2==3.1.6 \\
    pydantic==2.13.4 prompt_toolkit==3.0.52
`;
    }

    df += `RUN mkdir -p /container_mount/virtual_disks /container_mount/disk_mounts && chmod -R 777 /container_mount
WORKDIR /app
COPY app/ /app/
COPY requirements.txt /app/requirements.txt
COPY manifest.json /app/manifest.json
RUN pip install --no-cache-dir -r requirements.txt
`;

    if (isHermes) {
      df += `ENV HERMES_SRC=/opt/hermes-agent PYTHONPATH=/opt/hermes-agent HERMES_HOME=/tmp/.hermes
`;
    }

    df += `ENV PORT=${port}
EXPOSE ${port}
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=3 \\
    CMD curl -f http://localhost:${port}/health || exit 1
CMD ["python3", "/app/main.py"]
`;

    return { path: 'Dockerfile', content: df };
  }

  private _generateManifestJson(project: AIMForgeProject): GeneratedFile {
    const endpoints = project.endpoints.map(ep => ({
      name: ep.name,
      uri: ep.uri,
      methods: [ep.method],  // NOTE: "methods" not "input_methods" — Node Manager expects this
      is_public: ep.isPublic,
      documentation: ep.doc,
      input_parameters: ep.inputs.map(i => ({
        name: i.name,
        shim: i.shim,
        label: i.label,
        test: i.testValue,
        test_shim: i.testShim,
      })),
      output: {
        name: ep.output.name,
        shim: ep.output.shim,
        label: ep.output.label,
        test: ep.output.testValue,
        test_shim: ep.output.testShim,
      }
    }));

    const manifest = {
      name: project.projectName,
      version: project.version,
      description: project.description,
      license: project.manifest.license,
      doc_url: project.manifest.docUrl,
      estimated_cost_per_call: project.manifest.estimatedCostPerCall,
      estimated_cost_token: project.manifest.estimatedCostToken,
      endpoints,
      // Hermes-specific metadata
      ...(project.modelType === 'hermes' ? {
        aim_type: 'real_embedded_hermes',
        mosaic_aim_version: '2.0.0',
        hermes_model: project.hermesModel,
        hermes_provider: project.hermesProvider,
      } : {})
    };

    return { path: 'manifest.json', content: JSON.stringify(manifest, null, 2) };
  }

  private _generateTestPy(project: AIMForgeProject): GeneratedFile {
    const baseUrl = `http://localhost:${project.port}`;
    const tests = project.endpoints.map(ep => `
def test_${ep.name.toLowerCase().replace(/\s+/g, '_')}():
    resp = requests.${ep.method.toLowerCase()}("${baseUrl}${ep.uri}", json={
        ${ep.inputs.map(i => `"${i.name}": ${i.testValue || '"test"'}`).join(',\n        ')}
    })
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "cost" in data
    print("OK", "${ep.uri}")
`).join('\n');

    const content = `import requests, sys
BASE = "${baseUrl}"
${tests}
if __name__ == "__main__":
    for name, fn in globals().items():
        if name.startswith("test_"):
            try:
                fn()
            except Exception as e:
                print("FAIL", name, e)
                sys.exit(1)
    print("All tests passed")
`;
    return { path: 'test.py', content };
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  private _validateName(name: string): string {
    const clean = name.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return clean.endsWith('-aim') ? clean : `${clean}-aim`;
  }

  private _toClassName(name: string): string {
    return name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  }
}

// Singleton export
export const aimForgeService = new AIMForgeService();
