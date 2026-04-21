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
  return (
    <button
      type="button"
      onClick={() => onSelect(raffle.id)}
      className={[
        "group relative w-full rounded-2xl border text-left transition-all duration-200",
        "min-h-[120px] p-4 md:p-5",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        selected
          ? "border-transparent shadow-lg ring-2 ring-offset-2 ring-offset-stone-50 dark:ring-offset-neutral-950"
          : "border-stone-200 bg-white/60 hover:border-stone-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-700",
      ].join(" ")}
      style={
        selected
          ? ({
              boxShadow: `0 20px 50px -20px ${accent}66`,
              ["--tw-ring-color" as string]: accent,
            } as CSSProperties)
          : undefined
      }
    >
      <div className="flex gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-100 dark:bg-neutral-800">
          {raffle.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={raffle.imageUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-lg font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${accent}, #1c1917)` }}
            >
              {raffle.title.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-stone-900 dark:text-neutral-100">{raffle.title}</p>
          {raffle.subtitle ? (
            <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-neutral-400">
              {raffle.subtitle}
            </p>
          ) : null}
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-neutral-500">
            {selected ? "Selected" : "Tap to choose"}
          </p>
        </div>
      </div>
    </button>
  );
}
