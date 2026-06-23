"use client";

import { useMemo, useState } from "react";
import {
  ChevronUp,
  Check,
  Copy,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface PriceModelSeed {
  label: string;
  slug: string;
  inputPrice: number;
  outputPrice: number;
}

export type PriceAnchor = PriceModelSeed;

interface Basket {
  inputTokens: number;
  outputTokens: number;
}

interface DiscountToDeepSeekClientProps {
  allModels: PriceModelSeed[];
  initialRows: PriceModelSeed[];
  anchors: {
    pro: PriceAnchor;
    flash: PriceAnchor;
  };
  defaultBasket: Basket;
  priceUnit: number;
  sourceLabel: string;
  sourceDetail: string;
  missingTargets: string[];
  loadError: string | null;
}

type AnchorStrategy = "tiered" | "pro" | "flash";

type EditableRow = PriceModelSeed & {
  id: string;
};

interface ComputedRow extends EditableRow {
  origBlended: number;
  anchorLabel: string;
  anchorCost: number | null;
  factor: number;
  newInputPrice: number;
  newOutputPrice: number;
  newBlended: number;
}

const STRATEGIES: { value: AnchorStrategy; label: string }[] = [
  { value: "tiered", label: "Script tiers" },
  { value: "pro", label: "Force V4 Pro" },
  { value: "flash", label: "Force V4 Flash" },
];

function rowFromSeed(seed: PriceModelSeed, index: number): EditableRow {
  return {
    ...seed,
    id: `${seed.slug || seed.label}-${index}`,
  };
}

function blendedCost(
  inputPrice: number,
  outputPrice: number,
  basket: Basket,
  priceUnit: number,
): number {
  return (
    (inputPrice * basket.inputTokens) / priceUnit +
    (outputPrice * basket.outputTokens) / priceUnit
  );
}

function clampNumber(value: number, min: number, max = Number.POSITIVE_INFINITY) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseLooseNumber(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function makeCustomSlug(label: string) {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `custom/${slug || "model"}`;
}

function ratioLabel({ inputTokens, outputTokens }: Basket) {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(Math.round(inputTokens), Math.round(outputTokens));
  if (g <= 0) return "0:0";
  return `${Math.round(inputTokens / g)}:${Math.round(outputTokens / g)}`;
}

function outputPer100k({ inputTokens, outputTokens }: Basket) {
  return inputTokens > 0 ? (outputTokens / inputTokens) * 100_000 : 0;
}

function usd(value: number, digits = 6) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: digits,
  })}`;
}

function price(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

function tokens(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function DiscountToDeepSeekClient({
  allModels,
  initialRows,
  anchors,
  defaultBasket,
  priceUnit,
  sourceLabel,
  sourceDetail,
  missingTargets,
  loadError,
}: DiscountToDeepSeekClientProps) {
  const [rows, setRows] = useState<EditableRow[]>(() =>
    initialRows.map(rowFromSeed),
  );
  const [basket, setBasket] = useState(defaultBasket);
  const [strategy, setStrategy] = useState<AnchorStrategy>("tiered");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const initialSelectedSlug =
    allModels.find((model) => !initialRows.some((row) => row.slug === model.slug))
      ?.slug ??
    allModels[0]?.slug ??
    "";
  const [selectedSlug, setSelectedSlug] = useState(initialSelectedSlug);
  const [custom, setCustom] = useState({
    label: "",
    slug: "",
    inputPrice: "",
    outputPrice: "",
  });

  const anchorCosts = useMemo(
    () => ({
      pro: blendedCost(
        anchors.pro.inputPrice,
        anchors.pro.outputPrice,
        basket,
        priceUnit,
      ),
      flash: blendedCost(
        anchors.flash.inputPrice,
        anchors.flash.outputPrice,
        basket,
        priceUnit,
      ),
    }),
    [anchors, basket, priceUnit],
  );

  const computedRows = useMemo<ComputedRow[]>(() => {
    return rows.map((row) => {
      const origBlended = blendedCost(
        row.inputPrice,
        row.outputPrice,
        basket,
        priceUnit,
      );

      let anchorLabel = "Already <= V4 Flash";
      let anchorCost: number | null = null;
      let factor = 1;

      if (origBlended > 0) {
        if (strategy === "pro") {
          anchorLabel = "DeepSeek V4 Pro";
          anchorCost = anchorCosts.pro;
          factor = anchorCosts.pro / origBlended;
        } else if (strategy === "flash") {
          anchorLabel = "DeepSeek V4 Flash";
          anchorCost = anchorCosts.flash;
          factor = anchorCosts.flash / origBlended;
        } else if (origBlended > anchorCosts.flash) {
          const usePro = origBlended >= anchorCosts.pro;
          anchorLabel = usePro ? "DeepSeek V4 Pro" : "DeepSeek V4 Flash";
          anchorCost = usePro ? anchorCosts.pro : anchorCosts.flash;
          factor = anchorCost / origBlended;
        }
      }

      return {
        ...row,
        origBlended,
        anchorLabel,
        anchorCost,
        factor,
        newInputPrice: row.inputPrice * factor,
        newOutputPrice: row.outputPrice * factor,
        newBlended: origBlended * factor,
      };
    });
  }, [anchorCosts, basket, priceUnit, rows, strategy]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return computedRows;
    return computedRows.filter(
      (row) =>
        row.label.toLowerCase().includes(q) ||
        row.slug.toLowerCase().includes(q) ||
        row.anchorLabel.toLowerCase().includes(q),
    );
  }, [computedRows, query]);

  const availableModels = useMemo(() => {
    const selected = new Set(rows.map((row) => row.slug));
    return allModels.filter((model) => !selected.has(model.slug));
  }, [allModels, rows]);

  const factorStats = useMemo(() => {
    const factors = computedRows.map((row) => row.factor).filter(Number.isFinite);
    const discounted = factors.filter((factor) => factor < 1).length;
    const average =
      factors.length > 0
        ? factors.reduce((sum, factor) => sum + factor, 0) / factors.length
        : 1;
    return { average, discounted };
  }, [computedRows]);

  const customInput = parseLooseNumber(custom.inputPrice);
  const customOutput = parseLooseNumber(custom.outputPrice);
  const customValid =
    custom.label.trim().length > 0 && customInput !== null && customOutput !== null;

  const csv = useMemo(() => {
    const headers = [
      "Model",
      "Slug",
      "Orig Input ($/1M)",
      "Orig Output ($/1M)",
      "Orig Blended ($)",
      "Anchor",
      "Factor",
      "New Input ($/1M)",
      "New Output ($/1M)",
      "New Blended ($)",
    ];
    const lines = computedRows.map((row) =>
      [
        row.label,
        row.slug,
        price(row.inputPrice),
        price(row.outputPrice),
        price(row.origBlended),
        row.anchorLabel,
        row.factor.toFixed(6),
        price(row.newInputPrice),
        price(row.newOutputPrice),
        price(row.newBlended),
      ]
        .map(csvEscape)
        .join(","),
    );
    return [headers.join(","), ...lines].join("\n");
  }, [computedRows]);

  function updateBasket(key: keyof Basket, value: string) {
    const min = key === "inputTokens" ? 1 : 0;
    setBasket((current) => ({
      ...current,
      [key]: Math.round(clampNumber(Number(value), min)),
    }));
  }

  function updateOutputRatio(nextOutputPer100k: number) {
    setBasket((current) => ({
      ...current,
      outputTokens: Math.round((current.inputTokens * nextOutputPer100k) / 100_000),
    }));
  }

  function updatePrice(id: string, key: "inputPrice" | "outputPrice", value: string) {
    const next = clampNumber(Number(value), 0);
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [key]: next } : row)),
    );
  }

  function addFromSnapshot() {
    const model = allModels.find((item) => item.slug === selectedSlug);
    if (!model || rows.some((row) => row.slug === model.slug)) return;
    setRows((current) => [...current, rowFromSeed(model, Date.now())]);

    const nextSlug =
      allModels.find(
        (item) =>
          item.slug !== model.slug && !rows.some((row) => row.slug === item.slug),
      )?.slug ?? "";
    setSelectedSlug(nextSlug);
  }

  function addCustomModel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customValid || customInput === null || customOutput === null) return;

    const label = custom.label.trim();
    const baseSlug = custom.slug.trim() || makeCustomSlug(label);
    const slug = rows.some((row) => row.slug === baseSlug)
      ? `${baseSlug}-${Date.now()}`
      : baseSlug;

    setRows((current) => [
      ...current,
      {
        id: `custom-${Date.now()}`,
        label,
        slug,
        inputPrice: customInput,
        outputPrice: customOutput,
      },
    ]);
    setCustom({ label: "", slug: "", inputPrice: "", outputPrice: "" });
    setCustomOpen(false);
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function resetRows() {
    setRows(initialRows.map(rowFromSeed));
    setQuery("");
    setCustomOpen(false);
  }

  async function copyCsv() {
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const currentOutputPer100k = outputPer100k(basket);
  const sliderMax = Math.max(20_000, Math.ceil(currentOutputPer100k / 1_000) * 1_000);

  return (
    <main className="flex-1">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-3xl flex-col gap-3">
            <Badge variant="outline" className="w-fit gap-1.5">
              <SlidersHorizontal data-icon="inline-start" />
              Pricing Tool
            </Badge>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold sm:text-4xl">
                Discount to DeepSeek
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Normalize selected model prices against DeepSeek V4 Pro and V4
                Flash using an editable input/output basket.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{sourceLabel}</Badge>
            {sourceDetail && <span>{sourceDetail}</span>}
          </div>
        </div>

        {(loadError || missingTargets.length > 0) && (
          <Card size="sm" className="border-destructive/30">
            <CardContent className="flex flex-col gap-2 text-sm">
              {loadError && (
                <p className="text-destructive">
                  Price data load failed: {loadError}
                </p>
              )}
              {missingTargets.length > 0 && (
                <p className="text-muted-foreground">
                  Missing script targets: {missingTargets.join("; ")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="V4 Pro Basket"
            value={usd(anchorCosts.pro)}
            sub={`${price(anchors.pro.inputPrice)} in / ${price(anchors.pro.outputPrice)} out`}
          />
          <MetricCard
            label="V4 Flash Basket"
            value={usd(anchorCosts.flash)}
            sub={`${price(anchors.flash.inputPrice)} in / ${price(anchors.flash.outputPrice)} out`}
          />
          <MetricCard
            label="Basket Ratio"
            value={ratioLabel(basket)}
            sub={`${tokens(basket.inputTokens)} in + ${tokens(basket.outputTokens)} out`}
          />
          <MetricCard
            label="Rows Discounted"
            value={`${factorStats.discounted}/${computedRows.length}`}
            sub={`avg factor ${factorStats.average.toFixed(4)}x`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <CardHeader>
              <CardTitle>Basket & Anchors</CardTitle>
              <CardDescription>
                Prices are quoted per 1M tokens; basket cost is normalized to the
                editable token mix below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="basket-input">Input tokens</FieldLabel>
                  <Input
                    id="basket-input"
                    type="number"
                    min={1}
                    step={1_000}
                    value={basket.inputTokens}
                    onChange={(event) =>
                      updateBasket("inputTokens", event.currentTarget.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="basket-output">Output tokens</FieldLabel>
                  <Input
                    id="basket-output"
                    type="number"
                    min={0}
                    step={100}
                    value={basket.outputTokens}
                    onChange={(event) =>
                      updateBasket("outputTokens", event.currentTarget.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="anchor-strategy">Anchor strategy</FieldLabel>
                  <Select
                    value={strategy}
                    onValueChange={(value) => setStrategy(value as AnchorStrategy)}
                  >
                    <SelectTrigger id="anchor-strategy" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {STRATEGIES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>

              <Field className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel htmlFor="output-ratio">
                    Output tokens per 100K input
                  </FieldLabel>
                  <span className="font-mono text-sm text-muted-foreground">
                    {tokens(currentOutputPer100k)}
                  </span>
                </div>
                <Slider
                  id="output-ratio"
                  value={[Math.min(currentOutputPer100k, sliderMax)]}
                  min={0}
                  max={sliderMax}
                  step={100}
                  onValueChange={([value]) => updateOutputRatio(value ?? 0)}
                />
                <FieldDescription>
                  Script default is 1,000 output tokens per 100,000 input tokens.
                </FieldDescription>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Model</CardTitle>
              <CardDescription>
                Add a listed model or enter a custom price row.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="snapshot-model">ZenMux model</FieldLabel>
                  <div className="flex gap-2">
                    <Select
                      value={selectedSlug}
                      onValueChange={setSelectedSlug}
                      disabled={availableModels.length === 0}
                    >
                      <SelectTrigger id="snapshot-model" className="min-w-0 flex-1">
                        <SelectValue placeholder="No more models" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {availableModels.map((model) => (
                            <SelectItem key={model.slug} value={model.slug}>
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addFromSnapshot}
                      disabled={!selectedSlug || availableModels.length === 0}
                    >
                      <Plus data-icon="inline-start" />
                      Add
                    </Button>
                  </div>
                </Field>
              </FieldGroup>

              {!customOpen ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  aria-expanded={false}
                  aria-controls="custom-model-fields"
                  onClick={() => setCustomOpen(true)}
                >
                  <Plus data-icon="inline-start" />
                  Add custom model
                </Button>
              ) : (
                <form
                  id="custom-model-fields"
                  onSubmit={addCustomModel}
                  className="rounded-lg border border-border bg-muted/20 p-3"
                >
                  <FieldGroup className="gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-medium">Custom model</h3>
                        <p className="text-xs text-muted-foreground">
                          Add a one-off row with manual pricing.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-expanded={true}
                        aria-controls="custom-model-fields"
                        onClick={() => setCustomOpen(false)}
                      >
                        <ChevronUp data-icon="inline-start" />
                        Hide
                      </Button>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="custom-label">Model name</FieldLabel>
                      <Input
                        id="custom-label"
                        value={custom.label}
                        onChange={(event) =>
                          setCustom((current) => ({
                            ...current,
                            label: event.currentTarget.value,
                          }))
                        }
                        placeholder="Model name"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="custom-slug">Slug</FieldLabel>
                      <Input
                        id="custom-slug"
                        value={custom.slug}
                        onChange={(event) =>
                          setCustom((current) => ({
                            ...current,
                            slug: event.currentTarget.value,
                          }))
                        }
                        placeholder="vendor/model"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field>
                        <FieldLabel htmlFor="custom-input">Input $/1M</FieldLabel>
                        <Input
                          id="custom-input"
                          type="number"
                          min={0}
                          step={0.000001}
                          value={custom.inputPrice}
                          onChange={(event) =>
                            setCustom((current) => ({
                              ...current,
                              inputPrice: event.currentTarget.value,
                            }))
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="custom-output">Output $/1M</FieldLabel>
                        <Input
                          id="custom-output"
                          type="number"
                          min={0}
                          step={0.000001}
                          value={custom.outputPrice}
                          onChange={(event) =>
                            setCustom((current) => ({
                              ...current,
                              outputPrice: event.currentTarget.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                    <Button type="submit" disabled={!customValid}>
                      <Plus data-icon="inline-start" />
                      Add custom
                    </Button>
                  </FieldGroup>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="gap-3 md:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-1">
              <CardTitle>Discount Table</CardTitle>
              <CardDescription>
                Edit original prices in place; adjusted input and output prices
                update immediately.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Filter models"
                className="w-full sm:w-56"
              />
              <Button type="button" variant="outline" onClick={resetRows}>
                <RotateCcw data-icon="inline-start" />
                Reset
              </Button>
              <Button type="button" onClick={copyCsv}>
                {copied ? (
                  <Check data-icon="inline-start" />
                ) : (
                  <Copy data-icon="inline-start" />
                )}
                {copied ? "Copied" : "Copy CSV"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-64 pl-4">Model</TableHead>
                  <TableHead className="min-w-32 text-right">Orig In</TableHead>
                  <TableHead className="min-w-32 text-right">Orig Out</TableHead>
                  <TableHead className="min-w-28 text-right">Orig Basket</TableHead>
                  <TableHead className="min-w-40">Target</TableHead>
                  <TableHead className="min-w-24 text-right">Factor</TableHead>
                  <TableHead className="min-w-28 text-right">New In</TableHead>
                  <TableHead className="min-w-28 text-right">New Out</TableHead>
                  <TableHead className="min-w-28 text-right">New Basket</TableHead>
                  <TableHead className="w-14 pr-4 text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-4">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="font-medium">{row.label}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {row.slug}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        step={0.000001}
                        value={row.inputPrice}
                        onChange={(event) =>
                          updatePrice(
                            row.id,
                            "inputPrice",
                            event.currentTarget.value,
                          )
                        }
                        className="ml-auto w-28 text-right font-mono"
                        aria-label={`${row.label} input price`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        step={0.000001}
                        value={row.outputPrice}
                        onChange={(event) =>
                          updatePrice(
                            row.id,
                            "outputPrice",
                            event.currentTarget.value,
                          )
                        }
                        className="ml-auto w-28 text-right font-mono"
                        aria-label={`${row.label} output price`}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {usd(row.origBlended)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.anchorCost === null ? "secondary" : "outline"}
                      >
                        {row.anchorLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "font-mono",
                          row.factor < 1
                            ? "text-emerald-600 dark:text-emerald-400"
                            : row.factor > 1
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-muted-foreground",
                        )}
                      >
                        {row.factor.toFixed(6)}x
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {price(row.newInputPrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {price(row.newOutputPrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {usd(row.newBlended)}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeRow(row.id)}
                        aria-label={`Remove ${row.label}`}
                      >
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="h-28 text-center text-muted-foreground"
                    >
                      No matching models.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card size="sm">
      <CardHeader className="gap-1">
        <CardDescription className="text-xs font-medium uppercase tracking-[0.12em]">
          {label}
        </CardDescription>
        <CardTitle className="font-mono text-xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="truncate text-xs text-muted-foreground" title={sub}>
          {sub}
        </p>
      </CardContent>
    </Card>
  );
}
