import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

function normalizeBarcode(raw) {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim();
  return str.length ? str : null;
}

function pickCategoryNameFromItemName(name) {
  const n = String(name || '').toLowerCase();

  const has = (substr) => n.includes(substr);

  // Oils & fluids
  if (
    has('oil') ||
    has('atf') ||
    has('coolant') ||
    has('antifreeze') ||
    has('brake fluid') ||
    has('power steering') ||
    has('transmission') ||
    has('gear oil') ||
    has('quart') ||
    has('quarts') ||
    has('qt')
  ) {
    return 'Oils & Fluids';
  }

  // Cleaning
  if (
    has('fabuloso') ||
    has('cleaner') ||
    has('clean ') ||
    has('cleaning') ||
    has('degreaser') ||
    has('soap') ||
    has('sanitizer') ||
    has('disinfect')
  ) {
    return 'Cleaning';
  }

  // Spray paint & coatings
  if (
    has('spray paint') ||
    (has('spray') && has('paint')) ||
    has('aerosol') ||
    has('primer') ||
    has('enamel') ||
    has('clear coat') ||
    has('rustoleum') ||
    has('paint')
  ) {
    return 'Spray Paint & Coatings';
  }

  // Filters (before Parts so "oil filter" etc. match)
  if (has('filter')) return 'Filters';

  // Belts & hoses
  if (has('belt') || has('hose')) return 'Belts & Hoses';

  // Parts (pumps, grommets, sensors, motors, etc. — check before Fasteners so "washer pump" → Parts)
  if (
    has('pump') ||
    has('grommet') ||
    has('sensor') ||
    has('motor') ||
    has('relay') ||
    has('switch') ||
    has('cap') ||
    has('housing') ||
    has('bushing') ||
    has('bearing') ||
    has('seal') ||
    has('gasket') ||
    has('valve') ||
    has('module') ||
    has('actuator') ||
    has('solenoid') ||
    has('connector') ||
    has('bracket') ||
    has('reservoir') ||
    has('tank')
  ) {
    return 'Parts';
  }

  // Fasteners (bolts, nuts, screws, washers, plugs)
  if (
    has('washer') ||
    has('washers') ||
    has('bolt') ||
    has('nuts') ||
    has('nut ') ||
    has('screw') ||
    has('drain plug') ||
    has('plug')
  ) {
    return 'Fasteners';
  }

  return 'Other';
}

async function getCategoryIdByName(name) {
  const row = await db.getAsync(`SELECT id FROM inventory_categories WHERE name = ?`, [name]);
  return row?.id ?? null;
}

async function suggestCategoryId(name) {
  const categoryName = pickCategoryNameFromItemName(name);
  return await getCategoryIdByName(categoryName);
}

function isAdmin(req) {
  return req.user?.role === 'admin';
}

// GET /api/inventory/categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await db.allAsync(
      `SELECT id, name, sort_order FROM inventory_categories ORDER BY sort_order ASC, name ASC`
    );
    res.json({ categories: categories || [] });
  } catch (error) {
    console.error('Get inventory categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory/categories/suggest
router.post('/categories/suggest', async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const category_id = await suggestCategoryId(name);
    res.json({ category_id });
  } catch (error) {
    console.error('Suggest category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/inventory/items
router.get('/items', async (req, res) => {
  try {
    const { category_id, q, in_stock_only } = req.query || {};
    const where = [];
    const params = [];

    if (category_id) {
      where.push('i.category_id = ?');
      params.push(category_id);
    }

    if (q) {
      where.push('(i.name LIKE ? OR i.barcode LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }

    // Exclude returned items and 0 quantity from "in stock" list (e.g. main inventory view); search still finds all
    if (in_stock_only === '1' || in_stock_only === 'true') {
      where.push('(i.returned_at IS NULL)');
      where.push('(i.quantity IS NOT NULL AND i.quantity > 0)');
    }

    const fields = [
      'i.id',
      'i.barcode',
      'i.name',
      'i.category_id',
      'c.name AS category_name',
      'i.unit',
      'i.quantity',
      'i.weight',
      'i.weight_unit',
      'i.viscosity',
      'i.image_url',
      'i.size_per_unit',
      'i.last_counted_at',
      'i.last_counted_by',
      'u.full_name AS last_counted_by_name',
      'i.needs_return',
      'i.return_supplier',
      'i.return_quantity',
      'i.returned_at',
      'i.min_quantity',
      'i.keep_in_stock',
      'i.created_at',
      'i.updated_at'
    ];

    if (isAdmin(req)) {
      fields.splice(fields.indexOf('i.unit') + 1, 0, 'i.price');
    }

    const sql = `
      SELECT ${fields.join(', ')}
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON c.id = i.category_id
      LEFT JOIN users u ON u.id = i.last_counted_by
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY COALESCE(c.sort_order, 999) ASC, COALESCE(c.name, 'Other') ASC, i.name ASC
    `;

    const items = await db.allAsync(sql, params);
    res.json({ items: items || [] });
  } catch (error) {
    console.error('Get inventory items error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Try one barcode string against external APIs. Returns { name, brand, image_url, source } or null.
function pickImageUrl(product) {
  return product?.image_front_small_url || product?.image_front_url || product?.image_url || product?.image_thumb_url || null;
}

async function tryLookupOneCode(code) {
  if (!code) return null;

  // Open Food Facts
  try {
    const offUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`;
    const offRes = await fetch(offUrl, { headers: { 'User-Agent': 'SpectrumOutfitters-Inventory/1.0' } });
    if (offRes.ok) {
      const data = await offRes.json();
      const product = data?.product;
      if (product && data.status === 1) {
        const productName = product.product_name || product.abbreviated_product_name || product.generic_name_en || '';
        const brand = product.brands ? product.brands.split(',')[0].trim() : '';
        const name = [brand, productName].filter(Boolean).join(' - ') || productName || null;
        const image_url = pickImageUrl(product);
        if (name) return { name, brand: brand || null, image_url: image_url || null, source: 'openfoodfacts' };
      }
    }
  } catch (e) {}

  // UPCItemDB (numeric UPC/EAN; alphanumeric codes like 05083285aa are not in their DB)
  try {
    const itemRes = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (itemRes.ok) {
      const data = await itemRes.json();
      const item = data?.items?.[0];
      if (item?.title) {
        const brand = item.brand ? String(item.brand).trim() : '';
        const name = [brand, item.title].filter(Boolean).join(' - ') || item.title;
        const image_url = (item.images && item.images[0]) ? String(item.images[0]).trim() : null;
        return { name, brand: brand || null, image_url: image_url || null, source: 'upcitemdb' };
      }
    }
  } catch (e) {}

  return null;
}

// Try full barcode, then digits-only fallback (e.g. 05083285aa → 05083285) for external lookup.
async function lookupBarcodeFromExternalSources(barcode) {
  const code = String(barcode).trim();
  if (!code) return null;

  let result = await tryLookupOneCode(code);
  if (result) return result;

  const digitsOnly = code.replace(/\D/g, '');
  if (digitsOnly.length >= 8 && digitsOnly !== code) {
    result = await tryLookupOneCode(digitsOnly);
    if (result) return result;
  }

  return null;
}

// GET /api/inventory/items/lookup-product?barcode=xxx — figure out what the item is (tries Open Food Facts + UPCItemDB)
router.get('/items/lookup-product', async (req, res) => {
  try {
    const barcode = normalizeBarcode(req.query.barcode);
    if (!barcode) return res.status(400).json({ error: 'Barcode is required' });

    const result = await lookupBarcodeFromExternalSources(barcode);
    if (!result) {
      return res.status(404).json({ error: 'Product not found for this barcode' });
    }

    const category_id = await suggestCategoryId(result.name);
    res.json({ name: result.name, brand: result.brand || null, image_url: result.image_url || null, category_id, source: result.source });
  } catch (error) {
    console.error('Lookup product by barcode error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/inventory/items/by-barcode/:barcode
router.get('/items/by-barcode/:barcode', async (req, res) => {
  try {
    const barcode = normalizeBarcode(req.params.barcode);
    if (!barcode) return res.status(400).json({ error: 'Barcode is required' });

    const fields = [
      'i.id',
      'i.barcode',
      'i.name',
      'i.category_id',
      'c.name AS category_name',
      'i.unit',
      'i.quantity',
      'i.weight',
      'i.weight_unit',
      'i.viscosity',
      'i.image_url',
      'i.size_per_unit',
      'i.last_counted_at',
      'i.last_counted_by',
      'u.full_name AS last_counted_by_name',
      'i.needs_return',
      'i.return_supplier',
      'i.return_quantity',
      'i.returned_at',
      'i.min_quantity',
      'i.keep_in_stock',
      'i.created_at',
      'i.updated_at'
    ];
    if (isAdmin(req)) fields.splice(fields.indexOf('i.unit') + 1, 0, 'i.price');

    const item = await db.getAsync(
      `
        SELECT ${fields.join(', ')}
        FROM inventory_items i
        LEFT JOIN inventory_categories c ON c.id = i.category_id
        LEFT JOIN users u ON u.id = i.last_counted_by
        WHERE i.barcode = ?
      `,
      [barcode]
    );

    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ item });
  } catch (error) {
    console.error('Inventory lookup by barcode error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory/items — workers can add (name, category, unit, quantity); admins can also set price, image, etc.
router.post('/items', async (req, res) => {
  try {
    const { barcode: barcodeRaw, name, category_id, unit, price, quantity: quantityRaw, size_per_unit: sizePerUnitRaw, image_url: imageUrlRaw, min_quantity: minQtyRaw, keep_in_stock: keepInStockRaw } = req.body || {};
    const admin = isAdmin(req);

    if (!name) return res.status(400).json({ error: 'Name is required' });

    const barcode = normalizeBarcode(barcodeRaw);
    const initialQty = quantityRaw !== undefined && quantityRaw !== null && quantityRaw !== ''
      ? Number.parseFloat(quantityRaw)
      : 0;
    if (!Number.isFinite(initialQty) || initialQty < 0) {
      return res.status(400).json({ error: 'Quantity must be a non-negative number' });
    }
    const normalizedUnit = String(unit || '').trim() || 'each';
    const sizePerUnit = admin && sizePerUnitRaw !== null && sizePerUnitRaw !== undefined && String(sizePerUnitRaw).trim()
      ? String(sizePerUnitRaw).trim()
      : null;
    const imageUrl = admin && imageUrlRaw !== null && imageUrlRaw !== undefined && String(imageUrlRaw).trim()
      ? String(imageUrlRaw).trim()
      : null;
    const minQty = admin && minQtyRaw !== null && minQtyRaw !== undefined && minQtyRaw !== '' ? Number.parseFloat(minQtyRaw) : null;
    const keepInStock = admin && (keepInStockRaw === false || keepInStockRaw === 0 || keepInStockRaw === '0') ? 0 : 1;

    let finalCategoryId = category_id ? Number(category_id) : null;
    if (!finalCategoryId) {
      finalCategoryId = await suggestCategoryId(name);
    }
    if (!finalCategoryId) {
      finalCategoryId = await getCategoryIdByName('Other');
    }

    let parsedPrice = null;
    if (admin && price !== undefined && price !== null && price !== '') {
      parsedPrice = Number.parseFloat(price);
      if (!Number.isFinite(parsedPrice)) return res.status(400).json({ error: 'Invalid price' });
    }
    if (minQty !== null && !Number.isFinite(minQty)) {
      return res.status(400).json({ error: 'Invalid min quantity' });
    }

    const result = await db.runAsync(
      `
        INSERT INTO inventory_items (barcode, name, category_id, unit, price, quantity, size_per_unit, image_url, min_quantity, keep_in_stock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [barcode, name, finalCategoryId, normalizedUnit, parsedPrice, initialQty, sizePerUnit, imageUrl, minQty, keepInStock]
    );

    const created = await db.getAsync(
      `
        SELECT i.id, i.barcode, i.name, i.category_id, c.name AS category_name, i.unit, i.price, i.quantity,
               i.weight, i.weight_unit, i.viscosity, i.image_url, i.size_per_unit, i.last_counted_at, i.last_counted_by, u.full_name AS last_counted_by_name, i.needs_return, i.return_supplier, i.return_quantity, i.returned_at, i.min_quantity, i.keep_in_stock, i.created_at, i.updated_at
        FROM inventory_items i
        LEFT JOIN inventory_categories c ON c.id = i.category_id
        LEFT JOIN users u ON u.id = i.last_counted_by
        WHERE i.id = ?
      `,
      [result.lastID]
    );

    res.status(201).json({ item: created });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE constraint failed: inventory_items.barcode')) {
      return res.status(409).json({ error: 'That barcode already exists' });
    }
    console.error('Create inventory item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/inventory/items/:id (admin only)
router.put('/items/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const current = await db.getAsync('SELECT * FROM inventory_items WHERE id = ?', [id]);
    if (!current) return res.status(404).json({ error: 'Item not found' });

    const { barcode: barcodeRaw, name, category_id, unit, price, image_url: imageUrlRaw, needs_return: needsReturnRaw, return_supplier: returnSupplier, size_per_unit: sizePerUnitRaw, min_quantity: minQtyRaw, keep_in_stock: keepInStockRaw } = req.body || {};
    const barcode = barcodeRaw === undefined ? current.barcode : normalizeBarcode(barcodeRaw);
    const finalName = name === undefined ? current.name : String(name).trim();
    const finalUnit = unit === undefined ? current.unit : (String(unit).trim() || 'each');
    const finalCategoryId = category_id === undefined ? current.category_id : (category_id ? Number(category_id) : null);
    const finalImageUrl = imageUrlRaw === undefined ? (current.image_url ?? null) : (imageUrlRaw !== null && imageUrlRaw !== '' && String(imageUrlRaw).trim() ? String(imageUrlRaw).trim() : null);
    const finalNeedsReturn = needsReturnRaw === undefined ? (current.needs_return ?? 0) : (needsReturnRaw === true || needsReturnRaw === 1 || needsReturnRaw === '1' ? 1 : 0);
    const finalReturnSupplier = returnSupplier === undefined ? (current.return_supplier ?? null) : (returnSupplier !== null && returnSupplier !== '' && String(returnSupplier).trim() ? String(returnSupplier).trim() : null);
    const finalSizePerUnit = sizePerUnitRaw === undefined ? (current.size_per_unit ?? null) : (sizePerUnitRaw !== null && sizePerUnitRaw !== '' && String(sizePerUnitRaw).trim() ? String(sizePerUnitRaw).trim() : null);
    const finalMinQty = minQtyRaw === undefined ? (current.min_quantity ?? null) : (minQtyRaw !== null && minQtyRaw !== '' ? Number.parseFloat(minQtyRaw) : null);
    const finalKeepInStock = keepInStockRaw === undefined ? (current.keep_in_stock ?? 1) : (keepInStockRaw === true || keepInStockRaw === 1 || keepInStockRaw === '1' ? 1 : 0);

    const parsedPrice = price === undefined
      ? current.price
      : (price === null || price === '' ? null : Number.parseFloat(price));

    if (parsedPrice !== null && parsedPrice !== undefined && !Number.isFinite(parsedPrice)) {
      return res.status(400).json({ error: 'Invalid price' });
    }

    if (!finalName) return res.status(400).json({ error: 'Name is required' });

    if (finalMinQty !== null && finalMinQty !== undefined && !Number.isFinite(finalMinQty)) {
      return res.status(400).json({ error: 'Min quantity must be a number' });
    }

    await db.runAsync(
      `
        UPDATE inventory_items
        SET barcode = ?, name = ?, category_id = ?, unit = ?, price = ?, image_url = ?, needs_return = ?, return_supplier = ?, size_per_unit = ?, min_quantity = ?, keep_in_stock = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [barcode, finalName, finalCategoryId, finalUnit, parsedPrice, finalImageUrl, finalNeedsReturn, finalReturnSupplier, finalSizePerUnit, finalMinQty, finalKeepInStock, id]
    );

    const wasAlreadyFlagged = (current.needs_return === 1 || current.needs_return === '1');
    if (finalNeedsReturn === 1 && finalReturnSupplier && !wasAlreadyFlagged) {
      try {
        const userName = req.user?.full_name || req.user?.username || 'Admin';
        const taskTitle = `Return: ${finalName}`;
        const taskDesc = `Flagged by ${userName}. Return to supplier: ${finalReturnSupplier}.`;
        await db.runAsync(
          `INSERT INTO tasks (title, description, created_by, status, priority, category) VALUES (?, ?, ?, 'todo', 'medium', 'Admin')`,
          [taskTitle, taskDesc, req.user.id]
        );
      } catch (e) {
        console.error('Create return task on PUT error:', e);
      }
    }

    const updated = await db.getAsync(
      `
        SELECT i.id, i.barcode, i.name, i.category_id, c.name AS category_name, i.unit, i.price, i.quantity,
               i.weight, i.weight_unit, i.viscosity, i.image_url, i.size_per_unit, i.last_counted_at, i.last_counted_by, u.full_name AS last_counted_by_name, i.needs_return, i.return_supplier, i.return_quantity, i.returned_at, i.min_quantity, i.keep_in_stock, i.created_at, i.updated_at
        FROM inventory_items i
        LEFT JOIN inventory_categories c ON c.id = i.category_id
        LEFT JOIN users u ON u.id = i.last_counted_by
        WHERE i.id = ?
      `,
      [id]
    );

    res.json({ item: updated });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE constraint failed: inventory_items.barcode')) {
      return res.status(409).json({ error: 'That barcode already exists' });
    }
    console.error('Update inventory item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory/items/:id/mark-returned (admin only) — check off item as returned
router.post('/items/:id/mark-returned', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const row = await db.getAsync('SELECT id FROM inventory_items WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Item not found' });

    await db.runAsync(
      `UPDATE inventory_items SET returned_at = CURRENT_TIMESTAMP, needs_return = 0, return_quantity = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );

    const fields = [
      'i.id', 'i.barcode', 'i.name', 'i.category_id', 'c.name AS category_name', 'i.unit', 'i.price', 'i.quantity',
      'i.weight', 'i.weight_unit', 'i.viscosity', 'i.image_url', 'i.size_per_unit', 'i.last_counted_at', 'i.last_counted_by',
      'u.full_name AS last_counted_by_name', 'i.needs_return', 'i.return_supplier', 'i.return_quantity', 'i.returned_at', 'i.min_quantity', 'i.keep_in_stock', 'i.created_at', 'i.updated_at'
    ];
    const item = await db.getAsync(
      `SELECT ${fields.join(', ')} FROM inventory_items i
       LEFT JOIN inventory_categories c ON c.id = i.category_id
       LEFT JOIN users u ON u.id = i.last_counted_by
       WHERE i.id = ?`,
      [id]
    );
    res.json({ item });
  } catch (error) {
    console.error('Mark returned error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory/items/:id/request-return — any authenticated user (worker or admin) flags item as need to return; requires supplier; optional return_quantity when multiple in stock
router.post('/items/:id/request-return', async (req, res) => {
  try {
    const { id } = req.params;
    const { return_supplier: returnSupplier, return_quantity: returnQtyRaw } = req.body || {};
    const supplier = returnSupplier != null && String(returnSupplier).trim() ? String(returnSupplier).trim() : null;
    if (!supplier) return res.status(400).json({ error: 'Supplier is required. Where was this part bought from?' });

    const row = await db.getAsync('SELECT id, name, quantity FROM inventory_items WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Item not found' });

    const currentQty = row.quantity != null ? Number(row.quantity) : 0;
    let returnQty = null;
    if (returnQtyRaw !== undefined && returnQtyRaw !== null && returnQtyRaw !== '') {
      const parsed = Number.parseFloat(returnQtyRaw);
      if (!Number.isFinite(parsed) || parsed < 1) {
        return res.status(400).json({ error: 'Return quantity must be at least 1.' });
      }
      if (currentQty > 1 && parsed > currentQty) {
        return res.status(400).json({ error: `Return quantity cannot exceed current quantity (${currentQty}).` });
      }
      returnQty = Math.floor(parsed);
    }
    if (currentQty > 1 && (returnQty == null || returnQty < 1)) {
      return res.status(400).json({ error: 'Please specify how many need to be returned.' });
    }
    const effectiveReturnQty = returnQty != null ? returnQty : (currentQty >= 1 ? 1 : 1);

    await db.runAsync(
      `UPDATE inventory_items SET needs_return = 1, returned_at = NULL, return_supplier = ?, return_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [supplier, returnQty, id]
    );

    const userName = req.user.full_name || req.user.username || 'Someone';
    const qtyText = effectiveReturnQty > 1 ? ` (${effectiveReturnQty} units)` : '';
    const notificationMessage = `↩️ Return requested: ${userName} flagged "${row.name}"${qtyText} — return to supplier: ${supplier}.`;
    try {
      const msgResult = await db.runAsync(
        `INSERT INTO messages (sender_id, message, is_team_message, board_type) VALUES (?, ?, 1, 'admin_board')`,
        [req.user.id, notificationMessage]
      );
      const msgRow = await db.getAsync(
        `SELECT m.*, u.full_name as sender_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?`,
        [msgResult.lastID]
      );
      const io = req.app.get('io');
      if (io && msgRow) {
        io.to('admin').emit('new_message', {
          ...msgRow,
          is_team_message: 1,
          board_type: 'admin_board',
          type: 'admin_board'
        });
      }
      if (io) {
        io.to('admin').emit('admin_notification', {
          type: 'return_requested',
          itemId: id,
          itemName: row.name,
          employeeName: userName,
          message: notificationMessage,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('Return request notification error:', e);
    }

    try {
      const taskTitle = `Return: ${row.name}`;
      const taskDesc = effectiveReturnQty > 1
        ? `Flagged by ${userName}. Return ${effectiveReturnQty} to supplier: ${supplier}.`
        : `Flagged by ${userName}. Return to supplier: ${supplier}.`;
      await db.runAsync(
        `INSERT INTO tasks (title, description, created_by, status, priority, category) VALUES (?, ?, ?, 'todo', 'medium', 'Admin')`,
        [taskTitle, taskDesc, req.user.id]
      );
    } catch (e) {
      console.error('Create return task error:', e);
    }

    const fields = [
      'i.id', 'i.barcode', 'i.name', 'i.category_id', 'c.name AS category_name', 'i.unit', 'i.price', 'i.quantity',
      'i.weight', 'i.weight_unit', 'i.viscosity', 'i.image_url', 'i.size_per_unit', 'i.last_counted_at', 'i.last_counted_by',
      'u.full_name AS last_counted_by_name', 'i.needs_return', 'i.return_supplier', 'i.return_quantity', 'i.returned_at', 'i.min_quantity', 'i.keep_in_stock', 'i.created_at', 'i.updated_at'
    ];
    if (isAdmin(req)) fields.splice(fields.indexOf('i.unit') + 1, 0, 'i.price');
    const item = await db.getAsync(
      `SELECT ${fields.join(', ')} FROM inventory_items i
       LEFT JOIN inventory_categories c ON c.id = i.category_id
       LEFT JOIN users u ON u.id = i.last_counted_by
       WHERE i.id = ?`,
      [id]
    );
    res.json({ item });
  } catch (error) {
    console.error('Request return error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory/items/:id/quantity
router.post('/items/:id/quantity', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, viscosity } = req.body || {};

    const parsedQuantity = Number.parseFloat(quantity);
    if (!Number.isFinite(parsedQuantity)) {
      return res.status(400).json({ error: 'Quantity must be a number' });
    }
    if (parsedQuantity < 0) {
      return res.status(400).json({ error: 'Quantity cannot be negative' });
    }

    const row = await db.getAsync('SELECT id, quantity FROM inventory_items WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Item not found' });
    const quantityBefore = row.quantity ?? 0;

    const normViscosity = (viscosity !== undefined && viscosity !== null && String(viscosity).trim()) ? String(viscosity).trim() : null;

    await db.runAsync(
      `
        UPDATE inventory_items
        SET quantity = ?, viscosity = ?, last_counted_at = CURRENT_TIMESTAMP, last_counted_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [parsedQuantity, normViscosity, req.user.id, id]
    );

    await db.runAsync(
      `INSERT INTO inventory_quantity_log (item_id, quantity_before, quantity_after, changed_by, reason) VALUES (?, ?, ?, ?, 'count')`,
      [id, quantityBefore, parsedQuantity, req.user.id]
    ).catch(() => {});

    const fields = [
      'i.id',
      'i.barcode',
      'i.name',
      'i.category_id',
      'c.name AS category_name',
      'i.unit',
      'i.quantity',
      'i.weight',
      'i.weight_unit',
      'i.viscosity',
      'i.image_url',
      'i.last_counted_at',
      'i.last_counted_by',
      'u.full_name AS last_counted_by_name',
      'i.needs_return',
      'i.return_supplier',
      'i.return_quantity',
      'i.returned_at',
      'i.size_per_unit',
      'i.min_quantity',
      'i.keep_in_stock',
      'i.created_at',
      'i.updated_at'
    ];
    if (isAdmin(req)) fields.splice(fields.indexOf('i.unit') + 1, 0, 'i.price');

    const item = await db.getAsync(
      `
        SELECT ${fields.join(', ')}
        FROM inventory_items i
        LEFT JOIN inventory_categories c ON c.id = i.category_id
        LEFT JOIN users u ON u.id = i.last_counted_by
        WHERE i.id = ?
      `,
      [id]
    );

    res.json({ item });
  } catch (error) {
    console.error('Update inventory quantity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory/scan-log — record a barcode scan when inventory goes up (required before quantity increase or receive)
router.post('/scan-log', async (req, res) => {
  try {
    const { item_id: itemIdRaw, barcode: barcodeRaw, event_type: eventType, refill_request_id: refillRequestId } = req.body || {};
    const itemId = itemIdRaw != null ? Number(itemIdRaw) : null;
    const barcode = normalizeBarcode(barcodeRaw);
    if (!itemId || !Number.isFinite(itemId) || !barcode) {
      return res.status(400).json({ error: 'item_id and barcode are required' });
    }
    const row = await db.getAsync('SELECT id, barcode FROM inventory_items WHERE id = ?', [itemId]);
    if (!row) return res.status(404).json({ error: 'Item not found' });
    const itemBarcode = normalizeBarcode(row.barcode);
    if (itemBarcode !== barcode) {
      return res.status(400).json({ error: 'Barcode does not match this item. Scan the correct item.' });
    }
    const type = eventType === 'refill_receive' ? 'refill_receive' : 'quantity_increase';
    const refillId = refillRequestId != null && Number.isFinite(Number(refillRequestId)) ? Number(refillRequestId) : null;
    await db.runAsync(
      `INSERT INTO inventory_scan_log (item_id, barcode, scanned_by, event_type, refill_request_id) VALUES (?, ?, ?, ?, ?)`,
      [itemId, barcode, req.user.id, type, refillId]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Scan log error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---- Refill requests ----

// POST /api/inventory/refill-requests — worker requests more (notifies admins)
router.post('/refill-requests', async (req, res) => {
  try {
    const { item_id } = req.body || {};
    const itemId = item_id != null ? Number(item_id) : null;
    if (!itemId || !Number.isFinite(itemId)) {
      return res.status(400).json({ error: 'item_id is required' });
    }
    const item = await db.getAsync('SELECT id, name FROM inventory_items WHERE id = ?', [itemId]);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const result = await db.runAsync(
      `INSERT INTO inventory_refill_requests (item_id, requested_by, status) VALUES (?, ?, 'pending')`,
      [itemId, req.user.id]
    );
    const requestId = result.lastID;

    const requestRow = await db.getAsync(
      `SELECT r.*, i.name AS item_name, u.full_name AS requested_by_name
       FROM inventory_refill_requests r
       JOIN inventory_items i ON i.id = r.item_id
       JOIN users u ON u.id = r.requested_by
       WHERE r.id = ?`,
      [requestId]
    );

    const userName = req.user.full_name || req.user.username || 'Someone';
    const notificationMessage = `📦 Reorder requested: ${userName} asked the office to order "${item.name}".`;
    try {
      const msgResult = await db.runAsync(
        `INSERT INTO messages (sender_id, message, is_team_message, board_type) VALUES (?, ?, 1, 'admin_board')`,
        [req.user.id, notificationMessage]
      );
      const msgRow = await db.getAsync(
        `SELECT m.*, u.full_name as sender_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?`,
        [msgResult.lastID]
      );
      const io = req.app.get('io');
      if (io && msgRow) {
        io.to('admin').emit('new_message', {
          ...msgRow,
          is_team_message: 1,
          board_type: 'admin_board',
          type: 'admin_board'
        });
      }
      if (io) {
        io.to('admin').emit('admin_notification', {
          type: 'reorder_requested',
          requestId,
          itemId,
          itemName: item.name,
          employeeName: userName,
          message: notificationMessage,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('Refill notification error:', e);
    }

    res.status(201).json({ request: requestRow });
  } catch (error) {
    console.error('Create refill request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/inventory/refill-requests/count — for admin dashboard (?status=pending)
router.get('/refill-requests/count', async (req, res) => {
  try {
    const status = req.query.status && /^(pending|ordered|received|cancelled)$/.test(req.query.status) ? req.query.status : null;
    let sql = 'SELECT COUNT(*) AS count FROM inventory_refill_requests';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    const row = await db.getAsync(sql, params);
    res.json({ count: row?.count ?? 0 });
  } catch (error) {
    console.error('Refill requests count error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/inventory/refill-requests — list (optional ?status=pending|ordered|received)
router.get('/refill-requests', async (req, res) => {
  try {
    const status = req.query.status && /^(pending|ordered|received|cancelled)$/.test(req.query.status) ? req.query.status : null;
    let sql = `
      SELECT r.*, i.name AS item_name, i.unit AS item_unit, i.quantity AS item_quantity,
             u1.full_name AS requested_by_name, u2.full_name AS received_by_name
      FROM inventory_refill_requests r
      JOIN inventory_items i ON i.id = r.item_id
      JOIN users u1 ON u1.id = r.requested_by
      LEFT JOIN users u2 ON u2.id = r.received_by
    `;
    const params = [];
    if (status) {
      sql += ` WHERE r.status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY r.requested_at DESC`;
    const requests = await db.allAsync(sql, params);
    res.json({ requests: requests || [] });
  } catch (error) {
    console.error('List refill requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/inventory/refill-requests/expected — refills with expected date (today or future), status ordered
router.get('/refill-requests/expected', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const requests = await db.allAsync(
      `SELECT r.*, i.name AS item_name, i.unit AS item_unit, u1.full_name AS requested_by_name
       FROM inventory_refill_requests r
       JOIN inventory_items i ON i.id = r.item_id
       JOIN users u1 ON u1.id = r.requested_by
       WHERE r.status = 'ordered' AND r.expected_arrival_date IS NOT NULL AND r.expected_arrival_date >= ?
       ORDER BY r.expected_arrival_date ASC, r.id ASC`,
      [today]
    );
    res.json({ requests: requests || [] });
  } catch (error) {
    console.error('Expected refills error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/inventory/refill-requests/:id — admin sets expected date, where ordered, price, and marks ordered
router.patch('/refill-requests/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { expected_arrival_date, admin_notes, status, ordered_from, order_price, order_quantity } = req.body || {};
    const row = await db.getAsync('SELECT id, status FROM inventory_refill_requests WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Refill request not found' });

    const updates = [];
    const params = [];
    if (expected_arrival_date !== undefined) {
      const d = expected_arrival_date === null || expected_arrival_date === '' ? null : String(expected_arrival_date).trim().slice(0, 10);
      updates.push('expected_arrival_date = ?');
      params.push(d);
    }
    if (admin_notes !== undefined) {
      updates.push('admin_notes = ?');
      params.push(String(admin_notes).trim() || null);
    }
    if (ordered_from !== undefined) {
      updates.push('ordered_from = ?');
      params.push(ordered_from !== null && ordered_from !== '' && String(ordered_from).trim() ? String(ordered_from).trim() : null);
    }
    if (order_price !== undefined) {
      const p = order_price === null || order_price === '' ? null : Number.parseFloat(order_price);
      updates.push('order_price = ?');
      params.push(p !== null && Number.isFinite(p) ? p : null);
    }
    if (order_quantity !== undefined) {
      const qty = order_quantity === null || order_quantity === '' ? null : Number.parseFloat(order_quantity);
      updates.push('order_quantity = ?');
      params.push(qty !== null && Number.isFinite(qty) && qty >= 0 ? qty : null);
    }
    if (status && ['pending', 'ordered', 'received', 'cancelled'].includes(status)) {
      updates.push('status = ?');
      params.push(status);
    }
    if (updates.length === 0) {
      const full = await db.getAsync(
        `SELECT r.*, i.name AS item_name, i.unit AS item_unit, u1.full_name AS requested_by_name, u2.full_name AS received_by_name
         FROM inventory_refill_requests r JOIN inventory_items i ON i.id = r.item_id
         JOIN users u1 ON u1.id = r.requested_by LEFT JOIN users u2 ON u2.id = r.received_by WHERE r.id = ?`,
        [id]
      );
      return res.json({ request: full });
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    await db.runAsync(
      `UPDATE inventory_refill_requests SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    const request = await db.getAsync(
      `SELECT r.*, i.name AS item_name, i.unit AS item_unit, u1.full_name AS requested_by_name, u2.full_name AS received_by_name
       FROM inventory_refill_requests r JOIN inventory_items i ON i.id = r.item_id
       JOIN users u1 ON u1.id = r.requested_by LEFT JOIN users u2 ON u2.id = r.received_by WHERE r.id = ?`,
      [id]
    );
    res.json({ request });
  } catch (error) {
    console.error('Update refill request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/inventory/refill-requests/:id — admin only; remove/cancel a reorder request
router.delete('/refill-requests/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const row = await db.getAsync('SELECT id FROM inventory_refill_requests WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Refill request not found' });
    await db.runAsync('DELETE FROM inventory_refill_requests WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete refill request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory/refill-requests/:id/receive — record received quantity and update inventory
router.post('/refill-requests/:id/receive', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity_received } = req.body || {};
    const qty = quantity_received === undefined || quantity_received === null || quantity_received === '' ? null : Number.parseFloat(quantity_received);
    if (qty === null || !Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({ error: 'quantity_received must be a non-negative number' });
    }

    const row = await db.getAsync(
      `SELECT r.*, i.name AS item_name, i.quantity AS current_quantity FROM inventory_refill_requests r
       JOIN inventory_items i ON i.id = r.item_id WHERE r.id = ?`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Refill request not found' });
    if (row.status === 'received') {
      return res.status(400).json({ error: 'This refill was already received' });
    }
    if (row.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot receive a cancelled request' });
    }

    const quantityBefore = row.current_quantity ?? 0;
    const quantityAfter = quantityBefore + qty;

    await db.runAsync(
      `UPDATE inventory_items SET quantity = ?, last_counted_at = CURRENT_TIMESTAMP, last_counted_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [quantityAfter, req.user.id, row.item_id]
    );
    await db.runAsync(
      `INSERT INTO inventory_quantity_log (item_id, quantity_before, quantity_after, changed_by, reason, refill_request_id) VALUES (?, ?, ?, ?, 'refill_received', ?)`,
      [row.item_id, quantityBefore, quantityAfter, req.user.id, id]
    ).catch(() => {});
    await db.runAsync(
      `UPDATE inventory_refill_requests SET status = 'received', quantity_received = ?, received_at = CURRENT_TIMESTAMP, received_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [qty, req.user.id, id]
    );

    const request = await db.getAsync(
      `SELECT r.*, i.name AS item_name, i.unit AS item_unit, i.quantity AS item_quantity,
       u1.full_name AS requested_by_name, u2.full_name AS received_by_name
       FROM inventory_refill_requests r JOIN inventory_items i ON i.id = r.item_id
       JOIN users u1 ON u1.id = r.requested_by LEFT JOIN users u2 ON u2.id = r.received_by WHERE r.id = ?`,
      [id]
    );
    res.json({ request, item: { ...request, quantity: quantityAfter } });
  } catch (error) {
    console.error('Receive refill error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---- New item requests (workers request items we don't have) ----
// POST /api/inventory/new-item-requests — worker submits request for an item not in inventory
router.post('/new-item-requests', async (req, res) => {
  try {
    const { item_name, notes, barcode } = req.body || {};
    const name = (item_name || '').trim();
    if (!name) return res.status(400).json({ error: 'Item name is required' });
    const requestedBy = req.user.id;
    await db.runAsync(
      `INSERT INTO inventory_new_item_requests (requested_by, item_name, notes, barcode, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [requestedBy, name, (notes || '').trim() || null, (barcode || '').trim() || null]
    );
    const row = await db.getAsync(
      `SELECT r.*, u.full_name AS requested_by_name FROM inventory_new_item_requests r
       JOIN users u ON u.id = r.requested_by WHERE r.id = last_insert_rowid()`
    );
    res.status(201).json({ request: row });
  } catch (error) {
    console.error('Create new item request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/inventory/new-item-requests — list (admin: all; worker: own). ?status=pending|addressed|dismissed
router.get('/new-item-requests', async (req, res) => {
  try {
    const { status } = req.query || {};
    const isAdmin = req.user.role === 'admin';
    let sql = `SELECT r.*, u.full_name AS requested_by_name FROM inventory_new_item_requests r
               JOIN users u ON u.id = r.requested_by`;
    const params = [];
    if (!isAdmin) {
      sql += ' WHERE r.requested_by = ?';
      params.push(req.user.id);
    }
    if (status && ['pending', 'addressed', 'dismissed'].includes(status)) {
      sql += (params.length ? ' AND' : ' WHERE') + ' r.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY r.created_at DESC';
    const list = await db.allAsync(sql, params);
    res.json({ requests: list || [] });
  } catch (error) {
    console.error('List new item requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/inventory/new-item-requests/:id — admin marks addressed or dismissed
router.patch('/new-item-requests/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!['addressed', 'dismissed'].includes(status)) return res.status(400).json({ error: 'status must be addressed or dismissed' });
    const row = await db.getAsync('SELECT id FROM inventory_new_item_requests WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Request not found' });
    await db.runAsync(
      `UPDATE inventory_new_item_requests SET status = ?, addressed_at = CURRENT_TIMESTAMP, addressed_by = ? WHERE id = ?`,
      [status, req.user.id, id]
    );
    const updated = await db.getAsync(
      `SELECT r.*, u.full_name AS requested_by_name FROM inventory_new_item_requests r
       JOIN users u ON u.id = r.requested_by WHERE r.id = ?`,
      [id]
    );
    res.json({ request: updated });
  } catch (error) {
    console.error('Update new item request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

