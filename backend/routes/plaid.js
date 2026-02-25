import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { getPlaidClient, encryptToken, decryptToken, isPlaidConfigured } from '../utils/plaidClient.js';
import { Products, CountryCode } from 'plaid';
import db from '../database/db.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

function guardPlaid(req, res, next) {
  if (!isPlaidConfigured()) {
    return res.status(400).json({
      error: 'Plaid not configured',
      message: 'Set PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_TOKEN_ENCRYPTION_KEY in .env',
    });
  }
  next();
}

router.use(guardPlaid);

/**
 * Run transaction sync for all (or one) Plaid items. Used by POST /transactions/sync and by background job.
 * @param {string|null} itemId - Optional. If set, sync only this item_id; otherwise sync all.
 * @returns {{ synced_count: number }}
 */
export async function runPlaidTransactionsSync(itemId = null) {
  let items;
  if (itemId) {
    items = await db.allAsync('SELECT * FROM plaid_items WHERE item_id = ?', [itemId]);
  } else {
    items = await db.allAsync('SELECT * FROM plaid_items');
  }

  if (!items || items.length === 0) {
    return { synced_count: 0 };
  }

  const client = getPlaidClient();
  let totalSynced = 0;

  for (const item of items) {
    const accessToken = decryptToken(item.access_token_encrypted);
    let cursor = item.next_cursor || '';
    let hasMore = true;

    while (hasMore) {
      const syncResponse = await client.transactionsSync({
        access_token: accessToken,
        cursor: cursor || undefined,
      });

      const { added, modified, removed, next_cursor, has_more } = syncResponse.data;

      for (const txn of added) {
        await db.runAsync(
          `INSERT INTO bank_transactions
            (plaid_item_id, plaid_transaction_id, date, amount, name, merchant_name, category, pending, iso_currency_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(plaid_item_id, plaid_transaction_id) DO UPDATE SET
            date = excluded.date, amount = excluded.amount, name = excluded.name,
            merchant_name = excluded.merchant_name, category = excluded.category,
            pending = excluded.pending`,
          [
            item.id,
            txn.transaction_id,
            txn.date,
            txn.amount,
            txn.name,
            txn.merchant_name || null,
            txn.personal_finance_category?.primary || (txn.category ? txn.category.join(' > ') : null),
            txn.pending ? 1 : 0,
            txn.iso_currency_code || 'USD',
          ]
        );
      }

      for (const txn of modified) {
        await db.runAsync(
          `UPDATE bank_transactions SET
            date = ?, amount = ?, name = ?, merchant_name = ?, category = ?, pending = ?
           WHERE plaid_item_id = ? AND plaid_transaction_id = ?`,
          [
            txn.date,
            txn.amount,
            txn.name,
            txn.merchant_name || null,
            txn.personal_finance_category?.primary || (txn.category ? txn.category.join(' > ') : null),
            txn.pending ? 1 : 0,
            item.id,
            txn.transaction_id,
          ]
        );
      }

      for (const txn of removed) {
        const txnId = txn.transaction_id;
        if (txnId) {
          await db.runAsync(
            'DELETE FROM bank_transactions WHERE plaid_item_id = ? AND plaid_transaction_id = ?',
            [item.id, txnId]
          );
        }
      }

      totalSynced += added.length + modified.length;
      cursor = next_cursor;
      hasMore = has_more;
    }

    await db.runAsync(
      'UPDATE plaid_items SET next_cursor = ?, last_sync_at = CURRENT_TIMESTAMP WHERE id = ?',
      [cursor, item.id]
    );
  }

  return { synced_count: totalSynced };
}

// POST /api/plaid/link-token
router.post('/link-token', async (req, res) => {
  try {
    const client = getPlaidClient();
    const response = await client.linkTokenCreate({
      user: { client_user_id: String(req.user.id) },
      client_name: 'Spectrum Outfitters',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Plaid link-token error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// POST /api/plaid/exchange
router.post('/exchange', async (req, res) => {
  try {
    const { public_token } = req.body;
    if (!public_token) {
      return res.status(400).json({ error: 'public_token is required' });
    }

    const client = getPlaidClient();
    const exchangeResponse = await client.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeResponse.data;

    let institutionName = 'Unknown';
    try {
      const itemResponse = await client.itemGet({ access_token });
      const instId = itemResponse.data.item.institution_id;
      if (instId) {
        const instResponse = await client.institutionsGetById({
          institution_id: instId,
          country_codes: [CountryCode.Us],
        });
        institutionName = instResponse.data.institution.name;
      }
    } catch (_) { /* non-critical */ }

    const encrypted = encryptToken(access_token);

    await db.runAsync(
      `INSERT INTO plaid_items (user_id, item_id, institution_name, access_token_encrypted)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET
         access_token_encrypted = excluded.access_token_encrypted,
         institution_name = excluded.institution_name`,
      [req.user.id, item_id, institutionName, encrypted]
    );

    res.json({ item_id, institution_name: institutionName });
  } catch (error) {
    console.error('Plaid exchange error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// POST /api/plaid/transactions/sync
router.post('/transactions/sync', async (req, res) => {
  try {
    const { item_id } = req.body;
    const result = await runPlaidTransactionsSync(item_id || null);
    if (result.synced_count === 0 && !item_id) {
      const items = await db.allAsync('SELECT 1 FROM plaid_items LIMIT 1');
      if (!items || items.length === 0) {
        return res.status(404).json({ error: 'No connected bank accounts found' });
      }
    }
    res.json({ synced_count: result.synced_count });
  } catch (error) {
    console.error('Plaid sync error:', error.response?.data || error.message);
    const msg = error.response?.data?.error_code === 'ITEM_LOGIN_REQUIRED'
      ? 'Bank login expired. Please re-link the account.'
      : 'Failed to sync transactions';
    res.status(500).json({ error: msg });
  }
});

// GET /api/plaid/items
router.get('/items', async (req, res) => {
  try {
    const items = await db.allAsync(
      'SELECT id, item_id, institution_name, last_sync_at, created_at FROM plaid_items ORDER BY created_at DESC'
    );
    res.json({ items: items || [] });
  } catch (error) {
    console.error('Plaid list items error:', error);
    res.status(500).json({ error: 'Failed to list connected accounts' });
  }
});

// GET /api/plaid/transactions
router.get('/transactions', async (req, res) => {
  try {
    const { start_date, end_date, is_business_expense } = req.query;
    let query = `
      SELECT bt.*, pi.institution_name
      FROM bank_transactions bt
      JOIN plaid_items pi ON bt.plaid_item_id = pi.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) { query += ' AND bt.date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND bt.date <= ?'; params.push(end_date); }
    if (is_business_expense !== undefined) {
      query += ' AND bt.is_business_expense = ?';
      params.push(is_business_expense === 'true' ? 1 : 0);
    }
    query += ' ORDER BY bt.date DESC LIMIT 500';

    const transactions = await db.allAsync(query, params);
    res.json({ transactions: transactions || [] });
  } catch (error) {
    console.error('Plaid transactions list error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// PUT /api/plaid/transactions/:id/categorize
router.put('/transactions/:id/categorize', async (req, res) => {
  try {
    const { is_business_expense, expense_category } = req.body;
    await db.runAsync(
      'UPDATE bank_transactions SET is_business_expense = ?, expense_category = ? WHERE id = ?',
      [is_business_expense ? 1 : 0, expense_category || null, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Categorize transaction error:', error);
    res.status(500).json({ error: 'Failed to categorize transaction' });
  }
});

// DELETE /api/plaid/items/:id
router.delete('/items/:id', async (req, res) => {
  try {
    const item = await db.getAsync('SELECT * FROM plaid_items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    try {
      const client = getPlaidClient();
      const accessToken = decryptToken(item.access_token_encrypted);
      await client.itemRemove({ access_token: accessToken });
    } catch (_) { /* best-effort remove from Plaid */ }

    await db.runAsync('DELETE FROM bank_transactions WHERE plaid_item_id = ?', [req.params.id]);
    await db.runAsync('DELETE FROM plaid_items WHERE id = ?', [req.params.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Plaid delete item error:', error);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});

export default router;
