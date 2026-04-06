const base = (process.env.SMOKE_BASE_URL || 'http://localhost:5057/api').replace(/\/+$/, '');
const username = process.env.SMOKE_USERNAME || 'admin';
const password = process.env.SMOKE_PASSWORD || 'SpectrumAdmin2024!';

async function j(method, path, body, token) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error || data?.message || `${res.status} ${res.statusText}`;
    throw new Error(`${method} ${path} failed: ${msg}`);
  }
  return data;
}

const dollarsToCents = (s) => {
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
};

async function main() {
  console.log(`🔎 Smoke base: ${base}`);
  const login = await j('POST', '/auth/login', { username, password });
  const token = login?.token;
  if (!token) throw new Error('Login returned no token');
  console.log('✅ Logged in');

  const custName = `Smoke Customer ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
  const customer = await j('POST', '/crm/customers', { display_name: custName, phone: '555-000-0000' }, token);
  const customerId = customer?.customer?.id;
  if (!customerId) throw new Error('Customer create returned no id');
  console.log(`✅ Customer #${customerId}`);

  const vehicle = await j('POST', `/crm/customers/${customerId}/vehicles`, { year: '2018', make: 'Ford', model: 'F-150', license_plate: 'SMOKE' }, token);
  const vehicleId = vehicle?.vehicle?.id;
  if (!vehicleId) throw new Error('Vehicle create returned no id');
  console.log(`✅ Vehicle #${vehicleId}`);

  const invoice = await j('POST', '/crm/invoices', { crm_customer_id: customerId, crm_vehicle_id: vehicleId, tax_cents: 0 }, token);
  const invoiceId = invoice?.invoice?.id;
  if (!invoiceId) throw new Error('Invoice create returned no id');
  console.log(`✅ Invoice #${invoiceId} (number ${invoice?.invoice?.invoice_number || '—'})`);

  await j('POST', `/crm/invoices/${invoiceId}/items`, {
    line_type: 'part',
    description: 'Oil filter',
    quantity: 1,
    unit_price_cents: dollarsToCents(12.5),
  }, token);
  await j('POST', `/crm/invoices/${invoiceId}/items`, {
    line_type: 'labor',
    description: 'Labor',
    quantity: 1.5,
    unit_price_cents: dollarsToCents(120),
  }, token);
  console.log('✅ Added line items');

  const detail = await j('GET', `/crm/invoices/${invoiceId}`, null, token);
  const inv = detail?.invoice;
  if (!inv) throw new Error('Invoice detail missing invoice');
  console.log(`✅ Totals parts=${inv.parts_cents} labor=${inv.labor_cents} fees=${inv.fees_cents} tax=${inv.tax_cents} total=${inv.total_cents}`);
  if (!Number.isFinite(Number(inv.total_cents)) || Number(inv.total_cents) <= 0) throw new Error('Total did not calculate');

  const link = await j('POST', `/crm/invoices/${invoiceId}/payment-link`, {}, token);
  if (!link?.token) throw new Error('Payment link missing token');
  console.log(`✅ Payment link token ${String(link.token).slice(0, 6)}…`);

  const pub = await j('GET', `/public/invoices/${encodeURIComponent(link.token)}`, null, null);
  if (!pub?.invoice?.id) throw new Error('Public invoice fetch failed');
  if (Number(pub.amount_due_cents) <= 0) throw new Error('Public due amount not positive');
  console.log('✅ Public invoice fetch ok');

  console.log('🎉 Smoke test passed');
}

main().catch((e) => {
  console.error('❌ Smoke test failed:', e.message);
  process.exit(1);
});

