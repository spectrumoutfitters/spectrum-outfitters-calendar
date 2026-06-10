import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { format, endOfMonth, subMonths } from 'date-fns';
import {
  calendarBackfillSocSecWagesByYear,
  computeW2DeductionsInRowOrder,
  generatePayStubsPdf,
  parsePayDate,
  paycheckGrossFromEntry,
  weeklyChecksSharePayWeekDay,
} from '../../utils/payStubPdf';
import { computeContractorDeductions } from '../../utils/payrollTaxUS';

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

function parseOptionalTaxYear(raw) {
  const t = `${raw ?? ''}`.trim();
  if (!t) return undefined;
  const y = Number(t);
  return Number.isFinite(y) && y >= 1970 && y <= 2150 ? y : undefined;
}

function anyPriorYtdFieldFilled(fields) {
  return Object.values(fields).some((v) => `${v ?? ''}`.trim() !== '');
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
  const [payFrequency, setPayFrequency] = useState('Monthly');
  const [sameAmountsAllPeriods, setSameAmountsAllPeriods] = useState(true);
  const [employmentType, setEmploymentType] = useState('w2');
  const [filingStatus, setFilingStatus] = useState('single');
  const [workStateCode, setWorkStateCode] = useState('TX');
  const [manualWithholdings, setManualWithholdings] = useState(false);
  const [employerLogoDataUrl, setEmployerLogoDataUrl] = useState('');
  const [logoHint, setLogoHint] = useState('');
  const [priorYtdTaxYear, setPriorYtdTaxYear] = useState('');
  const [priorYtdGross, setPriorYtdGross] = useState('');
  const [priorYtdFederal, setPriorYtdFederal] = useState('');
  const [priorYtdSocialSecurity, setPriorYtdSocialSecurity] = useState('');
  const [priorYtdMedicareBase, setPriorYtdMedicareBase] = useState('');
  const [priorYtdMedicareAdditional, setPriorYtdMedicareAdditional] = useState('');
  const [priorYtdState, setPriorYtdState] = useState('');
  const [priorYtdOther, setPriorYtdOther] = useState('');
  const [priorYtdTaxableSocSecWages, setPriorYtdTaxableSocSecWages] = useState('');
  const [annualSalary, setAnnualSalary] = useState('');
  const [applyAnnualSalaryToMonthlyGross, setApplyAnnualSalaryToMonthlyGross] = useState(false);
  const [calendarYtdBackfill, setCalendarYtdBackfill] = useState(true);
  const [spreadMonthlyAcrossPaychecks, setSpreadMonthlyAcrossPaychecks] = useState(true);

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

  useEffect(() => {
    if (!applyAnnualSalaryToMonthlyGross || !sameAmountsAllPeriods) return;
    const a = Number(`${annualSalary}`.replace(/,/g, ''));
    if (!Number.isFinite(a) || a <= 0) return;
    const monthly = a / 12;
    setShared((prev) => ({ ...prev, gross: monthly.toFixed(2) }));
  }, [applyAnnualSalaryToMonthlyGross, annualSalary, sameAmountsAllPeriods]);

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

    const priorSocSeed =
      employmentType === '1099' ? 0 : Number(`${priorYtdTaxableSocSecWages}`.replace(/,/g, '')) || 0;
    const priorSocSeedByYear = calendarBackfillSocSecWagesByYear(baselineRowsForCalc, {
      calendarYtdBackfill,
      monthlyJanBackfill: calendarYtdBackfill,
      payFrequency,
      filingStatus,
      workerState: workStateCode,
      priorSsTaxableWages: priorSocSeed,
      priorSsTaxYear: parseOptionalTaxYear(priorYtdTaxYear),
      spreadMonthlyAcrossPaychecks,
    });
    const dedSeq = computeW2DeductionsInRowOrder(baselineRowsForCalc, {
      payFrequency,
      filingStatus,
      workStateCode,
      priorSocSecWages: priorSocSeed,
      priorSocSecWagesByYear: priorSocSeedByYear,
      spreadMonthlyAcrossPaychecks,
    });
    const chronFirstIdx =
      baselineRowsForCalc.length === 0
        ? 0
        : [...baselineRowsForCalc.map((r, idx) => ({ idx, t: +parsePayDate(r.periodEnd) }))].sort(
            (a, b) => a.t - b.t,
          )[0].idx;
    const firstFmt = dedSeq[chronFirstIdx]
      ? formatDeductionFields(dedSeq[chronFirstIdx])
      : zFmt;

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
    calendarYtdBackfill,
    priorYtdTaxYear,
    priorYtdTaxableSocSecWages,
    spreadMonthlyAcrossPaychecks,
  ]);

  /** 1099 + Weekly + calendar YTD uses discrete weekdays from Jan 1 — every check date must agree. */
  const weekly1099CalendarMisaligned = useMemo(() => {
    if (employmentType !== '1099' || payFrequency !== 'Weekly' || !calendarYtdBackfill) return false;
    const gateNums = {
      gross: priorYtdGross,
      federal: priorYtdFederal,
      socialSecurity: priorYtdSocialSecurity,
      medicareBase: priorYtdMedicareBase,
      medicareAdditional: priorYtdMedicareAdditional,
      state: priorYtdState,
      other: priorYtdOther,
    };
    if (anyPriorYtdFieldFilled(gateNums) || parseOptionalTaxYear(priorYtdTaxYear) != null)
      return false;
    const ends = [...baselineRowsForCalc.map((r) => r.periodEnd)].sort(
      (a, b) => +parsePayDate(a) - +parsePayDate(b),
    );
    return !weeklyChecksSharePayWeekDay(ends).ok;
  }, [
    employmentType,
    payFrequency,
    calendarYtdBackfill,
    priorYtdGross,
    priorYtdFederal,
    priorYtdSocialSecurity,
    priorYtdMedicareBase,
    priorYtdMedicareAdditional,
    priorYtdState,
    priorYtdOther,
    priorYtdTaxYear,
    baselineRowsForCalc,
    periodDriverKey,
  ]);

  const handleDownload = () => {
    const rowsRaw =
      sameAmountsAllPeriods && perPeriod.length === 3
        ? baselineRowsForCalc.map((r) => ({ ...r }))
        : perPeriod.map((row) => ({ ...row }));

    const priorGateNums = {
      gross: priorYtdGross,
      federal: priorYtdFederal,
      socialSecurity: priorYtdSocialSecurity,
      medicareBase: priorYtdMedicareBase,
      medicareAdditional: priorYtdMedicareAdditional,
      state: priorYtdState,
      other: priorYtdOther,
    };
    const hasPdfPriorManual =
      anyPriorYtdFieldFilled(priorGateNums) || parseOptionalTaxYear(priorYtdTaxYear) != null;
    const sortedForWeeklyGate = [...rowsRaw].sort(
      (a, b) => +parsePayDate(a.periodEnd) - +parsePayDate(b.periodEnd),
    );
    const weeklyGate = weeklyChecksSharePayWeekDay(sortedForWeeklyGate.map((r) => r.periodEnd));

    if (
      employmentType === '1099' &&
      calendarYtdBackfill &&
      payFrequency === 'Weekly' &&
      !hasPdfPriorManual &&
      !weeklyGate.ok
    ) {
      alert(
        'Weekly year-to-date needs every listed check date on the same weekday (January 1 through each check counts one pay date every seven days). Align your dates, fill optional prior YTD instead, or turn off “Earlier months rolled into year-to-date”.',
      );
      return;
    }

    const isContractor = employmentType === '1099';
    const priorSocSeed =
      isContractor ? 0 : Number(`${priorYtdTaxableSocSecWages ?? ''}`.replace(/,/g, '')) || 0;

    /** Per-row withholding: auto W-2 recomputed in chronological period-end order */
    let working = rowsRaw.map((r) => ({ ...r }));
    if (!isContractor && !manualWithholdings) {
      const priorSocSeedByYear = calendarBackfillSocSecWagesByYear(working, {
        calendarYtdBackfill,
        monthlyJanBackfill: calendarYtdBackfill,
        payFrequency,
        filingStatus,
        workerState: workStateCode,
        priorSsTaxableWages: priorSocSeed,
        priorSsTaxYear: parseOptionalTaxYear(priorYtdTaxYear),
        spreadMonthlyAcrossPaychecks,
      });
      const seq = computeW2DeductionsInRowOrder(working, {
        payFrequency,
        filingStatus,
        workStateCode,
        priorSocSecWages: priorSocSeed,
        priorSocSecWagesByYear: priorSocSeedByYear,
        spreadMonthlyAcrossPaychecks,
      });
      working = working.map((row, i) => ({
        ...row,
        federal: seq[i].federal,
        socialSecurity: seq[i].socialSecurity,
        medicare: seq[i].medicare,
        medicareBase: seq[i].medicareBase,
        medicareAdditional: seq[i].medicareAdditional,
        state: seq[i].state,
      }));
    }

    const months = working.map((row) => {
      const rawEnteredGross = Math.max(0, Number(row.gross) || 0);
      const grossNum = paycheckGrossFromEntry(
        rawEnteredGross,
        payFrequency,
        spreadMonthlyAcrossPaychecks,
      );
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
        deductions = {
          federal: Number(row.federal) || 0,
          socialSecurity: Number(row.socialSecurity) || 0,
          medicare: Number(row.medicare) || 0,
          medicareBase: Number(row.medicareBase) || 0,
          medicareAdditional: Number(row.medicareAdditional) || 0,
          state: Number(row.state) || 0,
        };
      }

      return {
        periodEnd: row.periodEnd,
        /** Raw UI gross; `generatePayStubsPdf`/`buildPreparedPaystubPages` apply `paycheckGrossFromEntry` once. */
        gross: rawEnteredGross,
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

    const priorNums = {
      gross: priorYtdGross,
      federal: priorYtdFederal,
      socialSecurity: priorYtdSocialSecurity,
      medicareBase: priorYtdMedicareBase,
      medicareAdditional: priorYtdMedicareAdditional,
      state: priorYtdState,
      other: priorYtdOther,
    };
    const priorYtdPdf =
      anyPriorYtdFieldFilled(priorNums) || parseOptionalTaxYear(priorYtdTaxYear) != null
        ? {
            taxYear: parseOptionalTaxYear(priorYtdTaxYear),
            gross: Number(`${priorYtdGross}`.replace(/,/g, '')) || 0,
            federal: Number(`${priorYtdFederal}`.replace(/,/g, '')) || 0,
            socialSecurity: Number(`${priorYtdSocialSecurity}`.replace(/,/g, '')) || 0,
            medicareBase: Number(`${priorYtdMedicareBase}`.replace(/,/g, '')) || 0,
            medicareAdditional: Number(`${priorYtdMedicareAdditional}`.replace(/,/g, '')) || 0,
            state: Number(`${priorYtdState}`.replace(/,/g, '')) || 0,
            other: Number(`${priorYtdOther}`.replace(/,/g, '')) || 0,
          }
        : undefined;

    generatePayStubsPdf({
      employerName,
      employerAddress,
      employerEin,
      ...(employerLogoDataUrl ? { logoDataUrl: employerLogoDataUrl } : {}),
      ...(priorYtdPdf ? { priorYtd: priorYtdPdf } : {}),
      employeeName,
      employeeId,
      last4Ssn,
      payFrequency,
      filingStatus,
      employmentType,
      workerState: workStateCode,
      calendarYtdBackfill,
      monthlyJanBackfillCalendarYtd: calendarYtdBackfill,
      spreadMonthlyAcrossPaychecks,
      priorSsTaxableWages:
        employmentType === '1099' ? 0 : Number(`${priorYtdTaxableSocSecWages}`.replace(/,/g, '')) || 0,
      taxCalculationNote: '',
      months,
    });
  };

  const disabledTaxFields =
    (!manualWithholdings && employmentType === 'w2') || employmentType === '1099';

  const fieldClass =
    'w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-gray-900 dark:text-neutral-100';

  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1';

  const cardClass =
    'rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 sm:p-6 shadow-sm dark:shadow-none';

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-14 sm:px-0">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-neutral-50">Pay stubs</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-neutral-400">
          QuickBooks-style earning statement — one PDF with three stubs. Enter only what you need;{' '}
          <a
            href="https://quickbooks.intuit.com/learn-support/en-us/help-article/payroll-preferences/customize-paycheck-layout-pay-stub/L2VLh4LXk_US_en_US"
            target="_blank"
            rel="noreferrer noopener"
            className="text-blue-700 dark:text-blue-400 underline underline-offset-2"
          >
            Intuit pay stub layout guidance
          </a>
          .
        </p>
      </header>

      <section className={cardClass}>
        <h2 className="sr-only">Company &amp; worker</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <label className={labelClass}>Company name</label>
            <input className={fieldClass} value={employerName} onChange={(e) => setEmployerName(e.target.value)} />
            <label className={labelClass}>Employer address</label>
            <textarea className={`${fieldClass} min-h-[72px]`} rows={2} placeholder="" value={employerAddress} onChange={(e) => setEmployerAddress(e.target.value)} />
            <label className={labelClass}>EIN</label>
            <input className={fieldClass} placeholder="12-3456789" value={employerEin} onChange={(e) => setEmployerEin(e.target.value)} />
          </div>
          <div className="space-y-3">
            <label className={labelClass}>Employee name</label>
            <input className={fieldClass} value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="First Last" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Employee ID</label>
                <input className={fieldClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>SSN last 4</label>
                <input
                  className={fieldClass}
                  maxLength={4}
                  inputMode="numeric"
                  value={last4Ssn}
                  onChange={(e) => setLast4Ssn(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>
            <label className={labelClass}>Worker type</label>
            <select className={fieldClass} value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
              {WORKER_TYPES.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Pay schedule</label>
            <select className={fieldClass} value={payFrequency} onChange={(e) => setPayFrequency(e.target.value)}>
              {PAY_FREQUENCIES.map((p) => (
                <option key={p} value={p}>
                  {p}
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
              <option value="single">Single</option>
              <option value="mfj">Married filing jointly</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Work state</label>
            <select
              disabled={employmentType !== 'w2'}
              className={fieldClass}
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
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-100 dark:border-neutral-800 pt-4 text-sm text-gray-800 dark:text-neutral-200">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="h-4 w-4 rounded border-gray-400 dark:border-neutral-600" checked={calendarYtdBackfill} onChange={(e) => setCalendarYtdBackfill(e.target.checked)} />
            Earlier months rolled into year-to-date
          </label>
          {payFrequency !== 'Monthly' ? (
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-400 dark:border-neutral-600" checked={spreadMonthlyAcrossPaychecks} onChange={(e) => setSpreadMonthlyAcrossPaychecks(e.target.checked)} />
              Gross figures are monthly (split across checks)
            </label>
          ) : null}
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-400 dark:border-neutral-600"
              checked={manualWithholdings}
              disabled={employmentType !== 'w2'}
              onChange={(e) => setManualWithholdings(e.target.checked)}
            />
            Override tax withholdings
          </label>
        </div>
        {employmentType === '1099' && payFrequency === 'Weekly' && calendarYtdBackfill && weekly1099CalendarMisaligned ? (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100">
            Gross year‑to‑date counts paychecks weekly on one weekday starting from January 1. Listed check dates do not share the same weekday—align those dates or turn off earlier‑months YTD, or use optional prior‑year‑to‑date fields. Export is blocked until this is fixed or prior YTD is used.
          </p>
        ) : null}

        <details className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/50">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-neutral-300">Optional · logo image</summary>
          <div className="mt-3 space-y-3">
            <input type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" className={fieldClass} onChange={onEmployerLogoFile} />
            {logoHint ? <p className="text-xs text-red-600 dark:text-red-400">{logoHint}</p> : null}
            {employerLogoDataUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                <img src={employerLogoDataUrl} alt="" className="h-12 max-w-[140px] object-contain rounded border border-gray-200 dark:border-neutral-700 p-1" />
                <button
                  type="button"
                  className="text-sm text-gray-700 dark:text-neutral-300 underline-offset-4 hover:underline"
                  onClick={() => {
                    setEmployerLogoDataUrl('');
                    setLogoHint('');
                  }}
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        </details>

        <details className="mt-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/50">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-neutral-300">Optional · prior paychecks this same year</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Baseline year</label>
              <input
                className={fieldClass}
                inputMode="numeric"
                placeholder="2026"
                value={priorYtdTaxYear}
                onChange={(e) => setPriorYtdTaxYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Prior gross before first stub listed</label>
              <input className={fieldClass} inputMode="decimal" placeholder="0.00" value={priorYtdGross} onChange={(e) => setPriorYtdGross(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Federal</label>
              <input className={fieldClass} inputMode="decimal" placeholder="0.00" value={priorYtdFederal} onChange={(e) => setPriorYtdFederal(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Social Security</label>
              <input className={fieldClass} inputMode="decimal" placeholder="0.00" value={priorYtdSocialSecurity} onChange={(e) => setPriorYtdSocialSecurity(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Medicare (1.45%)</label>
              <input className={fieldClass} inputMode="decimal" placeholder="0.00" value={priorYtdMedicareBase} onChange={(e) => setPriorYtdMedicareBase(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Addl. Medicare</label>
              <input className={fieldClass} inputMode="decimal" placeholder="0.00" value={priorYtdMedicareAdditional} onChange={(e) => setPriorYtdMedicareAdditional(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input className={fieldClass} inputMode="decimal" placeholder="0.00" value={priorYtdState} onChange={(e) => setPriorYtdState(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Other</label>
              <input className={fieldClass} inputMode="decimal" placeholder="0.00" value={priorYtdOther} onChange={(e) => setPriorYtdOther(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>SS taxable wages YTD prior (W‑2 only)</label>
              <input
                className={fieldClass}
                inputMode="decimal"
                disabled={employmentType !== 'w2'}
                placeholder=""
                value={priorYtdTaxableSocSecWages}
                onChange={(e) => setPriorYtdTaxableSocSecWages(e.target.value)}
              />
            </div>
          </div>
        </details>

        <details className="mt-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/50">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-neutral-300">Shortcut · annual salary → monthly gross</summary>
          <div className="mt-3 space-y-3">
            <label className="flex items-start gap-2 cursor-pointer select-none text-sm dark:text-neutral-200">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-400 dark:border-neutral-600"
                checked={applyAnnualSalaryToMonthlyGross}
                disabled={!sameAmountsAllPeriods}
                onChange={(e) => {
                  const on = e.target.checked;
                  setApplyAnnualSalaryToMonthlyGross(on);
                  if (!on) setAnnualSalary('');
                }}
              />
              Only when pay entries use the same dollars
            </label>
            {applyAnnualSalaryToMonthlyGross && sameAmountsAllPeriods ? (
              <>
                <label className={labelClass}>Annual salary</label>
                <input className={fieldClass} inputMode="decimal" placeholder="120000" value={annualSalary} onChange={(e) => setAnnualSalary(e.target.value)} />
              </>
            ) : null}
          </div>
        </details>
      </section>

      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-neutral-100">Checks</h2>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700 dark:text-neutral-300">
            <input type="checkbox" className="h-4 w-4 rounded border-gray-400 dark:border-neutral-600" checked={sameAmountsAllPeriods} onChange={(e) => setSameAmountsAllPeriods(e.target.checked)} />
            Same wages on each check
          </label>
        </div>

        {sameAmountsAllPeriods ? (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <label className={labelClass}>Check #{i + 1} date</label>
                  <input
                    type="date"
                    className={fieldClass}
                    value={perPeriod[i]?.periodEnd || ''}
                    onChange={(e) => updatePeriod(i, { periodEnd: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6">
              <MoneyFields values={shared} onPatch={(p) => setShared((prev) => ({ ...prev, ...p }))} fieldClass={fieldClass} labelClass={labelClass} taxFieldsLocked={disabledTaxFields} />
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-4">
            {[0, 1, 2].map((i) => (
              <fieldset key={i} className="rounded-xl border border-gray-100 p-4 dark:border-neutral-800">
                <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">
                  Stub {i + 1}
                </legend>
                <div className="mt-2">
                  <label className={labelClass}>Check date</label>
                  <input type="date" className={fieldClass} value={perPeriod[i]?.periodEnd || ''} onChange={(e) => updatePeriod(i, { periodEnd: e.target.value })} />
                </div>
                <div className="mt-3">
                  <MoneyFields values={perPeriod[i]} onPatch={(p) => updatePeriod(i, p)} fieldClass={fieldClass} labelClass={labelClass} taxFieldsLocked={disabledTaxFields} />
                </div>
              </fieldset>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-4 px-1">
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex h-12 min-w-[220px] items-center justify-center rounded-xl bg-neutral-900 px-8 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          Download PDF
        </button>
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
        <label className={labelClass}>Federal withholding</label>
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
        <label className={labelClass}>State withholding</label>
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
        <label className={labelClass}>Other (label)</label>
        <input
          className={fieldClass}
          placeholder="e.g. Health insurance"
          value={values.otherLabel}
          onChange={ch('otherLabel')}
        />
      </div>
      <div>
        <label className={labelClass}>Other (amount)</label>
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
