import React, { useState } from 'react';

const CleanupReminderModal = ({ message, onAcknowledge }) => {
  const [acknowledged, setAcknowledged] = useState(false);

  // Log when modal is rendered
  React.useEffect(() => {
    console.log('[Cleanup Reminder] Modal rendered with message:', message?.substring(0, 50) + '...');
  }, [message]);

  const handleAcknowledge = () => {
    if (acknowledged) {
      console.log('[Cleanup Reminder] User acknowledged');
      onAcknowledge();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-blue-100 rounded-full p-3">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
          End of Day Reminder
        </h2>
        
        <div className="mb-6">
          <p className="text-gray-700 text-center text-base leading-relaxed whitespace-pre-line">
            {message || 'Great work today! Before you head out, let\'s finish strong by ensuring our entire shop is clean and ready for tomorrow. A clean shop is a professional shop, and it shows pride in our work. Thank you for being part of a team that takes pride in our workspace!'}
          </p>
        </div>
        
        <div className="mb-6">
          <label className="flex items-center justify-center cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="ml-3 text-gray-700 font-medium">
              I acknowledge and will help keep the shop clean and organized
            </span>
          </label>
        </div>
        
        <button
          onClick={handleAcknowledge}
          disabled={!acknowledged}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition ${
            acknowledged
              ? 'bg-blue-600 hover:bg-blue-700 active:scale-95'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default CleanupReminderModal;

