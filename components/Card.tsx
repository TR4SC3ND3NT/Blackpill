import type { HTMLAttributes, PropsWithChildren } from "react";
import styles from "./ui.module.css";

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export default function Card({ children, className, ...rest }: CardProps) {
  return (
    <div {...rest} className={`${styles.card} ${className ?? ""}`}>
      {children}
    </div>
  );
}
