/**
 * HttpService: uses fetch against `${REACT_APP_API_BASE}/notes`.
 * Contract assumed:
 * - GET /notes -> array of notes
 * - POST /notes with {title, body, tags?} -> created note
 * - PUT /notes/:id with patch {title?, body?, tags?} -> updated note
 * - DELETE /notes/:id -> 204/200
 *
 * Notes are expected to include {id,title,body,createdAt,updatedAt}.
 */

/** PRIVATE */
function joinUrl(base, path) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "");
  return `${b}${p.startsWith("/") ? "" : "/"}${p}`;
}

/** PRIVATE */
async function readErrorBody(res) {
  try {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await res.json();
      // Common patterns: {message}, {detail}, or a string.
      const msg =
        (json && typeof json === "object" && (json.message || json.detail)) ||
        (typeof json === "string" ? json : "");
      return msg ? String(msg) : JSON.stringify(json);
    }
    const text = await res.text();
    return text || "";
  } catch {
    return "";
  }
}

/** PRIVATE */
function normalizeRemoteNote(n) {
  const now = new Date().toISOString();

  // tags can be an array (preferred) or a comma-separated string depending on backend implementation.
  const rawTags = n?.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags.map((t) => String(t ?? "").trim()).filter(Boolean)
    : String(rawTags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

  return {
    id: String(n?.id ?? ""),
    title: String(n?.title ?? "Untitled note"),
    body: String(n?.body ?? ""),
    tags,
    createdAt: String(n?.createdAt ?? now),
    updatedAt: String(n?.updatedAt ?? n?.createdAt ?? now)
  };
}

/** PRIVATE */
function assertOkId(note) {
  if (!note?.id) throw new Error("Backend returned a note without an id.");
}

/** PUBLIC_INTERFACE
 * Create an HttpService instance.
 */
export function createHttpService({ apiBase }) {
  /** This is a public function. */
  if (!apiBase || !String(apiBase).trim()) {
    throw new Error("HttpService requires a non-empty apiBase.");
  }

  async function fetchJson(path, options) {
    const url = joinUrl(apiBase, path);
    let res;
    try {
      res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
        ...options
      });
    } catch (e) {
      throw new Error(`Network error while calling backend: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (!res.ok) {
      const body = await readErrorBody(res);
      const suffix = body ? `: ${body}` : "";
      throw new Error(`Backend request failed (${res.status})${suffix}`);
    }

    // 204 No Content
    if (res.status === 204) return null;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      // Some backends might still return JSON without correct content-type; try anyway.
      try {
        return await res.json();
      } catch {
        return null;
      }
    }

    return res.json();
  }

  return {
    kind: "http",

    async listNotes() {
      const data = await fetchJson("/notes", { method: "GET" });
      if (!Array.isArray(data)) throw new Error("Unexpected backend response for GET /notes (expected array).");
      return data.map(normalizeRemoteNote).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    },

    async createNote(note) {
      const created = await fetchJson("/notes", {
        method: "POST",
        body: JSON.stringify({
          title: note?.title ?? "Untitled note",
          body: note?.body ?? "",
          tags: Array.isArray(note?.tags) ? note.tags : undefined
        })
      });
      const normalized = normalizeRemoteNote(created);
      assertOkId(normalized);
      return normalized;
    },

    async updateNote(id, patch) {
      const safePatch = patch ?? {};
      const updated = await fetchJson(`/notes/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(safePatch)
      });
      const normalized = normalizeRemoteNote({ ...(updated ?? {}), id: updated?.id ?? id });
      assertOkId(normalized);
      return normalized;
    },

    async deleteNote(id) {
      await fetchJson(`/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
      return { ok: true };
    }
  };
}
