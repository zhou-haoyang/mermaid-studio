"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Copy, Download, FileCode, FileImage } from "lucide-react";
import type { ExportScale } from "../lib/state";

interface DownloadMenuProps {
  scale: ExportScale;
  bg: string;
  onScaleChange: (scale: ExportScale) => void;
  onBgChange: (bg: string) => void;
  onExportSvg: () => void;
  onExportRaster: (format: "png" | "jpeg") => void;
  onCopySvg: () => Promise<boolean>;
  onCopyPng: () => Promise<boolean>;
  disabled: boolean;
}

const SCALES: ExportScale[] = [1, 2, 3];
const BG_SWATCHES: { value: string; label: string; swatch: string }[] = [
  { value: "transparent", label: "None", swatch: "conic-gradient(#0002 0 25%, transparent 0 50%) 0 0 / 8px 8px" },
  { value: "#ffffff", label: "White", swatch: "#ffffff" },
  { value: "#000000", label: "Black", swatch: "#000000" },
];

export default function DownloadMenu({
  scale,
  bg,
  onScaleChange,
  onBgChange,
  onExportSvg,
  onExportRaster,
  onCopySvg,
  onCopyPng,
  disabled,
}: DownloadMenuProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const [copied, setCopied] = useState<"svg" | "png" | null>(null);
  const isCustomBg = !BG_SWATCHES.some((s) => s.value === bg);
  const close = () => setOpen(false);

  // Copy keeps the menu open so the transient "Copied!" confirmation is visible.
  const runCopy = async (kind: "svg" | "png", fn: () => Promise<boolean>) => {
    const ok = await fn();
    if (ok) {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    }
  };

  // Anchor the (portaled) menu under the button, in viewport coordinates.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const r = btnRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download size={15} />
        Export
        <ChevronDown size={14} className={open ? "rotate-180 transition" : "transition"} />
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={close} />
            <div
              className="fixed z-50 w-72 rounded-lg border border-black/10 bg-background p-3 shadow-xl dark:border-white/15"
              style={{ top: pos.top, right: pos.right }}
            >
              <div className="mb-3">
                <div className="mb-1.5 text-xs font-medium text-foreground/60">Resolution (raster)</div>
                <div className="flex gap-1">
                  {SCALES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onScaleChange(s)}
                      className={`flex-1 rounded-md border px-2 py-1 text-xs ${
                        scale === s
                          ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "border-black/10 text-foreground/70 hover:bg-foreground/5 dark:border-white/15"
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <div className="mb-1.5 text-xs font-medium text-foreground/60">Background (raster)</div>
                <div className="flex items-center gap-1">
                  {BG_SWATCHES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => onBgChange(s.value)}
                      title={s.label}
                      className={`h-7 w-7 rounded-md border ${
                        bg === s.value ? "border-blue-500 ring-2 ring-blue-500/30" : "border-black/15 dark:border-white/20"
                      }`}
                      style={{ background: s.swatch }}
                    />
                  ))}
                  <label
                    className={`relative h-7 w-7 overflow-hidden rounded-md border ${
                      isCustomBg ? "border-blue-500 ring-2 ring-blue-500/30" : "border-black/15 dark:border-white/20"
                    }`}
                    title="Custom color"
                  >
                    <input
                      type="color"
                      value={isCustomBg ? bg : "#888888"}
                      onChange={(e) => onBgChange(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <span
                      className="pointer-events-none block h-full w-full"
                      style={{
                        background: isCustomBg
                          ? bg
                          : "conic-gradient(from 90deg, red, yellow, lime, cyan, blue, magenta, red)",
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-1 border-t border-black/10 pt-2 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    onExportSvg();
                    close();
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/5"
                >
                  <FileCode size={15} className="text-foreground/60" />
                  Download SVG <span className="ml-auto text-xs text-foreground/40">vector</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExportRaster("png");
                    close();
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/5"
                >
                  <FileImage size={15} className="text-foreground/60" />
                  Download PNG <span className="ml-auto text-xs text-foreground/40">{scale}× raster</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExportRaster("jpeg");
                    close();
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/5"
                >
                  <FileImage size={15} className="text-foreground/60" />
                  Download JPEG <span className="ml-auto text-xs text-foreground/40">{scale}× raster</span>
                </button>
              </div>

              <div className="mt-2 flex flex-col gap-1 border-t border-black/10 pt-2 dark:border-white/10">
                <div className="px-2 pb-0.5 text-xs font-medium text-foreground/60">Copy to clipboard</div>
                <button
                  type="button"
                  onClick={() => runCopy("svg", onCopySvg)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/5"
                >
                  {copied === "svg" ? (
                    <Check size={15} className="text-green-600 dark:text-green-500" />
                  ) : (
                    <Copy size={15} className="text-foreground/60" />
                  )}
                  {copied === "svg" ? "Copied!" : "Copy SVG"}
                  <span className="ml-auto text-xs text-foreground/40">markup</span>
                </button>
                <button
                  type="button"
                  onClick={() => runCopy("png", onCopyPng)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/5"
                >
                  {copied === "png" ? (
                    <Check size={15} className="text-green-600 dark:text-green-500" />
                  ) : (
                    <Copy size={15} className="text-foreground/60" />
                  )}
                  {copied === "png" ? "Copied!" : "Copy PNG"}
                  <span className="ml-auto text-xs text-foreground/40">{scale}× image</span>
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
