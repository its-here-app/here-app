"use client";

import { forwardRef, useState, type TextareaHTMLAttributes } from "react";

interface ListInputProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  /** Overrides the default fixed height */
  heightClassName?: string;
}

export const ListInput = forwardRef<HTMLTextAreaElement, ListInputProps>(
  function ListInput(
    { value, onChange, heightClassName, className, onFocus, onBlur, ...rest },
    ref,
  ) {
    const [focused, setFocused] = useState(false);

    return (
      <div
        className={`border border-subtle rounded-[1rem] w-full px-4 py-3 flex flex-col transition-colors duration-200 ${
          focused ? "bg-surface-subtle" : "bg-transparent"
        } ${heightClassName ?? "h-[5.375rem]"} ${className ?? ""}`}
      >
        <textarea
          ref={ref}
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
          className="flex-1 min-h-0 w-full bg-transparent text-body-sm text-primary placeholder:text-tertiary outline-none resize-none"
          {...rest}
        />
      </div>
    );
  },
);
