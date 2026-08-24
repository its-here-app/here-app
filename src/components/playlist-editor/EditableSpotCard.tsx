"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SpotCard from "@/components/SpotCard";
import { IconButton } from "@/components/ui/IconButton";
import { Trash } from "@/components/ui/icons/Trash";
import { Reorder } from "@/components/ui/icons/Reorder";
import type { Spot } from "@/types";

export interface EditableSpotItem {
  /** Stable key: PlaylistSpot.id for the edit flow, DraftSpot.google_place_id for create flow */
  id: string;
  spot: Pick<Spot, "google_place_id" | "name" | "address" | "photo_url">;
  notes?: string;
}

export function EditableSpotCard({
  item,
  reorderMode,
  onRemove,
  onNotesChange,
}: {
  item: EditableSpotItem;
  reorderMode: boolean;
  onRemove: (id: string) => void;
  onNotesChange: (id: string, notes: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Notes render as a full-height, wrapping textarea (not truncated to one
  // line) so the whole highlight is always visible while editing a playlist.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "1px";
    el.style.height = `${el.scrollHeight}px`;
  }, [item.notes]);

  // The create-playlist flow mounts this card in both a desktop and a
  // mobile container simultaneously (CSS toggles which is visible), so the
  // effect above can measure scrollHeight against a not-yet-laid-out
  // ancestor (e.g. mid panel-open transition) and freeze at ~0px. Re-measure
  // whenever the element's own box actually changes size.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      el.style.height = "1px";
      el.style.height = `${el.scrollHeight}px`;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div className="flex items-start gap-3">
        <SpotCard
          spot={{
            google_place_id: item.spot.google_place_id,
            name: item.spot.name,
            address: item.spot.address,
            photo_url: item.spot.photo_url,
          }}
          subtitleText={item.notes ?? ""}
          className="flex-1"
          disableLink
          onClick={reorderMode ? undefined : () => inputRef.current?.focus()}
          subtitleSlot={
            <textarea
              ref={inputRef}
              rows={1}
              value={item.notes ?? ""}
              readOnly={reorderMode}
              onChange={(e) => onNotesChange(item.id, e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={reorderMode ? "" : "Add a highlight"}
              className="block w-full resize-none bg-transparent text-body-xs text-secondary placeholder:text-tertiary outline-none border-none p-0 leading-4 mb-1"
            />
          }
          action={
            reorderMode ? (
              <IconButton
                key="reorder"
                variant="ghost"
                icon={<Reorder />}
                label="Drag to reorder"
                className="touch-none cursor-grab active:cursor-grabbing"
                {...attributes}
                {...listeners}
              />
            ) : (
              <IconButton
                key="trash"
                variant="secondary"
                icon={<Trash />}
                label="Remove spot"
                className={`transition-opacity opacity-0 group-hover:opacity-100 ${isFocused ? "[@media(hover:none)]:opacity-100" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onRemove(item.id);
                }}
              />
            )
          }
        />
      </div>
    </div>
  );
}
