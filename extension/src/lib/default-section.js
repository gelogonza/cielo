/**
 * The popup lets the user pick a section that every right-click save drops
 * into. The chosen id is stored locally, but the section itself lives on the
 * server and can be renamed or deleted from the web app — so the stored id is
 * always re-checked against the live list rather than trusted.
 *
 * A null result means "General", which is the computed all-items view rather
 * than a real section, so it is never sent as a sectionId.
 */
export const GENERAL = { id: null, name: "General" };

/**
 * @param {string | null | undefined} storedId
 * @param {{ id: string, name: string }[]} [sections]
 */
export function resolveDefaultSection(storedId, sections = []) {
  if (!storedId) {
    return GENERAL;
  }

  const match = sections.find((section) => section.id === storedId);

  // The section was deleted (or belongs to a different account) — fall back to
  // General rather than saving into a section that no longer exists.
  return match ? { id: match.id, name: match.name } : GENERAL;
}
