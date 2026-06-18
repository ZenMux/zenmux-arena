// Route-level loading UI — the Suspense fallback shown while the dynamic page
// runs its first live fetch (the model listing). It mirrors the real layout's
// skeleton in the SAME brutalist language: cream paper, hard ink borders, square
// corners, monospace. A scoped sweep animation (no global CSS) reads as a
// terminal "loading…" rather than a generic spinner.
//
// Note: this only covers the INITIAL load. Tab switches between surfaces are now
// pure client state (see TokenEconClient) and need no loading state at all.

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
              <Bar key={w} className="h-7" />
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
          {/* Title block */}
          <div className="mb-5 space-y-2">
            <Bar className="h-7 w-64 sm:h-8" pulse />
            <Bar className="h-3 w-full max-w-2xl" />
            <Bar className="h-3 w-3/4 max-w-xl" />
          </div>

          {/* Headline stat boxes — 4 across, like the real StatBox grid. */}
          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-[#141414] bg-[#fbf9f4] px-3 py-2.5">
                <Bar className="h-2.5 w-20" />
                <Bar className="mt-2 h-6 w-28" pulse />
                <Bar className="mt-1.5 h-2.5 w-16" />
              </div>
            ))}
          </div>

          {/* A table-ish skeleton standing in for the active surface. */}
          <div className="border border-[#141414] bg-[#fbf9f4]">
            <div className="border-b border-[#141414] bg-[#ece8dd] px-3 py-2.5">
              <Bar className="h-3 w-40" />
            </div>
            <div className="divide-y divide-[#141414]/12">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <Bar className="size-4 shrink-0 rounded-none" />
                  <Bar className="h-3 flex-1" style={{ maxWidth: `${42 - i * 2}%` }} />
                  <Bar className="ml-auto h-3 w-16 shrink-0" />
                  <Bar className="h-3 w-16 shrink-0" />
                  <Bar className="hidden h-3 w-16 shrink-0 sm:block" />
                </div>
              ))}
            </div>
          </div>

          {/* Terminal-style status line — the brutalist "still working" cue. */}
          <p className="mt-4 inline-flex items-center gap-2 border border-[#141414] bg-[#fbf9f4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6f6a5f]">
            <span className="te-skel--pulse inline-block size-2 border border-[#141414] bg-[#141414]" aria-hidden />
            Fetching live model data…
          </p>
        </div>
      </main>
    </>
  );
}
