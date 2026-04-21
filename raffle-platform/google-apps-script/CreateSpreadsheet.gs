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

var RAFFLE_HEADERS = ['slug', 'raffleId', 'title', 'subtitle', 'imageUrl', 'sortOrder', 'active'];

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

function writeHeadersAndSamples_(ss) {
  var shEv = ss.getSheetByName('Events');
  shEv.getRange(1, 1, 1, EVENT_HEADERS.length).setValues([EVENT_HEADERS]);
  shEv.getRange(2, 1, 2, EVENT_HEADERS.length).setValues([
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
  ]);
  shEv.setFrozenRows(1);
  formatHeaderRow_(shEv, EVENT_HEADERS.length);

  var shRf = ss.getSheetByName('Raffles');
  shRf.getRange(1, 1, 1, RAFFLE_HEADERS.length).setValues([RAFFLE_HEADERS]);
  shRf.getRange(2, 1, 4, RAFFLE_HEADERS.length).setValues([
    ['grand-opening', 'grand-prize', 'Grand prize bundle', 'Top prize pool — multiple items', '', 1, true],
    ['grand-opening', 'runner-up', 'Runner-up package', 'Second-draw pool', '', 2, true],
    ['grand-opening', 'door-prize', 'Door prizes', 'Random draws throughout the day', '', 3, true],
  ]);
  shRf.setFrozenRows(1);
  formatHeaderRow_(shRf, RAFFLE_HEADERS.length);

  var shEn = ss.getSheetByName('Entries');
  shEn.getRange(1, 1, 1, ENTRY_HEADERS.length).setValues([ENTRY_HEADERS]);
  shEn.setFrozenRows(1);
  formatHeaderRow_(shEn, ENTRY_HEADERS.length);

  var shW = ss.getSheetByName('Winners');
  shW.getRange(1, 1, 1, WINNER_HEADERS.length).setValues([WINNER_HEADERS]);
  shW.setFrozenRows(1);
  formatHeaderRow_(shW, WINNER_HEADERS.length);
}

function formatHeaderRow_(sheet, numCols) {
  var r = sheet.getRange(1, 1, 1, numCols);
  r.setFontWeight('bold');
  r.setBackground('#1a1a1a');
  r.setFontColor('#f5f5f4');
}
