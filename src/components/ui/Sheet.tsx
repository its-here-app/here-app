"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode, RefObject } from "react";
import { Scrim } from "./Scrim";
import { Button } from "./Button";

export interface SheetItem {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  icon?: ReactNode;
}

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  items: SheetItem[];
  anchorRef?: RefObject<HTMLElement | null>;
  /** Force horizontal alignment of the dropdown. "start" = opens right, "end" = opens left. Default: auto based on viewport position. */
  align?: "start" | "end";
}

interface ConfirmSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Optional supporting line under the title (e.g. what the action does). */
  description?: string;
  items: SheetItem[];
}

export function ConfirmSheet({
  isOpen,
  onClose,
  title = "Are you sure?",
  description,
  items,
}: ConfirmSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(false);
      let raf2: number;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setIsAnimating(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    } else {
      setIsAnimating(false);
      const t = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape, { capture: true });
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape, { capture: true });
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <Scrim visible={isAnimating} onClick={onClose} />
      <div
        className={`relative w-full sm:max-w-xs bg-surface-base rounded-[1rem] flex flex-col overflow-hidden transition-all duration-200 ${
          isAnimating ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="py-4 px-3 flex flex-col items-center justify-center gap-1 border-b border-subtle">
          <p className="text-body-sm-bold text-primary text-center">{title}</p>
          {description && (
            <p className="text-body-xs text-secondary text-center">{description}</p>
          )}
        </div>
        {items.map((item, i) => (
          <button
            type="button"
            key={i}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`flex h-[46px] items-center justify-center px-3 cursor-pointer text-body-xs ${
              item.variant === "danger" ? "text-danger" : "text-primary"
            } ${i < items.length - 1 ? "border-b border-subtle" : ""}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type DropdownPos = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

export function Sheet({ isOpen, onClose, title, items, anchorRef, align }: SheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isLg = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

  // Compute dropdown position before paint so it's always set when isVisible becomes true
  useLayoutEffect(() => {
    if (!isOpen || !anchorRef?.current) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    const rect = anchorRef.current.getBoundingClientRect();
    const estimatedHeight = 200;

    // Vertical: below if there's space, otherwise above
    const belowFits = rect.bottom + 8 + estimatedHeight < window.innerHeight;
    const vertical: DropdownPos = belowFits
      ? { top: rect.bottom + 8 }
      : { bottom: window.innerHeight - rect.top + 8 };

    // Horizontal: forced by align prop, or auto based on anchor center
    const anchorCenter = rect.left + rect.width / 2;
    const horizontal: DropdownPos =
      align === "end" || (align !== "start" && anchorCenter > window.innerWidth / 2)
        ? { right: window.innerWidth - rect.right }
        : { left: rect.left };

    setDropdownPos({ ...vertical, ...horizontal });
  }, [isOpen]);

  // Visibility + animation
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(false);
      let raf2: number;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setIsAnimating(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    } else {
      setIsAnimating(false);
      const t = setTimeout(() => {
        setIsVisible(false);
        setDropdownPos(null);
      }, isLg ? 150 : 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Body scroll lock — mobile only
  useEffect(() => {
    if (!isLg && isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, isLg]);

  // Click outside — lg+ only
  useEffect(() => {
    if (!isLg || !isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !anchorRef?.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isLg, isOpen, onClose]);

  if (!isVisible) return null;

  // ── lg+ dropdown ───────────────────────────────────────────────────────────
  if (isLg) {
    // Don't render until position is known
    if (!dropdownPos) return null;

    return createPortal(
      <div
        ref={dropdownRef}
        style={dropdownPos}
        className={`fixed z-[60] bg-surface-base rounded-[1rem] shadow-[2px_2px_15px_rgba(0,0,0,0.1)] px-[1.125rem] py-3 flex flex-col transition-all duration-150 origin-top ${
          isAnimating ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        {items.map((item, i) => (
          <button
            type="button"
            key={i}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`flex items-center gap-2 cursor-pointer text-body-xs whitespace-nowrap ${
              item.variant === "danger" ? "text-danger" : "text-primary"
            } ${i < items.length - 1 ? "border-b border-subtle pb-2 mb-2" : ""}`}
          >
            {item.icon && (
              <span className="size-5 flex items-center justify-center shrink-0">
                {item.icon}
              </span>
            )}
            {item.label}
          </button>
        ))}
      </div>,
      document.body
    );
  }

  // ── Mobile bottom sheet ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <Scrim visible={isAnimating} onClick={onClose} />
      <div
        className={`relative flex flex-col gap-2 p-3 w-full sm:max-w-sm mx-auto transition-transform duration-300 ${
          isAnimating ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Options card */}
        <div className="bg-surface-base backdrop-blur-[12px] rounded-[1rem] flex flex-col overflow-hidden">
          {title && (
            <div className="py-4 px-3 flex items-center justify-center">
              <p className="text-body-sm-bold text-primary text-center">
                {title}
              </p>
            </div>
          )}
          {items.map((item, i) => (
            <button
              type="button"
              key={i}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className={`flex h-[46px] items-center justify-center px-3 cursor-pointer text-body-xs ${
                item.variant === "danger" ? "text-danger" : "text-primary"
              } ${i < items.length - 1 ? "border-b border-subtle" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Cancel */}
        <Button
          variant="tonal"
          size="lg"
          onClick={onClose}
          className="w-full"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
