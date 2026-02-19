import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useOpenScan } from '../contexts/OpenScanContext';
import BarcodeScannerModal from '../components/Inventory/BarcodeScannerModal';
import InventoryColorLegend from '../components/Inventory/InventoryColorLegend';

const safeNumber = (v) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const categoryIcon = (name) => {
  const n = (name || '').toLowerCase();
  if (n.includes('oil') || n.includes('fluid')) return '🛢️';
  if (n.includes('clean')) return '🧹';
  if (n.includes('spray') || n.includes('paint') || n.includes('coating')) return '🎨';
  if (n.includes('part')) return '⚙️';
  if (n.includes('fastener')) return '🔩';
  if (n.includes('filter')) return '🧻';
  if (n.includes('belt') || n.includes('hose')) return '🔗';
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

// Inventory level for grouping: return_needed, out, low, ok, no_min (no min set)
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
  no_min: 'In stock'
};

const BARCODE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 min

const Inventory = () => {
  const { isAdmin } = useAuth();
  const { registerOpenScanner, unregisterOpenScanner } = useOpenScan();

  const barcodeRef = useRef(null);
  const barcodeCacheRef = useRef(new Map()); // barcode -> { item, ts }

  const [barcode, setBarcode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [item, setItem] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [categories, setCategories] = useState([]);
  const categoriesById = useMemo(() => {
    const map = new Map();
    for (const c of categories) map.set(String(c.id), c);
    return map;
  }, [categories]);

  const [createForm, setCreateForm] = useState({
    name: '',
    category_id: '',
    unit: 'each',
    price: '',
    quantity: '',
    image_url: ''
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);

  const [quantity, setQuantity] = useState('');
  const [viscosity, setViscosity] = useState('');
  const [quantityLoading, setQuantityLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [refillRequestLoading, setRefillRequestLoading] = useState(false);
  const [expectedRefills, setExpectedRefills] = useState([]);
  const [orderedRefills, setOrderedRefills] = useState([]);
  const [receiveLoadingId, setReceiveLoadingId] = useState(null);
  const [receiveQty, setReceiveQty] = useState({});

  const [allItems, setAllItems] = useState([]);
  const [allItemsLoading, setAllItemsLoading] = useState(false);

  const [showScanResultModal, setShowScanResultModal] = useState(false);
  const [scanPurpose, setScanPurpose] = useState(null); // null | 'lookup' | 'quantity_increase' | 'refill_receive' | 'got_more_scan_first'
  const [pendingQuantityUpdate, setPendingQuantityUpdate] = useState(null); // { qty, viscosity } when scan required for quantity increase
  const [pendingReceive, setPendingReceive] = useState(null); // { requestId, itemId, qty } when scan required for receive
  const [gotMoreAwaitingQuantity, setGotMoreAwaitingQuantity] = useState(null); // { defaultQty } after "Add to inventory" scan confirmed
  const [gotMoreQuantityInput, setGotMoreQuantityInput] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', barcode: '', category_id: '', unit: 'each', price: '', image_url: '', size_per_unit: '', min_quantity: '', keep_in_stock: true, needs_return: false, return_supplier: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [markReturnedLoading, setMarkReturnedLoading] = useState(false);
  const [requestReturnLoading, setRequestReturnLoading] = useState(false);
  const [showReturnSupplierModal, setShowReturnSupplierModal] = useState(false);
  const [returnSupplierInput, setReturnSupplierInput] = useState('');
  const [returnQuantityInput, setReturnQuantityInput] = useState('');
  const [fetchImageLoading, setFetchImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [scanResultImageError, setScanResultImageError] = useState(false);
  const [showNewItemRequestModal, setShowNewItemRequestModal] = useState(false);
  const [newItemRequestForm, setNewItemRequestForm] = useState({ item_name: '', notes: '', barcode: '' });
  const [newItemRequestLoading, setNewItemRequestLoading] = useState(false);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await api.get('/inventory/categories');
        setCategories(res.data.categories || []);
      } catch (e) {
        console.error('Failed to load inventory categories:', e);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    registerOpenScanner(() => setScannerOpen(true));
    return () => unregisterOpenScanner();
  }, [registerOpenScanner, unregisterOpenScanner]);

  useEffect(() => {
    if (!notFound) return;
    if (!createForm.name) return;
    if (categoryTouched) return;

    const handle = window.setTimeout(async () => {
      try {
        setSuggestLoading(true);
        const res = await api.post('/inventory/categories/suggest', { name: createForm.name });
        const suggested = res.data?.category_id;
        if (suggested) {
          setCreateForm((prev) => ({ ...prev, category_id: String(suggested) }));
        }
      } catch (e) {
        // Suggestion is best-effort; ignore failures.
      } finally {
        setSuggestLoading(false);
      }
    }, 400);

    return () => window.clearTimeout(handle);
  }, [notFound, createForm.name, categoryTouched]);

  useEffect(() => {
    if (!barcodeRef.current) return;
    barcodeRef.current.focus();
  }, []);

  const [pendingRefills, setPendingRefills] = useState([]);

  const loadRefills = async () => {
    try {
      const [expectedRes, orderedRes, pendingRes] = await Promise.all([
        api.get('/inventory/refill-requests/expected'),
        api.get('/inventory/refill-requests', { params: { status: 'ordered' } }),
        api.get('/inventory/refill-requests', { params: { status: 'pending' } })
      ]);
      setExpectedRefills(expectedRes.data?.requests || []);
      setOrderedRefills(orderedRes.data?.requests || []);
      setPendingRefills(pendingRes.data?.requests || []);
    } catch (e) {
      console.error('Load refills error:', e);
    }
  };

  useEffect(() => {
    loadRefills();
  }, [successMessage]);

  const loadAllItems = async () => {
    setAllItemsLoading(true);
    try {
      const res = await api.get('/inventory/items');
      setAllItems(res.data?.items || []);
    } catch (e) {
      console.error('Load inventory list error:', e);
    } finally {
      setAllItemsLoading(false);
    }
  };

  useEffect(() => {
    loadAllItems();
  }, [successMessage]);

  const refillStatusByItemId = useMemo(() => {
    const map = new Map();
    for (const r of pendingRefills) {
      if (r.item_id) map.set(r.item_id, 'pending');
    }
    for (const r of orderedRefills) {
      if (r.item_id) map.set(r.item_id, 'ordered');
    }
    for (const r of expectedRefills) {
      if (r.item_id && !map.has(r.item_id)) map.set(r.item_id, 'ordered');
    }
    return map;
  }, [pendingRefills, orderedRefills, expectedRefills]);

  const ATTENTION_LEVELS = new Set(['return_needed', 'out', 'low']);

  const inventoryByCategoryAndLevel = useMemo(() => {
    const byCategory = new Map();
    for (const it of allItems) {
      const cat = it.category_name || 'Uncategorized';
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
      return a.localeCompare(b);
    });
    const result = [];
    for (const cat of categoryNames) {
      const levelMap = byCategory.get(cat);
      const levels = [];
      for (const level of LEVEL_ORDER) {
        const items = levelMap.get(level);
        if (items?.length) {
          items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          levels.push({ level, label: LEVEL_LABELS[level], items });
        }
      }
      if (levels.length) result.push({ categoryName: cat, levels });
    }
    return result;
  }, [allItems]);

  useEffect(() => {
    setImageError(false);
  }, [item?.id]);

  useEffect(() => {
    if (showScanResultModal && item?.id) setScanResultImageError(false);
  }, [showScanResultModal, item?.id]);

  const resetFlow = () => {
    setLookupError(null);
    setSuccessMessage('');
    setNotFound(false);
    setItem(null);
    setQuantity('');
    setViscosity('');
    setShowScanResultModal(false);
    setCreateForm({ name: '', category_id: '', unit: 'each', price: '', quantity: '', image_url: '' });
    setCategoryTouched(false);
  };

  const cameraSupported = Boolean(navigator.mediaDevices?.getUserMedia);
  const secureContext = typeof window !== 'undefined' ? window.isSecureContext : false;

  const handleLookup = async (explicitBarcode, options = {}) => {
    const { openQuickModal = false } = options;
    const code = String(explicitBarcode ?? barcode).trim();
    if (!code) return;

    setLookupError(null);
    setSuccessMessage('');
    setNotFound(false);
    setItem(null);
    setQuantity('');
    setShowScanResultModal(false);

    const cached = barcodeCacheRef.current.get(code);
    if (cached && Date.now() - cached.ts < BARCODE_CACHE_TTL_MS && cached.item) {
      setItem(cached.item);
      setQuantity(cached.item?.quantity ?? '');
      setViscosity(cached.item?.viscosity && String(cached.item.viscosity).trim() ? String(cached.item.viscosity) : '');
      if (openQuickModal) setShowScanResultModal(true);
      setLookupLoading(false);
      return;
    }

    setLookupLoading(true);
    try {
      const res = await api.get(`/inventory/items/by-barcode/${encodeURIComponent(code)}`);
      const found = res.data?.item;
      barcodeCacheRef.current.set(code, { item: found, ts: Date.now() });
      setItem(found);
      setQuantity(found?.quantity ?? '');
      setViscosity(found?.viscosity && String(found.viscosity).trim() ? String(found.viscosity) : '');
      if (openQuickModal) setShowScanResultModal(true);
    } catch (e) {
      if (e.response?.status === 404) {
        setNotFound(true);
        setCreateForm((prev) => ({ ...prev, name: '', category_id: '', unit: prev.unit || 'each', quantity: '', image_url: '' }));
        api.get('/inventory/items/lookup-product', { params: { barcode: code } })
          .then((lookupRes) => {
            const { name: suggestedName, category_id: suggestedCategoryId, image_url: suggestedImageUrl } = lookupRes.data || {};
            setCreateForm((prev) => ({
              ...prev,
              name: suggestedName || prev.name,
              category_id: suggestedCategoryId ? String(suggestedCategoryId) : prev.category_id,
              unit: prev.unit || 'each',
              quantity: prev.quantity ?? '',
              image_url: suggestedImageUrl && String(suggestedImageUrl).trim() ? String(suggestedImageUrl).trim() : prev.image_url || ''
            }));
          })
          .catch(() => {});
      } else {
        setLookupError(e.response?.data?.error || e.message || 'Lookup failed');
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    const code = String(barcode).trim();
    if (!code) {
      setLookupError('Barcode is required to create a new item from scan.');
      return;
    }
    if (!createForm.name.trim()) {
      setLookupError('Name is required.');
      return;
    }

    setCreateLoading(true);
    setLookupError(null);
    setSuccessMessage('');
    try {
      const parsedPrice = createForm.price === '' ? null : safeNumber(createForm.price);
      if (createForm.price !== '' && parsedPrice === null) {
        setLookupError('Price must be a number.');
        return;
      }

      const parsedQty = createForm.quantity !== '' ? safeNumber(createForm.quantity) : null;
      if (createForm.quantity !== '' && (parsedQty === null || parsedQty < 0)) {
        setLookupError('Quantity must be a non-negative number.');
        return;
      }
      const payload = {
        barcode: code,
        name: createForm.name.trim(),
        category_id: createForm.category_id ? Number(createForm.category_id) : undefined,
        unit: createForm.unit || 'each',
        price: parsedPrice,
        quantity: parsedQty !== null ? parsedQty : 0,
        image_url: createForm.image_url && createForm.image_url.trim() ? createForm.image_url.trim() : undefined
      };
      const res = await api.post('/inventory/items', payload);
      const created = res.data?.item;
      if (!created) throw new Error('Item was not returned after save');
      setItem(created);
      setNotFound(false);
      setQuantity(created?.quantity ?? '');
      setViscosity(created?.viscosity && String(created.viscosity).trim() ? String(created.viscosity) : '');
      setSuccessMessage('Saved to inventory.');
      setShowScanResultModal(true);
    } catch (e2) {
      setLookupError(e2.response?.data?.error || e2.message || 'Create failed');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleQuantityUpdate = async (e) => {
    e.preventDefault();
    if (!item?.id) return;

    const q = safeNumber(quantity);
    if (q === null) {
      setLookupError('Quantity must be a number.');
      return;
    }

    const currentQty = item?.quantity ?? 0;
    const isOilsOrFluids = item?.category_name === 'Oils & Fluids' || categoryLabel === 'Oils & Fluids';
    const visc = isOilsOrFluids ? (viscosity && viscosity.trim() ? viscosity.trim() : null) : null;

    if (q > currentQty && item?.barcode) {
      setLookupError(null);
      setPendingQuantityUpdate({ qty: q, viscosity: visc });
      setScanPurpose('quantity_increase');
      setScannerOpen(true);
      return;
    }

    setQuantityLoading(true);
    setLookupError(null);
    setSuccessMessage('');
    try {
      const payload = { quantity: q };
      if (isOilsOrFluids) payload.viscosity = visc;
      const res = await api.post(`/inventory/items/${item.id}/quantity`, payload);
      setItem(res.data?.item);
      setSuccessMessage('Quantity updated.');
      setShowScanResultModal(false);
    } catch (e2) {
      setLookupError(e2.response?.data?.error || e2.message || 'Update failed');
    } finally {
      setQuantityLoading(false);
    }
  };

  const submitQuantityAfterScan = async (qty, visc) => {
    if (!item?.id) return;
    setQuantityLoading(true);
    setLookupError(null);
    setSuccessMessage('');
    try {
      const payload = { quantity: qty };
      if (visc !== undefined && visc !== null) payload.viscosity = visc;
      const res = await api.post(`/inventory/items/${item.id}/quantity`, payload);
      setItem(res.data?.item);
      setQuantity(String(qty));
      setSuccessMessage('Quantity updated.');
      setShowScanResultModal(false);
      loadAllItems();
    } catch (e2) {
      setLookupError(e2.response?.data?.error || e2.message || 'Update failed');
    } finally {
      setQuantityLoading(false);
    }
  };

  const categoryLabel = item?.category_name || (item?.category_id ? categoriesById.get(String(item.category_id))?.name : null);

  const openGotMoreFlow = () => {
    if (!item?.id) return;
    if (!item.barcode || String(item.barcode).trim() === '') {
      setLookupError('This item has no barcode. Add a barcode in Edit to use "Add to inventory".');
      return;
    }
    setLookupError(null);
    setSuccessMessage('');
    setScanPurpose('got_more_scan_first');
    setScannerOpen(true);
  };

  const openEditModal = () => {
    if (!item) return;
    setEditForm({
      name: item.name || '',
      barcode: item.barcode || '',
      category_id: item.category_id ? String(item.category_id) : '',
      unit: item.unit || 'each',
      price: item.price !== null && item.price !== undefined ? String(item.price) : '',
      image_url: item.image_url && String(item.image_url).trim() ? String(item.image_url) : '',
      size_per_unit: item.size_per_unit && String(item.size_per_unit).trim() ? String(item.size_per_unit) : '',
      min_quantity: item.min_quantity != null && item.min_quantity !== '' ? String(item.min_quantity) : '',
      keep_in_stock: item.keep_in_stock !== 0 && item.keep_in_stock !== false,
      needs_return: Boolean(item.needs_return),
      return_supplier: item.return_supplier && String(item.return_supplier).trim() ? String(item.return_supplier) : ''
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!item?.id) return;
    if (!editForm.name.trim()) {
      setEditError('Name is required.');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const payload = {
        name: editForm.name.trim(),
        barcode: editForm.barcode.trim() || null,
        category_id: editForm.category_id ? Number(editForm.category_id) : null,
        unit: editForm.unit.trim() || 'each',
        price: editForm.price === '' ? null : safeNumber(editForm.price),
        image_url: editForm.image_url.trim() || null,
        size_per_unit: editForm.size_per_unit.trim() || null,
        min_quantity: editForm.min_quantity === '' ? null : safeNumber(editForm.min_quantity),
        keep_in_stock: editForm.keep_in_stock,
        needs_return: editForm.needs_return,
        return_supplier: editForm.return_supplier.trim() || null
      };
      if (payload.price !== null && !Number.isFinite(payload.price)) {
        setEditError('Price must be a number.');
        return;
      }
      const res = await api.put(`/inventory/items/${item.id}`, payload);
      setItem(res.data?.item);
      setShowEditModal(false);
      setSuccessMessage('Item updated.');
      loadAllItems();
    } catch (e) {
      setEditError(e.response?.data?.error || e.message || 'Update failed');
    } finally {
      setEditSaving(false);
    }
  };

  const handleRequestRefill = async () => {
    if (!item?.id) return;
    setRefillRequestLoading(true);
    setLookupError(null);
    try {
      await api.post('/inventory/refill-requests', { item_id: item.id });
      setSuccessMessage('Reorder requested. Office has been notified.');
      loadRefills();
    } catch (e) {
      setLookupError(e.response?.data?.error || 'Failed to request refill');
    } finally {
      setRefillRequestLoading(false);
    }
  };

  const handleFetchProductImage = async () => {
    if (!item?.id || !item?.barcode) return;
    setFetchImageLoading(true);
    setLookupError(null);
    setImageError(false);
    try {
      const lookupRes = await api.get('/inventory/items/lookup-product', { params: { barcode: item.barcode } });
      const image_url = lookupRes.data?.image_url;
      if (image_url && String(image_url).trim()) {
        const res = await api.put(`/inventory/items/${item.id}`, { image_url: image_url.trim() });
        setItem(res.data?.item);
        setSuccessMessage('Product image updated.');
        loadAllItems();
      } else {
        setLookupError('No image found for this barcode.');
      }
    } catch (e) {
      setLookupError(e.response?.data?.error || e.response?.status === 404 ? 'No image found for this barcode.' : 'Failed to fetch image.');
    } finally {
      setFetchImageLoading(false);
    }
  };

  const handleRequestReturn = async (supplier, returnQty) => {
    if (!item?.id) return;
    const trimmed = supplier != null ? String(supplier).trim() : '';
    if (!trimmed) {
      setLookupError('Please enter which supplier this part was bought from.');
      return;
    }
    const currentQty = Number(item?.quantity) ?? 0;
    if (currentQty > 1) {
      const q = returnQty !== undefined && returnQty !== null && returnQty !== '' ? safeNumber(returnQty) : null;
      if (q === null || q < 1 || q > currentQty) {
        setLookupError(`Please enter how many to return (1–${currentQty}).`);
        return;
      }
    }
    setRequestReturnLoading(true);
    setLookupError(null);
    try {
      const body = { return_supplier: trimmed };
      if (currentQty > 1) {
        const q = returnQty !== undefined && returnQty !== null && returnQty !== '' ? safeNumber(returnQty) : null;
        if (q != null && q >= 1) body.return_quantity = q;
      }
      const res = await api.post(`/inventory/items/${item.id}/request-return`, body);
      setItem(res.data?.item);
      setSuccessMessage('Office notified — this part is flagged for return. A task was created for admins.');
      setShowReturnSupplierModal(false);
      setReturnSupplierInput('');
      setReturnQuantityInput('');
      loadAllItems();
    } catch (e) {
      setLookupError(e.response?.data?.error || 'Failed to flag for return');
    } finally {
      setRequestReturnLoading(false);
    }
  };

  const handleMarkReturned = async () => {
    if (!item?.id) return;
    setMarkReturnedLoading(true);
    setLookupError(null);
    try {
      const res = await api.post(`/inventory/items/${item.id}/mark-returned`);
      setItem(res.data?.item);
      setSuccessMessage('Marked as returned.');
      loadAllItems();
    } catch (e) {
      setLookupError(e.response?.data?.error || 'Failed to mark returned');
    } finally {
      setMarkReturnedLoading(false);
    }
  };

  const handleReceiveRefill = (requestId) => {
    const qty = receiveQty[requestId];
    const num = qty !== undefined && qty !== '' ? safeNumber(qty) : null;
    if (num === null || num < 0) {
      setLookupError('Enter a valid quantity received.');
      return;
    }
    const refill = orderedRefills.find((r) => r.id === requestId);
    const itemId = refill?.item_id;
    if (!itemId) {
      setLookupError('Could not find item for this refill.');
      return;
    }
    setLookupError(null);
    setPendingReceive({ requestId, itemId, qty: num });
    setScanPurpose('refill_receive');
    setScannerOpen(true);
  };

  const submitReceiveAfterScan = async (requestId, qty) => {
    setReceiveLoadingId(requestId);
    setLookupError(null);
    try {
      await api.post(`/inventory/refill-requests/${requestId}/receive`, { quantity_received: qty });
      setSuccessMessage('Refill received and quantity updated.');
      setReceiveQty((prev) => ({ ...prev, [requestId]: '' }));
      loadRefills();
    } catch (e) {
      setLookupError(e.response?.data?.error || 'Failed to record receive');
    } finally {
      setReceiveLoadingId(null);
    }
  };

  const handleSubmitNewItemRequest = async (e) => {
    e.preventDefault();
    const name = (newItemRequestForm.item_name || '').trim();
    if (!name) {
      setLookupError('Please enter the item name.');
      return;
    }
    setNewItemRequestLoading(true);
    setLookupError(null);
    try {
      await api.post('/inventory/new-item-requests', {
        item_name: name,
        notes: (newItemRequestForm.notes || '').trim() || undefined,
        barcode: (newItemRequestForm.barcode || '').trim() || undefined
      });
      setSuccessMessage('Request sent. Office will be notified.');
      setShowNewItemRequestModal(false);
      setNewItemRequestForm({ item_name: '', notes: '', barcode: '' });
    } catch (e) {
      setLookupError(e.response?.data?.error || 'Failed to submit request');
    } finally {
      setNewItemRequestLoading(false);
    }
  };

  const openScanner = () => {
    setLookupError(null);
    setScannerOpen(true);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 md:pb-8" style={{ paddingBottom: 'max(5.5rem, calc(env(safe-area-inset-bottom, 0px) + 4.5rem))' }}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 md:p-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-600 mt-1">
            Scan a barcode to load an item, then record how much is left.
          </p>
        </div>

        <form
          className="mt-4 sm:mt-5 flex flex-col sm:flex-row gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleLookup(barcode, { openQuickModal: true });
          }}
        >
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
            <input
              ref={barcodeRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or type barcode, press Enter"
              className="w-full px-4 py-3.5 sm:py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary text-lg tracking-wider touch-manipulation"
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
          <div className="flex items-end flex-shrink-0">
            <button
              type="button"
              onClick={openScanner}
              disabled={!cameraSupported}
              className="min-h-[48px] w-full sm:w-auto sm:min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-primary bg-primary text-white font-semibold disabled:opacity-50 active:opacity-90 touch-manipulation"
              title={cameraSupported ? 'Scan barcode with camera' : 'Camera not available'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7" /></svg>
              Scan barcode
            </button>
          </div>
        </form>

        {!secureContext && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            <strong>Barcode scanner</strong> needs a secure connection (HTTPS). Use <strong>https://login.spectrumoutfitters.com</strong> instead of http://, or set up HTTPS on your server (see scripts/ENABLE_HTTPS.md).
          </div>
        )}

        {lookupError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {lookupError}
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
            {successMessage}
          </div>
        )}

        {expectedRefills.length > 0 && (
          <div className="mt-5 p-4 rounded-xl border border-primary/30 bg-primary-subtle">
            <div className="font-semibold text-neutral-800 mb-2">📅 Refills expected</div>
            <ul className="space-y-1 text-sm text-neutral-700">
              {expectedRefills.map((r) => (
                <li key={r.id}>
                  <span className="font-medium">{r.item_name}</span>
                  {' — '}
                  {r.expected_arrival_date ? new Date(r.expected_arrival_date).toLocaleDateString() : '—'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {orderedRefills.length > 0 && (
          <div className="mt-5 p-4 rounded-xl border border-gray-200 bg-gray-50">
            <div className="font-semibold text-gray-900 mb-3">📦 Receive refill</div>
            <p className="text-sm text-gray-600 mb-3">When a shipment arrives, enter the quantity received and click Receive.</p>
            <ul className="space-y-3">
              {orderedRefills.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg border border-gray-200">
                  <span className="font-medium text-gray-900">{r.item_name}</span>
                  <span className="text-gray-500 text-sm">({r.item_unit || 'each'})</span>
                  {r.expected_arrival_date && (
                    <span className="text-xs text-gray-500">Expected {new Date(r.expected_arrival_date).toLocaleDateString()}</span>
                  )}
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Qty received"
                    value={receiveQty[r.id] ?? ''}
                    onChange={(e) => setReceiveQty((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    className="w-24 px-2 py-1.5 rounded border border-gray-300 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleReceiveRefill(r.id)}
                    disabled={receiveLoadingId === r.id}
                    className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
                  >
                    {receiveLoadingId === r.id ? 'Saving…' : 'Receive'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900">What&apos;s in inventory</h2>
            <p className="text-sm text-gray-600 mt-1">
              Tap an item to update quantity or request a refill.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setShowNewItemRequestModal(true); setLookupError(null); setNewItemRequestForm({ item_name: '', notes: '', barcode: '' }); }}
            className="shrink-0 px-4 py-2 rounded-lg border-2 border-primary text-primary bg-white hover:bg-primary hover:text-white transition font-medium text-sm"
          >
            Request an item we don&apos;t have
          </button>
        </div>
        <InventoryColorLegend className="mb-4" />
        {isAdmin && (() => {
          const attentionItems = allItems.filter((it) => ATTENTION_LEVELS.has(getInventoryLevel(it)));
          const attentionCount = attentionItems.length;
          if (attentionCount === 0) return null;
          return (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border-2 border-amber-200">
              <p className="text-sm font-semibold text-amber-900">
                ⚠️ {attentionCount} item{attentionCount !== 1 ? 's' : ''} need attention
                {attentionCount > 0 && ' — low stock, out of stock, or need return. Listed first by category below.'}
              </p>
              {pendingRefills.length > 0 && (
                <p className="text-xs text-amber-800 mt-1">
                  {pendingRefills.length} reorder request{pendingRefills.length !== 1 ? 's' : ''} pending in office.
                </p>
              )}
            </div>
          );
        })()}
        {allItemsLoading ? (
          <p className="py-6 text-center text-gray-500">Loading…</p>
        ) : allItems.length === 0 ? (
          <p className="py-6 text-center text-gray-500">No items yet. Scan a barcode and add your first item above.</p>
        ) : (
          <div className="space-y-8">
            {inventoryByCategoryAndLevel.map(({ categoryName, levels }) => (
              <div key={categoryName}>
                <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-xl" aria-hidden>{categoryIcon(categoryName)}</span>
                  {categoryName}
                </h3>
                <div className="space-y-4">
                  {levels.map(({ level, label, items }) => (
                    <div key={level}>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        {label}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {items.map((it) => (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => {
                              if (it.barcode) {
                                setBarcode(it.barcode);
                                setLookupError(null);
                                setSuccessMessage('');
                                window.setTimeout(() => handleLookup(it.barcode, { openQuickModal: true }), 0);
                              }
                            }}
                            className={`text-left flex gap-3 p-4 rounded-xl border-2 ${getTileColorClass(it)} hover:opacity-90 transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed`}
                            disabled={!it.barcode}
                          >
                            <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                              {it.image_url ? (
                                <img src={it.image_url} alt="" className="w-full h-full object-contain" />
                              ) : (
                                <span className="text-2xl" aria-hidden>{categoryIcon(it.category_name)}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-gray-900 truncate" title={it.name}>{it.name}</div>
                              <div className="text-sm text-gray-700 mt-1">
                                <span className="font-medium">{formatQuantityWithSize(it)}</span>
                                {it.min_quantity != null && it.min_quantity !== '' && (
                                  <span className="text-xs text-gray-500 ml-1">(min: {Number(it.min_quantity)})</span>
                                )}
                              </div>
                              {refillStatusByItemId.get(it.id) === 'pending' && (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">Reorder requested</span>
                              )}
                              {refillStatusByItemId.get(it.id) === 'ordered' && (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-primary-subtle text-primary border border-primary/30">On order</span>
                              )}
                              {it.last_counted_by_name && (
                                <div className="text-xs text-gray-500 mt-0.5">Last counted by {it.last_counted_by_name}</div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {notFound && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4" aria-modal="true" role="dialog" aria-labelledby="add-item-title">
          <div className="absolute inset-0 bg-black/40 sm:bg-black/50" onClick={resetFlow} />
          <div
            className="relative w-full sm:max-w-md sm:rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh] sm:max-h-[85vh] rounded-t-2xl overflow-hidden"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 pt-4 pb-2 border-b border-gray-100">
              <div className="min-w-0">
                <h2 id="add-item-title" className="text-lg font-bold text-gray-900">Add to inventory</h2>
                <p className="text-sm text-gray-500 mt-0.5 font-mono">Barcode: {barcode.trim()}</p>
              </div>
              <button
                type="button"
                onClick={resetFlow}
                className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
                aria-label="Close"
              >
                <svg className="w-6 h-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              {lookupError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{lookupError}</div>
              )}
              {isAdmin && (
                <div className="flex flex-col sm:flex-row gap-4 mb-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-white border border-gray-200 flex items-center justify-center">
                    {createForm.image_url ? (
                      <img src={createForm.image_url} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-3xl sm:text-4xl" title="No image">{categoryIcon(categoriesById.get(createForm.category_id)?.name || '')}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Product name</label>
                    <input
                      value={createForm.name}
                      onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary font-medium touch-manipulation"
                      placeholder="e.g. 5 qt Oil Jug, Fabuloso"
                      autoFocus
                    />
                  </div>
                </div>
              )}
              {!isAdmin && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product name</label>
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary font-medium touch-manipulation"
                    placeholder="e.g. 5 qt Oil Jug, Fabuloso"
                    autoFocus
                  />
                </div>
              )}
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category {suggestLoading && <span className="text-xs text-gray-500">(suggesting…)</span>}
                  </label>
                  <select
                    value={createForm.category_id}
                    onChange={(e) => { setCategoryTouched(true); setCreateForm((p) => ({ ...p, category_id: e.target.value })); }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-primary focus:border-primary touch-manipulation"
                  >
                    <option value="">(Auto)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input
                    value={createForm.unit}
                    onChange={(e) => setCreateForm((p) => ({ ...p, unit: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary touch-manipulation"
                    placeholder="each, quarts, oz, cans…"
                  />
                </div>
                {isAdmin && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price (optional)</label>
                      <input
                        value={createForm.price}
                        onChange={(e) => setCreateForm((p) => ({ ...p, price: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary touch-manipulation"
                        placeholder="e.g. 19.99"
                        inputMode="decimal"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
                      <input
                        value={createForm.image_url}
                        onChange={(e) => setCreateForm((p) => ({ ...p, image_url: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary touch-manipulation"
                        placeholder="https://..."
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    value={createForm.quantity}
                    onChange={(e) => setCreateForm((p) => ({ ...p, quantity: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary touch-manipulation"
                    placeholder="e.g. 5 (blank = 0)"
                    inputMode="decimal"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetFlow}
                    className="min-h-[48px] flex-1 px-4 py-3 rounded-xl border border-gray-200 font-medium hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading || !createForm.name.trim()}
                    className="min-h-[48px] flex-1 px-4 py-3 rounded-xl bg-primary text-white font-semibold disabled:opacity-50 active:opacity-90 touch-manipulation"
                  >
                    {createLoading ? 'Saving…' : 'Save to inventory'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {item && (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6 ${showScanResultModal ? 'hidden sm:block' : ''}`}>
          <div className="flex flex-col md:flex-row gap-6 md:items-start">
            <div className="flex-shrink-0 w-28 h-28 md:w-32 md:h-32 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex flex-col items-center justify-center relative">
              {item.image_url && !imageError ? (
                <img
                  src={item.image_url}
                  alt=""
                  className="w-full h-full object-contain"
                  onError={() => setImageError(true)}
                />
              ) : (
                <>
                  <span className="text-5xl md:text-6xl" aria-hidden>{categoryIcon(item.category_name || categoryLabel)}</span>
                  {item.barcode && (
                    <button
                      type="button"
                      onClick={handleFetchProductImage}
                      disabled={fetchImageLoading}
                      className="mt-2 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                    >
                      {fetchImageLoading ? 'Looking up…' : 'Get product image'}
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-xl font-bold text-gray-900 leading-tight">{item.name}</h2>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50"
                  >
                    Edit
                  </button>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div>
                  <dt className="text-gray-500">Barcode</dt>
                  <dd className="font-mono text-gray-900">{item.barcode || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Category</dt>
                  <dd className="text-gray-900">{categoryLabel || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Unit</dt>
                  <dd className="text-gray-900">{item.unit || 'each'}</dd>
                </div>
                {item.viscosity && (
                  <div>
                    <dt className="text-gray-500">Viscosity</dt>
                    <dd className="text-gray-900">{item.viscosity}</dd>
                  </div>
                )}
                {isAdmin && (
                  <div>
                    <dt className="text-gray-500">Price</dt>
                    <dd className="text-green-600 font-medium">{item.price === null || item.price === undefined ? '—' : `$${Number(item.price).toFixed(2)}`}</dd>
                  </div>
                )}
              </dl>
              {(item.returned_at || Boolean(item.needs_return) || (isAdmin && item.return_supplier)) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {item.returned_at && (
                    <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-700">Returned</span>
                  )}
                  {Boolean(item.needs_return) && !item.returned_at && (
                    <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">Needs to be returned</span>
                  )}
                  {isAdmin && item.return_supplier && (
                    <span className="text-sm text-gray-600">
                      {item.return_quantity > 1 ? `Return ${item.return_quantity} to ` : 'From: '}{item.return_supplier}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 md:flex-shrink-0">
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 w-full md:w-[200px]">
                <div className="text-sm font-semibold text-gray-800">Current quantity</div>
                <div className="mt-1 text-3xl font-bold text-gray-900">
                  {formatQuantityWithSize(item)}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Last counted: {item.last_counted_at ? new Date(item.last_counted_at).toLocaleString() : '—'}
                  {item.last_counted_by_name && (
                    <span className="block mt-0.5">by {item.last_counted_by_name}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (item.needs_return && !item.returned_at) return;
                  setLookupError(null);
                  setReturnSupplierInput('');
                  setReturnQuantityInput((Number(item?.quantity) ?? 0) > 1 ? String(item.quantity) : '');
                  setShowReturnSupplierModal(true);
                }}
                disabled={requestReturnLoading || (item.needs_return && !item.returned_at)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border-2 border-orange-400 bg-orange-50 text-orange-800 font-medium hover:bg-orange-100 disabled:opacity-50 disabled:cursor-default touch-manipulation"
                title={item.needs_return && !item.returned_at ? 'Already flagged for return' : 'Flag this part so office can return it to supplier'}
              >
                {requestReturnLoading ? 'Sending…' : (item.needs_return && !item.returned_at) ? 'Flagged for return' : 'Need to return this'}
              </button>
              {isAdmin && Boolean(item.needs_return) && !item.returned_at && (
                <button
                  type="button"
                  onClick={handleMarkReturned}
                  disabled={markReturnedLoading}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 touch-manipulation"
                >
                  {markReturnedLoading ? 'Saving…' : 'Mark returned'}
                </button>
              )}
              <button
                type="button"
                onClick={handleRequestRefill}
                disabled={refillRequestLoading}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-800 font-medium hover:bg-amber-100 disabled:opacity-50 touch-manipulation"
              >
                {refillRequestLoading ? 'Sending…' : 'Tell office to order'}
              </button>
              <button
                type="button"
                onClick={openGotMoreFlow}
                disabled={!item.barcode || !String(item.barcode).trim()}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border-2 border-primary bg-primary/10 text-primary font-medium hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                title={!item.barcode ? 'Add a barcode in Edit to use this' : 'Scan this item, then enter new quantity'}
              >
                Add to inventory
              </button>
            </div>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleQuantityUpdate}>
            <div className="flex flex-col md:flex-row gap-3 items-end">
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Record quantity ({item.unit || 'each'})
                </label>
                <input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary text-lg touch-manipulation"
                  placeholder="e.g. 2.5 or 0.5 for half bottle"
                  inputMode="decimal"
                />
                {(item.category_name === 'Oils & Fluids' || item.size_per_unit) && (
                  <p className="text-xs text-gray-500 mt-1">Use decimals for partial containers (e.g. 0.5 = half bottle). Edit item to set size per unit (e.g. 32 oz) to see equivalent.</p>
                )}
              </div>
              {(item.category_name === 'Oils & Fluids' || categoryLabel === 'Oils & Fluids') && (
                <div className="flex-1 md:max-w-[180px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Viscosity</label>
                  <input
                    value={viscosity}
                    onChange={(e) => setViscosity(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="e.g. 5W-30, 10W-40, SAE 30"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={quantityLoading}
                className="min-h-[48px] px-5 py-3 rounded-xl bg-primary text-white font-semibold disabled:opacity-50 touch-manipulation"
              >
                {quantityLoading ? 'Saving…' : 'Save quantity'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showScanResultModal && item && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4" aria-modal="true" role="dialog" aria-labelledby="scan-result-title">
          <div className="absolute inset-0 bg-black/40 sm:bg-black/50" onClick={() => setShowScanResultModal(false)} />
          <div
            className="relative w-full sm:max-w-md sm:rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh] sm:max-h-[85vh] rounded-t-2xl overflow-hidden"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex-shrink-0 flex items-start gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
              <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                {item.image_url && !scanResultImageError ? (
                  <img
                    src={item.image_url}
                    alt=""
                    className="w-full h-full object-contain"
                    onError={() => setScanResultImageError(true)}
                  />
                ) : (
                  <span className="text-4xl" aria-hidden>{categoryIcon(item.category_name || categoryLabel)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <h2 id="scan-result-title" className="text-lg font-bold text-gray-900 leading-tight">{item.name}</h2>
                  <button
                    type="button"
                    onClick={() => setShowScanResultModal(false)}
                    className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 touch-manipulation -m-2"
                    aria-label="Close"
                  >
                    <svg className="w-6 h-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                {(item.returned_at || Boolean(item.needs_return) || (isAdmin && item.return_supplier)) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {item.returned_at && (
                      <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-700">Returned</span>
                    )}
                    {Boolean(item.needs_return) && !item.returned_at && (
                      <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">Needs to be returned</span>
                    )}
                    {isAdmin && item.return_supplier && (
                      <span className="text-xs text-gray-600">
                        {item.return_quantity > 1 ? `Return ${item.return_quantity} to ` : 'From: '}{item.return_supplier}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
              {lookupError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{lookupError}</div>
              )}
              {successMessage && (
                <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">{successMessage}</div>
              )}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 w-full">
                <div className="text-sm font-semibold text-gray-800">Current quantity</div>
                <div className="mt-1 text-2xl font-bold text-primary">
                  {formatQuantityWithSize(item)}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Last counted: {item.last_counted_at ? new Date(item.last_counted_at).toLocaleString() : '—'}
                  {item.last_counted_by_name && (
                    <span className="block mt-0.5">by {item.last_counted_by_name}</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    if (item.needs_return && !item.returned_at) return;
                    setLookupError(null);
                    setReturnSupplierInput('');
                    setReturnQuantityInput((Number(item?.quantity) ?? 0) > 1 ? String(item.quantity) : '');
                    setShowReturnSupplierModal(true);
                  }}
                  disabled={requestReturnLoading || (item.needs_return && !item.returned_at)}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border-2 border-orange-400 bg-orange-50 text-orange-800 font-medium hover:bg-orange-100 active:bg-orange-200 disabled:opacity-50 disabled:cursor-default touch-manipulation"
                  title={item.needs_return && !item.returned_at ? 'Already flagged for return' : 'Flag this part so office can return it to supplier'}
                >
                  {requestReturnLoading ? 'Sending…' : (item.needs_return && !item.returned_at) ? 'Flagged for return' : 'Need to return this'}
                </button>
                {isAdmin && Boolean(item.needs_return) && !item.returned_at && (
                  <button
                    type="button"
                    onClick={handleMarkReturned}
                    disabled={markReturnedLoading}
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 touch-manipulation"
                  >
                    {markReturnedLoading ? 'Saving…' : 'Mark returned'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRequestRefill}
                  disabled={refillRequestLoading}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-800 font-medium hover:bg-amber-100 active:bg-amber-200 disabled:opacity-50 touch-manipulation"
                >
                  {refillRequestLoading ? 'Sending…' : 'Tell office to order'}
                </button>
                <button
                  type="button"
                  onClick={openGotMoreFlow}
                  disabled={!item.barcode || !String(item.barcode).trim()}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border-2 border-primary bg-primary/10 text-primary font-medium hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                  title={!item.barcode ? 'Add a barcode in Edit to use this' : 'Scan this item, then enter new quantity'}
                >
                  Add to inventory
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {gotMoreAwaitingQuantity != null && item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog" aria-labelledby="got-more-quantity-title">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setGotMoreAwaitingQuantity(null); setGotMoreQuantityInput(''); }} />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 p-5">
            <h3 id="got-more-quantity-title" className="text-lg font-bold text-gray-900 mb-1">Scan confirmed</h3>
            <p className="text-sm text-gray-600 mb-4">Enter the new total quantity for {item.name}.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = safeNumber(gotMoreQuantityInput);
                if (q === null || q < 0) {
                  setLookupError('Enter a valid number.');
                  return;
                }
                setGotMoreAwaitingQuantity(null);
                setGotMoreQuantityInput('');
                submitQuantityAfterScan(q, null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New quantity ({item.unit || 'each'})</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={gotMoreQuantityInput}
                  onChange={(e) => setGotMoreQuantityInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary text-lg"
                  placeholder={String(gotMoreAwaitingQuantity.defaultQty)}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">Current: {formatQuantityWithSize(item)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setGotMoreAwaitingQuantity(null); setGotMoreQuantityInput(''); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quantityLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
                >
                  {quantityLoading ? 'Saving…' : 'Save quantity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Edit item</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Update name, price, return status, and other details. Price is optional.</p>
            {editError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{editError}</div>
            )}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                <input
                  value={editForm.barcode}
                  onChange={(e) => setEditForm((p) => ({ ...p, barcode: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={editForm.category_id}
                  onChange={(e) => setEditForm((p) => ({ ...p, category_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  value={editForm.unit}
                  onChange={(e) => setEditForm((p) => ({ ...p, unit: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. each, bottles, oz, quarts"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size per unit (optional, for fluids)</label>
                <input
                  value={editForm.size_per_unit}
                  onChange={(e) => setEditForm((p) => ({ ...p, size_per_unit: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. 32 oz, 1 gal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min quantity (target level for color coding)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editForm.min_quantity}
                  onChange={(e) => setEditForm((p) => ({ ...p, min_quantity: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. 2 — leave blank for no color"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_keep_in_stock"
                  checked={editForm.keep_in_stock}
                  onChange={(e) => setEditForm((p) => ({ ...p, keep_in_stock: e.target.checked }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="edit_keep_in_stock" className="text-sm font-medium text-gray-700">Always keep in inventory (uncheck for one-time parts)</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.price}
                  onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. 19.99"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
                <input
                  value={editForm.image_url}
                  onChange={(e) => setEditForm((p) => ({ ...p, image_url: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="https://..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_needs_return"
                  checked={editForm.needs_return}
                  onChange={(e) => setEditForm((p) => ({ ...p, needs_return: e.target.checked }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="edit_needs_return" className="text-sm font-medium text-gray-700">Needs to be returned</label>
              </div>
              {editForm.needs_return && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bought from (supplier)</label>
                  <input
                    value={editForm.return_supplier}
                    onChange={(e) => setEditForm((p) => ({ ...p, return_supplier: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="e.g. AutoZone, NAPA, Amazon"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={editSaving} className="px-5 py-2 rounded-lg bg-primary text-white font-semibold disabled:opacity-50">
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReturnSupplierModal && item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowReturnSupplierModal(false); setReturnSupplierInput(''); setReturnQuantityInput(''); setLookupError(null); }} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Flag for return</h3>
              <button type="button" onClick={() => { setShowReturnSupplierModal(false); setReturnSupplierInput(''); setReturnQuantityInput(''); setLookupError(null); }} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Which supplier was this part bought from? This creates a task for the office to return it.</p>
            {lookupError && (
              <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{lookupError}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier (required)</label>
                <input
                  value={returnSupplierInput}
                  onChange={(e) => setReturnSupplierInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleRequestReturn(returnSupplierInput, returnQuantityInput))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. AutoZone, NAPA, Amazon"
                  autoFocus
                />
              </div>
              {(Number(item?.quantity) ?? 0) > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">How many to return?</label>
                  <input
                    type="number"
                    min={1}
                    max={Number(item?.quantity) ?? 1}
                    value={returnQuantityInput}
                    onChange={(e) => setReturnQuantityInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder={`1–${item?.quantity ?? 0}`}
                    inputMode="numeric"
                  />
                  <p className="text-xs text-gray-500 mt-0.5">You have {item?.quantity ?? 0} in inventory.</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowReturnSupplierModal(false); setReturnSupplierInput(''); setReturnQuantityInput(''); setLookupError(null); }} className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="button" onClick={() => handleRequestReturn(returnSupplierInput, returnQuantityInput)} disabled={requestReturnLoading || !returnSupplierInput.trim() || ((Number(item?.quantity) ?? 0) > 1 && !returnQuantityInput.trim())} className="px-5 py-2 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-default">
                  {requestReturnLoading ? 'Sending…' : 'Flag for return'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewItemRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog" aria-labelledby="new-item-request-title">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowNewItemRequestModal(false); setLookupError(null); setNewItemRequestForm({ item_name: '', notes: '', barcode: '' }); }} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 id="new-item-request-title" className="text-lg font-bold text-gray-900">Request an item we don&apos;t have</h2>
              <button type="button" onClick={() => { setShowNewItemRequestModal(false); setLookupError(null); setNewItemRequestForm({ item_name: '', notes: '', barcode: '' }); }} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmitNewItemRequest}>
              {lookupError && <p className="text-sm text-red-600 mb-3">{lookupError}</p>}
              <div className="space-y-3">
                <div>
                  <label htmlFor="new-item-name" className="block text-sm font-medium text-gray-700 mb-1">Item name *</label>
                  <input
                    id="new-item-name"
                    type="text"
                    value={newItemRequestForm.item_name}
                    onChange={(e) => setNewItemRequestForm((f) => ({ ...f, item_name: e.target.value }))}
                    placeholder="e.g. Pack of binders"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="new-item-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <textarea
                    id="new-item-notes"
                    value={newItemRequestForm.notes}
                    onChange={(e) => setNewItemRequestForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Size, brand, or other details"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="new-item-barcode" className="block text-sm font-medium text-gray-700 mb-1">Barcode (optional)</label>
                  <input
                    id="new-item-barcode"
                    type="text"
                    value={newItemRequestForm.barcode}
                    onChange={(e) => setNewItemRequestForm((f) => ({ ...f, barcode: e.target.value }))}
                    placeholder="If you have it"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => { setShowNewItemRequestModal(false); setLookupError(null); setNewItemRequestForm({ item_name: '', notes: '', barcode: '' }); }} className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={newItemRequestLoading || !(newItemRequestForm.item_name || '').trim()} className="px-5 py-2 rounded-lg bg-primary text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-default">
                  {newItemRequestLoading ? 'Sending…' : 'Submit request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          setScanPurpose(null);
          setPendingQuantityUpdate(null);
          setPendingReceive(null);
        }}
        onDetected={(text) => {
          const code = String(text || '').trim();
          if (!code) return;

          if (scanPurpose === 'quantity_increase' && pendingQuantityUpdate && item?.id) {
            setScannerOpen(false);
            const payload = pendingQuantityUpdate;
            setPendingQuantityUpdate(null);
            setScanPurpose(null);
            api.post('/inventory/scan-log', { item_id: item.id, barcode: code, event_type: 'quantity_increase' })
              .then(() => submitQuantityAfterScan(payload.qty, payload.viscosity))
              .catch((e) => {
                setLookupError(e.response?.data?.error || 'Scan did not match this item. Try again.');
              });
            return;
          }

          if (scanPurpose === 'got_more_scan_first' && item?.id) {
            setScannerOpen(false);
            setScanPurpose(null);
            const expectedBarcode = String(item.barcode || '').trim();
            if (code !== expectedBarcode) {
              setLookupError(`Scanned item doesn't match. Expected: ${item.name || 'this item'}.`);
              return;
            }
            api.post('/inventory/scan-log', { item_id: item.id, barcode: code, event_type: 'quantity_increase' }).catch(() => {});
            const defaultQty = (item.quantity ?? 0) + 1;
            setGotMoreAwaitingQuantity({ defaultQty });
            setGotMoreQuantityInput(String(defaultQty));
            setLookupError(null);
            return;
          }

          if (scanPurpose === 'refill_receive' && pendingReceive) {
            const { requestId, itemId, qty } = pendingReceive;
            setScannerOpen(false);
            setPendingReceive(null);
            setScanPurpose(null);
            api.post('/inventory/scan-log', { item_id: itemId, barcode: code, event_type: 'refill_receive', refill_request_id: requestId })
              .then(() => submitReceiveAfterScan(requestId, qty))
              .catch((e) => {
                setLookupError(e.response?.data?.error || 'Scan did not match this item. Try again.');
              });
            return;
          }

          resetFlow();
          setBarcode(code);
          window.setTimeout(() => handleLookup(code, { openQuickModal: true }), 0);
        }}
      />
    </div>
  );
};

export default Inventory;

