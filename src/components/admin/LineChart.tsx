"use client";

import { useLayoutEffect, useRef, useState } from "react";

export interface LineSeries {
  key: string;
  label: string;
  /** CSS custom property name holding the series color. */
  colorVar: string;
}

/**
 * Formats are named rather than passed as functions: the callers are server
 * components, and functions can't cross the server/client boundary.
 */
export type ValueFormat = "number" | "percent";
export type XFormat = "date" | "raw";

export interface LineChartProps {
  data: Record<string, string | number | null>[];
  xKey: string;
  series: LineSeries[];
  height?: number;
  /** Horizontal reference lines — targets read as context, not as data. */
  targets?: { value: number; label: string }[];
  valueFormat?: ValueFormat;
  xFormat?: XFormat;
  /** Renders a fill wash under a single series. */
  area?: boolean;
}

function makeValueFormatter(f: ValueFormat) {
  return (n: number) => (f === "percent" ? `${n}%` : n.toLocaleString());
}

function makeXFormatter(f: XFormat) {
  return (x: string) =>
    f === "date"
      ? new Date(x).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : x;
}

const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width)
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  return ticks;
}

export function LineChart({
  data,
  xKey,
  series,
  height = 240,
  targets = [],
  valueFormat = "number",
  xFormat = "raw",
  area = false,
}: LineChartProps) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const formatValue = makeValueFormatter(valueFormat);
  const formatX = makeXFormatter(xFormat);

  const innerW = Math.max(width - PAD.left - PAD.right, 0);
  const innerH = height - PAD.top - PAD.bottom;

  const values = data.flatMap((d) =>
    series.map((s) => Number(d[s.key] ?? 0))
  );
  const rawMax = Math.max(...values, ...targets.map((t) => t.value), 0);
  const ticks = niceTicks(rawMax);
  const max = ticks[ticks.length - 1] || 1;

  const x = (i: number) =>
    data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW;
  const y = (v: number) => innerH - (v / max) * innerH;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!data.length || innerW <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - PAD.left;
    const i = Math.round((px / innerW) * (data.length - 1));
    setHover(Math.min(Math.max(i, 0), data.length - 1));
  }

  const point = hover !== null ? data[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        >
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={0}
                  x2={innerW}
                  y1={y(t)}
                  y2={y(t)}
                  className="viz-grid"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={-8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="viz-axis-text"
                >
                  {formatValue(t)}
                </text>
              </g>
            ))}

            {targets.map((t) => (
              <g key={t.label}>
                <line
                  x1={0}
                  x2={innerW}
                  y1={y(t.value)}
                  y2={y(t.value)}
                  className="viz-target"
                  vectorEffect="non-scaling-stroke"
                />
                {/* Left-anchored: series usually end high on the right, where a
                    right-anchored label would sit under the line and end marker. */}
                <text x={2} y={y(t.value) - 5} textAnchor="start" className="viz-axis-text">
                  {t.label}
                </text>
              </g>
            ))}

            {series.map((s) => {
              const pts = data.map((d, i) => `${x(i)},${y(Number(d[s.key] ?? 0))}`);
              return (
                <g key={s.key}>
                  {area && data.length > 1 && (
                    <polygon
                      points={`0,${innerH} ${pts.join(" ")} ${innerW},${innerH}`}
                      fill={`var(${s.colorVar})`}
                      opacity={0.1}
                    />
                  )}
                  <polyline
                    points={pts.join(" ")}
                    fill="none"
                    stroke={`var(${s.colorVar})`}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* End marker with a surface ring so it stays legible on crossings. */}
                  {data.length > 0 && (
                    <circle
                      cx={x(data.length - 1)}
                      cy={y(Number(data[data.length - 1][s.key] ?? 0))}
                      r={4}
                      fill={`var(${s.colorVar})`}
                      className="viz-marker-ring"
                    />
                  )}
                </g>
              );
            })}

            {hover !== null && (
              <g>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={0}
                  y2={innerH}
                  className="viz-crosshair"
                  vectorEffect="non-scaling-stroke"
                />
                {series.map((s) => (
                  <circle
                    key={s.key}
                    cx={x(hover)}
                    cy={y(Number(data[hover][s.key] ?? 0))}
                    r={4}
                    fill={`var(${s.colorVar})`}
                    className="viz-marker-ring"
                  />
                ))}
              </g>
            )}

            {data.length > 0 && (
              <>
                <text x={0} y={innerH + 18} textAnchor="start" className="viz-axis-text">
                  {formatX(String(data[0][xKey]))}
                </text>
                <text x={innerW} y={innerH + 18} textAnchor="end" className="viz-axis-text">
                  {formatX(String(data[data.length - 1][xKey]))}
                </text>
              </>
            )}
          </g>
        </svg>
      )}

      {point && (
        <div
          className="pointer-events-none absolute top-2 rounded-[--radius-xs] border border-subtle bg-surface-base px-2 py-1 text-xs shadow-sm"
          style={{
            left: Math.min(
              Math.max(PAD.left + x(hover!) - 60, 0),
              Math.max(width - 132, 0)
            ),
          }}
        >
          <div className="text-secondary">{formatX(String(point[xKey]))}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-primary">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: `var(${s.colorVar})` }}
              />
              <span>{s.label}</span>
              <span className="ml-auto tabular-nums">
                {formatValue(Number(point[s.key] ?? 0))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
