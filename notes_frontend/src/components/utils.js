import React from "react";

/** PRIVATE
 * Format an ISO timestamp into a short locale date label.
 * Kept for existing UI usage; now uses a slightly richer format.
 */
export function formatShortDate(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, { month: "short", day: "2-digit" });
  } catch {
    return "";
  }
}

/** PRIVATE
 * Format an ISO timestamp into a readable full date/time.
 */
export function formatDateTime(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

/** PRIVATE
 * Format an ISO timestamp as a friendly relative label (e.g., "3m ago", "yesterday"),
 * falling back to a locale date for older items.
 */
export function formatRelativeDate(iso, now = new Date()) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const diffMs = now.getTime() - d.getTime();

    // Future timestamps (clock skew): just show absolute time.
    if (diffMs < 0) return formatDateTime(iso);

    const sec = Math.floor(diffMs / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);

    if (sec < 45) return "just now";
    if (min < 60) return `${min}m ago`;
    if (hr < 24) return `${hr}h ago`;
    if (day === 1) return "yesterday";
    if (day < 7) return `${day}d ago`;

    return formatShortDate(iso);
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
 * Normalize a tags value into an array of trimmed unique-ish strings.
 * Accepts array or comma-separated string.
 */
export function normalizeTags(input) {
  const raw = input ?? [];
  const arr = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

  // Keep order stable while removing duplicates (case-insensitive).
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** PRIVATE
 * Render tags as a compact comma-separated label.
 */
export function formatTags(tags) {
  const t = normalizeTags(tags);
  return t.join(", ");
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
