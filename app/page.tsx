"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import HomeHeader from "@/components/page-parts/HomeHeader";
import HomeStepper from "@/components/page-parts/HomeStepper";
import HomeStepRenderer from "@/components/page-parts/HomeStepRenderer";
import { useHomeFlow } from "@/lib/page-flow/use-home-flow";
import { fetchJson } from "@/lib/api";
import type { FaceRecord } from "@/lib/types";

type RecentFace = Pick<FaceRecord, "id" | "createdAt" | "overallScore">;

const RECENT_ANALYSES_KEY = "recentAnalyses";

const readRecentIds = () => {
  if (typeof window === "undefined") return [] as string[];
  try {
    const raw = window.localStorage.getItem(RECENT_ANALYSES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string" && id.length > 0).slice(0, 8);
  } catch {
    return [];
  }
};

export default function Home() {
  const flow = useHomeFlow();
  const [recent, setRecent] = useState<RecentFace[]>([]);
  const [recentIds] = useState<string[]>(() => readRecentIds());
  const [recentLoading, setRecentLoading] = useState(recentIds.length > 0);

  useEffect(() => {
    let active = true;
    Promise.all(
      recentIds.map(async (id) => {
        try {
          const payload = await fetchJson<{ success: boolean; face: FaceRecord }>(`/api/faces/${id}`);
          return payload.face ?? null;
        } catch {
          return null;
        }
      })
    )
      .then((faces) => {
        if (!active) return;
        const mapped = faces
          .filter((face): face is FaceRecord => Boolean(face?.id))
          .map((face) => ({
            id: face.id,
            createdAt: face.createdAt,
            overallScore: face.overallScore,
          }));
        setRecent(mapped);
      })
      .finally(() => {
        if (!active) return;
        setRecentLoading(false);
      });

    return () => {
      active = false;
    };
  }, [recentIds]);

  const recentLabel = useMemo(() => {
    if (recentLoading) return "Loading…";
    if (!recent.length) return "No analyses yet.";
    return null;
  }, [recent, recentLoading]);

  return (
    <main className={styles.homeShell}>
      <div className={styles.homeLayout}>
        <aside className={styles.homeSidebar}>
          <div className={`${styles.faceiqGlass} ${styles.sidebarCard}`}>
            <div className={styles.sidebarTitle}>Recent Analyses</div>
            <div className={styles.sidebarSubtitle}>
              Your latest results are saved locally and stay accessible from here.
            </div>
            <div className={styles.sidebarList}>
              {recentLabel ? <div className={styles.sidebarEmpty}>{recentLabel}</div> : null}
              {recent.map((item) => (
                <Link key={item.id} href={`/results/${item.id}`} className={styles.sidebarItem}>
                  <div>
                    <div className={styles.sidebarItemTitle}>Analysis</div>
                    <div className={styles.sidebarItemMeta}>
                      {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className={styles.sidebarItemScore}>
                    {item.overallScore == null ? "--" : (item.overallScore / 10).toFixed(1)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </aside>

        <div className={styles.homeContainer}>
          <HomeHeader />
          <HomeStepper items={flow.stepItems} />
          <HomeStepRenderer
            step={flow.step}
            gender={flow.gender}
            race={flow.race}
            consent={flow.consent}
            error={flow.error}
            warmupError={flow.warmupError}
            frontImage={flow.frontImage}
            sideImage={flow.sideImage}
            activeDropZone={flow.activeDropZone}
            frontInputRef={flow.frontInputRef}
            sideInputRef={flow.sideInputRef}
            canProceed={flow.canProceed}
            previewData={flow.previewData}
            previewLoading={flow.previewLoading}
            previewStatus={flow.previewStatus}
            previewError={flow.previewError}
            manualCalibration={flow.manualCalibration}
            processingSteps={flow.processingSteps}
            progressPercent={flow.progressPercent}
            isProcessing={flow.isProcessing}
            onSelectGender={flow.onSelectGender}
            onSelectRace={flow.onSelectRace}
            onConsentChange={flow.onConsentChange}
            onFrontFileChange={flow.onFrontFileChange}
            onSideFileChange={flow.onSideFileChange}
            onFrontDrop={flow.onFrontDrop}
            onSideDrop={flow.onSideDrop}
            setActiveDropZone={flow.setActiveDropZone}
            onResetUploads={flow.onResetUploads}
            onBackFromEthnicity={flow.onBackFromEthnicity}
            onBackFromUpload={flow.onBackFromUpload}
            onBackFromConsent={flow.onBackFromConsent}
            onBackFromCalibration={flow.onBackFromCalibration}
            onBackFromProcessing={flow.onBackFromProcessing}
            onContinueFromGender={flow.onContinueFromGender}
            onContinueFromEthnicity={flow.onContinueFromEthnicity}
            onContinueFromUpload={flow.onContinueFromUpload}
            onStartCalibration={flow.onStartCalibration}
            onRetryPreview={flow.onRetryPreview}
            onCompleteCalibration={flow.onCompleteCalibration}
          />
        </div>
      </div>
    </main>
  );
}
