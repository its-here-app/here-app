"use client";

import { useRef, useState } from "react";
import { TextInput } from "@/components/ui/inputs";

export function DescriptionField({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="relative mb-4">
      <TextInput
        ref={inputRef}
        size="tall"
        ghost
        autoResize
        readOnly={readOnly}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"What does this playlist capture? (optional)\nie. favorite spots that is nostalgic to me"}
        onFocus={() => {
          if (!readOnly) setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        className={readOnly ? "pointer-events-none" : undefined}
      />
      {focused && (
        <button
          type="button"
          className="absolute bottom-4 right-4 text-body-xs text-black cursor-pointer"
          onMouseDown={(e) => {
            e.preventDefault();
            inputRef.current?.blur();
          }}
        >
          Done
        </button>
      )}
    </div>
  );
}
