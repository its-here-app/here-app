import { type ReactNode } from "react";
import { Check } from "@/components/ui/icons/Check";

interface DropdownListItemProps {
  icon?: ReactNode;
  label: string;
  selected?: boolean;
  onClick?: () => void;
}

export function DropdownListItem({
  icon,
  label,
  selected = false,
  onClick,
}: DropdownListItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center h-9 gap-2 w-full cursor-pointer"
    >
      {icon && (
        <span className="size-6 shrink-0 flex items-center justify-center text-primary">
          {icon}
        </span>
      )}
      <span className="flex-1 text-left text-header-radio-2 text-primary">
        {label}
      </span>
      {selected && <Check focus className="size-6 shrink-0 text-primary" />}
    </button>
  );
}
