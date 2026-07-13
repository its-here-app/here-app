"use client";

import { useEffect, useState } from "react";
import { getAllCovers, type DefaultCover } from "../../lib/playlist-covers";
import { Pin } from "./icons/Pin";

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

interface CoverPhotoRotatorProps {
  className?: string;
}

export function CoverPhotoRotator({ className }: CoverPhotoRotatorProps) {
  const [covers] = useState<DefaultCover[]>(() => shuffle(getAllCovers()));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % covers.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [covers.length]);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {covers.map((cover, i) => (
        <img
          key={cover.url}
          src={cover.url}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div
        className="absolute bottom-0 inset-x-0 h-[180px] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 100%)",
        }}
      />
      <div className="absolute bottom-4 right-4 flex items-center gap-1 px-3 py-1.5 rounded-full text-neon">
        <Pin />
        <span className="text-body-sm">{covers[index].city}</span>
      </div>
    </div>
  );
}
