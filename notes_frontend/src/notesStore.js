const STORAGE_KEY = "ocean-notes:v1";

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  // Good enough for client-side IDs.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultNotes() {
  const t = nowIso();
  return [
    {
      id: uid(),
      title: "Welcome to Personal Notes",
      body:
        "# Getting started\n\n" +
        "- Create notes with **Markdown**\n" +
        "- Search across titles and content\n" +
        "- Edit on the left, preview on the right\n\n" +
        "```js\nconsole.log('Hello, notes!')\n```",
      createdAt: t,
      updatedAt: t
    },
    {
      id: uid(),
      title: "Shortcuts",
      body:
        "Tips:\n\n" +
        "- Use the search bar to filter notes\n" +
        "- Use **Delete** to remove a note\n" +
        "- Your notes are kept in this browser (localStorage) when no backend is configured.",
      createdAt: t,
      updatedAt: t
    }
  ];
}

/**
 * Normalize a note loaded from storage to ensure required fields exist and are valid types.
 * This also serves as a lightweight migration path from older stored shapes.
 */
function normalizeNote(raw, index = 0) {
  const safe = raw && typeof raw === "object" ? raw : {};
  const id = String(safe.id ?? "") || uid();

  const createdAtRaw = safe.createdAt;
  const updatedAtRaw = safe.updatedAt;

  // If timestamps are missing (older storage), synthesize stable-ish ISO values.
  // We prefer "now" for updatedAt so sorting behaves intuitively after migration.
  const createdAt =
    typeof createdAtRaw === "string" && createdAtRaw.trim()
      ? createdAtRaw
      : // Slightly offset to make multiple migrated notes stable and avoid same-timestamp ties.
        new Date(Date.now() - index).toISOString();

  const updatedAt =
    typeof updatedAtRaw === "string" && updatedAtRaw.trim()
      ? updatedAtRaw
      : nowIso();

  return {
    id,
    title: String(safe.title ?? "").trim() || "Untitled note",
    body: String(safe.body ?? ""),
    createdAt,
    updatedAt
  };
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultNotes();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultNotes();

    const normalized = parsed.map((n, i) => normalizeNote(n, i));

    // If we had to normalize (migration), persist back so future loads are consistent.
    // This is best-effort and won't throw (we do not want reads to fail due to writes).
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // ignore
    }

    return normalized;
  } catch {
    return defaultNotes();
  }
}

function saveAll(notes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return { ok: true };
  } catch (e) {
    // Surface storage errors (e.g., quota exceeded, blocked storage) so the UI can notify.
    return { ok: false, error: e instanceof Error ? e : new Error("Storage write failed") };
  }
}

/** PUBLIC_INTERFACE
 * Creates a new note and returns it.
 */
export function createNote({ title, body }) {
  /** This is a public function. */
  const notes = loadAll();
  const t = nowIso();
  const note = {
    id: uid(),
    title: (title ?? "").trim() || "Untitled note",
    body: body ?? "",
    createdAt: t,
    updatedAt: t
  };
  const next = [note, ...notes];
  const res = saveAll(next);
  if (!res.ok) throw res.error;
  return note;
}

/** PUBLIC_INTERFACE
 * Returns all notes (most-recent first).
 */
export function listNotes() {
  /** This is a public function. */
  const notes = loadAll();
  // Ensure stable sorting by updatedAt.
  return [...notes].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

/** PUBLIC_INTERFACE
 * Updates an existing note by id. Returns updated note or null if missing.
 */
export function updateNote(id, patch) {
  /** This is a public function. */
  const notes = loadAll();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return null;

  const current = normalizeNote(notes[idx]);

  // Persist ISO strings for timestamps.
  // - createdAt never changes once set.
  // - updatedAt always refreshes on update flows.
  const updated = {
    ...current,
    ...(patch ?? {}),
    title:
      patch?.title !== undefined ? (patch.title ?? "").trim() || "Untitled note" : current.title,
    body: patch?.body !== undefined ? patch.body ?? "" : current.body,
    createdAt: current.createdAt,
    updatedAt: nowIso()
  };

  const next = [...notes];
  next[idx] = updated;
  const res = saveAll(next);
  if (!res.ok) throw res.error;
  return updated;
}

/** PUBLIC_INTERFACE
 * Deletes a note by id. Returns boolean success.
 */
export function deleteNote(id) {
  /** This is a public function. */
  const notes = loadAll();
  const next = notes.filter((n) => n.id !== id);
  if (next.length === notes.length) return false;
  const res = saveAll(next);
  if (!res.ok) throw res.error;
  return true;
}

/** PUBLIC_INTERFACE
 * Filters notes by a query (matches title/body). Returns sorted results.
 */
export function searchNotes(query) {
  /** This is a public function. */
  const q = String(query ?? "").trim().toLowerCase();
  const notes = listNotes();
  if (!q) return notes;
  return notes.filter((n) => {
    const t = String(n.title ?? "").toLowerCase();
    const b = String(n.body ?? "").toLowerCase();
    return t.includes(q) || b.includes(q);
  });
}

/** PUBLIC_INTERFACE
 * Clears all stored notes (local only). Useful for debugging.
 */
export function clearAllNotes() {
  /** This is a public function. */
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
