import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import CleanupChecklist from '../TimeEntry/CleanupChecklist';

// ─── Constants ───────────────────────────────────────────────

const AFFIRMATIONS = [
  "You've got this! Keep crushing it!",
  "Great work today — you're a valuable part of the team!",
  "Every task completed is progress. You're doing amazing!",
  "Your effort matters. Keep it up!",
  "Crushing it today! The team is lucky to have you.",
  "Focus on the next task — you've got the skills.",
  "Taking care of business — nice work!",
  "Your hard work doesn't go unnoticed. Keep going!",
];

// ─── Helpers ─────────────────────────────────────────────────

const getDailyAffirmation = () => {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now - new Date(now.getFullYear(), 0, 0)) / 86400000
  );
  return AFFIRMATIONS[dayOfYear % AFFIRMATIONS.length];
};

const getGreeting = (user) => {
  const hour = new Date().getHours();
  const name = user?.full_name?.split(' ')[0] || user?.username || 'there';
  if (hour >= 5 && hour < 12) return `Good morning, ${name}!`;
  if (hour >= 12 && hour < 17) return `Good afternoon, ${name}!`;
  if (hour >= 17 && hour < 22) return `Good evening, ${name}!`;
  return `Hey, ${name}!`;
};

const formatElapsed = (ms) => {
  if (!ms || ms < 0) return '0m';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
};

const formatBreakRemaining = (ms) => {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const formatTaskDuration = (minutes) => {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// ─── VacationCountdownWidget ──────────────────────────────

const VACATION_CHECKLIST_ITEMS = [
  'Update team on your projects',
  'Hand off any urgent items',
  'Document your progress',
  'Out-of-office message set',
  'All tools cleaned up',
];

function VacationCountdownWidget({ daysOff, onNotifyAdmin }) {
  const [checked, setChecked] = useState({});
  const [notified, setNotified] = useState(false);

  const { days_remaining, start_date } = daysOff;
  const showChecklist = days_remaining <= 3;

  const startLabel = new Date(start_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const toggle = (i) => setChecked((prev) => ({ ...prev, [i]: !prev[i] }));

  const handleNotify = async () => {
    if (notified) return;
    await onNotifyAdmin(days_remaining);
    setNotified(true);
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🏖️</span>
        <h2 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
          Upcoming Time Off
        </h2>
      </div>

      <p className="text-gray-800 dark:text-blue-100 font-semibold text-base mb-1">
        {days_remaining === 0
          ? 'Your time off starts today!'
          : days_remaining === 1
          ? '1 day until your time off'
          : `${days_remaining} days until your time off`}
      </p>
      <p className="text-sm text-gray-500 dark:text-blue-300/70 mb-4">
        Starts {startLabel}
      </p>

      {showChecklist && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-blue-100 dark:border-blue-900">
          <p className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
            Before you go — make sure to:
          </p>
          <div className="space-y-2.5">
            {VACATION_CHECKLIST_ITEMS.map((item, i) => (
              <label
                key={i}
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => toggle(i)}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${
                    checked[i]
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300 dark:border-neutral-600 group-hover:border-green-400'
                  }`}
                >
                  {checked[i] && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span
                  className={`text-sm transition ${
                    checked[i]
                      ? 'line-through text-gray-400 dark:text-neutral-500'
                      : 'text-gray-700 dark:text-neutral-200'
                  }`}
                >
                  {item}
                </span>
              </label>
            ))}
          </div>

          <button
            onClick={handleNotify}
            disabled={notified}
            className={`mt-4 w-full py-2.5 rounded-xl text-sm font-semibold transition active:scale-95 ${
              notified
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 cursor-default'
                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm'
            }`}
          >
            {notified ? '✓ Admin notified' : 'Notify admin of handoff'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── WelcomeBackBanner ────────────────────────────────────

function WelcomeBackBanner() {
  return (
    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">👋</span>
        <div>
          <p className="font-bold text-green-800 dark:text-green-200 text-base">
            Welcome back!
          </p>
          <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
            Catch up with the team on what happened while you were out.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function EmployeeDashboard({ onClockAction }) {
  const { user } = useAuth();

  const [clockStatus, setClockStatus] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [upcomingDaysOff, setUpcomingDaysOff] = useState(null);
  const [recentlyReturned, setRecentlyReturned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  // Break timer
  const [breakTimer, setBreakTimer] = useState(null); // { endTime, duration }
  const [breakRemaining, setBreakRemaining] = useState(null);

  const elapsedRef = useRef(null);
  const breakRef = useRef(null);
  const baseElapsedRef = useRef(0);
  const tickStartRef = useRef(null);

  // ─── Data loading ─────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [clockRes, tasksRes, daysOffRes] = await Promise.all([
        api.get('/time/current').catch(() => ({ data: { clockedIn: false } })),
        api.get('/tasks').catch(() => ({ data: { tasks: [] } })),
        api.get('/employee/upcoming-days-off').catch(() => ({ data: { upcoming: null, recently_returned: null } })),
      ]);

      const cs = clockRes.data;
      setClockStatus(cs);

      if (cs.clockedIn && cs.totalElapsedMs !== undefined) {
        baseElapsedRef.current = cs.totalElapsedMs;
        tickStartRef.current = Date.now();
        setElapsedMs(cs.totalElapsedMs);
      } else {
        baseElapsedRef.current = 0;
        tickStartRef.current = null;
        setElapsedMs(0);
      }

      // Tasks assigned to this user, not archived/completed
      const allTasks = tasksRes.data?.tasks || [];
      const myTasks = allTasks
        .filter((t) => t.status !== 'completed' && !t.is_archived)
        .sort((a, b) => {
          const order = { in_progress: 0, review: 1, todo: 2 };
          return (order[a.status] ?? 3) - (order[b.status] ?? 3);
        });
      setTasks(myTasks);

      setUpcomingDaysOff(daysOffRes.data?.upcoming || null);
      setRecentlyReturned(!!daysOffRes.data?.recently_returned);
    } catch (err) {
      console.error('EmployeeDashboard loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ─── Elapsed time ticker ──────────────────────────────────

  useEffect(() => {
    clearInterval(elapsedRef.current);
    if (clockStatus?.clockedIn) {
      elapsedRef.current = setInterval(() => {
        const base = baseElapsedRef.current || 0;
        const diff = tickStartRef.current ? Date.now() - tickStartRef.current : 0;
        setElapsedMs(base + diff);
      }, 1000);
    }
    return () => clearInterval(elapsedRef.current);
  }, [clockStatus?.clockedIn]);

  // ─── Break timer ticker ───────────────────────────────────

  useEffect(() => {
    clearInterval(breakRef.current);
    if (breakTimer) {
      breakRef.current = setInterval(() => {
        const rem = breakTimer.endTime - Date.now();
        if (rem <= 0) {
          setBreakRemaining(0);
          setBreakTimer(null);
          clearInterval(breakRef.current);
        } else {
          setBreakRemaining(rem);
        }
      }, 500);
    }
    return () => clearInterval(breakRef.current);
  }, [breakTimer]);

  // ─── Clock actions ────────────────────────────────────────

  const handleClockIn = async () => {
    setClockLoading(true);
    try {
      await api.post('/time/clock-in');
      await loadData();
      setConfirmation({
        type: 'in',
        time: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
      });
      setTimeout(() => setConfirmation(null), 4000);
      onClockAction?.();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to clock in');
    } finally {
      setClockLoading(false);
    }
  };

  const handleClockOutConfirm = async ({ cleanup_completed, notes }) => {
    setClockLoading(true);
    try {
      await api.post('/time/clock-out', {
        break_minutes: 0,
        notes: notes || null,
        cleanup_completed,
      });
      setShowChecklist(false);
      await loadData();
      setConfirmation({
        type: 'out',
        time: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
      });
      setTimeout(() => setConfirmation(null), 4000);
      onClockAction?.();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to clock out');
    } finally {
      setClockLoading(false);
    }
  };

  const startBreak = (minutes) => {
    setBreakTimer({ endTime: Date.now() + minutes * 60 * 1000, duration: minutes });
    setBreakRemaining(minutes * 60 * 1000);
  };

  const handleMarkTaskDone = async (task) => {
    try {
      await api.put(`/tasks/${task.id}`, { status: 'completed' });
      await loadData();
    } catch {
      /* silent */
    }
  };

  const handleNotifyAdmin = async (days_remaining) => {
    try {
      await api.post('/employee/vacation-checklist', { days_remaining });
    } catch {
      /* silent */
    }
  };

  // ─── Derived values ───────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isClockedIn = clockStatus?.clockedIn;
  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const currentTask =
    tasks.find((t) => t.status === 'in_progress') ||
    tasks.find((t) => t.status === 'todo');
  const affirmation = getDailyAffirmation();

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-6">

      {/* ── Confirmation banner ── */}
      {confirmation && (
        <div
          className={`px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2 ${
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

      {/* ── Header card ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-100 dark:border-neutral-800 shadow-sm">
        {!isClockedIn ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
              {getGreeting(user)}
            </h1>
            <p className="text-gray-500 dark:text-neutral-400 mt-1 text-base">
              {activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''} today
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
              You're on the clock!
            </p>
            <p className="text-4xl font-bold text-primary tabular-nums">
              {formatElapsed(elapsedMs)}
            </p>
            <p className="text-sm text-gray-400 dark:text-neutral-500 mt-1">elapsed today</p>
          </>
        )}
      </div>

      {/* ── HUGE Clock In / Out button ── */}
      <button
        onClick={isClockedIn ? () => setShowChecklist(true) : handleClockIn}
        disabled={clockLoading}
        className={`w-full rounded-2xl py-7 px-6 text-white font-bold flex items-center justify-center gap-4 transition-all active:scale-95 shadow-lg text-2xl ${
          isClockedIn
            ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
            : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
        } ${clockLoading ? 'opacity-70 cursor-wait' : ''}`}
      >
        {clockLoading ? (
          <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span className="text-4xl">{isClockedIn ? '🔴' : '🟢'}</span>
            <span>{isClockedIn ? 'CLOCK OUT' : 'CLOCK IN'}</span>
          </>
        )}
      </button>

      {/* ── Affirmation (when not clocked in) ── */}
      {!isClockedIn && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">⭐</span>
            <p className="text-gray-800 dark:text-amber-100 text-base leading-relaxed font-medium">
              "{affirmation}"
            </p>
          </div>
        </div>
      )}

      {/* ── Welcome back (after returning from time off) ── */}
      {recentlyReturned && <WelcomeBackBanner />}

      {/* ── Vacation countdown (only when time off in next 14 days) ── */}
      {upcomingDaysOff && (
        <VacationCountdownWidget
          daysOff={upcomingDaysOff}
          onNotifyAdmin={handleNotifyAdmin}
        />
      )}

      {/* ── Break timer (when clocked in) ── */}
      {isClockedIn && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-100 dark:border-neutral-800 shadow-sm">
          <h2 className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
            Break Timer
          </h2>
          {breakTimer && breakRemaining !== null && breakRemaining > 0 ? (
            <div className="text-center py-2">
              <p className="text-5xl font-bold text-primary tabular-nums mb-1">
                {formatBreakRemaining(breakRemaining)}
              </p>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mb-4">
                {breakTimer.duration}min break
              </p>
              <button
                onClick={() => { setBreakTimer(null); setBreakRemaining(null); }}
                className="text-sm text-gray-400 hover:text-red-500 underline transition"
              >
                Cancel break
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => startBreak(15)}
                className="flex-1 py-4 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-xl text-sm font-bold text-gray-700 dark:text-neutral-200 transition active:scale-95"
              >
                15 min
              </button>
              <button
                onClick={() => startBreak(30)}
                className="flex-1 py-4 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-xl text-sm font-bold text-gray-700 dark:text-neutral-200 transition active:scale-95"
              >
                30 min
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Current task (when clocked in) ── */}
      {isClockedIn && currentTask && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-100 dark:border-neutral-800 shadow-sm">
          <h2 className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
            Current Task
          </h2>
          <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight mb-1">
            {currentTask.title}
          </p>
          {currentTask.estimated_time_minutes && (
            <p className="text-sm text-gray-400 dark:text-neutral-500 mb-4">
              Est. {formatTaskDuration(currentTask.estimated_time_minutes)}
            </p>
          )}
          <button
            onClick={() => handleMarkTaskDone(currentTask)}
            className="w-full py-3.5 bg-green-500 hover:bg-green-600 active:scale-95 text-white rounded-xl text-sm font-bold transition shadow-sm"
          >
            ✓ Mark as done
          </button>
        </div>
      )}

      {/* ── Today's work / progress ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-100 dark:border-neutral-800 shadow-sm">
        <h2 className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-4">
          {isClockedIn ? "Today's Progress" : "Today's Work"}
        </h2>

        {/* Progress stats (when clocked in) */}
        {isClockedIn && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center bg-green-50 dark:bg-green-900/20 rounded-xl py-3">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {tasks.filter((t) => t.status === 'completed').length}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-neutral-400 font-medium mt-0.5 uppercase">
                Done
              </p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-neutral-800 rounded-xl py-3">
              <p className="text-2xl font-bold text-gray-700 dark:text-neutral-200">
                {activeTasks.length}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-neutral-400 font-medium mt-0.5 uppercase">
                Left
              </p>
            </div>
            <div className="text-center bg-primary/5 dark:bg-primary/10 rounded-xl py-3">
              <p className="text-lg font-bold text-primary tabular-nums">
                {formatElapsed(elapsedMs)}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-neutral-400 font-medium mt-0.5 uppercase">
                Worked
              </p>
            </div>
          </div>
        )}

        {/* Task list */}
        {activeTasks.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-neutral-500 text-center py-6">
            {isClockedIn ? 'All done! Great work today! 🎉' : 'No tasks assigned. Enjoy your day!'}
          </p>
        ) : (
          <div className="space-y-0 divide-y divide-gray-50 dark:divide-neutral-800">
            {activeTasks.slice(0, 6).map((task, i) => (
              <div
                key={task.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-sm font-bold text-gray-300 dark:text-neutral-600 w-5 flex-shrink-0">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-neutral-100 truncate leading-tight">
                    {task.title}
                  </p>
                  {task.estimated_time_minutes && (
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                      {formatTaskDuration(task.estimated_time_minutes)}
                    </p>
                  )}
                </div>
                {task.status === 'in_progress' && (
                  <span className="flex-shrink-0 text-[10px] font-bold bg-primary/10 text-primary px-2 py-1 rounded-full uppercase tracking-wide">
                    Active
                  </span>
                )}
              </div>
            ))}
            {activeTasks.length > 6 && (
              <p className="text-xs text-gray-400 dark:text-neutral-500 text-center pt-3">
                +{activeTasks.length - 6} more tasks
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Affirmation when clocked in ── */}
      {isClockedIn && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4">
          <div className="flex items-start gap-2">
            <span className="text-xl flex-shrink-0">⭐</span>
            <p className="text-gray-700 dark:text-amber-100 text-sm font-medium leading-relaxed">
              "{affirmation}"
            </p>
          </div>
        </div>
      )}

      {/* ── Cleanup checklist modal ── */}
      {showChecklist && (
        <CleanupChecklist
          onConfirm={handleClockOutConfirm}
          onCancel={() => setShowChecklist(false)}
          loading={clockLoading}
        />
      )}
    </div>
  );
}
