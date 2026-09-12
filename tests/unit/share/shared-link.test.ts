import { describe, expect, it } from "vitest";
import { extractSharedLink } from "@/lib/share/shared-link";

describe("extractSharedLink", () => {
  it("prefers the url field when the share sheet supplies one", () => {
    expect(
      extractSharedLink({ url: "https://are.na/block/1", text: "https://other.test/x" }),
    ).toMatchObject({ url: "https://are.na/block/1" });
  });

  it("digs the link out of text when no url field was sent", () => {
    expect(
      extractSharedLink({ text: "Check this https://tiktok.com/@user/video/1" }),
    ).toMatchObject({ url: "https://tiktok.com/@user/video/1" });
  });

  it("keeps the surrounding text as the title", () => {
    expect(extractSharedLink({ text: "Poster archive https://are.na/block/1" })).toEqual({
      url: "https://are.na/block/1",
      title: "Poster archive",
    });
  });

  it("lets an explicit title win over text scraps", () => {
    expect(
      extractSharedLink({ title: "Swiss grid", text: "junk https://are.na/block/1" }),
    ).toMatchObject({ title: "Swiss grid" });
  });

  it("accepts a pasted link with no scheme", () => {
    expect(extractSharedLink({ url: "are.na/block/1" })).toMatchObject({
      url: "https://are.na/block/1",
    });
  });

  it("trims punctuation that trailed the link in a sentence", () => {
    expect(extractSharedLink({ text: "look at https://are.na/block/1." })).toMatchObject({
      url: "https://are.na/block/1",
    });
  });

  it("returns null when the share carried no link at all", () => {
    expect(extractSharedLink({ text: "just some words", title: "Note" })).toBeNull();
    expect(extractSharedLink({})).toBeNull();
  });

  it("does not treat a bare sentence as a host", () => {
    expect(extractSharedLink({ text: "hello world" })).toBeNull();
  });

  it("gives no title when the text was only the link", () => {
    expect(extractSharedLink({ text: "https://are.na/block/1" })).toEqual({
      url: "https://are.na/block/1",
      title: null,
    });
  });
});
