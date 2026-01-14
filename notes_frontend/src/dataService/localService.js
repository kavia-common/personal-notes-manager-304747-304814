/**
 * LocalService: wraps the existing localStorage-backed notesStore module.
 * This preserves the existing createdAt/updatedAt semantics and id handling.
 */

/** PRIVATE */
function asMessage(err) {
  if (!err) return "Unknown error";
  if (err instanceof Error) return err.message || "Unknown error";
  return String(err);
}

/** PUBLIC_INTERFACE
 * Create a LocalService instance.
 */
export function createLocalService({ store }) {
  /** This is a public function. */
  if (!store) throw new Error("LocalService requires a notes store implementation.");

  return {
    kind: "local",

    async listNotes() {
      try {
        // notesStore.listNotes() is synchronous; we wrap in async to match interface.
        return store.listNotes();
      } catch (e) {
        throw new Error(`Failed to load notes from local storage. ${asMessage(e)}`.trim());
      }
    },

    async createNote(note) {
      try {
        const created = store.createNote({
          title: note?.title ?? "",
          body: note?.body ?? ""
        });
        return created;
      } catch (e) {
        throw new Error(`Failed to create note in local storage. ${asMessage(e)}`.trim());
      }
    },

    async updateNote(id, patch) {
      try {
        const updated = store.updateNote(id, patch);
        if (!updated) {
          throw new Error("Note not found.");
        }
        return updated;
      } catch (e) {
        throw new Error(`Failed to update note in local storage. ${asMessage(e)}`.trim());
      }
    },

    async deleteNote(id) {
      try {
        const ok = store.deleteNote(id);
        if (!ok) {
          throw new Error("Note not found.");
        }
        return { ok: true };
      } catch (e) {
        throw new Error(`Failed to delete note in local storage. ${asMessage(e)}`.trim());
      }
    }
  };
}
