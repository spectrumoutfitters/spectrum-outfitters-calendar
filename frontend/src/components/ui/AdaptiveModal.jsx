import React, { useEffect } from 'react';

/**
 * Adaptive modal: bottom sheet on mobile, centered on tablet+.
 * - Mobile: full-width bottom sheet, rounded-t-2xl, safe-area padding, overflow-y-auto
 * - Tablet: max-w-lg centered
 * - Desktop: max-w-2xl; use size="large" for max-w-3xl/4xl
 * Rage-proof: prevents scroll bleed, keeps primary action visible.
 */
export default function AdaptiveModal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'default', // 'default' | 'large'
  closeAriaLabel = 'Close',
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const sizeClass = size === 'large'
    ? 'sm:max-w-lg md:max-w-2xl lg:max-w-4xl'
    : 'sm:max-w-lg md:max-w-xl lg:max-w-2xl';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'adaptive-modal-title' : undefined}
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel: bottom sheet on mobile, centered on sm+ */}
      <div
        className={`relative w-full max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl bg-white dark:bg-neutral-900 dark:border dark:border-neutral-800 ${sizeClass} mx-0 sm:mx-4`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 px-4 py-4 sm:px-6 border-b border-neutral-200 dark:border-neutral-800">
          {title && (
            <h2 id="adaptive-modal-title" className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-neutral-100 pr-4">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors ml-auto"
            aria-label={closeAriaLabel}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body: scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 pb-safe">
          {children}
        </div>

        {/* Optional sticky footer (e.g. form actions) */}
        {footer && (
          <div className="shrink-0 px-4 py-4 sm:px-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 rounded-b-2xl sm:rounded-b-2xl pb-safe">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
