import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import api from '../../utils/api';

const fmt$ = (v) => {
  const n = Number(v) || 0;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

function PlaidLinkButton({ onSuccess }) {
  const [linkToken, setLinkToken] = useState(null);

  useEffect(() => {
    api.post('/plaid/link-token').then(r => setLinkToken(r.data.link_token)).catch(() => {});
  }, []);

  const onPlaidSuccess = useCallback((publicToken, metadata) => {
    api.post('/plaid/exchange', { public_token: publicToken })
      .then(() => onSuccess?.())
      .catch(err => alert(err.response?.data?.error || 'Failed to connect bank'));
  }, [onSuccess]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
  });

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium"
    >
      + Connect Bank or Credit Card
    </button>
  );
}

function ConnectedAccounts({ items, onRefresh, syncing, onSync, onDisconnect }) {
  if (!items.length) {
    return (
      <p className="text-sm text-gray-500 dark:text-neutral-400 py-4 text-center">
        No bank or credit card connected. Click &quot;Connect Bank or Credit Card&quot; to link an account and pull expenses automatically.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-950 rounded-lg">
          <div>
            <p className="font-medium text-gray-800 text-sm">{item.institution_name}</p>
            <p className="text-xs text-gray-500">
              {item.last_sync_at
                ? `Last synced: ${new Date(item.last_sync_at).toLocaleString()}`
                : 'Never synced'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onSync(item.item_id)}
              disabled={syncing}
              className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
            <button
              onClick={() => onDisconnect(item.id)}
              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
            >
              Disconnect
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TransactionList({ transactions, onCategorize }) {
  if (!transactions.length) {
    return <p className="text-sm text-gray-500 py-4 text-center">No transactions synced yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="py-2 px-2">Date</th>
            <th className="py-2 px-2">Description</th>
            <th className="py-2 px-2">Category</th>
            <th className="py-2 px-2 text-right">Amount</th>
            <th className="py-2 px-2 text-center">Business?</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(txn => (
            <tr key={txn.id} className="border-b border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800">
              <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{txn.date}</td>
              <td className="py-2 px-2 text-gray-800 max-w-[200px] truncate">
                {txn.merchant_name || txn.name}
              </td>
              <td className="py-2 px-2">
                <span className="text-xs bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-100 px-2 py-0.5 rounded">
                  {txn.expense_category || txn.category || 'Uncategorized'}
                </span>
              </td>
              <td className={`py-2 px-2 text-right font-medium whitespace-nowrap ${txn.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {fmt$(Math.abs(txn.amount))}
              </td>
              <td className="py-2 px-2 text-center">
                <input
                  type="checkbox"
                  checked={!!txn.is_business_expense}
                  onChange={() => onCategorize(txn.id, !txn.is_business_expense)}
                  className="w-4 h-4 rounded border-gray-300"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevenueTable({ daily }) {
  const [showAll, setShowAll] = useState(false);
  const [filterYear, setFilterYear] = useState('');

  const years = [...new Set(daily.map(d => d.date.slice(0, 4)))].sort().reverse();

  const filtered = filterYear ? daily.filter(d => d.date.startsWith(filterYear)) : daily;
  const visible = showAll ? filtered : filtered.slice(0, 60);
  const totalVisible = filtered.reduce((s, d) => s + (parseFloat(d.revenue) || 0), 0);

  return (
    <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-800">
          Daily Revenue ({filtered.length} days{filterYear ? ` in ${filterYear}` : ''}) — Total: {fmt$(totalVisible)}
        </h4>
        <div className="flex gap-2 items-center">
          <select
            value={filterYear}
            onChange={e => { setFilterYear(e.target.value); setShowAll(false); }}
            className="text-xs border border-gray-300 dark:border-neutral-700 rounded px-2 py-1 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
          >
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white dark:bg-neutral-950">
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 px-2">Date</th>
              <th className="py-2 px-2 text-right">Revenue</th>
              <th className="py-2 px-2 text-right">Charges</th>
              <th className="py-2 px-2 text-right">Refunds</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d, i) => (
              <tr key={i} className="border-b border-gray-50 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800">
                <td className="py-1.5 px-2 text-gray-600">{d.date}</td>
                <td className="py-1.5 px-2 text-right font-medium text-green-600">{fmt$(d.revenue)}</td>
                <td className="py-1.5 px-2 text-right text-gray-600">{d.charge_count || 0}</td>
                <td className="py-1.5 px-2 text-right text-red-500">{d.refund_total ? fmt$(d.refund_total) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!showAll && filtered.length > 60 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 text-sm text-primary hover:underline"
        >
          Show all {filtered.length} days
        </button>
      )}
      {showAll && filtered.length > 60 && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-3 text-sm text-gray-500 hover:underline"
        >
          Show less
        </button>
      )}
    </div>
  );
}

export default function FinanceDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [plaidItems, setPlaidItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [plaidConfigured, setPlaidConfigured] = useState(true);
  const [smRevenue, setSmRevenue] = useState(null);
  const [smSyncing, setSmSyncing] = useState(false);
  const [processorRevenue, setProcessorRevenue] = useState(null);
  const [processorConfigured, setProcessorConfigured] = useState(null);
  const [processorSyncing, setProcessorSyncing] = useState(false);
  const [forecast, setForecast] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);

  const loadPlaidItems = async () => {
    try {
      const res = await api.get('/plaid/items');
      setPlaidItems(res.data.items || []);
    } catch (err) {
      if (err.response?.status === 400) setPlaidConfigured(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const res = await api.get('/plaid/transactions');
      setTransactions(res.data.transactions || []);
    } catch (_) {}
  };

  const loadSmRevenue = async () => {
    try {
      const res = await api.get('/shopmonkey/revenue/status');
      setSmRevenue(res.data);
    } catch (_) {}
  };

  const loadProcessorRevenue = async () => {
    try {
      const res = await api.get('/payment-processor/revenue/status');
      setProcessorRevenue(res.data);
    } catch (_) {}
  };

  const loadProcessorConfigured = async () => {
    try {
      const res = await api.get('/payment-processor/revenue/configured');
      setProcessorConfigured(res.data?.processor || null);
    } catch (_) {}
  };

  const loadCashFlow = async () => {
    try {
      const res = await api.get('/finance/cash-flow');
      setCashFlow(res.data);
    } catch (_) {}
  };

  const loadForecast = async () => {
    try {
      const res = await api.get('/finance/forecast');
      setForecast(res.data);
    } catch (_) {}
  };

  useEffect(() => {
    loadPlaidItems();
    loadTransactions();
    loadSmRevenue();
    loadProcessorConfigured();
    loadProcessorRevenue();
    loadCashFlow();
    loadForecast();

    // Auto-refresh revenue status every 60s to reflect background sync
    const interval = setInterval(() => {
      loadSmRevenue();
      loadProcessorRevenue();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async (itemId) => {
    setSyncing(true);
    try {
      const res = await api.post('/plaid/transactions/sync', { item_id: itemId || undefined });
      alert(`Synced ${res.data.synced_count} transactions`);
      await loadPlaidItems();
      await loadTransactions();
      await loadCashFlow();
    } catch (err) {
      alert(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async (id) => {
    if (!window.confirm('Disconnect this bank account? Transaction history will be removed.')) return;
    try {
      await api.delete(`/plaid/items/${id}`);
      await loadPlaidItems();
      await loadTransactions();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to disconnect');
    }
  };

  const handleCategorize = async (txnId, isBusiness) => {
    try {
      await api.put(`/plaid/transactions/${txnId}/categorize`, { is_business_expense: isBusiness });
      setTransactions(prev => prev.map(t => t.id === txnId ? { ...t, is_business_expense: isBusiness ? 1 : 0 } : t));
    } catch (_) {}
  };

  const handleSmSync = async () => {
    setSmSyncing(true);
    try {
      const res = await api.post('/shopmonkey/revenue/sync');
      alert(`Synced ${res.data.days_synced} days of revenue`);
      await loadSmRevenue();
      await loadCashFlow();
      await loadForecast();
    } catch (err) {
      alert(err.response?.data?.error || 'Shop Monkey sync failed');
    } finally {
      setSmSyncing(false);
    }
  };

  const handleProcessorSync = async () => {
    setProcessorSyncing(true);
    try {
      const res = await api.post('/payment-processor/revenue/sync');
      alert(`Synced ${res.data.days_synced} days of revenue`);
      await loadProcessorRevenue();
      await loadCashFlow();
      await loadForecast();
    } catch (err) {
      alert(err.response?.data?.error || 'Payment processor sync failed');
    } finally {
      setProcessorSyncing(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'bank', label: 'Bank Accounts' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'forecast', label: 'Forecast' },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-950 p-1 rounded-lg overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
              activeTab === tab.id ? 'bg-white dark:bg-neutral-700 text-gray-800 dark:text-neutral-100 shadow-sm' : 'text-gray-600 dark:text-neutral-100 hover:text-gray-800 dark:hover:text-neutral-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Quick stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Connected Banks</p>
              <p className="text-2xl font-bold text-gray-800">{plaidItems.length}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Bank Transactions</p>
              <p className="text-2xl font-bold text-gray-800">{transactions.length}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Business Expenses (Bank)</p>
              <p className="text-2xl font-bold text-red-600">
                {fmt$(transactions.filter(t => t.is_business_expense).reduce((s, t) => s + Math.abs(t.amount), 0))}
              </p>
            </div>
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">SM Revenue Status</p>
              <p className="text-lg font-bold text-green-600">
                {smRevenue?.last_sync ? 'Active' : 'Not synced'}
              </p>
            </div>
          </div>

          {/* Cash flow summary */}
          {cashFlow && cashFlow.weeks && cashFlow.weeks.length > 0 && (
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
              <h3 className="text-base font-semibold text-gray-800 mb-3">Weekly Cash Flow</h3>
              <div className="space-y-2">
                {cashFlow.weeks.slice(0, 6).map((w, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
                    <span className="text-gray-600">Week of {w.week_start}</span>
                    <div className="flex gap-4">
                      <span className="text-green-600">{fmt$(w.income)}</span>
                      <span className="text-red-600">{fmt$(w.expenses)}</span>
                      <span className={`font-medium ${w.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {fmt$(w.net)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Forecast preview */}
          {forecast && forecast.projected && forecast.projected.length > 0 && (
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-800">Forecast (Next {forecast.projected.length} Weeks)</h3>
                <button onClick={() => setActiveTab('forecast')} className="text-primary text-sm hover:underline">View details</button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Avg Projected Revenue</p>
                  <p className="text-lg font-bold text-green-600">
                    {fmt$(forecast.projected.reduce((s, w) => s + w.projected_revenue, 0) / forecast.projected.length)}
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Avg Projected Expenses</p>
                  <p className="text-lg font-bold text-red-600">
                    {fmt$(forecast.projected.reduce((s, w) => s + w.projected_expenses, 0) / forecast.projected.length)}
                  </p>
                </div>
                <div className={`rounded-lg p-3 ${
                  forecast.projected.reduce((s, w) => s + w.projected_net, 0) >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                }`}>
                  <p className="text-xs text-gray-500">Avg Projected Net</p>
                  <p className={`text-lg font-bold ${
                    forecast.projected.reduce((s, w) => s + w.projected_net, 0) >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {fmt$(forecast.projected.reduce((s, w) => s + w.projected_net, 0) / forecast.projected.length)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bank Accounts tab */}
      {activeTab === 'bank' && (
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-800">Connected Bank Accounts</h3>
            {plaidConfigured && <PlaidLinkButton onSuccess={() => { loadPlaidItems(); }} />}
          </div>
          {!plaidConfigured ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Plaid is not configured. Set                 <code className="bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded text-gray-900 dark:text-neutral-100">PLAID_CLIENT_ID</code>,{' '}
                <code className="bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded text-gray-900 dark:text-neutral-100">PLAID_SECRET</code>, and{' '}
                <code className="bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded text-gray-900 dark:text-neutral-100">PLAID_TOKEN_ENCRYPTION_KEY</code> in the backend .env file.
              </p>
            </div>
          ) : (
            <ConnectedAccounts
              items={plaidItems}
              onRefresh={loadPlaidItems}
              syncing={syncing}
              onSync={handleSync}
              onDisconnect={handleDisconnect}
            />
          )}
          {plaidItems.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => handleSync()}
                disabled={syncing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm"
              >
                {syncing ? 'Syncing All...' : 'Sync All Accounts'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Transactions tab */}
      {activeTab === 'transactions' && (
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-800">Bank Transactions</h3>
            <span className="text-xs text-gray-500">{transactions.length} transactions</span>
          </div>
          <TransactionList transactions={transactions} onCategorize={handleCategorize} />
        </div>
      )}

      {/* Revenue tab: Shop Monkey + Payment Processor (Stripe) */}
      {activeTab === 'revenue' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Shop Monkey */}
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-800 dark:text-neutral-100">Shop Monkey Revenue</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Auto-syncs every 5 min. Last 7 days refreshed automatically.</p>
                </div>
                <button
                  onClick={handleSmSync}
                  disabled={smSyncing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm font-medium"
                >
                  {smSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>
              {smRevenue ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Days</p>
                    <p className="text-lg font-bold text-gray-800 dark:text-neutral-100">{smRevenue.total_days || 0}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-lg font-bold text-green-600">{fmt$(smRevenue.total_revenue || 0)}</p>
                  </div>
                  <div className="col-span-2 text-xs text-gray-500">
                    Last sync: {smRevenue.last_sync ? new Date(smRevenue.last_sync).toLocaleString() : 'Never'}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-2">Sync to pull Shop Monkey payment data.</p>
              )}
            </div>

            {/* Payment Processor (Valor Pay or Stripe) – label from configured endpoint */}
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-800 dark:text-neutral-100">
                    {processorConfigured === 'valorpay' ? 'Valor Pay' : processorConfigured === 'stripe' ? 'Payment Processor (Stripe)' : 'Payment Processor'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {processorConfigured === 'valorpay'
                      ? 'Charges sync into daily income. Valor Pay keys set in backend/.env.'
                      : processorConfigured === 'stripe'
                        ? 'Charges sync into daily income. Set STRIPE_SECRET_KEY in backend/.env.'
                        : 'Set VALOR_APP_ID and VALOR_APP_KEY (Valor Pay) or STRIPE_SECRET_KEY in backend/.env.'}
                  </p>
                </div>
                <button
                  onClick={handleProcessorSync}
                  disabled={processorSyncing}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50 text-sm font-medium"
                >
                  {processorSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>
              {processorRevenue ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Days</p>
                    <p className="text-lg font-bold text-gray-800 dark:text-neutral-100">{processorRevenue.total_days || 0}</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-lg font-bold text-amber-600">{fmt$(processorRevenue.total_revenue || 0)}</p>
                  </div>
                  <div className="col-span-2 text-xs text-gray-500">
                    Last sync: {processorRevenue.last_sync ? new Date(processorRevenue.last_sync).toLocaleString() : 'Never'}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-2">
                  {processorConfigured === 'valorpay' ? 'Click Sync Now to pull Valor Pay charges into daily income.' : 'Add Valor Pay or Stripe keys in backend/.env and sync.'}
                </p>
              )}
            </div>
          </div>

          {/* Daily revenue: P&L uses one source per day (Shop Monkey > Processor > Manual). Tables show each source. */}
          {smRevenue && smRevenue.daily && smRevenue.daily.length > 0 && (
            <>
              <h4 className="text-sm font-medium text-gray-700 dark:text-neutral-100">Shop Monkey by day</h4>
              <RevenueTable daily={smRevenue.daily} />
            </>
          )}
          {processorRevenue && processorRevenue.daily && processorRevenue.daily.length > 0 && (
            <>
              <h4 className="text-sm font-medium text-gray-700 dark:text-neutral-100 mt-4">Payment processor by day</h4>
              <RevenueTable daily={processorRevenue.daily} />
            </>
          )}
        </div>
      )}

      {/* Forecast tab */}
      {activeTab === 'forecast' && (
        <div className="space-y-4">
          {forecast && forecast.projected && forecast.projected.length > 0 ? (
            <>
              <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Historical (Actual)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 px-2">Week</th>
                        <th className="py-2 px-2 text-right">Revenue</th>
                        <th className="py-2 px-2 text-right">Expenses</th>
                        <th className="py-2 px-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(forecast.historical || []).map((w, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 px-2 text-gray-600">{w.week_ending}</td>
                          <td className="py-2 px-2 text-right text-green-600">{fmt$(w.revenue)}</td>
                          <td className="py-2 px-2 text-right text-red-600">{fmt$(w.expenses)}</td>
                          <td className={`py-2 px-2 text-right font-medium ${w.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {fmt$(w.net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Projected</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 px-2">Week</th>
                        <th className="py-2 px-2 text-right">Proj. Revenue</th>
                        <th className="py-2 px-2 text-right">Proj. Expenses</th>
                        <th className="py-2 px-2 text-right">Proj. Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecast.projected.map((w, i) => (
                        <tr key={i} className="border-b border-gray-50 bg-blue-50/30">
                          <td className="py-2 px-2 text-gray-600">{w.week_ending}</td>
                          <td className="py-2 px-2 text-right text-green-600">{fmt$(w.projected_revenue)}</td>
                          <td className="py-2 px-2 text-right text-red-600">{fmt$(w.projected_expenses)}</td>
                          <td className={`py-2 px-2 text-right font-medium ${w.projected_net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {fmt$(w.projected_net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Based on {forecast.method || 'average'} of {forecast.weeks_used || 0} historical weeks.
                </p>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-xl p-8 text-center">
              <p className="text-gray-500">Not enough historical data to generate a forecast.</p>
              <p className="text-sm text-gray-400 mt-1">At least 2 weeks of revenue/expense data is needed.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
