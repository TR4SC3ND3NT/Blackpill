import { AppShell } from "@/components/blackpill/shell/AppShell";
import { DashboardContent } from "@/components/blackpill/dashboard/DashboardContent";

export const metadata = {
  title: "Dashboard",
};

export default function UiDashboardPage() {
  return (
    <AppShell title="Dashboard" subtitle="Overview and recent analyses">
      <DashboardContent />
    </AppShell>
  );
}
