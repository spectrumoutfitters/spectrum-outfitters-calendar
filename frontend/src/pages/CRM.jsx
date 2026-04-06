import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import AvatarInitials from '../components/ui/AvatarInitials';

const fmtCents = (cents) => {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '—';
  return `$${(n / 100).toFixed(2)}`;
};

const TabButton = ({ active, children, onClick }) => (
  <Button type="button" variant={active ? 'secondary' : 'ghost'} onClick={onClick} className="h-12 px-4 rounded-2xl">
    {children}
  </Button>
);

const CRM = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'customers';
  const { isAdmin } = useAuth();

  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState(null);

  // Manual sync (ShopMonkey order id) — admin only
  const [syncOrderId, setSyncOrderId] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Backfill (bulk ShopMonkey → CRM cache) — admin only
  const [backfillStart, setBackfillStart] = useState('2010-01-01');
  const [backfillEnd, setBackfillEnd] = useState(new Date().toISOString().slice(0, 10));
  const [backfillStarting, setBackfillStarting] = useState(false);
  const [backfillJob, setBackfillJob] = useState(null);
  const [backfillMsg, setBackfillMsg] = useState('');

  const activeTab = useMemo(() => (tab === 'invoices' ? 'invoices' : 'customers'), [tab]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (activeTab === 'customers') {
          const res = await api.get('/crm/customers', { params: { q: q.trim() || undefined } });
          if (cancelled) return;
          setCustomers(res.data?.customers || []);
        } else {
          const res = await api.get('/crm/invoices', { params: { q: q.trim() || undefined } });
          if (cancelled) return;
          setInvoices(res.data?.invoices || []);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e.response?.data?.error || 'Failed to load CRM data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activeTab, q]);

  const runSync = async () => {
    const orderId = syncOrderId.trim();
    if (!orderId) return;
    setSyncLoading(true);
    setSyncMsg('');
    try {
      await api.post(`/crm/sync/order/${encodeURIComponent(orderId)}`);
      setSyncMsg('Synced from ShopMonkey.');
      setSyncOrderId('');
      const res = await api.get('/crm/invoices', { params: { q: q.trim() || undefined } });
      setInvoices(res.data?.invoices || []);
    } catch (e) {
      setSyncMsg(e.response?.data?.error || 'Sync failed');
    } finally {
      setSyncLoading(false);
    }
  };

  useEffect(() => {
    if (!backfillJob?.id) return;
    if (!['queued', 'running'].includes(backfillJob.status)) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await api.get(`/crm/backfill/${backfillJob.id}`);
        if (cancelled) return;
        setBackfillJob(res.data?.job || null);
      } catch {
        // ignore
      }
    };
    const interval = setInterval(tick, 2000);
    tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [backfillJob?.id, backfillJob?.status]);

  return (
    <PageShell className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-neutral-100">Customers & Invoices</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Create invoices, take payments, and view customer history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TabButton active={activeTab === 'customers'} onClick={() => setSearchParams({ tab: 'customers' })}>
            Customers
          </TabButton>
          <TabButton active={activeTab === 'invoices'} onClick={() => setSearchParams({ tab: 'invoices' })}>
            Invoices
          </TabButton>
          {activeTab === 'invoices' && (
            <button
              type="button"
              onClick={() => navigate('/crm/invoices/new')}
              className="min-h-12 px-4 rounded-xl bg-primary text-white text-sm font-semibold"
            >
              New invoice
            </button>
          )}
        </div>
      </div>

      <Card noPadding className="p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 min-w-0">
            <Input
              label="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={activeTab === 'customers' ? 'Name, phone, email…' : 'Order #, customer, VIN/plate…'}
            />
          </div>

          {activeTab === 'invoices' && isAdmin && (
            <div className="md:w-[360px]">
              <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Sync ShopMonkey order
              </label>
              <div className="flex gap-2">
                <input
                  value={syncOrderId}
                  onChange={(e) => setSyncOrderId(e.target.value)}
                  className="flex-1 h-12 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Paste ShopMonkey order ID"
                />
                <button
                  type="button"
                  onClick={runSync}
                  disabled={!syncOrderId.trim() || syncLoading}
                  className="h-12 px-4 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
                >
                  {syncLoading ? '…' : 'Sync'}
                </button>
              </div>
              {syncMsg && (
                <p className={`text-xs mt-1 ${syncMsg.includes('Synced') ? 'text-green-600 dark:text-green-400' : 'text-amber-700 dark:text-amber-300'}`}>
                  {syncMsg}
                </p>
              )}
            </div>
          )}
        </div>

        {activeTab === 'invoices' && isAdmin && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-neutral-800">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Backfill ShopMonkey history</p>
                <p className="text-sm text-gray-600 dark:text-neutral-300 mt-1">
                  Pull all ShopMonkey invoices + customers + vehicles into the CRM cache (resumable).
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Start</label>
                  <input
                    type="date"
                    value={backfillStart}
                    onChange={(e) => setBackfillStart(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">End</label>
                  <input
                    type="date"
                    value={backfillEnd}
                    onChange={(e) => setBackfillEnd(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setBackfillStarting(true);
                    setBackfillMsg('');
                    try {
                      const res = await api.post('/crm/backfill/start', { start_date: backfillStart, end_date: backfillEnd, page_limit: 50 });
                      setBackfillJob(res.data?.job || null);
                      setBackfillMsg('Backfill started.');
                    } catch (e) {
                      setBackfillMsg(e.response?.data?.error || 'Failed to start backfill');
                    } finally {
                      setBackfillStarting(false);
                    }
                  }}
                  disabled={backfillStarting}
                  className="h-11 px-4 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
                >
                  {backfillStarting ? 'Starting…' : 'Start backfill'}
                </button>
                {backfillJob?.id && ['queued', 'running'].includes(backfillJob.status) && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.post(`/crm/backfill/${backfillJob.id}/cancel`);
                        const res = await api.get(`/crm/backfill/${backfillJob.id}`);
                        setBackfillJob(res.data?.job || null);
                      } catch {
                        // ignore
                      }
                    }}
                    className="h-11 px-4 rounded-xl border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {backfillMsg && (
              <p className={`text-xs mt-2 ${backfillMsg.includes('started') ? 'text-green-600 dark:text-green-400' : 'text-amber-700 dark:text-amber-300'}`}>
                {backfillMsg}
              </p>
            )}

            {backfillJob?.id && (
              <div className="mt-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-950 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
                    Backfill job #{backfillJob.id} · <span className="uppercase text-xs text-gray-500 dark:text-neutral-400">{backfillJob.status}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    Offset {backfillJob.offset || 0} · Page {backfillJob.page_limit || 50}
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-2">
                    <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">Processed</p>
                    <p className="font-bold text-gray-900 dark:text-neutral-100">{backfillJob.processed_count || 0}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-2">
                    <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">Synced</p>
                    <p className="font-bold text-gray-900 dark:text-neutral-100">{backfillJob.synced_count || 0}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-2">
                    <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">Skipped</p>
                    <p className="font-bold text-gray-900 dark:text-neutral-100">{backfillJob.skipped_count || 0}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-2">
                    <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">Errors</p>
                    <p className="font-bold text-gray-900 dark:text-neutral-100">{backfillJob.error_count || 0}</p>
                  </div>
                </div>
                {backfillJob.last_error && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300 truncate" title={backfillJob.last_error}>
                    Last error: {backfillJob.last_error}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <Card noPadding>
        {loading ? (
          <div className="p-6 text-sm text-gray-500 dark:text-neutral-400">Loading…</div>
        ) : activeTab === 'customers' ? (
          customers.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 dark:text-neutral-400">No customers cached yet. Sync an order from the Invoices tab to start.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-neutral-900/80">
                  <tr className="text-left text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Primary vehicle</th>
                    <th className="py-3 px-4 text-right">Invoices</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {customers.map((c) => {
                    const primaryVehicle =
                      [c.primary_vehicle_year, c.primary_vehicle_make, c.primary_vehicle_model].filter(Boolean).join(' ') ||
                      c.primary_plate ||
                      c.primary_vin ||
                      '—';
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-gray-50 dark:hover:bg-neutral-900 cursor-pointer"
                        onClick={() => navigate(`/crm/customers/${c.id}`)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <AvatarInitials name={c.display_name} dimensionPx={36} />
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-neutral-100 truncate">
                                {c.display_name || '—'}
                              </p>
                              <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                                {c.source === 'native' ? 'Native' : 'ShopMonkey'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="space-y-0.5 text-xs">
                            <p className="text-gray-900 dark:text-neutral-100">{c.phone || '—'}</p>
                            <p className="text-gray-500 dark:text-neutral-400 truncate max-w-[220px]">
                              {c.email || '—'}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-700 dark:text-neutral-200 align-top">
                          {primaryVehicle}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900 dark:text-neutral-100 font-semibold align-top">
                          {c.invoice_count ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : invoices.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 dark:text-neutral-400">No invoices cached yet. Sync a ShopMonkey order above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-900">
                <tr className="text-left text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {invoices.map((i) => (
                  <tr
                    key={i.id}
                    className="hover:bg-gray-50 dark:hover:bg-neutral-900 cursor-pointer"
                    onClick={() => navigate(`/crm/invoices/${i.id}`)}
                  >
                    <td className="py-3 px-4 font-semibold text-gray-900 dark:text-neutral-100">
                      {i.invoice_number || i.shopmonkey_order_number || i.shopmonkey_order_id || i.id}
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-neutral-200">{i.customer_name || '—'}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-neutral-200">
                      {[i.year, i.make, i.model].filter(Boolean).join(' ') || i.vin || i.license_plate || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-500 dark:text-neutral-400">{i.invoice_date || '—'}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-neutral-100">{fmtCents(i.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
};

export default CRM;

