import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);

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
          Invoice {invoice?.shopmonkey_order_number || invoice?.shopmonkey_order_id || ''}
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
              <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">Tax</p>
              <p className="text-lg font-bold text-gray-900 dark:text-neutral-100 mt-1">{fmtCents(invoice.tax_cents)}</p>
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
            <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-gray-700 dark:text-neutral-100 uppercase tracking-wider">Line items</h2>
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
            {items.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 dark:text-neutral-400">No line items cached.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-neutral-900">
                    <tr className="text-left text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Part #</th>
                      <th className="py-3 px-4 text-right">Qty</th>
                      <th className="py-3 px-4 text-right">Unit</th>
                      <th className="py-3 px-4 text-right">Total</th>
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
                        <td className="py-3 px-4 text-right text-gray-900 dark:text-neutral-100">{li.quantity ?? '—'}</td>
                        <td className="py-3 px-4 text-right text-gray-600 dark:text-neutral-300">{fmtCents(li.unit_price_cents)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-neutral-100">{fmtCents(li.total_cents)}</td>
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

