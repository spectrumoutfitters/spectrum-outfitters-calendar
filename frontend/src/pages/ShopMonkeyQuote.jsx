import React, { useEffect } from 'react';
import Logo from '../components/Logo';

const SM_ORIGIN = 'https://app.shopmonkey.cloud';
/** Override: VITE_SHOPMONKEY_QUOTE_URL — ShopMonkey public work-request / quote embed URL */
const DEFAULT_EMBED_SRC =
  'https://app.shopmonkey.cloud/public/quote-request/b6ddd723-82be-48b3-9166-59ac434cda7c';

const embedSrc =
  typeof import.meta.env.VITE_SHOPMONKEY_QUOTE_URL === 'string' &&
  import.meta.env.VITE_SHOPMONKEY_QUOTE_URL.trim()
    ? import.meta.env.VITE_SHOPMONKEY_QUOTE_URL.trim()
    : DEFAULT_EMBED_SRC;

const GOLD = '#D4A017';

export default function ShopMonkeyQuote() {
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== SM_ORIGIN) return;
      if (e.data && e.data.source === 'sm_wrf' && e.data.dataLayer) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(e.data.dataLayer);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <header className="shrink-0 z-10 bg-white dark:bg-neutral-900 border-b-4 px-4 py-4 shadow-md dark:shadow-neutral-950/80" style={{ borderBottomColor: GOLD }}>
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="shrink-0">
            <Logo size="lg" />
          </div>
          <div
            className="min-w-0 flex-1 pl-4 border-l-[3px] border-y-0 border-r-0 border-solid border-transparent"
            style={{ borderLeftColor: GOLD }}
          >
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight leading-tight">
              Start your request
            </h1>
            <p className="mt-1.5 text-sm sm:text-[15px] font-semibold text-neutral-700 dark:text-neutral-200 leading-snug">
              New clients · Spectrum Outfitters
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 max-w-4xl w-full mx-auto px-4 pt-2 pb-2">
        <section className="flex-1 min-h-0 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
          <iframe
            title="ShopMonkey online quote request"
            src={embedSrc}
            className="h-full w-full border-0 bg-white dark:bg-neutral-950 block"
            allow="clipboard-write"
          />
        </section>
        <p className="shrink-0 pt-2 text-[11px] text-neutral-500 dark:text-neutral-400 text-center leading-snug">
          Form powered by ShopMonkey — your request goes straight to our shop.
        </p>
      </main>
    </div>
  );
}
