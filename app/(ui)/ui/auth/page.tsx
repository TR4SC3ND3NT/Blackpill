import Link from "next/link";
import { Card } from "@/components/blackpill/Card";

export const metadata = {
  title: "Auth",
};

export default function UiAuthPage() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <div className="text-center">
          <div className="text-2xl font-semibold tracking-tight text-gray-900">Welcome back</div>
          <div className="mt-2 text-sm text-gray-600">
            This is a UI-only auth shell to mirror the reference routes.
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/ui/auth/login" className="block">
            <Card className="rounded-xl border-gray-200/50 p-6 hover:bg-gray-50 transition-colors">
              <div className="text-sm font-medium text-gray-900">Login</div>
              <div className="mt-1 text-sm text-gray-600">Sign in to your account.</div>
            </Card>
          </Link>
          <Link href="/ui/auth/register" className="block">
            <Card className="rounded-xl border-gray-200/50 p-6 hover:bg-gray-50 transition-colors">
              <div className="text-sm font-medium text-gray-900">Register</div>
              <div className="mt-1 text-sm text-gray-600">Create a new account.</div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
