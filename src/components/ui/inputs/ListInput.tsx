"use client";

import { forwardRef, useRef, useState, type TextareaHTMLAttributes } from "react";

interface ListInputProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  /** Called when Enter (without shift) is pressed while the field has content */
  onImport?: () => void;
  /** Called when "Done" is clicked (shown once the field is filled) */
  onDone?: () => void;
  /** Overrides the default fixed height */
  heightClassName?: string;
}

export const ListInput = forwardRef<HTMLTextAreaElement, ListInputProps>(
  function ListInput(
    {
      value,
      onChange,
      onImport,
      onDone,
      heightClassName,
      className,
      onFocus,
      onBlur,
      onKeyDown,
      ...rest
    },
    ref,
  ) {
    const [focused, setFocused] = useState(false);
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const isFilled = value.trim().length > 0;

    return (
      <div
        className={`border border-subtle rounded-[1rem] w-full px-4 py-3 flex flex-col transition-colors duration-200 ${
          focused ? "bg-surface-subtle" : "bg-transparent"
        } ${heightClassName ?? "h-[5.375rem]"} ${className ?? ""}`}
      >
        <textarea
          ref={(el) => {
            internalRef.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && value.trim()) {
              e.preventDefault();
              onImport?.();
            }
            onKeyDown?.(e);
          }}
          className="flex-1 min-h-0 w-full bg-transparent text-body-sm text-primary placeholder:text-tertiary outline-none resize-none"
          {...rest}
        />
        {isFilled && (
          <div className="flex items-center justify-end pt-2 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                internalRef.current?.blur();
                onImport?.();
              }}
              className="text-body-xs text-primary cursor-pointer"
            >
              Import
            </button>
          </div>
        )}
      </div>
    );
  },
);
