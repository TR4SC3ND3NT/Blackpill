"use client";

import { cn } from "@/lib/cn";
import { ANALYTICS_TIME_RANGES, type AnalyticsTimeRange } from "@/lib/analyticsFromSnapshots";

export type TimeRangeButtonsProps = {
  value: AnalyticsTimeRange;
  onChange: (next: AnalyticsTimeRange) => void;
};

export function TimeRangeButtons({ value, onChange }: TimeRangeButtonsProps) {
  return (
    <div className="inline-flex items-center rounded-md border border-gray-200 bg-white p-0.5">
      {ANALYTICS_TIME_RANGES.map((range) => {
        const active = range === value;
        return (
          <button
            key={range}
            type="button"
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
              active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100",
            )}
            onClick={() => onChange(range)}
            aria-pressed={active}
          >
            {range}
          </button>
        );
      })}
    </div>
  );
}
