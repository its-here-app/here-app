"use client";

import { useState, useEffect, useRef } from "react";

interface CitySuggestion {
  google_place_id: string;
  display_name: string;   // Full canonical name (e.g. "Los Angeles, CA", "Portland, OR")
  is_primary?: boolean;   // Google's #1 city for this base name
}

interface CityAutocompleteInputProps {
  value: string;
  onSelect: (city: CitySuggestion) => void;
  onChange?: (value: string) => void;
  variant?: "text" | "ghost";
  placeholder?: string;
  autoFocus?: boolean;
  label?: string;
  focusBrand?: boolean;
  className?: string;
}

export function CityAutocompleteInput({
  value,
  onSelect,
  onChange,
  variant = "text",
  placeholder = "Your city",
  autoFocus,
  label,
  focusBrand,
  className,
}: CityAutocompleteInputProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedValue, setSelectedValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
    setSelectedValue(value);
  }, [value]);

  // Debounced fetch
  useEffect(() => {
    if (query.length < 2 || query === selectedValue) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/cities/autocomplete?query=${encodeURIComponent(query)}`,
        );
        const data = await res.json();
        setSuggestions(data.cities ?? []);
        setShowDropdown(true);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(city: CitySuggestion) {
    setQuery(city.display_name);
    setSelectedValue(city.display_name);
    setSuggestions([]);
    setShowDropdown(false);
    onSelect(city);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    onChange?.(val);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    }
  }

  const dropdown = showDropdown && suggestions.length > 0 && (
    <ul className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface-subtle border border-subtle rounded-[0.75rem] overflow-hidden shadow-lg">
      {suggestions.map((city, i) => (
        <li key={city.google_place_id}>
          <button
            type="button"
            className={`w-full text-left px-4 py-3 text-body-sm text-primary cursor-pointer transition-colors ${
              i === activeIndex ? "bg-white/10" : "hover:bg-white/5"
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelect(city);
            }}
          >
            {city.display_name}
          </button>
        </li>
      ))}
    </ul>
  );

  if (variant === "ghost") {
    return (
      <div ref={containerRef} className={`relative w-full ${className ?? ""}`}>
        <div className="flex flex-col gap-3 w-full">
          <input
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="text-display-crimson-1 text-neon text-center bg-transparent border-none outline-none w-full placeholder:text-white/30"
          />
          <div className="h-px bg-white" />
        </div>
        {dropdown}
      </div>
    );
  }

  // TextInput variant
  const focusClass = focusBrand ? "focus-within:border-brand" : "";

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col gap-2 w-full ${className ?? ""}`}
    >
      {label && <span className="text-body-xs text-secondary">{label}</span>}
      <div
        className={`group bg-black border border-subtle ${focusClass} flex gap-2.5 px-4 py-3 rounded-[1rem] w-full h-14 items-center`}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex-1 min-w-0 bg-transparent text-body-sm outline-none text-primary placeholder:text-tertiary"
        />
      </div>
      {dropdown}
    </div>
  );
}
