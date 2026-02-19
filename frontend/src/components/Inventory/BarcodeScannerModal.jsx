import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatOneDReader } from '@zxing/browser';

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

const BarcodeScannerModal = ({ isOpen, onClose, onDetected }) => {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const readerRef = useRef(null);

  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [scanning, setScanning] = useState(false);

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
      // 1D barcodes only: UPC-A, EAN-13, Code 128, etc. — no QR codes
      const reader = new BrowserMultiFormatOneDReader();
      readerRef.current = reader;

      try {
        const videoEl = videoRef.current;
        if (!videoEl) {
          setError('Camera element not ready.');
          return;
        }

        const constraints = {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' }
          }
        };

        const controls = await reader.decodeFromConstraints(constraints, videoEl, (result, err) => {
          if (result?.getText) {
            const text = result.getText();
            if (text) {
              playScanBeep();
              onDetected(text);
              onClose();
            }
            return;
          }

          if (err && err?.name !== 'NotFoundException') {
            console.warn('Scanner error:', err);
          }
        });

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
  }, [isOpen, onClose, onDetected]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))', paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="font-semibold text-gray-900 text-lg">Scan barcode</div>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 touch-manipulation" aria-label="Close">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-auto flex-1 min-h-0">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="relative rounded-xl overflow-hidden border-2 border-gray-300 bg-black flex-shrink-0">
            <video
              ref={videoRef}
              className="w-full h-[240px] sm:h-[280px] md:h-[320px] object-cover"
              muted
              playsInline
              autoPlay
            />
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

          <div className="text-center py-2">
            <p className="text-sm font-medium text-gray-700">
              {starting ? 'Starting camera…' : scanning ? 'Align the barcode within the frame' : 'Point the camera at a product barcode (UPC / EAN).'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Scans 1D barcodes only — QR codes are ignored.
            </p>
          </div>
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
      `}</style>
    </div>
  );
};

export default BarcodeScannerModal;
