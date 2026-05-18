import { jsPDF } from 'jspdf';
import { format, startOfMonth, parseISO, isValid } from 'date-fns';

function parsePayDate(raw) {
  if (!raw) return new Date();
  const d = typeof raw === 'string' ? parseISO(raw) : raw;
  return isValid(d) ? d : new Date();
}

function moneyUsd(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '$0.00';
  return x.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function periodLabel(periodEndDate) {
  const end = periodEndDate;
  const start = startOfMonth(end);
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
}

/**
 * Multi-page PDF: one payslip-style stub per entry.
 * @param {object} data
 * @param {string} data.employerName
 * @param {string} data.employerAddress
 * @param {string} data.employeeName
 * @param {string} [data.employeeId]
 * @param {string} [data.last4Ssn]
 * @param {string} data.payFrequency
 * @param {Array<object>} data.months — length 3; each has periodEnd (yyyy-mm-dd), gross, federal, state, socialSecurity, medicare, otherLabel?, otherAmount?
 */
export function generatePayStubsPdf(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const rightCol = pageW - margin;
  const contentW = pageW - margin * 2;

  const months = Array.isArray(data.months) ? data.months : [];

  months.forEach((month, idx) => {
    if (idx > 0) doc.addPage();

    const pe = parsePayDate(month.periodEnd);
    const gross = Number(month.gross) || 0;
    const federal = Number(month.federal) || 0;
    const state = Number(month.state) || 0;
    const ss = Number(month.socialSecurity) || 0;
    const med = Number(month.medicare) || 0;
    const other = Number(month.otherAmount) || 0;
    const net = Math.max(0, gross - federal - state - ss - med - other);

    let y = margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 30, 30);
    doc.text(data.employerName || 'Employer', margin, y);
    y += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const addr = (data.employerAddress || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (addr.length === 0) {
      doc.setTextColor(120, 120, 120);
      doc.text('(Add employer address on the form)', margin, y);
      y += 14;
      doc.setTextColor(30, 30, 30);
    } else {
      addr.forEach((line) => {
        doc.text(line, margin, y);
        y += 13;
      });
    }
    y += 8;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Pay stub', margin, y);
    y += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const row = (label, value) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, margin, y);
      doc.setFont('helvetica', 'normal');
      const v = value == null || value === '' ? '—' : String(value);
      doc.text(v, margin + 128, y, { maxWidth: contentW - 128 });
      y += 16;
    };

    row('Employee', data.employeeName || '—');
    row('Employee ID', data.employeeId || month.employeeId || '—');
    if (data.last4Ssn && String(data.last4Ssn).trim()) {
      row('SSN (last 4)', `***-**-${String(data.last4Ssn).trim()}`);
    }
    row('Pay frequency', data.payFrequency || '—');
    row('Pay period', periodLabel(pe));
    row('Pay date', format(pe, 'MMM d, yyyy'));
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Earnings & deductions', margin, y);
    y += 16;
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, rightCol, y);
    y += 18;

    const lineAmount = (label, amount, opts = {}) => {
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setFontSize(opts.size || 10);
      doc.text(label, margin, y);
      doc.text(moneyUsd(amount), rightCol, y, { align: 'right' });
      y += opts.gap ?? 17;
    };

    doc.setFont('helvetica', 'normal');
    lineAmount('Gross pay', gross);

    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text('Deductions', margin, y);
    y += 14;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);

    const deds = [
      ['Federal income tax', federal],
      ['Social Security', ss],
      ['Medicare', med],
      ['State income tax', state],
    ];
    if (other > 0) {
      const ol = month.otherLabel?.trim() || 'Other deduction';
      deds.push([ol, other]);
    }

    deds.forEach(([label, amt]) => {
      if (amt > 0) lineAmount(label, amt);
    });

    doc.line(margin, y + 4, rightCol, y + 4);
    y += 22;
    lineAmount('Net pay', net, { bold: true, size: 11, gap: 20 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    const disc =
      'Unofficial worksheet for your records only. Figures are entered on this screen — not payroll tax advice. Verify all amounts against your official payroll provider.';
    const splitDisc = doc.splitTextToSize(disc, contentW);
    doc.text(splitDisc, margin, pageH - 52);
    doc.setTextColor(30, 30, 30);
  });

  const safeName =
    (data.employeeName || 'pay-stubs')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'pay-stubs';
  doc.save(`pay-stubs-3-months-${safeName}.pdf`);
}
