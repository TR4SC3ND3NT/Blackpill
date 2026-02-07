"use client";

import { motion } from "framer-motion";
import styles from "../results.module.css";
import DistributionChart from "../_components/DistributionChart";
import FaceThumbs from "../_components/FaceThumbs";
import PillarBreakdownChart from "../_components/PillarBreakdownChart";
import BalanceChart from "../_components/BalanceChart";
import { useFace } from "../_components/FaceProvider";
import { useSubscription } from "../_components/SubscriptionProvider";
import { useResultsLock } from "../_components/useResultsLock";
import QualityBadge from "../_components/QualityBadge";

const formatScore = (score?: number) =>
  score == null ? "--" : (score / 10).toFixed(1);

const baseTransition = { duration: 0.5, ease: "easeOut" } as const;

export default function HarmonyPage() {
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
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className={styles.skeletonBlock} />
          ))}
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

  const frontCount = face.mediapipeLandmarks?.length ?? face.frontLandmarks?.length ?? 0;
  const sideCount = face.sideLandmarks?.length ?? 0;
  const qualityLevel =
    face.frontQuality?.quality === "ok" && face.sideQuality?.quality === "ok"
      ? "ok"
      : "low";

  return (
    <>
      <motion.section
        className={styles.sectionHeader}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={baseTransition}
      >
        <div>
          <div className={styles.sectionEyebrow}>Harmony</div>
          <div className={styles.sectionTitle}>Balance and proportion</div>
          <div className={styles.sectionSubtitle}>
            Overall alignment across facial thirds and left/right balance signals.
          </div>
        </div>
        <div className={styles.sectionMeta}>
          Updated {new Date(face.updatedAt ?? face.createdAt).toLocaleString()}
        </div>
      </motion.section>

      <motion.div
        className={styles.statRow}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...baseTransition, delay: 0.05 }}
      >
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Overall Harmony</div>
          <div className={`${styles.statValue} ${locked ? styles.blur : ""}`}>
            {formatScore(face.harmonyScore)} / 10
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Front Harmony</div>
          <div className={`${styles.statValue} ${locked ? styles.blur : ""}`}>
            {formatScore(face.frontHarmonyScore)} / 10
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Side Harmony</div>
          <div className={`${styles.statValue} ${locked ? styles.blur : ""}`}>
            {formatScore(face.sideHarmonyScore)} / 10
          </div>
        </div>
      </motion.div>

      <div className={styles.qualityRow}>
        <QualityBadge frontCount={frontCount} sideCount={sideCount} quality={qualityLevel} />
      </div>

      <div className={styles.heroGrid}>
        <motion.div
          className={styles.statCard}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...baseTransition, delay: 0.1 }}
        >
          <div className={styles.statLabel}>Harmony Insight</div>
          <div className={styles.sectionSubtitle}>
            This pillar blends geometric symmetry with proportional ratios. Balanced scores
            usually indicate strong facial cohesion and consistent alignment.
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...baseTransition, delay: 0.15 }}
        >
          <DistributionChart locked={locked} score={face.harmonyScore} />
        </motion.div>
      </div>

      <motion.section
        className={styles.sectionGrid}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...baseTransition, delay: 0.18 }}
      >
        <PillarBreakdownChart
          scores={[
            { label: "Harmony", score: face.harmonyScore },
            { label: "Angularity", score: face.angularityScore },
            { label: "Dimorphism", score: face.dimorphismScore },
            { label: "Features", score: face.featuresScore },
          ]}
        />
        <BalanceChart front={face.frontHarmonyScore} side={face.sideHarmonyScore} />
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...baseTransition, delay: 0.2 }}
      >
        <FaceThumbs
          frontUrl={face.frontPhotoUrl}
          sideUrl={face.sidePhotoUrl}
          frontLandmarks={face.mediapipeLandmarks ?? face.frontLandmarks ?? []}
          sideLandmarks={face.sideLandmarks ?? []}
          frontScore={face.frontHarmonyScore}
          sideScore={face.sideHarmonyScore}
          locked={locked}
        />
      </motion.div>
    </>
  );
}
