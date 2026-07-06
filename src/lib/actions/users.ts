"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

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
