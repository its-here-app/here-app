import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import EmptyState from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6">
      <Link href="/">
        <Logo />
      </Link>
      <EmptyState
        className="mt-6"
        header="Playlist not found"
        message="This playlist doesn't exist or may have been made private."
        actionLabel="Back home"
        actionHref="/"
      />
    </div>
  );
}
