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
  const sorted = [...assessments].sort((a, b) => b.score - a.score);
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

      <motion.section
        className={styles.diagnosticsCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...baseTransition, delay: 0.3 }}
      >
        <div className={styles.sectionEyebrow}>Diagnostics</div>
        <div className={styles.sectionTitle}>Overlay health</div>
        <div className={styles.diagnosticsGrid}>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>landmarksCount</span>
            <span className={styles.diagnosticValue}>{diagnostics.landmarksCount}</span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>overlayLandmarksCount</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.overlayLandmarksCount}
            </span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>mediapipeLandmarksCount</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.mediapipeLandmarksCount}
            </span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>front.natural</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.front.natural.w}×{diagnostics.front.natural.h}
            </span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>side.natural</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.side.natural.w}×{diagnostics.side.natural.h}
            </span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>front.poseYaw</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.frontQuality
                ? diagnostics.frontQuality.poseYaw.toFixed(1)
                : "--"}
            </span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>front.posePitch</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.frontQuality
                ? diagnostics.frontQuality.posePitch.toFixed(1)
                : "--"}
            </span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>front.poseRoll</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.frontQuality
                ? diagnostics.frontQuality.poseRoll.toFixed(1)
                : "--"}
            </span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>front.detectedView</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.frontQuality?.detectedView ?? "--"}
            </span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>front.faceInFrame</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.frontQuality
                ? diagnostics.frontQuality.faceInFrame
                  ? "true"
                  : "false"
                : "--"}
            </span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>side.poseYaw</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.sideQuality
                ? diagnostics.sideQuality.poseYaw.toFixed(1)
                : "--"}
            </span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>side.posePitch</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.sideQuality
                ? diagnostics.sideQuality.posePitch.toFixed(1)
                : "--"}
            </span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>side.poseRoll</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.sideQuality
                ? diagnostics.sideQuality.poseRoll.toFixed(1)
                : "--"}
            </span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>side.detectedView</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.sideQuality?.detectedView ?? "--"}
            </span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>side.faceInFrame</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.sideQuality
                ? diagnostics.sideQuality.faceInFrame
                  ? "true"
                  : "false"
                : "--"}
            </span>
          </div>
          <div className={styles.diagnosticItem}>
            <span className={styles.diagnosticLabel}>normalized</span>
            <span className={styles.diagnosticValue}>
              {diagnostics.isNormalized ? "true" : "false"}
            </span>
          </div>
        </div>
        {diagnostics.sideTooSmall ? (
          <div className={styles.warningText}>
            Side image resolution too low for reliable landmarks.
          </div>
        ) : null}
      </motion.section>
    </>
  );
}
