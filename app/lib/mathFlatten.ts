// Convert mermaid's HTML labels (KaTeX math + plain text, rendered inside
// <foreignObject>) into native SVG primitives (<text>/<rect>/<svg>), so the
// diagram survives export:
//   - PNG/JPEG: an SVG containing ANY <foreignObject> taints the canvas in
//     Chromium/WebKit (a WONTFIX security decision), so raster export cannot
//     hold foreignObject. Native <text>/<rect> rasterize cleanly.
//   - SVG: KaTeX's on-screen look depends on the page's KaTeX CSS/fonts and its
//     `output:"htmlAndMathml"` renders a hidden MathML twin. Rebuilding from the
//     *visible* KaTeX HTML drops the twin (no "double lines") and, with the
//     woff2 fonts embedded (see `renderFlattenedExportSvg`), is self-contained.
//
// The input SVG must be MOUNTED, laid out at natural size, and its fonts loaded
// — we read live geometry (getBoundingClientRect / Range rects) and computed
// styles. `flattenForeignObjects` mutates the SVG in place and returns the set
// of font families it emitted (for the caller to embed).

const SVGNS = "http://www.w3.org/2000/svg";
const XMLNS = "http://www.w3.org/XML/1998/namespace";
const MATHMLNS = "http://www.w3.org/1998/Math/MathML";

/** First family token, unquoted (e.g. `"KaTeX_Math", sans-serif` -> `KaTeX_Math`). */
function firstFamily(fontFamily: string): string {
  return (fontFamily.split(",")[0] ?? "").replace(/["']/g, "").trim();
}

/** Quote a family for the canvas `font` shorthand if it contains spaces. */
function quoteFamily(family: string): string {
  return /\s/.test(family) ? `"${family}"` : family;
}

/** Round to 3 decimals and stringify — keeps the serialized SVG compact. */
function fmt(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}

/** A computed color counts as absent if it is `transparent` or has alpha 0. */
function isTransparent(color: string): boolean {
  const c = color?.trim();
  if (!c || c === "transparent") return true;
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean);
    if (parts.length >= 4 && parseFloat(parts[3]) === 0) return true;
  }
  return false;
}

interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Rebuild every `<foreignObject>` in `svg` as native SVG. Returns the set of
 * emitted `font-family` tokens (first-token, unquoted) so the caller can embed
 * the matching @font-face rules. Throws if any foreignObject survives (the
 * canvas-taint guarantee).
 */
export function flattenForeignObjects(svg: SVGSVGElement): Set<string> {
  const usedFamilies = new Set<string>();

  const vb = svg.viewBox.baseVal;
  const hasVb = !!vb && vb.width > 0 && vb.height > 0;
  // Pin the SVG to its natural pixel size so screen px ≈ viewBox units (1:1).
  if (hasVb) {
    svg.style.maxWidth = "none";
    svg.setAttribute("width", String(vb.width));
    svg.setAttribute("height", String(vb.height));
  }
  const root = svg.getBoundingClientRect(); // forces layout after the resize
  // Aspect ratio is preserved, so a single scale maps screen px -> user units.
  const s = hasVb && root.width > 0 ? vb.width / root.width : 1;
  const ox = hasVb ? vb.x : 0;
  const oy = hasVb ? vb.y : 0;
  const toX = (cx: number) => ox + (cx - root.left) * s;
  const toY = (cy: number) => oy + (cy - root.top) * s;
  const len = (px: number) => px * s;

  // Shared canvas for font-metric measurement (baseline).
  const measureCtx = document.createElement("canvas").getContext("2d");

  const emitRect = (target: SVGGElement, r: ScreenRect, fill: string) => {
    if (r.width <= 0 || r.height <= 0) return;
    const rect = document.createElementNS(SVGNS, "rect");
    rect.setAttribute("x", fmt(toX(r.left)));
    rect.setAttribute("y", fmt(toY(r.top)));
    rect.setAttribute("width", fmt(len(r.width)));
    rect.setAttribute("height", fmt(len(r.height)));
    rect.setAttribute("fill", fill);
    target.appendChild(rect);
  };

  const emitBackground = (target: SVGGElement, el: HTMLElement, cs: CSSStyleDeclaration) => {
    if (isTransparent(cs.backgroundColor)) return;
    emitRect(target, el.getBoundingClientRect(), cs.backgroundColor);
  };

  // KaTeX draws fraction bars, √ vincula, over/underlines and \boxed as CSS
  // borders. Reproduce each visible border side as a thin rect — driven by
  // computed style, so it is robust across KaTeX versions/class renames.
  const emitBorders = (target: SVGGElement, el: HTMLElement, cs: CSSStyleDeclaration) => {
    const r = el.getBoundingClientRect();
    const sides = [
      ["top", { left: r.left, top: r.top, width: r.width, height: 0 }],
      ["bottom", { left: r.left, top: r.bottom, width: r.width, height: 0 }],
      ["left", { left: r.left, top: r.top, width: 0, height: r.height }],
      ["right", { left: r.right, top: r.top, width: 0, height: r.height }],
    ] as const;
    for (const [side, base] of sides) {
      const w = parseFloat(cs.getPropertyValue(`border-${side}-width`));
      const style = cs.getPropertyValue(`border-${side}-style`);
      const color = cs.getPropertyValue(`border-${side}-color`);
      if (!(w > 0) || style === "none" || isTransparent(color)) continue;
      const rect: ScreenRect =
        side === "top"
          ? { left: base.left, top: r.top, width: r.width, height: w }
          : side === "bottom"
            ? { left: base.left, top: r.bottom - w, width: r.width, height: w }
            : side === "left"
              ? { left: r.left, top: r.top, width: w, height: r.height }
              : { left: r.right - w, top: r.top, width: w, height: r.height };
      emitRect(target, rect, color);
    }
  };

  const emitText = (target: SVGGElement, textNode: Text) => {
    const raw = textNode.textContent ?? "";
    if (!raw.trim()) return;
    const parent = textNode.parentElement;
    if (!parent) return;
    const cs = getComputedStyle(parent);
    if (cs.visibility === "hidden" || cs.display === "none") return;

    const range = document.createRange();
    range.selectNodeContents(textNode);
    const r = range.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) return;

    const family = firstFamily(cs.fontFamily) || "sans-serif";
    const fontPx = parseFloat(cs.fontSize) || 16;
    const weight = cs.fontWeight || "normal";
    const style = cs.fontStyle || "normal";
    const fill = cs.color || "#000";

    // Baseline: Range.top is the text's em-box top, so baseline = top + ascent.
    // Use the font metric (constant per font+size), not the glyph ink ascent.
    let ascent = fontPx * 0.8;
    if (measureCtx) {
      measureCtx.font = `${style} ${weight} ${fontPx}px ${quoteFamily(family)}`;
      const m = measureCtx.measureText(raw);
      ascent = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent || ascent;
    }

    const t = document.createElementNS(SVGNS, "text");
    t.setAttribute("x", fmt(toX(r.left)));
    t.setAttribute("y", fmt(toY(r.top + ascent)));
    t.setAttribute("font-family", cs.fontFamily);
    t.setAttribute("font-size", fmt(len(fontPx)));
    if (weight && weight !== "400" && weight !== "normal") t.setAttribute("font-weight", weight);
    if (style && style !== "normal") t.setAttribute("font-style", style);
    t.setAttribute("fill", fill);
    t.setAttribute("text-anchor", "start");
    t.setAttribute("dominant-baseline", "alphabetic");
    t.setAttributeNS(XMLNS, "xml:space", "preserve");
    t.textContent = raw;
    target.appendChild(t);
    usedFamilies.add(family);
  };

  // Stretchy delimiters, extensible arrows and some surds are inline <svg> with
  // their own viewBox — lift them wholesale, repositioned into root coordinates.
  const emitNestedSvg = (target: SVGGElement, inner: SVGSVGElement) => {
    const r = inner.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const clone = inner.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("x", fmt(toX(r.left)));
    clone.setAttribute("y", fmt(toY(r.top)));
    clone.setAttribute("width", fmt(len(r.width)));
    clone.setAttribute("height", fmt(len(r.height)));
    clone.style.removeProperty("width");
    clone.style.removeProperty("height");
    const color = getComputedStyle(inner).color;
    if (color && !isTransparent(color)) clone.setAttribute("fill", color);
    target.appendChild(clone);
  };

  const walk = (target: SVGGElement, node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      emitText(target, node as Text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;

    // Drop KaTeX's hidden MathML twin (the "double lines" source) and anything
    // explicitly hidden — but NOT clipped-but-visible nodes (checked per text).
    if (el.namespaceURI === MATHMLNS || el.classList?.contains("katex-mathml")) return;

    if (el.namespaceURI === SVGNS && el.tagName.toLowerCase() === "svg") {
      emitNestedSvg(target, el as SVGSVGElement);
      return;
    }

    const cs = getComputedStyle(el as HTMLElement);
    if (cs.display === "none" || cs.visibility === "hidden") return;

    emitBackground(target, el as HTMLElement, cs);
    emitBorders(target, el as HTMLElement, cs);
    for (const child of Array.from(el.childNodes)) walk(target, child);
  };

  for (const fo of Array.from(svg.querySelectorAll("foreignObject"))) {
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("data-flattened-label", "");
    try {
      for (const child of Array.from(fo.childNodes)) walk(g, child);
    } catch (err) {
      console.warn("math flatten: label conversion failed", err);
    }
    svg.appendChild(g);
    fo.remove();
  }

  if (svg.querySelector("foreignObject")) {
    throw new Error("flattenForeignObjects: a <foreignObject> survived — raster would taint");
  }
  return usedFamilies;
}
