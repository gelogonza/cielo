import { describe, expect, it } from "vitest";
import {
  isAllowedImageType,
  itemImageUrl,
  objectKeyFor,
  ownsObjectKey,
} from "@/lib/storage/item-images";

describe("objectKeyFor", () => {
  it("puts the owner first, because every storage policy keys off that", () => {
    expect(objectKeyFor("user-1", "image/png", "abc")).toBe("user-1/abc.png");
  });

  it("maps each allowed type to a sensible extension", () => {
    expect(objectKeyFor("u", "image/jpeg", "a")).toBe("u/a.jpg");
    expect(objectKeyFor("u", "image/webp", "a")).toBe("u/a.webp");
    expect(objectKeyFor("u", "image/avif", "a")).toBe("u/a.avif");
  });

  it("drops the original filename", () => {
    // Filenames say more about people than they realise, and Cielo uses none
    // of it.
    const key = objectKeyFor("user-1", "image/png", "abc");

    expect(key).not.toContain("holiday");
    expect(key.split("/")[1]).toBe("abc.png");
  });
});

describe("ownsObjectKey", () => {
  it("accepts this user's own key", () => {
    expect(ownsObjectKey("user-1", "user-1/abc.png")).toBe(true);
  });

  it("rejects another user's key", () => {
    // The confirm step takes the key from the request body, so without this a
    // crafted body could point an item at someone else's object.
    expect(ownsObjectKey("user-1", "user-2/abc.png")).toBe(false);
  });

  it("rejects traversal and nesting", () => {
    expect(ownsObjectKey("user-1", "user-1/../user-2/abc.png")).toBe(false);
    expect(ownsObjectKey("user-1", "user-1/nested/abc.png")).toBe(false);
    expect(ownsObjectKey("user-1", "../user-1/abc.png")).toBe(false);
  });

  it("rejects a bare or hidden name", () => {
    expect(ownsObjectKey("user-1", "user-1/")).toBe(false);
    expect(ownsObjectKey("user-1", "user-1")).toBe(false);
    expect(ownsObjectKey("user-1", "user-1/.hidden")).toBe(false);
    expect(ownsObjectKey("user-1", "")).toBe(false);
  });

  it("rejects a key whose owner merely starts the same", () => {
    expect(ownsObjectKey("user-1", "user-10/abc.png")).toBe(false);
  });
});

describe("isAllowedImageType", () => {
  it("allows the formats the bucket allows", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]) {
      expect(isAllowedImageType(type)).toBe(true);
    }
  });

  it("refuses anything else, including things that merely look like images", () => {
    expect(isAllowedImageType("image/svg+xml")).toBe(false);
    expect(isAllowedImageType("application/pdf")).toBe(false);
    expect(isAllowedImageType("text/html")).toBe(false);
    expect(isAllowedImageType("")).toBe(false);
  });
});

describe("itemImageUrl", () => {
  it("is a stable path, not a signed url that expires", () => {
    expect(itemImageUrl("item-1")).toBe("/api/items/item-1/image");
  });
});
