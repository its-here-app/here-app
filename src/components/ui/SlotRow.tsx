import type { ReactNode } from "react";

interface SlotRowProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function SlotRow({ left, center, right, className }: SlotRowProps) {
  return (
    <div className={`grid grid-cols-[1fr_auto_1fr] items-center whitespace-nowrap ${className ?? ""}`}>
      <div className="flex justify-start">{left}</div>
      <div className="flex justify-center">{center}</div>
      <div className="flex justify-end">{right}</div>
    </div>
  );
}
