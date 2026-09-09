import { useEffect, useMemo, useRef, useState } from "react";
import type { FileItem, SidebarTab } from "../types/file";
import { getSearchScope, getNameMatches } from "../utils/fileQueries";
import { extractSearchableText } from "../services/searchIndex";

export interface SearchSnippet {
  text: string;
  matchStart: number;
  matchEnd: number;
}

export interface SearchResult {
  item: FileItem;
  matchType: "name" | "content";
  snippet?: SearchSnippet;
}

const DEBOUNCE_MS = 300;
const MIN_CONTENT_QUERY_LENGTH = 2;
const SNIPPET_RADIUS = 60;

function buildSnippet(text: string, query: string): SearchSnippet | undefined {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return undefined;

  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + query.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";

  return {
    text: prefix + text.slice(start, end) + suffix,
    matchStart: idx - start + prefix.length,
    matchEnd: idx - start + prefix.length + query.length,
  };
}

// Full-text search: name matches are synchronous and instant (same substring check as
// always, just widened to the whole recursive section instead of one folder); content
// matches run in a debounced async pass over whatever didn't already match by name, reusing
// each viewer's own content-extraction logic via extractSearchableText.
export function useFileSearch({
  files,
  activeSidebarTab,
  currentFolderId,
  typeFilter,
  trashFolderId,
}: {
  files: FileItem[];
  activeSidebarTab: SidebarTab;
  currentFolderId: string | null;
  typeFilter: string;
  trashFolderId?: string | null;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [contentResults, setContentResults] = useState<SearchResult[]>([]);
  const [isSearchingContent, setIsSearchingContent] = useState(false);
  const generationRef = useRef(0);

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery !== "";

  const scope = useMemo(
    () =>
      isSearching ? getSearchScope(files, { activeSidebarTab, currentFolderId, typeFilter, trashFolderId }) : [],
    [files, activeSidebarTab, currentFolderId, typeFilter, trashFolderId, isSearching]
  );

  const nameResults: SearchResult[] = useMemo(
    () => (isSearching ? getNameMatches(scope, trimmedQuery).map((item) => ({ item, matchType: "name" as const })) : []),
    [scope, trimmedQuery, isSearching]
  );

  useEffect(() => {
    const generation = ++generationRef.current;

    if (!isSearching || trimmedQuery.length < MIN_CONTENT_QUERY_LENGTH) {
      setContentResults([]);
      setIsSearchingContent(false);
      return;
    }

    const nameMatchedIds = new Set(nameResults.map((r) => r.item.id));
    const candidates = scope.filter((f) => !f.isFolder && !nameMatchedIds.has(f.id));

    if (candidates.length === 0) {
      setContentResults([]);
      setIsSearchingContent(false);
      return;
    }

    setIsSearchingContent(true);
    const timer = setTimeout(() => {
      (async () => {
        const matches: SearchResult[] = [];
        await Promise.all(
          candidates.map(async (item) => {
            const text = await extractSearchableText(item);
            if (!text) return;
            const snippet = buildSnippet(text, trimmedQuery);
            if (snippet) matches.push({ item, matchType: "content", snippet });
          })
        );
        // A newer search superseded this one while extraction was in flight — drop it.
        if (generationRef.current !== generation) return;
        setContentResults(matches);
        setIsSearchingContent(false);
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [scope, trimmedQuery, isSearching, nameResults]);

  const results = isSearching ? [...nameResults, ...contentResults] : [];

  return { searchQuery, setSearchQuery, isSearching, results, isSearchingContent };
}
