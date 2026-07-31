export const DEFAULT_MODELS = {
    claude: [
        "claude-sonnet-4-20250514",
        "claude-opus-4-0-20250514",
        "claude-haiku-4-0-20250514",
        "claude-3-5-sonnet-20241022",
    ],
    openai: [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-3.5-turbo",
        "o1-preview",
        "o1-mini",
    ],
    gemini: ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    ollama: ["llama3.2", "mistral", "codellama", "deepseek-coder"],
    custom: [],
    hypercycle: ["claude-sonnet-4-5-20250929"],
};
export const PROVIDER_INFO = {
    claude: {
        name: "Anthropic Claude",
        color: "#D97706",
        baseUrl: "https://api.anthropic.com",
    },
    openai: {
        name: "OpenAI",
        color: "#10B981",
        baseUrl: "https://api.openai.com",
    },
    gemini: {
        name: "Google Gemini",
        color: "#3B82F6",
        baseUrl: "https://generativelanguage.googleapis.com",
    },
    ollama: {
        name: "Ollama (Local)",
        color: "#8B5CF6",
        baseUrl: "http://localhost:11434",
    },
    custom: {
        name: "Custom Endpoint",
        color: "#6B7280",
        baseUrl: "",
    },
    hypercycle: {
        name: "Hypercycle Node",
        color: "#22D3EE",
        baseUrl: "http://207.53.252.108",
    },
};
