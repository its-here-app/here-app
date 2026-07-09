import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import Message from "./Message";

interface EmptyStateProps {
  icon?: ReactNode;
  header?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  neonAction?: boolean;
}

export default function EmptyState({
  icon,
  header,
  message,
  actionLabel,
  onAction,
  neonAction = false,
}: EmptyStateProps) {
  return (
    <Message icon={icon} header={header}>
      <p>{message}</p>
      {actionLabel && (
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
