import { cn } from "@/lib/cn";
import type * as React from "react";

export type GlassPanelProps<TAs extends React.ElementType = "div"> = {
  as?: TAs;
} & React.ComponentPropsWithoutRef<TAs>;

export function GlassPanel<TAs extends React.ElementType = "div">({
  as,
  className,
  ...props
}: GlassPanelProps<TAs>) {
  const Comp = (as ?? "div") as React.ElementType;
  return <Comp className={cn("bp-glass-panel", className)} {...props} />;
}
