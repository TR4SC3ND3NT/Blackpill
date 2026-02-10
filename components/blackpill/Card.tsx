import { cn } from "@/lib/cn";
import type * as React from "react";
import { GlassCard } from "@/components/blackpill/glass/GlassCard";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return <GlassCard className={cn(className)} {...props} />;
}
