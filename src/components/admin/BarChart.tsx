"use client";

import { useState } from "react";

export interface BarRow {
  label: string;
  value: number;
  /** Optional secondary count shown in the tooltip, e.g. how many were social. */
  note?: string;
}

/**
 * Horizontal bars, single hue. Discovery mix is a magnitude comparison across
 * ordered categories, not identity — one color plus direct labels reads better
 * than a categorical palette, and sidesteps a 6-hue CVD problem entirely.
 */
export function BarChart({ rows }: { rows: BarRow[] }) {
  const formatValue = (n: number) => n.toLocaleString();
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...rows.map((r) => r.value), 1);

  if (rows.length === 0) {
    return <p className="text-sm text-secondary">No saves recorded yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div
          key={r.label}
          className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3"
          onMouseEnter={() => setHover(r.label)}
          onMouseLeave={() => setHover(null)}
          title={r.note}
        >
          <span className="truncate text-xs text-secondary">{r.label}</span>
          <div className="h-4">
            <div
              className="h-4 rounded-r-[4px] transition-[width]"
              style={{
                width: `${Math.max((r.value / max) * 100, r.value > 0 ? 1 : 0)}%`,
                background: "var(--viz-series-1)",
                opacity: hover && hover !== r.label ? 0.55 : 1,
              }}
            />
          </div>
          <span className="text-xs tabular-nums text-primary">
            {formatValue(r.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
