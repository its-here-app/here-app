"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { signOut, getUserUsername } from "@/lib/services/users";
import { FullLogo } from "../ui/Logo";
import { Add } from "../ui/icons/Add";
import { openCreatePlaylist } from "@/components/modals/CreatePlaylistFlow";
import { Bookmark } from "../ui/icons/Bookmark";
import { Home } from "../ui/icons/Home";
import { Search } from "../ui/icons/Search";
import { Logout } from "../ui/icons/Logout";
import { Avatar } from "../ui/Avatar";

export default function Sidebar() {
  const { user, loading, avatarUrl } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserUsername(user.id).then(setUsername);
  }, [user]);

  if (loading || !user || pathname.startsWith("/signin")) return null;

  async function handleSignOut() {
    await signOut();
    router.push("/signin");
  }

  const profileHref = username ? `/${username}` : "/";

  return (
    <aside className="flex flex-col w-[var(--sidebar-width)] p-[var(--space-page-dynamic)] bg-surface-base h-screen fixed top-0 left-[max(0px,calc((100vw-var(--app-max-width))/2))] -ml-[var(--sidebar-width)] lg:ml-0 transition-[margin] duration-400">
      {/* Logo */}
      <Link href="/" className="cursor-pointer">
        <FullLogo className="mt-2" />
      </Link>

      {/* Nav */}
      <nav className="-ml-2 flex flex-col gap-8 mt-[5rem]">
        <Link href="/" className="flex items-center gap-5">
          <Home focus={pathname === "/"} className="size-8 shrink-0 text-primary" />
          <span className="text-header-radio-3 text-primary">Home</span>
        </Link>

        <Link href="/search" className="flex items-center gap-5">
          <Search focus={pathname.startsWith("/search")} className="size-8 shrink-0 text-primary" />
          <span className="text-header-radio-3 text-primary">Search</span>
        </Link>

        <Link href="/saves" className="flex items-center gap-5">
          <Bookmark
            active={pathname === "/saves"}
            className="size-8 shrink-0 text-primary"
          />
          <span className="text-header-radio-3 text-primary">Saves</span>
        </Link>

        <Link href={profileHref} className="flex items-center gap-5">
          <span className="size-8 shrink-0 flex items-center justify-center">
            <Avatar
              src={avatarUrl}
              alt="Profile"
              focus={pathname === profileHref}
            />
          </span>
          <span className="text-header-radio-3 text-primary">Profile</span>
        </Link>

        <div className="border-t border-subtle w-full" />

        <button
          onClick={() => openCreatePlaylist()}
          className="flex items-center gap-5 cursor-pointer"
        >
          <Add className="size-8 shrink-0" />
          <span className="text-header-radio-3 text-primary">
            Start a new playlist
          </span>
        </button>
      </nav>

      {/* Log out */}
      <button
        onClick={handleSignOut}
        className="-ml-2 absolute bottom-[var(--space-page-dynamic)] left-[var(--space-page-dynamic)] flex items-center gap-5 cursor-pointer"
      >
        <Logout className="size-8 shrink-0 text-secondary" />
        <span className="text-header-radio-3 text-secondary">Log out</span>
      </button>
    </aside>
  );
}
