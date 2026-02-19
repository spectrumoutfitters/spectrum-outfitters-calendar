# Environment Variables

This document lists all environment variables used in the Spectrum Outfitters application.

## Backend Environment Variables

Create or edit `backend/.env` file with the following variables:

### Required Variables

```env
PORT=5000
DATABASE_PATH=./database/shop_tasks.db
JWT_SECRET=your_random_32_character_secret_key_here
NODE_ENV=production
ADMIN_EMAIL=neel@spectrumoutfitters.com
BACKUP_PATH=./backups
SESSION_TIMEOUT_HOURS=12
```

### Optional Variables

```env
SHOPMONKEY_API_KEY=your_shopmonkey_api_key_here
```

**Note:** `SHOPMONKEY_API_KEY` is only needed if you want to use ShopMonkey integration. Leave it empty or omit it if not using ShopMonkey.

## Variable Descriptions

### PORT
- **Description:** Port number for the backend server
- **Default:** `5000`
- **Required:** Yes

### DATABASE_PATH
- **Description:** Path to the SQLite database file
- **Default:** `./database/shop_tasks.db`
- **Required:** Yes

### JWT_SECRET
- **Description:** Secret key for JWT token signing (must be at least 32 characters)
- **Required:** Yes
- **Security:** Use a strong, random string in production

### NODE_ENV
- **Description:** Environment mode (`production` or `development`)
- **Default:** `production`
- **Required:** Yes

### ADMIN_EMAIL
- **Description:** Email address for the default admin user
- **Default:** `neel@spectrumoutfitters.com`
- **Required:** Yes

### BACKUP_PATH
- **Description:** Directory path for database backups
- **Default:** `./backups`
- **Required:** Yes

### SESSION_TIMEOUT_HOURS
- **Description:** Session timeout in hours
- **Default:** `12`
- **Required:** Yes

### SHOPMONKEY_API_KEY
- **Description:** API key for ShopMonkey integration (Bearer token)
- **Required:** No (optional)
- **How to get:** 
  1. Log in to ShopMonkey
  2. Go to Settings → Integrations → API
  3. Generate or copy your API key
- **Note:** Leave empty or omit if not using ShopMonkey integration

## Example .env File

```env
PORT=5000
DATABASE_PATH=./database/shop_tasks.db
JWT_SECRET=spectrum_outfitters_secret_key_12345678901234567890
NODE_ENV=production
ADMIN_EMAIL=neel@spectrumoutfitters.com
BACKUP_PATH=./backups
SESSION_TIMEOUT_HOURS=12
SHOPMONKEY_API_KEY=sm_live_abc123xyz789...
```

### Plaid (Bank Connection)

```env
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox
PLAID_TOKEN_ENCRYPTION_KEY=64_hex_char_key_here
```

- **PLAID_CLIENT_ID** — Client ID from the Plaid dashboard.
- **PLAID_SECRET** — Secret key from the Plaid dashboard (use the sandbox secret for development).
- **PLAID_ENV** — `sandbox` for testing, `development` for limited live data, `production` for full access. Default: `sandbox`.
- **PLAID_TOKEN_ENCRYPTION_KEY** — 32-byte hex key (64 hex characters) used to encrypt Plaid access tokens at rest. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

All four are required to enable the Financial Planner bank connection feature. If not set, the "Connect Bank Account" button will show a configuration warning.

## Security Notes

- **Never commit `.env` files to version control**
- The `.env` file is already in `.gitignore`
- Keep your `JWT_SECRET`, `SHOPMONKEY_API_KEY`, `PLAID_SECRET`, and `PLAID_TOKEN_ENCRYPTION_KEY` secure
- Use different secrets for development and production
- Plaid access tokens are encrypted with AES-256-CBC before storage; never log or expose them

## Adding Your ShopMonkey API Key

1. Open `backend/.env` in a text editor
2. Add or update this line:
   ```env
   SHOPMONKEY_API_KEY=your_actual_api_key_here
   ```
3. Save the file
4. Restart the backend server

The ShopMonkey integration will work automatically once the API key is set.

