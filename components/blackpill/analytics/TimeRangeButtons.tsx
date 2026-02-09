"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { mockAnalytics, type AnalyticsTimeRange } from "@/lib/mock/analytics";

export function TimeRangeButtons() {
  const [value, setValue] = useState<AnalyticsTimeRange>("30d");

  return (
    <div className="inline-flex items-center rounded-md border border-gray-200 bg-white p-0.5">
      {mockAnalytics.timeRanges.map((range) => {
        const active = range === value;
        return (
          <button
            key={range}
            type="button"
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
              active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100",
            )}
            onClick={() => setValue(range)}
            aria-pressed={active}
          >
            {range}
          </button>
        );
      })}
    </div>
  );
}

