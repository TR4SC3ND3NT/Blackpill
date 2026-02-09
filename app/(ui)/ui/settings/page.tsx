import { SettingsContent } from "@/components/blackpill/settings/SettingsContent";
import { AppShell } from "@/components/blackpill/shell/AppShell";

export const metadata = {
  title: "Settings",
};

export default function UiSettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Preferences and configuration">
      <SettingsContent />
    </AppShell>
  );
}

