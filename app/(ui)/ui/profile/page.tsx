import { ProfileContent } from "@/components/blackpill/profile/ProfileContent";
import { AppShell } from "@/components/blackpill/shell/AppShell";

export const metadata = {
  title: "Profile",
};

export default function UiProfilePage() {
  return (
    <AppShell title="Profile" subtitle="Account and subscription">
      <ProfileContent />
    </AppShell>
  );
}
