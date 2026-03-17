import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { getCustomer, getOrderLineItems, getRepairOrder, getVehicle } from '../utils/shopmonkey.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

function pickId(...candidates) {
  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c).trim();
    if (s) return s;
  }
  return null;
}

function pickCustomerId(order) {
  return pickId(order?.customerId, order?.customer_id, order?.customer?.id, order?.customer?.customerId, order?.customer?.customer_id);
}

function pickVehicleId(order) {
  return pickId(order?.vehicleId, order?.vehicle_id, order?.vehicle?.id, order?.vehicle?.vehicleId, order?.vehicle?.vehicle_id);
}

function formatCustomerName(customer) {
  const name = pickId(customer?.name, customer?.displayName, customer?.fullName);
  if (name) return name;
  const first = pickId(customer?.firstName, customer?.first_name);
  const last = pickId(customer?.lastName, customer?.last_name);
  return [first, last].filter(Boolean).join(' ') || null;
}

function extractLineItemFields(li) {
  const id = pickId(li?.id, li?._id, li?.lineItemId, li?.line_item_id);
  const description = pickId(li?.name, li?.description, li?.title, li?.displayName, li?.itemName) || null;
  const lineType = pickId(li?.type, li?.lineType, li?.line_type, li?.kind) || null;
  const partNumber = pickId(li?.partNumber, li?.part_number, li?.sku, li?.vendorPartNumber, li?.supplierPartNumber) || null;

  const quantityRaw = li?.quantity ?? li?.qty ?? li?.units;
  const quantity = quantityRaw != null && quantityRaw !== '' ? Number.parseFloat(quantityRaw) : null;

  const unitPriceCentsRaw = li?.unitPriceCents ?? li?.unit_price_cents ?? li?.priceCents ?? li?.price_cents;
  const unitPriceCents = unitPriceCentsRaw != null && unitPriceCentsRaw !== '' ? Number.parseInt(unitPriceCentsRaw, 10) : null;

  const totalCentsRaw = li?.totalCents ?? li?.total_cents ?? li?.amountCents ?? li?.amount_cents;
  const totalCents = totalCentsRaw != null && totalCentsRaw !== '' ? Number.parseInt(totalCentsRaw, 10) : null;

  return {
    shopmonkey_line_item_id: id,
    line_type: lineType,
    description,
    part_number: partNumber,
    quantity: Number.isFinite(quantity) ? quantity : null,
    unit_price_cents: Number.isFinite(unitPriceCents) ? unitPriceCents : null,
    total_cents: Number.isFinite(totalCents) ? totalCents : null,
  };
}

async function resolveInventoryItemId({ part_number, description }) {
  if (part_number) {
    const row = await db.getAsync(
      `SELECT id FROM inventory_items WHERE TRIM(COALESCE(supplier_part_number, '')) = ? LIMIT 1`,
      [String(part_number).trim()]
    );
    if (row?.id) return row.id;
  }
  if (description) {
    const row = await db.getAsync(
      `SELECT id FROM inventory_items WHERE name LIKE ? ORDER BY LENGTH(name) ASC LIMIT 1`,
      [`%${String(description).trim()}%`]
    );
    if (row?.id) return row.id;
  }
  return null;
}

async function upsertCustomerFromOrder(order) {
  const customerId = pickCustomerId(order);
  if (!customerId) return null;

  const customerObj = order?.customer && typeof order.customer === 'object' ? order.customer : await getCustomer(customerId).catch(() => null);
  const displayName = formatCustomerName(customerObj) || formatCustomerName(order?.customer) || null;
  const phone = pickId(customerObj?.phone, customerObj?.phoneNumber, customerObj?.phone_number);
  const email = pickId(customerObj?.email, customerObj?.emailAddress, customerObj?.email_address);

  await db.runAsync(
    `INSERT INTO crm_customers (shopmonkey_customer_id, display_name, phone, email, raw_json, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(shopmonkey_customer_id) DO UPDATE SET
       display_name=excluded.display_name,
       phone=excluded.phone,
       email=excluded.email,
       raw_json=excluded.raw_json,
       updated_at=CURRENT_TIMESTAMP`,
    [customerId, displayName, phone || null, email || null, customerObj ? JSON.stringify(customerObj) : null]
  );

  return customerId;
}

async function upsertVehicleFromOrder(order) {
  const vehicleId = pickVehicleId(order);
  if (!vehicleId) return null;

  const customerId = pickCustomerId(order);
  const vehicleObj = order?.vehicle && typeof order.vehicle === 'object' ? order.vehicle : await getVehicle(vehicleId).catch(() => null);

  const year = pickId(vehicleObj?.year, order?.vehicle?.year);
  const make = pickId(vehicleObj?.make, order?.vehicle?.make);
  const model = pickId(vehicleObj?.model, order?.vehicle?.model);
  const vin = pickId(vehicleObj?.vin, order?.vehicle?.vin);
  const plate = pickId(vehicleObj?.licensePlate, vehicleObj?.license_plate, order?.vehicle?.licensePlate, order?.vehicle?.license_plate);

  await db.runAsync(
    `INSERT INTO crm_vehicles (shopmonkey_vehicle_id, shopmonkey_customer_id, year, make, model, vin, license_plate, raw_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(shopmonkey_vehicle_id) DO UPDATE SET
       shopmonkey_customer_id=excluded.shopmonkey_customer_id,
       year=excluded.year,
       make=excluded.make,
       model=excluded.model,
       vin=excluded.vin,
       license_plate=excluded.license_plate,
       raw_json=excluded.raw_json,
       updated_at=CURRENT_TIMESTAMP`,
    [vehicleId, customerId, year || null, make || null, model || null, vin || null, plate || null, vehicleObj ? JSON.stringify(vehicleObj) : null]
  );

  return vehicleId;
}

async function upsertInvoice(order, lineItems) {
  const orderId = pickId(order?.id, order?._id, order?.orderId, order?.order_id);
  if (!orderId) return { error: 'Order id missing from ShopMonkey response' };

  const orderNumber = pickId(order?.number, order?.orderNumber, order?.order_number);
  const workflowStatusId = pickId(order?.workflowStatusId, order?.workflow_status_id);
  const status = pickId(order?.status);
  const invoiceDate = pickId(order?.completedDate, order?.completed_date, order?.createdDate, order?.created_date, order?.updatedDate, order?.updated_date)?.slice(0, 10) || null;

  const customerId = pickCustomerId(order);
  const vehicleId = pickVehicleId(order);

  const laborCents = Number.isFinite(Number(order?.laborCents)) ? Number(order?.laborCents) : null;
  const partsCents = Number.isFinite(Number(order?.partsCents)) ? Number(order?.partsCents) : null;
  const feesCents = Number.isFinite(Number(order?.feesCents)) ? Number(order?.feesCents) : null;
  const taxCents = Number.isFinite(Number(order?.taxCents)) ? Number(order?.taxCents) : null;
  const totalCents = Number.isFinite(Number(order?.totalCents))
    ? Number(order?.totalCents)
    : (laborCents != null || partsCents != null || feesCents != null || taxCents != null)
      ? (Number(laborCents || 0) + Number(partsCents || 0) + Number(feesCents || 0) + Number(taxCents || 0))
      : null;

  await db.runAsync(
    `INSERT INTO crm_invoices (
        shopmonkey_order_id, shopmonkey_order_number, shopmonkey_workflow_status_id, status, invoice_date,
        shopmonkey_customer_id, shopmonkey_vehicle_id,
        labor_cents, parts_cents, fees_cents, tax_cents, total_cents,
        raw_json, synced_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(shopmonkey_order_id) DO UPDATE SET
        shopmonkey_order_number=excluded.shopmonkey_order_number,
        shopmonkey_workflow_status_id=excluded.shopmonkey_workflow_status_id,
        status=excluded.status,
        invoice_date=excluded.invoice_date,
        shopmonkey_customer_id=excluded.shopmonkey_customer_id,
        shopmonkey_vehicle_id=excluded.shopmonkey_vehicle_id,
        labor_cents=excluded.labor_cents,
        parts_cents=excluded.parts_cents,
        fees_cents=excluded.fees_cents,
        tax_cents=excluded.tax_cents,
        total_cents=excluded.total_cents,
        raw_json=excluded.raw_json,
        synced_at=CURRENT_TIMESTAMP`,
    [
      orderId,
      orderNumber || null,
      workflowStatusId || null,
      status || null,
      invoiceDate,
      customerId || null,
      vehicleId || null,
      laborCents,
      partsCents,
      feesCents,
      taxCents,
      totalCents,
      JSON.stringify({ order, lineItems }),
    ]
  );

  const invoiceRow = await db.getAsync('SELECT id FROM crm_invoices WHERE shopmonkey_order_id = ?', [orderId]);
  const invoiceId = invoiceRow?.id;
  if (!invoiceId) return { error: 'Failed to upsert invoice' };

  // Replace line items on each sync.
  await db.runAsync('DELETE FROM crm_invoice_items WHERE invoice_id = ?', [invoiceId]).catch(() => {});

  for (const li of lineItems || []) {
    const extracted = extractLineItemFields(li);
    if (!extracted.description && !extracted.part_number) continue;

    const invId = await resolveInventoryItemId(extracted).catch(() => null);
    await db.runAsync(
      `INSERT INTO crm_invoice_items
        (invoice_id, shopmonkey_line_item_id, line_type, description, part_number, quantity, unit_price_cents, total_cents, inventory_item_id, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        extracted.shopmonkey_line_item_id,
        extracted.line_type,
        extracted.description,
        extracted.part_number,
        extracted.quantity,
        extracted.unit_price_cents,
        extracted.total_cents,
        invId,
        JSON.stringify(li),
      ]
    ).catch(() => {});
  }

  return { invoice_id: invoiceId, shopmonkey_order_id: orderId };
}

// POST /api/crm/sync/order/:orderId — fetch from ShopMonkey and cache invoice + customer + vehicle + items
router.post('/sync/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    const order = await getRepairOrder(orderId);
    const lineItems = await getOrderLineItems(orderId);

    await upsertCustomerFromOrder(order);
    await upsertVehicleFromOrder(order);
    const up = await upsertInvoice(order, lineItems);
    if (up.error) return res.status(500).json({ error: up.error });

    res.json({ ok: true, ...up });
  } catch (error) {
    console.error('CRM sync order error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync order' });
  }
});

// GET /api/crm/invoices — list cached invoices
router.get('/invoices', async (req, res) => {
  try {
    const { q, customer_id, vehicle_id, start_date, end_date, limit } = req.query || {};
    const where = [];
    const params = [];

    if (customer_id) {
      where.push('i.shopmonkey_customer_id = ?');
      params.push(String(customer_id));
    }
    if (vehicle_id) {
      where.push('i.shopmonkey_vehicle_id = ?');
      params.push(String(vehicle_id));
    }
    if (start_date) {
      where.push('i.invoice_date >= ?');
      params.push(String(start_date));
    }
    if (end_date) {
      where.push('i.invoice_date <= ?');
      params.push(String(end_date));
    }
    if (q) {
      where.push('(i.shopmonkey_order_number LIKE ? OR c.display_name LIKE ? OR v.vin LIKE ? OR v.license_plate LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const lim = limit ? Number(limit) : 50;
    params.push(Number.isFinite(lim) ? Math.min(200, Math.max(1, lim)) : 50);

    const rows = await db.allAsync(
      `SELECT
         i.id,
         i.shopmonkey_order_id,
         i.shopmonkey_order_number,
         i.status,
         i.invoice_date,
         i.total_cents,
         i.parts_cents,
         i.labor_cents,
         i.tax_cents,
         i.shopmonkey_customer_id,
         c.display_name AS customer_name,
         i.shopmonkey_vehicle_id,
         v.year, v.make, v.model, v.vin, v.license_plate
       FROM crm_invoices i
       LEFT JOIN crm_customers c ON c.shopmonkey_customer_id = i.shopmonkey_customer_id
       LEFT JOIN crm_vehicles v ON v.shopmonkey_vehicle_id = i.shopmonkey_vehicle_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY COALESCE(i.invoice_date, '0000-00-00') DESC, i.id DESC
       LIMIT ?`,
      params
    );

    res.json({ invoices: rows || [] });
  } catch (error) {
    console.error('CRM list invoices error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/crm/invoices/:id — invoice detail + line items
router.get('/invoices/:id', async (req, res) => {
  try {
    const id = req.params.id != null ? Number(req.params.id) : null;
    if (!id || !Number.isFinite(id)) return res.status(400).json({ error: 'Invoice id is required' });

    const invoice = await db.getAsync(
      `SELECT i.*, c.display_name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
              c.id AS crm_customer_id,
              v.year, v.make, v.model, v.vin, v.license_plate
       FROM crm_invoices i
       LEFT JOIN crm_customers c ON c.shopmonkey_customer_id = i.shopmonkey_customer_id
       LEFT JOIN crm_vehicles v ON v.shopmonkey_vehicle_id = i.shopmonkey_vehicle_id
       WHERE i.id = ?`,
      [id]
    );
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const items = await db.allAsync(
      `SELECT li.*, inv.name AS inventory_item_name
       FROM crm_invoice_items li
       LEFT JOIN inventory_items inv ON inv.id = li.inventory_item_id
       WHERE li.invoice_id = ?
       ORDER BY li.id ASC`,
      [id]
    );

    res.json({ invoice, items: items || [] });
  } catch (error) {
    console.error('CRM invoice detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/crm/customers — list cached customers
router.get('/customers', async (req, res) => {
  try {
    const { q, limit } = req.query || {};
    const where = [];
    const params = [];
    if (q) {
      where.push('(display_name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const lim = limit ? Number(limit) : 50;
    params.push(Number.isFinite(lim) ? Math.min(200, Math.max(1, lim)) : 50);

    const rows = await db.allAsync(
      `SELECT id, shopmonkey_customer_id, display_name, phone, email, updated_at
       FROM crm_customers
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY COALESCE(display_name, '') ASC
       LIMIT ?`,
      params
    );
    res.json({ customers: rows || [] });
  } catch (error) {
    console.error('CRM list customers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/crm/customers/:id/history — invoice + parts history for a customer (by internal crm_customers.id)
router.get('/customers/:id/history', async (req, res) => {
  try {
    const id = req.params.id != null ? Number(req.params.id) : null;
    if (!id || !Number.isFinite(id)) return res.status(400).json({ error: 'Customer id is required' });

    const customer = await db.getAsync('SELECT * FROM crm_customers WHERE id = ?', [id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const vehicles = await db.allAsync(
      `SELECT id, shopmonkey_vehicle_id, year, make, model, vin, license_plate, updated_at
       FROM crm_vehicles
       WHERE shopmonkey_customer_id = ?
       ORDER BY updated_at DESC`,
      [customer.shopmonkey_customer_id]
    );

    const invoices = await db.allAsync(
      `SELECT id, shopmonkey_order_id, shopmonkey_order_number, invoice_date, status, total_cents, parts_cents, labor_cents, tax_cents, shopmonkey_vehicle_id
       FROM crm_invoices
       WHERE shopmonkey_customer_id = ?
       ORDER BY COALESCE(invoice_date, '0000-00-00') DESC, id DESC`,
      [customer.shopmonkey_customer_id]
    );

    // Flatten parts/items per customer across all invoices (for quick “what did they buy”)
    const parts = await db.allAsync(
      `SELECT
         li.inventory_item_id,
         inv.name AS inventory_item_name,
         li.part_number,
         li.description,
         SUM(COALESCE(li.quantity, 0)) AS qty
       FROM crm_invoice_items li
       JOIN crm_invoices i ON i.id = li.invoice_id
       LEFT JOIN inventory_items inv ON inv.id = li.inventory_item_id
       WHERE i.shopmonkey_customer_id = ?
       GROUP BY li.inventory_item_id, li.part_number, li.description
       ORDER BY qty DESC
       LIMIT 200`,
      [customer.shopmonkey_customer_id]
    );

    res.json({ customer, vehicles: vehicles || [], invoices: invoices || [], parts: parts || [] });
  } catch (error) {
    console.error('CRM customer history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/customers/:id', async (req, res) => {
  try {
    const id = req.params.id != null ? Number(req.params.id) : null;
    if (!id || !Number.isFinite(id)) return res.status(400).json({ error: 'Customer id is required' });

    const customer = await db.getAsync('SELECT * FROM crm_customers WHERE id = ?', [id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const vehicles = await db.allAsync(
      `SELECT id, shopmonkey_vehicle_id, year, make, model, vin, license_plate, updated_at
       FROM crm_vehicles
       WHERE shopmonkey_customer_id = ?
       ORDER BY updated_at DESC`,
      [customer.shopmonkey_customer_id]
    );

    const invoices = await db.allAsync(
      `SELECT id, shopmonkey_order_id, shopmonkey_order_number, invoice_date, status, total_cents, parts_cents, labor_cents, tax_cents, shopmonkey_vehicle_id
       FROM crm_invoices
       WHERE shopmonkey_customer_id = ?
       ORDER BY COALESCE(invoice_date, '0000-00-00') DESC, id DESC
       LIMIT 100`,
      [customer.shopmonkey_customer_id]
    );

    res.json({ customer, vehicles: vehicles || [], invoices: invoices || [] });
  } catch (error) {
    console.error('CRM customer detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/crm/vehicles/:id/history — invoice + parts history for a vehicle (by internal crm_vehicles.id)
router.get('/vehicles/:id/history', async (req, res) => {
  try {
    const id = req.params.id != null ? Number(req.params.id) : null;
    if (!id || !Number.isFinite(id)) return res.status(400).json({ error: 'Vehicle id is required' });

    const vehicle = await db.getAsync('SELECT * FROM crm_vehicles WHERE id = ?', [id]);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const invoices = await db.allAsync(
      `SELECT id, shopmonkey_order_id, shopmonkey_order_number, invoice_date, status, total_cents, parts_cents, labor_cents, tax_cents
       FROM crm_invoices
       WHERE shopmonkey_vehicle_id = ?
       ORDER BY COALESCE(invoice_date, '0000-00-00') DESC, id DESC`,
      [vehicle.shopmonkey_vehicle_id]
    );

    const parts = await db.allAsync(
      `SELECT
         li.inventory_item_id,
         inv.name AS inventory_item_name,
         li.part_number,
         li.description,
         SUM(COALESCE(li.quantity, 0)) AS qty
       FROM crm_invoice_items li
       JOIN crm_invoices i ON i.id = li.invoice_id
       LEFT JOIN inventory_items inv ON inv.id = li.inventory_item_id
       WHERE i.shopmonkey_vehicle_id = ?
       GROUP BY li.inventory_item_id, li.part_number, li.description
       ORDER BY qty DESC
       LIMIT 200`,
      [vehicle.shopmonkey_vehicle_id]
    );

    res.json({ vehicle, invoices: invoices || [], parts: parts || [] });
  } catch (error) {
    console.error('CRM vehicle history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/vehicles/:id', async (req, res) => {
  try {
    const id = req.params.id != null ? Number(req.params.id) : null;
    if (!id || !Number.isFinite(id)) return res.status(400).json({ error: 'Vehicle id is required' });

    const vehicle = await db.getAsync('SELECT * FROM crm_vehicles WHERE id = ?', [id]);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const invoices = await db.allAsync(
      `SELECT id, shopmonkey_order_id, shopmonkey_order_number, invoice_date, status, total_cents, parts_cents, labor_cents, tax_cents
       FROM crm_invoices
       WHERE shopmonkey_vehicle_id = ?
       ORDER BY COALESCE(invoice_date, '0000-00-00') DESC, id DESC
       LIMIT 100`,
      [vehicle.shopmonkey_vehicle_id]
    );

    res.json({ vehicle, invoices: invoices || [] });
  } catch (error) {
    console.error('CRM vehicle detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

