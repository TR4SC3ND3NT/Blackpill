"use client";

import { motion } from "framer-motion";
import styles from "./results.module.css";
import PillarCardsRow from "./_components/PillarCardsRow";
import OverallScorePanel from "./_components/OverallScorePanel";
import FaceThumbs from "./_components/FaceThumbs";
import DistributionChart from "./_components/DistributionChart";
import PillarBreakdownChart from "./_components/PillarBreakdownChart";
import BalanceChart from "./_components/BalanceChart";
import ProsConsPanel from "./_components/ProsConsPanel";
import { useFace } from "./_components/FaceProvider";
import { useSubscription } from "./_components/SubscriptionProvider";
import { useResultsLock } from "./_components/useResultsLock";

const formatScore = (score?: number) =>
  score == null ? "--" : (score / 10).toFixed(1);

const baseTransition = { duration: 0.5, ease: "easeOut" } as const;

export default function ResultsOverviewPage() {
  const { face, loading, error, diagnostics } = useFace();
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

  if (error) {
    return <div className={styles.statCard}>{error}</div>;
  }

  if (!face) {
    return <div className={styles.statCard}>No analysis data found.</div>;
  }

  if (!face.frontPhotoUrl || !face.sidePhotoUrl) {
    return <div className={styles.statCard}>Missing photo data for this analysis.</div>;
  }

  const createdAt = new Date(face.createdAt).toLocaleString();
  const frontCount = face.mediapipeLandmarks?.length ?? face.frontLandmarks?.length ?? 0;
  const sideCount = face.sideLandmarks?.length ?? 0;
  const qualityLevel =
    face.frontQuality?.quality === "ok" && face.sideQuality?.quality === "ok"
      ? "ok"
      : "low";
  const assessments = [
    ...face.angularityAssessments,
    ...face.dimorphismAssessments,
    ...face.featuresAssessments,
  ];
  const sorted = [...assessments]
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
          <div className={styles.sectionEyebrow}>Overview</div>
          <div className={styles.sectionTitle}>Your facial analysis</div>
          <div className={styles.sectionSubtitle}>
            Summary of your four core pillars with distribution and landmark overlays.
          </div>
        </div>
        <div className={styles.sectionMeta}>Generated on {createdAt}</div>
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...baseTransition, delay: 0.05 }}
      >
        <PillarCardsRow
          locked={locked}
          scores={[
            { label: "Harmony", score: face.harmonyScore },
            { label: "Angularity", score: face.angularityScore },
            { label: "Dimorphism", score: face.dimorphismScore },
            { label: "Features", score: face.featuresScore },
          ]}
        />
      </motion.div>

      <div className={styles.heroGrid}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...baseTransition, delay: 0.1 }}
        >
          <OverallScorePanel
            locked={locked}
            scores={{
              overall: face.overallScore,
              harmony: face.harmonyScore,
              angularity: face.angularityScore,
              dimorphism: face.dimorphismScore,
              features: face.featuresScore,
            }}
            quality={{
              frontCount,
              sideCount,
              quality: qualityLevel,
            }}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...baseTransition, delay: 0.15 }}
        >
          <DistributionChart locked={locked} score={face.overallScore} />
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

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...baseTransition, delay: 0.22 }}
      >
        <ProsConsPanel strengths={strengths} weaknesses={weaknesses} />
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

      <motion.section
        className={styles.sectionGrid}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...baseTransition, delay: 0.25 }}
      >
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Overall</div>
          <div className={`${styles.statValue} ${locked ? styles.blur : ""}`}>
            {formatScore(face.overallScore)} / 10
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Landmarks Source</div>
          <div className={styles.statValue}>{diagnostics.landmarksSource}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Front Landmarks</div>
          <div className={styles.statValue}>{diagnostics.frontLandmarksCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Side Landmarks</div>
          <div className={styles.statValue}>{diagnostics.sideLandmarksCount}</div>
        </div>
      </motion.section>

    </>
  );
}
