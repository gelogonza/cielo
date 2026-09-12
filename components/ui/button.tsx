import type { ComponentProps } from "react";

type ButtonVariant =
  /** Acid-green primary action. */
  | "accent"
  /** Dark secondary action with a hairline border. */
  | "secondary";

const variantClasses: Record<ButtonVariant, string> = {
  accent: "bg-accent text-accent-contrast hover:brightness-95",
  secondary: "bg-surface border border-line text-primary-text hover:bg-thumb",
};

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant };

export function Button({ variant = "accent", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`flex h-16 w-full items-center justify-center rounded-full text-xl font-medium transition disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
