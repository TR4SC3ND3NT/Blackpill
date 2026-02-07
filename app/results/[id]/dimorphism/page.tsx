"use client";

import { motion } from "framer-motion";
import styles from "../results.module.css";
import DistributionChart from "../_components/DistributionChart";
import AssessmentPanel from "../_components/AssessmentPanel";
import PillarBreakdownChart from "../_components/PillarBreakdownChart";
import ProsConsPanel from "../_components/ProsConsPanel";
import { useFace } from "../_components/FaceProvider";
import { useSubscription } from "../_components/SubscriptionProvider";
import { useResultsLock } from "../_components/useResultsLock";
import QualityBadge from "../_components/QualityBadge";

const formatScore = (score?: number) =>
  score == null ? "--" : (score / 10).toFixed(1);

const baseTransition = { duration: 0.5, ease: "easeOut" } as const;

export default function DimorphismPage() {
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
          {Array.from({ length: 2 }).map((_, idx) => (
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
  const sorted = [...face.dimorphismAssessments]
    .filter((item) => !item.insufficient)
    .sort((a, b) => b.score - a.score);
  const strengths = sorted.slice(0, 3);
  const weaknesses = sorted.slice(-3).reverse();

  return (
    <>
      <motion.section
        className={styles.sectionHeader}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={baseTransition}
      >
        <div>
          <div className={styles.sectionEyebrow}>Dimorphism</div>
          <div className={styles.sectionTitle}>Contrast and presence</div>
          <div className={styles.sectionSubtitle}>
            Captures signal strength around brow prominence, midface balance, and
            jaw width ratios.
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
          <div className={styles.statLabel}>Dimorphism Score</div>
          <div className={`${styles.statValue} ${locked ? styles.blur : ""}`}>
            {formatScore(face.dimorphismScore)} / 10
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Score Percentile</div>
          <div className={`${styles.statValue} ${locked ? styles.blur : ""}`}>
            {face.dimorphismScore}%
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
          <div className={styles.statLabel}>Dimorphism Insight</div>
          <div className={styles.sectionSubtitle}>
            Strong dimorphism signals come from bold contours and confident
            midface structure.
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...baseTransition, delay: 0.15 }}
        >
          <DistributionChart locked={locked} score={face.dimorphismScore} />
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
      </motion.section>

      {strengths.length || weaknesses.length ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...baseTransition, delay: 0.2 }}
        >
          <ProsConsPanel strengths={strengths} weaknesses={weaknesses} />
        </motion.section>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...baseTransition, delay: 0.24 }}
      >
        <AssessmentPanel
          title="Dimorphism Assessments"
          subtitle="Highlights from brow, midface, and jaw alignment." 
          items={face.dimorphismAssessments}
          locked={locked}
        />
      </motion.div>
    </>
  );
}
