import db from '../../database/db.js';
import {
  getCustomer,
  getOrderLineItems,
  getRepairOrder,
  getRepairOrders,
  getVehicle,
} from '../../utils/shopmonkey.js';

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

function pickOrderId(order) {
  return pickId(order?.id, order?._id, order?.orderId, order?.order_id);
}

function normalizeOrdersArray(response) {
  const seen = new Set();
  const walk = (v) => {
    if (v == null) return null;
    if (Array.isArray(v)) return v;
    if (typeof v !== 'object') return null;
    if (seen.has(v)) return null;
    seen.add(v);

    for (const key of ['orders', 'items', 'results', 'data']) {
      if (Object.prototype.hasOwnProperty.call(v, key)) {
        const arr = walk(v[key]);
        if (arr) return arr;
      }
    }
    return null;
  };

  const arr = walk(response);
  return Array.isArray(arr) ? arr : [];
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
  const orderId = pickOrderId(order);
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

export async function syncShopmonkeyOrderToCrm(orderId, { force = false } = {}) {
  if (!orderId) return { error: 'orderId is required' };

  if (!force) {
    const existing = await db.getAsync('SELECT id FROM crm_invoices WHERE shopmonkey_order_id = ? LIMIT 1', [String(orderId)]);
    if (existing?.id) return { ok: true, skipped: true, shopmonkey_order_id: String(orderId) };
  }

  const order = await getRepairOrder(orderId);
  const lineItems = await getOrderLineItems(orderId);

  await upsertCustomerFromOrder(order);
  await upsertVehicleFromOrder(order);
  const up = await upsertInvoice(order, lineItems);
  if (up.error) return { error: up.error };
  return { ok: true, ...up };
}

export async function listShopmonkeyOrdersPage({ start_date, end_date, limit = 50, offset = 0 } = {}) {
  const filters = {
    ...(start_date ? { startDate: String(start_date).slice(0, 10) } : {}),
    ...(end_date ? { endDate: String(end_date).slice(0, 10) } : {}),
    limit,
    offset,
  };

  const resp = await getRepairOrders(filters);
  const orders = normalizeOrdersArray(resp);
  return { orders, raw: resp };
}

let backfillWorkerScheduled = false;
let backfillWorkerRunning = false;

async function updateJob(jobId, patch) {
  const fields = [];
  const params = [];
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = ?`);
    params.push(v);
  }
  fields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(jobId);
  await db.runAsync(`UPDATE crm_backfill_jobs SET ${fields.join(', ')} WHERE id = ?`, params);
}

export async function getBackfillJob(jobId) {
  const id = Number(jobId);
  if (!Number.isFinite(id)) return null;
  return await db.getAsync('SELECT * FROM crm_backfill_jobs WHERE id = ?', [id]);
}

export async function cancelBackfillJob(jobId) {
  const job = await getBackfillJob(jobId);
  if (!job) return { error: 'Job not found' };
  if (job.status === 'completed' || job.status === 'failed') return { ok: true, status: job.status };
  await updateJob(job.id, { status: 'cancelled', finished_at: new Date().toISOString() });
  return { ok: true, status: 'cancelled' };
}

async function runBackfillOnce(job) {
  const jobId = job.id;
  const startDate = job.start_date || null;
  const endDate = job.end_date || null;
  const limit = job.page_limit || 50;
  let offset = job.offset || 0;

  await updateJob(jobId, { status: 'running', started_at: job.started_at || new Date().toISOString() });

  const { orders } = await listShopmonkeyOrdersPage({ start_date: startDate, end_date: endDate, limit, offset });
  if (!orders || orders.length === 0) {
    await updateJob(jobId, { status: 'completed', finished_at: new Date().toISOString() });
    return;
  }

  // Sync sequentially (safe for production); can bump to small concurrency later.
  let processed = 0;
  let synced = 0;
  let skipped = 0;
  let errors = 0;
  let lastOrderId = null;

  for (const o of orders) {
    const oid = pickOrderId(o);
    if (!oid) continue;
    lastOrderId = String(oid);
    processed += 1;
    try {
      const res = await syncShopmonkeyOrderToCrm(oid, { force: false });
      if (res?.skipped) skipped += 1;
      else if (res?.ok) synced += 1;
      else errors += 1;
    } catch (e) {
      errors += 1;
      await updateJob(jobId, { last_error: e?.message || String(e) }).catch(() => {});
    }

    // If cancelled mid-run, stop early.
    const latest = await getBackfillJob(jobId);
    if (latest?.status === 'cancelled') return;
  }

  offset += orders.length;

  await db.runAsync(
    `UPDATE crm_backfill_jobs
     SET offset = ?, last_order_id = ?,
         processed_count = processed_count + ?,
         synced_count = synced_count + ?,
         skipped_count = skipped_count + ?,
         error_count = error_count + ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [offset, lastOrderId, processed, synced, skipped, errors, jobId]
  );
}

export async function enqueueBackfillJob({ start_date, end_date, page_limit = 50 } = {}) {
  const start = start_date ? String(start_date).slice(0, 10) : '2010-01-01';
  const end = end_date ? String(end_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const lim = Math.min(100, Math.max(10, Number(page_limit) || 50));

  const result = await db.runAsync(
    `INSERT INTO crm_backfill_jobs (status, start_date, end_date, page_limit)
     VALUES ('queued', ?, ?, ?)`,
    [start, end, lim]
  );
  scheduleBackfillWorker();
  return await getBackfillJob(result.lastID);
}

async function backfillWorkerTick() {
  if (backfillWorkerRunning) return;
  backfillWorkerRunning = true;
  try {
    const job = await db.getAsync(
      `SELECT * FROM crm_backfill_jobs
       WHERE status IN ('queued','running')
       ORDER BY created_at ASC
       LIMIT 1`
    );
    if (!job) return;
    if (job.status === 'queued') {
      await updateJob(job.id, { status: 'running', started_at: new Date().toISOString() });
    }

    await runBackfillOnce(job);

    const updated = await getBackfillJob(job.id);
    if (updated?.status === 'running') {
      // Keep it running; we’ll pick it up next tick.
      return;
    }
  } catch (e) {
    // Best-effort: mark the oldest running job failed.
    try {
      const running = await db.getAsync(
        `SELECT * FROM crm_backfill_jobs WHERE status = 'running' ORDER BY created_at ASC LIMIT 1`
      );
      if (running?.id) {
        await updateJob(running.id, { status: 'failed', last_error: e?.message || String(e), finished_at: new Date().toISOString() });
      }
    } catch {}
  } finally {
    backfillWorkerRunning = false;
  }
}

export function scheduleBackfillWorker() {
  if (backfillWorkerScheduled) return;
  backfillWorkerScheduled = true;
  const loop = async () => {
    await backfillWorkerTick();
    setTimeout(loop, 1200);
  };
  setTimeout(loop, 250);
}

