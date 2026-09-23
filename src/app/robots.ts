import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export const CANONICAL_HOST = "itshere.app";

// This app fronts itshere.app, so it serves the domain's robots.txt. Its own
// *.vercel.app deployment URL stays publicly reachable and would otherwise be
// indexed as a duplicate of every page here, so only the canonical host is
// allowed to be crawled.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";
  const isCanonicalHost = host === CANONICAL_HOST || host === `www.${CANONICAL_HOST}`;

  if (!isCanonicalHost) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/utility", "/studio", "/admin", "/api", "/signin"],
      },
    ],
    // Two zones, so two sitemaps: this app's product pages, and the marketing
    // zone's (proxied through /marketing-sitemap.xml).
    sitemap: [
      `https://${CANONICAL_HOST}/sitemap.xml`,
      `https://${CANONICAL_HOST}/marketing-sitemap.xml`,
    ],
  };
}
