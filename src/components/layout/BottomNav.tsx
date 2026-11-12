"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { markNavTabPending, useActiveNavTab } from "@/lib/useActiveNavTab";
import {
  BottomNavigation,
  type BottomNavTab,
} from "@/components/ui/BottomNavigation";
import { openCreatePlaylist } from "@/components/modals/CreatePlaylistCityPicker";

export default function BottomNav() {
  const { user, loading, avatarUrl, username } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab: BottomNavTab = useActiveNavTab();

  const hrefs: Record<BottomNavTab, string> = {
    home: "/",
    search: "/search",
    saved: "/saves",
    profile: username ? `/${username}` : "/",
  };

  useEffect(() => {
    if (!user) return;
    ["/", "/search", "/saves", username ? `/${username}` : null].forEach(
      (href) => href && router.prefetch(href),
    );
  }, [user, username, router]);

  if (loading || !user) return null;

  function handleTabChange(tab: BottomNavTab) {
    if (tab === "profile" && pathname === hrefs.profile) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    markNavTabPending(tab, hrefs[tab]);
    router.push(hrefs[tab]);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface-base pb-[env(safe-area-inset-bottom)] lg:translate-y-[100%] transition-transform duration-400 will-change-transform">
      <BottomNavigation
        activeTab={activeTab}
        avatarUrl={avatarUrl || undefined}
        onTabChange={handleTabChange}
        onAdd={() => openCreatePlaylist()}
      />
    </div>
  );
}
