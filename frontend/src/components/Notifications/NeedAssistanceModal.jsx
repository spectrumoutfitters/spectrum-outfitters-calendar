import React, { useState } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

const NeedAssistanceModal = ({ onClose }) => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [urgency, setUrgency] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!urgency) {
      setError('Please select an urgency level');
      return;
    }

    try {
      setSubmitting(true);
      
      // Send quick notification to admins
      await api.post('/notifications/quick', {
        type: 'need_assistance',
        urgency: urgency,
      });

      // Show success message
      const urgencyText = urgency === 'immediate' ? 'Immediate' : 'At First Convenience';
      alert(`✅ Notification sent! Admins have been notified that you need ${urgencyText.toLowerCase()} assistance.`);
      
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
      <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Need Assistance</h2>
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
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Urgency Level <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setUrgency('immediate')}
                className={`w-full px-4 py-4 rounded-lg border-2 transition text-left ${
                  urgency === 'immediate'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    urgency === 'immediate' ? 'border-red-500' : 'border-gray-400'
                  }`}>
                    {urgency === 'immediate' && (
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-lg">🚨 Immediate</div>
                    <div className="text-sm text-gray-600">I need help right away</div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setUrgency('convenience')}
                className={`w-full px-4 py-4 rounded-lg border-2 transition text-left ${
                  urgency === 'convenience'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    urgency === 'convenience' ? 'border-blue-500' : 'border-gray-400'
                  }`}>
                    {urgency === 'convenience' && (
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-lg">⏰ At First Convenience</div>
                    <div className="text-sm text-gray-600">When you have a moment</div>
                  </div>
                </div>
              </button>
            </div>
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
              disabled={submitting || !urgency}
            >
              {submitting ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NeedAssistanceModal;

