"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FullLogo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Error as ErrorIcon } from "@/components/ui/icons/Error";
import { toast } from "@/components/ui/Toast";

export default function DeleteAccountPage() {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      // TODO(backend): call the account-deletion endpoint, then sign out
      // and redirect (e.g. to "/" or a confirmation screen).
    } catch (err: any) {
      toast({ icon: <ErrorIcon />, message: err.message ?? "Failed to delete account" });
    } finally {
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
