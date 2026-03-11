import React from "react";
import type { TableBlock } from "../types";

export const ToolTable: React.FC<TableBlock> = ({ title, columns, rows }) => (
  <div className="rounded-lg border border-gray-700 overflow-hidden">
    {title && (
      <div className="px-3 py-2 bg-gray-800 text-sm font-medium text-gray-200 border-b border-gray-700">
        {title}
      </div>
    )}
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 font-medium text-gray-400 text-${col.align ?? "left"} border-b border-gray-700`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-800 last:border-b-0 hover:bg-gray-800/30">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-2 text-gray-300 text-${col.align ?? "left"}`}
                >
                  {String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
