"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Minus, Plus, Scan } from "lucide-react";
import type { RenderOutput } from "../lib/mermaid";
import { intrinsicSize } from "../lib/export";

export interface ViewerHandle {
  getSvg: () => SVGSVGElement | null;
  fit: () => void;
}

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface ViewerPaneProps {
  render: RenderOutput | null;
  error: string | null;
}

const ViewerPane = forwardRef<ViewerHandle, ViewerPaneProps>(function ViewerPane(
  { render, error },
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<Transform>({ scale: 1, tx: 0, ty: 0 });
  const didInitialFit = useRef(false);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  const getSvg = useCallback(
    () => (containerRef.current?.querySelector("svg") as SVGSVGElement | null) ?? null,
    [],
  );

  const fit = useCallback(() => {
    const vp = viewportRef.current;
    const svg = getSvg();
    if (!vp || !svg) return;
    const { width, height } = intrinsicSize(svg);
    if (!width || !height) return;
    const pad = 40;
    const scale = clamp(Math.min((vp.clientWidth - pad) / width, (vp.clientHeight - pad) / height), 0.05, 3);
    setT({
      scale,
      tx: (vp.clientWidth - width * scale) / 2,
      ty: (vp.clientHeight - height * scale) / 2,
    });
  }, [getSvg]);

  useImperativeHandle(ref, () => ({ getSvg, fit }), [getSvg, fit]);

  // Inject the freshly rendered SVG and wire any interactive bindings. On error
  // we intentionally leave the previous SVG untouched (handled by the caller
  // passing the last good `render`).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !render?.svg) return;
    el.innerHTML = render.svg;
    render.bindFunctions?.(el);
    if (!didInitialFit.current) {
      didInitialFit.current = true;
      // Wait a frame so the SVG has a measurable box.
      requestAnimationFrame(fit);
    }
  }, [render, fit]);

  // Non-passive wheel listener so we can preventDefault and zoom to the cursor.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setT((prev) => {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const scale = clamp(prev.scale * factor, 0.05, 20);
        const k = scale / prev.scale;
        return { scale, tx: px - (px - prev.tx) * k, ty: py - (py - prev.ty) * k };
      });
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragging.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    dragging.current = { x: e.clientX, y: e.clientY };
    setT((prev) => ({ ...prev, tx: prev.tx + dx, ty: prev.ty + dy }));
  };
  const endDrag = (e: React.PointerEvent) => {
    dragging.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  const zoomAtCenter = (factor: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const cx = vp.clientWidth / 2;
    const cy = vp.clientHeight / 2;
    setT((prev) => {
      const scale = clamp(prev.scale * factor, 0.05, 20);
      const k = scale / prev.scale;
      return { scale, tx: cx - (cx - prev.tx) * k, ty: cy - (cy - prev.ty) * k };
    });
  };

  const hasDiagram = Boolean(render?.svg);

  return (
    <div className="viewer-canvas relative h-full min-w-0 flex-1 overflow-hidden">
      <div
        ref={viewportRef}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          ref={containerRef}
          className="origin-top-left [&_svg]:max-w-none"
          style={{ transform: `translate(${t.tx}px, ${t.ty}px) scale(${t.scale})` }}
        />
      </div>

      {!hasDiagram && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-foreground/40">
          Start typing a diagram on the left to see it here.
        </div>
      )}
      {!hasDiagram && error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
          <div className="max-w-md rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        </div>
      )}
      {hasDiagram && error && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <div className="rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs text-amber-700 dark:text-amber-300">
            Showing last valid diagram — current source has an error
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-black/10 bg-background/80 p-1 shadow-sm backdrop-blur dark:border-white/10">
        <button
          type="button"
          onClick={() => zoomAtCenter(1 / 1.2)}
          className="rounded-md p-1.5 text-foreground/70 hover:bg-foreground/10"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          onClick={() => setT((p) => ({ ...p, scale: 1 }))}
          className="min-w-12 rounded-md px-1 py-1 text-center text-xs tabular-nums text-foreground/70 hover:bg-foreground/10"
          title="Reset to 100%"
        >
          {Math.round(t.scale * 100)}%
        </button>
        <button
          type="button"
          onClick={() => zoomAtCenter(1.2)}
          className="rounded-md p-1.5 text-foreground/70 hover:bg-foreground/10"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus size={16} />
        </button>
        <div className="mx-0.5 h-5 w-px bg-foreground/15" />
        <button
          type="button"
          onClick={fit}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-foreground/70 hover:bg-foreground/10"
          title="Fit to view"
          aria-label="Fit to view"
        >
          <Scan size={16} />
          <span className="hidden sm:inline">Fit</span>
        </button>
      </div>
    </div>
  );
});

export default ViewerPane;
