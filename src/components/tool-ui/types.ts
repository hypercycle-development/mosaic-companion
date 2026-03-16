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
  | "section"
  | "stat-card"
  | "badge"
  | "detail-panel"
  | "confirm-modal";

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
  /** Color for the text */
  color?: CellColor;
  /** Render in monospace */
  mono?: boolean;
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

/** Named color tokens for cell formatting */
export type CellColor = "green" | "red" | "yellow" | "blue" | "purple" | "cyan" | "gray";

export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  /** Apply a color to all cells in this column (overridden by per-cell colors) */
  color?: CellColor;
  /** Render cells in this column as monospace */
  mono?: boolean;
}

/** Per-cell color override: cellColors[rowIndex][columnKey] */
export type CellColorMap = Record<number, Record<string, CellColor>>;

export interface TableBlock extends BlockBase {
  type: "table";
  title?: string;
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  /** Per-cell color overrides */
  cellColors?: CellColorMap;
  /** Show a search input that filters rows client-side */
  searchable?: boolean;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Action template fired when a row is clicked. Row data is merged into action.args. */
  onRowClick?: ButtonAction;
}

export interface CardField {
  label: string;
  value: string;
  /** Optional icon name (rendered via lucide-react) */
  icon?: "download" | "star" | "clock" | "check" | "info" | "warning" | "shield" | "globe" | "cpu" | "database" | "zap" | "hash";
  /** Color the value text */
  color?: CellColor;
  /** Color the icon (defaults to color if set, otherwise gray) */
  iconColor?: CellColor;
}

export interface CardBlock extends BlockBase {
  type: "card";
  title?: string;
  /** Color for the title text */
  titleColor?: CellColor;
  /** Render title in monospace */
  titleMono?: boolean;
  /** Subtitle shown right-aligned in the title row (e.g. "ID: 84006") */
  subtitle?: string;
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

/**
 * Where the result of an action should render.
 * - "inline"  (default): re-render the current panel in place.
 * - "sidebar": render the result in the right detail sidebar.
 * - "modal":   show a confirmation modal before executing.
 */
export type ActionTarget = "inline" | "sidebar" | "modal";

export interface ButtonAction {
  tool: string;
  server: string;
  args?: Record<string, unknown>;
  /** Where the tool's response should render. Default: "inline". */
  target?: ActionTarget;
}

export interface ButtonBlock extends BlockBase {
  type: "button";
  label: string;
  variant?: ButtonVariant;
  action: ButtonAction;
}

// =============================================================================
// Stat Card Block
// =============================================================================

/** Trend data point for sparkline in stat cards */
export interface TrendPoint {
  value: number;
}

export type StatCardColor = "blue" | "green" | "red" | "yellow" | "purple" | "cyan" | "gray";

export interface StatCardBlock extends BlockBase {
  type: "stat-card";
  /** Main label (e.g. "Active AIMs") */
  label: string;
  /** Big number or value string */
  value: string;
  /** Smaller subtext below the value */
  subtext?: string;
  /** Accent color theme */
  color?: StatCardColor;
  /** Optional sparkline trend data */
  trend?: TrendPoint[];
  /** Icon for the card */
  icon?: "cpu" | "database" | "globe" | "zap" | "server" | "activity" | "layers" | "box" | "shield" | "hash";
  /** Tooltip text shown on hover (via info icon) */
  tooltip?: string;
}

// =============================================================================
// Badge Block
// =============================================================================

export type BadgeColor = "blue" | "green" | "red" | "yellow" | "purple" | "cyan" | "gray";

export interface BadgeBlock extends BlockBase {
  type: "badge";
  label: string;
  color?: BadgeColor;
  icon?: "download" | "star" | "clock" | "check" | "info" | "warning" | "zap" | "globe" | "hash";
}

// =============================================================================
// Layout Blocks
// =============================================================================

export type TabIcon = "server" | "zap" | "cpu" | "activity" | "trophy" | "chart" | "globe" | "database" | "layers" | "box" | "shield" | "hash";

export interface TabDef {
  id: string;
  label: string;
  /** Optional icon rendered before the label */
  icon?: TabIcon;
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
  /** When true, children flow inline without stretching to equal widths */
  inline?: boolean;
}

export interface ColumnBlock extends BlockBase {
  type: "column";
  blocks: ToolUIBlock[];
}

export interface SectionBlock extends BlockBase {
  type: "section";
  title: string;
  /** Subtitle shown below the title */
  subtitle?: string;
  collapsed?: boolean;
  /** Icon name for the section header */
  icon?: TabIcon;
  /** Icon color class (e.g. "text-orange-500") */
  iconColor?: string;
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
  | SectionBlock
  | StatCardBlock
  | BadgeBlock
  | DetailPanelBlock
  | ConfirmModalBlock;

// =============================================================================
// Detail Panel Block (right sidebar)
// =============================================================================

/**
 * A detail panel block that renders in a right-side drawer/sidebar.
 * Returned by tools when an action has target: "sidebar", or directly
 * as a top-level block with type "detail-panel".
 *
 * The tool provides a title, optional subtitle, and child blocks.
 * MosAIc owns the slide-in animation, close button, and overlay.
 */
export interface DetailPanelBlock extends BlockBase {
  type: "detail-panel";
  /** Title shown in the sidebar header */
  title: string;
  /** Optional subtitle (e.g. ID, status badge text) */
  subtitle?: string;
  /** Width of the sidebar: "narrow" (384px), "medium" (480px), "wide" (640px) */
  width?: "narrow" | "medium" | "wide";
  /** Child blocks rendered inside the sidebar body */
  blocks: ToolUIBlock[];
}

// =============================================================================
// Confirm Modal Block
// =============================================================================

/**
 * A confirmation modal that asks the user to approve or reject an action.
 * Tools return this when they need explicit user consent before proceeding
 * (e.g. "Confirm this transaction?", "Delete this item?").
 *
 * - confirmAction: fired when the user clicks Confirm
 * - cancelAction:  fired when the user clicks Cancel (optional — default just closes)
 */
export interface ConfirmModalBlock extends BlockBase {
  type: "confirm-modal";
  /** Modal title (e.g. "Confirm Transaction") */
  title: string;
  /** Descriptive message explaining what will happen */
  message: string;
  /** Optional severity for visual styling: "info" | "warning" | "danger" */
  severity?: "info" | "warning" | "danger";
  /** Detail blocks shown between the message and the action buttons */
  details?: ToolUIBlock[];
  /** Label for the confirm button (default: "Confirm") */
  confirmLabel?: string;
  /** Label for the cancel button (default: "Cancel") */
  cancelLabel?: string;
  /** Action triggered on confirm */
  confirmAction: ButtonAction;
  /** Action triggered on cancel (optional — default just closes the modal) */
  cancelAction?: ButtonAction;
}

// =============================================================================
// Constraints
// =============================================================================

/** Maximum nesting depth for layout blocks (row, column, section, tabs) */
export const MAX_BLOCK_DEPTH = 6;

/** Maximum number of blocks in a single UI response */
export const MAX_BLOCK_COUNT = 50;
