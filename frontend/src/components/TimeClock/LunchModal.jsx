import React from 'react';

const LunchModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-8 text-center" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Enjoy Your Lunch! 🍽️</h2>
          <p className="text-gray-600 mb-4">
            Your clock has been stopped for your lunch break.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800 text-sm leading-relaxed">
              Take your time and enjoy your meal. We'll see you back in about an hour! 
              When you return, just click "Clock In" to resume your day.
            </p>
          </div>
          <p className="text-sm text-gray-500">
            Have a great lunch! 😊
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-semibold"
        >
          Got it, thanks!
        </button>
      </div>
    </div>
  );
};

export default LunchModal;

