"use client";

import type { CSSProperties } from "react";
import type { RaffleOption } from "@/lib/types";

type Props = {
  raffle: RaffleOption;
  selected: boolean;
  onSelect: (id: string) => void;
  accent: string;
};

export function RaffleCard({ raffle, selected, onSelect, accent }: Props) {
  const hasValue = Boolean(raffle.valueLabel?.trim());

  return (
    <button
      type="button"
      onClick={() => onSelect(raffle.id)}
      className={[
        "group relative w-full touch-manipulation overflow-hidden rounded-2xl border text-left transition-all duration-200",
        "min-h-[120px] shadow-sm sm:min-h-[132px]",
        "active:scale-[0.99] hover:-translate-y-0.5 hover:shadow-md",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        selected
          ? "border-transparent ring-2 ring-offset-2 ring-offset-stone-50 dark:ring-offset-neutral-950"
          : "border-stone-200 bg-white/80 dark:border-neutral-800 dark:bg-neutral-900/75",
      ].join(" ")}
      style={
        selected
          ? ({
              boxShadow: `0 16px 48px -18px ${accent}77`,
              ["--tw-ring-color" as string]: accent,
            } as CSSProperties)
          : undefined
      }
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-90 transition-opacity group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88, transparent)` }}
        aria-hidden
      />
      <div className="flex gap-4 p-4 md:p-5">
        <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl bg-stone-100 shadow-inner dark:bg-neutral-800">
          {raffle.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={raffle.imageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-xl font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${accent}, #1c1917)` }}
            >
              {raffle.title.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Free entry
            </span>
            {hasValue ? (
              <span
                className="max-w-full truncate rounded-md px-2 py-0.5 text-xs font-semibold text-stone-900 dark:text-neutral-50"
                style={{
                  backgroundColor: `${accent}22`,
                  border: `1px solid ${accent}44`,
                }}
              >
                {raffle.valueLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-base font-bold leading-snug text-stone-900 dark:text-neutral-50">{raffle.title}</p>
          {raffle.subtitle ? (
            <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-neutral-400">{raffle.subtitle}</p>
          ) : null}
          <p className="mt-2.5 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-neutral-500">
            {selected ? "Selected — tap another to switch" : "Tap to choose this prize pool"}
          </p>
        </div>
      </div>
    </button>
  );
}
