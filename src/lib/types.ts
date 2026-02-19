export type NoteTagJoin = {
  tags: { id: string; name: string } | null;
};

export type Note = {
  id: string;
  user_id: string;
  collection_id: string | null;
  title: string | null;
  content: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
  note_tags?: NoteTagJoin[];
};

export type Collection = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};
