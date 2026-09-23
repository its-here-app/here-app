// The not-found.tsx files live inside route groups, so they only cover 404s
// raised under those groups — a URL matching no route at all (e.g. a
// two-segment /user/city) fell through to Next's unstyled default. This
// convention renders at the routing level, outside any layout, so it brings
// its own <html>/<body> and fonts.
import type { Metadata } from "next";
import { siteUrl } from "@/lib/siteUrl";
import { Geist, Geist_Mono } from "next/font/google";
import NotFoundScreen from "@/components/ui/NotFoundScreen";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: "Page not found • Here*",
  description: "The page you're looking for doesn't exist or may have been moved.",
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <NotFoundScreen
          header="Page not found"
          message="The page you're looking for doesn't exist or may have been moved."
        />
      </body>
    </html>
  );
}
