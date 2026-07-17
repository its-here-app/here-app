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
import { Skeleton } from "@/components/ui/Skeleton";
import {
  YourPlaylistsSection,
  TodaysPickSection,
  SharedRecentlySection,
  MostSavedSection,
  WantedToGoSection,
  OldFavoritesSection,
  ExplorePlaylistsSection,
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
  const [cityId, setCityId] = useState<string | null>(null);
  const [cityForCreate, setCityForCreate] = useState<{
    google_place_id: string;
    display_name: string;
    is_primary?: boolean;
  } | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [greetingLoaded, setGreetingLoaded] = useState(false);

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
        setCityId(profile.city_id);
        const supabase = createClient();
        const { data: city } = await supabase
          .from("cities")
          .select("google_place_id, display_name, is_primary")
          .eq("id", profile.city_id)
          .single();
        if (city) {
          setCityName(formatCityDisplay(city.display_name, city.is_primary));
          setCityForCreate(city);
        }

        try {
          const res = await fetch(`/api/weather?cityId=${profile.city_id}`);
          const data = res.ok ? await res.json() : null;
          if (data?.temp != null) setWeather(data);
        } catch {
          // best-effort
        }
      }
      setGreetingLoaded(true);
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
      {!greetingLoaded ? (
        <div className="hidden lg:flex flex-col mb-4">
          <div className="h-[2.5625rem] flex items-center">
            <Skeleton className="h-4 w-96 rounded-full" />
          </div>
          <div className="h-[2.5625rem] flex items-center">
            <Skeleton className="h-4 w-80 rounded-full" />
          </div>
        </div>
      ) : (
        firstName && weather && cityName && (
          <div className="hidden lg:block mb-4">
            <h1 className="text-display-radio-2 text-primary">
              {getGreeting()}, {firstName}.
            </h1>
            <h1 className="text-display-radio-2 text-primary">
              It&apos;s {weather.temp}° and {weather.condition} in{" "}
              <button
                onClick={() => setCityPickerOpen(true)}
                className="underline underline-offset-4 text-bubble cursor-pointer"
              >
                {cityName}
              </button>{" "}
              today.
            </h1>
          </div>
        )
      )}

      <div className="flex flex-col gap-12">
        <TodaysPickSection key={`pick-${cityId}`} userId={user.id} cityId={cityId} />
        <YourPlaylistsSection
          key={`your-playlists-${cityId}`}
          userId={user.id}
          cityId={cityId}
          city={cityForCreate}
        />
        <SharedRecentlySection userId={user.id} />
        <MostSavedSection key={`most-saved-${cityId}`} cityId={cityId} />
        <WantedToGoSection key={`wanted-${cityId}`} userId={user.id} cityId={cityId} />
        <OldFavoritesSection key={`old-favorites-${cityId}`} userId={user.id} cityId={cityId} />
        <ExplorePlaylistsSection key={`explore-${cityId}`} userId={user.id} cityId={cityId} />
        <RecommendedSection key={`recommended-${cityId}`} userId={user.id} cityId={cityId} />
      </div>

      <CityPickerModal
        isOpen={cityPickerOpen}
        onClose={() => setCityPickerOpen(false)}
        onSelect={async (city) => {
          setCityName(formatCityDisplay(city.display_name, city.is_primary));
          setCityForCreate(city);
          const newCityId = await upsertCityAction({
            google_place_id: city.google_place_id,
            display_name: city.display_name,
            is_primary: city.is_primary,
          });
          await updateProfileCityAction(newCityId);
          setCityId(newCityId);
        }}
      />
    </>
  );
}
