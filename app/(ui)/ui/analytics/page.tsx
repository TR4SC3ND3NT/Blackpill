import { Badge } from "@/components/blackpill/Badge";
import { Card } from "@/components/blackpill/Card";
import { TimeRangeButtons } from "@/components/blackpill/analytics/TimeRangeButtons";
import { AppShell } from "@/components/blackpill/shell/AppShell";
import { cn } from "@/lib/cn";
import { mockAnalytics } from "@/lib/mock/analytics";

export const metadata = {
  title: "Analytics",
};

export default function UiAnalyticsPage() {
  const { seriesOverall, breakdownRows } = mockAnalytics;
  const values = seriesOverall.map((p) => p.value);
  const latest = values.at(-1) ?? 0;
  const avg = Math.round(values.reduce((acc, v) => acc + v, 0) / Math.max(1, values.length));
  const best = values.reduce((m, v) => Math.max(m, v), 0);
  const weekAgo = values.at(-8) ?? latest;
  const delta7d = latest - weekAgo;

  return (
    <AppShell title="Analytics" subtitle="Trends and breakdowns" rightSlot={<TimeRangeButtons />}>
      <div className="max-w-7xl mx-auto px-6 py-6 sm:py-8">
        <div className="space-y-6">
          <section className="flex flex-col sm:flex-row gap-3">
            <KpiCard label="Latest overall" value={`${latest}`} hint="Most recent point" badge={`${delta7d >= 0 ? "+" : ""}${delta7d}`} />
            <KpiCard label="Avg overall" value={`${avg}`} hint="Rolling average" />
            <KpiCard label="Best overall" value={`${best}`} hint="Peak score" />
            <KpiCard label="Points" value={`${values.length}`} hint="Mock samples" />
          </section>

          <section className="flex flex-col lg:flex-row gap-4 lg:gap-8">
            <div className="flex-1 min-w-0 space-y-4">
              <Card className="rounded-xl border-gray-200/60 overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">Overall trend</div>
                    <div className="mt-1 text-xs text-gray-500">Placeholder chart (UI only).</div>
                  </div>
                  <Badge className="shrink-0">Overall</Badge>
                </div>

                <div className="px-4 sm:px-6 py-6">
                  <div className="rounded-xl border border-gray-200/60 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
                    <div
                      className="h-64 relative"
                      style={{
                        backgroundImage:
                          "linear-gradient(to right, rgba(17, 24, 39, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(17, 24, 39, 0.04) 1px, transparent 1px)",
                        backgroundSize: "48px 48px",
                      }}
                    >
                      <div className="absolute inset-0 flex items-end px-4 pb-4">
                        <div className="flex items-end gap-2 w-full">
                          {seriesOverall.slice(-18).map((p) => (
                            <div key={p.t} className="flex-1 min-w-0">
                              <div
                                className="w-full rounded-md bg-gray-900/10"
                                style={{ height: `${Math.max(10, Math.round((p.value / 100) * 160))}px` }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="text-xs text-gray-500">Active cohort: asian_male_young</div>
                      <div className="text-xs text-gray-500">Mock</div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="rounded-xl border-gray-200/60 overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">Breakdown</div>
                    <div className="mt-1 text-xs text-gray-500">Category deltas (mocked).</div>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {breakdownRows.map((row) => (
                    <div key={row.label} className="px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900">{row.label}</div>
                          <div className="mt-1 text-xs text-gray-500">{row.value}</div>
                        </div>
                        <div
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            row.delta.trim().startsWith("-") ? "text-red-600" : "text-emerald-600",
                          )}
                        >
                          {row.delta}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <aside className="w-full lg:w-[360px] flex-shrink-0 space-y-4">
              <Card className="rounded-xl border-gray-200/60 p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">Top strengths</div>
                    <div className="mt-1 text-xs text-gray-500">Mock ranking.</div>
                  </div>
                  <Badge>Mock</Badge>
                </div>
                <div className="mt-4 divide-y divide-gray-100">
                  {["Jaw width", "Midface ratio", "Eye spacing", "Cheekbone prominence"].map((label) => (
                    <div key={label} className="py-3 flex items-center justify-between">
                      <span className="text-sm text-gray-700">{label}</span>
                      <span className="text-sm font-medium text-gray-900">High</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="rounded-xl border-gray-200/60 p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">Top weaknesses</div>
                    <div className="mt-1 text-xs text-gray-500">Mock ranking.</div>
                  </div>
                  <Badge className="bg-gray-50 text-gray-600">Mock</Badge>
                </div>
                <div className="mt-4 divide-y divide-gray-100">
                  {["Gonial angle", "Brow position", "Nasal projection"].map((label) => (
                    <div key={label} className="py-3 flex items-center justify-between">
                      <span className="text-sm text-gray-700">{label}</span>
                      <span className="text-sm font-medium text-gray-900">Medium</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="rounded-xl border-gray-200/60 p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">Distribution</div>
                    <div className="mt-1 text-xs text-gray-500">Placeholder histogram.</div>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-gray-200/60 bg-gradient-to-b from-gray-50 to-white p-4">
                  <div className="flex items-end gap-2 h-20">
                    {[18, 34, 52, 41, 28, 20].map((h, i) => (
                      <div key={i} className="flex-1 min-w-0">
                        <div className="w-full bg-gray-900/10 rounded-md" style={{ height: `${h}px` }} />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </aside>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  hint,
  badge,
}: {
  label: string;
  value: string;
  hint: string;
  badge?: string;
}) {
  return (
    <Card className="rounded-xl border-gray-200/60 p-4 flex-1">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{value}</div>
        </div>
        {badge ? (
          <span className="text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-700 shrink-0">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-xs text-gray-500">{hint}</div>
    </Card>
  );
}

