// Route-level loading UI — the Suspense fallback shown while the dynamic page
// runs its first live fetch (the model listing). It mirrors the real layout's
// skeleton in the SAME brutalist language: cream paper, hard ink borders, square
// corners, monospace. A scoped sweep animation (no global CSS) reads as a
// terminal "loading…" rather than a generic spinner.
//
// Note: this only covers the INITIAL load. Tab switches between surfaces are now
// pure client state (see TokenEconClient) and need no loading state at all.

import { LiveSkeletonBoard, LiveSkeletonStyles } from "./LiveSkeletonChart";

const INK = "#141414";

/** A skeleton block that runs the ink sweep. `pulse` adds a soft opacity beat. */
function Bar({
  className = "",
  pulse = false,
  style,
}: {
  className?: string;
  pulse?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`te-skel ${pulse ? "te-skel--pulse" : ""} ${className}`}
      style={style}
      aria-hidden
    />
  );
}

export default function TokenEconomicsLoading() {
  return (
    <>
      {/* Scoped keyframes — kept local so the brutalist route owns its own
          motion without touching the site-wide globals.css. */}
      <style>{`
        @keyframes te-sweep {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes te-beat {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.45; }
        }
        .te-skel {
          border: 1px solid ${INK};
          background-image: linear-gradient(
            100deg,
            #ece8dd 30%,
            #f7f4ec 50%,
            #ece8dd 70%
          );
          background-size: 200% 100%;
          animation: te-sweep 1.4s linear infinite;
        }
        .te-skel--pulse { animation: te-sweep 1.4s linear infinite, te-beat 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .te-skel, .te-skel--pulse { animation: none; }
        }
      `}</style>
      <LiveSkeletonStyles />

      {/* Top bar skeleton — matches TokenEconNav's height + sticky ink rule. */}
      <header className="sticky top-0 z-30 border-b border-[#141414] bg-[#f4f1ea]/95">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Bar className="h-5 w-24" />
            <span className="hidden border-l border-[#141414]/30 pl-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#141414] sm:inline">
              Token Economics
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {[64, 88, 78, 92].map((w) => (
              <Bar key={w} className="h-7" style={{ width: w }} />
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-none px-3 py-3 sm:px-4 lg:px-5">
          <div className="mb-2 flex justify-end px-4 sm:px-5">
            <Bar className="h-7 w-24" pulse />
          </div>

          <div className="bg-[#f4f1ea] p-4 sm:p-5">
            <section className="space-y-7">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-0 border border-[#141414] bg-[#fbf9f4] p-1">
                    <Bar className="h-8 w-14" pulse />
                    <Bar className="h-8 w-16" />
                  </div>
                  <div className="flex items-center gap-0 border border-[#141414] bg-[#fbf9f4] p-1">
                    <Bar className="h-8 w-20" />
                    <Bar className="h-8 w-14" pulse />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Bar className="hidden h-3 w-[34rem] lg:block" />
                  <div className="flex items-center gap-0 border border-[#141414] bg-[#fbf9f4] p-1">
                    <Bar className="h-8 w-12" pulse />
                    <Bar className="h-8 w-14" />
                  </div>
                  <Bar className="h-10 w-24" />
                </div>
              </div>

              <div className="space-y-9">
                <LiveSkeletonBoard variant="primary" />
                <LiveSkeletonBoard variant="secondary" />
              </div>
            </section>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#141414] pt-2.5">
              <div className="flex items-center gap-2.5">
                <Bar className="size-11 shrink-0" />
                <div className="space-y-1.5">
                  <Bar className="h-3 w-24" />
                  <Bar className="h-2.5 w-44" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Bar className="ml-auto h-2.5 w-52" />
                <Bar className="ml-auto h-2.5 w-36" pulse />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
