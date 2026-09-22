import { useEffect, useMemo, useState } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { loadLanguage } from "@uiw/codemirror-extensions-langs";
import { FileCode, Save, Braces } from "lucide-react";
import type { FileItem } from "../../types/file";
import { useFileBlob } from "../../hooks/useFileBlob";
import { isItemLocked } from "../../utils/format";

// CodeMirror renders the whole document; past this it stalls the tab, so bigger files
// are download-only.
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

// Extensions whose grammar lives under a different key in the language pack.
const LANGUAGE_ALIASES: Record<string, string> = {
  jsonc: "json",
  json5: "json",
  jsonl: "json",
  ndjson: "json",
  geojson: "json",
  htm: "html",
  xhtml: "html",
  xsl: "xml",
  xslt: "xml",
  scss: "sass",
  markdown: "md",
  pyw: "py",
  gradle: "groovy",
  kts: "kt",
  zsh: "sh",
  fish: "sh",
  bat: "sh",
  cmd: "sh",
  sol: "solidity",
  hh: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  tf: "properties",
  conf: "properties",
  ini: "properties",
  env: "properties",
  vhd: "vhdl",
  patch: "diff",
};

const Notice = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center gap-2 text-center text-text-main py-16">
    <FileCode className="w-12 h-12 text-purple-400" />
    <div className="text-sm font-medium">{message}</div>
  </div>
);

export function CodeEditor({
  item,
  onSave,
  fill = false,
}: {
  item: FileItem;
  onSave: (blob: Blob) => void;
  // Stretch to the viewer's full height instead of capping at 65vh (full-view mode).
  fill?: boolean;
}) {
  const { blob, loading, error } = useFileBlob(item);
  const [content, setContent] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [decodeFailed, setDecodeFailed] = useState(false);

  // There is no write-back path to the server for text edits, so saving is only offered
  // for local items; server/shared files open read-only rather than pretending to save.
  const readOnly = item.origin === "server" || item.origin === "shared" || isItemLocked(item);
  const tooLarge = !!blob && blob.size > MAX_PREVIEW_BYTES;
  const ext = (item.extension || "").toLowerCase();

  useEffect(() => {
    setContent(null);
    setDirty(false);
    setDecodeFailed(false);
    if (!blob || blob.size > MAX_PREVIEW_BYTES) return;

    let active = true;
    blob
      .text()
      .then((text) => {
        if (active) setContent(text);
      })
      .catch(() => active && setDecodeFailed(true));
    return () => {
      active = false;
    };
  }, [blob]);

  const extensions = useMemo(() => {
    const lang = ext ? loadLanguage((LANGUAGE_ALIASES[ext] ?? ext) as never) : null;
    return [EditorView.lineWrapping, ...(lang ? [lang] : [])];
  }, [ext]);

  const isDark = useMemo(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches, []);

  const handleSave = () => {
    if (content === null) return;
    onSave(new Blob([content], { type: "text/plain" }));
    setDirty(false);
  };

  const handleFormatJson = () => {
    if (content === null) return;
    try {
      setContent(JSON.stringify(JSON.parse(content), null, 2));
      setDirty(true);
    } catch {
      // Not valid JSON (e.g. JSON Lines) — leave the text untouched.
    }
  };

  if (loading) return <div className="text-sm text-text-main text-center py-16">Loading…</div>;
  if (error) return <Notice message={error} />;
  if (tooLarge) return <Notice message="This file is too large to preview as text — download it to open." />;
  if (decodeFailed) return <Notice message="Could not read this file as text." />;
  if (content === null) return <div className="text-sm text-text-main text-center py-16">Loading…</div>;

  return (
    <div className={`flex flex-col gap-3 w-full ${fill ? "h-full" : ""}`}>
      {!readOnly && (
        <div className="flex items-center justify-end gap-2">
          {ext === "json" && (
            <button
              onClick={handleFormatJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-code-bg border border-border-main text-text-main text-xs font-semibold rounded-full cursor-pointer hover:bg-border-main transition"
            >
              <Braces className="w-3.5 h-3.5" /> Format
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-full disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:opacity-90 transition"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </button>
        </div>
      )}
      <div
        className={`border border-border-main rounded-lg overflow-hidden overflow-y-auto text-left ${
          fill ? "flex-1 min-h-0" : "max-h-[65vh]"
        }`}
      >
        <CodeMirror
          value={content}
          extensions={extensions}
          theme={isDark ? "dark" : "light"}
          readOnly={readOnly}
          editable={!readOnly}
          onChange={(value) => {
            setContent(value);
            setDirty(true);
          }}
          basicSetup={{ lineNumbers: true, foldGutter: true }}
        />
      </div>
    </div>
  );
}
