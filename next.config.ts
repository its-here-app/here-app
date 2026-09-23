import type { NextConfig } from "next";

// here-app is the front door for itshere.app: it owns the domain, and proxies
// marketing's paths through to the marketing site's own deployment so the
// browser only ever sees one domain. MARKETING_ORIGIN must point at that
// deployment (e.g. https://here-marketing-site.vercel.app).
const MARKETING_ORIGIN = process.env.MARKETING_ORIGIN;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!MARKETING_ORIGIN) return { beforeFiles: [], fallback: [] };

    return {
      // These must be explicit: here-app's /[username] route matches any
      // single segment, so it would otherwise swallow /privacy, /terms etc.
      // as profile lookups and 404 before any fallback could run.
      // ("/" is auth-dependent and handled in middleware.ts instead.)
      beforeFiles: [
        { source: "/privacy", destination: `${MARKETING_ORIGIN}/privacy` },
        // This app serves the domain's /sitemap.xml, so the marketing zone's
        // is exposed under a distinct path and listed alongside it in
        // robots.txt.
        {
          source: "/marketing-sitemap.xml",
          destination: `${MARKETING_ORIGIN}/sitemap.xml`,
        },
        { source: "/terms", destination: `${MARKETING_ORIGIN}/terms` },
        {
          source: "/studio/:path*",
          destination: `${MARKETING_ORIGIN}/studio/:path*`,
        },
        {
          source: "/playlist/:path*",
          destination: `${MARKETING_ORIGIN}/playlist/:path*`,
        },
        // Marketing's JS/CSS. It sets assetPrefix: "/marketing-static", so its
        // chunks live under this namespace instead of colliding with this
        // app's own /_next/*.
        {
          source: "/marketing-static/:path+",
          destination: `${MARKETING_ORIGIN}/marketing-static/:path+`,
        },
        // assetPrefix doesn't cover public/ files, so marketing's images need
        // their own rule. It keeps them in these subfolders while here-app's
        // /images holds only flat files, so there's no overlap. /fonts needs
        // no rule — both apps ship the identical Crimson/Golos/Radio files.
        {
          source:
            "/images/:dir(cursor|graphics|icons|logo|og|photos|stickers)/:path*",
          destination: `${MARKETING_ORIGIN}/images/:dir/:path*`,
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
