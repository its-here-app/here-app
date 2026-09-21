import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Account deletion, per the policy:
 *
 * - Deleting is a soft delete. profiles.deleted_at is stamped, RLS hides the
 *   profile and its lists from everyone else immediately, and the user is
 *   signed out everywhere.
 * - For 14 days, signing in restores everything. Restoration is only ever by
 *   signing in — never by email or on request.
 * - After 14 days it is permanent. The nightly cron (or the next sign-in,
 *   whichever comes first) removes the auth user (everything cascades), the
 *   person's files in Storage, and leaves anonymous per-place save counts
 *   behind (spots.retained_save_count, bumped inside purge_deleted_account).
 *
 * profiles.deleted_at can only be written with the service-role key — a
 * trigger rejects the user's own session — so both directions live here.
 */

export const DELETION_GRACE_DAYS = 14;
const GRACE_MS = DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function softDeleteAccount(userId: string): Promise<void> {
  const { error } = await adminClient()
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", userId)
    .is("deleted_at", null);
  if (error) throw error;
}

export type SignInReconcile = "active" | "restored" | "purged";

/**
 * Run on every successful sign-in. Inside the window the pending deletion is
 * cleared; past it the account is purged on the spot (the cron may simply not
 * have got to it yet) and the caller must sign the session out again.
 */
export async function reconcileDeletedAccount(
  userId: string
): Promise<SignInReconcile> {
  const admin = adminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!profile?.deleted_at) return "active";

  if (Date.now() - Date.parse(profile.deleted_at) < GRACE_MS) {
    const { error: restoreError } = await admin
      .from("profiles")
      .update({ deleted_at: null })
      .eq("id", userId);
    if (restoreError) throw restoreError;
    return "restored";
  }

  await purgeDeletedAccount(userId);
  return "purged";
}

/** Ids of every account whose grace period has lapsed. */
export async function listExpiredDeletedAccounts(): Promise<string[]> {
  const cutoff = new Date(Date.now() - GRACE_MS).toISOString();
  const { data, error } = await adminClient()
    .from("profiles")
    .select("id")
    .lt("deleted_at", cutoff);
  if (error) throw error;
  return (data ?? []).map((row) => row.id as string);
}

/**
 * Hard delete. The database function re-checks the 14-day window and refuses
 * otherwise, so a restore racing this call always wins. Files go first: once
 * the auth user is gone there is nothing left to retry from, whereas a file
 * failure here just leaves the account pending for the next run.
 */
export async function purgeDeletedAccount(userId: string): Promise<boolean> {
  const admin = adminClient();
  await removeUserFiles(admin, userId);

  const { data, error } = await admin.rpc("purge_deleted_account", {
    p_user_id: userId,
  });
  if (error) throw error;
  return data === true;
}

// Avatars are flat files named <userId>-<timestamp>.<ext>; covers live in a
// <userId>/ folder (see uploadProfilePhoto and uploadPlaylistCover).
async function removeUserFiles(
  admin: ReturnType<typeof adminClient>,
  userId: string
): Promise<void> {
  const avatars = await admin.storage
    .from("profile-photos")
    .list("", { limit: 1000, search: `${userId}-` });
  if (avatars.error) throw avatars.error;
  const avatarPaths = avatars.data
    .map((f) => f.name)
    .filter((name) => name.startsWith(`${userId}-`));
  if (avatarPaths.length) {
    const { error } = await admin.storage.from("profile-photos").remove(avatarPaths);
    if (error) throw error;
  }

  const covers = await admin.storage
    .from("playlist-covers")
    .list(userId, { limit: 1000 });
  if (covers.error) throw covers.error;
  const coverPaths = covers.data
    .filter((f) => f.id !== null) // folders come back with a null id
    .map((f) => `${userId}/${f.name}`);
  if (coverPaths.length) {
    const { error } = await admin.storage.from("playlist-covers").remove(coverPaths);
    if (error) throw error;
  }
}
