"use client";

import { Button } from "@/components/ui/Button";
import { Add } from "@/components/ui/icons/Add";
import { Arrows } from "@/components/ui/icons/Arrows";

/**
 * Just the "Add a spot" + "Reorder" button row — deliberately does not also
 * render SpotSearchPanel, since some callers (e.g. CreatePlaylistFlow) render
 * this row twice (once per breakpoint) but must mount the panel exactly once.
 * Mount SpotSearchPanel separately alongside this component.
 */
export function AddSpotSection({
  spotCount,
  reorderMode,
  onToggleReorder,
  onOpenSearch,
}: {
  spotCount: number;
  reorderMode: boolean;
  onToggleReorder: () => void;
  onOpenSearch: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Button
        size="lg"
        variant="tonal"
        leftIcon={<Add className="size-5" />}
        className="flex-1"
        onClick={onOpenSearch}
      >
        Add a spot
      </Button>
      {spotCount > 1 && (
        <Button
          size="lg"
          variant="tonal"
          leftIcon={<Arrows />}
          onClick={onToggleReorder}
        >
          <span className="sr-only">{reorderMode ? "Done reordering" : "Reorder spots"}</span>
        </Button>
      )}
    </div>
  );
}
