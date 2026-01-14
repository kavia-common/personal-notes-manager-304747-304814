import React from "react";

/** PRIVATE
 * Format an ISO timestamp into a short locale date label.
 */
export function formatShortDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "2-digit" });
  } catch {
    return "";
  }
}

/** PRIVATE
 * Create a compact single-line snippet for list display.
 */
export function snippet(text) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > 120 ? `${t.slice(0, 120)}…` : t;
}

/** PRIVATE
 * Count words in a note body.
 */
export function countWords(text) {
  const t = String(text ?? "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** PRIVATE
 * Render a small icon box used in the sidebar nav.
 */
export function iconBox(text) {
  return (
    <span className="navIcon" aria-hidden="true">
      {text}
    </span>
  );
}
