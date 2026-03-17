import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../utils/api';

const fmtCents = (cents) => {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '—';
  return `$${(n / 100).toFixed(2)}`;
};

const Chip = ({ children }) => (
  <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-neutral-900 text-gray-700 dark:text-neutral-200 border border-gray-200 dark:border-neutral-800">
    {children}
  </span>
);

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'invoices';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const activeTab = useMemo(() => (['overview', 'vehicles', 'invoices', 'parts'].includes(tab) ? tab : 'invoices'), [tab]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/crm/customers/${encodeURIComponent(id)}/history`);
        if (cancelled) return;
        setData(res.data || null);
      } catch (e) {
        if (cancelled) return;
        setError(e.response?.data?.error || 'Failed to load customer');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  const customer = data?.customer;
  const vehicles = data?.vehicles || [];
  const invoices = data?.invoices || [];
  const parts = data?.parts || [];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate('/crm?tab=customers')}
            className="text-sm text-gray-500 dark:text-neutral-400 hover:text-primary"
          >
            ← Back to Customers
          </button>
          <h1 className="mt-2 text-xl md:text-2xl font-bold text-gray-900 dark:text-neutral-100 truncate">
            {customer?.display_name || 'Customer'}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {customer?.phone && <Chip>{customer.phone}</Chip>}
            {customer?.email && <Chip>{customer.email}</Chip>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {['overview', 'vehicles', 'invoices', 'parts'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSearchParams({ tab: t })}
              className={`min-h-12 px-4 rounded-xl text-sm font-semibold transition border ${
                activeTab === t
                  ? 'bg-primary-subtle dark:bg-primary/20 border-primary/30 text-primary dark:text-primary-light'
                  : 'bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-6 text-sm text-gray-500 dark:text-neutral-400">
          Loading…
        </div>
      ) : !data ? (
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-6 text-sm text-gray-500 dark:text-neutral-400">
          Not found.
        </div>
      ) : activeTab === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
            <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Summary</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500 dark:text-neutral-400">Vehicles</span>
                <span className="font-semibold text-gray-900 dark:text-neutral-100">{vehicles.length}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500 dark:text-neutral-400">Invoices</span>
                <span className="font-semibold text-gray-900 dark:text-neutral-100">{invoices.length}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500 dark:text-neutral-400">Distinct parts</span>
                <span className="font-semibold text-gray-900 dark:text-neutral-100">{parts.length}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
            <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Recent invoices</h2>
            {invoices.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-3">No invoices cached yet.</p>
            ) : (
              <div className="mt-3 divide-y divide-gray-100 dark:divide-neutral-800">
                {invoices.slice(0, 10).map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => navigate(`/crm/invoices/${i.id}`)}
                    className="w-full text-left py-3 hover:bg-gray-50 dark:hover:bg-neutral-900 rounded-xl px-3 -mx-3 transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-neutral-100 truncate">
                          {i.shopmonkey_order_number || i.shopmonkey_order_id}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">{i.invoice_date || '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-neutral-100">{fmtCents(i.total_cents)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'vehicles' ? (
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
          {vehicles.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 dark:text-neutral-400">No vehicles cached yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => navigate(`/crm/vehicles/${v.id}`)}
                  className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-neutral-900 transition"
                >
                  <p className="font-semibold text-gray-900 dark:text-neutral-100">
                    {[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                    {v.vin ? `VIN ${v.vin}` : v.license_plate ? `Plate ${v.license_plate}` : '—'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'parts' ? (
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
          {parts.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 dark:text-neutral-400">No parts cached yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-neutral-900">
                  <tr className="text-left text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Part</th>
                    <th className="py-3 px-4">Part #</th>
                    <th className="py-3 px-4 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {parts.map((p, idx) => (
                    <tr key={`${p.inventory_item_id || 'x'}-${idx}`}>
                      <td className="py-3 px-4 text-gray-900 dark:text-neutral-100">
                        {p.inventory_item_name || p.description || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-600 dark:text-neutral-300">{p.part_number || '—'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-neutral-100">{p.qty || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
          {invoices.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 dark:text-neutral-400">No invoices cached yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-neutral-900">
                  <tr className="text-left text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Order</th>
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
                      <td className="py-3 px-4 text-gray-500 dark:text-neutral-400">{i.invoice_date || '—'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-neutral-100">{fmtCents(i.total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerDetail;

