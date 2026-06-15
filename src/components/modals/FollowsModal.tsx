"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Avatar } from "../ui/Avatar";
import { BottomPanel } from "../ui/BottomPanel";
import { Tab, Tabs, TabPanels } from "../ui/Tabs";
import { Button } from "../ui/Button";
import { getFollowers, getFollowing, followUser } from "@/lib/services/users";
import type { FollowUser } from "@/lib/services/users";

interface FollowsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  profileName: string;
  initialTab: "followers" | "following";
  currentUserId?: string;
  followerCount?: number;
  followingCount?: number;
  onFollowBack?: () => void;
}

export default function FollowsModal({
  isOpen,
  onClose,
  profileId,
  profileName,
  initialTab,
  currentUserId,
  followerCount,
  followingCount,
  onFollowBack,
}: FollowsModalProps) {
  const [tab, setTab] = useState<"followers" | "following">(initialTab);
  const [followers, setFollowers] = useState<FollowUser[] | null>(null);
  const [following, setFollowing] = useState<FollowUser[] | null>(null);
  const [followedBack, setFollowedBack] = useState<Set<string>>(new Set());
  const [localFollowingCount, setLocalFollowingCount] =
    useState(followingCount);

  const isOwnProfile = !!currentUserId && currentUserId === profileId;

  useEffect(() => {
    setTab(initialTab);
    setFollowers(null);
    setFollowing(null);
    setFollowedBack(new Set());
    setLocalFollowingCount(followingCount);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    if (tab === "followers" && followers === null) {
      getFollowers(profileId, currentUserId).then(setFollowers);
    } else if (tab === "following" && following === null) {
      getFollowing(profileId, currentUserId).then(setFollowing);
    }
  }, [isOpen, tab, profileId, currentUserId, followers, following]);

  function renderList(
    list: FollowUser[] | null,
    emptyMsg: string,
    showFollowBack = false,
  ) {
    if (list === null)
      return (
        <p className="text-center text-tertiary py-8 text-body-xs">
          Loading...
        </p>
      );
    if (list.length === 0)
      return (
        <p className="text-center text-tertiary py-8 text-body-xs">
          {emptyMsg}
        </p>
      );
    return (
      <ul className="-mt-2">
        {list.map((u) => (
          <li key={u.id}>
            <Link
              href={`/${u.username}?back=1`}
              onClick={onClose}
              className="flex items-center gap-2 p-2 -mx-2"
            >
              <Avatar size="xl" src={u.avatar_url ?? undefined} />
              <div className="flex-1 min-w-0">
                <p className="text-body-xs text-white truncate">{u.full_name}</p>
                <div className="flex items-center gap-1">
                  <p className="text-body-xs text-grey-500 truncate">@{u.username}</p>
                  {u.mutualCount > 0 && (
                    <span className="text-body-xs text-grey-500 flex-shrink-0">· {u.mutualCount} mutual{u.mutualCount !== 1 ? "s" : ""}</span>
                  )}
                </div>
              </div>
              {showFollowBack && !u.mutual && !followedBack.has(u.id) && (
                <Button
                  variant="tonal"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    followUser(currentUserId!, u.id).then(() => {
                      setFollowedBack((prev) => new Set([...prev, u.id]));
                      setLocalFollowingCount((c) => (c ?? 0) + 1);
                      onFollowBack?.();
                      setFollowing((prev) =>
                        prev
                          ? [{ ...u, mutual: true }, ...prev]
                          : [{ ...u, mutual: true }],
                      );
                      setFollowers((prev) =>
                        prev
                          ? prev.map((f) =>
                              f.id === u.id ? { ...f, mutual: true } : f,
                            )
                          : prev,
                      );
                    });
                  }}
                >
                  Follow back
                </Button>
              )}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <BottomPanel
      isOpen={isOpen}
      onClose={onClose}
      header={`@${profileName}`}
      centerHeader
      handle
      mobileHeight="30rem"
      desktopVariant="floating"
      desktopWidth="43rem"
      desktopHeight="440px"
    >
      {/* Tabs */}
      <Tabs className="">
        <Tab
          title={
            followerCount != null ? `${followerCount} followers` : "followers"
          }
          active={tab === "followers"}
          onClick={() => setTab("followers")}
        />
        <Tab
          title={
            localFollowingCount != null
              ? `${localFollowingCount} following`
              : "following"
          }
          active={tab === "following"}
          onClick={() => setTab("following")}
        />
      </Tabs>

      {/* Sliding user lists */}
      <TabPanels activeIndex={tab === "followers" ? 0 : 1} bleed="1.5rem">
        {renderList(followers, "No followers yet.", isOwnProfile)}
        {renderList(following, "Not following anyone yet.")}
      </TabPanels>
    </BottomPanel>
  );
}
