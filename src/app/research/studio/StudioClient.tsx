"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  Download,
  ImageDown,
  LoaderCircle,
  Move,
  Pipette,
  RotateCcw,
  Spline,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DEFAULT_RENDER,
  type EdgeCurves,
  isOffByDefault,
  type RenderConfig,
} from "@research/lib/geometry";
import type { GraphData, VendorId } from "@research/lib/types";
import RelationshipGraph from "../RelationshipGraph";
import StudyBadge from "../StudyBadge";
import EdgeTable from "./EdgeTable";

export interface RunRef {
  id: string; // "<study>/<stamp>"
  study: string;
  stamp: string;
}

// Quick background swatches: paper white, soft off-white, near-black, deep navy, warm cream.
const BG_PRESETS = ["#ffffff", "#f4f4f5", "#0a0a0a", "#0b1220", "#faf6ef"];

/** Inline GitHub mark — lucide-react ships no `Github` icon. */
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/** Coerce any background string to a #rrggbb the native <input type=color> accepts. */
function normalizeHex(c: string): string {
  let h = c.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  return /^[0-9a-fA-F]{6}$/.test(h) ? `#${h}` : "#ffffff";
}

export default function StudioClient({
  runs,
  selectedRun,
  graph,
}: {
  runs: RunRef[];
  selectedRun: string;
  graph: GraphData;
}) {
  const router = useRouter();
  const [navPending, startNav] = useTransition();
  const [cfg, setCfg] = useState<RenderConfig>(DEFAULT_RENDER);
  const [lang, setLang] = useState<string>("");
  const [scale, setScale] = useState<number>(2);
  const [exporting, setExporting] = useState<null | "png" | "svg">(null);
  const [exportError, setExportError] = useState<string | null>(null);
  // Lifted out of RelationshipGraph so the export reflects the user's edits:
  // which vendors are hidden, and any edges they've dragged into a new shape.
  // Seeded with the off-by-default set (unknown/refused/other:<brand>) so the
  // graph opens as just the canonical vendors — matching RelationshipGraph's own
  // default. The studio remounts per run (key in page.tsx), so this re-seeds for
  // each run's distinct other:<brand> set.
  const [hidden, setHidden] = useState<Set<VendorId>>(
    () => new Set(graph.vendors.filter((v) => isOffByDefault(v.id)).map((v) => v.id)),
  );
  const [curves, setCurves] = useState<EdgeCurves>({});
  const [showEdgeLabels, setShowEdgeLabels] = useState<boolean>(false);

  const set = useCallback(
    <K extends keyof RenderConfig>(key: K, value: RenderConfig[K]) =>
      setCfg((c) => ({ ...c, [key]: value })),
    [],
  );

  const onRunChange = (id: string) => {
    startNav(() => router.push(`/research/studio?run=${encodeURIComponent(id)}`));
  };

  const doExport = useCallback(
    async (format: "png" | "svg") => {
      setExporting(format);
      setExportError(null);
      try {
        const res = await fetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            run: selectedRun,
            lang,
            scale,
            format,
            config: cfg,
            hidden: [...hidden],
            curves,
            showEdgeLabels,
          }),
        });
        if (!res.ok) {
          const msg = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(msg.error ?? "Export failed");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const stamp = selectedRun.split("/")[1] ?? "graph";
        a.download = `who-are-you-${stamp}${lang ? `-${lang}` : ""}${
          format === "png" ? `@${scale}x.png` : ".svg"
        }`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        setExportError(e instanceof Error ? e.message : "Export failed");
      } finally {
        setExporting(null);
      }
    },
    [selectedRun, lang, scale, cfg, hidden, curves, showEdgeLabels],
  );

  const dirty = JSON.stringify(cfg) !== JSON.stringify(DEFAULT_RENDER);
  const curveCount = Object.keys(curves).length;
  const hiddenCount = hidden.size;

  const realVendorCount = graph.vendors.filter(
    (v) => !["self", "unknown", "refused", "other"].includes(v.id),
  ).length;

  return (
    <div className="flex-1">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ── Control console ───────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-20 lg:h-fit">
          <Card className="gap-0 py-0">
            <CardHeader className="gap-1 px-4 py-4">
              <CardTitle className="text-sm">Controls</CardTitle>
              <CardDescription className="text-xs">
                Live preview · server-rendered export
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="flex flex-col gap-5 px-4 py-5">
              {/* Data source */}
              <Field label="Run">
                <Select value={selectedRun} onValueChange={onRunChange} disabled={navPending}>
                  <SelectTrigger size="sm" className="w-full font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {runs.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="font-mono text-xs">
                        {r.study} · {r.stamp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Language">
                <Select value={lang || "__all"} onValueChange={(v) => setLang(v === "__all" ? "" : v)}>
                  <SelectTrigger size="sm" className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all" className="text-xs">
                      All languages (aggregate)
                    </SelectItem>
                    {graph.languages.map((l) => (
                      <SelectItem key={l.code} value={l.code} className="text-xs">
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Separator />

              {/* Layout knobs */}
              <SliderRow
                label="Spacing"
                value={cfg.ringScale}
                min={0.7}
                max={1.6}
                step={0.02}
                format={(v) => `${v.toFixed(2)}×`}
                onChange={(v) => set("ringScale", v)}
              />
              <SliderRow
                label="Node size"
                value={cfg.nodeRadius}
                min={36}
                max={72}
                step={1}
                format={(v) => `${Math.round(v)}px`}
                onChange={(v) => set("nodeRadius", v)}
              />
              <SliderRow
                label="Curvature"
                value={cfg.curveBow}
                min={0.02}
                max={0.34}
                step={0.01}
                format={(v) => v.toFixed(2)}
                onChange={(v) => set("curveBow", v)}
              />

              <Separator />

              {/* Edge knobs */}
              <SliderRow
                label="Edge weight"
                value={cfg.edgeWidthScale}
                min={0}
                max={12}
                step={0.2}
                format={(v) => `${v.toFixed(1)}px`}
                onChange={(v) => set("edgeWidthScale", v)}
              />
              <SliderRow
                label="Threshold"
                value={cfg.threshold}
                min={0}
                max={0.5}
                step={0.01}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => set("threshold", v)}
              />

              <ToggleRow label="Color by source">
                <Switch
                  checked={cfg.colorBySource}
                  onCheckedChange={(v) => set("colorBySource", v)}
                />
              </ToggleRow>
              <ToggleRow label="Title & footer">
                <Switch checked={cfg.chrome} onCheckedChange={(v) => set("chrome", v)} />
              </ToggleRow>
              <ToggleRow label="Optimize order">
                <Switch
                  checked={cfg.optimizeOrder}
                  onCheckedChange={(v) => set("optimizeOrder", v)}
                />
              </ToggleRow>

              <ToggleRow label="Show edge labels">
                <Switch
                  checked={showEdgeLabels}
                  onCheckedChange={setShowEdgeLabels}
                />
              </ToggleRow>

              {showEdgeLabels && (
              <Field label="Edge labels">
                <ToggleGroup
                  type="single"
                  size="sm"
                  variant="outline"
                  value={cfg.labelMode}
                  onValueChange={(v) => v && set("labelMode", v as RenderConfig["labelMode"])}
                  className="w-full"
                >
                  <ToggleGroupItem value="all" className="text-xs">
                    All
                  </ToggleGroupItem>
                  <ToggleGroupItem value="top" className="text-xs">
                    Top
                  </ToggleGroupItem>
                  <ToggleGroupItem value="none" className="text-xs">
                    None
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>
              )}

              <Field label="Background">
                <div className="flex items-center gap-1.5">
                  {BG_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Background ${c}`}
                      onClick={() => set("background", c)}
                      className={cn(
                        "size-6 rounded-md border transition-transform hover:scale-110",
                        cfg.background.toLowerCase() === c.toLowerCase()
                          ? "border-ring ring-2 ring-ring/40"
                          : "border-border",
                      )}
                      style={{ background: c }}
                    />
                  ))}
                  {/* Native color picker for any custom value. */}
                  <label
                    className="relative size-6 cursor-pointer overflow-hidden rounded-md border border-dashed border-border"
                    title="Custom color"
                    style={{ background: cfg.background }}
                  >
                    <Pipette className="absolute inset-0 m-auto size-3 mix-blend-difference text-white" />
                    <input
                      type="color"
                      value={normalizeHex(cfg.background)}
                      onChange={(e) => set("background", e.target.value)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                  <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                    {cfg.background}
                  </span>
                </div>
              </Field>

              <Separator />

              {/* Export */}
              <Field label="Export resolution">
                <ToggleGroup
                  type="single"
                  size="sm"
                  variant="outline"
                  value={String(scale)}
                  onValueChange={(v) => v && setScale(Number(v))}
                  className="w-full"
                >
                  {[1, 2, 3, 4].map((s) => (
                    <ToggleGroupItem key={s} value={String(s)} className="font-mono text-xs">
                      {s}×
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>

              <div className="flex flex-col gap-2">
                <Button onClick={() => doExport("png")} disabled={exporting !== null} className="w-full">
                  {exporting === "png" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <ImageDown className="size-4" />
                  )}
                  Export PNG
                </Button>
                <Button
                  variant="outline"
                  onClick={() => doExport("svg")}
                  disabled={exporting !== null}
                  className="w-full"
                >
                  {exporting === "svg" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Download SVG
                </Button>
                {exportError && <p className="text-xs text-destructive">{exportError}</p>}
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Export honors your edits — hidden vendors and reshaped edges
                  are baked into the {scale}× PNG and the SVG.
                </p>
              </div>

              {/* Edit affordances — drag hint + granular resets, shown only when
                  there's something to undo so the console stays uncluttered. */}
              <Separator />
              <div className="flex items-start gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
                <Move className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Drag any edge to bend it; double-click an edge to snap it back.
                  Uncheck a vendor to drop it and reflow the ring.
                </span>
              </div>

              {(dirty || curveCount > 0 || hiddenCount > 0) && (
                <div className="flex flex-col gap-1.5">
                  {curveCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurves({})}
                      className="w-full justify-start text-muted-foreground"
                    >
                      <Spline className="size-3.5" />
                      Reset {curveCount} reshaped {curveCount === 1 ? "edge" : "edges"}
                    </Button>
                  )}
                  {hiddenCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setHidden(new Set())}
                      className="w-full justify-start text-muted-foreground"
                    >
                      <RotateCcw className="size-3.5" />
                      Show {hiddenCount} hidden {hiddenCount === 1 ? "vendor" : "vendors"}
                    </Button>
                  )}
                  {dirty && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCfg(DEFAULT_RENDER)}
                      className="w-full justify-start text-muted-foreground"
                    >
                      <RotateCcw className="size-3.5" />
                      Reset controls
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* ── Canvas + data ─────────────────────────────────────────────── */}
        <section className="min-w-0">
          <Tabs defaultValue="graph" className="gap-4">
            <div className="flex items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="graph">Graph</TabsTrigger>
                <TabsTrigger value="table">Edge detail</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground sm:flex">
                <span className="hidden sm:inline">n={graph.summary.totalAnswers}</span>
                <span className="hidden sm:inline text-border">·</span>
                <span className="hidden sm:inline">{realVendorCount} vendors</span>
                <a
                  href="https://github.com/ZenMux/zenmux-arena"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View source on GitHub"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <GithubIcon className="size-4" />
                </a>
              </div>
            </div>

            <TabsContent value="overview">
              <OverviewTab graph={graph} />
            </TabsContent>

            <TabsContent value="graph">
              {/* The attribution badge is drawn inside the SVG chrome (below the
                  title), so it's centered with the graph and baked into the export
                  — no separate HTML badge here. The SVG paints its own
                  (configurable) background edge-to-edge, so the wrapper just
                  clips + frames it. */}
              <div className="overflow-hidden rounded-xl border border-border shadow-sm">
                <RelationshipGraph
                  graph={graph}
                  config={cfg}
                  lang={lang}
                  hideLangPicker
                  showVendorPicker
                  hidden={hidden}
                  onHiddenChange={setHidden}
                  curves={curves}
                  onCurvesChange={setCurves}
                  editableEdges
                  showEdgeLabels={showEdgeLabels}
                />
              </div>
            </TabsContent>

            <TabsContent value="table">
              <Card className="py-0">
                <CardContent className="px-0 py-0">
                  <div className="px-4 py-3">
                    <h2 className="text-sm font-semibold">Every language, every edge</h2>
                    <p className="text-xs text-muted-foreground">
                      One row per confusion edge, one column per language — never truncated.
                    </p>
                  </div>
                  <Separator />
                  <div className="max-h-[70vh] overflow-auto px-2 py-2">
                    <EdgeTable graph={graph} threshold={cfg.threshold} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  );
}

/* ── Overview tab (ex- /research report page) ─────────────────────────── */

function OverviewTab({ graph }: { graph: GraphData }) {
  const s = graph.summary;
  const confusionEdges = graph.edges
    .filter((e) => e.from !== e.to && !["self", "unknown", "refused"].includes(e.to))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 8);

  const modelSelf = graph.models
    .map((m) => ({ label: m.label ?? m.id, rate: s.perModelSelfRate[m.id] ?? 0 }))
    .sort((a, b) => b.rate - a.rate);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <header className="mb-10 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
          ZenMux Arena · Research
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {graph.study.title}
        </h1>
        {graph.study.description && (
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            {graph.study.description}
          </p>
        )}
        {/* Attribution — below the title/description for a cleaner layout. */}
        <div className="mt-6 flex justify-center">
          <StudyBadge />
        </div>
      </header>

      {/* Headline stats */}
      <section className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Answers" value={String(s.totalAnswers)} />
        <StatCard
          label="Self-ID rate"
          value={pct(s.overallSelfRate)}
          accent
        />
        <StatCard label="Confusion rate" value={pct(s.confusionRate)} />
        <StatCard
          label="Unknown / Refused"
          value={`${pct(s.unknownRate, 0)} / ${pct(s.refusedRate, 0)}`}
        />
      </section>

      {/* Tables */}
      <section className="mb-10 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-base font-semibold">
            Self-identification by model
          </h2>
          <MiniTable
            headers={["Model", "Self rate"]}
            rows={modelSelf.map((m) => [m.label, pct(m.rate)])}
          />
        </div>
        <div>
          <h2 className="mb-3 text-base font-semibold">
            Self-identification by language
          </h2>
          <MiniTable
            headers={["Language", "Self rate"]}
            rows={graph.languages
              .map((l) => ({ name: l.name, rate: s.perLangSelfRate[l.code] ?? 0 }))
              .sort((a, b) => b.rate - a.rate)
              .map((l) => [l.name, pct(l.rate)])}
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold">
          Top cross-vendor confusion
        </h2>
        {confusionEdges.length ? (
          <MiniTable
            headers={["From (true)", "Claims to be", "Probability", "Count"]}
            rows={confusionEdges.map((e) => [
              vname(graph, e.from),
              vname(graph, e.to),
              pct(e.probability),
              `${e.count}/${e.total}`,
            ])}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No cross-vendor confusion above threshold.
          </p>
        )}
      </section>

    </div>
  );
}

function pct(x: number, d = 1): string {
  return `${(x * 100).toFixed(d)}%`;
}

function vname(graph: GraphData, id: string): string {
  return graph.vendors.find((v) => v.id === id)?.name ?? id;
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div
        className={`text-xl font-bold sm:text-2xl ${
          accent ? "text-emerald-600 dark:text-emerald-400" : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function MiniTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {headers.map((h, i) => (
              <th
                key={h}
                className={`px-4 py-2 font-semibold text-muted-foreground ${
                  i === 0 ? "text-left" : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr
              key={ri}
              className="border-b border-border/60 last:border-0"
            >
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className={`px-4 py-2 ${
                    ci === 0
                      ? "text-left font-medium"
                      : "text-right tabular-nums text-muted-foreground"
                  }`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── small layout helpers ─────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="font-mono text-[11px] tabular-nums text-foreground">{format(value)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}
