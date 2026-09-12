/**
 * Post-login destinations arrive from a query param, so they are attacker
 * controllable. Only same-origin absolute paths are honoured — anything else
 * (a full URL, a protocol-relative "//evil.test", a scheme) would turn the
 * login page into an open redirect.
 */
export const DEFAULT_NEXT = "/library";

export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return DEFAULT_NEXT;
  }

  // Backslashes are normalised to forward slashes by some browsers, so "/\evil"
  // can escape the origin the same way "//evil" does.
  if (next.startsWith("/\\")) {
    return DEFAULT_NEXT;
  }

  return next;
}
