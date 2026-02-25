import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

const PAYROLL_IFRAME_LOAD_TIMEOUT_MS = 12000;

const PayrollManagement = () => {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [iframeLoadFailed, setIframeLoadFailed] = useState(false);
  const loadTimeoutRef = useRef(null);

  useEffect(() => {
    checkAccess();
  }, []);

  // If iframe hasn't loaded within 12s, show fallback (onError often doesn't fire for iframes)
  useEffect(() => {
    if (!hasAccess || loading) return;
    setIframeLoadFailed(false);
    loadTimeoutRef.current = setTimeout(() => setIframeLoadFailed(true), PAYROLL_IFRAME_LOAD_TIMEOUT_MS);
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [hasAccess, loading]);

  const checkAccess = async () => {
    try {
      const response = await api.get('/payroll/access');
      setHasAccess(response.data.hasAccess);
      if (!response.data.hasAccess) {
        setError('You do not have access to the payroll system. Contact the master admin.');
      }
    } catch (err) {
      console.error('Error checking payroll access:', err);
      setError(err.response?.data?.error || 'Error checking access');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-neutral-300">Loading...</div>
      </div>
    );
  }

  if (error || !hasAccess) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-neutral-100 mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-neutral-300 mb-4">{error || 'You do not have access to the payroll system.'}</p>
          <p className="text-sm text-gray-500 dark:text-neutral-400">Contact the master admin to request access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100 mb-4">💰 Payroll System</h1>
        <p className="text-gray-600 dark:text-neutral-300 mb-6">
          Access the Spectrum Outfitters Payroll Management System. This system contains sensitive financial information.
        </p>
        
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>⚠️ Security Notice:</strong> This system contains sensitive payroll and financial information. 
            Only authorized personnel should access this system.
          </p>
        </div>

        <div className="border-2 border-gray-300 dark:border-neutral-600 rounded-lg overflow-hidden" style={{ height: '800px' }}>
          {iframeLoadFailed ? (
            <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-neutral-800 p-8 text-center">
              <span className="text-4xl" aria-hidden>⚠️</span>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-neutral-100">Payroll app not available</h3>
              <p className="text-sm text-gray-600 dark:text-neutral-300 max-w-md">
                The payroll system could not be loaded. It may not be configured or the payroll app files are not accessible at <code className="text-xs bg-gray-200 dark:bg-neutral-700 px-1 rounded">/payroll-system/</code>.
              </p>
              <p className="text-xs text-gray-500 dark:text-neutral-400">Check with your administrator or refer to setup documentation.</p>
            </div>
          ) : (
            <iframe
              src="/payroll-system/index.html"
              title="Payroll System"
              className="w-full h-full border-0"
              style={{ minHeight: '800px' }}
              onLoad={() => {
                if (loadTimeoutRef.current) {
                  clearTimeout(loadTimeoutRef.current);
                  loadTimeoutRef.current = null;
                }
                setIframeLoadFailed(false);
              }}
              onError={() => {
                setIframeLoadFailed(true);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PayrollManagement;

