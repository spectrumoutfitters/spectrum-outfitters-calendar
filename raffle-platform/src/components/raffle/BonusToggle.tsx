"use client";

type Props = {
  title: string;
  description: string;
  points: number;
  checked: boolean;
  onChange: (v: boolean) => void;
};

export function BonusToggle({ title, description, points, checked, onChange }: Props) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-4 rounded-2xl border border-stone-200 bg-white/70 px-4 py-3 transition hover:border-stone-300 dark:border-neutral-800 dark:bg-neutral-900/70 dark:hover:border-neutral-700">
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 rounded border-stone-300 text-amber-600 focus:ring-amber-500 dark:border-neutral-600 dark:bg-neutral-900"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-medium text-stone-900 dark:text-neutral-100">{title}</span>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
            +{points} tickets
          </span>
        </span>
        <span className="mt-1 block text-sm text-stone-600 dark:text-neutral-400">{description}</span>
      </span>
    </label>
  );
}
