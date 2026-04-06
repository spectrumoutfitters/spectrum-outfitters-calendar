import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import AvatarInitials from '../components/ui/AvatarInitials';
import Chip from '../components/ui/Chip';

const fmtCents = (cents) => {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '—';
  return `$${(n / 100).toFixed(2)}`;
};

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const [vehOpen, setVehOpen] = useState(false);
  const [vehForm, setVehForm] = useState({
    year: '',
    make: '',
    model: '',
    vin: '',
    license_plate: '',
  });
  const [vehMsg, setVehMsg] = useState('');
  const [vehSaving, setVehSaving] = useState(false);

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

  const titleCase = (v) => {
    const s = (v || '').toString().trim();
    if (!s) return '';
    return s
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const initials = (customer?.display_name || '—')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <PageShell className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/crm?tab=customers')}
            className="mt-1 text-sm text-gray-500 dark:text-neutral-400 hover:text-primary"
          >
            ← Back
          </button>
          <div className="flex items-center gap-4 min-w-0">
            <AvatarInitials name={customer?.display_name} dimensionPx={64} />
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-neutral-100 truncate">
                {customer?.display_name || 'Customer'}
              </h1>
              <div className="mt-2 flex flex-wrap gap-2">
                {customer?.phone && <Chip>{customer.phone}</Chip>}
                {customer?.email && <Chip>{customer.email}</Chip>}
              </div>
            </div>
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
        <div className="space-y-4">
          {/* Profile */}
          <Card className="space-y-4">
            <h2 className="text-xs font-bold text-gray-600 dark:text-neutral-300 uppercase tracking-wider">Overview</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500 dark:text-neutral-400">Source</span>
                <span className="font-semibold text-gray-900 dark:text-neutral-100">
                  {customer?.source === 'native' ? 'Native' : 'ShopMonkey'}
                </span>
              </div>
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
            <p className="text-[11px] text-gray-500 dark:text-neutral-400">
              Photos are optional – we use initials either way.
            </p>
          </Card>

          {/* Vehicles */}
          <Card noPadding>
            <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-gray-600 dark:text-neutral-300 uppercase tracking-wider">
                Vehicles
              </h2>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setVehOpen((v) => !v);
                  setVehMsg('');
                }}
                className="min-h-9 px-3 rounded-lg text-xs"
              >
                {vehOpen ? 'Close' : 'Add vehicle'}
              </Button>
            </div>

            {vehOpen && (
              <div className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/40 p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                      Year
                    </label>
                    <input
                      value={vehForm.year}
                      onChange={(e) => setVehForm((s) => ({ ...s, year: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-neutral-100"
                      inputMode="numeric"
                      placeholder="2020"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                      Make
                    </label>
                    <input
                      value={vehForm.make}
                      onChange={(e) => setVehForm((s) => ({ ...s, make: e.target.value }))}
                      onBlur={(e) => setVehForm((s) => ({ ...s, make: titleCase(e.target.value) }))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-neutral-100"
                      placeholder="Toyota"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                      Model
                    </label>
                    <input
                      value={vehForm.model}
                      onChange={(e) => setVehForm((s) => ({ ...s, model: e.target.value }))}
                      onBlur={(e) => setVehForm((s) => ({ ...s, model: titleCase(e.target.value) }))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-neutral-100"
                      placeholder="Camry"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                      VIN
                    </label>
                    <input
                      value={vehForm.vin}
                      onChange={(e) => setVehForm((s) => ({ ...s, vin: e.target.value.toUpperCase() }))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-neutral-100 font-mono"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                      Plate
                    </label>
                    <input
                      value={vehForm.license_plate}
                      onChange={(e) => setVehForm((s) => ({ ...s, license_plate: e.target.value.toUpperCase() }))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-neutral-100 font-mono"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                {vehMsg && <p className="text-[11px] text-amber-700 dark:text-amber-300">{vehMsg}</p>}

                <Button
                  type="button"
                  disabled={vehSaving || (!vehForm.year && !vehForm.make && !vehForm.model)}
                  onClick={async () => {
                    setVehSaving(true);
                    setVehMsg('');
                    try {
                      const payload = {
                        year: vehForm.year || null,
                        make: vehForm.make || null,
                        model: vehForm.model || null,
                        vin: vehForm.vin || null,
                        license_plate: vehForm.license_plate || null,
                      };
                      await api.post(`/crm/customers/${encodeURIComponent(id)}/vehicles`, payload);
                      const res = await api.get(`/crm/customers/${encodeURIComponent(id)}/history`);
                      setData(res.data || null);
                      setVehForm({ year: '', make: '', model: '', vin: '', license_plate: '' });
                      setVehOpen(false);
                    } catch (e) {
                      const msg = e.response?.data?.error || e.message || 'Failed to add vehicle';
                      setVehMsg(msg);
                    } finally {
                      setVehSaving(false);
                    }
                  }}
                  className="min-h-10 rounded-lg text-xs"
                >
                  {vehSaving ? 'Saving…' : 'Save vehicle'}
                </Button>
              </div>
            )}

            {vehicles.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 dark:text-neutral-400">
                No vehicles yet. Add one to attach it to this customer.
              </div>
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
          </Card>

          {/* Recent invoices */}
          <Card noPadding>
            <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-600 dark:text-neutral-300 uppercase tracking-wider">
                Recent invoices
              </h2>
            </div>
            {invoices.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 dark:text-neutral-400">No invoices cached yet.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                {invoices.slice(0, 8).map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => navigate(`/crm/invoices/${i.id}`)}
                    className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-neutral-900 transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-neutral-100 truncate">
                          {i.invoice_number || i.shopmonkey_order_number || i.shopmonkey_order_id}
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

          {/* Parts */}
          <Card noPadding>
            <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-600 dark:text-neutral-300 uppercase tracking-wider">
                Parts used
              </h2>
            </div>
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
                    {parts.slice(0, 12).map((p, idx) => (
                      <tr key={`${p.inventory_item_id || 'x'}-${idx}`}>
                        <td className="py-3 px-4 text-gray-900 dark:text-neutral-100">{p.inventory_item_name || p.description || '—'}</td>
                        <td className="py-3 px-4 font-mono text-gray-600 dark:text-neutral-300">{p.part_number || '—'}</td>
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

export default CustomerDetail;

