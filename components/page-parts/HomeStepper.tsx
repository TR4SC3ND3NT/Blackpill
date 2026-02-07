"use client";

import styles from "@/app/page.module.css";
import type { StepItem } from "@/lib/page-flow/types";

type Props = {
  items: StepItem[];
};

export default function HomeStepper({ items }: Props) {
  return (
    <div className={styles.homeStepper}>
      {items.map((item) => (
        <div
          key={item.label}
          className={`${styles.homeStep} ${
            item.status === "active"
              ? styles.homeStepActive
              : item.status === "done"
                ? styles.homeStepDone
                : ""
          }`}
        >
          <span className={styles.homeStepDot} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
