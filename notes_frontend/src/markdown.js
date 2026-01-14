import { marked } from "marked";

/**
 * Configure marked to be deterministic and conservative.
 * Note: marked does not sanitize by default; we do minimal defense and keep preview local-only.
 */
marked.setOptions({
  headerIds: false,
  mangle: false,
  breaks: true
});

function stripDangerous(html) {
  // Minimal hardening. For production-grade sanitization, use DOMPurify.
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
}

/** PUBLIC_INTERFACE
 * Render markdown into safe-ish HTML for preview.
 */
export function renderMarkdownToHtml(markdownText) {
  /** This is a public function. */
  const md = String(markdownText ?? "");
  const html = marked.parse(md);
  return stripDangerous(html);
}
