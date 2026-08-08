"use client";

import { Button } from "@/components/ui/Button";
import { Add } from "@/components/ui/icons/Add";
import { Arrows } from "@/components/ui/icons/Arrows";

/**
 * Just the add-spot + "Reorder" button row — deliberately does not also
 * render SpotSearchPanel, since some callers (e.g. CreatePlaylistFlow) render
 * this row twice (once per breakpoint) but must mount the panel exactly once.
 * Mount SpotSearchPanel separately alongside this component.
 */
export function AddSpotSection({
  spotCount,
  reorderMode,
  onToggleReorder,
  onOpenSearch,
  showImport,
  onImport,
}: {
  spotCount: number;
  reorderMode: boolean;
  onToggleReorder: () => void;
  onOpenSearch: () => void;
  /** Shows a black "Import" button in place of the add-spot button (e.g. while the list-paste textarea has content) */
  showImport?: boolean;
  onImport?: () => void;
}) {
  return (
    <div className="flex gap-2">
      {showImport ? (
        <Button size="lg" variant="filled" className="flex-1" onClick={onImport}>
          Import
        </Button>
      ) : (
        <Button
          size="lg"
          variant="tonal"
          leftIcon={<Add className="size-5" />}
          className="flex-1"
          onClick={onOpenSearch}
        >
          Search spots
        </Button>
      )}
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
