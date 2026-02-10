import { ProfileShell } from "@/components/blackpill/profile/ProfileShell";

export const metadata = {
  title: "Account",
};

export default function UiProfilePage() {
  return (
    <ProfileShell title="Account" subtitle="Manage your account and subscription">
      <div className="space-y-6">
        <div className="border border-gray-200 rounded-lg p-4 sm:p-6">
          <h2 className="text-lg font-medium">Account Information</h2>

          <div className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-gray-100 gap-1 sm:gap-0">
              <span className="text-sm text-gray-600">Name</span>
              <span className="text-sm font-medium">Blackpill User</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-gray-100 gap-1 sm:gap-0">
              <span className="text-sm text-gray-600">Email</span>
              <span className="text-sm font-medium break-all">user@blackpill.local</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-sm text-gray-600">Username</span>
              <span className="text-sm font-medium">—</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-gray-100 gap-1 sm:gap-0">
              <span className="text-sm text-gray-600">Referred By</span>
              <span className="text-sm font-medium">—</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between py-3 gap-1 sm:gap-0">
              <span className="text-sm text-gray-600">Member For</span>
              <span className="text-sm font-medium">3 days</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Data Export</h2>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  Download all your data including face images, analyses, subscription history, and
                  transactions as a ZIP file.
                </p>
              </div>

              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
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
                  className="lucide lucide-download w-4 h-4"
                  aria-hidden="true"
                >
                  <path d="M12 15V3"></path>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <path d="m7 10 5 5 5-5"></path>
                </svg>
                <span>Download Data</span>
              </button>
            </div>
          </div>

          <div className="border border-red-200 rounded-lg p-6 bg-red-50/50">
            <h2 className="text-lg font-medium text-red-900 mb-4">Danger Zone</h2>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900">Delete Account</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Permanently delete your account and all associated data. This action cannot be
                  undone.
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  If you wish to delete your account and remove your subscription immediately,
                  please contact support.
                </p>
              </div>

              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
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
                  className="lucide lucide-trash2 lucide-trash-2 w-4 h-4"
                  aria-hidden="true"
                >
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                  <path d="M3 6h18"></path>
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProfileShell>
  );
}
