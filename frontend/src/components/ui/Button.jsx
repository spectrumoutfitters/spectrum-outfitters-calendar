import React from 'react';

const base =
  'inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-2xl text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed';

const variants = {
  primary:
    'bg-primary text-white hover:bg-primary/90',
  secondary:
    'bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 text-gray-900 dark:text-neutral-100 hover:bg-gray-50 dark:hover:bg-neutral-900',
  ghost:
    'bg-transparent text-gray-700 dark:text-neutral-200 hover:bg-gray-100/70 dark:hover:bg-neutral-800/70 border border-transparent',
  danger:
    'bg-danger text-white hover:bg-danger/90',
};

export default function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      {...props}
      className={[base, variants[variant] || variants.secondary, className].join(' ')}
    >
      {children}
    </button>
  );
}

