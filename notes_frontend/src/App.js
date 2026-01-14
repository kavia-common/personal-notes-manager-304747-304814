import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { hasBackendConfigured, getApiBaseUrl } from "./env";
import { createNote, deleteNote, listNotes, searchNotes, updateNote } from "./notesStore";
import { Editor, NotesList, Sidebar, Toast, Topbar } from "./components";

/**
 * Minimal backend adapter (not fully implemented since backend spec is not provided).
 * If REACT_APP_API_BASE or REACT_APP_BACKEND_URL is configured, we will attempt to load notes.
 * If calls fail, we fall back to local storage/in-memory experience.
 */
async function backendFetchJson(path, options) {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Backend request failed (${res.status}): ${body || res.statusText}`);
  }
  return res.json();
}

// PUBLIC_INTERFACE
function App() {
  /** This is a public function. */
  const [activeNav, setActiveNav] = useState("notes");
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState(() => listNotes());
  const [selectedId, setSelectedId] = useState(notes[0]?.id ?? null);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const [toast, setToast] = useState(null); // {type,title,msg}
  const toastTimer = useRef(null);

  const [backendMode, setBackendMode] = useState(hasBackendConfigured());
  const [backendStatus, setBackendStatus] = useState(
    backendMode ? "Backend configured (best-effort)" : "Local mode"
  );

  const selectedNote = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId]);

  // Note: searchNotes() reads from localStorage via listNotes(). We keep this behavior intact.
  const filteredNotes = useMemo(() => searchNotes(query), [query, notes]);

  useEffect(() => {
    // Keep selection valid when notes list changes
    if (selectedId && notes.some((n) => n.id === selectedId)) return;
    setSelectedId(notes[0]?.id ?? null);
  }, [notes, selectedId]);

  useEffect(() => {
    // When selection changes, reset draft.
    if (!selectedNote) {
      setDraftTitle("");
      setDraftBody("");
      setIsDirty(false);
      return;
    }
    setDraftTitle(selectedNote.title ?? "");
    setDraftBody(selectedNote.body ?? "");
    setIsDirty(false);
  }, [selectedNote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Best-effort backend load if configured. If it fails, stay in local mode.
    let cancelled = false;

    async function load() {
      if (!hasBackendConfigured()) return;

      try {
        // Because backend spec is unknown, we attempt a conventional route.
        // If this fails, we simply use local notes.
        const data = await backendFetchJson("/notes", { method: "GET" });
        if (cancelled) return;

        if (Array.isArray(data)) {
          // Expecting an array of notes shaped like {id,title,body,createdAt,updatedAt}
          setNotes(
            data
              .map((n) => ({
                id: String(n.id ?? ""),
                title: String(n.title ?? "Untitled note"),
                body: String(n.body ?? ""),
                createdAt: String(n.createdAt ?? new Date().toISOString()),
                updatedAt: String(n.updatedAt ?? n.createdAt ?? new Date().toISOString())
              }))
              .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
          );
          setBackendMode(true);
          setBackendStatus("Connected to backend");
          notify({ type: "info", title: "Backend", msg: "Loaded notes from configured backend." });
        } else {
          throw new Error("Unexpected backend response for /notes");
        }
      } catch (e) {
        if (cancelled) return;
        setBackendMode(false);
        setBackendStatus("Local mode (backend unavailable)");
        notify({
          type: "error",
          title: "Backend unavailable",
          msg: "Falling back to local notes so the UI remains usable."
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function notify({ type, title, msg }) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ type, title, msg });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }

  function selectNote(id) {
    if (isDirty) {
      const ok = window.confirm("You have unsaved changes. Discard them and switch notes?");
      if (!ok) return;
    }
    setSelectedId(id);
  }

  async function handleCreate() {
    if (isDirty) {
      const ok = window.confirm("You have unsaved changes. Discard them and create a new note?");
      if (!ok) return;
    }

    if (backendMode) {
      // Best-effort: attempt backend create.
      try {
        const created = await backendFetchJson("/notes", {
          method: "POST",
          body: JSON.stringify({ title: "Untitled note", body: "" })
        });
        const note = {
          id: String(created.id ?? ""),
          title: String(created.title ?? "Untitled note"),
          body: String(created.body ?? ""),
          createdAt: String(created.createdAt ?? new Date().toISOString()),
          updatedAt: String(created.updatedAt ?? created.createdAt ?? new Date().toISOString())
        };
        const next = [note, ...notes];
        setNotes(next);
        setSelectedId(note.id);
        notify({ type: "info", title: "Created", msg: "New note created (backend)." });
        return;
      } catch {
        setBackendMode(false);
        setBackendStatus("Local mode (backend unavailable)");
        notify({ type: "error", title: "Backend unavailable", msg: "Creating note locally instead." });
      }
    }

    const note = createNote({ title: "Untitled note", body: "" });
    setNotes(listNotes());
    setSelectedId(note.id);
    notify({ type: "info", title: "Created", msg: "New note created." });
  }

  async function handleSave() {
    if (!selectedNote) return;

    const title = draftTitle;
    const body = draftBody;

    if (backendMode) {
      try {
        const updated = await backendFetchJson(`/notes/${encodeURIComponent(selectedNote.id)}`, {
          method: "PUT",
          body: JSON.stringify({ title, body })
        });

        const nextNote = {
          id: String(updated.id ?? selectedNote.id),
          title: String(updated.title ?? title ?? "Untitled note"),
          body: String(updated.body ?? body ?? ""),
          createdAt: String(updated.createdAt ?? selectedNote.createdAt ?? new Date().toISOString()),
          updatedAt: String(updated.updatedAt ?? new Date().toISOString())
        };

        setNotes((prev) =>
          [nextNote, ...prev.filter((n) => n.id !== selectedNote.id)].sort((a, b) =>
            String(b.updatedAt).localeCompare(String(a.updatedAt))
          )
        );
        setIsDirty(false);
        notify({ type: "info", title: "Saved", msg: "Changes saved (backend)." });
        return;
      } catch {
        setBackendMode(false);
        setBackendStatus("Local mode (backend unavailable)");
        notify({ type: "error", title: "Backend unavailable", msg: "Saving locally instead." });
      }
    }

    updateNote(selectedNote.id, { title, body });
    setNotes(listNotes());
    setIsDirty(false);
    notify({ type: "info", title: "Saved", msg: "Changes saved." });
  }

  async function handleDelete() {
    if (!selectedNote) return;
    const ok = window.confirm(`Delete "${selectedNote.title}"? This cannot be undone.`);
    if (!ok) return;

    if (backendMode) {
      try {
        await backendFetchJson(`/notes/${encodeURIComponent(selectedNote.id)}`, { method: "DELETE" });
        setNotes((prev) => prev.filter((n) => n.id !== selectedNote.id));
        notify({ type: "info", title: "Deleted", msg: "Note deleted (backend)." });
        return;
      } catch {
        setBackendMode(false);
        setBackendStatus("Local mode (backend unavailable)");
        notify({ type: "error", title: "Backend unavailable", msg: "Deleting locally instead." });
      }
    }

    deleteNote(selectedNote.id);
    setNotes(listNotes());
    notify({ type: "info", title: "Deleted", msg: "Note deleted." });
  }

  return (
    <>
      <div className="app-shell" role="application" aria-label="Personal Notes">
        <Sidebar
          activeNav={activeNav}
          setActiveNav={setActiveNav}
          notesCount={notes.length}
          backendMode={backendMode}
          backendStatus={backendStatus}
        />

        <main className="main" aria-label="Main content">
          <Topbar
            query={query}
            setQuery={setQuery}
            filteredCount={filteredNotes.length}
            activeNav={activeNav}
            onCreate={handleCreate}
            onSave={handleSave}
            onDelete={handleDelete}
            canSave={Boolean(selectedNote) && isDirty}
            canDelete={Boolean(selectedNote)}
          />

          {activeNav === "about" ? (
            <section className="panel surface" aria-label="About">
              <div className="emptyState">
                <div className="emptyTitle">About</div>
                <div className="emptyText">
                  This is a lightweight personal notes manager built in React with a modern Ocean Professional theme.
                  It works without a backend (local mode), and can attempt to use a backend if{" "}
                  <code>REACT_APP_API_BASE</code> or <code>REACT_APP_BACKEND_URL</code> is configured.
                </div>
                <div className="emptyText">Markdown preview: type on the left and preview renders on the right.</div>
              </div>
            </section>
          ) : (
            <section className="contentGrid" aria-label="Notes workspace">
              <NotesList
                notesCount={notes.length}
                filteredNotes={filteredNotes}
                selectedId={selectedId}
                onSelectNote={selectNote}
                onCreate={handleCreate}
              />

              <Editor
                selectedNote={selectedNote}
                draftTitle={draftTitle}
                setDraftTitle={setDraftTitle}
                draftBody={draftBody}
                setDraftBody={setDraftBody}
                isDirty={isDirty}
                setIsDirty={setIsDirty}
                onCreate={handleCreate}
                onSave={handleSave}
              />
            </section>
          )}
        </main>
      </div>

      <Toast toast={toast} />
    </>
  );
}

export default App;
