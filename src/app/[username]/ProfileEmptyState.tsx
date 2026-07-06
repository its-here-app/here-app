import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import ProfileMessage from "./ProfileMessage";

interface ProfileEmptyStateProps {
  icon?: ReactNode;
  header?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  neonAction?: boolean;
}

export default function ProfileEmptyState({
  icon,
  header,
  message,
  actionLabel,
  onAction,
  neonAction = false,
}: ProfileEmptyStateProps) {
  return (
    <ProfileMessage icon={icon} header={header}>
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
    </ProfileMessage>
  );
}
