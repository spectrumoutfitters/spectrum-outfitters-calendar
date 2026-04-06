import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

const GOLD = '#D4A017';

const fmt$ = (v) => {
  const n = Number(v) || 0;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

function emptyForm() {
  return {
    payee_type: 'employee', // 'employee' | 'external'
    user_id: '',
    external_party_name: '',
    external_party_company: '',
    item_description: '',
    total_amount: '',
    balance_due: '',
    weekly_payment: '',
    deduct_from_payroll: false,
    deduction_reason: '',
    notes: '',
    start_date: '',
    status: 'active',
  };
}

export default function EmployeeShopFinancing() {
  const [plans, setPlans] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('active');

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [deductForm, setDeductForm] = useState({ week_ending_date: '', amount: '', extra_note: '' });
  const [saving, setSaving] = useState(false);

  const [weekEnding, setWeekEnding] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const add = (5 - day + 7) % 7;
    const fri = new Date(d);
    fri.setDate(d.getDate() + add);
    const y = fri.getFullYear();
    const m = String(fri.getMonth() + 1).padStart(2, '0');
    const dd = String(fri.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  });
  const [weekSummary, setWeekSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    const errs = [];
    try {
      const uRes = await api.get('/users');
      setUsers((uRes.data.users || []).filter((u) => u.is_active === 1 || u.is_active === true));
    } catch (e) {
      setUsers([]);
      errs.push(
        e.response?.data?.error ||
          e.response?.data?.message ||
          e.message ||
          'Failed to load users'
      );
    }
    try {
      const pRes = await api.get('/admin/shop-financing', {
        params: filter !== 'all' ? { status: filter } : {},
      });
      setPlans(pRes.data.plans || []);
    } catch (e) {
      setPlans([]);
      errs.push(
        e.response?.data?.error ||
          e.response?.data?.message ||
          e.message ||
          'Failed to load financing plans'
      );
    }
    if (errs.length) setError(errs.join(' · '));
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const loadWeekSummary = useCallback(async () => {
    if (!weekEnding) return;
    setSummaryLoading(true);
    try {
      const res = await api.get('/payroll/financing-week-summary', { params: { week_ending: weekEnding } });
      setWeekSummary(res.data);
    } catch (e) {
      setWeekSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [weekEnding]);

  useEffect(() => {
    loadWeekSummary();
  }, [loadWeekSummary]);

  const openAdd = () => {
    setForm(emptyForm());
    setEditingId(null);
    setModal('add');
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    const isEmployee = p.user_id != null && p.user_id !== '';
    setForm({
      payee_type: isEmployee ? 'employee' : 'external',
      user_id: isEmployee ? String(p.user_id) : '',
      external_party_name: p.external_party_name || '',
      external_party_company: p.external_party_company || '',
      item_description: p.item_description || '',
      total_amount: String(p.total_amount ?? ''),
      balance_due: String(p.balance_due ?? ''),
      weekly_payment: String(p.weekly_payment ?? ''),
      deduct_from_payroll: !!p.deduct_from_payroll,
      deduction_reason: p.deduction_reason || '',
      notes: p.notes || '',
      start_date: p.start_date || '',
      status: p.status || 'active',
    });
    setModal('edit');
  };

  const openDeduct = (p) => {
    setEditingId(p.id);
    const suggested = Math.min(Number(p.weekly_payment) || 0, Number(p.balance_due) || 0);
    setDeductForm({
      week_ending_date: weekEnding,
      amount: suggested > 0 ? String(suggested) : '',
      extra_note: '',
    });
    setModal('deduct');
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        item_description: form.item_description.trim(),
        total_amount: parseFloat(form.total_amount),
        balance_due: form.balance_due === '' ? undefined : parseFloat(form.balance_due),
        weekly_payment: parseFloat(form.weekly_payment) || 0,
        deduct_from_payroll: form.deduct_from_payroll,
        deduction_reason: form.deduction_reason.trim(),
        notes: form.notes.trim() || null,
        start_date: form.start_date || null,
        status: form.status,
      };
      if (form.payee_type === 'employee') {
        payload.user_id = parseInt(form.user_id, 10);
        payload.external_party_name = '';
        payload.external_party_company = '';
      } else {
        payload.user_id = null;
        payload.external_party_name = form.external_party_name.trim();
        payload.external_party_company = form.external_party_company.trim() || null;
      }
      if (modal === 'add') {
        await api.post('/admin/shop-financing', payload);
      } else {
        await api.put(`/admin/shop-financing/${editingId}`, payload);
      }
      setModal(null);
      await loadPlans();
      await loadWeekSummary();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const submitDeduct = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        week_ending_date: deductForm.week_ending_date.trim(),
        extra_note: deductForm.extra_note.trim() || undefined,
      };
      if (deductForm.amount !== '') {
        body.amount = parseFloat(deductForm.amount);
      }
      await api.post(`/admin/shop-financing/${editingId}/record-deduction`, body);
      setModal(null);
      await loadPlans();
      await loadWeekSummary();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Could not record deduction');
    } finally {
      setSaving(false);
    }
  };

  const copyPayrollSummary = () => {
    if (!weekSummary) return;
    const lines = [];
    for (const row of weekSummary.pending_payroll_deductions || []) {
      const amt = fmt$(row.suggested_deduction);
      const reason = row.deduction_reason || 'Shop financing';
      lines.push(
        `${row.employee_name} — ${amt} — ${reason} — Item: ${row.item_description} — Week ending ${weekSummary.week_ending}`
      );
    }
    for (const row of weekSummary.recorded_this_week || []) {
      lines.push(
        `[Recorded] ${row.employee_name} — ${fmt$(row.amount)} — ${row.reason_note} — ${row.item_description}`
      );
    }
    const text = lines.length ? lines.join('\n') : 'No payroll deductions for this week.';
    navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard')).catch(() => alert(text));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-md dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
        <Link
          to="/admin"
          className="inline-block text-sm text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:underline mb-3"
        >
          ← Back to Admin
        </Link>
        <h2 className="text-xl font-bold text-gray-800 dark:text-neutral-100 mb-1">Shop employee financing</h2>
        <p className="text-sm text-gray-600 dark:text-neutral-400 mb-4">
          Track shop purchases being paid over time for <strong>your team</strong> or for <strong>someone who is not in
          Spectrum</strong> (e.g. another shop&apos;s employee). When <strong>Deduct from payroll</strong> is on, enter a{' '}
          <strong>deduction reason</strong> for records. Record each payment here so balances stay accurate.
        </p>

        <div className="flex flex-wrap gap-3 items-center mb-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input-base h-10 text-sm"
          >
            <option value="active">Active only</option>
            <option value="paused">Paused</option>
            <option value="paid_off">Paid off</option>
            <option value="all">All statuses</option>
          </select>
          <button
            type="button"
            onClick={openAdd}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: GOLD }}
          >
            + Add financing plan
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 dark:text-neutral-400 py-8 text-center">Loading…</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 dark:border-neutral-700 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-900 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-200">Who&apos;s paying</th>
                  <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-200">Item</th>
                  <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-200">Total</th>
                  <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-200">Balance</th>
                  <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-200">Weekly</th>
                  <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-200">Payroll</th>
                  <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-200">Status</th>
                  <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-200">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500 dark:text-neutral-400">
                      No plans yet. Add one to start tracking.
                    </td>
                  </tr>
                ) : (
                  plans.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100 dark:border-neutral-800">
                      <td className="px-3 py-2 text-gray-800 dark:text-neutral-100">{p.payer_display || p.employee_name}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-neutral-300 max-w-[200px] truncate" title={p.item_description}>
                        {p.item_description}
                      </td>
                      <td className="px-3 py-2">{fmt$(p.total_amount)}</td>
                      <td className="px-3 py-2 font-medium">{fmt$(p.balance_due)}</td>
                      <td className="px-3 py-2">{fmt$(p.weekly_payment)}</td>
                      <td className="px-3 py-2">{p.deduct_from_payroll ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2 capitalize">{p.status}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button type="button" className="text-primary text-xs font-medium mr-2" onClick={() => openEdit(p)}>
                          Edit
                        </button>
                        {p.status === 'active' && Number(p.balance_due) > 0 && (
                          <button
                            type="button"
                            className="text-xs font-medium"
                            style={{ color: GOLD }}
                            onClick={() => openDeduct(p)}
                          >
                            Record payment
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-md dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-neutral-100 mb-2">Pay week helper</h3>
        <p className="text-sm text-gray-600 dark:text-neutral-400 mb-3">
          Pick the <strong>week ending</strong> date (often the Friday your pay period ends). Use the list below when
          entering deductions in your payroll system, then use <strong>Record payment</strong> on each plan so balances
          stay in sync.
        </p>
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <label className="text-sm text-gray-700 dark:text-neutral-200">
            Week ending{' '}
            <input
              type="date"
              value={weekEnding}
              onChange={(e) => setWeekEnding(e.target.value)}
              className="input-base h-10 ml-2"
            />
          </label>
          <button
            type="button"
            onClick={loadWeekSummary}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-neutral-600 dark:text-neutral-100"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={copyPayrollSummary}
            className="px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-neutral-800 dark:text-neutral-100"
          >
            Copy summary for payroll
          </button>
        </div>

        {summaryLoading ? (
          <p className="text-sm text-gray-500">Loading summary…</p>
        ) : weekSummary ? (
          <div className="space-y-4">
            {weekSummary.pending_payroll_deductions?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-neutral-100 mb-2">
                  To enter in payroll (not recorded in app yet)
                </h4>
                <ul className="space-y-2 text-sm">
                  {weekSummary.pending_payroll_deductions.map((row) => (
                    <li
                      key={row.financing_id}
                      className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                    >
                      <span className="font-medium text-gray-900 dark:text-neutral-100">{row.employee_name}</span>
                      <span className="text-gray-600 dark:text-neutral-300"> — suggested </span>
                      <span className="font-semibold">{fmt$(row.suggested_deduction)}</span>
                      <div className="text-gray-700 dark:text-neutral-300 mt-1">
                        <span className="text-gray-500 dark:text-neutral-500">Reason for pay stub: </span>
                        {row.deduction_reason || '—'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-neutral-400 mt-1">Item: {row.item_description}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {weekSummary.recorded_this_week?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-neutral-100 mb-2">
                  Already recorded this week in the app
                </h4>
                <ul className="space-y-2 text-sm">
                  {weekSummary.recorded_this_week.map((row) => (
                    <li
                      key={row.deduction_id}
                      className="p-3 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700"
                    >
                      <span className="font-medium">{row.employee_name}</span> — {fmt$(row.amount)}
                      <div className="text-gray-600 dark:text-neutral-300 mt-1">{row.reason_note}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{row.item_description}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!weekSummary.pending_payroll_deductions?.length && !weekSummary.recorded_this_week?.length && (
              <p className="text-sm text-gray-500 dark:text-neutral-400">Nothing for this week.</p>
            )}
          </div>
        ) : null}
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog">
          <div className="bg-white dark:bg-neutral-950 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 border dark:border-neutral-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-neutral-100 mb-4">
              {modal === 'add' ? 'Add financing plan' : 'Edit financing plan'}
            </h3>
            <form onSubmit={submitForm} className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-neutral-200 mb-2">Who is this for?</p>
                <div className="flex flex-col gap-2 mb-3">
                  <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-neutral-100 cursor-pointer">
                    <input
                      type="radio"
                      name="payee_type"
                      checked={form.payee_type === 'employee'}
                      onChange={() => setForm({ ...form, payee_type: 'employee' })}
                    />
                    Spectrum employee (in payroll / user list)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-neutral-100 cursor-pointer">
                    <input
                      type="radio"
                      name="payee_type"
                      checked={form.payee_type === 'external'}
                      onChange={() => setForm({ ...form, payee_type: 'external' })}
                    />
                    Someone else (other business, not in our system)
                  </label>
                </div>
                {form.payee_type === 'employee' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">Employee</label>
                    <select
                      required
                      value={form.user_id}
                      onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                      className="input-base w-full h-11"
                    >
                      <option value="">Select…</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({u.username})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
                        Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        required
                        value={form.external_party_name}
                        onChange={(e) => setForm({ ...form, external_party_name: e.target.value })}
                        className="input-base w-full h-11"
                        placeholder="Person or business contact"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
                        Company / other business (optional)
                      </label>
                      <input
                        value={form.external_party_company}
                        onChange={(e) => setForm({ ...form, external_party_company: e.target.value })}
                        className="input-base w-full h-11"
                        placeholder="e.g. ABC Auto — their employee buying here"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">Item / description</label>
                <input
                  required
                  value={form.item_description}
                  onChange={(e) => setForm({ ...form, item_description: e.target.value })}
                  className="input-base w-full h-11"
                  placeholder="e.g. Tool set, supplies bundle"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">Total financed</label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.total_amount}
                    onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                    className="input-base w-full h-11"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">Balance due</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.balance_due}
                    onChange={(e) => setForm({ ...form, balance_due: e.target.value })}
                    className="input-base w-full h-11"
                    placeholder="Defaults to total"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">Weekly payment</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.weekly_payment}
                  onChange={(e) => setForm({ ...form, weekly_payment: e.target.value })}
                  className="input-base w-full h-11"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-neutral-100">
                <input
                  type="checkbox"
                  checked={form.deduct_from_payroll}
                  onChange={(e) => setForm({ ...form, deduct_from_payroll: e.target.checked })}
                />
                Deduct from payroll (payroll system)
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
                  Reason on paycheck / deduction note {form.deduct_from_payroll && <span className="text-red-600">*</span>}
                </label>
                <textarea
                  value={form.deduction_reason}
                  onChange={(e) => setForm({ ...form, deduction_reason: e.target.value })}
                  className="input-base w-full min-h-[72px] py-2"
                  placeholder="e.g. Employee purchase — shop supplies, repayment plan"
                  required={form.deduct_from_payroll}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">Internal notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input-base w-full min-h-[56px] py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">Start date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="input-base w-full h-11"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="input-base w-full h-11"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="paid_off">Paid off</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" className="px-4 py-2 text-sm rounded-lg border dark:border-neutral-600" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: GOLD }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'deduct' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog">
          <div className="bg-white dark:bg-neutral-950 rounded-xl shadow-xl max-w-md w-full p-6 border dark:border-neutral-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-neutral-100 mb-2">Record payment / deduction</h3>
            <p className="text-sm text-gray-600 dark:text-neutral-400 mb-4">
              After you run payroll (or they paid cash), record it here. Balance will go down. For payroll weeks, use the
              same week ending date as your pay period.
            </p>
            <form onSubmit={submitDeduct} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Week ending</label>
                <input
                  required
                  type="date"
                  value={deductForm.week_ending_date}
                  onChange={(e) => setDeductForm({ ...deductForm, week_ending_date: e.target.value })}
                  className="input-base w-full h-11"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Amount (leave blank for weekly amount)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={deductForm.amount}
                  onChange={(e) => setDeductForm({ ...deductForm, amount: e.target.value })}
                  className="input-base w-full h-11"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Extra note (optional)</label>
                <input
                  value={deductForm.extra_note}
                  onChange={(e) => setDeductForm({ ...deductForm, extra_note: e.target.value })}
                  className="input-base w-full h-11"
                  placeholder="Appended to deduction reason in history"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" className="px-4 py-2 text-sm rounded-lg border dark:border-neutral-600" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: GOLD }}
                >
                  {saving ? 'Saving…' : 'Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
