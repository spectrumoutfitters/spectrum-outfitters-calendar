import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

// ── Helpers ─────────────────────────────────────────────────

const DISPATCH_COLS = [
  { key: 'received',    label: 'Received',    dbStatus: 'todo',        color: 'blue' },
  { key: 'in_progress', label: 'In Progress', dbStatus: 'in_progress', color: 'amber' },
  { key: 'ready',       label: 'Ready',       dbStatus: 'review',      color: 'green' },
];

const PRIORITY_BADGE = {
  urgent: 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800',
  high:   'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
  medium: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  low:    'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 border border-gray-200 dark:border-neutral-700',
};

const COL_ACCENT = {
  blue:  { header: 'border-b-2 border-blue-500', dot: 'bg-blue-500', count: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' },
  amber: { header: 'border-b-2 border-amber-500', dot: 'bg-amber-500', count: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' },
  green: { header: 'border-b-2 border-green-500', dot: 'bg-green-500', count: 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300' },
};

function fmtElapsed(mins) {
  if (mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtClockIn(isoStr) {
  if (!isoStr) return null;
  return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function jobRisk(job) {
  if (!job.estimated_hours || job.elapsed_minutes == null) return 'ok';
  const elapsedH = job.elapsed_minutes / 60;
  const ratio = elapsedH / job.estimated_hours;
  if (ratio >= 1) return 'overdue';
  if (ratio >= 0.8) return 'warning';
  return 'ok';
}

const RISK_BORDER = {
  overdue: 'border-l-4 border-l-red-500',
  warning: 'border-l-4 border-l-amber-400',
  ok:      'border-l-4 border-l-transparent',
};

// ── Job Card ─────────────────────────────────────────────────

function JobCard({ job, onDragStart, onClick }) {
  const risk = jobRisk(job);
  const elapsed = fmtElapsed(job.elapsed_minutes);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, job)}
      onClick={() => onClick(job)}
      className={`bg-white dark:bg-neutral-800 rounded-xl p-3.5 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none ${RISK_BORDER[risk]}`}
    >
      {/* Title */}
      <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100 line-clamp-2 leading-snug mb-2">
        {job.title}
      </p>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md ${PRIORITY_BADGE[job.priority] || PRIORITY_BADGE.medium}`}>
          {job.priority}
        </span>
        {risk === 'overdue' && (
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            Overdue
          </span>
        )}
        {risk === 'warning' && (
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Nearing limit
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-neutral-500 mb-1">
          <span>Progress</span>
          <span>{job.progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-neutral-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              risk === 'overdue' ? 'bg-red-500' : risk === 'warning' ? 'bg-amber-400' : 'bg-green-500'
            }`}
            style={{ width: `${job.progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-neutral-400">
        <span className="truncate">
          {job.assigned_to_name || (
            <span className="italic text-gray-400 dark:text-neutral-500">Unassigned</span>
          )}
        </span>
        {elapsed && (
          <span className="font-mono flex-shrink-0 ml-1">{elapsed}</span>
        )}
      </div>
    </div>
  );
}

// ── Team Card ────────────────────────────────────────────────

function TeamCard({ member }) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        {/* Status dot */}
        <div className="mt-0.5 flex-shrink-0">
          <span
            className={`block w-2.5 h-2.5 rounded-full ${
              member.status === 'working' ? 'bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.2)]' : 'bg-gray-300 dark:bg-neutral-600'
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100 truncate">{member.name}</p>

          {member.status === 'working' ? (
            <>
              {member.current_job_title ? (
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 truncate">
                  {member.current_job_title}
                </p>
              ) : (
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 italic">No active job</p>
              )}
              <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                {member.hours_today}h today
                {member.clocked_in_at && (
                  <span className="text-gray-400 dark:text-neutral-500 font-normal ml-1">
                    · in {fmtClockIn(member.clocked_in_at)}
                  </span>
                )}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
              {member.hours_today > 0 ? `${member.hours_today}h logged` : 'Not clocked in'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Column ───────────────────────────────────────────────────

function Column({ col, jobs, onDragOver, onDrop, onDragStart, onJobClick }) {
  const accent = COL_ACCENT[col.color];

  return (
    <div
      className="flex flex-col min-h-0"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, col)}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 pb-2.5 mb-3 ${accent.header}`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${accent.dot}`} />
        <span className="text-sm font-bold text-gray-700 dark:text-neutral-200 uppercase tracking-wide">
          {col.label}
        </span>
        <span className={`ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-md ${accent.count}`}>
          {jobs.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[80px] rounded-lg">
        {jobs.length === 0 && (
          <div className="flex items-center justify-center h-16 border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl text-xs text-gray-400 dark:text-neutral-500">
            Drop here
          </div>
        )}
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onDragStart={onDragStart}
            onClick={onJobClick}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main DispatchBoard ───────────────────────────────────────

export default function DispatchBoard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const dragJobRef = useRef(null);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/dispatch');
      setJobs(res.data.jobs || []);
      setTeam(res.data.team || []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dispatch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Drag-drop handlers ────────────────────────────────────

  const handleDragStart = (e, job) => {
    dragJobRef.current = job;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetCol) => {
    e.preventDefault();
    const job = dragJobRef.current;
    dragJobRef.current = null;
    if (!job || job.db_status === targetCol.dbStatus) return;

    // Optimistic update
    setJobs((prev) =>
      prev.map((j) =>
        j.id === job.id
          ? { ...j, db_status: targetCol.dbStatus, status: targetCol.key }
          : j
      )
    );

    try {
      await api.put(`/tasks/${job.id}/status`, { status: targetCol.dbStatus });
    } catch {
      // Revert on failure
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, db_status: job.db_status, status: job.status } : j
        )
      );
    }
  };

  // ── Job click: navigate to tasks page ────────────────────

  const handleJobClick = (job) => {
    navigate(`/tasks?highlight=${job.id}`);
  };

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-neutral-400">Loading dispatch board...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => loadData()} className="text-sm text-primary hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const clockedIn = team.filter((m) => m.status === 'working');
  const away = team.filter((m) => m.status !== 'working');

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-neutral-100">Dispatch Board</h1>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
            Live job &amp; team status
            {lastRefresh && (
              <span className="ml-1">· refreshed {lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-neutral-300 border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Main layout: team on left, columns on right */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* ── Team panel ────────────────────────────────────── */}
        <div className="lg:w-60 xl:w-72 flex-shrink-0">
          <div className="bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-2xl p-4 h-full overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Team</h2>
              <span className="text-xs font-semibold bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-md">
                {clockedIn.length} in
              </span>
            </div>

            <div className="space-y-2">
              {clockedIn.map((m) => <TeamCard key={m.id} member={m} />)}
              {away.length > 0 && clockedIn.length > 0 && (
                <div className="pt-1 pb-0.5">
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Away</span>
                </div>
              )}
              {away.map((m) => <TeamCard key={m.id} member={m} />)}
              {team.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-neutral-500 text-center py-4">No team data</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Job columns ───────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 min-h-0">
          {DISPATCH_COLS.map((col) => {
            const colJobs = jobs.filter((j) => j.status === col.key);
            return (
              <Column
                key={col.key}
                col={col}
                jobs={colJobs}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragStart={handleDragStart}
                onJobClick={handleJobClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
