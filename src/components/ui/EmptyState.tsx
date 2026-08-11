import type { ReactNode } from "react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/Button";
import Message from "./Message";

interface EmptyStateProps {
  icon?: ReactNode;
  header?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  neonAction?: boolean;
  className?: string;
}

export default function EmptyState({
  icon,
  header,
  message,
  actionLabel,
  onAction,
  actionHref,
  neonAction = false,
  className,
}: EmptyStateProps) {
  return (
    <Message icon={icon} header={header} className={className}>
      <p className="whitespace-pre-line">{message}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className={`mt-6 ${buttonClasses({ size: "lg", variant: neonAction ? "brand" : "tonal" })}`}
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && !actionHref && (
        <Button
          size="lg"
          variant={neonAction ? "brand" : "tonal"}
          className="mt-6"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </Message>
  );
}
