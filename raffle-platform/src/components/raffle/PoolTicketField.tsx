"use client";

import { useEffect, useState } from "react";

type Props = {
  inputId: string;
  /** Accessible label (pool title). */
  label: string;
  value: number;
  /** Ceiling for this pool given other pools’ counts (from `maxTicketsForPool`). */
  max: number;
  disabled?: boolean;
  onCommit: (n: number) => void;
  /** Tailwind classes for the text box. */
  inputClassName: string;
};

/**
 * Integer ticket count: text field (no leading-zero quirks) plus up/down.
 * Commits on blur; steppers commit immediately.
 */
export function PoolTicketField({ inputId, label, value, max, disabled, onCommit, inputClassName }: Props) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!focused) setText(value === 0 ? "0" : String(value));
  }, [value, focused]);

  function commit(n: number) {
    const clamped = Math.max(0, Math.min(max, Math.floor(Number.isFinite(n) ? n : 0)));
    onCommit(clamped);
  }

  const display = focused ? text : String(value);

  return (
    <div className="flex shrink-0 items-stretch gap-1 self-center">
      <div className="flex flex-col overflow-hidden rounded-xl border border-stone-300 bg-stone-100/80 dark:border-neutral-600 dark:bg-neutral-800/80">
        <button
          type="button"
          disabled={disabled || value >= max}
          aria-label={`Add one ticket in ${label}`}
          className="flex h-5 min-w-[2.25rem] touch-manipulation items-center justify-center border-b border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-200/90 disabled:cursor-not-allowed disabled:opacity-35 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700/80"
          onClick={() => commit(value + 1)}
        >
          ▲
        </button>
        <button
          type="button"
          disabled={disabled || value <= 0}
          aria-label={`Remove one ticket from ${label}`}
          className="flex h-5 min-w-[2.25rem] touch-manipulation items-center justify-center text-xs font-bold text-stone-700 hover:bg-stone-200/90 disabled:cursor-not-allowed disabled:opacity-35 dark:text-neutral-200 dark:hover:bg-neutral-700/80"
          onClick={() => commit(value - 1)}
        >
          ▼
        </button>
      </div>
      <div className="flex flex-col items-end justify-center gap-1">
        <label htmlFor={inputId} className="sr-only">
          Tickets in {label}
        </label>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          title={`Up to ${max} in this pool so all pools add up to your ticket total.`}
          value={display}
          onFocus={() => {
            setFocused(true);
            setText(value === 0 ? "" : String(value));
          }}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            setText(digits);
          }}
          onBlur={() => {
            setFocused(false);
            const n = text === "" ? 0 : parseInt(text, 10);
            commit(Number.isFinite(n) ? n : 0);
          }}
          className={inputClassName}
        />
        <span className="text-[10px] font-medium uppercase tracking-wide text-stone-500 dark:text-neutral-500">
          tickets
        </span>
      </div>
    </div>
  );
}
