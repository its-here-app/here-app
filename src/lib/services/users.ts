import { createClient } from "../supabase/client";
import { track } from "../analytics";
import type { Profile } from "@/types";

export async function getUsers(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return data;
}

export async function getUserByUsername(
  username: string
): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();
  if (error || !data) return null;
  return data;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function getUserUsername(userId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();
  return data?.username ?? null;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, "full_name" | "username" | "bio" | "avatar_url">>
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function uploadProfilePhoto(
  userId: string,
  blob: Blob,
  ext: string,
  currentUrl?: string
): Promise<string> {
  const supabase = createClient();

  if (currentUrl) {
    const oldFileName = currentUrl.split("/").pop();
    if (oldFileName) {
      await supabase.storage.from("profile-photos").remove([oldFileName]);
    }
  }

  const fileName = `${userId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("profile-photos")
    .upload(fileName, blob);
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("profile-photos").getPublicUrl(fileName);

  return publicUrl;
}

export async function createUser(params: { name: string; username: string }) {
  const response = await fetch("/api/user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to create user");
  }
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export interface FollowUser extends Profile {
  mutual: boolean;
  mutualCount: number;
}

export async function getFollowerCount(userId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId);
  return count ?? 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", userId);
  return count ?? 0;
}

export async function getFollowers(
  userId: string,
  currentUserId?: string
): Promise<FollowUser[]> {
  const supabase = createClient();
  const { data: followData, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", userId);
  if (error || !followData || followData.length === 0) return [];

  const ids = followData.map((r: { follower_id: string }) => r.follower_id);
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);
  if (!profileData) return [];

  if (!currentUserId) return profileData.map((p: Profile) => ({ ...p, mutual: false, mutualCount: 0 }));

  const { data: following } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", currentUserId);
  const followingIds = new Set((following ?? []).map((r: { following_id: string }) => r.following_id));

  // Get who each person in the list follows, to count mutuals (people you both follow)
  const { data: theirFollows } = await supabase
    .from("follows")
    .select("follower_id, following_id")
    .in("follower_id", ids);

  const mutualCounts = new Map<string, number>();
  for (const row of theirFollows ?? []) {
    if (followingIds.has(row.following_id)) {
      mutualCounts.set(row.follower_id, (mutualCounts.get(row.follower_id) ?? 0) + 1);
    }
  }

  return profileData.map((p: Profile) => ({
    ...p,
    mutual: followingIds.has(p.id),
    mutualCount: p.id === currentUserId ? 0 : (mutualCounts.get(p.id) ?? 0),
  }));
}

export async function getFollowing(
  userId: string,
  currentUserId?: string
): Promise<FollowUser[]> {
  const supabase = createClient();
  const { data: followData, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  if (error || !followData || followData.length === 0) return [];

  const ids = followData.map((r: { following_id: string }) => r.following_id);
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);
  if (!profileData) return [];

  if (!currentUserId) return profileData.map((p: Profile) => ({ ...p, mutual: false, mutualCount: 0 }));

  const { data: myFollowing } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", currentUserId);
  const followingIds = new Set((myFollowing ?? []).map((r: { following_id: string }) => r.following_id));

  // Get who each person in the list follows, to count mutuals (people you both follow)
  const { data: theirFollows } = await supabase
    .from("follows")
    .select("follower_id, following_id")
    .in("follower_id", ids);

  const mutualCounts = new Map<string, number>();
  for (const row of theirFollows ?? []) {
    if (followingIds.has(row.following_id)) {
      mutualCounts.set(row.follower_id, (mutualCounts.get(row.follower_id) ?? 0) + 1);
    }
  }

  return profileData.map((p: Profile) => ({
    ...p,
    mutual: followingIds.has(p.id),
    mutualCount: p.id === currentUserId ? 0 : (mutualCounts.get(p.id) ?? 0),
  }));
}

export async function getRelationship(
  currentUserId: string,
  targetUserId: string
): Promise<{ following: boolean; followedBy: boolean; blocking: boolean; blockedBy: boolean }> {
  const supabase = createClient();
  const [followingRes, followedByRes, blockingRes, blockedByRes] = await Promise.all([
    supabase
      .from("follows")
      .select("id")
      .eq("follower_id", currentUserId)
      .eq("following_id", targetUserId)
      .maybeSingle(),
    supabase
      .from("follows")
      .select("id")
      .eq("follower_id", targetUserId)
      .eq("following_id", currentUserId)
      .maybeSingle(),
    supabase
      .from("blocks")
      .select("id")
      .eq("blocker_id", currentUserId)
      .eq("blocked_id", targetUserId)
      .maybeSingle(),
    supabase
      .from("blocks")
      .select("id")
      .eq("blocker_id", targetUserId)
      .eq("blocked_id", currentUserId)
      .maybeSingle(),
  ]);
  return {
    following: !!followingRes.data,
    followedBy: !!followedByRes.data,
    blocking: !!blockingRes.data,
    blockedBy: !!blockedByRes.data,
  };
}

export async function followUser(
  followerId: string,
  followingId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw error;
  track(followerId, "user.followed", { target_user_id: followingId });
}

export async function unfollowUser(
  followerId: string,
  followingId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);
  if (error) throw error;
  track(followerId, "user.unfollowed", { target_user_id: followingId });
}

export async function blockUser(
  blockerId: string,
  blockedId: string
): Promise<void> {
  const supabase = createClient();
  const { error: insertError } = await supabase
    .from("blocks")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (insertError) throw insertError;

  // Remove follows in both directions
  await supabase
    .from("follows")
    .delete()
    .or(
      `and(follower_id.eq.${blockerId},following_id.eq.${blockedId}),and(follower_id.eq.${blockedId},following_id.eq.${blockerId})`
    );
  track(blockerId, "user.blocked", { target_user_id: blockedId });
}

export async function unblockUser(
  blockerId: string,
  blockedId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw error;
  track(blockerId, "user.unblocked", { target_user_id: blockedId });
}
