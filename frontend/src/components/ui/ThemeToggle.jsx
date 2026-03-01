import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Global theme toggle: switches between Light and Dark. Min tap target h-10 (40px).
 * @param {boolean} showLabel - Show "Light" / "Dark" text next to icon (e.g. in header)
 * @param {string} variant - "header" (white icon on dark bar) | "standalone" (contrast on light/dark card)
 */
export default function ThemeToggle({ showLabel = false, variant = 'header' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const isStandalone = variant === 'standalone';
  const buttonClass = isStandalone
    ? 'flex items-center justify-center gap-2 w-10 h-10 min-w-[2.5rem] rounded-lg text-neutral-600 dark:text-neutral-100 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
    : 'flex items-center justify-center gap-2 w-10 h-10 min-w-[2.5rem] rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={buttonClass}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
      {showLabel && (
        <span className="text-sm font-medium hidden md:inline">
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
}
