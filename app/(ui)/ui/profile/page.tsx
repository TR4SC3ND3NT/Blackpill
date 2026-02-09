import { TopHeader } from "@/components/blackpill/shell/TopHeader";

export const metadata = {
  title: "Profile",
};

export default function UiProfilePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white">
        <TopHeader />
      </div>

      <main className="max-w-7xl mx-auto px-4 py-3 md:py-12">
        <div>
          <h1 className="text-3xl font-semibold">Account</h1>
          <p className="mt-2 text-gray-600">Manage your account and subscription</p>
        </div>

        <div className="mt-8">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
            <nav className="lg:hidden -mx-4 px-4 overflow-x-auto">
              <div className="flex gap-2 min-w-max pb-1">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap bg-black text-white"
                >
                  Account
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap text-gray-600 hover:bg-gray-100 border border-gray-200"
                >
                  Usage
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap text-gray-600 hover:bg-gray-100 border border-gray-200"
                >
                  Your Plan
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap text-gray-600 hover:bg-gray-100 border border-gray-200"
                >
                  Billing
                </button>
              </div>
            </nav>

            <aside className="hidden lg:block w-48 flex-shrink-0">
              <nav className="space-y-1">
                <button
                  type="button"
                  className="block w-full text-left px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-black text-white"
                >
                  Account
                </button>
                <button
                  type="button"
                  className="block w-full text-left px-4 py-2 text-sm font-medium rounded-lg transition-colors text-gray-600 hover:bg-gray-100"
                >
                  Usage
                </button>
                <button
                  type="button"
                  className="block w-full text-left px-4 py-2 text-sm font-medium rounded-lg transition-colors text-gray-600 hover:bg-gray-100"
                >
                  Your Plan
                </button>
                <button
                  type="button"
                  className="block w-full text-left px-4 py-2 text-sm font-medium rounded-lg transition-colors text-gray-600 hover:bg-gray-100"
                >
                  Billing
                </button>
              </nav>
            </aside>

            <main className="flex-1 min-w-0">
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

                <div className="border border-gray-200 rounded-lg p-4 sm:p-6">
                  <h2 className="text-lg font-medium">Subscription</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Mocked subscription block. Billing routes are intentionally not implemented yet.
                  </p>
                  <div className="mt-5 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700">
                      Free
                    </span>
                    <span className="text-xs text-gray-500">Next reset: 23h</span>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </main>
    </div>
  );
}

