"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/blackpill/shell/AppShell";
import { Button } from "@/components/blackpill/Button";
import { Card } from "@/components/blackpill/Card";
import {
  clearUiNewAnalysisDraft,
  loadUiNewAnalysisDraft,
  saveUiNewAnalysisDraft,
  subscribeUiNewAnalysisDraft,
} from "@/lib/uiNewAnalysisDraft";

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });

function UploadTile({
  title,
  subtitle,
  dataUrl,
  onPick,
}: {
  title: string;
  subtitle: string;
  dataUrl: string | null;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900">{title}</div>
          <div className="mt-1 text-xs text-gray-500">{subtitle}</div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {dataUrl ? "Replace" : "Upload"}
        </Button>
      </div>

      <div className="mt-4 rounded-xl border border-gray-200/50 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
        <div className="p-3">
          <div className="aspect-square w-full max-h-[360px] rounded-lg border border-gray-200/50 bg-white/60 grid place-items-center overflow-hidden">
            {dataUrl ? (
              <img
                src={dataUrl}
                alt={`${title} preview`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-xs text-gray-500">No image selected.</div>
            )}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          setLoading(true);
          try {
            await onPick(file);
          } finally {
            setLoading(false);
          }
        }}
      />
    </Card>
  );
}

export function NewAnalysisUploadScreen() {
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
  const missingLabel = useMemo(() => {
    if (!ready) return "Loading…";
    if (!frontDataUrl && !sideDataUrl) return "Upload front + side photos to continue.";
    if (!frontDataUrl) return "Front photo missing.";
    if (!sideDataUrl) return "Side photo missing.";
    return null;
  }, [frontDataUrl, ready, sideDataUrl]);

  return (
    <AppShell title="New analysis" subtitle="Upload your photos">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
            <UploadTile
              title="Front photo"
              subtitle="Straight-on, eyes open, even lighting."
              dataUrl={frontDataUrl}
              onPick={async (file) => {
                const dataUrl = await readAsDataUrl(file);
                saveUiNewAnalysisDraft({ frontDataUrl: dataUrl });
              }}
            />
            <UploadTile
              title="Side photo"
              subtitle="Clear profile, chin neutral."
              dataUrl={sideDataUrl}
              onPick={async (file) => {
                const dataUrl = await readAsDataUrl(file);
                saveUiNewAnalysisDraft({ sideDataUrl: dataUrl });
              }}
            />
          </div>

          <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-gray-600">{missingLabel ?? "Ready."}</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    clearUiNewAnalysisDraft();
                  }}
                >
                  Reset
                </Button>
                <Button
                  onClick={() => router.push("/ui/new-analysis/confirm")}
                  disabled={!canContinue}
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
