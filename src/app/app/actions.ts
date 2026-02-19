"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/server-admin";
import { embedText, summarizeAndTag } from "@/lib/openai";
import { assertBudget, assertNotDuplicate } from "@/lib/guardrails";

const semanticCache = new Map<string, { expiresAt: number; data: unknown[] }>();

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

export async function getAppData() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) throw new Error("Not authenticated");

  const userId = auth.claims.sub;

  const [
    { data: collections, error: collectionsError },
    { data: notes, error: notesError },
  ] = await Promise.all([
    supabase
      .from("collections")
      .select("*")
      .order("created_at", { ascending: true }),

    supabase
      .from("notes")
      .select(
        `
        *,
        note_tags (
        tags ( id, name )
        )
    `,
      )
      .order("updated_at", { ascending: false }),
  ]);

  if (collectionsError) throw collectionsError;
  if (notesError) throw notesError;

  return {
    userId,
    collections: collections ?? [],
    notes: notes ?? [],
  };
}

export async function createCollection(name: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) throw new Error("Not authenticated");

  const userId = auth.claims.sub;

  const trimmed = name.trim();
  if (!trimmed) return;

  const { error } = await supabase.from("collections").insert({
    user_id: userId,
    name: trimmed,
  });

  if (error) throw error;
  revalidatePath("/app");
}

export async function createNote(params: {
  title?: string;
  content: string;
  collectionId?: string | null;
  tagsCsv?: string;
}) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) throw new Error("Not authenticated");

  const userId = auth.claims.sub;

  const content = params.content.trim();
  if (!content) throw new Error("Content is required");

  const { data: note, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      title: params.title?.trim() || null,
      content,
      collection_id: params.collectionId ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  // Tags: created via admin client, but validated by ownership.
  const tags = normalizeTags(params.tagsCsv ?? "");
  if (tags.length) {
    await upsertTagsForNote({ userId, noteId: note.id, tags });
  }

  revalidatePath("/app");
}

async function upsertTagsForNote(params: {
  userId: string;
  noteId: string;
  tags: string[];
}) {
  // Use admin client so we can do upserts cleanly; still enforce userId explicitly.
  const admin = supabaseAdmin();

  // Upsert tags
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

  // Insert join rows (ignore duplicates)
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

export async function deleteNote(noteId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) throw error;
  revalidatePath("/app");
}

export async function restoreDeletedNote(params: {
  id: string;
  title: string | null;
  content: string;
  summary: string | null;
  collectionId: string | null;
  tagNames?: string[];
}) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) throw new Error("Not authenticated");

  const userId = auth.claims.sub;
  const content = params.content.trim();
  if (!content) throw new Error("Cannot restore an empty note.");

  if (params.collectionId) {
    const { error: collectionError } = await supabase
      .from("collections")
      .select("id")
      .eq("id", params.collectionId)
      .single();
    if (collectionError) throw new Error("Collection not found.");
  }

  const { error: insertError } = await supabase.from("notes").insert({
    id: params.id,
    user_id: userId,
    title: params.title?.trim() || null,
    content,
    summary: params.summary?.trim() || null,
    collection_id: params.collectionId ?? null,
  });

  if (insertError) throw insertError;

  const tagNames = normalizeTags((params.tagNames ?? []).join(","));
  await replaceTagsForNote({
    userId,
    noteId: params.id,
    tags: tagNames,
  });

  revalidatePath("/app");
}

export async function updateNoteCollection(params: {
  noteId: string;
  collectionId: string | null;
}) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) throw new Error("Not authenticated");

  if (params.collectionId) {
    const { error: collectionError } = await supabase
      .from("collections")
      .select("id")
      .eq("id", params.collectionId)
      .single();

    if (collectionError) throw new Error("Collection not found.");
  }

  const { error } = await supabase
    .from("notes")
    .update({ collection_id: params.collectionId })
    .eq("id", params.noteId);

  if (error) throw error;
  revalidatePath("/app");
}

export async function enrichNote(noteId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) throw new Error("Not authenticated");

  const userId = auth.claims.sub;

  const { data: note, error: noteErr } = await supabase
    .from("notes")
    .select("id, title, content")
    .eq("id", noteId)
    .single();

  if (noteErr) throw noteErr;

  const content = String(note.content ?? "").trim();
  if (!content) throw new Error("Note content is empty");

  assertBudget({
    userId,
    action: "enrichNote",
    charCost: content.length,
    config: {
      windowMs: 60 * 60 * 1000,
      maxRequests: 24,
      maxCharsPerRequest: 20_000,
      maxCharsPerWindow: 180_000,
    },
  });

  assertNotDuplicate({
    userId,
    action: "enrichNote",
    fingerprint: noteId,
    dedupeMs: 45_000,
  });

  // 1) Summary + tags
  const enriched = await summarizeAndTag(content);

  // If the model returns an empty title, keep existing title or derive a simple one.
  const derivedTitle = content
    .split(/\n|\.|\?|!/)[0]
    ?.trim()
    .slice(0, 60);

  const nextTitle =
    enriched.title && enriched.title.trim()
      ? enriched.title.trim().slice(0, 60)
      : String(note.title ?? "").trim() || derivedTitle || null;

  // 2) Embedding
  const embedding = await embedText(
    `${nextTitle ?? ""}\n\n${enriched.summary ?? ""}\n\n${content}`.slice(
      0,
      8000,
    ),
  );

  // 3) Update note
  const { error: upErr } = await supabase
    .from("notes")
    .update({
      title: nextTitle,
      summary: enriched.summary || null,
      embedding,
    })
    .eq("id", noteId);

  if (upErr) throw upErr;

  // 4) Tags join
  if (enriched.tags.length) {
    const admin = supabaseAdmin();

    const { data: insertedTags, error: tagsError } = await admin
      .from("tags")
      .upsert(
        enriched.tags.map((name: unknown) => ({ user_id: userId, name })),
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

  revalidatePath("/app");
}

export async function undoEnrichNote(params: {
  noteId: string;
  previousTitle: string | null;
  previousSummary: string | null;
  previousTagNames?: string[];
}) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) throw new Error("Not authenticated");

  const userId = auth.claims.sub;

  const { error: noteError } = await supabase
    .from("notes")
    .select("id")
    .eq("id", params.noteId)
    .single();
  if (noteError) throw new Error("Note not found.");

  const { error: updateError } = await supabase
    .from("notes")
    .update({
      title: params.previousTitle?.trim() || null,
      summary: params.previousSummary?.trim() || null,
      embedding: null,
    })
    .eq("id", params.noteId);

  if (updateError) throw updateError;

  const previousTags = normalizeTags((params.previousTagNames ?? []).join(","));
  await replaceTagsForNote({
    userId,
    noteId: params.noteId,
    tags: previousTags,
  });

  revalidatePath("/app");
}

export async function semanticSearch(query: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) throw new Error("Not authenticated");

  const userId = auth.claims.sub;

  const q = query.trim();
  if (!q) return [];
  if (q.length < 2) return [];

  const cached = readSemanticCache(userId, q);
  if (cached) return cached;

  assertBudget({
    userId,
    action: "semanticSearch",
    charCost: q.length,
    config: {
      windowMs: 10 * 60 * 1000,
      maxRequests: 40,
      maxCharsPerRequest: 500,
      maxCharsPerWindow: 12_000,
    },
  });

  assertNotDuplicate({
    userId,
    action: "semanticSearch",
    fingerprint: q.toLowerCase(),
    dedupeMs: 4_000,
  });

  const queryEmbedding = await embedText(q);

  const { data, error } = await supabase.rpc("match_notes", {
    query_embedding: queryEmbedding,
    match_count: 12,
    user_id: userId,
  });

  if (error) throw error;
  const rows = data ?? [];
  writeSemanticCache(userId, q, rows);
  return rows;
}
