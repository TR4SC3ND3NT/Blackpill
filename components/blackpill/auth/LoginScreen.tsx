"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/blackpill/Button";
import { Card } from "@/components/blackpill/Card";

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 4 && !submitting;

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="text-2xl font-semibold tracking-tight text-gray-900">Login</div>
          <div className="mt-2 text-sm text-gray-600">UI-only auth shell.</div>
        </div>

        <Card className="mt-8 rounded-xl border-gray-200/50 p-6">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!canSubmit) return;
              setSubmitting(true);
              try {
                router.push("/ui/dashboard");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="w-full justify-center" disabled={!canSubmit}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </div>
          </form>

          <div className="mt-5 text-center text-sm text-gray-600">
            No account?{" "}
            <Link href="/ui/auth/register" className="font-medium text-gray-900 hover:opacity-70">
              Register
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

