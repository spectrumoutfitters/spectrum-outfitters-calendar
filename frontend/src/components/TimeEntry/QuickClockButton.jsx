import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { calculateElapsedTime } from '../../utils/helpers';
import CleanupChecklist from './CleanupChecklist';

/**
 * Big prominent CLOCK IN / CLOCK OUT button.
 * Shows elapsed time when clocked in.
 * On clock-out: shows CleanupChecklist modal before hitting API.
 * Props:
 *   onClockAction - optional callback fired after a successful clock in/out
 *   compact       - if true renders a smaller pill (for FAB use)
 */
export default function QuickClockButton({ onClockAction, compact = false }) {
  const [clockedIn, setClockedIn] = useState(false);
  const [elapsedHours, setElapsedHours] = useState('0:00');
  const [clockedInAt, setCluckedInAt] = useState(null);
  const [totalElapsedMs, setTotalElapsedMs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [showChecklist, setShowChecklist] = useState(false);
  const [confirmation, setConfirmation] = useState(null); // { type: 'in'|'out', time }

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get('/time/current');
      if (res.data.clockedIn) {
        setClockedIn(true);
        setTotalElapsedMs(res.data.totalElapsedMs ?? null);
        setCluckedInAt(res.data.entry?.clock_in ?? null);
        setElapsedHours(calculateElapsedTime(null, res.data.totalElapsedMs));
      } else {
        setClockedIn(false);
        setTotalElapsedMs(null);
        setCluckedInAt(null);
        setElapsedHours('0:00');
      }
    } catch {
      // silently fail
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Tick elapsed time every second
  useEffect(() => {
    if (!clockedIn) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/time/current');
        if (res.data.clockedIn) {
          setTotalElapsedMs(res.data.totalElapsedMs ?? null);
          setElapsedHours(calculateElapsedTime(null, res.data.totalElapsedMs));
        }
      } catch {
        if (totalElapsedMs !== null) {
          setElapsedHours(calculateElapsedTime(null, totalElapsedMs + 1000));
        }
      }
    }, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [clockedIn, totalElapsedMs]);

  const handleClockIn = async () => {
    setLoading(true);
    try {
      await api.post('/time/clock-in');
      await loadStatus();
      setConfirmation({ type: 'in', time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) });
      setTimeout(() => setConfirmation(null), 4000);
      onClockAction?.();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to clock in');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOutRequest = () => {
    setShowChecklist(true);
  };

  const handleClockOutConfirm = async ({ cleanup_completed, notes }) => {
    setLoading(true);
    try {
      await api.post('/time/clock-out', {
        break_minutes: 0,
        notes: notes || null,
        cleanup_completed,
      });
      setShowChecklist(false);
      await loadStatus();
      setConfirmation({ type: 'out', time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) });
      setTimeout(() => setConfirmation(null), 4000);
      onClockAction?.();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to clock out');
    } finally {
      setLoading(false);
    }
  };

  if (statusLoading) {
    if (compact) return null;
    return (
      <div className="w-full h-[60px] bg-gray-100 dark:bg-neutral-800 rounded-xl animate-pulse" />
    );
  }

  // ─── Compact mode (for FAB) ────────────────────────────────
  if (compact) {
    return (
      <>
        <button
          onClick={clockedIn ? handleClockOutRequest : handleClockIn}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-50 ${
            clockedIn
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-green-500 hover:bg-green-600'
          }`}
          title={clockedIn ? `Clocked in ${elapsedHours}` : 'Clock In'}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
            </svg>
          )}
          {clockedIn ? elapsedHours : 'IN'}
        </button>

        {showChecklist && (
          <CleanupChecklist
            onConfirm={handleClockOutConfirm}
            onCancel={() => setShowChecklist(false)}
            loading={loading}
          />
        )}
      </>
    );
  }

  // ─── Full mode (for Dashboard) ────────────────────────────
  return (
    <div className="relative">
      {/* Confirmation banner */}
      {confirmation && (
        <div
          className={`mb-3 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 ${
            confirmation.type === 'in'
              ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-gray-50 dark:bg-neutral-800 text-gray-700 dark:text-neutral-200 border border-gray-200 dark:border-neutral-700'
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {confirmation.type === 'in'
            ? `Clocked in at ${confirmation.time}`
            : `Clocked out at ${confirmation.time}`}
        </div>
      )}

      {clockedIn ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-neutral-400">
              Time worked today
            </div>
            <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-neutral-100">
              {elapsedHours}
            </div>
          </div>
          <button
            onClick={handleClockOutRequest}
            disabled={loading}
            className="w-full h-[60px] bg-red-500 hover:bg-red-600 active:scale-[0.99] text-white font-bold text-xl rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-3 shadow-sm"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                CLOCK OUT
              </>
            )}
          </button>
        </div>
      ) : (
        <button
          onClick={handleClockIn}
          disabled={loading}
          className="w-full h-[60px] bg-green-500 hover:bg-green-600 active:scale-[0.99] text-white font-bold text-xl rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-3 shadow-sm"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              CLOCK IN
            </>
          )}
        </button>
      )}

      {showChecklist && (
        <CleanupChecklist
          onConfirm={handleClockOutConfirm}
          onCancel={() => setShowChecklist(false)}
          loading={loading}
        />
      )}
    </div>
  );
}
