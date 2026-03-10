import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const ProfitAndLoss = () => {
  const [loading, setLoading] = useState(true);
  const [pnlData, setPnlData] = useState(null);
  const [weekEndingDate, setWeekEndingDate] = useState(() => {
    // Default to most recent Friday (business week ends Friday)
    const today = new Date();
    const day = today.getDay(); // 0 = Sunday, 5 = Friday
    let friday;
    if (day === 5) {
      friday = new Date(today);
    } else if (day < 5) {
      // If before Friday, go to this week's Friday
      const daysToFriday = 5 - day;
      friday = new Date(today);
      friday.setDate(today.getDate() + daysToFriday);
    } else {
      // If Saturday or Sunday, go to last Friday
      const daysToLastFriday = day - 5;
      friday = new Date(today);
      friday.setDate(today.getDate() - daysToLastFriday);
    }
    return friday.toISOString().split('T')[0];
  });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    expense_name: '',
    category: 'other',
    amount: '',
    frequency: 'one_time',
    expense_date: '',
    week_ending_date: weekEndingDate,
    month_year: '',
    is_recurring: false,
    notes: ''
  });
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [editingPayrollPerson, setEditingPayrollPerson] = useState(null);
  const [payrollForm, setPayrollForm] = useState({ full_name: '', weekly_salary: '', hourly_rate: '', notes: '', split_reimbursable_amount: '', split_reimbursable_notes: '', split_reimbursable_period: 'weekly' });
  const [payrollSaving, setPayrollSaving] = useState(false);
  const [reimbursements, setReimbursements] = useState({ sources: [], payments: [], total_received_by_source: {} });
  const [showReimbModal, setShowReimbModal] = useState(false);
  const [reimbForm, setReimbForm] = useState({ source_type: '', source_id: '', received_date: new Date().toISOString().split('T')[0], amount: '', notes: '' });
  const [reimbSaving, setReimbSaving] = useState(false);

  useEffect(() => {
    loadPnlData();
    loadRecurringExpenses();
  }, [weekEndingDate]);

  useEffect(() => {
    loadReimbursements();
  }, []);

  const loadPnlData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/compliance/pnl/weekly?week_ending_date=${weekEndingDate}`);
      setPnlData(response.data);
    } catch (error) {
      console.error('Error loading P&L data:', error);
      alert('Error loading P&L data: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadRecurringExpenses = async () => {
    try {
      const response = await api.get('/compliance/expenses/recurring');
      setRecurringExpenses(response.data.expenses || []);
    } catch (error) {
      console.error('Error loading recurring expenses:', error);
    }
  };

  const loadReimbursements = async () => {
    try {
      const res = await api.get('/finance/reimbursements');
      setReimbursements({ sources: res.data.sources || [], payments: res.data.payments || [], total_received_by_source: res.data.total_received_by_source || {} });
    } catch (err) {
      console.error('Error loading reimbursements:', err);
    }
  };

  const handleWeekChange = (date) => {
    // Ensure it's a Friday - find the Friday of the week containing this date (business week ends Friday)
    const selectedDate = new Date(date);
    const day = selectedDate.getDay(); // 0 = Sunday, 5 = Friday
    if (day === 5) {
      // Already Friday
      setWeekEndingDate(selectedDate.toISOString().split('T')[0]);
    } else if (day < 5) {
      // Before Friday, go to this week's Friday
      const daysToFriday = 5 - day;
      selectedDate.setDate(selectedDate.getDate() + daysToFriday);
      setWeekEndingDate(selectedDate.toISOString().split('T')[0]);
    } else {
      // Saturday or Sunday, go to last Friday
      const daysToLastFriday = day - 5;
      selectedDate.setDate(selectedDate.getDate() - daysToLastFriday);
      setWeekEndingDate(selectedDate.toISOString().split('T')[0]);
    }
  };

  const handleAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      expense_name: '',
      category: 'other',
      amount: '',
      frequency: 'one_time',
      expense_date: weekEndingDate,
      week_ending_date: weekEndingDate,
      month_year: weekEndingDate.substring(0, 7),
      is_recurring: false,
      notes: ''
    });
    setShowExpenseModal(true);
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      expense_name: expense.expense_name,
      category: expense.category,
      amount: expense.amount,
      frequency: expense.frequency,
      expense_date: expense.expense_date || '',
      week_ending_date: expense.week_ending_date || weekEndingDate,
      month_year: expense.month_year || '',
      is_recurring: expense.is_recurring === 1,
      notes: expense.notes || ''
    });
    setShowExpenseModal(true);
  };

  const handleSaveExpense = async () => {
    try {
      if (editingExpense) {
        await api.put(`/compliance/expenses/${editingExpense.id}`, expenseForm);
      } else {
        await api.post('/compliance/expenses', expenseForm);
      }
      setShowExpenseModal(false);
      loadPnlData();
      loadRecurringExpenses();
    } catch (error) {
      alert('Error saving expense: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) {
      return;
    }
    try {
      await api.delete(`/compliance/expenses/${id}`);
      loadPnlData();
    } catch (error) {
      alert('Error deleting expense: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAddPayrollPerson = () => {
    setEditingPayrollPerson(null);
    setPayrollForm({ full_name: '', weekly_salary: '', hourly_rate: '', notes: '', split_reimbursable_amount: '', split_reimbursable_notes: '', split_reimbursable_period: 'weekly' });
    setShowPayrollModal(true);
  };

  const handleEditPayrollPerson = (emp) => {
    if (!emp.payroll_people_id) return;
    setEditingPayrollPerson(emp);
    setPayrollForm({
      full_name: emp.employee_name || '',
      weekly_salary: emp.weekly_salary > 0 ? String(emp.weekly_salary) : '',
      hourly_rate: emp.hourly_rate > 0 ? String(emp.hourly_rate) : '',
      notes: '',
      split_reimbursable_amount: emp.split_reimbursable_amount > 0 ? String(emp.split_reimbursable_amount) : '',
      split_reimbursable_notes: emp.split_reimbursable_notes || '',
      split_reimbursable_period: emp.split_reimbursable_period || 'weekly'
    });
    setShowPayrollModal(true);
  };

  const handleSavePayrollPerson = async () => {
    const name = (payrollForm.full_name || '').trim();
    const weekly = parseFloat(payrollForm.weekly_salary) || 0;
    const hourly = parseFloat(payrollForm.hourly_rate) || 0;
    if (!name) {
      alert('Please enter a name.');
      return;
    }
    if (weekly <= 0 && hourly <= 0) {
      alert('Please enter a weekly salary or hourly rate.');
      return;
    }
    const splitAmt = parseFloat(payrollForm.split_reimbursable_amount) || 0;
    const splitNotes = (payrollForm.split_reimbursable_notes || '').trim() || undefined;
    const splitPeriod = payrollForm.split_reimbursable_period === 'monthly' ? 'monthly' : 'weekly';
    setPayrollSaving(true);
    try {
      if (editingPayrollPerson?.payroll_people_id) {
        await api.put(`/finance/payroll-people/${editingPayrollPerson.payroll_people_id}`, {
          full_name: name,
          weekly_salary: weekly,
          hourly_rate: hourly,
          notes: (payrollForm.notes || '').trim() || undefined,
          split_reimbursable_amount: splitAmt,
          split_reimbursable_notes: splitNotes,
          split_reimbursable_period: splitPeriod
        });
      } else {
        await api.post('/finance/payroll-people', {
          full_name: name,
          weekly_salary: weekly,
          hourly_rate: hourly,
          notes: (payrollForm.notes || '').trim() || undefined,
          split_reimbursable_amount: splitAmt,
          split_reimbursable_notes: splitNotes,
          split_reimbursable_period: splitPeriod
        });
      }
      setShowPayrollModal(false);
      loadPnlData();
      loadReimbursements();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save payroll person');
    } finally {
      setPayrollSaving(false);
    }
  };

  const handleRemovePayrollPerson = async (emp) => {
    if (!emp.payroll_people_id) return;
    if (!window.confirm(`Remove ${emp.employee_name} from payroll? They will no longer appear in weekly cost.`)) return;
    try {
      await api.delete(`/finance/payroll-people/${emp.payroll_people_id}`);
      loadPnlData();
      loadReimbursements();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to remove');
    }
  };

  const handleRecordReimbursement = () => {
    const first = reimbursements.sources[0];
    setReimbForm({
      source_type: first ? first.source_type : '',
      source_id: first ? String(first.source_id) : '',
      received_date: new Date().toISOString().split('T')[0],
      amount: '',
      notes: ''
    });
    setShowReimbModal(true);
  };

  const handleSaveReimbursement = async () => {
    const amt = parseFloat(reimbForm.amount);
    if (!reimbForm.source_type || !reimbForm.source_id || !reimbForm.received_date || isNaN(amt) || amt <= 0) {
      alert('Select a person, enter date and amount.');
      return;
    }
    setReimbSaving(true);
    try {
      await api.post('/finance/reimbursements', {
        source_type: reimbForm.source_type,
        source_id: parseInt(reimbForm.source_id, 10),
        received_date: reimbForm.received_date,
        amount: amt,
        notes: (reimbForm.notes || '').trim() || undefined
      });
      setShowReimbModal(false);
      loadReimbursements();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to record payment');
    } finally {
      setReimbSaving(false);
    }
  };

  const handleUseRecurring = (expense) => {
    setExpenseForm({
      expense_name: expense.expense_name,
      category: expense.category,
      amount: expense.amount,
      frequency: expense.frequency,
      expense_date: weekEndingDate,
      week_ending_date: weekEndingDate,
      month_year: weekEndingDate.substring(0, 7),
      is_recurring: false, // This will be a one-time use of the recurring template
      notes: expense.notes || ''
    });
    setEditingExpense(null);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getCategoryColor = (category) => {
    const colors = {
      rent: 'bg-red-100 text-red-800',
      utilities: 'bg-blue-100 text-blue-800',
      insurance: 'bg-green-100 text-green-800',
      supplies: 'bg-yellow-100 text-yellow-800',
      other: 'bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-neutral-100'
    };
    return colors[category] || colors.other;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading Profit & Loss data...</div>
      </div>
    );
  }

  if (!pnlData) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-600">
          <p>No P&L data available for this week.</p>
          <p className="text-sm mt-2">Make sure daily sales are entered for this week.</p>
        </div>
      </div>
    );
  }

  const { revenue, payroll, expenses, summary, comparison } = pnlData;

  return (
    <div className="space-y-6">
      {/* Week Selector */}
      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Week Ending (Friday)
            </label>
            <input
              type="date"
              value={weekEndingDate}
              onChange={(e) => handleWeekChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-sm text-gray-600">
            Week: {formatDate(pnlData.week_start)} - {formatDate(weekEndingDate)}
          </div>
        </div>
      </div>

      {/* Summary Card - Large and Prominent */}
      <div className={`bg-white dark:bg-neutral-950 rounded-lg shadow-lg dark:shadow-neutral-950/50 p-6 border-2 dark:border-neutral-700 ${
        summary.is_profitable ? 'border-green-500' : 'border-red-500'
      }`}>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Weekly Profit & Loss Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(summary.total_revenue)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Total Expenses</div>
              <div className="text-3xl font-bold text-red-600">
                {formatCurrency(summary.total_expenses)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Payroll: {formatCurrency(summary.payroll_cost)} | Other: {formatCurrency(summary.other_expenses)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Net Profit/Loss</div>
              <div className={`text-4xl font-bold ${
                summary.is_profitable ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(summary.net_profit_loss)}
              </div>
              <div className={`text-sm mt-1 ${
                summary.is_profitable ? 'text-green-700' : 'text-red-700'
              }`}>
                {summary.profit_margin.toFixed(1)}% margin
              </div>
            </div>
          </div>
          
          {comparison && comparison.previous_week_net !== null && (
            <div className={`text-sm p-3 rounded-lg ${
              comparison.change_amount >= 0 
                ? 'bg-green-50 text-green-800' 
                : 'bg-red-50 text-red-800'
            }`}>
              {comparison.change_amount >= 0 ? '↑' : '↓'} 
              {' '}{formatCurrency(Math.abs(comparison.change_amount))} 
              {' '}({comparison.change_percentage.toFixed(1)}%) 
              {' '}from previous week
            </div>
          )}
        </div>
      </div>

      {/* Revenue Section */}
      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Revenue</h3>
        <div className="mb-4">
          <div className="text-3xl font-bold text-green-600">
            {formatCurrency(revenue.total)}
          </div>
          <div className="text-sm text-gray-600">Total weekly sales</div>
        </div>
        
        {revenue.missing_days && revenue.missing_days.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800">
              ⚠️ Missing sales data for: {revenue.missing_days.map(d => formatDate(d)).join(', ')}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          {revenue.daily.map((day, idx) => (
            <div key={idx} className="text-center p-2 bg-gray-50 dark:bg-neutral-950 rounded">
              <div className="text-xs text-gray-600">{formatDate(day.date)}</div>
              <div className="text-sm font-semibold text-gray-800">
                {formatCurrency(day.revenue)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payroll Section */}
      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-neutral-100 mb-1">Payroll</h3>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(payroll.total)}
            </div>
            <div className="text-sm text-gray-600 dark:text-neutral-400">Total weekly payroll cost</div>
          </div>
          <button
            type="button"
            onClick={handleAddPayrollPerson}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700 text-sm font-medium"
          >
            + Add to payroll
          </button>
        </div>

        <div className="space-y-2">
          {payroll.employees.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-neutral-400">No payroll data for this week. Add employees in Admin → Users (salary/hourly rate) or use “Add to payroll” for contractors.</p>
          ) : (
            payroll.employees.map((emp, idx) => (
              <div key={emp.payroll_people_id || emp.employee_id || idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-neutral-900 rounded border border-gray-200 dark:border-neutral-700">
                <div>
                  <div className="font-medium text-gray-800 dark:text-neutral-100">{emp.employee_name}</div>
                  <div className="text-xs text-gray-600 dark:text-neutral-400">
                    {emp.weekly_salary > 0
                      ? `Salary: ${formatCurrency(emp.weekly_salary)}`
                      : `${emp.hours_worked?.toFixed(1) || 0} hrs × ${formatCurrency(emp.hourly_rate)}`
                    }
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-800 dark:text-neutral-100">
                    {formatCurrency(emp.cost)}
                  </span>
                  {emp.payroll_people_id && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEditPayrollPerson(emp)}
                        className="text-xs px-2 py-1 text-amber-600 dark:text-amber-400 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePayrollPerson(emp)}
                        className="text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:underline"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reimbursements (split salary – when other business pays you back) */}
      {(reimbursements.sources?.length > 0 || reimbursements.payments?.length > 0) && (
        <div className="bg-white dark:bg-neutral-950 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-neutral-100">Reimbursements (split salary)</h3>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mt-0.5">Track when the other business pays you back for their share of payroll.</p>
            </div>
            {reimbursements.sources?.length > 0 && (
              <button
                type="button"
                onClick={handleRecordReimbursement}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-sm font-medium"
              >
                Record payment received
              </button>
            )}
          </div>
          {reimbursements.sources?.length > 0 && (
            <div className="space-y-3 mb-4">
              {reimbursements.sources.map((src) => {
                const key = `${src.source_type}:${src.source_id}`;
                const totalReceived = reimbursements.total_received_by_source[key] || 0;
                const isMonthly = src.expected_period === 'monthly';
                const expectedLabel = isMonthly ? `Expected per month: ${formatCurrency(src.expected_amount)}` : `Expected per week: ${formatCurrency(src.expected_amount)}`;
                return (
                  <div key={key} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-700">
                    <div>
                      <span className="font-medium text-gray-800 dark:text-neutral-100">{src.name}</span>
                      {src.notes && <span className="text-xs text-gray-500 dark:text-neutral-400 ml-2">({src.notes})</span>}
                      <div className="text-xs text-gray-600 dark:text-neutral-400 mt-0.5">{expectedLabel}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Total received: {formatCurrency(totalReceived)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {reimbursements.payments?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">Payment history</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-neutral-700">
                      <th className="text-left py-2 text-gray-600 dark:text-neutral-400">Date</th>
                      <th className="text-left py-2 text-gray-600 dark:text-neutral-400">Amount</th>
                      <th className="text-left py-2 text-gray-600 dark:text-neutral-400">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reimbursements.payments.slice(0, 20).map((p) => (
                      <tr key={p.id} className="border-b border-gray-100 dark:border-neutral-800">
                        <td className="py-2 text-gray-800 dark:text-neutral-100">{formatDate(p.received_date)}</td>
                        <td className="py-2 font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(p.amount)}</td>
                        <td className="py-2 text-gray-600 dark:text-neutral-400">{p.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monthly Expenses Section */}
      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Monthly Expenses</h3>
            <p className="text-sm text-gray-600 mt-1">
              These expenses are automatically prorated across all weeks in the month
            </p>
          </div>
          <button
            onClick={() => {
              setEditingExpense(null);
              setExpenseForm({
                expense_name: '',
                category: 'other',
                amount: '',
                frequency: 'monthly',
                expense_date: '',
                week_ending_date: weekEndingDate,
                month_year: weekEndingDate.substring(0, 7),
                is_recurring: true,
                notes: ''
              });
              setShowExpenseModal(true);
            }}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            + Add Monthly Expense
          </button>
        </div>

        {/* Show monthly expenses for current month */}
        {(() => {
          const currentMonth = weekEndingDate.substring(0, 7); // YYYY-MM
          const monthlyExpenses = expenses.items.filter(e => e.frequency === 'monthly' && e.month_year === currentMonth);
          const monthlyTotal = monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
          
          return (
            <div className="space-y-3">
              {monthlyExpenses.length === 0 ? (
                <p className="text-sm text-gray-500">No monthly expenses for {new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              ) : (
                <>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm text-red-700 font-medium">Monthly Total</div>
                        <div className="text-2xl font-bold text-red-800">
                          {formatCurrency(monthlyTotal)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-red-700 font-medium">Prorated Weekly</div>
                        <div className="text-xl font-bold text-red-800">
                          {formatCurrency(monthlyTotal / 4.33)}
                        </div>
                        <div className="text-xs text-red-600 mt-1">(÷ 4.33 weeks)</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {monthlyExpenses.map((expense, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-neutral-950 rounded border border-gray-200 dark:border-neutral-700">
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">{expense.expense_name}</div>
                          <div className="text-xs text-gray-600 flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded ${getCategoryColor(expense.category)}`}>
                              {expense.category}
                            </span>
                            <span>{formatCurrency(expense.amount)}/month</span>
                            <span className="text-red-600">→ {formatCurrency(expense.prorated_amount || expense.amount / 4.33)}/week</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditExpense(expense)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* Weekly Expenses Section */}
      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">Weekly & One-Time Expenses</h3>
          <button
            onClick={handleAddExpense}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            + Add Expense
          </button>
        </div>

        <div className="mb-4">
          <div className="text-3xl font-bold text-red-600">
            {formatCurrency(expenses.items.filter(e => e.frequency !== 'monthly').reduce((sum, e) => sum + (e.amount || 0), 0))}
          </div>
          <div className="text-sm text-gray-600">Weekly & one-time expenses (excluding monthly)</div>
        </div>

        {/* Expenses by Category (excluding monthly) */}
        {(() => {
          const weeklyExpenses = expenses.items.filter(e => e.frequency !== 'monthly');
          const byCategory = {};
          weeklyExpenses.forEach(expense => {
            if (!byCategory[expense.category]) {
              byCategory[expense.category] = [];
            }
            byCategory[expense.category].push(expense);
          });

          if (Object.keys(byCategory).length === 0) {
            return <p className="text-sm text-gray-500">No weekly or one-time expenses recorded for this week</p>;
          }

          return (
            <div className="space-y-4">
              {Object.entries(byCategory).map(([category, items]) => (
                <div key={category} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-gray-800 capitalize">{category}</h4>
                    <span className="text-lg font-bold text-gray-800">
                      {formatCurrency(items.reduce((sum, item) => sum + (item.amount || 0), 0))}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {items.map((expense, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <span>{expense.expense_name}</span>
                          {expense.is_recurring === 1 && expense.frequency === 'weekly' && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                              Weekly Recurring
                            </span>
                          )}
                          {expense.frequency === 'one_time' && (
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-neutral-100 text-xs rounded">
                              One-Time
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(expense.amount)}</span>
                          <button
                            onClick={() => handleEditExpense(expense)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-xl dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">
                  {editingExpense ? 'Edit Expense' : 'Add Expense'}
                </h3>
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expense Name *
                  </label>
                  <input
                    type="text"
                    value={expenseForm.expense_name}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expense_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="rent">Rent</option>
                      <option value="utilities">Utilities</option>
                      <option value="insurance">Insurance</option>
                      <option value="supplies">Supplies</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frequency *
                  </label>
                  <select
                    value={expenseForm.frequency}
                    onChange={(e) => setExpenseForm({ ...expenseForm, frequency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="one_time">One-Time</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {expenseForm.frequency === 'one_time' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expense Date *
                    </label>
                    <input
                      type="date"
                      value={expenseForm.expense_date}
                      onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                )}

                {expenseForm.frequency === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Week Ending (Friday) *
                    </label>
                    <input
                      type="date"
                      value={expenseForm.week_ending_date}
                      onChange={(e) => setExpenseForm({ ...expenseForm, week_ending_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                )}

                {expenseForm.frequency === 'monthly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Month (YYYY-MM) *
                    </label>
                    <input
                      type="month"
                      value={expenseForm.month_year}
                      onChange={(e) => setExpenseForm({ ...expenseForm, month_year: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={expenseForm.is_recurring}
                      onChange={(e) => setExpenseForm({ ...expenseForm, is_recurring: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Save as recurring template
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>

                {/* Recurring Expenses Quick Add */}
                {recurringExpenses.length > 0 && !editingExpense && (
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Use Saved Recurring Expense:
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {recurringExpenses.map((exp) => (
                        <button
                          key={exp.id}
                          onClick={() => handleUseRecurring(exp)}
                          className="w-full text-left p-2 bg-gray-50 dark:bg-neutral-950 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-neutral-100"
                        >
                          <div className="font-medium text-sm">{exp.expense_name}</div>
                          <div className="text-xs text-gray-600">
                            {exp.category} • {formatCurrency(exp.amount)} • {exp.frequency}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => setShowExpenseModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveExpense}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingExpense ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record reimbursement modal */}
      {showReimbModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl dark:border dark:border-neutral-700 max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-neutral-100">Record payment received</h3>
                <button type="button" onClick={() => setShowReimbModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-neutral-200" aria-label="Close">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mb-4">When the other business pays you back for their share of an employee&apos;s salary, record it here.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Person (split salary)</label>
                  <select
                    value={reimbForm.source_type && reimbForm.source_id ? `${reimbForm.source_type}:${reimbForm.source_id}` : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) {
                        const [st, sid] = v.split(':');
                        setReimbForm({ ...reimbForm, source_type: st, source_id: sid });
                      }
                    }}
                    className="w-full h-12 px-3 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                  >
                    <option value="">Select...</option>
                    {reimbursements.sources?.map((src) => (
                      <option key={`${src.source_type}:${src.source_id}`} value={`${src.source_type}:${src.source_id}`}>
                        {src.name} ({formatCurrency(src.expected_amount)}/{src.expected_period === 'monthly' ? 'mo' : 'wk'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Date received *</label>
                  <input
                    type="date"
                    value={reimbForm.received_date}
                    onChange={(e) => setReimbForm({ ...reimbForm, received_date: e.target.value })}
                    className="w-full h-12 px-3 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Amount ($) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={reimbForm.amount}
                    onChange={(e) => setReimbForm({ ...reimbForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full h-12 px-3 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={reimbForm.notes}
                    onChange={(e) => setReimbForm({ ...reimbForm, notes: e.target.value })}
                    placeholder="e.g. March 1–7"
                    className="w-full h-12 px-3 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowReimbModal(false)} className="px-4 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200">Cancel</button>
                  <button type="button" onClick={handleSaveReimbursement} disabled={reimbSaving} className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">{reimbSaving ? 'Saving…' : 'Record'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payroll person modal (Add to payroll) */}
      {showPayrollModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl dark:border dark:border-neutral-700 max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-neutral-100">
                  {editingPayrollPerson ? 'Edit payroll person' : 'Add to payroll'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPayrollModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mb-4">
                Add someone who gets paid weekly (e.g. contractor). For employees who use the app, set salary in Admin → Users.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Name *</label>
                  <input
                    type="text"
                    value={payrollForm.full_name}
                    onChange={(e) => setPayrollForm({ ...payrollForm, full_name: e.target.value })}
                    placeholder="Full name"
                    className="w-full h-12 px-3 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Weekly salary ($) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payrollForm.weekly_salary}
                    onChange={(e) => setPayrollForm({ ...payrollForm, weekly_salary: e.target.value })}
                    placeholder="e.g. 850"
                    className="w-full h-12 px-3 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Hourly rate ($) — optional</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payrollForm.hourly_rate}
                    onChange={(e) => setPayrollForm({ ...payrollForm, hourly_rate: e.target.value })}
                    placeholder="If no weekly salary"
                    className="w-full h-12 px-3 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={payrollForm.notes}
                    onChange={(e) => setPayrollForm({ ...payrollForm, notes: e.target.value })}
                    placeholder="e.g. Contractor"
                    className="w-full h-12 px-3 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500"
                  />
                </div>
                <div className="border-t border-gray-200 dark:border-neutral-600 pt-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Split with other business (reimbursable)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-neutral-400 mb-1">Amount reimbursed ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payrollForm.split_reimbursable_amount}
                        onChange={(e) => setPayrollForm({ ...payrollForm, split_reimbursable_amount: e.target.value })}
                        placeholder="0"
                        className="w-full h-12 px-3 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-neutral-400 mb-1">Per week or per month</label>
                      <select
                        value={payrollForm.split_reimbursable_period}
                        onChange={(e) => setPayrollForm({ ...payrollForm, split_reimbursable_period: e.target.value })}
                        className="w-full h-12 px-3 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-gray-600 dark:text-neutral-400 mb-1">Reimbursed by</label>
                      <input
                        type="text"
                        value={payrollForm.split_reimbursable_notes}
                        onChange={(e) => setPayrollForm({ ...payrollForm, split_reimbursable_notes: e.target.value })}
                        placeholder="Other business name"
                        className="w-full h-12 px-3 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPayrollModal(false)}
                    className="px-4 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePayrollPerson}
                    disabled={payrollSaving}
                    className="px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    {payrollSaving ? 'Saving…' : (editingPayrollPerson ? 'Update' : 'Add')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitAndLoss;
