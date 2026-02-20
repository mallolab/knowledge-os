"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteNote,
  enrichNote,
  restoreDeletedNote,
  undoEnrichNote,
  updateNoteCollection,
} from "../actions";
import type { Note } from "@/lib/types";
import type { WorkspaceMode } from "@/lib/app-mode";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarDays,
  Check,
  FolderTree,
  LayoutGrid,
  List,
  MoreHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NotePendingAction = "delete" | "enrich" | "move";

type ToastAction = {
  label: string;
  ariaLabel?: string;
  onAction: () => void | Promise<void>;
};

type SemanticExplain = {
  similarity: number;
  snippet: string;
  matchedIn: "title" | "summary" | "content" | "semantic";
};

type DeletedNoteSnapshot = {
  id: string;
  title: string | null;
  content: string;
  summary: string | null;
  collectionId: string | null;
  tagNames: string[];
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedSnippet(snippet: string, query: string) {
  const terms = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length > 1),
    ),
  );
  if (!terms.length) return snippet;

  const matcher = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "ig");
  return snippet.split(matcher).map((part, idx) => {
    if (terms.includes(part.toLowerCase())) {
      return (
        <mark
          key={`${part}-${idx}`}
          className="rounded bg-cyan-200/70 px-0.5 text-cyan-950"
        >
          {part}
        </mark>
      );
    }
    return <span key={`${part}-${idx}`}>{part}</span>;
  });
}

function semanticSourceLabel(source: SemanticExplain["matchedIn"]) {
  if (source === "title") return "Title match";
  if (source === "summary") return "Summary match";
  if (source === "content") return "Content match";
  return "Semantic context";
}

function noteAccentClass(noteId: string) {
  const sum = Array.from(noteId).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const pick = sum % 4;
  if (pick === 0) return "from-emerald-400/80 to-cyan-400/70";
  if (pick === 1) return "from-amber-400/80 to-rose-400/70";
  if (pick === 2) return "from-cyan-400/80 to-indigo-400/70";
  return "from-lime-400/80 to-teal-400/70";
}

export function NotesGrid({
  notes,
  collections,
  collectionFilter,
  onCollectionFilterChange,
  semanticExplainByNoteId,
  semanticQuery,
  mode = "user",
}: {
  notes: Note[];
  collections: { id: string; name: string }[];
  collectionFilter: string;
  onCollectionFilterChange: (value: string) => void;
  semanticExplainByNoteId?: Record<string, SemanticExplain>;
  semanticQuery?: string;
  mode?: WorkspaceMode;
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [viewTransitionKey, setViewTransitionKey] = useState(0);
  const [pendingByNote, setPendingByNote] = useState<
    Record<string, NotePendingAction | undefined>
  >({});

  const collectionNameById = useMemo(() => {
    const map = new Map<string, string>();
    collections.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [collections]);

  const filtered = useMemo(() => {
    if (collectionFilter === "all") return notes;
    if (collectionFilter === "none") return notes.filter((n) => !n.collection_id);
    return notes.filter((n) => n.collection_id === collectionFilter);
  }, [notes, collectionFilter]);

  function emitToast(
    message: string,
    tone: "success" | "error" | "info",
    action?: ToastAction,
  ) {
    window.dispatchEvent(
      new CustomEvent("ko:toast", {
        detail: { message, tone, action },
      }),
    );
  }

  function extractTagNames(note: Note) {
    return (note.note_tags ?? [])
      .map((noteTag) => noteTag.tags?.name?.trim().toLowerCase())
      .filter((tag): tag is string => Boolean(tag));
  }

  function pendingActionFor(noteId: string) {
    return pendingByNote[noteId] ?? null;
  }

  function isNotePending(noteId: string) {
    return Boolean(pendingActionFor(noteId));
  }

  function setNotePending(noteId: string, action: NotePendingAction | null) {
    setPendingByNote((prev) => {
      const next = { ...prev };
      if (action) next[noteId] = action;
      else delete next[noteId];
      return next;
    });
  }

  async function onUndoDelete(snapshot: DeletedNoteSnapshot) {
    try {
      await restoreDeletedNote(snapshot, mode);
      emitToast("Delete undone.", "success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to undo delete.";
      emitToast(message, "error");
    }
    router.refresh();
  }

  async function onUndoMoveToCollection(
    noteId: string,
    previousCollectionId: string | null,
    previousCollectionName: string,
  ) {
    try {
      await updateNoteCollection({
        noteId,
        collectionId: previousCollectionId,
      }, mode);
      emitToast(`Move undone. Back to ${previousCollectionName}.`, "success");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to undo collection move.";
      emitToast(message, "error");
    }
    router.refresh();
  }

  async function onUndoEnrich(note: {
    noteId: string;
    previousTitle: string | null;
    previousSummary: string | null;
    previousTagNames: string[];
  }) {
    try {
      await undoEnrichNote(note, mode);
      emitToast("Enrich undone.", "success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to undo enrich.";
      emitToast(message, "error");
    }
    router.refresh();
  }

  async function onEnrich(note: Note) {
    if (isNotePending(note.id)) return;

    setNotePending(note.id, "enrich");
    try {
      await enrichNote(note.id, mode);
      emitToast("Note enriched with summary, tags, and embedding.", "success", {
        label: "Undo",
        ariaLabel: "Undo enrich",
        onAction: () =>
          onUndoEnrich({
            noteId: note.id,
            previousTitle: note.title,
            previousSummary: note.summary,
            previousTagNames: extractTagNames(note),
          }),
      });
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to enrich note.";
      emitToast(message, "error");
    } finally {
      setNotePending(note.id, null);
    }
  }

  async function onDelete(note: Note) {
    if (isNotePending(note.id)) return;
    if (!window.confirm("Delete this note? This action cannot be undone.")) return;

    setNotePending(note.id, "delete");
    try {
      await deleteNote(note.id, mode);
      emitToast("Note deleted.", "success", {
        label: "Undo",
        ariaLabel: "Undo delete",
        onAction: () =>
          onUndoDelete({
            id: note.id,
            title: note.title,
            content: note.content,
            summary: note.summary,
            collectionId: note.collection_id ?? null,
            tagNames: extractTagNames(note),
          }),
      });
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete note.";
      emitToast(message, "error");
    } finally {
      setNotePending(note.id, null);
    }
  }

  function switchViewMode(nextMode: "grid" | "list") {
    if (nextMode === viewMode) return;
    setViewMode(nextMode);
    setViewTransitionKey((k) => k + 1);
  }

  async function onMoveToCollection(
    note: Note,
    nextCollectionId: string | null,
    nextCollectionName: string,
  ) {
    if (isNotePending(note.id)) return;
    if ((note.collection_id ?? null) === nextCollectionId) {
      emitToast("This note is already in that collection.", "info");
      return;
    }

    setNotePending(note.id, "move");
    try {
      const previousCollectionId = note.collection_id ?? null;
      const previousCollectionName = previousCollectionId
        ? (collectionNameById.get(previousCollectionId) ?? "Collection")
        : "No collection";
      await updateNoteCollection({
        noteId: note.id,
        collectionId: nextCollectionId,
      }, mode);
      emitToast(`Moved to ${nextCollectionName}.`, "success", {
        label: "Undo",
        ariaLabel: "Undo move to collection",
        onAction: () =>
          onUndoMoveToCollection(
            note.id,
            previousCollectionId,
            previousCollectionName,
          ),
      });
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to move note to collection.";
      emitToast(message, "error");
    } finally {
      setNotePending(note.id, null);
    }
  }

  function renderCollectionItems(note: Note) {
    return (
      <>
        <DropdownMenuItem
          onSelect={() => onMoveToCollection(note, null, "No collection")}
          disabled={isNotePending(note.id)}
        >
          {(note.collection_id ?? null) === null ? (
            <Check className="size-4" />
          ) : (
            <span className="size-4" />
          )}
          No collection
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {collections.map((collection) => (
          <DropdownMenuItem
            key={collection.id}
            onSelect={() =>
              onMoveToCollection(note, collection.id, collection.name)
            }
            disabled={isNotePending(note.id)}
          >
            {(note.collection_id ?? null) === collection.id ? (
              <Check className="size-4" />
            ) : (
              <span className="size-4" />
            )}
            {collection.name}
          </DropdownMenuItem>
        ))}
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="glass-panel ko-fade-up flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={collectionFilter === "all" ? "default" : "outline"}
            onClick={() => onCollectionFilterChange("all")}
            size="sm"
          >
            All
          </Button>
          <Button
            variant={collectionFilter === "none" ? "default" : "outline"}
            onClick={() => onCollectionFilterChange("none")}
            size="sm"
          >
            No collection
          </Button>
          {collections.map((c) => (
            <Button
              key={c.id}
              variant={collectionFilter === c.id ? "default" : "outline"}
              onClick={() => onCollectionFilterChange(c.id)}
              size="sm"
            >
              {c.name}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">{filtered.length} notes</p>
          <Button
            size="icon-sm"
            variant={viewMode === "grid" ? "default" : "outline"}
            onClick={() => switchViewMode("grid")}
            title="Grid view"
            className="ko-press"
            aria-label="Switch to grid view"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant={viewMode === "list" ? "default" : "outline"}
            onClick={() => switchViewMode("list")}
            title="List view"
            className="ko-press"
            aria-label="Switch to list view"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-panel ko-fade-up rounded-2xl p-8 text-center">
          <p className="text-lg font-medium">Nothing here yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Start with a note, then enrich it to auto-generate summary and tags.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => window.dispatchEvent(new Event("ko:new-note"))}>
              Create note
            </Button>
            <Button
              variant="outline"
              onClick={() => window.dispatchEvent(new Event("ko:new-collection"))}
            >
              Create collection
            </Button>
          </div>
        </div>
      ) : (
        <div
          key={viewTransitionKey}
          className={[
            "ko-stagger",
            "ko-view-switch",
            viewMode === "grid"
              ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              : "grid gap-3",
          ].join(" ")}
        >
          {filtered.map((note) => {
            const pendingAction = pendingActionFor(note.id);
            const currentCollectionName = note.collection_id
              ? collectionNameById.get(note.collection_id)
              : "No collection";
            const semanticExplain = semanticExplainByNoteId?.[note.id];
            const semanticScorePercent = semanticExplain
              ? Math.round(
                  Math.min(1, Math.max(0, semanticExplain.similarity)) * 100,
                )
              : null;

            return (
              <Card
                id={`note-${note.id}`}
                key={note.id}
                className={cn(
                  "glass-panel ko-interactive relative overflow-hidden border-border/70 bg-card/88",
                  viewMode === "list" && "sm:flex sm:items-start sm:gap-4",
                )}
              >
                <div
                  className={[
                    "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
                    noteAccentClass(note.id),
                  ].join(" ")}
                />

                {pendingAction === "enrich" && (
                  <div className="absolute inset-x-0 top-1 z-10 px-3">
                    <div
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                      className="rounded-md border border-emerald-300/70 bg-emerald-50/95 px-2.5 py-2 text-xs text-emerald-900 shadow-sm backdrop-blur-sm"
                    >
                      <div className="inline-flex items-center gap-1.5 font-medium">
                        <Sparkles className="size-3.5 motion-safe:animate-spin" />
                        Enriching note with summary, tags, and embedding...
                      </div>
                    </div>
                  </div>
                )}

                <CardHeader className={viewMode === "list" ? "sm:w-80" : "space-y-2"}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">
                        {note.title?.trim() ? note.title : "Untitled"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="ko-press inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                              aria-label={`Change collection for ${
                                note.title?.trim() || "Untitled"
                              }`}
                            >
                              <FolderTree className="size-3.5" />
                              {currentCollectionName ?? "No collection"}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {renderCollectionItems(note)}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                        Updated {new Date(note.updated_at).toLocaleDateString()}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Open actions"
                          className="ko-press"
                          aria-label={`Open actions for ${
                            note.title?.trim() || "Untitled"
                          }`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => onEnrich(note)}
                          disabled={isNotePending(note.id)}
                        >
                          <Sparkles className="size-4" />
                          {pendingAction === "enrich" ? "Enriching..." : "Enrich"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => onDelete(note)}
                          disabled={isNotePending(note.id)}
                          variant="destructive"
                        >
                          <Trash2 className="size-4" />
                          {pendingAction === "delete" ? "Deleting..." : "Delete"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger disabled={isNotePending(note.id)}>
                            <FolderTree className="size-4" />
                            {pendingAction === "move"
                              ? "Updating collection..."
                              : "Move to collection"}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {renderCollectionItems(note)}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {note.summary && (
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {note.summary}
                    </p>
                  )}

                  {semanticExplain && (
                    <div className="mt-2 rounded-lg border border-cyan-300/60 bg-cyan-50/80 px-2.5 py-2 text-xs text-cyan-900/90">
                      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-800/90">
                        <span>{semanticSourceLabel(semanticExplain.matchedIn)}</span>
                        <span>{semanticScorePercent}% score</span>
                      </div>
                      <p className="mt-1.5 leading-relaxed">
                        {renderHighlightedSnippet(
                          semanticExplain.snippet,
                          semanticQuery ?? "",
                        )}
                      </p>
                    </div>
                  )}
                </CardHeader>

                <CardContent>
                  <p
                    className={[
                      "whitespace-pre-wrap text-sm",
                      viewMode === "grid" ? "line-clamp-4" : "line-clamp-2",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {note.content}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(note.note_tags ?? [])
                      .map((nt) => nt.tags)
                      .filter((t): t is { id: string; name: string } =>
                        Boolean(t?.id && t?.name),
                      )
                      .map((t) => (
                        <Badge key={t.id} variant="secondary">
                          {t.name}
                        </Badge>
                      ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
