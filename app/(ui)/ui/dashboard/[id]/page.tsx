import { DashboardContent } from "@/components/blackpill/dashboard/DashboardContent";
import { AppShell } from "@/components/blackpill/shell/AppShell";

export const metadata = {
  title: "Dashboard",
};

export default async function UiDashboardAnalysisPage({
  params,
}: {
  // Next 16 treats route params as async in dev; unwrap to avoid `params` Promise warnings.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell
      title="Dashboard"
      subtitle={`Selected analysis: ${id}`}
      selectedAnalysisId={id}
    >
      <DashboardContent selectedId={id} />
    </AppShell>
  );
}
