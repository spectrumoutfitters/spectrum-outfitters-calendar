import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { format, endOfMonth, subMonths } from 'date-fns';
import { generatePayStubsPdf } from '../../utils/payStubPdf';
import { computeContractorDeductions, computeW2Deductions } from '../../utils/payrollTaxUS';

const PAY_FREQUENCIES = ['Weekly', 'Bi-weekly', 'Semi-monthly', 'Monthly', 'Other'];
const WORKER_TYPES = [
  { value: 'w2', label: 'W‑2 employee (withholdings)' },
  { value: '1099', label: '1099‑NEC contractor' },
];

const US_STATES = [
  ['TX', 'Texas (no wage income tax)'],
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
  ['DC', 'District of Columbia'],
];

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
    regularHours: '',
    hourlyRate: '',
    federal: '',
    socialSecurity: '',
    medicare: '',
    medicareBase: '',
    medicareAdditional: '',
    state: '',
    otherLabel: '',
    otherAmount: '',
  };
}

function moneyFixed2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '';
  return x.toFixed(2);
}

/**
 * Applies auto withholding per period while advancing Social Security wage base.
 */
function sequentialW2Deductions(rows, payFrequency, filingStatus, workStateCode) {
  let priorSocSec = 0;
  return rows.map((row) => {
    const gross = Math.max(0, Number(row.gross) || 0);
    const calc = computeW2Deductions({
      gross,
      payFrequency,
      filingStatus,
      workStateCode,
      priorYtdSocSecWages: priorSocSec,
    });
    priorSocSec += calc.oasdiWagesNow ?? 0;
    return {
      federal: calc.federal,
      socialSecurity: calc.socialSecurity,
      medicare: calc.medicare,
      medicareBase: calc.medicareBase,
      medicareAdditional: calc.medicareAdditional,
      state: calc.state,
    };
  });
}

function formatDeductionFields(d) {
  return {
    federal: moneyFixed2(d.federal),
    socialSecurity: moneyFixed2(d.socialSecurity),
    medicare: moneyFixed2(d.medicare),
    medicareBase: moneyFixed2(d.medicareBase),
    medicareAdditional: moneyFixed2(d.medicareAdditional),
    state: moneyFixed2(d.state),
  };
}

const MAX_PAYSTUB_LOGO_BYTES = 2_500_000;

const PayStubMaker = () => {
  const defaults = useMemo(() => defaultThreePeriodEnds(), []);

  const [employerName, setEmployerName] = useState('Spectrum Outfitters LLC');
  const [employerAddress, setEmployerAddress] = useState('');
  const [employerEin, setEmployerEin] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [last4Ssn, setLast4Ssn] = useState('');
  const [payFrequency, setPayFrequency] = useState('Bi-weekly');
  const [sameAmountsAllPeriods, setSameAmountsAllPeriods] = useState(true);
  const [employmentType, setEmploymentType] = useState('w2');
  const [filingStatus, setFilingStatus] = useState('single');
  const [workStateCode, setWorkStateCode] = useState('TX');
  const [manualWithholdings, setManualWithholdings] = useState(false);
  const [employerLogoDataUrl, setEmployerLogoDataUrl] = useState('');
  const [logoHint, setLogoHint] = useState('');

  const onEmployerLogoFile = useCallback((e) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const okMime =
      /^image\/(png|jpeg|webp)$/i.test(file.type) ||
      /\.(png|jpe?g|webp)$/i.test(file.name);
    if (!okMime) {
      setLogoHint('Use PNG, JPG, or WebP.');
      return;
    }
    if (file.size > MAX_PAYSTUB_LOGO_BYTES) {
      setLogoHint('Logo file is too large. Try under 2.5 MB or a compressed image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEmployerLogoDataUrl(reader.result);
        setLogoHint('');
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const [shared, setShared] = useState({
    gross: '',
    regularHours: '',
    hourlyRate: '',
    federal: '',
    socialSecurity: '',
    medicare: '',
    medicareBase: '',
    medicareAdditional: '',
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

  const periodDriverKey = useMemo(
    () =>
      perPeriod
        .map((r, i) =>
          [
            i,
            String(r.periodEnd || ''),
            sameAmountsAllPeriods ? '' : [r.gross, r.regularHours, r.hourlyRate, r.otherAmount, r.otherLabel].join('~'),
          ].join('|'),
        )
        .join('¦'),
    [perPeriod, sameAmountsAllPeriods],
  );

  const baselineRowsForCalc = useMemo(() => {
    if (sameAmountsAllPeriods && perPeriod.length === 3) {
      return perPeriod.map((row) => ({
        periodEnd: row.periodEnd,
        gross: shared.gross,
        regularHours: shared.regularHours,
        hourlyRate: shared.hourlyRate,
        otherLabel: shared.otherLabel,
        otherAmount: shared.otherAmount,
      }));
    }
    return perPeriod.map((row) => ({
      periodEnd: row.periodEnd,
      gross: row.gross,
      regularHours: row.regularHours,
      hourlyRate: row.hourlyRate,
      otherLabel: row.otherLabel,
      otherAmount: row.otherAmount,
    }));
  }, [
    sameAmountsAllPeriods,
    periodDriverKey,
    shared.gross,
    shared.regularHours,
    shared.hourlyRate,
    shared.otherLabel,
    shared.otherAmount,
    /** Reads latest perPeriod from closure; driver keys avoid reruns when only withholdings change. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  /** Auto-sync computed withholdings into form fields (manual override / contractor exemptions apply). */
  useEffect(() => {
    if (manualWithholdings) return;

    const isContractor = employmentType === '1099';
    const z = computeContractorDeductions();
    const zFmt = formatDeductionFields(z);

    if (isContractor) {
      setShared((prev) => ({ ...prev, ...zFmt }));
      setPerPeriod((prev) => prev.map((row) => ({ ...row, ...zFmt })));
      return;
    }

    const dedSeq = sequentialW2Deductions(baselineRowsForCalc, payFrequency, filingStatus, workStateCode);
    const firstFmt = dedSeq[0] ? formatDeductionFields(dedSeq[0]) : zFmt;

    if (sameAmountsAllPeriods && perPeriod.length === 3) {
      setShared((prev) => ({ ...prev, ...firstFmt }));
      /** Withholdings rendered from shared fields; sequential detail on export only. */
      return;
    }

    setPerPeriod((prev) =>
      prev.map((row, idx) =>
        dedSeq[idx] ? { ...row, ...formatDeductionFields(dedSeq[idx]) } : row,
      ),
    );
  }, [
    baselineRowsForCalc,
    filingStatus,
    payFrequency,
    workStateCode,
    employmentType,
    manualWithholdings,
    sameAmountsAllPeriods,
    perPeriod.length,
  ]);

  const handleDownload = () => {
    const rows =
      sameAmountsAllPeriods && perPeriod.length === 3
        ? baselineRowsForCalc
        : perPeriod.map((row) => ({ ...row }));

    let priorSocSec = 0;
    const isContractor = employmentType === '1099';

    const months = rows.map((row) => {
      const grossNum = Math.max(0, Number(row.gross) || 0);
      let deductions;

      if (isContractor) {
        deductions = computeContractorDeductions();
      } else if (manualWithholdings) {
        deductions = {
          federal: Number(row.federal ?? shared.federal) || 0,
          socialSecurity: Number(row.socialSecurity ?? shared.socialSecurity) || 0,
          medicare: Number(row.medicare ?? shared.medicare) || 0,
          medicareBase:
            Number(row.medicareBase ?? shared.medicareBase ?? 0) ||
            Math.max(
              0,
              Number(row.medicare ?? shared.medicare ?? 0) -
                Number(row.medicareAdditional ?? shared.medicareAdditional ?? 0),
            ),
          medicareAdditional: Number(row.medicareAdditional ?? shared.medicareAdditional) || 0,
          state: Number(row.state ?? shared.state) || 0,
          oasdiWagesNow: Math.min(grossNum, Number.MAX_SAFE_INTEGER),
        };
      } else {
        deductions = computeW2Deductions({
          gross: grossNum,
          payFrequency,
          filingStatus,
          workStateCode,
          priorYtdSocSecWages: priorSocSec,
        });
      }

      if (!manualWithholdings && !isContractor) {
        priorSocSec += deductions.oasdiWagesNow ?? 0;
      }

      return {
        periodEnd: row.periodEnd,
        gross: grossNum,
        federal: deductions.federal,
        socialSecurity: deductions.socialSecurity,
        medicare: deductions.medicare,
        medicareBase: deductions.medicareBase,
        medicareAdditional: deductions.medicareAdditional,
        state: deductions.state,
        otherLabel: row.otherLabel ?? shared.otherLabel,
        otherAmount: row.otherAmount ?? shared.otherAmount,
        regularHours: row.regularHours ?? shared.regularHours,
        hourlyRate: row.hourlyRate ?? shared.hourlyRate,
      };
    });

    generatePayStubsPdf({
      employerName,
      employerAddress,
      employerEin,
      ...(employerLogoDataUrl ? { logoDataUrl: employerLogoDataUrl } : {}),
      employeeName,
      employeeId,
      last4Ssn,
      payFrequency,
      employmentType,
      workerState: workStateCode,
      taxCalculationNote:
        employmentType === '1099'
          ? 'Independent contractor payouts — payer does not withhold FICA.'
          : 'Federal withholding projected from annual wage × pay periods minus standard deduction; not Publication 15-T exact.',
      months,
    });
  };

  const disabledTaxFields =
    (!manualWithholdings && employmentType === 'w2') || employmentType === '1099';

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
          One PDF downloads with{' '}
          <strong className="text-gray-900 dark:text-neutral-100">three professionally structured pages</strong> (layouts similar to
          large payroll portals—statement ref, earnings/deductions grids, bold pay summary—even though you&apos;re entering your own figures).
          W‑2 mode estimates federal/state/FICA from gross × pay periods; toggle manual mode to edit every line item.
          <span className="block mt-1 text-amber-800 dark:text-amber-200">
            Estimated taxes only — align with payroll provider withholding tables before relying on withholdings legally.
          </span>
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
          <div>
            <label className={labelClass}>Federal EIN (optional)</label>
            <input
              className={fieldClass}
              value={employerEin}
              onChange={(e) => setEmployerEin(e.target.value)}
              placeholder="12-3456789"
              autoCapitalize="characters"
            />
          </div>
          <div>
            <label className={labelClass}>Company logo (optional)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              className={fieldClass}
              onChange={onEmployerLogoFile}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-neutral-500">
              PNG, JPG, or WebP · shown to the left of the company block on each page · leave blank for text only
            </p>
            {logoHint ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{logoHint}</p>
            ) : null}
            {employerLogoDataUrl ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <img
                  src={employerLogoDataUrl}
                  alt="Logo preview"
                  className="h-14 max-w-[160px] object-contain rounded-lg border border-gray-300 dark:border-neutral-600 bg-neutral-900/40 p-1"
                />
                <button
                  type="button"
                  className="text-sm font-medium rounded-lg px-3 py-1.5 border border-gray-300 dark:border-neutral-600 text-gray-800 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
                  onClick={() => {
                    setEmployerLogoDataUrl('');
                    setLogoHint('');
                  }}
                >
                  Remove logo
                </button>
              </div>
            ) : null}
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

          <h2 className="text-lg font-semibold text-gray-800 dark:text-neutral-100 pt-2">Classification & tax basis</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Worker type</label>
              <select
                className={fieldClass}
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
              >
                {WORKER_TYPES.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Federal filing status</label>
              <select
                disabled={employmentType !== 'w2'}
                className={fieldClass}
                value={filingStatus}
                onChange={(e) => setFilingStatus(e.target.value)}
              >
                <option value="single">Single (or married filing separately)</option>
                <option value="mfj">Married filing jointly</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Primary work state</label>
            <select
              className={fieldClass}
              disabled={employmentType !== 'w2'}
              value={workStateCode}
              onChange={(e) => setWorkStateCode(e.target.value)}
            >
              {US_STATES.map(([abbr, readable]) => (
                <option key={abbr} value={abbr}>
                  {readable}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-neutral-200 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-gray-400 dark:border-neutral-500 shrink-0"
              checked={manualWithholdings}
              disabled={employmentType !== 'w2'}
              onChange={(e) => setManualWithholdings(e.target.checked)}
            />
            <span>
              Manual withholding override (editable federal / Social Security / Medicare / state fields)
            </span>
          </label>
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
                taxFieldsLocked={disabledTaxFields}
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
                    taxFieldsLocked={disabledTaxFields}
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

function MoneyFields({
  values,
  onPatch,
  fieldClass,
  labelClass,
  taxFieldsLocked = false,
}) {
  const ch = (key) => (e) => onPatch({ [key]: e.target.value });
  const lockedCls = `${fieldClass}${taxFieldsLocked ? ' opacity-60 cursor-not-allowed' : ''}`;

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
        <label className={labelClass}>Regular hours (optional)</label>
        <input
          className={fieldClass}
          inputMode="decimal"
          placeholder="e.g. 80"
          value={values.regularHours ?? ''}
          onChange={ch('regularHours')}
        />
      </div>
      <div>
        <label className={labelClass}>Hourly rate (optional)</label>
        <input
          className={fieldClass}
          inputMode="decimal"
          placeholder="Salary / hourly"
          value={values.hourlyRate ?? ''}
          onChange={ch('hourlyRate')}
        />
      </div>
      <div>
        <label className={labelClass}>Federal income tax</label>
        <input
          className={lockedCls}
          inputMode="decimal"
          placeholder="0.00"
          value={values.federal}
          onChange={ch('federal')}
          disabled={taxFieldsLocked}
          title={
            taxFieldsLocked
              ? 'Turn on manual withholding override to edit withholding lines.'
              : undefined
          }
        />
      </div>
      <div>
        <label className={labelClass}>State income tax</label>
        <input
          className={lockedCls}
          inputMode="decimal"
          placeholder="0.00"
          value={values.state}
          onChange={ch('state')}
          disabled={taxFieldsLocked}
        />
      </div>
      <div>
        <label className={labelClass}>Social Security</label>
        <input
          className={lockedCls}
          inputMode="decimal"
          placeholder="0.00"
          value={values.socialSecurity}
          onChange={ch('socialSecurity')}
          disabled={taxFieldsLocked}
        />
      </div>
      <div>
        <label className={labelClass}>Medicare</label>
        <input
          className={lockedCls}
          inputMode="decimal"
          placeholder="0.00"
          value={values.medicare}
          onChange={ch('medicare')}
          disabled={taxFieldsLocked}
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
