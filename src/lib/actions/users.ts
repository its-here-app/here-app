"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import {
  isPastGracePeriod,
  reconcileDeletedAccount,
  softDeleteAccount,
  type SignInReconcile,
} from "@/lib/accountDeletion";
import { isReservedUsername } from "@/lib/reservedUsernames";

// Drives the "Welcome back" vs "Create your account" copy. An account whose
// 14-day undo window has passed is as good as gone (signing in purges it and
// starts over), so its email reads as free.
export async function checkEmailExistsAction(email: string): Promise<boolean> {
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { data } = await admin
    .from("profiles")
    .select("deleted_at")
    .eq("email", email)
    .maybeSingle();

  return !!data && !isPastGracePeriod(data.deleted_at);
}

// Service role on purpose: RLS hides profiles that are pending deletion, but
// their username stays reserved for the 14-day undo window, so a session-bound
// lookup would report it free and the save would then hit the unique index.
export async function checkUsernameTakenAction(username: string): Promise<boolean> {
  if (isReservedUsername(username)) return true;

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  return !!data;
}

export async function updateProfileAction(params: {
  full_name: string;
  username: string;
  bio: string;
  instagram_handle: string;
  avatar_url: string;
  city_id?: string | null;
  previousUsername: string;
}): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Use admin client to bypass RLS column restrictions (e.g. city_id)
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { error } = await admin
    .from("profiles")
    .update({
      full_name: params.full_name,
      username: params.username,
      bio: params.bio,
      instagram_handle: params.instagram_handle,
      avatar_url: params.avatar_url,
      city_id: params.city_id ?? null,
    })
    .eq("id", user.id);
  if (error) throw error;

  revalidatePath(`/${params.previousUsername}`);
  if (params.username !== params.previousUsername) {
    revalidatePath(`/${params.username}`);
  }
}

export async function updateProfileCityAction(cityId: string): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { error } = await admin
    .from("profiles")
    .update({ city_id: cityId })
    .eq("id", user.id);
  if (error) throw error;
}

export async function removeFollowerAction(followerId: string): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Use admin client to bypass RLS since we're deleting another user's follow row
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { error } = await admin
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", user.id);
  if (error) throw error;
}

export async function blockUserAction(blockedId: string): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error: insertError } = await supabase
    .from("blocks")
    .insert({ blocker_id: user.id, blocked_id: blockedId });
  if (insertError) throw insertError;

  // Use admin client to remove follows in both directions (RLS prevents deleting other user's rows)
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  await admin
    .from("follows")
    .delete()
    .or(
      `and(follower_id.eq.${user.id},following_id.eq.${blockedId}),and(follower_id.eq.${blockedId},following_id.eq.${user.id})`
    );
}

/**
 * Soft-deletes the caller's account (see lib/accountDeletion.ts). The client
 * signs out afterwards with scope "global", which revokes every refresh token
 * so other devices drop off within one access-token lifetime.
 */
export async function deleteAccountAction(): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await softDeleteAccount(user.id);
}

/**
 * Run after a password sign-in (Google returns go through /auth/callback,
 * which calls reconcileDeletedAccount directly). "restored" means a pending
 * deletion was undone; "purged" means the 14 days had passed and the account
 * was just removed — the caller must sign the session out again.
 */
export async function reconcileDeletedAccountAction(): Promise<SignInReconcile> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  return reconcileDeletedAccount(user.id);
}
