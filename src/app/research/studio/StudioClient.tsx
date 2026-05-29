"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  ArrowLeft,
  Download,
  ImageDown,
  LoaderCircle,
  Pipette,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
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
import { DEFAULT_RENDER, type RenderConfig } from "@research/lib/geometry";
import type { GraphData } from "@research/lib/types";
import RelationshipGraph from "../RelationshipGraph";
import EdgeTable from "./EdgeTable";

export interface RunRef {
  id: string; // "<study>/<stamp>"
  study: string;
  stamp: string;
}

// Quick background swatches: paper white, soft off-white, near-black, deep navy, warm cream.
const BG_PRESETS = ["#ffffff", "#f4f4f5", "#0a0a0a", "#0b1220", "#faf6ef"];

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
          body: JSON.stringify({ run: selectedRun, lang, scale, format, config: cfg }),
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
    [selectedRun, lang, scale, cfg],
  );

  const dirty = JSON.stringify(cfg) !== JSON.stringify(DEFAULT_RENDER);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
          <Link
            href="/research"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Report
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            <h1 className="text-sm font-semibold tracking-tight">Graph Studio</h1>
          </div>
          <div className="ml-auto flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="hidden sm:inline">n={graph.summary.totalAnswers}</span>
            <span className="hidden sm:inline text-border">·</span>
            <span>{graph.vendors.filter((v) => !["self", "unknown", "refused", "other"].includes(v.id)).length} vendors</span>
          </div>
        </div>
      </header>

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
              </div>

              {dirty && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCfg(DEFAULT_RENDER)}
                  className="w-full text-muted-foreground"
                >
                  <RotateCcw className="size-3.5" />
                  Reset controls
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* ── Canvas + data ─────────────────────────────────────────────── */}
        <main className="min-w-0">
          <Tabs defaultValue="graph" className="gap-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="graph">Graph</TabsTrigger>
                <TabsTrigger value="table">Edge detail</TabsTrigger>
              </TabsList>
              <p className="hidden font-mono text-[11px] text-muted-foreground sm:block">
                {graph.study.title}
              </p>
            </div>

            <TabsContent value="graph">
              {/* The SVG paints its own (configurable) background edge-to-edge, so
                  the wrapper just clips + frames it. */}
              <div className="overflow-hidden rounded-xl border border-border shadow-sm">
                <RelationshipGraph graph={graph} config={cfg} lang={lang} hideLangPicker />
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
        </main>
      </div>
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
