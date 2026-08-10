import { AuthProvider } from "@/lib/authContext";
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
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "Here* — Discover and share favorite spots through city playlists",
  description: "For the spots you love & the places you'll go.",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased dark">
        <AuthProvider>
          <div className="min-h-dvh">{children}</div>
          <Toaster />
          <Snackbar />
        </AuthProvider>
      </body>
    </html>
  );
}
