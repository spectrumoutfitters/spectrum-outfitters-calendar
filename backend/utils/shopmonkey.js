/**
 * ShopMonkey API Integration
 * Documentation: https://shopmonkey.dev/
 */

import { toTitleCase } from './helpers.js';

// ShopMonkey API base URL
// Documentation: https://shopmonkey.dev/
// Correct base URL: https://api.shopmonkey.cloud/v3
const SHOPMONKEY_API_BASE = 'https://api.shopmonkey.cloud/v3';

/**
 * Make an authenticated request to ShopMonkey API
 */
export async function shopmonkeyRequest(endpoint, options = {}) {
  const apiKey = process.env.SHOPMONKEY_API_KEY;
  
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_shopmonkey_api_key_here') {
    throw new Error('ShopMonkey API key not configured. Please set SHOPMONKEY_API_KEY in backend/.env');
  }

  const url = `${SHOPMONKEY_API_BASE}${endpoint}`;
  
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {})
    }
  };

  // Handle body - if it's a string, use it; if it's an object, stringify it
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  try {
    console.log(
      `ShopMonkey API Request: ${config.method} ${url} (API key length: ${apiKey ? apiKey.length : 0})`
    );
    
    // Create timeout controller for fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(url, {
      ...config,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `ShopMonkey API error: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      // Prefix so downstream callers can distinguish HTTP errors vs connectivity issues.
      throw new Error(`ShopMonkey API error: ${errorMessage}`);
    }

    const bodyText = await response.text();
    const trimmed = bodyText != null ? String(bodyText).trim() : '';
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed);
    } catch (parseErr) {
      throw new Error(
        `ShopMonkey API error: Response was not valid JSON (${response.status}): ${parseErr.message}`
      );
    }
  } catch (error) {
    const msg = error && typeof error.message === 'string' ? error.message : String(error);
    if (msg.includes('ShopMonkey API error')) {
      throw error instanceof Error ? error : new Error(msg);
    }

    // Provide more detailed error information
    const errorDetails = {
      url,
      method: config.method,
      error: msg,
      errorName: error && error.name,
      code: error && error.code
    };
    
    console.error('ShopMonkey API connection error:', errorDetails);
    
    // Provide user-friendly error messages
    if (error && error.name === 'AbortError') {
      throw new Error('ShopMonkey API request timed out. The server may be slow or unreachable.');
    } else if (error && (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED')) {
      throw new Error(`Cannot reach ShopMonkey API (${error.code}). Check your internet connection and verify the API base URL is correct: ${SHOPMONKEY_API_BASE}`);
    } else if (msg.includes('fetch failed')) {
      throw new Error(`Network error connecting to ShopMonkey API. This could be due to:\n- Internet connectivity issues\n- Firewall blocking the connection\n- Incorrect API base URL\n\nError: ${msg}`);
    }

    throw new Error(`Failed to connect to ShopMonkey API: ${msg}. Check your internet connection and verify the API endpoint is correct.`);
  }
}

/**
 * Get a repair order by ID
 * Note: ShopMonkey API uses /order (singular) not /orders (plural)
 * Returns the order data (unwrapped from response.data if needed)
 * @param {string} orderId - The order ID
 * @param {Object} options - Optional parameters (include, expand, etc.)
 */
export async function getRepairOrder(orderId, options = {}) {
  let endpoint = `/order/${orderId}`;
  
  // Add query parameters if provided
  const queryParams = new URLSearchParams();
  if (options.include) {
    queryParams.append('include', options.include);
  }
  if (options.expand) {
    queryParams.append('expand', options.expand);
  }
  if (options.fields) {
    queryParams.append('fields', options.fields);
  }
  
  const queryString = queryParams.toString();
  if (queryString) {
    endpoint += `?${queryString}`;
  }
  
  const response = await shopmonkeyRequest(endpoint);
  // ShopMonkey wraps responses in { success: true, data: { ... } }
  // Return the data directly, or the response if it's already unwrapped
  return response.data || response;
}

/**
 * Get line items for a repair order
 * ShopMonkey may have line items in a separate endpoint or need to be included in the order
 */
export async function getOrderLineItems(orderId) {
  try {
    const toInt = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n) : null;
    };

    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const applyDiscount = ({ baseCents, discountCents, discountPercent, discountValueType }) => {
      const base = toInt(baseCents) || 0;
      const type = String(discountValueType || '').toLowerCase();
      const pct = toNum(discountPercent);
      const fixed = toInt(discountCents);
      let disc = 0;
      if (type.includes('percent') && pct != null) disc = Math.round((base * pct) / 100);
      else if (fixed != null) disc = fixed;
      return Math.max(0, base - Math.max(0, disc));
    };

    const normalizeItems = (items, type) => {
      const out = [];
      for (const it of items || []) {
        const id = it?.id || it?._id || it?.serviceItemId || null;
        const name = it?.name || it?.description || null;

        let quantity = null;
        let unitPriceCents = null;

        if (type === 'labor') {
          quantity = toNum(it?.hours) ?? toNum(it?.quantity);
          unitPriceCents = toInt(it?.rateCents ?? it?.retailCostCents ?? it?.unitPriceCents);
        } else {
          quantity = toNum(it?.quantity);
          unitPriceCents = toInt(it?.retailCostCents ?? it?.unitPriceCents ?? it?.priceCents);
        }

        const qty = quantity != null ? quantity : 1;
        const unit = unitPriceCents != null ? unitPriceCents : 0;
        const baseCents = Math.round(qty * unit);
        const totalCents = applyDiscount({
          baseCents,
          discountCents: it?.discountCents,
          discountPercent: it?.discountPercent,
          discountValueType: it?.discountValueType,
        });

        out.push({
          id,
          type, // for extractLineItemFields()
          name,
          partNumber: it?.partNumber || it?.sku || null,
          quantity: qty,
          unitPriceCents: unitPriceCents,
          totalCents,
          raw: it,
        });
      }
      return out;
    };

    const flattenServiceItemPayload = (payload) => {
      // ShopMonkey returns { success, meta, data }, where data is an object with arrays (parts, labors, tires, subcontracts, fees...)
      const data = payload?.data != null ? payload.data : payload;
      if (!data) return [];

      if (Array.isArray(data)) return data;

      const parts = Array.isArray(data.parts) ? normalizeItems(data.parts, 'part') : [];
      const labors = Array.isArray(data.labors) ? normalizeItems(data.labors, 'labor') : [];
      const tires = Array.isArray(data.tires) ? normalizeItems(data.tires, 'part') : [];
      const subcontracts = Array.isArray(data.subcontracts) ? normalizeItems(data.subcontracts, 'fee') : [];
      const fees = Array.isArray(data.fees) ? normalizeItems(data.fees, 'fee') : [];

      return [...parts, ...labors, ...tires, ...subcontracts, ...fees];
    };

    // Correct approach (ShopMonkey v3): Service Items, filtered by orderId using `where`.
    const where = encodeURIComponent(JSON.stringify({ orderId: String(orderId) }));
    const primaryEndpoint = `/service_item?where=${where}&limit=500`;
    console.log(`Trying line items endpoint: ${primaryEndpoint}`);
    const response = await shopmonkeyRequest(primaryEndpoint);
    const normalized = flattenServiceItemPayload(response);
    if (normalized.length > 0) {
      console.log(`✅ Found ${normalized.length} service items for order ${orderId}`);
      // Return a shape compatible with extractLineItemFields
      return normalized.map((x) => ({
        id: x.id,
        type: x.type,
        name: x.name,
        partNumber: x.partNumber,
        quantity: x.quantity,
        unitPriceCents: x.unitPriceCents,
        totalCents: x.totalCents,
        raw_json: x.raw ? JSON.stringify(x.raw) : null,
      }));
    }

    // Fallback: fetch services for the order, then query by serviceId(s)
    try {
      const serviceEndpoint = `/order/${orderId}/service`;
      console.log(`Trying services endpoint: ${serviceEndpoint}`);
      const svcResp = await shopmonkeyRequest(serviceEndpoint);
      const svcData = svcResp?.data || svcResp;
      const services = Array.isArray(svcData) ? svcData : Array.isArray(svcData?.data) ? svcData.data : [];
      const serviceIds = (services || []).map((s) => s?.id).filter(Boolean);
      const all = [];
      for (const serviceId of serviceIds) {
        const w = encodeURIComponent(JSON.stringify({ serviceId: String(serviceId) }));
        const ep = `/service_item?where=${w}&limit=500`;
        console.log(`Trying service items endpoint: ${ep}`);
        const r = await shopmonkeyRequest(ep);
        const items = flattenServiceItemPayload(r);
        all.push(...items);
      }
      if (all.length > 0) {
        console.log(`✅ Found ${all.length} service items via serviceId fallback for order ${orderId}`);
        return all.map((x) => ({
          id: x.id,
          type: x.type,
          name: x.name,
          partNumber: x.partNumber,
          quantity: x.quantity,
          unitPriceCents: x.unitPriceCents,
          totalCents: x.totalCents,
          raw_json: x.raw ? JSON.stringify(x.raw) : null,
        }));
      }
    } catch {
      // ignore fallback failure
    }

    console.warn('❌ No service items found for order');
    return [];
  } catch (error) {
    console.warn('Could not fetch line items from separate endpoint:', error.message);
    return [];
  }
}

/**
 * Get workflow statuses from ShopMonkey
 * This returns all available workflow statuses (columns) in the shop
 * Correct endpoint: /workflow_status (with underscore, not slash)
 */
export async function getWorkflowStatuses() {
  const response = await shopmonkeyRequest('/workflow_status');
  
  // Handle different response formats
  // ShopMonkey might return: { data: [...] }, { statuses: [...] }, or just [...]
  if (Array.isArray(response)) {
    return response;
  }
  if (response.data && Array.isArray(response.data)) {
    return response.data;
  }
  if (response.statuses && Array.isArray(response.statuses)) {
    return response.statuses;
  }
  if (response.workflowStatuses && Array.isArray(response.workflowStatuses)) {
    return response.workflowStatuses;
  }
  
  // Log the response structure for debugging
  console.log('ShopMonkey workflow_status response format:', JSON.stringify(response, null, 2).substring(0, 500));
  
  // Return empty array if we can't parse it
  return [];
}

/**
 * Get orders from a specific workflow status (column)
 * @param {string} statusId - The workflow status ID (e.g., for "in the shop" column)
 * @param {Object} options - Additional options (limit, offset, etc.)
 */
export async function getOrdersByWorkflowStatus(statusId, options = {}) {
  const queryParams = new URLSearchParams();
  if (options.limit) queryParams.append('limit', options.limit);
  if (options.offset) queryParams.append('offset', options.offset);
  
  const queryString = queryParams.toString();
  const endpoint = `/workflow/list/${statusId}${queryString ? `?${queryString}` : ''}`;
  
  const response = await shopmonkeyRequest(endpoint);
  // The workflow endpoint returns data in a different format
  // Extract orders from the response
  if (response.data && response.data.orders) {
    return response.data.orders;
  }
  if (Array.isArray(response)) {
    return response;
  }
  return [];
}

/**
 * Get repair orders with filters
 * @param {Object} filters - Query filters (workflowStatus, workflowStatusId, status, date range, etc.)
 * Note: For "in the shop" orders, use workflowStatusId or workflowStatus='inShop'
 */
export async function getRepairOrders(filters = {}) {
  // If workflowStatusId is provided, use the workflow endpoint
  if (filters.workflowStatusId) {
    return await getOrdersByWorkflowStatus(filters.workflowStatusId, {
      limit: filters.limit,
      offset: filters.offset
    });
  }
  
  // Otherwise, try the regular order endpoint
  const queryParams = new URLSearchParams();
  
  // ShopMonkey uses workflowStatus for filtering by workflow/column status
  // "in the shop" column is typically workflowStatus='inShop'
  if (filters.workflowStatus) {
    queryParams.append('workflowStatus', filters.workflowStatus);
  }
  // Also support regular status filter
  if (filters.status) {
    queryParams.append('status', filters.status);
  }
  
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.limit) queryParams.append('limit', filters.limit);
  if (filters.offset) queryParams.append('offset', filters.offset);

  const queryString = queryParams.toString();
  // ShopMonkey API uses /order (singular) endpoint
  const endpoint = `/order${queryString ? `?${queryString}` : ''}`;
  
  return await shopmonkeyRequest(endpoint);
}

/**
 * Get vehicle information
 */
export async function getVehicle(vehicleId) {
  return await shopmonkeyRequest(`/vehicles/${vehicleId}`);
}

/**
 * Get customer information
 */
export async function getCustomer(customerId) {
  return await shopmonkeyRequest(`/customers/${customerId}`);
}

/**
 * Extract work items from a ShopMonkey repair order
 * Extracts parts and labor items only, no pricing
 * @param {Object} order - The ShopMonkey order object
 * @param {Array} lineItemsFromAPI - Optional line items fetched from a separate API call
 */
export function extractWorkItemsFromOrder(order, lineItemsFromAPI = null) {
  const items = [];
  
  if (!order) {
    console.warn('ShopMonkey order is null or undefined');
    return items;
  }

  // Log all order keys to see what we're missing
  const allKeys = Object.keys(order);
  console.log(`ShopMonkey order has ${allKeys.length} keys. Full list:`, allKeys);
  
  // Also log the actual full JSON to see all fields (first 10000 chars to see more)
  const orderJson = JSON.stringify(order, null, 2);
  console.log('Full order structure (first 10000 chars):', orderJson.substring(0, 10000));
  
  // Check if there are any fields we're missing by checking the end of the JSON
  if (orderJson.length > 10000) {
    console.log('Full order structure (last 5000 chars):', orderJson.substring(orderJson.length - 5000));
  }
  
  // Check if "lineItems" appears anywhere in the JSON (even if truncated in logs)
  if (orderJson.includes('"lineItems"') || orderJson.includes('"line_items"')) {
    console.log('✅ Found "lineItems" or "line_items" in order JSON!');
    // Try to extract it manually
    const lineItemsMatch = orderJson.match(/"lineItems"\s*:\s*\[([^\]]*)\]/);
    if (lineItemsMatch) {
      console.log('Found lineItems array in JSON (may be truncated in logs)');
    }
  }
  
  // Check for any keys that might be line items but we missed
  const allKeysLower = allKeys.map(k => k.toLowerCase());
  const lineItemKeywords = ['line', 'item', 'part', 'labor', 'service', 'work'];
  const suspiciousKeys = allKeys.filter(key => 
    lineItemKeywords.some(keyword => key.toLowerCase().includes(keyword))
  );
  if (suspiciousKeys.length > 0) {
    console.log('Keys that might contain line items:', suspiciousKeys);
    suspiciousKeys.forEach(key => {
      const value = order[key];
      console.log(`  ${key}:`, typeof value, Array.isArray(value) ? `(array, length: ${value.length})` : 
        (typeof value === 'object' && value !== null ? `(object, keys: ${Object.keys(value).join(', ')})` : value));
    });
  }
  
  // Check for any array fields that might be line items
  const arrayFields = allKeys.filter(key => Array.isArray(order[key]));
  if (arrayFields.length > 0) {
    console.log('Array fields found:', arrayFields);
    arrayFields.forEach(key => {
      const arr = order[key];
      console.log(`  ${key}: ${arr.length} items`);
      if (arr.length > 0 && arr.length < 10) {
        // Log first item structure if array is small
        console.log(`    First item keys:`, Object.keys(arr[0] || {}));
      }
    });
  }
  
  // Check for object fields that might contain line items
  const objectFields = allKeys.filter(key => 
    order[key] && 
    typeof order[key] === 'object' && 
    !Array.isArray(order[key]) &&
    order[key] !== null
  );
  if (objectFields.length > 0) {
    console.log('Object fields found:', objectFields);
    objectFields.forEach(key => {
      const obj = order[key];
      if (obj && typeof obj === 'object') {
        const objKeys = Object.keys(obj);
        const objArrays = objKeys.filter(k => Array.isArray(obj[k]));
        if (objArrays.length > 0) {
          console.log(`  ${key} contains arrays:`, objArrays);
          objArrays.forEach(arrKey => {
            const arr = obj[arrKey];
            if (arr.length > 0 && arr.length < 10) {
              console.log(`    ${key}.${arrKey} first item keys:`, Object.keys(arr[0] || {}));
            }
          });
        }
      }
    });
  }
  
  // Also check for fields that might be line item IDs that need to be fetched separately
  const possibleLineItemFields = allKeys.filter(key => 
    key.toLowerCase().includes('line') || 
    key.toLowerCase().includes('item') ||
    key.toLowerCase().includes('service') ||
    key.toLowerCase().includes('part') ||
    key.toLowerCase().includes('labor')
  );
  if (possibleLineItemFields.length > 0) {
    console.log('Fields that might relate to line items:', possibleLineItemFields);
    possibleLineItemFields.forEach(key => {
      console.log(`  ${key}:`, typeof order[key], Array.isArray(order[key]) ? `(array, length: ${order[key].length})` : order[key]);
    });
  }

  // ShopMonkey might use different field names: lineItems, items, parts, labor, etc.
  let lineItems = [];
  
  // First, try line items passed from API
  if (lineItemsFromAPI && Array.isArray(lineItemsFromAPI) && lineItemsFromAPI.length > 0) {
    lineItems = lineItemsFromAPI;
    console.log(`Using ${lineItems.length} line items from separate API call`);
  }
  // Check various possible field names in the order
  else if (order.lineItems && Array.isArray(order.lineItems)) {
    lineItems = order.lineItems;
    console.log(`✅ Found ${lineItems.length} line items in order.lineItems`);
    if (lineItems.length > 0) {
      console.log(`First line item structure:`, Object.keys(lineItems[0]));
      console.log(`First line item sample:`, JSON.stringify(lineItems[0], null, 2).substring(0, 500));
    }
  } else if (order.items && Array.isArray(order.items)) {
    lineItems = order.items;
    console.log(`✅ Found ${lineItems.length} line items in order.items`);
  } else if (order.parts && Array.isArray(order.parts)) {
    lineItems = order.parts;
    console.log(`✅ Found ${lineItems.length} line items in order.parts`);
  } else if (order.labor && Array.isArray(order.labor)) {
    lineItems = order.labor;
    console.log(`✅ Found ${lineItems.length} line items in order.labor`);
  } else if (order.line_items && Array.isArray(order.line_items)) {
    lineItems = order.line_items;
    console.log(`✅ Found ${lineItems.length} line items in order.line_items`);
  } else if (order.lineItemList && Array.isArray(order.lineItemList)) {
    lineItems = order.lineItemList;
    console.log(`✅ Found ${lineItems.length} line items in order.lineItemList`);
  } else if (order.invoice && order.invoice.lineItems && Array.isArray(order.invoice.lineItems)) {
    lineItems = order.invoice.lineItems;
    console.log(`✅ Found ${lineItems.length} line items in order.invoice.lineItems`);
  } else if (order.invoice && order.invoice.items && Array.isArray(order.invoice.items)) {
    lineItems = order.invoice.items;
    console.log(`✅ Found ${lineItems.length} line items in order.invoice.items`);
  }
  
  // If still no line items, check if the JSON string contains it (might be in truncated logs)
  if (lineItems.length === 0) {
    const orderJson = JSON.stringify(order);
    // Try to parse lineItems from the full JSON string
    try {
      const parsed = JSON.parse(orderJson);
      if (parsed.lineItems && Array.isArray(parsed.lineItems)) {
        lineItems = parsed.lineItems;
        console.log(`✅ Found ${lineItems.length} line items by parsing full JSON`);
      }
    } catch (e) {
      // JSON parsing failed, continue
    }
  }

  if (lineItems.length === 0) {
    console.warn('No line items found in ShopMonkey order. All order keys:', allKeys);
    
    // Fallback: Extract from order fields when no line items found
    // Prefer generatedName (service description) over name
    const serviceName = order.generatedName || order.name || order.coalescedName || '';
    if (serviceName && serviceName.trim().length > 0) {
      console.log(`Using service name as work item: ${serviceName}`);
      items.push({
        title: toTitleCase(serviceName.trim()),
        order: items.length + 1,
        source: 'shopmonkey'
      });
    }
    
    // Add inspection if needed
    if (order.inspectionStatus === 'NotCompleted' && order.inspectionCount > 0) {
      console.log(`Adding inspection work item (status: ${order.inspectionStatus}, count: ${order.inspectionCount})`);
      items.push({
        title: 'Vehicle Inspection',
        order: items.length + 1,
        source: 'shopmonkey'
      });
    }
    
    // Add labor if present
    if (order.laborCents > 0 && order.totalLaborHours > 0) {
      const laborHours = order.totalLaborHours;
      console.log(`Adding labor work item: ${laborHours} hours ($${(order.laborCents / 100).toFixed(2)})`);
      items.push({
        title: `Labor - ${laborHours} hour${laborHours !== 1 ? 's' : ''}`,
        order: items.length + 1,
        source: 'shopmonkey'
      });
    } else if (order.laborCents > 0) {
      // Labor present but no hours specified
      console.log(`Adding labor work item: $${(order.laborCents / 100).toFixed(2)}`);
      items.push({
        title: 'Labor',
        order: items.length + 1,
        source: 'shopmonkey'
      });
    }
    
    // Add parts if present
    if (order.partsCents > 0) {
      console.log(`Adding parts work item: $${(order.partsCents / 100).toFixed(2)}`);
      items.push({
        title: 'Parts',
        order: items.length + 1,
        source: 'shopmonkey'
      });
    }
    
    // Also check if there's a complaint/recommendation that might describe the work
    if (order.complaint && order.complaint.trim().length > 0) {
      items.push({
        title: toTitleCase(order.complaint.trim()),
        order: items.length + 1,
        source: 'shopmonkey'
      });
    }
    
    // Add recommendation if available
    if (order.recommendation && order.recommendation.trim().length > 0) {
      items.push({
        title: toTitleCase(order.recommendation.trim()),
        order: items.length + 1,
        source: 'shopmonkey'
      });
    }
    
    if (items.length === 0) {
      console.warn('⚠️ ShopMonkey API does not include line items in order response.');
      console.warn('⚠️ You may need to contact ShopMonkey support to get the correct endpoint for line items.');
      console.warn('⚠️ Or check if your API key has permissions to access line items.');
    } else {
      console.log(`✅ Extracted ${items.length} work items from order data:`, items.map(i => i.title));
    }
    
    return items;
  }

  console.log(`Found ${lineItems.length} line items in ShopMonkey order`);

  lineItems.forEach((lineItem, index) => {
    // Get description from various possible fields
    let description = lineItem.description || 
                     lineItem.name || 
                     lineItem.title || 
                     lineItem.item || 
                     lineItem.partName ||
                     lineItem.laborName ||
                     '';

    // Skip if empty
    if (!description || typeof description !== 'string') {
      return;
    }

    description = description.trim();

    // Skip if it's just a price or too short
    if (description.length < 3 || description.match(/^\$[\d,]+\.\d{2}$/)) {
      return;
    }

    // Filter for parts and labor only (exclude other types like fees, taxes, etc.)
    // ShopMonkey uses lineItemType field (e.g., "Service", "Part", "Labor")
    const itemType = (lineItem.lineItemType || lineItem.type || lineItem.itemType || lineItem.category || '').toLowerCase();
    const isPart = itemType.includes('part') || 
                   itemType.includes('inventory') ||
                   itemType === 'part';
    const isLabor = itemType.includes('labor') || 
                    itemType.includes('service') ||
                    itemType.includes('work') ||
                    itemType === 'service' ||
                    itemType === 'labor';
    
    // If lineItemType is explicitly set, only include Service, Part, or Labor
    if (lineItem.lineItemType) {
      const lineItemType = lineItem.lineItemType.toLowerCase();
      if (lineItemType !== 'service' && lineItemType !== 'part' && lineItemType !== 'labor') {
        console.log(`Skipping line item with type "${lineItem.lineItemType}": ${description.substring(0, 50)}`);
        return;
      }
    }
    
    // Skip if it's not a part or labor item (and no explicit type was set)
    if (!isPart && !isLabor && !lineItem.lineItemType) {
      // If no type is specified, include it anyway (might be a work item)
      // But log it for debugging
      console.log(`Including line item with no explicit type: ${description.substring(0, 50)}`);
    }

    // Remove pricing information
    description = description.replace(/\$\s*[\d,]+\.\d{2}/g, '').trim();
    description = description.replace(/[\d,]+\.\d{2}\s*$/g, '').trim(); // Remove trailing prices
    
    // Remove quantity information
    description = description.replace(/\s*(QTY|Qty|qty|Quantity|quantity)[:\s]*\d+\s*$/i, '').trim();
    description = description.replace(/\s+\d+\s*$/, '').trim(); // Remove standalone numbers at end
    
    // Remove part number references (keep the description but remove "Part #: XXX")
    description = description.replace(/Part\s*#:\s*[A-Z0-9-]+/gi, '').trim();
    description = description.replace(/P\/N[:\s]*[A-Z0-9-]+/gi, '').trim();
    
    // Clean up extra spaces
    description = description.replace(/\s+/g, ' ').trim();

    // Only add if we have a meaningful description
    if (description.length > 3) {
      // Check for duplicates
      const exists = items.some(item => 
        item.title.toLowerCase() === description.toLowerCase()
      );
      
      if (!exists) {
        items.push({
          title: toTitleCase(description),
          order: index + 1
        });
      }
    }
  });

  console.log(`Extracted ${items.length} work items from ShopMonkey order`);
  return items;
}

/**
 * Extract vehicle information from a ShopMonkey repair order
 */
export function extractVehicleInfoFromOrder(order) {
  const info = {};
  
  if (order.vehicle) {
    if (order.vehicle.year) info.year = order.vehicle.year;
    if (order.vehicle.make) info.make = order.vehicle.make;
    if (order.vehicle.model) info.model = order.vehicle.model;
    if (order.vehicle.vin) info.vin = order.vehicle.vin;
    if (order.vehicle.mileage) info.mileage = order.vehicle.mileage.toString();
  }
  
  if (order.number) {
    info.repairOrderNumber = order.number.toString();
  }
  
  if (order.customer && order.customer.name) {
    info.customerName = order.customer.name;
  }

  return info;
}

/**
 * Update a repair order in ShopMonkey
 * @param {string} orderId - The ShopMonkey order ID
 * @param {Object} updates - Fields to update (status, workflowStatusId, notes, etc.)
 */
export async function updateRepairOrder(orderId, updates) {
  const endpoint = `/order/${orderId}`;
  
  const response = await shopmonkeyRequest(endpoint, {
    method: 'PATCH',
    body: updates
  });
  
  // ShopMonkey wraps responses in { success: true, data: { ... } }
  return response.data || response;
}

/**
 * Update repair order workflow status (move to different column)
 * @param {string} orderId - The ShopMonkey order ID
 * @param {string} workflowStatusId - The workflow status ID to move to
 */
export async function updateRepairOrderWorkflowStatus(orderId, workflowStatusId) {
  return await updateRepairOrder(orderId, {
    workflowStatusId: workflowStatusId
  });
}

/**
 * Add a note/comment to a repair order
 * @param {string} orderId - The ShopMonkey order ID
 * @param {string} note - The note to add
 */
export async function addRepairOrderNote(orderId, note) {
  // ShopMonkey may have a notes endpoint or include it in the order update
  // This is a placeholder - adjust based on actual API
  return await updateRepairOrder(orderId, {
    notes: note,
    // Or use a separate endpoint if available
  });
}

/**
 * Sync task completion to ShopMonkey
 * This moves the repair order to a "completed" or "ready for pickup" workflow status
 * @param {string} orderId - The ShopMonkey order ID
 * @param {Object} options - Additional options (workflowStatusId, note, etc.)
 */
/**
 * Search payments by date range. Paginates automatically.
 * Returns array of payment objects from Shop Monkey.
 */
export async function getPaymentsByDateRange(startDate, endDate) {
  const payments = [];
  let skip = 0;
  const limit = 200;
  let hasMore = true;

  while (hasMore) {
    const response = await shopmonkeyRequest('/integration/payment/search', {
      method: 'POST',
      body: {
        where: {
          recordedDate: { $gte: startDate, $lte: endDate },
        },
        limit,
        skip,
        orderBy: { recordedDate: 'asc' },
      },
    });

    const data = response.data || response;
    const batch = Array.isArray(data) ? data : (data.data || []);
    payments.push(...batch);

    if (batch.length < limit) {
      hasMore = false;
    } else {
      skip += limit;
    }
  }

  return payments;
}

/**
 * Aggregate payments into daily revenue totals.
 * Only counts successful Charge transactions; subtracts refunds.
 */
export function aggregatePaymentsByDay(payments) {
  const byDay = {};

  for (const p of payments) {
    const date = (p.recordedDate || p.createdDate || '').slice(0, 10);
    if (!date) continue;

    const status = (p.status || '').toLowerCase();
    if (status !== 'succeeded' && status !== 'processing') continue;

    if (!byDay[date]) {
      byDay[date] = { revenue: 0, charges: 0, refunds: 0 };
    }

    const cents = p.amountCents || 0;

    if (p.transactionType === 'Charge') {
      byDay[date].revenue += cents;
      byDay[date].charges += 1;
    } else if (p.transactionType === 'Refund') {
      byDay[date].refunds += cents;
    }
  }

  // Net revenue = charges - refunds, convert cents to dollars
  return Object.entries(byDay).map(([date, d]) => ({
    date,
    revenue: (d.revenue - d.refunds) / 100,
    charge_count: d.charges,
    refund_total: d.refunds / 100,
  }));
}

export async function syncTaskCompletionToShopMonkey(orderId, options = {}) {
  try {
    // First, get all workflow statuses to find a "completed" or "ready" status
    const statuses = await getWorkflowStatuses();
    
    // Try to find a completed/ready status
    const completedStatus = statuses.find(s => {
      const name = (s.name || s.label || s.title || '').toLowerCase();
      return name.includes('complete') || 
             name.includes('ready') || 
             name.includes('done') ||
             name.includes('finished') ||
             name.includes('pickup');
    });
    
    if (completedStatus && completedStatus.id) {
      const statusId = completedStatus.id || completedStatus.workflowStatusId || completedStatus._id;
      
      // Update workflow status
      await updateRepairOrderWorkflowStatus(orderId, statusId);
      
      // Add note if provided
      if (options.note) {
        await addRepairOrderNote(orderId, options.note);
      }
      
      return {
        success: true,
        message: `Repair order moved to ${completedStatus.name || completedStatus.label || 'completed'} status`,
        workflowStatus: completedStatus.name || completedStatus.label
      };
    } else {
      // If no completed status found, just add a note
      if (options.note) {
        await addRepairOrderNote(orderId, options.note);
      }
      
      return {
        success: true,
        message: 'Note added to repair order (no completed workflow status found)',
        warning: 'Could not find a "completed" workflow status in ShopMonkey'
      };
    }
  } catch (error) {
    console.error('Error syncing task completion to ShopMonkey:', error);
    throw new Error(`Failed to sync to ShopMonkey: ${error.message}`);
  }
}

