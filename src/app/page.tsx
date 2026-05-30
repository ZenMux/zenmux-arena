import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-white px-6 py-24 text-center dark:bg-black">
      {/* Soft ambient backdrop — a single radial wash, kept subtle. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_0%,rgba(120,120,255,0.07),transparent_70%)] dark:[background:radial-gradient(60%_50%_at_50%_0%,rgba(140,140,255,0.10),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neutral-200 to-transparent dark:via-neutral-800"
      />

      <div className="relative flex w-full max-w-xl flex-col items-center gap-10">
        {/* Wordmark — theme-aware. Note the asset naming: ZenMux-Light.png is the
            DARK wordmark (for light backgrounds), ZenMux.png is the WHITE wordmark
            (for dark backgrounds) — same convention as the graph export (svg.ts). */}
        <div>
          <Image
            src="/maker-logo/ZenMux-Light.png"
            alt="ZenMux"
            width={512}
            height={125}
            priority
            className="h-9 w-auto dark:hidden"
          />
          <Image
            src="/maker-logo/ZenMux.png"
            alt="ZenMux"
            width={2000}
            height={512}
            priority
            className="hidden h-9 w-auto dark:block"
          />
        </div>

        <div className="flex flex-col items-center gap-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            ZenMux Arena
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl dark:text-neutral-50">
            Where frontier models
            <br className="hidden sm:block" /> meet the same question.
          </h1>
          <p className="max-w-md text-pretty text-lg leading-8 text-neutral-500 dark:text-neutral-400">
            Reproducible, cross-vendor studies of how today&apos;s leading LLMs
            actually behave — run through one unified endpoint.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/research"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            <FlaskConical className="size-4" />
            Enter the Arena
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="https://zenmux.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-full border border-neutral-200 px-6 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            About ZenMux
          </a>
        </div>
      </div>

      {/* Featured study card */}
      <Link
        href="/research"
        className="group relative mt-16 flex w-full max-w-xl items-center gap-4 rounded-2xl border border-neutral-200 bg-white/70 p-5 text-left backdrop-blur transition-all hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70 dark:hover:border-neutral-700"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          <FlaskConical className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">
            Featured study
          </p>
          <h2 className="mt-1 truncate font-medium text-neutral-900 dark:text-neutral-100">
            Who Are You? — Cross-Vendor Identity Confusion
          </h2>
          <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
            One question, many vendors, ten languages.
          </p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
      </Link>

      <footer className="relative mt-16 text-xs text-neutral-400">
        Built by{" "}
        <strong className="font-medium text-neutral-500 dark:text-neutral-400">
          thinkthinking
        </strong>{" "}
        ·{" "}
        <a
          href="https://zenmux.ai"
          className="underline decoration-dotted underline-offset-4 hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          ZenMux.ai
        </a>
      </footer>
    </main>
  );
}
