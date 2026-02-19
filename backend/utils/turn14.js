/**
 * Turn14.com API Integration
 * Documentation: https://www.turn14.com/
 * 
 * This utility handles API calls to Turn14 for parts lookup and ordering
 * Uses OAuth2 Client Credentials flow for authentication
 */

// Turn14 API base URL - from official documentation: https://turn14.com/api/
// Base URL: https://api.turn14.com/v1/
const TURN14_API_BASE = process.env.TURN14_API_BASE_URL || 'https://api.turn14.com/v1';
// OAuth2 token endpoint - try common patterns based on Turn14 API structure
const TURN14_TOKEN_URL = process.env.TURN14_TOKEN_URL || 'https://api.turn14.com/v1/oauth/token';

// Authentication method: 'oauth2', 'basic', 'apikey', or 'auto' (tries all)
const TURN14_AUTH_METHOD = process.env.TURN14_AUTH_METHOD || 'auto';

// Token cache
let accessToken = null;
let tokenExpiry = null;

// Circuit breaker to prevent spamming on repeated failures
let circuitBreaker = {
  failures: 0,
  lastFailure: null,
  isOpen: false,
  cooldown: 60000 // 1 minute cooldown after 3 failures
};

function checkCircuitBreaker() {
  // If circuit is open and cooldown hasn't passed, reject immediately
  if (circuitBreaker.isOpen) {
    const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure;
    if (timeSinceLastFailure < circuitBreaker.cooldown) {
      throw new Error(`Turn14 API is temporarily disabled due to repeated failures. Please wait ${Math.ceil((circuitBreaker.cooldown - timeSinceLastFailure) / 1000)} seconds or check your API configuration.`);
    } else {
      // Cooldown passed, reset circuit breaker
      circuitBreaker.isOpen = false;
      circuitBreaker.failures = 0;
    }
  }
}

function recordFailure() {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();
  
  // Open circuit after 3 consecutive failures
  if (circuitBreaker.failures >= 3) {
    circuitBreaker.isOpen = true;
    console.error(`[Turn14] Circuit breaker OPENED after ${circuitBreaker.failures} failures. API calls disabled for ${circuitBreaker.cooldown / 1000} seconds.`);
  }
}

function recordSuccess() {
  // Reset on success
  circuitBreaker.failures = 0;
  circuitBreaker.isOpen = false;
}

/**
 * Get OAuth2 access token using Client Credentials flow
 * Tries multiple common token endpoint paths if the default fails
 */
async function getAccessToken() {
  // Check circuit breaker first
  checkCircuitBreaker();
  
  // Check if we have a valid cached token
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const clientId = process.env.TURN14_CLIENT_ID;
  const clientSecret = process.env.TURN14_CLIENT_SECRET;
  
  if (!clientId || !clientSecret || 
      clientId.trim() === '' || clientSecret.trim() === '' ||
      clientId === 'your_turn14_client_id_here' ||
      clientSecret === 'your_turn14_client_secret_here') {
    throw new Error('Turn14 credentials not configured. Please set TURN14_CLIENT_ID and TURN14_CLIENT_SECRET in backend/.env');
  }

  // Try multiple common token endpoint paths
  // Start with user-specified URL first, then try alternatives
  const tokenEndpoints = [
    TURN14_TOKEN_URL, // User-specified or default (try this first)
    `${TURN14_API_BASE}/oauth/token`,
    `${TURN14_API_BASE}/oauth2/token`,
    `${TURN14_API_BASE}/auth/token`,
    `${TURN14_API_BASE}/token`,
    // Try without /v1 in base URL
    TURN14_API_BASE.replace('/v1', '') + '/oauth/token',
    TURN14_API_BASE.replace('/v1', '') + '/oauth2/token',
    TURN14_API_BASE.replace('/v1', '') + '/auth/token',
    // Try common alternatives
    'https://api.turn14.com/oauth/token',
    'https://api.turn14.com/oauth2/token',
    'https://api.turn14.com/auth/token',
    'https://api.turn14.com/token',
    'https://turn14.com/api/oauth/token',
    'https://turn14.com/api/oauth2/token'
  ];

  // Remove duplicates
  const uniqueEndpoints = [...new Set(tokenEndpoints)];

  let lastError = null;
  
  // Limit to first 3 attempts to avoid spamming
  const maxAttempts = 3;
  const endpointsToTry = uniqueEndpoints.slice(0, maxAttempts);
  
  for (let i = 0; i < endpointsToTry.length; i++) {
    const tokenUrl = endpointsToTry[i];
    try {
      // Only log first attempt to reduce spam
      if (i === 0) {
        console.log(`[Turn14] Attempting authentication...`);
      }
      
      // Add small delay between attempts (except first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout per attempt
      });

      if (response.ok) {
        const data = await response.json();
        
        // Cache the token
        accessToken = data.access_token;
        // Set expiry to 5 minutes before actual expiry to be safe
        const expiresIn = (data.expires_in || 3600) * 1000; // Convert to milliseconds
        tokenExpiry = Date.now() + expiresIn - (5 * 60 * 1000); // 5 minutes buffer
        
        console.log(`[Turn14] ✅ Authentication successful`);
        recordSuccess(); // Reset circuit breaker on success
        return accessToken;
      } else {
        const errorText = await response.text();
        lastError = new Error(`Failed to get access token from ${tokenUrl}: ${response.status} ${response.statusText} - ${errorText}`);
        // Only log errors, not every attempt
        if (i === endpointsToTry.length - 1) {
          console.error(`[Turn14] ❌ Authentication failed: ${response.status} ${response.statusText}`);
        }
        // Continue to next endpoint
      }
    } catch (error) {
      lastError = error;
      // Only log final error
      if (i === endpointsToTry.length - 1) {
        console.error(`[Turn14] ❌ Authentication error: ${error.message}`);
      }
      // Continue to next endpoint
    }
  }

  // If all OAuth2 attempts failed, try alternative auth methods
  if (TURN14_AUTH_METHOD === 'auto' || TURN14_AUTH_METHOD === 'basic') {
    console.log('[Turn14] Trying Basic Auth as fallback...');
    try {
      return await tryBasicAuth(clientId, clientSecret);
    } catch (basicError) {
      // Silent fallthrough
    }
  }
  
  // Last resort: Use Client ID as API key
  if (TURN14_AUTH_METHOD === 'auto' || TURN14_AUTH_METHOD === 'apikey') {
    console.log('[Turn14] Using API key authentication...');
    accessToken = clientId; // Use Client ID as API key
    tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    return accessToken;
  }
  
  // If we get here, all methods failed
  recordFailure(); // Record failure for circuit breaker
  throw new Error(`All authentication methods failed. Last error: ${lastError?.message || 'Unknown error'}. Please check TURN14_TOKEN_URL or set TURN14_AUTH_METHOD to 'basic' or 'apikey' in backend/.env`);
}

/**
 * Try Basic Authentication as fallback
 * Some APIs use Basic Auth with Client ID as username and Secret as password
 */
async function tryBasicAuth(clientId, clientSecret) {
  // Create Basic Auth header
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  // For Basic Auth, we don't need a token - we'll use the credentials directly
  // Store them in a way that turn14Request can use
  accessToken = `Basic ${credentials}`;
  tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours (Basic Auth doesn't expire)
  
  console.log('[Turn14] ✅ Using Basic Auth');
  return accessToken;
}

/**
 * Make an authenticated request to Turn14 API
 */
export async function turn14Request(endpoint, options = {}) {
  // Check circuit breaker
  checkCircuitBreaker();
  
  // Get access token or credentials
  const authHeader = await getAccessToken();

  const url = `${TURN14_API_BASE}${endpoint}`;
  
  // Determine auth header format
  let authHeaderValue;
  if (authHeader.startsWith('Basic ')) {
    // Basic Auth
    authHeaderValue = authHeader;
  } else if (TURN14_AUTH_METHOD === 'apikey' || (!authHeader.includes('.') && authHeader.length > 20)) {
    // API Key - might use X-API-Key header or Authorization header
    // Try both: some APIs use X-API-Key, others use Authorization: Bearer <key>
    // We'll use Authorization: Bearer for now, but can be changed
    authHeaderValue = `Bearer ${authHeader}`;
  } else {
    // Bearer token (OAuth2)
    authHeaderValue = `Bearer ${authHeader}`;
  }
  
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  // Add authentication header
  // Some APIs use X-API-Key instead of Authorization
  if (TURN14_AUTH_METHOD === 'apikey' && process.env.TURN14_USE_X_API_KEY === 'true') {
    defaultOptions.headers['X-API-Key'] = authHeader;
  } else {
    defaultOptions.headers['Authorization'] = authHeaderValue;
  }

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
    // Reduced logging - only log errors
    // console.log(`Turn14 API Request: ${config.method} ${url}`);
    
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
      console.error(`[Turn14] API Error (${response.status}):`, errorText.substring(0, 200));
      let errorMessage = `Turn14 API error: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorJson.errors?.title || errorMessage;
        // Only log full errors in development
        if (process.env.NODE_ENV === 'development' && errorJson.errors) {
          console.error('[Turn14] Full error details:', JSON.stringify(errorJson.errors, null, 2));
        }
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    recordSuccess(); // Reset circuit breaker on successful API call
    return data;
  } catch (error) {
    // Record failure for circuit breaker (unless it's a circuit breaker error itself)
    if (!error.message.includes('Circuit breaker') && !error.message.includes('temporarily disabled')) {
      recordFailure();
    }
    
    if (error.message.includes('Turn14 API error')) {
      throw error;
    }
    
    // Provide more detailed error information
    const errorDetails = {
      url,
      method: config.method,
      error: error.message,
      errorName: error.name,
      code: error.code
    };
    
    console.error('Turn14 API connection error:', errorDetails);
    
    // Provide user-friendly error messages
    if (error.name === 'AbortError') {
      throw new Error('Turn14 API request timed out. The server may be slow or unreachable.');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot reach Turn14 API (${error.code}). Check your internet connection and verify the API base URL is correct: ${TURN14_API_BASE}`);
    } else if (error.message.includes('fetch failed')) {
      throw new Error(`Network error connecting to Turn14 API. This could be due to:\n- Internet connectivity issues\n- Firewall blocking the connection\n- Incorrect API base URL\n\nError: ${error.message}`);
    }
    
    throw new Error(`Failed to connect to Turn14 API: ${error.message}. Check your internet connection and verify the API endpoint is correct.`);
  }
}

/**
 * Search for parts by part number, description, or keyword
 * @param {Object} searchParams - Search parameters
 * @param {string} searchParams.query - Search query (part number, description, etc.)
 * @param {string} searchParams.partNumber - Specific part number
 * @param {string} searchParams.make - Vehicle make
 * @param {string} searchParams.model - Vehicle model
 * @param {string} searchParams.year - Vehicle year
 * @param {number} searchParams.limit - Maximum number of results
 * @param {number} searchParams.offset - Pagination offset
 */
export async function searchParts(searchParams = {}) {
  const queryParams = new URLSearchParams();
  
  // Add search parameters - try different parameter names
  if (searchParams.query) {
    // Try multiple common parameter names
    queryParams.append('q', searchParams.query);
    queryParams.append('query', searchParams.query);
    queryParams.append('search', searchParams.query);
    queryParams.append('keyword', searchParams.query);
  }
  if (searchParams.partNumber) {
    queryParams.append('partNumber', searchParams.partNumber);
    queryParams.append('part_number', searchParams.partNumber);
    queryParams.append('part', searchParams.partNumber);
    queryParams.append('sku', searchParams.partNumber);
  }
  if (searchParams.make) {
    queryParams.append('make', searchParams.make);
  }
  if (searchParams.model) {
    queryParams.append('model', searchParams.model);
  }
  if (searchParams.year) {
    queryParams.append('year', searchParams.year);
  }
  if (searchParams.limit) {
    queryParams.append('limit', searchParams.limit.toString());
  }
  if (searchParams.offset) {
    queryParams.append('offset', searchParams.offset.toString());
  }

  // Try multiple common endpoint paths
  // Based on Turn14 API documentation at https://turn14.com/api/
  // NOTE: All endpoints tried so far return 404 - need correct endpoint from Turn14 docs
  // Common patterns for parts search (trying different variations)
  const endpoints = [
    `/products`, // Maybe just /products with query params?
    `/inventory`, // Maybe just /inventory with query params?
    `/parts`, // Maybe just /parts with query params?
    `/catalog`, // Common alternative
    `/search`, // Generic search
    `/products/search`,
    `/inventory/search`,
    `/parts/search`,
    `/catalog/search`
  ];

  // Build query string - try different parameter names
  // Turn14 might use different parameter names - try common variations
  const uniqueParams = new URLSearchParams();
  if (searchParams.query) {
    // Try multiple parameter names
    uniqueParams.append('q', searchParams.query);
    uniqueParams.append('query', searchParams.query);
    uniqueParams.append('search', searchParams.query);
    uniqueParams.append('keyword', searchParams.query);
    uniqueParams.append('term', searchParams.query);
  }
  if (searchParams.partNumber) {
    uniqueParams.append('partNumber', searchParams.partNumber);
    uniqueParams.append('part_number', searchParams.partNumber);
    uniqueParams.append('sku', searchParams.partNumber);
    uniqueParams.append('part', searchParams.partNumber);
  }
  if (searchParams.make) uniqueParams.append('make', searchParams.make);
  if (searchParams.model) uniqueParams.append('model', searchParams.model);
  if (searchParams.year) uniqueParams.append('year', searchParams.year);
  if (searchParams.limit) uniqueParams.append('limit', searchParams.limit.toString());
  if (searchParams.offset) uniqueParams.append('offset', searchParams.offset.toString());
  
  const queryString = uniqueParams.toString();
  let lastError = null;

  // Limit to first 3 attempts to avoid spamming
  const maxAttempts = 3;
  const endpointsToTry = endpoints.slice(0, maxAttempts);

  // Try each endpoint until one works
  for (let i = 0; i < endpointsToTry.length; i++) {
    const endpointPath = endpointsToTry[i];
    try {
      const endpoint = `${endpointPath}${queryString ? `?${queryString}` : ''}`;
      // Only log first attempt
      if (i === 0) {
        console.log(`[Turn14] Searching for parts...`);
      }
      
      // Add small delay between attempts (except first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
      
      const response = await turn14Request(endpoint);
      
      // Only log success, not every attempt
      if (i > 0) {
        console.log(`[Turn14] ✅ Search successful`);
      }
      
      // Handle different response formats
      if (Array.isArray(response)) {
        return response;
      }
      if (response.data && Array.isArray(response.data)) {
        return response.data;
      }
      if (response.results && Array.isArray(response.results)) {
        return response.results;
      }
      if (response.items && Array.isArray(response.items)) {
        return response.items;
      }
      if (response.parts && Array.isArray(response.parts)) {
        return response.parts;
      }
      if (response.products && Array.isArray(response.products)) {
        return response.products;
      }
      
      // If response has pagination info, return it
      if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        return response.data;
      }
      
      // If we got a response but it's not in expected format, return empty
      return [];
    } catch (error) {
      lastError = error;
      // Only log final error
      if (i === endpointsToTry.length - 1) {
        console.error(`[Turn14] ❌ Search failed: ${error.message}`);
      }
      // Stop immediately if we get authentication errors or circuit breaker is open
      if (error.message && (
        error.message.includes('401') || 
        error.message.includes('Unauthorized') || 
        error.message.includes('authenticate') ||
        error.message.includes('Circuit breaker') ||
        error.message.includes('temporarily disabled')
      )) {
        console.error('[Turn14] Stopping attempts - authentication error or circuit breaker');
        break;
      }
      // Continue to next endpoint
    }
  }

  // If all endpoints failed, throw the last error
  throw new Error(`All search endpoints failed. Last error: ${lastError?.message || 'Unknown error'}. Please check TURN14_API_BASE_URL and endpoint paths.`);
}

/**
 * Get part details by part number
 * @param {string} partNumber - The part number
 */
export async function getPartByNumber(partNumber) {
  // Adjust endpoint based on actual Turn14 API documentation
  // Common patterns: /parts/{partNumber}, /products/{partNumber}
  const endpoint = `/parts/${encodeURIComponent(partNumber)}`;
  
  const response = await turn14Request(endpoint);
  
  // Handle different response formats
  return response.data || response;
}

/**
 * Get pricing for a part
 * @param {string} partNumber - The part number
 * @param {number} quantity - Quantity (optional, for quantity-based pricing)
 */
export async function getPartPricing(partNumber, quantity = 1) {
  // Adjust endpoint based on actual Turn14 API documentation
  const endpoint = `/parts/${encodeURIComponent(partNumber)}/pricing${quantity > 1 ? `?quantity=${quantity}` : ''}`;
  
  const response = await turn14Request(endpoint);
  
  return response.data || response;
}

/**
 * Check inventory/availability for a part
 * @param {string} partNumber - The part number
 */
export async function checkPartAvailability(partNumber) {
  // Adjust endpoint based on actual Turn14 API documentation
  const endpoint = `/parts/${encodeURIComponent(partNumber)}/availability`;
  
  const response = await turn14Request(endpoint);
  
  return response.data || response;
}

/**
 * Get parts by vehicle fitment
 * @param {Object} vehicleInfo - Vehicle information
 * @param {string} vehicleInfo.make - Vehicle make
 * @param {string} vehicleInfo.model - Vehicle model
 * @param {string} vehicleInfo.year - Vehicle year
 * @param {string} vehicleInfo.category - Part category (optional)
 */
export async function getPartsByVehicle(vehicleInfo) {
  const queryParams = new URLSearchParams();
  
  if (vehicleInfo.make) {
    queryParams.append('make', vehicleInfo.make);
  }
  if (vehicleInfo.model) {
    queryParams.append('model', vehicleInfo.model);
  }
  if (vehicleInfo.year) {
    queryParams.append('year', vehicleInfo.year);
  }
  if (vehicleInfo.category) {
    queryParams.append('category', vehicleInfo.category);
  }

  const queryString = queryParams.toString();
  // Adjust endpoint based on actual Turn14 API documentation
  const endpoint = `/parts/fitment${queryString ? `?${queryString}` : ''}`;
  
  const response = await turn14Request(endpoint);
  
  // Handle different response formats
  if (Array.isArray(response)) {
    return response;
  }
  if (response.data && Array.isArray(response.data)) {
    return response.data;
  }
  if (response.results && Array.isArray(response.results)) {
    return response.results;
  }
  
  return [];
}

/**
 * Create an order
 * @param {Array} items - Array of order items
 * @param {string} items[].partNumber - Part number
 * @param {number} items[].quantity - Quantity
 * @param {Object} orderInfo - Additional order information (shipping address, etc.)
 */
export async function createOrder(items, orderInfo = {}) {
  const endpoint = '/orders';
  
  const orderData = {
    items: items.map(item => ({
      partNumber: item.partNumber,
      quantity: item.quantity || 1
    })),
    ...orderInfo
  };
  
  const response = await turn14Request(endpoint, {
    method: 'POST',
    body: orderData
  });
  
  return response.data || response;
}

/**
 * Get order status
 * @param {string} orderId - The order ID
 */
export async function getOrderStatus(orderId) {
  const endpoint = `/orders/${encodeURIComponent(orderId)}`;
  
  const response = await turn14Request(endpoint);
  
  return response.data || response;
}

/**
 * Test API connection
 */
export async function testConnection() {
  try {
    // First, try to get an access token
    await getAccessToken();
    
    // Try a simple endpoint - adjust based on actual API
    // Common test endpoints: /health, /status, /me, /account
    try {
      const response = await turn14Request('/health');
      return { success: true, message: 'Turn14 API connection successful', data: response };
    } catch (healthError) {
      // If /health doesn't exist, try searching with empty query (should return empty or error)
      try {
        await searchParts({ query: 'test', limit: 1 });
        return { success: true, message: 'Turn14 API connection successful' };
      } catch (searchError) {
        return { 
          success: true, 
          message: 'Turn14 authentication successful (endpoint test failed)',
          warning: 'Authentication works, but endpoint may need adjustment',
          error: searchError.message
        };
      }
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Failed to connect to Turn14 API',
      details: 'Check your Client ID, Client Secret, and base URL configuration'
    };
  }
}
