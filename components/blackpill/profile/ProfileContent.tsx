"use client";

import { useState } from "react";
import { Badge } from "@/components/blackpill/Badge";
import { Button } from "@/components/blackpill/Button";
import { Card } from "@/components/blackpill/Card";
import { cn } from "@/lib/cn";
import { mockProfile, type ProfileTabId } from "@/lib/mock/profile";

const tabs: Array<{ id: ProfileTabId; label: string }> = [
  { id: "account", label: "Account" },
  { id: "usage", label: "Usage" },
  { id: "plan", label: "Plan" },
];

export function ProfileContent() {
  const [active, setActive] = useState<ProfileTabId>("account");

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 sm:py-8">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
          <nav className="lg:hidden -mx-6 px-6 overflow-x-auto">
            <div className="flex gap-2 min-w-max pb-1">
              {tabs.map((t) => {
                const isActive = t.id === active;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap border",
                      isActive
                        ? "bg-gray-900 text-white border-gray-900"
                        : "text-gray-600 hover:bg-gray-100 border-gray-200",
                    )}
                    onClick={() => setActive(t.id)}
                    aria-pressed={isActive}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <aside className="hidden lg:block w-52 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map((t) => {
                const isActive = t.id === active;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={cn(
                      "block w-full text-left px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100",
                    )}
                    onClick={() => setActive(t.id)}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1 min-w-0">
            {active === "account" ? <AccountTab /> : null}
            {active === "usage" ? <UsageTab /> : null}
            {active === "plan" ? <PlanTab /> : null}
          </main>
        </div>
      </div>
    </div>
  );
}

function AccountTab() {
  return (
    <div className="space-y-6">
      <Card className="rounded-xl border-gray-200/60 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900">Account information</div>
            <div className="mt-1 text-xs text-gray-500">UI-only profile details.</div>
          </div>
          <Badge className="shrink-0">Blackpill</Badge>
        </div>

        <div className="mt-5 divide-y divide-gray-100">
          <InfoRow label="Name" value={mockProfile.user.name} />
          <InfoRow label="Email" value={mockProfile.user.email} monospace />
          <InfoRow label="Username" value={mockProfile.user.username} />
          <InfoRow label="Referred by" value={mockProfile.user.referredBy} />
          <InfoRow label="Member for" value={mockProfile.user.memberForLabel} />
        </div>
      </Card>

      <Card className="rounded-xl border-gray-200/60 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900">Security</div>
            <div className="mt-1 text-xs text-gray-500">Actions are placeholders.</div>
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-sm text-gray-700">Password</div>
          <Button variant="outline" size="sm" disabled>
            Change password
          </Button>
        </div>
      </Card>
    </div>
  );
}

function UsageTab() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row gap-3">
        <KpiCard label="Analyses" value={`${mockProfile.usage.analysesThisMonth}`} hint="This month (mock)" />
        <KpiCard label="Exports" value={`${mockProfile.usage.exportsThisMonth}`} hint="This month (mock)" />
        <KpiCard label="Last active" value={mockProfile.usage.lastActiveLabel} hint="Activity (mock)" />
      </section>

      <Card className="rounded-xl border-gray-200/60 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900">Usage details</div>
            <div className="mt-1 text-xs text-gray-500">Mock rows styled like the reference.</div>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            { label: "Latest cohort", value: mockProfile.plan.cohortLabel },
            { label: "History retention", value: "Enabled" },
            { label: "Exports", value: "UI only" },
          ].map((row) => (
            <div key={row.label} className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
              <span className="text-sm text-gray-700">{row.label}</span>
              <span className="text-sm font-medium text-gray-900">{row.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PlanTab() {
  return (
    <div className="space-y-6">
      <Card className="rounded-xl border-gray-200/60 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900">Subscription</div>
            <div className="mt-1 text-xs text-gray-500">Mocked plan block (UI only).</div>
          </div>
          <Badge className="shrink-0">{mockProfile.plan.tierLabel}</Badge>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Tier</span>
            <span className="text-sm font-medium text-gray-900">{mockProfile.plan.tierLabel}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-gray-100">
            <span className="text-sm text-gray-600">Next reset</span>
            <span className="text-sm font-medium text-gray-900">{mockProfile.plan.nextResetLabel}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-gray-100">
            <span className="text-sm text-gray-600">Default cohort</span>
            <span className="text-sm font-medium text-gray-900">{mockProfile.plan.cohortLabel}</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-xs text-gray-500">Plan management is a UI placeholder.</div>
          <Button variant="outline" size="sm" disabled>
            Manage plan
          </Button>
        </div>
      </Card>

      <Card className="rounded-xl border-gray-200/60 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900">Included features</div>
            <div className="mt-1 text-xs text-gray-500">Mock list for layout parity.</div>
          </div>
        </div>
        <div className="mt-4 divide-y divide-gray-100">
          {[
            { label: "History", value: "Unlimited (mock)" },
            { label: "Exports", value: "Limited (mock)" },
            { label: "Cohorts", value: "Available (mock)" },
          ].map((row) => (
            <div key={row.label} className="py-3 flex items-center justify-between gap-4">
              <span className="text-sm text-gray-700">{row.label}</span>
              <span className="text-sm font-medium text-gray-900">{row.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function InfoRow({
  label,
  value,
  monospace,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={cn("text-sm font-medium text-gray-900 break-all", monospace ? "font-mono" : undefined)}>
        {value}
      </span>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="rounded-xl border-gray-200/60 p-4 flex-1">
      <div className="min-w-0">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</div>
        <div className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{value}</div>
        <div className="mt-2 text-xs text-gray-500">{hint}</div>
      </div>
    </Card>
  );
}

