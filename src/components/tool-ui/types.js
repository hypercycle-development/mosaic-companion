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
// Constraints
// =============================================================================
/** Maximum nesting depth for layout blocks (row, column, section, tabs) */
export const MAX_BLOCK_DEPTH = 6;
/** Maximum number of blocks in a single UI response */
export const MAX_BLOCK_COUNT = 50;
