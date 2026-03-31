/**
 * Sequential Multi-Agent Reasoning Engine
 * CONVERSATIONAL MODEL - System-enforced natural dialogue
 * 
 * Key principles:
 * - Agents respond to each other like human collaborators
 * - No structured JSON output enforcement
 * - Each response is a natural message in a chain
 * - Output sanitization strips any JSON/structure
 */

import { Agent } from './MultiAgentService';

// ============================================================================
// Input/Output Types (Conversational Model)
// ============================================================================

export interface ConversationMessage {
  agentName: string;
  content: string;
}

export interface AgentInput {
  originalPrompt: string;
  previousMessages: ConversationMessage[];
  agentRole?: string;
}

export interface AgentOutput {
  agentId: string;
  agentName: string;
  answer: string;
  critique: string;
  improvements: string[];
  timestamp: number;
  duration: number;
  error?: string;
  // Conversational format
  message: string;
  rawOutput?: string;
  // Progressive rendering
  isThinking?: boolean;
}

export interface SequentialExecutionContext {
  originalPrompt: string;
  history: ConversationMessage[];
  currentAgent: Agent | null;
}

export interface SequentialExecutionResult {
  mode: 'sequential';
  originalPrompt: string;
  outputs: AgentOutput[];
  totalDuration: number;
  success: boolean;
  // No synthesis - we block merged outputs
}

// ============================================================================
// System-Enforced Instructions
// ============================================================================

const CONVERSATIONAL_INSTRUCTION = `You are part of a multi-agent conversation.

- Read previous agent responses carefully.
- Respond naturally as part of a discussion.
- Build on, refine, or challenge previous ideas.

STRICT RULES:
- Do NOT return JSON
- Do NOT structure your response into sections
- Do NOT mention 'critique' or 'improvements'
- Speak like a human collaborator

If previous responses exist:
- Reference them conversationally
- Example: 'Building on what X said...'

Return ONLY your message.`;

// ============================================================================
// Output Sanitization Layer (CRITICAL)
// ============================================================================

/**
 * Sanitize agent output to ensure clean conversational text
 * Strips JSON, brackets, code blocks, and structured content
 */
export const sanitizeOutput = (rawOutput: string): string => {
  console.log('[SequentialEngine] Raw output received:', rawOutput.substring(0, 200));
  
  let cleaned = rawOutput;
  
  // Step 1: Remove code blocks (```...```)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/```/g, '');
  
  // Step 2: Check if output is JSON and extract meaningful text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      // Extract "answer" field if present, otherwise best available text
      if (parsed.answer) {
        cleaned = parsed.answer;
      } else if (parsed.response || parsed.message || parsed.content) {
        cleaned = parsed.response || parsed.message || parsed.content;
      } else {
        // No standard field - try to find any string value
        const values = Object.values(parsed).filter(v => typeof v === 'string' && v.length > 10);
        if (values.length > 0) {
          cleaned = values[0] as string;
        }
      }
    } catch {
      // Not valid JSON, continue with cleanup
    }
  }
  
  // Step 3: Strip remaining JSON-like structures
  cleaned = cleaned.replace(/\{"[\w]+":/g, '');
  cleaned = cleaned.replace(/\[[\s\S]*\]/g, '');
  
  // Step 4: Remove field names/keys commonly found
  cleaned = cleaned.replace(/"answer":/g, '');
  cleaned = cleaned.replace(/"critique":/g, '');
  cleaned = cleaned.replace(/"improvements":/g, '');
  cleaned = cleaned.replace(/"response":/g, '');
  cleaned = cleaned.replace(/"message":/g, '');
  cleaned = cleaned.replace(/"content":/g, '');
  
  // Step 5: Remove quotes and brackets that remain
  cleaned = cleaned.replace(/["\[\]{}]/g, ' ');
  cleaned = cleaned.replace(/\\/g, '');
  
  // Step 6: Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Step 7: Remove any remaining numeric bullet points
  cleaned = cleaned.replace(/^\d+\.\s*/gm, '');
  
  console.log('[SequentialEngine] Sanitized output:', cleaned.substring(0, 200));
  
  return cleaned;
};

// ============================================================================
// Prompt Building (Conversational Model)
// ============================================================================

/**
 * Build conversational prompt for an agent
 * Enforces natural dialogue behavior at system level
 */
export const buildConversationalPrompt = (
  agentName: string,
  agentRole: string,
  originalPrompt: string,
  previousMessages: ConversationMessage[]
): string => {
  // Build previous messages as a conversational history
  const historySection = previousMessages.length > 0
    ? `\n\n=== PREVIOUS AGENT RESPONSES ===\n${previousMessages.map((msg, i) => `
${msg.agentName}: ${msg.content}
`).join('\n\n')}`
    : '';

  // Role injection (optional advanced feature)
  const roleInjection = agentRole
    ? `\nYou are acting as: ${agentRole}`
    : '';

  return `${CONVERSATIONAL_INSTRUCTION}

${roleInjection}

ORIGINAL USER PROMPT:
${originalPrompt}
${historySection}

Remember: Respond as a natural conversation. Reference previous responses if they exist.`;
};

// ============================================================================
// Legacy Parser (kept for compatibility but sanitized)
// ============================================================================

export const parseAgentResponse = (
  agentId: string,
  agentName: string,
  response: string,
  startTime: number
): AgentOutput => {
  const duration = Date.now() - startTime;
  
  // SANITIZE the output - this is the critical layer
  const sanitized = sanitizeOutput(response);
  
  return {
    agentId,
    agentName,
    answer: sanitized,
    message: sanitized,
    rawOutput: response,
    critique: '',  // We don't use these in conversational model
    improvements: [],
    timestamp: Date.now(),
    duration,
  };
};

// ============================================================================
// Sequential Execution Engine (Conversational Model)
// ============================================================================

export class SequentialAgentEngine {
  private timeoutPerAgent: number;
  private onAgentStart?: (agentId: string, agentName: string, progress: number) => void;
  private onAgentComplete?: (output: AgentOutput, progress: number) => void;
  private onError?: (error: Error, agentId: string) => void;
  private onMessage?: (message: ConversationMessage) => void;

  constructor(options: {
    timeoutPerAgent?: number;
    onAgentStart?: (agentId: string, agentName: string, progress: number) => void;
    onAgentComplete?: (output: AgentOutput, progress: number) => void;
    onError?: (error: Error, agentId: string) => void;
    /** Callback for each message as it's generated (for real-time UI) */
    onMessage?: (message: ConversationMessage) => void;
  } = {}) {
    this.timeoutPerAgent = options.timeoutPerAgent || 60000;
    this.onAgentStart = options.onAgentStart;
    this.onAgentComplete = options.onAgentComplete;
    this.onError = options.onError;
    this.onMessage = options.onMessage;
  }

  /**
   * Execute agents sequentially in CONVERSATIONAL mode
   * Each agent receives previous messages and responds naturally
   */
  async execute(
    agents: Agent[],
    originalPrompt: string,
    executeFn: (agentId: string, prompt: string) => Promise<string>
  ): Promise<SequentialExecutionResult> {
    const startTime = Date.now();
    const outputs: AgentOutput[] = [];
    const previousMessages: ConversationMessage[] = [];
    let success = true;

    console.log('[SequentialEngine] Starting conversational execution with', agents.length, 'agents');
    console.log('[SequentialEngine] Original prompt:', originalPrompt.substring(0, 100));

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const progress = ((i + 1) / agents.length) * 100;

      this.onAgentStart?.(agent.id, agent.name, progress);

      console.log(`[SequentialEngine] === Agent ${i + 1}/${agents.length}: ${agent.name} ===`);
      console.log(`[SequentialEngine] Previous messages count: ${previousMessages.length}`);

      try {
        // Build the conversational input
        const input: AgentInput = {
          originalPrompt,
          previousMessages: [...previousMessages],
          agentRole: agent.role,
        };

        // Generate conversational prompt (system-enforced)
        const prompt = buildConversationalPrompt(
          agent.name,
          agent.role,
          originalPrompt,
          previousMessages
        );

        console.log(`[SequentialEngine] Sending prompt to ${agent.name}...`);

        // Execute with timeout
        const rawResponse = await this.executeWithTimeout(
          agent.id,
          prompt,
          executeFn
        );

        // SANITIZE output - critical step
        const output = parseAgentResponse(agent.id, agent.name, rawResponse, startTime);
        
        console.log(`[SequentialEngine] ${agent.name} raw response length: ${rawResponse.length}`);
        console.log(`[SequentialEngine] ${agent.name} sanitized message: ${output.message.substring(0, 100)}...`);

        // Add to outputs
        outputs.push(output);

        // Create conversational message for the chain
        const conversationMessage: ConversationMessage = {
          agentName: agent.name,
          content: output.message,
        };

        // Add to previous messages for next agent
        previousMessages.push(conversationMessage);

        // Notify real-time (for UI if needed)
        this.onMessage?.(conversationMessage);

        this.onAgentComplete?.(output, progress);
        
        console.log(`[SequentialEngine] === Agent ${agent.name} COMPLETE ===`);
        console.log(`[SequentialEngine] Messages passed to next agent: ${previousMessages.length}`);

      } catch (error) {
        success = false;
        const err = error instanceof Error ? error : String(error);
        
        console.error(`[SequentialEngine] ERROR on ${agent.name}:`, err);
        
        outputs.push({
          agentId: agent.id,
          agentName: agent.name,
          answer: '',
          message: `Error: ${err}`,
          critique: '',
          improvements: [],
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          error: String(err),
        });

        this.onError?.(err instanceof Error ? err : new Error(String(err)), agent.id);

        // Continue to next agent (graceful degradation)
        if (!this.continueOnError(err)) {
          break;
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[SequentialEngine] Execution complete. ${outputs.length} outputs, ${totalDuration}ms`);

    return {
      mode: 'sequential',
      originalPrompt,
      outputs,
      totalDuration,
      success,
    };
  }

  private async executeWithTimeout(
    agentId: string,
    prompt: string,
    executeFn: (agentId: string, prompt: string) => Promise<string>
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Agent ${agentId} timed out after ${this.timeoutPerAgent}ms`));
      }, this.timeoutPerAgent);

      executeFn(agentId, prompt)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private continueOnError(error: Error | string): boolean {
    const message = String(error).toLowerCase();
    return !message.includes('timeout') && !message.includes('rate limit');
  }
}

// ============================================================================
// DEPRECATED - Old functions kept for compatibility
// ============================================================================

/** @deprecated Use buildConversationalPrompt instead */
export const wrapAgentPrompt = (
  agentName: string,
  agentRole: string,
  originalPrompt: string,
  previousOutputs: AgentOutput[]
): string => {
  const conversationHistory: ConversationMessage[] = previousOutputs.map(o => ({
    agentName: o.agentName,
    content: o.message || o.answer,
  }));
  return buildConversationalPrompt(agentName, agentRole, originalPrompt, conversationHistory);
};

/** @deprecated - No synthesis in conversational model */
export const synthesizePrompt = (_outputs: AgentOutput[]): string => {
  console.warn('[SequentialEngine] synthesizePrompt is deprecated - no synthesis in conversational model');
  return '';
};

export default SequentialAgentEngine;