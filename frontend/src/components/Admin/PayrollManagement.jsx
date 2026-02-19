import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

const PayrollManagement = () => {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAccess();
  }, []);

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
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !hasAccess) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">{error || 'You do not have access to the payroll system.'}</p>
          <p className="text-sm text-gray-500">Contact the master admin to request access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">💰 Payroll System</h1>
        <p className="text-gray-600 mb-6">
          Access the Spectrum Outfitters Payroll Management System. This system contains sensitive financial information.
        </p>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>⚠️ Security Notice:</strong> This system contains sensitive payroll and financial information. 
            Only authorized personnel should access this system.
          </p>
        </div>

        <div className="border-2 border-gray-300 rounded-lg overflow-hidden" style={{ height: '800px' }}>
          <iframe
            src="/payroll-system/index.html"
            title="Payroll System"
            className="w-full h-full border-0"
            style={{ minHeight: '800px' }}
            onError={(e) => {
              console.error('Iframe load error:', e);
              setError('Failed to load payroll system. Please check if the payroll system files are accessible.');
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default PayrollManagement;

