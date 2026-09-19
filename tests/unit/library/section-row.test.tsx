// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SectionRow } from "@/components/library/section-row";

afterEach(cleanup);

function setup(props: Partial<Parameters<typeof SectionRow>[0]> = {}) {
  const onSelect = vi.fn();
  const onRename = vi.fn();
  const onDelete = vi.fn();

  render(
    <SectionRow
      name="Inspo"
      count={2}
      active={false}
      onSelect={onSelect}
      onRename={onRename}
      onDelete={onDelete}
      {...props}
    />,
  );

  return { onSelect, onRename, onDelete, user: userEvent.setup() };
}

describe("SectionRow", () => {
  it("selects the section when the row is clicked", async () => {
    const { onSelect, user } = setup();

    await user.click(screen.getByRole("button", { name: "Inspo, 2 items" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("offers no menu for General, which is computed and cannot be edited", () => {
    cleanup();
    render(<SectionRow name="General" count={14} active onSelect={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /Options for/ })).not.toBeInTheDocument();
  });

  it("renames on Enter and does not fire onSelect on the way", async () => {
    const { onRename, onSelect, user } = setup();

    await user.click(screen.getByRole("button", { name: "Options for Inspo" }));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));

    const input = screen.getByRole("textbox", { name: "Rename Inspo" });
    await user.clear(input);
    await user.type(input, "Inspiration{Enter}");

    expect(onRename).toHaveBeenCalledWith("Inspiration");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("abandons a rename on Escape", async () => {
    const { onRename, user } = setup();

    await user.click(screen.getByRole("button", { name: "Options for Inspo" }));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    await user.type(screen.getByRole("textbox", { name: "Rename Inspo" }), "nope{Escape}");

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Inspo, 2 items" })).toBeInTheDocument();
  });

  it("does not call onRename when the name is unchanged or blank", async () => {
    const { onRename, user } = setup();

    await user.click(screen.getByRole("button", { name: "Options for Inspo" }));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    await user.type(screen.getByRole("textbox", { name: "Rename Inspo" }), "{Enter}");

    expect(onRename).not.toHaveBeenCalled();
  });

  it("asks before deleting, and says the items survive", async () => {
    const { onDelete, user } = setup();

    await user.click(screen.getByRole("button", { name: "Options for Inspo" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(screen.getByText(/The 2 items in it stay in your library/)).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("does not say 'the 0 items' for an empty section", async () => {
    const { user } = setup({ count: 0 });

    await user.click(screen.getByRole("button", { name: "Options for Inspo" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(screen.getByText(/Nothing is filed in it/)).toBeInTheDocument();
  });

  it("closes the confirm step on Escape, so a delete needs a deliberate click", async () => {
    const { onDelete, user } = setup();

    await user.click(screen.getByRole("button", { name: "Options for Inspo" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("closes the menu when you click away", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Options for Inspo" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
