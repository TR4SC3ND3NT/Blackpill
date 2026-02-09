"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/blackpill/Button";
import { Card } from "@/components/blackpill/Card";
import { cn } from "@/lib/cn";
import { mockSettings, type SettingsItem, type SettingsSection, type SettingsSectionId } from "@/lib/mock/settings";
import { loadUiSettings, saveUiSettings, subscribeUiSettings, type UiSettings } from "@/lib/uiSettings";

type SettingValue = string | boolean;
type SettingsValues = Record<string, SettingValue>;

export function SettingsContent() {
  const sections = mockSettings.sections;
  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);
  const [active, setActive] = useState<SettingsSectionId>(sectionIds[0] ?? "general");
  const [values, setValues] = useState<SettingsValues>(() => {
    const stored = loadUiSettings();
    const next: SettingsValues = {};
    for (const section of sections) {
      for (const item of section.items) {
        const storedValue = (stored as unknown as Record<string, SettingValue>)[item.id];
        next[item.id] = typeof storedValue !== "undefined" ? storedValue : item.value;
      }
    }
    return next;
  });

  useEffect(() => {
    return subscribeUiSettings(() => {
      const stored = loadUiSettings();
      setValues((prev) => ({ ...prev, ...stored }));
    });
  }, []);

  const activeSection = sections.find((s) => s.id === active) ?? sections[0];

  return (
    <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
          <SectionNavMobile
            sections={sections}
            active={active}
            onChange={(id) => setActive(id)}
          />

          <aside className="hidden lg:block w-52 flex-shrink-0">
            <nav className="space-y-1">
              {sections.map((s) => {
                const isActive = s.id === active;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={cn(
                      "block w-full text-left px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100",
                    )}
                    onClick={() => setActive(s.id)}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {s.title}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="flex-1 min-w-0">
            {activeSection ? (
              <SectionPanel
                section={activeSection}
                values={values}
                onValueChange={(id, value) => {
                  setValues((prev) => ({ ...prev, [id]: value }));
                  if (
                    id === "language" ||
                    id === "units" ||
                    id === "defaultCohort" ||
                    id === "shareAnonymizedAnalytics" ||
                    id === "allowModelImprovement" ||
                    id === "compactMode" ||
                    id === "reducedMotion"
                  ) {
                    saveUiSettings({ [id]: value } as Partial<UiSettings>);
                  }
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionNavMobile({
  sections,
  active,
  onChange,
}: {
  sections: SettingsSection[];
  active: SettingsSectionId;
  onChange: (id: SettingsSectionId) => void;
}) {
  return (
    <nav className="lg:hidden -mx-6 px-6 overflow-x-auto">
      <div className="flex gap-2 min-w-max pb-1">
        {sections.map((s) => {
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap border",
                isActive ? "bg-gray-900 text-white border-gray-900" : "text-gray-600 hover:bg-gray-100 border-gray-200",
              )}
              onClick={() => onChange(s.id)}
              aria-pressed={isActive}
            >
              {s.title}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function SectionPanel({
  section,
  values,
  onValueChange,
}: {
  section: SettingsSection;
  values: SettingsValues;
  onValueChange: (id: string, value: SettingValue) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
        {section.description ? <p className="mt-1 text-sm text-gray-600">{section.description}</p> : null}
      </div>

      <Card className="rounded-xl border-gray-200/60 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {section.items.map((item) => (
            <div key={item.id} className="px-4 sm:px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{item.label}</div>
                  {item.description ? <div className="mt-1 text-xs text-gray-500">{item.description}</div> : null}
                </div>
                <div className="shrink-0">{renderControl(item, values, onValueChange)}</div>
              </div>
            </div>
          ))}
        </div>

        {section.id === "api" ? (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              API access is mocked in the UI shell.
            </div>
            <Button variant="outline" size="sm" disabled>
              Generate
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function renderControl(
  item: SettingsItem,
  values: SettingsValues,
  onValueChange: (id: string, value: SettingValue) => void,
) {
  const disabled = Boolean(item.disabled);

  switch (item.type) {
    case "toggle": {
      const checked = Boolean(values[item.id]);
      return (
        <Toggle
          checked={checked}
          disabled={disabled}
          onCheckedChange={(next) => onValueChange(item.id, next)}
        />
      );
    }
    case "select": {
      const value = String(values[item.id] ?? "");
      return (
        <select
          className="w-56 max-w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:opacity-60"
          value={value}
          onChange={(e) => onValueChange(item.id, e.target.value)}
          disabled={disabled}
        >
          {item.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }
    case "text":
    default: {
      const value = String(values[item.id] ?? "");
      return (
        <input
          className={cn(
            "w-72 max-w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:bg-gray-50 disabled:text-gray-600 disabled:opacity-80",
            item.monospaced ? "font-mono" : undefined,
          )}
          value={value}
          placeholder={item.placeholder}
          onChange={(e) => onValueChange(item.id, e.target.value)}
          disabled={disabled}
          readOnly={disabled}
        />
      );
    }
  }
}

function Toggle({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:opacity-60",
        checked ? "bg-gray-900" : "bg-gray-200",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-1",
        )}
      />
    </button>
  );
}
