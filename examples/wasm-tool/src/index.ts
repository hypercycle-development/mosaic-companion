/// <reference types="@extism/js-pdk" />

const MANIFEST = {
  manifestVersion: "1.0.0",
  id: "text-stats",
  version: "1.0.0",
  displayName: "Text Stats",
  description: "Analyzes text and returns word count, character count, sentence count, and estimated reading time.",
  author: "Mosaic Contributors",
  license: "MIT",
  runtime: { type: "wasm", entry: "text-stats.wasm" },
  permissions: {
    internet: false,
    allowed_domains: [],
    files: [],
    services: [],
  },
  resources: { memory: "16m", timeout: "10s" },
  tools: {
    analyze: {
      description: "Count words, characters, and sentences in a text, and estimate reading time.",
      displayHint: "analyze",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "The text to analyze" },
        },
        required: ["text"],
      },
    },
  },
};

export function mosaic_manifest() {
  Host.outputString(JSON.stringify(MANIFEST));
}

export function analyze() {
  const input = JSON.parse(Host.inputString()) as { text?: string };
  const text = input.text ?? "";

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sentences = text.split(/[.!?]+\s/).filter((s) => s.trim().length > 0).length;
  const readingTimeMin = Math.max(1, Math.ceil(words / 200));

  Host.outputString(JSON.stringify({
    data: {
      words,
      characters: text.length,
      characters_no_spaces: text.replace(/\s/g, "").length,
      sentences,
      reading_time_minutes: readingTimeMin,
    },
  }));
}
