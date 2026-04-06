import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Logo from '../components/Logo';

const SHOPMONKEY_QUOTE_BASE = 'https://app.shopmonkey.cloud/public/quote-request/b6ddd723-82be-48b3-9166-59ac434cda7c';

function buildIframeSrc(affiliateToken) {
  const params = new URLSearchParams();
  params.set('noExternalScripts', '1');

  // Best-effort: if ShopMonkey copies query params into request fields,
  // these make the token discoverable later in webhooks/payloads.
  params.set('affiliateToken', affiliateToken);
  params.set('note', `AFFILIATE_TOKEN:${affiliateToken}`);
  params.set('description', `AFFILIATE_TOKEN:${affiliateToken}`);

  return `${SHOPMONKEY_QUOTE_BASE}?${params.toString()}`;
}

export default function AffiliateQuote() {
  const { token } = useParams();
  const affiliateToken = String(token || '').trim();

  const iframeSrc = useMemo(() => {
    if (!affiliateToken) return '';
    return buildIframeSrc(affiliateToken);
  }, [affiliateToken]);

  const [status, setStatus] = useState({ kind: 'idle', message: '' });

  useEffect(() => {
    if (!affiliateToken) return;

    const handler = async (event) => {
      // This is best-effort. If ShopMonkey emits a postMessage after submit,
      // we can track it immediately; otherwise the backend will rely on webhooks.
      try {
        const payload = event?.data;
        if (!payload) return;
        if (typeof payload !== 'object') return;

        const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
        const workmonkeyWorkRequestId =
          data?.workRequestId || data?.work_request_id || data?.workRequest?.id || data?.work_request?.id || null;
        const orderId = data?.orderId || data?.order_id || data?.order?.id || null;
        const customerId = data?.customerId || data?.customer_id || data?.customer?.id || null;

        if (!workmonkeyWorkRequestId && !orderId && !customerId) return;

        const res = await fetch('/api/affiliates/public/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            affiliate_token: affiliateToken,
            shopmonkey_work_request_id: workmonkeyWorkRequestId,
            shopmonkey_order_id: orderId,
            shopmonkey_customer_id: customerId,
            raw_json: payload,
          }),
        });
        if (!res.ok) return;

        setStatus({
          kind: 'tracked',
          message: 'Received your submission. We’ll notify the shop and match it to the correct employee.',
        });
      } catch {
        // ignore
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [affiliateToken]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo size="md" className="shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-neutral-100">
                Request a Quote
              </h1>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
                Tell us what you need and we’ll send a quote.
              </p>
            </div>
          </div>

          {status.kind === 'tracked' && (
            <div className="hidden sm:block rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm text-emerald-800 dark:text-emerald-100">
              {status.message}
            </div>
          )}
        </div>

        {status.kind === 'tracked' && (
          <div className="sm:hidden rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm text-emerald-800 dark:text-emerald-100">
            {status.message}
          </div>
        )}

        <div className="rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
            <p className="text-xs font-semibold text-gray-600 dark:text-neutral-300 uppercase tracking-wider">
              Secure quote request
            </p>
          </div>

          {!iframeSrc ? (
            <div className="p-4 text-sm text-red-700 dark:text-red-300">
              Missing affiliate token.
            </div>
          ) : (
            <div className="w-full overflow-hidden">
              <iframe
                title="ShopMonkey Quote Request"
                src={iframeSrc}
                width="100%"
                height="100%"
                frameBorder="0"
                loading="lazy"
                className="w-full h-[78vh] sm:h-[72vh] md:h-[640px] lg:h-[680px] xl:h-[720px]"
              />
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-400 dark:text-neutral-500">
          If commission tracking doesn’t update automatically, we can reconcile it after the first paid invoice.
        </p>
      </div>
    </div>
  );
}

