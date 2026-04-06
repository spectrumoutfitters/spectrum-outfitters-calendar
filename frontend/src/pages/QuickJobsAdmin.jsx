import React, { useEffect, useState } from 'react';
import api from '../utils/api';

const emptyJob = {
  id: null,
  name: '',
  color: '',
  is_active: true,
  sort_order: 0,
  items: [],
};

const emptyItem = {
  kind: 'part',
  description: '',
  part_number: '',
  quantity: 1,
  unit_price_cents: null,
  discount_type: null,
  discount_value: null,
  inventory_item_id: null,
};

const QuickJobsAdmin = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(emptyJob);
  const [saving, setSaving] = useState(false);
  const [invQ, setInvQ] = useState('');
  const [invLoading, setInvLoading] = useState(false);
  const [invResults, setInvResults] = useState([]);
  const [invIndex, setInvIndex] = useState(null);

  const loadJobs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/crm/quick-jobs');
      setJobs(res.data?.jobs || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load quick jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!invQ.trim() || invIndex == null) {
        setInvResults([]);
        return;
      }
      setInvLoading(true);
      try {
        const res = await api.get('/inventory/items', { params: { q: invQ.trim() } });
        setInvResults((res.data?.items || []).slice(0, 10));
      } catch {
        setInvResults([]);
      } finally {
        setInvLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [invQ, invIndex]);

  const startNew = () => {
    setEditing({ ...emptyJob, items: [] });
    setError('');
  };

  const startEdit = async (id) => {
    setError('');
    try {
      const res = await api.get(`/crm/quick-jobs/${id}`);
      const job = res.data?.job;
      const items = res.data?.items || [];
      if (job) {
        setEditing({
          id: job.id,
          name: job.name || '',
          color: job.color || '',
          is_active: job.is_active !== 0,
          sort_order: job.sort_order ?? 0,
          items,
        });
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load quick job');
    }
  };

  const saveJob = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: editing.name,
        color: editing.color || null,
        is_active: !!editing.is_active,
        sort_order: Number(editing.sort_order) || 0,
        items: editing.items.map((it) => ({
          ...it,
          quantity: it.quantity != null ? Number(it.quantity) : null,
          unit_price_cents: it.unit_price_cents != null ? Number(it.unit_price_cents) : null,
          discount_value: it.discount_value != null ? Number(it.discount_value) : null,
        })),
      };
      if (editing.id) {
        await api.put(`/crm/quick-jobs/${editing.id}`, payload);
      } else {
        await api.post('/crm/quick-jobs', payload);
      }
      await loadJobs();
      setEditing(emptyJob);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to save quick job');
    } finally {
      setSaving(false);
    }
  };

  const deleteJob = async (id) => {
    if (!window.confirm('Delete this quick job?')) return;
    try {
      await api.delete(`/crm/quick-jobs/${id}`);
      await loadJobs();
      if (editing.id === id) setEditing(emptyJob);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-neutral-100">Quick jobs</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Define reusable service packages (parts + labor + fees) for one-click invoice write-ups.
          </p>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="min-h-11 px-4 rounded-xl bg-primary text-white text-sm font-semibold"
        >
          New quick job
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950">
            <div className="p-3 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-600 dark:text-neutral-300 uppercase tracking-wider">
                Templates
              </h2>
            </div>
            {loading ? (
              <div className="p-4 text-sm text-gray-500 dark:text-neutral-400">Loading…</div>
            ) : jobs.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 dark:text-neutral-400">No quick jobs yet.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                {jobs.map((j) => (
                  <div key={j.id} className="p-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(j.id)}
                      className="text-left flex-1"
                    >
                      <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100 truncate">
                        {j.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                        {j.is_active ? 'Active' : 'Inactive'} · Order {j.sort_order ?? 0}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteJob(j.id)}
                      className="min-h-8 px-3 rounded-lg border border-red-200 dark:border-red-800 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-600 dark:text-neutral-300 uppercase tracking-wider">
              {editing.id ? 'Edit template' : 'New template'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">
                  Name
                </label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 text-sm"
                  placeholder="e.g. Oil change – synthetic"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">
                  Sort order
                </label>
                <input
                  value={editing.sort_order}
                  onChange={(e) => setEditing((s) => ({ ...s, sort_order: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 text-sm"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">
                  Color (optional)
                </label>
                <input
                  value={editing.color}
                  onChange={(e) => setEditing((s) => ({ ...s, color: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 text-sm"
                  placeholder="e.g. amber, green"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="qjob-active"
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing((s) => ({ ...s, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 dark:border-neutral-600 text-primary focus:ring-primary"
                />
                <label htmlFor="qjob-active" className="text-xs text-gray-600 dark:text-neutral-300">
                  Active (show button on invoice)
                </label>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-neutral-300 uppercase tracking-wider">
                  Lines in this job
                </p>
                <button
                  type="button"
                  onClick={() => setEditing((s) => ({ ...s, items: [...(s.items || []), { ...emptyItem }] }))}
                  className="min-h-9 px-3 rounded-lg bg-primary text-white text-xs font-semibold"
                >
                  Add line
                </button>
              </div>
              {(editing.items || []).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-neutral-400">No lines yet. Add parts, labor, or fees.</p>
              ) : (
                <div className="space-y-2">
                  {(editing.items || []).map((it, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-950 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={it.kind || 'part'}
                          onChange={(e) =>
                            setEditing((s) => {
                              const items = [...(s.items || [])];
                              items[idx] = { ...items[idx], kind: e.target.value };
                              return { ...s, items };
                            })
                          }
                          className="h-9 px-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-neutral-100"
                        >
                          <option value="part">Part</option>
                          <option value="labor">Labor</option>
                          <option value="fee">Fee</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setEditing((s) => ({
                              ...s,
                              items: (s.items || []).filter((_, j) => j !== idx),
                            }))
                          }
                          className="min-h-8 px-2 rounded-lg border border-red-200 dark:border-red-800 text-[11px] font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold mb-1">
                            Description
                          </label>
                          <input
                            value={it.description || ''}
                            onChange={(e) =>
                              setEditing((s) => {
                                const items = [...(s.items || [])];
                                items[idx] = { ...items[idx], description: e.target.value };
                                return { ...s, items };
                              })
                            }
                            className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-neutral-100"
                            placeholder="Oil change, labor, shop supplies…"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold mb-1">
                            Part #
                          </label>
                          <input
                            value={it.part_number || ''}
                            onChange={(e) =>
                              setEditing((s) => {
                                const items = [...(s.items || [])];
                                items[idx] = { ...items[idx], part_number: e.target.value };
                                return { ...s, items };
                              })
                            }
                            className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-neutral-100 font-mono"
                            placeholder="SKU"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold mb-1">
                            Qty / hours
                          </label>
                          <input
                            value={it.quantity ?? ''}
                            onChange={(e) =>
                              setEditing((s) => {
                                const items = [...(s.items || [])];
                                items[idx] = { ...items[idx], quantity: e.target.value };
                                return { ...s, items };
                              })
                            }
                            className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-neutral-100 text-right"
                            inputMode="decimal"
                            placeholder="1"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold mb-1">
                            Unit ($)
                          </label>
                          <input
                            value={
                              it.unit_price_cents != null
                                ? (Number(it.unit_price_cents) / 100).toFixed(2)
                                : ''
                            }
                            onChange={(e) =>
                              setEditing((s) => {
                                const items = [...(s.items || [])];
                                const val = e.target.value;
                                const num = Number.parseFloat(val);
                                items[idx] = {
                                  ...items[idx],
                                  unit_price_cents: Number.isFinite(num) ? Math.round(num * 100) : null,
                                };
                                return { ...s, items };
                              })
                            }
                            className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-neutral-100 text-right"
                            inputMode="decimal"
                            placeholder="99.99"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold mb-1">
                            Discount
                          </label>
                          <div className="flex gap-1">
                            <select
                              value={it.discount_type || ''}
                              onChange={(e) =>
                                setEditing((s) => {
                                  const items = [...(s.items || [])];
                                  items[idx] = { ...items[idx], discount_type: e.target.value || null };
                                  return { ...s, items };
                                })
                              }
                              className="h-9 px-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-[11px] text-gray-900 dark:text-neutral-100"
                            >
                              <option value="">None</option>
                              <option value="percent">% off line</option>
                              <option value="amount">$ off line</option>
                            </select>
                            <input
                              value={it.discount_value ?? ''}
                              onChange={(e) =>
                                setEditing((s) => {
                                  const items = [...(s.items || [])];
                                  items[idx] = { ...items[idx], discount_value: e.target.value };
                                  return { ...s, items };
                                })
                              }
                              className="flex-1 h-9 px-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-[11px] text-gray-900 dark:text-neutral-100 text-right"
                              inputMode="decimal"
                              placeholder="10"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold mb-1">
                            Link inventory
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setInvIndex(idx);
                              setInvQ(it.description || '');
                            }}
                            className="w-full h-9 px-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-[11px] text-gray-700 dark:text-neutral-200 text-left"
                          >
                            {it.inventory_item_id ? `Linked #${it.inventory_item_id}` : 'Search inventory…'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!editing.name.trim() || saving}
                onClick={saveJob}
                className="min-h-11 px-4 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save template'}
              </button>
              {editing.id && (
                <button
                  type="button"
                  onClick={() => setEditing(emptyJob)}
                  className="min-h-11 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
                >
                  Cancel edit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickJobsAdmin;

