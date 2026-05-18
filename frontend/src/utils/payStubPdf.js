import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, parseISO, isValid, subDays } from 'date-fns';
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
 * When enabled, infer prior calendar months Jan … (month before earliest exported stub in that tax year).
 * Applies to any pay frequency: phantom months use implied monthly wages from earliest listed paycheck
 * (weekly/biweekly etc. scaled up × periods/12). Contractors get gross phantom only (no withheld lines).
 *
 * Multi-year batches skip extrapolation — user should use manual prior or split exports.
 *
 * @param {Array<{ y: number; d: Date; gross: number }>} normalizedRows
 * @param {boolean} contractor
 * @param {PaystubYtdOptions} opts
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

  for (let m = 1; m < earliestMonthHuman; m++) {
    phantom.g += monthlyPhantomGross;
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

  const phantomSynthetic = phantomCalendarMonthsPriorTotals(
    rows.map((r) => ({ y: r.y, d: r.d, gross: r.gross })),
    contractor,
    ytdOpts || {},
  );
  const phantomByYear = phantomSynthetic.byYear || {};
  /** Earliest chronological row (for phantom label) */
  const earliestExported =
    rows.length > 0
      ? [...rows].reduce((min, r) => (+r.d < +min.d ? r : min), rows[0])
      : null;
  let phantomInclusiveLabel = '';
  if (
    phantomByYear[earliestExported?.y] &&
    earliestExported &&
    earliestExported.gross > 0
  ) {
    const y = earliestExported.y;
    const em = earliestExported.d.getMonth();
    const lastPhMonthIdx = Math.max(0, em - 1);
    phantomInclusiveLabel = `Jan–${format(new Date(y, lastPhMonthIdx, 1), 'MMM yyyy')}`;
  }

  let monthPhantomEquivalent = 0;
  if (earliestExported && earliestExported.gross > 0) {
    const periodsExplain = payPeriodsPerYear(pfResolved);
    monthPhantomEquivalent = earliestExported.gross * (periodsExplain / 12);
  }

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

    const ytdGross = pb.g + sumGross;
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
      ytdBannerNote: [
        hasPriorAmounts && priorYearResolved === null
          ? 'Prior YTD baseline skipped: set Tax year for baseline when periods span multiple calendar years.'
          : '',
        phantomSynthetic.suppressedReason,
        phantomByYear[row.y]?.g > 1e-6 &&
        phantomInclusiveLabel &&
        earliestExported &&
        monthPhantomEquivalent > 1e-6
          ? `YTD includes phantom prior months (${phantomInclusiveLabel}) ≈ ${moneyUsd(monthPhantomEquivalent)}/mo from earliest listed paycheck ${moneyUsd(earliestExported.gross)} (${pfResolved}). `
          : '',
      ]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .join(' '),
    };
  });

  return prepared;
}

const BORDER_GRAY = [198, 202, 210];
const BORDER_LIGHT = [230, 233, 238];
const BANNER = [38, 42, 52];
const BANNER_MUTED = [70, 75, 86];
const GOLD = [212, 160, 23];
const PANEL_BG = [250, 251, 253];
const ZEBRA = [246, 248, 251];

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

/** @param {import('jspdf').default} doc */
function drawCorporateSectionLabel(doc, x, y, label) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 105, 115);
  doc.text(String(label || '').toUpperCase(), x, y);
}

/**
 * Sequential YTD totals (each page sums prior stubs + current).
 * Corporate-style layout suitable for SMB presentation (readable, formal sections).
 * @param {object} data
 */
export function generatePayStubsPdf(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const side = 42;
  const topBarH = 4;
  /** Content starts below gold bar */
  let yOrigin = side + topBarH + 6;

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

  prepared.forEach((P, idx) => {
    if (idx > 0) {
      doc.addPage();
      yOrigin = side + topBarH + 6;
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
    const cumRegEarn = P.ytdRegEarn;

    const totalDedCurr = P.totalDedCurr;
    const totalDedYtd = P.totalDedYtd;
    const netCurr = P.netCurr;
    const netYtd = P.netYtd;
    const ytdSupplementalAmt = P.ytdSupplemental ?? 0;

    const statementRef = `PS-${format(payDateObj, 'yyyyMMdd')}-${String(idx + 1).padStart(2, '0')}`;
    const refNo = `${month.referenceNumber ?? data.referenceNumber ?? ''}`.trim();

    /** ─── Top accent bar ─── */
    doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.rect(0, 0, pageW, topBarH, 'F');

    let y = yOrigin;

    /** Outer frame (professional “form” edge) */
    doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
    doc.setLineWidth(0.75);
    doc.roundedRect(side - 2, topBarH + 4, pageW - (side - 2) * 2, pageH - topBarH - side - 2, 1, 1, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 125, 135);
    doc.text(`Statement ${statementRef}`, pageW - side, y, { align: 'right' });
    doc.text(`Page ${idx + 1} of ${prepared.length}`, pageW - side, y + 10, {
      align: 'right',
    });

    /** Company + document title strip */
    doc.setFillColor(PANEL_BG[0], PANEL_BG[1], PANEL_BG[2]);
    doc.setDrawColor(BORDER_LIGHT[0], BORDER_LIGHT[1], BORDER_LIGHT[2]);
    doc.roundedRect(side, y + 20, pageW - side * 2, 112, 2, 2, 'FD');

    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(2);
    doc.line(side + 14, y + 28, side + 14, y + 20 + 98);
    doc.setLineWidth(0.75);

    const logoUri = `${data.logoDataUrl || data.employerLogoDataUrl || ''}`.trim();
    const logoMaxH =
      typeof data.logoMaxHeightPt === 'number' && Number.isFinite(data.logoMaxHeightPt)
        ? Math.min(80, Math.max(22, data.logoMaxHeightPt))
        : 52;
    /** Text block starts here; shifts right when logo draws successfully */
    let leftBlockX = side + 26;
    let ly = y + 40;
    const logoFmt = logoUri ? detectPdfImageFormat(logoUri) : null;
    if (logoFmt) {
      const measured = measureLogoForPdf(doc, logoUri, logoMaxH, 118);
      if (measured) {
        try {
          const lx = side + 26;
          const panelInsetTop = y + 24;
          const panelInnerH = 104;
          const lyLogo =
            measured.h <= panelInnerH
              ? panelInsetTop + (panelInnerH - measured.h) / 2
              : panelInsetTop;
          doc.addImage(logoUri, logoFmt, lx, lyLogo, measured.w, measured.h);
          leftBlockX = lx + measured.w + 14;
        } catch {
          leftBlockX = side + 26;
        }
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(22, 24, 31);
    doc.text(String(data.employerName || 'Employer').trim(), leftBlockX, ly);
    ly += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(72, 78, 88);
    if (data.employerEin && String(data.employerEin).trim()) {
      doc.text(`Federal Employer ID Number (FEIN): ${String(data.employerEin).trim()}`, leftBlockX, ly);
      ly += 13;
    }
    const addrParts = `${data.employerAddress || ''}`
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!addrParts.length) {
      doc.setTextColor(156, 160, 170);
      doc.text('Employer mailing address…', leftBlockX, ly);
      ly += 13;
    } else {
      addrParts.forEach((line) => {
        doc.text(line, leftBlockX, ly);
        ly += 12;
      });
    }

    const rightPaneX = pageW / 2 + 18;
    let ry = y + 42;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(BANNER[0], BANNER[1], BANNER[2]);
    doc.text(
      contractor ? 'Contractor payout advice' : 'Earnings statement',
      pageW - side - 16,
      ry,
      { align: 'right' },
    );
    ry += 16;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
    doc.roundedRect(rightPaneX - 6, ry - 4, pageW - side - rightPaneX + 6, 74, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(55, 60, 70);
    const metaLeft = [
      ['Pay date', format(payDateObj, 'MMM d, yyyy')],
      ['Pay period', computePeriodLabel(payDateObj, payFreqResolved)],
      ['Deposit / voucher ref.', refNo || 'Direct deposit'],
    ];
    metaLeft.forEach(([k, v], i) => {
      const yy = ry + i * 20;
      doc.setTextColor(110, 115, 125);
      doc.setFont('helvetica', 'normal');
      doc.text(k + ':', rightPaneX + 6, yy + 6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(38, 42, 50);
      doc.text(String(v), rightPaneX + 96, yy + 6);
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(138, 142, 150);
    doc.text(`Printed · ${printedAt}`, pageW - side - 16, ry + 70, { align: 'right' });

    y = y + 20 + 112 + 16;

    drawCorporateSectionLabel(doc, side, y, 'Employee information');

    /** Employee info grid (classic two-column KV) */
    const legalName = `${data.employeeName || ''}`.trim() || '—';
    const eeId = `${data.employeeId || ''}`.trim() || '—';
    const lastFour = `${data.last4Ssn || ''}`.trim();
    const ssnShown = contractor
      ? 'Masked TIN'
      : lastFour.length === 4
        ? `XXX-XX-${lastFour}`
        : '—';

    autoTable(doc, {
      body: [
        [
          'Legal name',
          legalName,
          'Classification',
          contractor ? '1099 · Independent contractor' : 'W‑2 · Employee',
        ],
        [
          'Employee ID',
          eeId,
          'Pay frequency',
          payFreqResolved,
        ],
        [
          contractor ? 'TIN presentation' : 'Social Security Number',
          ssnShown,
          'Primary work jurisdiction',
          `${data.workerState || ''}`.trim().length ? String(data.workerState).trim() : '—',
        ],
        ...(data.jobTitle?.trim?.() || month.jobTitle?.trim?.() ||
        data.department?.trim?.() ||
        month.department?.trim?.()
          ? [
              [
                'Department / unit',
                `${data.department || month.department || '—'}`.trim(),
                'Job title',
                `${data.jobTitle || month.jobTitle || '—'}`.trim(),
              ],
            ]
          : []),
      ],
      startY: y + 8,
      margin: { left: side, right: side },
      theme: 'grid',
      tableWidth: pageW - side * 2,
      styles: {
        fontSize: 9,
        cellPadding: { top: 7, bottom: 7, left: 8, right: 8 },
        lineColor: BORDER_LIGHT,
        lineWidth: 0.35,
        valign: 'middle',
      },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: BANNER_MUTED, fillColor: PANEL_BG, cellWidth: 104 },
        1: { textColor: 38 },
        2: { fontStyle: 'bold', textColor: BANNER_MUTED, fillColor: PANEL_BG, cellWidth: 104 },
        3: { textColor: 38 },
      },
    });

    y = doc.lastAutoTable.finalY + 18;

    drawCorporateSectionLabel(doc, side, y, contractor ? 'Gross earnings' : 'Earnings breakdown');

    const earnBody = [];
    if (!contractor) {
      earnBody.push([
        'Regular wages',
        hrs || '—',
        rateStr || 'Salary / flat',
        moneyUsd(regEarnCurr),
        moneyUsd(cumRegEarn),
      ]);
      if (supplementalCurr > 1e-2) {
        earnBody.push([
          'Supplemental / bonus earnings',
          '—',
          '—',
          moneyUsd(supplementalCurr),
          moneyUsd(ytdSupplementalAmt),
        ]);
      }
    } else {
      earnBody.push(['Contract gross (statutory payout)', '—', '—', moneyUsd(gross), moneyUsd(cumGross)]);
    }
    const earnSummaryRowIndex = earnBody.length;
    earnBody.push(['TOTAL GROSS EARNINGS', '', '', moneyUsd(gross), moneyUsd(cumGross)]);

    autoTable(doc, {
      head: [['Earnings · description', 'Hours / qty.', 'Rate', 'Amount · current period', 'Amount · year-to-date']],
      body: earnBody,
      startY: y + 10,
      margin: { left: side, right: side },
      theme: 'grid',
      styles: {
        fontSize: 9,
        lineColor: BORDER_LIGHT,
        cellPadding: 5,
        valign: 'middle',
      },
      headStyles: {
        fillColor: BANNER,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
      },
      bodyStyles: { textColor: 38 },
      columnStyles: { 3: { halign: 'right', fontStyle: 'normal' }, 4: { halign: 'right' }, 0: { cellWidth: 186 } },
      didParseCell: (hookData) => {
        if (hookData.section !== 'body') return;
        if (hookData.row.index === earnSummaryRowIndex) {
          hookData.cell.styles.fillColor = PANEL_BG;
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.textColor = BANNER[0];
          return;
        }
        if (hookData.row.index % 2 === 1) {
          hookData.cell.styles.fillColor = ZEBRA;
        }
      },
    });

    y = doc.lastAutoTable.finalY + 22;

    drawCorporateSectionLabel(
      doc,
      side,
      y,
      contractor ? 'Withholdings summary' : 'Taxes · insurance · deductions',
    );

    const dedBody = [];
    if (!contractor) {
      dedBody.push([
        'Federal income tax withholding (employee estimate)',
        moneyUsd(federal),
        moneyUsd(cumFed),
      ]);
      dedBody.push([
        `Social Security (OASDI) · EE share · statutory 6.${2}%`,
        moneyUsd(ssAmt),
        moneyUsd(cumSs),
      ]);
      dedBody.push([
        medicareTotal > 0 && medClassic + medAdditional > 1e-2
          ? 'Medicare Hospital Insurance · EE · 1.45% base'
          : 'Medicare (HI)',
        moneyUsd(medClassic),
        moneyUsd(cumMedClassic),
      ]);
      if (medAdditional > 1e-2) {
        dedBody.push(['Additional Medicare tax (0.9% over threshold)', moneyUsd(medAdditional), moneyUsd(cumMedAdd)]);
      }
      dedBody.push(
        [
          data.workerState && String(data.workerState).trim().length > 0
            ? `State income tax withholdings (${String(data.workerState).trim()})`
            : 'State / local withholdings (estimate)',
          moneyUsd(stateInc),
          moneyUsd(cumState),
        ],
      );
      if (otherAmt > 1e-4) {
        dedBody.push([`${otherLbl} (after-tax)`, moneyUsd(otherAmt), moneyUsd(cumOther)]);
      }
      const deductionTotalRowIx = dedBody.length;
      dedBody.push([
        'Total deductions · all categories',
        moneyUsd(totalDedCurr),
        moneyUsd(totalDedYtd),
      ]);

      autoTable(doc, {
        head: [['Deductions · description', 'Current period total', 'Year-to-date total']],
        body: dedBody,
        startY: y + 10,
        margin: { left: side, right: side },
        theme: 'grid',
        styles: {
          fontSize: 9,
          lineColor: BORDER_LIGHT,
          cellPadding: 5,
          valign: 'middle',
        },
        headStyles: {
          fillColor: BANNER,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8.5,
        },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 0: { cellWidth: 310 } },
        didParseCell: (hookData) => {
          if (hookData.section !== 'body') return;
          if (hookData.row.index === deductionTotalRowIx) {
            hookData.cell.styles.fillColor = PANEL_BG;
            hookData.cell.styles.fontStyle = 'bold';
            hookData.cell.styles.textColor = BANNER[0];
            return;
          }
          if (hookData.row.index % 2 === 1) {
            hookData.cell.styles.fillColor = ZEBRA;
          }
        },
      });
    } else {
      dedBody.push(['Statutory withholdings withheld by payer', moneyUsd(0), moneyUsd(0)]);
      dedBody.push([
        'Self-employment obligations (estimated separately)',
        '—',
        '—',
      ]);
      autoTable(doc, {
        head: [['Withholdings · description', 'Current period total', 'Year-to-date total']],
        body: dedBody,
        startY: y + 10,
        margin: { left: side, right: side },
        theme: 'grid',
        styles: { fontSize: 9, lineColor: BORDER_LIGHT, cellPadding: 5 },
        headStyles: { fillColor: BANNER, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 0: { cellWidth: 310 } },
      });
    }

    y = doc.lastAutoTable.finalY + 22;

    drawCorporateSectionLabel(doc, side, y, 'Pay summary');

    doc.setFillColor(BANNER[0], BANNER[1], BANNER[2]);
    doc.roundedRect(side, y + 8, pageW - side * 2, 78, 2, 2, 'F');
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(1);
    doc.line(side + 14, y + 18, side + 14, y + 76);

    const sumX = side + 26;
    let sy = y + 34;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(220, 224, 230);
    doc.text('Total gross earnings', sumX, sy);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(moneyUsd(gross), pageW - side - 18, sy, { align: 'right' });
    sy += 16;

    doc.setFont('helvetica', 'normal');
    doc.text(contractor ? 'Less: statutory withholdings' : 'Less: total deductions · taxes · other', sumX, sy);
    doc.setFont('helvetica', 'bold');
    doc.text(`(${moneyUsd(totalDedCurr)})`, pageW - side - 18, sy, { align: 'right' });
    sy += 22;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.text('Net payment to worker', sumX, sy);
    doc.text(moneyUsd(netCurr), pageW - side - 18, sy, { align: 'right' });

    sy += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 205, 214);
    doc.text(`Year-to-date net (calendar YTD shown): ${moneyUsd(netYtd)}`, sumX, sy);

    y = y + 8 + 78 + 20;

    doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
    doc.setLineWidth(0.35);
    doc.line(side, y, pageW - side, y);

    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.75);
    doc.setTextColor(110, 115, 122);
    const ytdExplain = doc.splitTextToSize(
      `YTD columns use calendar-year ${format(payDateObj, 'yyyy')}: summed gross and withholdings for every exported stub with the same year and period-end on or before ${format(payDateObj, 'MMM d, yyyy')} (chronological by date). Optional baseline adds earlier-in-year totals.`,
      pageW - side * 2,
    );
    doc.text(ytdExplain, side, y);
    y += ytdExplain.length * 9 + 8;

    if (P.ytdBannerNote) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.75);
      doc.setTextColor(160, 90, 50);
      const warnLines = doc.splitTextToSize(P.ytdBannerNote, pageW - side * 2);
      doc.text(warnLines, side, y);
      y += warnLines.length * 10 + 4;
      doc.setTextColor(120, 126, 135);
      doc.setFontSize(7);
    }

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(120, 126, 135);
    doc.text(
      contractor
        ? 'This payout advice summarizes contractor compensation. It does not constitute a payroll tax withholding record.'
        : 'This earnings statement summarizes compensation for informational purposes.',
      side,
      y,
      { maxWidth: pageW - side * 2 },
    );

    const legalExtra = contractor
      ? `${
          data.contractorDisclaimer || ''
        }`.trim()
      : `${
          data.payStubDisclaimer || data.taxCalculationNote || ''
        }`.trim();

    if (legalExtra.length) {
      y += 12;
      const wrapped = doc.splitTextToSize(legalExtra, pageW - side * 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(110, 115, 125);
      doc.text(wrapped, side, Math.min(pageH - 56, y));
      y += wrapped.length * 9;
    }

    y += legalExtra.length ? 6 : 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 155, 164);
    const footParts = [
      'Not a negotiable instrument or check substitute.',
      contractor ? '' : 'Withholding projections are illustrative only—defer to payroll service tax tables.',
      'Retain for your permanent records.',
    ].filter(Boolean);
    doc.text(footParts.join(' '), side, Math.min(pageH - 42, Math.max(y, pageH - 58)), {
      maxWidth: pageW - side * 2,
    });

    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.text(`DOCUMENT REF · ${statementRef}`, side, Math.min(pageH - 26, pageH - 34));
    doc.text(`Generated electronically`, pageW - side, Math.min(pageH - 26, pageH - 34), {
      align: 'right',
    });
  });

  const safeStem = `${data.employeeName || 'earning-statement'}`
    .replace(/[^\w\s-]/gu, '')
    .replace(/\s+/g, '-');

  doc.save(`${safeStem || 'pay-documentation'}-${prepared.length}-periods.pdf`);
}
