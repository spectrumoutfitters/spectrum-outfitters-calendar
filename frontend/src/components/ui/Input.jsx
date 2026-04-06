import React from 'react';

export default function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  className = '',
  inputClassName = '',
  ...props
}) {
  return (
    <label className="block">
      {label && (
        <span className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
          {label}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={[
          'w-full h-12 px-4 rounded-2xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950',
          'text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          className,
          inputClassName,
        ].join(' ')}
        {...props}
      />
    </label>
  );
}

