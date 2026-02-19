import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';

const GoogleCalendarSettings = () => {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState({
    connected: false,
    calendar_id: 'primary',
    sync_calendar_ids: null,
    last_synced_at: null
  });
  const [calendars, setCalendars] = useState([]);
  const [calendarIdInput, setCalendarIdInput] = useState('primary');
  const [selectedSyncIds, setSelectedSyncIds] = useState([]); // multi-select for pull
  const [message, setMessage] = useState(null); // { type, text }

  const lastSyncedLabel = useMemo(() => {
    if (!status.last_synced_at) return 'Never';
    try {
      return new Date(status.last_synced_at).toLocaleString();
    } catch {
      return status.last_synced_at;
    }
  }, [status.last_synced_at]);

  const loadStatus = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.get('/google-calendar/status');
      const next = res.data || {};
      setStatus({
        connected: !!next.connected,
        calendar_id: next.calendar_id || 'primary',
        sync_calendar_ids: next.sync_calendar_ids || null,
        last_synced_at: next.last_synced_at || null
      });
      setCalendarIdInput(next.calendar_id || 'primary');
      setSelectedSyncIds(Array.isArray(next.sync_calendar_ids) ? [...next.sync_calendar_ids] : []);

      if (next.connected) {
        // Optional list; failure is non-fatal
        try {
          const cals = await api.get('/google-calendar/calendars');
          setCalendars(cals.data?.calendars || []);
        } catch {
          setCalendars([]);
        }
      } else {
        setCalendars([]);
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to load Google Calendar status'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const connect = async () => {
    setWorking(true);
    setMessage(null);
    try {
      const res = await api.get('/google-calendar/auth-url');
      const url = res.data?.url;
      if (!url) throw new Error('No auth URL returned');
      window.open(url, '_blank', 'noopener,noreferrer');
      setMessage({
        type: 'info',
        text: 'Google authorization opened in a new tab. After approving, come back here and click Refresh.'
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to start Google authorization'
      });
    } finally {
      setWorking(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect Google Calendar sync?')) return;
    setWorking(true);
    setMessage(null);
    try {
      await api.post('/google-calendar/disconnect');
      await loadStatus();
      setMessage({ type: 'success', text: 'Disconnected.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to disconnect'
      });
    } finally {
      setWorking(false);
    }
  };

  const syncNow = async () => {
    setWorking(true);
    setMessage(null);
    try {
      const res = await api.post('/google-calendar/sync-now');
      await loadStatus();
      const result = res.data?.result || {};
      const processed = result.processed ?? 0;
      const errors = result.errors || [];
      if (errors.length > 0) {
        const detail = errors.map((e) => `${e.calendarId}: ${e.message}`).join('; ');
        setMessage({
          type: 'error',
          text: `Synced ${processed} events, but ${errors.length} calendar(s) failed: ${detail}`
        });
      } else {
        setMessage({
          type: 'success',
          text: processed > 0 ? `Sync completed. ${processed} event(s) synced.` : 'Sync completed.'
        });
      }
    } catch (err) {
      const details = err.response?.data?.details || err.response?.data?.error;
      setMessage({
        type: 'error',
        text: details || err.message || 'Sync failed'
      });
    } finally {
      setWorking(false);
    }
  };

  const saveCalendarId = async () => {
    const trimmed = (calendarIdInput || '').trim();
    if (!trimmed) {
      setMessage({ type: 'error', text: 'Calendar ID cannot be empty.' });
      return;
    }
    setWorking(true);
    setMessage(null);
    try {
      await api.put('/google-calendar/calendar', { calendar_id: trimmed });
      await loadStatus();
      setMessage({ type: 'success', text: 'Calendar for new events saved. Next sync will be a full refresh.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to set calendar'
      });
    } finally {
      setWorking(false);
    }
  };

  const saveSyncCalendars = async () => {
    setWorking(true);
    setMessage(null);
    try {
      await api.put('/google-calendar/sync-calendars', { calendar_ids: selectedSyncIds });
      await loadStatus();
      setMessage({
        type: 'success',
        text: selectedSyncIds.length > 0
          ? `Syncing from ${selectedSyncIds.length} calendar(s). Click Sync Now to pull events.`
          : 'Sync calendars cleared. Only the default calendar will be used for sync.'
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to save sync calendars'
      });
    } finally {
      setWorking(false);
    }
  };

  const toggleSyncCalendar = (id) => {
    setSelectedSyncIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearAndResync = async () => {
    if (!window.confirm('This will remove ALL events that came from Google (including every "Unknown User" and other calendar). The schedule will then be refilled only from the calendars you have selected above. Make sure only Outfitters Projects, Outfitters Events, and US Holidays are selected. Continue?')) return;
    setWorking(true);
    setMessage(null);
    try {
      const res = await api.post('/google-calendar/clear-and-resync');
      await loadStatus();
      const d = res.data?.deleted ?? 0;
      const s = res.data?.synced ?? 0;
      const errs = res.data?.errors || [];
      if (errs.length > 0) {
        setMessage({
          type: 'error',
          text: `Removed ${d} old events and synced ${s} from selected calendars. Some calendars had errors: ${errs.map((e) => e.message).join('; ')}`
        });
      } else {
        setMessage({
          type: 'success',
          text: `Done. Removed ${d} old synced events and synced ${s} events from your selected calendars only.`
        });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.details || err.response?.data?.error || err.message || 'Cleanup failed'
      });
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="text-gray-600">Loading Google Calendar settings...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-gray-800">Google Calendar Sync</div>
          <div className="text-sm text-gray-600">
            Status:{' '}
            <span className={status.connected ? 'text-green-700 font-semibold' : 'text-gray-700 font-semibold'}>
              {status.connected ? 'Connected' : 'Disconnected'}
            </span>
            {' · '}
            Last sync: <span className="font-medium">{lastSyncedLabel}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadStatus}
            disabled={working}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            Refresh
          </button>
          {status.connected ? (
            <>
              <button
                type="button"
                onClick={syncNow}
                disabled={working}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Sync Now
              </button>
              <button
                type="button"
                onClick={disconnect}
                disabled={working}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={connect}
              disabled={working}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              Connect Google Calendar
            </button>
          )}
        </div>
      </div>

      {message?.text && (
        <div
          className={`text-sm rounded-lg p-3 border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : message.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {status.connected && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">Calendar for new events</div>
              <p className="text-xs text-gray-500">Schedule entries you create in the app are pushed to this calendar.</p>
              {calendars.length > 0 ? (
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={calendarIdInput}
                  onChange={(e) => setCalendarIdInput(e.target.value)}
                >
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.summary}
                      {c.primary ? ' (Primary)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={calendarIdInput}
                  onChange={(e) => setCalendarIdInput(e.target.value)}
                  placeholder="primary or calendar ID"
                />
              )}
              <button
                type="button"
                onClick={saveCalendarId}
                disabled={working}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Save
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">Sync events from these calendars</div>
              <p className="text-xs text-gray-500">Events from all selected calendars are pulled into the schedule. To <strong>unsync</strong> a calendar (e.g. Thomas Ho), uncheck it and click &quot;Save sync calendars&quot;.</p>
              {selectedSyncIds.length > 0 && (
                <p className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                  Currently syncing: {selectedSyncIds.map((id) => calendars.find((c) => c.id === id)?.summary || id).join(', ')}
                </p>
              )}
              {calendars.length > 0 ? (
                <>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                    {calendars.map((c) => {
                      const isSelected = selectedSyncIds.includes(c.id);
                      return (
                        <div key={c.id} className="flex items-center gap-2">
                          <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSyncCalendar(c.id)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-800 truncate">
                              {c.summary}
                              {c.primary ? ' (Primary)' : ''}
                            </span>
                          </label>
                          {isSelected && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedSyncIds((prev) => prev.filter((x) => x !== c.id));
                              }}
                              className="text-xs text-red-600 hover:text-red-800 hover:underline shrink-0"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={saveSyncCalendars}
                    disabled={working}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    Save sync calendars
                  </button>
                </>
              ) : (
                <p className="text-xs text-gray-500">Connect and refresh to see your calendar list.</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-700">How it works</div>
            <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
              <li>Creating/updating schedule entries pushes changes to the &quot;Calendar for new events&quot; above.</li>
              <li>Events from every calendar you selected under &quot;Sync events from these calendars&quot; are pulled into the app (every 5 min and via Sync Now).</li>
              <li>Pending time-off requests are not synced until approved.</li>
            </ul>
          </div>

          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-2">
            <div className="text-sm font-semibold text-gray-800">Clean up schedule</div>
            <p className="text-xs text-gray-700">
              Removes <strong>all</strong> events synced from Google (including &quot;Unknown User&quot; and every other calendar). Then re-syncs <strong>only</strong> from the calendars you have selected above. To show only Outfitters Projects, Outfitters Events, and US Holidays: leave <strong>only those 3 checked</strong>, click &quot;Save sync calendars&quot;, then run cleanup below.
            </p>
            {selectedSyncIds.length > 3 && (
              <p className="text-xs text-amber-800 font-medium">
                You have {selectedSyncIds.length} calendars selected. Uncheck all except Outfitters Projects, Outfitters Events, and Holidays in United States, then Save sync calendars, then run cleanup.
              </p>
            )}
            <button
              type="button"
              onClick={clearAndResync}
              disabled={working}
              className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:opacity-50"
            >
              Clean up: keep only selected calendars
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleCalendarSettings;

