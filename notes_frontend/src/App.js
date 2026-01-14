import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { hasBackendConfigured, getApiBaseUrl } from "./env";
import { createNote, deleteNote, listNotes, searchNotes, updateNote } from "./notesStore";
import { renderMarkdownToHtml } from "./markdown";

function formatShortDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "2-digit" });
  } catch {
    return "";
  }
}

function snippet(text) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > 120 ? `${t.slice(0, 120)}…` : t;
}

function countWords(text) {
  const t = String(text ?? "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function iconBox(text) {
  return <span className="navIcon" aria-hidden="true">{text}</span>;
}

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

  const selectedNote = useMemo(
    () => notes.find(n => n.id === selectedId) ?? null,
    [notes, selectedId]
  );

  const filteredNotes = useMemo(() => searchNotes(query), [query, notes]);

  useEffect(() => {
    // Keep selection valid when notes list changes
    if (selectedId && notes.some(n => n.id === selectedId)) return;
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
              .map(n => ({
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

        setNotes(prev =>
          [nextNote, ...prev.filter(n => n.id !== selectedNote.id)].sort((a, b) =>
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
        setNotes(prev => prev.filter(n => n.id !== selectedNote.id));
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

  const previewHtml = useMemo(() => renderMarkdownToHtml(draftBody), [draftBody]);

  return (
    <>
      <div className="app-shell" role="application" aria-label="Personal Notes">
        {/* Sidebar */}
        <aside className="sidebar surface" aria-label="Sidebar navigation">
          <div className="sidebarHeader">
            <div className="brand">
              <div className="brandTitle">Personal Notes</div>
              <div className="brandSub">Ocean Professional</div>
            </div>
            <div className="pill" title={backendStatus}>
              <span aria-hidden="true">{backendMode ? "●" : "◻"}</span>
              <span>{backendMode ? "Backend" : "Local"}</span>
            </div>
          </div>

          <nav className="nav" aria-label="Sections">
            <button
              type="button"
              className={`navButton ${activeNav === "notes" ? "navButtonActive" : ""}`}
              onClick={() => setActiveNav("notes")}
              aria-current={activeNav === "notes" ? "page" : undefined}
            >
              <span className="navButtonLabel">
                {iconBox("N")}
                Notes
              </span>
              <span className="badge" aria-label={`${notes.length} total notes`}>{notes.length}</span>
            </button>

            <button
              type="button"
              className={`navButton ${activeNav === "about" ? "navButtonActive" : ""}`}
              onClick={() => setActiveNav("about")}
              aria-current={activeNav === "about" ? "page" : undefined}
            >
              <span className="navButtonLabel">
                {iconBox("i")}
                About
              </span>
            </button>
          </nav>

          <div className="sidebarFooter">
            <div className="smallText">
              Search, create, edit, and delete notes. Markdown preview is available while editing.
            </div>
            <div className="smallText">
              Env vars used: <strong>REACT_APP_API_BASE</strong>, <strong>REACT_APP_BACKEND_URL</strong> (optional).
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="main" aria-label="Main content">
          <header className="topbar surface" aria-label="Top bar">
            <div className="searchRow">
              <input
                className="searchInput"
                type="search"
                placeholder="Search notes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search notes"
              />
              <span className="badge" aria-label="Filtered notes count">
                {filteredNotes.length} shown
              </span>
            </div>

            <div className="actions" aria-label="Actions">
              <button type="button" className="btn btnPrimary" onClick={handleCreate}>
                <span aria-hidden="true">＋</span> Add note
              </button>
              {activeNav === "notes" && (
                <>
                  <button
                    type="button"
                    className="btn btnGhost"
                    onClick={handleSave}
                    disabled={!selectedNote || !isDirty}
                    aria-disabled={!selectedNote || !isDirty}
                    title={!isDirty ? "No changes to save" : "Save changes"}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn btnDanger"
                    onClick={handleDelete}
                    disabled={!selectedNote}
                    aria-disabled={!selectedNote}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </header>

          {activeNav === "about" ? (
            <section className="panel surface" aria-label="About">
              <div className="emptyState">
                <div className="emptyTitle">About</div>
                <div className="emptyText">
                  This is a lightweight personal notes manager built in React with a modern Ocean Professional theme.
                  It works without a backend (local mode), and can attempt to use a backend if{" "}
                  <code>REACT_APP_API_BASE</code> or <code>REACT_APP_BACKEND_URL</code> is configured.
                </div>
                <div className="emptyText">
                  Markdown preview: type on the left and preview renders on the right.
                </div>
              </div>
            </section>
          ) : (
            <section className="contentGrid" aria-label="Notes workspace">
              {/* List */}
              <section className="panel surface noteList" aria-label="Note list">
                <div className="panelHeader">
                  <div>
                    <div className="panelTitle">Notes</div>
                    <div className="panelSub">Select a note to view and edit</div>
                  </div>
                  <div className="badge" title="Total notes">
                    {notes.length}
                  </div>
                </div>

                <div className="listScroll" role="list" aria-label="Notes">
                  {filteredNotes.length === 0 ? (
                    <div className="emptyState">
                      <div className="emptyTitle">No matches</div>
                      <div className="emptyText">Try a different search, or create a new note.</div>
                      <button type="button" className="btn btnPrimary btnSmall" onClick={handleCreate}>
                        <span aria-hidden="true">＋</span> Add note
                      </button>
                    </div>
                  ) : (
                    filteredNotes.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className={`noteItem ${n.id === selectedId ? "noteItemActive" : ""}`}
                        onClick={() => selectNote(n.id)}
                        role="listitem"
                        aria-label={`Open note: ${n.title}`}
                        aria-current={n.id === selectedId ? "true" : "false"}
                      >
                        <div className="noteTitle">{n.title || "Untitled note"}</div>
                        <div className="noteSnippet">{snippet(n.body)}</div>
                        <div className="noteMeta">
                          <span>{formatShortDate(n.updatedAt)}</span>
                          <span>{countWords(n.body)} words</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>

              {/* Editor */}
              <section className="panel surface editorWrap" aria-label="Note editor and preview">
                {!selectedNote ? (
                  <div className="emptyState">
                    <div className="emptyTitle">No note selected</div>
                    <div className="emptyText">
                      Create a note or select one from the list to start writing.
                    </div>
                    <button type="button" className="btn btnPrimary btnSmall" onClick={handleCreate}>
                      <span aria-hidden="true">＋</span> Add note
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="panelHeader">
                      <div>
                        <div className="panelTitle">Editor</div>
                        <div className="panelSub">
                          Updated {formatShortDate(selectedNote.updatedAt)} •{" "}
                          {isDirty ? "Unsaved changes" : "All changes saved"}
                        </div>
                      </div>
                      <div className="actions">
                        <span className="badge" title="Markdown enabled">Markdown</span>
                        <button
                          type="button"
                          className="btn btnGhost btnSmall"
                          onClick={handleSave}
                          disabled={!isDirty}
                          aria-disabled={!isDirty}
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="editorBody">
                      <div className="field" aria-label="Edit fields">
                        <div className="labelRow">
                          <div className="label">Title</div>
                          <div className="helper">Short, descriptive</div>
                        </div>
                        <input
                          className="input"
                          value={draftTitle}
                          onChange={(e) => {
                            setDraftTitle(e.target.value);
                            setIsDirty(true);
                          }}
                          placeholder="Untitled note"
                          aria-label="Note title"
                        />

                        <div className="labelRow" style={{ marginTop: 8 }}>
                          <div className="label">Body</div>
                          <div className="helper">Supports markdown</div>
                        </div>
                        <textarea
                          className="textarea"
                          value={draftBody}
                          onChange={(e) => {
                            setDraftBody(e.target.value);
                            setIsDirty(true);
                          }}
                          placeholder="Write your note in markdown…"
                          aria-label="Note body"
                        />
                      </div>

                      <div className="field" aria-label="Preview">
                        <div className="labelRow">
                          <div className="label">Preview</div>
                          <div className="helper">Rendered output</div>
                        </div>
                        <div
                          className="preview"
                          role="region"
                          aria-label="Markdown preview"
                          // We do minimal sanitization in markdown.js. For production: DOMPurify.
                          dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </section>
            </section>
          )}
        </main>
      </div>

      {toast && (
        <div className="toastWrap" aria-live="polite" aria-atomic="true">
          <div className={`toast ${toast.type === "error" ? "toastError" : ""}`} role="status">
            <div className="toastIcon" aria-hidden="true" />
            <div className="toastBody">
              <div className="toastTitle">{toast.title}</div>
              <div className="toastMsg">{toast.msg}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
