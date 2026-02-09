import { AppShell } from "@/components/blackpill/shell/AppShell";

export const metadata = {
  title: "Dashboard",
};

export default function UiDashboardPage() {
  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-gray-600">Dashboard content placeholder</p>
      </div>
    </AppShell>
  );
}

