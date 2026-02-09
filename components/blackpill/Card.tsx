import { cn } from "@/lib/cn";
import type * as React from "react";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return <div className={cn("bg-white border border-gray-200 rounded-lg", className)} {...props} />;
}
