import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { formatDate } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';
import AdaptiveModal from '../ui/AdaptiveModal';

const EmployeeSchedule = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleEntries, setScheduleEntries] = useState([]);
  const [calendarNames, setCalendarNames] = useState({}); // id -> summary for color coding (Outfitter Events, Outfitter Projects, etc.)
  const [loading, setLoading] = useState(true);
  const [assignableUsers, setAssignableUsers] = useState([]); // for admins: users they can assign events to
  const [syncCalendarOptions, setSyncCalendarOptions] = useState([]); // for admins: selected sync calendars (Outfitters Projects, etc.)
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    type: 'time_off_request',
    reason: '',
    notes: ''
  });
  const [eventFormData, setEventFormData] = useState({
    start_date: '',
    end_date: '',
    type: 'meeting',
    reason: '',
    notes: '',
    location: '',
    availability: 'busy',
    visibility: 'default',
    reminder: '10',
    target_user_id: '' // for admins: which user's calendar to assign to (empty = self)
  });
  const [showMoreOptions, setShowMoreOptions] = useState(true); // options visible by default; "Fewer options" collapses
  const [locationCoords, setLocationCoords] = useState(null); // { lat, lng } after address validation
  const [locationValidation, setLocationValidation] = useState(null); // { valid, error?, display_name? }
  const [locationValidating, setLocationValidating] = useState(false);
  const [showStreetView, setShowStreetView] = useState(false);
  const [streetViewImageUrl, setStreetViewImageUrl] = useState(null); // blob or null
  const [streetViewError, setStreetViewError] = useState(null); // error message when Street View fails
  const [streetViewUseInteractive, setStreetViewUseInteractive] = useState(false);
  const [streetViewInteractiveLoading, setStreetViewInteractiveLoading] = useState(false);
  const streetViewContainerRef = useRef(null);
  const streetViewPanoramaRef = useRef(null);
  const streetViewCoordsRef = useRef(null);
  const viewModalStreetViewContainerRef = useRef(null);
  const viewModalStreetViewPanoramaRef = useRef(null);
  const viewModalStreetViewCoordsRef = useRef(null);
  const [viewModalShowStreetView, setViewModalShowStreetView] = useState(false);
  const [viewModalStreetViewCoords, setViewModalStreetViewCoords] = useState(null);
  const [viewModalStreetViewUseInteractive, setViewModalStreetViewUseInteractive] = useState(false);
  const [viewModalStreetViewLoading, setViewModalStreetViewLoading] = useState(false);
  const [viewModalStreetViewImageUrl, setViewModalStreetViewImageUrl] = useState(null);
  const [viewModalStreetViewError, setViewModalStreetViewError] = useState(null);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationSuggestionsOpen, setLocationSuggestionsOpen] = useState(false);
  const [locationSuggestionsLoading, setLocationSuggestionsLoading] = useState(false);
  const locationSuggestionsRef = useRef(null);
  const locationSuggestionsTimeoutRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const handler = () => setLegendExpanded(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    loadScheduleEntries();
  }, [currentDate]);

  // Open event detail when navigating from dashboard with ?view=<id>
  useEffect(() => {
    const viewId = searchParams.get('view');
    if (!viewId) return;
    api.get(`/schedule/entry/${viewId}`)
      .then((res) => {
        const entry = res.data?.entry;
        if (entry) setViewingEntry(entry);
      })
      .catch(() => {})
      .finally(() => {
        const next = new URLSearchParams(searchParams);
        next.delete('view');
        setSearchParams(next, { replace: true });
      });
  }, []);

  useEffect(() => {
    if (isAdmin) {
      api.get('/users')
        .then((res) => {
          const list = (res.data?.users || []).filter((u) => u.is_active);
          setAssignableUsers(list);
        })
        .catch(() => setAssignableUsers([]));
      // Load selected sync calendars (Outfitters Projects, Outfitter Events, etc.) for calendar dropdown
      Promise.all([
        api.get('/google-calendar/status').catch(() => ({ data: {} })),
        api.get('/google-calendar/calendars').catch(() => ({ data: { calendars: [] } }))
      ]).then(([statusRes, calendarsRes]) => {
        const syncIds = Array.isArray(statusRes.data?.sync_calendar_ids) ? statusRes.data.sync_calendar_ids : [];
        const calendars = calendarsRes.data?.calendars || [];
        const selected = calendars.filter((c) => syncIds.includes(c.id)).map((c) => ({ id: c.id, summary: c.summary || c.id }));
        setSyncCalendarOptions(selected);
      }).catch(() => setSyncCalendarOptions([]));
    }
  }, [isAdmin]);


  const loadScheduleEntries = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const response = await api.get('/schedule', {
        params: {
          start_date: startOfMonth.toISOString().split('T')[0],
          end_date: endOfMonth.toISOString().split('T')[0]
        }
      });
      setScheduleEntries(response.data.entries || []);
      setCalendarNames(response.data.calendar_names || {});
    } catch (error) {
      console.error('Error loading schedule entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/schedule', {
        start_date: formData.start_date,
        end_date: formData.end_date,
        type: formData.type || 'time_off_request',
        reason: formData.reason,
        notes: formData.notes
      });
      setShowRequestModal(false);
      setFormData({
        start_date: '',
        end_date: '',
        type: 'time_off_request',
        reason: '',
        notes: ''
      });
      loadScheduleEntries();
      alert('Time off request submitted successfully!');
    } catch (error) {
      console.error('Error submitting request:', error);
      alert(error.response?.data?.error || 'Failed to submit time off request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddEventSubmit = async (e) => {
    e.preventDefault();
    setSubmittingEvent(true);
    try {
      const notesParts = [];
      if (eventFormData.notes?.trim()) notesParts.push(eventFormData.notes.trim());
      if (eventFormData.location?.trim()) notesParts.push(`Location: ${eventFormData.location.trim()}`);
      if (eventFormData.availability && eventFormData.availability !== 'busy') notesParts.push(`Availability: ${eventFormData.availability === 'free' ? 'Free' : 'Busy'}`);
      if (eventFormData.visibility && eventFormData.visibility !== 'default') notesParts.push(`Visibility: ${eventFormData.visibility}`);
      if (eventFormData.reminder && eventFormData.reminder !== 'none') {
        const reminderLabels = { '5': '5 minutes before', '10': '10 minutes before', '30': '30 minutes before', '60': '1 hour before', '1440': '1 day before' };
        notesParts.push(`Reminder: ${reminderLabels[eventFormData.reminder] || eventFormData.reminder}`);
      }
      const notes = notesParts.length ? notesParts.join('\n\n') : null;
      const payload = {
        start_date: eventFormData.start_date,
        end_date: eventFormData.end_date,
        type: eventFormData.type || 'meeting',
        reason: eventFormData.reason?.trim() || null,
        notes,
        location: eventFormData.location?.trim() || null,
        is_event: true
      };
      if (isAdmin && eventFormData.target_user_id) {
        if (eventFormData.target_user_id.startsWith('gcal:')) {
          payload.google_calendar_id = eventFormData.target_user_id.slice(5);
          payload.user_id = user?.id; // entry owned by admin, pushed to selected Google calendar
        } else {
          const uid = eventFormData.target_user_id.replace(/^user:/, '');
          if (uid) payload.user_id = Number(uid);
        }
      }
      await api.post('/schedule', payload);
      setShowAddEventModal(false);
      setEventFormData({
        start_date: '',
        end_date: '',
        type: 'meeting',
        reason: '',
        notes: '',
        location: '',
        availability: 'busy',
        visibility: 'default',
        reminder: '10',
        target_user_id: ''
      });
      loadScheduleEntries();
      alert('Event added to your schedule.');
    } catch (error) {
      console.error('Error adding event:', error);
      alert(error.response?.data?.error || 'Failed to add event');
    } finally {
      setSubmittingEvent(false);
    }
  };

  const looksLikeAddress = (text) => {
    const t = (text || '').trim();
    return t.length >= 8 && /\d/.test(t);
  };

  const handleLocationBlur = () => {
    const loc = (eventFormData.location || '').trim();
    if (!loc || !looksLikeAddress(loc)) {
      setLocationValidation(null);
      setLocationCoords(null);
      return;
    }
    setLocationValidating(true);
    setLocationValidation(null);
    setLocationCoords(null);
    api.get('/geocode', { params: { address: loc } })
      .then((res) => {
        if (res.data?.valid && res.data.lat != null && res.data.lng != null) {
          setLocationValidation({ valid: true, display_name: res.data.display_name });
          setLocationCoords({ lat: res.data.lat, lng: res.data.lng });
        } else {
          setLocationValidation({ valid: false, error: res.data?.error || 'Address not found.' });
        }
      })
      .catch(() => {
        setLocationValidation({ valid: false, error: 'Could not validate address.' });
      })
      .finally(() => setLocationValidating(false));
  };

  // Debounced address suggestions for location field
  useEffect(() => {
    const q = (eventFormData.location || '').trim();
    if (q.length < 2) {
      setLocationSuggestions([]);
      setLocationSuggestionsOpen(false);
      return;
    }
    if (locationSuggestionsTimeoutRef.current) clearTimeout(locationSuggestionsTimeoutRef.current);
    locationSuggestionsTimeoutRef.current = setTimeout(() => {
      setLocationSuggestionsLoading(true);
      setLocationSuggestionsOpen(true);
      api.get('/geocode/suggest', { params: { q } })
        .then((res) => {
          const list = res.data?.suggestions || [];
          setLocationSuggestions(list);
          setLocationSuggestionsOpen(list.length > 0 || q.length >= 2);
        })
        .catch(() => {
          setLocationSuggestions([]);
          setLocationSuggestionsOpen(false);
        })
        .finally(() => setLocationSuggestionsLoading(false));
    }, 400);
    return () => {
      if (locationSuggestionsTimeoutRef.current) clearTimeout(locationSuggestionsTimeoutRef.current);
    };
  }, [eventFormData.location]);

  const handleSelectLocationSuggestion = useCallback((suggestion) => {
    setEventFormData((prev) => ({ ...prev, location: suggestion.display_name }));
    setLocationCoords({ lat: suggestion.lat, lng: suggestion.lon });
    setLocationValidation({ valid: true, display_name: suggestion.display_name });
    setLocationSuggestions([]);
    setLocationSuggestionsOpen(false);
  }, []);

  const fallbackToStaticStreetView = useCallback(() => {
    if (!locationCoords) return;
    api.get('/geocode/streetview', { params: { lat: locationCoords.lat, lng: locationCoords.lng }, responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        setStreetViewImageUrl(url);
      })
      .catch(async (err) => {
        setStreetViewImageUrl('');
        let msg = 'Street View unavailable.';
        try {
          if (err.response?.data instanceof Blob) {
            const text = await err.response.data.text();
            const json = JSON.parse(text);
            if (json.error) msg = json.error;
          }
        } catch (_) {}
        setStreetViewError(msg);
      });
  }, [locationCoords]);

  const handleShowStreetView = () => {
    if (!locationCoords) return;
    setShowStreetView(true);
    setStreetViewImageUrl(null);
    setStreetViewError(null);
    setStreetViewUseInteractive(false);
    setStreetViewInteractiveLoading(false);
    streetViewCoordsRef.current = { lat: locationCoords.lat, lng: locationCoords.lng };

    api.get('/config/maps-key')
      .then((res) => {
        const key = (res.data?.googleMapsApiKey || '').trim();
        if (!key) {
          fallbackToStaticStreetView();
          return;
        }
        setStreetViewInteractiveLoading(true);
        window.__streetViewCtx = {
          containerRef: streetViewContainerRef,
          coordsRef: streetViewCoordsRef,
          panoramaRef: streetViewPanoramaRef,
          setUseInteractive: setStreetViewUseInteractive,
          setLoading: setStreetViewInteractiveLoading,
          fallback: fallbackToStaticStreetView
        };
        if (window.google?.maps?.StreetViewPanorama && streetViewContainerRef.current) {
          try {
            const { lat, lng } = streetViewCoordsRef.current || {};
            const panorama = new window.google.maps.StreetViewPanorama(streetViewContainerRef.current, {
              position: { lat, lng },
              pov: { heading: 0, pitch: 0 },
              zoom: 1,
              addressControl: false,
              linksControl: true,
              enableCloseButton: false
            });
            streetViewPanoramaRef.current = panorama;
            setStreetViewUseInteractive(true);
            setStreetViewInteractiveLoading(false);
          } catch (e) {
            setStreetViewInteractiveLoading(false);
            fallbackToStaticStreetView();
          }
          return;
        }
        if (document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
          setTimeout(() => {
            const ctx = window.__streetViewCtx;
            if (!ctx?.containerRef?.current || !ctx?.coordsRef?.current) return;
            try {
              const { lat, lng } = ctx.coordsRef.current;
              const panorama = new window.google.maps.StreetViewPanorama(ctx.containerRef.current, {
                position: { lat, lng },
                pov: { heading: 0, pitch: 0 },
                zoom: 1,
                addressControl: false,
                linksControl: true,
                enableCloseButton: false
              });
              ctx.panoramaRef.current = panorama;
              ctx.setUseInteractive(true);
            } catch (_) {}
            ctx.setLoading(false);
          }, 100);
          return;
        }
        window.__streetViewMapsCallback = () => {
          const ctx = window.__streetViewCtx;
          if (!ctx) return;
          const tryCreate = () => {
            try {
              const { lat, lng } = ctx.coordsRef?.current || {};
              const el = ctx.containerRef?.current;
              if (el && lat != null && lng != null && window.google?.maps?.StreetViewPanorama) {
                const panorama = new window.google.maps.StreetViewPanorama(el, {
                  position: { lat, lng },
                  pov: { heading: 0, pitch: 0 },
                  zoom: 1,
                  addressControl: false,
                  linksControl: true,
                  enableCloseButton: false
                });
                ctx.panoramaRef.current = panorama;
                ctx.setUseInteractive(true);
              }
            } catch (_) {}
            ctx.setLoading(false);
          };
          if (ctx.containerRef?.current) tryCreate();
          else setTimeout(tryCreate, 50);
        };
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__streetViewMapsCallback`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          if (window.__streetViewCtx?.fallback) window.__streetViewCtx.fallback();
          setStreetViewInteractiveLoading(false);
        };
        document.head.appendChild(script);
      })
      .catch(() => {
        fallbackToStaticStreetView();
      });
  };

  const resetViewModalStreetView = useCallback(() => {
    setViewModalShowStreetView(false);
    setViewModalStreetViewCoords(null);
    if (viewModalStreetViewImageUrl) URL.revokeObjectURL(viewModalStreetViewImageUrl);
    setViewModalStreetViewImageUrl(null);
    setViewModalStreetViewError(null);
    setViewModalStreetViewUseInteractive(false);
    setViewModalStreetViewLoading(false);
    if (viewModalStreetViewContainerRef.current && viewModalStreetViewPanoramaRef.current) {
      viewModalStreetViewContainerRef.current.innerHTML = '';
      viewModalStreetViewPanoramaRef.current = null;
    }
  }, [viewModalStreetViewImageUrl]);

  const viewModalFallbackToStaticStreetView = useCallback((coords) => {
    if (!coords) return;
    api.get('/geocode/streetview', { params: { lat: coords.lat, lng: coords.lng }, responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        setViewModalStreetViewImageUrl(url);
      })
      .catch(async (err) => {
        setViewModalStreetViewImageUrl('');
        let msg = 'Street View unavailable.';
        try {
          if (err.response?.data instanceof Blob) {
            const text = await err.response.data.text();
            const json = JSON.parse(text);
            if (json.error) msg = json.error;
          }
        } catch (_) {}
        setViewModalStreetViewError(msg);
      });
    setViewModalStreetViewLoading(false);
  }, []);

  const handleViewModalShowStreetView = useCallback((address) => {
    if (!address || !address.trim()) return;
    setViewModalStreetViewLoading(true);
    setViewModalStreetViewImageUrl(null);
    setViewModalStreetViewError(null);
    setViewModalStreetViewUseInteractive(false);
    api.get('/geocode', { params: { address: address.trim() } })
      .then((res) => {
        if (!res.data?.valid || res.data.lat == null || res.data.lng == null) {
          setViewModalStreetViewError(res.data?.error || 'Address not found.');
          setViewModalStreetViewLoading(false);
          return;
        }
        const coords = { lat: res.data.lat, lng: res.data.lng };
        setViewModalStreetViewCoords(coords);
        setViewModalShowStreetView(true);
        viewModalStreetViewCoordsRef.current = coords;

        api.get('/config/maps-key')
          .then((keyRes) => {
            const key = (keyRes.data?.googleMapsApiKey || '').trim();
            if (!key) {
              viewModalFallbackToStaticStreetView(coords);
              return;
            }
            window.__streetViewCtx = {
              containerRef: viewModalStreetViewContainerRef,
              coordsRef: viewModalStreetViewCoordsRef,
              panoramaRef: viewModalStreetViewPanoramaRef,
              setUseInteractive: setViewModalStreetViewUseInteractive,
              setLoading: setViewModalStreetViewLoading,
              fallback: () => viewModalFallbackToStaticStreetView(coords)
            };
            if (window.google?.maps?.StreetViewPanorama && viewModalStreetViewContainerRef.current) {
              try {
                const panorama = new window.google.maps.StreetViewPanorama(viewModalStreetViewContainerRef.current, {
                  position: coords,
                  pov: { heading: 0, pitch: 0 },
                  zoom: 1,
                  addressControl: false,
                  linksControl: true,
                  enableCloseButton: false
                });
                viewModalStreetViewPanoramaRef.current = panorama;
                setViewModalStreetViewUseInteractive(true);
                setViewModalStreetViewLoading(false);
              } catch (e) {
                setViewModalStreetViewLoading(false);
                viewModalFallbackToStaticStreetView(coords);
              }
              return;
            }
            if (document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
              setTimeout(() => {
                const ctx = window.__streetViewCtx;
                if (!ctx?.containerRef?.current || !ctx?.coordsRef?.current) return;
                try {
                  const { lat, lng } = ctx.coordsRef.current;
                  const panorama = new window.google.maps.StreetViewPanorama(ctx.containerRef.current, {
                    position: { lat, lng },
                    pov: { heading: 0, pitch: 0 },
                    zoom: 1,
                    addressControl: false,
                    linksControl: true,
                    enableCloseButton: false
                  });
                  ctx.panoramaRef.current = panorama;
                  ctx.setUseInteractive(true);
                } catch (_) {}
                ctx.setLoading(false);
              }, 100);
              return;
            }
            window.__streetViewMapsCallback = () => {
              const ctx = window.__streetViewCtx;
              if (!ctx) return;
              const tryCreate = () => {
                try {
                  const { lat, lng } = ctx.coordsRef?.current || {};
                  const el = ctx.containerRef?.current;
                  if (el && lat != null && lng != null && window.google?.maps?.StreetViewPanorama) {
                    const panorama = new window.google.maps.StreetViewPanorama(el, {
                      position: { lat, lng },
                      pov: { heading: 0, pitch: 0 },
                      zoom: 1,
                      addressControl: false,
                      linksControl: true,
                      enableCloseButton: false
                    });
                    ctx.panoramaRef.current = panorama;
                    ctx.setUseInteractive(true);
                  }
                } catch (_) {}
                ctx.setLoading(false);
              };
              if (ctx.containerRef?.current) tryCreate();
              else setTimeout(tryCreate, 50);
            };
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__streetViewMapsCallback`;
            script.async = true;
            script.defer = true;
            script.onerror = () => {
              if (window.__streetViewCtx?.fallback) window.__streetViewCtx.fallback();
              setViewModalStreetViewLoading(false);
            };
            document.head.appendChild(script);
          })
          .catch(() => viewModalFallbackToStaticStreetView(coords));
      })
      .catch(() => {
        setViewModalStreetViewError('Could not find address.');
        setViewModalStreetViewLoading(false);
      });
  }, [viewModalFallbackToStaticStreetView]);

  const EVENT_TYPES = [
    { value: 'meeting', label: 'Meeting' },
    { value: 'training', label: 'Training' },
    { value: 'appointment', label: 'Appointment' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'conference', label: 'Conference' },
    { value: 'other', label: 'Other' }
  ];

  const navigateMonth = (direction) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getEntriesForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return scheduleEntries.filter(entry => {
      const start = new Date(entry.start_date);
      const end = new Date(entry.end_date);
      const current = new Date(dateStr);
      return current >= start && current <= end;
    });
  };

  /** Color by: shop closed (purple), Outfitter Events / Projects (brand gold & black), or per-person palette. */
  const getEntryColor = (entry) => {
    if (entry.is_shop_wide) return 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-100';

    const calName = (entry.source_calendar_id && calendarNames[entry.source_calendar_id]) ? String(calendarNames[entry.source_calendar_id]).toLowerCase() : '';
    if (calName && (calName.includes('outfitter events') || calName === 'outfitter events')) return 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100';
    if (calName && (calName.includes('outfitter projects') || calName.includes('outfitters projects') || calName === 'outfitter projects')) return 'bg-neutral-900 text-amber-400 dark:bg-neutral-800 dark:text-amber-300 border border-amber-500/50';

    const userPalette = [
      'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-100',
      'bg-sky-200 text-sky-800 dark:bg-sky-800 dark:text-sky-100',
      'bg-cyan-200 text-cyan-800 dark:bg-cyan-800 dark:text-cyan-100',
      'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100',
      'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100',
      'bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-100',
      'bg-rose-200 text-rose-800 dark:bg-rose-800 dark:text-rose-100',
      'bg-fuchsia-200 text-fuchsia-800 dark:bg-fuchsia-800 dark:text-fuchsia-100',
      'bg-violet-200 text-violet-800 dark:bg-violet-800 dark:text-violet-100',
      'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
    ];
    const seed = entry.user_id != null ? entry.user_id : (entry.username || entry.user_name || 'unknown').toString().split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0);
    const idx = Math.abs(Number(seed) || 0) % userPalette.length;
    return userPalette[idx];
  };

  const getTypeLabel = (type) => {
    const typeLabels = {
      'day_off': 'Day Off',
      'time_off_request': 'Time Off Request',
      'approved_time_off': 'Approved Time Off',
      'out_of_office': 'Out of Office',
      'vacation': 'Vacation',
      'sick_leave': 'Sick Leave',
      'personal_leave': 'Personal Leave',
      'training': 'Training',
      'meeting': 'Meeting',
      'other': 'Other',
      'appointment': 'Appointment',
      'workshop': 'Workshop',
      'conference': 'Conference'
    };
    return typeLabels[type] || type;
  };

  const getEntryLabel = (entry) => {
    if (entry.is_shop_wide) return 'Shop Closed';
    if (entry.status === 'pending') return `Pending ${getTypeLabel(entry.type)}`;
    if (entry.status === 'approved') return getTypeLabel(entry.type);
    if (entry.status === 'rejected') return 'Rejected';
    return entry.reason || getTypeLabel(entry.type);
  };

  /** Address for any event: from location column or parsed from notes "Location: ..." (app or Google). */
  const getEventAddress = (entry) => {
    if (entry?.location && typeof entry.location === 'string') {
      const t = entry.location.trim();
      if (t) return t;
    }
    const notes = entry?.notes;
    if (typeof notes !== 'string') return null;
    const match = notes.match(/Location:\s*(.+?)(?:\n|$)/);
    return match ? match[1].trim() : null;
  };

  const days = getDaysInMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4 sm:space-y-6">
      {isAdmin && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500/40 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Admins: Edit events and drag to reschedule in <strong>Team schedule</strong>.
          </p>
          <button
            type="button"
            onClick={() => navigate('/admin?tab=schedule')}
            className="min-h-[2.75rem] px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 transition"
          >
            Open Team schedule →
          </button>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-neutral-100 md:text-3xl">My Schedule</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const today = new Date().toISOString().split('T')[0];
              setEventFormData(prev => ({
                ...prev,
                start_date: prev.start_date || today,
                end_date: prev.end_date || today,
                reason: prev.reason || '',
                notes: prev.notes || '',
                location: prev.location || '',
                availability: prev.availability || 'busy',
                visibility: prev.visibility || 'default',
                reminder: prev.reminder || '10',
                target_user_id: isAdmin && user?.id ? `user:${user.id}` : ''
              }));
              setShowMoreOptions(false);
              setShowAddEventModal(true);
            }}
            className="min-h-[3rem] px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-medium text-base"
          >
            + Add Event
          </button>
          <button
            onClick={() => setShowRequestModal(true)}
            className="min-h-[3rem] px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition font-medium text-base"
          >
            + Request Time Off
          </button>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth(-1)}
            className="min-h-[3rem] px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
          >
            ← Previous
          </button>
          <span className="px-4 py-2 font-semibold min-w-[180px] sm:min-w-[200px] text-center text-gray-900 dark:text-neutral-100">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="min-h-[3rem] px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
          >
            Next →
          </button>
        </div>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="min-h-[3rem] px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
        >
          Today
        </button>
      </div>

      {/* Legend — collapsed on mobile by default, expanded on sm+ */}
      <details open={legendExpanded} className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden group">
        <summary
          className="list-none cursor-pointer p-3 sm:p-4 flex items-center justify-between gap-2 min-h-12"
          onClick={(e) => { e.preventDefault(); setLegendExpanded((v) => !v); }}
        >
          <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Legend</h3>
          <span className="text-neutral-500 dark:text-neutral-400 sm:hidden select-none">{legendExpanded ? 'Tap to collapse' : 'Tap to expand'}</span>
        </summary>
        <div className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0 sm:pt-0 flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-gray-700 dark:text-neutral-300">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-200 dark:bg-purple-800 rounded shrink-0"></div>
            <span>Shop Closed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-200 dark:bg-amber-800 rounded shrink-0"></div>
            <span>Outfitter Events</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-neutral-900 dark:bg-neutral-800 border border-amber-500/50 rounded shrink-0"></div>
            <span>Outfitter Projects</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 shrink-0">
              <div className="w-3 h-4 rounded-l bg-blue-200 dark:bg-blue-800"></div>
              <div className="w-3 h-4 bg-emerald-200 dark:bg-emerald-800"></div>
              <div className="w-3 h-4 rounded-r bg-amber-200 dark:bg-amber-800"></div>
            </div>
            <span>People (by person)</span>
          </div>
        </div>
      </details>

      {/* Calendar — extra bottom padding on mobile so FAB doesn't cover dates */}
      {loading ? (
        <div className="text-center py-8 text-gray-600 dark:text-neutral-400">Loading schedule...</div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden min-w-0 pb-20 sm:pb-4">
          <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800">
            {dayNames.map(day => (
              <div key={day} className="p-2 sm:p-3 text-center text-sm font-semibold bg-neutral-50 dark:bg-neutral-800/50 text-gray-700 dark:text-neutral-300 border-r border-neutral-200 dark:border-neutral-700 last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 min-w-0">
            {days.map((date, index) => {
              const entries = getEntriesForDate(date);
              const isToday = date && date.toDateString() === new Date().toDateString();
              const isCurrentMonth = date !== null;
              const maxVisible = 2;
              const visibleEntries = entries.slice(0, maxVisible);
              const moreCount = entries.length - maxVisible;

              return (
                <div
                  key={index}
                  className={`min-h-[116px] sm:min-h-[120px] border-r border-b border-neutral-200 dark:border-neutral-800 p-1 sm:p-2 min-w-0 ${
                    !isCurrentMonth ? 'bg-neutral-50 dark:bg-neutral-800/30' : 'bg-white dark:bg-neutral-900'
                  } ${isToday ? 'ring-2 ring-inset ring-primary dark:ring-amber-500' : ''}`}
                >
                  {date && (
                    <>
                      <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-primary dark:text-amber-400' : 'text-gray-700 dark:text-neutral-300'}`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1.5">
                        {visibleEntries.map(entry => (
                          <div
                            key={entry.id}
                            role="button"
                            tabIndex={0}
                            className={`text-xs sm:text-sm p-2 rounded-lg cursor-pointer hover:opacity-90 active:opacity-95 min-h-12 sm:min-h-[2.5rem] flex flex-col justify-center border-0 ${getEntryColor(entry)}`}
                            onClick={() => setViewingEntry(entry)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setViewingEntry(entry); }}
                            title={`${getEntryLabel(entry)}: ${entry.reason || 'No reason provided'} — Tap for details`}
                          >
                            <div className="font-medium leading-tight line-clamp-2 break-words">{getEntryLabel(entry)}</div>
                            {entry.reason && entries.length <= 1 && (
                              <div className="truncate text-[10px] sm:text-xs opacity-90 mt-0.5">{entry.reason}</div>
                            )}
                          </div>
                        ))}
                        {moreCount > 0 && (
                          <button
                            type="button"
                            className="w-full min-h-10 sm:min-h-8 text-xs font-medium text-primary dark:text-amber-400 bg-primary/10 dark:bg-amber-500/20 rounded-lg hover:bg-primary/20 dark:hover:bg-amber-500/30 active:opacity-90"
                            onClick={() => setViewingEntry(entries[maxVisible])}
                          >
                            +{moreCount} more
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View details modal */}
      <AdaptiveModal
        open={!!viewingEntry}
        onClose={() => {
          resetViewModalStreetView();
          setViewingEntry(null);
        }}
        title={viewingEntry ? (viewingEntry.is_shop_wide ? '🏪 Shop Closed' : getEntryLabel(viewingEntry)) : ''}
        closeAriaLabel="Close"
        footer={
          viewingEntry ? (
            <div className="flex flex-col gap-2 w-full">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    resetViewModalStreetView();
                    setViewingEntry(null);
                    navigate('/admin?tab=schedule');
                  }}
                  className="w-full min-h-[3rem] px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:opacity-90 transition dark:bg-amber-600 dark:hover:bg-amber-500"
                >
                  Edit or move in Team schedule →
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  resetViewModalStreetView();
                  setViewingEntry(null);
                }}
                className="w-full min-h-[3rem] px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 text-gray-900 dark:text-neutral-100 font-medium transition"
              >
                Close
              </button>
            </div>
          ) : null
        }
      >
        {viewingEntry && (
          <>
            <div className={`inline-block px-2 py-1 rounded text-sm font-medium mb-3 ${getEntryColor(viewingEntry)}`}>
              {getTypeLabel(viewingEntry.type)}
              {viewingEntry.status && (
                <span className="ml-1">({viewingEntry.status})</span>
              )}
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500 dark:text-neutral-400 font-medium">Dates</dt>
                <dd className="text-gray-900 dark:text-neutral-100">
                  {formatDate(viewingEntry.start_date)}
                  {viewingEntry.start_date !== viewingEntry.end_date && ` – ${formatDate(viewingEntry.end_date)}`}
                </dd>
              </div>
              {getEventAddress(viewingEntry) && (
                <div className="pb-2">
                  <dt className="text-gray-500 dark:text-neutral-400 font-medium">Location</dt>
                  <dd className="text-gray-900 dark:text-neutral-100">
                    <p className="mb-3 break-words">{getEventAddress(viewingEntry)}</p>
                    {!viewModalShowStreetView && (
                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
                        <button
                          type="button"
                          onClick={() => handleViewModalShowStreetView(getEventAddress(viewingEntry))}
                          disabled={viewModalStreetViewLoading}
                          className="min-h-12 flex items-center justify-center sm:justify-start sm:min-h-0 px-4 py-3 sm:px-0 sm:py-0 rounded-lg sm:rounded-none bg-neutral-100 dark:bg-neutral-800 sm:bg-transparent dark:sm:bg-transparent text-primary dark:text-amber-400 hover:underline font-medium text-left border-0 cursor-pointer w-full sm:w-auto disabled:opacity-60"
                        >
                          {viewModalStreetViewLoading ? 'Loading…' : 'Show Street View'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const addr = getEventAddress(viewingEntry);
                            if (addr) window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`, '_blank');
                          }}
                          className="min-h-12 flex items-center justify-center sm:justify-start sm:min-h-0 px-4 py-3 sm:px-0 sm:py-0 rounded-lg sm:rounded-none bg-neutral-100 dark:bg-neutral-800 sm:bg-transparent dark:sm:bg-transparent text-primary dark:text-amber-400 hover:underline font-medium text-left border-0 cursor-pointer w-full sm:w-auto"
                        >
                          Get Directions
                        </button>
                      </div>
                    )}
                    {viewModalShowStreetView && viewModalStreetViewCoords && (
                      <div className="rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800 mt-2">
                        {(viewModalStreetViewUseInteractive || viewModalStreetViewLoading) ? (
                          <div className="relative">
                            <div
                              ref={viewModalStreetViewContainerRef}
                              className="w-full h-[280px] min-h-[200px] bg-neutral-200 dark:bg-neutral-700"
                              aria-label="Interactive Street View — drag to look around, use arrows to move"
                            />
                            {viewModalStreetViewLoading && (
                              <div className="absolute inset-0 flex items-center justify-center bg-neutral-200/80 dark:bg-neutral-700/80 text-neutral-600 dark:text-neutral-400 text-sm rounded-t-lg">
                                Loading Street View…
                              </div>
                            )}
                          </div>
                        ) : viewModalStreetViewImageUrl ? (
                          <img src={viewModalStreetViewImageUrl} alt="Street view" className="w-full h-auto max-h-48 object-cover" />
                        ) : viewModalStreetViewImageUrl === '' ? (
                          <div className="p-3 text-sm text-neutral-600 dark:text-neutral-400">
                            {viewModalStreetViewError ? (
                              <p className="mb-2 text-amber-600 dark:text-amber-400">{viewModalStreetViewError}</p>
                            ) : (
                              <p className="mb-2">Street View not available for this address.</p>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 text-sm text-neutral-500">Loading…</div>
                        )}
                        <button
                          type="button"
                          onClick={resetViewModalStreetView}
                          className="w-full py-2 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                        >
                          Hide street view
                        </button>
                      </div>
                    )}
                  </dd>
                </div>
              )}
              {viewingEntry.reason && (
                <div>
                  <dt className="text-gray-500 dark:text-neutral-400 font-medium">Reason</dt>
                  <dd className="text-gray-900 dark:text-neutral-100">{viewingEntry.reason}</dd>
                </div>
              )}
              {viewingEntry.notes && (
                <div>
                  <dt className="text-gray-500 dark:text-neutral-400 font-medium">Notes</dt>
                  <dd className="text-gray-900 dark:text-neutral-100 whitespace-pre-wrap">{viewingEntry.notes}</dd>
                </div>
              )}
              {!viewingEntry.is_shop_wide && viewingEntry.user_name && (
                <div>
                  <dt className="text-gray-500 dark:text-neutral-400 font-medium">Employee</dt>
                  <dd className="text-gray-900 dark:text-neutral-100">{viewingEntry.user_name}</dd>
                </div>
              )}
            </dl>
          </>
        )}
      </AdaptiveModal>

      {/* Add Event Modal — Google Calendar style */}
      <AdaptiveModal
        open={showAddEventModal}
        onClose={() => {
          setShowAddEventModal(false);
          setEventFormData({ start_date: '', end_date: '', type: 'meeting', reason: '', notes: '', location: '', availability: 'busy', visibility: 'default', reminder: '10', target_user_id: '' });
          setShowMoreOptions(true);
          setLocationCoords(null);
          setLocationValidation(null);
          setShowStreetView(false);
          setStreetViewImageUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
          setStreetViewError(null);
          setStreetViewUseInteractive(false);
          setStreetViewInteractiveLoading(false);
          if (streetViewContainerRef.current && streetViewPanoramaRef.current) {
            streetViewContainerRef.current.innerHTML = '';
            streetViewPanoramaRef.current = null;
          }
          setLocationSuggestions([]);
          setLocationSuggestionsOpen(false);
        }}
        title="Add Event"
        closeAriaLabel="Close"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="text-sm text-primary dark:text-amber-300 hover:underline font-medium"
            >
              {showMoreOptions ? 'Fewer options' : 'More options'}
            </button>
            <button
              type="submit"
              form="add-event-form"
              disabled={submittingEvent}
              className="min-h-[3rem] px-5 py-2.5 bg-primary text-white dark:bg-amber-500 dark:text-neutral-900 rounded-xl hover:bg-amber-400 dark:hover:bg-amber-400 transition font-medium disabled:opacity-50"
            >
              {submittingEvent ? 'Saving...' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="add-event-form" onSubmit={handleAddEventSubmit} className="space-y-1">
          {/* Title — prominent, no label (required) */}
          <input
            type="text"
            value={eventFormData.reason}
            onChange={(e) => setEventFormData({ ...eventFormData, reason: e.target.value })}
            placeholder="Add title"
            required
            className="w-full min-h-[3rem] px-0 py-2 text-lg font-medium border-0 border-b border-neutral-200 dark:border-neutral-600 bg-transparent text-gray-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-0 focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
          />

          {/* Event type tabs — clearer contrast in dark mode */}
          <div className="flex flex-wrap gap-2 py-3">
            {EVENT_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setEventFormData({ ...eventFormData, type: value })}
                className={`min-h-9 px-3 rounded-lg text-sm font-medium transition border ${
                  eventFormData.type === value
                    ? 'bg-primary text-white dark:bg-amber-500 dark:text-neutral-900 border-primary dark:border-amber-500'
                    : 'bg-neutral-100 dark:bg-neutral-700 border-neutral-200 dark:border-neutral-600 text-gray-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Date & time row — visible borders in dark mode */}
          <div className="flex items-start gap-3 py-3 border-b border-neutral-200 dark:border-neutral-700">
            <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full text-neutral-500 dark:text-neutral-400" aria-hidden>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </span>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={eventFormData.start_date}
                  onChange={(e) => setEventFormData({ ...eventFormData, start_date: e.target.value, end_date: eventFormData.end_date < e.target.value ? e.target.value : eventFormData.end_date })}
                  required
                  className="h-10 px-3 rounded-lg border border-neutral-300 dark:border-neutral-500 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-primary dark:focus:ring-amber-500 focus:outline-none focus:border-transparent"
                />
                <span className="text-neutral-500 dark:text-neutral-400 text-sm">to</span>
                <input
                  type="date"
                  value={eventFormData.end_date}
                  onChange={(e) => setEventFormData({ ...eventFormData, end_date: e.target.value })}
                  required
                  min={eventFormData.start_date || undefined}
                  className="h-10 px-3 rounded-lg border border-neutral-300 dark:border-neutral-500 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-primary dark:focus:ring-amber-500 focus:outline-none focus:border-transparent"
                />
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Does not repeat</p>
            </div>
          </div>

          {/* Description — icon + textarea */}
          <div className="flex items-start gap-3 py-3 border-b border-neutral-200 dark:border-neutral-700">
            <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full text-neutral-500 dark:text-neutral-400" aria-hidden>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
            </span>
            <textarea
              value={eventFormData.notes}
              onChange={(e) => setEventFormData({ ...eventFormData, notes: e.target.value })}
              rows={2}
              placeholder="Add description"
              className="flex-1 min-w-0 min-h-12 py-2 px-0 text-sm border-0 bg-transparent text-gray-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none resize-y"
            />
          </div>

          {/* Location — icon + input + address validation + Street View */}
          <div className="flex items-start gap-3 py-3 border-b border-neutral-200 dark:border-neutral-700">
            <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full text-neutral-500 dark:text-neutral-400 mt-0.5" aria-hidden>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </span>
            <div className="flex-1 min-w-0 space-y-2 relative" ref={locationSuggestionsRef}>
              <input
                type="text"
                value={eventFormData.location}
                onChange={(e) => {
                  setEventFormData({ ...eventFormData, location: e.target.value });
                  setLocationValidation(null);
                  setLocationCoords(null);
                  setShowStreetView(false);
                  if (streetViewImageUrl) URL.revokeObjectURL(streetViewImageUrl);
                  setStreetViewImageUrl(null);
                  setStreetViewError(null);
                  setStreetViewUseInteractive(false);
                  setStreetViewInteractiveLoading(false);
                  if (streetViewContainerRef.current && streetViewPanoramaRef.current) {
                    streetViewContainerRef.current.innerHTML = '';
                    streetViewPanoramaRef.current = null;
                  }
                }}
                onFocus={() => locationSuggestions.length > 0 && setLocationSuggestionsOpen(true)}
                onBlur={() => {
                  handleLocationBlur();
                  setTimeout(() => setLocationSuggestionsOpen(false), 200);
                }}
                placeholder="Type address to see suggestions"
                className="w-full min-h-10 py-2 px-0 text-sm border-0 bg-transparent text-gray-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none"
                autoComplete="off"
              />
              {locationSuggestionsOpen && (locationSuggestions.length > 0 || locationSuggestionsLoading || (!locationSuggestionsLoading && eventFormData.location?.trim().length >= 2)) && (
                <ul
                  className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-lg py-1"
                  role="listbox"
                >
                  {locationSuggestionsLoading && locationSuggestions.length === 0 && (
                    <li className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">Loading…</li>
                  )}
                  {!locationSuggestionsLoading && locationSuggestions.length === 0 && eventFormData.location?.trim().length >= 2 && (
                    <li className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">No addresses found. You can still enter an address manually.</li>
                  )}
                  {locationSuggestions.map((s, i) => (
                    <li
                      key={`${s.display_name}-${i}`}
                      role="option"
                      tabIndex={0}
                      className="px-3 py-2 text-sm text-gray-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer border-b border-neutral-100 dark:border-neutral-700 last:border-b-0"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectLocationSuggestion(s);
                      }}
                    >
                      {s.display_name}
                    </li>
                  ))}
                </ul>
              )}
              {locationValidating && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Checking address…</p>
              )}
              {locationValidation && !locationValidating && (
                <p className={`text-xs ${locationValidation.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {locationValidation.valid ? '✓ Valid address' : locationValidation.error}
                </p>
              )}
              {(eventFormData.location?.trim() || locationCoords) && (
                <div className="flex flex-wrap items-center gap-3">
                  {locationCoords && !showStreetView && (
                    <button
                      type="button"
                      onClick={handleShowStreetView}
                      className="text-sm text-primary dark:text-amber-300 hover:underline font-medium"
                    >
                      Show street view?
                    </button>
                  )}
                  <a
                    href={
                      eventFormData.location?.trim()
                        ? `geo:0,0?q=${encodeURIComponent(eventFormData.location.trim())}`
                        : locationCoords
                          ? `geo:${locationCoords.lat},${locationCoords.lng}`
                          : '#'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary dark:text-amber-300 hover:underline font-medium"
                    onClick={(e) => {
                      const addr = eventFormData.location?.trim();
                      const coords = locationCoords;
                      if (!addr && !coords) e.preventDefault();
                      // Fallback for environments where geo: isn't handled: open Google Maps with destination
                      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
                      const isDesktop = /Mac|Windows|Linux/.test(ua) && !/Android|iPad|iPhone|Mobile/.test(ua);
                      if (isDesktop) {
                        e.preventDefault();
                        const q = addr ? encodeURIComponent(addr) : (coords ? `${coords.lat},${coords.lng}` : '');
                        if (q) window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, '_blank');
                      }
                    }}
                  >
                    Directions
                  </a>
                </div>
              )}
              {showStreetView && locationCoords && (
                <div className="rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800">
                  {(streetViewUseInteractive || streetViewInteractiveLoading) ? (
                    <div className="relative">
                      <div
                        ref={streetViewContainerRef}
                        className="w-full h-[280px] min-h-[200px] bg-neutral-200 dark:bg-neutral-700"
                        aria-label="Interactive Street View — drag to look around, use arrows to move"
                      />
                      {streetViewInteractiveLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-neutral-200/80 dark:bg-neutral-700/80 text-neutral-600 dark:text-neutral-400 text-sm rounded-t-lg">
                          Loading Street View…
                        </div>
                      )}
                    </div>
                  ) : streetViewImageUrl ? (
                    <img src={streetViewImageUrl} alt="Street view" className="w-full h-auto max-h-48 object-cover" />
                  ) : streetViewImageUrl === '' ? (
                    <div className="p-3 text-sm text-neutral-600 dark:text-neutral-400">
                      {streetViewError ? (
                        <p className="mb-2 text-amber-600 dark:text-amber-400">{streetViewError}</p>
                      ) : (
                        <p className="mb-2">Street View snapshot not configured. Open in Google Maps to see street view.</p>
                      )}
                      <a
                        href={`https://www.google.com/maps?q=${locationCoords.lat},${locationCoords.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary dark:text-amber-400 hover:underline"
                      >
                        Open in Google Maps →
                      </a>
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-neutral-500">Loading…</div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowStreetView(false);
                      if (streetViewImageUrl) URL.revokeObjectURL(streetViewImageUrl);
                      setStreetViewImageUrl(null);
                      setStreetViewError(null);
                      setStreetViewUseInteractive(false);
                      setStreetViewInteractiveLoading(false);
                      if (streetViewContainerRef.current && streetViewPanoramaRef.current) {
                        streetViewContainerRef.current.innerHTML = '';
                        streetViewPanoramaRef.current = null;
                      }
                    }}
                    className="w-full py-2 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  >
                    Hide street view
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* More options: calendar, availability, visibility, reminder — all clickable */}
          {showMoreOptions && (
            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4 mt-3 space-y-3">
              {/* Calendar assignment — admins: any active user; employees: own schedule only */}
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full text-neutral-500 dark:text-neutral-400" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </span>
                <div className="flex-1 min-w-0">
                  <label htmlFor="add-event-calendar" className="sr-only">Calendar</label>
                  <select
                    id="add-event-calendar"
                    value={isAdmin ? (eventFormData.target_user_id || (user?.id ? `user:${user.id}` : '')) : 'me'}
                    onChange={(e) => isAdmin && setEventFormData({ ...eventFormData, target_user_id: e.target.value })}
                    className="w-full min-h-10 pl-3 pr-8 py-2 rounded-lg border border-neutral-300 dark:border-neutral-500 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-primary dark:focus:ring-amber-500 focus:outline-none appearance-none cursor-pointer bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
                  >
                    {isAdmin ? (
                      <>
                        {assignableUsers.map((u) => (
                          <option key={`user:${u.id}`} value={`user:${u.id}`}>{u.full_name}</option>
                        ))}
                        {syncCalendarOptions.length > 0 && (
                          <>
                            {assignableUsers.length > 0 && (
                              <option disabled>——— Calendars ———</option>
                            )}
                            {syncCalendarOptions.map((c) => (
                              <option key={`gcal:${c.id}`} value={`gcal:${c.id}`}>{c.summary}</option>
                            ))}
                          </>
                        )}
                        {assignableUsers.length === 0 && syncCalendarOptions.length === 0 && (
                          <option value={user?.id ? `user:${user.id}` : 'me'}>{user?.full_name || 'My schedule'}</option>
                        )}
                      </>
                    ) : (
                      <option value="me">{user?.full_name || 'My schedule'}</option>
                    )}
                  </select>
                </div>
              </div>
              {/* Availability */}
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full text-neutral-500 dark:text-neutral-400" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </span>
                <div className="flex-1 min-w-0">
                  <label htmlFor="add-event-availability" className="sr-only">Availability</label>
                  <select
                    id="add-event-availability"
                    value={eventFormData.availability}
                    onChange={(e) => setEventFormData({ ...eventFormData, availability: e.target.value })}
                    className="w-full min-h-10 pl-3 pr-8 py-2 rounded-lg border border-neutral-300 dark:border-neutral-500 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-primary dark:focus:ring-amber-500 focus:outline-none appearance-none cursor-pointer bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
                  >
                    <option value="busy">Busy</option>
                    <option value="free">Free</option>
                  </select>
                </div>
              </div>
              {/* Visibility */}
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full text-neutral-500 dark:text-neutral-400" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </span>
                <div className="flex-1 min-w-0">
                  <label htmlFor="add-event-visibility" className="sr-only">Visibility</label>
                  <select
                    id="add-event-visibility"
                    value={eventFormData.visibility}
                    onChange={(e) => setEventFormData({ ...eventFormData, visibility: e.target.value })}
                    className="w-full min-h-10 pl-3 pr-8 py-2 rounded-lg border border-neutral-300 dark:border-neutral-500 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-primary dark:focus:ring-amber-500 focus:outline-none appearance-none cursor-pointer bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
                  >
                    <option value="default">Default visibility</option>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
              {/* Reminder timing */}
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full text-neutral-500 dark:text-neutral-400" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-6-6v0a6 6 0 00-6 6v3.159c0 .538.214 1.055.595 1.436L19 17m-6-6v3m0 0v3m0-3h3m-3 0h-3" /></svg>
                </span>
                <div className="flex-1 min-w-0">
                  <label htmlFor="add-event-reminder" className="sr-only">Reminder</label>
                  <select
                    id="add-event-reminder"
                    value={eventFormData.reminder}
                    onChange={(e) => setEventFormData({ ...eventFormData, reminder: e.target.value })}
                    className="w-full min-h-10 pl-3 pr-8 py-2 rounded-lg border border-neutral-300 dark:border-neutral-500 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-primary dark:focus:ring-amber-500 focus:outline-none appearance-none cursor-pointer bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
                  >
                    <option value="none">None</option>
                    <option value="5">5 minutes before</option>
                    <option value="10">10 minutes before</option>
                    <option value="30">30 minutes before</option>
                    <option value="60">1 hour before</option>
                    <option value="1440">1 day before</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </form>
      </AdaptiveModal>

      {/* Request Time Off Modal */}
      <AdaptiveModal
        open={showRequestModal}
        onClose={() => {
          setShowRequestModal(false);
          setFormData({ start_date: '', end_date: '', type: 'time_off_request', reason: '', notes: '' });
        }}
        title="Request Time Off"
        closeAriaLabel="Close"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                setShowRequestModal(false);
                setFormData({ start_date: '', end_date: '', type: 'time_off_request', reason: '', notes: '' });
              }}
              className="min-h-[3rem] flex-1 px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-200 font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="request-timeoff-form"
              disabled={submitting}
              className="min-h-[3rem] flex-1 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition font-medium disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        }
      >
        <form id="request-timeoff-form" onSubmit={handleRequestSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Start Date *</label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
              min={new Date().toISOString().split('T')[0]}
              className="w-full h-12 px-4 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">End Date *</label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              required
              min={formData.start_date || new Date().toISOString().split('T')[0]}
              className="w-full h-12 px-4 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Type *</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              required
              className="w-full h-12 px-4 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="time_off_request">Time Off Request</option>
              <option value="out_of_office">Out of Office</option>
              <option value="vacation">Vacation</option>
              <option value="sick_leave">Sick Leave</option>
              <option value="personal_leave">Personal Leave</option>
              <option value="training">Training</option>
              <option value="meeting">Meeting</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Reason *</label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              required
              placeholder="e.g., Vacation, Sick Day, Personal"
              className="w-full h-12 px-4 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 placeholder-neutral-400 focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Additional Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Any additional information..."
              className="w-full min-h-[4rem] px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 placeholder-neutral-400 focus:ring-2 focus:ring-primary focus:outline-none resize-y"
            />
          </div>
        </form>
      </AdaptiveModal>
    </div>
  );
};

export default EmployeeSchedule;

