// Mirrors src/agents/skills/types.ts from OpenMosaic

export type OpenMosaicSkillMetadata = {
  always?: boolean; // include regardless of requirements
  skillKey?: string; // alternate identifier
  emoji?: string;
  homepage?: string;
  os?: NodeJS.Platform[]; // "darwin" | "linux" | "win32"
  requires?: {
    bins?: string[]; // all must be present in PATH
    anyBins?: string[]; // at least one must be present
    env?: string[]; // all env vars must be set
  };
};

export type SkillInvocationPolicy = {
  userInvocable: boolean; // can user invoke via /command?
  disableModelInvocation: boolean; // exclude from agent system prompt?
};

export type SkillCommandDispatch = {
  kind: "tool";
  toolName: string;
  argMode?: "raw";
};

export type SkillEntry = {
  name: string;
  description: string;
  filePath: string;
  source: "bundled" | "managed" | "workspace" | "plugin" | "extra";
  baseDir: string;
  content: string; // full SKILL.md text
  metadata: OpenMosaicSkillMetadata;
  policy: SkillInvocationPolicy;
  dispatch?: SkillCommandDispatch;
};

export type SkillCommandSpec = {
  name: string; // sanitized command name, e.g. "github"
  skillName: string; // original skill name
  description: string;
  dispatch?: SkillCommandDispatch;
};

export type SkillSnapshot = {
  prompt: string; // formatted block injected into agent system prompt
  skills: SkillEntry[];
  commandSpecs: SkillCommandSpec[];
};

export type SkillEligibilityContext = {
  platform: NodeJS.Platform;
  availableBins: Set<string>;
  availableEnv: Set<string>;
};
