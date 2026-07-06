"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { lintGutter } from "@codemirror/lint";
import { oneDark } from "@codemirror/theme-one-dark";
import { AlertCircle } from "lucide-react";
import { mermaid as mermaidLang, mermaidLinter } from "../lib/cmMermaid";

interface EditorPaneProps {
  value: string;
  onChange: (value: string) => void;
  isDark: boolean;
  error: string | null;
}

const heightTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px" },
  ".cm-scroller": {
    fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
    lineHeight: "1.6",
  },
  ".cm-gutters": { border: "none" },
});

export default function EditorPane({ value, onChange, isDark, error }: EditorPaneProps) {
  const extensions = useMemo(
    () => [mermaidLang(), mermaidLinter(), lintGutter(), EditorView.lineWrapping, heightTheme],
    [],
  );

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col border-black/10 dark:border-white/10">
      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeMirror
          value={value}
          onChange={onChange}
          height="100%"
          theme={isDark ? oneDark : "light"}
          extensions={extensions}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            autocompletion: false,
            bracketMatching: true,
            closeBrackets: true,
            indentOnInput: false,
          }}
        />
      </div>
      {error && (
        <div className="flex max-h-28 shrink-0 items-start gap-2 overflow-auto border-t border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <pre className="whitespace-pre-wrap break-words font-mono">{error}</pre>
        </div>
      )}
    </div>
  );
}
