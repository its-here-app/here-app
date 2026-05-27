"use client";

import { useEffect, useState } from "react";
import { AppBarConfig } from "@/lib/appBarContext";
import { FullLogo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Map } from "@/components/ui/icons/Map";
import { useAuth } from "@/lib/authContext";
import { getProfile } from "@/lib/services/users";
import { createClient } from "@/lib/supabase/client";
import { formatCityDisplay } from "@/lib/cityDisplay";
import { upsertCityAction } from "@/lib/actions/cities";
import { updateProfileCityAction } from "@/lib/actions/users";
import { useRouter } from "next/navigation";
import CityPickerModal from "@/components/modals/CityPickerModal";
import {
  YourPlaylistsSection,
  TodaysPickSection,
  SharedRecentlySection,
  MostSavedSection,
  WantedToGoSection,
  OldFavoritesSection,
  RecommendedSection,
} from "@/components/home";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface Weather {
  temp: number;
  condition: string;
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [cityName, setCityName] = useState<string | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/signin");
  }, [user, loading]);

  // Load user profile: city + name + weather
  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then(async (profile) => {
      if (profile?.full_name) {
        setFirstName(profile.full_name.split(" ")[0]);
      }
      if (profile?.city_id) {
        const supabase = createClient();
        const { data: city } = await supabase
          .from("cities")
          .select("display_name, is_primary")
          .eq("id", profile.city_id)
          .single();
        if (city) setCityName(formatCityDisplay(city.display_name, city.is_primary));

        // Fetch weather (non-blocking, best-effort)
        fetch(`/api/weather?cityId=${profile.city_id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => { if (data?.temp != null) setWeather(data); })
          .catch(() => {});
      }
    });
  }, [user]);

  if (!user) return null;

  return (
    <>
      <AppBarConfig
        left={
          <div className="lg:hidden">
            <FullLogo />
          </div>
        }
        right={
          <Button
            variant="tonal"
            size="sm"
            leftIcon={<Map />}
            onClick={() => setCityPickerOpen(true)}
          >
            {cityName ?? "Choose city"}
          </Button>
        }
      />

      {/* Desktop weather greeting */}
      {firstName && weather && cityName && (
        <div className="hidden lg:block mb-4">
          <h1 className="text-display-radio-2 text-primary">
            {getGreeting()}, {firstName}.
          </h1>
          <h1 className="text-display-radio-2 text-primary">
            It&apos;s {weather.temp}° and {weather.condition} in{" "}
            <button
              onClick={() => setCityPickerOpen(true)}
              className="underline underline-offset-4 cursor-pointer"
            >
              {cityName}
            </button>{" "}
            today.
          </h1>
        </div>
      )}

      <div className="flex flex-col gap-12">
        <YourPlaylistsSection userId={user.id} />
        <TodaysPickSection />
        <SharedRecentlySection userId={user.id} />
        <MostSavedSection />
        <WantedToGoSection userId={user.id} />
        <OldFavoritesSection userId={user.id} />
        <RecommendedSection userId={user.id} />
      </div>

      <CityPickerModal
        isOpen={cityPickerOpen}
        onClose={() => setCityPickerOpen(false)}
        onSelect={async (city) => {
          setCityName(formatCityDisplay(city.display_name, city.is_primary));
          const cityId = await upsertCityAction({
            google_place_id: city.google_place_id,
            display_name: city.display_name,
            is_primary: city.is_primary,
          });
          await updateProfileCityAction(cityId);
        }}
      />
    </>
  );
}
