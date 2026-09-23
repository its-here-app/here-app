/**
 * Absolute origin for this deployment, used as Next's `metadataBase` so
 * relative OG/Twitter image paths (e.g. "/og.png") resolve to absolute URLs.
 * Social scrapers can't fetch a relative path, and without this Next falls
 * back to http://localhost:3000 — which silently breaks previews in prod.
 */
export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
);
