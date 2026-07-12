"use client";

import { useSlideTransition } from "@/lib/useSlideTransition";
import { Scrim } from "@/components/ui/Scrim";
import { SlotRow } from "@/components/ui/SlotRow";
import { Button } from "@/components/ui/Button";
import SpotSearchInput from "@/components/SpotSearchInput";
import type { SearchResult } from "@/types";

interface SpotSearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  city?: string;
  cityId?: string;
  onSelect: (result: SearchResult) => void;
  addedPlaceIds?: Set<string>;
}

export function SpotSearchPanel({ isOpen, onClose, city, cityId, onSelect, addedPlaceIds }: SpotSearchPanelProps) {
  const { isVisible, isAnimating } = useSlideTransition(isOpen);

  const closeButton = (
    <Button variant="text" size="md" onClick={onClose}>
      Close
    </Button>
  );
  const doneButton = (
    <Button variant="text" size="md" onClick={onClose}>
      Done
    </Button>
  );
  const title = <p className="text-body-sm-bold text-primary">Add spots</p>;

  return (
    <>
      {/* Desktop: inline, instant swap in place — no slide, nothing to slide */}
      {isOpen && (
        <div className="hidden lg:flex lg:flex-col lg:h-full">
          <SlotRow className="mb-6" left={closeButton} center={title} right={doneButton} />
          <div className="flex-1 overflow-y-auto">
            <SpotSearchInput placeholder="Search" city={city} cityId={cityId} addedPlaceIds={addedPlaceIds} onSelect={onSelect} />
          </div>
        </div>
      )}

      {/* Mobile: full-screen sheet, slides up like BottomPanel */}
      {isVisible && (
        <div className="fixed inset-0 z-[70] lg:hidden flex flex-col justify-end">
          <Scrim visible={isAnimating} onClick={onClose} />
          <div
            className="relative bg-white h-full flex flex-col transition-transform duration-300 overflow-hidden"
            style={{ transform: isAnimating ? "translateY(0)" : "translateY(100%)" }}
          >
            <SlotRow className="p-[var(--space-page-sm)] shrink-0" left={closeButton} center={title} right={doneButton} />
            <div className="flex-1 overflow-y-auto px-[var(--space-page-sm)]">
              <SpotSearchInput placeholder="Search" city={city} cityId={cityId} addedPlaceIds={addedPlaceIds} onSelect={onSelect} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
