import { getEnv } from "../env";
import * as notesStore from "../notesStore";
import { createHttpService } from "./httpService";
import { createLocalService } from "./localService";

/**
 * Data-service abstraction layer.
 * Exposes a single CRUD surface used by the UI and selects an implementation at runtime.
 */

/** PRIVATE */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** PRIVATE */
function getApiBase() {
  // Requirement: auto-select HttpService if REACT_APP_API_BASE is a non-empty string; else local.
  return getEnv("REACT_APP_API_BASE");
}

/** PRIVATE */
function chooseService() {
  const apiBase = getApiBase();
  if (isNonEmptyString(apiBase)) {
    return createHttpService({ apiBase });
  }
  return createLocalService({ store: notesStore });
}

// We intentionally create a singleton so the app uses one adapter instance everywhere.
const service = chooseService();

/** PUBLIC_INTERFACE
 * Returns the currently-selected service instance ("http" or "local") for display/debugging.
 */
export function getServiceInfo() {
  /** This is a public function. */
  return { kind: service.kind };
}

/** PUBLIC_INTERFACE
 * List notes.
 */
export async function listNotes() {
  /** This is a public function. */
  return service.listNotes();
}

/** PUBLIC_INTERFACE
 * Create a note.
 */
export async function createNote(note) {
  /** This is a public function. */
  return service.createNote(note);
}

/** PUBLIC_INTERFACE
 * Update a note by id with a patch.
 */
export async function updateNote(id, patch) {
  /** This is a public function. */
  return service.updateNote(id, patch);
}

/** PUBLIC_INTERFACE
 * Delete a note by id.
 */
export async function deleteNote(id) {
  /** This is a public function. */
  return service.deleteNote(id);
}
