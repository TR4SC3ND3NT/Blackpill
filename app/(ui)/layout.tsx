import type { Metadata } from "next";
import "./ui.css";

export const metadata: Metadata = {
  title: {
    default: "Blackpill",
    template: "%s | Blackpill",
  },
  description: "Blackpill UI shell (mock).",
};

export default function UiLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // RootLayout wraps everything in a centered container; we render the UI
  // clone as a full-viewport layer so it can't affect the existing flow.
  return (
    <div className="bp fixed inset-0 overflow-y-auto bg-neutral-50 text-gray-900 antialiased">
      {children}
    </div>
  );
}

