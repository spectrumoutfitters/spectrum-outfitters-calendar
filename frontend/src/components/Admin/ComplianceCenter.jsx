import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import ProfitAndLoss from './ProfitAndLoss';

const ComplianceCenter = () => {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [editingSalesId, setEditingSalesId] = useState(null); // null = new entry, id = editing
  const [aiReview, setAiReview] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [salesEntries, setSalesEntries] = useState([]);
  
  // Sales form state - matches batch report fields
  const [salesForm, setSalesForm] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    batch_number: '',
    transaction_count: '',
    gross_sales: '',           // Net Amount from batch report (cards only)
    visa_amount: '',
    mastercard_amount: '',
    amex_amount: '',
    discover_amount: '',
    other_card_amount: '',
    check_amount: '',          // Check payments received
    check_count: '',           // Number of checks
    cash_amount: '',           // Cash payments received
    zelle_ach_amount: '',      // Zelle/ACH payments received
    taxable_sales: '',         // User calculates based on services
    non_taxable_sales: '',
    sales_tax_collected: '',   // User calculates (8.25% in Houston)
    refunds: '',
    tips: '',
    fees: '',                  // Processing fees if any
    net_deposit: '',           // What actually deposits to bank
    notes: ''
  });
  
  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    confirmation_number: '',
    method: '',
    notes: '',
    paid_at: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await api.get('/compliance/dashboard');
      setDashboard(response.data);
    } catch (error) {
      console.error('Error loading compliance dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSalesEntries = async () => {
    try {
      const response = await api.get('/compliance/sales/daily?limit=30');
      setSalesEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error loading sales entries:', error);
    }
  };

  const handleMarkPaid = async () => {
    if (!selectedInstance) return;
    
    try {
      await api.post(`/compliance/instances/${selectedInstance.id}/mark-paid`, paymentForm);
      setShowPaymentModal(false);
      setSelectedInstance(null);
      setPaymentForm({
        amount: '',
        confirmation_number: '',
        method: '',
        notes: '',
        paid_at: new Date().toISOString().split('T')[0]
      });
      await loadDashboard();
    } catch (error) {
      alert('Error recording payment: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleMarkFiled = async (instance) => {
    const confirmation = prompt('Enter confirmation/reference number (optional):');
    try {
      await api.post(`/compliance/instances/${instance.id}/mark-filed`, {
        confirmation_number: confirmation || null,
        filed_at: new Date().toISOString()
      });
      await loadDashboard();
    } catch (error) {
      alert('Error recording filing: ' + (error.response?.data?.error || error.message));
    }
  };

  const resetSalesForm = () => {
    setSalesForm({
      sale_date: new Date().toISOString().split('T')[0],
      batch_number: '',
      transaction_count: '',
      gross_sales: '',
      visa_amount: '',
      mastercard_amount: '',
      amex_amount: '',
      discover_amount: '',
      other_card_amount: '',
      check_amount: '',
      check_count: '',
      cash_amount: '',
      zelle_ach_amount: '',
      taxable_sales: '',
      non_taxable_sales: '',
      sales_tax_collected: '',
      refunds: '',
      tips: '',
      fees: '',
      net_deposit: '',
      notes: ''
    });
    setEditingSalesId(null);
  };

  const handleEditSales = (entry) => {
    setSalesForm({
      sale_date: entry.sale_date,
      batch_number: entry.batch_number || '',
      transaction_count: entry.transaction_count || '',
      gross_sales: entry.gross_sales || '',
      visa_amount: entry.visa_amount || '',
      mastercard_amount: entry.mastercard_amount || '',
      amex_amount: entry.amex_amount || '',
      discover_amount: entry.discover_amount || '',
      other_card_amount: entry.other_card_amount || '',
      check_amount: entry.check_amount || '',
      check_count: entry.check_count || '',
      cash_amount: entry.cash_amount || '',
      zelle_ach_amount: entry.zelle_ach_amount || '',
      taxable_sales: entry.taxable_sales || '',
      non_taxable_sales: entry.non_taxable_sales || '',
      sales_tax_collected: entry.sales_tax_collected || '',
      refunds: entry.refunds || '',
      tips: entry.tips || '',
      fees: entry.fees || '',
      net_deposit: entry.net_deposit || '',
      notes: entry.notes || ''
    });
    setEditingSalesId(entry.id);
    setShowSalesModal(true);
  };

  const handleSaveSales = async () => {
    try {
      await api.post('/compliance/sales/daily', salesForm);
      setShowSalesModal(false);
      resetSalesForm();
      await loadDashboard();
      if (activeTab === 'sales') {
        await loadSalesEntries();
      }
    } catch (error) {
      alert('Error saving sales: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleNoSales = async () => {
    try {
      await api.post('/compliance/sales/daily', {
        sale_date: salesForm.sale_date,
        gross_sales: 0,
        taxable_sales: 0,
        sales_tax_collected: 0,
        no_sales: true,
        notes: 'No sales recorded for this day'
      });
      setShowSalesModal(false);
      resetSalesForm();
      await loadDashboard();
      if (activeTab === 'sales') {
        await loadSalesEntries();
      }
    } catch (error) {
      alert('Error recording no-sales day: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAiReview = async () => {
    setAiLoading(true);
    try {
      const response = await api.post('/compliance/ai/review');
      setAiReview(response.data);
    } catch (error) {
      if (error.response?.data?.fallback) {
        setAiReview({ review: error.response.data.fallback, isRuleBased: true });
      } else {
        alert('AI review failed: ' + (error.response?.data?.error || error.message));
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleExportPacket = async () => {
    const startDate = prompt('Start date (YYYY-MM-DD):', new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const endDate = prompt('End date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    
    if (!startDate || !endDate) return;
    
    try {
      const response = await api.get(`/compliance/export/cpa-packet?start_date=${startDate}&end_date=${endDate}`);
      
      // Convert to CSV
      const data = response.data;
      let csv = 'CPA Packet Export\n';
      csv += `Period: ${startDate} to ${endDate}\n`;
      csv += `Generated: ${data.generated_at}\n\n`;
      
      csv += 'DAILY SALES\n';
      csv += 'Date,Gross Sales,Taxable Sales,Sales Tax Collected,Refunds,Notes\n';
      data.sales_summary.forEach(s => {
        csv += `${s.sale_date},${s.gross_sales},${s.taxable_sales},${s.sales_tax_collected},${s.refunds},"${s.notes || ''}"\n`;
      });
      
      csv += '\nPAYMENTS & FILINGS\n';
      csv += 'Date,Obligation,Period,Type,Amount,Confirmation,Method,Notes\n';
      data.payments.forEach(p => {
        csv += `${p.paid_at},${p.obligation_name},${p.period_label},${p.payment_type},${p.amount || ''},${p.confirmation_number || ''},${p.method || ''},"${p.notes || ''}"\n`;
      });
      
      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cpa-packet-${startDate}-to-${endDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Export failed: ' + (error.response?.data?.error || error.message));
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    // Parse date string (YYYY-MM-DD) as local date to avoid timezone shifts
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDaysUntil = (dateStr) => {
    const due = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading) {
    return <div className="text-center py-8">Loading compliance data...</div>;
  }

  const { summary, overdue = [], dueSoon = [], upcoming = [], salesSummary } = dashboard || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">Tax & Compliance Center</h2>
          <p className="text-gray-600">Track obligations, record payments, and stay compliant</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowSalesModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
          >
            💵 Enter Daily Sales
          </button>
          <button
            onClick={handleAiReview}
            disabled={aiLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm disabled:opacity-50"
          >
            {aiLoading ? '⏳ Analyzing...' : '🤖 AI Review'}
          </button>
          <button
            onClick={handleExportPacket}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm"
          >
            📦 Export CPA Packet
          </button>
          <button
            onClick={loadDashboard}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition text-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Alert Summary */}
      {(overdue.length > 0 || dueSoon.length > 0) && (
        <div className={`p-4 rounded-lg ${overdue.length > 0 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{overdue.length > 0 ? '🚨' : '⚠️'}</span>
            <div>
              {overdue.length > 0 && (
                <p className="font-semibold text-red-800">{overdue.length} obligation(s) OVERDUE - Immediate action required!</p>
              )}
              {dueSoon.length > 0 && (
                <p className="font-medium text-yellow-800">{dueSoon.length} obligation(s) due soon</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-red-700">{summary?.overdue || 0}</div>
          <div className="text-sm text-red-600">Overdue</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-yellow-700">{summary?.dueSoon || 0}</div>
          <div className="text-sm text-yellow-600">Due Soon</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-blue-700">{summary?.upcoming || 0}</div>
          <div className="text-sm text-blue-600">Upcoming</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-700">{summary?.completed || 0}</div>
          <div className="text-sm text-green-600">Completed</div>
        </div>
      </div>

      {/* AI Review Result */}
      {aiReview && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-purple-800 flex items-center gap-2">
              <span>🤖</span> {aiReview.isRuleBased ? 'Compliance Review' : 'AI Compliance Review'}
            </h3>
            <button
              onClick={() => setAiReview(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
            {aiReview.review}
          </div>
          {aiReview.disclaimer && (
            <p className="mt-4 text-xs text-gray-500 italic">{aiReview.disclaimer}</p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'sales', label: 'Daily Sales', icon: '💵' },
            { id: 'pnl', label: 'Profit & Loss', icon: '💰' },
            { id: 'obligations', label: 'Manage Obligations', icon: '⚙️' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'sales') loadSalesEntries();
              }}
              className={`px-4 py-2 border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Overdue */}
          {overdue.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-red-800 mb-3">🚨 Overdue</h3>
              <div className="space-y-3">
                {overdue.map((item) => (
                  <InstanceCard
                    key={item.id}
                    instance={item}
                    onMarkPaid={() => {
                      setSelectedInstance(item);
                      setPaymentForm(prev => ({ ...prev, amount: item.amount_due_estimate || '' }));
                      setShowPaymentModal(true);
                    }}
                    onMarkFiled={() => handleMarkFiled(item)}
                    formatDate={formatDate}
                    formatCurrency={formatCurrency}
                    getDaysUntil={getDaysUntil}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Due Soon */}
          {dueSoon.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-3">⚠️ Due Soon</h3>
              <div className="space-y-3">
                {dueSoon.map((item) => (
                  <InstanceCard
                    key={item.id}
                    instance={item}
                    onMarkPaid={() => {
                      setSelectedInstance(item);
                      setPaymentForm(prev => ({ ...prev, amount: item.amount_due_estimate || '' }));
                      setShowPaymentModal(true);
                    }}
                    onMarkFiled={() => handleMarkFiled(item)}
                    formatDate={formatDate}
                    formatCurrency={formatCurrency}
                    getDaysUntil={getDaysUntil}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">📅 Upcoming</h3>
              <div className="space-y-3">
                {upcoming.slice(0, 5).map((item) => (
                  <InstanceCard
                    key={item.id}
                    instance={item}
                    onMarkPaid={() => {
                      setSelectedInstance(item);
                      setPaymentForm(prev => ({ ...prev, amount: item.amount_due_estimate || '' }));
                      setShowPaymentModal(true);
                    }}
                    onMarkFiled={() => handleMarkFiled(item)}
                    formatDate={formatDate}
                    formatCurrency={formatCurrency}
                    getDaysUntil={getDaysUntil}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sales Summary */}
          {salesSummary && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">💰 Recent Sales Summary (Last 30 Days)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Days Entered</div>
                  <div className="text-xl font-bold">{salesSummary.days_entered || 0}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Gross Sales</div>
                  <div className="text-xl font-bold text-green-600">{formatCurrency(salesSummary.total_gross)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Taxable Sales</div>
                  <div className="text-xl font-bold text-green-600">{formatCurrency(salesSummary.total_taxable)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Sales Tax Collected</div>
                  <div className="text-xl font-bold text-amber-600">{formatCurrency(salesSummary.total_tax_collected)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sales' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Daily Sales Log</h3>
            <button
              onClick={() => { resetSalesForm(); setShowSalesModal(true); }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
            >
              + Add Entry
            </button>
          </div>
          
          {salesEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No sales entries yet. Click "Add Entry" to start tracking.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium">Date</th>
                    <th className="text-center py-3 px-4 text-sm font-medium">Batch</th>
                    <th className="text-right py-3 px-4 text-sm font-medium">Cards</th>
                    <th className="text-right py-3 px-4 text-sm font-medium">Check</th>
                    <th className="text-right py-3 px-4 text-sm font-medium">Cash</th>
                    <th className="text-right py-3 px-4 text-sm font-medium">Zelle/ACH</th>
                    <th className="text-right py-3 px-4 text-sm font-medium bg-green-50 text-green-700">Total</th>
                    <th className="text-right py-3 px-4 text-sm font-medium">Taxable</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-amber-700">Tax $</th>
                    <th className="text-left py-3 px-4 text-sm font-medium">Notes</th>
                    <th className="text-center py-3 px-4 text-sm font-medium w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {salesEntries.map((entry) => {
                    const totalSales = (parseFloat(entry.gross_sales) || 0) + (parseFloat(entry.check_amount) || 0) + (parseFloat(entry.cash_amount) || 0) + (parseFloat(entry.zelle_ach_amount) || 0);
                    return (
                      <tr key={entry.id} className={`border-t border-gray-200 hover:bg-gray-50 ${entry.no_sales ? 'bg-gray-50' : ''}`}>
                        <td className="py-3 px-4">
                          {formatDate(entry.sale_date)}
                          {entry.no_sales ? (
                            <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">No Sales</span>
                          ) : null}
                        </td>
                        <td className="py-3 px-4 text-center text-gray-500 text-sm">
                          {entry.batch_number ? `#${entry.batch_number}` : '-'}
                          {entry.transaction_count > 0 && <span className="text-xs text-gray-400 block">{entry.transaction_count} trans</span>}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {formatCurrency(entry.gross_sales)}
                          {(entry.visa_amount > 0 || entry.amex_amount > 0 || entry.mastercard_amount > 0) && (
                            <div className="text-xs text-gray-400 flex flex-wrap gap-0.5 justify-end mt-0.5">
                              {entry.visa_amount > 0 && <span>V</span>}
                              {entry.mastercard_amount > 0 && <span>MC</span>}
                              {entry.amex_amount > 0 && <span>AX</span>}
                              {entry.discover_amount > 0 && <span>D</span>}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {entry.check_amount > 0 ? (
                            <span>
                              {formatCurrency(entry.check_amount)}
                              {entry.check_count > 0 && <span className="text-xs text-gray-400 block">({entry.check_count} chk)</span>}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {entry.cash_amount > 0 ? formatCurrency(entry.cash_amount) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {entry.zelle_ach_amount > 0 ? formatCurrency(entry.zelle_ach_amount) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold bg-green-50 text-green-700">{formatCurrency(totalSales)}</td>
                        <td className="py-3 px-4 text-right">{formatCurrency(entry.taxable_sales)}</td>
                        <td className="py-3 px-4 text-right text-amber-600 font-medium">{formatCurrency(entry.sales_tax_collected)}</td>
                        <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">{entry.notes || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleEditSales(entry)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            title="Edit this entry"
                          >
                            ✏️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pnl' && (
        <ProfitAndLoss />
      )}

      {activeTab === 'obligations' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Configured Obligations</h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Jurisdiction</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Frequency</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Reminder</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.obligations?.map((ob) => (
                  <tr key={ob.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{ob.name}</td>
                    <td className="py-3 px-4">{ob.type}</td>
                    <td className="py-3 px-4">{ob.jurisdiction}</td>
                    <td className="py-3 px-4 capitalize">{ob.frequency}</td>
                    <td className="py-3 px-4">{ob.reminder_days_before} days</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${ob.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {ob.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500">
            Contact support to add custom obligations or modify due date rules.
          </p>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedInstance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Record Payment</h3>
            <p className="text-gray-600 mb-4">
              <strong>{selectedInstance.obligation_name}</strong><br />
              Period: {selectedInstance.period_label}<br />
              Due: {formatDate(selectedInstance.due_date)}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmation Number</label>
                <input
                  type="text"
                  value={paymentForm.confirmation_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, confirmation_number: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="EFTPS confirmation, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Select method...</option>
                  <option value="EFTPS">EFTPS</option>
                  <option value="WebFile">WebFile (TX Comptroller)</option>
                  <option value="Direct Debit">Direct Debit</option>
                  <option value="Check">Check</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Paid</label>
                <input
                  type="date"
                  value={paymentForm.paid_at}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paid_at: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleMarkPaid}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Record Payment
              </button>
              <button
                onClick={() => { setShowPaymentModal(false); setSelectedInstance(null); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Entry Modal - Matches Batch Report Format */}
      {showSalesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[95vh] flex flex-col">
            {/* Fixed Header */}
            <div className="flex justify-between items-start p-4 sm:p-6 pb-3 border-b border-gray-200 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold">
                  {editingSalesId ? '✏️ Edit Batch Report' : '💵 End of Day Batch Report'}
                </h3>
                <p className="text-sm text-gray-600">
                  {editingSalesId 
                    ? `Editing entry for ${formatDate(salesForm.sale_date)}`
                    : 'Enter the totals from your credit card terminal batch report'
                  }
                </p>
              </div>
              <button
                onClick={() => { setShowSalesModal(false); setEditingSalesId(null); }}
                className="text-gray-500 hover:text-gray-700 text-xl p-1"
              >
                ✕
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4 space-y-4">
              {/* Date and Batch Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">📅 Batch Information</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                    <input
                      type="date"
                      value={salesForm.sale_date}
                      onChange={(e) => setSalesForm({ ...salesForm, sale_date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch #</label>
                    <input
                      type="text"
                      value={salesForm.batch_number}
                      onChange={(e) => setSalesForm({ ...salesForm, batch_number: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="e.g., 2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1"># Transactions</label>
                    <input
                      type="number"
                      value={salesForm.transaction_count}
                      onChange={(e) => setSalesForm({ ...salesForm, transaction_count: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Batch Total */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">💳 Batch Total (Net Amount)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gross Sales (Batch Total) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={salesForm.gross_sales}
                        onChange={(e) => setSalesForm({ ...salesForm, gross_sales: e.target.value })}
                        className="w-full pl-7 pr-3 py-2 border rounded-lg text-lg font-semibold"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">From "Net Amount" on your batch report</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Refunds (if any)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={salesForm.refunds}
                        onChange={(e) => setSalesForm({ ...salesForm, refunds: e.target.value })}
                        className="w-full pl-7 pr-3 py-2 border rounded-lg"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Type Breakdown */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">💳 Card Breakdown (Optional)</h4>
                <p className="text-xs text-gray-500 mb-3">Enter amounts by card type from your batch report</p>
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">VISA</label>
                    <input
                      type="number"
                      step="0.01"
                      value={salesForm.visa_amount}
                      onChange={(e) => setSalesForm({ ...salesForm, visa_amount: e.target.value })}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">MC</label>
                    <input
                      type="number"
                      step="0.01"
                      value={salesForm.mastercard_amount}
                      onChange={(e) => setSalesForm({ ...salesForm, mastercard_amount: e.target.value })}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">AMEX</label>
                    <input
                      type="number"
                      step="0.01"
                      value={salesForm.amex_amount}
                      onChange={(e) => setSalesForm({ ...salesForm, amex_amount: e.target.value })}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Discover</label>
                    <input
                      type="number"
                      step="0.01"
                      value={salesForm.discover_amount}
                      onChange={(e) => setSalesForm({ ...salesForm, discover_amount: e.target.value })}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Other</label>
                    <input
                      type="number"
                      step="0.01"
                      value={salesForm.other_card_amount}
                      onChange={(e) => setSalesForm({ ...salesForm, other_card_amount: e.target.value })}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Check, Cash & Zelle/ACH Payments */}
              <div className="bg-yellow-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">📝 Other Payment Methods</h4>
                <p className="text-xs text-gray-500 mb-3">All income must be reported - enter check, cash, and Zelle/ACH payments received today</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Check Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={salesForm.check_amount}
                        onChange={(e) => setSalesForm({ ...salesForm, check_amount: e.target.value })}
                        className="w-full pl-7 pr-3 py-2 border rounded-lg"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1"># of Checks</label>
                    <input
                      type="number"
                      value={salesForm.check_count}
                      onChange={(e) => setSalesForm({ ...salesForm, check_count: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cash Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={salesForm.cash_amount}
                        onChange={(e) => setSalesForm({ ...salesForm, cash_amount: e.target.value })}
                        className="w-full pl-7 pr-3 py-2 border rounded-lg"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zelle/ACH Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={salesForm.zelle_ach_amount}
                        onChange={(e) => setSalesForm({ ...salesForm, zelle_ach_amount: e.target.value })}
                        className="w-full pl-7 pr-3 py-2 border rounded-lg"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
                  ⚠️ <strong>Tax Compliance:</strong> All income (cards, checks, cash, Zelle/ACH) is taxable and must be reported to the IRS and TX Comptroller. Your total daily income = Card Batch + Checks + Cash + Zelle/ACH.
                </div>
              </div>

              {/* Tax Information */}
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">🏛️ Sales Tax (for TX Comptroller)</h4>
                <p className="text-xs text-gray-500 mb-3">Calculate taxable amount from your invoices (labor + parts = taxable in TX)</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Taxable Sales</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={salesForm.taxable_sales}
                        onChange={(e) => {
                          const taxable = parseFloat(e.target.value) || 0;
                          const taxRate = 0.0825; // Houston TX rate
                          const estimatedTax = (taxable * taxRate).toFixed(2);
                          setSalesForm({ 
                            ...salesForm, 
                            taxable_sales: e.target.value,
                            sales_tax_collected: estimatedTax
                          });
                        }}
                        className="w-full pl-7 pr-3 py-2 border rounded-lg"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Non-Taxable</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={salesForm.non_taxable_sales}
                        onChange={(e) => setSalesForm({ ...salesForm, non_taxable_sales: e.target.value })}
                        className="w-full pl-7 pr-3 py-2 border rounded-lg"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Collected (8.25%)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={salesForm.sales_tax_collected}
                        onChange={(e) => setSalesForm({ ...salesForm, sales_tax_collected: e.target.value })}
                        className="w-full pl-7 pr-3 py-2 border rounded-lg bg-green-100"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={salesForm.notes}
                  onChange={(e) => setSalesForm({ ...salesForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="Any notes about today's batch..."
                />
              </div>
            </div>
            
            {/* Fixed Footer */}
            <div className="flex gap-3 p-4 sm:p-6 pt-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 rounded-b-lg">
              <button
                onClick={handleSaveSales}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                {editingSalesId ? '✓ Update Entry' : '✓ Save Batch Report'}
              </button>
              {!editingSalesId && (
                <button
                  onClick={handleNoSales}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                  title="Record that there were no sales today"
                >
                  🚫 No Sales
                </button>
              )}
              <button
                onClick={() => { setShowSalesModal(false); setEditingSalesId(null); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Instance Card Component
const InstanceCard = ({ instance, onMarkPaid, onMarkFiled, formatDate, formatCurrency, getDaysUntil }) => {
  const daysUntil = getDaysUntil(instance.due_date);
  const isOverdue = daysUntil < 0;
  const needsFiling = ['form_941', 'form_940', 'twc_report'].includes(instance.obligation_type);
  
  return (
    <div className={`border rounded-lg p-4 ${
      isOverdue ? 'bg-red-50 border-red-200' :
      daysUntil <= 7 ? 'bg-yellow-50 border-yellow-200' :
      'bg-white border-gray-200'
    }`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h4 className="font-semibold text-gray-800">{instance.obligation_name}</h4>
          <p className="text-sm text-gray-600">
            Period: {instance.period_label} • Due: {formatDate(instance.due_date)}
            {isOverdue ? (
              <span className="ml-2 text-red-600 font-semibold">({Math.abs(daysUntil)} days overdue)</span>
            ) : (
              <span className="ml-2 text-gray-500">({daysUntil} days)</span>
            )}
          </p>
          {instance.amount_due_estimate && (
            <p className="text-sm text-amber-600 font-medium">Estimated: {formatCurrency(instance.amount_due_estimate)}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onMarkPaid}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
          >
            💳 Mark Paid
          </button>
          {needsFiling && (
            <button
              onClick={onMarkFiled}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              📄 Mark Filed
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplianceCenter;
