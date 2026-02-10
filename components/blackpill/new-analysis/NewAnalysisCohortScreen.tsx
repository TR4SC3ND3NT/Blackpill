"use client";

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
import { cn } from "@/lib/cn";

const cohorts: Array<{ key: string; label: string; note: string }> = [
  { key: "asian", label: "Asian", note: "East / South / Southeast Asian." },
  { key: "black", label: "Black / African", note: "African / Afro-Caribbean." },
  { key: "latino", label: "Hispanic / Latino", note: "Latin American heritage." },
  { key: "middle-eastern", label: "Middle Eastern", note: "MENA region." },
  { key: "white", label: "White / Caucasian", note: "European heritage." },
];

export function NewAnalysisCohortScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      const draft = loadUiNewAnalysisDraft();
      setSelected(draft.cohortKey);
      setReady(true);
    };
    const unsubscribe = subscribeUiNewAnalysisDraft(load);
    // Avoid hydration mismatch: load localStorage only after mount (async).
    queueMicrotask(load);
    return unsubscribe;
  }, []);

  const status = useMemo(() => {
    if (!ready) return "Loading…";
    if (!selected) return "Pick one option to continue.";
    return `Selected: ${selected}.`;
  }, [ready, selected]);

  return (
    <AppShell title="New analysis" subtitle="Choose cohort">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <div className="space-y-4">
          <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
            <div className="text-sm font-medium text-gray-900">Ethnicity / cohort</div>
            <div className="mt-1 text-sm text-gray-600">
              Choose the closest match to align comparisons.
            </div>

            <div className="mt-6 flex items-center justify-center">
              <div className="w-full max-w-lg">
                <div className="space-y-2">
                  {cohorts.map((item) => {
                    const active = selected === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={cn(
                          "w-full text-left rounded-2xl border px-5 py-4 transition-all",
                          active
                            ? "border-blue-300 bg-blue-50 shadow-[0_16px_34px_rgba(76,129,255,0.2)]"
                            : "border-gray-200 bg-white hover:bg-gray-50",
                        )}
                        onClick={() => {
                          setSelected(item.key);
                          saveUiNewAnalysisDraft({ cohortKey: item.key });
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">{item.label}</div>
                            <div className="mt-1 text-xs text-gray-500">{item.note}</div>
                          </div>
                          <div
                            className={cn(
                              "h-5 w-5 rounded-full border flex items-center justify-center",
                              active ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-white",
                            )}
                            aria-hidden="true"
                          >
                            {active ? (
                              <span className="h-2 w-2 rounded-full bg-white" />
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-gray-600">{status}</div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => router.push("/ui/new-analysis/confirm")}>
                  Back
                </Button>
                <Button
                  disabled={!selected}
                  onClick={() => router.push("/ui/new-analysis/results-preview")}
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

