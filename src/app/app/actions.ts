"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/server-admin";
import { embedText, summarizeAndTag } from "@/lib/openai";
import { assertBudget, assertNotDuplicate } from "@/lib/guardrails";
import { isDemoMode, type WorkspaceMode } from "@/lib/app-mode";

const semanticCache = new Map<string, { expiresAt: number; data: unknown[] }>();
const DEFAULT_DEMO_MAX_NOTES = 24;
const LOCAL_DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

type DemoCollection = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

type DemoTag = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

type DemoNote = {
  id: string;
  user_id: string;
  collection_id: string | null;
  title: string | null;
  content: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
  embedding: number[] | null;
};

type DemoNoteTag = {
  note_id: string;
  tag_id: string;
};

type DemoStore = {
  collections: DemoCollection[];
  notes: DemoNote[];
  tags: DemoTag[];
  noteTags: DemoNoteTag[];
};

let localDemoStore: DemoStore | null = null;

const ENRICH_BUDGET = {
  user: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 24,
    maxCharsPerRequest: 20_000,
    maxCharsPerWindow: 180_000,
  },
  demo: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 8,
    maxCharsPerRequest: 8_000,
    maxCharsPerWindow: 48_000,
  },
} as const;

const SEMANTIC_BUDGET = {
  user: {
    windowMs: 10 * 60 * 1000,
    maxRequests: 40,
    maxCharsPerRequest: 500,
    maxCharsPerWindow: 12_000,
  },
  demo: {
    windowMs: 10 * 60 * 1000,
    maxRequests: 12,
    maxCharsPerRequest: 500,
    maxCharsPerWindow: 4_000,
  },
} as const;

type DbClient =
  | Awaited<ReturnType<typeof createClient>>
  | ReturnType<typeof supabaseAdmin>;

type ActionContext = {
  mode: WorkspaceMode;
  userId: string;
  db: DbClient;
};

function getSemanticCacheKey(userId: string, query: string) {
  return `${userId}:${query.trim().toLowerCase()}`;
}

function readSemanticCache(userId: string, query: string) {
  const key = getSemanticCacheKey(userId, query);
  const cached = semanticCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    semanticCache.delete(key);
    return null;
  }
  return cached.data;
}

function writeSemanticCache(userId: string, query: string, data: unknown[]) {
  const key = getSemanticCacheKey(userId, query);
  semanticCache.set(key, {
    expiresAt: Date.now() + 60_000,
    data,
  });
}

function normalizeTags(input: string) {
  return input
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getDemoMaxNotes() {
  return parsePositiveInt(process.env.DEMO_MAX_NOTES, DEFAULT_DEMO_MAX_NOTES);
}

function isLocalDemoMode(mode: WorkspaceMode) {
  return isDemoMode(mode) && !process.env.DEMO_USER_ID?.trim();
}

function getDemoUserId() {
  return process.env.DEMO_USER_ID?.trim() || LOCAL_DEMO_USER_ID;
}

function getNowIso() {
  return new Date().toISOString();
}

function uniqueNormalizedTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
}

function upsertTagInStore(store: DemoStore, userId: string, name: string) {
  const existing = store.tags.find((tag) => tag.user_id === userId && tag.name === name);
  if (existing) return existing;

  const tag: DemoTag = {
    id: crypto.randomUUID(),
    user_id: userId,
    name,
    created_at: getNowIso(),
  };
  store.tags.push(tag);
  return tag;
}

function replaceTagsInStore(params: {
  store: DemoStore;
  userId: string;
  noteId: string;
  tags: string[];
}) {
  const { store, userId, noteId, tags } = params;
  store.noteTags = store.noteTags.filter((join) => join.note_id !== noteId);

  const names = uniqueNormalizedTags(tags);
  for (const name of names) {
    const tag = upsertTagInStore(store, userId, name);
    store.noteTags.push({ note_id: noteId, tag_id: tag.id });
  }
}

function upsertTagsInStore(params: {
  store: DemoStore;
  userId: string;
  noteId: string;
  tags: string[];
}) {
  const { store, userId, noteId, tags } = params;
  const names = uniqueNormalizedTags(tags);

  for (const name of names) {
    const tag = upsertTagInStore(store, userId, name);
    const exists = store.noteTags.some(
      (join) => join.note_id === noteId && join.tag_id === tag.id,
    );
    if (!exists) {
      store.noteTags.push({ note_id: noteId, tag_id: tag.id });
    }
  }
}

function createSeedDemoStore(userId: string): DemoStore {
  const now = getNowIso();
  const collectionIdeas: DemoCollection = {
    id: crypto.randomUUID(),
    user_id: userId,
    name: "Ideas",
    created_at: now,
  };
  const collectionResearch: DemoCollection = {
    id: crypto.randomUUID(),
    user_id: userId,
    name: "Research",
    created_at: now,
  };

  const notes: DemoNote[] = [
    {
      id: crypto.randomUUID(),
      user_id: userId,
      collection_id: collectionIdeas.id,
      title: "Landing page refresh",
      content:
        "Test cleaner hierarchy for primary CTA. Keep the headline editorial but reduce line length on small screens.",
      summary:
        "Plan a tighter visual hierarchy and improve mobile readability without losing the crafted brand tone.",
      created_at: now,
      updated_at: now,
      embedding: null,
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      collection_id: collectionResearch.id,
      title: "AI enrichment guardrails",
      content:
        "For demo usage, keep strict per-window limits and short inputs to control token cost. Add clear error copy when limits are reached.",
      summary:
        "Demo mode should stay useful while tightly controlling API usage and communicating limits clearly.",
      created_at: now,
      updated_at: now,
      embedding: null,
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      collection_id: null,
      title: "Onboarding checklist",
      content:
        "Allow users to create, edit, search, enrich, and delete notes in under five minutes. Demo should not require account setup.",
      summary:
        "The demo should showcase the full note workflow quickly and without authentication friction.",
      created_at: now,
      updated_at: now,
      embedding: null,
    },
  ];

  const store: DemoStore = {
    collections: [collectionIdeas, collectionResearch],
    notes,
    tags: [],
    noteTags: [],
  };

  replaceTagsInStore({
    store,
    userId,
    noteId: notes[0].id,
    tags: ["ux", "landing", "mobile"],
  });
  replaceTagsInStore({
    store,
    userId,
    noteId: notes[1].id,
    tags: ["openai", "guardrails", "cost"],
  });
  replaceTagsInStore({
    store,
    userId,
    noteId: notes[2].id,
    tags: ["onboarding", "product"],
  });

  return store;
}

function getLocalDemoStore() {
  if (!localDemoStore) {
    localDemoStore = createSeedDemoStore(LOCAL_DEMO_USER_ID);
  }
  return localDemoStore;
}

function getLocalNotesWithTags(store: DemoStore) {
  const tagsById = new Map(store.tags.map((tag) => [tag.id, tag]));

  return [...store.notes]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .map((note) => ({
      ...note,
      note_tags: store.noteTags
        .filter((join) => join.note_id === note.id)
        .map((join) => {
          const tag = tagsById.get(join.tag_id);
          return {
            tags: tag
              ? {
                  id: tag.id,
                  name: tag.name,
                }
              : null,
          };
        }),
    }));
}

function requireLocalCollection(store: DemoStore, userId: string, collectionId: string) {
  const exists = store.collections.some(
    (collection) => collection.id === collectionId && collection.user_id === userId,
  );
  if (!exists) throw new Error("Collection not found.");
}

function requireLocalNote(store: DemoStore, userId: string, noteId: string) {
  const note = store.notes.find((candidate) => candidate.id === noteId);
  if (!note || note.user_id !== userId) throw new Error("Note not found.");
  return note;
}

function assertDemoCapacity(currentCount: number, reason: "create" | "restore") {
  const maxNotes = getDemoMaxNotes();
  if (currentCount < maxNotes) return;

  if (reason === "restore") {
    throw new Error(
      `Demo note limit reached (${maxNotes} max). Delete a note before restoring another one.`,
    );
  }

  throw new Error(
    `Demo note limit reached (${maxNotes} max). Delete a note before creating a new one.`,
  );
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "you",
  "have",
  "will",
  "are",
  "was",
  "were",
  "not",
  "but",
  "can",
  "use",
  "mode",
  "demo",
  "note",
  "notes",
  "about",
  "then",
  "when",
  "where",
  "what",
]);

function localDerivedTitle(content: string, previousTitle: string | null) {
  const candidate =
    content
      .split(/\n|\.|\?|!/)[0]
      ?.trim()
      .slice(0, 60) || "";
  if (candidate) return candidate;
  return previousTitle?.trim() || null;
}

function localSummary(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  return `${compact.slice(0, 220)}${compact.length > 220 ? "..." : ""}`;
}

function localTagsFromContent(content: string) {
  const terms =
    content.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g)?.filter((word) => !STOP_WORDS.has(word)) ??
    [];

  const counts = new Map<string, number>();
  for (const term of terms) {
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
}

function localSemanticRows(store: DemoStore, query: string) {
  const terms = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length > 1),
    ),
  );

  if (!terms.length) return [];

  const scored = store.notes
    .map((note) => {
      const title = String(note.title ?? "").toLowerCase();
      const summary = String(note.summary ?? "").toLowerCase();
      const content = note.content.toLowerCase();

      let score = 0;
      let matchedTerms = 0;

      for (const term of terms) {
        let termScore = 0;
        if (title.includes(term)) termScore = Math.max(termScore, 3);
        if (summary.includes(term)) termScore = Math.max(termScore, 2);
        if (content.includes(term)) termScore = Math.max(termScore, 1);
        if (termScore > 0) {
          matchedTerms += 1;
          score += termScore;
        }
      }

      if (!score) return null;

      const similarity = Math.min(0.98, (score + matchedTerms) / (terms.length * 4));
      return {
        id: note.id,
        title: note.title,
        content: note.content,
        summary: note.summary,
        collection_id: note.collection_id,
        updated_at: note.updated_at,
        similarity,
        sortScore: score,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return scored
    .sort((a, b) => {
      if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    })
    .slice(0, 12)
    .map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      summary: row.summary,
      collection_id: row.collection_id,
      updated_at: row.updated_at,
      similarity: row.similarity,
    }));
}

async function getActionContext(mode: WorkspaceMode = "user"): Promise<ActionContext> {
  if (isLocalDemoMode(mode)) {
    throw new Error("Local demo mode should not request database context.");
  }

  if (isDemoMode(mode)) {
    return {
      mode,
      userId: getDemoUserId(),
      db: supabaseAdmin(),
    };
  }

  const db = await createClient();
  const { data: auth } = await db.auth.getClaims();
  if (!auth?.claims) throw new Error("Not authenticated");

  return {
    mode,
    userId: auth.claims.sub,
    db,
  };
}

function revalidateWorkspace(mode: WorkspaceMode) {
  revalidatePath(isDemoMode(mode) ? "/app/demo" : "/app");
}

export async function getAppData(mode: WorkspaceMode = "user") {
  if (isLocalDemoMode(mode)) {
    const store = getLocalDemoStore();
    return {
      userId: LOCAL_DEMO_USER_ID,
      collections: [...store.collections].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
      notes: getLocalNotesWithTags(store),
    };
  }

  const context = await getActionContext(mode);

  const [
    { data: collections, error: collectionsError },
    { data: notes, error: notesError },
  ] = await Promise.all([
    context.db
      .from("collections")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true }),

    context.db
      .from("notes")
      .select(
        `
        *,
        note_tags (
        tags ( id, name )
        )
    `,
      )
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false }),
  ]);

  if (collectionsError) throw collectionsError;
  if (notesError) throw notesError;

  return {
    userId: context.userId,
    collections: collections ?? [],
    notes: notes ?? [],
  };
}

export async function createCollection(
  name: string,
  mode: WorkspaceMode = "user",
) {
  const trimmed = name.trim();
  if (!trimmed) return;

  if (isLocalDemoMode(mode)) {
    const store = getLocalDemoStore();
    store.collections.push({
      id: crypto.randomUUID(),
      user_id: LOCAL_DEMO_USER_ID,
      name: trimmed,
      created_at: getNowIso(),
    });
    revalidateWorkspace(mode);
    return;
  }

  const context = await getActionContext(mode);

  const { error } = await context.db.from("collections").insert({
    user_id: context.userId,
    name: trimmed,
  });

  if (error) throw error;
  revalidateWorkspace(mode);
}

export async function createNote(
  params: {
    title?: string;
    content: string;
    collectionId?: string | null;
    tagsCsv?: string;
  },
  mode: WorkspaceMode = "user",
) {
  const content = params.content.trim();
  if (!content) throw new Error("Content is required");

  if (isLocalDemoMode(mode)) {
    const store = getLocalDemoStore();
    assertDemoCapacity(store.notes.length, "create");

    if (params.collectionId) {
      requireLocalCollection(store, LOCAL_DEMO_USER_ID, params.collectionId);
    }

    const now = getNowIso();
    const note: DemoNote = {
      id: crypto.randomUUID(),
      user_id: LOCAL_DEMO_USER_ID,
      title: params.title?.trim() || null,
      content,
      summary: null,
      collection_id: params.collectionId ?? null,
      created_at: now,
      updated_at: now,
      embedding: null,
    };

    store.notes.push(note);
    const tags = normalizeTags(params.tagsCsv ?? "");
    if (tags.length) {
      upsertTagsInStore({
        store,
        userId: LOCAL_DEMO_USER_ID,
        noteId: note.id,
        tags,
      });
    }

    revalidateWorkspace(mode);
    return;
  }

  const context = await getActionContext(mode);

  if (isDemoMode(mode)) {
    const { count, error: countError } = await context.db
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);

    if (countError) throw countError;
    assertDemoCapacity(count ?? 0, "create");
  }

  if (params.collectionId) {
    const { error: collectionError } = await context.db
      .from("collections")
      .select("id")
      .eq("id", params.collectionId)
      .eq("user_id", context.userId)
      .single();

    if (collectionError) throw new Error("Collection not found.");
  }

  const { data: note, error } = await context.db
    .from("notes")
    .insert({
      user_id: context.userId,
      title: params.title?.trim() || null,
      content,
      collection_id: params.collectionId ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;

  const tags = normalizeTags(params.tagsCsv ?? "");
  if (tags.length) {
    await upsertTagsForNote({ userId: context.userId, noteId: note.id, tags });
  }

  revalidateWorkspace(mode);
}

async function upsertTagsForNote(params: {
  userId: string;
  noteId: string;
  tags: string[];
}) {
  const admin = supabaseAdmin();

  const { data: insertedTags, error: tagsError } = await admin
    .from("tags")
    .upsert(
      params.tags.map((name) => ({ user_id: params.userId, name })),
      {
        onConflict: "user_id,name",
      },
    )
    .select("id,name");

  if (tagsError) throw tagsError;

  const tagIds: string[] = (insertedTags ?? []).map((t) => String(t.id));

  const { error: joinError } = await admin.from("note_tags").upsert(
    tagIds.map((tag_id) => ({ note_id: params.noteId, tag_id })),
    { onConflict: "note_id,tag_id" },
  );

  if (joinError) throw joinError;
}

async function replaceTagsForNote(params: {
  userId: string;
  noteId: string;
  tags: string[];
}) {
  const admin = supabaseAdmin();

  const { error: clearError } = await admin
    .from("note_tags")
    .delete()
    .eq("note_id", params.noteId);

  if (clearError) throw clearError;

  const uniqueTags = Array.from(new Set(params.tags.map((tag) => tag.trim())));
  if (!uniqueTags.length) return;

  const { data: insertedTags, error: tagsError } = await admin
    .from("tags")
    .upsert(
      uniqueTags.map((name) => ({ user_id: params.userId, name })),
      {
        onConflict: "user_id,name",
      },
    )
    .select("id,name");

  if (tagsError) throw tagsError;

  const tagIds = (insertedTags ?? []).map((t) => t.id);
  const { error: joinError } = await admin.from("note_tags").upsert(
    tagIds.map((tag_id) => ({ note_id: params.noteId, tag_id })),
    { onConflict: "note_id,tag_id" },
  );

  if (joinError) throw joinError;
}

export async function deleteNote(noteId: string, mode: WorkspaceMode = "user") {
  if (isLocalDemoMode(mode)) {
    const store = getLocalDemoStore();
    const idx = store.notes.findIndex(
      (note) => note.id === noteId && note.user_id === LOCAL_DEMO_USER_ID,
    );
    if (idx < 0) throw new Error("Note not found.");

    store.notes.splice(idx, 1);
    store.noteTags = store.noteTags.filter((join) => join.note_id !== noteId);
    revalidateWorkspace(mode);
    return;
  }

  const context = await getActionContext(mode);

  const { error } = await context.db
    .from("notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", context.userId);

  if (error) throw error;
  revalidateWorkspace(mode);
}

export async function restoreDeletedNote(
  params: {
    id: string;
    title: string | null;
    content: string;
    summary: string | null;
    collectionId: string | null;
    tagNames?: string[];
  },
  mode: WorkspaceMode = "user",
) {
  const content = params.content.trim();
  if (!content) throw new Error("Cannot restore an empty note.");

  if (isLocalDemoMode(mode)) {
    const store = getLocalDemoStore();
    assertDemoCapacity(store.notes.length, "restore");

    if (params.collectionId) {
      requireLocalCollection(store, LOCAL_DEMO_USER_ID, params.collectionId);
    }

    const now = getNowIso();
    store.notes.push({
      id: params.id,
      user_id: LOCAL_DEMO_USER_ID,
      title: params.title?.trim() || null,
      content,
      summary: params.summary?.trim() || null,
      collection_id: params.collectionId ?? null,
      created_at: now,
      updated_at: now,
      embedding: null,
    });

    replaceTagsInStore({
      store,
      userId: LOCAL_DEMO_USER_ID,
      noteId: params.id,
      tags: normalizeTags((params.tagNames ?? []).join(",")),
    });

    revalidateWorkspace(mode);
    return;
  }

  const context = await getActionContext(mode);

  if (params.collectionId) {
    const { error: collectionError } = await context.db
      .from("collections")
      .select("id")
      .eq("id", params.collectionId)
      .eq("user_id", context.userId)
      .single();
    if (collectionError) throw new Error("Collection not found.");
  }

  if (isDemoMode(mode)) {
    const { count, error: countError } = await context.db
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);

    if (countError) throw countError;
    assertDemoCapacity(count ?? 0, "restore");
  }

  const { error: insertError } = await context.db.from("notes").insert({
    id: params.id,
    user_id: context.userId,
    title: params.title?.trim() || null,
    content,
    summary: params.summary?.trim() || null,
    collection_id: params.collectionId ?? null,
  });

  if (insertError) throw insertError;

  const tagNames = normalizeTags((params.tagNames ?? []).join(","));
  await replaceTagsForNote({
    userId: context.userId,
    noteId: params.id,
    tags: tagNames,
  });

  revalidateWorkspace(mode);
}

export async function updateNoteCollection(
  params: {
    noteId: string;
    collectionId: string | null;
  },
  mode: WorkspaceMode = "user",
) {
  if (isLocalDemoMode(mode)) {
    const store = getLocalDemoStore();
    const note = requireLocalNote(store, LOCAL_DEMO_USER_ID, params.noteId);

    if (params.collectionId) {
      requireLocalCollection(store, LOCAL_DEMO_USER_ID, params.collectionId);
    }

    note.collection_id = params.collectionId;
    note.updated_at = getNowIso();
    revalidateWorkspace(mode);
    return;
  }

  const context = await getActionContext(mode);

  if (params.collectionId) {
    const { error: collectionError } = await context.db
      .from("collections")
      .select("id")
      .eq("id", params.collectionId)
      .eq("user_id", context.userId)
      .single();

    if (collectionError) throw new Error("Collection not found.");
  }

  const { error } = await context.db
    .from("notes")
    .update({ collection_id: params.collectionId })
    .eq("id", params.noteId)
    .eq("user_id", context.userId);

  if (error) throw error;
  revalidateWorkspace(mode);
}

export async function enrichNote(noteId: string, mode: WorkspaceMode = "user") {
  if (isLocalDemoMode(mode)) {
    const store = getLocalDemoStore();
    const note = requireLocalNote(store, LOCAL_DEMO_USER_ID, noteId);

    const content = String(note.content ?? "").trim();
    if (!content) throw new Error("Note content is empty");

    assertBudget({
      userId: LOCAL_DEMO_USER_ID,
      action: "enrichNote",
      charCost: content.length,
      config: ENRICH_BUDGET.demo,
    });

    assertNotDuplicate({
      userId: LOCAL_DEMO_USER_ID,
      action: "enrichNote",
      fingerprint: noteId,
      dedupeMs: 45_000,
    });

    note.title = localDerivedTitle(content, note.title);
    note.summary = localSummary(content);
    note.embedding = null;
    note.updated_at = getNowIso();

    const tags = localTagsFromContent(content);
    if (tags.length) {
      replaceTagsInStore({
        store,
        userId: LOCAL_DEMO_USER_ID,
        noteId,
        tags,
      });
    }

    revalidateWorkspace(mode);
    return;
  }

  const context = await getActionContext(mode);

  const { data: note, error: noteErr } = await context.db
    .from("notes")
    .select("id, title, content")
    .eq("id", noteId)
    .eq("user_id", context.userId)
    .single();

  if (noteErr) throw noteErr;

  const content = String(note.content ?? "").trim();
  if (!content) throw new Error("Note content is empty");

  assertBudget({
    userId: context.userId,
    action: "enrichNote",
    charCost: content.length,
    config: isDemoMode(mode) ? ENRICH_BUDGET.demo : ENRICH_BUDGET.user,
  });

  assertNotDuplicate({
    userId: context.userId,
    action: "enrichNote",
    fingerprint: noteId,
    dedupeMs: 45_000,
  });

  const enriched = await summarizeAndTag(content);

  const derivedTitle = content
    .split(/\n|\.|\?|!/)[0]
    ?.trim()
    .slice(0, 60);

  const nextTitle =
    enriched.title && enriched.title.trim()
      ? enriched.title.trim().slice(0, 60)
      : String(note.title ?? "").trim() || derivedTitle || null;

  const embedding = await embedText(
    `${nextTitle ?? ""}\n\n${enriched.summary ?? ""}\n\n${content}`.slice(0, 8000),
  );

  const { error: upErr } = await context.db
    .from("notes")
    .update({
      title: nextTitle,
      summary: enriched.summary || null,
      embedding,
    })
    .eq("id", noteId)
    .eq("user_id", context.userId);

  if (upErr) throw upErr;

  if (enriched.tags.length) {
    const admin = supabaseAdmin();

    const { data: insertedTags, error: tagsError } = await admin
      .from("tags")
      .upsert(
        enriched.tags.map((name: unknown) => ({ user_id: context.userId, name })),
        { onConflict: "user_id,name" },
      )
      .select("id,name");

    if (tagsError) throw tagsError;

    const tagIds = (insertedTags ?? []).map((t) => t.id);
    const { error: joinError } = await admin.from("note_tags").upsert(
      tagIds.map((tag_id) => ({ note_id: noteId, tag_id })),
      { onConflict: "note_id,tag_id" },
    );

    if (joinError) throw joinError;
  }

  revalidateWorkspace(mode);
}

export async function undoEnrichNote(
  params: {
    noteId: string;
    previousTitle: string | null;
    previousSummary: string | null;
    previousTagNames?: string[];
  },
  mode: WorkspaceMode = "user",
) {
  if (isLocalDemoMode(mode)) {
    const store = getLocalDemoStore();
    const note = requireLocalNote(store, LOCAL_DEMO_USER_ID, params.noteId);

    note.title = params.previousTitle?.trim() || null;
    note.summary = params.previousSummary?.trim() || null;
    note.embedding = null;
    note.updated_at = getNowIso();

    replaceTagsInStore({
      store,
      userId: LOCAL_DEMO_USER_ID,
      noteId: params.noteId,
      tags: normalizeTags((params.previousTagNames ?? []).join(",")),
    });

    revalidateWorkspace(mode);
    return;
  }

  const context = await getActionContext(mode);

  const { error: noteError } = await context.db
    .from("notes")
    .select("id")
    .eq("id", params.noteId)
    .eq("user_id", context.userId)
    .single();
  if (noteError) throw new Error("Note not found.");

  const { error: updateError } = await context.db
    .from("notes")
    .update({
      title: params.previousTitle?.trim() || null,
      summary: params.previousSummary?.trim() || null,
      embedding: null,
    })
    .eq("id", params.noteId)
    .eq("user_id", context.userId);

  if (updateError) throw updateError;

  const previousTags = normalizeTags((params.previousTagNames ?? []).join(","));
  await replaceTagsForNote({
    userId: context.userId,
    noteId: params.noteId,
    tags: previousTags,
  });

  revalidateWorkspace(mode);
}

export async function semanticSearch(query: string, mode: WorkspaceMode = "user") {
  const q = query.trim();
  if (!q) return [];
  if (q.length < 2) return [];

  if (isLocalDemoMode(mode)) {
    const cached = readSemanticCache(LOCAL_DEMO_USER_ID, q);
    if (cached) return cached;

    assertBudget({
      userId: LOCAL_DEMO_USER_ID,
      action: "semanticSearch",
      charCost: q.length,
      config: SEMANTIC_BUDGET.demo,
    });

    assertNotDuplicate({
      userId: LOCAL_DEMO_USER_ID,
      action: "semanticSearch",
      fingerprint: q.toLowerCase(),
      dedupeMs: 4_000,
    });

    const rows = localSemanticRows(getLocalDemoStore(), q);
    writeSemanticCache(LOCAL_DEMO_USER_ID, q, rows);
    return rows;
  }

  const context = await getActionContext(mode);

  const cached = readSemanticCache(context.userId, q);
  if (cached) return cached;

  assertBudget({
    userId: context.userId,
    action: "semanticSearch",
    charCost: q.length,
    config: isDemoMode(mode) ? SEMANTIC_BUDGET.demo : SEMANTIC_BUDGET.user,
  });

  assertNotDuplicate({
    userId: context.userId,
    action: "semanticSearch",
    fingerprint: q.toLowerCase(),
    dedupeMs: 4_000,
  });

  const queryEmbedding = await embedText(q);

  const { data, error } = await context.db.rpc("match_notes", {
    query_embedding: queryEmbedding,
    match_count: 12,
    user_id: context.userId,
  });

  if (error) throw error;
  const rows = data ?? [];
  writeSemanticCache(context.userId, q, rows);
  return rows;
}
