import React from 'react';

/**
 * Color reference for inventory status. Use on any page that shows inventory tiles/cards with status colors.
 */
const LEGEND_ITEMS = [
  { label: 'Needs return', colorClass: 'bg-orange-100 border-orange-500', dotClass: 'bg-orange-500' },
  { label: 'Out of stock', colorClass: 'bg-red-50 border-red-300', dotClass: 'bg-red-500' },
  { label: 'Low stock', colorClass: 'bg-amber-50 border-amber-300', dotClass: 'bg-amber-500' },
  { label: 'In stock', colorClass: 'bg-green-50 border-green-300', dotClass: 'bg-green-500' },
  { label: 'No min set', colorClass: 'bg-gray-50 border-gray-200', dotClass: 'bg-gray-400' },
];

export default function InventoryColorLegend({ className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 ${className}`} role="list" aria-label="Inventory status colors">
      <span className="font-medium text-gray-700 mr-1">Colors:</span>
      {LEGEND_ITEMS.map(({ label, colorClass, dotClass }) => (
        <span key={label} className="inline-flex items-center gap-1.5" role="listitem">
          <span className={`w-3 h-3 rounded-full ${dotClass}`} aria-hidden />
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}
