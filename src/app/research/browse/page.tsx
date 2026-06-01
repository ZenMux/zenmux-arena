// Raw-answer browser — read every model's "Who are you?" answers, grouped by
// language, each with the extractor's identity label beneath it.
//
// Server component: discovers runs, loads + joins the selected run (data.ts),
// and serializes ONLY the selected model's answers to the client. Model and run
// selection are URL-driven (<Link> soft-navigations), so the multi-MB JSONL
// never reaches the browser. force-dynamic so fresh runs appear on reload.

import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import StudyBadge from "../StudyBadge";
import {
  discoverRuns,
  isBucket,
  loadRunData,
  type JoinedAnswer,
  type LangGroup,
  type ModelEntry,
  type RunRef,
  type VendorDisplay,
} from "./data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse answers — Who Are You?",
  description: "Every model's raw self-identification answers, by language, with extraction labels.",
};

function pct(x: number, d = 0): string {
  return `${(x * 100).toFixed(d)}%`;
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; model?: string }>;
}) {
  const { run, model } = await searchParams;
  const runs = discoverRuns();

  if (runs.length === 0) {
    return (
      <EmptyShell title="Browse answers">
        <p className="mt-4 text-neutral-500">
          No runs found. Generate one with the study pipeline, then reload:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-100">
          export ZENMUX_API_KEY=...{"\n"}pnpm study:test
        </pre>
      </EmptyShell>
    );
  }

  const selectedRun = runs.find((r) => r.id === run)?.id ?? runs[0].id;
  const data = loadRunData(selectedRun);

  if (!data || data.models.length === 0) {
    return (
      <EmptyShell title="Browse answers">
        <p className="mt-4 text-destructive">No records found for {selectedRun}.</p>
      </EmptyShell>
    );
  }

  const selectedModel =
    data.models.find((m) => m.id === model) ?? data.models[0];

  return (
    <div className="flex-1">
      {/* View toolbar — run picker + counts. Title/back-nav live in the shell. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/70 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-muted-foreground" />
          <h1 className="text-sm font-semibold tracking-tight">Raw answers</h1>
        </div>
        <RunPicker runs={runs} selected={selectedRun} />
        <div className="ml-auto hidden font-mono text-[11px] text-muted-foreground sm:block">
          {data.models.length} models · n={data.totalAnswers}
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <ModelSidebar models={data.models} run={selectedRun} selectedId={selectedModel.id} />
        <ModelDetail model={selectedModel} />
      </div>

      <footer className="mx-auto max-w-[1600px] border-t border-border px-4 py-10 sm:px-6">
        <StudyBadge align="left" meta={`run ${data.ref.id}`} />
      </footer>
    </div>
  );
}

/* ── Run picker (soft-nav links, resets the model selection) ─────────────── */

function RunPicker({ runs, selected }: { runs: RunRef[]; selected: string }) {
  if (runs.length <= 1) {
    return <span className="font-mono text-[11px] text-neutral-400">{selected}</span>;
  }
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {runs.map((r) => {
        const active = r.id === selected;
        return (
          <Link
            key={r.id}
            href={`/research/browse?run=${encodeURIComponent(r.id)}`}
            className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors ${
              active
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-black"
                : "border-neutral-200 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
            }`}
          >
            {r.stamp}
          </Link>
        );
      })}
    </div>
  );
}

/* ── Model sidebar ───────────────────────────────────────────────────────── */

function ModelSidebar({
  models,
  run,
  selectedId,
}: {
  models: ModelEntry[];
  run: string;
  selectedId: string;
}) {
  return (
    <aside className="lg:sticky lg:top-20 lg:h-fit">
      <div className="rounded-xl border border-neutral-200 bg-white/60 p-2 dark:border-neutral-800 dark:bg-neutral-950/60">
        <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Models <span className="font-mono text-neutral-400">({models.length})</span>
        </div>
        <nav className="flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto lg:max-h-[78vh]">
          {models.map((m) => {
            const active = m.id === selectedId;
            return (
              <Link
                key={m.id}
                href={`/research/browse?run=${encodeURIComponent(run)}&model=${encodeURIComponent(m.id)}`}
                scroll={false}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
                  active
                    ? "bg-neutral-100 dark:bg-neutral-900"
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
                }`}
              >
                <VendorChip vendor={m.vendor} size={22} />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm ${
                      active
                        ? "font-semibold text-neutral-900 dark:text-neutral-100"
                        : "text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    {m.label}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-neutral-400">
                    {m.vendor.name}
                  </span>
                </span>
                <span
                  className="shrink-0 font-mono text-[11px] tabular-nums text-neutral-400"
                  title="Self-identification rate"
                >
                  {pct(m.selfRate)}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

/* ── Model detail: language groups, each a collapsible <details> ─────────── */

function ModelDetail({ model }: { model: ModelEntry }) {
  return (
    <section className="min-w-0">
      {/* Model header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <VendorChip vendor={model.vendor} size={40} />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight">{model.label}</h2>
          <p className="font-mono text-xs text-neutral-400">{model.id}</p>
        </div>
        <div className="ml-auto flex items-center gap-4 text-right">
          <Metric label="Self-ID" value={pct(model.selfRate, 1)} accent />
          <Metric label="Answers" value={`${model.selfCount}/${model.n}`} />
          <Metric label="Languages" value={String(model.langs.length)} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {model.langs.map((lang, i) => (
          <LanguageGroup key={lang.code} lang={lang} defaultOpen={i === 0} />
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div
        className={`text-base font-bold tabular-nums ${
          accent ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-800 dark:text-neutral-200"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</div>
    </div>
  );
}

function LanguageGroup({ lang, defaultOpen }: { lang: LangGroup; defaultOpen: boolean }) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 bg-neutral-50 px-4 py-2.5 dark:bg-neutral-900/60">
        <svg
          viewBox="0 0 20 20"
          className="size-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-90"
          fill="currentColor"
          aria-hidden
        >
          <path d="M7 5l6 5-6 5V5z" />
        </svg>
        <span className="font-semibold text-neutral-800 dark:text-neutral-100">{lang.name}</span>
        <span className="font-mono text-[11px] text-neutral-400">{lang.code}</span>
        <span className="font-mono text-[11px] tabular-nums text-neutral-400">n={lang.n}</span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {lang.dist.map((d) => (
            <DistPill key={d.display.id} display={d.display} count={d.count} />
          ))}
        </div>
      </summary>
      <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-900">
        {lang.answers.map((a) => (
          <AnswerRow key={a.key} answer={a} />
        ))}
      </div>
    </details>
  );
}

/** A compact "vendor ×count" pill for the language-group summary. */
function DistPill({ display, count }: { display: VendorDisplay; count: number }) {
  const isSelf = display.id === "self";
  const bucket = isBucket(display.id);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        isSelf
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
          : bucket
            ? "bg-neutral-100 text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400"
            : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
      }`}
      title={display.name}
    >
      {!isSelf && !bucket && (
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ backgroundColor: display.color }}
        />
      )}
      <span className="max-w-[7rem] truncate">{display.name}</span>
      <span className="tabular-nums opacity-70">{count}</span>
    </span>
  );
}

/* ── One answer + its extraction ─────────────────────────────────────────── */

function AnswerRow({ answer }: { answer: JoinedAnswer }) {
  const ext = answer.extraction;
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex shrink-0 flex-col items-start gap-1">
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            #{answer.repeat}
          </span>
          {answer.sourceStamp && (
            <span
              className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[9px] text-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-400"
              title={`Pooled from run ${answer.sourceStamp}`}
            >
              {answer.sourceStamp}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          {answer.error ? (
            <p className="text-sm italic text-red-600 dark:text-red-400">错误：{answer.error}</p>
          ) : answer.response.trim() ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
              {answer.response}
            </p>
          ) : (
            <p className="text-sm italic text-neutral-400">（空回答）</p>
          )}

          {/* Extraction sub-card */}
          <div className="mt-2.5 rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900/40">
            {ext ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="text-neutral-400">提取身份</span>
                  {answer.effective ? (
                    <ClaimBadge display={answer.effective} />
                  ) : (
                    <span className="text-neutral-400">无</span>
                  )}
                  {/* Show the raw claimed vendor too, when it differs (e.g. `self`). */}
                  {answer.effective?.id === "self" && (
                    <span className="font-mono text-[10px] text-neutral-400">
                      = {ext.claimedVendor}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[10px] tabular-nums text-neutral-400">
                    conf {ext.confidence.toFixed(2)}
                  </span>
                </div>
                <ExtField label="自称">{ext.claimedModelText?.trim() || "无"}</ExtField>
                <ExtField label="理由">{ext.rationale?.trim() || "无"}</ExtField>
              </div>
            ) : (
              <p className="text-xs text-neutral-400">提取结果：无</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExtField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="shrink-0 text-neutral-400">{label}</span>
      <span className="min-w-0 break-words text-neutral-600 dark:text-neutral-300">{children}</span>
    </div>
  );
}

/** The extracted claim, shown with the vendor's logo/color chip. */
function ClaimBadge({ display }: { display: VendorDisplay }) {
  const isSelf = display.id === "self";
  const bucket = isBucket(display.id);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
        isSelf
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : bucket
            ? "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            : "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black"
      }`}
    >
      {!isSelf && display.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={display.logo} alt="" className="size-3.5 shrink-0 object-contain" />
      )}
      {!isSelf && !bucket && !display.logo && (
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ backgroundColor: display.color }}
        />
      )}
      {display.name}
    </span>
  );
}

/* ── Shared bits ─────────────────────────────────────────────────────────── */

/** Vendor logo on a dark chip (the maker logos are light variants) + color fallback. */
function VendorChip({ vendor, size }: { vendor: VendorDisplay; size: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg"
      style={{
        width: size,
        height: size,
        backgroundColor: vendor.logo ? "#111113" : vendor.color,
      }}
    >
      {vendor.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={vendor.logo}
          alt={vendor.name}
          className="object-contain"
          style={{ width: size * 0.72, height: size * 0.72 }}
        />
      ) : (
        <span className="font-bold text-white" style={{ fontSize: size * 0.4 }}>
          {vendor.name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function EmptyShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}
