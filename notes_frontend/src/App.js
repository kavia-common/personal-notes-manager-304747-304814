import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { hasBackendConfigured, getApiBaseUrl } from "./env";
import {
  clearAllNotes,
  createNote,
  deleteNote,
  exportNotesData,
  listNotes,
  replaceAllNotes,
  searchNotes,
  updateNote
} from "./notesStore";
import { Editor, NotesList, SettingsPanel, Sidebar, Toast, Topbar } from "./components";

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

  // Dirty state tracks whether current draft differs from the last loaded/saved note content.
  const [isDirty, setIsDirty] = useState(false);

  // Save status shown in UI. Values: "hidden" | "saved" | "dirty" | "saving"
  const [saveStatus, setSaveStatus] = useState("hidden");
  const autosaveTimer = useRef(null);

  const [toast, setToast] = useState(null); // {type,title,msg}
  const toastTimer = useRef(null);

  const [backendMode, setBackendMode] = useState(hasBackendConfigured());
  const [backendStatus, setBackendStatus] = useState(
    backendMode ? "Backend configured (best-effort)" : "Local mode"
  );

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Focus management refs
  const searchInputRef = useRef(null);
  const lastFocusRef = useRef(null);

  const selectedNote = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId]);

  // Note: searchNotes() reads from localStorage via listNotes(). We keep this behavior intact.
  const filteredNotes = useMemo(() => searchNotes(query), [query, notes]);

  useEffect(() => {
    // Keep selection valid when notes list changes
    if (selectedId && notes.some((n) => n.id === selectedId)) return;
    setSelectedId(notes[0]?.id ?? null);
  }, [notes, selectedId]);

  useEffect(() => {
    // When selection changes, reset draft and status.
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);

    if (!selectedNote) {
      setDraftTitle("");
      setDraftBody("");
      setIsDirty(false);
      setSaveStatus("hidden");
      return;
    }
    setDraftTitle(selectedNote.title ?? "");
    setDraftBody(selectedNote.body ?? "");
    setIsDirty(false);
    setSaveStatus("saved");
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

  const focusSearch = useCallback(() => {
    const el = searchInputRef.current || document.getElementById("notes-search");
    if (!el) return;
    try {
      el.focus();
      el.select?.();
    } catch {
      // ignore
    }
  }, []);

  // Keyboard shortcuts:
  // - Ctrl/Cmd+N: New note
  // - Ctrl/Cmd+S: Save (prevents browser "Save page" dialog)
  // - Ctrl/Cmd+F: Focus search input (prevents browser find dialog)
  useEffect(() => {
    function isTypingInField(target) {
      const el = target;
      if (!el) return false;
      const tag = String(el.tagName || "").toLowerCase();
      return tag === "input" || tag === "textarea" || el.isContentEditable;
    }

    // PUBLIC_INTERFACE
    function onKeyDown(e) {
      /** Global key handler for notes app shortcuts. */
      const key = String(e.key || "").toLowerCase();
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      // Ctrl/Cmd+S: Save current note
      if (key === "s") {
        e.preventDefault();
        if (!selectedNote) {
          notify({ type: "info", title: "Nothing to save", msg: "Create or select a note first." });
          return;
        }
        if (!isDirty) {
          // Keep this subtle; user explicitly invoked save so a tiny toast is okay.
          notify({ type: "info", title: "Up to date", msg: "No changes to save." });
          return;
        }
        handleSave({ silent: false });
        return;
      }

      // Ctrl/Cmd+N: New note
      if (key === "n") {
        e.preventDefault();
        handleCreate();
        return;
      }

      // Ctrl/Cmd+F: Focus search
      if (key === "f") {
        // If the user is already typing in an input/textarea, don't steal focus.
        if (isTypingInField(e.target)) return;

        e.preventDefault();
        focusSearch();
      }

      // Ctrl/Cmd+, : Open settings (common app shortcut)
      if (key === ",") {
        e.preventDefault();
        lastFocusRef.current = document.activeElement;
        setSettingsOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // Depend on current state so shortcuts behave with latest selection/dirty state.
  }, [selectedNote, isDirty, handleCreate, handleSave, focusSearch]);

  const selectNote = useCallback(
    (id) => {
      if (isDirty) {
        const ok = window.confirm("You have unsaved changes. Discard them and switch notes?");
        if (!ok) return;
      }
      setSelectedId(id);
    },
    [isDirty]
  );

  const handleCreate = useCallback(async () => {
    if (isDirty) {
      const ok = window.confirm("You have unsaved changes. Discard them and create a new note?");
      if (!ok) return;
    }

    // Track the currently focused element so we can return focus to something sensible if needed.
    lastFocusRef.current = document.activeElement;

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
        setNotes((prev) => [note, ...prev]);
        setSelectedId(note.id);

        // Focus editor title after creating.
        window.setTimeout(() => {
          document.querySelector('input[aria-label="Note title"]')?.focus?.();
        }, 0);

        notify({ type: "info", title: "Created", msg: "New note created (backend)." });
        return;
      } catch {
        setBackendMode(false);
        setBackendStatus("Local mode (backend unavailable)");
        notify({ type: "error", title: "Backend unavailable", msg: "Creating note locally instead." });
      }
    }

    try {
      const note = createNote({ title: "Untitled note", body: "" });
      setNotes(listNotes());
      setSelectedId(note.id);

      window.setTimeout(() => {
        document.querySelector('input[aria-label="Note title"]')?.focus?.();
      }, 0);

      notify({ type: "info", title: "Created", msg: "New note created." });
    } catch (e) {
      notify({
        type: "error",
        title: "Storage error",
        msg: `Could not create note. ${e instanceof Error ? e.message : ""}`.trim()
      });
    }
  }, [backendMode, isDirty, notify, notes]);

  // Debounced autosave: when dirty drafts change, schedule a save after a short pause.
  useEffect(() => {
    if (!selectedNote) return;
    if (!isDirty) return;

    // Mark dirty immediately for UI responsiveness.
    setSaveStatus("dirty");

    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);

    autosaveTimer.current = window.setTimeout(() => {
      // Do not await to keep typing responsive; handleSave will update status.
      handleSave({ silent: true });
    }, 800);

    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
    // We intentionally watch the draft values so autosave triggers on edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftTitle, draftBody, isDirty, selectedNote?.id]);

  const handleSave = useCallback(
    async (options = {}) => {
      if (!selectedNote) return;

      const { silent = false } = options;

      // Capture the note id and the draft snapshot at the moment save begins.
      const noteIdAtStart = selectedNote.id;
      const titleAtStart = draftTitle;
      const bodyAtStart = draftBody;

      // If an autosave is about to run, cancel that timer; manual save should win.
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);

      setSaveStatus("saving");

      if (backendMode) {
        try {
          const updated = await backendFetchJson(`/notes/${encodeURIComponent(noteIdAtStart)}`, {
            method: "PUT",
            body: JSON.stringify({ title: titleAtStart, body: bodyAtStart })
          });

          const nextNote = {
            id: String(updated.id ?? noteIdAtStart),
            title: String(updated.title ?? titleAtStart ?? "Untitled note"),
            body: String(updated.body ?? bodyAtStart ?? ""),
            createdAt: String(updated.createdAt ?? selectedNote.createdAt ?? new Date().toISOString()),
            updatedAt: String(updated.updatedAt ?? new Date().toISOString())
          };

          setNotes((prev) =>
            [nextNote, ...prev.filter((n) => n.id !== noteIdAtStart)].sort((a, b) =>
              String(b.updatedAt).localeCompare(String(a.updatedAt))
            )
          );

          // Avoid clearing dirty state if the user typed more while we were saving.
          const stillSameDraft =
            titleAtStart === draftTitle && bodyAtStart === draftBody && selectedNote?.id === noteIdAtStart;
          if (stillSameDraft) setIsDirty(false);

          setSaveStatus(stillSameDraft ? "saved" : "dirty");

          if (!silent) notify({ type: "info", title: "Saved", msg: "Changes saved (backend)." });
          return;
        } catch {
          setBackendMode(false);
          setBackendStatus("Local mode (backend unavailable)");
          if (!silent) notify({ type: "error", title: "Backend unavailable", msg: "Saving locally instead." });
        }
      }

      try {
        updateNote(noteIdAtStart, { title: titleAtStart, body: bodyAtStart });
        setNotes(listNotes());

        // Same "did draft change during save?" protection for local saves.
        const stillSameDraft =
          titleAtStart === draftTitle && bodyAtStart === draftBody && selectedNote?.id === noteIdAtStart;
        if (stillSameDraft) setIsDirty(false);
        setSaveStatus(stillSameDraft ? "saved" : "dirty");

        if (!silent) notify({ type: "info", title: "Saved", msg: "Changes saved." });
      } catch (e) {
        setSaveStatus("dirty");
        // If autosave fails silently, we still want a subtle signal. Keep it silent.
        if (!silent) {
          notify({
            type: "error",
            title: "Storage error",
            msg: `Could not save changes. ${e instanceof Error ? e.message : ""}`.trim()
          });
        }
      }
    },
    [backendMode, draftBody, draftTitle, notify, selectedNote]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedNote) return;
    const ok = window.confirm(`Delete "${selectedNote.title}"? This cannot be undone.`);
    if (!ok) return;

    lastFocusRef.current = document.activeElement;

    const deletedId = selectedNote.id;

    if (backendMode) {
      try {
        await backendFetchJson(`/notes/${encodeURIComponent(deletedId)}`, { method: "DELETE" });
        setNotes((prev) => prev.filter((n) => n.id !== deletedId));
        notify({ type: "info", title: "Deleted", msg: "Note deleted (backend)." });

        // Move focus somewhere sensible after delete.
        window.setTimeout(() => {
          focusSearch();
        }, 0);

        return;
      } catch {
        setBackendMode(false);
        setBackendStatus("Local mode (backend unavailable)");
        notify({ type: "error", title: "Backend unavailable", msg: "Deleting locally instead." });
      }
    }

    try {
      deleteNote(deletedId);
      const nextNotes = listNotes();
      setNotes(nextNotes);

      window.setTimeout(() => {
        // Prefer focusing search; list selection already updates.
        focusSearch();
      }, 0);

      notify({ type: "info", title: "Deleted", msg: "Note deleted." });
    } catch (e) {
      notify({
        type: "error",
        title: "Storage error",
        msg: `Could not delete note. ${e instanceof Error ? e.message : ""}`.trim()
      });
    }
  }, [backendMode, focusSearch, notify, selectedNote]);

  async function handleResetAllNotes() {
    if (backendMode) {
      notify({
        type: "error",
        title: "Local-only action",
        msg: "Reset operates on local notes. Backend mode is enabled; disconnect backend to avoid confusion."
      });
      return;
    }

    if (isDirty) {
      const ok = window.confirm(
        "You have unsaved changes in the editor. Reset will discard them. Continue?"
      );
      if (!ok) return;
    }

    try {
      clearAllNotes();
      const fresh = listNotes(); // will re-seed defaults if storage is empty
      setNotes(fresh);
      setSelectedId(fresh[0]?.id ?? null);
      setDraftTitle("");
      setDraftBody("");
      setIsDirty(false);
      setSaveStatus("hidden");
      notify({ type: "info", title: "Reset", msg: "Local notes were cleared." });
    } catch (e) {
      notify({
        type: "error",
        title: "Storage error",
        msg: `Could not reset notes. ${e instanceof Error ? e.message : ""}`.trim()
      });
    }
  }

  async function handleExportNotes() {
    if (backendMode) {
      notify({
        type: "error",
        title: "Local-only action",
        msg: "Export in this build exports local notes. Backend mode is enabled; exported file may not match backend state."
      });
      // Still allow export to proceed (best effort) since notes state exists in-memory.
    }

    try {
      const data = exportNotesData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `personal-notes-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
      notify({ type: "info", title: "Exported", msg: "Downloaded notes JSON." });
    } catch (e) {
      notify({
        type: "error",
        title: "Export failed",
        msg: `Could not export notes. ${e instanceof Error ? e.message : ""}`.trim()
      });
    }
  }

  async function handleImportNotesJsonText(jsonText) {
    if (backendMode) {
      notify({
        type: "error",
        title: "Local-only action",
        msg: "Import replaces local notes. Backend mode is enabled; imported content will not be pushed to backend."
      });
      // Still allow local import, but warn user.
    }

    if (isDirty) {
      const ok = window.confirm(
        "You have unsaved changes in the editor. Import will replace notes and discard current draft. Continue?"
      );
      if (!ok) return;
    }

    try {
      const parsed = JSON.parse(String(jsonText ?? ""));

      // Support both raw array exports and a wrapped shape for future-proofing.
      const notesArray = Array.isArray(parsed) ? parsed : parsed?.notes;

      if (!Array.isArray(notesArray)) {
        throw new Error('Invalid import file. Expected a JSON array of notes, or an object with a "notes" array.');
      }

      const next = replaceAllNotes(notesArray);

      setNotes(listNotes());
      setSelectedId(next[0]?.id ?? null);
      setDraftTitle("");
      setDraftBody("");
      setIsDirty(false);
      setSaveStatus("hidden");

      notify({ type: "info", title: "Imported", msg: `Imported ${next.length} notes.` });
    } catch (e) {
      notify({
        type: "error",
        title: "Import failed",
        msg: `Could not import notes. ${e instanceof Error ? e.message : ""}`.trim()
      });
    }
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
            onOpenSettings={() => {
              lastFocusRef.current = document.activeElement;
              setSettingsOpen(true);
            }}
            canSave={Boolean(selectedNote) && isDirty}
            canDelete={Boolean(selectedNote)}
            saveStatus={Boolean(selectedNote) ? saveStatus : "hidden"}
            searchInputRef={searchInputRef}
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
                <button type="button" className="btn btnGhost btnSmall" onClick={() => setSettingsOpen(true)}>
                  Open Settings
                </button>
              </div>
            </section>
          ) : activeNav === "settings" ? (
            <section className="panel surface" aria-label="Settings">
              <div className="emptyState">
                <div className="emptyTitle">Settings</div>
                <div className="emptyText">
                  Manage local notes: export, import, or reset. Settings opens in a modal to avoid routing changes.
                </div>
                <button type="button" className="btn btnPrimary btnSmall" onClick={() => setSettingsOpen(true)}>
                  Open Settings
                </button>
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
                saveStatus={saveStatus}
                onCreate={handleCreate}
                onSave={handleSave}
              />
            </section>
          )}
        </main>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          window.setTimeout(() => {
            const el = lastFocusRef.current;
            if (el && typeof el.focus === "function") {
              try {
                el.focus();
                return;
              } catch {
                // ignore
              }
            }
            focusSearch();
          }, 0);
        }}
        notesCount={notes.length}
        onResetAll={handleResetAllNotes}
        onExport={handleExportNotes}
        onImportJsonText={handleImportNotesJsonText}
      />

      <Toast toast={toast} />
    </>
  );
}

export default App;
