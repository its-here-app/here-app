import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Here* — internal metrics",
  robots: { index: false, follow: false },
};

/**
 * Chart tokens. Series colors are the brand blue paired with orange; the pair
 * clears the lightness band, chroma floor, CVD separation, normal-vision floor
 * and 3:1 contrast against both #ffffff and #000000. Neon is the brand accent
 * but is far too light to carry data on white — it is not a series color.
 * Dark values are scoped to `.dark` to match the app's class-based theming.
 */
const VIZ_TOKENS = `
  .viz-root {
    --viz-series-1: #1169ee;
    --viz-series-2: #eb6834;
    --viz-grid: #e1e0d9;
    --viz-axis: #898781;
    --viz-surface: var(--surface-base);
    --viz-good: #0ca30c;
    --viz-warning: #b06a00;
    --viz-critical: #d03b3b;
  }
  .dark .viz-root {
    --viz-series-1: #6395df;
    --viz-series-2: #d95926;
    --viz-grid: #2c2c2a;
    --viz-axis: #898781;
    --viz-good: #0ca30c;
    --viz-warning: #fab219;
    --viz-critical: #e66767;
  }
  .viz-root .viz-grid { stroke: var(--viz-grid); stroke-width: 1; }
  .viz-root .viz-target { stroke: var(--viz-axis); stroke-width: 1; stroke-dasharray: 3 3; }
  .viz-root .viz-crosshair { stroke: var(--viz-axis); stroke-width: 1; }
  .viz-root .viz-axis-text { fill: var(--viz-axis); font-size: 11px; font-variant-numeric: tabular-nums; }
  .viz-root .viz-marker-ring { stroke: var(--viz-surface); stroke-width: 2; }
  .viz-root .viz-tone-good { color: var(--viz-good); }
  .viz-root .viz-tone-warning { color: var(--viz-warning); }
  .viz-root .viz-tone-critical { color: var(--viz-critical); }
`;

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <style>{VIZ_TOKENS}</style>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="viz-root min-h-screen bg-surface-subtle">{children}</div>
      </body>
    </html>
  );
}
