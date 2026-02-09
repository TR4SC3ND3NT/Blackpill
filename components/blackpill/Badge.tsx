import { cn } from "@/lib/cn";
import type * as React from "react";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "neutral" | "success" | "danger";
};

const variantClass: Record<NonNullable<BadgeProps["variant"]>, string> = {
  neutral: "bg-gray-100 text-gray-700",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  danger: "bg-red-50 text-red-700 border border-red-200",
};

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-lg",
        variantClass[variant],
        className,
      )}
      {...props}
    />
  );
}
