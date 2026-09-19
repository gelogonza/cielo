import { describe, expect, it } from "vitest";
import { normalizeUrl } from "@/lib/url/normalize-url";

describe("normalizeUrl", () => {
  it("writes the empty path, so a bare origin has one spelling", () => {
    // The whole point: this and "https://mymind.com/" must not be two items.
    expect(normalizeUrl("https://mymind.com")).toBe("https://mymind.com/");
    expect(normalizeUrl("https://mymind.com/")).toBe("https://mymind.com/");
  });

  it("lowercases the scheme and host but not the path", () => {
    expect(normalizeUrl("HTTPS://MyMind.com/Some/Path")).toBe("https://mymind.com/Some/Path");
  });

  it("drops a default port and keeps a real one", () => {
    expect(normalizeUrl("https://mymind.com:443/x")).toBe("https://mymind.com/x");
    expect(normalizeUrl("http://localhost:3000/library")).toBe("http://localhost:3000/library");
  });

  it("keeps the query string, which is sometimes the whole address", () => {
    expect(normalizeUrl("https://youtube.com/watch?v=abc&t=30")).toBe(
      "https://youtube.com/watch?v=abc&t=30",
    );
  });

  it("keeps the text fragment that makes two highlights two items", () => {
    const highlight = "https://mymind.com/#:~:text=Remember%20everything.";
    expect(normalizeUrl(highlight)).toBe(highlight);
  });

  it("ignores surrounding whitespace", () => {
    expect(normalizeUrl("  https://mymind.com/x  ")).toBe("https://mymind.com/x");
  });

  it("is idempotent, so it can be applied to rows saved before it existed", () => {
    for (const raw of [
      "https://mymind.com",
      "HTTPS://MyMind.com:443",
      "https://x.com/a b",
      "https://mymind.com#:~:text=Folders%20are%20dead.",
      "https://youtube.com/watch?v=abc",
    ]) {
      const once = normalizeUrl(raw);
      expect(normalizeUrl(once)).toBe(once);
    }
  });

  it("rejects a scheme Cielo could never open", () => {
    expect(normalizeUrl("javascript:void(0)")).toBeNull();
    expect(normalizeUrl("place:sort=8")).toBeNull();
    expect(normalizeUrl("file:///Users/me/notes.txt")).toBeNull();
    expect(normalizeUrl("data:text/plain,hi")).toBeNull();
  });

  it("rejects what is not a URL at all", () => {
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl(undefined)).toBeNull();
  });
});
