/*
 * Copyright (C) 2026 Yukthi Systems Private Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * version 3 along with this program. If not, see
 * <https://www.gnu.org/licenses/>.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, Loader2, MoreVertical, Search } from "lucide-react";
import type { FileItem } from "../../types/file";
import type { SearchResult, SearchSnippet } from "../../hooks/useFileSearch";
import { getItemPath } from "../../utils/fileQueries";
import { formatBytes, formatDate, isItemFailed, isItemProcessing } from "../../utils/format";
import { getItemIcon } from "./FileIcon";
import { ContextMenuPortal } from "../common/ContextMenuPortal";
import type { AnchorRect } from "../common/ContextMenuPortal";

function HighlightedSnippet({ snippet }: { snippet: SearchSnippet }) {
  return (
    <p className="text-xs text-text-main leading-relaxed truncate">
      {snippet.text.slice(0, snippet.matchStart)}
      <mark className="bg-accent-bg text-accent rounded px-0.5">{snippet.text.slice(snippet.matchStart, snippet.matchEnd)}</mark>
      {snippet.text.slice(snippet.matchEnd)}
    </p>
  );
}

export function SearchResultsList({
  results,
  files,
  isSearchingContent,
  query,
  contextMenuId,
  onContextMenuToggle,
  onItemContextMenu,
  renderContextMenu,
  onOpenItem,
}: {
  results: SearchResult[];
  files: FileItem[];
  isSearchingContent: boolean;
  query: string;
  contextMenuId: string | null;
  onContextMenuToggle: (id: string | null) => void;
  onItemContextMenu: (item: FileItem, e: React.MouseEvent) => void;
  renderContextMenu: (item: FileItem) => ReactNode;
  onOpenItem: (item: FileItem) => void;
}) {
  const [menuAnchor, setMenuAnchor] = useState<{ rect: AnchorRect; align: "start" | "end" } | null>(null);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-4 text-text-main">
        {isSearchingContent ? (
          <Loader2 className="w-10 h-10 mb-4 opacity-50 animate-spin text-neutral-400" />
        ) : (
          <Search className="w-14 h-14 mb-4 opacity-50 text-neutral-400" />
        )}
        <div className="text-base font-semibold text-text-heading mb-1.5">
          {isSearchingContent ? "Searching file contents…" : `No results for "${query}"`}
        </div>
        {!isSearchingContent && (
          <div className="text-sm max-w-[320px] leading-relaxed">Try a different word, or check the file's name and content.</div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {results.map(({ item, matchType, snippet }) => (
        <div
          key={item.id}
          onClick={() => onOpenItem(item)}
          onContextMenu={(e) => {
            setMenuAnchor({ rect: { top: e.clientY, left: e.clientX, right: e.clientX, bottom: e.clientY }, align: "start" });
            onItemContextMenu(item, e);
          }}
          className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-code-bg transition"
        >
          {getItemIcon(item)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-heading truncate">{item.name}</span>
              <span className="text-[11px] text-text-main shrink-0 truncate max-w-[40%]">{getItemPath(files, item)}</span>
            </div>
            {matchType === "content" && snippet && <HighlightedSnippet snippet={snippet} />}
          </div>
          <span className="text-[11px] text-text-main shrink-0 hidden sm:inline">
            {item.isFolder ? (
              item.size > 0 ? formatBytes(item.size) : "—"
            ) : isItemFailed(item) ? (
              <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                <AlertCircle className="w-2.5 h-2.5" />
                Failed
              </span>
            ) : isItemProcessing(item) ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-500" />
                Processing
              </span>
            ) : (
              formatBytes(item.size)
            )}
          </span>
          <span className="text-[11px] text-text-main shrink-0 hidden sm:inline">{formatDate(item.modifiedAt)}</span>
          <div className="relative shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const opening = contextMenuId !== item.id;
                setMenuAnchor(opening ? { rect: e.currentTarget.getBoundingClientRect(), align: "end" } : null);
                onContextMenuToggle(opening ? item.id : null);
              }}
              className="row-actions-trigger border-none bg-transparent p-1.5 rounded-full text-text-main hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-text-heading cursor-pointer inline-flex items-center justify-center transition opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {contextMenuId === item.id && menuAnchor && (
              <ContextMenuPortal anchor={menuAnchor.rect} align={menuAnchor.align}>
                {renderContextMenu(item)}
              </ContextMenuPortal>
            )}
          </div>
        </div>
      ))}
      {isSearchingContent && <div className="text-xs text-text-main text-center py-3">Searching file contents…</div>}
    </div>
  );
}
