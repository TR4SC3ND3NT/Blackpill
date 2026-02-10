"use client";
/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/blackpill/shell/AppShell";
import { Button } from "@/components/blackpill/Button";
import { Card } from "@/components/blackpill/Card";
import {
  loadUiNewAnalysisDraft,
  saveUiNewAnalysisDraft,
  subscribeUiNewAnalysisDraft,
} from "@/lib/uiNewAnalysisDraft";

export function NewAnalysisConfirmScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [frontDataUrl, setFrontDataUrl] = useState<string | null>(null);
  const [sideDataUrl, setSideDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      const draft = loadUiNewAnalysisDraft();
      setFrontDataUrl(draft.frontDataUrl);
      setSideDataUrl(draft.sideDataUrl);
      setReady(true);
    };
    const unsubscribe = subscribeUiNewAnalysisDraft(load);
    // Avoid hydration mismatch: load localStorage only after mount (async).
    queueMicrotask(load);
    return unsubscribe;
  }, []);

  const canContinue = Boolean(frontDataUrl && sideDataUrl);

  const status = useMemo(() => {
    if (!ready) return "Loading…";
    if (!frontDataUrl || !sideDataUrl) return "Missing photos. Go back and upload both.";
    return "Looks good. Continue to cohort selection.";
  }, [frontDataUrl, ready, sideDataUrl]);

  return (
    <AppShell title="New analysis" subtitle="Confirm your uploads">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <div className="space-y-4">
          <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
            <div className="text-sm font-medium text-gray-900">Review</div>
            <div className="mt-1 text-sm text-gray-600">
              Ensure both photos are sharp, correctly oriented, and not stretched.
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
              <PreviewCard
                title="Front photo"
                dataUrl={frontDataUrl}
                onClear={() => saveUiNewAnalysisDraft({ frontDataUrl: null })}
              />
              <PreviewCard
                title="Side photo"
                dataUrl={sideDataUrl}
                onClear={() => saveUiNewAnalysisDraft({ sideDataUrl: null })}
              />
            </div>
          </Card>

          <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-gray-600">{status}</div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => router.push("/ui/new-analysis")}>
                  Back
                </Button>
                <Button
                  disabled={!canContinue}
                  onClick={() => router.push("/ui/new-analysis/cohort")}
                >
                  Continue
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function PreviewCard({
  title,
  dataUrl,
  onClear,
}: {
  title: string;
  dataUrl: string | null;
  onClear: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200/50 bg-white/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-gray-900">{title}</div>
        <Button size="xs" variant="outline" onClick={onClear} disabled={!dataUrl}>
          Remove
        </Button>
      </div>
      <div className="mt-3 aspect-square w-full max-w-[360px] max-h-[360px] mx-auto rounded-lg border border-gray-200/50 bg-white/60 grid place-items-center overflow-hidden">
        {dataUrl ? (
          <img src={dataUrl} alt={`${title} preview`} className="w-full h-full object-contain" />
        ) : (
          <div className="text-xs text-gray-500">Missing.</div>
        )}
      </div>
    </div>
  );
}
