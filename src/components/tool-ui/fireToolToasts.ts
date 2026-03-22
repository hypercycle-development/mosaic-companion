/**
 * fireToolToasts — Extract toast blocks from a tool response and fire them.
 *
 * Tools return `{ type: "toast", level, message, title?, duration? }` blocks
 * alongside other UI blocks. This helper extracts them and calls react-toastify.
 *
 * Usage:
 *   import { fireToolToasts } from "./tool-ui/fireToolToasts";
 *   fireToolToasts(responseBlocks);
 */

import { toast } from "react-toastify";
import type { ToolUIBlock, ToastBlock } from "./types";

const DEFAULT_DURATION = 4000;
const MAX_TOASTS_PER_RESPONSE = 5;

/**
 * Extract toast blocks from a tool response and display them.
 * Returns the remaining non-toast blocks for inline rendering.
 */
export function fireToolToasts(blocks: ToolUIBlock[]): ToolUIBlock[] {
  const remaining: ToolUIBlock[] = [];
  let toastCount = 0;

  for (const block of blocks) {
    if (block.type === "toast" && toastCount < MAX_TOASTS_PER_RESPONSE) {
      const t = block as ToastBlock;
      const content = t.title ? `**${t.title}**\n${t.message}` : t.message;
      const options = { autoClose: t.duration ?? DEFAULT_DURATION };

      switch (t.level) {
        case "success": toast.success(content, options); break;
        case "error":   toast.error(content, options); break;
        case "warning": toast.warning(content, options); break;
        case "info":    toast.info(content, options); break;
        default:        toast(content, options);
      }
      toastCount++;
    } else {
      remaining.push(block);
    }
  }

  return remaining;
}
