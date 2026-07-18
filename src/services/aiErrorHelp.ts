/**
 * Turns raw provider/API error strings into actionable, human-readable help.
 *
 * Providers return terse or jargon-heavy errors ("RESOURCE_EXHAUSTED", "401")
 * that new users routinely misread (e.g. assuming a rate-limited key is
 * broken). This maps the common failure classes to plain-language guidance;
 * anything unrecognized falls through to the raw message.
 */

import { AIProvider, PROVIDER_INFO } from "../types/ai";

const QUOTA_PATTERNS = [
  "quota",
  "429",
  "resource_exhausted",
  "rate limit",
  "billing",
];

const AUTH_PATTERNS = [
  "invalid api key",
  "incorrect api key",
  "invalid x-api-key",
  "authentication",
  "unauthorized",
  "401",
  "403",
  "api key not valid",
  "permission",
];

const NETWORK_PATTERNS = [
  "failed to fetch",
  "network",
  "enotfound",
  "econnrefused",
];

const matchesAny = (haystack: string, patterns: string[]): boolean =>
  patterns.some((p) => haystack.includes(p));

/**
 * Explain an AI provider error in actionable terms.
 *
 * @param provider The agent's provider (used for provider-specific wording).
 * @param raw      The raw error message from the provider/service.
 * @param baseUrl  The agent's base URL (used for Ollama connection help).
 * @returns Actionable copy for known failure classes, else `raw` unchanged.
 */
export function explainAIError(
  provider: AIProvider,
  raw: string,
  baseUrl?: string,
): string {
  // AIService already produces detailed Hypercycle diagnostics — pass through.
  if (provider === "hypercycle") return raw;

  const msg = raw.toLowerCase();
  const name = PROVIDER_INFO[provider]?.name ?? "Provider";
  const isNetworkError = matchesAny(msg, NETWORK_PATTERNS);

  // Ollama connection problems get local-server help, not generic network copy.
  if (
    msg.includes("is ollama running") ||
    (provider === "ollama" && isNetworkError)
  ) {
    return `Couldn't reach Ollama at ${baseUrl || "http://localhost:11434"}. Make sure Ollama is installed and running (ollama serve), then retry.`;
  }

  if (matchesAny(msg, QUOTA_PATTERNS)) {
    return `${name} says this key has hit a usage or quota limit. Free-tier keys (especially Gemini) have small daily limits — wait a while and retry, enable billing on your ${name} account, or use a key from another provider. Your key itself is fine.`;
  }

  if (matchesAny(msg, AUTH_PATTERNS)) {
    return `${name} rejected this API key. Check that you pasted the entire key with no extra spaces or line breaks (Claude keys start with sk-ant-, OpenAI with sk-, Gemini with AIza), and that the key hasn't been revoked.`;
  }

  if (isNetworkError) {
    return `Couldn't reach ${name}. Check your internet connection (and any VPN/firewall) and try again.`;
  }

  return raw;
}
