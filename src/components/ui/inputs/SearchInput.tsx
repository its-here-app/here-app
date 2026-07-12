"use client";

import { useRef, type ReactNode } from "react";
import { Search } from "@/components/ui/icons/Search";
import { Close } from "@/components/ui/icons/Close";

export type SearchInputState = "default" | "focused" | "typing";

interface SearchInputProps {
  state?: SearchInputState;
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onClear?: () => void;
  leftIcon?: ReactNode;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  state = "default",
  value = "",
  onChange,
  onFocus,
  onBlur,
  onClear,
  leftIcon,
  placeholder = "Search",
  className,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isActive = state !== "default";

  return (
    <div
      className={`flex gap-2 items-center px-3 h-[2.75rem] rounded-[0.75rem] w-full transition-colors outline-none border
        ${isActive ? "border-black/10" : "bg-grey-300 border-transparent cursor-pointer"}
        ${className ?? ""}`}
      onClick={!isActive ? onFocus : undefined}
    >
      <span className={`shrink-0 ${isActive ? "text-black" : "text-grey-500"}`}>
        {leftIcon ?? <Search focus={isActive} className="size-6" />}
      </span>
      {isActive ? (
        <>
          <input
            ref={inputRef}
            autoFocus={state === "focused"}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            className="flex-1 min-w-0 bg-transparent text-body-sm text-black placeholder:text-tertiary outline-none"
          />
          <button
            type="button"
            onClick={() => {
              onChange?.("");
              onClear?.();
            }}
            className="shrink-0 text-grey-500 hover:text-black transition-colors cursor-pointer"
            aria-label="Clear search"
          >
            <Close className="size-6" />
          </button>
        </>
      ) : (
        <span className="text-body-sm text-grey-500">{placeholder}</span>
      )}
    </div>
  );
}
