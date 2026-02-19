import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import InventoryColorLegend from '../Inventory/InventoryColorLegend';

const safeNumber = (v) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const categoryIcon = (name) => {
  const n = (name || '').toLowerCase();
  if (n.includes('oil') || n.includes('fluid')) return '🛢️';
  if (n.includes('clean')) return '🧹';
  if (n.includes('spray') || n.includes('paint')) return '🎨';
  if (n.includes('hardware')) return '🔧';
  return '📦';
};

// For fluids: when size_per_unit is set (e.g. "32" or "32 oz"), show actual amount. E.g. 0.5 of a 32 oz bottle = 16 oz.
const formatQuantityWithSize = (item) => {
  const q = item?.quantity;
  const u = item?.unit || 'each';
  const s = item?.size_per_unit;
  const base = `${q ?? 0} ${u}`;
  if (s == null || s === '' || q == null) return base;
  const match = String(s).trim().match(/^([\d.]+)\s*(.*)$/);
  if (!match) return base;
  const sizeNum = parseFloat(match[1]);
  let suffix = (match[2] || '').trim();
  if (!Number.isFinite(sizeNum)) return base;
  const equiv = q * sizeNum;
  const equivStr = Number.isInteger(equiv) ? String(equiv) : equiv.toFixed(1).replace(/\.0$/, '');
  if (!suffix) suffix = 'oz';
  return `${equivStr} ${suffix} (${q} of ${sizeNum} ${suffix})`;
};

const getTileColorClass = (item) => {
  const needsReturn = Boolean(item?.needs_return) && !item?.returned_at;
  if (needsReturn) return 'border-2 border-orange-500 bg-orange-100';
  const q = item?.quantity ?? 0;
  const min = item?.min_quantity;
  if (min == null || min === '') return 'border-gray-200';
  if (q <= 0) return 'border-red-300 bg-red-50';
  if (q < min) return 'border-amber-300 bg-amber-50';
  return 'border-green-300 bg-green-50';
};

const getInventoryLevel = (item) => {
  const needsReturn = Boolean(item?.needs_return) && !item?.returned_at;
  if (needsReturn) return 'return_needed';
  const q = item?.quantity ?? 0;
  const min = item?.min_quantity;
  if (min == null || min === '') return 'no_min';
  if (q <= 0) return 'out';
  if (q < min) return 'low';
  return 'ok';
};

const LEVEL_ORDER = ['return_needed', 'out', 'low', 'ok', 'no_min'];
const LEVEL_LABELS = {
  return_needed: 'Needs return',
  out: 'Out of stock',
  low: 'Low stock',
  ok: 'In stock',
  no_min: 'No min set'
};
const ATTENTION_LEVELS = new Set(['return_needed', 'out', 'low']);

const InventoryManagement = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const categoriesById = useMemo(() => {
    const map = new Map();
    for (const c of categories) map.set(String(c.id), c);
    return map;
  }, [categories]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    barcode: '',
    name: '',
    category_id: '',
    unit: 'each',
    price: '',
    quantity: '',
    image_url: '',
    size_per_unit: '',
    min_quantity: '',
    keep_in_stock: true,
    needs_return: false,
    return_supplier: ''
  });
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [fetchImageLoading, setFetchImageLoading] = useState(false);

  const [searchParams] = useSearchParams();
  const showRefills = searchParams.get('refills') === '1';
  const [refillRequests, setRefillRequests] = useState([]);
  const [refillLoading, setRefillLoading] = useState(false);
  const [refillSavingId, setRefillSavingId] = useState(null);
  const [refillDeletingId, setRefillDeletingId] = useState(null);
  const [refillEdit, setRefillEdit] = useState({});
  const refillSectionRef = useRef(null);
  const [markReturnedLoadingId, setMarkReturnedLoadingId] = useState(null);

  const [newItemRequests, setNewItemRequests] = useState([]);
  const [newItemRequestsLoading, setNewItemRequestsLoading] = useState(false);
  const [newItemRequestPatchingId, setNewItemRequestPatchingId] = useState(null);

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({ barcode: '', name: '', category_id: '', unit: 'each', price: '', quantity: '', image_url: '', size_per_unit: '', min_quantity: '', keep_in_stock: true, needs_return: false, return_supplier: '' });
    setCategoryTouched(false);
    setError(null);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [catsRes, itemsRes] = await Promise.all([
        api.get('/inventory/categories'),
        api.get('/inventory/items', { params: { q: q || undefined, category_id: categoryFilter || undefined } })
      ]);
      setCategories(catsRes.data.categories || []);
      setItems(itemsRes.data.items || []);
    } catch (e) {
      console.error('Load inventory admin error:', e);
      setError(e.response?.data?.error || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => loadAll(), 350);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, categoryFilter]);

  const loadRefillRequests = async () => {
    setRefillLoading(true);
    try {
      const [pendingRes, orderedRes, receivedRes] = await Promise.all([
        api.get('/inventory/refill-requests', { params: { status: 'pending' } }),
        api.get('/inventory/refill-requests', { params: { status: 'ordered' } }),
        api.get('/inventory/refill-requests', { params: { status: 'received' } })
      ]);
      const pending = pendingRes.data?.requests || [];
      const ordered = orderedRes.data?.requests || [];
      const received = receivedRes.data?.requests || [];
      setRefillRequests([...pending, ...ordered, ...received]);
    } catch (e) {
      console.error('Load refill requests error:', e);
    } finally {
      setRefillLoading(false);
    }
  };

  const loadNewItemRequests = async () => {
    setNewItemRequestsLoading(true);
    try {
      const res = await api.get('/inventory/new-item-requests', { params: { status: 'pending' } });
      setNewItemRequests(res.data?.requests || []);
    } catch (e) {
      console.error('Load new item requests error:', e);
    } finally {
      setNewItemRequestsLoading(false);
    }
  };

  useEffect(() => {
    loadRefillRequests();
    loadNewItemRequests();
  }, []);

  useEffect(() => {
    if (showRefills && refillSectionRef.current) {
      refillSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showRefills]);

  const refillStatusByItemId = useMemo(() => {
    const map = new Map();
    for (const r of refillRequests) {
      if (!r.item_id) continue;
      if (r.status === 'pending') map.set(r.item_id, 'pending');
      else if ((r.status === 'ordered' || r.status === 'received') && !map.has(r.item_id)) map.set(r.item_id, 'ordered');
    }
    return map;
  }, [refillRequests]);

  const pendingRefillCount = useMemo(() => refillRequests.filter((r) => r.status === 'pending').length, [refillRequests]);

  const inventoryByCategoryAndLevel = useMemo(() => {
    const byCategory = new Map();
    for (const it of items) {
      const cat = it.category_name || (it.category_id ? categoriesById.get(String(it.category_id))?.name : null) || 'Uncategorized';
      if (!byCategory.has(cat)) byCategory.set(cat, new Map());
      const level = getInventoryLevel(it);
      const levelMap = byCategory.get(cat);
      if (!levelMap.has(level)) levelMap.set(level, []);
      levelMap.get(level).push(it);
    }
    const categoryNames = [...byCategory.keys()].sort((a, b) => {
      const aHasAttention = [...(byCategory.get(a)?.keys() || [])].some((l) => ATTENTION_LEVELS.has(l));
      const bHasAttention = [...(byCategory.get(b)?.keys() || [])].some((l) => ATTENTION_LEVELS.has(l));
      if (aHasAttention && !bHasAttention) return -1;
      if (!aHasAttention && bHasAttention) return 1;
      return (a || '').localeCompare(b || '');
    });
    const result = [];
    for (const cat of categoryNames) {
      const levelMap = byCategory.get(cat);
      const levels = [];
      for (const level of LEVEL_ORDER) {
        const levelItems = levelMap.get(level);
        if (levelItems?.length) {
          levelItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          levels.push({ level, label: LEVEL_LABELS[level], items: levelItems });
        }
      }
      if (levels.length) result.push({ categoryName: cat, levels });
    }
    return result;
  }, [items, categoriesById]);

  const attentionItemsCount = useMemo(
    () => items.filter((it) => ATTENTION_LEVELS.has(getInventoryLevel(it))).length,
    [items]
  );

  const handleSaveRefill = async (r) => {
    const expected = refillEdit[r.id]?.expected_arrival_date ?? r.expected_arrival_date ?? null;
    const orderedFrom = refillEdit[r.id]?.ordered_from !== undefined ? refillEdit[r.id].ordered_from : r.ordered_from;
    const orderPrice = refillEdit[r.id]?.order_price !== undefined ? refillEdit[r.id].order_price : r.order_price;
    const orderQty = refillEdit[r.id]?.order_quantity !== undefined ? refillEdit[r.id].order_quantity : r.order_quantity;
    const newStatus = r.status === 'pending' ? 'ordered' : r.status;
    setRefillSavingId(r.id);
    setError(null);
    try {
      await api.patch(`/inventory/refill-requests/${r.id}`, {
        expected_arrival_date: expected || null,
        ordered_from: orderedFrom ?? null,
        order_price: orderPrice === '' || orderPrice === null || orderPrice === undefined ? null : Number(orderPrice),
        order_quantity: orderQty === '' || orderQty === null || orderQty === undefined ? null : Number(orderQty),
        status: newStatus
      });
      setRefillEdit((prev) => {
        const next = { ...prev };
        delete next[r.id];
        return next;
      });
      await loadRefillRequests();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update refill request');
    } finally {
      setRefillSavingId(null);
    }
  };

  const handleDeleteRefill = async (id) => {
    if (!window.confirm('Delete this reorder request? This cannot be undone.')) return;
    setRefillDeletingId(id);
    setError(null);
    try {
      await api.delete(`/inventory/refill-requests/${id}`);
      await loadRefillRequests();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete reorder request');
    } finally {
      setRefillDeletingId(null);
    }
  };

  const handleNewItemRequestStatus = async (id, status) => {
    if (!id || !['addressed', 'dismissed'].includes(status)) return;
    setNewItemRequestPatchingId(id);
    setError(null);
    try {
      await api.patch(`/inventory/new-item-requests/${id}`, { status });
      await loadNewItemRequests();
    } catch (e) {
      setError(e.response?.data?.error || `Failed to mark as ${status}`);
    } finally {
      setNewItemRequestPatchingId(null);
    }
  };

  const handleFetchProductImage = async () => {
    const barcode = (form.barcode || '').trim();
    if (!barcode) {
      setError('Enter a barcode first to look up a product image.');
      return;
    }
    setFetchImageLoading(true);
    setError(null);
    try {
      const res = await api.get('/inventory/items/lookup-product', { params: { barcode } });
      const image_url = res.data?.image_url;
      if (image_url && String(image_url).trim()) {
        setForm((p) => ({ ...p, image_url: image_url.trim() }));
      } else {
        setError('No image found for this barcode.');
      }
    } catch (e) {
      setError(e.response?.data?.error || e.response?.status === 404 ? 'No image found for this barcode.' : 'Failed to fetch image.');
    } finally {
      setFetchImageLoading(false);
    }
  };

  useEffect(() => {
    if (!showModal) return;
    if (!form.name) return;
    if (categoryTouched) return;

    const handle = window.setTimeout(async () => {
      try {
        setSuggestLoading(true);
        const res = await api.post('/inventory/categories/suggest', { name: form.name });
        const suggested = res.data?.category_id;
        if (suggested) {
          setForm((p) => ({ ...p, category_id: String(suggested) }));
        }
      } catch {
        // ignore
      } finally {
        setSuggestLoading(false);
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [showModal, form.name, categoryTouched]);

  const openAdd = () => {
    setEditing(null);
    setForm({ barcode: '', name: '', category_id: '', unit: 'each', price: '', quantity: '', image_url: '', size_per_unit: '', min_quantity: '', keep_in_stock: true, needs_return: false, return_supplier: '' });
    setCategoryTouched(false);
    setShowModal(true);
    setError(null);
  };

  const openEdit = (it) => {
    setEditing(it);
    setForm({
      barcode: it.barcode || '',
      name: it.name || '',
      category_id: it.category_id ? String(it.category_id) : '',
      unit: it.unit || 'each',
      price: it.price === null || it.price === undefined ? '' : String(it.price),
      quantity: it.quantity === null || it.quantity === undefined ? '' : String(it.quantity),
      image_url: it.image_url && String(it.image_url).trim() ? String(it.image_url) : '',
      size_per_unit: it.size_per_unit && String(it.size_per_unit).trim() ? String(it.size_per_unit) : '',
      min_quantity: it.min_quantity != null && it.min_quantity !== '' ? String(it.min_quantity) : '',
      keep_in_stock: it.keep_in_stock !== 0 && it.keep_in_stock !== false,
      needs_return: Boolean(it.needs_return),
      return_supplier: it.return_supplier && String(it.return_supplier).trim() ? String(it.return_supplier) : ''
    });
    setCategoryTouched(true);
    setShowModal(true);
    setError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!form.name.trim()) {
        setError('Name is required.');
        return;
      }

      if (form.needs_return && !form.return_supplier.trim()) {
        setError('Supplier is required when flagging for return (where was this part bought from?).');
        return;
      }

      const parsedPrice = form.price === '' ? null : safeNumber(form.price);
      if (form.price !== '' && parsedPrice === null) {
        setError('Price must be a number.');
        return;
      }

      const payload = {
        barcode: form.barcode.trim() || null,
        name: form.name.trim(),
        category_id: form.category_id ? Number(form.category_id) : null,
        unit: form.unit.trim() || 'each',
        price: parsedPrice,
        image_url: form.image_url && form.image_url.trim() ? form.image_url.trim() : undefined,
        needs_return: form.needs_return,
        return_supplier: form.return_supplier.trim() || null,
        size_per_unit: form.size_per_unit.trim() || null,
        min_quantity: form.min_quantity.trim() === '' ? null : safeNumber(form.min_quantity),
        keep_in_stock: form.keep_in_stock
      };

      if (payload.price !== null && payload.price !== undefined && !Number.isFinite(payload.price)) {
        setError('Price must be a number.');
        return;
      }

      let savedItem;
      if (editing?.id) {
        const res = await api.put(`/inventory/items/${editing.id}`, payload);
        savedItem = res.data.item;
      } else {
        const res = await api.post('/inventory/items', payload);
        savedItem = res.data.item;
      }

      // Optional quantity update (separate endpoint; allowed for admins)
      if (form.quantity !== '') {
        const qNum = safeNumber(form.quantity);
        if (qNum === null || qNum < 0) {
          setError('Quantity must be a non-negative number.');
          return;
        }
        const resQ = await api.post(`/inventory/items/${savedItem.id}/quantity`, { quantity: qNum });
        savedItem = resQ.data.item;
      }

      closeModal();
      await loadAll();
    } catch (e2) {
      console.error('Save inventory item error:', e2);
      setError(e2.response?.data?.error || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkReturned = async (it) => {
    if (!it?.id) return;
    setMarkReturnedLoadingId(it.id);
    setError(null);
    try {
      await api.post(`/inventory/items/${it.id}/mark-returned`);
      await loadAll();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to mark returned');
    } finally {
      setMarkReturnedLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
          <p className="text-sm text-gray-600 mt-1">Manage shop supplies, barcodes, categories, prices, and quantities.</p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:opacity-95"
        >
          + Add item
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">🆕 New item requests</h3>
        <p className="text-sm text-gray-600 mb-4">Workers can request items the shop doesn&apos;t have yet. Mark as addressed when you&apos;ve added the item or ordered it, or dismiss if not needed.</p>
        {newItemRequestsLoading ? (
          <p className="text-gray-500 py-4">Loading new item requests…</p>
        ) : newItemRequests.length === 0 ? (
          <p className="text-gray-500 py-4">No pending new item requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-3">Item name</th>
                  <th className="py-2 pr-3">Requested by</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Notes</th>
                  <th className="py-2 pr-3">Barcode</th>
                  <th className="py-2 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {newItemRequests.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0 align-top">
                    <td className="py-3 pr-3 font-medium text-gray-900">{r.item_name}</td>
                    <td className="py-3 pr-3 text-gray-700">{r.requested_by_name ?? '—'}</td>
                    <td className="py-3 pr-3 text-gray-700 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                    <td className="py-3 pr-3 text-gray-700 max-w-[200px] truncate" title={r.notes}>{r.notes || '—'}</td>
                    <td className="py-3 pr-3 text-gray-700 font-mono">{r.barcode || '—'}</td>
                    <td className="py-3 pr-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleNewItemRequestStatus(r.id, 'addressed')}
                          disabled={newItemRequestPatchingId === r.id}
                          className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
                        >
                          {newItemRequestPatchingId === r.id ? '…' : 'Mark addressed'}
                        </button>
                        <button
                          onClick={() => handleNewItemRequestStatus(r.id, 'dismissed')}
                          disabled={newItemRequestPatchingId === r.id}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div ref={refillSectionRef} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">📦 Reorder requests</h3>
        <p className="text-sm text-gray-600 mb-4">When the shop asks to reorder, the request stays here until you mark it ordered. Optionally fill out where you ordered from, price, and when it will arrive (none required).</p>
        {refillLoading ? (
          <p className="text-gray-500 py-4">Loading reorder requests…</p>
        ) : refillRequests.length === 0 ? (
          <p className="text-gray-500 py-4">No pending or ordered reorder requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Requested by</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Expected arrival</th>
                  <th className="py-2 pr-3">Ordered from</th>
                  <th className="py-2 pr-3">Qty ordered</th>
                  <th className="py-2 pr-3">Price</th>
                  <th className="py-2 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {refillRequests.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0 align-top">
                    <td className="py-3 pr-3 font-medium text-gray-900">{r.item_name}</td>
                    <td className="py-3 pr-3 text-gray-700">{r.requested_by_name}</td>
                    <td className="py-3 pr-3 text-gray-700 whitespace-nowrap">{r.requested_at ? new Date(r.requested_at).toLocaleString() : '—'}</td>
                    <td className="py-3 pr-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        r.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        r.status === 'ordered' ? 'bg-primary-subtle text-primary' :
                        r.status === 'received' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="date"
                        value={refillEdit[r.id]?.expected_arrival_date ?? r.expected_arrival_date ?? ''}
                        onChange={(e) => setRefillEdit((prev) => ({ ...prev, [r.id]: { ...prev[r.id], expected_arrival_date: e.target.value } }))}
                        className="px-2 py-1 rounded border border-gray-300 w-full max-w-[140px]"
                        placeholder="When it will arrive"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="text"
                        value={refillEdit[r.id]?.ordered_from ?? r.ordered_from ?? ''}
                        onChange={(e) => setRefillEdit((prev) => ({ ...prev, [r.id]: { ...prev[r.id], ordered_from: e.target.value } }))}
                        className="px-2 py-1 rounded border border-gray-300 w-full max-w-[140px]"
                        placeholder="Store / vendor"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={refillEdit[r.id]?.order_quantity ?? r.order_quantity ?? ''}
                        onChange={(e) => setRefillEdit((prev) => ({ ...prev, [r.id]: { ...prev[r.id], order_quantity: e.target.value } }))}
                        className="px-2 py-1 rounded border border-gray-300 w-full max-w-[70px]"
                        placeholder="Qty"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={refillEdit[r.id]?.order_price ?? r.order_price ?? ''}
                        onChange={(e) => setRefillEdit((prev) => ({ ...prev, [r.id]: { ...prev[r.id], order_price: e.target.value } }))}
                        className="px-2 py-1 rounded border border-gray-300 w-full max-w-[80px]"
                        placeholder="Price"
                      />
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.status !== 'cancelled' && (
                          <button
                            onClick={() => handleSaveRefill(r)}
                            disabled={refillSavingId === r.id}
                            className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
                          >
                            {refillSavingId === r.id ? 'Saving…' : r.status === 'pending' ? 'Mark ordered' : 'Update'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRefill(r.id)}
                          disabled={refillDeletingId === r.id}
                          className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                          title="Delete this reorder request"
                        >
                          {refillDeletingId === r.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Name or barcode…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!loading && items.length > 0 && (
          <InventoryColorLegend className="mt-4 mb-2" />
        )}

        {!loading && attentionItemsCount > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 border-2 border-amber-200">
            <p className="text-sm font-semibold text-amber-900">
              ⚠️ {attentionItemsCount} item{attentionItemsCount !== 1 ? 's' : ''} need attention — low stock, out of stock, or need return. Listed first by category below.
            </p>
            {pendingRefillCount > 0 && (
              <p className="text-xs text-amber-800 mt-1">
                {pendingRefillCount} reorder request{pendingRefillCount !== 1 ? 's' : ''} pending. See Reorder requests table above.
              </p>
            )}
          </div>
        )}

        <div className="mt-4">
          {loading ? (
            <p className="py-8 text-center text-gray-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No inventory items yet.</p>
          ) : (
            <div className="space-y-8">
              {inventoryByCategoryAndLevel.map(({ categoryName, levels }) => (
                <div key={categoryName}>
                  <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-xl" aria-hidden>{categoryIcon(categoryName)}</span>
                    {categoryName}
                  </h3>
                  <div className="space-y-4">
                    {levels.map(({ level, label, items: levelItems }) => (
                      <div key={level}>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          {label}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {levelItems.map((it) => {
                            const itemOrders = (refillRequests || [])
                              .filter((r) => r.item_id === it.id && (r.status === 'ordered' || r.status === 'received'))
                              .sort((a, b) => new Date(b.received_at || b.requested_at || 0) - new Date(a.received_at || a.requested_at || 0));
                            const formatOrderPrice = (r) => {
                              if (r.order_price == null) return '—';
                              const total = `$${Number(r.order_price).toFixed(2)}`;
                              if (r.order_quantity != null && Number(r.order_quantity) > 0) {
                                const perUnit = (Number(r.order_price) / Number(r.order_quantity)).toFixed(2);
                                return `${r.order_quantity} for ${total} ($${perUnit} each)`;
                              }
                              return total;
                            };
                            return (
                              <div
                                key={it.id}
                                className={`bg-white border-2 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col ${getTileColorClass(it)}`}
                              >
                                <div className="flex gap-3">
                                  <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                                    {it.image_url ? (
                                      <img src={it.image_url} alt="" className="w-full h-full object-contain" />
                                    ) : (
                                      <span className="text-2xl" aria-hidden>{categoryIcon(it.category_name || categoriesById.get(String(it.category_id))?.name)}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold text-gray-900 truncate" title={it.name}>{it.name}</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {it.category_name || (it.category_id ? categoriesById.get(String(it.category_id))?.name : '') || '—'}
                                    </p>
                                    <p className="text-sm text-gray-700 mt-1">
                                      <span className="font-medium">{formatQuantityWithSize(it)}</span>
                                      {it.min_quantity != null && it.min_quantity !== '' && (
                                        <span className="text-xs text-gray-500 ml-1">(min: {Number(it.min_quantity)})</span>
                                      )}
                                    </p>
                                    {refillStatusByItemId.get(it.id) === 'pending' && (
                                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">Reorder requested</span>
                                    )}
                                    {refillStatusByItemId.get(it.id) === 'ordered' && (
                                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-primary-subtle text-primary border border-primary/30">On order</span>
                                    )}
                                    {it.keep_in_stock === 0 && (
                                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">One-time part</span>
                                    )}
                                    {it.price !== null && it.price !== undefined && (
                                      <p className="text-sm text-green-600 font-medium">${Number(it.price).toFixed(2)}</p>
                                    )}
                                    {it.returned_at && (
                                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">Returned</span>
                                    )}
                                    {Boolean(it.needs_return) && !it.returned_at && (
                                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Needs return</span>
                                    )}
                                    {it.return_supplier && (it.needs_return || it.returned_at) && (
                                      <p className="text-xs text-gray-600 mt-0.5">From: {it.return_supplier}</p>
                                    )}
                                    {it.last_counted_by_name && (
                                      <p className="text-xs text-gray-500 mt-0.5">Last counted by {it.last_counted_by_name}</p>
                                    )}
                                  </div>
                                </div>
                                {itemOrders.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-600 mb-1">Order history</p>
                                    <ul className="text-xs text-gray-600 space-y-1">
                                      {itemOrders.slice(0, 5).map((r) => (
                                        <li key={r.id}>
                                          {r.ordered_from || 'Order'} — {formatOrderPrice(r)}
                                          {r.expected_arrival_date && ` · ${new Date(r.expected_arrival_date).toLocaleDateString()}`}
                                        </li>
                                      ))}
                                      {itemOrders.length > 5 && <li className="text-gray-400">+{itemOrders.length - 5} more</li>}
                                    </ul>
                                  </div>
                                )}
                                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap justify-end gap-2">
                                  {Boolean(it.needs_return) && !it.returned_at && (
                                    <button
                                      type="button"
                                      onClick={() => handleMarkReturned(it)}
                                      disabled={markReturnedLoadingId === it.id}
                                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                    >
                                      {markReturnedLoadingId === it.id ? 'Saving…' : 'Mark returned'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openEdit(it)}
                                    className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-200 p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {editing ? 'Edit item' : 'Add item'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">Add or edit item price below; workers only see quantity. Quantity in form uses the item unit.</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <form className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSave}>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. 5 qt oil jug, Fabuloso cleaner, drain plug washers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                <input
                  value={form.barcode}
                  onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary font-mono"
                  placeholder="Scan or type (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category {suggestLoading && <span className="text-xs text-gray-500">(suggesting…)</span>}
                </label>
                <select
                  value={form.category_id}
                  onChange={(e) => {
                    setCategoryTouched(true);
                    setForm((p) => ({ ...p, category_id: e.target.value }));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="">(Auto)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  value={form.unit}
                  onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="each, bottles, oz, quarts, cans…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size per unit (optional, for fluids)</label>
                <input
                  value={form.size_per_unit}
                  onChange={(e) => setForm((p) => ({ ...p, size_per_unit: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. 32 oz, 1 gal — shows equivalent (e.g. 0.5 bottles = 16 oz)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min quantity (target level for tile color)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.min_quantity}
                  onChange={(e) => setForm((p) => ({ ...p, min_quantity: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. 2 — leave blank for no color"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="form_keep_in_stock"
                  checked={form.keep_in_stock}
                  onChange={(e) => setForm((p) => ({ ...p, keep_in_stock: e.target.checked }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="form_keep_in_stock" className="text-sm font-medium text-gray-700">Always keep in inventory (uncheck for one-time parts)</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item price (add or edit)</label>
                <input
                  value={form.price}
                  onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. 19.99 — optional"
                  inputMode="decimal"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
                <div className="flex gap-2">
                  <input
                    value={form.image_url}
                    onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="https://… product image"
                  />
                  <button
                    type="button"
                    onClick={handleFetchProductImage}
                    disabled={fetchImageLoading || !(form.barcode || '').trim()}
                    className="shrink-0 px-3 py-2 rounded-lg border border-primary text-primary bg-white hover:bg-primary hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    title="Look up product image by barcode"
                  >
                    {fetchImageLoading ? 'Looking up…' : 'Find product image'}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Set quantity (optional)</label>
                <input
                  value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. 2.5"
                  inputMode="decimal"
                />
              </div>

              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="needs_return"
                  checked={form.needs_return}
                  onChange={(e) => setForm((p) => ({ ...p, needs_return: e.target.checked }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="needs_return" className="text-sm font-medium text-gray-700">Needs to be returned</label>
              </div>
              {form.needs_return && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bought from (supplier)</label>
                  <input
                    value={form.return_supplier}
                    onChange={(e) => setForm((p) => ({ ...p, return_supplier: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="e.g. AutoZone, NAPA, Amazon"
                  />
                </div>
              )}

              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-primary text-white font-semibold disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;

