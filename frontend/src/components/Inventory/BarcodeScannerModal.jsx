import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import api from '../../utils/api';

const isSecure = () => {
  try {
    return window.isSecureContext === true || window.location.hostname === 'localhost';
  } catch {
    return false;
  }
};

function playScanBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 2100;
    osc.type = 'square';
    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
  } catch {
    // ignore
  }
}

// Lightning-fast scan: try many times per second, work on any camera
const SCAN_OPTIONS = {
  delayBetweenScanAttempts: 33,   // ~30 attempts/sec when no barcode (was 500ms = 2/sec)
  delayBetweenScanSuccess: 0,     // no delay after success — we close immediately
  tryPlayVideoTimeout: 8000,      // give slow cameras time to start
};

/**
 * Optional context when scan is for a specific action.
 * @typedef {{ type: 'add_quantity'|'add_barcode'|'refill_receive'|'use_on_task'|'batch_receive', item?: { name: string }, itemName?: string, qty?: number, task_id?: number, task_title?: string }} PendingContext
 */

const BarcodeScannerModal = ({ isOpen, onClose, onDetected, pendingContext = null }) => {
  const videoRef = useRef(null);
  const videoWrapRef = useRef(null);
  const controlsRef = useRef(null);
  const readerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const onDetectedRef = useRef(onDetected);

  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [focusPoint, setFocusPoint] = useState(null);
  const [manualBarcode, setManualBarcode] = useState('');

  // use_on_task flow state
  const [uotStep, setUotStep] = useState(null); // null | 'loading' | 'confirm' | 'submitting' | 'success'
  const [uotItem, setUotItem] = useState(null);
  const [uotQty, setUotQty] = useState('1');
  const [uotTasks, setUotTasks] = useState([]);
  const [uotTaskId, setUotTaskId] = useState('');
  const [uotError, setUotError] = useState(null);
  const [uotScannedBarcode, setUotScannedBarcode] = useState('');

  // batch_receive flow state
  const [batchItems, setBatchItems] = useState([]); // [{ item, qty, barcode }]
  const [batchLookupLoading, setBatchLookupLoading] = useState(false);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchSuccess, setBatchSuccess] = useState(false);
  const [batchError, setBatchError] = useState(null);
  const [lastScannedId, setLastScannedId] = useState(null);
  const [batchConfirming, setBatchConfirming] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const batchScannedRef = useRef(new Set()); // prevent double-scan

  onCloseRef.current = onClose;
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!isOpen) {
      setManualBarcode('');
      setUotStep(null);
      setUotItem(null);
      setUotQty('1');
      setUotTasks([]);
      setUotTaskId('');
      setUotError(null);
      setUotScannedBarcode('');
      setBatchItems([]);
      setBatchSuccess(false);
      setBatchError(null);
      setLastScannedId(null);
      setBatchConfirming(false);
      setShowSuccessToast(false);
      batchScannedRef.current = new Set();
    }
  }, [isOpen]);

  // Pre-set task_id for use_on_task from pendingContext
  useEffect(() => {
    if (isOpen && pendingContext?.type === 'use_on_task' && pendingContext.task_id) {
      setUotTaskId(String(pendingContext.task_id));
    }
  }, [isOpen, pendingContext?.type, pendingContext?.task_id]);

  const descriptionText = pendingContext
    ? pendingContext.item?.name ?? pendingContext.itemName ?? 'this item'
    : null;

  const handleManualSubmit = (e) => {
    e?.preventDefault();
    const code = String(manualBarcode || '').trim();
    if (!code) return;
    onDetectedRef.current(code);
    onCloseRef.current();
  };

  useEffect(() => {
    if (!isOpen) return;

    const start = async () => {
      setError(null);
      setScanning(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera is not available in this browser.');
        return;
      }

      if (!isSecure()) {
        setError('Camera requires a secure connection. On your phone, use the HTTPS URL (e.g. https://[this computer\'s IP]:5173) and accept the certificate to use the camera.');
        return;
      }

      setStarting(true);
      // Barcodes (UPC, EAN, Code 128, etc.) and QR codes. Options = scan speed.
      const reader = new BrowserMultiFormatReader(undefined, SCAN_OPTIONS);
      readerRef.current = reader;

      try {
        const videoEl = videoRef.current;
        if (!videoEl) {
          setError('Camera element not ready.');
          return;
        }

        const handleResult = (result, err) => {
          if (result?.getText) {
            const text = result.getText();
            if (text) {
              playScanBeep();
              const ctx = pendingContext;
              if (ctx?.type === 'use_on_task') {
                handleUotScan(text);
              } else if (ctx?.type === 'batch_receive') {
                handleBatchScan(text);
              } else {
                onDetectedRef.current(text);
                onCloseRef.current();
              }
            }
            return;
          }
          if (err && err?.name !== 'NotFoundException') {
            console.warn('Scanner error:', err);
          }
        };

        // Robust constraints: prefer moderate resolution (faster decode), fallback for strict cameras
        let constraints = {
          audio: false,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: 'environment' },
          }
        };

        let controls;
        try {
          controls = await reader.decodeFromConstraints(constraints, videoEl, handleResult);
        } catch (constraintErr) {
          constraints = {
            audio: false,
            video: { facingMode: { ideal: 'environment' } },
          };
          controls = await reader.decodeFromConstraints(constraints, videoEl, handleResult);
        }

        controlsRef.current = controls;
        setScanning(true);
      } catch (e) {
        console.error('Failed to start scanner:', e);
        setError(e?.message || 'Failed to start camera scanner.');
      } finally {
        setStarting(false);
      }
    };

    start();

    return () => {
      setScanning(false);
      try {
        controlsRef.current?.stop();
      } catch {
        // ignore
      }
      try {
        readerRef.current?.reset();
      } catch {
        // ignore
      }
      controlsRef.current = null;
      readerRef.current = null;
    };
  }, [isOpen]);

  const stopCamera = () => {
    try { controlsRef.current?.stop(); } catch (_) {}
    try { readerRef.current?.reset(); } catch (_) {}
    controlsRef.current = null;
    readerRef.current = null;
    setScanning(false);
  };

  const handleUotScan = async (barcode) => {
    if (uotStep) return; // already processing
    setUotStep('loading');
    setUotScannedBarcode(barcode);
    setUotError(null);
    stopCamera();
    try {
      const [itemRes, tasksRes] = await Promise.all([
        api.get(`/inventory/items/by-barcode/${encodeURIComponent(barcode)}`),
        pendingContext?.task_id ? Promise.resolve(null) : api.get('/tasks'),
      ]);
      setUotItem(itemRes.data.item);
      if (!pendingContext?.task_id && tasksRes) {
        const allTasks = tasksRes.data?.tasks || [];
        setUotTasks(allTasks.filter((t) => t.status !== 'completed' && !t.is_archived));
      }
      setUotStep('confirm');
    } catch (e) {
      setUotError(e.response?.data?.error || 'Item not found for this barcode');
      setUotStep(null);
    }
  };

  const handleUotSubmit = async () => {
    if (!uotItem) return;
    const taskId = pendingContext?.task_id || uotTaskId;
    if (!taskId) { setUotError('Please select a task'); return; }
    const qty = parseFloat(uotQty);
    if (!qty || qty <= 0) { setUotError('Enter a valid quantity'); return; }
    setUotStep('submitting');
    setUotError(null);
    try {
      const res = await api.post('/inventory/use-on-task', {
        item_id: uotItem.id,
        task_id: Number(taskId),
        quantity_used: qty,
      });
      onDetectedRef.current(res.data.item);
      setUotStep('success');
      setTimeout(() => onCloseRef.current(), 1200);
    } catch (e) {
      setUotError(e.response?.data?.error || 'Failed to use item');
      setUotStep('confirm');
    }
  };

  const handleBatchScan = async (barcode) => {
    if (batchScannedRef.current.has(barcode)) return;
    batchScannedRef.current.add(barcode);
    setBatchLookupLoading(true);
    setBatchError(null);
    setBatchConfirming(false);
    try {
      const res = await api.get(`/inventory/items/by-barcode/${encodeURIComponent(barcode)}`);
      const found = res.data.item;
      setLastScannedId(found.id);
      setBatchItems((prev) => {
        const exists = prev.find((b) => b.item.id === found.id);
        if (exists) {
          return prev.map((b) => b.item.id === found.id ? { ...b, qty: String(Number(b.qty) + 1) } : b);
        }
        return [...prev, { item: found, qty: '1', barcode }];
      });
    } catch (e) {
      setBatchError(`Not found: ${barcode}`);
      batchScannedRef.current.delete(barcode);
    } finally {
      setBatchLookupLoading(false);
    }
  };

  const handleBatchSubmit = async () => {
    if (batchItems.length === 0) return;
    if (!batchConfirming) {
      setBatchConfirming(true);
      return;
    }
    setBatchSubmitting(true);
    setBatchError(null);
    setBatchConfirming(false);
    try {
      const items = batchItems
        .map((b) => ({ item_id: b.item.id, quantity: parseFloat(b.qty) || 0 }))
        .filter((b) => b.quantity > 0);
      const res = await api.post('/inventory/batch-receive', { items });
      onDetectedRef.current(res.data.results);
      setBatchSuccess(true);
      setShowSuccessToast(true);
      setTimeout(() => onCloseRef.current(), 2000);
    } catch (e) {
      setBatchError(e.response?.data?.error || 'Batch receive failed');
    } finally {
      setBatchSubmitting(false);
    }
  };

  const handleTapToFocus = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const video = videoRef.current;
    const wrap = videoWrapRef.current;
    if (!video?.srcObject || !wrap) return;
    const stream = video.srcObject;
    const track = stream?.getVideoTracks?.()?.[0];
    if (!track) return;

    const rect = wrap.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY;
    if (clientX == null || clientY == null) return;

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setFocusPoint({ x, y });
    const t = setTimeout(() => setFocusPoint(null), 700);
    const cleanup = () => clearTimeout(t);

    const runFocus = async () => {
      try {
        if (typeof ImageCapture !== 'undefined' && ImageCapture.prototype.setFocusPoint) {
          const imageCapture = new ImageCapture(track);
          await imageCapture.setFocusPoint((clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height);
          return;
        }
      } catch (_) { /* not supported */ }

      try {
        const caps = track.getCapabilities?.();
        const modes = Array.isArray(caps?.focusMode) ? caps.focusMode : (caps?.focusMode ? [caps.focusMode] : []);
        if (modes.includes('continuous')) {
          await track.applyConstraints({ focusMode: 'continuous' });
        } else if (modes.length > 0) {
          await track.applyConstraints({ focusMode: 'manual' });
          await new Promise((r) => setTimeout(r, 150));
          await track.applyConstraints({ focusMode: modes[0] });
        }
      } catch (_) {
        // Many cameras don't expose focus constraints; ignore
      }
    };

    runFocus().finally(cleanup);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-end sm:justify-center sm:py-4 safe-area-inset"
      style={{
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <div
        className="relative w-full max-w-xl bg-white dark:bg-neutral-950 rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-200 dark:border-neutral-700 flex flex-col overflow-hidden max-h-[100dvh] sm:max-h-[90vh] md:max-h-[85vh] flex-1 sm:flex-initial min-h-0"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="barcode-scanner-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-700 flex-shrink-0 min-h-[3rem]">
          <div id="barcode-scanner-title" className="font-semibold text-gray-900 dark:text-neutral-100 text-lg">Scan barcode or QR code</div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[2.75rem] min-w-[2.75rem] flex items-center justify-center p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 active:bg-gray-200 dark:active:bg-neutral-700 touch-manipulation"
            aria-label="Close"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-3 sm:p-4 space-y-3 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <div
            ref={videoWrapRef}
            className="relative rounded-xl overflow-hidden border-2 border-gray-300 dark:border-neutral-700 bg-black flex-shrink-0"
          >
            <video
              ref={videoRef}
              className="w-full h-[200px] min-[480px]:h-[240px] sm:h-[280px] md:h-[320px] object-cover"
              muted
              playsInline
              autoPlay
            />
            {/* Tap-to-focus overlay: capture taps and show focus indicator */}
            <div
              className="absolute inset-0 cursor-pointer touch-manipulation"
              onClick={handleTapToFocus}
              onTouchEnd={(e) => { if (e.cancelable) e.preventDefault(); handleTapToFocus(e); }}
              role="button"
              tabIndex={0}
              aria-label="Tap to focus camera"
            />
            {focusPoint && (
              <div
                className="absolute w-16 h-16 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full pointer-events-none animate-tap-focus"
                style={{ left: `${focusPoint.x}%`, top: `${focusPoint.y}%` }}
              />
            )}
            {/* Viewfinder overlay: dark edges + clear scan area */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="absolute inset-0 bg-black/50" />
              <div className="relative w-[85%] max-w-[320px] aspect-[2.5/1] border-2 border-white rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                {/* Corner brackets */}
                <div className="absolute -top-0.5 -left-0.5 w-8 h-8 border-l-4 border-t-4 border-primary rounded-tl-lg" />
                <div className="absolute -top-0.5 -right-0.5 w-8 h-8 border-r-4 border-t-4 border-primary rounded-tr-lg" />
                <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-l-4 border-b-4 border-primary rounded-bl-lg" />
                <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-r-4 border-b-4 border-primary rounded-br-lg" />
                {/* Scanning line animation */}
                {scanning && (
                  <div className="absolute inset-1 rounded overflow-hidden">
                    <div
                      className="absolute left-0 right-0 h-0.5 bg-primary/90 animate-scanline"
                      style={{
                        animation: 'scanline 1.5s ease-in-out infinite'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="text-center py-2 safe-area-pb">
            <p className="text-sm font-medium text-gray-700 dark:text-neutral-100">
              {starting ? 'Starting camera…' : scanning ? 'Align the barcode or QR code in the frame' : 'Point the camera at a barcode or QR code.'}
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
              Scans barcodes (UPC, EAN, Code 128) and QR codes.
            </p>
          </div>

          {/* use_on_task confirm UI */}
          {pendingContext?.type === 'use_on_task' && uotStep === 'loading' && (
            <div className="border-t border-gray-200 dark:border-neutral-700 pt-3 mt-1">
              <p className="text-sm text-gray-600 dark:text-neutral-400">Looking up item…</p>
            </div>
          )}
          {pendingContext?.type === 'use_on_task' && uotStep === 'confirm' && uotItem && (
            <div className="border-t border-gray-200 dark:border-neutral-700 pt-3 mt-1 space-y-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="font-semibold text-gray-900 dark:text-neutral-100">{uotItem.name}</p>
                <p className="text-sm text-gray-600 dark:text-neutral-400">
                  In stock: <strong>{uotItem.quantity ?? 0}</strong> {uotItem.unit || 'each'}
                  {uotItem.category_name && <span> · {uotItem.category_name}</span>}
                </p>
              </div>
              {uotError && <p className="text-sm text-red-600">{uotError}</p>}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-neutral-100 whitespace-nowrap">Qty used:</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={uotQty}
                  onChange={(e) => setUotQty(e.target.value)}
                  className="w-24 min-h-10 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 text-sm"
                  autoFocus
                />
                <span className="text-sm text-gray-500">{uotItem.unit || 'each'}</span>
              </div>
              {!pendingContext.task_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Task:</label>
                  <select
                    value={uotTaskId}
                    onChange={(e) => setUotTaskId(e.target.value)}
                    className="w-full min-h-10 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 text-sm"
                  >
                    <option value="">Select task…</option>
                    {uotTasks.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              )}
              {pendingContext.task_id && pendingContext.task_title && (
                <p className="text-sm text-gray-600 dark:text-neutral-400">Task: <strong>{pendingContext.task_title}</strong></p>
              )}
              <button
                type="button"
                onClick={handleUotSubmit}
                className="w-full min-h-12 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90"
              >
                Use Item on Task
              </button>
            </div>
          )}
          {pendingContext?.type === 'use_on_task' && uotStep === 'submitting' && (
            <div className="border-t border-gray-200 dark:border-neutral-700 pt-3 mt-1">
              <p className="text-sm text-gray-600">Recording usage…</p>
            </div>
          )}
          {pendingContext?.type === 'use_on_task' && uotStep === 'success' && (
            <div className="border-t border-green-200 pt-3 mt-1">
              <p className="text-sm font-medium text-green-700">✓ Item used on task! Inventory updated.</p>
            </div>
          )}
          {pendingContext?.type === 'use_on_task' && !uotStep && (
            <div className="border-t border-gray-200 dark:border-neutral-700 pt-3 mt-1 space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-neutral-100">
                Scan an item to log it on a task and deduct from stock.
              </p>
              {uotError && <p className="text-sm text-red-600">{uotError}</p>}
              <form onSubmit={(e) => { e.preventDefault(); if (manualBarcode.trim()) { handleUotScan(manualBarcode.trim()); setManualBarcode(''); }}} className="flex gap-2">
                <input
                  type="text"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="Enter barcode manually"
                  className="flex-1 min-h-10 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 font-mono text-sm"
                  autoComplete="off"
                />
                <button type="submit" disabled={!manualBarcode.trim()} className="min-h-10 px-3 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50">Search</button>
              </form>
            </div>
          )}

          {/* batch_receive UI */}
          {pendingContext?.type === 'batch_receive' && (
            <div className="border-t border-gray-200 dark:border-neutral-700 pt-3 mt-1 space-y-3">
              {/* Running total header */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-neutral-100">
                  Batch receive — scanner stays open
                </p>
                {batchItems.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                    {batchItems.length} item{batchItems.length !== 1 ? 's' : ''} scanned
                  </span>
                )}
              </div>
              {batchLookupLoading && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400">
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Looking up item…
                </div>
              )}
              {batchError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-red-600 dark:text-red-400">{batchError}</p>
                </div>
              )}
              {batchItems.length > 0 && (
                <ul className="space-y-1 max-h-44 overflow-y-auto rounded-lg border border-gray-200 dark:border-neutral-700">
                  {batchItems.map((b, idx) => (
                    <li
                      key={b.item.id}
                      className={`flex items-center gap-2 px-3 py-2 transition-colors ${
                        b.item.id === lastScannedId
                          ? 'bg-primary/10 dark:bg-primary/15 border-l-2 border-primary'
                          : idx % 2 === 0
                            ? 'bg-white dark:bg-neutral-950'
                            : 'bg-gray-50 dark:bg-neutral-950/80'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-neutral-100 truncate block">
                          {b.item.id === lastScannedId && <span className="text-primary mr-1">→</span>}
                          {b.item.name}
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={b.qty}
                        onChange={(e) => setBatchItems((prev) => prev.map((x) => x.item.id === b.item.id ? { ...x, qty: e.target.value } : x))}
                        className="w-16 px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                      />
                      <span className="text-xs text-gray-400 dark:text-neutral-400 w-6 text-right">{b.item.unit || 'ea'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setBatchItems((prev) => prev.filter((x) => x.item.id !== b.item.id));
                          batchScannedRef.current.delete(b.barcode);
                          if (lastScannedId === b.item.id) setLastScannedId(null);
                        }}
                        className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50 flex-shrink-0 transition-colors"
                        aria-label="Remove item"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {batchItems.length === 0 && !batchLookupLoading && (
                <div className="flex flex-col items-center py-4 text-gray-400 dark:text-neutral-500">
                  <svg className="w-8 h-8 mb-1 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17 14h.01M14 17h.01M17 17h.01M20 17h.01M20 14h.01M14 20h.01M17 20h.01M20 20h.01" />
                  </svg>
                  <p className="text-xs">Scan your first item to begin</p>
                </div>
              )}
              {batchSuccess ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">All items received successfully!</p>
                </div>
              ) : batchConfirming ? (
                <div className="space-y-2">
                  <div className="px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-300">
                    Confirm receiving <strong>{batchItems.length} item{batchItems.length !== 1 ? 's' : ''}</strong> into stock?
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBatchConfirming(false)}
                      className="flex-1 min-h-10 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-100 text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleBatchSubmit}
                      disabled={batchSubmitting}
                      className="flex-1 min-h-10 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {batchSubmitting ? 'Receiving…' : 'Yes, Receive All'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleBatchSubmit}
                  disabled={batchItems.length === 0 || batchSubmitting}
                  className="w-full min-h-10 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Receive All ({batchItems.length} item{batchItems.length !== 1 ? 's' : ''})
                </button>
              )}
            </div>
          )}

          {pendingContext && descriptionText && pendingContext.type !== 'use_on_task' && pendingContext.type !== 'batch_receive' && (
            <div className="border-t border-gray-200 dark:border-neutral-700 pt-3 mt-1 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-neutral-100">
                {pendingContext.type === 'add_quantity' && <>Adding quantity for: <strong className="text-gray-900 dark:text-neutral-100">{descriptionText}</strong></>}
                {pendingContext.type === 'add_barcode' && <>Adding barcode for: <strong className="text-gray-900 dark:text-neutral-100">{descriptionText}</strong></>}
                {pendingContext.type === 'refill_receive' && <>Receiving: <strong className="text-gray-900 dark:text-neutral-100">{descriptionText}</strong></>}
                {pendingContext.type === 'use_item' && <>Scan to use: <strong className="text-gray-900 dark:text-neutral-100">{descriptionText}</strong></>}
              </p>
              <p className="text-xs text-gray-500 dark:text-neutral-400">
                Barcode won&apos;t scan? Enter the barcode or SKU below.
              </p>
              <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="Enter barcode or SKU"
                  className="flex-1 min-h-12 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 font-mono text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  aria-label="Barcode or SKU"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!(manualBarcode || '').trim()}
                  className="min-h-12 px-4 py-2 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Use this barcode
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Success toast */}
      {showSuccessToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-5 py-3 rounded-2xl bg-green-600 text-white shadow-2xl text-sm font-semibold animate-toast-in pointer-events-none">
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {batchItems.length} item{batchItems.length !== 1 ? 's' : ''} received into stock!
        </div>
      )}

      <style>{`
        @keyframes scanline {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
        .animate-scanline {
          animation: scanline 1.5s ease-in-out infinite;
        }
        @keyframes tap-focus {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(0.8); }
          70% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.2); }
        }
        .animate-tap-focus {
          animation: tap-focus 0.7s ease-out forwards;
        }
        @keyframes toast-in {
          0% { opacity: 0; transform: translateX(-50%) translateY(1rem) scale(0.95); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        .animate-toast-in {
          animation: toast-in 0.25s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default BarcodeScannerModal;
