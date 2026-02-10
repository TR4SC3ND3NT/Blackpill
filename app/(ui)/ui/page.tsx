import { AppShell } from "@/components/blackpill/shell/AppShell";
import { DashboardContent } from "@/components/blackpill/dashboard/DashboardContent";

export const metadata = {
  title: "Dashboard",
};

export default function UiIndexPage() {
  // Reference `index.html` is essentially the same shell as dashboard.
  return (
    <AppShell title="Dashboard" subtitle="Overview and recent analyses">
      <DashboardContent />
    </AppShell>
  );
}

