// A lightweight CodeMirror 6 language for Mermaid (there is no official grammar),
// plus a linter that surfaces `mermaid.parse` errors on the offending line.
// Token strings returned below are @lezer/highlight tag names, so the active
// highlight style (default in light, oneDark in dark) colors them automatically.

import { StreamLanguage, LanguageSupport } from "@codemirror/language";
import { linter, type Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import { validate } from "./mermaid";

// Diagram-type + structural keywords, longest variants first so the `(?![\w-])`
// lookahead resolves e.g. `stateDiagram-v2` before `stateDiagram`.
const KEYWORDS = [
  "stateDiagram-v2", "classDiagram-v2", "sankey-beta", "xychart-beta", "packet-beta", "block-beta",
  "requirementDiagram", "quadrantChart", "sequenceDiagram", "stateDiagram", "classDiagram", "erDiagram",
  "gitGraph", "flowchart", "mindmap", "timeline", "journey", "gantt", "graph", "pie",
  "C4Context", "C4Container", "C4Component", "C4Dynamic", "C4Deployment", "zenuml",
  "subgraph", "direction", "participant", "autonumber", "deactivate", "activate", "classDef",
  "linkStyle", "dateFormat", "axisFormat", "todayMarker", "excludes", "includes", "requirement",
  "cherry-pick", "checkout", "callback", "section", "critical", "element", "commit", "branch",
  "actor", "state", "class", "style", "title", "click", "link", "note", "loop", "rect", "merge",
  "break", "over", "else", "opt", "par", "and", "end",
];
const KEYWORD_RE = new RegExp(`^(?:${KEYWORDS.join("|")})(?![\\w-])`);

export const mermaidLanguage = StreamLanguage.define<Record<string, never>>({
  name: "mermaid",
  startState: () => ({}),
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^%%\{.*?\}%%/)) return "meta"; // %%{init: ...}%% directive
    if (stream.match(/^%%.*/)) return "comment";
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return "string";
    if (stream.match(/^\d+(?:\.\d+)?/)) return "number";
    if (stream.match(KEYWORD_RE)) return "keyword";
    if (stream.match(/^(?:[-.=~<>|][-.=~<>ox|]*)/)) return "operator"; // arrows / links
    if (stream.match(/^[[\]{}()]/)) return "bracket";
    if (stream.match(/^[A-Za-z_][\w-]*/)) return null; // identifiers / node ids
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: "%%" } },
});

export function mermaid(): LanguageSupport {
  return new LanguageSupport(mermaidLanguage);
}

/** Bridge `mermaid.parse` errors into CodeMirror diagnostics on the reported line. */
export function mermaidLinter() {
  return linter(
    async (view: EditorView): Promise<readonly Diagnostic[]> => {
      const code = view.state.doc.toString();
      if (!code.trim()) return [];
      const result = await validate(code);
      if (result.ok) return [];
      const total = view.state.doc.lines;
      const lineNo = result.line && result.line >= 1 && result.line <= total ? result.line : 1;
      const line = view.state.doc.line(lineNo);
      return [
        {
          from: line.from,
          to: line.to,
          severity: "error",
          message: result.message ?? "Syntax error",
        },
      ];
    },
    { delay: 400 },
  );
}
