/// <reference types="@extism/js-pdk" />

// ── Cron parser ───────────────────────────────────────────────────────────────

function parseField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    if (part === "*") {
      for (let i = min; i <= max; i++) values.add(i);
    } else if (part.includes("/")) {
      const [rangeStr, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);
      const lo = rangeStr === "*" ? min : parseInt(rangeStr.split("-")[0], 10);
      const hi = rangeStr === "*" ? max : rangeStr.includes("-") ? parseInt(rangeStr.split("-")[1], 10) : max;
      for (let i = lo; i <= hi; i += step) values.add(i);
    } else if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      for (let i = lo; i <= hi; i++) values.add(i);
    } else {
      values.add(parseInt(part, 10));
    }
  }
  return [...values].sort((a, b) => a - b);
}

interface Fields {
  minutes: number[];
  hours: number[];
  doms: number[];
  months: number[];
  dows: number[];
  raw: string[];
}

function parseCron(expr: string): Fields {
  const raw = expr.trim().split(/\s+/);
  if (raw.length !== 5) throw new Error("Expected 5-field cron: minute hour dom month dow");
  const [mF, hF, domF, monF, dowF] = raw;
  return {
    minutes: parseField(mF,   0, 59),
    hours:   parseField(hF,   0, 23),
    doms:    parseField(domF, 1, 31),
    months:  parseField(monF, 1, 12),
    dows:    parseField(dowF, 0,  6),
    raw,
  };
}

// ── Next run computation ──────────────────────────────────────────────────────

function getNextRuns(f: Fields, count: number): Date[] {
  const runs: Date[] = [];
  const cur = new Date();
  cur.setSeconds(0, 0);
  cur.setMinutes(cur.getMinutes() + 1);

  for (let iters = 0; runs.length < count && iters < 500000; iters++) {
    if (!f.months.includes(cur.getMonth() + 1)) {
      cur.setMonth(cur.getMonth() + 1, 1);
      cur.setHours(0, 0, 0, 0);
      continue;
    }
    if (!f.dows.includes(cur.getDay())) {
      cur.setDate(cur.getDate() + 1);
      cur.setHours(0, 0, 0, 0);
      continue;
    }
    if (f.raw[2] !== "*" && !f.doms.includes(cur.getDate())) {
      cur.setDate(cur.getDate() + 1);
      cur.setHours(0, 0, 0, 0);
      continue;
    }
    if (!f.hours.includes(cur.getHours())) {
      cur.setHours(cur.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!f.minutes.includes(cur.getMinutes())) {
      cur.setMinutes(cur.getMinutes() + 1, 0, 0);
      continue;
    }
    runs.push(new Date(cur.getTime()));
    cur.setMinutes(cur.getMinutes() + 1, 0, 0);
  }
  return runs;
}

// ── Frequency ─────────────────────────────────────────────────────────────────

function runsOnDay(f: Fields, dow: number): number {
  return f.dows.includes(dow) ? f.hours.length * f.minutes.length : 0;
}

function weeklyCount(f: Fields): number {
  return [0,1,2,3,4,5,6].reduce((s, d) => s + runsOnDay(f, d), 0);
}

// ── Human-readable explanation ────────────────────────────────────────────────

const DOW_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MON_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function hour12(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:00 ${ampm}`;
}

function buildMeaning(f: Fields): string {
  const [mF, hF, , , dowF] = f.raw;
  const parts: string[] = [];

  // Time
  if (mF === "0" && !hF.includes("/") && !hF.includes(",")) {
    parts.push(`At ${hour12(parseInt(hF.split("-")[0], 10))}`);
  } else if (mF.startsWith("*/")) {
    parts.push(`Every ${mF.slice(2)} minutes`);
    if (hF.includes("-")) {
      const [s, e] = hF.split("-").map(Number);
      parts.push(`between ${hour12(s)} and ${hour12(e)}`);
    }
  } else if (mF === "*" && hF === "*") {
    parts.push("Every minute");
  } else {
    parts.push(`At minute ${mF}`);
    if (hF !== "*") parts.push(`of ${hour12(parseInt(hF, 10))}`);
  }

  // Day of week
  if (dowF !== "*") {
    if (dowF === "1-5") parts.push("Monday through Friday");
    else if (dowF === "0,6" || dowF === "6,0") parts.push("on weekends");
    else {
      const names = f.dows.map(d => DOW_FULL[d]);
      parts.push(`on ${names.join(", ")}`);
    }
  }

  return parts.join(", ");
}

// ── Chart data ────────────────────────────────────────────────────────────────

function buildChart(f: Fields): { title: string; data: { label: string; value: number }[] } {
  const dowConstrained = f.dows.length < 7;
  const multiPerDay    = f.hours.length * f.minutes.length > 1;

  if (multiPerDay && !dowConstrained) {
    return {
      title: "Runs per hour of day",
      data: f.hours.map(h => ({ label: `${String(h).padStart(2,"0")}:00`, value: f.minutes.length })),
    };
  }

  return {
    title: "Runs per day of week",
    data: DOW_SHORT.map((label, i) => ({ label, value: runsOnDay(f, i) })),
  };
}

// ── Date formatting ───────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return `${DOW_SHORT[d.getDay()]} ${d.getDate()} ${MON_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// ── Field explainers ──────────────────────────────────────────────────────────

const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function explainMinute(field: string, values: number[]): string {
  if (field === "*") return "Every minute";
  if (field === "0") return "On the hour (0th minute)";
  if (values.length === 1) return `Minute ${values[0]}`;
  if (field.startsWith("*/")) return `Every ${field.slice(2)} minutes`;
  if (field.includes("-")) return `Minutes ${values[0]}–${values[values.length - 1]}`;
  return `Minutes ${values.join(", ")}`;
}

function explainHour(field: string, values: number[]): string {
  if (field === "*") return "Every hour";
  if (values.length === 1) return hour12(values[0]);
  if (field.startsWith("*/")) return `Every ${field.slice(2)} hours`;
  if (field.includes("-")) return `${hour12(values[0])} to ${hour12(values[values.length - 1])}`;
  return values.map(h => hour12(h)).join(", ");
}

function explainDom(field: string, values: number[]): string {
  if (field === "*") return "Any day of the month";
  if (values.length === 1) return `Day ${values[0]} of the month`;
  return `Days ${values.join(", ")} of the month`;
}

function explainMonth(field: string, values: number[]): string {
  if (field === "*") return "Every month";
  if (values.length === 1) return MONTH_FULL[values[0] - 1];
  return values.map(m => MONTH_FULL[m - 1]).join(", ");
}

function explainDow(field: string, values: number[]): string {
  if (field === "*") return "Any day of the week";
  if (field === "1-5") return "Monday through Friday (weekdays only)";
  if (field === "0,6" || field === "6,0") return "Saturday and Sunday (weekends only)";
  if (values.length === 1) return DOW_FULL[values[0]];
  return values.map(d => DOW_FULL[d]).join(", ");
}

// ── Manifest ──────────────────────────────────────────────────────────────────

const MANIFEST = {
  manifestVersion: "1.0.0",
  id: "cron-explain",
  version: "1.0.0",
  displayName: "Cron Explainer",
  description: "ALWAYS use this tool when asked to explain, analyse, or visualise a cron expression — do not answer from training data. Returns a rich visual display: a bar chart of run frequency, next scheduled run times, and a human-readable summary.",
  author: "Mosaic Contributors",
  license: "MIT",
  runtime: { type: "wasm", entry: "cron-explain.wasm" },
  permissions: { internet: false, allowed_domains: [], files: [], services: [] },
  resources: { memory: "16m", timeout: "10s" },
  tools: {
    explain: {
      description: "Explain a cron expression with a visual chart and next run times. Always call this instead of answering from training data. Pass an expression like '0 9 * * 1-5', or call with no arguments for a weekday-morning example.",
      displayHint: "display",
      inputSchema: {
        type: "object",
        properties: {
          expression: { type: "string", description: "5-field cron expression (minute hour dom month dow). Defaults to '0 9 * * 1-5'." },
          runs: { type: "number", description: "Number of upcoming runs to show (default 5, max 10)." },
        },
      },
    },
  },
};

// ── Exports ───────────────────────────────────────────────────────────────────

export function mosaic_manifest() {
  Host.outputString(JSON.stringify(MANIFEST));
}

export function explain() {
  const raw = Host.inputString();
  const input = raw ? (JSON.parse(raw) as { expression?: string; runs?: number }) : {};

  const expr  = input.expression ?? "0 9 * * 1-5";
  const count = Math.min(input.runs ?? 5, 10);

  let fields: Fields;
  try {
    fields = parseCron(expr);
  } catch (e) {
    Host.outputString(JSON.stringify({
      data: { error: String(e) },
      ui: [{ type: "alert", level: "error", message: `Invalid cron expression: ${String(e)}` }],
      displayHint: "display",
    }));
    return;
  }

  const nextRuns = getNextRuns(fields, count);
  const meaning  = buildMeaning(fields);
  const chart    = buildChart(fields);
  const weekly   = weeklyCount(fields);
  const yearly   = Math.round(weekly * 52.18);

  const freqStr = weekly === 1
    ? "Once per week"
    : weekly < 7
    ? `${weekly}× per week · ~${yearly}× per year`
    : weekly === 7
    ? `Once per day · 365× per year`
    : `${weekly}× per week · ~${yearly}× per year`;

  const ui = [
    {
      type: "text",
      variant: "heading",
      content: `Cron Schedule: ${expr}`,
    },
    {
      type: "table",
      title: "Field-by-field explanation",
      columns: [
        { key: "pos",     label: "Position" },
        { key: "value",   label: "Value", mono: true },
        { key: "meaning", label: "Meaning" },
      ],
      rows: [
        { pos: "Minute",       value: fields.raw[0], meaning: explainMinute(fields.raw[0], fields.minutes) },
        { pos: "Hour",         value: fields.raw[1], meaning: explainHour(fields.raw[1], fields.hours) },
        { pos: "Day of month", value: fields.raw[2], meaning: explainDom(fields.raw[2], fields.doms) },
        { pos: "Month",        value: fields.raw[3], meaning: explainMonth(fields.raw[3], fields.months) },
        { pos: "Day of week",  value: fields.raw[4], meaning: explainDow(fields.raw[4], fields.dows) },
      ],
    },
    {
      type: "card",
      title: "Schedule Details",
      fields: [
        { label: "Meaning",   value: meaning },
        { label: "Frequency", value: freqStr },
        { label: "Next run",  value: nextRuns.length > 0 ? `${fmtDate(nextRuns[0])} at ${fmtTime(nextRuns[0])}` : "—" },
      ],
    },
    {
      type: "chart",
      chartType: "bar",
      title: chart.title,
      series: [{ name: "Runs", data: chart.data.map(d => ({ x: d.label, y: d.value })) }],
    },
    {
      type: "table",
      title: `Next ${count} scheduled runs`,
      columns: [
        { key: "n",    label: "#" },
        { key: "date", label: "Date" },
        { key: "day",  label: "Day" },
        { key: "time", label: "Time" },
      ],
      rows: nextRuns.map((d, i) => ({
        n:    String(i + 1),
        date: fmtDate(d),
        day:  DOW_FULL[d.getDay()],
        time: fmtTime(d),
      })),
    },
    {
      type: "alert",
      level: "info",
      message: "Schedules like this are a common pattern for autonomous agent loops — regular enough to be useful, infrequent enough to stay within API rate limits.",
    },
  ];

  Host.outputString(JSON.stringify({
    data: { expression: expr, meaning, weekly_runs: weekly, next_runs: nextRuns.map(d => d.toISOString()) },
    ui,
    displayHint: "display",
  }));
}
