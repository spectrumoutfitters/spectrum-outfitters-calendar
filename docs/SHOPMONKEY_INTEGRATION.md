# ShopMonkey API Integration

This document explains how to integrate ShopMonkey API with the Spectrum Outfitters application.

## Setup

### 1. Get Your ShopMonkey API Key

1. Log in to your ShopMonkey account
2. Navigate to Settings → Integrations → API
3. Generate or copy your API key
4. The API key is a Bearer token used for authentication

### 2. Configure the API Key

Add your ShopMonkey API key to `backend/.env`:

```env
SHOPMONKEY_API_KEY=your_api_key_here
```

**Important:** Never commit your API key to version control. The `.env` file is already in `.gitignore`.

### 3. Test the Connection

Once the API key is configured, you can test the connection:

1. Start the backend server
2. As an admin, navigate to the application
3. Use the ShopMonkey integration features (see below)

Or test via API:
```bash
GET /api/shopmonkey/test
```

## Features

### Available Endpoints

- `GET /api/shopmonkey/orders` - Get list of repair orders
- `GET /api/shopmonkey/orders/:id` - Get a specific repair order
- `POST /api/shopmonkey/orders/:id/parse` - Parse repair order and extract work items for tasks
- `GET /api/shopmonkey/vehicles/:id` - Get vehicle information
- `GET /api/shopmonkey/customers/:id` - Get customer information

### Using ShopMonkey Repair Orders in Task Creation

Instead of uploading a PDF, you can:

1. **Search for Repair Orders** - Find repair orders from ShopMonkey
2. **Import Work Items** - Automatically extract line items from the repair order
3. **Auto-fill Task Details** - Vehicle info, customer name, and repair order number are automatically populated

## API Documentation

For full API documentation, visit: https://shopmonkey.dev/

## Troubleshooting

### "ShopMonkey API key not configured"
- Make sure `SHOPMONKEY_API_KEY` is set in `backend/.env`
- Restart the backend server after adding the key

### "Failed to connect to ShopMonkey API"
- Check your internet connection
- Verify the API key is correct
- Check ShopMonkey API status: https://status.shopmonkey.io/

### "ShopMonkey API error: 401 Unauthorized"
- Your API key may be invalid or expired
- Generate a new API key from ShopMonkey settings

### "ShopMonkey API error: 404 Not Found"
- The repair order ID may not exist
- Verify you're using the correct ShopMonkey account

## Security Notes

- API keys are stored server-side only (in `.env`)
- All API requests are made over HTTPS
- Only admins can access ShopMonkey integration features
- API keys are never exposed to the frontend

