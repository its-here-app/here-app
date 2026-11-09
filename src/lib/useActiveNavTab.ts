"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/authContext";

export type NavTab = "home" | "search" | "saved" | "profile";

const STORAGE_KEY = "nav:lastTab";
const TABS: NavTab[] = ["home", "search", "saved", "profile"];

let lastTab: NavTab | null = null;

function tabForPath(pathname: string, username: string | null): NavTab | null {
  if (pathname === "/") return "home";
  if (pathname === "/search" || pathname.startsWith("/search/")) return "search";
  if (pathname === "/saves") return "saved";
  if (username && pathname === `/${username}`) return "profile";
  return null;
}

function readLastTab(): NavTab {
  if (lastTab) return lastTab;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY) as NavTab | null;
    if (stored && TABS.includes(stored)) return stored;
  } catch {}
  return "home";
}

// Pages that aren't a tab (e.g. someone else's profile) keep the tab the user came from.
export function useActiveNavTab(): NavTab {
  const pathname = usePathname();
  const { username } = useAuth();
  const directTab = tabForPath(pathname, username);

  useEffect(() => {
    if (!directTab) return;
    lastTab = directTab;
    try {
      sessionStorage.setItem(STORAGE_KEY, directTab);
    } catch {}
  }, [directTab]);

  return directTab ?? readLastTab();
}
