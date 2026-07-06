import type { ReactNode } from "react";

export type ChipVariant = "primary" | "secondary";

interface ChipProps {
  variant?: ChipVariant;
  leftIcon?: ReactNode;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

const variantClasses: Record<ChipVariant, string> = {
  primary: "bg-black text-white",
  secondary: "bg-grey-300 text-grey-500",
};

export function Chip({ variant = "primary", leftIcon, onClick, className, children }: ChipProps) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1 h-8 rounded-full px-[0.875rem] text-body-xs ${variantClasses[variant]} ${onClick ? "cursor-pointer" : ""} ${className ?? ""}`}
    >
      {leftIcon && <span className="shrink-0">{leftIcon}</span>}
      {children}
    </Tag>
  );
}
