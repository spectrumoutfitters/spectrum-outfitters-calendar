import React from 'react';
import { useLocation } from 'react-router-dom';
import ChatBubble from '../Chat/ChatBubble';
import QuickNotificationButton from '../Notifications/QuickNotificationButton';
import InventoryScanFab from '../Inventory/InventoryScanFab';
import QuickClockButton from '../TimeEntry/QuickClockButton';
import {
  isInventoryPath,
  isPublicCustomerPath,
  shouldShowClockFab,
} from '../../utils/employeeFloatingActionsGate';

/**
 * Single fixed container that stacks all floating action buttons (chat, notifications, inventory scan)
 * so they don't overlap. Order from bottom: Chat, then Notifications (if employee), then Scan (if on inventory).
 */
export default function FloatingActions() {
  const location = useLocation();
  const onInventory = isInventoryPath(location.pathname, location.search);
  // Public customer-facing pages shouldn't show employee floating actions / clock.
  if (isPublicCustomerPath(location.pathname)) return null;

  const showClockFab = shouldShowClockFab(location.pathname);

  return (
    <div
      className="fixed z-50 flex flex-col-reverse gap-3 items-end"
      style={{
        bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
        right: 'max(1rem, env(safe-area-inset-right, 1rem))'
      }}
    >
      <ChatBubble stacked />
      <QuickNotificationButton stacked />
      {onInventory && <InventoryScanFab />}
      {showClockFab && <QuickClockButton compact />}
    </div>
  );
}
