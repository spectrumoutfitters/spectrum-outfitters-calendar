import React, { createContext, useContext, useLayoutEffect, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';

const ThemeContext = createContext({ theme: 'light', setTheme: () => {}, toggleTheme: () => {} });

const STORAGE_KEY = 'spectrum-ui-theme';

function applyThemeToDom(value) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (value === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Apply class to <html> before first paint and whenever theme changes
  useLayoutEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  const setTheme = useCallback((next) => {
    const value = next === 'dark' ? 'dark' : 'light';
    applyThemeToDom(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (_) {}
    flushSync(() => setThemeState(value));
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyThemeToDom(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) {}
    flushSync(() => setThemeState(next));
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { theme: 'light', setTheme: () => {}, toggleTheme: () => {} };
  return ctx;
}
