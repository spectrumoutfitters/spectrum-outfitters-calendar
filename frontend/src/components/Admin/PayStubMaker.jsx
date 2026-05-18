import React, { useMemo, useState, useCallback } from 'react';
import { format, endOfMonth, subMonths } from 'date-fns';
import { generatePayStubsPdf } from '../../utils/payStubPdf';

const PAY_FREQUENCIES = ['Weekly', 'Bi-weekly', 'Semi-monthly', 'Monthly', 'Other'];

function isoEndOfMonth(d) {
  return format(endOfMonth(d), 'yyyy-MM-dd');
}

function defaultThreePeriodEnds() {
  const today = new Date();
  return [3, 2, 1].map((monthsAgo) => isoEndOfMonth(subMonths(today, monthsAgo)));
}

function emptyMoneyRow(periodEnd) {
  return {
    periodEnd,
    gross: '',
    federal: '',
    socialSecurity: '',
    medicare: '',
    state: '',
    otherLabel: '',
    otherAmount: '',
  };
}

const PayStubMaker = () => {
  const defaults = useMemo(() => defaultThreePeriodEnds(), []);

  const [employerName, setEmployerName] = useState('Spectrum Outfitters');
  const [employerAddress, setEmployerAddress] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [last4Ssn, setLast4Ssn] = useState('');
  const [payFrequency, setPayFrequency] = useState('Bi-weekly');
  const [sameAmountsAllPeriods, setSameAmountsAllPeriods] = useState(true);

  const [shared, setShared] = useState({
    gross: '',
    federal: '',
    socialSecurity: '',
    medicare: '',
    state: '',
    otherLabel: '',
    otherAmount: '',
  });

  const [perPeriod, setPerPeriod] = useState(() =>
    defaults.map((pe) => emptyMoneyRow(pe)),
  );

  const updatePeriod = useCallback((i, patch) => {
    setPerPeriod((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }, []);

  const handleDownload = () => {
    const months =
      sameAmountsAllPeriods && perPeriod.length === 3
        ? perPeriod.map((row) => ({
            periodEnd: row.periodEnd,
            gross: shared.gross,
            federal: shared.federal,
            socialSecurity: shared.socialSecurity,
            medicare: shared.medicare,
            state: shared.state,
            otherLabel: shared.otherLabel,
            otherAmount: shared.otherAmount,
          }))
        : perPeriod.map((row) => ({ ...row }));

    generatePayStubsPdf({
      employerName,
      employerAddress,
      employeeName,
      employeeId,
      last4Ssn,
      payFrequency,
      months,
    });
  };

  const fieldClass =
    'w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-gray-900 dark:text-neutral-100';

  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1';

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-md dark:border dark:border-neutral-700 p-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100 mb-1">
          Pay stub PDF (3 months)
        </h1>
        <p className="text-sm text-gray-600 dark:text-neutral-300 max-w-2xl">
          Enter amounts below. One PDF downloads with{' '}
          <strong className="text-gray-900 dark:text-neutral-100">three pages</strong> — typically the past three month-end
          pay dates (you can edit each date). Intended for informal records only.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-md dark:border dark:border-neutral-700 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-neutral-100">Employer</h2>
          <div>
            <label className={labelClass}>Company name</label>
            <input className={fieldClass} value={employerName} onChange={(e) => setEmployerName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Address (optional)</label>
            <textarea
              rows={3}
              className={fieldClass}
              placeholder="Street, City, ST ZIP"
              value={employerAddress}
              onChange={(e) => setEmployerAddress(e.target.value)}
            />
          </div>

          <h2 className="text-lg font-semibold text-gray-800 dark:text-neutral-100 pt-2">Employee</h2>
          <div>
            <label className={labelClass}>Legal name</label>
            <input
              className={fieldClass}
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="First Last"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Employee ID</label>
              <input className={fieldClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>SSN last 4 (optional)</label>
              <input
                className={fieldClass}
                maxLength={4}
                inputMode="numeric"
                value={last4Ssn}
                onChange={(e) => setLast4Ssn(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Pay frequency</label>
            <select
              className={fieldClass}
              value={payFrequency}
              onChange={(e) => setPayFrequency(e.target.value)}
            >
              {PAY_FREQUENCIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-md dark:border dark:border-neutral-700 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-neutral-100">Amounts</h2>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-neutral-200 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-gray-400 dark:border-neutral-500"
                checked={sameAmountsAllPeriods}
                onChange={(e) => setSameAmountsAllPeriods(e.target.checked)}
              />
              Same dollar amounts each month (only dates differ)
            </label>
          </div>

          {sameAmountsAllPeriods ? (
            <>
              <p className="text-xs text-gray-500 dark:text-neutral-400">
                These figures repeat on all three stubs. Set each pay period end date in the section below.
              </p>
              <MoneyFields
                values={shared}
                onPatch={(p) => setShared((prev) => ({ ...prev, ...p }))}
                fieldClass={fieldClass}
                labelClass={labelClass}
              />
            </>
          ) : (
            <>
              {[0, 1, 2].map((i) => (
                <fieldset
                  key={i}
                  className="border border-gray-200 dark:border-neutral-700 rounded-xl p-4 space-y-3"
                >
                  <legend className="text-sm font-semibold px-2 text-gray-800 dark:text-neutral-100">
                    Period {i + 1}
                  </legend>
                  <div>
                    <label className={labelClass}>Pay period end (month paid)</label>
                    <input
                      type="date"
                      className={fieldClass}
                      value={perPeriod[i]?.periodEnd || ''}
                      onChange={(e) => updatePeriod(i, { periodEnd: e.target.value })}
                    />
                  </div>
                  <MoneyFields
                    values={perPeriod[i]}
                    onPatch={(p) => updatePeriod(i, p)}
                    fieldClass={fieldClass}
                    labelClass={labelClass}
                  />
                </fieldset>
              ))}
            </>
          )}
        </div>
      </div>

      {sameAmountsAllPeriods && (
        <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-md dark:border dark:border-neutral-700 p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-neutral-100 mb-4">Pay period end dates</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <label className={labelClass}>Month {i + 1}</label>
                <input
                  type="date"
                  className={fieldClass}
                  value={perPeriod[i]?.periodEnd || ''}
                  onChange={(e) => updatePeriod(i, { periodEnd: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-semibold text-black shadow-md transition hover:opacity-95"
          style={{ background: 'linear-gradient(135deg, #D4A017, #a67c00)' }}
        >
          Download PDF (3 pages)
        </button>
        <p className="text-xs text-gray-500 dark:text-neutral-400 max-w-md">
          Net pay = gross minus all deductions. Zero deductions are omitted from the PDF lines.
        </p>
      </div>
    </div>
  );
};

function MoneyFields({ values, onPatch, fieldClass, labelClass }) {
  const ch = (key) => (e) => onPatch({ [key]: e.target.value });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelClass}>Gross pay</label>
        <input
          className={fieldClass}
          inputMode="decimal"
          placeholder="0.00"
          value={values.gross}
          onChange={ch('gross')}
        />
      </div>
      <div>
        <label className={labelClass}>Federal income tax</label>
        <input
          className={fieldClass}
          inputMode="decimal"
          placeholder="0.00"
          value={values.federal}
          onChange={ch('federal')}
        />
      </div>
      <div>
        <label className={labelClass}>State income tax</label>
        <input className={fieldClass} inputMode="decimal" placeholder="0.00" value={values.state} onChange={ch('state')} />
      </div>
      <div>
        <label className={labelClass}>Social Security</label>
        <input
          className={fieldClass}
          inputMode="decimal"
          placeholder="0.00"
          value={values.socialSecurity}
          onChange={ch('socialSecurity')}
        />
      </div>
      <div>
        <label className={labelClass}>Medicare</label>
        <input
          className={fieldClass}
          inputMode="decimal"
          placeholder="0.00"
          value={values.medicare}
          onChange={ch('medicare')}
        />
      </div>
      <div>
        <label className={labelClass}>Other deduction label</label>
        <input
          className={fieldClass}
          placeholder="e.g. Health insurance"
          value={values.otherLabel}
          onChange={ch('otherLabel')}
        />
      </div>
      <div>
        <label className={labelClass}>Other deduction amount</label>
        <input
          className={fieldClass}
          inputMode="decimal"
          placeholder="0.00"
          value={values.otherAmount}
          onChange={ch('otherAmount')}
        />
      </div>
    </div>
  );
}

export default PayStubMaker;
