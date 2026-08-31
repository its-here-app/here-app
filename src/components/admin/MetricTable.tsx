import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  /** Right-aligned + tabular by default; set false for label columns. */
  numeric?: boolean;
  render: (row: T) => ReactNode;
}

export function MetricTable<T>({
  columns,
  rows,
  empty = "No data yet.",
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  caption?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-secondary">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        {caption && (
          <caption className="pb-2 text-left text-xs text-tertiary">
            {caption}
          </caption>
        )}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={`border-b border-subtle pb-2 text-xs font-normal text-secondary ${
                  c.numeric === false ? "text-left" : "text-right"
                }`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={`border-b border-subtle py-2 text-primary ${
                    c.numeric === false
                      ? "text-left"
                      : "text-right tabular-nums"
                  }`}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-[--radius-md] border border-subtle bg-surface-base p-4">
      <div>
        <h2 className="text-base font-semibold text-primary">{title}</h2>
        {subtitle && <p className="text-xs text-secondary">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
