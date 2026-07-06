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
