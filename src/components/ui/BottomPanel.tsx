"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Close } from "./icons/Close";
import { FullLogo } from "./Logo";
import { Scrim } from "./Scrim";
import { useSlideTransition } from "@/lib/useSlideTransition";

interface BottomPanelProps {
  isOpen: boolean;
  onClose: () => void;
  header: string;
  /** Optional line directly below the header, same font as header but grey */
  subheader?: string;
  /** Optional footer area (e.g. a save/confirm button) */
  footer?: ReactNode;
  /** Overrides footer in the full-page desktop variant */
  desktopFooter?: ReactNode;
  /** Controls the desktop rendering: "full-page" = full-screen overlay, "floating" = centered card */
  desktopVariant: "full-page" | "floating";
  /** Custom width for the floating desktop variant (default: 24.375rem / 390px) */
  desktopWidth?: string;
  /** Optional fixed height for the floating desktop variant */
  desktopHeight?: string;
  /** Show the FullLogo — in the top bar for full-page, or top-left corner for floating */
  logo?: boolean;
  /** Centers the header text */
  centerHeader?: boolean;
  /** Mobile panel height: "tall" = 90vh, or a fixed value (e.g. "30rem"). Default is auto. */
  mobileHeight?: "tall" | string;
  /** Vertically centers the body/children within the available space */
  centerBody?: boolean;
  /** Mobile only. Shows a drag handle pill above the header and enables drag-to-dismiss at 90vh height. */
  handle?: boolean;
  children: ReactNode;
}

export function BottomPanel({
  isOpen,
  onClose,
  header,
  subheader,
  footer,
  desktopFooter,
  desktopVariant,
  desktopWidth,
  desktopHeight,
  logo = false,
  centerHeader = false,
  mobileHeight,
  centerBody = false,
  handle = false,
  children,
}: BottomPanelProps) {
  const { isVisible, isAnimating } = useSlideTransition(isOpen);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const dragStartY = useRef(0);
  const isDraggingRef = useRef(false);
  const scrollableRef = useRef<HTMLDivElement>(null);

  // Pointer Events (not Touch Events) so the handle drags with mouse, touch,
  // and pen alike. Pointer capture keeps move/up events targeting the handle
  // even once the pointer strays outside its small hit area mid-drag.
  // pointermove fires on plain mouse hover too (no button needed), so a ref
  // (checked synchronously, unlike state) gates it to only apply mid-drag.
  function handlePointerDown(e: React.PointerEvent) {
    dragStartY.current = e.clientY;
    isDraggingRef.current = true;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!isDraggingRef.current) return;
    setDragY(e.clientY - dragStartY.current);
  }
  function handlePointerUp() {
    isDraggingRef.current = false;
    setIsDragging(false);
    if (Math.abs(dragY) < 5) {
      // Negligible movement: treat as a tap, same as clicking the handle.
      setIsExpanded((prev) => !prev);
    } else if (isExpanded) {
      // Expanded: drag down far enough collapses back to the default height.
      if (dragY > 100) setIsExpanded(false);
    } else {
      // Collapsed: drag up far enough expands; drag down far enough dismisses.
      if (dragY < -40) setIsExpanded(true);
      else if (dragY > 100) onClose();
    }
    setDragY(0);
  }

  useEffect(() => {
    if (!isOpen) setIsExpanded(false);
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Plain `overflow: hidden` on the body doesn't stop iOS Safari from scrolling
  // the page (and panning fixed-position elements along with it) when a focused
  // input needs to be brought above the keyboard. Taking the body out of the
  // scrollable flow entirely with `position: fixed` denies iOS anything to pan,
  // so the sheet — a real `position: fixed` element — stays pinned to the true
  // bottom of the screen regardless of the keyboard. Scroll position is restored
  // on close since this technique resets it.
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const { position, top, left, right, width } = document.body.style;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    return () => {
      document.body.style.position = position;
      document.body.style.top = top;
      document.body.style.left = left;
      document.body.style.right = right;
      document.body.style.width = width;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // iOS still lets a touchmove drag rubber-band/scroll the document underneath
  // a `position: fixed` overlay even once body scroll is locked above — the fixed
  // positioning stops it from staying scrolled, but not from visibly moving
  // during the drag. Block touchmove everywhere except inside the panel's own
  // scrollable content, which still needs to scroll normally.
  useEffect(() => {
    if (!isOpen) return;
    function blockScroll(e: TouchEvent) {
      if (scrollableRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
    }
    document.addEventListener("touchmove", blockScroll, { passive: false });
    return () => document.removeEventListener("touchmove", blockScroll);
  }, [isOpen]);

  if (!isVisible) return null;

  const fadeIn = isAnimating ? "opacity-100" : "opacity-0";
  const closeBtn = (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="text-primary shrink-0 cursor-pointer"
    >
      <Close focus />
    </button>
  );

  return (
    <>
      {/* Desktop: full-page overlay */}
      {desktopVariant === "full-page" && (
        <div
          className={`fixed inset-0 z-[60] bg-surface-base dark hidden lg:flex flex-col transition-opacity duration-300 ${fadeIn}`}
        >
          <div className="relative z-10 flex items-center justify-between p-[var(--space-page-dynamic)] shrink-0">
            {logo ? <FullLogo color="white" className="w-20" /> : <div />}
            {closeBtn}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center py-12">
            <div className="flex flex-col gap-[3.75rem] w-[22.875rem]">
              <div className="flex flex-col items-center">
                <p className="text-body-sm-bold text-primary text-center">
                  {header}
                </p>
                {subheader && (
                  <p className="text-body-sm-bold text-secondary text-center">
                    {subheader}
                  </p>
                )}
              </div>
              {children}
              {(desktopFooter ?? footer) && (
                <div className="flex justify-center">
                  {desktopFooter ?? footer}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Desktop: floating card */}
      {desktopVariant === "floating" && (
        <div
          className={`fixed inset-0 z-[60] hidden lg:flex flex-col items-center justify-center transition-opacity duration-300 ${fadeIn}`}
        >
          <Scrim visible={isAnimating} onClick={onClose} variant="default" />
          {logo && (
            <div className="absolute top-8 left-8">
              <FullLogo color="white" />
            </div>
          )}
          <div
            className="relative bg-surface-base dark rounded-[2rem] p-6 flex flex-col gap-5 overflow-x-hidden"
            style={{
              width: desktopWidth ?? "24.375rem",
              height: desktopHeight,
            }}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="size-6 shrink-0" />
                <p className="text-body-sm-bold text-primary text-center flex-1">
                  {header}
                </p>
                {closeBtn}
              </div>
              {subheader && (
                <p className="text-body-sm-bold text-secondary text-center">
                  {subheader}
                </p>
              )}
            </div>
            {children}
          </div>
        </div>
      )}

      {/* Mobile: bottom sheet */}
      <div className="fixed inset-0 z-[60] lg:hidden flex flex-col justify-end pt-10">
        <Scrim visible={isAnimating} onClick={onClose} />
        <div
          className={`relative bg-surface-base dark rounded-t-[1.5rem] flex flex-col gap-5 px-6 pt-6 pb-[calc(2.25rem+env(safe-area-inset-bottom))] max-h-[90vh] overflow-hidden ${handle && isDragging ? "" : "transition-[transform,height]"} duration-300`}
          style={{
            height:
              isExpanded || mobileHeight === "tall" ? "90vh" : mobileHeight,
            transform: isAnimating
              ? `translateY(${handle ? Math.max(dragY, 0) : 0}px)`
              : "translateY(100%)",
          }}
        >
          {handle && (
            <div
              className="shrink-0 flex justify-center cursor-pointer py-4 -mt-7 -mb-4 touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>
          )}
          <div className="relative shrink-0">
            <div
              className={`flex flex-col ${centerHeader ? "items-center px-8" : "pr-8"}`}
            >
              <p className="text-body-sm-bold text-primary">{header}</p>
            </div>
            {subheader && (
              <p
                className={`text-body-sm-bold text-secondary ${centerHeader ? "text-center px-8" : "pr-8"}`}
              >
                {subheader}
              </p>
            )}
            <div className="absolute top-0 right-0">{closeBtn}</div>
          </div>
          <div
            ref={scrollableRef}
            className={`flex flex-col gap-4 min-h-0 overflow-y-auto ${mobileHeight || centerBody ? "flex-1" : ""} ${centerBody ? "justify-center" : ""}`}
          >
            {children}
          </div>
          {footer && <div className="shrink-0 pt-3 flex justify-center">{footer}</div>}
        </div>
      </div>
    </>
  );
}
