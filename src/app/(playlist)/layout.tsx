import { AuthProvider } from "@/lib/authContext";
import { SavesProvider } from "@/lib/savesContext";
import { Toaster } from "@/components/ui/Toast";
import { Snackbar } from "@/components/ui/Snackbar";
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
  title: "Here* — Discover and share favorite spots through city playlists",
  description: "For the spots you love & the places you'll go.",
  openGraph: {
    images: [{ url: "/og.png" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
};

export default function PlaylistLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <SavesProvider>
            {children}
            <Toaster />
            <Snackbar />
          </SavesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
