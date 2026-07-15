import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface AimManifest {
  name: string;
  version: string;
  entrypoint: string;
  protocol: string;
  endpoints: { path: string; method: string; description: string }[];
  resources: { cpu: string; memory: string };
  telemetry: { heartbeat_interval: number; metrics: string[] };
}

export interface AxiTool {
  id: string;
  name: string;
  version: string;
  bin: string;
  commands: string[];
}

export function createAimManifest(tool: AxiTool): AimManifest {
  return {
    name: tool.name,
    version: tool.version,
    entrypoint: tool.bin,
    protocol: "axi-v1",
    endpoints: tool.commands.map((cmd) => ({
      path: `/api/v1/${cmd}`,
      method: "POST",
      description: `${cmd} operation`,
    })),
    resources: { cpu: "100m", memory: "128Mi" },
    telemetry: {
      heartbeat_interval: 30,
      metrics: ["requests", "errors", "latency"],
    },
  };
}

export function generateDockerfile(tool: AxiTool): string {
  return `FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY dist/ ./dist/
RUN npm install --production 2>/dev/null || true
ENV NODE_ENV=production
EXPOSE 8080
ENTRYPOINT ["node", "${tool.bin}"]
`;
}

export function aimify(tool: AxiTool, outputDir: string): void {
  mkdirSync(outputDir, { recursive: true });

  const manifest = createAimManifest(tool);
  const dockerfile = generateDockerfile(tool);

  writeFileSync(
    join(outputDir, "aim.json"),
    JSON.stringify(manifest, null, 2)
  );
  writeFileSync(join(outputDir, "Dockerfile"), dockerfile);

  console.log(`AIMified ${tool.name} v${tool.version}`);
  console.log(`  → ${join(outputDir, "aim.json")}`);
  console.log(`  → ${join(outputDir, "Dockerfile")}`);
}
