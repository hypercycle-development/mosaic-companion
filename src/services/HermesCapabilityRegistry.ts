/**
 * Hermes Capability Registry
 * 
 * Maps Hermes Agent tools to Mosaic-Companion AI Agent capabilities.
 * Provides structured capability definitions for injection into agent system prompts.
 */

import { HermesCapability } from "../types/soul";

// =============================================================================
// Core Hermes Capabilities
// =============================================================================

export const HERMES_CAPABILITIES: Record<string, HermesCapability> = {
  // Web & Research
  web_search: {
    id: "web_search",
    name: "Web Search",
    description: "Search the web for information using DuckDuckGo or other search engines",
    category: "web",
    toolNames: ["web_search"],
    systemPromptAddition: `## Web Search
When you need current information not in your context, use web_search.
- Search for specific, verifiable facts
- Cite sources from search results
- Acknowledge when search results are insufficient`,
  },

  browser_navigation: {
    id: "browser_navigation",
    name: "Browser Navigation",
    description: "Navigate websites, extract content, and interact with web pages",
    category: "web",
    toolNames: ["browser_navigate", "browser_click", "browser_type", "browser_snapshot"],
    systemPromptAddition: `## Browser Navigation
Use browser tools to interact with web pages:
- browser_navigate: Load a specific URL
- browser_click: Click elements on the page
- browser_type: Fill in forms
- browser_snapshot: Read page content
Always verify page state before claiming success.`,
  },

  // File Operations
  file_read: {
    id: "file_read",
    name: "File Reading",
    description: "Read files with line numbers and pagination support",
    category: "file",
    toolNames: ["read_file"],
    systemPromptAddition: `## File Reading
Use read_file to examine code and documents:
- Check file existence before reading
- Use offset/limit for large files
- Respect file boundaries and permissions`,
  },

  file_write: {
    id: "file_write",
    name: "File Writing",
    description: "Write content to files, creating directories as needed",
    category: "file",
    toolNames: ["write_file"],
    systemPromptAddition: `## File Writing
Use write_file for creating/updating files:
- Overwrites existing content completely
- Creates parent directories automatically
- Verify write success with read_file`,
  },

  file_search: {
    id: "file_search",
    name: "File Search",
    description: "Search file contents or find files by name/pattern",
    category: "file",
    toolNames: ["search_files"],
    systemPromptAddition: `## File Search
Use search_files for discovery:
- Search content with regex patterns
- Find files by glob patterns
- Respect result limits to avoid noise`,
  },

  file_patch: {
    id: "file_patch",
    name: "File Patching",
    description: "Targeted find-and-replace edits with fuzzy matching",
    category: "file",
    toolNames: ["patch"],
    systemPromptAddition: `## File Patching
Use patch for precise edits:
- Requires unique old_string match
- Supports multi-file patches
- Validates syntax after editing`,
  },

  // Terminal & Execution
  terminal: {
    id: "terminal",
    name: "Terminal Execution",
    description: "Execute shell commands with persistent environment",
    category: "terminal",
    toolNames: ["terminal"],
    systemPromptAddition: `## Terminal Execution
Use terminal for shell commands:
- Commands return instantly when done
- Use timeout for long operations
- Background mode for servers/daemons
- Verify command success before proceeding`,
  },

  process_management: {
    id: "process_management",
    name: "Process Management",
    description: "Manage background processes started with terminal",
    category: "terminal",
    toolNames: ["process"],
    systemPromptAddition: `## Process Management
Use process for background jobs:
- Poll for progress
- Wait for completion
- Kill when necessary
- Always verify process state`,
  },

  code_execution: {
    id: "code_execution",
    name: "Python Code Execution",
    description: "Run Python scripts with tool access",
    category: "terminal",
    toolNames: ["execute_code"],
    systemPromptAddition: `## Python Execution
Use execute_code for complex logic:
- Import tools via hermes_tools
- 50 tool calls max per script
- Print final result to stdout
- Use for batch operations`,
  },

  // Agent & Skills
  skill_management: {
    id: "skill_management",
    name: "Skill Management",
    description: "Create, update, delete, and view skills",
    category: "agent",
    toolNames: ["skill_manage", "skill_view", "skills_list"],
    systemPromptAddition: `## Skill Management
Skills are procedural memory:
- Use skills_list to discover available skills
- Use skill_view to load skill content
- Create skills after complex successful workflows
- Update skills when you discover pitfalls`,
  },

  memory_management: {
    id: "memory_management",
    name: "Memory Management",
    description: "Save and retrieve persistent memory",
    category: "agent",
    toolNames: ["memory"],
    systemPromptAddition: `## Memory Management
Use memory for durable facts:
- User preferences and corrections
- Environment facts and conventions
- Project-specific knowledge
- Keep memory compact and factual`,
  },

  session_search: {
    id: "session_search",
    name: "Session Search",
    description: "Search past sessions for context recall",
    category: "agent",
    toolNames: ["session_search"],
    systemPromptAddition: `## Session Search
Use session_search for continuity:
- Find previous work on topics
- Recall decisions and rationale
- Discover established patterns
- Use before asking users to repeat`,
  },

  task_delegation: {
    id: "task_delegation",
    name: "Task Delegation",
    description: "Spawn subagents for parallel work",
    category: "agent",
    toolNames: ["delegate_task"],
    systemPromptAddition: `## Task Delegation
Use delegate_task for parallel work:
- Spawn up to 3 concurrent subagents
- Provide complete context
- Results are summaries, not verified facts
- Use for independent workstreams`,
  },

  // Vision & Media
  vision: {
    id: "vision",
    name: "Vision Analysis",
    description: "Analyze images and screenshots",
    category: "core",
    toolNames: ["vision_analyze"],
    systemPromptAddition: `## Vision Analysis
Use vision_analyze for images:
- Describe visual content
- Extract text from screenshots
- Analyze diagrams and UI elements`,
  },

  // Kanban & Project Management
  kanban: {
    id: "kanban",
    name: "Kanban Task Management",
    description: "Manage kanban tasks for agent orchestration",
    category: "agent",
    toolNames: ["kanban_show", "kanban_create", "kanban_complete", "kanban_comment", "kanban_block"],
    systemPromptAddition: `## Kanban Tasks
Use kanban tools for coordination:
- kanban_show: Orient to current task
- kanban_create: Spawn child tasks
- kanban_complete: Finish with handoff
- kanban_comment: Add durable notes
- kanban_block: Signal for human input`,
  },

  // Cron & Scheduling
  cronjob: {
    id: "cronjob",
    name: "Scheduled Jobs",
    description: "Create and manage scheduled agent runs",
    category: "agent",
    toolNames: ["cronjob"],
    systemPromptAddition: `## Scheduled Jobs
Use cronjob for recurring tasks:
- Schedule autonomous runs
- Set up monitoring
- Manage job lifecycle
- Use no_agent mode for watchdogs`,
  },

  // TTS
  text_to_speech: {
    id: "text_to_speech",
    name: "Text to Speech",
    description: "Convert text to audio",
    category: "core",
    toolNames: ["text_to_speech"],
    systemPromptAddition: `## Text to Speech
Use text_to_speech for audio:
- Convert responses to speech
- Useful for accessibility
- Character limits apply by provider`,
  },
};

// =============================================================================
// Capability Sets
// =============================================================================

export const CAPABILITY_SETS = {
  // Full developer agent
  developer: [
    "web_search",
    "browser_navigation",
    "file_read",
    "file_write",
    "file_search",
    "file_patch",
    "terminal",
    "process_management",
    "code_execution",
    "skill_management",
    "memory_management",
    "session_search",
    "task_delegation",
    "kanban",
    "vision",
  ],

  // Research agent
  researcher: [
    "web_search",
    "browser_navigation",
    "file_read",
    "file_search",
    "session_search",
    "memory_management",
    "skill_management",
    "vision",
  ],

  // Operations agent
  ops: [
    "terminal",
    "process_management",
    "code_execution",
    "file_read",
    "file_write",
    "file_search",
    "cronjob",
    "memory_management",
    "kanban",
  ],

  // Creative agent
  creative: [
    "vision",
    "web_search",
    "browser_navigation",
    "file_read",
    "file_write",
    "memory_management",
    "text_to_speech",
  ],

  // Minimal agent
  minimal: [
    "file_read",
    "memory_management",
  ],
};

// =============================================================================
// Public API
// =============================================================================

/**
 * Get a capability by ID
 */
export function getCapability(capabilityId: string): HermesCapability | undefined {
  return HERMES_CAPABILITIES[capabilityId];
}

/**
 * Get multiple capabilities by IDs
 */
export function getCapabilities(capabilityIds: string[]): HermesCapability[] {
  return capabilityIds
    .map(id => HERMES_CAPABILITIES[id])
    .filter((cap): cap is HermesCapability => cap !== undefined);
}

/**
 * Get a predefined capability set
 */
export function getCapabilitySet(setName: keyof typeof CAPABILITY_SETS): HermesCapability[] {
  const ids = CAPABILITY_SETS[setName];
  return getCapabilities(ids);
}

/**
 * Get all capabilities in a category
 */
export function getCapabilitiesByCategory(
  category: HermesCapability["category"]
): HermesCapability[] {
  return Object.values(HERMES_CAPABILITIES).filter(cap => cap.category === category);
}

/**
 * Build system prompt additions for enabled capabilities
 */
export function buildCapabilitySystemPrompt(capabilityIds: string[]): string {
  // Defensive: handle undefined/non-array inputs to prevent renderer crashes
  if (!Array.isArray(capabilityIds)) {
    console.warn("[HermesCapabilityRegistry] buildCapabilitySystemPrompt received non-array:", capabilityIds);
    return "";
  }

  const capabilities = getCapabilities(capabilityIds);

  if (capabilities.length === 0) {
    return "";
  }

  const sections = capabilities.map(cap => cap.systemPromptAddition).filter(Boolean);

  return `\n## Available Tools\n\n${sections.join("\n\n---\n\n")}\n`;
}

/**
 * Get all capability IDs
 */
export function getAllCapabilityIds(): string[] {
  return Object.keys(HERMES_CAPABILITIES);
}

/**
 * Get capability categories
 */
export function getCapabilityCategories(): string[] {
  const categories = new Set(Object.values(HERMES_CAPABILITIES).map(c => c.category));
  return Array.from(categories);
}

export default {
  HERMES_CAPABILITIES,
  CAPABILITY_SETS,
  getCapability,
  getCapabilities,
  getCapabilitySet,
  getCapabilitiesByCategory,
  buildCapabilitySystemPrompt,
  getAllCapabilityIds,
  getCapabilityCategories,
};
