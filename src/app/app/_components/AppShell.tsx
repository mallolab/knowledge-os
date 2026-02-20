"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Orbit, Radar, Rows4, X } from "lucide-react";
import { TopBar } from "./TopBar";
import { NotesGrid } from "./NotesGrid";
import { semanticSearch } from "../actions";
import type { Note } from "@/lib/types";
import { CommandPalette } from "./CommandPalette";
import { isDemoMode, type WorkspaceMode } from "@/lib/app-mode";

type SearchRow = {
  id: string;
  title: string | null;
  content: string;
  summary: string | null;
  collection_id: string | null;
  updated_at: string;
  similarity: number;
};

type ToastTone = "info" | "success" | "error";

type ToastAction = {
  label: string;
  ariaLabel?: string;
  onAction: () => void | Promise<void>;
};

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
};

type SemanticMatchSource = "title" | "summary" | "content" | "semantic";

type SemanticExplain = {
  similarity: number;
  snippet: string;
  matchedIn: SemanticMatchSource;
};

function clampSimilarity(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function buildSemanticSnippet(
  row: SearchRow,
  query: string,
): { snippet: string; matchedIn: SemanticMatchSource } {
  const terms = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length > 1),
    ),
  );

  const sources: Array<{ matchedIn: SemanticMatchSource; text: string }> = [
    { matchedIn: "title", text: row.title ?? "" },
    { matchedIn: "summary", text: row.summary ?? "" },
    { matchedIn: "content", text: row.content ?? "" },
  ];

  for (const source of sources) {
    const lowered = source.text.toLowerCase();
    for (const term of terms) {
      const index = lowered.indexOf(term);
      if (index < 0) continue;
      const start = Math.max(0, index - 52);
      const end = Math.min(source.text.length, index + term.length + 110);
      const prefix = start > 0 ? "..." : "";
      const suffix = end < source.text.length ? "..." : "";
      return {
        matchedIn: source.matchedIn,
        snippet: `${prefix}${source.text.slice(start, end).trim()}${suffix}`,
      };
    }
  }

  const fallback = (row.summary ?? row.content ?? "").trim();
  return {
    matchedIn: "semantic",
    snippet: fallback
      ? `${fallback.slice(0, 170)}${fallback.length > 170 ? "..." : ""}`
      : "Semantic similarity match.",
  };
}

export function AppShell({
  notes,
  collections,
  mode = "user",
}: {
  notes: Note[];
  collections: { id: string; name: string }[];
  mode?: WorkspaceMode;
}) {
  const [query, setQuery] = useState("");
  const [remoteResult, setRemoteResult] = useState<{
    query: string;
    data: SearchRow[];
  } | null>(null);
  const [searchCache, setSearchCache] = useState<Record<string, SearchRow[]>>(
    {},
  );
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastTimeoutIds = useRef<Record<number, number>>({});
  const [isPending, startTransition] = useTransition();

  const normalizedQuery = query.trim().toLowerCase();
  const cachedForQuery =
    normalizedQuery.length > 0 ? (searchCache[normalizedQuery] ?? null) : null;

  useEffect(() => {
    const qRaw = query.trim();
    const qKey = qRaw.toLowerCase();
    if (!qRaw || cachedForQuery) return;

    const t = setTimeout(() => {
      startTransition(() => {
        void (async () => {
          try {
            const data = (await semanticSearch(qRaw, mode)) as SearchRow[];
            setSearchCache((prev) => ({ ...prev, [qKey]: data }));
            setRemoteResult({ query: qKey, data });
          } catch {
            window.dispatchEvent(
              new CustomEvent("ko:toast", {
                detail: {
                  message:
                    "Semantic search is temporarily unavailable. Showing local matches.",
                  tone: "error",
                },
              }),
            );
          }
        })();
      });
    }, 260);

    return () => clearTimeout(t);
  }, [cachedForQuery, mode, query, startTransition]);

  const isSearching = query.trim().length > 0;
  const results =
    cachedForQuery ??
    (remoteResult?.query === normalizedQuery ? remoteResult.data : null);

  const notesById = useMemo(() => {
    const next = new Map<string, Note>();
    notes.forEach((note) => next.set(note.id, note));
    return next;
  }, [notes]);

  const resultNotesLike: Note[] = useMemo(() => {
    if (!results) return [];
    return results.map((r) => ({
      ...(notesById.get(r.id) ?? {}),
      id: r.id,
      user_id: notesById.get(r.id)?.user_id ?? "search",
      collection_id: r.collection_id ?? notesById.get(r.id)?.collection_id ?? null,
      title: r.title ?? notesById.get(r.id)?.title ?? null,
      content: r.content ?? notesById.get(r.id)?.content ?? "",
      summary: r.summary ?? notesById.get(r.id)?.summary ?? null,
      created_at: notesById.get(r.id)?.created_at ?? r.updated_at,
      updated_at: r.updated_at,
      note_tags: notesById.get(r.id)?.note_tags ?? [],
    }));
  }, [notesById, results]);

  const locallyFilteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;

    return notes.filter((n) => {
      const hay =
        `${n.title ?? ""} ${n.summary ?? ""} ${n.content ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [notes, query]);

  const showSemantic = isSearching && results !== null;
  const displayNotes = showSemantic ? resultNotesLike : locallyFilteredNotes;
  const semanticExplainByNoteId = useMemo(() => {
    if (!showSemantic || !results) return {};

    const next: Record<string, SemanticExplain> = {};
    for (const row of results) {
      const snippet = buildSemanticSnippet(row, query);
      next[row.id] = {
        similarity: clampSimilarity(Number(row.similarity)),
        snippet: snippet.snippet,
        matchedIn: snippet.matchedIn,
      };
    }
    return next;
  }, [query, results, showSemantic]);

  const dismissToast = useCallback((id: number) => {
    const timeoutId = toastTimeoutIds.current[id];
    if (typeof timeoutId === "number") {
      window.clearTimeout(timeoutId);
      delete toastTimeoutIds.current[id];
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const runToastAction = useCallback(
    (toast: ToastItem) => {
      if (!toast.action) return;
      dismissToast(toast.id);
      try {
        const maybePromise = toast.action.onAction();
        void Promise.resolve(maybePromise).catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Failed to run action.";
          window.dispatchEvent(
            new CustomEvent("ko:toast", {
              detail: { message, tone: "error" as ToastTone },
            }),
          );
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to run action.";
        window.dispatchEvent(
          new CustomEvent("ko:toast", {
            detail: { message, tone: "error" as ToastTone },
          }),
        );
      }
    },
    [dismissToast],
  );

  useEffect(() => {
    function onToast(event: Event) {
      const customEvent = event as CustomEvent<{
        message?: string;
        tone?: ToastTone;
        action?: ToastAction;
      }>;
      const message = customEvent.detail?.message?.trim();
      if (!message) return;

      const id = Date.now() + Math.floor(Math.random() * 1000);
      const tone = customEvent.detail?.tone ?? "info";
      const action = customEvent.detail?.action;
      setToasts((prev) => [...prev, { id, message, tone, action }]);

      const timeoutMs = action
        ? tone === "error"
          ? 10_000
          : 8_000
        : tone === "error"
          ? 5600
          : 2800;
      toastTimeoutIds.current[id] = window.setTimeout(() => {
        dismissToast(id);
      }, timeoutMs);
    }

    window.addEventListener("ko:toast", onToast as EventListener);
    return () => {
      window.removeEventListener("ko:toast", onToast as EventListener);
      Object.values(toastTimeoutIds.current).forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      );
      toastTimeoutIds.current = {};
    };
  }, [dismissToast]);

  return (
    <div className="ko-grid-overlay relative min-h-screen overflow-hidden p-4 sm:p-8">
      <div className="ko-drift pointer-events-none absolute -top-28 -left-20 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
      <div className="ko-drift pointer-events-none absolute top-40 right-[-7rem] h-80 w-80 rounded-full bg-cyan-200/30 blur-3xl" />

      <div className="relative mx-auto w-full max-w-7xl space-y-6">
        <TopBar
          collections={collections}
          query={query}
          setQuery={setQuery}
          isSearching={isSearching}
          isPending={isPending}
          onClear={() => setQuery("")}
          mode={mode}
        />

        <CommandPalette
          collections={collections}
          notes={displayNotes}
          onClearSearch={() => setQuery("")}
          onJumpToNote={(id: unknown) => {
            const el = document.getElementById(`note-${id}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          onCreateNote={() => {
            window.dispatchEvent(new Event("ko:new-note"));
          }}
          onCreateCollection={() => {
            window.dispatchEvent(new Event("ko:new-collection"));
          }}
          onSelectCollection={(id) => {
            setCollectionFilter(id);
            window.dispatchEvent(
              new CustomEvent("ko:toast", {
                detail: {
                  message:
                    id === "all"
                      ? "Showing all collections"
                      : id === "none"
                        ? "Showing uncategorized notes"
                        : "Collection filter applied",
                  tone: "info",
                },
              }),
            );
          }}
        />

        <div className="glass-panel ko-fade-up flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground">
          <span className="ko-token inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium uppercase tracking-[0.14em]">
            <Rows4 className="size-3.5" />
            {displayNotes.length} visible notes
          </span>
          <span className="ko-token inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium uppercase tracking-[0.14em]">
            <Orbit className="size-3.5" />
            {collections.length} collections
          </span>
          <span className="ko-token inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium uppercase tracking-[0.14em]">
            <Radar className="size-3.5" />
            {isSearching ? "query active" : "idle"}
          </span>
        </div>

        {isDemoMode(mode) && (
          <div className="glass-panel ko-fade-up rounded-xl px-4 py-2 text-sm text-muted-foreground">
            Demo mode is shared and rate-limited. Note creation and AI actions are capped.
          </div>
        )}

        {isSearching && (
          <div className="glass-panel ko-fade-up rounded-xl px-4 py-2 text-sm text-muted-foreground">
            {showSemantic
              ? `${results?.length ?? 0} semantic result(s)`
              : isPending
                ? "Searching semantically... (showing instant local matches)"
                : "Showing instant local matches"}
          </div>
        )}

        <NotesGrid
          notes={displayNotes}
          collections={collections}
          collectionFilter={collectionFilter}
          onCollectionFilterChange={setCollectionFilter}
          semanticQuery={showSemantic ? query.trim() : ""}
          semanticExplainByNoteId={semanticExplainByNoteId}
          mode={mode}
        />
      </div>

      <div className="fixed right-4 bottom-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            aria-live={toast.tone === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            className={[
              "ko-fade-up rounded-xl border px-3 py-2 text-sm shadow-lg backdrop-blur",
              toast.tone === "success" &&
                "border-emerald-300 bg-emerald-50 text-emerald-900",
              toast.tone === "error" && "border-rose-300 bg-rose-50 text-rose-900",
              toast.tone === "info" && "glass-panel text-card-foreground",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1">{toast.message}</p>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => runToastAction(toast)}
                  className="ko-press inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-cyan-300/80 bg-cyan-100/70 px-2 text-xs font-medium text-cyan-900 hover:bg-cyan-100"
                  aria-label={toast.action.ariaLabel ?? toast.action.label}
                  title={toast.action.label}
                >
                  {toast.action.label}
                </button>
              )}
              {toast.tone === "error" && !toast.action && (
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="ko-press inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-rose-300/80 bg-white/70 text-rose-700 hover:bg-white"
                  aria-label="Dismiss error notification"
                  title="Dismiss"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
