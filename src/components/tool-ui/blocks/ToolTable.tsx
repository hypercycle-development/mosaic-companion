import React, { useState, useMemo, useCallback } from "react";
import { Search } from "lucide-react";
import type { TableBlock, CellColor, ButtonAction } from "../types";

const CELL_COLOR_CLASSES: Record<CellColor, string> = {
  green:  "text-green-400",
  red:    "text-red-400",
  yellow: "text-yellow-400",
  blue:   "text-blue-400",
  purple: "text-purple-400",
  cyan:   "text-cyan-400",
  gray:   "text-gray-500",
};

export type TableActionHandler = (action: ButtonAction, args: Record<string, unknown>) => Promise<void>;

export const ToolTable: React.FC<TableBlock & { onAction?: TableActionHandler }> = ({ title, columns, rows, cellColors, searchable, searchPlaceholder, onRowClick, onAction }) => {
  const [query, setQuery] = useState("");

  // Filter rows by search query (case-insensitive, matches any column)
  const filteredRows = useMemo(() => {
    if (!searchable || !query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) =>
      columns.some((col) => String(row[col.key] ?? "").toLowerCase().includes(q))
    );
  }, [rows, columns, query, searchable]);

  // Remap cellColors indices to filtered rows
  const filteredCellColors = useMemo(() => {
    if (!cellColors || !searchable || !query.trim()) return cellColors;
    const mapping: typeof cellColors = {};
    let fi = 0;
    for (let ri = 0; ri < rows.length; ri++) {
      if (filteredRows.includes(rows[ri])) {
        if (cellColors[ri]) mapping[fi] = cellColors[ri];
        fi++;
      }
    }
    return mapping;
  }, [cellColors, filteredRows, rows, searchable, query]);

  const clickable = !!onRowClick && !!onAction;

  const handleRowClick = useCallback((row: Record<string, unknown>) => {
    if (!onRowClick || !onAction) return;
    const mergedArgs = { ...onRowClick.args, ...row };
    onAction(onRowClick, mergedArgs);
  }, [onRowClick, onAction]);

  return (
    <div className="rounded-lg border border-gray-700 overflow-hidden">
      {(title || searchable) && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-800 border-b border-gray-700">
          {title && <span className="text-sm font-semibold text-gray-200">{title}</span>}
          {searchable && (
            <div className="relative flex-shrink-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder ?? "Search..."}
                className="pl-9 pr-3 py-1.5 text-sm rounded-md bg-gray-900 border border-gray-700 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-500 w-52"
              />
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/60">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 font-semibold text-gray-400 text-${col.align ?? "left"} border-b border-gray-700`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, ri) => (
              <tr
                key={ri}
                className={`border-b border-gray-800 last:border-b-0 hover:bg-gray-800/30${clickable ? " cursor-pointer" : ""}`}
                onClick={clickable ? () => handleRowClick(row) : undefined}
              >
                {columns.map((col) => {
                  const cc = filteredCellColors ?? cellColors;
                  const cellColor = cc?.[ri]?.[col.key] ?? col.color;
                  const colorClass = cellColor ? CELL_COLOR_CLASSES[cellColor] : "text-gray-300";
                  const monoClass = col.mono ? " font-mono" : "";
                  return (
                    <td
                      key={col.key}
                      className={`px-4 py-2.5 text-${col.align ?? "left"} ${colorClass}${monoClass}`}
                    >
                      {String(row[col.key] ?? "")}
                    </td>
                  );
                })}
              </tr>
            ))}
            {searchable && filteredRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-4 text-center text-xs text-gray-500">
                  No matching rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
