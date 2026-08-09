import { AuthProvider } from "@/lib/authContext";
import { SavesProvider } from "@/lib/savesContext";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import AppShell from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";
import { Toaster } from "@/components/ui/Toast";
import { Snackbar } from "@/components/ui/Snackbar";
import { CreatePlaylistFlow } from "@/components/modals/CreatePlaylistFlow";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

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

export default async function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const initialLoggedIn = !!user;
  const theme = (await headers()).get("x-theme");

  return (
    <html lang="en">
      <body className={`antialiased ${theme === "dark" ? "dark" : ""}`}>
        <AuthProvider>
          <SavesProvider>
            <AppShell
              initialLoggedIn={initialLoggedIn}
              nav={
                <>
                  <Sidebar />
                  <BottomNav />
                </>
              }
            >
              {children}
            </AppShell>
            {modal}
            <Toaster />
            <Snackbar />
            <CreatePlaylistFlow />
          </SavesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
