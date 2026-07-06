"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Toolbar from "./Toolbar";
import EditorPane from "./EditorPane";
import ViewerPane, { type ViewerHandle } from "./ViewerPane";
import ConfigPanel from "./ConfigPanel";
import Divider from "./Divider";
import DownloadMenu from "./DownloadMenu";
import {
  DEFAULT_STATE,
  fromSnapshot,
  loadState,
  reducer,
  saveState,
  toSnapshot,
  useDebouncedValue,
  type ShareSnapshot,
  type State,
} from "../lib/state";
import { decodeShare, encodeShare } from "../lib/share";
import { parseRawConfig } from "../lib/config";
import {
  configureSecure,
  renderDiagram,
  renderFlattenedExportSvg,
  renderForRaster,
  validate,
  type RenderOutput,
} from "../lib/mermaid";
import { downloadSvg, rasterizeSvgString, svgToRasterBlob, triggerDownload } from "../lib/export";

export default function EditorApp() {
  const [state, dispatch] = useReducer(reducer, null, (): State => {
    const snap = decodeShare<ShareSnapshot>(window.location.hash);
    if (snap) return fromSnapshot(snap, DEFAULT_STATE);
    return loadState() ?? DEFAULT_STATE;
  });

  const viewerRef = useRef<ViewerHandle>(null);
  const hiddenRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef(0);

  const [renderOut, setRenderOut] = useState<RenderOutput | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [systemDark, setSystemDark] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);

  // ---- Appearance ----------------------------------------------------------
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setSystemDark(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const isDark =
    state.ui.appTheme === "dark" || (state.ui.appTheme === "system" && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Re-render once webfonts are ready so measured text layout is correct.
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, []);

  // ---- Persistence + shareable URL ----------------------------------------
  const debouncedState = useDebouncedValue(state, 400);
  useEffect(() => {
    saveState(debouncedState);
    window.history.replaceState(null, "", "#" + encodeShare(toSnapshot(debouncedState)));
  }, [debouncedState]);

  // ---- Render pipeline -----------------------------------------------------
  const parsedOverride = useMemo(() => parseRawConfig(state.rawOverride), [state.rawOverride]);

  const debouncedCode = useDebouncedValue(state.code, 300);

  useEffect(() => {
    const token = ++tokenRef.current;
    let cancelled = false;
    (async () => {
      try {
        if (!debouncedCode.trim()) {
          if (!cancelled && token === tokenRef.current) {
            setRenderOut(null);
            setRenderError(null);
          }
          return;
        }
        const v = await validate(debouncedCode);
        if (cancelled || token !== tokenRef.current) return;
        if (!v.ok) {
          setRenderError(v.message ?? "Invalid diagram");
          return;
        }
        await configureSecure(state.secure);
        const hidden = hiddenRef.current;
        if (!hidden || cancelled || token !== tokenRef.current) return;
        const out = await renderDiagram(debouncedCode, state.visual, parsedOverride, hidden);
        if (cancelled || token !== tokenRef.current) return;
        setRenderError(null);
        setRenderOut(out);
      } catch (err) {
        if (cancelled || token !== tokenRef.current) return;
        const e = err as { str?: string; message?: string };
        setRenderError(e?.str ?? e?.message ?? String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedCode, state.visual, state.secure, parsedOverride, fontsReady]);

  // ---- Actions -------------------------------------------------------------
  // Math (`$$…$$`) can't survive export as <foreignObject> (raster taints the
  // canvas; standalone SVG lacks KaTeX CSS/fonts). For those diagrams we render
  // a flattened, self-contained SVG (native <text>/<rect>, fonts embedded).
  const handleExportSvg = useCallback(async () => {
    try {
      if (state.code.includes("$$")) {
        downloadSvg(await renderFlattenedExportSvg(state.code, state.visual, parsedOverride));
        return;
      }
      const svg = viewerRef.current?.getSvg();
      if (svg) downloadSvg(svg);
    } catch (e) {
      console.error("Export failed", e);
      alert("Export failed: " + ((e as Error)?.message ?? String(e)));
    }
  }, [state.code, state.visual, parsedOverride]);

  const handleExportRaster = useCallback(
    async (format: "png" | "jpeg") => {
      if (!renderOut) return;
      dispatch({ type: "patchUi", patch: { exportFormat: format } });
      try {
        const opts = { scale: state.ui.exportScale, bg: state.ui.exportBg, format };
        let blob: Blob;
        if (state.code.includes("$$")) {
          // Flattened SVG is already foreignObject-free and font-embedded.
          const svg = await renderFlattenedExportSvg(state.code, state.visual, parsedOverride);
          blob = await svgToRasterBlob(svg, opts);
        } else {
          // No math: HTML labels off avoids <foreignObject> (which taints the canvas).
          const svgString = await renderForRaster(state.code, state.visual, parsedOverride);
          blob = await rasterizeSvgString(svgString, { ...opts, embedFontFamily: state.visual.fontFamily });
        }
        triggerDownload(blob, `diagram.${format === "jpeg" ? "jpg" : "png"}`);
      } catch (e) {
        console.error("Export failed", e);
        alert("Export failed: " + ((e as Error)?.message ?? String(e)));
      }
    },
    [renderOut, state.code, state.visual, state.ui.exportScale, state.ui.exportBg, parsedOverride],
  );

  const handleShare = useCallback(async () => {
    window.history.replaceState(null, "", "#" + encodeShare(toSnapshot(state)));
    try {
      await navigator.clipboard.writeText(window.location.href);
      return true;
    } catch {
      return false;
    }
  }, [state]);

  const canExport = Boolean(renderOut);

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <Toolbar
        state={state}
        dispatch={dispatch}
        onShare={handleShare}
        DownloadMenu={
          <DownloadMenu
            scale={state.ui.exportScale}
            bg={state.ui.exportBg}
            onScaleChange={(s) => dispatch({ type: "patchUi", patch: { exportScale: s } })}
            onBgChange={(bg) => dispatch({ type: "patchUi", patch: { exportBg: bg } })}
            onExportSvg={handleExportSvg}
            onExportRaster={handleExportRaster}
            disabled={!canExport}
          />
        }
      />

      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        <div ref={splitRef} className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <div
            className="min-h-0 min-w-0 md:h-full"
            style={{ flexBasis: `${state.ui.splitFraction * 100}%`, flexGrow: 0, flexShrink: 0 }}
          >
            <EditorPane
              value={state.code}
              onChange={(code) => dispatch({ type: "setCode", code })}
              isDark={isDark}
              error={renderError}
            />
          </div>
          <Divider
            containerRef={splitRef}
            onChange={(f) => dispatch({ type: "patchUi", patch: { splitFraction: f } })}
          />
          <ViewerPane ref={viewerRef} render={renderOut} error={renderError} />
        </div>

        <ConfigPanel
          open={state.ui.configOpen}
          visual={state.visual}
          secure={state.secure}
          rawOverride={state.rawOverride}
          dispatch={dispatch}
          onClose={() => dispatch({ type: "patchUi", patch: { configOpen: false } })}
        />
      </main>

      {/* Off-screen (laid-out, NOT display:none) container for mermaid's text measurement. */}
      <div
        ref={hiddenRef}
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: 0,
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      />
    </div>
  );
}
