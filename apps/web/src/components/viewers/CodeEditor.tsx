import { useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { loadLanguage } from "@uiw/codemirror-extensions-langs";
import { FileCode, Save } from "lucide-react";
import type { FileItem } from "../../types/file";

export function CodeEditor({
  item,
  onSave,
}: {
  item: FileItem;
  onSave: (blob: Blob) => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setContent(null);
    setDirty(false);
    setLoadFailed(false);
    if (!item.blobUrl) return;

    let active = true;
    fetch(item.blobUrl)
      .then((res) => res.text())
      .then((text) => active && setContent(text))
      .catch(() => active && setLoadFailed(true));

    return () => {
      active = false;
    };
  }, [item.id, item.blobUrl]);

  const extensions = useMemo(() => {
    const ext = (item.extension || "").toLowerCase();
    const lang = ext ? loadLanguage(ext as never) : null;
    return lang ? [lang] : [];
  }, [item.extension]);

  const isDark = useMemo(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches, []);

  const handleSave = () => {
    if (content === null) return;
    const blob = new Blob([content], { type: "text/plain" });
    onSave(blob);
    setDirty(false);
  };

  if (!item.blobUrl) {
    return (
      <div className="flex flex-col items-center gap-2 text-center text-text-main py-16">
        <FileCode className="w-12 h-12 text-purple-400" />
        <div className="text-sm font-medium">Seeded demo item — no file content to open.</div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="flex flex-col items-center gap-2 text-center text-text-main py-16">
        <FileCode className="w-12 h-12 text-purple-400" />
        <div className="text-sm font-medium">Could not read this file as text.</div>
      </div>
    );
  }

  if (content === null) {
    return <div className="text-sm text-text-main text-center py-16">Loading…</div>;
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-end">
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-full disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:opacity-90 transition"
        >
          <Save className="w-3.5 h-3.5" /> Save
        </button>
      </div>
      <div className="border border-border-main rounded-lg overflow-hidden max-h-[65vh] overflow-y-auto text-left">
        <CodeMirror
          value={content}
          extensions={extensions}
          theme={isDark ? "dark" : "light"}
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
