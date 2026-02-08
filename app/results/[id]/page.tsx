"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import styles from "./results.module.css";
import PillarCardsRow from "./_components/PillarCardsRow";
import OverallScorePanel from "./_components/OverallScorePanel";
import FaceThumbs from "./_components/FaceThumbs";
import FaceIQHarmonyChart from "@/components/FaceIQHarmonyChart";
import PillarBreakdownChart from "./_components/PillarBreakdownChart";
import BalanceChart from "./_components/BalanceChart";
import ProsConsPanel from "./_components/ProsConsPanel";
import { useFace } from "./_components/FaceProvider";
import { useSubscription } from "./_components/SubscriptionProvider";
import { useResultsLock } from "./_components/useResultsLock";

const formatScore = (score?: number) =>
  score == null ? "--" : (score / 10).toFixed(1);

const baseTransition = { duration: 0.5, ease: "easeOut" } as const;

type ResultsTabKey = "overview" | "ratios" | "strengths" | "flaws" | "plan";

const RECENT_ANALYSES_KEY = "recentAnalyses";

export default function ResultsOverviewPage() {
  const { face, loading, error, diagnostics } = useFace();
  const { loading: subscriptionLoading } = useSubscription();

  const locked = useResultsLock();

  const [tab, setTab] = useState<ResultsTabKey>("overview");

  const tabs = useMemo(
    () => [
      { key: "overview" as const, label: "Overview" },
      { key: "ratios" as const, label: "Ratios (60+)" },
      { key: "strengths" as const, label: "Strengths" },
      { key: "flaws" as const, label: "Flaws" },
      { key: "plan" as const, label: "Plan" },
    ],
    []
  );

  useEffect(() => {
    if (!face?.id) return;
    try {
      const raw = window.localStorage.getItem(RECENT_ANALYSES_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const ids = Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
      const next = [face.id, ...ids.filter((id) => id !== face.id)].slice(0, 8);
      window.localStorage.setItem(RECENT_ANALYSES_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures
    }
  }, [face?.id]);

  const metricsSorted = useMemo(() => {
    const metrics = face?.metricDiagnostics ?? [];
    const pillarOrder = new Map([
      ["harmony", 0],
      ["angularity", 1],
      ["dimorphism", 2],
      ["features", 3],
    ]);
    const viewOrder = new Map([
      ["front", 0],
      ["either", 1],
      ["side", 2],
    ]);
    return [...metrics].sort((a, b) => {
      const pa = pillarOrder.get(a.pillar) ?? 9;
      const pb = pillarOrder.get(b.pillar) ?? 9;
      if (pa !== pb) return pa - pb;
      const va = viewOrder.get(a.view) ?? 9;
      const vb = viewOrder.get(b.view) ?? 9;
      if (va !== vb) return va - vb;
      return a.title.localeCompare(b.title);
    });
  }, [face?.metricDiagnostics]);

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
        transition={{ ...baseTransition, delay: 0.03 }}
      >
        <div className={styles.overallTabs} role="tablist" aria-label="Results tabs">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`${styles.overallTab} ${tab === item.key ? styles.overallTabActive : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </motion.div>

      {tab === "ratios" ? (
        <motion.section
          className={styles.sectionGrid}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...baseTransition, delay: 0.08 }}
        >
          <div className={styles.statCard} style={{ gridColumn: "1 / -1", overflowX: "auto" }}>
            <div className={styles.statLabel}>Ratios (60+)</div>
            <div className={styles.sectionSubtitle} style={{ marginTop: 10 }}>
              Computed metric diagnostics used for scoring.
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  {["Metric", "Pillar", "View", "Value", "Score", "Conf", "Used W", "Status"].map(
                    (label) => (
                      <th
                        key={label}
                        style={{
                          fontSize: 12,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "rgba(15,20,30,0.55)",
                          padding: "10px 10px",
                          borderBottom: "1px solid rgba(12,24,46,0.08)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {metricsSorted.length ? (
                  metricsSorted.map((metric) => (
                    <tr key={metric.id}>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(12,24,46,0.06)" }}>
                        <div style={{ fontWeight: 700 }}>{metric.title}</div>
                        {metric.validityReason ? (
                          <div style={{ fontSize: 12, color: "rgba(15,20,30,0.55)" }}>{metric.validityReason}</div>
                        ) : null}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(12,24,46,0.06)", whiteSpace: "nowrap" }}>
                        {metric.pillar}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(12,24,46,0.06)", whiteSpace: "nowrap" }}>
                        {metric.view}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(12,24,46,0.06)", whiteSpace: "nowrap" }}>
                        {metric.value == null ? "--" : metric.value.toFixed(4)}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(12,24,46,0.06)", whiteSpace: "nowrap" }}>
                        {metric.score == null ? "--" : (metric.score / 10).toFixed(1)}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(12,24,46,0.06)", whiteSpace: "nowrap" }}>
                        {metric.confidence.toFixed(2)}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(12,24,46,0.06)", whiteSpace: "nowrap" }}>
                        {metric.usedWeight.toFixed(3)}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(12,24,46,0.06)", whiteSpace: "nowrap" }}>
                        {metric.scored ? "scored" : "insufficient"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ padding: "14px 10px", color: "rgba(15,20,30,0.55)" }}>
                      No metrics were exported for this analysis.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.section>
      ) : null}

      {tab === "strengths" ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...baseTransition, delay: 0.08 }}
        >
          <div className={styles.prosConsGrid}>
            <div className={styles.prosConsCard}>
              <div className={styles.prosConsTitle}>Strengths</div>
              <div className={styles.prosConsSubtitle}>Highest scoring signals detected.</div>
              <div className={styles.prosConsList}>
                {strengths.length ? (
                  strengths.map((item) => (
                    <div key={item.title} className={styles.prosConsItem}>
                      <div>
                        <div className={styles.prosConsItemTitle}>{item.title}</div>
                        <div className={styles.prosConsItemNote}>{item.note ?? ""}</div>
                      </div>
                      <div className={styles.prosConsScore}>
                        {item.insufficient ? "insufficient" : (item.score / 10).toFixed(1)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "rgba(15,20,30,0.55)" }}>No strengths detected yet.</div>
                )}
              </div>
            </div>
          </div>
        </motion.section>
      ) : null}

      {tab === "flaws" ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...baseTransition, delay: 0.08 }}
        >
          <div className={styles.prosConsGrid}>
            <div className={styles.prosConsCard}>
              <div className={styles.prosConsTitle}>Flaws</div>
              <div className={styles.prosConsSubtitle}>Lowest scoring signals to focus on.</div>
              <div className={styles.prosConsList}>
                {weaknesses.length ? (
                  weaknesses.map((item) => (
                    <div key={item.title} className={styles.prosConsItem}>
                      <div>
                        <div className={styles.prosConsItemTitle}>{item.title}</div>
                        <div className={styles.prosConsItemNote}>{item.note ?? ""}</div>
                      </div>
                      <div className={`${styles.prosConsScore} ${styles.prosConsScoreWeak}`}>
                        {item.insufficient ? "insufficient" : (item.score / 10).toFixed(1)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "rgba(15,20,30,0.55)" }}>No flaws detected yet.</div>
                )}
              </div>
            </div>
          </div>
        </motion.section>
      ) : null}

      {tab === "plan" ? (
        <motion.section
          className={styles.sectionGrid}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...baseTransition, delay: 0.08 }}
        >
          <div className={styles.planCard} style={{ gridColumn: "1 / -1" }}>
            <div className={styles.planTitle}>Action Plan</div>
            <div className={styles.planSubtitle}>Prioritized checklist tailored to your scores.</div>
            <ul className={styles.planList}>
              {(face.actionPlan?.items ?? []).length ? (
                (face.actionPlan?.items ?? []).map((item, index) => (
                  <li key={index} className={styles.planItem}>
                    {typeof item === "string" ? item : "Personalized step"}
                  </li>
                ))
              ) : (
                <li className={styles.planEmpty}>No action plan generated yet.</li>
              )}
            </ul>
          </div>
        </motion.section>
      ) : null}

      {tab !== "overview" ? null : (
        <>
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
          <div className={styles.chartCard}>
            <FaceIQHarmonyChart
              overall={face.overallScore}
              harmony={face.harmonyScore}
              angularity={face.angularityScore}
              dimorphism={face.dimorphismScore}
              features={face.featuresScore}
              title="Harmony radial"
              subtitle="Radial pillars snapshot."
            />
          </div>
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
      )}

    </>
  );
}
