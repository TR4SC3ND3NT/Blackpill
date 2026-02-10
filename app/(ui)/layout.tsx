import type { Metadata } from "next";
import "./ui.css";
import { UiSettingsApplier } from "@/components/blackpill/shell/UiSettingsApplier";
import { Manrope } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Blackpill",
    template: "%s | Blackpill",
  },
  description: "Blackpill UI shell.",
};

export default function UiLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // RootLayout wraps everything in a centered container and applies a dark theme.
  // Tailwind is scoped via `important: ".bp"` so utilities won't apply on the `.bp`
  // element itself. We keep `.bp` as the scope root and render the actual UI
  // inside a child that can use utilities.
  return (
    <div className={`bp ${manrope.variable}`}>
      <div className="fixed inset-0 overflow-y-auto text-gray-900 antialiased">
        <div className="bp-ui-bg" aria-hidden="true" />
        <UiSettingsApplier />
        <div className="relative min-h-screen">{children}</div>
      </div>
    </div>
  );
}
