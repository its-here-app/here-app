"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface TabPanelsProps {
  activeIndex: number;
  children: ReactNode;
  className?: string;
  /**
   * Break the sliding viewport out of the surrounding side padding so panels
   * slide to the container's edge, re-applying that padding inside each panel.
   * Pass the padding amount as a CSS length, e.g. "var(--space-page-dynamic)"
   * or "1.5rem".
   */
  bleed?: string;
}

export function TabPanels({
  activeIndex,
  children,
  className,
  bleed,
}: TabPanelsProps) {
  const panels = Children.toArray(children);
  const count = panels.length;
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [height, setHeight] = useState<number>();
  const prevIndex = useRef(activeIndex);
  const sliding = useRef(false);

  const measure = (i: number) => panelRefs.current[i]?.offsetHeight ?? 0;

  // On tab change, expand to fit both the outgoing and incoming panels so the
  // taller one isn't clipped mid-slide. Height jumps instantly (no transition)
  // and is masked by the sliding content.
  useEffect(() => {
    if (prevIndex.current === activeIndex) return;
    sliding.current = true;
    setHeight(Math.max(measure(prevIndex.current), measure(activeIndex)));
    prevIndex.current = activeIndex;
  }, [activeIndex]);

  // Once the slide settles, collapse to the active panel's height. The outgoing
  // panel is fully off-screen by now, so this collapse is invisible.
  const handleTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget || e.propertyName !== "transform") return;
    sliding.current = false;
    setHeight(measure(activeIndex));
  };

  // Keep height synced to the active panel's content while it's at rest
  // (e.g. async data), but never collapse mid-slide.
  useEffect(() => {
    const el = panelRefs.current[activeIndex];
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (!sliding.current) setHeight(measure(activeIndex));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeIndex, count]);

  return (
    <div
      className={`overflow-hidden ${className ?? ""}`}
      style={{
        height,
        ...(bleed && {
          marginLeft: `calc(-1 * (${bleed}))`,
          marginRight: `calc(-1 * (${bleed}))`,
        }),
      }}
    >
      <div
        onTransitionEnd={handleTransitionEnd}
        className="flex items-start transition-transform duration-400 ease-in-out"
        style={{
          width: `${count * 100}%`,
          transform: `translateX(${-(activeIndex * 100) / count}%)`,
        }}
      >
        {panels.map((panel, i) => (
          <div
            key={i}
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
            style={{
              width: `${100 / count}%`,
              ...(bleed && { paddingLeft: bleed, paddingRight: bleed }),
            }}
            className="min-w-0"
          >
            {panel}
          </div>
        ))}
      </div>
    </div>
  );
}

interface TabProps {
  title: string;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function Tab({ title, icon, active = false, onClick }: TabProps) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2 cursor-pointer transition-colors ${
        active
          ? "text-primary"
          : "text-tertiary hover:text-secondary"
      }`}
    >
      {icon && (
        <span className="size-6 flex items-center justify-center">{icon}</span>
      )}
      <span className="text-body-xs">{title}</span>
    </button>
  );
}

interface TabsProps {
  children: ReactNode;
  className?: string;
}

export function Tabs({ children, className }: TabsProps) {
  const tabs = Children.toArray(children);
  const count = tabs.length;
  const activeIndex = tabs.findIndex(
    (tab) => isValidElement(tab) && (tab.props as TabProps).active
  );

  return (
    <div
      role="tablist"
      className={`relative flex w-full ${className ?? ""}`}
    >
      {children}
      {activeIndex >= 0 && count > 0 && (
        <div
          className="absolute bottom-[-1px] h-[1px] bg-[var(--border-strong)] transition-transform duration-300 ease-in-out"
          style={{
            width: `${100 / count}%`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
      )}
    </div>
  );
}
