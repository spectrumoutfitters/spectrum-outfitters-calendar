import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  getRepairOrder,
  getRepairOrders,
  getVehicle,
  getCustomer,
  extractWorkItemsFromOrder,
  extractVehicleInfoFromOrder,
  getWorkflowStatuses,
  getOrdersByWorkflowStatus,
  getOrderLineItems,
  syncTaskCompletionToShopMonkey
} from '../utils/shopmonkey.js';
import db from '../database/db.js';

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/shopmonkey/workflow/statuses - Get all workflow statuses (columns)
 */
router.get('/workflow/statuses', async (req, res) => {
  try {
    // Check if API key is configured
    if (!process.env.SHOPMONKEY_API_KEY || 
        process.env.SHOPMONKEY_API_KEY.trim() === '' || 
        process.env.SHOPMONKEY_API_KEY === 'your_shopmonkey_api_key_here') {
      return res.status(400).json({ 
        error: 'ShopMonkey API key not configured',
        message: 'Please add SHOPMONKEY_API_KEY to backend/.env file'
      });
    }

    const statuses = await getWorkflowStatuses();
    res.json({ statuses });
  } catch (error) {
    console.error('ShopMonkey get workflow statuses error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch workflow statuses' });
  }
});

/**
 * GET /api/shopmonkey/orders - Get repair orders
 * Query params: status, workflowStatus, workflowStatusId, startDate, endDate, limit, offset
 * For "in the shop" orders, use workflowStatusId or workflowStatus='inShop'
 */
router.get('/orders', async (req, res) => {
  try {
    // Check if API key is configured
    if (!process.env.SHOPMONKEY_API_KEY || 
        process.env.SHOPMONKEY_API_KEY.trim() === '' || 
        process.env.SHOPMONKEY_API_KEY === 'your_shopmonkey_api_key_here') {
      return res.status(400).json({ 
        error: 'ShopMonkey API key not configured',
        message: 'Please add SHOPMONKEY_API_KEY to backend/.env file'
      });
    }

    const { status, workflowStatus, workflowStatusId, startDate, endDate, limit, offset } = req.query;
    
    const filters = {};
    
    // If workflowStatusId is provided, use workflow endpoint (for "in the shop" column)
    if (workflowStatusId) {
      filters.workflowStatusId = workflowStatusId;
    } else if (workflowStatus) {
      // Try to find workflow status ID by name
      // For "in the shop", we'll try common values
      if (workflowStatus === 'inShop' || workflowStatus === 'in the shop' || workflowStatus === 'in_the_shop') {
        // First, get all workflow statuses to find "in the shop"
        try {
          const statuses = await getWorkflowStatuses();
          console.log(`Found ${statuses.length} workflow statuses`);
          
          // Try to find "in the shop" status by various name patterns
          const inShopStatus = statuses.find(s => {
            const name = (s.name || s.label || s.title || '').toLowerCase();
            const id = (s.id || s.workflowStatusId || '').toString().toLowerCase();
            
            return name.includes('shop') || 
                   name.includes('in shop') ||
                   name.includes('in the shop') ||
                   name === 'in shop' ||
                   id === workflowStatus;
          });
          
          if (inShopStatus) {
            const statusId = inShopStatus.id || inShopStatus.workflowStatusId || inShopStatus._id;
            if (statusId) {
              console.log(`Found "in the shop" status: ${inShopStatus.name || inShopStatus.label} (ID: ${statusId})`);
              filters.workflowStatusId = statusId;
            } else {
              console.warn('Found "in the shop" status but no ID:', inShopStatus);
              filters.workflowStatus = workflowStatus;
            }
          } else {
            console.warn(`Could not find "in the shop" status. Available statuses:`, 
              statuses.map(s => ({ name: s.name || s.label, id: s.id || s.workflowStatusId })));
            // Fallback: try using the workflowStatus value as ID
            filters.workflowStatus = workflowStatus;
          }
        } catch (statusError) {
          console.warn('Could not fetch workflow statuses, using fallback:', statusError.message);
          filters.workflowStatus = workflowStatus;
        }
      } else {
        filters.workflowStatus = workflowStatus;
      }
    } else if (status) {
      filters.status = status;
    }
    
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const orders = await getRepairOrders(filters);
    res.json({ orders });
  } catch (error) {
    console.error('ShopMonkey get orders error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch repair orders' });
  }
});

/**
 * GET /api/shopmonkey/orders/:id - Get a specific repair order
 */
router.get('/orders/:id', async (req, res) => {
  try {
    // Check if API key is configured
    if (!process.env.SHOPMONKEY_API_KEY || 
        process.env.SHOPMONKEY_API_KEY.trim() === '' || 
        process.env.SHOPMONKEY_API_KEY === 'your_shopmonkey_api_key_here') {
      return res.status(400).json({ 
        error: 'ShopMonkey API key not configured',
        message: 'Please add SHOPMONKEY_API_KEY to backend/.env file'
      });
    }

    const { id } = req.params;
    const order = await getRepairOrder(id);
    res.json({ order });
  } catch (error) {
    console.error('ShopMonkey get order error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch repair order' });
  }
});

/**
 * POST /api/shopmonkey/orders/:id/parse - Parse a repair order and extract work items
 * This is similar to the PDF parser but uses ShopMonkey API data
 */
router.post('/orders/:id/parse', async (req, res) => {
  try {
    // Check if API key is configured
    if (!process.env.SHOPMONKEY_API_KEY || 
        process.env.SHOPMONKEY_API_KEY.trim() === '' || 
        process.env.SHOPMONKEY_API_KEY === 'your_shopmonkey_api_key_here') {
      return res.status(400).json({ 
        error: 'ShopMonkey API key not configured',
        message: 'Please add SHOPMONKEY_API_KEY to backend/.env file'
      });
    }

    const { id } = req.params;
    
    // Try to get order with line items included first
    console.log(`Attempting to get order ${id} with line items included...`);
    let order = await getRepairOrder(id, { include: 'lineItems' });
    
    // If that doesn't work, try with expand parameter
    if (!order.lineItems || !Array.isArray(order.lineItems) || order.lineItems.length === 0) {
      console.log('Trying with expand parameter...');
      order = await getRepairOrder(id, { expand: 'lineItems' });
    }
    
    // If still no line items, try without parameters (default)
    if (!order.lineItems || !Array.isArray(order.lineItems) || order.lineItems.length === 0) {
      console.log('Trying default order fetch...');
      order = await getRepairOrder(id);
    }
    
    console.log(`Parsing ShopMonkey order ${id}. Order structure keys:`, Object.keys(order || {}));
    
    // Try to get line items from a separate endpoint
    const lineItemsFromAPI = await getOrderLineItems(id);
    if (lineItemsFromAPI.length > 0) {
      console.log(`Found ${lineItemsFromAPI.length} line items from separate API endpoint`);
    }
    
    // Extract work items and vehicle info
    let workItems = extractWorkItemsFromOrder(order, lineItemsFromAPI);
    const vehicleInfo = extractVehicleInfoFromOrder(order);
    
    console.log(`=== ShopMonkey Order Parse ===`);
    console.log(`Order ID: ${order.id}`);
    console.log(`Order Number: ${order.number}`);
    console.log(`Order Name: ${order.name}`);
    console.log(`Order Generated Name: ${order.generatedName || 'N/A'} ⭐ THIS IS THE SERVICE DESCRIPTION`);
    console.log(`Order Labor: $${(order.laborCents / 100).toFixed(2)} (${order.totalLaborHours || 0} hours)`);
    console.log(`Order Parts: $${(order.partsCents / 100).toFixed(2)}`);
    console.log(`Initial extracted workItems: ${workItems.length}`);
    console.log(`Vehicle info:`, vehicleInfo);
    
    // AI extraction is DISABLED by default due to performance issues (100% CPU usage)
    // The improved fallback extraction in extractWorkItemsFromOrder works well without AI
    console.log('Using regular extraction (AI disabled for performance).');
    
    // Ensure all items have selected flag
    workItems = workItems.map(item => ({
      ...item,
      source: item.source || 'shopmonkey',
      selected: item.selected !== false
    }));
    
    // Final fallback: If still no items, use order name
    if (workItems.length === 0) {
      console.warn('No work items extracted, using order name as fallback');
      workItems = [{
        title: order.name || order.coalescedName || order.generatedName || `Repair Order #${order.number}`,
        order: 1,
        source: 'shopmonkey',
        selected: true
      }];
    }
    
    console.log(`=== Final Response ===`);
    console.log(`Sending ${workItems.length} work items to frontend:`, workItems);
    console.log(`Each item has selected flag:`, workItems.map(item => ({ title: item.title, selected: item.selected })));
    
    res.json({
      workItems,
      vehicleInfo,
      order: {
        id: order.id,
        number: order.number,
        status: order.status,
        createdAt: order.createdAt || order.createdDate
      }
    });
  } catch (error) {
    console.error('ShopMonkey parse order error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse repair order' });
  }
});

/**
 * GET /api/shopmonkey/vehicles/:id - Get vehicle information
 */
router.get('/vehicles/:id', async (req, res) => {
  try {
    // Check if API key is configured
    if (!process.env.SHOPMONKEY_API_KEY || 
        process.env.SHOPMONKEY_API_KEY.trim() === '' || 
        process.env.SHOPMONKEY_API_KEY === 'your_shopmonkey_api_key_here') {
      return res.status(400).json({ 
        error: 'ShopMonkey API key not configured',
        message: 'Please add SHOPMONKEY_API_KEY to backend/.env file'
      });
    }

    const { id } = req.params;
    const vehicle = await getVehicle(id);
    res.json({ vehicle });
  } catch (error) {
    console.error('ShopMonkey get vehicle error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch vehicle' });
  }
});

/**
 * GET /api/shopmonkey/customers/:id - Get customer information
 */
router.get('/customers/:id', async (req, res) => {
  try {
    // Check if API key is configured
    if (!process.env.SHOPMONKEY_API_KEY || 
        process.env.SHOPMONKEY_API_KEY.trim() === '' || 
        process.env.SHOPMONKEY_API_KEY === 'your_shopmonkey_api_key_here') {
      return res.status(400).json({ 
        error: 'ShopMonkey API key not configured',
        message: 'Please add SHOPMONKEY_API_KEY to backend/.env file'
      });
    }

    const { id } = req.params;
    const customer = await getCustomer(id);
    res.json({ customer });
  } catch (error) {
    console.error('ShopMonkey get customer error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch customer' });
  }
});

/**
 * POST /api/shopmonkey/tasks/:taskId/sync - Manually sync a task to ShopMonkey
 * This endpoint allows manually syncing task completion status to ShopMonkey
 */
router.post('/tasks/:taskId/sync', async (req, res) => {
  try {
    // Check if API key is configured
    if (!process.env.SHOPMONKEY_API_KEY || 
        process.env.SHOPMONKEY_API_KEY.trim() === '' || 
        process.env.SHOPMONKEY_API_KEY === 'your_shopmonkey_api_key_here') {
      return res.status(400).json({ 
        error: 'ShopMonkey API key not configured',
        message: 'Please add SHOPMONKEY_API_KEY to backend/.env file'
      });
    }

    const { taskId } = req.params;
    const { note } = req.body;

    // Get task from database
    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!task.shopmonkey_order_id) {
      return res.status(400).json({ 
        error: 'Task is not linked to a ShopMonkey order',
        message: 'This task was not created from a ShopMonkey repair order'
      });
    }

    if (task.status !== 'completed') {
      return res.status(400).json({ 
        error: 'Task is not completed',
        message: 'Only completed tasks can be synced to ShopMonkey'
      });
    }

    // Sync to ShopMonkey
    const syncResult = await syncTaskCompletionToShopMonkey(task.shopmonkey_order_id, {
      note: note || `Task "${task.title}" completed in Spectrum Outfitters Calendar`
    });

    res.json({ 
      success: true,
      message: 'Task synced to ShopMonkey successfully',
      syncResult
    });
  } catch (error) {
    console.error('ShopMonkey sync error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync task to ShopMonkey' });
  }
});

/**
 * POST /api/shopmonkey/webhook - Webhook endpoint for receiving ShopMonkey updates
 * This allows ShopMonkey to send real-time updates when orders change
 */
router.post('/webhook', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    console.log('ShopMonkey webhook received:', { event, data });

    const extractAffiliateToken = (payload) => {
      const candidates = [];
      const pushIfString = (v) => {
        if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
      };

      // Common places token might be embedded
      pushIfString(payload?.description);
      pushIfString(payload?.note);
      pushIfString(payload?.externalId);
      pushIfString(payload?.workRequest?.description);
      pushIfString(payload?.work_request?.description);

      // Nested metadata/custom fields (best-effort)
      if (payload?.metadata && typeof payload.metadata === 'object') {
        for (const v of Object.values(payload.metadata)) {
          pushIfString(v);
        }
      }

      if (payload?.customFields && typeof payload.customFields === 'object') {
        for (const v of Object.values(payload.customFields)) {
          pushIfString(v);
        }
      }

      const combined = candidates.join('\n');
      const m = combined.match(/AFFILIATE_TOKEN[:=]([a-zA-Z0-9_-]{6,64})/);
      if (m?.[1]) return m[1];

      const m2 = combined.match(/affiliate[_-]?token[:=]([a-zA-Z0-9_-]{6,64})/i);
      if (m2?.[1]) return m2[1];

      return null;
    };

    const token = extractAffiliateToken({ event, data });

    if (token) {
      const link = await db.getAsync(
        'SELECT id FROM quote_affiliate_links WHERE token = ? LIMIT 1',
        [token]
      );

      if (link?.id) {
        const workRequestId =
          data?.id ||
          data?.workRequestId ||
          data?.work_request_id ||
          data?.workRequest?.id ||
          data?.work_request?.id ||
          null;

        const orderId =
          data?.orderId ||
          data?.order_id ||
          data?.order?.id ||
          data?.estimateId ||
          data?.estimate_id ||
          null;

        const customerId =
          data?.customerId ||
          data?.customer_id ||
          data?.customer?.id ||
          data?.customer?.customerId ||
          data?.customer?.customer_id ||
          null;

        const customerFirstName = data?.firstName || data?.customer?.firstName || data?.customer?.first_name || null;
        const customerLastName = data?.lastName || data?.customer?.lastName || data?.customer?.last_name || null;
        const customerEmail = data?.email || data?.customer?.email || data?.customer?.emailAddress || null;
        const customerPhone = data?.phone || data?.phoneNumber || data?.customer?.phone || data?.customer?.phoneNumber || null;

        const vin = data?.vin || data?.vehicle?.vin || data?.vehicle?.VIN || null;
        const plate =
          data?.licensePlate ||
          data?.license_plate ||
          data?.plate ||
          data?.vehicle?.licensePlate ||
          data?.vehicle?.license_plate ||
          null;

        const vehicleYear = data?.year || data?.vehicle?.year || null;
        const vehicleMake = data?.make || data?.vehicle?.make || null;
        const vehicleModel = data?.model || data?.vehicle?.model || null;

        const idsWhere = [];
        const idsParams = [link.id];
        if (workRequestId) {
          idsWhere.push('shopmonkey_work_request_id = ?');
          idsParams.push(String(workRequestId));
        }
        if (orderId) {
          idsWhere.push('shopmonkey_order_id = ?');
          idsParams.push(String(orderId));
        }
        if (customerId) {
          idsWhere.push('shopmonkey_customer_id = ?');
          idsParams.push(String(customerId));
        }

        let existingId = null;
        if (idsWhere.length > 0) {
          const existing = await db.getAsync(
            `SELECT id FROM quote_affiliate_submissions
             WHERE affiliate_link_id = ? AND (${idsWhere.join(' OR ')})
             ORDER BY submitted_at DESC
             LIMIT 1`,
            idsParams
          );
          existingId = existing?.id || null;
        }

        const raw_json = JSON.stringify({ event, data });

        if (existingId) {
          await db.runAsync(
            `UPDATE quote_affiliate_submissions
             SET
               shopmonkey_work_request_id = COALESCE(shopmonkey_work_request_id, ?),
               shopmonkey_order_id = COALESCE(shopmonkey_order_id, ?),
               shopmonkey_customer_id = COALESCE(shopmonkey_customer_id, ?),
               customer_first_name = COALESCE(customer_first_name, ?),
               customer_last_name = COALESCE(customer_last_name, ?),
               customer_email = COALESCE(customer_email, ?),
               customer_phone = COALESCE(customer_phone, ?),
               vehicle_vin = COALESCE(vehicle_vin, ?),
               vehicle_license_plate = COALESCE(vehicle_license_plate, ?),
               vehicle_year = COALESCE(vehicle_year, ?),
               vehicle_make = COALESCE(vehicle_make, ?),
               vehicle_model = COALESCE(vehicle_model, ?),
               raw_json = ?,
               updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
              workRequestId || null,
              orderId || null,
              customerId || null,
              customerFirstName || null,
              customerLastName || null,
              customerEmail || null,
              customerPhone || null,
              vin || null,
              plate || null,
              vehicleYear || null,
              vehicleMake || null,
              vehicleModel || null,
              raw_json,
              existingId,
            ]
          );
        } else {
          await db.runAsync(
            `INSERT INTO quote_affiliate_submissions
              (affiliate_link_id,
               shopmonkey_work_request_id,
               shopmonkey_order_id,
               shopmonkey_customer_id,
               customer_first_name,
               customer_last_name,
               customer_email,
               customer_phone,
               vehicle_vin,
               vehicle_license_plate,
               vehicle_year,
               vehicle_make,
               vehicle_model,
               raw_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              link.id,
              workRequestId || null,
              orderId || null,
              customerId || null,
              customerFirstName || null,
              customerLastName || null,
              customerEmail || null,
              customerPhone || null,
              vin || null,
              plate || null,
              vehicleYear || null,
              vehicleMake || null,
              vehicleModel || null,
              raw_json,
            ]
          );
        }
      }
    }

    // Handle different webhook events
    switch (event) {
      case 'order.created':
      case 'order.updated':
        // You could auto-create tasks when new orders come in
        // For now, just log it
        console.log('ShopMonkey order event:', event, data);
        break;
      
      case 'order.status_changed':
        // Update linked tasks if order status changes
        if (data && data.id) {
          // Find tasks linked to this order
          const linkedTasks = await db.allAsync(
            'SELECT * FROM tasks WHERE shopmonkey_order_id = ?',
            [data.id.toString()]
          );
          
          console.log(`Found ${linkedTasks.length} tasks linked to ShopMonkey order ${data.id}`);
          // You could update task status based on order status here
        }
        break;
      
      default:
        console.log('Unhandled webhook event:', event);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('ShopMonkey webhook error:', error);
    // Still return 200 to prevent retries
    res.status(200).json({ received: true, error: error.message });
  }
});

/**
 * GET /api/shopmonkey/test - Test API connection
 */
router.get('/test', async (req, res) => {
  try {
    // Check if API key is configured
    if (!process.env.SHOPMONKEY_API_KEY || 
        process.env.SHOPMONKEY_API_KEY.trim() === '' || 
        process.env.SHOPMONKEY_API_KEY === 'your_shopmonkey_api_key_here') {
      return res.status(400).json({ 
        success: false,
        error: 'ShopMonkey API key not configured',
        message: 'Please add SHOPMONKEY_API_KEY to backend/.env file'
      });
    }

    // Try a simple endpoint first - maybe /me or /user to test auth
    // If that doesn't exist, try orders
    try {
      const orders = await getRepairOrders({ limit: 1 });
      res.json({ 
        success: true, 
        message: 'ShopMonkey API connection successful',
        hasOrders: orders && orders.length > 0,
        apiKeyConfigured: true,
        apiKeyLength: process.env.SHOPMONKEY_API_KEY.length
      });
    } catch (orderError) {
      // If orders endpoint fails, try a simpler test
      console.error('Orders endpoint failed, trying alternative test:', orderError.message);
      res.status(500).json({ 
        success: false,
        error: orderError.message || 'Failed to connect to ShopMonkey API',
        details: 'Check the API base URL and endpoint format in the ShopMonkey documentation',
        apiKeyConfigured: true,
        apiKeyLength: process.env.SHOPMONKEY_API_KEY.length
      });
    }
  } catch (error) {
    console.error('ShopMonkey test error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to connect to ShopMonkey API',
      apiKeyConfigured: !!process.env.SHOPMONKEY_API_KEY
    });
  }
});

// ─── Revenue sync endpoints ──────────────────────────────────────────

import { getPaymentsByDateRange, aggregatePaymentsByDay } from '../utils/shopmonkey.js';

/**
 * Shared sync logic — used by both the API endpoint and the background job.
 * @param {string} [startDate] defaults to 2015-01-01 (pull all history)
 * @param {string} [endDate] defaults to today
 */
export async function syncShopMonkeyRevenue(startDate, endDate) {
  const end = endDate || new Date().toISOString().split('T')[0];
  const start = startDate || '2015-01-01';

  const payments = await getPaymentsByDateRange(start, end);
  const daily = aggregatePaymentsByDay(payments);

  for (const d of daily) {
    await db.runAsync(
      `INSERT INTO shopmonkey_daily_revenue (date, revenue, charge_count, refund_total, synced_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(date) DO UPDATE SET
         revenue = excluded.revenue,
         charge_count = excluded.charge_count,
         refund_total = excluded.refund_total,
         synced_at = CURRENT_TIMESTAMP`,
      [d.date, d.revenue, d.charge_count, d.refund_total]
    );
  }

  return { days_synced: daily.length, start_date: start, end_date: end };
}

/**
 * POST /api/shopmonkey/revenue/sync - Sync payments into daily revenue totals
 * Body: { start_date?, end_date? } — defaults to all history
 */
router.post('/revenue/sync', async (req, res) => {
  try {
    const result = await syncShopMonkeyRevenue(req.body.start_date, req.body.end_date);
    res.json(result);
  } catch (error) {
    console.error('ShopMonkey revenue sync error:', error);
    res.status(500).json({ error: error.message || 'Revenue sync failed' });
  }
});

/**
 * GET /api/shopmonkey/revenue/status - Get sync status and recent daily revenue
 */
router.get('/revenue/status', async (req, res) => {
  try {
    const summary = await db.getAsync(
      'SELECT COUNT(*) as total_days, SUM(revenue) as total_revenue, MAX(synced_at) as last_sync FROM shopmonkey_daily_revenue'
    );
    const daily = await db.allAsync(
      'SELECT date, revenue, charge_count, refund_total FROM shopmonkey_daily_revenue ORDER BY date DESC'
    );
    res.json({
      total_days: summary?.total_days || 0,
      total_revenue: summary?.total_revenue || 0,
      last_sync: summary?.last_sync || null,
      daily: daily || [],
    });
  } catch (error) {
    console.error('ShopMonkey revenue status error:', error);
    res.status(500).json({ error: 'Failed to get revenue status' });
  }
});

export default router;
