import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  searchParts,
  getPartByNumber,
  getPartPricing,
  checkPartAvailability,
  getPartsByVehicle,
  createOrder,
  getOrderStatus,
  testConnection
} from '../utils/turn14.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/turn14/test - Test API connection
 */
router.get('/test', async (req, res) => {
  try {
    // Check if credentials are configured
    if (!process.env.TURN14_CLIENT_ID || !process.env.TURN14_CLIENT_SECRET ||
        process.env.TURN14_CLIENT_ID.trim() === '' || 
        process.env.TURN14_CLIENT_SECRET.trim() === '' ||
        process.env.TURN14_CLIENT_ID === 'your_turn14_client_id_here' ||
        process.env.TURN14_CLIENT_SECRET === 'your_turn14_client_secret_here') {
      return res.status(400).json({ 
        success: false,
        error: 'Turn14 credentials not configured',
        message: 'Please add TURN14_CLIENT_ID and TURN14_CLIENT_SECRET to backend/.env file'
      });
    }

    const result = await testConnection();
    res.json(result);
  } catch (error) {
    console.error('Turn14 test error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to connect to Turn14 API',
      credentialsConfigured: !!(process.env.TURN14_CLIENT_ID && process.env.TURN14_CLIENT_SECRET),
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/turn14/debug - Debug endpoint to check configuration
 */
router.get('/debug', async (req, res) => {
  const config = {
    hasClientId: !!(process.env.TURN14_CLIENT_ID && process.env.TURN14_CLIENT_ID.trim() !== ''),
    hasClientSecret: !!(process.env.TURN14_CLIENT_SECRET && process.env.TURN14_CLIENT_SECRET.trim() !== ''),
    apiBaseUrl: process.env.TURN14_API_BASE_URL || 'https://api.turn14.com/v1 (default)',
    tokenUrl: process.env.TURN14_TOKEN_URL || 'https://api.turn14.com/oauth/token (default)',
    authMethod: process.env.TURN14_AUTH_METHOD || 'auto (default)',
    useXApiKey: process.env.TURN14_USE_X_API_KEY || 'false (default)',
    clientIdPreview: process.env.TURN14_CLIENT_ID ? `${process.env.TURN14_CLIENT_ID.substring(0, 10)}...` : 'NOT SET',
    clientSecretPreview: process.env.TURN14_CLIENT_SECRET ? `${process.env.TURN14_CLIENT_SECRET.substring(0, 10)}...` : 'NOT SET'
  };
  
  res.json({
    message: 'Turn14 Configuration Debug',
    config,
    note: 'Check your backend server console logs for detailed error messages when making API calls'
  });
});

/**
 * GET /api/turn14/parts/search - Search for parts
 * Query params: query, partNumber, make, model, year, limit, offset
 */
router.get('/parts/search', async (req, res) => {
  try {
    // Check if credentials are configured
    if (!process.env.TURN14_CLIENT_ID || !process.env.TURN14_CLIENT_SECRET ||
        process.env.TURN14_CLIENT_ID.trim() === '' || 
        process.env.TURN14_CLIENT_SECRET.trim() === '') {
      return res.status(400).json({ 
        error: 'Turn14 credentials not configured',
        message: 'Please add TURN14_CLIENT_ID and TURN14_CLIENT_SECRET to backend/.env file'
      });
    }

    const { query, partNumber, make, model, year, limit, offset } = req.query;
    
    const searchParams = {};
    if (query) searchParams.query = query;
    if (partNumber) searchParams.partNumber = partNumber;
    if (make) searchParams.make = make;
    if (model) searchParams.model = model;
    if (year) searchParams.year = year;
    if (limit) searchParams.limit = parseInt(limit);
    if (offset) searchParams.offset = parseInt(offset);

    // Reduced logging
    const parts = await searchParts(searchParams);
    res.json({ parts, count: Array.isArray(parts) ? parts.length : 0 });
  } catch (error) {
    // Only log the actual error message, not full stack
    console.error('[Turn14] Search error:', error.message);
    
    // Return more detailed error information
    const errorResponse = {
      error: error.message || 'Failed to search parts'
    };
    
    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
      errorResponse.fullError = error.toString();
    }
    
    // If it's an authentication error, provide helpful message
    if (error.message && error.message.includes('authenticate')) {
      errorResponse.suggestion = 'Authentication failed. Check TURN14_TOKEN_URL or try TURN14_AUTH_METHOD=basic in .env';
    }
    
    // If it's a 404, suggest checking endpoint paths
    if (error.message && error.message.includes('404')) {
      errorResponse.suggestion = 'Endpoint not found. Check TURN14_API_BASE_URL and endpoint paths. Contact Turn14 for correct API structure.';
    }
    
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/turn14/parts/:partNumber - Get part details by part number
 */
router.get('/parts/:partNumber', async (req, res) => {
  try {
    // Check if credentials are configured
    if (!process.env.TURN14_CLIENT_ID || !process.env.TURN14_CLIENT_SECRET ||
        process.env.TURN14_CLIENT_ID.trim() === '' || 
        process.env.TURN14_CLIENT_SECRET.trim() === '') {
      return res.status(400).json({ 
        error: 'Turn14 credentials not configured',
        message: 'Please add TURN14_CLIENT_ID and TURN14_CLIENT_SECRET to backend/.env file'
      });
    }

    const { partNumber } = req.params;
    const part = await getPartByNumber(partNumber);
    res.json({ part });
  } catch (error) {
    console.error('Turn14 get part error:', error);
    res.status(500).json({ error: error.message || 'Failed to get part details' });
  }
});

/**
 * GET /api/turn14/parts/:partNumber/pricing - Get pricing for a part
 * Query params: quantity (optional)
 */
router.get('/parts/:partNumber/pricing', async (req, res) => {
  try {
    // Check if credentials are configured
    if (!process.env.TURN14_CLIENT_ID || !process.env.TURN14_CLIENT_SECRET ||
        process.env.TURN14_CLIENT_ID.trim() === '' || 
        process.env.TURN14_CLIENT_SECRET.trim() === '') {
      return res.status(400).json({ 
        error: 'Turn14 credentials not configured',
        message: 'Please add TURN14_CLIENT_ID and TURN14_CLIENT_SECRET to backend/.env file'
      });
    }

    const { partNumber } = req.params;
    const { quantity } = req.query;
    const pricing = await getPartPricing(partNumber, quantity ? parseInt(quantity) : 1);
    res.json({ pricing });
  } catch (error) {
    console.error('Turn14 get pricing error:', error);
    res.status(500).json({ error: error.message || 'Failed to get pricing' });
  }
});

/**
 * GET /api/turn14/parts/:partNumber/availability - Check part availability
 */
router.get('/parts/:partNumber/availability', async (req, res) => {
  try {
    // Check if credentials are configured
    if (!process.env.TURN14_CLIENT_ID || !process.env.TURN14_CLIENT_SECRET ||
        process.env.TURN14_CLIENT_ID.trim() === '' || 
        process.env.TURN14_CLIENT_SECRET.trim() === '') {
      return res.status(400).json({ 
        error: 'Turn14 credentials not configured',
        message: 'Please add TURN14_CLIENT_ID and TURN14_CLIENT_SECRET to backend/.env file'
      });
    }

    const { partNumber } = req.params;
    const availability = await checkPartAvailability(partNumber);
    res.json({ availability });
  } catch (error) {
    console.error('Turn14 check availability error:', error);
    res.status(500).json({ error: error.message || 'Failed to check availability' });
  }
});

/**
 * GET /api/turn14/parts/fitment - Get parts by vehicle fitment
 * Query params: make, model, year, category
 */
router.get('/parts/fitment', async (req, res) => {
  try {
    // Check if credentials are configured
    if (!process.env.TURN14_CLIENT_ID || !process.env.TURN14_CLIENT_SECRET ||
        process.env.TURN14_CLIENT_ID.trim() === '' || 
        process.env.TURN14_CLIENT_SECRET.trim() === '') {
      return res.status(400).json({ 
        error: 'Turn14 credentials not configured',
        message: 'Please add TURN14_CLIENT_ID and TURN14_CLIENT_SECRET to backend/.env file'
      });
    }

    const { make, model, year, category } = req.query;
    
    const vehicleInfo = {};
    if (make) vehicleInfo.make = make;
    if (model) vehicleInfo.model = model;
    if (year) vehicleInfo.year = year;
    if (category) vehicleInfo.category = category;

    const parts = await getPartsByVehicle(vehicleInfo);
    res.json({ parts, count: Array.isArray(parts) ? parts.length : 0 });
  } catch (error) {
    console.error('Turn14 get parts by vehicle error:', error);
    res.status(500).json({ error: error.message || 'Failed to get parts by vehicle' });
  }
});

/**
 * POST /api/turn14/orders - Create an order (admin only)
 */
router.post('/orders', requireAdmin, async (req, res) => {
  try {
    // Check if credentials are configured
    if (!process.env.TURN14_CLIENT_ID || !process.env.TURN14_CLIENT_SECRET ||
        process.env.TURN14_CLIENT_ID.trim() === '' || 
        process.env.TURN14_CLIENT_SECRET.trim() === '') {
      return res.status(400).json({ 
        error: 'Turn14 credentials not configured',
        message: 'Please add TURN14_CLIENT_ID and TURN14_CLIENT_SECRET to backend/.env file'
      });
    }

    const { items, ...orderInfo } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items are required' });
    }

    const order = await createOrder(items, orderInfo);
    res.status(201).json({ order, message: 'Order created successfully' });
  } catch (error) {
    console.error('Turn14 create order error:', error);
    res.status(500).json({ error: error.message || 'Failed to create order' });
  }
});

/**
 * GET /api/turn14/orders/:orderId - Get order status
 */
router.get('/orders/:orderId', async (req, res) => {
  try {
    // Check if credentials are configured
    if (!process.env.TURN14_CLIENT_ID || !process.env.TURN14_CLIENT_SECRET ||
        process.env.TURN14_CLIENT_ID.trim() === '' || 
        process.env.TURN14_CLIENT_SECRET.trim() === '') {
      return res.status(400).json({ 
        error: 'Turn14 credentials not configured',
        message: 'Please add TURN14_CLIENT_ID and TURN14_CLIENT_SECRET to backend/.env file'
      });
    }

    const { orderId } = req.params;
    const order = await getOrderStatus(orderId);
    res.json({ order });
  } catch (error) {
    console.error('Turn14 get order status error:', error);
    res.status(500).json({ error: error.message || 'Failed to get order status' });
  }
});

export default router;
