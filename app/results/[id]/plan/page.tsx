"use client";

import { motion } from "framer-motion";
import styles from "../results.module.css";
import LockedOverlay from "../_components/LockedOverlay";
import { useFace } from "../_components/FaceProvider";
import { useSubscription } from "../_components/SubscriptionProvider";
import { useResultsLock } from "../_components/useResultsLock";

const baseTransition = { duration: 0.5, ease: "easeOut" } as const;

export default function PlanPage() {
  const { face, loading, error } = useFace();
  const { loading: subscriptionLoading } = useSubscription();

  const locked = useResultsLock();

  if (loading || subscriptionLoading) {
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
          <div className={styles.skeletonBlock} />
        </div>
      </>
    );
  }

  if (error) {
    return <div className={styles.statCard}>{error}</div>;
  }

  if (!face) {
    return <div className={styles.statCard}>No analysis data found.</div>;
  }

  const items = face.actionPlan?.items ?? [];

  return (
    <>
      <motion.section
        className={styles.sectionHeader}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={baseTransition}
      >
        <div>
          <div className={styles.sectionEyebrow}>Plan</div>
          <div className={styles.sectionTitle}>Your improvement roadmap</div>
          <div className={styles.sectionSubtitle}>
            Curated focus areas and next steps based on your analysis.
          </div>
        </div>
        <div className={styles.sectionMeta}>
          Updated {new Date(face.updatedAt ?? face.createdAt).toLocaleString()}
        </div>
      </motion.section>

      <motion.div
        className={styles.planCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...baseTransition, delay: 0.1 }}
      >
        <div className={styles.planTitle}>Action Plan</div>
        <div className={styles.planSubtitle}>
          Prioritized checklist tailored to your scores.
        </div>
        <ul className={styles.planList}>
          {items.length ? (
            items.map((item, index) => (
              <li key={index} className={styles.planItem}>
                {typeof item === "string" ? item : "Personalized step"}
              </li>
            ))
          ) : (
            <li className={styles.planEmpty}>No action plan generated yet.</li>
          )}
        </ul>
        {locked ? (
          <LockedOverlay title="Unlock your plan" cta="Unlock plan" />
        ) : null}
      </motion.div>
    </>
  );
}
