import React, { useEffect, useId, useRef, useState } from "react";

/** PUBLIC_INTERFACE
 * Settings panel shown as a routing-less modal. Provides Reset/Export/Import for local notes.
 */
export function SettingsPanel({
  open,
  onClose,
  notesCount,
  onResetAll,
  onExport,
  onImportJsonText
}) {
  /** This is a public function. */
  const titleId = useId();
  const descId = useId();
  const fileInputId = useId();
  const dialogRef = useRef(null);
  const fileRef = useRef(null);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement;

    // Focus management: focus first meaningful control when opened.
    const t = window.setTimeout(() => {
      const first =
        dialogRef.current?.querySelector?.(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || dialogRef.current;
      try {
        first?.focus?.();
      } catch {
        // ignore
      }
    }, 0);

    function getFocusable(container) {
      if (!container) return [];
      const nodes = Array.from(
        container.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      return nodes.filter((n) => n && n.offsetParent !== null);
    }

    // Escape closes; Tab traps focus inside.
    // PUBLIC_INTERFACE
    function onKeyDown(e) {
      /** Modal key handler: Escape to close and Tab to trap focus. */
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }

      if (e.key === "Tab") {
        const focusables = getFocusable(dialogRef.current);
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || active === dialogRef.current) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);

      // Restore focus if parent didn't already.
      try {
        previouslyFocused?.focus?.();
      } catch {
        // ignore
      }
    };
  }, [open, onClose]);

  async function handleReset() {
    const ok = window.confirm(
      "Reset will permanently remove all notes stored in this browser. Continue?"
    );
    if (!ok) return;

    setBusy(true);
    try {
      await onResetAll?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setBusy(true);
    try {
      await onExport?.();
    } finally {
      setBusy(false);
    }
  }

  async function handlePickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    try {
      const text = await file.text();
      await onImportJsonText?.(text);
      // Clear selection so the same file can be re-selected if desired.
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="modalOverlay"
      role="presentation"
      onMouseDown={(e) => {
        // Close if clicking the overlay (outside the dialog)
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <section
        className="modalCard surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="modalHeader">
          <div>
            <div className="panelTitle" id={titleId}>
              Settings
            </div>
            <div className="panelSub" id={descId}>
              Local notes tools · <span className="badge">{notesCount} notes</span>
            </div>
          </div>

          <button type="button" className="btn btnGhost btnSmall" onClick={onClose} aria-label="Close settings">
            Close
          </button>
        </div>

        <div className="modalBody">
          <div className="settingsGrid" aria-label="Settings actions">
            <div className="settingsRow">
              <div className="settingsInfo">
                <div className="settingsTitle">Export</div>
                <div className="settingsText">Download your current notes as a JSON file.</div>
              </div>
              <button
                type="button"
                className="btn btnGhost"
                onClick={handleExport}
                disabled={busy}
                aria-disabled={busy}
              >
                Download JSON
              </button>
            </div>

            <div className="settingsRow">
              <div className="settingsInfo">
                <div className="settingsTitle">Import</div>
                <div className="settingsText">
                  Upload a JSON export to replace your current local notes.
                </div>
              </div>

              <div className="settingsActions">
                <input
                  id={fileInputId}
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="fileInput"
                  onChange={handlePickFile}
                  disabled={busy}
                  aria-disabled={busy}
                  aria-label="Import notes JSON file"
                />
                <label htmlFor={fileInputId} className={`btn btnPrimary ${busy ? "btnDisabled" : ""}`}>
                  Choose file…
                </label>
              </div>
            </div>

            <div className="settingsRow">
              <div className="settingsInfo">
                <div className="settingsTitle">Reset</div>
                <div className="settingsText">
                  Remove all local notes from this browser. This cannot be undone.
                </div>
              </div>
              <button
                type="button"
                className="btn btnDanger"
                onClick={handleReset}
                disabled={busy}
                aria-disabled={busy}
              >
                Reset notes
              </button>
            </div>

            <div className="settingsRow">
              <div className="settingsInfo">
                <div className="settingsTitle">About</div>
                <div className="settingsText">
                  Personal Notes is a lightweight, local-first notes app with markdown preview and autosave.
                </div>
              </div>
              <div className="badge" title="Theme">
                Ocean Professional
              </div>
            </div>
          </div>

          <div className="smallText">
            Tip: Export regularly before clearing browser storage or switching devices.
          </div>
        </div>
      </section>
    </div>
  );
}

export default SettingsPanel;
