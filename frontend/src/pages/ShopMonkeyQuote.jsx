import React, { useEffect } from 'react';
import Logo from '../components/Logo';

const SM_ORIGIN = 'https://app.shopmonkey.cloud';
/** Override in frontend/.env: VITE_SHOPMONKEY_QUOTE_URL=https://app.shopmonkey.cloud/public/quote-request/… */
const DEFAULT_EMBED_SRC =
  'https://app.shopmonkey.cloud/public/quote-request/b6ddd723-82be-48b3-9166-59ac434cda7c';

const embedSrc =
  typeof import.meta.env.VITE_SHOPMONKEY_QUOTE_URL === 'string' &&
  import.meta.env.VITE_SHOPMONKEY_QUOTE_URL.trim()
    ? import.meta.env.VITE_SHOPMONKEY_QUOTE_URL.trim()
    : DEFAULT_EMBED_SRC;

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
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 pb-16">
      <header className="sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur px-4 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Logo size="md" />
          <div>
            <h1 className="text-lg font-bold leading-tight">Request a quote</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Spectrum Outfitters · ShopMonkey</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6">
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
          <iframe
            title="ShopMonkey online quote request"
            src={embedSrc}
            className="w-full border-0 block bg-neutral-50 dark:bg-neutral-950 min-h-[50vh] h-[700px] max-h-[90vh] sm:max-h-none"
            allow="clipboard-write"
          />
        </section>
        <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400 text-center">
          Form powered by ShopMonkey — your request goes straight to our shop.
        </p>
      </main>
    </div>
  );
}
