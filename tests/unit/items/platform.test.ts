import { describe, expect, it } from "vitest";
import { detectPlatform, sourceLabel, toSourcePlatform } from "@/lib/items/platform";

describe("toSourcePlatform", () => {
  it.each([
    ["tiktok", "tiktok"],
    ["instagram", "instagram"],
    ["x", "x"],
    ["web", "web"],
  ])("passes through the stored platform %s", (stored, expected) => {
    expect(toSourcePlatform(stored)).toBe(expected);
  });

  it("treats a null platform as a direct upload", () => {
    expect(toSourcePlatform(null)).toBe("upload");
  });

  it("falls back to upload for an unrecognised platform", () => {
    expect(toSourcePlatform("myspace")).toBe("upload");
  });
});

describe("detectPlatform", () => {
  it.each([
    ["https://www.tiktok.com/@user/video/123", "tiktok"],
    ["https://vm.tiktok.com/abc", "tiktok"],
    ["https://instagram.com/p/abc", "instagram"],
    ["https://www.instagram.com/reel/abc", "instagram"],
    ["https://x.com/user/status/1", "x"],
    ["https://twitter.com/user/status/1", "x"],
    ["https://are.na/block/28417", "web"],
  ])("classifies %s as %s", (url, expected) => {
    expect(detectPlatform(url)).toBe(expected);
  });

  it("accepts a url without a protocol", () => {
    expect(detectPlatform("tiktok.com/@user")).toBe("tiktok");
  });

  it("does not match a lookalike host as a platform", () => {
    expect(detectPlatform("https://nottiktok.com/x")).toBe("web");
    expect(detectPlatform("https://tiktok.com.evil.test/x")).toBe("web");
  });

  it("falls back to web for an unparseable url", () => {
    expect(detectPlatform("::: not a url :::")).toBe("web");
  });
});

describe("sourceLabel", () => {
  it("strips the www prefix", () => {
    expect(sourceLabel("https://www.tiktok.com/@user")).toBe("tiktok.com");
  });

  it("returns null for a direct upload with no url", () => {
    expect(sourceLabel(null)).toBeNull();
  });
});
