import type { ReactNode } from "react";

export type Tone = "neutral" | "good" | "warning" | "critical";

/** Icon + label, never color alone — status has to survive a CVD reader. */
const TONE_MARK: Record<Exclude<Tone, "neutral">, { icon: string; label: string }> = {
  good: { icon: "●", label: "on target" },
  warning: { icon: "▲", label: "below target" },
  critical: { icon: "■", label: "off target" },
};

export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function StatTile({
  label,
  value,
  unit,
  context,
  tone = "neutral",
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  /** What the number should be, so a reader who isn't in the weeds can judge it. */
  context?: string;
  tone?: Tone;
  children?: ReactNode;
}) {
  const mark = tone === "neutral" ? null : TONE_MARK[tone];

  return (
    <div className="flex flex-col gap-1 rounded-[--radius-md] border border-subtle bg-surface-base p-4">
      <div className="text-xs text-secondary">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-primary">{value}</span>
        {unit && <span className="text-sm text-secondary">{unit}</span>}
      </div>
      {mark && (
        <div className={`flex items-center gap-1 text-xs viz-tone-${tone}`}>
          <span aria-hidden="true">{mark.icon}</span>
          <span>{mark.label}</span>
        </div>
      )}
      {context && <div className="text-xs text-tertiary">{context}</div>}
      {children}
    </div>
  );
}
