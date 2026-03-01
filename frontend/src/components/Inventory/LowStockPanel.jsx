import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const LowStockPanel = ({ onNavigateToInventory }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reorderingAll, setReorderingAll] = useState(false);
  const [reorderingIds, setReorderingIds] = useState(new Set());
  const [reorderedIds, setReorderedIds] = useState(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/low-stock');
      setItems(res.data?.items || []);
    } catch (e) {
      console.error('Low stock load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const requestReorder = async (item) => {
    if (reorderedIds.has(item.id)) return;
    setReorderingIds((prev) => new Set([...prev, item.id]));
    try {
      await api.post('/inventory/refill-requests', { item_id: item.id });
      setReorderedIds((prev) => new Set([...prev, item.id]));
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to request reorder');
    } finally {
      setReorderingIds((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  };

  const requestReorderAll = async () => {
    setReorderingAll(true);
    const toRequest = items.filter((it) => !reorderedIds.has(it.id));
    for (const item of toRequest) {
      try {
        await api.post('/inventory/refill-requests', { item_id: item.id });
        setReorderedIds((prev) => new Set([...prev, item.id]));
      } catch (_) {}
    }
    setReorderingAll(false);
  };

  if (loading) return (
    <div className="p-4 text-center text-gray-500 text-sm">Checking stock levels…</div>
  );

  if (items.length === 0) return (
    <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
      <span>✓</span>
      <span>All items are stocked</span>
    </div>
  );

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-amber-200 dark:border-amber-700 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <span className="font-semibold text-amber-800 dark:text-amber-300">
            Low Stock — {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={requestReorderAll}
          disabled={reorderingAll || items.every((it) => reorderedIds.has(it.id))}
          className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition"
        >
          {reorderingAll ? 'Requesting…' : 'Reorder All'}
        </button>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
        {items.map((item) => {
          const isOut = (item.quantity ?? 0) <= 0;
          const requested = reorderedIds.has(item.id);
          return (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOut ? 'bg-red-500' : 'bg-amber-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 dark:text-neutral-100 truncate">{item.name}</p>
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  {item.category_name && <span>{item.category_name} · </span>}
                  <span className={isOut ? 'text-red-600 font-semibold' : 'text-amber-700 font-semibold'}>
                    {item.quantity ?? 0} {item.unit || 'each'}
                  </span>
                  {item.min_quantity != null && (
                    <span className="text-gray-400"> (min: {item.min_quantity})</span>
                  )}
                </p>
              </div>
              {requested ? (
                <span className="text-xs text-green-600 font-medium">Requested ✓</span>
              ) : (
                <button
                  onClick={() => requestReorder(item)}
                  disabled={reorderingIds.has(item.id)}
                  className="text-xs px-2 py-1 border border-amber-400 text-amber-700 rounded-lg hover:bg-amber-50 disabled:opacity-50 transition"
                >
                  {reorderingIds.has(item.id) ? '…' : 'Request Reorder'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LowStockPanel;
