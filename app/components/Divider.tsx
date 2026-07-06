"use client";

import { useEffect, useRef } from "react";

interface DividerProps {
  containerRef: React.RefObject<HTMLElement | null>;
  onChange: (fraction: number) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Draggable vertical split handle. Computes the editor fraction from pointer X. */
export default function Divider({ containerRef, onChange }: DividerProps) {
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      onChange(clamp((e.clientX - rect.left) / rect.width, 0.2, 0.8));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [containerRef, onChange]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={() => {
        dragging.current = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      className="group relative hidden w-px shrink-0 cursor-col-resize bg-black/10 md:block dark:bg-white/10"
    >
      <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-blue-500/20" />
    </div>
  );
}
