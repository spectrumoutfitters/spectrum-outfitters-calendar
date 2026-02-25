import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

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
 * Optional context when scan is for a specific action (add quantity, add barcode, refill receive).
 * When set, the modal shows the item description and a manual barcode/SKU entry field.
 * @typedef {{ type: 'add_quantity'|'add_barcode'|'refill_receive', item?: { name: string }, itemName?: string, qty?: number }} PendingContext
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
  const [focusPoint, setFocusPoint] = useState(null); // { x, y } in % for indicator, cleared after delay
  const [manualBarcode, setManualBarcode] = useState('');

  onCloseRef.current = onClose;
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!isOpen) setManualBarcode('');
  }, [isOpen]);

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
              onDetectedRef.current(text);
              onCloseRef.current();
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
        className="relative w-full max-w-xl bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-200 dark:border-neutral-700 flex flex-col overflow-hidden max-h-[100dvh] sm:max-h-[90vh] md:max-h-[85vh] flex-1 sm:flex-initial min-h-0"
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
            className="relative rounded-xl overflow-hidden border-2 border-gray-300 dark:border-neutral-600 bg-black flex-shrink-0"
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
            <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">
              {starting ? 'Starting camera…' : scanning ? 'Align the barcode or QR code in the frame' : 'Point the camera at a barcode or QR code.'}
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
              Scans barcodes (UPC, EAN, Code 128) and QR codes.
            </p>
          </div>

          {pendingContext && descriptionText && (
            <div className="border-t border-gray-200 dark:border-neutral-700 pt-3 mt-1 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">
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
                  className="flex-1 min-h-12 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 font-mono text-sm focus:ring-2 focus:ring-primary focus:border-primary"
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
      `}</style>
    </div>
  );
};

export default BarcodeScannerModal;
