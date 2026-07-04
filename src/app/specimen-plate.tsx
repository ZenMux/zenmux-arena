"use client";

// The hero "specimen plate": the ring of frontier-model marks around the giant
// outlined masthead — now with a hidden easter egg. Click the title and it
// borrows a random specimen's plumage; click any mark on the ring and the
// masthead wears THAT brand's colours. The outline re-inks in the brand's
// primary, the full brand gradient (every colour extracted from its SVG)
// rises through the letters like ink, the chosen mark hops with a halo pulse,
// and a field-note tag records the sighting.
//
// Client component because the egg is interactive; everything else (positions,
// sizes, entrance delays) is deterministic module-level data so SSR and
// hydration agree. Math.random() only ever runs inside click handlers.

import { useState } from "react";
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
   `stops` are the actual fill/stop-color values found in the SVG (whites and
   near-white backgrounds dropped), ordered dark→light so the gradient reads
   bottom-up like rising ink. `ink` is the dominant brand colour and drives
   the title stroke, halo, and field-note accent. Single-colour and black-ink
   brands keep their one true colour; a lighter tint is derived at runtime so
   the gradient still breathes (see resolveStops). */
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

/** Mix a hex colour toward white (0..1). Used to derive tint plates and
 *  lighter gradient stops from a brand's own extracted colour. */
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * amt);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(ch);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Hex → rgba() at the given alpha. The colour-wash gradient sits ON TOP of
 *  the tiled logo texture, so its stops must be translucent. */
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** A brand's usable gradient stops: multi-colour brands as extracted;
 *  single-colour brands get a derived lighter top stop. */
function resolveStops(file: string): string[] {
  const { stops } = PLUMAGE[file];
  return stops.length > 1 ? stops : [stops[0], lighten(stops[0], 0.35)];
}

/** Translucent bottom-up colour wash laid over the logo tiling — brand hue
 *  without drowning the texture. Black-ink brands get a lighter wash so
 *  their tiled marks stay the star. */
function plumeWash(file: string): string {
  const stops = resolveStops(file);
  const a = PLUMAGE[file].stops.length > 1 ? 0.45 : 0.18;
  return `linear-gradient(to top, ${stops.map((s) => withAlpha(s, a)).join(", ")})`;
}

/** Solid tint plate behind the tiling, derived from the brand ink, so the
 *  letters read as filled specimens and the pattern has contrast. */
function plumePlate(file: string): string {
  return lighten(PLUMAGE[file].ink, 0.87);
}

/** Evenly spaced ring coordinates. The ellipse is wider than tall (the hero
 *  is landscape) and starts at 12 o'clock; sizes alternate on a gentle
 *  three-step rhythm so the ring has cadence without chaos. */
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

/* ── The easter egg state ─────────────────────────────────────────────────── */

interface Feather {
  dx: number;
  dy: number;
  rot: number;
  size: number;
  delay: number;
  clr: string;
  quill: boolean;
}

interface Egg {
  file: string;
  /** Monotonic counter — keys the animated bits so a re-pick restarts them. */
  count: number;
  feathers: Feather[];
}

/** A burst of brand-coloured feathers/dots from the title's heart, sampling
 *  every extracted stop. Random by design — generated in the click handler,
 *  never during render. */
function moltFeathers(stops: string[]): Feather[] {
  return Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 110 + Math.random() * 170;
    return {
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist * 0.7 - 36),
      rot: Math.round(-200 + Math.random() * 400),
      size: 5 + Math.round(Math.random() * 7),
      delay: Math.round(Math.random() * 140) / 1000,
      clr: stops[Math.floor(Math.random() * stops.length)],
      quill: Math.random() > 0.55,
    };
  });
}

/* ── The plate ────────────────────────────────────────────────────────────── */

export function SpecimenPlate() {
  const [egg, setEgg] = useState<Egg | null>(null);

  const plumage = egg ? PLUMAGE[egg.file] : null;
  const specimen = egg ? SPECIMENS.find((s) => s.file === egg.file) : null;
  const specimenNo = egg
    ? String(SPECIMENS.findIndex((s) => s.file === egg.file) + 1).padStart(2, "0")
    : null;

  /** Dress the masthead in a specific brand's colours (logo click). */
  function wear(file: string) {
    setEgg((prev) => ({
      file,
      count: (prev?.count ?? 0) + 1,
      feathers: moltFeathers(resolveStops(file)),
    }));
  }

  /** Dress the masthead in a random brand's colours (title click). */
  function borrowPlumage() {
    const pool = SPECIMENS.filter((s) => s.file !== egg?.file);
    wear(pool[Math.floor(Math.random() * pool.length)].file);
  }

  return (
    <>
      {/* Mobile specimen strip (the ring needs room). */}
      <ul
        className="fg-rise mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-4 md:hidden"
        style={{ "--fg-delay": "0.1s" } as React.CSSProperties}
      >
        {MOBILE_SPECIMENS.map((s) => {
          const hot = egg?.file === s.file;
          return (
            <li key={s.file}>
              <button
                type="button"
                title={s.name}
                aria-label={`Paint the masthead in ${s.name} colours`}
                onClick={() => wear(s.file)}
                className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fg-paper)]"
              >
                <span
                  key={hot ? egg.count : undefined}
                  className={cn("relative inline-block", hot && "fg-egg-hot")}
                  style={hot && plumage ? ({ "--egg-ink": plumage.ink } as React.CSSProperties) : undefined}
                >
                  {hot && <span aria-hidden className="fg-egg-halo" />}
                  <Image
                    src={`/model-logo/${s.file}_color.svg`}
                    alt=""
                    width={30}
                    height={30}
                    unoptimized
                    className="h-7 w-7"
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="relative flex min-h-[42vh] flex-col items-center justify-center py-14 text-center md:min-h-[78vh] md:py-0">
        {/* The ring (md+): an even ellipse of marks, each drifting slowly.
            The container swallows no clicks; each mark re-enables its own. */}
        <div className="pointer-events-none absolute inset-0 hidden md:block">
          {RING.map((s, i) => {
            const hot = egg?.file === s.file;
            return (
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
                    aria-label={`Paint the masthead in ${s.name} colours`}
                    onClick={() => wear(s.file)}
                    className="fg-egg-mark pointer-events-auto cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fg-paper)]"
                  >
                    {/* Keyed by the click counter so re-picking restarts the
                        hop; the halo is a one-shot pulse. */}
                    <span
                      key={hot ? egg.count : undefined}
                      className={cn("relative inline-block", hot && "fg-egg-hot")}
                      style={hot && plumage ? ({ "--egg-ink": plumage.ink } as React.CSSProperties) : undefined}
                    >
                      {hot && <span aria-hidden className="fg-egg-halo" />}
                      <Image
                        src={`/model-logo/${s.file}_color.svg`}
                        alt=""
                        width={s.size}
                        height={s.size}
                        unoptimized
                        className="drop-shadow-[0_2px_6px_rgba(33,29,22,0.12)]"
                        style={{ width: s.size, height: s.size }}
                      />
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
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
            role="button"
            tabIndex={0}
            aria-label="Shuffle the masthead's plumage — borrow a random specimen's colours"
            onClick={borrowPlumage}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                borrowPlumage();
              }
            }}
            className="fg-rise fg-egg-perch relative cursor-pointer select-none font-(family-name:--font-archivo-black) text-[clamp(3.2rem,9vw,7rem)] uppercase leading-[0.96] tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg-ink)] focus-visible:ring-offset-8 focus-visible:ring-offset-[var(--fg-paper)]"
            style={{ "--fg-delay": "0.35s" } as React.CSSProperties}
          >
            {/* Feather burst — re-keyed per click so the shower replays. */}
            {egg && plumage && (
              <span key={`molt-${egg.count}`} aria-hidden className="pointer-events-none absolute inset-0">
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

            {egg && plumage ? (
              /* Plumage mode: two stacked copies of the title. The bottom one
                 carries the brand fill — a pale tint plate, the brand's mark
                 TILED through the glyphs, and a translucent colour wash — and
                 wipes up via a mask. The top copy is just the brand-ink
                 stroke, visible instantly, keeping the letterforms crisp. */
              <span
                key={`plume-${egg.count}`}
                className="fg-plume-pop relative block"
                style={
                  {
                    "--egg-ink": plumage.ink,
                    "--egg-plate": plumePlate(egg.file),
                    "--egg-wash": plumeWash(egg.file),
                    "--egg-tile": `url(/model-logo/${egg.file}_color.svg)`,
                  } as React.CSSProperties
                }
              >
                <span className="fg-plume-fill block" aria-hidden>
                  ZenMux
                  <br />
                  Arena
                </span>
                <span className="fg-plume-stroke absolute inset-0 block">
                  ZenMux
                  <br />
                  Arena
                </span>
              </span>
            ) : (
              <span className="fg-title-outline block">
                ZenMux
                <br />
                Arena
              </span>
            )}
          </h1>

          {/* Field-note tag: records the sighting without shifting layout. */}
          {egg && specimen && plumage && (
            <p
              key={egg.count}
              className="fg-egg-tag absolute -bottom-14 left-1/2 flex items-center gap-2 whitespace-nowrap rounded-full border border-[var(--fg-ink)]/10 bg-[var(--fg-paper)]/85 px-4 py-1.5 backdrop-blur-sm"
            >
              <Image
                src={`/model-logo/${egg.file}_color.svg`}
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
                wearing {specimen.name} plumage
              </span>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
