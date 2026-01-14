import React, { useMemo } from "react";
import { renderMarkdownToHtml } from "../markdown";
import { formatShortDate } from "./utils";

/** PUBLIC_INTERFACE
 * Editor panel for a selected note, including markdown preview.
 */
export function Editor({
  selectedNote,
  draftTitle,
  setDraftTitle,
  draftBody,
  setDraftBody,
  isDirty,
  setIsDirty,
  onCreate,
  onSave
}) {
  /** This is a public function. */
  const previewHtml = useMemo(() => renderMarkdownToHtml(draftBody), [draftBody]);

  return (
    <section className="panel surface editorWrap" aria-label="Note editor and preview">
      {!selectedNote ? (
        <div className="emptyState">
          <div className="emptyTitle">No note selected</div>
          <div className="emptyText">Create a note or select one from the list to start writing.</div>
          <button type="button" className="btn btnPrimary btnSmall" onClick={onCreate}>
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
              <span className="badge" title="Markdown enabled">
                Markdown
              </span>
              <button
                type="button"
                className="btn btnGhost btnSmall"
                onClick={onSave}
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
  );
}
