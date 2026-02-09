export type ReportStatus = "Complete" | "Queued" | "Failed";

export type ReportRow = {
  id: string;
  createdAtLabel: string;
  overall: number;
  cohort: string;
  status: ReportStatus;
};

export const mockReports: {
  statuses: readonly ReportStatus[];
  rows: ReportRow[];
} = {
  statuses: ["Complete", "Queued", "Failed"] as const,
  rows: [
    { id: "rpt_9cml95ip9", createdAtLabel: "2h", overall: 82, cohort: "asian_male_young", status: "Complete" },
    { id: "rpt_7cml95f8a", createdAtLabel: "1d", overall: 74, cohort: "asian_male_young", status: "Complete" },
    { id: "rpt_2cml94zz2", createdAtLabel: "3d", overall: 79, cohort: "asian_male_young", status: "Queued" },
    { id: "rpt_5cml94u3k", createdAtLabel: "5d", overall: 70, cohort: "asian_male_young", status: "Complete" },
    { id: "rpt_4cml94p0x", createdAtLabel: "1w", overall: 76, cohort: "asian_male_young", status: "Failed" },
    { id: "rpt_3cml93kq1", createdAtLabel: "2w", overall: 68, cohort: "asian_male_young", status: "Complete" },
    { id: "rpt_1cml92aa7", createdAtLabel: "3w", overall: 73, cohort: "asian_male_young", status: "Queued" },
    { id: "rpt_0cml91b8m", createdAtLabel: "1m", overall: 65, cohort: "asian_male_young", status: "Complete" },
  ],
};

