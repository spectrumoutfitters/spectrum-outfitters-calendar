import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addDays, format, startOfMonth, parseISO, isValid, subDays } from 'date-fns';
import { computeW2Deductions, payPeriodsPerYear } from './payrollTaxUS';

export function parsePayDate(raw) {
  if (!raw) return new Date();
  const d = typeof raw === 'string' ? parseISO(raw) : raw;
  return isValid(d) ? d : new Date();
}

function moneyUsd(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '$0.00';
  return x.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * Inclusive pay-period range for stub wording, anchored on the employer-entered period end date.
 * @param {Date} periodEndDate
 * @param {string} [payFrequency]
 * @returns {{ start: Date, end: Date }}
 */
export function computePayPeriodBounds(periodEndDate, payFrequency = 'Monthly') {
  const end =
    periodEndDate instanceof Date && isValid(periodEndDate) ? periodEndDate : new Date();

  switch (`${payFrequency || 'Monthly'}`.trim()) {
    case 'Weekly':
      return { start: subDays(end, 6), end };
    case 'Bi-weekly':
      return { start: subDays(end, 13), end };
    case 'Semi-monthly': {
      const y = end.getFullYear();
      const m = end.getMonth();
      const day = end.getDate();
      const start = day <= 15 ? new Date(y, m, 1) : new Date(y, m, 16);
      return { start, end };
    }
    case 'Monthly':
      return { start: startOfMonth(end), end };
    /** Approximate generic period when schedule is unspecified */
    case 'Other':
      return { start: subDays(end, 13), end };
    default:
      return { start: startOfMonth(end), end };
  }
}

/**
 * Printable "MMM d, yyyy – MMM d, yyyy" line for PDF / preview (matches Pay frequency selection).
 */
export function computePeriodLabel(periodEndDate, payFrequency = 'Monthly') {
  const { start, end } = computePayPeriodBounds(periodEndDate, payFrequency);
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
}

/**
 * Converts a typed gross entry into gross for one printed paycheck when the user
 * means "monthly pay split across pay periods" (e.g. $10k/mo shown on weekly stubs).
 */
export function paycheckGrossFromEntry(rawEntered, payFrequency, treatEnteredAmountAsMonthlyInstallment) {
  const g = Math.max(0, Number(rawEntered) || 0);
  const f = `${payFrequency || 'Monthly'}`.trim();
  if (!treatEnteredAmountAsMonthlyInstallment || f === 'Monthly' || !g) return g;
  const periods = payPeriodsPerYear(f);
  return (g * 12) / periods;
}

function truncateToLocalCalendarDate(d) {
  const x =
    d instanceof Date && isValid(d) ? d : typeof d === 'string' ? parseISO(d) : new Date();
  const dd = isValid(x) ? x : new Date();
  return new Date(dd.getFullYear(), dd.getMonth(), dd.getDate());
}

/**
 * Count actual weekly paycheck *dates* in the stub year — first payment on-or-after Jan 1
 * that lands on payWeekDayJs, then each +7 calendar days through periodEnd inclusive.
 * payWeekDayJs matches `Date.getDay()` (0 Sun … 6 Sat).
 *
 * @param {Date|string} periodEnd
 * @param {number} payWeekDayJs
 * @returns {number}
 */
export function countWeeklyPayChecksThroughInclusive(periodEnd, payWeekDayJs) {
  const w = Number(payWeekDayJs);
  if (!Number.isInteger(w) || w < 0 || w > 6) return 0;
  const end = truncateToLocalCalendarDate(parsePayDate(periodEnd));
  const y = end.getFullYear();
  /** @type {Date} */
  let anchor = new Date(y, 0, 1);
  let guard = 0;
  while (anchor.getDay() !== w && guard < 14) {
    anchor = addDays(anchor, 1);
    guard += 1;
  }
  if (guard >= 14) return 0;
  let n = 0;
  for (let cur = anchor; cur.getTime() <= end.getTime(); cur = addDays(cur, 7)) {
    if (cur.getFullYear() !== y) break;
    n += 1;
  }
  return n;
}

/**
 * Weekly calendar Y‑TD counting needs every exported check date on one weekday.
 *
 * @param {Array<Date|string>} periodEndsChronoOrAnyOrder
 */
export function weeklyChecksSharePayWeekDay(periodEndsChronoOrAnyOrder) {
  const dates = [...periodEndsChronoOrAnyOrder]
    .map((pe) => truncateToLocalCalendarDate(parsePayDate(pe)))
    .filter((dt) => isValid(dt))
    .sort((a, b) => +a - +b);
  if (dates.length === 0) return { ok: true, payWeekDay: undefined };
  const d0 = dates[0].getDay();
  const ok = dates.every((dt) => dt.getDay() === d0);
  return { ok, payWeekDay: ok ? d0 : undefined };
}

export function shouldBlockWeeklyCalendarYtdExport({
  employmentType,
  payFrequency,
  calendarYtdBackfill,
  priorYtdFields,
  periodEnds,
}) {
  const workerType = String(employmentType || '').toUpperCase();
  const isSupportedWeeklyWorker = workerType.includes('1099') || workerType === 'W2' || workerType === 'W-2';
  if (!isSupportedWeeklyWorker || payFrequency !== 'Weekly' || calendarYtdBackfill !== true) {
    return false;
  }
  const hasDollarPrior = Object.values(priorYtdFields || {}).some(
    (v) => `${v ?? ''}`.trim() !== '',
  );
  if (hasDollarPrior) return false;
  return !weeklyChecksSharePayWeekDay(periodEnds || []).ok;
}

export function calendarBackfillPriorSsTaxableWages(months, opts = {}) {
  const basePrior = Math.max(0, Number(opts.priorSsTaxableWages) || 0);
  const backfillEnabled =
    opts?.calendarYtdBackfill === true || opts?.monthlyJanBackfill === true;
  if (!backfillEnabled || !Array.isArray(months) || months.length === 0) return basePrior;

  const payFreqResolved = `${opts.payFrequency || 'Monthly'}`.trim();
  const spreadMonthly = !!opts.spreadMonthlyAcrossPaychecks;
  const normalizedRows = months.map((m) => {
    const d = parsePayDate(m.periodEnd ?? m.d);
    return {
      y: d.getFullYear(),
      d,
      gross: paycheckGrossFromEntry(numUsdField(m.gross), payFreqResolved, spreadMonthly),
    };
  });

  const years = [...new Set(normalizedRows.map((r) => r.y))];
  if (years.length !== 1) return basePrior;

  const sorted = [...normalizedRows].sort((a, b) => +a.d - +b.d);
  const earliest = sorted[0];
  const earliestMonthHuman = earliest.d.getMonth() + 1;
  const grossPerCheckEarliest = Math.max(0, Number(earliest.gross) || 0);
  const monthlyPhantomGross = grossPerCheckEarliest * (payPeriodsPerYear(payFreqResolved) / 12);

  if (earliestMonthHuman <= 1 || monthlyPhantomGross <= 0) return basePrior;

  let priorSs = basePrior;
  for (let m = 1; m < earliestMonthHuman; m++) {
    const c = computeW2Deductions({
      gross: monthlyPhantomGross,
      payFrequency: 'Monthly',
      filingStatus: opts.filingStatus === 'mfj' ? 'mfj' : 'single',
      workStateCode: opts.workerState || 'TX',
      priorYtdSocSecWages: priorSs,
    });
    priorSs += c.oasdiWagesNow ?? 0;
  }
  return priorSs;
}

function roundUsd2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function numUsdField(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function calculateNetYTD(gross, fed, ss, medC, medA, state, other) {
  return Math.max(0, gross - fed - ss - medC - medA - state - other);
}

/**
 * @typedef {{ gross?: number, federal?: number, socialSecurity?: number, medicareBase?: number, medicareAdditional?: number, state?: number, other?: number, taxYear?: number }} PriorYtdInput
 * @typedef {{ calendarYtdBackfill?: boolean, monthlyJanBackfill?: boolean, spreadMonthlyAcrossPaychecks?: boolean, payFrequency?: string, filingStatus?: string, workerState?: string, priorSsTaxableWages?: number }} PaystubYtdOptions
 */

function emptyPriorParts() {
  return { g: 0, f: 0, ss: 0, mc: 0, ma: 0, st: 0, o: 0 };
}

function addPriorParts(a, b) {
  return {
    g: a.g + b.g,
    f: a.f + b.f,
    ss: a.ss + b.ss,
    mc: a.mc + b.mc,
    ma: a.ma + b.ma,
    st: a.st + b.st,
    o: a.o + b.o,
  };
}

/**
 * When calendar backfill is on, infers withheld prior months for **W-2**: Jan … (calendar month before the earliest exported stub).
 * Phantom months use implied monthly wages derived from earliest listed paycheck (weekly/biweekly → × periods/12).
 *
 * **1099 + calendar backfill** with `skipContractorMonthPhantomGross`: skip contractor phantom month lumps; cumulative gross Y‑TD counts
 * **discrete** weekly paycheck *dates* (`countWeeklyPayChecksThroughInclusive`) when every exported check lands on one weekday (`weeklyChecksSharePayWeekDay`).
 *
 * Multi-year batches skip extrapolation — user should use manual prior or split exports.
 *
 * @param {Array<{ y: number; d: Date; gross: number }>} normalizedRows
 * @param {boolean} contractor
 * @param {PaystubYtdOptions & { skipContractorMonthPhantomGross?: boolean }} opts — when `skipContractorMonthPhantomGross`,
 * contractor prior-month gross lumps are suppressed (calendar YTD is filled another way).
 * @returns {{ byYear: Record<number, ReturnType<emptyPriorParts>>, runningSsConsumed: boolean, suppressedReason: string }}
 */
function phantomCalendarMonthsPriorTotals(normalizedRows, contractor, opts) {
  /** @type {Record<number, ReturnType<emptyPriorParts>>} */
  const byYear = {};
  let suppressedReason = '';

  const backfillEnabled =
    opts?.calendarYtdBackfill === true || opts?.monthlyJanBackfill === true;
  if (!backfillEnabled || normalizedRows.length === 0) {
    return { byYear, runningSsConsumed: false, suppressedReason };
  }

  const years = [...new Set(normalizedRows.map((r) => r.y))];
  if (years.length > 1) {
    suppressedReason =
      'Automatic calendar-YTD phantom needs one tax year per PDF; use manual prior YTD or export one year at a time.';
    return { byYear, runningSsConsumed: false, suppressedReason };
  }

  const year = years[0];
  const inYear = normalizedRows.filter((r) => r.y === year);
  const sorted = [...inYear].sort((a, b) => +a.d - +b.d);
  const earliest = sorted[0];
  const earliestMonthIdx = earliest.d.getMonth(); // 0 January
  /** January = 1 ... December =12 */
  const earliestMonthHuman = earliestMonthIdx + 1;

  const grossPerCheckEarliest = Math.max(0, Number(earliest.gross) || 0);

  /** Implied ordinary monthly wages from per-check gross (Monthly → factor 12/12). */
  const payFreqResolved = `${opts.payFrequency || 'Monthly'}`.trim();
  const periods = payPeriodsPerYear(payFreqResolved);
  const monthlyPhantomGross = grossPerCheckEarliest * (periods / 12);

  if (earliestMonthHuman <= 1 || monthlyPhantomGross <= 0) {
    return { byYear, runningSsConsumed: false, suppressedReason };
  }

  /** Jan .. earliestMonthHuman-1 */
  let phantom = emptyPriorParts();
  let priorSs = Math.max(0, Number(opts.priorSsTaxableWages) || 0);

  const skipCg =
    !!(contractor && opts?.skipContractorMonthPhantomGross);

  for (let m = 1; m < earliestMonthHuman; m++) {
    if (!skipCg) {
      phantom.g += monthlyPhantomGross;
    }
    if (!contractor) {
      const c = computeW2Deductions({
        gross: monthlyPhantomGross,
        payFrequency: 'Monthly',
        filingStatus: opts.filingStatus === 'mfj' ? 'mfj' : 'single',
        workStateCode: opts.workerState || 'TX',
        priorYtdSocSecWages: priorSs,
      });
      priorSs += c.oasdiWagesNow ?? 0;
      phantom.f += Number(c.federal) || 0;
      phantom.ss += Number(c.socialSecurity) || 0;
      phantom.mc += Number(c.medicareBase) || 0;
      phantom.ma += Number(c.medicareAdditional) || 0;
      phantom.st += Number(c.state) || 0;
    }
  }

  byYear[year] = phantom;
  return {
    byYear,
    runningSsConsumed: earliestMonthHuman > 1 && !contractor && monthlyPhantomGross > 0,
    suppressedReason,
  };
}

/**
 * @param {object[]} months
 * @param {boolean} contractor
 * @param {PriorYtdInput} prior
 * @param {PaystubYtdOptions} [ytdOpts]
 */
export function buildPreparedPaystubPages(months, contractor, prior, ytdOpts) {
  /** @type {ReturnType<typeof parsePayDate>[]} */
  const pfResolved = String(ytdOpts?.payFrequency ?? 'Monthly').trim() || 'Monthly';
  const spreadMonthly = !!ytdOpts?.spreadMonthlyAcrossPaychecks;

  const rows = months.map((m, inputOrder) => {
    const d = parsePayDate(m.periodEnd);
    const y = d.getFullYear();
    const gross = paycheckGrossFromEntry(numUsdField(m.gross), pfResolved, spreadMonthly);
    const federal = contractor ? 0 : Math.max(0, numUsdField(m.federal));
    const stateInc = contractor ? 0 : Math.max(0, numUsdField(m.state));
    const ssAmt = contractor ? 0 : Math.max(0, numUsdField(m.socialSecurity));
    const medicareTotal = contractor ? 0 : Math.max(0, numUsdField(m.medicare));
    let medClassic = contractor ? 0 : Math.max(0, numUsdField(m.medicareBase));
    let medAdditional = contractor ? 0 : Math.max(0, numUsdField(m.medicareAdditional));

    if (!contractor && medClassic <= 1e-4 && medAdditional <= 1e-4 && medicareTotal > 0) {
      medClassic = medicareTotal;
    }
    if (
      !contractor &&
      medClassic + medAdditional > medicareTotal + 0.03 &&
      medicareTotal > 0
    ) {
      medClassic = medicareTotal - medAdditional;
    }

    const otherAmt = Math.max(0, numUsdField(m.otherAmount));
    const otherLbl =
      contractor ? '' : `${m.otherLabel || ''}`.trim() || 'Other after-tax deduction';

    const hrs =
      contractor ? '' : Number(m.regularHours) > 0 ? String(Number(m.regularHours)) : '';
    let rateStr = '';
    let regEarnCurr = gross;
    if (!contractor && Number(m.hourlyRate) > 0) {
      const r = Number(m.hourlyRate);
      rateStr = moneyUsd(r);
      if (Number(m.regularHours) > 0) {
        const calc = Number(m.regularHours) * r;
        if (calc > 0) regEarnCurr = Math.min(calc, gross);
      }
    }
    const supplementalCurr = contractor ? 0 : Math.max(0, gross - regEarnCurr);

    return {
      inputOrder,
      d,
      y,
      m,
      gross,
      federal,
      stateInc,
      ssAmt,
      medicareTotal,
      medClassic,
      medAdditional,
      otherAmt,
      otherLbl,
      hrs,
      rateStr,
      regEarnCurr,
      supplementalCurr,
    };
  });

  const minYear =
    rows.length > 0 ? Math.min(...rows.map((r) => r.y)) : new Date().getFullYear();
  const uniqueYears = new Set(rows.map((r) => r.y));
  const hasMultiYear = uniqueYears.size > 1;

  const explicitPriorYearRaw = prior?.taxYear;
  const explicitPriorYear =
    explicitPriorYearRaw != null &&
    `${explicitPriorYearRaw}`.trim() !== '' &&
    Number.isFinite(Number(explicitPriorYearRaw))
      ? Number(explicitPriorYearRaw)
      : null;

  const priorYearResolved =
    explicitPriorYear !== null ? explicitPriorYear : hasMultiYear ? null : minYear;

  const priorGross = Math.max(0, numUsdField(prior?.gross));
  const priorFed = Math.max(0, numUsdField(prior?.federal));
  const priorSs = Math.max(0, numUsdField(prior?.socialSecurity));
  const priorMedC = Math.max(0, numUsdField(prior?.medicareBase));
  const priorMedA = Math.max(0, numUsdField(prior?.medicareAdditional));
  const priorState = Math.max(0, numUsdField(prior?.state));
  const priorOther = Math.max(0, numUsdField(prior?.other));

  const hasPriorAmounts =
    priorGross +
      priorFed +
      priorSs +
      priorMedC +
      priorMedA +
      priorState +
      priorOther >
    1e-6;

  const calendarBackfillOn =
    ytdOpts?.calendarYtdBackfill === true || ytdOpts?.monthlyJanBackfill === true;

  const sortedChronological = [...rows].sort((a, b) => +a.d - +b.d);
  const alignedWeekly = weeklyChecksSharePayWeekDay(sortedChronological.map((r) => r.d));
  const contractorYtdAnchorGross = sortedChronological.length ? sortedChronological[0].gross : 0;

  const contractorWeeklyDiscreteYtd =
    contractor &&
    calendarBackfillOn &&
    !hasPriorAmounts &&
    !hasMultiYear &&
    pfResolved === 'Weekly' &&
    sortedChronological.length > 0 &&
    alignedWeekly.ok &&
    alignedWeekly.payWeekDay !== undefined &&
    contractorYtdAnchorGross > 1e-6;

  const weeklyPayWeekDayResolved =
    contractorWeeklyDiscreteYtd && typeof alignedWeekly.payWeekDay === 'number'
      ? alignedWeekly.payWeekDay
      : null;

  const phantomSynthetic = phantomCalendarMonthsPriorTotals(
    rows.map((r) => ({ y: r.y, d: r.d, gross: r.gross })),
    contractor,
    {
      ...(ytdOpts || {}),
      skipContractorMonthPhantomGross: contractorWeeklyDiscreteYtd,
    },
  );
  const phantomByYear = phantomSynthetic.byYear || {};

  /**
   * @param {number} stubYear
   */
  function userManualPriorBundle(stubYear) {
    if (!hasPriorAmounts) {
      return { g: 0, f: 0, ss: 0, mc: 0, ma: 0, st: 0, o: 0 };
    }
    if (priorYearResolved === null || stubYear !== priorYearResolved) {
      return { g: 0, f: 0, ss: 0, mc: 0, ma: 0, st: 0, o: 0 };
    }
    return {
      g: priorGross,
      f: priorFed,
      ss: priorSs,
      mc: priorMedC,
      ma: priorMedA,
      st: priorState,
      o: priorOther,
    };
  }

  /**
   * @param {number} stubYear
   */
  function combinedPriorBundle(stubYear) {
    const userPb = userManualPriorBundle(stubYear);
    const phant = phantomByYear[stubYear] || emptyPriorParts();
    return addPriorParts(userPb, phant);
  }

  const prepared = rows.map((row) => {
    const cohort = rows.filter((o) => o.y === row.y && +o.d <= +row.d);
    const pb = combinedPriorBundle(row.y);

    const sumGross = cohort.reduce((s, o) => s + o.gross, 0);
    const sumFed = cohort.reduce((s, o) => s + o.federal, 0);
    const sumSs = cohort.reduce((s, o) => s + o.ssAmt, 0);
    const sumMedC = cohort.reduce((s, o) => s + o.medClassic, 0);
    const sumMedA = cohort.reduce((s, o) => s + o.medAdditional, 0);
    const sumState = cohort.reduce((s, o) => s + o.stateInc, 0);
    const sumOther = cohort.reduce((s, o) => s + o.otherAmt, 0);
    const sumReg = cohort.reduce((s, o) => s + o.regEarnCurr, 0);
    const sumSup = cohort.reduce((s, o) => s + o.supplementalCurr, 0);

    const ytdGross =
      contractorWeeklyDiscreteYtd && weeklyPayWeekDayResolved != null
        ? roundUsd2(
            countWeeklyPayChecksThroughInclusive(row.d, weeklyPayWeekDayResolved) *
              contractorYtdAnchorGross,
          )
        : pb.g + sumGross;
    const ytdFed = pb.f + sumFed;
    const ytdSs = pb.ss + sumSs;
    const ytdMedC = pb.mc + sumMedC;
    const ytdMedA = pb.ma + sumMedA;
    const ytdState = pb.st + sumState;
    const ytdOther = pb.o + sumOther;

    const totalDedCurr =
      row.federal + row.stateInc + row.ssAmt + row.medClassic + row.medAdditional + row.otherAmt;
    const totalDedYtd = ytdFed + ytdSs + ytdMedC + ytdMedA + ytdState + ytdOther;

    const netCurr =
      row.gross - row.federal - row.stateInc - row.ssAmt - row.medClassic - row.medAdditional - row.otherAmt;
    const netYtd = calculateNetYTD(ytdGross, ytdFed, ytdSs, ytdMedC, ytdMedA, ytdState, ytdOther);

    return {
      ...row,
      payDateObj: row.d,
      ytdGross,
      ytdFed,
      ytdSs,
      ytdMedC,
      ytdMedA,
      ytdState,
      ytdOther,
      ytdRegEarn: sumReg,
      ytdSupplemental: sumSup,
      totalDedCurr,
      totalDedYtd,
      netCurr,
      netYtd,
    };
  });

  return prepared;
}

const QB_HEADER_FILL = [230, 231, 234];
const QB_HEADER_TEXT = [33, 33, 39];
const QB_GRID_LINE = [200, 203, 210];

/** @param {string} uri */
function detectPdfImageFormat(uri) {
  const head = String(uri).slice(0, 64).toLowerCase();
  if (head.includes('image/png')) return 'PNG';
  if (head.includes('image/jpeg') || head.includes('image/jpg')) return 'JPEG';
  if (head.includes('image/webp')) return 'WEBP';
  return null;
}

/**
 * @param {import('jspdf').default} doc
 * @param {string} uri
 * @param {number} maxH
 * @param {number} maxW
 */
function measureLogoForPdf(doc, uri, maxH, maxW) {
  try {
    const dims = doc.getImageProperties(uri);
    const iw = Number(dims?.width) || 1;
    const ih = Number(dims?.height) || 1;
    let h = maxH;
    let w = (iw / ih) * h;
    if (w > maxW) {
      w = maxW;
      h = (ih / iw) * w;
    }
    return { w, h };
  } catch {
    return null;
  }
}

/**
 * Intuit QuickBooks Desktop / Online voucher–style earning statement (plain typography,
 * sectioned Earnings → Deductions → Net pay, neutral gray table headers customary on QB pay stubs).
 * @see https://quickbooks.intuit.com/learn-support/en-us/help-article/payroll-preferences/customize-paycheck-layout-pay-stub/L2VLh4LXk_US_en_US
 * @param {object} data
 */
export function generatePayStubsPdf(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const margin = 48;
  const tblW = pageW - margin * 2;
  let yOrigin = margin;

  const contractor = String(data.employmentType || '').toUpperCase().includes('1099');
  const months = Array.isArray(data.months) ? data.months.slice(0, 36) : [];
  const printedAt = format(new Date(), 'MMM d, yyyy h:mm a');
  const payFreqResolved = String(data.payFrequency ?? 'Monthly').trim() || 'Monthly';

  const calendarYtdBackfill =
    data.calendarYtdBackfill === true || data.monthlyJanBackfillCalendarYtd === true;

  const prepared = buildPreparedPaystubPages(months, contractor, data.priorYtd || {}, {
    calendarYtdBackfill,
    monthlyJanBackfill: calendarYtdBackfill,
    spreadMonthlyAcrossPaychecks: data.spreadMonthlyAcrossPaychecks === true,
    payFrequency: payFreqResolved,
    filingStatus: data.filingStatus === 'mfj' ? 'mfj' : 'single',
    workerState: data.workerState || 'TX',
    priorSsTaxableWages: Math.max(0, Number(data.priorSsTaxableWages) || 0),
  });

  const qbTableHead = () => ({
    fillColor: QB_HEADER_FILL,
    textColor: QB_HEADER_TEXT,
    fontStyle: 'bold',
    fontSize: 8.5,
    halign: 'left',
  });

  const qbLine = (yPt) => {
    doc.setDrawColor(QB_GRID_LINE[0], QB_GRID_LINE[1], QB_GRID_LINE[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, yPt, pageW - margin, yPt);
  };

  prepared.forEach((P, idx) => {
    if (idx > 0) {
      doc.addPage();
      yOrigin = margin;
    }

    const month = P.m;
    const payDateObj = P.payDateObj;
    const gross = P.gross;
    const federal = P.federal;
    const stateInc = P.stateInc;
    const ssAmt = P.ssAmt;
    const medicareTotal = P.medicareTotal;
    const medClassic = P.medClassic;
    const medAdditional = P.medAdditional;
    const otherAmt = P.otherAmt;
    const otherLbl = P.otherLbl;
    const hrs = P.hrs;
    const rateStr = P.rateStr;
    const regEarnCurr = P.regEarnCurr;
    const supplementalCurr = P.supplementalCurr;

    const cumGross = P.ytdGross;
    const cumFed = P.ytdFed;
    const cumSs = P.ytdSs;
    const cumMedClassic = P.ytdMedC;
    const cumMedAdd = P.ytdMedA;
    const cumState = P.ytdState;
    const cumOther = P.ytdOther;

    const totalDedCurr = P.totalDedCurr;
    const totalDedYtd = P.totalDedYtd;
    const netCurr = P.netCurr;
    const netYtd = P.netYtd;
    const ytdSupplementalAmt = P.ytdSupplemental ?? 0;
    const cumRegEarn = P.ytdRegEarn;

    const statementRef = `PS-${format(payDateObj, 'yyyyMMdd')}-${String(idx + 1).padStart(2, '0')}`;
    const refNo = `${month.referenceNumber ?? data.referenceNumber ?? ''}`.trim();
    let y = yOrigin;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 105, 115);
    doc.text(`Pay stub (${idx + 1} of ${prepared.length})`, pageW - margin, y + 12, {
      align: 'right',
    });

    /** Logo + employer (QB letterhead lane) */
    let textStartX = margin;
    let textStartY = y + 8;
    const logoUri = `${data.logoDataUrl || data.employerLogoDataUrl || ''}`.trim();
    const logoMaxH =
      typeof data.logoMaxHeightPt === 'number' && Number.isFinite(data.logoMaxHeightPt)
        ? Math.min(56, Math.max(20, data.logoMaxHeightPt))
        : 40;
    const logoFmt = logoUri ? detectPdfImageFormat(logoUri) : null;
    if (logoFmt) {
      const measured = measureLogoForPdf(doc, logoUri, logoMaxH, 112);
      if (measured) {
        try {
          doc.addImage(logoUri, logoFmt, margin, y + 6, measured.w, measured.h);
          textStartX = margin + measured.w + 12;
        } catch {
          textStartX = margin;
        }
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(String(data.employerName || 'Employer').trim(), textStartX, textStartY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(52, 55, 60);
    let ly = textStartY + 26;
    const addrParts = `${data.employerAddress || ''}`
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (addrParts.length) {
      addrParts.forEach((line) => {
        doc.text(line, textStartX, ly);
        ly += 11;
      });
    }
    if (data.employerEin && String(data.employerEin).trim()) {
      doc.text(`EIN: ${String(data.employerEin).trim()}`, textStartX, ly);
      ly += 11;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Pay Stub', pageW - margin, y + 32, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(52, 55, 60);
    let metaY = y + 42;
    doc.text(`Pay period: ${computePeriodLabel(payDateObj, payFreqResolved)}`, pageW - margin, metaY, {
      align: 'right',
    });
    metaY += 12;
    doc.text(`Check date: ${format(payDateObj, 'MM/dd/yyyy')}`, pageW - margin, metaY, {
      align: 'right',
    });
    metaY += 12;
    if (refNo) {
      doc.text(`Reference: ${refNo}`, pageW - margin, metaY, { align: 'right' });
      metaY += 12;
    }

    y = Math.max(ly, metaY) + 12;
    qbLine(y);
    y += 18;

    const legalName = `${data.employeeName || ''}`.trim() || '—';
    const eeId = `${data.employeeId || ''}`.trim() || '—';
    const lastFour = `${data.last4Ssn || ''}`.trim();
    const ssnShown = contractor
      ? '—'
      : lastFour.length === 4
        ? `XXX-XX-${lastFour}`
        : '—';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(legalName, margin, y);
    y += 18;

    const empKv = [
      ['Employee ID:', eeId],
      [contractor ? 'Worker type:' : 'SS No.:', contractor ? '1099 Contractor' : ssnShown],
      ['Pay frequency:', payFreqResolved],
      ...(contractor
        ? []
        : [['Work state:', `${data.workerState || ''}`.trim() || '—']]),
    ];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(52, 55, 60);
    empKv.forEach(([k, v]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(k, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(v), margin + 90, y);
      y += 13;
    });
    y += 8;

    /** Earnings (QB voucher column headings) */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Earnings', margin, y);
    y += 10;

    const earnBody = [];
    if (!contractor) {
      const rateDisplay =
        rateStr && String(hrs || '').trim() !== ''
          ? `${rateStr.replace(/^\$/, '').trim()}/hr`
          : rateStr || (regEarnCurr > 1e-4 ? 'Salary' : '');
      earnBody.push([
        'Regular wages',
        hrs ? String(hrs) : '',
        rateDisplay,
        moneyUsd(regEarnCurr),
        moneyUsd(cumRegEarn),
      ]);
      if (supplementalCurr > 1e-2) {
        earnBody.push(['Other earnings', '', '', moneyUsd(supplementalCurr), moneyUsd(ytdSupplementalAmt)]);
      }
    } else {
      earnBody.push(['Gross wages', '', '', moneyUsd(gross), moneyUsd(cumGross)]);
    }
    const earnTotalIx = earnBody.length;
    earnBody.push(['Gross pay — total', '', '', moneyUsd(gross), moneyUsd(cumGross)]);

    autoTable(doc, {
      head: [['Description', 'Hours', 'Rate', 'Amount', 'YTD']],
      body: earnBody,
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: tblW,
      theme: 'grid',
      styles: {
        fontSize: 9,
        lineColor: QB_GRID_LINE,
        lineWidth: 0.25,
        cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
        valign: 'middle',
      },
      headStyles: qbTableHead(),
      bodyStyles: { textColor: 34 },
      columnStyles: {
        0: { cellWidth: tblW * 0.34 },
        1: { halign: 'right', cellWidth: tblW * 0.12 },
        2: { halign: 'right', cellWidth: tblW * 0.16 },
        3: { halign: 'right', cellWidth: tblW * 0.17 },
        4: { halign: 'right', cellWidth: tblW * 0.17 },
      },
      didParseCell: (hookData) => {
        if (hookData.section !== 'body') return;
        if (hookData.row.index === earnTotalIx) {
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = doc.lastAutoTable.finalY + 18;

    /** Deductions */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(contractor ? 'Deductions' : 'Deductions and taxes withheld', margin, y);
    y += 10;

    const dedBody = [];
    if (!contractor) {
      const medDedAmt = medicareTotal > 1e-4 ? medicareTotal : medClassic + medAdditional;
      dedBody.push(['Federal withholding', moneyUsd(federal), moneyUsd(cumFed)]);
      dedBody.push(['Social Security', moneyUsd(ssAmt), moneyUsd(cumSs)]);
      dedBody.push(['Medicare', moneyUsd(medDedAmt), moneyUsd(cumMedClassic + cumMedAdd)]);
      dedBody.push([`State withholding (${data.workerState || '—'})`, moneyUsd(stateInc), moneyUsd(cumState)]);
      if (otherAmt > 1e-4) {
        dedBody.push([`${otherLbl || 'Other'}`, moneyUsd(otherAmt), moneyUsd(cumOther)]);
      }
    } else {
      dedBody.push(['Employee withholdings shown on payer records', '—', '—']);
    }
    const dedTotalIx = dedBody.length;
    dedBody.push(['Total deductions', moneyUsd(contractor ? 0 : totalDedCurr), moneyUsd(contractor ? 0 : totalDedYtd)]);

    autoTable(doc, {
      head: [['Description', 'Amount', 'YTD']],
      body: dedBody,
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: tblW,
      theme: 'grid',
      styles: {
        fontSize: 9,
        lineColor: QB_GRID_LINE,
        lineWidth: 0.25,
        cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
      },
      headStyles: qbTableHead(),
      bodyStyles: { textColor: 34 },
      columnStyles: {
        0: { cellWidth: tblW * 0.55 },
        1: { halign: 'right', cellWidth: tblW * 0.22 },
        2: { halign: 'right', cellWidth: tblW * 0.22 },
      },
      didParseCell: (hookData) => {
        if (hookData.section !== 'body') return;
        if (hookData.row.index === dedTotalIx) {
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = doc.lastAutoTable.finalY + 20;

    /** Net pay (QB totals band) */
    doc.setFillColor(QB_HEADER_FILL[0], QB_HEADER_FILL[1], QB_HEADER_FILL[2]);
    doc.rect(margin, y, tblW, 52, 'F');
    doc.setDrawColor(QB_GRID_LINE[0], QB_GRID_LINE[1], QB_GRID_LINE[2]);
    doc.rect(margin, y, tblW, 52, 'S');

    const ny = y + 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(QB_HEADER_TEXT[0], QB_HEADER_TEXT[1], QB_HEADER_TEXT[2]);
    doc.text('Net pay — this paycheck', margin + 12, ny);
    doc.text(moneyUsd(netCurr), pageW - margin - 12, ny, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Year-to-date net pay (through ${format(payDateObj, 'MMM d, yyyy')})`, margin + 12, ny + 18);
    doc.setFont('helvetica', 'bold');
    doc.text(moneyUsd(netYtd), pageW - margin - 12, ny + 18, { align: 'right' });

    y += 60;
    qbLine(y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110, 115, 125);
    doc.text(
      `Year-to-date through ${format(payDateObj, 'yyyy')} using calendar paycheck dates printed above. ${statementRef}.`,
      margin,
      y,
      { maxWidth: tblW },
    );
    y += 20;

    const discretionaryFooter = contractor
      ? `${
          data.contractorDisclaimer ||
          '1099 NEC — payer does not withhold employee FICA on this payout.'
        }`.trim()
      : `${data.payStubDisclaimer || data.taxCalculationNote || ''}`.trim();

    if (discretionaryFooter) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(110, 115, 122);
      const wrapped = doc.splitTextToSize(discretionaryFooter, tblW);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 9 + 6;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(130, 135, 140);
    doc.text(`Printed ${printedAt}`, margin, Math.min(pageH - 42, Math.max(y, pageH - 52)));
    doc.text('Not a paycheck — documentation only.', pageW - margin, Math.min(pageH - 42, Math.max(y, pageH - 52)), {
      align: 'right',
    });
  });

  const safeStem = `${data.employeeName || 'earning-statement'}`
    .replace(/[^\w\s-]/gu, '')
    .replace(/\s+/g, '-');

  doc.save(`${safeStem || 'pay-documentation'}-${prepared.length}-periods.pdf`);
}
