"use client";

import { Avatar } from "@/components/blackpill/Avatar";
import { mockDashboard } from "@/lib/mock/dashboard";

export type SidebarProps = {
  open: boolean;
};

export function Sidebar({ open }: SidebarProps) {
  const { user, history } = mockDashboard;

  return (
    <aside
      className="flex flex-col fixed top-0 bottom-0 left-0 z-50 bg-white w-[min(320px,100vw)] shadow-2xl transition-transform duration-300"
      style={{ boxShadow: "none", transform: open ? "translateX(0)" : "translateX(-100%)" }}
      aria-hidden={!open}
    >
      <div className="relative h-12 flex items-center px-3 flex-shrink-0">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Blackpill" width="18" height="18" className="flex-shrink-0" />
          <span className="font-semibold text-sm tracking-tight text-gray-900">Blackpill</span>
        </div>
      </div>

      <div className="px-3 py-3 flex-shrink-0">
        <div className="relative overflow-hidden px-3 pt-3 rounded-xl border border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 relative">
              <Avatar
                shape="square"
                size="md"
                src={user.avatarUrl}
                fallback={user.initials}
                className="relative z-10 w-full h-full bg-transparent"
              />
              <span
                className="text-sm font-medium text-gray-600 absolute inset-0 flex items-center justify-center z-0"
                style={{ display: "flex" }}
              >
                {user.initials}
              </span>
            </div>

            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium text-gray-900 leading-tight truncate">
                {user.name}
              </div>
              <div className="text-xs text-gray-500 leading-tight mt-0.5">{user.planLabel}</div>
            </div>

            <div>
              <button
                className="p-1.5 rounded-md hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700 flex-shrink-0"
                type="button"
                aria-label="User menu"
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
                  className="lucide lucide-ellipsis-vertical w-4 h-4"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="12" cy="5" r="1"></circle>
                  <circle cx="12" cy="19" r="1"></circle>
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-2.5">
            <button className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer">
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
                className="lucide lucide-circle-arrow-up h-4 w-4"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <path d="m16 12-4-4-4 4"></path>
                <path d="M12 16V8"></path>
              </svg>
              Upgrade
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3 pt-1 pb-3 flex items-center justify-between flex-shrink-0 gap-2">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">History</h2>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors border border-gray-300">
              New
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
                className="lucide lucide-plus h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M5 12h14"></path>
                <path d="M12 5v14"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="space-y-1">
            {history.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                className="group relative w-full flex items-center gap-2 min-[375px]:gap-3 px-2 min-[375px]:px-3 py-2 min-[375px]:py-2.5 rounded-lg border transition-all border-transparent text-gray-600 hover:bg-white/80 hover:border-gray-200/50 hover:text-gray-900"
              >
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-9 rounded-r-full transition-all"
                  style={{
                    background: idx === 0 ? "rgb(17 24 39)" : "rgb(209 213 219)",
                    opacity: idx === 0 ? 0.9 : 0.6,
                  }}
                />

                <div className="ml-0.5 w-9 min-[375px]:w-11 h-9 min-[375px]:h-11 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden transition-all bg-gray-200 group-hover:bg-gray-100">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl}
                      alt={`Analysis ${item.id}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-gray-500">BP</span>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <div className="flex items-center gap-1.5 min-[375px]:gap-2 mb-1 min-[375px]:mb-1.5">
                    <span
                      className="text-[9px] min-[375px]:text-[10px] font-semibold px-1 min-[375px]:px-1.5 py-0.5 rounded-md"
                      style={{
                        background: "transparent",
                        color: "#72838c",
                        letterSpacing: "0.05em",
                        border: "1px dashed rgba(114, 131, 140, 0.3)",
                      }}
                    >
                      <span className="hidden min-[375px]:inline">OVERALL</span>
                      <span className="min-[375px]:hidden">OVR</span>
                    </span>
                    <span className="text-xs min-[375px]:text-sm font-medium leading-none text-gray-900">
                      {item.overall}
                    </span>
                    <span className="text-[10px] leading-none text-gray-400">{item.createdAtLabel}</span>
                  </div>

                  <div className="flex items-center gap-1.5 min-[375px]:gap-3">
                    <PillStat label="H" value={item.harmony} />
                    <PillStat label="A" value={item.angularity} dashed />
                    <PillStat label="D" value={item.dimorphism} dashed />
                    <PillStat label="F" value={item.features} dashed />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function PillStat({ label, value, dashed }: { label: string; value: number; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-0.5 min-[375px]:gap-1">
      <span
        className="text-[8px] min-[375px]:text-[9px] font-semibold px-0.5 min-[375px]:px-1 py-0.5 rounded-md"
        style={
          dashed
            ? { background: "transparent", color: "#72838c", border: "1px dashed rgba(114, 131, 140, 0.3)" }
            : { background: "rgba(114, 131, 140, 0.1)", color: "#72838c" }
        }
      >
        {label}
      </span>
      <span className="text-[10px] min-[375px]:text-xs font-medium leading-none text-gray-500">
        {value.toFixed(1)}
      </span>
    </div>
  );
}
