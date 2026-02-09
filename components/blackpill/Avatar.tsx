import { cn } from "@/lib/cn";

export type AvatarProps = {
  src?: string | null;
  alt?: string;
  fallback: string;
  size?: "sm" | "md" | "lg";
  shape?: "circle" | "square";
  className?: string;
};

const sizeClass: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-12 w-12",
};

const shapeClass: Record<NonNullable<AvatarProps["shape"]>, string> = {
  circle: "rounded-full",
  square: "rounded-lg",
};

export function Avatar({
  src,
  alt,
  fallback,
  size = "sm",
  shape = "circle",
  className,
}: AvatarProps) {
  const safeFallback = (fallback || "?").slice(0, 2).toUpperCase();

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden bg-gray-100",
        sizeClass[size],
        shapeClass[shape],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? safeFallback}
          className="object-cover w-full h-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="text-sm font-medium text-gray-700">{safeFallback}</span>
      )}
    </span>
  );
}

