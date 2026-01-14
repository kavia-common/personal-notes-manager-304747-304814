import React from "react";

/** PUBLIC_INTERFACE
 * Toast notification shown in the bottom-right.
 */
export function Toast({ toast }) {
  /** This is a public function. */
  if (!toast) return null;

  return (
    <div className="toastWrap" aria-live="polite" aria-atomic="true">
      <div className={`toast ${toast.type === "error" ? "toastError" : ""}`} role="status">
        <div className="toastIcon" aria-hidden="true" />
        <div className="toastBody">
          <div className="toastTitle">{toast.title}</div>
          <div className="toastMsg">{toast.msg}</div>
        </div>
      </div>
    </div>
  );
}
