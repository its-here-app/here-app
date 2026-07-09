import Message from "@/components/ui/Message";
import ProfileTabsShell from "./ProfileTabsShell";

export default function PlaylistSkeleton() {
  return (
    <ProfileTabsShell>
      <Message>Loading playlists...</Message>
    </ProfileTabsShell>
  );
}
