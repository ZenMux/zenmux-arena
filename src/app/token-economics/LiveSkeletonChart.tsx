type SkeletonVariant = "primary" | "secondary";

const PLOT = {
  x: 54,
  y: 28,
  w: 900,
  h: 334,
};

const SKELETON_SERIES = [
  { width: 2.4, opacity: 0.78, dash: "" },
  { width: 2.2, opacity: 0.58, dash: "6 4" },
  { width: 1.7, opacity: 0.38, dash: "" },
  { width: 1.7, opacity: 0.34, dash: "3 4" },
  { width: 1.7, opacity: 0.3, dash: "10 5" },
  { width: 1.7, opacity: 0.28, dash: "" },
  { width: 1.7, opacity: 0.26, dash: "2 5" },
] as const;

const SKELETON_STROKE = "#6f6a5f";
const SKELETON_FILL = "#ece8dd";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function peak(x: number, center: number, width: number, height: number): number {
  return height * Math.exp(-((x - center) ** 2) / (2 * width ** 2));
}

function skeletonLinePoints(seriesIndex: number, variant: SkeletonVariant): string {
  const count = 188;
  const alternate = variant === "secondary";
  const shift = alternate ? 31 : 0;
  const points: string[] = [];

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = t * PLOT.w;
    const rough =
      Math.sin((i + shift) * 1.7) * 8 +
      Math.sin((i + shift) * 4.1) * 5 +
      (((i + shift) * 37) % 17 - 8) * 1.8;
    let activity = 0;

    if (seriesIndex === 0) {
      activity =
        14 +
        peak(t, alternate ? 0.28 : 0.34, 0.072, 122) +
        peak(t, alternate ? 0.46 : 0.50, 0.014, 232) +
        peak(t, alternate ? 0.66 : 0.70, 0.058, 178) +
        peak(t, alternate ? 0.82 : 0.86, 0.068, 142) +
        peak(t, 0.20, 0.08, 66);
      activity += (i + shift) % 13 === 0 ? 54 : 0;
      activity += (i + shift) % 29 === 0 ? 42 : 0;
      activity -= (i + shift) % 23 === 0 ? 32 : 0;
    } else if (seriesIndex === 1) {
      activity =
        8 +
        peak(t, alternate ? 0.31 : 0.27, 0.035, 56) +
        peak(t, alternate ? 0.56 : 0.40, 0.05, 50) +
        peak(t, alternate ? 0.75 : 0.72, 0.08, 62) +
        peak(t, alternate ? 0.90 : 0.91, 0.05, 80);
      activity += (i + shift) % 17 === 0 ? 28 : 0;
      activity -= (i + shift) % 19 === 0 ? 18 : 0;
    } else {
      const localShift = seriesIndex * 0.07 + (alternate ? 0.04 : 0);
      activity =
        2 +
        peak(t, 0.34 + localShift, 0.03, 9 + seriesIndex * 1.5) +
        peak(t, 0.72 - localShift / 2, 0.05, 15 + seriesIndex * 2) +
        Math.max(0, Math.sin((i + shift) * (0.55 + seriesIndex * 0.08))) * 9;
      activity += (i + seriesIndex + shift) % 31 === 0 ? 15 : 0;
    }

    const y = clamp(PLOT.h - 8 - activity + rough, 10, PLOT.h - 2);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return points.join(" ");
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <span
      className={`te-live-skeleton-shine inline-block overflow-hidden border border-[#141414]/15 bg-[#ece8dd] ${className}`}
      aria-hidden
    />
  );
}

export function LiveSkeletonStyles() {
  return (
    <style>{`
      @keyframes te-live-skeleton-sweep {
        0% { transform: translateX(-120%); }
        100% { transform: translateX(120%); }
      }
      .te-live-skeleton-shine {
        position: relative;
      }
      .te-live-skeleton-shine::after {
        content: "";
        position: absolute;
        inset: 0;
        transform: translateX(-120%);
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.72), transparent);
        animation: te-live-skeleton-sweep 1.45s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .te-live-skeleton-shine::after { animation: none; opacity: 0; }
      }
    `}</style>
  );
}

export function LiveSkeletonBoard({
  variant = "primary",
}: {
  variant?: SkeletonVariant;
}) {
  const labelYs = [252, 270, 288, 306, 324, 342, 360];

  return (
    <section className="space-y-2 bg-[#fbf9f4]">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 className="sr-only">Loading token usage chart</h2>
          <SkeletonBlock className="h-5 w-80 max-w-full" />
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[10px] font-bold text-[#6f6a5f]">
            <SkeletonBlock className="h-3 w-16 align-middle" />
            <span>·</span>
            <SkeletonBlock className="h-3 w-24 align-middle" />
            <span>·</span>
            <SkeletonBlock className="h-3 w-20 align-middle" />
            <span>·</span>
            <SkeletonBlock className="h-3 w-16 align-middle" />
            <span>·</span>
            <SkeletonBlock className="h-3 w-14 align-middle" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-x-5 text-right">
          {["Peak bucket", "Leader", "Leader tokens"].map((label, i) => (
            <div key={label}>
              <div className="font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-[#6f6a5f]">
                {label}
              </div>
              <SkeletonBlock className={i === 1 ? "mt-1 h-3.5 w-28" : "mt-1 h-3.5 w-20"} />
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto bg-[#fbf9f4]">
        <svg
          viewBox="0 0 1120 430"
          className="w-full min-w-[1080px] bg-[#fbf9f4]"
          role="img"
          aria-label="Loading token usage chart"
        >
          <rect
            x={PLOT.x}
            y={PLOT.y}
            width={PLOT.w}
            height={PLOT.h}
            fill="#fbf9f4"
          />

          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = PLOT.y + PLOT.h * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={PLOT.x}
                  x2={PLOT.x + PLOT.w}
                  y1={y}
                  y2={y}
                  stroke="#141414"
                  strokeOpacity={i === 4 ? 0.46 : 0.1}
                />
                <rect
                  x={PLOT.x - 42}
                  y={y - 4}
                  width={i === 4 ? 12 : 32}
                  height="7"
                  fill={SKELETON_FILL}
                  stroke="#141414"
                  strokeOpacity="0.12"
                />
              </g>
            );
          })}

          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio) => {
            const x = PLOT.x + PLOT.w * ratio;
            return (
              <line
                key={ratio}
                x1={x}
                x2={x}
                y1={PLOT.y}
                y2={PLOT.y + PLOT.h}
                stroke="#141414"
                strokeOpacity="0.08"
              />
            );
          })}

          <line
            x1={PLOT.x}
            x2={PLOT.x}
            y1={PLOT.y}
            y2={PLOT.y + PLOT.h}
            stroke="#141414"
            strokeOpacity="0.45"
          />
          <line
            x1={PLOT.x}
            x2={PLOT.x + PLOT.w}
            y1={PLOT.y + PLOT.h}
            y2={PLOT.y + PLOT.h}
            stroke="#141414"
            strokeOpacity="0.45"
          />
          <rect
            x="-8"
            y={PLOT.y + PLOT.h / 2 - 20}
            width="7"
            height="40"
            transform={`rotate(-90 -8 ${PLOT.y + PLOT.h / 2})`}
            fill={SKELETON_FILL}
            stroke="#141414"
            strokeOpacity="0.12"
          />

          <g transform={`translate(${PLOT.x} ${PLOT.y})`}>
            {SKELETON_SERIES.map((series, i) => (
              <polyline
                key={i}
                points={skeletonLinePoints(i, variant)}
                fill="none"
                stroke={SKELETON_STROKE}
                strokeWidth={series.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={series.dash}
                opacity={series.opacity}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {SKELETON_SERIES.slice(0, 2).map((series, i) => (
              <circle
                key={`endpoint-${i}`}
                cx={PLOT.w}
                cy={i === 0 ? PLOT.h - 36 : PLOT.h - 24}
                r="7"
                fill="none"
                stroke={SKELETON_STROKE}
                strokeWidth="2"
                opacity={series.opacity}
              />
            ))}
          </g>

          {Array.from({ length: 6 }).map((_, i) => (
            <rect
              key={i}
              x={PLOT.x + (PLOT.w * i) / 5}
              y="405"
              width="34"
              height="7"
              transform={i === 0 ? undefined : i === 5 ? "translate(-34 0)" : "translate(-17 0)"}
              fill={SKELETON_FILL}
              stroke="#141414"
              strokeOpacity="0.12"
            />
          ))}

          {SKELETON_SERIES.map((series, i) => {
            const y = labelYs[i];
            return (
              <g key={`label-${i}`}>
                <line
                  x1={PLOT.x + PLOT.w + 1}
                  x2={PLOT.x + PLOT.w + 10}
                  y1={i < 2 ? PLOT.y + PLOT.h - 28 + i * 12 : PLOT.y + PLOT.h - 7}
                  y2={y}
                  stroke={SKELETON_STROKE}
                  strokeOpacity="0.26"
                />
                <rect
                  x={PLOT.x + PLOT.w + 10}
                  y={y - 9}
                  width="136"
                  height="18"
                  fill={SKELETON_FILL}
                  stroke="#141414"
                  strokeOpacity="0.16"
                />
                <circle
                  cx={PLOT.x + PLOT.w + 20}
                  cy={y}
                  r="8"
                  fill="#fbf9f4"
                  stroke="#141414"
                  strokeWidth="1"
                />
                <rect
                  x={PLOT.x + PLOT.w + 16}
                  y={y - 4}
                  width="8"
                  height="8"
                  fill={SKELETON_FILL}
                  stroke="#141414"
                  strokeOpacity="0.18"
                />
                <rect
                  x={PLOT.x + PLOT.w + 36}
                  y={y - 4}
                  width={54 - i * 3}
                  height="8"
                  fill="#fbf9f4"
                  opacity="0.9"
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex gap-2 overflow-hidden px-1 pb-1 pt-1">
        {SKELETON_SERIES.slice(0, 6).map((_, i) => (
          <div
            key={i}
            className="grid min-h-[58px] min-w-[148px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 border border-[#141414]/25 bg-[#fbf9f4] px-2 py-1.5"
          >
            <span className="relative row-span-2 size-8 border border-[#141414]/45 bg-white p-1">
              <span className="block size-full bg-[#ece8dd]" />
              <span
                className="absolute -bottom-1 -right-1 size-2.5 border border-[#141414]"
                aria-hidden
              />
            </span>
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-2.5 w-20" />
          </div>
        ))}
      </div>
    </section>
  );
}
