import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { format, endOfMonth, subMonths } from 'date-fns';
import { generatePayStubsPdf, parsePayDate } from '../../utils/payStubPdf';
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

function sequentialW2DeductionsInRowOrder(
  rows,
  payFrequency,
  filingStatus,
  workStateCode,
  priorSocSeed = 0,
) {
  const tagged = rows.map((row, idx) => ({ row, idx }));
  tagged.sort((a, b) => +parsePayDate(a.row.periodEnd) - +parsePayDate(b.row.periodEnd));
  let priorSocSec = Number(priorSocSeed) || 0;
  const calcByIdx = {};
  tagged.forEach(({ row, idx }) => {
    const gross = Math.max(0, Number(row.gross) || 0);
    const calc = computeW2Deductions({
      gross,
      payFrequency,
      filingStatus,
      workStateCode,
      priorYtdSocSecWages: priorSocSec,
    });
    priorSocSec += calc.oasdiWagesNow ?? 0;
    calcByIdx[idx] = calc;
  });
  return rows.map((_, idx) => {
    const calc = calcByIdx[idx];
    return {
      federal: calc.federal,
      socialSecurity: calc.socialSecurity,
      medicare: calc.medicare,
      medicareBase: calc.medicareBase,
      medicareAdditional: calc.medicareAdditional,
      state: calc.state,
      oasdiWagesNow: calc.oasdiWagesNow ?? 0,
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
  const [payFrequency, setPayFrequency] = useState('Bi-weekly');
  const [sameAmountsAllPeriods, setSameAmountsAllPeriods] = useState(true);
  const [employmentType, setEmploymentType] = useState('w2');
  const [filingStatus, setFilingStatus] = useState('single');
  const [workStateCode, setWorkStateCode] = useState('TX');
  const [manualWithholdings, setManualWithholdings] = useState(false);
  const [employerLogoDataUrl, setEmployerLogoDataUrl] = useState('');
  const [logoHint, setLogoHint] = useState('');
  /** Optional calendar-year amounts already earned before earliest period-date in this PDF */
  const [priorYtdTaxYear, setPriorYtdTaxYear] = useState('');
  const [priorYtdGross, setPriorYtdGross] = useState('');
  const [priorYtdFederal, setPriorYtdFederal] = useState('');
  const [priorYtdSocialSecurity, setPriorYtdSocialSecurity] = useState('');
  const [priorYtdMedicareBase, setPriorYtdMedicareBase] = useState('');
  const [priorYtdMedicareAdditional, setPriorYtdMedicareAdditional] = useState('');
  const [priorYtdState, setPriorYtdState] = useState('');
  const [priorYtdOther, setPriorYtdOther] = useState('');
  /** W-2 SS taxable wages already earned before first period (for withholding sequence only) */
  const [priorYtdTaxableSocSecWages, setPriorYtdTaxableSocSecWages] = useState('');
  const [annualSalary, setAnnualSalary] = useState('');
  const [applyAnnualSalaryToMonthlyGross, setApplyAnnualSalaryToMonthlyGross] = useState(false);

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

    const dedSeq = sequentialW2DeductionsInRowOrder(
      baselineRowsForCalc,
      payFrequency,
      filingStatus,
      workStateCode,
      employmentType === '1099' ? 0 : Number(`${priorYtdTaxableSocSecWages}`.replace(/,/g, '')) || 0,
    );
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
    priorYtdTaxableSocSecWages,
  ]);

  const handleDownload = () => {
    const rowsRaw =
      sameAmountsAllPeriods && perPeriod.length === 3
        ? baselineRowsForCalc.map((r) => ({ ...r }))
        : perPeriod.map((row) => ({ ...row }));

    const isContractor = employmentType === '1099';
    const priorSocSeed =
      isContractor ? 0 : Number(`${priorYtdTaxableSocSecWages ?? ''}`.replace(/,/g, '')) || 0;

    /** Per-row withholding: auto W-2 recomputed in chronological period-end order */
    let working = rowsRaw.map((r) => ({ ...r }));
    if (!isContractor && !manualWithholdings) {
      const seq = sequentialW2DeductionsInRowOrder(
        working,
        payFrequency,
        filingStatus,
        workStateCode,
        priorSocSeed,
      );
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
          One PDF with{' '}
          <strong className="text-gray-900 dark:text-neutral-100">three professionally structured pages</strong>.
          Figures update live as you type. YTD on each page sums periods in the <strong className="font-normal">same tax year </strong>
          with end-dates{' '}
          <strong className="font-normal">on or before that page&apos;s pay period-end </strong>
          (sorted by calendar date; Month 3 can run before Month 2 if dates say so).
          Optional baseline adds pay from earlier in that year before the dates you listed.
          <span className="block mt-1 text-neutral-700 dark:text-neutral-300">
            W‑2 mode estimates withholdings chronologically including Social Security wage base; toggle manual row edits if needed.
          </span>
          <span className="block mt-1 text-amber-800 dark:text-amber-200">
            Estimated taxes only — defer to payroll software for withholding tables before relying legally.
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

          <fieldset className="border border-gray-200 dark:border-neutral-700 rounded-xl p-4 space-y-3">
            <legend className="text-sm font-semibold px-2 text-gray-800 dark:text-neutral-100">
              Prior calendar-year YTD (optional)
            </legend>
            <p className="text-xs text-gray-600 dark:text-neutral-400 leading-relaxed">
              Enter amounts already paid{' '}
              <strong className="font-normal text-gray-500">in the same tax year </strong>
              before the earliest period date below. Leave blank when this PDF covers the full year-so-far. Totals columns on each page
              add every exported period<strong className="font-normal text-gray-500"> that falls in the same calendar year and on/before </strong>
              that page&apos;s period end (ordering is chronological, not Month 1/2/3 order).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Baseline tax year</label>
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  placeholder="e.g. 2026 (required if stubs cross two years)"
                  value={priorYtdTaxYear}
                  onChange={(e) => setPriorYtdTaxYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Prior gross YTD (before first date above)</label>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={priorYtdGross}
                  onChange={(e) => setPriorYtdGross(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Prior federal withheld</label>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={priorYtdFederal}
                  onChange={(e) => setPriorYtdFederal(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Prior Social Security withheld</label>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={priorYtdSocialSecurity}
                  onChange={(e) => setPriorYtdSocialSecurity(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Prior Medicare base (1.45% tier)</label>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={priorYtdMedicareBase}
                  onChange={(e) => setPriorYtdMedicareBase(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Prior additional Medicare withheld</label>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={priorYtdMedicareAdditional}
                  onChange={(e) => setPriorYtdMedicareAdditional(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Prior state withheld</label>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={priorYtdState}
                  onChange={(e) => setPriorYtdState(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Prior other deductions</label>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={priorYtdOther}
                  onChange={(e) => setPriorYtdOther(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Soc. Security taxable wages YTD before first period (W‑2)</label>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  disabled={employmentType !== 'w2'}
                  placeholder="Feeds OASDI base only — unrelated to gross YTD boxes"
                  value={priorYtdTaxableSocSecWages}
                  onChange={(e) => setPriorYtdTaxableSocSecWages(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

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
              Same dollar amounts each period (dates can differ)
            </label>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-neutral-700 p-4 space-y-3 bg-neutral-50/80 dark:bg-neutral-900/50">
            <label className="flex items-start gap-2 text-sm text-gray-800 dark:text-neutral-100 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-400 dark:border-neutral-500 shrink-0"
                checked={applyAnnualSalaryToMonthlyGross}
                disabled={!sameAmountsAllPeriods}
                onChange={(e) => {
                  const on = e.target.checked;
                  setApplyAnnualSalaryToMonthlyGross(on);
                  if (!on) setAnnualSalary('');
                }}
              />
              <span>
                Auto-fill <strong className="font-normal">monthly gross = annual salary ÷ 12</strong> (same-dollar mode only)
              </span>
            </label>
            {applyAnnualSalaryToMonthlyGross && sameAmountsAllPeriods ? (
              <div>
                <label className={labelClass}>Annual salary (USD)</label>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="120000"
                  value={annualSalary}
                  onChange={(e) => setAnnualSalary(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          {sameAmountsAllPeriods ? (
            <>
              <p className="text-xs text-gray-500 dark:text-neutral-400">
                These figures repeat on every page below. Dates order the math: YTD is cumulative by calendar date, not Month 1 / 2 / 3 slot.
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
