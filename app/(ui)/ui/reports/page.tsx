import { Badge } from "@/components/blackpill/Badge";
import { Card } from "@/components/blackpill/Card";
import { AppShell } from "@/components/blackpill/shell/AppShell";
import { mockReports, type ReportStatus } from "@/lib/mock/reports";

export const metadata = {
  title: "Reports",
};

export default function UiReportsPage() {
  return (
    <AppShell
      title="Reports"
      subtitle="Exports and history"
      rightSlot={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
        >
          Export
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-download h-4 w-4"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M7 10l5 5 5-5" />
            <path d="M12 15V3" />
          </svg>
        </button>
      }
    >
      <div className="max-w-7xl mx-auto px-6 py-6 sm:py-8">
        <div className="space-y-6">
          <Card className="rounded-xl border-gray-200/60 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">Filters</div>
                <div className="mt-1 text-xs text-gray-500">UI only (no filtering logic).</div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="relative">
                  <input
                    type="search"
                    placeholder="Search reports..."
                    className="w-full sm:w-64 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
                  />
                </div>

                <select className="w-full sm:w-44 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300">
                  <option value="">All statuses</option>
                  {mockReports.statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card className="rounded-xl border-gray-200/60 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">Report history</div>
                <div className="mt-1 text-xs text-gray-500">Mock rows styled like the reference.</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-medium text-gray-500">
                    <th className="px-4 sm:px-6 py-3">Report</th>
                    <th className="px-4 sm:px-6 py-3">Date</th>
                    <th className="px-4 sm:px-6 py-3">Cohort</th>
                    <th className="px-4 sm:px-6 py-3">Overall</th>
                    <th className="px-4 sm:px-6 py-3">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mockReports.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{row.id}</div>
                        <div className="mt-1 text-xs text-gray-500">PDF export (mock)</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{row.createdAtLabel} ago</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{row.cohort}</td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">
                          {row.overall}
                        </span>
                        <span className="text-sm text-gray-500"> / 100</span>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <Badge variant={badgeVariant(row.status)}>{row.status}</Badge>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <a
                          href="#"
                          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
                        >
                          View
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="lucide lucide-arrow-right h-4 w-4"
                            aria-hidden="true"
                          >
                            <path d="M5 12h14" />
                            <path d="m12 5 7 7-7 7" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="rounded-xl border-gray-200/60 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">Export notes</div>
                <div className="mt-1 text-xs text-gray-500">
                  Reports are mocked. No export logic is implemented yet.
                </div>
              </div>
              <Badge className="bg-gray-50 text-gray-600">UI only</Badge>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function badgeVariant(status: ReportStatus): "neutral" | "success" | "danger" {
  switch (status) {
    case "Complete":
      return "success";
    case "Failed":
      return "danger";
    case "Queued":
    default:
      return "neutral";
  }
}
