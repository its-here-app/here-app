"use client";

import { useState, useRef, useLayoutEffect, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "./ui/icons/ArrowRight";
import { IconButton } from "./ui/IconButton";
import { SlotRow } from "./ui/SlotRow";
import { Badge } from "./ui/Badge";
import { Rating } from "./ui/Rating";
import { getThumbCoverUrl } from "@/lib/playlist-covers";

const FILTERED_METADATA_TYPES = new Set(["point_of_interest", "establishment"]);

// ─── TextScrim ────────────────────────────────────────────────────────────────
// Gradient overlay for text legibility on card images.

export type TextScrimSize = "sm" | "md" | "lg" | "hero";
export type TextScrimType = "city" | "playlist" | "playlist-edit" | "spot";

interface TextScrimProps {
  size?: TextScrimSize;
  type?: TextScrimType;
  children?: ReactNode;
  className?: string;
}

const scrimDimensions: Record<TextScrimSize, string> = {
  sm: "size-[10rem]",
  md: "size-[15.0625rem]",
  lg: "size-[23.375rem]",
  hero: "h-[29.25rem] w-[23.375rem]",
};

export function TextScrim({
  size = "hero",
  children,
  className,
}: TextScrimProps) {
  return (
    <div
      className={`relative overflow-hidden ${scrimDimensions[size]} ${className ?? ""}`}
    >
      {children}
      <div
        className="absolute inset-0 mix-blend-soft-light pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 20%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.45) 65%, rgba(0,0,0,0.2) 80%, rgba(0,0,0,0.05) 88%, rgba(0,0,0,0.25) 94%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────

export type CardSize = "hero" | "featured" | "lg" | "md" | "sm" | "xs" | "empty";

interface CardProps {
  size?: CardSize;
  image?: string;
  city?: string;
  name?: string;
  title?: string;
  subtitle?: string;
  /** Info block rendered under the card, styled and formatted like SpotCard: title + 2 metadata rows */
  metadata?: {
    title: string;
    subtitleText?: string;
    /** Rich subtitle (e.g. avatar + text) rendered instead of subtitleText when provided */
    subtitleContent?: ReactNode;
    rating?: number | null;
    types?: string[] | null;
    city?: string;
  };
  /** Set to false to hide metadata row 2 (badge/rating/city) */
  metadataRow2?: boolean;
  /** Slot rendered to the right of the metadata block, e.g. a bookmark button */
  metadataRight?: ReactNode;
  /** Shows the Today's Pick sticker in the upper-left corner of the cover */
  sticker?: boolean;
  /** Truncate the title to a single line with an ellipsis */
  truncate?: boolean;
  /** Overlay action slots */
  topLeft?: ReactNode;
  topCenter?: ReactNode;
  topRight?: ReactNode;
  bottomLeft?: ReactNode;
  bottomCenter?: ReactNode;
  bottomRight?: ReactNode;
  /** When provided, renders the name as an editable inline textarea */
  onNameChange?: (name: string) => void;
  onNameBlur?: (name: string) => void;
  readOnlyName?: boolean;
  autoFocusName?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
  /** Set to false to hide the gradient scrim over the image */
  scrim?: boolean;
}

function TopActions({
  left,
  center,
  right,
  padding,
}: {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  padding: string;
}) {
  if (!left && !center && !right) return null;
  return (
    <SlotRow left={left} center={center} right={right} className={`absolute top-0 inset-x-0 ${padding}`} />
  );
}

function BottomActions({
  left,
  center,
  right,
  padding,
}: {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  padding: string;
}) {
  if (!left && !center && !right) return null;
  return (
    <SlotRow left={left} center={center} right={right} className={`absolute bottom-0 inset-x-0 ${padding}`} />
  );
}

const defaultScrim =
  "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.12) 10%, rgba(0,0,0,0.3) 25%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.35) 63%, rgba(0,0,0,0.28) 74%, rgba(0,0,0,0.1) 82%, rgba(0,0,0,0.03) 87%, rgba(0,0,0,0.12) 92%, rgba(0,0,0,0.3) 96%, rgba(0,0,0,0.45) 100%)";

const heroScrim =
  "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.3) 4%, rgba(0,0,0,0.12) 8%, rgba(0,0,0,0.03) 13%, rgba(0,0,0,0.1) 18%, rgba(0,0,0,0.28) 25%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.45) 63%, rgba(0,0,0,0.28) 74%, rgba(0,0,0,0.1) 82%, rgba(0,0,0,0.03) 87%, rgba(0,0,0,0.12) 92%, rgba(0,0,0,0.3) 96%, rgba(0,0,0,0.45) 100%)";

interface SizeConfig {
  height: string;
  radius: string;
  scrim: string;
  cityText: string;
  nameText: string;
  nameOffset: string;
  namePadding: string;
  actionPadding: string;
}

const cardDefaults: Omit<SizeConfig, "height" | "radius" | "nameOffset"> = {
  scrim: defaultScrim,
  cityText: "text-display-crimson-card",
  nameText: "text-display-golos-card",
  namePadding: "px-[8cqw]",
  actionPadding: "p-[4cqw]",
};

const sizeConfig: Record<CardSize, SizeConfig> = {
  hero: {
    height: "h-[30rem] lg:h-full",
    radius: "rounded-lg",
    scrim: heroScrim,
    cityText: "text-display-crimson-hero",
    nameText: "text-display-golos-hero",
    nameOffset: "-mt-1",
    namePadding: "px-8",
    actionPadding: "py-4 px-4 lg:p-6",
  },
  featured: { ...cardDefaults, height: "aspect-square max-h-[31.25rem]", radius: "rounded-md", nameOffset: "" },
  lg:    { ...cardDefaults, height: "aspect-square", radius: "rounded-md", nameOffset: "" },
  md:    { ...cardDefaults, height: "aspect-square", radius: "rounded-sm", nameOffset: "" },
  sm:    { ...cardDefaults, height: "aspect-square", radius: "rounded-sm", nameOffset: "-mt-1" },
  xs:    { ...cardDefaults, height: "", radius: "", nameOffset: "" },
  empty: {
    height: "aspect-square",
    radius: "rounded-sm",
    scrim: "",
    cityText: "text-display-crimson-2",
    nameText: "text-display-golos-2",
    nameOffset: "",
    namePadding: "px-8",
    actionPadding: "p-2",
  },
};

export function Card({
  size = "md",
  image,
  city,
  name,
  title,
  subtitle,
  metadata,
  metadataRight,
  metadataRow2 = true,
  sticker,
  truncate,
  topLeft,
  topCenter,
  topRight,
  bottomLeft,
  bottomCenter,
  bottomRight,
  onNameChange,
  onNameBlur,
  readOnlyName,
  autoFocusName,
  href,
  onClick,
  className,
  scrim = true,
}: CardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // hero/lg/featured render covers large enough to warrant the full
  // derivative; smaller grid/carousel/list sizes use the thumb.
  const useFullImage = size === "hero" || size === "lg" || size === "featured";
  const displayImage = useFullImage ? image : (getThumbCoverUrl(image) ?? image);

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (size === "empty") {
    return (
      <div
        className={`flex flex-col w-full ${onClick ? "cursor-pointer" : ""} ${className ?? ""}`}
        {...(onClick ? { onClick, role: "button" } : {})}
      >
        <div className="aspect-square rounded-sm w-full bg-grey-300 flex items-center justify-center">
          <p className="text-body-sm text-secondary">No image</p>
        </div>
        {(title || subtitle) && (
          <div className="flex flex-col gap-0.5 mt-3">
            {title && <p className={`text-display-golos-4 ${truncate ? "truncate" : ""}`}>{title}</p>}
            {subtitle && (
              <p className="text-body-sm text-secondary">{subtitle}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── XS ────────────────────────────────────────────────────────────────────
  if (size === "xs") {
    const XsWrapper = (href ? Link : onClick ? "button" : "div") as React.ElementType;
    const xsProps = href ? { href } : onClick ? { onClick } : {};
    return (
      <XsWrapper
        {...(xsProps as Record<string, unknown>)}
        className={`flex items-center gap-2 bg-surface-subtle rounded-sm p-2 w-full overflow-hidden text-left ${href || onClick ? "cursor-pointer" : ""} ${className ?? ""}`}
      >
        <div className="shrink-0 size-[3.125rem] rounded-xs overflow-hidden bg-black/10">
          {displayImage && (
            <img src={displayImage} alt={city ?? name ?? ""} className="size-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          {city && <p className="text-body-xs text-secondary truncate">{city}</p>}
          {name && <p className="text-header-radio-2 text-primary truncate">{name}</p>}
          {subtitle && <p className="text-body-xs text-secondary truncate">{subtitle}</p>}
        </div>
        <span className="size-9 inline-flex items-center justify-center shrink-0 text-primary" aria-hidden>
          <ArrowRight className="size-6" />
        </span>
      </XsWrapper>
    );
  }

  const Wrapper = (href ? Link : "div") as React.ElementType;
  const wrapperProps = href
    ? { href }
    : onClick
      ? { onClick, role: "button" }
      : {};

  const metadataFirstType = metadata?.types
    ?.filter((t) => !FILTERED_METADATA_TYPES.has(t))
    .map((t) => t.replace(/_/g, " "))[0];

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!autoFocusName || readOnlyName) return;
    const el = textareaRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.focus();
      el.select();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "1px";
    el.style.height = `${el.scrollHeight}px`;
    el.scrollTop = 0;
  });

  // Re-measure on pure CSS-driven reflow (e.g. a window resize changing the
  // cqw-based font size and wrapping the title onto another line) — that
  // doesn't trigger a React re-render, so the layout effect above alone
  // wouldn't catch it and the new line would clip against overflow-hidden.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      el.style.height = "1px";
      el.style.height = `${el.scrollHeight}px`;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Wrapper
      {...(wrapperProps as Record<string, unknown>)}
      className={`flex flex-col gap-3 w-full ${href || onClick ? "cursor-pointer group" : ""} ${className ?? ""}`}
    >
      <div
        className={`relative overflow-hidden w-full @container ${imageLoaded ? "bg-transparent" : "bg-black"} ${sizeConfig[size].height} ${sizeConfig[size].radius}`}
      >
        {displayImage && (
          <img
            src={displayImage}
            alt={city ?? title ?? ""}
            className="absolute inset-0 size-full object-cover transition-transform duration-400 ease-in-out group-hover:scale-104"
            onLoad={() => setImageLoaded(true)}
          />
        )}
        {sticker && (
          <div className="absolute top-4 left-4">
            <img src="/stickers/todays-pick.svg" alt="Today's pick" />
          </div>
        )}
        {scrim && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: sizeConfig[size].scrim,
            }}
          />
        )}
        {city && (
          <div className={`absolute inset-x-0 bottom-1/3 top-1/3 flex flex-col items-center justify-center ${sizeConfig[size].namePadding} text-center text-brand overflow-visible`}>
            <p className={sizeConfig[size].cityText}>{city}</p>
            {onNameChange ? (
              <textarea
                ref={textareaRef}
                rows={1}
                value={name ?? ""}
                readOnly={readOnlyName}
                onChange={(e) => !readOnlyName && onNameChange(e.target.value.replace(/\n/g, ""))}
                placeholder="Playlist name"
                onBlur={(e) => !readOnlyName && onNameBlur?.(e.target.value)}
                className={`${sizeConfig[size].nameText} ${sizeConfig[size].nameOffset} text-center bg-transparent border-none outline-none w-full resize-none overflow-hidden p-0 ${readOnlyName ? "cursor-default pointer-events-none" : "cursor-text"} placeholder:opacity-40`}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              name && <p className={`${sizeConfig[size].nameText} ${sizeConfig[size].nameOffset} w-full break-words`}>{name}</p>
            )}
          </div>
        )}
        <TopActions
          left={topLeft}
          center={topCenter}
          right={topRight}
          padding={sizeConfig[size].actionPadding}
        />
        <BottomActions
          left={bottomLeft}
          center={bottomCenter}
          right={bottomRight}
          padding={sizeConfig[size].actionPadding}
        />
      </div>
      {(title || subtitle) && (
        <div className="flex flex-col gap-0.5">
          {title && <p className={`text-display-golos-4 ${truncate ? "truncate" : ""}`}>{title}</p>}
          {subtitle && (
            <p className="text-body-sm text-secondary">{subtitle}</p>
          )}
        </div>
      )}
      {metadata && (
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className={`text-header-radio-2 lg:text-header-radio-1 mb-[2px] ${truncate ? "truncate" : ""}`}>
              {metadata.title}
            </p>
            {metadata.subtitleContent ? (
              <div className="text-body-xs text-secondary mb-1 flex items-center gap-1">
                {metadata.subtitleContent}
              </div>
            ) : (
              metadata.subtitleText && (
                <p className="text-body-xs text-secondary mb-1 line-clamp-1">
                  {metadata.subtitleText}
                </p>
              )
            )}
            {metadataRow2 && (metadata.rating != null || metadataFirstType || metadata.city) && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {metadataFirstType && <Badge>{metadataFirstType}</Badge>}
                {metadata.rating != null && <Rating rating={metadata.rating} />}
                {metadata.city && (
                  <span className="text-body-xs text-secondary">{metadata.city}</span>
                )}
              </div>
            )}
          </div>
          {metadataRight && (
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              {metadataRight}
            </div>
          )}
        </div>
      )}
    </Wrapper>
  );
}
