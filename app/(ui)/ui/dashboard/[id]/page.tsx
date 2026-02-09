import { DashboardContent } from "@/components/blackpill/dashboard/DashboardContent";
import { AppShell } from "@/components/blackpill/shell/AppShell";

export const metadata = {
  title: "Dashboard",
};

export default function UiDashboardAnalysisPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <AppShell
      title="Dashboard"
      subtitle={`Selected analysis: ${params.id}`}
      selectedAnalysisId={params.id}
    >
      <DashboardContent selectedId={params.id} />
    </AppShell>
  );
}
