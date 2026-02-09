export type MockDashboardUser = {
  name: string;
  planLabel: string;
  initials: string;
  avatarUrl?: string | null;
};

export type MockHistoryItem = {
  id: string;
  createdAtLabel: string;
  overall: number;
  harmony: number;
  angularity: number;
  dimorphism: number;
  features: number;
  thumbnailUrl?: string | null;
};

export type MockDashboardKpis = {
  overallAvg: number;
  overallAvgDelta?: number;
  bestOverall: number;
  analysesCount: number;
  last7Days: number;
};

export type MockSeriesPoint = {
  t: string;
  overall: number;
};

export type MockAnalysisDetails = {
  id: string;
  name: string;
  createdAtIso: string;
  createdAtLabel: string;
  overall: number;
  pillars: {
    harmony: number;
    angularity: number;
    dimorphism: number;
    features: number;
  };
  notes: string;
};

export type MockDashboardData = {
  user: MockDashboardUser;
  history: MockHistoryItem[];
  kpis: MockDashboardKpis;
  series: {
    overall: MockSeriesPoint[];
  };
  analysesById: Record<string, MockAnalysisDetails>;
};

const user: MockDashboardUser = {
  name: "Blackpill User",
  planLabel: "Free",
  initials: "B",
  avatarUrl: null,
};

const history: MockHistoryItem[] = [
  {
    id: "cml95ip9",
    createdAtLabel: "2h",
    overall: 82,
    harmony: 7.6,
    angularity: 6.9,
    dimorphism: 6.2,
    features: 7.1,
    thumbnailUrl: null,
  },
  {
    id: "cml95f8a",
    createdAtLabel: "1d",
    overall: 74,
    harmony: 6.8,
    angularity: 6.0,
    dimorphism: 5.9,
    features: 6.7,
    thumbnailUrl: null,
  },
  {
    id: "cml94zz2",
    createdAtLabel: "3d",
    overall: 79,
    harmony: 7.2,
    angularity: 6.6,
    dimorphism: 6.1,
    features: 7.0,
    thumbnailUrl: null,
  },
  {
    id: "cml94u3k",
    createdAtLabel: "5d",
    overall: 70,
    harmony: 6.4,
    angularity: 5.8,
    dimorphism: 5.6,
    features: 6.2,
    thumbnailUrl: null,
  },
  {
    id: "cml94p0x",
    createdAtLabel: "1w",
    overall: 76,
    harmony: 7.0,
    angularity: 6.2,
    dimorphism: 6.0,
    features: 6.8,
    thumbnailUrl: null,
  },
  {
    id: "cml93kq1",
    createdAtLabel: "2w",
    overall: 68,
    harmony: 6.1,
    angularity: 5.7,
    dimorphism: 5.4,
    features: 6.0,
    thumbnailUrl: null,
  },
  {
    id: "cml92aa7",
    createdAtLabel: "3w",
    overall: 73,
    harmony: 6.7,
    angularity: 6.1,
    dimorphism: 5.7,
    features: 6.5,
    thumbnailUrl: null,
  },
  {
    id: "cml91b8m",
    createdAtLabel: "1m",
    overall: 65,
    harmony: 5.8,
    angularity: 5.4,
    dimorphism: 5.1,
    features: 5.9,
    thumbnailUrl: null,
  },
];

const analysesById: Record<string, MockAnalysisDetails> = Object.fromEntries(
  history.map((h, idx) => [
    h.id,
    {
      id: h.id,
      name: `Analysis ${h.id}`,
      createdAtIso: "2026-02-09T00:00:00.000Z",
      createdAtLabel: h.createdAtLabel,
      overall: h.overall,
      pillars: {
        harmony: h.harmony,
        angularity: h.angularity,
        dimorphism: h.dimorphism,
        features: h.features,
      },
      notes:
        idx === 0
          ? "High overall with strong harmony. Consider improving angularity consistency."
          : "Mock analysis details for UI layout only.",
    },
  ]),
);

const overallAvg = Math.round(history.reduce((acc, h) => acc + h.overall, 0) / Math.max(1, history.length));
const bestOverall = history.reduce((max, h) => Math.max(max, h.overall), 0);

const kpis: MockDashboardKpis = {
  overallAvg,
  overallAvgDelta: 2,
  bestOverall,
  analysesCount: history.length,
  last7Days: 4,
};

const seriesOverall: MockSeriesPoint[] = [
  66, 64, 67, 68, 70, 69, 71, 72, 73, 71, 74, 73, 72, 74, 75, 74, 76, 78, 77, 76, 78, 79, 77, 78, 80, 79,
  81, 80, 82, 81,
].map((v, i) => ({ t: `D-${29 - i}`, overall: v }));

export const mockDashboard: MockDashboardData = {
  user,
  history,
  kpis,
  series: {
    overall: seriesOverall,
  },
  analysesById,
};

export function getMockAnalysisDetails(id: string): MockAnalysisDetails | null {
  return mockDashboard.analysesById[id] ?? null;
}
