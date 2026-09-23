import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import EmptyState from "@/components/ui/EmptyState";

interface NotFoundScreenProps {
  header: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  /**
   * Height of the centering box. Replaces the default rather than appending to
   * it — two `min-h-*` classes on one element collide and CSS order decides the
   * winner. Standalone 404s (their own <html>) want the default full viewport;
   * one rendered inside AppShell must pass a shorter height, since the AppBar
   * and page padding already consume part of the viewport above it.
   */
  heightClassName?: string;
}

export default function NotFoundScreen({
  header,
  message,
  actionLabel = "Back home",
  actionHref = "/",
  heightClassName = "min-h-dvh",
}: NotFoundScreenProps) {
  return (
    <div
      className={`${heightClassName} flex flex-col items-center justify-center px-6`}
    >
      <Link href="/">
        <Logo />
      </Link>
      <EmptyState
        className="mt-6"
        header={header}
        message={message}
        actionLabel={actionLabel}
        actionHref={actionHref}
      />
    </div>
  );
}
