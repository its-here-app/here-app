"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, Tab, TabPanels } from "@/components/ui/Tabs";
import { List } from "@/components/ui/icons/List";
import { Map } from "@/components/ui/icons/Map";
import { Spots } from "@/components/ui/icons/Spots";
import { IconButton } from "@/components/ui/IconButton";
import { Share } from "@/components/ui/icons/Share";
import { Lock } from "@/components/ui/icons/Lock";
import { Asterisk } from "@/components/ui/icons/Asterisk";
import BookmarkButton from "@/components/BookmarkButton";
import { useAuth } from "@/lib/authContext";
import { useShare } from "@/lib/useShare";
import { openCreatePlaylist } from "@/components/modals/CreatePlaylistCityPicker";

import { Card } from "@/components/Card";
import EmptyState from "@/components/ui/EmptyState";
import { playlistUrl } from "@/lib/playlistUrl";
import type { Playlist, Spot } from "@/types";
import SpotCard from "@/components/SpotCard";
import { playlistDocTitle } from "@/lib/playlistDocTitle";
import { parseCityFromAddress } from "@/lib/cityDisplay";

interface ProfileTabsProps {
  playlists: Playlist[];
  spots: Spot[];
  profileId: string;
  username: string;
}

export default function ProfileTabs({
  playlists,
  spots,
  profileId,
  username,
}: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<"playlists" | "cities" | "spots">(
    "playlists",
  );
  const { user } = useAuth();
  const router = useRouter();
  const { share } = useShare();

  const isActualOwner = !!user && user.id === profileId;
  const isLoggedIn = !!user;

  const tabIndex = { playlists: 0, cities: 1, spots: 2 }[activeTab];

  function handleTabClick(tab: "playlists" | "cities" | "spots") {
    if (!user) {
      router.push("/signin");
      return;
    }
    setActiveTab(tab);
  }

  const playlistCount = playlists.length;
  const cityCount = new Set(playlists.map((p) => p.city)).size;
  const spotCount = spots.length;

  return (
    <div className="mt-4 lg:mt-16">
      <Tabs className="mb-[var(--space-page-sm)]">
        <Tab
          title={isActualOwner && playlistCount === 0 ? "Playlists" : `${playlistCount} ${playlistCount === 1 ? "playlist" : "playlists"}`}
          active={activeTab === "playlists"}
          onClick={() => handleTabClick("playlists")}
          icon={<List />}
        />
        <Tab
          title={isActualOwner && playlistCount === 0 ? "Cities" : `${cityCount} ${cityCount === 1 ? "city" : "cities"}`}
          active={activeTab === "cities"}
          onClick={() => handleTabClick("cities")}
          icon={<Map />}
        />
        <Tab
          title={isActualOwner && playlistCount === 0 ? "Spots" : `${spotCount} ${spotCount === 1 ? "spot" : "spots"}`}
          active={activeTab === "spots"}
          onClick={() => handleTabClick("spots")}
          icon={<Spots />}
        />
      </Tabs>

      <TabPanels activeIndex={tabIndex} bleed="var(--space-page-dynamic)">
        {/* Playlists */}
        <div>
          {playlists.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {playlists.map((playlist: Playlist) => (
                <Card
                  key={playlist.id}
                  size="lg"
                  image={playlist.cover_photo_url ?? undefined}
                  city={playlist.city}
                  name={playlist.name}
                  href={playlistUrl(username, playlist.city, playlist.name, playlist.slug)}
                  className="w-full"
                  bottomCenter={
                    <span className="flex items-center gap-1 text-body-xs text-neon">
                      {playlist.spot_count ?? 0}
                      {!playlist.is_public && (
                        <>
                          <span style={{ marginLeft: "2px" }}>·</span>
                          <span className="inline-flex items-center gap-[0.125rem]">
                            <Lock className="size-4" /> Private
                          </span>
                        </>
                      )}
                    </span>
                  }
                  topRight={
                    isActualOwner ? (
                      <IconButton
                        variant="overlay"
                        icon={<Share />}
                        label="Share playlist"
                        onClick={(e) => {
                          e.preventDefault();
                          share(
                            `${window.location.origin}${playlistUrl(username, playlist.city, playlist.name, playlist.slug)}`,
                            playlistDocTitle(
                              playlist.city,
                              playlist.name,
                              username,
                            ),
                          );
                        }}
                      />
                    ) : isLoggedIn ? (
                      <div className="flex flex-row gap-2">
                        <span onClick={(e) => e.preventDefault()}>
                          <BookmarkButton
                            playlistId={playlist.id}
                            variant="overlay"
                          />
                        </span>
                        <IconButton
                          variant="overlay"
                          icon={<Share />}
                          label="Share playlist"
                          onClick={(e) => {
                            e.preventDefault();
                            share(
                              `${window.location.origin}${playlistUrl(username, playlist.city, playlist.name, playlist.slug)}`,
                              playlistDocTitle(
                                playlist.city,
                                playlist.name,
                                username,
                              ),
                            );
                          }}
                        />
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              header={isActualOwner ? "Get started" : undefined}
              message={
                isActualOwner
                  ? "You don't have any lists yet. Create your first to organize your favorite places and share them with friends"
                  : "No public lists found"
              }
              actionLabel={isActualOwner ? "Create a list" : undefined}
              onAction={isActualOwner ? () => openCreatePlaylist() : undefined}
              neonAction
            />
          )}
        </div>

        {/* Cities */}
        <div>
          <EmptyState
            header="Coming soon!"
            message="We're currently working on the city view, come back later"
          />
        </div>

        {/* Spots */}
        <div className="flex flex-col gap-2 py-2">
          {spots.length > 0 ? (
            spots.map((spot) => (
              <SpotCard
                key={spot.id}
                spot={spot}
                subtitleText=""
                bookmark={<BookmarkButton spot={spot} />}
                city={parseCityFromAddress(spot.address) ?? undefined}
              />
            ))
          ) : (
            <EmptyState
              header={isActualOwner ? "Nothing saved yet" : undefined}
              message={isActualOwner ? "Save spots you love so you can find them later" : "No public saved spots found"}
              actionLabel={isActualOwner ? "Start exploring" : undefined}
              onAction={isActualOwner ? () => router.push("/") : undefined}
            />
          )}
        </div>
      </TabPanels>
    </div>
  );
}
