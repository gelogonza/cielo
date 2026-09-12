/**
 * Normalises what an OS share sheet hands us. Apps are inconsistent about
 * which field carries the link: Chrome sends it in `url`, but plenty of apps
 * (and every "share as text" path) bury it inside `text` alongside a title or
 * a quote, so both are searched.
 */
export interface SharedPayload {
  url?: string | null;
  text?: string | null;
  title?: string | null;
}

export interface SharedLink {
  url: string;
  title: string | null;
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i;

export function extractSharedLink(payload: SharedPayload): SharedLink | null {
  const url = firstUrl(payload.url) ?? firstUrl(payload.text);

  if (!url) {
    return null;
  }

  // When the link came out of `text`, whatever else was in there is usually
  // the shared page's title — but only if a separate title wasn't supplied.
  const remainder = payload.title?.trim() || leftoverText(payload.text, url);

  return { url, title: remainder || null };
}

function firstUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const match = trimmed.match(URL_IN_TEXT);

  if (match) {
    return stripTrailingPunctuation(match[0]);
  }

  // A bare host like "are.na/block/1" — accepted so a pasted link without a
  // scheme still works, but only when it really looks like a host.
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(trimmed)) {
    return `https://${stripTrailingPunctuation(trimmed)}`;
  }

  return null;
}

function stripTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:!?)\]]+$/, "");
}

function leftoverText(text: string | null | undefined, url: string): string | null {
  if (!text) {
    return null;
  }

  const rest = text.replace(URL_IN_TEXT, "").replace(/\s+/g, " ").trim();
  return rest && rest !== url ? rest : null;
}
