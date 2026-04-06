import React from 'react';

export default function Chip({ children, className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold',
        'bg-gray-100 dark:bg-neutral-900',
        'text-gray-700 dark:text-neutral-200',
        'border border-gray-200 dark:border-neutral-800',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

