import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import PartsArrivedModal from './PartsArrivedModal';
import NeedAssistanceModal from './NeedAssistanceModal';
import CustomerArrivedModal from './CustomerArrivedModal';

const QuickNotificationButton = ({ stacked = false }) => {
  const { user, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showPartsArrived, setShowPartsArrived] = useState(false);
  const [showNeedAssistance, setShowNeedAssistance] = useState(false);
  const [showCustomerArrived, setShowCustomerArrived] = useState(false);

  // Only show for employees
  if (isAdmin || !user) return null;

  const notificationButton = (
    <button
      onClick={() => setIsOpen(true)}
      className="bg-green-600 text-white rounded-full w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center flex-shrink-0 shadow-lg hover:bg-green-700 transition relative active:scale-95"
      title="Quick Notifications"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    </button>
  );

  if (isOpen) {
    return (
      <>
        <div className="fixed bottom-28 right-2 md:right-6 z-50">
        <div className="bg-white rounded-lg shadow-2xl p-3 md:p-4 min-w-[200px] max-w-[90vw]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-lg text-gray-800">Quick Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => {
                setShowPartsArrived(true);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition text-left flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span>Parts Arrived</span>
            </button>
            <button
              onClick={() => {
                setShowNeedAssistance(true);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-left flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>Need Assistance</span>
            </button>
            <button
              onClick={() => {
                setShowCustomerArrived(true);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-left flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Customer Arrived</span>
            </button>
            {/* Add more quick notification buttons here in the future */}
          </div>
        </div>
      </div>
    </>
    );
  }

  return (
    <>
      {stacked ? notificationButton : (
        <div className="fixed bottom-28 right-6 z-50">
          {notificationButton}
        </div>
      )}
      {showPartsArrived && (
        <PartsArrivedModal
          onClose={() => setShowPartsArrived(false)}
        />
      )}
      {showNeedAssistance && (
        <NeedAssistanceModal
          onClose={() => setShowNeedAssistance(false)}
        />
      )}
      {showCustomerArrived && (
        <CustomerArrivedModal
          onClose={() => setShowCustomerArrived(false)}
        />
      )}
    </>
  );
};

export default QuickNotificationButton;

