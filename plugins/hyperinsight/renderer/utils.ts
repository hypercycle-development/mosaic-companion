export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatUtcDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    // Returns "YYYY-MM-DD HH:mm:ss UTC"
    return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  } catch (e) {
    return dateString || '-';
  }
}

/**
 * Returns a human-readable relative time string from a UTC date string.
 * Examples: "just now", "2 min ago", "1 hour ago", "3 days ago"
 */
export function relativeTime(utcDateString: string | null | undefined): string {
  if (!utcDateString) return 'unknown';
  const diffMs = Date.now() - new Date(utcDateString).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

/**
 * Returns a freshness status based on minutes elapsed since a UTC date.
 * fresh: < 10 min | stale: 10–30 min | very-stale: > 30 min
 */
export function freshnessStatus(
  utcDateString: string | null | undefined
): 'fresh' | 'stale' | 'very-stale' {
  if (!utcDateString) return 'very-stale';
  const diffMin = (Date.now() - new Date(utcDateString).getTime()) / 60_000;
  if (diffMin < 10)  return 'fresh';
  if (diffMin < 30)  return 'stale';
  return 'very-stale';
}

/**
 * Formats a micro-USDC amount to a human-readable string.
 * 0 or null → "Free" | 10000 → "$0.01 USDC" | 1000000 → "$1.00 USDC"
 */
export function formatUsdcMicro(microUnits: number | null | undefined): string {
  if (!microUnits || microUnits === 0) return 'Free';
  return `$${(microUnits / 1_000_000).toFixed(2)} USDC`;
}

/**
 * Formats bytes to a human-readable string.
 * 0 or null → "—" | 1073741824 → "1.0 GB" | 536870912 → "512 MB"
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return '—';
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(0)} MB`;
  if (bytes >= 1_024)         return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/**
 * Infers display category tags from an AIM's name and namespace.
 * Returns 1–3 tag strings. Designed to be replaced by an API-provided
 * field when the backend supplies category data.
 */
export function inferCategoryTags(name: string, namespace: string): string[] {
  const combined = `${name} ${namespace}`.toLowerCase();
  const tags: string[] = [];
  if (/ollama|llm|gpt|chat|mistral|llama|falcon/.test(combined)) tags.push('LLM Inference');
  if (/image|diffus|sdxl|stable|flux|midj/.test(combined))       tags.push('Image Generation');
  if (/audio|tts|speech|whisper|voice/.test(combined))            tags.push('Audio');
  if (/video|animate/.test(combined))                             tags.push('Video Generation');
  if (/embed|encod|vector|semantic/.test(combined))               tags.push('Embeddings');
  if (tags.length === 0) tags.push('General');
  return tags.slice(0, 3);
}

/**
 * Returns a Tailwind bg colour class based on a composite score (0–100).
 */
export function scoreToColourClass(score: number | null | undefined): string {
  if (score == null) return 'bg-gray-400';
  if (score >= 80)   return 'bg-green-500';
  if (score >= 50)   return 'bg-amber-500';
  return 'bg-red-500';
}

export type RoutabilityState =
  | 'all-routable'
  | 'partially-routable'
  | 'none-routable'
  | 'no-data';

export function deriveRoutabilityState(
  total: number | null | undefined,
  routable: number | null | undefined,
): RoutabilityState {
  const t = total ?? 0;
  const r = routable ?? 0;
  if (t === 0) return 'no-data';
  if (r === 0) return 'none-routable';
  if (r < t)   return 'partially-routable';
  return 'all-routable';
}
