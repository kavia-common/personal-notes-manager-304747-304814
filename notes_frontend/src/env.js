/**
 * Environment helpers. We intentionally treat env vars as potentially empty.
 */

/** PUBLIC_INTERFACE
 * Returns a normalized, trimmed environment variable value (or empty string).
 */
export function getEnv(name) {
  /** This is a public function. */
  return String(process.env[name] ?? "").trim();
}

/** PUBLIC_INTERFACE
 * Returns a best-effort API base URL for a backend, if configured.
 * If empty, the app will fall back to in-memory notes storage.
 */
export function getApiBaseUrl() {
  /** This is a public function. */
  // Prefer explicit API base if set; otherwise use backend URL.
  return getEnv("REACT_APP_API_BASE") || getEnv("REACT_APP_BACKEND_URL");
}

/** PUBLIC_INTERFACE
 * Returns whether the app should attempt backend calls.
 */
export function hasBackendConfigured() {
  /** This is a public function. */
  return Boolean(getApiBaseUrl());
}
