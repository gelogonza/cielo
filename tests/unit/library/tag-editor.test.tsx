// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TagEditor } from "@/components/library/tag-editor";

afterEach(cleanup);

const tags = [
  { id: "t1", name: "type", itemCount: 2 },
  { id: "t2", name: "undo", itemCount: 0 },
];

function setup() {
  const onRename = vi.fn();
  const onDelete = vi.fn();

  render(<TagEditor tags={tags} onRename={onRename} onDelete={onDelete} />);

  return { onRename, onDelete, user: userEvent.setup() };
}

describe("TagEditor", () => {
  it("lists every tag with its count", () => {
    setup();

    expect(screen.getByRole("button", { name: "Rename type" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename undo" })).toBeInTheDocument();
  });

  it("renames on Enter, reporting the tag it belongs to", async () => {
    const { onRename, user } = setup();

    await user.click(screen.getByRole("button", { name: "Rename type" }));
    const input = screen.getByRole("textbox", { name: "Rename type" });
    await user.clear(input);
    await user.type(input, "typography{Enter}");

    expect(onRename).toHaveBeenCalledWith("t1", "typography");
  });

  it("abandons a rename on Escape", async () => {
    const { onRename, user } = setup();

    await user.click(screen.getByRole("button", { name: "Rename type" }));
    await user.type(screen.getByRole("textbox", { name: "Rename type" }), "x{Escape}");

    expect(onRename).not.toHaveBeenCalled();
  });

  it("does not rename to an unchanged name", async () => {
    const { onRename, user } = setup();

    await user.click(screen.getByRole("button", { name: "Rename type" }));
    await user.type(screen.getByRole("textbox", { name: "Rename type" }), "{Enter}");

    expect(onRename).not.toHaveBeenCalled();
  });

  it("asks before deleting, and says the items survive", async () => {
    const { onDelete, user } = setup();

    await user.click(screen.getByRole("button", { name: "Delete type" }));

    expect(screen.getByText(/The 2 items stay in your library/)).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("t1");
  });

  it("does not say 'the 0 items' for a tag nothing uses", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Delete undo" }));

    expect(screen.getByText(/Nothing is tagged with it/)).toBeInTheDocument();
  });

  it("backs out of the confirm step on Cancel", async () => {
    const { onDelete, user } = setup();

    await user.click(screen.getByRole("button", { name: "Delete type" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Rename type" })).toBeInTheDocument();
  });
});
