import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import InventoryColorLegend from '../Inventory/InventoryColorLegend';
import BarcodeScannerModal from '../Inventory/BarcodeScannerModal';
import { useOpenScan } from '../../contexts/OpenScanContext';

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
  if (needsReturn) return 'border-2 border-orange-500 bg-orange-100 dark:bg-orange-900/30 dark:border-orange-600';
  const q = item?.quantity ?? 0;
  const min = item?.min_quantity;
  if (min == null || min === '') return 'border-gray-200 dark:border-neutral-700';
  if (q <= 0) return 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700';
  if (q < min) return 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700';
  return 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700';
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
    return_supplier: '',
    // New inventory helpers
    location: '',
    location_notes: '',
    preferred_vendor: '',
    supplier_name: '',
    supplier_contact: '',
    supplier_part_number: '',
    reorder_cost: '',
    amazon_asin: '',
    amazon_url: '',
  });
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [fetchImageLoading, setFetchImageLoading] = useState(false);
  const [lookupDescLoading, setLookupDescLoading] = useState(false);

  // Deals (per-item, loaded when editing)
  const [dealRows, setDealRows] = useState([]);
  const [dealMeta, setDealMeta] = useState(null);
  const [dealLoading, setDealLoading] = useState(false);
  const [dealRefreshing, setDealRefreshing] = useState(false);

  const [searchParams] = useSearchParams();
  const showRefills = searchParams.get('refills') === '1';
  const [refillRequests, setRefillRequests] = useState([]);
  const [refillLoading, setRefillLoading] = useState(false);
  const [refillSavingId, setRefillSavingId] = useState(null);
  const [refillDeletingId, setRefillDeletingId] = useState(null);
  const [refillReceiveQty, setRefillReceiveQty] = useState({});
  const [refillReceiveLoadingId, setRefillReceiveLoadingId] = useState(null);
  const [refillReceivePending, setRefillReceivePending] = useState(null); // { requestId, itemId, itemName, qty } when waiting for scan
  const [barcodeMismatchConfirm, setBarcodeMismatchConfirm] = useState(null); // { code, itemId, itemName, purpose: 'refill_receive', payload: { requestId, qty } }
  const [barcodeMismatchAdding, setBarcodeMismatchAdding] = useState(false);
  const [addToInventoryPending, setAddToInventoryPending] = useState(null); // { type: 'add_barcode'|'add_quantity', item, qty? }
  const [addQuantityInputs, setAddQuantityInputs] = useState({}); // itemId -> string
  const [addBarcodeLoadingId, setAddBarcodeLoadingId] = useState(null);
  const [addQuantityLoadingId, setAddQuantityLoadingId] = useState(null);
  const [refillEdit, setRefillEdit] = useState({});
  const [editingBarcodes, setEditingBarcodes] = useState([]); // { barcode, primary }[] for item in edit modal
  const refillSectionRef = useRef(null);
  const scrollPositionRef = useRef(null);
  const [refillStats, setRefillStats] = useState([]);
  const [refillStatsLoading, setRefillStatsLoading] = useState(false);
  const [markReturnedLoadingId, setMarkReturnedLoadingId] = useState(null);

  const [newItemRequests, setNewItemRequests] = useState([]);
  const [newItemRequestsLoading, setNewItemRequestsLoading] = useState(false);
  const [newItemRequestPatchingId, setNewItemRequestPatchingId] = useState(null);

  const [adHocScanOuts, setAdHocScanOuts] = useState([]);
  const [adHocScanOutsLoading, setAdHocScanOutsLoading] = useState(false);
  const [adHocAckId, setAdHocAckId] = useState(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const { registerOpenScanner, unregisterOpenScanner } = useOpenScan();

  useEffect(() => {
    registerOpenScanner(() => setScannerOpen(true));
    return () => unregisterOpenScanner();
  }, [registerOpenScanner, unregisterOpenScanner]);

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({ barcode: '', name: '', category_id: '', unit: 'each', price: '', quantity: '', image_url: '', size_per_unit: '', min_quantity: '', keep_in_stock: true, needs_return: false, return_supplier: '' });
    setCategoryTouched(false);
    setError(null);
  };

  const loadAll = async () => {
    scrollPositionRef.current = window.scrollY;
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
    scrollPositionRef.current = window.scrollY;
    setRefillLoading(true);
    try {
      const [pendingRes, orderedRes] = await Promise.all([
        api.get('/inventory/refill-requests', { params: { status: 'pending' } }),
        api.get('/inventory/refill-requests', { params: { status: 'ordered' } })
      ]);
      const pending = pendingRes.data?.requests || [];
      const ordered = orderedRes.data?.requests || [];
      setRefillRequests([...pending, ...ordered]);
    } catch (e) {
      console.error('Load refill requests error:', e);
    } finally {
      setRefillLoading(false);
    }
  };

  const loadNewItemRequests = async () => {
    scrollPositionRef.current = window.scrollY;
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

  const loadRefillStats = async () => {
    setRefillStatsLoading(true);
    try {
      const res = await api.get('/inventory/refill-stats', { params: { limit: 25 } });
      setRefillStats(res.data?.stats || []);
    } catch (e) {
      console.error('Load refill stats error:', e);
    } finally {
      setRefillStatsLoading(false);
    }
  };

  const loadAdHocScanOuts = async () => {
    setAdHocScanOutsLoading(true);
    try {
      const res = await api.get('/inventory/ad-hoc-scan-outs', { params: { acknowledged: '0', limit: 50 } });
      setAdHocScanOuts(res.data?.scan_outs || []);
    } catch (e) {
      console.error('Load ad-hoc scan-outs error:', e);
    } finally {
      setAdHocScanOutsLoading(false);
    }
  };

  useEffect(() => {
    loadRefillRequests();
    loadNewItemRequests();
    loadRefillStats();
    loadAdHocScanOuts();
  }, []);

  useEffect(() => {
    if (showRefills && refillSectionRef.current) {
      refillSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showRefills]);

  useEffect(() => {
    if (loading || refillLoading || newItemRequestsLoading) return;
    const saved = scrollPositionRef.current;
    if (saved != null) {
      scrollPositionRef.current = null;
      requestAnimationFrame(() => {
        window.scrollTo(0, saved);
      });
    }
  }, [loading, refillLoading, newItemRequestsLoading]);

  const refillStatusByItemId = useMemo(() => {
    const map = new Map();
    for (const r of refillRequests) {
      if (!r.item_id) continue;
      if (r.status === 'pending') map.set(r.item_id, 'pending');
      else if (r.status === 'ordered' && !map.has(r.item_id)) map.set(r.item_id, 'ordered');
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

  const itemsNeedingReturn = useMemo(
    () => items
      .filter((it) => Boolean(it.needs_return) && !it.returned_at)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
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

  const submitReceiveAfterScan = async (requestId, qty) => {
    setRefillReceiveLoadingId(requestId);
    setError(null);
    try {
      await api.post(`/inventory/refill-requests/${requestId}/receive`, { quantity_received: qty });
      setRefillReceiveQty((prev) => ({ ...prev, [requestId]: '' }));
      await loadRefillRequests();
      await loadAll();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to record receive');
    } finally {
      setRefillReceiveLoadingId(null);
    }
  };

  const handleReceiveRefill = (r) => {
    const qty = refillReceiveQty[r.id];
    const num = qty !== undefined && qty !== null && qty !== '' ? Number.parseFloat(qty) : null;
    if (num === null || !Number.isFinite(num) || num < 0) {
      setError('Enter a valid quantity received.');
      return;
    }
    const itemId = r.item_id;
    if (!itemId) {
      setError('Could not find item for this refill.');
      return;
    }
    setError(null);
    setRefillReceivePending({ requestId: r.id, itemId, itemName: r.item_name, qty: num });
    setScannerOpen(true);
  };

  const confirmBarcodeMismatchAddAndContinue = async () => {
    if (!barcodeMismatchConfirm) return;
    const { code, itemId, itemName, purpose, payload } = barcodeMismatchConfirm;
    setBarcodeMismatchAdding(true);
    setError(null);
    try {
      await api.post(`/inventory/items/${itemId}/alternate-barcodes`, { barcode: code });
      const eventType = purpose === 'refill_receive' ? 'refill_receive' : 'quantity_increase';
      const refillRequestId = purpose === 'refill_receive' && payload ? payload.requestId : null;
      await api.post('/inventory/scan-log', {
        item_id: itemId,
        barcode: code,
        event_type: eventType,
        ...(refillRequestId != null ? { refill_request_id: refillRequestId } : {})
      });
      if (purpose === 'refill_receive' && payload) {
        await submitReceiveAfterScan(payload.requestId, payload.qty);
      }
      setBarcodeMismatchConfirm(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not add barcode. Try again.');
    } finally {
      setBarcodeMismatchAdding(false);
    }
  };

  const handleAddBarcodeClick = (item) => {
    setError(null);
    setAddToInventoryPending({ type: 'add_barcode', item });
    setScannerOpen(true);
  };

  const handleAddQuantityClick = (item) => {
    const raw = addQuantityInputs[item.id];
    const num = raw !== undefined && raw !== null && raw !== '' ? Number.parseFloat(raw) : null;
    if (num === null || !Number.isFinite(num) || num < 0) {
      setError('Enter a valid quantity to add.');
      return;
    }
    setError(null);
    setAddToInventoryPending({ type: 'add_quantity', item, qty: num });
    setScannerOpen(true);
  };

  const submitAddBarcodeAfterScan = async (itemId, barcode) => {
    setAddBarcodeLoadingId(itemId);
    setError(null);
    try {
      await api.post(`/inventory/items/${itemId}/alternate-barcodes`, { barcode });
      await loadAll();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not add barcode.');
    } finally {
      setAddBarcodeLoadingId(null);
    }
  };

  const submitAddQuantityAfterScan = async (item, qty, barcode) => {
    const itemId = item.id;
    setAddQuantityLoadingId(itemId);
    setError(null);
    try {
      await api.post('/inventory/scan-log', { item_id: itemId, barcode, event_type: 'quantity_increase' });
      const newTotal = (item.quantity ?? 0) + qty;
      await api.post(`/inventory/items/${itemId}/quantity`, { quantity: newTotal });
      setAddQuantityInputs((prev) => ({ ...prev, [itemId]: '' }));
      await loadAll();
    } catch (e) {
      const msg = e.response?.data?.error || '';
      if (msg.includes('Barcode does not match')) {
        setError('Scanned barcode does not match this item. Scan the correct item.');
      } else {
        setError(msg || 'Failed to add quantity.');
      }
    } finally {
      setAddQuantityLoadingId(null);
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

  const handleLookupBarcode = async () => {
    const barcode = (form.barcode || '').trim();
    if (!barcode) {
      setError('Enter a barcode or SKU first to look up the product description.');
      return;
    }
    setLookupDescLoading(true);
    setError(null);
    try {
      const lookupRes = await api.get('/inventory/items/lookup-product', { params: { barcode } });
      const data = lookupRes.data || {};
      const name = (data.name || '').trim();
      const image_url = (data.image_url || '').trim();
      const category_id = data.category_id != null ? String(data.category_id) : '';
      setForm((prev) => ({
        ...prev,
        ...(name && { name }),
        ...(image_url && { image_url }),
        ...(category_id && { category_id }),
      }));
      if (!name && !image_url && !category_id) {
        setError('No product description found for this barcode. You can still fill in the details manually.');
      }
    } catch (e) {
      setError(e.response?.data?.error || e.response?.status === 404 ? 'No product found for this barcode. Enter details manually.' : 'Failed to look up product.');
    } finally {
      setLookupDescLoading(false);
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

  useEffect(() => {
    if (!showModal || !editing?.id) {
      setEditingBarcodes([]);
      return;
    }
    let cancelled = false;
    api.get(`/inventory/items/${editing.id}/barcodes`)
      .then((res) => { if (!cancelled) setEditingBarcodes(res.data?.barcodes || []); })
      .catch(() => { if (!cancelled) setEditingBarcodes([]); });
    return () => { cancelled = true; };
  }, [showModal, editing?.id]);

  const amazonLinkForCurrentForm = useMemo(() => {
    const url = (form.amazon_url || '').trim();
    if (url) return url;
    const asin = (form.amazon_asin || '').trim();
    if (!asin) return null;
    return `https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=${encodeURIComponent(asin)}&Quantity.1=1`;
  }, [form.amazon_asin, form.amazon_url]);

  useEffect(() => {
    if (!showModal || !editing?.id) {
      setDealRows([]);
      setDealMeta(null);
      return;
    }
    let cancelled = false;
    setDealLoading(true);
    api.get(`/inventory/items/${editing.id}/deals`)
      .then((res) => {
        if (cancelled) return;
        setDealRows(res.data?.deals || []);
        setDealMeta(res.data?.meta || null);
      })
      .catch(() => {
        if (cancelled) return;
        setDealRows([]);
        setDealMeta(null);
      })
      .finally(() => { if (!cancelled) setDealLoading(false); });
    return () => { cancelled = true; };
  }, [showModal, editing?.id]);

  const refreshDeals = async () => {
    if (!editing?.id) return;
    setDealRefreshing(true);
    try {
      const res = await api.post(`/inventory/items/${editing.id}/deals/refresh`);
      setDealRows(res.data?.deals || []);
      setDealMeta(res.data?.meta || null);
    } catch {
      // ignore
    } finally {
      setDealRefreshing(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
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
      return_supplier: '',
      location: '',
      location_notes: '',
      preferred_vendor: '',
      supplier_name: '',
      supplier_contact: '',
      supplier_part_number: '',
      reorder_cost: '',
      amazon_asin: '',
      amazon_url: '',
    });
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
      return_supplier: it.return_supplier && String(it.return_supplier).trim() ? String(it.return_supplier) : '',
      location: it.location && String(it.location).trim() ? String(it.location) : '',
      location_notes: it.location_notes && String(it.location_notes).trim() ? String(it.location_notes) : '',
      preferred_vendor: it.preferred_vendor && String(it.preferred_vendor).trim() ? String(it.preferred_vendor) : '',
      supplier_name: it.supplier_name && String(it.supplier_name).trim() ? String(it.supplier_name) : '',
      supplier_contact: it.supplier_contact && String(it.supplier_contact).trim() ? String(it.supplier_contact) : '',
      supplier_part_number: it.supplier_part_number && String(it.supplier_part_number).trim() ? String(it.supplier_part_number) : '',
      reorder_cost: it.reorder_cost === null || it.reorder_cost === undefined ? '' : String(it.reorder_cost),
      amazon_asin: it.amazon_asin && String(it.amazon_asin).trim() ? String(it.amazon_asin) : '',
      amazon_url: it.amazon_url && String(it.amazon_url).trim() ? String(it.amazon_url) : '',
    });
    setCategoryTouched(true);
    setShowModal(true);
    setError(null);
  };

  const handleScanDetected = async (code) => {
    const barcode = String(code || '').trim();
    if (!barcode) return;
    setScannerOpen(false);
    setError(null);
    try {
      const res = await api.get(`/inventory/items/by-barcode/${encodeURIComponent(barcode)}`);
      const item = res.data?.item;
      if (item) {
        openEdit(item);
        return;
      }
    } catch {
      // by-barcode 404 or error — not in our DB, will open add and try lookup
    }
    openAdd();
    setForm((prev) => ({ ...prev, barcode }));
    try {
      const lookupRes = await api.get('/inventory/items/lookup-product', { params: { barcode } });
      const data = lookupRes.data || {};
      const name = (data.name || '').trim();
      const image_url = (data.image_url || '').trim();
      const category_id = data.category_id != null ? String(data.category_id) : '';
      setForm((prev) => ({
        ...prev,
        ...(name && { name }),
        ...(image_url && { image_url }),
        ...(category_id && { category_id }),
      }));
    } catch {
      // lookup-product 404 or error — form already has barcode, user can fill manually
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!editing?.id && !(form.barcode || '').trim()) {
        setError('Barcode is required when adding an item. Scan or enter a barcode.');
        return;
      }
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
      const parsedReorderCost = form.reorder_cost === '' ? null : safeNumber(form.reorder_cost);
      if (form.reorder_cost !== '' && parsedReorderCost === null) {
        setError('Reorder cost must be a number.');
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
        keep_in_stock: form.keep_in_stock,
        location: form.location.trim() || null,
        location_notes: form.location_notes.trim() || null,
        preferred_vendor: form.preferred_vendor.trim() || null,
        supplier_name: form.supplier_name.trim() || null,
        supplier_contact: form.supplier_contact.trim() || null,
        supplier_part_number: form.supplier_part_number.trim() || null,
        reorder_cost: parsedReorderCost,
        amazon_asin: form.amazon_asin.trim() || null,
        amazon_url: form.amazon_url.trim() || null,
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

  const handleAckAdHocScanOut = async (id) => {
    if (!id) return;
    setAdHocAckId(id);
    setError(null);
    try {
      await api.patch(`/inventory/ad-hoc-scan-outs/${id}/acknowledge`);
      setAdHocScanOuts((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to mark as seen');
    } finally {
      setAdHocAckId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Inventory</h2>
          <p className="text-sm text-gray-600 dark:text-neutral-100 mt-1">Manage shop supplies, barcodes, categories, prices, and quantities.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-primary bg-white dark:bg-neutral-950 text-primary font-semibold hover:bg-primary hover:text-white dark:hover:bg-primary/20 dark:hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7" /></svg>
            Scan barcode
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:opacity-95"
          >
            + Add item
          </button>
        </div>
      </div>

      {itemsNeedingReturn.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl p-4 shadow-sm dark:shadow-neutral-950/50">
          <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">↩️ Returns to make</h3>
          <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">Items flagged for return to supplier. Mark returned when done.</p>
          <ul className="space-y-2">
            {itemsNeedingReturn.map((it) => (
              <li
                key={it.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-lg bg-white dark:bg-neutral-950 border border-amber-200 dark:border-amber-800"
              >
                <div className="min-w-0">
                  <span className="font-medium text-gray-900 dark:text-neutral-100">{it.name}</span>
                  {it.return_supplier && (
                    <span className="text-sm text-gray-600 dark:text-neutral-100 ml-2">→ {it.return_supplier}</span>
                  )}
                  {it.location && (
                    <div className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 truncate" title={it.location}>
                      📍 {it.location}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMarkReturned(it)}
                    disabled={markReturnedLoadingId === it.id}
                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {markReturnedLoadingId === it.id ? 'Saving…' : 'Mark returned'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(it)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-100 text-sm font-medium"
                  >
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 shadow-sm dark:shadow-neutral-950/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 mb-2">📤 Scan-outs (not on a task)</h3>
        <p className="text-sm text-gray-600 dark:text-neutral-100 mb-4">Items employees used and scanned out without linking to a task. They provided a reason; you can mark as seen when reviewed.</p>
        {adHocScanOutsLoading ? (
          <p className="text-gray-500 dark:text-neutral-400 py-4">Loading…</p>
        ) : adHocScanOuts.length === 0 ? (
          <p className="text-gray-500 dark:text-neutral-400 py-4">No unacknowledged scan-outs.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 dark:text-neutral-100 border-b dark:border-neutral-700">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Qty used</th>
                  <th className="py-2 pr-3">Used by</th>
                  <th className="py-2 pr-3">Reason</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adHocScanOuts.map((s) => (
                  <tr key={s.id} className="border-b last:border-b-0 align-top">
                    <td className="py-3 pr-3 font-medium text-gray-900 dark:text-neutral-100">{s.item_name}</td>
                    <td className="py-3 pr-3 text-gray-700 dark:text-neutral-100">{s.quantity_used} {s.item_unit || 'each'}</td>
                    <td className="py-3 pr-3 text-gray-700 dark:text-neutral-100">{s.used_by_name ?? '—'}</td>
                    <td className="py-3 pr-3 text-gray-700 dark:text-neutral-100 max-w-[200px]" title={s.reason_text}>{s.reason_text || '—'}</td>
                    <td className="py-3 pr-3 text-gray-700 dark:text-neutral-100 whitespace-nowrap">{s.created_at ? new Date(s.created_at).toLocaleString() : '—'}</td>
                    <td className="py-3 pr-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleAckAdHocScanOut(s.id)}
                        disabled={adHocAckId === s.id}
                        className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                      >
                        {adHocAckId === s.id ? '…' : 'Mark seen'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 shadow-sm dark:shadow-neutral-950/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 mb-2">🆕 New item requests</h3>
        <p className="text-sm text-gray-600 dark:text-neutral-100 mb-4">Workers can request items the shop doesn&apos;t have yet. Mark as addressed when you&apos;ve added the item or ordered it, or dismiss if not needed.</p>
        {newItemRequestsLoading ? (
          <p className="text-gray-500 dark:text-neutral-400 py-4">Loading new item requests…</p>
        ) : newItemRequests.length === 0 ? (
          <p className="text-gray-500 dark:text-neutral-400 py-4">No pending new item requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 dark:text-neutral-100 border-b dark:border-neutral-700">
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
                    <td className="py-3 pr-3 font-medium text-gray-900 dark:text-neutral-100">{r.item_name}</td>
                    <td className="py-3 pr-3 text-gray-700 dark:text-neutral-100">{r.requested_by_name ?? '—'}</td>
                    <td className="py-3 pr-3 text-gray-700 dark:text-neutral-100 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                    <td className="py-3 pr-3 text-gray-700 dark:text-neutral-100 max-w-[200px] truncate" title={r.notes}>{r.notes || '—'}</td>
                    <td className="py-3 pr-3 text-gray-700 dark:text-neutral-100 font-mono">{r.barcode || '—'}</td>
                    <td className="py-3 pr-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleNewItemRequestStatus(r.id, 'addressed')}
                          disabled={newItemRequestPatchingId === r.id}
                          className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
                        >
                          {newItemRequestPatchingId === r.id ? '…' : 'Mark addressed'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNewItemRequestStatus(r.id, 'dismissed')}
                          disabled={newItemRequestPatchingId === r.id}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-100 text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
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

      <div ref={refillSectionRef} className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 shadow-sm dark:shadow-neutral-950/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 mb-2">📦 Reorder requests</h3>
        <p className="text-sm text-gray-600 dark:text-neutral-100 mb-4">When the shop asks to reorder, the request stays here until you mark it ordered. Optionally fill out where you ordered from, price, and when it will arrive (none required).</p>
        {refillLoading ? (
          <p className="text-gray-500 dark:text-neutral-400 py-4">Loading reorder requests…</p>
        ) : refillRequests.length === 0 ? (
          <p className="text-gray-500 dark:text-neutral-400 py-4">No pending or ordered reorder requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 dark:text-neutral-100 border-b dark:border-neutral-700">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Requested by</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Expected arrival</th>
                  <th className="py-2 pr-3">Ordered from</th>
                  <th className="py-2 pr-3">Qty ordered</th>
                  <th className="py-2 pr-3">Price</th>
                  <th className="py-2 pr-3">Receive</th>
                  <th className="py-2 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {refillRequests.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0 align-top">
                    <td className="py-3 pr-3 font-medium text-gray-900 dark:text-neutral-100">{r.item_name}</td>
                    <td className="py-3 pr-3 text-gray-700 dark:text-neutral-100">{r.requested_by_name}</td>
                    <td className="py-3 pr-3 text-gray-700 dark:text-neutral-100 whitespace-nowrap">{r.requested_at ? new Date(r.requested_at).toLocaleString() : '—'}</td>
                    <td className="py-3 pr-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        r.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        r.status === 'ordered' ? 'bg-primary-subtle text-primary' :
                        r.status === 'received' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-100'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="date"
                        value={refillEdit[r.id]?.expected_arrival_date ?? r.expected_arrival_date ?? ''}
                        onChange={(e) => setRefillEdit((prev) => ({ ...prev, [r.id]: { ...prev[r.id], expected_arrival_date: e.target.value } }))}
                        className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 w-full max-w-[140px]"
                        placeholder="When it will arrive"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="text"
                        value={refillEdit[r.id]?.ordered_from ?? r.ordered_from ?? ''}
                        onChange={(e) => setRefillEdit((prev) => ({ ...prev, [r.id]: { ...prev[r.id], ordered_from: e.target.value } }))}
                        className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 w-full max-w-[140px]"
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
                        className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 w-full max-w-[70px]"
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
                        className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 w-full max-w-[80px]"
                        placeholder="Price"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      {r.status === 'ordered' ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            placeholder="Qty"
                            value={refillReceiveQty[r.id] ?? ''}
                            onChange={(e) => setRefillReceiveQty((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            className="px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 w-16"
                          />
                          <button
                            type="button"
                            onClick={() => handleReceiveRefill(r)}
                            disabled={refillReceiveLoadingId === r.id}
                            className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50"
                          >
                            {refillReceiveLoadingId === r.id ? 'Saving…' : 'Receive'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-neutral-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleSaveRefill(r)}
                            disabled={refillSavingId === r.id}
                            className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
                          >
                            {refillSavingId === r.id ? 'Saving…' : r.status === 'pending' ? 'Mark ordered' : 'Update'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteRefill(r.id)}
                          disabled={refillDeletingId === r.id}
                          className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
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

      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 shadow-sm dark:shadow-neutral-950/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 mb-2">📈 Refill history &amp; forecasting</h3>
        <p className="text-sm text-gray-600 dark:text-neutral-100 mb-4">Items refilled most often — use this to forecast what to keep in stock or order ahead.</p>
        {refillStatsLoading ? (
          <p className="text-gray-500 dark:text-neutral-400 py-4">Loading…</p>
        ) : refillStats.length === 0 ? (
          <p className="text-gray-500 dark:text-neutral-400 py-4">No refill history yet. Once you mark reorders as &quot;Received&quot;, they appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 dark:text-neutral-100 border-b dark:border-neutral-700">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Times refilled</th>
                  <th className="py-2 pr-3">Last received</th>
                </tr>
              </thead>
              <tbody>
                {refillStats.map((s) => (
                  <tr key={s.item_id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-neutral-100">{s.item_name}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-neutral-100">{s.refill_count}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-neutral-100 whitespace-nowrap">{s.last_received_at ? new Date(s.last_received_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 shadow-sm dark:shadow-neutral-950/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Name or barcode…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
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
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {!loading && items.length > 0 && (
          <InventoryColorLegend className="mt-4 mb-2" />
        )}

        {!loading && attentionItemsCount > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800">
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
            <p className="py-8 text-center text-gray-500 dark:text-neutral-400">Loading…</p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-gray-500 dark:text-neutral-400">No inventory items yet.</p>
          ) : (
            <div className="space-y-8">
              {inventoryByCategoryAndLevel.map(({ categoryName, levels }) => (
                <div key={categoryName}>
                  <h3 className="text-base font-bold text-gray-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                    <span className="text-xl" aria-hidden>{categoryIcon(categoryName)}</span>
                    {categoryName}
                  </h3>
                  <div className="space-y-4">
                    {levels.map(({ level, label, items: levelItems }) => (
                      <div key={level}>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                          {label}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {levelItems.map((it) => {
                            const itemOrders = (refillRequests || [])
                              .filter((r) => r.item_id === it.id && r.status === 'ordered')
                              .sort((a, b) => new Date(b.expected_arrival_date || b.requested_at || 0) - new Date(a.expected_arrival_date || a.requested_at || 0));
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
                                className={`bg-white dark:bg-neutral-950 border-2 dark:border-neutral-700 rounded-xl p-4 shadow-sm dark:shadow-neutral-950/50 hover:shadow-md transition-shadow flex flex-col ${getTileColorClass(it)}`}
                              >
                                <div className="flex gap-3">
                                  <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 flex items-center justify-center">
                                    {it.image_url ? (
                                      <img src={it.image_url} alt="" className="w-full h-full object-contain" />
                                    ) : (
                                      <span className="text-2xl" aria-hidden>{categoryIcon(it.category_name || categoriesById.get(String(it.category_id))?.name)}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold text-gray-900 dark:text-neutral-100 truncate" title={it.name}>{it.name}</h3>
                                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                                      {it.category_name || (it.category_id ? categoriesById.get(String(it.category_id))?.name : '') || '—'}
                                    </p>
                                    {it.location && (
                                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 truncate" title={it.location}>
                                        📍 {it.location}
                                      </p>
                                    )}
                                    {(it.preferred_vendor || it.supplier_name) && (
                                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 truncate" title={it.preferred_vendor || it.supplier_name}>
                                        🏷️ {(it.preferred_vendor || it.supplier_name)}
                                      </p>
                                    )}
                                    <p className="text-sm text-gray-700 dark:text-neutral-100 mt-1">
                                      <span className="font-medium">{formatQuantityWithSize(it)}</span>
                                      {it.min_quantity != null && it.min_quantity !== '' && (
                                        <span className="text-xs text-gray-500 dark:text-neutral-400 ml-1">(min: {Number(it.min_quantity)})</span>
                                      )}
                                    </p>
                                    {refillStatusByItemId.get(it.id) === 'pending' && (
                                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">Reorder requested</span>
                                    )}
                                    {refillStatusByItemId.get(it.id) === 'ordered' && (
                                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-primary-subtle dark:bg-primary/20 text-primary dark:text-primary-light border border-primary/30 dark:border-primary/50">On order</span>
                                    )}
                                    {it.keep_in_stock === 0 && (
                                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-100">One-time part</span>
                                    )}
                                    {it.price !== null && it.price !== undefined && (
                                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">${Number(it.price).toFixed(2)}</p>
                                    )}
                                    {it.returned_at && (
                                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-neutral-100">Returned</span>
                                    )}
                                    {Boolean(it.needs_return) && !it.returned_at && (
                                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">Needs return</span>
                                    )}
                                    {it.return_supplier && (it.needs_return || it.returned_at) && (
                                      <p className="text-xs text-gray-600 dark:text-neutral-100 mt-0.5">From: {it.return_supplier}</p>
                                    )}
                                    {it.last_counted_by_name && (
                                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Last counted by {it.last_counted_by_name}</p>
                                    )}
                                  </div>
                                </div>
                                {itemOrders.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-neutral-700">
                                    <p className="text-xs font-medium text-gray-600 dark:text-neutral-100 mb-1">Order history</p>
                                    <ul className="text-xs text-gray-600 dark:text-neutral-100 space-y-1">
                                      {itemOrders.slice(0, 5).map((r) => (
                                        <li key={r.id}>
                                          {r.ordered_from || 'Order'} — {formatOrderPrice(r)}
                                          {r.expected_arrival_date && ` · ${new Date(r.expected_arrival_date).toLocaleDateString()}`}
                                        </li>
                                      ))}
                                      {itemOrders.length > 5 && <li className="text-gray-400 dark:text-neutral-500">+{itemOrders.length - 5} more</li>}
                                    </ul>
                                  </div>
                                )}
                                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-neutral-700">
                                <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mb-2">Add to inventory</p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAddBarcodeClick(it)}
                                    disabled={addBarcodeLoadingId === it.id || addToInventoryPending?.type === 'add_barcode' && addToInventoryPending?.item?.id === it.id}
                                    className="px-3 py-1.5 rounded-lg border border-primary bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light text-sm font-medium hover:bg-primary/20 dark:hover:bg-primary/30 disabled:opacity-50"
                                    title="Scan to add a barcode to this item"
                                  >
                                    {addBarcodeLoadingId === it.id ? 'Adding…' : 'Scan to add barcode'}
                                  </button>
                                  <span className="text-gray-400 dark:text-neutral-500 text-sm">or</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="Qty"
                                    value={addQuantityInputs[it.id] ?? ''}
                                    onChange={(e) => setAddQuantityInputs((prev) => ({ ...prev, [it.id]: e.target.value }))}
                                    className="w-16 px-2 py-1.5 rounded border border-gray-300 dark:border-neutral-700 text-sm bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddQuantityClick(it)}
                                    disabled={addQuantityLoadingId === it.id || (addToInventoryPending?.type === 'add_quantity' && addToInventoryPending?.item?.id === it.id)}
                                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                    title="Enter quantity, then scan item barcode to confirm"
                                  >
                                    {addQuantityLoadingId === it.id ? 'Saving…' : 'Add quantity'}
                                  </button>
                                </div>
                                <div className="mt-3 flex flex-wrap justify-end gap-2">
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
                                    type="button"
                                    onClick={() => openEdit(it)}
                                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-100 text-sm font-medium"
                                  >
                                    Edit
                                  </button>
                                </div>
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
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:p-4 safe-area-inset" style={{ paddingLeft: 'max(0.5rem, env(safe-area-inset-left))', paddingRight: 'max(0.5rem, env(safe-area-inset-right))', paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} aria-hidden="true" />
          <div className="relative w-full max-w-2xl max-h-[95dvh] sm:max-h-[90vh] bg-white dark:bg-neutral-950 rounded-t-2xl sm:rounded-2xl shadow-xl dark:shadow-neutral-950/50 border border-gray-200 dark:border-neutral-700 flex flex-col overflow-hidden flex-1 sm:flex-initial min-h-0">
            <div className="flex items-start justify-between gap-3 flex-shrink-0 px-4 py-3 sm:p-5 md:p-6 border-b border-gray-200 dark:border-neutral-700 min-h-[3rem]">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-neutral-100">
                  {editing ? 'Edit item' : 'Add item'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-neutral-100 mt-0.5 sm:mt-1 line-clamp-2">Add or edit item price below; workers only see quantity. Quantity in form uses the item unit.</p>
              </div>
              <button type="button" onClick={closeModal} className="flex-shrink-0 min-h-[2.75rem] min-w-[2.75rem] flex items-center justify-center p-2 rounded-lg text-gray-600 dark:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800" aria-label="Close">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5 sm:pb-5 md:px-6 md:pb-6">
            {error && (
              <div className="mt-3 sm:mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <form className="mt-3 sm:mt-4 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSave} id="inventory-item-form">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. 5 qt oil jug, Fabuloso cleaner, drain plug washers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                  Barcode {!editing && <span className="text-red-500 dark:text-red-400">*</span>}
                </label>
                <div className="flex gap-2">
                  <input
                    value={form.barcode}
                    onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))}
                    onClick={!editing ? () => setScannerOpen(true) : undefined}
                    className={`flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary font-mono ${!editing ? 'cursor-pointer' : ''}`}
                    placeholder={editing ? 'Scan or type (optional)' : 'Tap to scan or type barcode (required)'}
                    title={!editing ? 'Tap to open barcode scanner' : undefined}
                  />
                  {!editing && (
                    <button
                      type="button"
                      onClick={handleLookupBarcode}
                      disabled={lookupDescLoading || !(form.barcode || '').trim()}
                      className="flex-shrink-0 min-h-12 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-700 dark:text-neutral-100 hover:bg-gray-50 dark:hover:bg-neutral-700 text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
                      title="Look up product name and details by barcode"
                    >
                      {lookupDescLoading ? 'Looking up…' : 'Look up'}
                    </button>
                  )}
                </div>
                {!editing && (form.barcode || '').trim() && (
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                    Can&apos;t scan? Type the barcode or SKU above, then tap &quot;Look up&quot; to fill in the description.
                  </p>
                )}
                {editing && editingBarcodes.length > 1 && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">All barcodes for this item</label>
                    <select
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 font-mono text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                      value={form.barcode}
                      onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))}
                      aria-label="Select a barcode to view or edit"
                    >
                      {editingBarcodes.map(({ barcode, primary }) => (
                        <option key={barcode} value={barcode}>
                          {barcode}{primary ? ' (primary)' : ' (alternate)'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">
                  Category {suggestLoading && <span className="text-xs text-gray-500 dark:text-neutral-400">(suggesting…)</span>}
                </label>
                <select
                  value={form.category_id}
                  onChange={(e) => {
                    setCategoryTouched(true);
                    setForm((p) => ({ ...p, category_id: e.target.value }));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Unit</label>
                <input
                  value={form.unit}
                  onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="each, bottles, oz, quarts, cans…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Size per unit (optional, for fluids)</label>
                <input
                  value={form.size_per_unit}
                  onChange={(e) => setForm((p) => ({ ...p, size_per_unit: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. 32 oz, 1 gal — shows equivalent (e.g. 0.5 bottles = 16 oz)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Min quantity (target level for tile color)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.min_quantity}
                  onChange={(e) => setForm((p) => ({ ...p, min_quantity: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
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
                <label htmlFor="form_keep_in_stock" className="text-sm font-medium text-gray-700 dark:text-neutral-100">Always keep in inventory (uncheck for one-time parts)</label>
              </div>

              <div className="md:col-span-2 pt-2">
                <p className="text-xs font-bold text-gray-700 dark:text-neutral-200 uppercase tracking-wider">Location</p>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Where it lives in the shop (makes “what’s where” instant).</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Primary location</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. Front rack • Bin A3, Tire wall • Top shelf"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Location notes (optional)</label>
                <input
                  value={form.location_notes}
                  onChange={(e) => setForm((p) => ({ ...p, location_notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. behind towels, labeled “Fluids”, second row"
                />
              </div>

              <div className="md:col-span-2 pt-2">
                <p className="text-xs font-bold text-gray-700 dark:text-neutral-200 uppercase tracking-wider">Vendor / Reorder</p>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Used for reorders, deal-finding, and history.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Preferred vendor</label>
                <input
                  value={form.preferred_vendor}
                  onChange={(e) => setForm((p) => ({ ...p, preferred_vendor: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. NAPA, AutoZone, Amazon"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Supplier part #</label>
                <input
                  value={form.supplier_part_number}
                  onChange={(e) => setForm((p) => ({ ...p, supplier_part_number: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. 12345-AB"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Supplier name (optional)</label>
                <input
                  value={form.supplier_name}
                  onChange={(e) => setForm((p) => ({ ...p, supplier_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. store/rep"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Supplier contact (optional)</label>
                <input
                  value={form.supplier_contact}
                  onChange={(e) => setForm((p) => ({ ...p, supplier_contact: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. phone/email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Reorder cost (optional)</label>
                <input
                  value={form.reorder_cost}
                  onChange={(e) => setForm((p) => ({ ...p, reorder_cost: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. 19.99"
                  inputMode="decimal"
                />
              </div>

              <div className="md:col-span-2 pt-2">
                <p className="text-xs font-bold text-gray-700 dark:text-neutral-200 uppercase tracking-wider">Amazon (optional)</p>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">For fast ordering and price checks.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">ASIN</label>
                <input
                  value={form.amazon_asin}
                  onChange={(e) => setForm((p) => ({ ...p, amazon_asin: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. B08XYZ1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Amazon URL</label>
                <input
                  value={form.amazon_url}
                  onChange={(e) => setForm((p) => ({ ...p, amazon_url: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="https://www.amazon.com/dp/…"
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-950 p-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-700 dark:text-neutral-200 uppercase tracking-wider">Quick Buy & Deals</p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                      {dealMeta?.last_fetched_at ? `Last checked: ${new Date(dealMeta.last_fetched_at).toLocaleString()}` : 'Not checked yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {amazonLinkForCurrentForm && (
                      <button
                        type="button"
                        onClick={() => window.open(amazonLinkForCurrentForm, '_blank', 'noopener,noreferrer')}
                        className="min-h-10 px-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
                        title="Open Amazon to buy"
                      >
                        Buy on Amazon
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={refreshDeals}
                      disabled={!editing?.id || dealRefreshing}
                      className="min-h-10 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-700 dark:text-neutral-100 text-sm font-medium hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                      title="Refresh deal suggestions"
                    >
                      {dealRefreshing ? 'Refreshing…' : 'Refresh deals'}
                    </button>
                  </div>
                </div>

                <div className="mt-2">
                  {dealLoading ? (
                    <p className="text-sm text-gray-500 dark:text-neutral-400 py-2">Loading deals…</p>
                  ) : dealRows.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-neutral-400 py-2">No deal suggestions yet. Refresh to search.</p>
                  ) : (
                    <div className="space-y-2">
                      {dealRows.slice(0, 6).map((d) => (
                        <a
                          key={d.id}
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-3 hover:border-primary/40 dark:hover:border-primary/50 transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-neutral-100 truncate" title={d.title || d.url}>
                                {d.title || d.url}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                                <span className="uppercase font-semibold">{d.source}</span>
                                {d.reason ? ` · ${d.reason}` : ''}
                              </p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              {d.price != null ? (
                                <p className="text-sm font-bold text-green-600 dark:text-green-400">${Number(d.price).toFixed(2)}</p>
                              ) : (
                                <p className="text-xs text-gray-400 dark:text-neutral-500">—</p>
                              )}
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Item price (add or edit)</label>
                <input
                  value={form.price}
                  onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. 19.99 — optional"
                  inputMode="decimal"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Image URL (optional)</label>
                <div className="flex gap-2">
                  <input
                    value={form.image_url}
                    onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="https://… product image"
                  />
                  <button
                    type="button"
                    onClick={handleFetchProductImage}
                    disabled={fetchImageLoading || !(form.barcode || '').trim()}
                    className="shrink-0 px-3 py-2 rounded-lg border border-primary text-primary bg-white dark:bg-neutral-950 hover:bg-primary hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    title="Look up product image by barcode"
                  >
                    {fetchImageLoading ? 'Looking up…' : 'Find product image'}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Set quantity (optional)</label>
                <input
                  value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
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
                <label htmlFor="needs_return" className="text-sm font-medium text-gray-700 dark:text-neutral-100">Needs to be returned</label>
              </div>
              {form.needs_return && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-100 mb-1">Bought from (supplier)</label>
                  <input
                    value={form.return_supplier}
                    onChange={(e) => setForm((p) => ({ ...p, return_supplier: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="e.g. AutoZone, NAPA, Amazon"
                  />
                </div>
              )}

              <div className="md:col-span-2 flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full sm:w-auto min-h-[2.75rem] px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto min-h-[2.75rem] px-5 py-2 rounded-lg bg-primary text-white font-semibold disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {barcodeMismatchConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" aria-modal="true" role="dialog" aria-labelledby="admin-barcode-mismatch-title">
          <div className="absolute inset-0 bg-black/40" onClick={() => !barcodeMismatchAdding && setBarcodeMismatchConfirm(null)} aria-hidden="true" />
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-950 rounded-xl shadow-xl dark:shadow-neutral-950/50 border border-gray-200 dark:border-neutral-700 p-5">
            <h2 id="admin-barcode-mismatch-title" className="text-lg font-bold text-gray-900 dark:text-neutral-100 mb-2">Barcode doesn&apos;t match</h2>
            <p className="text-gray-600 dark:text-neutral-100 mb-1">
              The scanned barcode (<code className="text-sm bg-gray-100 dark:bg-neutral-700 px-1 rounded text-gray-900 dark:text-neutral-100">{barcodeMismatchConfirm.code}</code>) is not the one on file for <strong>{barcodeMismatchConfirm.itemName || 'this item'}</strong>.
            </p>
            <p className="text-gray-600 dark:text-neutral-100 mb-4">
              Is it the same item? If yes, we&apos;ll add this barcode so future scans work.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={barcodeMismatchAdding}
                onClick={() => setBarcodeMismatchConfirm(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-100 disabled:opacity-50"
              >
                No
              </button>
              <button
                type="button"
                disabled={barcodeMismatchAdding}
                onClick={confirmBarcodeMismatchAddAndContinue}
                className="px-5 py-2 rounded-lg bg-primary text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-default"
              >
                {barcodeMismatchAdding ? 'Adding…' : 'Yes, add & continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          setRefillReceivePending(null);
          setAddToInventoryPending(null);
        }}
        pendingContext={
          addToInventoryPending
            ? { type: addToInventoryPending.type, item: addToInventoryPending.item, qty: addToInventoryPending.qty }
            : refillReceivePending
              ? { type: 'refill_receive', itemName: refillReceivePending.itemName }
              : null
        }
        onDetected={(code) => {
          const barcode = String(code || '').trim();
          if (!barcode) return;

          if (addToInventoryPending) {
            const { type, item, qty } = addToInventoryPending;
            setScannerOpen(false);
            setAddToInventoryPending(null);
            if (type === 'add_barcode') {
              submitAddBarcodeAfterScan(item.id, barcode);
              return;
            }
            if (type === 'add_quantity' && qty != null) {
              api.post('/inventory/scan-log', { item_id: item.id, barcode, event_type: 'quantity_increase' })
                .then(() => submitAddQuantityAfterScan(item, qty, barcode))
                .catch((e) => {
                  const msg = e.response?.data?.error || '';
                  if (msg.includes('Barcode does not match')) {
                    setError('Scanned barcode does not match this item. Scan the correct item.');
                  } else {
                    setError(msg || 'Failed to add quantity.');
                  }
                });
              return;
            }
          }

          if (refillReceivePending) {
            const { requestId, itemId, itemName: recvItemName, qty } = refillReceivePending;
            setScannerOpen(false);
            setRefillReceivePending(null);
            api.post('/inventory/scan-log', {
              item_id: itemId,
              barcode,
              event_type: 'refill_receive',
              refill_request_id: requestId
            })
              .then(() => submitReceiveAfterScan(requestId, qty))
              .catch((e) => {
                const msg = e.response?.data?.error || '';
                if (msg.includes('Barcode does not match')) {
                  setBarcodeMismatchConfirm({
                    code: barcode,
                    itemId,
                    itemName: recvItemName,
                    purpose: 'refill_receive',
                    payload: { requestId, qty }
                  });
                } else {
                  setError(msg || 'Scan did not match this item. Try again.');
                }
              });
            return;
          }

          handleScanDetected(code);
        }}
      />
    </div>
  );
};

export default InventoryManagement;

