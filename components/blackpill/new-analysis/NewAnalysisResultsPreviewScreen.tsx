"use client";
/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/blackpill/shell/AppShell";
import { Badge } from "@/components/blackpill/Badge";
import { Button } from "@/components/blackpill/Button";
import { Card } from "@/components/blackpill/Card";
import type { AnalysisSnapshot } from "@/lib/analysisHistory";
import { saveSnapshot } from "@/lib/analysisHistory";
import { cn } from "@/lib/cn";
import {
  clearUiNewAnalysisDraft,
  loadUiNewAnalysisDraft,
  subscribeUiNewAnalysisDraft,
} from "@/lib/uiNewAnalysisDraft";

const safeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `ui_${Math.random().toString(36).slice(2, 10)}`;
};

export function NewAnalysisResultsPreviewScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [frontDataUrl, setFrontDataUrl] = useState<string | null>(null);
  const [sideDataUrl, setSideDataUrl] = useState<string | null>(null);
  const [cohortKey, setCohortKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = () => {
      const draft = loadUiNewAnalysisDraft();
      setFrontDataUrl(draft.frontDataUrl);
      setSideDataUrl(draft.sideDataUrl);
      setCohortKey(draft.cohortKey);
      setReady(true);
    };
    const unsubscribe = subscribeUiNewAnalysisDraft(load);
    // Avoid hydration mismatch: load localStorage only after mount (async).
    queueMicrotask(load);
    return unsubscribe;
  }, []);

  const canSave = Boolean(frontDataUrl && sideDataUrl && cohortKey) && ready && !saving;

  const demo = useMemo(() => {
    // Deterministic-ish (no Math.random on initial SSR render; this is client-only).
    const overall = 72;
    const pillars = { harmony: 78, angularity: 64, dimorphism: 70, features: 76 };
    return { overall, pillars };
  }, []);

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const id = safeId();
      const now = new Date().toISOString();
      const snap: AnalysisSnapshot = {
        id,
        createdAtIso: now,
        updatedAtIso: now,
        cohortKey: cohortKey ?? "white",
        gender: "unspecified",
        race: cohortKey ?? "white",
        overall: demo.overall,
        pillarScores: demo.pillars,
        frontPhotoUrl: frontDataUrl,
        sidePhotoUrl: sideDataUrl,
      };
      saveSnapshot(snap);
      clearUiNewAnalysisDraft();
      router.push(`/ui/dashboard/${id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="New analysis" subtitle="Results preview">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <div className="space-y-4">
          <Card className="rounded-xl border-gray-200/50 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">Preview</div>
                <div className="mt-1 text-xs text-gray-500">
                  UI-only stub. Save to local history to populate dashboard, analytics, and reports.
                </div>
              </div>
              <Badge className="shrink-0">{cohortKey ?? "—"}</Badge>
            </div>

            <div className="px-4 sm:px-6 py-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
                <div className="lg:col-span-2 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PhotoPanel title="Front" dataUrl={frontDataUrl} />
                    <PhotoPanel title="Side" dataUrl={sideDataUrl} />
                  </div>
                  <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Overall
                        </div>
                        <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
                          {demo.overall}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">/ 100</div>
                    </div>
                    <div className="mt-5 space-y-3">
                      <PillarRow label="Harmony" value={demo.pillars.harmony} />
                      <PillarRow label="Angularity" value={demo.pillars.angularity} />
                      <PillarRow label="Dimorphism" value={demo.pillars.dimorphism} />
                      <PillarRow label="Features" value={demo.pillars.features} />
                    </div>
                  </Card>
                </div>

                <aside className="space-y-4">
                  <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
                    <div className="text-sm font-medium text-gray-900">Next</div>
                    <div className="mt-1 text-sm text-gray-600">
                      Save this preview as a local snapshot.
                    </div>
                    <div className="mt-4 space-y-2">
                      <Button disabled={!canSave} onClick={onSave} className="w-full justify-center">
                        {saving ? "Saving…" : "Save to history"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => router.push("/ui/new-analysis")}
                        className="w-full justify-center"
                      >
                        Start over
                      </Button>
                    </div>
                    {!ready ? (
                      <div className="mt-4 text-xs text-gray-500">Loading draft…</div>
                    ) : null}
                    {ready && (!frontDataUrl || !sideDataUrl || !cohortKey) ? (
                      <div className="mt-4 text-xs text-red-600">
                        Missing required steps. Upload photos and select a cohort.
                      </div>
                    ) : null}
                  </Card>

                  <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
                    <div className="text-sm font-medium text-gray-900">What happens next?</div>
                    <div className="mt-2 text-sm text-gray-600">
                      This route is a visual stub. The real analyzer lives in the main flow, but the
                      UI layer still needs a complete, navigable product journey.
                    </div>
                  </Card>
                </aside>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function PhotoPanel({ title, dataUrl }: { title: string; dataUrl: string | null }) {
  return (
    <div className="rounded-xl border border-gray-200/50 bg-white/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-gray-900">{title}</div>
        <span
          className={cn(
            "text-xs font-medium px-2 py-1 rounded-lg border",
            dataUrl
              ? "border-gray-200 bg-gray-50 text-gray-700"
              : "border-gray-200 bg-white text-gray-500",
          )}
        >
          {dataUrl ? "Ready" : "Missing"}
        </span>
      </div>
      <div className="mt-3 aspect-square w-full max-h-[300px] rounded-lg border border-gray-200/50 bg-white/60 grid place-items-center overflow-hidden">
        {dataUrl ? (
          <img src={dataUrl} alt={`${title} preview`} className="w-full h-full object-contain" />
        ) : (
          <div className="text-xs text-gray-500">No photo.</div>
        )}
      </div>
    </div>
  );
}

function PillarRow({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / 100) * 100)));
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-sm text-gray-600">{label}</div>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-gray-900/70" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="w-10 text-right text-sm font-medium text-gray-700 tabular-nums">
        {value}
      </div>
    </div>
  );
}

