import { notFound } from "next/navigation";
import { getMetrics, requireAdmin } from "@/lib/admin/metrics";
import { StatTile, formatCompact, type Tone } from "@/components/admin/StatTile";
import { LineChart } from "@/components/admin/LineChart";
import { BarChart } from "@/components/admin/BarChart";
import { MetricTable, Section } from "@/components/admin/MetricTable";

// Metrics should never be served from a cache — the point is watching them move.
export const dynamic = "force-dynamic";

const SERIES_1 = "--viz-series-1";
const SERIES_2 = "--viz-series-2";

function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `${n}%`;
}

function num(n: number | null | undefined, digits = 2): string {
  return n === null || n === undefined ? "—" : n.toFixed(digits);
}

/** Bands come from the launch targets, so a tile reads as pass/fail on its own. */
function band(
  value: number | null | undefined,
  good: number,
  warn: number
): Tone {
  if (value === null || value === undefined) return "neutral";
  if (value >= good) return "good";
  if (value >= warn) return "warning";
  return "critical";
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function hoursLabel(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} hr`;
  return `${(h / 24).toFixed(1)} days`;
}

export default async function AdminMetricsPage() {
  const adminId = await requireAdmin();
  // 404 rather than 403 — no reason to confirm the route exists.
  if (!adminId) notFound();

  const m = await getMetrics(60);
  const o = m.overview;

  const latestNorthStar = m.northStar[m.northStar.length - 1] ?? null;
  const northStarTone = band(latestNorthStar?.pct_of_wau, 40, 20);

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-6 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-primary">Launch metrics</h1>
          <p className="text-xs text-secondary">
            Live from Postgres. Refresh to update.
          </p>
        </div>
        <span className="text-xs text-tertiary">
          {new Date().toLocaleString()}
        </span>
      </header>

      {m.errors.length > 0 && (
        <div className="rounded-[--radius-md] border border-subtle bg-surface-base p-4">
          <p className="text-sm viz-tone-critical">
            ■ Some metrics failed to load — the numbers below are incomplete.
          </p>
          <ul className="mt-1 list-disc pl-5 text-xs text-secondary">
            {m.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── North star ─────────────────────────────────────────────────── */}
      <Section
        title="Weekly trusted discoveries"
        subtitle="Unique users per week who saved a place surfaced by another person, as a share of weekly active users. Above 40% the social layer is the primary mode; below 20% it isn't."
      >
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-5xl font-semibold text-primary">
              {pct(latestNorthStar?.pct_of_wau)}
            </div>
            <div className={`mt-1 text-xs viz-tone-${northStarTone}`}>
              {northStarTone === "good" && "● above the 40% bar"}
              {northStarTone === "warning" && "▲ between 20% and 40%"}
              {northStarTone === "critical" && "■ below 20%"}
              {northStarTone === "neutral" && ""}
            </div>
          </div>
          <div className="text-xs text-secondary">
            <div>
              {latestNorthStar?.trusted_discoverers ?? 0} of{" "}
              {latestNorthStar?.weekly_active_users ?? 0} weekly active users
            </div>
            <div className="text-tertiary">
              week of{" "}
              {latestNorthStar ? shortDate(latestNorthStar.week) : "—"}
            </div>
          </div>
        </div>

        <LineChart
          data={m.northStar as unknown as Record<string, string | number | null>[]}
          xKey="week"
          series={[
            { key: "pct_of_wau", label: "Trusted discoveries / WAU", colorVar: SERIES_1 },
          ]}
          area
          height={220}
          targets={[
            { value: 40, label: "40% target" },
            { value: 20, label: "20% floor" },
          ]}
          valueFormat="percent"
          xFormat="date"
        />
      </Section>

      {/* ── Key metrics vs targets ─────────────────────────────────────── */}
      <Section
        title="Key metrics"
        subtitle="Targets from the launch plan."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Lists per user"
            value={num(o?.avg_lists_per_user)}
            context="target 3"
            tone={band(o?.avg_lists_per_user, 3, 1.5)}
          />
          <StatTile
            label="Users creating lists"
            value={pct(o?.pct_users_with_a_list)}
            context="target 40–60%"
            tone={band(o?.pct_users_with_a_list, 40, 20)}
          />
          <StatTile
            label="Users saving from others"
            value={pct(o?.pct_users_with_social_save)}
            context="target 60–70%"
            tone={band(o?.pct_users_with_social_save, 60, 30)}
          />
          <StatTile
            label="Users sharing lists"
            value={pct(o?.pct_users_sharing)}
            context="target 20–30%; public lists"
            tone={band(o?.pct_users_sharing, 20, 10)}
          />
          <StatTile
            label="Social saves per user"
            value={num(o?.avg_social_saves_per_user)}
            context="target 5"
            tone={band(o?.avg_social_saves_per_user, 5, 2)}
          />
          <StatTile
            label="High quality lists"
            value={formatCompact(o?.quality_lists)}
            context="target 50–100; 5+ spots"
            tone={band(o?.quality_lists, 50, 20)}
          />
          <StatTile
            label="City curators"
            value={formatCompact(o?.city_curators)}
            context="target 50–100; 1+ public quality list"
            tone={band(o?.city_curators, 50, 20)}
          />
          <StatTile
            label="Users with 20+ saves"
            value={pct(o?.pct_users_20plus_saves)}
            context="depth of engagement"
          />
        </div>
      </Section>

      {/* ── Totals ─────────────────────────────────────────────────────── */}
      <Section title="Totals">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Total users"
            value={formatCompact(o?.total_users)}
            context={`${o?.new_users_7d ?? 0} in the last 7 days`}
          />
          <StatTile
            label="Lists"
            value={formatCompact(o?.total_lists)}
            context={`${o?.public_lists ?? 0} public`}
          />
          <StatTile
            label="Spot saves"
            value={formatCompact(o?.total_spot_saves)}
            context={`${num(o?.avg_saves_per_user)} per user`}
          />
          <StatTile
            label="Time to first list"
            value={hoursLabel(o?.median_hours_to_first_list)}
            context="median, signup → first list"
          />
        </div>
      </Section>

      {/* ── Growth ─────────────────────────────────────────────────────── */}
      <Section title="Signups and activity" subtitle="Last 60 days.">
        {/* Single series — the heading names it, so no legend box. */}
        <h3 className="text-xs text-secondary">Signups</h3>
        <LineChart
          data={m.daily as unknown as Record<string, string | number | null>[]}
          xKey="day"
          series={[{ key: "signups", label: "Signups", colorVar: SERIES_1 }]}
          area
          xFormat="date"
        />

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xs text-secondary">Lists and saves</h3>
          <div className="flex items-center gap-4 text-xs text-secondary">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-4 rounded-full"
                style={{ background: `var(${SERIES_1})` }}
              />
              Lists created
            </span>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-4 rounded-full"
                style={{ background: `var(${SERIES_2})` }}
              />
              Spot saves
            </span>
          </div>
        </div>
        <LineChart
          data={m.daily as unknown as Record<string, string | number | null>[]}
          xKey="day"
          series={[
            { key: "lists_created", label: "Lists created", colorVar: SERIES_1 },
            { key: "spot_saves", label: "Spot saves", colorVar: SERIES_2 },
          ]}
          xFormat="date"
        />
      </Section>

      {/* ── Discovery mix ──────────────────────────────────────────────── */}
      <Section
        title="Where saves come from"
        subtitle="Attribution starts 16 Aug 2026. Earlier saves are unattributed and excluded from social metrics rather than guessed at."
      >
        <BarChart
          rows={m.discovery.map((d) => ({
            label: d.source.replace(/_/g, " "),
            value: d.saves,
            note:
              d.social_saves > 0
                ? `${d.social_saves} attributable to a person`
                : undefined,
          }))}
        />
      </Section>

      {/* ── Activation ─────────────────────────────────────────────────── */}
      <Section
        title="Activation by signup week"
        subtitle="Targets: 70% following 3+ in the first 24h, 40% with a social save in week 1, first social save under 5 minutes."
      >
        <MetricTable
          rows={m.activation}
          columns={[
            { header: "Cohort", numeric: false, render: (r) => shortDate(r.cohort_week) },
            { header: "Users", render: (r) => r.cohort_size },
            { header: "Following 3+ in 24h", render: (r) => pct(r.pct_following_3plus_in_24h) },
            { header: "Social save wk 1", render: (r) => pct(r.pct_social_save_week1) },
            { header: "Created a list", render: (r) => pct(r.pct_created_a_list) },
            {
              header: "Median → first social save",
              render: (r) =>
                r.median_minutes_to_first_social_save === null
                  ? "—"
                  : `${r.median_minutes_to_first_social_save} min`,
            },
          ]}
        />
      </Section>

      {/* ── Retention ──────────────────────────────────────────────────── */}
      <Section
        title="Retention by signup month"
        subtitle="Active = any save, list, or follow in the window. Percentages count only users old enough to have reached the milestone, so young cohorts read as — rather than 0%."
      >
        <MetricTable
          rows={m.retention}
          columns={[
            {
              header: "Cohort",
              numeric: false,
              render: (r) =>
                new Date(r.cohort_month).toLocaleDateString(undefined, {
                  month: "short",
                  year: "numeric",
                }),
            },
            { header: "Size", render: (r) => r.cohort_size },
            {
              header: "M1",
              render: (r) =>
                r.eligible_m1 === 0 ? "—" : pct(r.m1_retention_pct),
            },
            {
              header: "M3",
              render: (r) =>
                r.eligible_m3 === 0 ? "—" : pct(r.m3_retention_pct),
            },
            {
              header: "M6",
              render: (r) =>
                r.eligible_m6 === 0 ? "—" : pct(r.m6_retention_pct),
            },
          ]}
        />
      </Section>

      {/* ── The thesis test ────────────────────────────────────────────── */}
      <Section
        title="Does a social save in week 1 change retention?"
        subtitle="If these two rows aren't dramatically separated, the social thesis needs revisiting. Only cohorts older than 60 days are included."
      >
        <MetricTable
          rows={m.socialSplit}
          empty="No cohort is 60 days old yet."
          columns={[
            {
              header: "Week 1 social save",
              numeric: false,
              render: (r) => (r.had_social_save_week1 ? "Yes" : "No"),
            },
            { header: "Users", render: (r) => r.users },
            { header: "M1 retention", render: (r) => pct(r.m1_retention_pct) },
          ]}
        />
      </Section>

      {/* ── Cities ─────────────────────────────────────────────────────── */}
      <Section
        title="Cities"
        subtitle="Where the user base is, and where demand has no content behind it."
      >
        <MetricTable
          rows={m.cities}
          columns={[
            { header: "City", numeric: false, render: (r) => r.display_name },
            { header: "Users", render: (r) => r.users },
            { header: "Lists", render: (r) => r.lists },
            { header: "Quality lists", render: (r) => r.quality_lists },
            { header: "Curators", render: (r) => r.curators },
            {
              header: "Content gap",
              render: (r) =>
                r.content_gap ? (
                  <span className="viz-tone-warning">▲ yes</span>
                ) : (
                  ""
                ),
            },
          ]}
        />
      </Section>

      {/* ── What this page can't tell you ──────────────────────────────── */}
      <Section
        title="Not instrumented yet"
        subtitle="Listed so an absent number isn't read as a zero."
      >
        <ul className="list-disc pl-5 text-sm text-secondary">
          <li>Session length and true active-user counts — activity here is a proxy built from saves, lists, and follows, not sessions.</li>
          <li>Spot click-through rate, and directions taps.</li>
          <li>Create-flow starts that never finish.</li>
          <li>Empty-feed rate and which city it happened in.</li>
          <li>
            First-touch attribution — saves are tagged with the surface they
            happened on, which is a close but not identical proxy for where a
            place was first encountered.
          </li>
        </ul>
      </Section>
    </main>
  );
}
