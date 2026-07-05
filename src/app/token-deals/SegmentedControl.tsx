"use client";

// The scoreboard segmented control — a bordered strip of uppercase buttons,
// active segment inverted white-on-black. One component, every deals surface:
// board sort/filter, ladder metric/filter (extracted from DealsClient so the
// ladder's controls can't drift from the board's).

export function SegmentedControl<K extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { key: K; label: string; title: string }[];
  value: K;
  onChange: (value: K) => void;
}) {
  return (
    <div className="flex items-center border border-white/30" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          aria-pressed={value === option.key}
          className={
            "min-h-8 cursor-pointer px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors sm:px-3 " +
            (value === option.key
              ? "bg-white text-[#0a0a0b]"
              : "text-white/70 hover:bg-white/15 hover:text-white")
          }
          title={option.title}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
