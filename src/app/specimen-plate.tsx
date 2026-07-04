"use client";

// The hero "specimen plate": the ring of frontier-model marks around the giant
// outlined masthead — with a hidden easter egg. Click a mark (or the title,
// which picks one at random) and that bird FLIES off its perch, arcs across
// the hero, and crashes into a random letter of ZENMUX ARENA: feathers burst
// from the impact, the letter is replaced by the brand's mark, and the brand's
// extracted colours ripple outward through the neighbouring letters.
//
// Choreography (one click):
//   t=0        the ring mark dims (the bird took off); a fixed-position clone
//              flies along a quadratic offset-path arc toward the target letter
//   t≈0.62s    landing — clone unmounts, the letter swaps to the logo with a
//              bouncy pop, a shockwave ring + feather burst fire at the impact
//              point, and each letter dyes itself stops[distance] with a
//              staggered delay radiating from the crash site
//
// Client component; ring geometry stays deterministic module-level data so
// SSR and hydration agree. Math.random() only runs inside click handlers.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/* ── Specimens ────────────────────────────────────────────────────────────── */

interface Specimen {
  file: string;
  name: string;
}

/* Ordered so the most recognisable marks land at the compass points (the
   ring starts at the top and walks clockwise). */
const SPECIMENS: Specimen[] = [
  { file: "chatgpt", name: "OpenAI GPT" },
  { file: "gemini", name: "Google Gemini" },
  { file: "grok", name: "xAI Grok" },
  { file: "qwen", name: "Alibaba Qwen" },
  { file: "hunyuan", name: "Tencent Hunyuan" },
  { file: "doubao", name: "ByteDance Doubao" },
  { file: "minimax", name: "MiniMax" },
  { file: "moonshot", name: "Moonshot AI" },
  { file: "kwai", name: "Kwai" },
  { file: "zai", name: "Z.ai GLM" },
  { file: "kimi", name: "Kimi" },
  { file: "inclusionai", name: "inclusionAI" },
  { file: "stepfun", name: "StepFun" },
  { file: "xiaomi", name: "Xiaomi MiMo" },
  { file: "deepeek", name: "DeepSeek" },
  { file: "wenxin", name: "Baidu ERNIE" },
  { file: "mistral", name: "Mistral" },
  { file: "claude", name: "Anthropic Claude" },
];

/* ── Plumage: colours extracted from each mark's _color.svg ────────────────
   `stops` are the actual fill/stop-color values found in the SVG (whites
   dropped), ordered dark→light. `ink` is the dominant brand colour — it
   drives the letter stroke, shockwave, and field-note accent. Multi-colour
   brands dye the letters by cycling their stops outward from the impact;
   single-colour brands dye everything in their one true ink. */
const PLUMAGE: Record<string, { ink: string; stops: string[] }> = {
  chatgpt: { ink: "#191919", stops: ["#191919"] }, // black-ink mark
  gemini: { ink: "#3186FF", stops: ["#3186FF", "#08B962", "#FABC12", "#F94543"] },
  grok: { ink: "#131418", stops: ["#131418"] }, // black-ink mark
  qwen: { ink: "#6336E7", stops: ["#6336E7", "#6F69F7"] },
  hunyuan: { ink: "#0055E9", stops: ["#0055E9", "#00BCFF", "#A8DFF5"] },
  doubao: { ink: "#1E37FC", stops: ["#1E37FC", "#A569FF", "#37E1BE"] },
  minimax: { ink: "#E2167E", stops: ["#E2167E", "#FE603C"] },
  moonshot: { ink: "#101010", stops: ["#101010"] }, // black-ink mark
  kwai: { ink: "#FF421C", stops: ["#FF421C"] },
  zai: { ink: "#141414", stops: ["#141414"] }, // black-ink mark
  kimi: { ink: "#027AFF", stops: ["#027AFF"] },
  inclusionai: { ink: "#181818", stops: ["#181818"] }, // black-ink mark
  stepfun: { ink: "#36A4F4", stops: ["#36A4F4", "#00F5E6", "#B2FF8B"] },
  xiaomi: { ink: "#EA6606", stops: ["#EA6606"] },
  deepeek: { ink: "#4D6BFE", stops: ["#4D6BFE"] },
  wenxin: { ink: "#0A51C3", stops: ["#012F8D", "#0A51C3", "#23A4FB"] },
  mistral: { ink: "#FA500F", stops: ["#E10500", "#FA500F", "#FF8205", "#FFAF00", "#FFD700"] },
  claude: { ink: "#D97757", stops: ["#D97757"] },
};

/** Mix a hex colour toward white (0..1) — derives a lighter feather tint for
 *  single-colour brands from their own extracted colour. */
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * amt);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(ch);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Feather-burst palette: every extracted stop, plus a lighter tint for
 *  one-colour brands so the burst still sparkles. */
function featherStops(file: string): string[] {
  const { stops } = PLUMAGE[file];
  return stops.length > 1 ? stops : [stops[0], lighten(stops[0], 0.4)];
}

/** Dye for the letter `dist` steps away from the crash site: multi-colour
 *  brands ripple through their stops; single-colour brands stay pure. */
function dyeAt(file: string, dist: number): string {
  const { stops, ink } = PLUMAGE[file];
  return stops.length > 1 ? stops[dist % stops.length] : ink;
}

/* ── Ring geometry (deterministic, shared with SSR) ───────────────────────── */

const RING = SPECIMENS.map((s, i) => {
  const angle = (i / SPECIMENS.length) * Math.PI * 2 - Math.PI / 2;
  const x = 50 + 44 * Math.cos(angle);
  const y = 50 + 42 * Math.sin(angle);
  const size = [52, 40, 46][i % 3];
  return {
    ...s,
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    size,
    driftDur: 7 + (i % 5) * 0.6,
    driftDelay: (i % 7) * 0.45,
  };
});

/* Compact strip for < md, where the absolute ring would collide with text. */
const MOBILE_SPECIMENS = SPECIMENS.slice(0, 10);

/* ── The masthead as letters ──────────────────────────────────────────────── */

const TITLE_LINES = ["ZENMUX", "ARENA"];
const LETTERS: { ch: string; line: number }[] = TITLE_LINES.flatMap((line, li) =>
  line.split("").map((ch) => ({ ch, line: li })),
);

/* ── Egg state ────────────────────────────────────────────────────────────── */

interface Feather {
  dx: number;
  dy: number;
  rot: number;
  size: number;
  delay: number;
  clr: string;
  quill: boolean;
}

interface Flight {
  /** Quadratic arc in viewport coords, consumed by CSS offset-path. */
  path: string;
  /** Clone starts at the source mark's size and shrinks/grows to the letter. */
  startSize: number;
  scale: number;
  dur: number;
}

interface Egg {
  file: string;
  /** Monotonic counter — keys every animated bit so a re-click restarts it. */
  count: number;
  /** Flat index into LETTERS of the crash site. */
  letterIndex: number;
  phase: "flying" | "landed";
  flight: Flight | null;
  /** Impact point relative to the h1 box — anchors feathers + shockwave. */
  impact: { x: number; y: number } | null;
  feathers: Feather[];
}

/** Feather burst sampling every extracted brand colour. Random by design —
 *  generated in the click handler, never during render. */
function moltFeathers(stops: string[]): Feather[] {
  return Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 60 + Math.random() * 150;
    return {
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist * 0.8 - 30),
      rot: Math.round(-220 + Math.random() * 440),
      size: 4 + Math.round(Math.random() * 7),
      delay: Math.round(Math.random() * 120) / 1000,
      clr: stops[Math.floor(Math.random() * stops.length)],
      quill: Math.random() > 0.5,
    };
  });
}

const FLIGHT_MS = 620;

/** Random crash-site letter. Module-level so it's plainly event-time only. */
function pickLetterIndex(): number {
  return Math.floor(Math.random() * LETTERS.length);
}

/** Random specimen, excluding the one already wearing the masthead. */
function pickSpecimen(excludeFile: string | undefined): Specimen {
  const pool = SPECIMENS.filter((s) => s.file !== excludeFile);
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ── The plate ────────────────────────────────────────────────────────────── */

export function SpecimenPlate() {
  const [egg, setEgg] = useState<Egg | null>(null);

  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const letterRefs = useRef<(HTMLElement | null)[]>([]);
  const ringRefs = useRef<Map<string, HTMLElement>>(new Map());
  const stripRefs = useRef<Map<string, HTMLElement>>(new Map());
  const landTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (landTimer.current) clearTimeout(landTimer.current);
  }, []);

  const plumage = egg ? PLUMAGE[egg.file] : null;
  const specimen = egg ? SPECIMENS.find((s) => s.file === egg.file) : null;
  const specimenNo = egg
    ? String(SPECIMENS.findIndex((s) => s.file === egg.file) + 1).padStart(2, "0")
    : null;
  const landed = egg?.phase === "landed";

  /** The visible on-screen element for a brand's mark (ring on md+, strip on
   *  mobile) — the flight's launch pad. Null when neither is rendered. */
  function sourceMark(file: string): HTMLElement | null {
    for (const el of [ringRefs.current.get(file), stripRefs.current.get(file)]) {
      if (el && el.getBoundingClientRect().width > 0) return el;
    }
    return null;
  }

  /** Launch a brand at the masthead: pick a random letter to crash into,
   *  compute the arc from the mark's current position, and schedule landing. */
  function wear(file: string) {
    if (landTimer.current) clearTimeout(landTimer.current);

    const letterIndex = pickLetterIndex();
    const letterEl = letterRefs.current[letterIndex];
    const titleEl = titleRef.current;
    const src = sourceMark(file);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const count = (egg?.count ?? 0) + 1;
    const feathers = moltFeathers(featherStops(file));

    let flight: Flight | null = null;
    let impact: Egg["impact"] = null;

    if (letterEl && titleEl) {
      const t = titleEl.getBoundingClientRect();
      const l = letterEl.getBoundingClientRect();
      impact = { x: l.left + l.width / 2 - t.left, y: l.top + l.height / 2 - t.top };

      if (src && !reduced) {
        const s = src.getBoundingClientRect();
        const sx = s.left + s.width / 2;
        const sy = s.top + s.height / 2;
        const ex = l.left + l.width / 2;
        const ey = l.top + l.height / 2;
        // Control point above the higher endpoint → a springy overhead arc.
        const cx = (sx + ex) / 2;
        const cy = Math.min(sy, ey) - Math.max(90, Math.abs(ex - sx) * 0.22);
        const startSize = Math.max(s.width, 28);
        flight = {
          path: `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`,
          startSize,
          scale: (l.height * 0.72) / startSize,
          dur: FLIGHT_MS,
        };
      }
    }

    if (flight) {
      setEgg({ file, count, letterIndex, phase: "flying", flight, impact, feathers });
      landTimer.current = setTimeout(() => {
        setEgg((prev) =>
          prev && prev.count === count ? { ...prev, phase: "landed", flight: null } : prev,
        );
      }, FLIGHT_MS - 30);
    } else {
      // No visible launch pad (or reduced motion): land instantly.
      setEgg({ file, count, letterIndex, phase: "landed", flight: null, impact, feathers });
    }
  }

  /** Title click: a random bird dives in (never the one already wearing). */
  function borrowPlumage() {
    wear(pickSpecimen(egg?.file).file);
  }

  /* A mark on its perch: dimmed while its bird is away in the masthead. */
  function markProps(file: string) {
    const away = egg?.file === file;
    return {
      "aria-label": `Send ${SPECIMENS.find((s) => s.file === file)?.name} flying into the masthead`,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        wear(file);
      },
      "data-away": away || undefined,
    };
  }

  return (
    <>
      {/* Mobile specimen strip (the ring needs room). */}
      <ul
        className="fg-rise mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-4 md:hidden"
        style={{ "--fg-delay": "0.1s" } as React.CSSProperties}
      >
        {MOBILE_SPECIMENS.map((s) => (
          <li key={s.file}>
            <button
              type="button"
              title={s.name}
              {...markProps(s.file)}
              ref={(el) => {
                if (el) stripRefs.current.set(s.file, el);
                else stripRefs.current.delete(s.file);
              }}
              className="fg-egg-mark cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fg-paper)]"
            >
              <Image
                src={`/model-logo/${s.file}_color.svg`}
                alt=""
                width={30}
                height={30}
                unoptimized
                className="h-7 w-7"
              />
            </button>
          </li>
        ))}
      </ul>

      <div className="relative flex min-h-[42vh] flex-col items-center justify-center py-14 text-center md:min-h-[78vh] md:py-0">
        {/* The ring (md+): an even ellipse of marks, each drifting slowly.
            The container swallows no clicks; each mark re-enables its own. */}
        <div className="pointer-events-none absolute inset-0 hidden md:block">
          {RING.map((s, i) => (
            <div
              key={s.file}
              className="fg-rise absolute -translate-x-1/2 -translate-y-1/2"
              style={
                {
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  "--fg-delay": `${0.15 + i * 0.05}s`,
                } as React.CSSProperties
              }
            >
              <div
                className="fg-drift"
                style={
                  {
                    "--fg-drift-dur": `${s.driftDur}s`,
                    "--fg-drift-delay": `${s.driftDelay}s`,
                  } as React.CSSProperties
                }
              >
                <button
                  type="button"
                  title={s.name}
                  {...markProps(s.file)}
                  ref={(el) => {
                    if (el) ringRefs.current.set(s.file, el);
                    else ringRefs.current.delete(s.file);
                  }}
                  className="fg-egg-mark pointer-events-auto cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fg-paper)]"
                >
                  <Image
                    src={`/model-logo/${s.file}_color.svg`}
                    alt=""
                    width={s.size}
                    height={s.size}
                    unoptimized
                    className="drop-shadow-[0_2px_6px_rgba(33,29,22,0.12)]"
                    style={{ width: s.size, height: s.size }}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Title block — the masthead speaks in the index's outlined voice. */}
        <div className="relative flex max-w-3xl flex-col items-center gap-8">
          <p
            className="fg-rise font-(family-name:--font-jost) text-[11px] font-medium uppercase tracking-[0.42em] text-[var(--fg-ink-soft)]"
            style={{ "--fg-delay": "0.2s" } as React.CSSProperties}
          >
            A field guide to frontier models
          </p>

          <h1
            ref={titleRef}
            role="button"
            tabIndex={0}
            aria-label="Send a random specimen flying into the masthead"
            onClick={borrowPlumage}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                borrowPlumage();
              }
            }}
            className="fg-rise fg-egg-perch fg-title-outline relative cursor-pointer select-none font-(family-name:--font-archivo-black) text-[clamp(3.2rem,9vw,7rem)] uppercase leading-[0.96] tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg-ink)] focus-visible:ring-offset-8 focus-visible:ring-offset-[var(--fg-paper)]"
            style={{ "--fg-delay": "0.35s" } as React.CSSProperties}
          >
            {/* Impact FX: shockwave + feather burst, anchored to the crash
                site, re-keyed per click so they replay. */}
            {landed && egg?.impact && plumage && (
              <span
                key={`impact-${egg.count}`}
                aria-hidden
                className="pointer-events-none absolute"
                style={{ left: egg.impact.x, top: egg.impact.y }}
              >
                <span
                  className="fg-egg-shockwave"
                  style={{ "--egg-ink": plumage.ink } as React.CSSProperties}
                />
                {egg.feathers.map((f, i) => (
                  <span
                    key={i}
                    className="fg-egg-feather"
                    style={
                      {
                        "--egg-dx": `${f.dx}px`,
                        "--egg-dy": `${f.dy}px`,
                        "--egg-rot": `${f.rot}deg`,
                        "--egg-delay": `${f.delay}s`,
                        width: f.quill ? f.size * 0.55 : f.size,
                        height: f.quill ? f.size * 2.4 : f.size,
                        borderRadius: f.quill ? 3 : 999,
                        backgroundColor: f.clr,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </span>
            )}

            {TITLE_LINES.map((line, li) => {
              const offset = li === 0 ? 0 : TITLE_LINES[0].length;
              return (
                <span key={li} className="block">
                  {line.split("").map((ch, ci) => {
                    const idx = offset + ci;
                    const hit = landed && egg!.letterIndex === idx;
                    const dist = landed ? Math.abs(idx - egg!.letterIndex) : 0;
                    return (
                      <span
                        key={ci}
                        ref={(el) => {
                          letterRefs.current[idx] = el;
                        }}
                        className={cn("fg-letter relative", landed && "fg-letter-dyed")}
                        style={
                          landed
                            ? ({
                                "--dye": dyeAt(egg!.file, dist),
                                "--dye-delay": `${dist * 60}ms`,
                              } as React.CSSProperties)
                            : undefined
                        }
                      >
                        {/* The struck glyph stays in the flow (invisible) so
                            kerning never shifts; the mark perches over it. */}
                        <span className={cn(hit && "opacity-0")}>{ch}</span>
                        {hit && (
                          <span key={`perch-${egg!.count}`} className="fg-letter-perch absolute inset-0 flex items-center justify-center">
                            <Image
                              src={`/model-logo/${egg!.file}_color.svg`}
                              alt={specimen?.name ?? ""}
                              width={96}
                              height={96}
                              unoptimized
                              className="h-[0.74em] w-[0.74em] drop-shadow-[0_3px_10px_rgba(33,29,22,0.25)]"
                            />
                          </span>
                        )}
                      </span>
                    );
                  })}
                </span>
              );
            })}
          </h1>

          {/* Field-note tag: records the sighting without shifting layout. */}
          {landed && specimen && plumage && (
            <p
              key={egg!.count}
              className="fg-egg-tag absolute -bottom-14 left-1/2 flex items-center gap-2 whitespace-nowrap rounded-full border border-[var(--fg-ink)]/10 bg-[var(--fg-paper)]/85 px-4 py-1.5 backdrop-blur-sm"
            >
              <Image
                src={`/model-logo/${egg!.file}_color.svg`}
                alt=""
                width={16}
                height={16}
                unoptimized
                className="h-4 w-4"
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-ink-soft)]">
                № {specimenNo}
              </span>
              <span className="font-(family-name:--font-fraunces) text-[13px] italic" style={{ color: plumage.ink }}>
                {specimen.name} landed in the masthead
              </span>
            </p>
          )}
        </div>
      </div>

      {/* The flying bird: a fixed-position clone riding a quadratic offset-path
          arc from the perch to the letter, shrinking to letter size en route. */}
      {egg?.phase === "flying" && egg.flight && (
        <span
          key={`flight-${egg.count}`}
          aria-hidden
          className="fg-egg-flight pointer-events-none fixed left-0 top-0 z-50"
          style={
            {
              offsetPath: `path("${egg.flight.path}")`,
              offsetRotate: "0deg",
              "--fl-scale": egg.flight.scale,
              "--fl-dur": `${egg.flight.dur}ms`,
              width: egg.flight.startSize,
              height: egg.flight.startSize,
            } as React.CSSProperties
          }
        >
          <Image
            src={`/model-logo/${egg.file}_color.svg`}
            alt=""
            width={egg.flight.startSize}
            height={egg.flight.startSize}
            unoptimized
            className="h-full w-full drop-shadow-[0_4px_12px_rgba(33,29,22,0.3)]"
          />
        </span>
      )}
    </>
  );
}
