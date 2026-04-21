import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4 text-center dark:bg-neutral-950">
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-stone-900 dark:text-neutral-50">This page is unavailable</h1>
      <p className="mt-3 max-w-md text-sm text-stone-600 dark:text-neutral-400">
        The event may be inactive, missing, or the link may be incorrect.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center rounded-xl bg-stone-900 px-6 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        Back home
      </Link>
    </div>
  );
}
