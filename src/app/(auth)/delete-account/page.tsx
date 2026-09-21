"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { deleteAccountAction } from "@/lib/actions/users";
import { signOut } from "@/lib/services/users";
import { FullLogo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Check } from "@/components/ui/icons/Check";
import { Error as ErrorIcon } from "@/components/ui/icons/Error";
import { toast } from "@/components/ui/Toast";

export default function DeleteAccountPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [deleting, setDeleting] = useState(false);

  // Only reachable signed in; a stray deep link goes to sign-in like everywhere else.
  useEffect(() => {
    if (!loading && !user && !deleting) router.replace("/signin");
  }, [user?.id, loading, deleting]);

  async function handleDelete() {
    setDeleting(true);
    try {
      // Soft delete (14-day undo), then a global sign-out so every device's
      // refresh token is revoked, not just this one's.
      await deleteAccountAction();
      await signOut();
      toast({ icon: <Check focus />, message: "Your account has been deleted" });
      router.replace("/signin");
    } catch (err: any) {
      toast({ icon: <ErrorIcon />, message: err.message ?? "Failed to delete account" });
      setDeleting(false);
    }
  }

  return (
    <main className="relative flex flex-col h-dvh dark p-[var(--space-page-dynamic)] max-w-[var(--app-max-width)] mx-auto">
      <FullLogo color="white" />

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <h1 className="text-display-radio-2 text-primary mb-4">Delete your account?</h1>
        <p className="text-body-sm text-primary">
          Your profile and lists will disappear.
          <br />
          Sign back in within 14 days to undo.
        </p>

        <div className="flex flex-col items-center gap-3 w-full mt-12">
          <Button
            type="button"
            variant="outline"
            size="lg"
            darkTheme
            disabled={deleting}
            onClick={handleDelete}
            className="w-full sm:w-auto !text-danger"
          >
            {deleting ? "Deleting..." : "Yes, delete"}
          </Button>
          <Button
            type="button"
            variant="tonal"
            size="lg"
            darkTheme
            disabled={deleting}
            onClick={() => router.back()}
            className="w-full sm:w-auto"
          >
            Never mind
          </Button>
        </div>
      </div>
    </main>
  );
}
