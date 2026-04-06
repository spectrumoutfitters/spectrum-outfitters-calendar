import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import AvatarInitials from '../components/ui/AvatarInitials';

const fmtCents = (cents) => {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '—';
  return `$${(n / 100).toFixed(2)}`;
};

const VehicleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/crm/vehicles/${encodeURIComponent(id)}/history`);
        if (cancelled) return;
        setData(res.data || null);
      } catch (e) {
        if (cancelled) return;
        setError(e.response?.data?.error || 'Failed to load vehicle');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  const vehicle = data?.vehicle;
  const invoices = data?.invoices || [];
  const parts = data?.parts || [];
  const title = vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') : 'Vehicle';

  return (
    <PageShell className="py-6">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-1 text-sm text-gray-500 dark:text-neutral-400 hover:text-primary"
        >
          ← Back
        </button>
        <div className="flex items-center gap-4">
          <AvatarInitials name={title} dimensionPx={56} />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-neutral-100">{title || 'Vehicle'}</h1>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
              {vehicle?.vin ? `VIN ${vehicle.vin}` : vehicle?.license_plate ? `Plate ${vehicle.license_plate}` : ''}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="p-6">
          <div className="text-sm text-gray-500 dark:text-neutral-400">Loading…</div>
        </Card>
      ) : !data ? (
        <Card className="p-6">
          <div className="text-sm text-gray-500 dark:text-neutral-400">Not found.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card noPadding>
            <div className="p-4 border-b border-gray-100 dark:border-neutral-800">
              <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Invoices</h2>
            </div>
            {invoices.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 dark:text-neutral-400">No invoices cached yet.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                {invoices.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => navigate(`/crm/invoices/${i.id}`)}
                    className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-neutral-900 transition"
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
          </Card>

          <Card noPadding>
            <div className="p-4 border-b border-gray-100 dark:border-neutral-800">
              <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Parts (qty)</h2>
            </div>
            {parts.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 dark:text-neutral-400">No parts cached yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-neutral-900">
                    <tr className="text-left text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Part</th>
                      <th className="py-3 px-4 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {parts.map((p, idx) => (
                      <tr key={`${p.inventory_item_id || 'x'}-${idx}`}>
                        <td className="py-3 px-4 text-gray-900 dark:text-neutral-100">{p.inventory_item_name || p.description || '—'}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-neutral-100">{p.qty || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </PageShell>
  );
};

export default VehicleDetail;

