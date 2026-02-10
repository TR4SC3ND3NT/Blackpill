import { ProfileShell } from "@/components/blackpill/profile/ProfileShell";

export const metadata = {
  title: "Your Plan",
};

export default function UiProfilePlanPage() {
  return (
    <ProfileShell title="Your Plan" subtitle="Subscription and plan details">
      <div className="space-y-6">
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-medium">Plan</h2>
          <p className="mt-2 text-sm text-gray-600">
            This section is UI-only for now.
          </p>
        </div>
      </div>
    </ProfileShell>
  );
}

