export type AnalyticsTimeRange = "7d" | "30d" | "90d";

export type AnalyticsPoint = {
  t: string;
  value: number;
};

export type AnalyticsBreakdownRow = {
  label: string;
  value: string;
  delta: string;
};

export const mockAnalytics: {
  timeRanges: readonly AnalyticsTimeRange[];
  seriesOverall: AnalyticsPoint[];
  breakdownRows: AnalyticsBreakdownRow[];
} = {
  timeRanges: ["7d", "30d", "90d"] as const,
  seriesOverall: [
    66, 64, 67, 68, 70, 69, 71, 72, 73, 71, 74, 73, 72, 74, 75, 74, 76, 78, 77, 76, 78, 79, 77, 78, 80,
    79, 81, 80, 82, 81, 83, 82, 81, 82, 84, 83, 84, 85, 84, 83, 84, 82, 81, 82, 83, 82, 81, 82, 83, 84,
    83, 82, 83, 84, 84, 83, 84, 85, 84,
  ].map((v, i) => ({ t: `D-${59 - i}`, value: v })),
  breakdownRows: [
    { label: "Harmony", value: "7.2 / 10", delta: "+0.3" },
    { label: "Angularity", value: "6.3 / 10", delta: "+0.1" },
    { label: "Dimorphism", value: "6.0 / 10", delta: "-0.2" },
    { label: "Features", value: "6.8 / 10", delta: "+0.4" },
    { label: "fWHR", value: "1.87", delta: "+0.02" },
    { label: "Gonial Angle", value: "118°", delta: "-4°" },
    { label: "Midface Ratio", value: "0.96", delta: "+0.01" },
    { label: "Nasal Projection", value: "1.03", delta: "+0.00" },
    { label: "Eye Spacing", value: "0.98", delta: "+0.01" },
    { label: "Jaw Width", value: "1.11", delta: "+0.03" },
  ],
};

