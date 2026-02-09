export function Footer() {
  return (
    <footer
      className="flex-shrink-0 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(248, 250, 252, 0.6) 100%)",
        borderTop: "1px solid rgba(114, 131, 140, 0.08)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backdropFilter: "blur(8px) saturate(1.1)",
          WebkitBackdropFilter: "blur(8px) saturate(1.1)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255, 255, 255, 0.5) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <span className="flex items-center">
            <a
              className="px-3 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-200"
              style={{ color: "#72838c" }}
              href="/support"
            >
              Support
            </a>
            <span className="mx-1 text-[10px]" style={{ color: "rgba(114, 131, 140, 0.3)" }}>
              •
            </span>
          </span>
          <span className="flex items-center">
            <a
              className="px-3 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-200"
              style={{ color: "#72838c" }}
              href="/terms"
            >
              Terms
            </a>
            <span className="mx-1 text-[10px]" style={{ color: "rgba(114, 131, 140, 0.3)" }}>
              •
            </span>
          </span>
          <span className="flex items-center">
            <a
              className="px-3 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-200"
              style={{ color: "#72838c" }}
              href="/privacy"
            >
              Privacy
            </a>
            <span className="mx-1 text-[10px]" style={{ color: "rgba(114, 131, 140, 0.3)" }}>
              •
            </span>
          </span>
          <span className="flex items-center">
            <a
              className="px-3 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-200"
              style={{ color: "#72838c" }}
              href="/roadmap"
            >
              Roadmap
            </a>
          </span>
        </div>

        <a
          href="https://discord.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-xl transition-all duration-300"
          style={{
            background:
              "linear-gradient(135deg, rgba(88, 101, 242, 0.1) 0%, rgba(88, 101, 242, 0.05) 100%)",
            color: "#5865F2",
            border: "1px solid rgba(88, 101, 242, 0.2)",
          }}
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
            className="lucide lucide-message-circle w-4 h-4"
            aria-hidden="true"
          >
            <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"></path>
          </svg>
          Join Discord
        </a>
      </div>
    </footer>
  );
}

