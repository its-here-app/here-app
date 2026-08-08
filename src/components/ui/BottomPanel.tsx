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
  const [viewportRect, setViewportRect] = useState<{ top: number; height: number } | null>(null);
  const touchStartY = useRef(0);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  }
  function handleTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setDragY(delta);
  }
  function handleTouchEnd() {
    setIsDragging(false);
    if (dragY > 100) {
      onClose();
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
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // iOS Safari shrinks the visual viewport (without resizing the layout viewport)
  // and pans it when the on-screen keyboard opens, which drags "fixed" elements
  // along with it since they're positioned relative to the layout viewport. Track
  // the visual viewport's own top/height and pin the sheet to those instead, so it
  // stays flush with the bottom of the visible area above the keyboard.
  useEffect(() => {
    if (!isOpen) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    function syncViewport() {
      setViewportRect({ top: viewport!.offsetTop, height: viewport!.height });
    }
    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);
    return () => {
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
      setViewportRect(null);
    };
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
      <div
        className="fixed left-0 right-0 z-[60] lg:hidden flex flex-col justify-end"
        style={{
          top: viewportRect ? viewportRect.top : 0,
          height: viewportRect ? viewportRect.height : "100%",
        }}
      >
        <Scrim visible={isAnimating} onClick={onClose} />
        <div
          className={`relative bg-surface-base dark rounded-t-[1.5rem] flex flex-col gap-5 px-6 pt-6 pb-[calc(2.25rem+env(safe-area-inset-bottom))] overflow-x-hidden ${handle && isDragging ? "" : "transition-[transform,height]"} duration-300`}
          style={{
            height:
              isExpanded || mobileHeight === "tall" ? "90vh" : mobileHeight,
            transform: isAnimating
              ? `translateY(${handle ? dragY : 0}px)`
              : "translateY(100%)",
          }}
          {...(handle
            ? {
                onTouchStart: handleTouchStart,
                onTouchMove: handleTouchMove,
                onTouchEnd: handleTouchEnd,
              }
            : {})}
        >
          {/*
            The panel's own height only covers the content above the keyboard.
            iOS pans/resizes the visual viewport as the keyboard animates in, which
            can momentarily desync from our tracked viewportRect and expose whatever
            is beneath the panel. This filler extends the same background straight
            down past any possible keyboard height so that gap is always black,
            never the page behind it.
          */}
          <div className="absolute top-full inset-x-0 h-[100vh] bg-surface-base pointer-events-none" />
          {handle && (
            <div
              className="flex justify-center cursor-pointer py-4 -mt-7 -mb-4 touch-none"
              onClick={() => setIsExpanded((prev) => !prev)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>
          )}
          <div className="relative">
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
            className={`flex flex-col gap-4 ${mobileHeight || centerBody ? "flex-1" : ""} ${centerBody ? "justify-center" : ""}`}
          >
            {children}
          </div>
          {footer && <div className="pt-3 flex justify-center">{footer}</div>}
        </div>
      </div>
    </>
  );
}
