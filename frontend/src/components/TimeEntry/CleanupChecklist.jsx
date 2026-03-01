import React, { useState } from 'react';

const CHECKLIST_ITEMS = [
  { id: 'work_area', label: 'Clean work area' },
  { id: 'tools', label: 'Tools back in storage' },
  { id: 'parts', label: 'Parts organized' },
  { id: 'rag_bin', label: 'Rag bin emptied' },
  { id: 'lights', label: 'Lights off' },
];

export default function CleanupChecklist({ onConfirm, onCancel, loading }) {
  const [checked, setChecked] = useState({});
  const [notes, setNotes] = useState('');

  const toggle = (id) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleConfirm = () => {
    onConfirm({ cleanup_completed: true, notes: notes.trim() || null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-neutral-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100">
            Before You Leave
          </h2>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
            Check off what you've done
          </p>
        </div>

        {/* Checklist */}
        <div className="px-5 py-4 space-y-3">
          {CHECKLIST_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className="w-full flex items-center gap-3 text-left group"
            >
              <span
                className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                  checked[item.id]
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300 dark:border-neutral-600 group-hover:border-primary'
                }`}
              >
                {checked[item.id] && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span
                className={`text-sm font-medium transition-colors ${
                  checked[item.id]
                    ? 'line-through text-gray-400 dark:text-neutral-500'
                    : 'text-gray-700 dark:text-neutral-200'
                }`}
              >
                {item.label}
              </span>
            </button>
          ))}

          {/* Notes */}
          <div className="pt-2">
            <label className="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">
              Anything else to note? (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Left vehicle on lift, check on Monday"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="w-full h-14 bg-red-500 hover:bg-red-600 active:scale-[0.98] text-white font-bold text-base rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                CONFIRM &amp; CLOCK OUT
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full h-11 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 font-medium text-sm rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
