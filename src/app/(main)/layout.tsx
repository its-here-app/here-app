import { AuthProvider } from "@/lib/authContext";
import { SavesProvider } from "@/lib/savesContext";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import AppShell from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";
import { Toaster } from "@/components/ui/Toast";
import { Snackbar } from "@/components/ui/Snackbar";
import { CreatePlaylistCityPicker } from "@/components/modals/CreatePlaylistCityPicker";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const initialLoggedIn = !!user;

  return (
    <html lang="en">
      <body className="antialiased">
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
            <Toaster />
            <Snackbar />
            <CreatePlaylistCityPicker />
          </SavesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
