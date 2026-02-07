"use client";

import styles from "@/app/page.module.css";

export default function HomeHeader() {
  return (
    <div className={styles.header}>
      <div className={styles.title}>Blackpill</div>
      <div className={styles.subtitle}>
        Upload front and side photos, review consent, then we run a quick landmark
        analysis to generate structured scores and assessments.
      </div>
    </div>
  );
}
