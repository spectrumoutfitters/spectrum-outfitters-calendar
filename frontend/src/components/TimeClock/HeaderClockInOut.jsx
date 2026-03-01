import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { calculateElapsedTime, getCurrentCentralTimeString } from '../../utils/helpers';

const HeaderClockInOut = () => {
  const [status, setStatus] = useState({ clockedIn: false, elapsedHours: '0:00' });
  const [loading, setLoading] = useState(false);
  const [isOnLunchBreak, setIsOnLunchBreak] = useState(false);
  const [currentTime, setCurrentTime] = useState(getCurrentCentralTimeString(true));

  useEffect(() => {
    loadStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status.clockedIn && status.entry) {
      const interval = setInterval(async () => {
        // Reload status to get updated total elapsed time from backend
        try {
          const response = await api.get('/time/current');
          if (response.data.clockedIn) {
            // Use totalElapsedMs directly from backend - this is the accurate day total
            setStatus(prev => ({
              ...prev,
              elapsedHours: calculateElapsedTime(null, response.data.totalElapsedMs)
            }));
          }
        } catch (error) {
          // Fallback to client-side calculation if API fails
          setStatus(prev => ({
            ...prev,
            elapsedHours: calculateElapsedTime(prev.entry?.clock_in)
          }));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status.clockedIn, status.entry]);

  useEffect(() => {
    // Update current time every second
    const interval = setInterval(() => {
      setCurrentTime(getCurrentCentralTimeString(true));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const response = await api.get('/time/current');
      if (response.data.clockedIn) {
        // Use totalElapsedMs from backend directly - this is the accurate day total
        // Use originalClockIn for display if available, otherwise use entry.clock_in
        const displayClockIn = response.data.originalClockIn || response.data.entry?.original_clock_in || response.data.entry?.clock_in;
        setStatus({
          ...response.data,
          entry: {
            ...response.data.entry,
            clock_in: displayClockIn // Use original clock-in for display
          },
          elapsedHours: calculateElapsedTime(null, response.data.totalElapsedMs)
        });
      } else {
        setStatus(response.data);
      }
      
      // Check if on lunch break
      if (!response.data.clockedIn) {
        try {
          const entriesResponse = await api.get('/time/entries', {
            params: {
              start_date: new Date().toISOString().split('T')[0],
              end_date: new Date().toISOString().split('T')[0]
            }
          });
          
          const recentEntry = entriesResponse.data.entries
            .filter(e => e.clock_out && e.notes && e.notes.toLowerCase().includes('lunch break'))
            .sort((a, b) => new Date(b.clock_out) - new Date(a.clock_out))[0];
          
          if (recentEntry) {
            const returnEntry = entriesResponse.data.entries.find(e => {
              if (!e.clock_in || e.id === recentEntry.id) return false;
              const returnTime = new Date(e.clock_in);
              const lunchOutTime = new Date(recentEntry.clock_out);
              return returnTime > lunchOutTime;
            });
            setIsOnLunchBreak(!returnEntry);
          } else {
            setIsOnLunchBreak(false);
          }
        } catch (err) {
          setIsOnLunchBreak(false);
        }
      } else {
        setIsOnLunchBreak(false);
      }
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const handleClockIn = async () => {
    setLoading(true);

    // Try to get GPS (non-blocking)
    let coords = null;
    if (navigator.geolocation) {
      try {
        coords = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 8000, maximumAge: 60000 }
          );
        });
      } catch {
        coords = null;
      }
    }

    try {
      const body = coords ? { lat: coords.lat, lng: coords.lng } : {};
      await api.post('/time/clock-in', body);
      await loadStatus();
    } catch (error) {
      const data = error.response?.data;
      if (data?.code === 'GEOFENCE_VIOLATION') {
        alert(data.error || 'You must be at the shop to clock in.');
      } else {
        alert(data?.error || 'Failed to clock in');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      await api.post('/time/clock-out', {
        break_minutes: 0,
        notes: null
      });
      await loadStatus();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to clock out');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLunch = async () => {
    setLoading(true);
    try {
      await api.post('/time/clock-out', {
        break_minutes: 60,
        notes: 'Lunch break'
      });
      await loadStatus();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to go to lunch');
    } finally {
      setLoading(false);
    }
  };

  if (!status.clockedIn && !isOnLunchBreak) {
    return (
      <button
        onClick={handleClockIn}
        disabled={loading}
        className="px-3 py-1.5 bg-success text-white text-sm rounded hover:bg-green-600 transition disabled:opacity-50 flex items-center gap-2"
        title="Clock In"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {loading ? '...' : 'Clock In'}
      </button>
    );
  }

  if (isOnLunchBreak) {
    return (
      <button
        onClick={handleClockIn}
        disabled={loading}
        className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 transition disabled:opacity-50 flex items-center gap-2"
        title="Return from Lunch"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {loading ? '...' : 'Return'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="text-xs text-white/80 font-mono" title={`Current Central Time: ${currentTime}`}>
        {currentTime}
      </div>
      <div className="flex items-center gap-2 px-2 py-1 bg-green-50 rounded text-sm">
        <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
        <span className="text-gray-700 font-medium">{status.elapsedHours}</span>
      </div>
      <button
        onClick={handleGoToLunch}
        disabled={loading}
        className="px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition disabled:opacity-50"
        title="Go to Lunch"
      >
        🍽️
      </button>
      <button
        onClick={handleClockOut}
        disabled={loading}
        className="px-3 py-1.5 bg-danger text-white text-sm rounded hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-1"
        title="Clock Out"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        {loading ? '...' : 'Out'}
      </button>
    </div>
  );
};

export default HeaderClockInOut;

