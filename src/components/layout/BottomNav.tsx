"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { useActiveNavTab } from "@/lib/useActiveNavTab";
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

  if (loading || !user) return null;

  function handleTabChange(tab: BottomNavTab) {
    switch (tab) {
      case "home":
        return router.push("/");
      case "search":
        return router.push("/search");
      case "saved":
        return router.push("/saves");
      case "profile":
        if (username && pathname === `/${username}`) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        return router.push(username ? `/${username}` : "/");
    }
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
