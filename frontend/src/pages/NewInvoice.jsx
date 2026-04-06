import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

function titleCase(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function digitsOnly(s) {
  return String(s || '').replace(/\D+/g, '');
}

function formatPhoneUS(s) {
  const d = digitsOnly(s);
  if (d.length < 7) return String(s || '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith('1')) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return String(s || '');
}

function vehicleLabel(v) {
  const label = [v?.year, v?.make, v?.model].filter(Boolean).join(' ');
  return label || v?.vin || v?.license_plate || '—';
}

function errorToMessage(e) {
  if (!e) return 'Something went wrong';
  if (e.isNetworkError) return e.message || 'Cannot connect to server';
  const status = e.response?.status;
  const msg = e.response?.data?.error || e.message || 'Request failed';
  return status ? `${msg} (HTTP ${status})` : msg;
}

const NewInvoice = () => {
  const navigate = useNavigate();

  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ display_name: '', phone: '', email: '' });
  const [newCustomerSaving, setNewCustomerSaving] = useState(false);
  const [newCustomerMsg, setNewCustomerMsg] = useState('');

  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleQ, setVehicleQ] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState(''); // crm_vehicles.id

  const [newVehicleOpen, setNewVehicleOpen] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ year: '', make: '', model: '', vin: '', license_plate: '' });
  const [newVehicleSaving, setNewVehicleSaving] = useState(false);
  const [newVehicleMsg, setNewVehicleMsg] = useState('');

  const [invoiceCreating, setInvoiceCreating] = useState(false);
  const [invoiceMsg, setInvoiceMsg] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setCustomersLoading(true);
      try {
        const res = await api.get('/crm/customers', { params: { q: qDebounced || undefined, limit: 12 } });
        if (!cancelled) setCustomers(res.data?.customers || []);
      } catch (e) {
        if (!cancelled) setCustomers([]);
      } finally {
        if (!cancelled) setCustomersLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [qDebounced]);

  useEffect(() => {
    if (!selectedCustomer?.id) {
      setVehicles([]);
      setVehicleQ('');
      setSelectedVehicleId('');
      return;
    }
    let cancelled = false;
    const load = async () => {
      setVehiclesLoading(true);
      try {
        const res = await api.get(`/crm/customers/${selectedCustomer.id}/vehicles`);
        if (!cancelled) setVehicles(res.data?.vehicles || []);
      } catch (e) {
        if (!cancelled) setVehicles([]);
      } finally {
        if (!cancelled) setVehiclesLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedCustomer?.id]);

  const filteredVehicles = useMemo(() => {
    const t = vehicleQ.trim().toLowerCase();
    if (!t) return vehicles || [];
    return (vehicles || []).filter((v) => {
      const hay = [vehicleLabel(v), v?.vin, v?.license_plate].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(t);
    });
  }, [vehicles, vehicleQ]);

  const canCreateInvoice = useMemo(() => !!selectedCustomer?.id, [selectedCustomer?.id]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-gray-500 dark:text-neutral-400 hover:text-primary"
          >
            ← Back
          </button>
          <h1 className="mt-2 text-xl md:text-2xl font-bold text-gray-900 dark:text-neutral-100">New invoice</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Search customer + vehicle, then create an invoice in seconds.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Customer</h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">Search by name, phone, or email.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewCustomerOpen((v) => !v);
                  setNewCustomerMsg('');
                  if (!newCustomerOpen) setNewCustomer((s) => ({ ...s, display_name: s.display_name || qDebounced }));
                }}
                className="min-h-11 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-gray-800 dark:text-neutral-200 font-semibold hover:bg-gray-50 dark:hover:bg-neutral-900"
              >
                {newCustomerOpen ? 'Close' : 'New customer'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary/20 focus:border-primary md:col-span-2"
                placeholder="Type to search…"
              />

              {customersLoading ? (
                <div className="md:col-span-2 text-sm text-gray-500 dark:text-neutral-400">Searching…</div>
              ) : customers.length === 0 ? (
                <div className="md:col-span-2 text-sm text-gray-500 dark:text-neutral-400">No matches.</div>
              ) : (
                <div className="md:col-span-2 divide-y divide-gray-100 dark:divide-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setInvoiceMsg('');
                        setSelectedVehicleId('');
                        setVehicleQ('');
                      }}
                      className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-neutral-900 transition ${
                        selectedCustomer?.id === c.id ? 'bg-primary-subtle dark:bg-primary/15' : 'bg-white dark:bg-neutral-950'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-neutral-100 truncate">{c.display_name || '—'}</p>
                          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 truncate">
                            {c.phone || '—'} {c.email ? ` · ${c.email}` : ''}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-neutral-500">Select</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedCustomer?.id ? (
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 p-3">
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">Selected customer</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100 mt-1">{selectedCustomer.display_name || '—'}</p>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                  {selectedCustomer.phone || '—'} {selectedCustomer.email ? ` · ${selectedCustomer.email}` : ''}
                </p>
              </div>
            ) : null}

            {newCustomerOpen && (
              <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 p-4">
                <p className="text-xs font-bold text-gray-700 dark:text-neutral-200 uppercase tracking-wider">Create customer</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Name</label>
                    <input
                      value={newCustomer.display_name}
                      onChange={(e) => setNewCustomer((s) => ({ ...s, display_name: e.target.value }))}
                      onBlur={() => setNewCustomer((s) => ({ ...s, display_name: titleCase(s.display_name) }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                      placeholder="Customer name"
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Phone</label>
                    <input
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer((s) => ({ ...s, phone: e.target.value }))}
                      onBlur={() => setNewCustomer((s) => ({ ...s, phone: formatPhoneUS(s.phone) }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                      placeholder="(555) 555-5555"
                      autoComplete="tel"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Email</label>
                    <input
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer((s) => ({ ...s, email: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                      placeholder="name@email.com"
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={async () => {
                      setNewCustomerSaving(true);
                      setNewCustomerMsg('');
                      try {
                        const payload = {
                          display_name: titleCase(newCustomer.display_name),
                          phone: newCustomer.phone ? formatPhoneUS(newCustomer.phone) : '',
                          email: newCustomer.email || '',
                        };
                        const res = await api.post('/crm/customers', payload);
                        const c = res.data?.customer;
                        if (c?.id) {
                          setSelectedCustomer(c);
                          setNewCustomer({ display_name: '', phone: '', email: '' });
                          setNewCustomerOpen(false);
                          setQ('');
                        }
                      } catch (e) {
                        setNewCustomerMsg(errorToMessage(e));
                      } finally {
                        setNewCustomerSaving(false);
                      }
                    }}
                    disabled={!newCustomer.display_name.trim() || newCustomerSaving}
                    className="min-h-12 px-4 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
                  >
                    {newCustomerSaving ? 'Saving…' : 'Create customer'}
                  </button>
                  {newCustomerMsg && <p className="text-sm text-amber-700 dark:text-amber-300">{newCustomerMsg}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Vehicle</h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">Optional, but recommended for history.</p>
              </div>
              <button
                type="button"
                disabled={!selectedCustomer?.id}
                onClick={() => {
                  setNewVehicleOpen((v) => !v);
                  setNewVehicleMsg('');
                }}
                className="min-h-11 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-gray-800 dark:text-neutral-200 font-semibold hover:bg-gray-50 dark:hover:bg-neutral-900 disabled:opacity-50"
              >
                {newVehicleOpen ? 'Close' : 'New vehicle'}
              </button>
            </div>

            {!selectedCustomer?.id ? (
              <p className="text-sm text-gray-500 dark:text-neutral-400">Select a customer first.</p>
            ) : (
              <>
                <input
                  value={vehicleQ}
                  onChange={(e) => setVehicleQ(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder={vehiclesLoading ? 'Loading vehicles…' : 'Search vehicle (year/make/model, VIN, plate)…'}
                  disabled={vehiclesLoading}
                />
                {vehiclesLoading ? (
                  <p className="text-sm text-gray-500 dark:text-neutral-400">Loading…</p>
                ) : filteredVehicles.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-neutral-400">No vehicles found.</p>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
                    {filteredVehicles.slice(0, 8).map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSelectedVehicleId(String(v.id));
                          setInvoiceMsg('');
                        }}
                        className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-neutral-900 transition ${
                          String(v.id) === String(selectedVehicleId) ? 'bg-primary-subtle dark:bg-primary/15' : 'bg-white dark:bg-neutral-950'
                        }`}
                      >
                        <p className="font-semibold text-gray-900 dark:text-neutral-100 truncate">{vehicleLabel(v)}</p>
                        <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 truncate">
                          {v.vin ? `VIN ${String(v.vin).toUpperCase()}` : '—'} {v.license_plate ? ` · Plate ${String(v.license_plate).toUpperCase()}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {newVehicleOpen && selectedCustomer?.id && (
              <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 p-4">
                <p className="text-xs font-bold text-gray-700 dark:text-neutral-200 uppercase tracking-wider">Create vehicle</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Year</label>
                    <input
                      value={newVehicle.year}
                      onChange={(e) => setNewVehicle((s) => ({ ...s, year: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                      placeholder="2015"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Make</label>
                    <input
                      value={newVehicle.make}
                      onChange={(e) => setNewVehicle((s) => ({ ...s, make: e.target.value }))}
                      onBlur={() => setNewVehicle((s) => ({ ...s, make: titleCase(s.make) }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                      placeholder="Ford"
                      autoComplete="off"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Model</label>
                    <input
                      value={newVehicle.model}
                      onChange={(e) => setNewVehicle((s) => ({ ...s, model: e.target.value }))}
                      onBlur={() => setNewVehicle((s) => ({ ...s, model: titleCase(s.model) }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                      placeholder="F-150"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Plate</label>
                    <input
                      value={newVehicle.license_plate}
                      onChange={(e) => setNewVehicle((s) => ({ ...s, license_plate: e.target.value.toUpperCase() }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                      placeholder="ABC123"
                      autoComplete="off"
                    />
                  </div>
                  <div className="md:col-span-5">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">VIN</label>
                    <input
                      value={newVehicle.vin}
                      onChange={(e) => setNewVehicle((s) => ({ ...s, vin: e.target.value.toUpperCase() }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                      placeholder="VIN (optional)"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={async () => {
                      setNewVehicleSaving(true);
                      setNewVehicleMsg('');
                      try {
                        const payload = {
                          year: newVehicle.year,
                          make: titleCase(newVehicle.make),
                          model: titleCase(newVehicle.model),
                          vin: newVehicle.vin ? String(newVehicle.vin).toUpperCase() : '',
                          license_plate: newVehicle.license_plate ? String(newVehicle.license_plate).toUpperCase() : '',
                        };
                        const res = await api.post(`/crm/customers/${selectedCustomer.id}/vehicles`, payload);
                        const v = res.data?.vehicle;
                        if (v?.id) {
                          setSelectedVehicleId(String(v.id));
                          setNewVehicle({ year: '', make: '', model: '', vin: '', license_plate: '' });
                          setNewVehicleOpen(false);
                          const list = await api.get(`/crm/customers/${selectedCustomer.id}/vehicles`);
                          setVehicles(list.data?.vehicles || []);
                        }
                      } catch (e) {
                        setNewVehicleMsg(errorToMessage(e));
                      } finally {
                        setNewVehicleSaving(false);
                      }
                    }}
                    disabled={newVehicleSaving}
                    className="min-h-12 px-4 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
                  >
                    {newVehicleSaving ? 'Saving…' : 'Create vehicle'}
                  </button>
                  {newVehicleMsg && <p className="text-sm text-amber-700 dark:text-amber-300">{newVehicleMsg}</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-2xl p-4 lg:sticky lg:top-6">
            <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Create</h2>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 p-3">
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">Customer</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100 mt-1">{selectedCustomer?.display_name || '—'}</p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 p-3">
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">Vehicle</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100 mt-1">
                  {selectedVehicleId ? `Selected (#${selectedVehicleId})` : 'None'}
                </p>
              </div>

              <button
                type="button"
                disabled={!canCreateInvoice || invoiceCreating}
                onClick={async () => {
                  setInvoiceCreating(true);
                  setInvoiceMsg('');
                  try {
                    const payload = {
                      crm_customer_id: selectedCustomer.id,
                      crm_vehicle_id: selectedVehicleId ? Number(selectedVehicleId) : undefined,
                    };
                    const res = await api.post('/crm/invoices', payload);
                    const inv = res.data?.invoice;
                    if (inv?.id) navigate(`/crm/invoices/${inv.id}?add=1`);
                    else setInvoiceMsg('Created invoice, but missing id.');
                  } catch (e) {
                    setInvoiceMsg(errorToMessage(e));
                  } finally {
                    setInvoiceCreating(false);
                  }
                }}
                className="w-full min-h-12 px-5 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
              >
                {invoiceCreating ? 'Creating…' : 'Create invoice'}
              </button>

              {invoiceMsg && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
                  {invoiceMsg}
                </div>
              )}

              <p className="text-xs text-gray-500 dark:text-neutral-400">
                After creation, you’ll land on the invoice with “Add item” open.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewInvoice;

