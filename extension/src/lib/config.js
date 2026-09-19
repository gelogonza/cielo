/**
 * Where the extension talks to Cielo.
 *
 * The URL is user-editable (Options page) rather than baked in at build time,
 * so one build works against a local dev server and a deployed app. Everything
 * else in the extension goes through `getApiBaseUrl()` — nothing imports a
 * constant, because the stored value can change while the worker is alive.
 */
export const DEFAULT_API_BASE_URL = "http://localhost:3000";

const STORAGE_KEY = "apiBaseUrl";

/** Hosts that are almost certainly a local dev server, so http, not https. */
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i;

/**
 * Turns what a person actually types into an origin, or null if it cannot be
 * one. Accepts a bare host ("cielo.app", "localhost:3000") and drops any path,
 * query or hash — every caller appends its own path.
 *
 * Pure, so the rules are testable without a `chrome` global.
 */
export function normalizeBaseUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  let candidate = trimmed;

  if (!/^https?:\/\//i.test(trimmed)) {
    // Some other scheme was spelled out — file://, chrome-extension:// — and
    // guessing http in front of it would quietly parse into nonsense.
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
      return null;
    }

    candidate = `${LOOPBACK.test(trimmed) ? "http" : "https"}://${trimmed}`;
  }

  let url;

  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  return url.hostname ? url.origin : null;
}

/** The configured origin, falling back to the dev server. */
export async function getApiBaseUrl() {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeBaseUrl(stored[STORAGE_KEY]) ?? DEFAULT_API_BASE_URL;
  } catch {
    // Storage is unavailable (or this is a bare test harness); the default
    // still lets the extension work against a local app.
    return DEFAULT_API_BASE_URL;
  }
}

/**
 * Stores a new origin. Returns the normalized value, or null if the input was
 * not a usable http(s) address — in which case nothing is written.
 */
export async function setApiBaseUrl(value) {
  const normalized = normalizeBaseUrl(value);

  if (!normalized) {
    return null;
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}
