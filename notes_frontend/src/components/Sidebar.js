import React from "react";
import { iconBox } from "./utils";

/** PUBLIC_INTERFACE
 * Sidebar navigation for the Personal Notes app.
 */
export function Sidebar({
  activeNav,
  setActiveNav,
  notesCount,
  backendMode,
  backendStatus
}) {
  /** This is a public function. */
  return (
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
          <span className="badge" aria-label={`${notesCount} total notes`}>
            {notesCount}
          </span>
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
  );
}
