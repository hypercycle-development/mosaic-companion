const EXT_TO_LANGUAGE: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".less": "less",
  ".md": "markdown",
  ".mdx": "markdown",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "ini",
  ".xml": "xml",
  ".svg": "xml",
  ".sql": "sql",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".dockerfile": "dockerfile",
  ".tf": "hcl",
  ".lua": "lua",
  ".r": "r",
  ".dart": "dart",
  ".vue": "html",
};

const NAME_TO_LANGUAGE: Record<string, string> = {
  Dockerfile: "dockerfile",
  Makefile: "makefile",
  Gemfile: "ruby",
  Rakefile: "ruby",
  ".gitignore": "ignore",
  ".env": "dotenv",
  ".env.local": "dotenv",
};

export function detectLanguage(filePath: string): string {
  const name = filePath.split("/").pop() ?? "";
  if (NAME_TO_LANGUAGE[name]) return NAME_TO_LANGUAGE[name];

  const dotIndex = name.lastIndexOf(".");
  if (dotIndex >= 0) {
    const ext = name.substring(dotIndex).toLowerCase();
    if (EXT_TO_LANGUAGE[ext]) return EXT_TO_LANGUAGE[ext];
  }

  return "plaintext";
}

export function getFileName(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

// ---- File icon colors by extension (VS Code-style) ----

export interface FileIconStyle {
  color: string;   // tailwind text color class
  label: string;   // short label shown on the icon
}

const EXT_ICON_STYLES: Record<string, FileIconStyle> = {
  // TypeScript
  ".ts":    { color: "text-blue-400",    label: "TS" },
  ".tsx":   { color: "text-blue-400",    label: "TX" },
  ".d.ts":  { color: "text-blue-300",    label: "DT" },
  // JavaScript
  ".js":    { color: "text-yellow-400",  label: "JS" },
  ".jsx":   { color: "text-yellow-400",  label: "JX" },
  ".mjs":   { color: "text-yellow-400",  label: "JS" },
  ".cjs":   { color: "text-yellow-400",  label: "JS" },
  // Python
  ".py":    { color: "text-green-400",   label: "PY" },
  ".pyw":   { color: "text-green-400",   label: "PY" },
  ".pyx":   { color: "text-green-400",   label: "PY" },
  // Web
  ".html":  { color: "text-orange-400",  label: "H" },
  ".htm":   { color: "text-orange-400",  label: "H" },
  ".css":   { color: "text-blue-300",    label: "C" },
  ".scss":  { color: "text-pink-400",    label: "S" },
  ".less":  { color: "text-indigo-300",  label: "L" },
  ".vue":   { color: "text-emerald-400", label: "V" },
  ".svelte":{ color: "text-orange-500",  label: "Sv" },
  // Data / Config
  ".json":  { color: "text-yellow-300",  label: "{}" },
  ".yaml":  { color: "text-red-300",     label: "Y" },
  ".yml":   { color: "text-red-300",     label: "Y" },
  ".toml":  { color: "text-gray-400",    label: "T" },
  ".xml":   { color: "text-orange-300",  label: "X" },
  ".svg":   { color: "text-amber-400",   label: "Sv" },
  ".env":   { color: "text-yellow-600",  label: "E" },
  // Markdown / Docs
  ".md":    { color: "text-sky-300",     label: "M" },
  ".mdx":   { color: "text-sky-300",     label: "M" },
  ".txt":   { color: "text-gray-400",    label: "T" },
  // Shell
  ".sh":    { color: "text-green-300",   label: "$" },
  ".bash":  { color: "text-green-300",   label: "$" },
  ".zsh":   { color: "text-green-300",   label: "$" },
  // Systems
  ".rs":    { color: "text-orange-400",  label: "Rs" },
  ".go":    { color: "text-cyan-400",    label: "Go" },
  ".c":     { color: "text-blue-300",    label: "C" },
  ".cpp":   { color: "text-blue-400",    label: "C+" },
  ".h":     { color: "text-purple-300",  label: "H" },
  ".hpp":   { color: "text-purple-300",  label: "H" },
  ".java":  { color: "text-red-400",     label: "J" },
  ".kt":    { color: "text-purple-400",  label: "Kt" },
  ".swift": { color: "text-orange-400",  label: "Sw" },
  ".cs":    { color: "text-green-500",   label: "C#" },
  ".rb":    { color: "text-red-500",     label: "Rb" },
  ".php":   { color: "text-indigo-300",  label: "P" },
  ".lua":   { color: "text-blue-500",    label: "Lu" },
  ".dart":  { color: "text-cyan-300",    label: "D" },
  ".r":     { color: "text-blue-400",    label: "R" },
  // SQL
  ".sql":   { color: "text-yellow-200",  label: "SQ" },
  // GraphQL
  ".graphql":{ color: "text-pink-400",   label: "GQ" },
  ".gql":   { color: "text-pink-400",    label: "GQ" },
  // Docker
  ".dockerfile": { color: "text-blue-400", label: "D" },
  // Misc
  ".gitignore": { color: "text-gray-500", label: "G" },
  ".wasm":  { color: "text-purple-400",  label: "W" },
  ".lock":  { color: "text-gray-500",    label: "L" },
};

const NAME_ICON_STYLES: Record<string, FileIconStyle> = {
  "Dockerfile":      { color: "text-blue-400",   label: "D" },
  "docker-compose.yml": { color: "text-blue-400", label: "DC" },
  "docker-compose.yaml": { color: "text-blue-400", label: "DC" },
  "Makefile":        { color: "text-orange-300",  label: "Mk" },
  "Gemfile":         { color: "text-red-500",     label: "Gm" },
  "Rakefile":        { color: "text-red-500",     label: "Rk" },
  "package.json":    { color: "text-green-400",   label: "Np" },
  "tsconfig.json":   { color: "text-blue-400",    label: "TS" },
  "vite.config.ts":  { color: "text-purple-400",  label: "Vi" },
  "webpack.config.js": { color: "text-blue-300",  label: "Wp" },
  ".prettierrc":     { color: "text-yellow-300",  label: "Pr" },
  ".eslintrc":       { color: "text-purple-300",  label: "Es" },
  ".eslintrc.js":    { color: "text-purple-300",  label: "Es" },
  ".eslintrc.json":  { color: "text-purple-300",  label: "Es" },
  "README.md":       { color: "text-sky-300",     label: "Rm" },
  "LICENSE":         { color: "text-gray-400",    label: "Li" },
  ".gitignore":      { color: "text-gray-500",    label: ".g" },
  ".env":            { color: "text-yellow-600",  label: ".e" },
  ".env.local":      { color: "text-yellow-600",  label: ".e" },
  "requirements.txt": { color: "text-green-400",  label: "Rq" },
  "setup.py":        { color: "text-green-400",   label: "Sp" },
  "pyproject.toml":  { color: "text-green-400",   label: "Py" },
  "Cargo.toml":      { color: "text-orange-400",  label: "Cr" },
  "go.mod":          { color: "text-cyan-400",    label: "Gm" },
  "go.sum":          { color: "text-cyan-300",    label: "Gs" },
};

const FOLDER_ICON_COLORS: Record<string, string> = {
  "src":          "text-blue-400",
  "lib":          "text-blue-300",
  "dist":         "text-yellow-600",
  "build":        "text-yellow-600",
  "out":          "text-yellow-600",
  "node_modules": "text-green-700",
  "public":       "text-green-400",
  "static":       "text-green-400",
  "assets":       "text-purple-400",
  "images":       "text-purple-300",
  "img":          "text-purple-300",
  "components":   "text-blue-400",
  "pages":        "text-green-400",
  "hooks":        "text-yellow-400",
  "utils":        "text-gray-400",
  "helpers":      "text-gray-400",
  "types":        "text-blue-300",
  "styles":       "text-pink-400",
  "config":       "text-gray-400",
  "test":         "text-yellow-300",
  "tests":        "text-yellow-300",
  "__tests__":    "text-yellow-300",
  "spec":         "text-yellow-300",
  "scripts":      "text-green-300",
  "docs":         "text-sky-300",
  "electron":     "text-cyan-400",
  "integrations": "text-indigo-400",
  ".git":         "text-orange-600",
  ".github":      "text-gray-400",
  ".vscode":      "text-blue-500",
};

export function getFileIconStyle(fileName: string): FileIconStyle {
  // Check exact name match first
  if (NAME_ICON_STYLES[fileName]) return NAME_ICON_STYLES[fileName];

  // Check extension (handle .d.ts specially)
  if (fileName.endsWith(".d.ts")) return EXT_ICON_STYLES[".d.ts"];

  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex >= 0) {
    const ext = fileName.substring(dotIndex).toLowerCase();
    if (EXT_ICON_STYLES[ext]) return EXT_ICON_STYLES[ext];
  }

  return { color: "text-gray-500", label: "" };
}

export function getFolderColor(folderName: string): string {
  return FOLDER_ICON_COLORS[folderName] ?? "text-yellow-500";
}
