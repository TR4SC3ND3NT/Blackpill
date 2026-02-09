export type ProfileTabId = "account" | "usage" | "plan";

export type ProfileUser = {
  name: string;
  email: string;
  username: string;
  referredBy: string;
  memberForLabel: string;
};

export type ProfilePlan = {
  tierLabel: string;
  nextResetLabel: string;
  cohortLabel: string;
};

export const mockProfile: {
  user: ProfileUser;
  plan: ProfilePlan;
  usage: {
    analysesThisMonth: number;
    exportsThisMonth: number;
    lastActiveLabel: string;
  };
} = {
  user: {
    name: "Blackpill User",
    email: "user@blackpill.local",
    username: "—",
    referredBy: "—",
    memberForLabel: "3 days",
  },
  plan: {
    tierLabel: "Free",
    nextResetLabel: "23h",
    cohortLabel: "asian_male_young",
  },
  usage: {
    analysesThisMonth: 12,
    exportsThisMonth: 0,
    lastActiveLabel: "2h ago",
  },
};

