import React from "react";
import type { TextBlock, CellColor } from "../types";

const VARIANT_CLASSES: Record<string, string> = {
  heading: "text-xl font-bold text-gray-100",
  subheading: "text-lg font-semibold text-gray-200",
  body: "text-base text-gray-300",
  caption: "text-sm text-gray-400",
  label: "text-sm font-semibold uppercase tracking-wide text-gray-500",
};

const COLOR_CLASSES: Record<CellColor, string> = {
  green: "text-green-400", red: "text-red-400", yellow: "text-yellow-400",
  blue: "text-blue-400", purple: "text-purple-400", cyan: "text-cyan-400", gray: "text-gray-500",
};

export const ToolText: React.FC<TextBlock> = ({ content, variant = "body", color, mono }) => {
  let cls = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.body;
  if (color) cls = cls.replace(/text-gray-\d+/, COLOR_CLASSES[color] ?? "");
  if (mono) cls += " font-mono";
  return <p className={cls}>{content}</p>;
};
