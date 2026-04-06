import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import Logo from '../components/Logo';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const fmtCents = (cents) => {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '—';
  return `$${(n / 100).toFixed(2)}`;
};

const stripePk = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim();
const stripePromise = stripePk ? loadStripe(stripePk) : null;

const PayForm = ({ onPaid }) => {
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
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });
      if (result.error) {
        setMsg(result.error.message || 'Payment failed');
      } else {
        setMsg('Payment submitted.');
        if (onPaid) onPaid();
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
        <div className={`text-sm ${msg.toLowerCase().includes('fail') ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}`}>
          {msg}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full min-h-12 px-4 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
      >
        {submitting ? 'Working…' : 'Pay now'}
      </button>
    </form>
  );
};

const PayInvoice = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [amountDueCents, setAmountDueCents] = useState(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);

  const vehicleLabel = useMemo(() => {
    if (!invoice) return '—';
    return [invoice.year, invoice.make, invoice.model].filter(Boolean).join(' ') || invoice.vin || invoice.license_plate || '—';
  }, [invoice]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/public/invoices/${encodeURIComponent(token)}`);
      setInvoice(res.data?.invoice || null);
      setAmountDueCents(res.data?.amount_due_cents ?? null);
    } catch (e) {
      setError(e.response?.data?.error || 'Link not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const createIntent = async () => {
    if (!token) return;
    setIntentLoading(true);
    try {
      const res = await api.post(`/public/invoices/${encodeURIComponent(token)}/create-intent`);
      setClientSecret(res.data?.clientSecret || null);
    } catch (e) {
      setError(e.response?.data?.error || 'Unable to start payment');
    } finally {
      setIntentLoading(false);
    }
  };

  useEffect(() => {
    setClientSecret(null);
    if (amountDueCents == null) return;
    if (Number(amountDueCents) <= 0) return;
    createIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountDueCents, token]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-4 py-10">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex justify-center">
          <Logo size="lg" className="max-w-[240px]" showText={false} />
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
          {loading ? (
            <div className="text-sm text-gray-500 dark:text-neutral-400">Loading…</div>
          ) : error ? (
            <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
          ) : !invoice ? (
            <div className="text-sm text-gray-500 dark:text-neutral-400">Not found.</div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Invoice</p>
                <p className="text-lg font-bold text-gray-900 dark:text-neutral-100 mt-1">
                  {invoice.invoice_number || invoice.id}
                </p>
                <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                  {invoice.customer_name || '—'} · {vehicleLabel}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 p-3">
                  <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">Total</p>
                  <p className="text-base font-bold text-gray-900 dark:text-neutral-100 mt-1">{fmtCents(invoice.total_cents)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 p-3">
                  <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">Amount due</p>
                  <p className="text-base font-bold text-gray-900 dark:text-neutral-100 mt-1">{fmtCents(amountDueCents)}</p>
                </div>
              </div>

              {Number(amountDueCents || 0) <= 0 ? (
                <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200">
                  This invoice is already paid.
                </div>
              ) : !stripePromise ? (
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  Payments are not configured.
                </div>
              ) : intentLoading ? (
                <div className="text-sm text-gray-500 dark:text-neutral-400">Preparing secure payment…</div>
              ) : !clientSecret ? (
                <button
                  type="button"
                  onClick={createIntent}
                  className="w-full min-h-12 px-4 rounded-xl bg-primary text-white font-semibold"
                >
                  Start payment
                </button>
              ) : (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
                  <PayForm onPaid={load} />
                </Elements>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500 dark:text-neutral-500 text-center">
          Payments processed securely.
        </p>
      </div>
    </div>
  );
};

export default PayInvoice;

