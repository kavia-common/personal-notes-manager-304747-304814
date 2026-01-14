import React from "react";

/** PUBLIC_INTERFACE
 * Topbar containing search input and global actions (create/save/delete).
 */
export function Topbar({
  query,
  setQuery,
  filteredCount,
  activeNav,
  onCreate,
  onSave,
  onDelete,
  onOpenSettings,
  canSave,
  canDelete,
  saveStatus,
  searchInputRef
}) {
  /** This is a public function. */

  const showStatus = activeNav === "notes" && saveStatus && saveStatus !== "hidden";

  const statusLabel =
    saveStatus === "dirty" ? "Unsaved" : saveStatus === "saving" ? "Saving…" : "Saved";

  const statusClass =
    saveStatus === "dirty"
      ? "statusPill statusDirty"
      : saveStatus === "saving"
        ? "statusPill statusSaving"
        : "statusPill statusSaved";

  return (
    <header className="topbar surface" aria-label="Top bar">
      <div className="searchRow" role="search" aria-label="Search">
        <input
          id="notes-search"
          ref={searchInputRef}
          className="searchInput"
          type="search"
          placeholder="Search notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search notes"
        />
        <span className="badge" aria-label="Filtered notes count">
          {filteredCount} shown
        </span>
      </div>

      <div className="actions" aria-label="Actions">
        {showStatus && (
          <span
            className={statusClass}
            role="status"
            aria-live="polite"
            aria-label={`Save status: ${statusLabel}`}
            title="Autosave status"
          >
            <span className="statusDot" aria-hidden="true" />
            {statusLabel}
          </span>
        )}

        <button type="button" className="btn btnPrimary" onClick={onCreate} aria-label="Create a new note">
          <span aria-hidden="true">＋</span> Add note
        </button>

        <button
          type="button"
          className="btn btnGhost"
          onClick={onOpenSettings}
          title="Open settings"
          aria-label="Open settings"
        >
          Settings
        </button>

        {activeNav === "notes" && (
          <>
            <button
              type="button"
              className="btn btnGhost"
              onClick={onSave}
              disabled={!canSave}
              aria-disabled={!canSave}
              title={!canSave ? "No changes to save" : "Save changes"}
              aria-label={!canSave ? "Save (disabled)" : "Save note"}
            >
              Save
            </button>
            <button
              type="button"
              className="btn btnDanger"
              onClick={onDelete}
              disabled={!canDelete}
              aria-disabled={!canDelete}
              aria-label={!canDelete ? "Delete (disabled)" : "Delete note"}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </header>
  );
}
