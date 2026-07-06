"use client";

import { useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SpotCard from "@/components/SpotCard";
import { IconButton } from "@/components/ui/IconButton";
import { Trash } from "@/components/ui/icons/Trash";
import { Reorder } from "@/components/ui/icons/Reorder";
import { CheckCircle } from "@/components/ui/icons/CheckCircle";
import { Info } from "@/components/ui/icons/Info";
import { snackbar } from "@/components/ui/Snackbar";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const noteAtFocus = useRef<string>("");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
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
            <input
              ref={inputRef}
              value={item.notes ?? ""}
              readOnly={reorderMode}
              onChange={(e) => onNotesChange(item.id, e.target.value)}
              onFocus={() => {
                setIsFocused(true);
                noteAtFocus.current = item.notes ?? "";
              }}
              onBlur={() => {
                setIsFocused(false);
                const current = item.notes ?? "";
                if (current !== noteAtFocus.current) {
                  const previous = noteAtFocus.current;
                  if (current.trim()) {
                    snackbar({
                      icon: <CheckCircle />,
                      message: `Note added to ${item.spot.name}`,
                      actionLabel: "Undo",
                      onAction: () => onNotesChange(item.id, previous),
                    });
                  } else if (previous.trim()) {
                    snackbar({
                      icon: <Info />,
                      message: `Note removed from ${item.spot.name}`,
                      actionLabel: "Undo",
                      onAction: () => onNotesChange(item.id, previous),
                    });
                  }
                }
              }}
              placeholder={reorderMode ? "" : "Add a highlight"}
              className="block w-full bg-transparent text-body-xs text-secondary placeholder:text-tertiary outline-none border-none p-0 leading-4 h-4 mb-1 truncate"
            />
          }
          action={
            reorderMode ? (
              <IconButton
                variant="ghost"
                icon={<Reorder />}
                label="Drag to reorder"
                className="cursor-grab active:cursor-grabbing"
                {...attributes}
                {...listeners}
              />
            ) : isFocused ? (
              <IconButton
                variant="secondary"
                icon={<Trash />}
                label="Remove spot"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onRemove(item.id);
                }}
              />
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
