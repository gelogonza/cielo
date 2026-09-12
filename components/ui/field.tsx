import type { ComponentProps } from "react";

/**
 * Pill text input. The Figma fields show only a placeholder, so the label is
 * carried by aria-label rather than a visible <label>.
 */
export function Field({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`bg-ink text-secondary-text placeholder:text-muted h-16 w-full rounded-full px-7 text-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${className}`}
      {...props}
    />
  );
}
