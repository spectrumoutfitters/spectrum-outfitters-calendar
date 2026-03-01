import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const STATUS_CONFIG = {
  todo:        { label: 'Received',          color: 'bg-blue-100 text-blue-800 border-blue-300',   icon: '🔵' },
  in_progress: { label: 'In Progress',       color: 'bg-amber-100 text-amber-800 border-amber-300', icon: '🔧' },
  review:      { label: 'Ready for Pickup',  color: 'bg-green-100 text-green-800 border-green-300', icon: '✅' },
  completed:   { label: 'Completed',         color: 'bg-gray-100 text-gray-700 border-gray-300',    icon: '🏁' },
};

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatUpdated(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function CustomerStatus() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/customer-status/${token}`, { signal: controller.signal });
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) throw new Error('Server error');
        const json = await res.json();
        setData(json);
      } catch (err) {
        if (err.name !== 'AbortError') setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [token]);

  const statusInfo = STATUS_CONFIG[data?.status] || STATUS_CONFIG.todo;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header style={{ backgroundColor: '#1a1a1a' }} className="px-4 py-4 flex items-center gap-3">
        <div
          style={{
            width: 40, height: 40, borderRadius: 8,
            backgroundColor: '#D4A017',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, color: '#1a1a1a', fontSize: 18,
          }}
        >
          S
        </div>
        <div>
          <p style={{ color: '#D4A017', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
            Spectrum Outfitters
          </p>
          <p style={{ color: '#9ca3af', fontSize: 12 }}>Vehicle Status</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 max-w-lg mx-auto w-full">
        {loading && (
          <div className="w-full space-y-4 mt-4">
            <div className="h-8 bg-gray-200 rounded animate-pulse w-3/4 mx-auto" />
            <div className="h-24 bg-gray-200 rounded-2xl animate-pulse" />
            <div className="h-16 bg-gray-200 rounded-xl animate-pulse" />
          </div>
        )}

        {!loading && notFound && (
          <div className="text-center mt-12">
            <p className="text-5xl mb-4">🔍</p>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Link Not Found</h2>
            <p className="text-gray-500 text-sm">
              This status link is invalid or may have expired. Contact us for an update.
            </p>
            <a
              href="tel:+1"
              style={{ backgroundColor: '#D4A017' }}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold"
            >
              📞 Call Us
            </a>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Greeting */}
            {data.customer_name && (
              <p className="text-gray-500 text-sm mb-1 self-start">
                Hello, <span className="font-semibold text-gray-700">{data.customer_name}</span>
              </p>
            )}

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 self-start mb-5 leading-tight">
              {data.task_title}
            </h1>

            {/* Status badge */}
            <div
              className={`w-full flex items-center gap-4 rounded-2xl border-2 p-5 mb-5 ${statusInfo.color}`}
            >
              <span className="text-4xl">{statusInfo.icon}</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-0.5">
                  Current Status
                </p>
                <p className="text-2xl font-bold">{statusInfo.label}</p>
              </div>
            </div>

            {/* Progress steps */}
            <div className="w-full flex items-center gap-1 mb-6">
              {['todo', 'in_progress', 'review', 'completed'].map((s, i) => {
                const statuses = ['todo', 'in_progress', 'review', 'completed'];
                const currentIdx = statuses.indexOf(data.status);
                const isDone = i <= currentIdx;
                const isCurrent = i === currentIdx;
                return (
                  <React.Fragment key={s}>
                    <div
                      className={`flex-1 h-2 rounded-full transition-all ${
                        isDone
                          ? isCurrent
                            ? 'bg-amber-400'
                            : 'bg-green-500'
                          : 'bg-gray-200'
                      }`}
                    />
                  </React.Fragment>
                );
              })}
            </div>
            <div className="w-full flex justify-between text-[10px] text-gray-400 -mt-4 mb-5 px-0.5">
              <span>Received</span>
              <span>Working</span>
              <span>Ready</span>
              <span>Done</span>
            </div>

            {/* Details */}
            <div className="w-full bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-5">
              {data.description && (
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{data.description}</p>
                </div>
              )}
              {data.due_date && (
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Estimated Completion</p>
                  <p className="text-sm font-semibold text-gray-800">{formatDate(data.due_date)}</p>
                </div>
              )}
              {data.last_updated && (
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Last Updated</p>
                  <p className="text-sm text-gray-600">{formatUpdated(data.last_updated)}</p>
                </div>
              )}
            </div>

            {/* Call to action */}
            <a
              href="tel:+1"
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-white text-base"
              style={{ backgroundColor: '#D4A017' }}
            >
              📞 Questions? Call Us
            </a>

            <p className="text-xs text-gray-400 text-center mt-6">
              Spectrum Outfitters · Powered by your shop management system
            </p>
          </>
        )}
      </main>
    </div>
  );
}
