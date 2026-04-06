import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { BASE_PATH } from '../utils/basePath';

const toOriginSafe = () => {
  try {
    return window.location.origin;
  } catch {
    return '';
  }
};

const fullAffiliateUrl = (token) => {
  const origin = toOriginSafe();
  const base = BASE_PATH || '';
  return `${origin}${base}/affiliates/${token}`;
};

export default function AffiliatesAdmin() {
  const [employees, setEmployees] = useState([]);
  const [links, setLinks] = useState([]);

  const [assignedUserId, setAssignedUserId] = useState('');
  const [label, setLabel] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [createLoading, setCreateLoading] = useState(false);
  const [createResultUrl, setCreateResultUrl] = useState('');

  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, linksRes] = await Promise.all([
        api.get('/users').catch(() => ({ data: { users: [] } })),
        api.get('/affiliates/links').catch(() => ({ data: { links: [] } })),
      ]);

      const users = usersRes.data?.users || [];
      const emps = users.filter((u) => u.role === 'employee' && u.is_active !== 0);
      setEmployees(emps);

      setLinks(linksRes.data?.links || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load affiliate data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const createLink = async () => {
    setCreateLoading(true);
    setCreateResultUrl('');
    setError('');
    try {
      const payload = {
        label: label.trim() || null,
        assigned_user_id: assignedUserId ? Number(assignedUserId) : null,
      };
      const res = await api.post('/affiliates/links', payload);
      const fullUrl = res.data?.full_url || fullAffiliateUrl(res.data?.link?.token);
      setCreateResultUrl(fullUrl);
      setLabel('');
      setAssignedUserId('');
      await loadAll();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to create affiliate link');
    } finally {
      setCreateLoading(false);
    }
  };

  const reconcile = async () => {
    setReconcileLoading(true);
    setReconcileMsg('');
    try {
      const res = await api.post('/affiliates/admin/reconcile');
      const count = res.data?.updated_count ?? 0;
      setReconcileMsg(`Reconciled commissions. Updated ${count} submission(s) with paid invoices.`);
      await loadAll();
    } catch (e) {
      setReconcileMsg(e.response?.data?.error || e.message || 'Reconcile failed');
    } finally {
      setReconcileLoading(false);
    }
  };

  return (
    <PageShell className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-neutral-100">Affiliate Link Builder</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Create employee-specific quote links, track submissions, and reconcile commissions when the first invoice is paid.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            type="button"
            variant="secondary"
            onClick={reconcile}
            disabled={reconcileLoading}
            className="h-12 px-4 rounded-2xl"
          >
            {reconcileLoading ? 'Reconciling…' : 'Reconcile commissions'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {reconcileMsg && (
        <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 text-sm text-gray-700 dark:text-neutral-200">
          {reconcileMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card noPadding className="p-4">
          <h2 className="text-xs font-semibold text-gray-600 dark:text-neutral-300 uppercase tracking-wider">
            Create link
          </h2>

          <div className="mt-3 space-y-3">
            <Input
              label="Label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. John referral link"
            />

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Assign to employee
              </label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100"
              >
                <option value="">Unassigned</option>
                {employees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.username}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-1">
              <Button
                type="button"
                onClick={createLink}
                disabled={createLoading || employees.length === 0}
                className="w-full h-12 rounded-2xl"
              >
                {createLoading ? 'Creating…' : 'Create affiliate link'}
              </Button>
            </div>

            {createResultUrl && (
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 p-3">
                <div className="text-xs font-semibold text-gray-600 dark:text-neutral-300 uppercase tracking-wider">
                  New link
                </div>
                <div className="mt-2 flex flex-col sm:flex-row gap-2 sm:items-center">
                  <input
                    type="text"
                    readOnly
                    value={createResultUrl}
                    onFocus={(e) => e.target.select()}
                    className="w-full sm:flex-1 h-11 px-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-neutral-100"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard?.writeText(createResultUrl).catch(() => {});
                    }}
                    className="h-11 rounded-xl px-4"
                  >
                    Copy
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card noPadding className="p-4">
          <h2 className="text-xs font-semibold text-gray-600 dark:text-neutral-300 uppercase tracking-wider">
            Affiliate links
          </h2>

          {loading ? (
            <p className="mt-3 text-sm text-gray-500 dark:text-neutral-400">Loading…</p>
          ) : links.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500 dark:text-neutral-400">No affiliate links created yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                    <th className="py-3 px-2">Employee</th>
                    <th className="py-3 px-2">Submissions</th>
                    <th className="py-3 px-2">Paid</th>
                    <th className="py-3 px-2">Latest</th>
                    <th className="py-3 px-2 text-right">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {links.map((l) => {
                    const url = l.full_url || fullAffiliateUrl(l.token);
                    return (
                      <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900/50">
                        <td className="py-3 px-2">
                          <div className="min-w-[180px]">
                            <p className="font-semibold text-gray-900 dark:text-neutral-100">
                              {l.assigned_user_name || 'Unassigned'}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-neutral-400 truncate">{l.label || ''}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2">{l.submission_count ?? 0}</td>
                        <td className="py-3 px-2">{l.paid_submission_count ?? 0}</td>
                        <td className="py-3 px-2 text-gray-500 dark:text-neutral-400">
                          {l.latest_submission_at ? new Date(l.latest_submission_at).toLocaleString() : '—'}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => navigator.clipboard?.writeText(url).catch(() => {})}
                            className="h-11 rounded-xl px-3"
                          >
                            Copy
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

