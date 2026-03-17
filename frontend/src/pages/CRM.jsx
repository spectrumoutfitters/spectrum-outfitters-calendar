import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';

const fmtCents = (cents) => {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '—';
  return `$${(n / 100).toFixed(2)}`;
};

const TabButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`min-h-12 px-4 rounded-xl text-sm font-semibold transition border ${
      active
        ? 'bg-primary-subtle dark:bg-primary/20 border-primary/30 text-primary dark:text-primary-light'
        : 'bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800'
    }`}
  >
    {children}
  </button>
);

const CRM = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'customers';

  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState(null);

  // Manual sync (ShopMonkey order id)
  const [syncOrderId, setSyncOrderId] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

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

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-neutral-100">Customers & Invoices</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Cached from ShopMonkey so you can search history fast.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TabButton active={activeTab === 'customers'} onClick={() => setSearchParams({ tab: 'customers' })}>
            Customers
          </TabButton>
          <TabButton active={activeTab === 'invoices'} onClick={() => setSearchParams({ tab: 'invoices' })}>
            Invoices
          </TabButton>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Search
            </label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder={activeTab === 'customers' ? 'Name, phone, email…' : 'Order #, customer, VIN/plate…'}
            />
          </div>

          {activeTab === 'invoices' && (
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
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-500 dark:text-neutral-400">Loading…</div>
        ) : activeTab === 'customers' ? (
          customers.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 dark:text-neutral-400">No customers cached yet. Sync an order from the Invoices tab to start.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
              {customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(`/crm/customers/${c.id}`)}
                  className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-neutral-900 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-neutral-100 truncate">{c.display_name || '—'}</p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                        {c.phone || '—'} {c.email ? ` · ${c.email}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-neutral-500">Open →</span>
                  </div>
                </button>
              ))}
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
                      {i.shopmonkey_order_number || i.shopmonkey_order_id}
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
      </div>
    </div>
  );
};

export default CRM;

