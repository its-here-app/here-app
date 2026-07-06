"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
} from "react";

export type TextInputSize = "default" | "tall";
export type TextInputState = "default" | "active" | "filled";

interface BaseProps {
  size?: TextInputSize;
  state?: TextInputState;
  /** Light mode: transparent background */
  lightMode?: boolean;
  /** When true, adds focus-within:border-brand to the input wrapper */
  focusBrand?: boolean;
  /** Borderless and paddingless at rest; animates to lightMode border + padding on focus */
  ghost?: boolean;
  /** Textarea grows to fit its content instead of using a fixed height (size="tall" only) */
  autoResize?: boolean;
  /** Overrides the default fixed height for size="tall" when autoResize is false */
  heightClassName?: string;
  label?: string;
  /** Slot for a left-side element (e.g. a fixed "@" prefix) */
  leftSlot?: React.ReactNode;
  /** Slot for a right-side element (e.g. a submit button or icon) */
  rightSlot?: React.ReactNode;
  className?: string;
}

type InputProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: "default" };

type TextareaProps = BaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> & { size: "tall" };

type TextInputProps = InputProps | TextareaProps;

export const TextInput = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  TextInputProps
>(function TextInput(props, ref) {
  const {
    size = "default",
    lightMode = false,
    focusBrand = false,
    ghost = false,
    autoResize = false,
    heightClassName,
    label,
    leftSlot,
    rightSlot,
    className,
    placeholder = "Input field",
    ...rest
  } = props;

  const isTall = size === "tall";

  const textareaRest = isTall
    ? (rest as TextareaHTMLAttributes<HTMLTextAreaElement>)
    : null;
  const charsLeft =
    isTall && textareaRest?.maxLength != null
      ? textareaRest.maxLength - (textareaRest.value?.toString().length ?? 0)
      : null;

  // Internal ref used for autoResize; merged with the forwarded ref.
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const setTextareaRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      (internalRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      if (typeof ref === "function") ref(el);
      else if (ref)
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    },
    [ref],
  );

  useEffect(() => {
    if (!autoResize || !internalRef.current) return;
    const el = internalRef.current;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autoResize, textareaRest?.value]);

  // Re-measure when the element toggles between hidden (display:none, e.g. a
  // duplicate mobile/desktop instance) and visible, since scrollHeight reads
  // as 0 while hidden and that stale height otherwise sticks after it reappears.
  useEffect(() => {
    if (!autoResize || !internalRef.current) return;
    const el = internalRef.current;
    const observer = new ResizeObserver(() => {
      if (el.offsetParent === null) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoResize]);

  const textClass = "text-primary placeholder:text-tertiary";

  const bg = ghost || lightMode ? "bg-transparent" : "bg-black";
  const borderClass = ghost
    ? "border-transparent focus-within:border-subtle"
    : `border-subtle ${focusBrand ? "focus-within:border-brand" : ""}`;
  const paddingClass = ghost ? "px-0 py-0 focus-within:px-4 focus-within:py-3" : "px-4 py-3";

  return (
    <div className={`flex flex-col gap-2 w-full ${className ?? ""}`}>
      {label && <span className="text-body-xs text-secondary">{label}</span>}
      <div
        className={`group ${bg} border ${borderClass} ${paddingClass} flex rounded-[1rem] w-full transition-[padding,border-color] duration-200 ${
          isTall
            ? `relative ${autoResize ? "" : (heightClassName ?? "h-[5.375rem]")} items-start`
            : "h-14 items-center"
        }`}
      >
        {leftSlot && <div className="shrink-0">{leftSlot}</div>}
        {isTall ? (
          <>
            <textarea
              ref={autoResize ? setTextareaRef : (ref as React.Ref<HTMLTextAreaElement>)}
              placeholder={placeholder}
              rows={autoResize ? 1 : undefined}
              className={`flex-1 min-w-0 min-h-0 ${autoResize ? "h-auto overflow-hidden" : "h-full"} bg-transparent text-body-sm resize-none outline-none ${textClass}`}
              {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
            {charsLeft != null && (
              <span className="absolute bottom-3 right-3 text-body-xs text-tertiary pointer-events-none">
                {charsLeft}
              </span>
            )}
          </>
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            placeholder={placeholder}
            className={`flex-1 min-w-0 bg-transparent text-body-sm outline-none ${textClass}`}
            {...(rest as InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
        {rightSlot && <div className="shrink-0 ml-2.5">{rightSlot}</div>}
      </div>
    </div>
  );
});
