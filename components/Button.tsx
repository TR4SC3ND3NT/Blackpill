import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./ui.module.css";

type ButtonVariant = "primary" | "ghost" | "subtle";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
};

const variantClass = (variant: ButtonVariant) => {
  if (variant === "ghost") return styles.buttonGhost;
  if (variant === "subtle") return styles.buttonSubtle;
  return "";
};

export default function Button({
  variant = "primary",
  loading,
  icon,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`${styles.button} ${variantClass(variant)} ${rest.className ?? ""}`}
      disabled={rest.disabled || loading}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {loading ? "Working..." : children}
    </button>
  );
}
