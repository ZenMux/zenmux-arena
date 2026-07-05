// Route-level loading UI for every Token Deals surface. Because the nav lives
// in layout.tsx, a Board↔Ladder↔About click keeps the ticker bar in place and
// swaps only the body for this skeleton — the navigation feels instant even
// though the pages are force-dynamic (they read the packaged baseline on the
// server per request). Shape is deliberately generic: a masthead band + stat
// panels + content strips reads plausibly as any of the three pages.

export default function TokenDealsLoading() {
  return (
    <div className="flex-1" role="status" aria-label="Loading Token Deals">
      <span className="sr-only">Loading Token Deals</span>

      {/* Masthead band — every surface opens with one. */}
      <div className="border-b-[3px] border-[#0a0a0b] bg-[#141416]">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-8 sm:py-10">
          <div className="h-10 w-[min(28rem,80%)] animate-pulse bg-white/10 sm:h-16" />
          <div className="mt-4 h-3 w-[min(22rem,60%)] animate-pulse bg-white/[0.07]" />
        </div>
      </div>

      {/* Stat panels row. */}
      <div className="grid grid-cols-2 gap-[3px] border-b-[3px] border-[#0a0a0b] bg-[#0a0a0b] lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse bg-[#1c1c1e] sm:h-32" />
        ))}
      </div>

      {/* Content strips. */}
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-8">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse bg-white/[0.06]"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
