import type { ComponentProps } from "react";

type ChipTone =
  /** Filled dark chip — tags in the item detail panel and the sidebar. */
  | "filled"
  /** Filled white chip — a section the item already belongs to. */
  | "selected"
  /** Hairline outline — an action or an unselected section. */
  | "outline";

const toneClasses: Record<ChipTone, string> = {
  filled: "bg-ink text-secondary-text",
  selected: "bg-accent text-accent-contrast",
  outline: "border border-line text-muted",
};

type ChipProps = ComponentProps<"button"> & { tone?: ChipTone };

export function Chip({ tone = "filled", className = "", ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={`rounded-full px-3.5 py-2 text-[13px] whitespace-nowrap ${toneClasses[tone]} ${className}`}
      {...props}
    />
  );
}

/** Uppercase section label — "TAGS", "SECTIONS", "ADD TO SECTIONS". */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-muted text-xs font-medium tracking-[1px]">{children}</p>;
}
