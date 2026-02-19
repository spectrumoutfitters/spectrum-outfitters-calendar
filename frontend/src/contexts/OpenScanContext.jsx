import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

const OpenScanContext = createContext(null);

export function OpenScanProvider({ children }) {
  const openScannerRef = useRef(null);

  const registerOpenScanner = useCallback((fn) => {
    openScannerRef.current = fn;
  }, []);

  const unregisterOpenScanner = useCallback(() => {
    openScannerRef.current = null;
  }, []);

  const openScanner = useCallback(() => {
    if (openScannerRef.current) openScannerRef.current();
  }, []);

  return (
    <OpenScanContext.Provider value={{ registerOpenScanner, unregisterOpenScanner, openScanner }}>
      {children}
    </OpenScanContext.Provider>
  );
}

export function useOpenScan() {
  const ctx = useContext(OpenScanContext);
  return ctx;
}
