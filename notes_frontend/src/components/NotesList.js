import React from "react";
import { countWords, formatShortDate, snippet } from "./utils";

/** PUBLIC_INTERFACE
 * Notes list panel with selectable notes and empty state.
 */
export function NotesList({
  notesCount,
  filteredNotes,
  selectedId,
  onSelectNote,
  onCreate
}) {
  /** This is a public function. */
  return (
    <section className="panel surface noteList" aria-label="Note list">
      <div className="panelHeader">
        <div>
          <div className="panelTitle">Notes</div>
          <div className="panelSub">Select a note to view and edit</div>
        </div>
        <div className="badge" title="Total notes">
          {notesCount}
        </div>
      </div>

      <div className="listScroll" role="list" aria-label="Notes">
        {filteredNotes.length === 0 ? (
          <div className="emptyState">
            <div className="emptyTitle">No matches</div>
            <div className="emptyText">Try a different search, or create a new note.</div>
            <button type="button" className="btn btnPrimary btnSmall" onClick={onCreate}>
              <span aria-hidden="true">＋</span> Add note
            </button>
          </div>
        ) : (
          filteredNotes.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`noteItem ${n.id === selectedId ? "noteItemActive" : ""}`}
              onClick={() => onSelectNote(n.id)}
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
  );
}
