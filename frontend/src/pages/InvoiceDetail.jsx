import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const fmtCents = (cents) => {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '—';
  return `$${(n / 100).toFixed(2)}`;
};

const stripePk = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim();
const stripePromise = stripePk ? loadStripe(stripePk) : null;

const StripeElementsForm = ({ mode, buttonLabel, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setMsg('');

    try {
      if (mode === 'setup') {
        const result = await stripe.confirmSetup({
          elements,
          confirmParams: { return_url: window.location.href },
          redirect: 'if_required',
        });
        if (result.error) {
          setMsg(result.error.message || 'Setup failed');
        } else {
          setMsg('Card saved.');
          if (onSuccess) onSuccess();
        }
      } else {
        const result = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: window.location.href },
          redirect: 'if_required',
        });
        if (result.error) {
          setMsg(result.error.message || 'Payment failed');
        } else {
          setMsg('Payment submitted.');
          if (onSuccess) onSuccess();
        }
      }
    } catch (err) {
      setMsg(err?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="p-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950">
        <PaymentElement />
      </div>
      {msg && (
        <div className={`text-sm ${msg.includes('failed') ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}`}>
          {msg}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full min-h-12 px-4 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
      >
        {submitting ? 'Working…' : buttonLabel}
      </button>
    </form>
  );
};

const InvoiceDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const isNative = useMemo(() => {
    if (!invoice) return false;
    return String(invoice.source || '').toLowerCase() === 'native' || !invoice.shopmonkey_order_id;
  }, [invoice]);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    line_type: 'part',
    inventory_item_id: null,
    inventory_item_name: '',
    description: '',
    part_number: '',
    quantity: '1',
    unit_price: '',
    total: '',
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addMsg, setAddMsg] = useState('');

  const [invQ, setInvQ] = useState('');
  const [invDebounced, setInvDebounced] = useState('');
  const [invLoading, setInvLoading] = useState(false);
  const [invResults, setInvResults] = useState([]);
  const [invOpen, setInvOpen] = useState(false);

  const [taxEditing, setTaxEditing] = useState(false);
  const [taxDraft, setTaxDraft] = useState('');

  const [paymentTab, setPaymentTab] = useState('card'); // card | manual | cards
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cards, setCards] = useState([]);

  const [intentClientSecret, setIntentClientSecret] = useState(null);
  const [intentAmountDueCents, setIntentAmountDueCents] = useState(null);
  const [intentLoading, setIntentLoading] = useState(false);

  const [setupClientSecret, setSetupClientSecret] = useState(null);
  const [setupLoading, setSetupLoading] = useState(false);

  const [manualType, setManualType] = useState('cash');
  const [manualAmount, setManualAmount] = useState('');
  const [manualRef, setManualRef] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualMsg, setManualMsg] = useState('');

  const [payLinkLoading, setPayLinkLoading] = useState(false);
  const [payLink, setPayLink] = useState(null); // { token, pay_url, short_url }
  const [payLinkMsg, setPayLinkMsg] = useState('');

  const [quickJobs, setQuickJobs] = useState([]);
  const [quickJobsLoading, setQuickJobsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/crm/invoices/${encodeURIComponent(id)}`);
        if (cancelled) return;
        setInvoice(res.data?.invoice || null);
        setItems(res.data?.items || []);
        setTaxDraft(res.data?.invoice?.tax_cents != null ? String(res.data?.invoice?.tax_cents) : '');
      } catch (e) {
        if (cancelled) return;
        setError(e.response?.data?.error || 'Failed to load invoice');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    const sp = new URLSearchParams(location.search || '');
    const open = sp.get('add') === '1';
    if (open && isNative) setAddOpen(true);
  }, [location.search, isNative]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setQuickJobsLoading(true);
      try {
        const res = await api.get('/crm/quick-jobs');
        if (!cancelled) setQuickJobs((res.data?.jobs || []).filter((j) => j.is_active !== 0));
      } catch {
        if (!cancelled) setQuickJobs([]);
      } finally {
        if (!cancelled) setQuickJobsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setInvDebounced(invQ.trim()), 180);
    return () => clearTimeout(t);
  }, [invQ]);

  useEffect(() => {
    if (!addOpen) return;
    const q = invDebounced;
    if (!q) {
      setInvResults([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setInvLoading(true);
      try {
        const res = await api.get('/inventory/items', { params: { q } });
        const items = res.data?.items || [];
        if (!cancelled) setInvResults(items.slice(0, 10));
      } catch {
        if (!cancelled) setInvResults([]);
      } finally {
        if (!cancelled) setInvLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [addOpen, invDebounced]);

  const vehicleLabel = useMemo(() => {
    if (!invoice) return '—';
    return [invoice.year, invoice.make, invoice.model].filter(Boolean).join(' ') || invoice.vin || invoice.license_plate || '—';
  }, [invoice]);

  const amountPaidCents = useMemo(() => {
    let sum = 0;
    for (const p of payments || []) {
      const status = String(p.status || '').toLowerCase();
      if (status !== 'succeeded' && status !== 'paid') continue;
      const a = Number(p.amount_cents);
      if (Number.isFinite(a)) sum += a;
    }
    return sum;
  }, [payments]);

  const amountDueCents = useMemo(() => {
    const total = Number(invoice?.total_cents);
    if (!Number.isFinite(total)) return null;
    return Math.max(0, total - amountPaidCents);
  }, [invoice?.total_cents, amountPaidCents]);

  const reloadPayments = useCallback(async () => {
    if (!invoice?.id) return;
    setPaymentsLoading(true);
    try {
      const res = await api.get(`/payments/invoices/${invoice.id}/payments`);
      setPayments(res.data?.payments || []);
    } catch {
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  }, [invoice?.id]);

  const reloadCards = useCallback(async () => {
    if (!invoice?.crm_customer_id) return;
    setCardsLoading(true);
    try {
      const res = await api.get(`/payments/customers/${invoice.crm_customer_id}/payment-methods`);
      setCards(res.data?.methods || []);
    } catch {
      setCards([]);
    } finally {
      setCardsLoading(false);
    }
  }, [invoice?.crm_customer_id]);

  useEffect(() => {
    setIntentClientSecret(null);
    setIntentAmountDueCents(null);
    setSetupClientSecret(null);
    setManualMsg('');
    setPayLinkMsg('');
    if (!invoice?.id) return;
    reloadPayments();
    reloadCards();
  }, [invoice?.id, reloadPayments, reloadCards]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-5">
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-gray-500 dark:text-neutral-400 hover:text-primary"
        >
          ← Back
        </button>
        <h1 className="mt-2 text-xl md:text-2xl font-bold text-gray-900 dark:text-neutral-100">
          Invoice {invoice?.invoice_number || invoice?.shopmonkey_order_number || invoice?.shopmonkey_order_id || ''}
        </h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
          {invoice?.invoice_date || '—'} · {invoice?.customer_name || '—'} · {vehicleLabel}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-6 text-sm text-gray-500 dark:text-neutral-400">
          Loading…
        </div>
      ) : !invoice ? (
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-6 text-sm text-gray-500 dark:text-neutral-400">
          Not found.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">Total</p>
              <p className="text-lg font-bold text-gray-900 dark:text-neutral-100 mt-1">{fmtCents(invoice.total_cents)}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">Parts</p>
              <p className="text-lg font-bold text-gray-900 dark:text-neutral-100 mt-1">{fmtCents(invoice.parts_cents)}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">Labor</p>
              <p className="text-lg font-bold text-gray-900 dark:text-neutral-100 mt-1">{fmtCents(invoice.labor_cents)}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">Tax</p>
                {isNative ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTaxEditing((v) => !v);
                      setTaxDraft(invoice?.tax_cents != null ? String(invoice.tax_cents) : '');
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    {taxEditing ? 'Close' : 'Edit'}
                  </button>
                ) : null}
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-neutral-100 mt-1">{fmtCents(invoice.tax_cents)}</p>
              {isNative && taxEditing ? (
                <div className="mt-2 flex gap-2">
                  <input
                    value={taxDraft}
                    onChange={(e) => setTaxDraft(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 text-sm"
                    placeholder="Tax cents (e.g. 825)"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const cents = taxDraft.trim() === '' ? 0 : Number(taxDraft);
                        await api.put(`/crm/invoices/${invoice.id}`, { tax_cents: Number.isFinite(cents) ? Math.round(cents) : 0 });
                        const res = await api.get(`/crm/invoices/${encodeURIComponent(id)}`);
                        setInvoice(res.data?.invoice || null);
                        setItems(res.data?.items || []);
                      } catch {
                        // ignore
                      } finally {
                        setTaxEditing(false);
                      }
                    }}
                    className="h-10 px-3 rounded-lg bg-primary text-white text-xs font-semibold"
                  >
                    Save
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Payments</h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                  Status: <span className="font-semibold text-gray-900 dark:text-neutral-100">{invoice.payment_status || 'unpaid'}</span>
                  {amountDueCents != null && (
                    <span className="ml-2">· Due: <span className="font-semibold">{fmtCents(amountDueCents)}</span></span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['card', 'manual', 'cards'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPaymentTab(t)}
                    className={`min-h-10 px-3 rounded-lg text-xs font-semibold border ${
                      paymentTab === t
                        ? 'bg-primary-subtle dark:bg-primary/20 border-primary/30 text-primary dark:text-primary-light'
                        : 'bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900'
                    }`}
                  >
                    {t === 'card' ? 'Take card payment' : t === 'manual' ? 'Record payment' : 'Cards on file'}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={async () => {
                    await reloadPayments();
                    await reloadCards();
                    const res = await api.get(`/crm/invoices/${encodeURIComponent(id)}`);
                    setInvoice(res.data?.invoice || null);
                  }}
                  className="min-h-10 px-3 rounded-lg text-xs font-semibold border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
                  title="Refresh"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-950 p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-700 dark:text-neutral-200 uppercase tracking-wider">Send payment link</p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                      Generate a secure link to text/email the customer.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={payLinkLoading}
                    onClick={async () => {
                      if (!invoice?.id) return;
                      setPayLinkLoading(true);
                      setPayLinkMsg('');
                      try {
                        const res = await api.post(`/crm/invoices/${invoice.id}/payment-link`);
                        const link = res.data || null;
                        setPayLink(link);
                        const url = link?.short_url || link?.pay_url;
                        if (url && navigator?.clipboard?.writeText) {
                          await navigator.clipboard.writeText(url);
                          setPayLinkMsg('Link copied to clipboard.');
                        } else {
                          setPayLinkMsg('Link generated.');
                        }
                      } catch (e) {
                        setPayLinkMsg(e.response?.data?.error || 'Failed to generate payment link');
                      } finally {
                        setPayLinkLoading(false);
                      }
                    }}
                    className="min-h-12 px-4 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
                  >
                    {payLinkLoading ? 'Working…' : 'Generate link'}
                  </button>
                </div>

                {payLink?.pay_url && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-col md:flex-row gap-2 md:items-center">
                      <input
                        value={payLink.short_url || payLink.pay_url}
                        readOnly
                        className="flex-1 h-11 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const url = payLink.short_url || payLink.pay_url;
                            try {
                              if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(url);
                              setPayLinkMsg('Link copied to clipboard.');
                            } catch {
                              setPayLinkMsg('Copy failed — select and copy manually.');
                            }
                          }}
                          className="min-h-11 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
                        >
                          Copy
                        </button>
                        <a
                          href={`mailto:${encodeURIComponent(invoice.customer_email || '')}?subject=${encodeURIComponent(`Invoice ${invoice.invoice_number || invoice.id} payment link`)}&body=${encodeURIComponent(`Hi${invoice.customer_name ? ` ${invoice.customer_name}` : ''},\n\nPlease use this secure link to pay your invoice:\n${payLink.short_url || payLink.pay_url}\n\nThank you!`)}`}
                          className="min-h-11 px-4 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900 inline-flex items-center justify-center"
                        >
                          Email
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {payLinkMsg && (
                  <p className={`text-sm mt-2 ${payLinkMsg.toLowerCase().includes('fail') ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}`}>
                    {payLinkMsg}
                  </p>
                )}
              </div>

              {!stripePromise && paymentTab === 'card' && (
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  Set `VITE_STRIPE_PUBLISHABLE_KEY` in the frontend env to enable card payments.
                </div>
              )}

              {paymentTab === 'card' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-950 p-4">
                    <p className="text-xs font-bold text-gray-700 dark:text-neutral-200 uppercase tracking-wider">Card payment</p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                      Creates a Stripe PaymentIntent for the remaining balance.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setIntentLoading(true);
                          try {
                            const res = await api.post(`/payments/invoices/${invoice.id}/create-intent`);
                            setIntentClientSecret(res.data?.clientSecret || null);
                            setIntentAmountDueCents(res.data?.amountDueCents ?? null);
                          } catch (e) {
                            setError(e.response?.data?.error || 'Failed to create payment intent');
                          } finally {
                            setIntentLoading(false);
                          }
                        }}
                        disabled={intentLoading || !stripePromise}
                        className="min-h-12 px-4 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
                      >
                        {intentLoading ? 'Creating…' : `Start card payment${amountDueCents != null ? ` (${fmtCents(amountDueCents)})` : ''}`}
                      </button>
                    </div>
                    {intentAmountDueCents != null && (
                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-2">Amount due: {fmtCents(intentAmountDueCents)}</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-4">
                    <p className="text-xs font-bold text-gray-700 dark:text-neutral-200 uppercase tracking-wider">Checkout</p>
                    {!intentClientSecret ? (
                      <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2">Start a card payment to load checkout.</p>
                    ) : (
                      <Elements
                        stripe={stripePromise}
                        options={{
                          clientSecret: intentClientSecret,
                          appearance: { theme: 'night' },
                        }}
                      >
                        <StripeElementsForm
                          mode="payment"
                          buttonLabel="Confirm payment"
                          onSuccess={async () => {
                            await reloadPayments();
                            const res = await api.get(`/crm/invoices/${encodeURIComponent(id)}`);
                            setInvoice(res.data?.invoice || null);
                          }}
                        />
                      </Elements>
                    )}
                  </div>
                </div>
              )}

              {paymentTab === 'manual' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-950 p-4">
                    <p className="text-xs font-bold text-gray-700 dark:text-neutral-200 uppercase tracking-wider">Record payment</p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">Cash, check, ACH, or other methods.</p>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Type</label>
                        <select
                          value={manualType}
                          onChange={(e) => setManualType(e.target.value)}
                          className="w-full h-12 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                        >
                          <option value="cash">Cash</option>
                          <option value="check">Check</option>
                          <option value="ach">ACH</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Amount ($)</label>
                        <input
                          value={manualAmount}
                          onChange={(e) => setManualAmount(e.target.value)}
                          className="w-full h-12 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                          placeholder={amountDueCents != null ? (amountDueCents / 100).toFixed(2) : '0.00'}
                          inputMode="decimal"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Reference (optional)</label>
                        <input
                          value={manualRef}
                          onChange={(e) => setManualRef(e.target.value)}
                          className="w-full h-12 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                          placeholder="e.g. Check #1234, ACH ref, notes…"
                        />
                      </div>
                    </div>
                    {manualMsg && (
                      <div className={`text-sm mt-2 ${manualMsg.includes('Saved') ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                        {manualMsg}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setManualSaving(true);
                          setManualMsg('');
                          try {
                            const dollars = Number.parseFloat(manualAmount || '');
                            const cents = Number.isFinite(dollars) ? Math.round(dollars * 100) : null;
                            if (!cents || cents <= 0) {
                              setManualMsg('Enter a valid amount.');
                              return;
                            }
                            await api.post(`/payments/invoices/${invoice.id}/record-manual`, {
                              amount_cents: cents,
                              payment_method_type: manualType,
                              payment_reference: manualRef || null,
                            });
                            setManualMsg('Saved.');
                            setManualAmount('');
                            setManualRef('');
                            await reloadPayments();
                            const res = await api.get(`/crm/invoices/${encodeURIComponent(id)}`);
                            setInvoice(res.data?.invoice || null);
                          } catch (e) {
                            setManualMsg(e.response?.data?.error || 'Failed to save');
                          } finally {
                            setManualSaving(false);
                          }
                        }}
                        disabled={manualSaving}
                        className="min-h-12 px-4 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
                      >
                        {manualSaving ? 'Saving…' : 'Record payment'}
                      </button>
                      {amountDueCents != null && amountDueCents > 0 && manualAmount === '' && (
                        <button
                          type="button"
                          onClick={() => setManualAmount((amountDueCents / 100).toFixed(2))}
                          className="min-h-12 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-700 dark:text-neutral-200 font-semibold hover:bg-gray-50 dark:hover:bg-neutral-900"
                        >
                          Fill due
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-4">
                    <p className="text-xs font-bold text-gray-700 dark:text-neutral-200 uppercase tracking-wider">Payment history</p>
                    {paymentsLoading ? (
                      <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2">Loading…</p>
                    ) : payments.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2">No payments recorded.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {payments.slice(0, 10).map((p) => (
                          <div key={p.id} className="rounded-lg border border-gray-200 dark:border-neutral-700 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-gray-900 dark:text-neutral-100">{fmtCents(p.amount_cents)}</div>
                              <div className="text-xs text-gray-500 dark:text-neutral-400">{p.provider} · {p.status}</div>
                            </div>
                            {(() => {
                              let ref = null;
                              try {
                                const parsed = p.raw_json ? JSON.parse(p.raw_json) : null;
                                ref = parsed?.ref || parsed?.reference || null;
                              } catch {
                                ref = null;
                              }
                              if (!p.payment_method_type && !ref) return null;
                              return (
                              <div className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                                {p.payment_method_type || '—'}{ref ? ` · ${ref}` : ''}
                              </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {paymentTab === 'cards' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-950 p-4">
                    <p className="text-xs font-bold text-gray-700 dark:text-neutral-200 uppercase tracking-wider">Cards on file</p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">Save a card for future payments (Stripe SetupIntent).</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!stripePromise) return;
                          setSetupLoading(true);
                          try {
                            const res = await api.post(`/payments/customers/${invoice.crm_customer_id}/setup-intent`);
                            setSetupClientSecret(res.data?.clientSecret || null);
                          } catch (e) {
                            setError(e.response?.data?.error || 'Failed to create setup intent');
                          } finally {
                            setSetupLoading(false);
                          }
                        }}
                        disabled={setupLoading || !stripePromise || !invoice.crm_customer_id}
                        className="min-h-12 px-4 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
                      >
                        {setupLoading ? 'Creating…' : 'Add card'}
                      </button>
                    </div>
                    {!invoice.crm_customer_id && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">Customer not linked yet. Sync the ShopMonkey order first.</p>
                    )}
                    {setupClientSecret && (
                      <div className="mt-3">
                        <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret, appearance: { theme: 'night' } }}>
                          <StripeElementsForm
                            mode="setup"
                            buttonLabel="Save card"
                            onSuccess={async () => {
                              setSetupClientSecret(null);
                              await reloadCards();
                            }}
                          />
                        </Elements>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-4">
                    <p className="text-xs font-bold text-gray-700 dark:text-neutral-200 uppercase tracking-wider">Saved methods</p>
                    {cardsLoading ? (
                      <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2">Loading…</p>
                    ) : cards.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2">No cards saved.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {cards.map((c) => (
                          <div key={c.provider_payment_method_id} className="rounded-lg border border-gray-200 dark:border-neutral-700 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
                                {c.brand || 'card'} •••• {c.last4 || '—'}
                                {c.exp_month && c.exp_year ? <span className="text-xs text-gray-500 dark:text-neutral-400 ml-2">exp {c.exp_month}/{c.exp_year}</span> : null}
                              </div>
                              {c.is_default ? (
                                <span className="text-xs font-semibold text-primary">Default</span>
                              ) : null}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {!c.is_default && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await api.post(`/payments/customers/${invoice.crm_customer_id}/payment-methods/${c.provider_payment_method_id}/default`);
                                    await reloadCards();
                                  }}
                                  className="min-h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
                                >
                                  Make default
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={async () => {
                                  await api.delete(`/payments/customers/${invoice.crm_customer_id}/payment-methods/${c.provider_payment_method_id}`);
                                  await reloadCards();
                                }}
                                className="min-h-10 px-3 rounded-lg border border-red-200 dark:border-red-800 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Line items</h2>
                <div className="flex items-center gap-2">
                  {isNative && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddOpen((v) => !v);
                        setAddMsg('');
                      }}
                      className="min-h-10 px-3 rounded-lg bg-primary text-white text-xs font-semibold"
                    >
                      {addOpen ? 'Close' : 'Add item'}
                    </button>
                  )}
                  {invoice.shopmonkey_order_id && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await api.post(`/crm/sync/order/${encodeURIComponent(invoice.shopmonkey_order_id)}`);
                          const res = await api.get(`/crm/invoices/${encodeURIComponent(id)}`);
                          setInvoice(res.data?.invoice || null);
                          setItems(res.data?.items || []);
                        } catch {
                          // ignore
                        }
                      }}
                      className="min-h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-700 dark:text-neutral-200 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-neutral-900"
                    >
                      Re-sync
                    </button>
                  )}
                </div>
              </div>
              {isNative && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                    Quick jobs
                  </span>
                  {quickJobsLoading && (
                    <span className="text-[11px] text-gray-400 dark:text-neutral-500">Loading…</span>
                  )}
                  {!quickJobsLoading && quickJobs.length === 0 && (
                    <span className="text-[11px] text-gray-400 dark:text-neutral-500">
                      No quick jobs yet. Admins can add them under CRM → Quick jobs.
                    </span>
                  )}
                  {!quickJobsLoading &&
                    quickJobs.map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await api.post(
                              `/crm/invoices/${encodeURIComponent(id)}/apply-quick-job/${j.id}`
                            );
                            if (res.data?.invoice) {
                              setInvoice(res.data.invoice);
                              const refreshed = await api.get(`/crm/invoices/${encodeURIComponent(id)}`);
                              setItems(refreshed.data?.items || []);
                            }
                          } catch {
                            // ignore for now; error toast not critical
                          }
                        }}
                        className={`min-h-8 px-3 rounded-full text-[11px] font-semibold border transition ${
                          j.color === 'green'
                            ? 'bg-emerald-500/10 border-emerald-400/60 text-emerald-600 dark:text-emerald-300'
                            : j.color === 'amber'
                            ? 'bg-amber-500/10 border-amber-400/60 text-amber-700 dark:text-amber-300'
                            : 'bg-gray-100 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-200'
                        }`}
                      >
                        {j.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
            {isNative && addOpen && (
              <div className="p-4 border-b border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/30">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  <div className="md:col-span-6">
                    <label className="block text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold mb-1">
                      Inventory (optional)
                    </label>
                    <div className="relative">
                      <input
                        value={invQ}
                        onChange={(e) => {
                          setInvQ(e.target.value);
                          setInvOpen(true);
                        }}
                        onFocus={() => setInvOpen(true)}
                        onBlur={() => setTimeout(() => setInvOpen(false), 120)}
                        className="w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 text-sm"
                        placeholder="Search inventory item name / part # / barcode…"
                      />
                      {invOpen && (invLoading || invResults.length > 0) && (
                        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-xl overflow-hidden">
                          <div className="max-h-[260px] overflow-auto">
                            {invLoading ? (
                              <div className="p-3 text-sm text-gray-500 dark:text-neutral-400">Searching…</div>
                            ) : (
                              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                                {invResults.map((it) => (
                                  <button
                                    key={it.id}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      const reorder = Number(it.reorder_cost);
                                      setAddForm((s) => ({
                                        ...s,
                                        inventory_item_id: it.id,
                                        inventory_item_name: it.name || '',
                                        description: s.description || it.name || '',
                                        part_number: s.part_number || it.supplier_part_number || it.barcode || '',
                                        unit_price: s.unit_price || (Number.isFinite(reorder) ? reorder.toFixed(2) : ''),
                                      }));
                                      setInvQ(it.name || '');
                                      setInvOpen(false);
                                    }}
                                    className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-neutral-900 transition"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100 truncate">{it.name || '—'}</p>
                                        <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 truncate">
                                          {it.supplier_part_number || it.barcode || '—'}
                                          {it.location ? ` · ${it.location}` : ''}
                                        </p>
                                      </div>
                                      <span className="text-xs text-gray-400 dark:text-neutral-500">Use</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {addForm.inventory_item_id ? (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-gray-600 dark:text-neutral-300">
                          Linked: <span className="font-semibold">{addForm.inventory_item_name || `#${addForm.inventory_item_id}`}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setAddForm((s) => ({ ...s, inventory_item_id: null, inventory_item_name: '' }));
                            setInvQ('');
                            setInvResults([]);
                          }}
                          className="text-xs font-semibold text-red-700 dark:text-red-300 hover:underline"
                        >
                          Clear link
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold mb-1">Type</label>
                    <select
                      value={addForm.line_type}
                      onChange={(e) => setAddForm((s) => ({ ...s, line_type: e.target.value }))}
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 text-sm"
                    >
                      <option value="part">Part</option>
                      <option value="labor">Labor</option>
                      <option value="fee">Fee</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold mb-1">Description</label>
                    <input
                      value={addForm.description}
                      onChange={(e) => setAddForm((s) => ({ ...s, description: e.target.value }))}
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 text-sm"
                      placeholder="Oil change, brake pads…"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold mb-1">Part #</label>
                    <input
                      value={addForm.part_number}
                      onChange={(e) => setAddForm((s) => ({ ...s, part_number: e.target.value }))}
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 text-sm font-mono"
                      placeholder="SKU"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold mb-1">Qty</label>
                    <input
                      value={addForm.quantity}
                      onChange={(e) => setAddForm((s) => ({ ...s, quantity: e.target.value }))}
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 text-sm text-right"
                      inputMode="decimal"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold mb-1">Unit ($)</label>
                    <input
                      value={addForm.unit_price}
                      onChange={(e) => setAddForm((s) => ({ ...s, unit_price: e.target.value }))}
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 text-sm text-right"
                      inputMode="decimal"
                      placeholder="99.99"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    disabled={addSaving}
                    onClick={async () => {
                      if (!invoice?.id) return;
                      setAddSaving(true);
                      setAddMsg('');
                      try {
                        const qty = Number(addForm.quantity);
                        const unit = Number(addForm.unit_price);
                        const unitCents = Number.isFinite(unit) ? Math.round(unit * 100) : null;
                        const payload = {
                          line_type: addForm.line_type,
                          description: addForm.description || undefined,
                          part_number: addForm.part_number || undefined,
                          quantity: Number.isFinite(qty) ? qty : 1,
                          unit_price_cents: unitCents,
                          inventory_item_id: addForm.inventory_item_id || undefined,
                        };
                        await api.post(`/crm/invoices/${invoice.id}/items`, payload);
                        const res = await api.get(`/crm/invoices/${encodeURIComponent(id)}`);
                        setInvoice(res.data?.invoice || null);
                        setItems(res.data?.items || []);
                        setAddForm({
                          line_type: 'part',
                          inventory_item_id: null,
                          inventory_item_name: '',
                          description: '',
                          part_number: '',
                          quantity: '1',
                          unit_price: '',
                          total: '',
                        });
                        setInvQ('');
                        setInvResults([]);
                        setAddOpen(false);
                      } catch (e) {
                        setAddMsg(e.response?.data?.error || 'Failed to add item');
                      } finally {
                        setAddSaving(false);
                      }
                    }}
                    className="min-h-11 px-4 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addSaving ? 'Saving…' : 'Add line item'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.post(`/crm/invoices/${invoice.id}/recalculate`);
                        const res = await api.get(`/crm/invoices/${encodeURIComponent(id)}`);
                        setInvoice(res.data?.invoice || null);
                        setItems(res.data?.items || []);
                      } catch {
                        // ignore
                      }
                    }}
                    className="min-h-11 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
                  >
                    Recalculate totals
                  </button>
                  {addMsg && <p className="text-sm text-amber-700 dark:text-amber-300">{addMsg}</p>}
                </div>
              </div>
            )}
            {items.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 dark:text-neutral-400">No line items cached.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-neutral-900">
                    <tr className="text-left text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Part #</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Qty</th>
                      <th className="py-3 px-4 text-right">Unit</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      {isNative ? <th className="py-3 px-4 text-right">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {items.map((li) => (
                      <tr key={li.id} className="align-top">
                        <td className="py-3 px-4 text-gray-900 dark:text-neutral-100">
                          <div className="font-medium">{li.inventory_item_name || li.description || '—'}</div>
                          {li.inventory_item_id && (
                            <button
                              type="button"
                              onClick={() => navigate('/inventory')}
                              className="text-xs text-primary hover:underline mt-0.5"
                              title="Open inventory to search this item"
                            >
                              Linked to inventory
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-600 dark:text-neutral-300">{li.part_number || '—'}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-neutral-300">{li.line_type || '—'}</td>
                        <td className="py-3 px-4 text-right text-gray-900 dark:text-neutral-100">{li.quantity ?? '—'}</td>
                        <td className="py-3 px-4 text-right text-gray-600 dark:text-neutral-300">{fmtCents(li.unit_price_cents)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-neutral-100">{fmtCents(li.total_cents)}</td>
                        {isNative ? (
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await api.delete(`/crm/invoice-items/${li.id}`);
                                  const res = await api.get(`/crm/invoices/${encodeURIComponent(id)}`);
                                  setInvoice(res.data?.invoice || null);
                                  setItems(res.data?.items || []);
                                } catch {
                                  // ignore
                                }
                              }}
                              className="min-h-10 px-3 rounded-lg border border-red-200 dark:border-red-800 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              Delete
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default InvoiceDetail;

