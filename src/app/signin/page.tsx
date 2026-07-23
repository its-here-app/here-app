"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/authContext";
import { createClient } from "../../lib/supabase/client";
import { Smiley, Arrow } from "../../components/ui/stickers";
import { TextInput } from "../../components/ui/inputs";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { ArrowRight } from "../../components/ui/icons/ArrowRight";
import { Google } from "../../components/ui/icons/Google";
import { Avatar } from "../../components/ui/Avatar";
import { Sheet } from "../../components/ui/Sheet";
import { Check } from "../../components/ui/icons/Check";
import { Error } from "../../components/ui/icons/Error";
import { FullLogo } from "../../components/ui/Logo";
import { toast } from "../../components/ui/Toast";
import { CoverPhotoRotator } from "../../components/ui/CoverPhotoRotator";

import { CityAutocompleteInput } from "../../components/ui/inputs/CityAutocompleteInput";
import { upsertCityAction } from "../../lib/actions/cities";
import { updateProfileAction } from "../../lib/actions/users";
import { getUserByUsername } from "../../lib/services/users";
import {
  isValidInstagramHandle,
  sanitizeInstagramHandleInput,
} from "../../lib/isValidInstagramHandle";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { useAvatarUpload } from "../../lib/useAvatarUpload";

type Step = "auth" | "profile";
type UsernameStatus = "idle" | "too-short" | "checking" | "valid" | "taken";

export default function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  // Auth step
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Multi-step
  const [step, setStep] = useState<Step>("auth");

  // Profile step
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [bio, setBio] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [selectedCity, setSelectedCity] = useState<{
    google_place_id: string;
    display_name: string;
    is_primary?: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
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
  } = useAvatarUpload();
  const isInstagramValid =
    !instagramHandle || isValidInstagramHandle(instagramHandle);

  // Handle returning from Google OAuth or already-authenticated users
  useEffect(() => {
    if (authLoading || !user || step === "profile") return;

    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single()
      .then(({ data: profile }) => {
        if (profile?.username) {
          router.push("/");
        } else {
          if (user.user_metadata?.full_name || user.user_metadata?.name) {
            setName(user.user_metadata.full_name ?? user.user_metadata.name);
          }
          setStep("profile");
        }
      });
  }, [user?.id, authLoading]);

  const debouncedUsername = useDebouncedValue(username, 800);
  const debouncedInstagramHandle = useDebouncedValue(instagramHandle, 800);

  // Debounced username uniqueness check
  useEffect(() => {
    if (username.length === 0) {
      setUsernameStatus("idle");
    } else if (username.length >= 3) {
      setUsernameStatus("checking");
    }
  }, [username]);

  useEffect(() => {
    if (debouncedUsername.length === 0) return;
    if (debouncedUsername.length < 3) {
      setUsernameStatus("too-short");
      return;
    }
    getUserByUsername(debouncedUsername).then((existing) => {
      setUsernameStatus(existing ? "taken" : "valid");
    });
  }, [debouncedUsername]);

  useEffect(() => {
    if (usernameStatus === "too-short") {
      toast({
        icon: <Error />,
        message: "Username must be at least 3 characters",
      });
    } else if (usernameStatus === "taken") {
      toast({
        icon: <Error />,
        message: "Username already taken, please try another",
      });
    }
  }, [usernameStatus]);

  useEffect(() => {
    if (!debouncedInstagramHandle || debouncedInstagramHandle.length >= 2)
      return;
    toast({
      icon: <Error />,
      message: "Instagram handle must be at least 2 characters",
    });
  }, [debouncedInstagramHandle]);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    setShowPassword(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (!signInError && signInData.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", signInData.user.id)
          .single();

        if (!profile?.username) {
          setStep("profile");
          return;
        }

        router.push("/");
        return;
      }

      if (signInError?.message.includes("Invalid login credentials")) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) throw signUpError;

        setStep("profile");
        return;
      }

      throw signInError;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    await supabase.auth.signOut();
    setStep("auth");
    setName("");
    setUsername("");
    setBio("");
    setInstagramHandle("");
    setSelectedCity(null);
    handleRemovePhoto();
    setError("");
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError("");

    try {
      const photoUrl = (await uploadAvatar(user.id)) || null;

      const { error: dbError } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        full_name: name,
        username,
        bio,
        instagram_handle: instagramHandle,
        avatar_url: photoUrl,
      });

      if (dbError) throw dbError;

      // Save city via server action (client-side upsert can't write city_id due to RLS)
      if (selectedCity) {
        const cityId = await upsertCityAction({
          google_place_id: selectedCity.google_place_id,
          display_name: selectedCity.display_name,
          is_primary: selectedCity.is_primary,
        });
        await updateProfileAction({
          full_name: name,
          username,
          bio,
          instagram_handle: instagramHandle,
          avatar_url: photoUrl ?? "",
          city_id: cityId,
          previousUsername: username,
        });
      }

      router.push("/");
    } catch (err: any) {
      toast({ icon: <Error />, message: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return <main className="h-dvh bg-surface-base dark" />;
  }

  return (
    <main className="relative flex h-dvh flex-row dark overflow-hidden max-w-[var(--app-max-width)] mx-auto">
      {/* Left column */}
      <div className="relative flex flex-col h-full overflow-hidden flex-1 min-w-0 min-h-[40rem]">
        <div className="p-[var(--space-page-dynamic)] flex flex-row items-center justify-between">
          <FullLogo className="mt-2" color="white" />
          {step === "profile" ? (
            <button
              type="button"
              onClick={handleCancel}
              className="text-body-sm text-primary/50 hover:text-primary/80 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          ) : undefined}
        </div>

        <div className="relative flex-1 overflow-hidden">
          {/* ── Auth panel ── */}
          <div
            className={`absolute inset-0 flex flex-col justify-end gap-9 p-[var(--space-page-dynamic)] pb-30 z-10 transition-transform duration-600 ease-in-out ${
              step === "auth" ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Stickers */}
            <div className="absolute top-6 right-16 pointer-events-none">
              <Smiley color="outline" size={127} />
            </div>
            <div className="absolute top-31 right-7 pointer-events-none">
              <Arrow color="cream" size={84} className="-rotate-45" />
            </div>

            {/* Title */}
            <div className="flex flex-col gap-4 text-primary">
              <h1 className="text-display-radio-1">
                Sign in <div>or sign up</div>
              </h1>
              <p className="text-body-sm max-w-[22rem]">
                {showPassword
                  ? "Enter your password to continue"
                  : "It's time to discover new spots around you and share your favorites in your own city playlists!"}
              </p>
            </div>

            {/* Auth options */}
            <div className="flex flex-col gap-3">
              <Button
                variant="tonal"
                size="lg"
                darkTheme
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full"
                leftIcon={<Google className="w-5 h-5" />}
              >
                Continue with Google
              </Button>

              <form
                onSubmit={showPassword ? handleSubmit : handleEmailContinue}
                className="flex flex-col gap-3"
              >
                <TextInput
                  focusBrand
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={showPassword}
                  placeholder="Your email"
                  state={showPassword ? "filled" : "default"}
                  rightSlot={
                    <IconButton
                      type="submit"
                      variant="brand"
                      label="Continue"
                      disabled={loading}
                      icon={<ArrowRight />}
                    />
                  }
                />

                {showPassword && (
                  <TextInput
                    focusBrand
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                    placeholder="Password"
                    state="default"
                  />
                )}
              </form>

              {showPassword && (
                <button
                  type="button"
                  onClick={() => {
                    setShowPassword(false);
                    setPassword("");
                    setError("");
                  }}
                  className="text-body-sm text-primary/50 hover:text-primary/80 transition-colors text-left cursor-pointer"
                >
                  ← Use a different email
                </button>
              )}

              {error && <p className="text-body-sm text-red-400">{error}</p>}
            </div>
          </div>

          {/* ── Profile panel ── */}
          <div
            className={`absolute inset-0 min-h-[48rem] flex flex-col items-center lg:items-start justify-center gap-12 -mt-24 px-[var(--space-page-dynamic)] transition-transform duration-600 ease-in-out ${
              step === "profile" ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="text-center lg:text-left text-primary">
              <h1 className="text-display-radio-2 lg:text-display-radio-1 mb-2 max-w-[18rem]">
                Welcome Here*!
              </h1>
              <p className="text-body-sm">Let’s start with some basics</p>
            </div>

            <form
              id="profile-form"
              onSubmit={handleProfileSubmit}
              className="flex flex-col gap-2 w-full"
            >
              <div className="flex justify-center lg:justify-start lg:mb-4">
                <div
                  ref={avatarRef}
                  className="relative cursor-pointer"
                  onClick={handleAvatarClick}
                >
                  <Avatar size="2xl" editIcon src={photoPreview || undefined} />
                </div>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <input
                  ref={captureInputRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  capture="user"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>

              <Sheet
                isOpen={isPhotoSheetOpen}
                onClose={() => setIsPhotoSheetOpen(false)}
                anchorRef={avatarRef}
                title={photoPreview ? "Change photo" : "Add photo"}
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
                aria-label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={30}
                placeholder="Your name"
                state={name ? "filled" : "default"}
              />

              <TextInput
                focusBrand
                aria-label="Username"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  )
                }
                required
                maxLength={30}
                placeholder="Username"
                state={usernameStatus === "valid" ? "filled" : "default"}
                rightSlot={
                  usernameStatus === "valid" ? (
                    <Check focus className="text-brand" />
                  ) : usernameStatus === "too-short" ||
                    usernameStatus === "taken" ? (
                    <Error className="text-brand" />
                  ) : undefined
                }
              />

              <CityAutocompleteInput
                focusBrand
                value={selectedCity?.display_name ?? ""}
                placeholder="City"
                onSelect={(city) => setSelectedCity(city)}
                onChange={() => setSelectedCity(null)}
              />

              <TextInput
                focusBrand
                aria-label="Bio"
                size="tall"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={110}
                placeholder="Tell us something about yourself... (Optional)"
                state={bio ? "filled" : "default"}
              />

              <TextInput
                focusBrand
                aria-label="Instagram"
                leftSlot={
                  instagramHandle ? (
                    <span className="text-body-sm leading-none text-primary">
                      @
                    </span>
                  ) : undefined
                }
                value={instagramHandle}
                onChange={(e) =>
                  setInstagramHandle(
                    sanitizeInstagramHandleInput(e.target.value),
                  )
                }
                maxLength={30}
                placeholder="Instagram username (Optional)"
                state={instagramHandle ? "filled" : "default"}
                rightSlot={
                  !instagramHandle ? undefined : isInstagramValid ? (
                    <Check focus className="text-brand" />
                  ) : (
                    <Error className="text-brand" />
                  )
                }
              />
            </form>

            {/* Done button — pinned to bottom on all sizes */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center px-[var(--space-page-dynamic)]">
              <Button
                type="submit"
                form="profile-form"
                variant="filled"
                size="lg"
                darkTheme
                softDisabled
                disabled={
                  saving ||
                  !name ||
                  usernameStatus !== "valid" ||
                  !isInstagramValid
                }
                className="w-full"
              >
                {saving ? "Saving..." : "Done"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right column — grows in horizontally at lg */}
      <div className="overflow-hidden shrink-0 h-full w-0 lg:w-[60%] transition-[width] duration-400 ease-out">
        <div className="h-full w-[60vw] py-[var(--space-page-sm)] pr-[var(--space-page-sm)]">
          <CoverPhotoRotator className="h-full w-full rounded-sm" />
        </div>
      </div>
    </main>
  );
}
