import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const ShopMonkeyItemSelector = ({ workItems, vehicleInfo, order, onConfirm, onCancel }) => {
  console.log('🎯🎯🎯 ShopMonkeyItemSelector COMPONENT RENDERED!');
  console.log('🎯 Props received:', { workItems, vehicleInfo, order });
  console.log('🎯 ShopMonkeyItemSelector RENDERED with workItems:', workItems);
  
  // Ensure workItems is an array
  const safeWorkItems = Array.isArray(workItems) ? workItems : [];
  console.log('Safe work items:', safeWorkItems);
  
  const [selectedItems, setSelectedItems] = useState(
    safeWorkItems.map(item => ({ ...item, selected: item.selected !== false }))
  );
  const [selectAll, setSelectAll] = useState(safeWorkItems.length > 0 && safeWorkItems.every(item => item.selected !== false));
  
  // Update when workItems prop changes
  useEffect(() => {
    console.log('🔄 ShopMonkeyItemSelector: workItems prop changed:', workItems);
    const safeItems = Array.isArray(workItems) ? workItems : [];
    setSelectedItems(safeItems.map(item => ({ ...item, selected: item.selected !== false })));
    setSelectAll(safeItems.length > 0 && safeItems.every(item => item.selected !== false));
  }, [workItems]);

  const toggleItem = (index) => {
    const updated = [...selectedItems];
    updated[index].selected = !updated[index].selected;
    setSelectedItems(updated);
    setSelectAll(updated.every(item => item.selected));
  };

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setSelectedItems(selectedItems.map(item => ({ ...item, selected: newSelectAll })));
  };

  const handleConfirm = () => {
    const selected = selectedItems.filter(item => item.selected);
    onConfirm(selected);
  };

  const selectedCount = selectedItems.filter(item => item.selected).length;

  console.log('🎯 ShopMonkeyItemSelector: Rendering modal with', safeWorkItems.length, 'items');
  
  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]" 
      style={{ 
        zIndex: 99999, 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        margin: 0,
        padding: 0
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          console.log('Modal backdrop clicked, canceling');
          onCancel();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        style={{ zIndex: 100000 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Select Work Items to Import</h2>
            <p className="text-sm text-blue-100 mt-1">
              {vehicleInfo.year && vehicleInfo.make && vehicleInfo.model
                ? `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`
                : 'ShopMonkey Order'}
              {order.number && ` - RO #${order.number}`}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-white hover:text-gray-200 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Vehicle Info */}
        {vehicleInfo && (vehicleInfo.year || vehicleInfo.make || vehicleInfo.model || vehicleInfo.vin) && (
          <div className="bg-gray-50 p-3 border-b">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {vehicleInfo.year && vehicleInfo.make && vehicleInfo.model && (
                <div>
                  <span className="font-semibold">Vehicle:</span>{' '}
                  {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
                </div>
              )}
              {vehicleInfo.vin && (
                <div>
                  <span className="font-semibold">VIN:</span> {vehicleInfo.vin}
                </div>
              )}
              {vehicleInfo.mileage && (
                <div>
                  <span className="font-semibold">Mileage:</span> {vehicleInfo.mileage}
                </div>
              )}
              {vehicleInfo.customerName && (
                <div>
                  <span className="font-semibold">Customer:</span> {vehicleInfo.customerName}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selection Controls */}
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="mr-2 w-4 h-4"
              />
              <span className="font-semibold">Select All</span>
            </label>
            <span className="text-sm text-gray-600">
              {selectedCount} of {selectedItems.length} items selected
            </span>
          </div>
          {selectedItems.some(item => item.source === 'ai') && (
            <div className="text-xs text-blue-600">
              <span className="font-semibold">✨</span> AI-enhanced items available
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedItems.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p className="mb-2">No work items found in this repair order.</p>
              <p className="text-sm">The order may not have line items available, or extraction failed.</p>
              <button
                onClick={onCancel}
                className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((item, index) => (
                <label
                  key={index}
                  className={`flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                    item.selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.selected || false}
                    onChange={() => toggleItem(index)}
                    className="mt-1 mr-3 w-4 h-4 flex-shrink-0 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      {item.source === 'ai' && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          AI
                        </span>
                      )}
                      {item.order && (
                        <span className="text-xs text-gray-500">#{item.order}</span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Import {selectedCount} {selectedCount === 1 ? 'Item' : 'Items'}
          </button>
        </div>
      </div>
    </div>
  );
  
  // Render using portal to document body to escape parent modal constraints
  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default ShopMonkeyItemSelector;

