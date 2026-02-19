import React, { useState } from 'react';
import api from '../../utils/api';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';

const PartsArrivedModal = ({ onClose }) => {
  // VERSION 2.0 - Text input only, no task loading
  const { user } = useAuth();
  const { socket } = useSocket();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    vehicle: '',
    distributor: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.vehicle.trim()) {
      setError('Please enter the vehicle/car information');
      return;
    }

    if (!formData.distributor.trim()) {
      setError('Please enter the parts distributor');
      return;
    }

    try {
      setSubmitting(true);
      
      // Send quick notification to admins with vehicle information
      await api.post('/notifications/quick', {
        type: 'parts_arrived',
        taskTitle: formData.vehicle.trim(), // Using vehicle as taskTitle for backward compatibility
        vehicle: formData.vehicle.trim(),
        distributor: formData.distributor.trim(),
      });

      // Show success message
      alert(`✅ Notification sent! Admins have been notified that parts arrived for ${formData.vehicle.trim()} from ${formData.distributor.trim()}.`);
      
      // Close modal
      onClose();
    } catch (error) {
      console.error('Error sending notification:', error);
      setError(error.response?.data?.error || 'Failed to send notification. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Parts Arrived</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="vehicle" className="block text-sm font-medium text-gray-700 mb-2">
              What Car Is This For? <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="vehicle"
              value={formData.vehicle}
              onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
              placeholder="e.g., 2020 Lexus RX350, 2018 Ford F150, Thomas Audi S5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">Enter the vehicle information (year, make, model, or customer name)</p>
          </div>

          <div>
            <label htmlFor="distributor" className="block text-sm font-medium text-gray-700 mb-2">
              Parts Distributor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="distributor"
              value={formData.distributor}
              onChange={(e) => setFormData({ ...formData, distributor: e.target.value })}
              placeholder="e.g., AutoZone, NAPA, O'Reilly"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              {submitting ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PartsArrivedModal;

