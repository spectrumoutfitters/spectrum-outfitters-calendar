import React from 'react';

export default function Card({
  children,
  className = '',
  noPadding = false,
}) {
  return (
    <div
      className={[
        'bg-white dark:bg-neutral-950',
        'border border-gray-200 dark:border-neutral-800',
        'rounded-3xl',
        'shadow-card',
        noPadding ? '' : 'p-5',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

