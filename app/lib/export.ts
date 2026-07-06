// SVG / PNG / JPEG export. All dependency-free: clone the live SVG, normalize
// its size from the viewBox, serialize, then (for raster) rasterize through an
// <img> + <canvas>. Notes on the tricky bits are inline.

const SVGNS = "http://www.w3.org/2000/svg";

export type RasterFormat = "png" | "jpeg";

export interface RasterOptions {
  scale: number; // 1 | 2 | 3 — hi-res is genuine (the vector is rasterized at target size)
  /** CSS color, or "transparent". JPEG has no alpha, so transparent falls back to white. */
  bg: string;
  format: RasterFormat;
  quality?: number; // JPEG only
  /** Best-effort: inline a same-origin @font-face for this family so custom text survives raster. */
  embedFontFamily?: string;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Intrinsic size of a mermaid SVG. mermaid sets `style="max-width:Npx"` and
 * often `width="100%"` with no px width, so the viewBox is the source of truth;
 * getBBox (valid while the element is in the DOM) and the client rect are fallbacks.
 */
export function intrinsicSize(svg: SVGSVGElement): Box {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) {
    return { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
  }
  try {
    const bb = svg.getBBox();
    if (bb.width > 0 && bb.height > 0) {
      return { x: bb.x, y: bb.y, width: bb.width, height: bb.height };
    }
  } catch {
    /* getBBox throws if detached — fall through */
  }
  const r = svg.getBoundingClientRect();
  return { x: 0, y: 0, width: r.width || 800, height: r.height || 600 };
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Lowercased first family token, unquoted (e.g. `"KaTeX_Math", serif` -> `katex_math`). */
function familyKey(family: string): string {
  return (family.split(",")[0] ?? "").replace(/["']/g, "").trim().toLowerCase();
}

/**
 * Best-effort: find same-origin @font-face rules whose family (first token) is
 * in `families`, fetch the files, and return an inlineable `<style>` block. All
 * matching weights/styles are collected (so bold/italic math survive). Cross-
 * origin / unavailable fonts are skipped silently (system fonts match nothing
 * and render natively).
 */
async function collectFontFaceCss(families: Set<string>): Promise<string> {
  const wanted = new Set<string>();
  for (const f of families) {
    const k = familyKey(f);
    if (k) wanted.add(k);
  }
  if (wanted.size === 0) return "";
  const faces: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin stylesheet
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const ffRaw = rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim();
      if (!wanted.has(ffRaw.toLowerCase())) continue;
      const src = rule.style.getPropertyValue("src");
      const match = /url\(["']?([^"')]+)["']?\)/.exec(src);
      if (!match) continue;
      // `src` urls are relative to the stylesheet (e.g. `../media/…woff2`), not
      // the document — resolve against the sheet's href before fetching.
      let href = match[1];
      try {
        href = new URL(match[1], sheet.href ?? document.baseURI).href;
      } catch {
        /* keep the raw url */
      }
      try {
        const res = await fetch(href);
        if (!res.ok) continue;
        const b64 = arrayBufferToBase64(await res.arrayBuffer());
        const fmt = /\.woff2|format\(["']?woff2/.test(src) ? "woff2" : /woff/.test(src) ? "woff" : "truetype";
        const weight = rule.style.getPropertyValue("font-weight") || "normal";
        const style = rule.style.getPropertyValue("font-style") || "normal";
        faces.push(
          `@font-face{font-family:'${ffRaw}';font-weight:${weight};font-style:${style};` +
            `src:url(data:font/${fmt};base64,${b64}) format('${fmt}');}`,
        );
      } catch {
        /* ignore a single unfetchable font */
      }
    }
  }
  return faces.join("\n");
}

/** Inline the @font-face rules for `families` as a `<style>` first-child of `svg`. */
export async function embedFontFaces(svg: SVGSVGElement, families: Set<string>): Promise<void> {
  const css = await collectFontFaceCss(families);
  if (!css) return;
  const style = document.createElementNS(SVGNS, "style");
  style.textContent = css;
  svg.insertBefore(style, svg.firstChild);
}

/** Clone the SVG and normalize it to a fixed pixel size (base × scale), keeping the viewBox. */
function prepareClone(svg: SVGSVGElement, scale: number): { clone: SVGSVGElement; outW: number; outH: number } {
  const { x, y, width, height } = intrinsicSize(svg);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));
  clone.setAttribute("width", String(outW));
  clone.setAttribute("height", String(outH));
  clone.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  clone.style.removeProperty("max-width");
  clone.style.removeProperty("width");
  clone.style.removeProperty("height");
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  return { clone, outW, outH };
}

function serialize(clone: SVGSVGElement): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download the diagram as a standalone, scalable `.svg`. */
export function downloadSvg(svg: SVGSVGElement, filename = "diagram.svg"): void {
  const { clone } = prepareClone(svg, 1);
  const blob = new Blob([serialize(clone)], { type: "image/svg+xml;charset=utf-8" });
  triggerDownload(blob, filename);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to rasterize SVG"));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))), type, quality);
  });
}

/** Rasterize the SVG to a PNG/JPEG Blob at the requested scale and background. */
export async function svgToRasterBlob(svg: SVGSVGElement, opts: RasterOptions): Promise<Blob> {
  const { clone, outW, outH } = prepareClone(svg, opts.scale);

  if (opts.embedFontFamily) {
    await embedFontFaces(clone, new Set([opts.embedFontFamily]));
  }

  const url = URL.createObjectURL(new Blob([serialize(clone)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");

    const jpeg = opts.format === "jpeg";
    const transparent = !opts.bg || opts.bg === "transparent";
    // JPEG has no alpha: a transparent request would render black, so fill white.
    const bg = jpeg && transparent ? "#ffffff" : opts.bg;
    if (bg && bg !== "transparent") {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, outW, outH);
    }
    ctx.drawImage(img, 0, 0, outW, outH);

    return await canvasToBlob(canvas, jpeg ? "image/jpeg" : "image/png", jpeg ? opts.quality ?? 0.92 : undefined);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadRaster(svg: SVGSVGElement, opts: RasterOptions, filename?: string): Promise<void> {
  const blob = await svgToRasterBlob(svg, opts);
  triggerDownload(blob, filename ?? `diagram.${opts.format === "jpeg" ? "jpg" : "png"}`);
}

/** Mount an SVG string off-screen, rasterize it, then clean up. */
export async function rasterizeSvgString(svgString: string, opts: RasterOptions): Promise<Blob> {
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:-99999px;top:0;opacity:0;pointer-events:none;";
  host.innerHTML = svgString;
  document.body.appendChild(host);
  try {
    const svg = host.querySelector("svg") as SVGSVGElement | null;
    if (!svg) throw new Error("No SVG to rasterize");
    return await svgToRasterBlob(svg, opts);
  } finally {
    host.remove();
  }
}
