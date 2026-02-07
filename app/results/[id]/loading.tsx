import styles from "./results.module.css";

export default function Loading() {
  return (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <div className={styles.skeletonLine} />
          <div className={`${styles.skeletonLine} ${styles.skeletonLineWide}`} />
        </div>
        <div className={styles.skeletonPill} />
      </div>
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className={styles.skeletonBlock} />
        ))}
      </div>
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 2 }).map((_, idx) => (
          <div key={idx} className={styles.skeletonBlock} />
        ))}
      </div>
    </>
  );
}
