import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import CreatePlaylistPage from "./CreatePlaylistPage";

export const metadata: Metadata = {
  title: "Create a playlist — Here*",
};

export default async function NewPlaylistPage({
  searchParams,
}: {
  searchParams: Promise<{ place_id?: string; name?: string; primary?: string }>;
}) {
  const [{ place_id, name, primary }, supabase] = await Promise.all([
    searchParams,
    createClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/signin");

  // City is picked from the global BottomPanel (CreatePlaylistCityPicker)
  // before landing here, so this route always expects it in the URL. Direct
  // navigation without a city has nothing to create a playlist for.
  if (!place_id || !name) redirect("/");

  const initialCity = { google_place_id: place_id, display_name: name, is_primary: primary === "1" };

  return <CreatePlaylistPage initialCity={initialCity} />;
}
