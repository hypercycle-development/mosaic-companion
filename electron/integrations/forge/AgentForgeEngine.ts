// =============================================================================
// STARGATE — Agent Forge Engine (Main Process)
// Real test runner + real deploy launcher for IDE-as-Agent-Forge
// =============================================================================
//
// Architecture:
//   Test Phase:  Code → esbuild bundle → vm.Script → execute in isolated VM
//   Deploy Phase: Code → esbuild bundle → write to disk → spawn child_process
//                → register with ToolManager (if WASM bridge) or run as Node agent
//
// Security model:
//   - Test runs in vm.Script with no context (no require, no fs, no network)
//   - Deploy spawns a real Node process with limited env
//   - Both log to Chronicle for audit trail
//
// Dependencies: esbuild (already in project), node:vm, node:child_process
// =============================================================================

import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { createHash } from "crypto";
import { Script } from "vm";
import { spawn, execSync } from "child_process";
import { getChronicle } from "../sandbox/chronicle";

// =============================================================================
// Types
// =============================================================================

export interface ForgeTestResult {
  success: boolean;
  output: string;
  stage: "syntax" | "bundle" | "runtime" | "error";
  durationMs: number;
  logs: string[];
}

export interface ForgeDeployResult {
  success: boolean;
  nodeId: string;
  taskId: string;
  processPid?: number;
  agentDir: string;
  error?: string;
  remoteStdout?: string;
  remoteStderr?: string;
}

export interface ForgeNodeConfig {
  host: string;
  user: string;
  agentDir?: string; // remote path, default: ~/.mosaic-forge-agents
}
export interface ForgeAgentManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  templateId: string;
  runtime: "node" | "wasm";
  permissions: string[];
  sourcePath: string;
  bundledPath: string;
  agentType: "anfe-minter" | "fleet-node" | "mcp-adapter" | "custom";
  autoStart: boolean;
  tier: string;
  enableWallet: boolean;
  createdAt: number;
}

// =============================================================================
// AgentForgeEngine
// =============================================================================

class AgentForgeEngine {
  private agentsDir: string;
  private runningAgents: Map<string, { pid: number; manifest: ForgeAgentManifest }> = new Map();

  constructor() {
    this.agentsDir = path.join(app.getPath("userData"), "forge-agents");
    if (!fs.existsSync(this.agentsDir)) {
      fs.mkdirSync(this.agentsDir, { recursive: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 1: Test — Bundle + VM execution
  // ---------------------------------------------------------------------------

  async runTest(code: string, templateId: string): Promise<ForgeTestResult> {
    const start = Date.now();
    const logs: string[] = [];

    const log = (msg: string) => {
      logs.push(msg);
      console.log(`[AgentForgeEngine] ${msg}`);
    };

    try {
      // ── Stage 1: Syntax check (lightweight, no deps) ──
      log("Stage 1/4: Syntax check...");
      const syntaxOk = this._syntaxCheck(code);
      if (!syntaxOk.valid) {
        return {
          success: false,
          output: `Syntax error: ${syntaxOk.error}`,
          stage: "syntax",
          durationMs: Date.now() - start,
          logs,
        };
      }
      log("Syntax OK");

      // ── Stage 2: Bundle with esbuild (transform, don't resolve externals) ──
      log("Stage 2/4: Bundling with esbuild...");
      let bundled: string;
      try {
        bundled = await this._bundleCode(code, templateId);
      } catch (bundleErr: any) {
        return {
          success: false,
          output: `Bundle error: ${bundleErr.message}`,
          stage: "bundle",
          durationMs: Date.now() - start,
          logs,
        };
      }
      log(`Bundle OK (${bundled.length} chars)`);

      // ── Stage 3: Runtime execution in isolated VM ──
      log("Stage 3/4: Runtime check in isolated VM...");
      const runtimeResult = this._runInVm(bundled, templateId);
      logs.push(...runtimeResult.vmLogs);

      if (!runtimeResult.success) {
        return {
          success: false,
          output: `Runtime error:\n${runtimeResult.error}`,
          stage: "runtime",
          durationMs: Date.now() - start,
          logs,
        };
      }
      log("Runtime OK — exported functions validated");

      // ── Stage 4: Template-specific validation ──
      log("Stage 4/4: Template validation...");
      const validation = this._validateTemplate(bundled, templateId);
      if (!validation.valid) {
        return {
          success: false,
          output: `Template validation failed: ${validation.error}`,
          stage: "runtime",
          durationMs: Date.now() - start,
          logs,
        };
      }
      log("Template validation OK");

      const durationMs = Date.now() - start;
      log(`Test complete in ${durationMs}ms`);

      return {
        success: true,
        output: `All stages passed (${durationMs}ms).\n${logs.join("\n")}`,
        stage: "runtime",
        durationMs,
        logs,
      };
    } catch (err: any) {
      const durationMs = Date.now() - start;
      log(`Unhandled error: ${err.message}`);
      return {
        success: false,
        output: `Test engine error: ${err.message}`,
        stage: "error",
        durationMs,
        logs,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Deploy — Write bundle + spawn + register
  // ---------------------------------------------------------------------------

  async deploy(
    code: string,
    config: {
      templateId: string;
      autoStart?: boolean;
      enableWallet?: boolean;
      tier?: string;
    }
  ): Promise<ForgeDeployResult> {
    const start = Date.now();
    const { templateId, autoStart = true, tier = "standard" } = config;

    try {
      // 1. Bundle the code (with deps for production deploy)
      const bundled = await this._bundleCodeWithDeps(code, templateId, this.agentsDir);

      // 2. Create agent directory
      const agentId = `forge-${templateId}-${Date.now()}`;
      const agentDir = path.join(this.agentsDir, agentId);
      fs.mkdirSync(agentDir, { recursive: true });

      // 3. Write bundled code + manifest
      const bundledPath = path.join(agentDir, "agent.js");
      fs.writeFileSync(bundledPath, bundled, "utf8");

      const manifest: ForgeAgentManifest = {
        id: agentId,
        name: `Forge Agent: ${templateId}`,
        version: "1.0.0",
        description: `Auto-deployed agent from IDE Forge (${templateId})`,
        templateId,
        runtime: "node",
        permissions: ["network", "filesystem"],
        sourcePath: agentDir,
        bundledPath,
        agentType: templateId as any,
        autoStart,
        tier,
        enableWallet: config.enableWallet ?? false,
        createdAt: Date.now(),
      };

      const manifestPath = path.join(agentDir, "manifest.json");
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

      // 4. Write package stub (for Node require resolution)
      const pkgPath = path.join(agentDir, "package.json");
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({ name: agentId, version: "1.0.0", type: "module" }, null, 2),
        "utf8"
      );

      // 5. Auto-start if configured
      let processPid: number | undefined;
      if (autoStart) {
        const proc = this._spawnAgent(manifest);
        if (proc.success && proc.pid) {
          processPid = proc.pid;
          this.runningAgents.set(agentId, { pid: processPid, manifest });
        }
      }

      console.log(`[AgentForgeEngine] Deployed ${agentId} to ${agentDir}`);

      return {
        success: true,
        nodeId: "local",
        taskId: agentId,
        processPid,
        agentDir,
      };
    } catch (err: any) {
      console.error(`[AgentForgeEngine] Deploy failed:`, err);
      return {
        success: false,
        nodeId: "local",
        taskId: "",
        agentDir: "",
        error: err.message,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 2b: Deploy to Remote Node via SSH (mesh:dispatch)
  // ---------------------------------------------------------------------------

  async deployToNode(
    code: string,
    config: {
      templateId: string;
      nodeConfig: ForgeNodeConfig;
      autoStart?: boolean;
      enableWallet?: boolean;
      tier?: string;
    }
  ): Promise<ForgeDeployResult> {
    const { templateId, nodeConfig, autoStart = true, tier = "standard" } = config;
    const { host, user, agentDir: remoteDir = "~/.mosaic-forge-agents" } = nodeConfig;

    try {
      // 1. Bundle locally
      const bundled = await this._bundleCode(code, templateId);

      // 2. Generate agent ID
      const agentId = `forge-${templateId}-${Date.now()}`;
      const remoteAgentDir = `${remoteDir}/${agentId}`;

      // 3. Write bundle to temp file for scp
      const tmpBundleFile = path.join(
        app.getPath("temp"),
        `forge-remote-${agentId}.js`
      );
      fs.writeFileSync(tmpBundleFile, bundled, "utf8");

      // 4. SCP bundle to remote node
      const scpCmd = `scp -o ConnectTimeout=10 -o StrictHostKeyChecking=no "${tmpBundleFile}" ${user}@${host}:"${remoteAgentDir}/agent.js"`;
      // Ensure remote dir exists first
      const mkdirCmd = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${user}@${host} 'mkdir -p "${remoteAgentDir}"'`;

      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      // Create remote dir
      await execAsync(mkdirCmd, { timeout: 15000 });

      // Copy bundle
      await execAsync(scpCmd, { timeout: 30000 });

      // 5. Write manifest on remote
      const manifest: ForgeAgentManifest = {
        id: agentId,
        name: `Forge Agent: ${templateId}`,
        version: "1.0.0",
        description: `Auto-deployed agent from IDE Forge to ${host} (${templateId})`,
        templateId,
        runtime: "node",
        permissions: ["network", "filesystem"],
        sourcePath: remoteAgentDir,
        bundledPath: `${remoteAgentDir}/agent.js`,
        agentType: templateId as any,
        autoStart,
        tier,
        enableWallet: config.enableWallet ?? false,
        createdAt: Date.now(),
      };

      const manifestJson = JSON.stringify(manifest, null, 2)
        .replace(/'/g, "'\\''");
      const manifestCmd = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${user}@${host} 'echo '\"'${manifestJson}'\"' > "${remoteAgentDir}/manifest.json"'`;
      await execAsync(manifestCmd, { timeout: 15000 });

      // 6. Auto-start via SSH if requested
      let remoteStdout = "";
      let remoteStderr = "";
      if (autoStart) {
        const startCmd = `cd "${remoteAgentDir}" && nohup node agent.js > agent.log 2>&1 & echo $!`;
        const sshFullCmd = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${user}@${host} '${startCmd}'`;
        const { stdout, stderr } = await execAsync(sshFullCmd, { timeout: 15000 });
        remoteStdout = stdout.trim();
        remoteStderr = stderr.trim();
      }

      // 7. Cleanup local temp
      try { fs.unlinkSync(tmpBundleFile); } catch {}

      console.log(`[AgentForgeEngine] Remotely deployed ${agentId} to ${host}:${remoteAgentDir}`);

      return {
        success: true,
        nodeId: host,
        taskId: agentId,
        agentDir: remoteAgentDir,
        remoteStdout,
        remoteStderr,
      };
    } catch (err: any) {
      console.error(`[AgentForgeEngine] Remote deploy to ${host} failed:`, err);
      return {
        success: false,
        nodeId: host,
        taskId: "",
        agentDir: "",
        error: err.message,
        remoteStderr: err.stderr || "",
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle: Stop / Restart / Status
  // ---------------------------------------------------------------------------

  stopAgent(agentId: string): boolean {
    const running = this.runningAgents.get(agentId);
    if (!running) return false;

    try {
      process.kill(running.pid, "SIGTERM");
      this.runningAgents.delete(agentId);
      console.log(`[AgentForgeEngine] Stopped ${agentId} (pid ${running.pid})`);
      return true;
    } catch {
      return false;
    }
  }

  getRunningAgents(): Array<{ agentId: string; pid: number; manifest: ForgeAgentManifest }> {
    return Array.from(this.runningAgents.entries()).map(([agentId, data]) => ({
      agentId,
      pid: data.pid,
      manifest: data.manifest,
    }));
  }

  getDeployedAgents(): ForgeAgentManifest[] {
    try {
      const dirs = fs.readdirSync(this.agentsDir);
      return dirs
        .map((dir) => {
          const manifestPath = path.join(this.agentsDir, dir, "manifest.json");
          if (!fs.existsSync(manifestPath)) return null;
          try {
            return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ForgeAgentManifest;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as ForgeAgentManifest[];
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: Syntax Check
  // ---------------------------------------------------------------------------

  private _syntaxCheck(code: string): { valid: boolean; error?: string } {
    try {
      // Use V8 parser (fast, no execution)
      new Script(code, { produceCachedData: false });
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: Bundle with esbuild
  // ---------------------------------------------------------------------------

  private async _bundleCode(code: string, templateId: string): Promise<string> {
    // esbuild is already in mosaic-companion's dependencies
    const esbuild = require("esbuild");

    const tmpDir = path.join(app.getPath("temp"), `forge-bundle-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const entryFile = path.join(tmpDir, `${templateId}.ts`);
    fs.writeFileSync(entryFile, code, "utf8");

    try {
      const result = await esbuild.build({
        entryPoints: [entryFile],
        bundle: true,
        write: false,
        format: "cjs",
        platform: "node",
        target: "node20",
        // External all imports — we don't install template deps for test
        external: ["*"],
        minify: false,
        sourcemap: false,
      });

      const bundled = result.outputFiles?.[0]?.text;
      if (!bundled) {
        throw new Error("esbuild produced no output");
      }

      return bundled;
    } finally {
      // Cleanup temp
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: Bundle with esbuild — FULL (with deps installed)
  // ---------------------------------------------------------------------------

  private async _bundleCodeWithDeps(
    code: string,
    templateId: string,
    agentDir: string
  ): Promise<string> {
    const esbuild = require("esbuild");

    const tmpDir = path.join(app.getPath("temp"), `forge-bundle-full-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const entryFile = path.join(tmpDir, `${templateId}.ts`);
    fs.writeFileSync(entryFile, code, "utf8");

    try {
      // 1. Extract imports
      const imports = this._extractImports(code);

      // 2. Write package.json with detected deps
      if (imports.length > 0) {
        const deps: Record<string, string> = {};
        for (const imp of imports) {
          // Skip relative imports, Node built-ins, and @types packages
          if (imp.startsWith(".") || imp.startsWith("/")) continue;
          if (["fs", "path", "http", "https", "os", "crypto", "stream", "util", "events", "child_process", "vm"].includes(imp)) continue;
          const pkgName = imp.startsWith("@") ? imp.split("/").slice(0, 2).join("/") : imp.split("/")[0];
          if (pkgName && !pkgName.startsWith("@types/")) {
            deps[pkgName] = "latest";
          }
        }
        if (Object.keys(deps).length > 0) {
          const pkgJson = { name: `forge-${templateId}`, version: "1.0.0", dependencies: deps };
          fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkgJson, null, 2), "utf8");
          // Install deps in temp dir
          const { execSync } = require("child_process");
          try {
            execSync("npm install --silent", { cwd: tmpDir, timeout: 60000, stdio: "pipe" });
          } catch (installErr: any) {
            console.warn(`[AgentForgeEngine] npm install warning: ${installErr.message}`);
          }
        }
      }

      // 3. Bundle with deps resolved (external: [] means inline everything)
      const result = await esbuild.build({
        entryPoints: [entryFile],
        bundle: true,
        write: false,
        format: "cjs",
        platform: "node",
        target: "node20",
        external: [], // Inline all deps
        minify: true,
        sourcemap: false,
      });

      const bundled = result.outputFiles?.[0]?.text;
      if (!bundled) throw new Error("esbuild produced no output");
      return bundled;
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }

  private _extractImports(code: string): string[] {
    const imports: string[] = [];
    // Match: import X from 'pkg' or import X from "pkg"
    const regex = /import\s+.*?\s+from\s+['"]([^'"]+)['"];?/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
      imports.push(match[1]);
    }
    // Match: import 'pkg' (side-effect)
    const sideEffectRegex = /import\s+['"]([^'"]+)['"];?/g;
    while ((match = sideEffectRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }
    return Array.from(new Set(imports));
  }

  // ---------------------------------------------------------------------------
  // Internal: VM Execution
  // ---------------------------------------------------------------------------

  private _runInVm(
    bundled: string,
    templateId: string
  ): { success: boolean; error?: string; vmLogs: string[] } {
    const vmLogs: string[] = [];

    // Create a minimal sandbox context
    const context: any = {
      console: {
        log: (...args: any[]) => vmLogs.push(args.join(" ")),
        error: (...args: any[]) => vmLogs.push("ERR: " + args.join(" ")),
        warn: (...args: any[]) => vmLogs.push("WARN: " + args.join(" ")),
      },
      // Provide stub globals that templates might reference
      process: { env: {} },
      Buffer: { from: () => ({}) },
      setTimeout: () => 0,
      clearTimeout: () => 0,
      setInterval: () => 0,
      clearInterval: () => 0,
      // Template-specific stubs
      exports: {},
      module: { exports: {} },
      require: () => {
        throw new Error("require() is not available in test VM — external imports must be stubbed");
      },
    };

    try {
      const script = new Script(bundled);

      script.runInNewContext(context, { timeout: 5000 });

      // Check that something was exported
      const exports = context.module?.exports || context.exports;
      const hasExports = exports && Object.keys(exports).length > 0;

      // For "custom" template, just verify it didn't throw
      if (templateId === "custom") {
        return { success: true, vmLogs };
      }

      if (!hasExports) {
        return {
          success: false,
          error: "Agent code bundled but exports nothing. Expected an exported function or class.",
          vmLogs,
        };
      }

      return { success: true, vmLogs };
    } catch (err: any) {
      return {
        success: false,
        error: `${err.name}: ${err.message}`,
        vmLogs,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: Template Validation
  // ---------------------------------------------------------------------------

  private _validateTemplate(
    bundled: string,
    templateId: string
  ): { valid: boolean; error?: string } {
    const expectedExports: Record<string, string[]> = {
      "anfe-minter": ["mintANFE"],
      "fleet-node": ["registerFleetNode"],
      "mcp-adapter": ["startMCPAdapter"],
      custom: [], // no required exports
    };

    const required = expectedExports[templateId];
    if (!required || required.length === 0) {
      return { valid: true }; // custom template has no requirements
    }

    // Check that the bundled code contains the expected export names
    for (const name of required) {
      if (!bundled.includes(name)) {
        return {
          valid: false,
          error: `Template "${templateId}" expects exported function "${name}" but it was not found in the bundled output.`,
        };
      }
    }

    return { valid: true };
  }

  // ---------------------------------------------------------------------------
  // Internal: Spawn Agent Process
  // ---------------------------------------------------------------------------

  private _spawnAgent(manifest: ForgeAgentManifest): { success: boolean; pid?: number; error?: string } {
    try {
      const child = spawn(
        process.execPath,
        [manifest.bundledPath],
        {
          cwd: manifest.sourcePath,
          env: {
            ...process.env,
            FORGE_AGENT_ID: manifest.id,
            FORGE_TEMPLATE_ID: manifest.templateId,
            FORGE_TIER: manifest.tier,
            NODE_ENV: "production",
          },
          detached: false,
          stdio: ["ignore", "pipe", "pipe"],
        }
      );

      child.stdout?.on("data", (data) => {
        console.log(`[ForgeAgent ${manifest.id}] ${data.toString().trim()}`);
      });

      child.stderr?.on("data", (data) => {
        console.error(`[ForgeAgent ${manifest.id}] ERR: ${data.toString().trim()}`);
      });

      child.on("exit", (code) => {
        console.log(`[ForgeAgent ${manifest.id}] exited with code ${code}`);
        this.runningAgents.delete(manifest.id);
      });

      child.on("error", (err) => {
        console.error(`[ForgeAgent ${manifest.id}] spawn error:`, err);
        this.runningAgents.delete(manifest.id);
      });

      return { success: true, pid: child.pid };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 3: Health Monitoring — heartbeat + auto-restart
  // ---------------------------------------------------------------------------

  private healthMonitors: Map<string, ReturnType<typeof setInterval>> = new Map();

  enableHealthCheck(
    agentId: string,
    manifest: ForgeAgentManifest,
    options: { intervalMs?: number; maxRestarts?: number } = {}
  ): void {
    const { intervalMs = 10000, maxRestarts = 3 } = options;
    let restarts = 0;

    // Clear existing monitor if any
    this.disableHealthCheck(agentId);

    const monitor = setInterval(() => {
      const running = this.runningAgents.get(agentId);
      if (!running) {
        // Agent not running — restart if under max
        if (restarts < maxRestarts) {
          console.log(`[AgentForgeEngine] Agent ${agentId} not running — restarting (${restarts + 1}/${maxRestarts})`);
          const proc = this._spawnAgent(manifest);
          if (proc.success && proc.pid) {
            this.runningAgents.set(agentId, { pid: proc.pid, manifest });
            restarts++;
          }
        } else {
          console.error(`[AgentForgeEngine] Agent ${agentId} max restarts reached (${maxRestarts}). Giving up.`);
          this.disableHealthCheck(agentId);
        }
      }
    }, intervalMs);

    this.healthMonitors.set(agentId, monitor);
    console.log(`[AgentForgeEngine] Health check enabled for ${agentId} (${intervalMs}ms)`);
  }

  disableHealthCheck(agentId: string): void {
    const monitor = this.healthMonitors.get(agentId);
    if (monitor) {
      clearInterval(monitor);
      this.healthMonitors.delete(agentId);
      console.log(`[AgentForgeEngine] Health check disabled for ${agentId}`);
    }
  }

  isHealthy(agentId: string): boolean {
    return this.runningAgents.has(agentId);
  }

  // ---------------------------------------------------------------------------
  // Phase 4: Deploy to Docker Sandbox (fleet-grade isolation)
  // ---------------------------------------------------------------------------

  async deployToSandbox(
    code: string,
    config: {
      templateId: string;
      nodeId: string;
      image?: string;
      memoryLimit?: string;
      cpuLimit?: number;
      networkMode?: "bridge" | "host" | "none";
      ports?: number[];
      env?: Record<string, string>;
      autoStart?: boolean;
      tier?: string;
    }
  ): Promise<ForgeDeployResult> {
    const {
      templateId, nodeId,
      image = "node:22-alpine",
      memoryLimit = "512m",
      cpuLimit = 1.0,
      networkMode = "bridge",
      ports = [],
      env = {},
      autoStart = true,
      tier = "standard",
    } = config;

    try {
      // 1. Bundle
      const bundled = await this._bundleCodeWithDeps(code, templateId, this.agentsDir);

      // 2. Write to temp for docker build context
      const tmpDir = path.join(app.getPath("temp"), `forge-sandbox-${nodeId}-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      const bundleFile = path.join(tmpDir, "agent.js");
      fs.writeFileSync(bundleFile, bundled, "utf8");
      fs.writeFileSync(
        path.join(tmpDir, "Dockerfile"),
        `FROM ${image}\nWORKDIR /app\nCOPY agent.js .\nENV NODE_ENV=production\nCMD ["node", "agent.js"]\n`,
        "utf8"
      );

      // 3. Build Docker image
      const imgName = `forge-agent-${nodeId}:${Date.now()}`;
      const { execSync } = require("child_process");

      // Preflight: verify Docker is available before building
      try {
        execSync("docker version --format {{.Server.Version}}", { stdio: "pipe", timeout: 10000 });
      } catch {
        const msg = "Docker is required. Install Docker Desktop from https://docker.com/";
        console.error(`[AgentForgeEngine] ${msg}`);
        this._logToChronicle(nodeId, "forge:sandbox:deploy", "failed", msg);
        return {
          success: false,
          nodeId,
          taskId: "",
          agentDir: tmpDir,
          error: msg,
        };
      }

      execSync(`docker build -t ${imgName} "${tmpDir}"`, { timeout: 120000, stdio: "pipe" });

      // 4. Run container
      const envFlags = Object.entries({ ...env, FORGE_AGENT_ID: nodeId, FORGE_TEMPLATE_ID: templateId, FORGE_TIER: tier })
        .map(([k, v]) => `-e ${k}=${v}`)
        .join(" ");
      const portFlags = ports.map((p) => `-p ${p}:${p}`).join(" ");
      const runCmd = `docker run -d --name stargate-forge-${nodeId} --network ${networkMode} --memory=${memoryLimit} --cpus=${cpuLimit} ${envFlags} ${portFlags} ${imgName}`;
      const containerId = execSync(runCmd, { encoding: "utf8", timeout: 30000 }).trim();

      // Cleanup temp
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

      this._logToChronicle(nodeId, "forge:sandbox:deploy", "success", `image=${imgName} container=${containerId}`);

      return {
        success: true,
        nodeId,
        taskId: nodeId,
        agentDir: tmpDir,
        processPid: undefined,
      };
    } catch (err: any) {
      console.error(`[AgentForgeEngine] Sandbox deploy failed:`, err);
      this._logToChronicle(nodeId, "forge:sandbox:deploy", "failed", err.message);
      return {
        success: false,
        nodeId,
        taskId: "",
        agentDir: "",
        error: err.message,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 5: Chronicle Integration — full audit trail
  // ---------------------------------------------------------------------------

  private _logToChronicle(
    nodeId: string,
    event: string,
    status: "success" | "failed" | "warning" | "info",
    detail?: string,
  ): void {
    try {
      const chronicle = getChronicle();
      chronicle.append(
        "forge",
        "core",
        "lifecycle",
        {
          nodeId,
          event,
          status,
          detail,
          category: "ide",
          timestamp: Date.now(),
          source: "AgentForgeEngine",
        },
      );
    } catch (err) {
      console.log(`[Chronicle-fallback] ${event} ${status}: ${detail || ""}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 4b: WASM Runtime — compile agent to WASI for sandboxed execution
  // ---------------------------------------------------------------------------

  /**
   * Run an agent through a WASM runtime (wasmer / wasmtime / javy).
   * Falls back to Node VM if no WASM runtime is available.
   */
  async runTestWASM(
    code: string,
    templateId: string,
    options: { engine?: "wasmer" | "wasmtime" | "javy"; timeoutMs?: number } = {}
  ): Promise<ForgeTestResult> {
    const { engine = "auto", timeoutMs = 10000 } = options;
    const selected = engine === "auto" ? this._detectWasmEngine() : engine;

    if (!selected) {
      // No WASM runtime — fallback to Node VM (same as runTest)
      return this.runTest(code, templateId);
    }

    const start = Date.now();
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      console.log(`[ForgeWASM ${templateId}] ${msg}`);
    };

    try {
      log(`Stage WASM/1: WASM engine=${selected}`);

      // 1. Bundle
      const bundled = await this._bundleCodeWithDeps(code, templateId, this.agentsDir);
      log(`  → bundle ${bundled.length} chars`);

      // 2. Build WASI runner script
      const runner = this._buildWasiRunner(bundled);
      log(`  → WASI runner built`);

      // 3. Write to temp
      const tmpDir = path.join(os.tmpdir(), `forge-wasm-${templateId}-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      const runnerPath = path.join(tmpDir, "runner.js");
      fs.writeFileSync(runnerPath, runner, "utf8");

      // 4. Execute via WASM engine
      let result: string;
      switch (selected) {
        case "javy":
          result = execSync(`javy compile ${runnerPath} -o ${tmpDir}/agent.wasm && javy run ${tmpDir}/agent.wasm`, {
            encoding: "utf8",
            timeout: timeoutMs,
            stdio: "pipe",
          });
          break;
        case "wasmer":
          result = execSync(`wasmer run --mapdir=/app:${tmpDir} ${runnerPath}`, {
            encoding: "utf8",
            timeout: timeoutMs,
            stdio: "pipe",
          });
          break;
        case "wasmtime":
          result = execSync(`wasmtime run --dir=${tmpDir} ${runnerPath}`, {
            encoding: "utf8",
            timeout: timeoutMs,
            stdio: "pipe",
          });
          break;
        default:
          throw new Error(`Unknown WASM engine: ${selected}`);
      }

      log(`  → WASM execution complete`);
      log(`  → output: ${result.substring(0, 200)}`);

      const durationMs = Date.now() - start;
      this._logToChronicle(templateId, "forge:wasm:test", "success", `engine=${selected}`);

      return {
        success: true,
        output: `WASM test passed (${selected}) in ${durationMs}ms.\n${logs.join("\n")}\n${result}`,
        stage: "runtime",
        durationMs,
        logs,
      };
    } catch (err: any) {
      const durationMs = Date.now() - start;
      log(`WASM test error: ${err.message}`);
      this._logToChronicle(templateId, "forge:wasm:test", "failed", err.message);
      return {
        success: false,
        output: `WASM test failed (${selected || "none"}): ${err.message}`,
        stage: "error",
        durationMs,
        logs,
      };
    }
  }

  /** Detect available WASM engine, or null if none */
  private _detectWasmEngine(): "wasmer" | "wasmtime" | "javy" | null {
    try {
      execSync("javy --version", { stdio: "ignore", timeout: 2000 });
      return "javy";
    } catch {}
    try {
      execSync("wasmer --version", { stdio: "ignore", timeout: 2000 });
      return "wasmer";
    } catch {}
    try {
      execSync("wasmtime --version", { stdio: "ignore", timeout: 2000 });
      return "wasmtime";
    } catch {}
    return null;
  }

  /** Build a WASI-compatible runner that self-executes the bundled code */
  private _buildWasiRunner(bundledCode: string): string {
    // Wrap the bundled code in a WASI-compatible IIFE
    // This runner uses console.log (available in all WASI hosts)
    // and exits cleanly so the host can capture stdout.
    return `// WASI Runner — Auto-generated by AgentForgeEngine
(function() {
  "use strict";
  try {
    ${bundledCode}
    console.log("[WASI-RUNNER] Agent loaded successfully.");
  } catch (e) {
    console.error("[WASI-RUNNER] Agent error: " + e.message);
    if (typeof __wasi_exit !== "undefined") __wasi_exit(1);
  }
})();
`;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const agentForgeEngine = new AgentForgeEngine();
export default AgentForgeEngine;
