import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { withBase } from '../../utils/basePath';
import {
  hydrateWeekly,
  uniqCalendarIdsArray,
  weeklyFromForms,
} from '../../utils/bookingWeeklyHours';

const GOLD = '#D4A017';

const TZ_PRESETS = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles'
];

export default function BookingSettings() {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [snap, setSnap] = useState(null);
  const [calendars, setCalendars] = useState([]);
  const [message, setMessage] = useState(null);

  const [enabled, setEnabled] = useState(false);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [horizonDays, setHorizonDays] = useState(21);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [introText, setIntroText] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [writeCalendarId, setWriteCalendarId] = useState('');
  const [notifyEmailsText, setNotifyEmailsText] = useState('');
  const [weekForm, setWeekForm] = useState(() => hydrateWeekly(null));
  const [services, setServices] = useState([]);
  const [selectedAvailIds, setSelectedAvailIds] = useState(() => new Set());

  const bookingUrl = useMemo(() => `${window.location.origin}${withBase('/book')}`, []);

  const loadAll = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [cfgRes, gStatus] = await Promise.all([
        api.get('/admin/booking/settings'),
        api.get('/google-calendar/status').catch(() => null)
      ]);

      const s = cfgRes.data;
      setSnap(s);

      setEnabled(!!s.enabled);
      setTimezone(s.timezone || 'America/Chicago');
      setSlotMinutes(Math.min(480, Math.max(15, s.slotMinutes ?? 30)));
      setHorizonDays(Math.min(60, Math.max(1, s.horizonDays ?? 21)));
      setBufferMinutes(Math.min(120, Math.max(0, s.bufferBeforeMinutes ?? 0)));
      setIntroText(s.intro_text || '');
      setSuccessMessage(s.success_message || '');
      setWriteCalendarId(s.write_calendar_id || '');
      setNotifyEmailsText((s.notify_emails || []).join('\n'));
      setWeekForm(hydrateWeekly(s.weekly_hours || {}));

      let checklist = [...(s.services_checklist || [])];
      if (!checklist.length) {
        checklist = [
          { id: 'oil_change', label: 'Oil change' },
          { id: 'other', label: 'Other (describe in notes)' }
        ];
      }
      setServices(checklist);

      const avail = s.availability_calendar_ids || [];
      setSelectedAvailIds(new Set(avail));

      const gConnected = gStatus?.data?.connected === true;
      if (gConnected) {
        try {
          const cals = await api.get('/google-calendar/calendars');
          setCalendars(cals.data?.calendars || []);
        } catch {
          setCalendars([]);
        }
      } else setCalendars([]);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to load booking settings'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const toggleAvailId = (id) => {
    setSelectedAvailIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const save = async () => {
    setWorking(true);
    setMessage(null);
    try {
      const availArr = uniqCalendarIdsArray([...selectedAvailIds]);
      const patch = {
        booking_enabled: enabled,
        booking_timezone: timezone.trim(),
        booking_slot_minutes: slotMinutes,
        booking_horizon_days: horizonDays,
        booking_buffer_before_minutes: bufferMinutes,
        booking_weekly_hours: weeklyFromForms(weekForm),
        booking_services_checklist: services.map((svc, idx) => ({
          id: svc.id?.trim() || `svc_${idx}`,
          label: svc.label.trim()
        })),
        booking_write_calendar_id: writeCalendarId.trim(),
        booking_availability_calendar_ids: availArr.length ? availArr : []
      };

      // Parse emails from textarea
      const lines = notifyEmailsText
        .split(/[\s,;\n]+/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);

      patch.booking_notify_emails = lines;
      patch.booking_intro_text = introText;
      patch.booking_success_message = successMessage;

      await api.patch('/admin/booking/settings', patch);
      setMessage({ type: 'success', text: 'Saved booking settings.' });
      await loadAll();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message || 'Save failed' });
    } finally {
      setWorking(false);
    }
  };

  const testEmail = async () => {
    setWorking(true);
    setMessage(null);
    try {
      const lines = notifyEmailsText
        .split(/[\s,;\n]+/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
      const payload = {};
      if (lines[0]) payload.to = lines[0];

      await api.post('/admin/booking/test-email', payload);
      setMessage({ type: 'success', text: `Test email dispatched to ${lines[0] || 'first notify address'}.` });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message || 'Could not send test email' });
    } finally {
      setWorking(false);
    }
  };

  const addServiceRow = () => setServices((prev) => [...prev, { id: '', label: '' }]);

  const updateService = (idx, field, val) => {
    setServices((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], [field]: val };
      return n;
    });
  };

  const removeService = (idx) => setServices((prev) => prev.filter((_, i) => i !== idx));

  if (loading) {
    return (
      <div className="flex items-center py-16 text-neutral-600 dark:text-neutral-300">
        Loading booking configuration…
      </div>
    );
  }

  const googleOk = !!snap?.google_connected;
  const gmailOk = !!snap?.gmail_send_allowed;

  return (
    <div className="max-w-4xl space-y-6 pt-4">
      {!googleOk && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          Connect Google Calendar in <strong className="font-semibold">Settings → Schedule / Google Calendar</strong> before
          customers can book.
        </div>
      )}

      {googleOk && !gmailOk && (
        <div className="rounded-xl border border-orange-400 bg-orange-50 dark:bg-orange-950/30 px-4 py-3 text-sm text-orange-950 dark:text-orange-100">
          Google is connected, but outbound booking mail isn’t fully authorized. Open <strong className="font-semibold">Settings → Schedule / Google Calendar</strong>,
          disconnect, then reconnect and accept prompts for Calendar, Gmail send, and your Google account email (needed for the “From:” address on staff notices).
        </div>
      )}

      {message?.text && (
        <div
          className={`rounded-xl px-4 py-2 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-100' : 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-100'}`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Shareable customer link</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Salespeople can paste this URL into SMS or email:</p>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch">
          <code className="flex-1 text-xs bg-neutral-100 dark:bg-neutral-900 rounded-xl px-3 py-3 break-all text-neutral-800 dark:text-neutral-200">
            {bookingUrl}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(bookingUrl)}
            className="rounded-xl px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: GOLD }}
          >
            Copy link
          </button>
        </div>
        <label className="flex items-start gap-2 text-sm mt-4">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Allow public booking requests (customers see the scheduler when checked and Google is healthy)
        </label>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-4">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Schedule rules</h3>
          <div>
            <label className="text-xs uppercase text-neutral-500 font-semibold tracking-wide">Timezone</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 bg-white dark:bg-neutral-900 dark:border-neutral-700">
              {TZ_PRESETS.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="IANA TZ e.g. America/Detroit" className="mt-2 w-full rounded-xl border px-3 py-2 bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-700 text-xs" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs uppercase text-neutral-500 font-semibold tracking-wide block">Slots</label>
              <select value={slotMinutes} onChange={(e) => setSlotMinutes(parseInt(e.target.value, 10))} className="mt-1 w-full rounded-xl border px-2 py-2 bg-white dark:bg-neutral-900 dark:border-neutral-700 text-sm">
                {[15, 30, 45, 60].map((n) => (
                  <option key={n} value={n}>{n} min</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs uppercase text-neutral-500 font-semibold tracking-wide block">Ahead (days)</label>
              <input type="number" min={1} max={60} value={horizonDays} onChange={(e) => setHorizonDays(parseInt(e.target.value || '1', 10))} className="mt-1 w-full rounded-xl border px-3 py-2 bg-white dark:bg-neutral-900 dark:border-neutral-700" />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase text-neutral-500 font-semibold tracking-wide block">Buffer before openings (minutes)</label>
            <input type="number" min={0} max={120} value={bufferMinutes} onChange={(e) => setBufferMinutes(parseInt(e.target.value || '0', 10))} className="mt-1 w-full rounded-xl border px-3 py-2 bg-white dark:bg-neutral-900 dark:border-neutral-700" />
            <p className="text-xs text-neutral-500 mt-1">Hide slots sooner than now + buffer.</p>
          </div>

          <div className="space-y-3 border-t border-neutral-100 dark:border-neutral-800 pt-4">
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Mon–Fri</p>
            <div className="flex gap-2 items-center">
              <label className="text-xs shrink-0 w-14">Opens</label>
              <input type="time" value={weekForm.monOpen} onChange={(e) => setWeekForm((w) => ({ ...w, monOpen: e.target.value }))} className="flex-1 rounded-xl border px-2 py-1 dark:bg-neutral-900 dark:border-neutral-700 text-sm" />
              <label className="text-xs shrink-0 w-14">Close</label>
              <input type="time" value={weekForm.monClose} onChange={(e) => setWeekForm((w) => ({ ...w, monClose: e.target.value }))} className="flex-1 rounded-xl border px-2 py-1 dark:bg-neutral-900 dark:border-neutral-700 text-sm" />
            </div>

            <div className="flex items-start gap-2">
              <input type="checkbox" checked={weekForm.satOn} onChange={(e) => setWeekForm((w) => ({ ...w, satOn: e.target.checked }))} />
              <div className="flex-1">
                <p className="text-sm font-medium">Saturday</p>
                {weekForm.satOn && (
                  <div className="flex gap-2 mt-1">
                    <input type="time" value={weekForm.satOpen} onChange={(e) => setWeekForm((w) => ({ ...w, satOpen: e.target.value }))} className="flex-1 rounded-xl border px-2 py-1 dark:bg-neutral-900 dark:border-neutral-700 text-sm" />
                    <input type="time" value={weekForm.satClose} onChange={(e) => setWeekForm((w) => ({ ...w, satClose: e.target.value }))} className="flex-1 rounded-xl border px-2 py-1 dark:bg-neutral-900 dark:border-neutral-700 text-sm" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <input type="checkbox" checked={weekForm.sunOn} onChange={(e) => setWeekForm((w) => ({ ...w, sunOn: e.target.checked }))} />
              <div className="flex-1">
                <p className="text-sm font-medium">Sunday</p>
                {weekForm.sunOn && (
                  <div className="flex gap-2 mt-1">
                    <input type="time" value={weekForm.sunOpen} onChange={(e) => setWeekForm((w) => ({ ...w, sunOpen: e.target.value }))} className="flex-1 rounded-xl border px-2 py-1 dark:bg-neutral-900 dark:border-neutral-700 text-sm" />
                    <input type="time" value={weekForm.sunClose} onChange={(e) => setWeekForm((w) => ({ ...w, sunClose: e.target.value }))} className="flex-1 rounded-xl border px-2 py-1 dark:bg-neutral-900 dark:border-neutral-700 text-sm" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-4">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Google calendars</h3>

          <div>
            <label className="text-xs uppercase text-neutral-500 font-semibold tracking-wide block mb-1">
              Calendar for new bookings (write)
            </label>
            {calendars.length ? (
              <select
                value={
                  calendars.some((c) => c.id === writeCalendarId)
                    ? writeCalendarId
                    : '__custom'
                }
                onChange={(e) => setWriteCalendarId(e.target.value === '__custom' ? '' : e.target.value)}
                className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-neutral-900 dark:border-neutral-700 text-sm"
              >
                <option value="__custom">Use typed calendar ID…</option>
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>{c.summary || c.id}</option>
                ))}
              </select>
            ) : null}
            <input
              placeholder="Google Calendar ID (e.g. workspace address from Calendar settings)"
              value={writeCalendarId}
              onChange={(e) => setWriteCalendarId(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2 bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-700 text-sm mt-2 ${calendars.length ? '' : ''}`}
            />
            <p className="text-xs text-neutral-500 mt-2">Leaving this blank defaults to your primary/sync calendar destination.</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase font-semibold text-neutral-500 tracking-wide">Treat as busy when computing openings</p>
            <p className="text-xs text-neutral-500">Leave unchecked to fall back to the calendars synced in Google Calendar sync.</p>
            <div className="grid gap-2 max-h-48 overflow-y-auto pr-2">
              {calendars.map((c) => (
                <label key={`avail-${c.id}`} className="flex gap-2 text-sm items-start rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900/60 px-2 py-1">
                  <input type="checkbox" checked={selectedAvailIds.has(c.id)} onChange={() => toggleAvailId(c.id)} />
                  <span className="truncate" title={c.id}>{c.summary || c.id}</span>
                </label>
              ))}
              {!calendars.length && <p className="text-xs text-neutral-400">Sync Google under Calendar settings first to see names.</p>}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-3">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Staff email notifications</h3>
        <textarea
          value={notifyEmailsText}
          onChange={(e) => setNotifyEmailsText(e.target.value)}
          placeholder="one@shop.com&#10;sales@shop.com"
          rows={5}
          className="w-full rounded-xl border px-3 py-3 text-sm bg-white dark:bg-neutral-900 dark:border-neutral-700"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={working || !notifyEmailsText.trim()} onClick={testEmail} className="rounded-xl px-4 py-2 text-sm font-semibold bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 disabled:opacity-50">
            Send test notification
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Service presets</h3>
          <button type="button" className="text-xs font-semibold px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700" onClick={addServiceRow}>
            + Row
          </button>
        </div>
        {services.map((svc, idx) => (
          <div key={`svc-${idx}`} className="flex gap-2 items-center">
            <input value={svc.id} placeholder="slug" className="w-24 rounded-xl border px-2 py-1 text-xs bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-700" onChange={(e) => updateService(idx, 'id', e.target.value)} />
            <input value={svc.label} placeholder="Shown to customers" className="flex-1 rounded-xl border px-3 py-2 bg-white dark:bg-neutral-900 dark:border-neutral-700" onChange={(e) => updateService(idx, 'label', e.target.value)} />
            <button type="button" className="text-red-500 text-xs underline" onClick={() => removeService(idx)}>Remove</button>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-3">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Messaging</h3>
        <label className="text-xs uppercase text-neutral-500 font-semibold tracking-wide block">Intro</label>
        <textarea rows={3} value={introText} onChange={(e) => setIntroText(e.target.value)} className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-neutral-900 dark:border-neutral-700 text-sm" />
        <label className="text-xs uppercase text-neutral-500 font-semibold tracking-wide block">Success message</label>
        <textarea rows={3} value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-neutral-900 dark:border-neutral-700 text-sm" />
      </section>

      <div className="flex justify-end pb-12">
        <button type="button" disabled={working} onClick={save} className="rounded-xl px-8 py-3 text-white font-semibold tracking-wide shadow disabled:opacity-50" style={{ backgroundColor: GOLD }}>
          Save booking settings
        </button>
      </div>
    </div>
  );
}
