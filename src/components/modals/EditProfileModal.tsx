"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/authContext";
import { Avatar } from "../ui/Avatar";
import { Sheet } from "../ui/Sheet";
import { Check } from "../ui/icons/Check";
import { Error } from "../ui/icons/Error";
import { toast } from "../ui/Toast";
import { TextInput } from "../ui/inputs/TextInput";
import { BottomPanel } from "../ui/BottomPanel";
import { Button } from "../ui/Button";
import {
  getProfile,
  getUserByUsername,
} from "@/lib/services/users";
import { updateProfileAction } from "@/lib/actions/users";
import { upsertCityAction } from "@/lib/actions/cities";
import { isValidInstagramHandle, sanitizeInstagramHandleInput } from "@/lib/isValidInstagramHandle";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useAvatarUpload } from "@/lib/useAvatarUpload";
import { CityAutocompleteInput } from "../ui/inputs/CityAutocompleteInput";

type UsernameStatus = "idle" | "too-short" | "checking" | "valid" | "taken";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditProfileModal({
  isOpen,
  onClose,
  onSuccess,
}: EditProfileModalProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [bio, setBio] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [selectedCity, setSelectedCity] = useState<{
    google_place_id: string;
    display_name: string;
    is_primary?: boolean;
  } | null>(null);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string>("");
  const {
    photoPreview,
    hasCamera,
    isPhotoSheetOpen,
    setIsPhotoSheetOpen,
    uploadInputRef,
    captureInputRef,
    avatarRef,
    handlePhotoChange,
    handleRemovePhoto,
    handleAvatarClick,
    upload: uploadAvatar,
    reset: resetAvatar,
  } = useAvatarUpload(currentPhotoUrl);
  const isInstagramValid = !instagramHandle || isValidInstagramHandle(instagramHandle);

  useEffect(() => {
    if (isOpen && user) {
      resetAvatar();
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  const debouncedUsername = useDebouncedValue(username, 800);
  const debouncedInstagramHandle = useDebouncedValue(instagramHandle, 800);

  useEffect(() => {
    if (username.length === 0) {
      setUsernameStatus("idle");
    } else if (username.length >= 3 && username !== initialUsername) {
      setUsernameStatus("checking");
    }
  }, [username, initialUsername]);

  useEffect(() => {
    if (debouncedUsername.length === 0) return;
    if (debouncedUsername.length < 3) {
      setUsernameStatus("too-short");
      return;
    }
    if (debouncedUsername === initialUsername) {
      setUsernameStatus("valid");
      return;
    }
    getUserByUsername(debouncedUsername).then((existing) => {
      setUsernameStatus(existing ? "taken" : "valid");
    });
  }, [debouncedUsername, initialUsername]);

  useEffect(() => {
    if (usernameStatus === "too-short") {
      toast({
        icon: <Error />,
        message: "Username must be at least 3 characters",
      });
    } else if (usernameStatus === "taken") {
      toast({
        icon: <Error />,
        message: "Username unavailable",
      });
    }
  }, [usernameStatus]);

  useEffect(() => {
    if (!debouncedInstagramHandle || debouncedInstagramHandle.length >= 2) return;
    toast({
      icon: <Error />,
      message: "Instagram handle must be at least 2 characters",
    });
  }, [debouncedInstagramHandle]);

  async function loadProfile() {
    if (!user) return;
    try {
      const profile = await getProfile(user.id);
      if (profile) {
        setName(profile.full_name || "");
        const loadedUsername = profile.username || "";
        setUsername(loadedUsername);
        setInitialUsername(loadedUsername);
        setUsernameStatus(loadedUsername.length >= 3 ? "valid" : "idle");
        setBio(profile.bio || "");
        setInstagramHandle(profile.instagram_handle || "");
        setCurrentPhotoUrl(profile.avatar_url || "");

        if (profile.city_id) {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { data: city } = await supabase
            .from("cities")
            .select("google_place_id, display_name, is_primary")
            .eq("id", profile.city_id)
            .single();
          if (city) {
            setSelectedCity({
              google_place_id: city.google_place_id,
              display_name: city.display_name,
              is_primary: city.is_primary ?? undefined,
            });
          }
        }
      }
    } catch {
      toast({ icon: <Error />, message: "Failed to load profile" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    try {
      const photoUrl = await uploadAvatar(user.id);

      let cityId: string | null = null;
      if (selectedCity) {
        cityId = await upsertCityAction({
          google_place_id: selectedCity.google_place_id,
          display_name: selectedCity.display_name,
          is_primary: selectedCity.is_primary,
        });
      }

      await updateProfileAction({
        full_name: name,
        username,
        bio,
        instagram_handle: instagramHandle,
        avatar_url: photoUrl,
        city_id: cityId,
        previousUsername: initialUsername,
      });

      if (username !== initialUsername) {
        router.push(`/${username}`);
      } else {
        router.refresh();
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast({ icon: <Error />, message: err.message });
    } finally {
      setSaving(false);
    }
  }

  const formBody = (
    <>
      {/* Avatar */}
      <div className="flex justify-center">
        <div
          ref={(el) => {
            if (!el) {
              avatarRef.current = null;
              return;
            }
            if (el.getBoundingClientRect().width > 0) avatarRef.current = el;
          }}
          className="relative cursor-pointer"
          onClick={handleAvatarClick}
        >
          <Avatar size="2xl" editIcon src={photoPreview || undefined} />
        </div>
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          className="hidden"
        />
        <input
          ref={captureInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handlePhotoChange}
          className="hidden"
        />
      </div>

      <Sheet
        isOpen={isPhotoSheetOpen}
        onClose={() => setIsPhotoSheetOpen(false)}
        anchorRef={avatarRef}
        title="Change photo"
        items={[
          {
            label: "Upload photo",
            onClick: () => {
              setIsPhotoSheetOpen(false);
              uploadInputRef.current?.click();
            },
          },
          ...(hasCamera
            ? [
                {
                  label: "Take photo",
                  onClick: () => {
                    setIsPhotoSheetOpen(false);
                    captureInputRef.current?.click();
                  },
                },
              ]
            : []),
          ...(photoPreview
            ? [
                {
                  label: "Remove photo",
                  onClick: handleRemovePhoto,
                  variant: "danger" as const,
                },
              ]
            : []),
        ]}
      />

      <TextInput
        focusBrand
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={30}
        placeholder="Your full name"
        state={name ? "filled" : "default"}
      />

      <TextInput
        focusBrand
        label="Username"
        value={username}
        onChange={(e) =>
          setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
        }
        required
        minLength={3}
        maxLength={30}
        placeholder="username"
        state={usernameStatus === "valid" ? "filled" : "default"}
        rightSlot={
          usernameStatus === "valid" ? (
            <Check focus className="text-brand" />
          ) : usernameStatus === "too-short" || usernameStatus === "taken" ? (
            <Error className="text-brand" />
          ) : undefined
        }
      />

      <CityAutocompleteInput
        focusBrand
        label="City"
        value={selectedCity?.display_name ?? ""}
        placeholder="Your city"
        onSelect={(city) => setSelectedCity(city)}
        onChange={() => setSelectedCity(null)}
      />

      <TextInput
        focusBrand
        label="Bio (optional)"
        size="tall"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        maxLength={110}
        placeholder="Tell us something about yourself..."
        state={bio ? "filled" : "default"}
      />

      <TextInput
        focusBrand
        label="Instagram (optional)"
        leftSlot={<span className="text-body-sm leading-none text-primary">@</span>}
        value={instagramHandle}
        onChange={(e) => setInstagramHandle(sanitizeInstagramHandleInput(e.target.value))}
        maxLength={30}
        placeholder="username"
        state={instagramHandle ? "filled" : "default"}
        rightSlot={
          !instagramHandle ? undefined : isInstagramValid ? (
            <Check focus className="text-brand" />
          ) : (
            <Error className="text-brand" />
          )
        }
      />

      {/* Delete account */}
      <div className="flex justify-center">
        <Button
          type="button"
          variant="outline"
          size="md"
          darkTheme
          className="!text-danger"
        >
          Delete account
        </Button>
      </div>
    </>
  );

  return (
    <BottomPanel
      isOpen={isOpen}
      onClose={onClose}
      header="Edit profile"
      desktopVariant="full-page"
      footer={
        <Button
          type="submit"
          form="edit-profile-form"
          variant="tonal"
          size="md"
          darkTheme
          disabled={saving || usernameStatus === "too-short" || usernameStatus === "taken" || usernameStatus === "checking" || !isInstagramValid}
          className="w-full"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      }
      desktopFooter={
        <Button
          type="submit"
          form="edit-profile-form"
          variant="tonal"
          size="lg"
          darkTheme
          disabled={saving || usernameStatus === "too-short" || usernameStatus === "taken" || usernameStatus === "checking" || !isInstagramValid}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      }
    >
      <form
        id="edit-profile-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        {loading ? (
          <p className="text-body-sm text-primary/50 text-center py-8">
            Loading...
          </p>
        ) : (
          formBody
        )}
      </form>
    </BottomPanel>
  );
}
