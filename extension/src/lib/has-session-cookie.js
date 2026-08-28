// Matches @supabase/ssr's cookie naming: `sb-<project-ref>-auth-token`,
// optionally chunked as `.0`, `.1`, ... for large JWTs. Verified against
// the installed @supabase/ssr package's own source (clearAuthCookiesAtScopes.js,
// cookies.js) rather than assumed — this is an internal convention, not a
// documented public API, so it's worth re-checking if @supabase/ssr is
// upgraded and the extension's "log in" prompt starts looking stale.
const SESSION_COOKIE_PATTERN = /^sb-.+-auth-token(\.\d+)?$/;

export function hasSessionCookie(cookies) {
  return cookies.some((cookie) => SESSION_COOKIE_PATTERN.test(cookie.name));
}
