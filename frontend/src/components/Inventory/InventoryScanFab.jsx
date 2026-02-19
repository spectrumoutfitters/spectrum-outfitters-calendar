import React from 'react';
import { useOpenScan } from '../../contexts/OpenScanContext';

const cameraSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

export default function InventoryScanFab() {
  const openScan = useOpenScan();
  if (!cameraSupported || !openScan?.openScanner) return null;

  return (
    <button
      type="button"
      onClick={() => openScan.openScanner()}
      className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 active:scale-95 focus:outline-none focus:ring-4 focus:ring-primary/30 touch-manipulation transition-transform flex-shrink-0"
      title="Quick scan barcode"
      aria-label="Open camera to scan barcode"
    >
      <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 13v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7" />
      </svg>
    </button>
  );
}
