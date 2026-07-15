// lib/toon.ts — TOON (Tabular Output Optimized for Networks) serializer
// AXI Principle #1: Token-efficient output
// Saves ~40% tokens vs JSON for the same data

export interface ToonTable {
  title: string;
  headers: string[];
  rows: string[][];
  footer?: string;
}

export interface ToonSection {
  title: string;
  items: { key: string; value: string; hint?: string }[];
}

const MAX_COL_WIDTH = 20;
const TABLE_WIDTH = 60;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}

function padAll(cols: string[], widths: number[]): string[] {
  return cols.map((c, i) => truncate(c, widths[i]).padEnd(widths[i]));
}

export function toon(table: ToonTable): string {
  if (table.rows.length === 0) {
    return `┌─ ${table.title} ${"─".repeat(Math.max(0, TABLE_WIDTH - table.title.length - 3))}┐\n` +
           `│ No data${" ".repeat(TABLE_WIDTH - 7)}│\n` +
           `└${"─".repeat(TABLE_WIDTH + 1)}┘`;
  }

  const colCount = table.headers.length;
  const allRows = [table.headers, ...table.rows];
  const widths: number[] = [];

  for (let i = 0; i < colCount; i++) {
    let max = table.headers[i]?.length || 8;
    for (const row of table.rows) {
      max = Math.max(max, row[i]?.length || 0);
    }
    widths.push(Math.min(max + 2, MAX_COL_WIDTH));
  }

  const innerWidth = widths.reduce((a, b) => a + b, 0) + (colCount - 1) * 3 + 2;
  const hr = "├" + "─".repeat(innerWidth - 2) + "┤";
  const top = "┌─ " + table.title + " " + "─".repeat(Math.max(0, innerWidth - table.title.length - 4)) + "┐";
  const bottom = "└" + "─".repeat(innerWidth - 2) + "┘";

  const lines: string[] = [top];

  // Header
  const header = "│ " + padAll(table.headers, widths).join(" │ ") + " │";
  lines.push(header);
  lines.push(hr);

  // Rows
  for (const row of table.rows) {
    const cells = row.map((c, i) => c ?? "");
    lines.push("│ " + padAll(cells, widths).join(" │ ") + " │");
  }

  // Footer
  if (table.footer) {
    lines.push(hr);
    lines.push("│ " + truncate(table.footer, innerWidth - 4).padEnd(innerWidth - 3) + "│");
  }

  lines.push(bottom);
  return lines.join("\n");
}

export function toonSection(section: ToonSection): string {
  const maxKey = Math.min(
    Math.max(...section.items.map((i) => i.key.length), 10),
    MAX_COL_WIDTH
  );
  const maxVal = Math.min(
    Math.max(...section.items.map((i) => i.value.length), 20),
    MAX_COL_WIDTH
  );

  const innerWidth = maxKey + maxVal + 5;
  const top = "┌─ " + section.title + " " + "─".repeat(Math.max(0, innerWidth - section.title.length - 4)) + "┐";
  const bottom = "└" + "─".repeat(innerWidth - 2) + "┘";

  const lines: string[] = [top];
  for (const item of section.items) {
    const k = truncate(item.key, maxKey).padEnd(maxKey);
    const v = truncate(item.value, maxVal).padEnd(maxVal);
    let line = `│ ${k} │ ${v} │`;
    if (item.hint) {
      line += ` ${truncate(item.hint, 15)}`;
    }
    lines.push(line);
  }
  lines.push(bottom);
  return lines.join("\n");
}

// AXI Principle #9: Contextual disclosure
export function nextStep(hint: string): string {
  return `→ Next: ${hint}`;
}

export function emptyState(what: string, action: string): string {
  return `┌─ ${what} ─────────────────────────────┐\n` +
         `│ 0 results${" ".repeat(35 - what.length)}│\n` +
         `├──────────────────────────────────────┤\n` +
         `│ → ${action.padEnd(35)}│\n` +
         `└──────────────────────────────────────┘`;
}
