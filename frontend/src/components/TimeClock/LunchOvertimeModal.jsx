import React from 'react';

const LunchOvertimeModal = ({ overtimeMinutes, onClose }) => {
  const hours = Math.floor(overtimeMinutes / 60);
  const minutes = overtimeMinutes % 60;
  const timeString = hours > 0 
    ? `${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`
    : `${minutes} minute${minutes !== 1 ? 's' : ''}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-8 text-center" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <div className="mx-auto w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Lunch Break Notice</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 text-sm leading-relaxed mb-2">
              Your lunch break was longer than the standard 1 hour.
            </p>
            <p className="text-yellow-800 font-semibold">
              You took an additional <span className="text-yellow-900">{timeString}</span> beyond the 1-hour lunch period.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            This has been noted and your supervisor has been notified. No action is needed from you.
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-semibold"
        >
          Understood
        </button>
      </div>
    </div>
  );
};

export default LunchOvertimeModal;

