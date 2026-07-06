import { Suspense } from "react";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProfileHeader from "./ProfileHeader";
import { getUserByUsername } from "@/lib/queries/users";
import { createClient } from "@/lib/supabase/server";
import PlaylistSection from "./PlaylistSection";
import PlaylistSkeleton from "./PlaylistSkeleton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getUserByUsername(username);
  const name = profile?.full_name;
  return { title: `${name ? `${name} ` : ""}(@${username}) • Here*` };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();
  const [
    profile,
    {
      data: { user },
    },
  ] = await Promise.all([getUserByUsername(username), supabase.auth.getUser()]);

  if (!profile) {
    notFound();
  }

  const isOwnProfile = user?.id === profile.id;

  return (
    <main className="flex flex-col items-center">
      <div className="w-full">
        <ProfileHeader profile={profile} />
        <Suspense fallback={<PlaylistSkeleton />}>
          <PlaylistSection
            profileId={profile.id}
            isOwnProfile={isOwnProfile}
            userId={user?.id}
            username={profile.username}
          />
        </Suspense>
      </div>
    </main>
  );
}
