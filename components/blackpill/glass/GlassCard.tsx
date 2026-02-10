import { cn } from "@/lib/cn";
import type * as React from "react";

export type GlassCardProps<TAs extends React.ElementType = "div"> = {
  as?: TAs;
} & React.ComponentPropsWithoutRef<TAs>;

export function GlassCard<TAs extends React.ElementType = "div">({
  as,
  className,
  ...props
}: GlassCardProps<TAs>) {
  const Comp = (as ?? "div") as React.ElementType;
  return <Comp className={cn("bp-glass-card", className)} {...props} />;
}
