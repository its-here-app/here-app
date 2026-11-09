"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/authContext";

export type NavTab = "home" | "search" | "saved" | "profile";

const STORAGE_KEY = "nav:lastTab";
const TABS: NavTab[] = ["home", "search", "saved", "profile"];

let lastTab: NavTab | null = null;

// The tab just tapped, shown as active while its page is still loading
// (pathname only changes once navigation commits).
let pendingTab: NavTab | null = null;
const pendingListeners = new Set<() => void>();

function setPendingTab(tab: NavTab | null) {
  if (pendingTab === tab) return;
  pendingTab = tab;
  pendingListeners.forEach((fn) => fn());
}

function subscribePending(fn: () => void) {
  pendingListeners.add(fn);
  return () => pendingListeners.delete(fn);
}

/** Call when a nav item starts navigating to `href`, before the route loads. */
export function markNavTabPending(tab: NavTab, href: string) {
  if (href !== window.location.pathname) setPendingTab(tab);
}

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
  const pending = useSyncExternalStore(subscribePending, () => pendingTab, () => null);

  useEffect(() => {
    setPendingTab(null);
  }, [pathname]);

  useEffect(() => {
    if (!directTab) return;
    lastTab = directTab;
    try {
      sessionStorage.setItem(STORAGE_KEY, directTab);
    } catch {}
  }, [directTab]);

  return pending ?? directTab ?? readLastTab();
}
