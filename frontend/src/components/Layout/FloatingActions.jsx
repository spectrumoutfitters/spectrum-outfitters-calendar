import React from 'react';
import { useLocation } from 'react-router-dom';
import ChatBubble from '../Chat/ChatBubble';
import QuickNotificationButton from '../Notifications/QuickNotificationButton';
import InventoryScanFab from '../Inventory/InventoryScanFab';

/**
 * Single fixed container that stacks all floating action buttons (chat, notifications, inventory scan)
 * so they don't overlap. Order from bottom: Chat, then Notifications (if employee), then Scan (if on inventory).
 */
export default function FloatingActions() {
  const location = useLocation();
  const tab = new URLSearchParams(location.search).get('tab');
  const onAdminInventory = location.pathname.toLowerCase().includes('admin') && tab === 'inventory';
  const onInventory = location.pathname.toLowerCase().includes('inventory') || onAdminInventory;

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
    </div>
  );
}
