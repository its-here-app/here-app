"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface ToastData {
  id: string;
  icon: React.ReactNode;
  message: string;
  duration?: number;
}

type Listener = (t: ToastData) => void;
const listeners: Listener[] = [];
// Toasts fired before a Toaster has subscribed — e.g. from a page's mount
// effect, which runs before the layout's Toaster effect — wait here.
const pending: ToastData[] = [];

export function toast({ icon, message, duration }: Omit<ToastData, "id">) {
  const id = Math.random().toString(36).slice(2);
  const data = { id, icon, message, duration };
  if (listeners.length === 0) {
    pending.push(data);
    return;
  }
  listeners.forEach((fn) => fn(data));
}

function ToastItem({
  data,
  onRemove,
}: {
  data: ToastData;
  onRemove: () => void;
}) {
  const [exiting, setExiting] = useState(false);
  const displayMessage = data.message.slice(0, 48);

  useEffect(() => {
    const dur = data.duration ?? 5000;
    const t1 = setTimeout(() => setExiting(true), dur);
    const t2 = setTimeout(onRemove, dur + 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [data.duration, onRemove]);

  return (
    <div
      style={{
        animation: `${exiting ? "toast-out 200ms ease" : "toast-in 400ms cubic-bezier(0.21,1.02,0.73,1)"} forwards`,
      }}
      className="dark pointer-events-auto flex items-center gap-3 w-full max-w-sm bg-surface-subtle rounded-[var(--radius-sm)] px-5 py-3.5 shadow-[0px_2px_4px_0px_rgba(64,64,64,0.14)]"
    >
      <span className="size-6 shrink-0 text-white flex items-center justify-center">
        {data.icon}
      </span>
      <p className="text-body-sm text-white">{displayMessage}</p>
    </div>
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const listener: Listener = (t) =>
      setToasts((prev) => [...prev.slice(-2), t]);
    listeners.push(listener);
    pending.splice(0).forEach(listener);
    return () => {
      listeners.splice(listeners.indexOf(listener), 1);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-x-0 top-0 z-[70] flex flex-col gap-2 items-center px-[var(--space-page-dynamic)] pt-[var(--space-page-dynamic)] pointer-events-none">
      {toasts.map((t) => (
        <ToastItem
          key={t.id}
          data={t}
          onRemove={() =>
            setToasts((prev) => prev.filter((x) => x.id !== t.id))
          }
        />
      ))}
    </div>,
    document.body,
  );
}
