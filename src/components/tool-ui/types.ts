/**
 * Tool UI Block Types
 *
 * Type-safe definitions for every UI block that WASM tools can return.
 * MosAIc's ToolUIRenderer maps each block type to a React component.
 *
 * Tool developers return JSON matching these shapes.
 * MosAIc owns the rendering — tools never produce HTML.
 */

// =============================================================================
// Base
// =============================================================================

/** All block types MosAIc supports */
export type BlockType =
  | "text"
  | "markdown"
  | "code"
  | "alert"
  | "image"
  | "divider"
  | "table"
  | "card"
  | "list"
  | "chart"
  | "form"
  | "button"
  | "tabs"
  | "row"
  | "column"
  | "section";

/** Base fields shared by every block */
interface BlockBase {
  type: BlockType;
}

// =============================================================================
// Display Blocks
// =============================================================================

export type TextVariant = "heading" | "subheading" | "body" | "caption" | "label";

export interface TextBlock extends BlockBase {
  type: "text";
  content: string;
  variant?: TextVariant;
}

export interface MarkdownBlock extends BlockBase {
  type: "markdown";
  content: string;
}

export interface CodeBlock extends BlockBase {
  type: "code";
  content: string;
  language?: string;
}

export type AlertLevel = "info" | "success" | "warning" | "error";

export interface AlertBlock extends BlockBase {
  type: "alert";
  level: AlertLevel;
  title?: string;
  message: string;
}

export interface ImageBlock extends BlockBase {
  type: "image";
  /** Must be data: URI (base64). External URLs are forbidden for security. */
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface DividerBlock extends BlockBase {
  type: "divider";
}

// =============================================================================
// Data Blocks
// =============================================================================

export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
}

export interface TableBlock extends BlockBase {
  type: "table";
  title?: string;
  columns: TableColumn[];
  rows: Record<string, unknown>[];
}

export interface CardField {
  label: string;
  value: string;
}

export interface CardBlock extends BlockBase {
  type: "card";
  title?: string;
  fields: CardField[];
}

export type ListItemIcon = "info" | "success" | "warning" | "error" | "none";

export interface ListItem {
  text: string;
  icon?: ListItemIcon;
}

export interface ListBlock extends BlockBase {
  type: "list";
  ordered?: boolean;
  items: ListItem[];
}

// =============================================================================
// Chart Block
// =============================================================================

export type ChartType = "bar" | "line" | "pie" | "scatter" | "area" | "donut";

export interface ChartDataPoint {
  x: string | number;
  y: number;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
}

export interface ChartAxis {
  label?: string;
}

export interface ChartBlock extends BlockBase {
  type: "chart";
  chartType: ChartType;
  title?: string;
  xAxis?: ChartAxis;
  yAxis?: ChartAxis;
  series: ChartSeries[];
}

// =============================================================================
// Interactive Blocks
// =============================================================================

export type FormFieldType =
  | "text"
  | "number"
  | "select"
  | "multiselect"
  | "checkbox"
  | "date"
  | "textarea"
  | "slider"
  | "file";

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  defaultValue?: unknown;
  /** For select/multiselect */
  options?: string[];
  /** For slider */
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}

export interface FormSubmitAction {
  tool: string;
  server: string;
  args?: Record<string, unknown>;
}

export interface FormBlock extends BlockBase {
  type: "form";
  id: string;
  submitLabel?: string;
  submitAction: FormSubmitAction;
  fields: FormField[];
}

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export interface ButtonAction {
  tool: string;
  server: string;
  args?: Record<string, unknown>;
}

export interface ButtonBlock extends BlockBase {
  type: "button";
  label: string;
  variant?: ButtonVariant;
  action: ButtonAction;
}

// =============================================================================
// Layout Blocks
// =============================================================================

export interface TabDef {
  id: string;
  label: string;
  blocks: ToolUIBlock[];
}

export interface TabsBlock extends BlockBase {
  type: "tabs";
  tabs: TabDef[];
}

export interface RowBlock extends BlockBase {
  type: "row";
  gap?: number;
  blocks: ToolUIBlock[];
}

export interface ColumnBlock extends BlockBase {
  type: "column";
  blocks: ToolUIBlock[];
}

export interface SectionBlock extends BlockBase {
  type: "section";
  title: string;
  collapsed?: boolean;
  blocks: ToolUIBlock[];
}

// =============================================================================
// Union Type
// =============================================================================

/** Any UI block a tool can return */
export type ToolUIBlock =
  | TextBlock
  | MarkdownBlock
  | CodeBlock
  | AlertBlock
  | ImageBlock
  | DividerBlock
  | TableBlock
  | CardBlock
  | ListBlock
  | ChartBlock
  | FormBlock
  | ButtonBlock
  | TabsBlock
  | RowBlock
  | ColumnBlock
  | SectionBlock;

// =============================================================================
// Constraints
// =============================================================================

/** Maximum nesting depth for layout blocks (row, column, section, tabs) */
export const MAX_BLOCK_DEPTH = 4;

/** Maximum number of blocks in a single UI response */
export const MAX_BLOCK_COUNT = 50;
