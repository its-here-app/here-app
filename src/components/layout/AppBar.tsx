"use client";

import { useAppBar } from "@/lib/appBarContext";
import { SlotRow } from "@/components/ui/SlotRow";

export default function AppBar() {
  const { state } = useAppBar();

  if (state.hidden) return null;

  return (
    <SlotRow
      left={state.left}
      center={state.center}
      right={state.right}
      className="mx-[var(--space-page-sm)] lg:mx-[var(--space-page-dynamic)] mt-[var(--space-page-sm)] lg:mt-[var(--space-page-dynamic)] h-9"
    />
  );
}
