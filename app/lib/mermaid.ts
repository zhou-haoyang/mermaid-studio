// Thin wrapper around mermaid v11: lazy singleton load (keeps the ~1MB library
// out of the initial chunk), friendly validation, and a render that scopes its
// temporary DOM nodes to a container we control and always cleans up.

import type { MermaidConfig } from "mermaid";
import {
  buildInitDirective,
  buildSecureConfig,
  buildVisualConfig,
  type SecureConfig,
  type VisualConfig,
} from "./config";
import { flattenForeignObjects } from "./mathFlatten";
import { embedFontFaces } from "./export";

type MermaidModule = typeof import("mermaid")["default"];

let _mermaid: MermaidModule | null = null;
let _loading: Promise<MermaidModule> | null = null;

async function getMermaid(): Promise<MermaidModule> {
  if (_mermaid) return _mermaid;
  if (!_loading) {
    _loading = import("mermaid").then((mod) => {
      _mermaid = mod.default;
      return _mermaid;
    });
  }
  return _loading;
}

// Monotonic, collision-free ids. We remove our nodes in `finally`, so the
// counter never has to worry about reuse.
let idSeq = 0;
const nextId = () => `mermaid-render-${++idSeq}`;

// KaTeX web fonts load lazily on first use, but mermaid measures a math label's
// box during `render` — if the fonts aren't in yet it sizes to the (narrower)
// fallback metrics and the real KaTeX text gets clipped on the right. Preload
// every registered `KaTeX_*` face before rendering any diagram containing math.
let _mathFontsLoaded = false;
async function ensureMathFonts(code: string): Promise<void> {
  if (_mathFontsLoaded || !code.includes("$$")) return;
  const fonts = document.fonts;
  if (!fonts) return;
  const loads: Promise<unknown>[] = [];
  let found = 0;
  fonts.forEach((f) => {
    if (!/^KaTeX_/.test(f.family)) return;
    found++;
    if (f.status !== "loaded") loads.push(f.load().catch(() => {}));
  });
  if (found === 0) return; // faces not registered yet — retry on the next render
  if (loads.length) await Promise.all(loads);
  _mathFontsLoaded = true;
}

/** Apply the secure-only keys (mermaid refuses to let directives change these). */
export async function configureSecure(secure: SecureConfig): Promise<void> {
  const mermaid = await getMermaid();
  mermaid.initialize(buildSecureConfig(secure) as MermaidConfig);
}

export interface ValidationResult {
  ok: boolean;
  message?: string;
  /** 1-based line within the user's source, when mermaid reports it. */
  line?: number;
}

/** Validate without rendering. Returns a friendly message + line instead of throwing. */
export async function validate(code: string): Promise<ValidationResult> {
  const mermaid = await getMermaid();
  try {
    await mermaid.parse(code);
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { str?: string; message?: string; hash?: { line?: number; loc?: { first_line?: number } } };
    const message = e?.str ?? e?.message ?? String(err);
    const line = e?.hash?.line ?? e?.hash?.loc?.first_line;
    return { ok: false, message, line: typeof line === "number" ? line : undefined };
  }
}

export interface RenderOutput {
  svg: string;
  bindFunctions?: (element: Element) => void;
}

/**
 * Render `code` to an SVG string. Visual config is applied via a per-render
 * `%%{init}%%` directive (auto-resets, so no stale theme/themeVariables).
 * `hidden` is an off-screen, in-flow (NOT display:none) element used for text
 * measurement; passing it keeps mermaid's temporary nodes out of `document.body`.
 */
export async function renderDiagram(
  code: string,
  visual: VisualConfig,
  rawOverride: Record<string, unknown> | null,
  hidden: HTMLElement,
): Promise<RenderOutput> {
  const mermaid = await getMermaid();
  await ensureMathFonts(code);
  const id = nextId();
  const source = buildInitDirective(visual, rawOverride) + code;
  try {
    const { svg, bindFunctions } = await mermaid.render(id, source, hidden);
    return { svg, bindFunctions };
  } finally {
    // A failed render can orphan `#id` / `#did`; clear anything we created.
    document.getElementById(id)?.remove();
    document.getElementById("d" + id)?.remove();
    hidden.replaceChildren();
  }
}

/**
 * Render an *export-safe* SVG string with HTML labels disabled. Rasterizing an
 * SVG that contains `<foreignObject>` (mermaid's default HTML labels) taints the
 * canvas, so PNG/JPEG export must use plain SVG `<text>` labels instead. Uses its
 * own temporary off-screen host so it never races the live-preview render.
 */
export async function renderForRaster(
  code: string,
  visual: VisualConfig,
  rawOverride: Record<string, unknown> | null,
): Promise<string> {
  const mermaid = await getMermaid();
  const id = nextId();
  const cfg = buildVisualConfig({ ...visual, htmlLabels: false }, rawOverride);
  cfg.htmlLabels = false;
  cfg.flowchart = { ...((cfg.flowchart as Record<string, unknown>) ?? {}), htmlLabels: false };

  const host = document.createElement("div");
  host.style.cssText =
    "position:absolute;left:-99999px;top:0;width:100%;height:0;overflow:hidden;opacity:0;pointer-events:none;";
  document.body.appendChild(host);
  try {
    const { svg } = await mermaid.render(id, `%%{init: ${JSON.stringify(cfg)}}%%\n` + code, host);
    return svg;
  } finally {
    document.getElementById(id)?.remove();
    document.getElementById("d" + id)?.remove();
    host.remove();
  }
}

/**
 * Render an export-ready SVG element for diagrams containing `$$…$$` math.
 * Renders with HTML labels + `forceLegacyMathML` so KaTeX emits real HTML, then
 * rebuilds every `<foreignObject>` (math and text labels) as native SVG and
 * embeds the fonts used. The result has NO foreignObject/MathML, so it both
 * rasterizes without tainting the canvas and is a self-contained vector SVG.
 * Returns a detached clone (its temporary host is cleaned up).
 */
export async function renderFlattenedExportSvg(
  code: string,
  visual: VisualConfig,
  rawOverride: Record<string, unknown> | null,
): Promise<SVGSVGElement> {
  const mermaid = await getMermaid();
  await ensureMathFonts(code);
  const id = nextId();
  const cfg = buildVisualConfig({ ...visual, htmlLabels: true, forceLegacyMathML: true }, rawOverride);
  // Force these on regardless of any rawOverride — flattening needs KaTeX HTML.
  cfg.htmlLabels = true;
  cfg.forceLegacyMathML = true;
  cfg.flowchart = { ...((cfg.flowchart as Record<string, unknown>) ?? {}), htmlLabels: true };

  // Mounted + laid out (NOT display:none / height:0) so geometry is measurable.
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-99999px;top:0;opacity:0;pointer-events:none;";
  document.body.appendChild(host);
  try {
    const { svg: svgString } = await mermaid.render(id, `%%{init: ${JSON.stringify(cfg)}}%%\n` + code, host);
    host.innerHTML = svgString;
    const svg = host.querySelector("svg");
    if (!svg) throw new Error("renderFlattenedExportSvg: no SVG produced");
    void svg.getBoundingClientRect(); // force layout, then wait for KaTeX fonts
    if (document.fonts?.ready) await document.fonts.ready;

    const families = flattenForeignObjects(svg as SVGSVGElement);
    await embedFontFaces(svg as SVGSVGElement, families);
    return svg.cloneNode(true) as SVGSVGElement;
  } finally {
    document.getElementById(id)?.remove();
    document.getElementById("d" + id)?.remove();
    host.remove();
  }
}
