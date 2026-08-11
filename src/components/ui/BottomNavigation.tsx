import { useState, type ReactNode } from "react";
import { Avatar } from "./Avatar";
import { Bookmark } from "./icons/Bookmark";
import { Home } from "./icons/Home";
import { Plus } from "./icons/Plus";
import { Search } from "./icons/Search";
import { IconButton } from "./IconButton";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BottomNavTab = "home" | "search" | "saved" | "profile";

interface BottomNavigationProps {
  /** Active tab — controls which icon is filled */
  activeTab?: BottomNavTab;
  /** Called when the + add button is pressed */
  onAdd?: () => void;
  /** Called when a tab icon is pressed */
  onTabChange?: (tab: BottomNavTab) => void;
  /** Avatar image URL — shown in the profile slot */
  avatarUrl?: string;
  className?: string;
}

function NavButton({
  active = false,
  onClick,
  children,
  label,
}: {
  active?: boolean;
  onClick?: () => void;
  children: (highlighted: boolean) => ReactNode;
  label: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="size-8 flex items-center justify-center"
    >
      {children(active || hovered)}
    </button>
  );
}

function ProfileButton({
  active,
  avatarUrl,
  onClick,
}: {
  active: boolean;
  avatarUrl?: string;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Profile"
    >
      <Avatar
        src={avatarUrl}
        focus={active || hovered}
        size="md"
        className="mt-2"
      />
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomNavigation({
  activeTab,
  onAdd,
  onTabChange,
  avatarUrl,
  className,
}: BottomNavigationProps) {
  return (
    <div
      className={`bg-surface-base py-2 shadow-[0px_-4px_14px_0px_rgba(0,0,0,0.05)] ${className ?? ""}`}
    >
      <div className="flex items-center justify-evenly max-w-md mx-auto">
        <NavButton active={activeTab === "home"} label="Home" onClick={() => onTabChange?.("home")}>
          {(highlighted) => <Home focus={highlighted} className="size-8" />}
        </NavButton>
        <NavButton active={activeTab === "search"} label="Search" onClick={() => onTabChange?.("search")}>
          {(highlighted) => <Search focus={highlighted} className="size-8" />}
        </NavButton>
        <IconButton
          variant="hero"
          icon={<Plus className="size-6" />}
          label="Add"
          onClick={onAdd}
        />
        <NavButton active={activeTab === "saved"} label="Saved" onClick={() => onTabChange?.("saved")}>
          {(highlighted) => <Bookmark active={highlighted} className="size-8" />}
        </NavButton>
        <ProfileButton
          active={activeTab === "profile"}
          avatarUrl={avatarUrl}
          onClick={() => onTabChange?.("profile")}
        />
      </div>
    </div>
  );
}
