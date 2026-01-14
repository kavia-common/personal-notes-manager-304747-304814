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

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultNotes();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultNotes();
    return parsed;
  } catch {
    return defaultNotes();
  }
}

function saveAll(notes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Ignore storage errors (e.g., private mode).
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
  saveAll(next);
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
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1) return null;

  const current = notes[idx];
  const updated = {
    ...current,
    ...(patch ?? {}),
    title: patch?.title !== undefined ? (patch.title ?? "").trim() || "Untitled note" : current.title,
    body: patch?.body !== undefined ? patch.body ?? "" : current.body,
    updatedAt: nowIso()
  };

  const next = [...notes];
  next[idx] = updated;
  saveAll(next);
  return updated;
}

/** PUBLIC_INTERFACE
 * Deletes a note by id. Returns boolean success.
 */
export function deleteNote(id) {
  /** This is a public function. */
  const notes = loadAll();
  const next = notes.filter(n => n.id !== id);
  if (next.length === notes.length) return false;
  saveAll(next);
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
  return notes.filter(n => {
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
