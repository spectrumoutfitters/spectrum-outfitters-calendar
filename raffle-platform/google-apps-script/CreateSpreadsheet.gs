/**
 * ONE-TIME: Create the Spectrum raffle Google Sheet (tabs + headers + sample rows).
 *
 * HOW TO RUN (recommended — new file in Drive):
 * 1. Go to https://script.google.com → New project.
 * 2. Delete the default myFunction code and paste THIS ENTIRE FILE (or merge with Code.gs later).
 * 3. Save. Select function **createSpectrumRaffleSpreadsheet** in the toolbar → Run.
 * 4. Authorize when prompted (needs permission to create spreadsheets).
 * 5. View → Logs (or Execution log) for the new spreadsheet URL. Open it in Drive.
 * 6. Open that new spreadsheet → Extensions → Apps Script → replace script with **Code.gs**
 *    from this repo (the web app handler), Deploy → New deployment → Web app → Anyone.
 * 7. In Events row 2: set **adminKey** to your secret; set **RAFFLE_APPS_SCRIPT_URL** on the server
 *    to this deployment’s /exec URL.
 *
 * ALTERNATIVE: Open any empty Google Sheet → Extensions → Apps Script → paste this file →
 * Run **installRaffleStructureInActiveSpreadsheet** (uses the open spreadsheet instead of creating one).
 */

var EVENT_HEADERS = [
  'slug',
  'name',
  'description',
  'logoUrl',
  'primaryColor',
  'secondaryColor',
  'theme',
  'active',
  'defaultTestMode',
  'adminKey',
  'blockTestWrite',
  'bonusRulesJson',
];

var RAFFLE_HEADERS = ['slug', 'raffleId', 'title', 'subtitle', 'imageUrl', 'valueLabel', 'sortOrder', 'active', 'drawAt'];

var ENTRY_HEADERS = [
  'timestamp',
  'slug',
  'name',
  'phone',
  'email',
  'raffleId',
  'bonusInstagram',
  'bonusReview',
  'bonusReferral',
  'totalEntries',
  'isTest',
  'ip',
  'userAgent',
  'extrasJson',
];

var WINNER_HEADERS = [
  'drawId',
  'timestamp',
  'slug',
  'raffleId',
  'winnerName',
  'winnerPhone',
  'winnerEmail',
  'ticketsInPool',
  'isTest',
];

/** Creates a new Google Spreadbook in your Drive and seeds grand-opening sample data. */
function createSpectrumRaffleSpreadsheet() {
  var name = 'Spectrum Outfitters — Raffle (' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') + ')';
  var ss = SpreadsheetApp.create(name);
  var sheets = ss.getSheets();
  var first = sheets[0];
  first.setName('Events');
  ss.insertSheet('Raffles');
  ss.insertSheet('Entries');
  ss.insertSheet('Winners');

  writeHeadersAndSamples_(ss);
  ss.setActiveSheet(ss.getSheetByName('Events'));

  var url = ss.getUrl();
  Logger.log('CREATED: ' + url);
  try {
    SpreadsheetApp.getUi().alert('Raffle workbook created.\n\nOpen this URL, then bind Code.gs and deploy the web app:\n\n' + url);
  } catch (e) {
    // Standalone script project (no container): open View → Execution log for the URL.
  }
  return url;
}

/**
 * Use when you already have a spreadsheet open (Extensions → Apps Script from that file).
 * Renames the first tab to Events if needed, adds Raffles / Entries / Winners, then writes headers + samples
 * only if Events row 2 is still empty (no slug yet).
 */
function installRaffleStructureInActiveSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ev = ss.getSheetByName('Events');
  if (!ev) {
    ev = ss.getSheets()[0];
    ev.setName('Events');
  }
  if (ev.getLastRow() >= 2 && String(ev.getRange('A2').getValue()).trim() !== '') {
    SpreadsheetApp.getUi().alert(
      'Aborted: Events already has a slug in row 2.\nUse a blank row 2 or run createSpectrumRaffleSpreadsheet() for a new file.',
    );
    return;
  }
  if (!ss.getSheetByName('Raffles')) ss.insertSheet('Raffles');
  if (!ss.getSheetByName('Entries')) ss.insertSheet('Entries');
  if (!ss.getSheetByName('Winners')) ss.insertSheet('Winners');
  writeHeadersAndSamples_(ss);
  SpreadsheetApp.getUi().alert(
    'Raffle structure installed.\n\n1) Set adminKey in Events row 2.\n2) Paste Code.gs into this script project and deploy the web app.',
  );
}

function clearSheetContent_(sh, minCols) {
  var lr = sh.getLastRow();
  var lc = sh.getLastColumn();
  if (lr === 0 && lc === 0) return;
  lr = Math.max(lr, 1);
  lc = Math.max(lc, minCols);
  sh.getRange(1, 1, lr, lc).clearContent();
}

/** 1-based column index → A, B, …, Z, AA, … (for A1 ranges). */
function columnIndexToLetter1_(columnIndex1Based) {
  var col = Math.floor(Number(columnIndex1Based));
  if (col < 1) throw new Error('columnIndexToLetter1_: column out of range: ' + columnIndex1Based);
  var s = '';
  while (col > 0) {
    var rem = (col - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    col = Math.floor((col - rem - 1) / 26);
  }
  return s;
}

/**
 * Writes rows2d to the sheet using an A1 range (avoids 4-arg getRange row/column confusion and
 * JS bugs like startRow + rows2d.length when length is a string).
 */
function setValuesBlock_(sheet, startRow, rows2d) {
  if (!rows2d || !rows2d.length) throw new Error('setValuesBlock_: need at least one data row');
  var r0 = rows2d[0];
  if (r0 == null || typeof r0.length !== 'number') {
    throw new Error('setValuesBlock_: first row must be an array');
  }
  var numRows = Math.floor(Number(rows2d.length));
  var numCols = Math.floor(Number(r0.length));
  if (numRows < 1 || numCols < 1) throw new Error('setValuesBlock_: empty row/column count');
  var startRowN = Math.floor(Number(startRow));
  if (!isFinite(startRowN) || startRowN < 1) throw new Error('setValuesBlock_: bad startRow: ' + startRow);
  var r;
  for (r = 1; r < numRows; r++) {
    var row = rows2d[r];
    if (!row || Math.floor(Number(row.length)) !== numCols) {
      throw new Error('setValuesBlock_: row ' + r + ' width mismatch (expected ' + numCols + ')');
    }
  }
  var endRowN = startRowN + numRows - 1;
  var a1 = columnIndexToLetter1_(1) + startRowN + ':' + columnIndexToLetter1_(numCols) + endRowN;
  sheet.getRange(a1).setValues(rows2d);
}

function writeHeadersAndSamples_(ss) {
  var shEv = ss.getSheetByName('Events');
  clearSheetContent_(shEv, EVENT_HEADERS.length);

  var eventSampleRows = [
    [
      'grand-opening',
      'Grand Opening Giveaway',
      'Enter for a chance to win. One entry per phone number. Bonus tickets for social actions.',
      '',
      '#D4A017',
      '#0c0a09',
      'dark',
      true,
      false,
      'CHANGE_THIS_SECRET_KEY',
      false,
      '',
    ],
  ];
  if (eventSampleRows[0].length !== EVENT_HEADERS.length) {
    throw new Error('Events sample column count mismatch: ' + eventSampleRows[0].length + ' vs ' + EVENT_HEADERS.length);
  }

  setValuesBlock_(shEv, 1, [EVENT_HEADERS]);
  setValuesBlock_(shEv, 2, eventSampleRows);
  shEv.setFrozenRows(1);
  formatHeaderRow_(shEv, EVENT_HEADERS.length);

  var shRf = ss.getSheetByName('Raffles');
  clearSheetContent_(shRf, RAFFLE_HEADERS.length);

  var raffleSampleRows = [
    ['grand-opening', 'grand-prize', 'Grand prize bundle', 'Top prize pool — multiple items', '', '$500+ retail value · No purchase necessary', 1, true, ''],
    ['grand-opening', 'runner-up', 'Runner-up package', 'Second-draw pool', '', '$150+ in gear', 2, true, ''],
    ['grand-opening', 'door-prize', 'Door prizes', 'Random draws throughout the day', '', 'Surprise bundles', 3, true, ''],
  ];
  for (var ri = 0; ri < raffleSampleRows.length; ri++) {
    if (raffleSampleRows[ri].length !== RAFFLE_HEADERS.length) {
      throw new Error('Raffles sample row ' + ri + ' column count mismatch');
    }
  }

  setValuesBlock_(shRf, 1, [RAFFLE_HEADERS]);
  setValuesBlock_(shRf, 2, raffleSampleRows);
  shRf.setFrozenRows(1);
  formatHeaderRow_(shRf, RAFFLE_HEADERS.length);

  var shEn = ss.getSheetByName('Entries');
  clearSheetContent_(shEn, ENTRY_HEADERS.length);
  setValuesBlock_(shEn, 1, [ENTRY_HEADERS]);
  shEn.setFrozenRows(1);
  formatHeaderRow_(shEn, ENTRY_HEADERS.length);

  var shW = ss.getSheetByName('Winners');
  clearSheetContent_(shW, WINNER_HEADERS.length);
  setValuesBlock_(shW, 1, [WINNER_HEADERS]);
  shW.setFrozenRows(1);
  formatHeaderRow_(shW, WINNER_HEADERS.length);
}

function formatHeaderRow_(sheet, numCols) {
  var n = Math.floor(Number(numCols));
  var r = sheet.getRange('A1:' + columnIndexToLetter1_(n) + '1');
  r.setFontWeight('bold');
  r.setBackground('#1a1a1a');
  r.setFontColor('#f5f5f4');
}
