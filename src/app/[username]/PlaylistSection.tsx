import { createClient } from "@/lib/supabase/server";
import { getPlaylistsByUser, getSpotsByUser } from "@/lib/queries/playlists";
import { Block } from "@/components/ui/icons/Block";
import ProfileTabs from "./ProfileTabs";
import ProfileMessage from "./ProfileMessage";
import ProfileTabsShell from "./ProfileTabsShell";

interface Props {
  profileId: string;
  isOwnProfile: boolean;
  userId?: string;
  username: string;
}

export default async function PlaylistSection({
  profileId,
  isOwnProfile,
  userId,
  username,
}: Props) {
  const supabase = await createClient();

  const [rawPlaylists, spots, blockRow] = await Promise.all([
    getPlaylistsByUser(profileId, !isOwnProfile),
    getSpotsByUser(profileId, !isOwnProfile),
    userId && !isOwnProfile
      ? supabase
          .from("blocks")
          .select("id")
          .eq("blocker_id", userId)
          .eq("blocked_id", profileId)
          .maybeSingle()
      : null,
  ]);

  const isBlocked = !!blockRow?.data;
  const playlists = rawPlaylists;

  if (isBlocked) {
    return (
      <ProfileTabsShell>
        <ProfileMessage icon={<Block className="size-9" />} header="You have blocked this account">
          <p className="mb-2">Unblock this account to see their playlists and saves.</p>
          <p>When you unblock them, they'll also be able to find your profile and see your content.</p>
        </ProfileMessage>
      </ProfileTabsShell>
    );
  }

  return <ProfileTabs playlists={playlists} spots={spots} profileId={profileId} username={username} />;
}
