import React from "react";
import type { TextBlock } from "../types";

const VARIANT_CLASSES: Record<string, string> = {
  heading: "text-lg font-semibold text-gray-100",
  subheading: "text-base font-medium text-gray-200",
  body: "text-sm text-gray-300",
  caption: "text-xs text-gray-400",
  label: "text-xs font-medium uppercase tracking-wide text-gray-500",
};

export const ToolText: React.FC<TextBlock> = ({ content, variant = "body" }) => (
  <p className={VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.body}>{content}</p>
);
