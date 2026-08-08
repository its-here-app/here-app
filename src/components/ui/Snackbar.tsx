"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface SnackbarData {
  id: string;
  icon: React.ReactNode;
  message: string;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

type Listener = (s: SnackbarData) => void;
const listeners: Listener[] = [];
const dismissHandlers = new Map<string, () => void>();

export function snackbar({
  icon,
  message,
  duration,
  actionLabel,
  onAction,
  onDismiss,
}: Omit<SnackbarData, "id">) {
  const id = Math.random().toString(36).slice(2);
  listeners.forEach((fn) =>
    fn({ id, icon, message, duration, actionLabel, onAction, onDismiss }),
  );
  return id;
}

export function dismissSnackbar(id: string) {
  dismissHandlers.get(id)?.();
}

function SnackbarItem({
  data,
  onRemove,
}: {
  data: SnackbarData;
  onRemove: () => void;
}) {
  const [exiting, setExiting] = useState(false);
  const displayMessage = data.message.slice(0, 48);

  useEffect(() => {
    if (data.duration === 0) return;
    const dur = data.duration ?? 5000;
    const t1 = setTimeout(() => setExiting(true), dur);
    const t2 = setTimeout(() => { data.onDismiss?.(); onRemove(); }, dur + 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [data.duration, onRemove]);

  useEffect(() => {
    dismissHandlers.set(data.id, () => {
      setExiting(true);
      setTimeout(onRemove, 200);
    });
    return () => {
      dismissHandlers.delete(data.id);
    };
  }, [data.id, onRemove]);

  function handleAction() {
    data.onAction?.();
    setExiting(true);
    setTimeout(onRemove, 200);
  }

  return (
    <div
      style={{
        animation: `${exiting ? "snackbar-out 200ms ease" : "snackbar-in 400ms cubic-bezier(0.21,1.02,0.73,1)"} forwards`,
      }}
      className="dark pointer-events-auto flex items-center gap-3 w-full max-w-sm bg-surface-subtle rounded-[var(--radius-sm)] px-5 py-3.5 shadow-[0px_2px_4px_0px_rgba(64,64,64,0.14)]"
    >
      {data.icon && (
        <span className="size-6 shrink-0 text-white flex items-center justify-center">
          {data.icon}
        </span>
      )}
      <p className="text-body-sm text-white flex-1">{displayMessage}</p>
      {data.actionLabel && (
        <button
          onClick={handleAction}
          className="text-body-xs text-grey-400 shrink-0 cursor-pointer"
        >
          {data.actionLabel}
        </button>
      )}
    </div>
  );
}

export function Snackbar() {
  const [snackbars, setSnackbars] = useState<SnackbarData[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const listener: Listener = (s) =>
      setSnackbars((prev) => [...prev.slice(-2), s]);
    listeners.push(listener);
    return () => {
      listeners.splice(listeners.indexOf(listener), 1);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[70] flex flex-col gap-2 items-center px-[var(--space-page-dynamic)] pb-[var(--space-page-dynamic)] pointer-events-none">
      {snackbars.map((s) => (
        <SnackbarItem
          key={s.id}
          data={s}
          onRemove={() =>
            setSnackbars((prev) => prev.filter((x) => x.id !== s.id))
          }
        />
      ))}
    </div>,
    document.body,
  );
}
