/**
 * Decides which of the three popup states from the design (Figma node 1:9)
 * to render: signed out, ready, or the result of the last save.
 *
 * A save outcome wins over the ready state so the popup can confirm what just
 * happened; the caller clears the stored outcome once it has been shown, so
 * reopening the popup later falls back to ready.
 */
/**
 * @typedef {object} SaveOutcome
 * @property {string} status "success" | "signed_out" | "error"
 * @property {string} [title]
 * @property {string | null} [thumbnailUrl]
 * @property {string} [sectionName]
 * @property {boolean} [reused]
 * @property {string} [message]
 *
 * @param {object} input
 * @param {boolean} input.signedIn
 * @param {SaveOutcome | null} [input.outcome]
 */
export function resolvePopupState({ signedIn, outcome = null }) {
  // A 401 recorded during a save is more current than the cookie check, which
  // only proves a cookie exists — not that the session behind it is still good.
  if (!signedIn || outcome?.status === "signed_out") {
    return { kind: "signed-out" };
  }

  if (outcome?.status === "success") {
    return {
      kind: "saved",
      title: outcome.title ?? "Saved",
      thumbnailUrl: outcome.thumbnailUrl ?? null,
      sectionName: outcome.sectionName ?? "General",
      reused: Boolean(outcome.reused),
    };
  }

  if (outcome?.status === "error") {
    return { kind: "error", message: outcome.message || "Something went wrong saving that page." };
  }

  return { kind: "ready" };
}
