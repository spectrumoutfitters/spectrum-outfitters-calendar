import React, { useEffect, useMemo, useState } from 'react';
import Logo from '../components/Logo';
import { getBookingConfig, getBookingSlots, submitBooking } from '../utils/publicBookingApi';

function formatTimeOnly(iso, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

/** Single readable line for confirmation + errors (duration shown once). */
function formatSelectedSlotSummary(iso, timeZone, slotMinutes) {
  try {
    const d = new Date(iso);
    const dateLine = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone
    }).format(d);
    const timeLine = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(d);
    return `${dateLine} at ${timeLine} · ${slotMinutes}-minute drop-off`;
  } catch {
    return iso;
  }
}

function groupSlots(slots, timeZone, slotMinutes) {
  const map = new Map();
  for (const s of slots || []) {
    const iso = s.slot_start_iso;
    try {
      const d = new Date(iso);
      const key = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone
      }).format(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(iso);
    } catch (_) {
      if (!map.has('_')) map.set('_', []);
      map.get('_').push(iso);
    }
  }
  const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([dayKey, isoList]) => {
    const first = isoList[0];
    const label =
      first && !Number.isNaN(Date.parse(first))
        ? new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone }).format(new Date(first))
        : dayKey === '_'
          ? 'Suggested times'
          : dayKey;
    const compactDay =
      first && !Number.isNaN(Date.parse(first))
        ? new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone }).format(new Date(first))
        : dayKey === '_'
          ? 'Open times'
          : dayKey;

    return { dayKey, label, compactDay, isoList };
  });
}

const emptyVehicle = () => ({ year: '', make: '', model: '', vin: '', plate: '' });

const CustomerBooking = () => {
  const [phase, setPhase] = useState('loading'); // loading | ready | submitting | done
  const [config, setConfig] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [donePayload, setDonePayload] = useState(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [vehicles, setVehicles] = useState([emptyVehicle()]);
  const [notes, setNotes] = useState('');
  const [selectedServices, setSelectedServices] = useState(() => new Set());
  const [slotStartIso, setSlotStartIso] = useState('');
  /** Which calendar day’s times are visible (yyyy-mm-dd in shop TZ). */
  const [activeDayKey, setActiveDayKey] = useState('');
  const [websiteHoneypot, setWebsiteHoneypot] = useState(''); // bots fill this

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPhase('loading');
      setLoadError('');
      try {
        const cfgRes = await getBookingConfig();
        if (cancelled) return;
        const cfg = cfgRes.data;
        setConfig(cfg);
        if (cfg.enabled) {
          const slotsRes = await getBookingSlots();
          if (cancelled) return;
          setSlots(slotsRes.data?.slots || []);
        } else {
          setSlots([]);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e?.response?.data?.error || e?.message || 'Could not load booking.');
        }
      } finally {
        if (!cancelled) setPhase('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const slotGroups = useMemo(
    () => groupSlots(slots, config?.timezone || 'America/Chicago', config?.slot_minutes || 30),
    [slots, config]
  );

  const tz = config?.timezone || 'America/Chicago';
  const slotMinutes = config?.slot_minutes || 30;

  useEffect(() => {
    if (!slotGroups.length) return;
    const stillValid = slotGroups.some((g) => g.dayKey === activeDayKey);
    if (!activeDayKey || !stillValid) {
      setActiveDayKey(slotGroups[0].dayKey);
    }
  }, [slotGroups, activeDayKey]);

  const activeGroup = useMemo(
    () => slotGroups.find((g) => g.dayKey === activeDayKey) || slotGroups[0] || null,
    [slotGroups, activeDayKey]
  );

  const pickDayAndMaybeClearSlot = (dayKey) => {
    const g = slotGroups.find((x) => x.dayKey === dayKey);
    setActiveDayKey(dayKey);
    setSlotStartIso((prev) => (g?.isoList?.includes(prev) ? prev : ''));
  };

  const toggleSvc = (id) => {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateVehicle = (idx, patch) => {
    setVehicles((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addVehicle = () => setVehicles((prev) => (prev.length < 10 ? [...prev, emptyVehicle()] : prev));
  const removeVehicle = (idx) => setVehicles((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const validate = () => {
    if (!customerName.trim() || customerName.trim().length < 2) return 'Please enter your full name.';
    const digits = customerPhone.replace(/\D/g, '');
    if (digits.length < 7) return 'Please enter a valid phone number.';
    if (!slotStartIso) return 'Pick a drop-off time.';
    if (!config?.enabled) return 'Booking is not available.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const vMsg = validate();
    if (vMsg) {
      setSubmitError(vMsg);
      return;
    }

    setPhase('submitting');
    try {
      const res = await submitBooking({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail.trim() || undefined,
        vehicles: vehicles.map(({ year, make, model, vin, plate }) => ({
          year: year.trim(),
          make: make.trim(),
          model: model.trim(),
          vin: vin.trim(),
          plate: plate.trim()
        })),
        selected_service_ids: [...selectedServices],
        notes,
        slot_start_iso: slotStartIso,
        company_website: websiteHoneypot
      });

      setDonePayload(res.data);
      setPhase('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg =
        err?.response?.data?.error || err?.message || 'Booking failed — please try again or call us.';
      setSubmitError(msg);
      setPhase('ready');
    }
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
        <Logo size="lg" className="mb-6" />
        <div className="text-neutral-600 dark:text-neutral-400">Loading scheduler…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 pb-24">
      <header className="sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur px-4 py-4 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Logo size="md" />
          <div>
            <h1 className="text-lg font-bold leading-tight">Schedule a vehicle drop-off</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Spectrum Outfitters</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm">
            {loadError}
          </div>
        )}

        {phase === 'done' && (
          <section className="rounded-2xl border border-green-300 dark:border-green-800 bg-green-50/80 dark:bg-green-950/30 p-5 space-y-2">
            <h2 className="text-xl font-semibold text-green-900 dark:text-green-100">You&apos;re booked</h2>
            <p className="text-sm text-neutral-700 dark:text-neutral-200">{donePayload?.confirmation_message}</p>
            {donePayload?.email_notify_sent === false && (
              <p className="text-xs text-amber-800 dark:text-amber-200 rounded-lg bg-amber-100 dark:bg-amber-900/40 px-2 py-1">
                Calendar event was saved. Staff email could not send:{' '}
                <span className="font-medium">{donePayload?.email_notify_error || 'unknown error'}.</span> We still have your
                request.
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 w-full rounded-xl py-3 text-sm font-medium text-white shadow"
              style={{ backgroundColor: '#D4A017' }}
            >
              Book another appointment
            </button>
          </section>
        )}

        {config && !config.enabled && phase !== 'done' && (
          <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold mb-2">Booking is unavailable online</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              Our scheduler is paused or waiting for calendar connection. Call the shop anytime and we&apos;ll get you sorted.
            </p>
          </section>
        )}

        {config?.enabled && phase !== 'done' && (
          <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm space-y-3">
            <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">{config.intro_text}</p>
            <p className="text-xs text-neutral-500">Timezone: {tz}</p>
          </section>
        )}

        {config?.enabled && phase !== 'done' && (
          <form className="space-y-8" onSubmit={handleSubmit}>
            <input type="text" tabIndex="-1" autoComplete="off" className="hidden" aria-hidden value={websiteHoneypot} onChange={(e) => setWebsiteHoneypot(e.target.value)} />

            {/* Contact */}
            <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-3 shadow-sm">
              <h2 className="text-base font-semibold">About you</h2>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">Name</label>
              <input
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-[#D4A017]/35"
              />
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wide mt-2">Mobile phone</label>
              <input
                required
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-[#D4A017]/35"
              />
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wide mt-2">Email (optional)</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-[#D4A017]/35"
              />
            </section>

            {/* Vehicles */}
            <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Vehicle(s)</h2>
                <button type="button" onClick={addVehicle} className="text-xs font-medium px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition">
                  + Another vehicle
                </button>
              </div>
              {vehicles.map((v, i) => (
                <div key={i} className="border border-neutral-100 dark:border-neutral-800 rounded-xl p-4 space-y-2 relative">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="Year"
                      value={v.year}
                      onChange={(e) => updateVehicle(i, { year: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeVehicle(i)}
                      className={`text-xs text-red-600 dark:text-red-400 underline ${vehicles.length <= 1 ? 'invisible pointer-events-none' : ''}`}
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    placeholder="Make"
                    value={v.make}
                    onChange={(e) => updateVehicle(i, { make: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm"
                  />
                  <input
                    placeholder="Model"
                    value={v.model}
                    onChange={(e) => updateVehicle(i, { model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="VIN (optional)"
                      value={v.vin}
                      onChange={(e) => updateVehicle(i, { vin: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm"
                    />
                    <input
                      placeholder="Plate (optional)"
                      value={v.plate}
                      onChange={(e) => updateVehicle(i, { plate: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm"
                    />
                  </div>
                </div>
              ))}
            </section>

            {/* Services */}
            <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-3 shadow-sm">
              <h2 className="text-base font-semibold">Requested work</h2>
              <p className="text-xs text-neutral-500">Tap any that apply. Add details below.</p>
              <div className="flex flex-wrap gap-2">
                {(config.services_checklist || []).map((item) => {
                  const checked = selectedServices.has(item.id);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => toggleSvc(item.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition border ${checked ? 'text-white border-[#D4A017]' : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950'}`}
                      style={checked ? { backgroundColor: '#D4A017' } : {}}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wide mt-2">Anything else?</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Diagnostics, aftermarket parts, window tint..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-[#D4A017]/35 text-sm resize-y min-h-[100px]"
              />
            </section>

            {/* Time — date first, then times (reduces overwhelm) */}
            <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Drop-off time</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-snug">
                  Choose a day, then a start time. Each visit is booked as a{' '}
                  <span className="text-neutral-700 dark:text-neutral-300 font-medium">{slotMinutes}-minute</span> drop-off slot.
                </p>
              </div>
              {!slots?.length ? (
                <p className="text-sm text-amber-800 dark:text-amber-100 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-800">
                  No openings right now. Please call the shop—we still want to help.
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">Day</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
                      {slotGroups.map((g) => {
                        const on = activeDayKey === g.dayKey;
                        return (
                          <button
                            key={g.dayKey}
                            type="button"
                            onClick={() => pickDayAndMaybeClearSlot(g.dayKey)}
                            className={`shrink-0 snap-start rounded-xl border px-3 py-2.5 text-center min-w-[5.75rem] transition ${
                              on
                                ? 'border-[#D4A017] bg-[#D4A017]/15 dark:bg-[#D4A017]/25 ring-1 ring-[#D4A017]/35'
                                : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 bg-neutral-50/80 dark:bg-neutral-950/80'
                            }`}
                          >
                            <span className="block text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
                              {g.compactDay}
                            </span>
                            <span className="block text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                              {g.isoList.length} open
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {activeGroup ? (
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Time</p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate max-w-[60%]" title={activeGroup.label}>
                          {activeGroup.label}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {activeGroup.isoList.map((iso) => {
                          const selected = slotStartIso === iso;
                          return (
                            <button
                              key={iso}
                              type="button"
                              onClick={() => setSlotStartIso(iso)}
                              className={`rounded-xl py-2.5 px-1 text-sm font-medium tabular-nums transition border ${
                                selected
                                  ? 'text-white border-[#D4A017] shadow-sm'
                                  : 'border-neutral-200 dark:border-neutral-700 hover:border-[#D4A017]/55 text-neutral-800 dark:text-neutral-100 bg-neutral-50/50 dark:bg-neutral-950'
                              }`}
                              style={selected ? { backgroundColor: '#D4A017' } : {}}
                            >
                              {formatTimeOnly(iso, tz)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {slotStartIso ? (
                    <div className="rounded-xl border border-[#D4A017]/35 bg-[#D4A017]/08 dark:bg-[#D4A017]/15 px-4 py-3 text-sm text-neutral-800 dark:text-neutral-200">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium uppercase text-[11px] tracking-wide mr-2">
                        Your slot
                      </span>
                      {formatSelectedSlotSummary(slotStartIso, tz, slotMinutes)}
                    </div>
                  ) : slots?.length ? (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Tap a time to continue. Scroll horizontally if there are multiple days available.
                    </p>
                  ) : null}
                </>
              )}
            </section>

            {submitError && (
              <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-100">{submitError}</div>
            )}

            <button
              type="submit"
              disabled={phase === 'submitting' || !slots?.length || !slotStartIso}
              className="w-full rounded-2xl py-4 text-white font-semibold tracking-wide shadow-lg disabled:opacity-50 disabled:pointer-events-none"
              style={{ backgroundColor: '#D4A017' }}
            >
              {phase === 'submitting' ? 'Booking…' : 'Confirm my drop-off'}
            </button>

            <p className="text-xs text-neutral-500 text-center">By booking you acknowledge we might follow up before your arrival.</p>
          </form>
        )}
      </main>
    </div>
  );
};

export default CustomerBooking;
