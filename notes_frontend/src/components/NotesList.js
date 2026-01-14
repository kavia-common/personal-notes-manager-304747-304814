import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { countWords, formatRelativeDate, formatTags, normalizeTags, snippet } from "./utils";

const ITEM_HEIGHT = 112; // px, approx height including margin (simple fixed-height virtualization)
const OVERSCAN = 6;

/** PRIVATE
 * Memoized note row to prevent re-rendering every row when selection changes.
 */
const NoteRow = memo(function NoteRow({ note, isSelected, onSelect }) {
  const tagsLabel = formatTags(note.tags);
  const tagsCount = normalizeTags(note.tags).length;

  return (
    <button
      type="button"
      className={`noteItem ${isSelected ? "noteItemActive" : ""}`}
      onClick={() => onSelect(note.id)}
      role="listitem"
      aria-label={`Open note: ${note.title || "Untitled note"}`}
      aria-current={isSelected ? "true" : "false"}
      tabIndex={isSelected ? 0 : -1}
    >
      <div className="noteTitle">{note.title || "Untitled note"}</div>

      {tagsCount > 0 && (
        <div className="noteTags" aria-label={`Tags: ${tagsLabel}`}>
          {tagsLabel}
        </div>
      )}

      <div className="noteSnippet">{snippet(note.body)}</div>
      <div className="noteMeta">
        <span title={`Updated ${note.updatedAt}`}>{formatRelativeDate(note.updatedAt)}</span>
        <span>{countWords(note.body)} words</span>
      </div>
    </button>
  );
});

/** PUBLIC_INTERFACE
 * Notes list panel with selectable notes and empty state.
 */
export function NotesList({ notesCount, filteredNotes, selectedId, onSelectNote, onCreate }) {
  /** This is a public function. */
  const scrollRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(640);

  const shouldVirtualize = filteredNotes.length > 80;

  const onScroll = useCallback((e) => {
    const el = e.currentTarget;
    setScrollTop(el.scrollTop || 0);
    setViewportHeight(el.clientHeight || 0);
  }, []);

  const onSelect = useCallback(
    (id) => {
      onSelectNote?.(id);
    },
    [onSelectNote]
  );

  const selectedIndex = useMemo(() => {
    if (!selectedId) return -1;
    return filteredNotes.findIndex((n) => n.id === selectedId);
  }, [filteredNotes, selectedId]);

  const virtual = useMemo(() => {
    if (!shouldVirtualize) {
      return { start: 0, end: filteredNotes.length, offsetY: 0, total: 0 };
    }

    const total = filteredNotes.length * ITEM_HEIGHT;
    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / ITEM_HEIGHT) + OVERSCAN * 2;
    const end = Math.min(filteredNotes.length, start + visibleCount);
    const offsetY = start * ITEM_HEIGHT;

    return { start, end, offsetY, total };
  }, [filteredNotes.length, scrollTop, viewportHeight, shouldVirtualize]);

  const visibleNotes = useMemo(() => {
    if (!shouldVirtualize) return filteredNotes;
    return filteredNotes.slice(virtual.start, virtual.end);
  }, [filteredNotes, shouldVirtualize, virtual.end, virtual.start]);

  const listLabel =
    filteredNotes.length === 0
      ? "Notes (empty)"
      : shouldVirtualize
        ? `Notes list (virtualized), ${filteredNotes.length} items`
        : `Notes list, ${filteredNotes.length} items`;

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

      <div
        ref={scrollRef}
        className="listScroll"
        role="list"
        aria-label={listLabel}
        aria-activedescendant={selectedId ? `note-${selectedId}` : undefined}
        onScroll={onScroll}
      >
        {filteredNotes.length === 0 ? (
          <div className="emptyState">
            <div className="emptyTitle">{notesCount === 0 ? "No notes yet" : "No matches"}</div>
            <div className="emptyText">
              {notesCount === 0
                ? "Create your first note to start writing."
                : "Try a different search, or create a new note."}
            </div>
            <button type="button" className="btn btnPrimary btnSmall" onClick={onCreate}>
              <span aria-hidden="true">＋</span> Add note
            </button>
          </div>
        ) : shouldVirtualize ? (
          <div className="virtualList" style={{ height: virtual.total }}>
            <div className="virtualSpacer" style={{ transform: `translateY(${virtual.offsetY}px)` }}>
              {visibleNotes.map((n) => (
                <div id={`note-${n.id}`} key={n.id}>
                  <NoteRow note={n} isSelected={n.id === selectedId} onSelect={onSelect} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          filteredNotes.map((n, idx) => (
            <div id={`note-${n.id}`} key={n.id}>
              <NoteRow note={n} isSelected={n.id === selectedId} onSelect={onSelect} />
              {/* If nothing is selected, allow first item to be tabbable for accessibility */}
              {idx === 0 && selectedIndex === -1 ? null : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
