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

export const mockDashboard: { user: MockDashboardUser; history: MockHistoryItem[] } = {
  user: {
    name: "Blackpill User",
    planLabel: "Free",
    initials: "B",
    avatarUrl: null,
  },
  history: [
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
  ],
};

