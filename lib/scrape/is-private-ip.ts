// SSRF guard: blocks fetches to internal/private address space (including
// the 169.254.169.254 cloud metadata endpoint) when scraping a user-
// submitted URL. This is a preflight check on the resolved address, not a
// full defense — it doesn't re-validate at connection time, so a DNS
// answer that changes between this check and the fetch (DNS rebinding)
// could still slip through. Acceptable for MVP; harden before scaling.
export function isPrivateIp(ip: string): boolean {
  if (ip === "::1") {
    return true;
  }

  if (ip.includes(":")) {
    const normalized = ip.toLowerCase();
    return (
      normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")
    );
  }

  return (
    /^127\./.test(ip) ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    /^169\.254\./.test(ip)
  );
}
