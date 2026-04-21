/**
 * Bind this project to your Google Spreadsheet (Extensions > Apps Script from the sheet).
 * Deploy > New deployment > Web app:
 * - Execute as: Me
 * - Who has access: Anyone
 *
 * Script Properties (Project Settings):
 * - ADMIN_MASTER_KEY: optional global fallback if Events.adminKey is blank
 *
 * Sheets (first row = headers):
 *
 * Events
 *   slug, name, description, logoUrl, primaryColor, secondaryColor, theme, active, defaultTestMode, adminKey, blockTestWrite
 *   - theme: "dark" or "light"
 *   - active: TRUE/FALSE
 *   - defaultTestMode: TRUE flags entries as test when not using ?test=1
 *   - adminKey: secret for /admin API; if blank, ADMIN_MASTER_KEY is used
 *   - blockTestWrite: TRUE skips writing test rows (returns success message only)
 *
 * Script Properties (optional):
 *   ENTRY_BASE_URL — public raffle site origin, no trailing slash (e.g. https://raffle.example.com).
 *   Used to email magic links so entrants can view/update tickets until 10 minutes before each pool’s drawAt.
 *
 * Raffles
 *   slug, raffleId, title, subtitle, imageUrl, valueLabel, sortOrder, active, drawAt (optional)
 *   - valueLabel: short text shown on the entry page (e.g. "$450+ retail · No purchase necessary")
 *   - drawAt: optional ISO datetime (event local time as text) when that pool is drawn; locks ticket edits at T−10 minutes
 *
 * Events — optional column:
 *   bonusRulesJson: JSON array of bonus rules. Each object may include:
 *   id, label, description, tickets, actionUrl, actionLabel, proofFields (array of
 *   { id, input: "text"|"url"|"textarea", label, placeholder, requiredWhenBonus }).
 *   If blank, built-in defaults match the raffle app (Instagram, TikTok, Facebook, story tag, review, referral).
 *
 * Entries (created automatically in column order)
 *   timestamp, slug, name, phone, email, raffleId, bonusInstagram, bonusReview, bonusReferral, totalEntries, isTest, ip, userAgent, extrasJson
 *   — extrasJson includes per-id bonus toggles, optional __bonusProof, __entryToken (magic link), __splitRaffleIds.
 *   — totalEntries may be fractional when ticketMode is "split" (one sheet row per pool; weights sum to the entrant's full ticket count).
 *
 * Winners (optional but recommended)
 *   drawId, timestamp, slug, raffleId, winnerName, winnerPhone, winnerEmail, ticketsInPool, isTest
 *
 * Admin (POST, requires Events.adminKey or ADMIN_MASTER_KEY):
 *   getAdminEventConfig — { slug, adminKey } → { event, raffles } for the admin UI (no adminKey in response).
 *   saveEventConfig — { slug, adminKey, event: partial fields, raffles: [{ raffleId, title, subtitle, imageUrl, valueLabel, sortOrder, active }] }
 *   replaces all Raffles rows for that slug and updates allowed Events columns (never overwrites adminKey from JSON).
 *
 * Performance: 500+ concurrent readers are fine; writes serialize per spreadsheet. For very high write volume,
 * shard events across spreadsheets or add a queue (e.g. Form → Sheet → batch processor).
 *
 * New workbook from scratch: see CreateSpreadsheet.gs in this folder (createSpectrumRaffleSpreadsheet).
 * If you merge that code into this file, avoid getRange(2, 1, 1, lastCol): row 2 to row 1 is two rows;
 * sample data must use end row 2 for a single row (CreateSpreadsheet uses setValuesBlock_ for this).
 */

var SHEET_EVENTS = 'Events';
var SHEET_RAFFLES = 'Raffles';
var SHEET_ENTRIES = 'Entries';
var SHEET_WINNERS = 'Winners';

function jsonResponse(obj, status) {
  status = status || 200;
  var out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function getAdminMasterKey_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_MASTER_KEY') || '';
}

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function findEventRow_(slug) {
  var sh = getSpreadsheet_().getSheetByName(SHEET_EVENTS);
  if (!sh) throw new Error('Missing sheet: ' + SHEET_EVENTS);
  var values = sh.getDataRange().getValues();
  if (!values.length) return null;
  var headers = values[0];
  var colSlug = headers.indexOf('slug');
  if (colSlug < 0) throw new Error('Events sheet needs slug column');
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][colSlug]).trim() === String(slug).trim()) {
      return { row: r + 1, headers: headers, record: values[r] };
    }
  }
  return null;
}

function recordToObject_(headers, row) {
  var o = {};
  for (var i = 0; i < headers.length; i++) {
    o[String(headers[i]).trim()] = row[i];
  }
  return o;
}

var RAFFLE_DEFAULT_IG_ = 'https://www.instagram.com/spectrum.outfitters/';
var RAFFLE_DEFAULT_TT_ = 'https://www.tiktok.com/@spectrumoutfitters';
var RAFFLE_DEFAULT_FB_ = 'https://www.facebook.com/spectrumoutfitters';

function getDefaultBonuses_() {
  return [
    {
      id: 'instagram',
      label: 'Instagram — follow us',
      description: 'Follow the shop, then leave your @ so we can match your account before prizes.',
      tickets: 3,
      actionUrl: RAFFLE_DEFAULT_IG_,
      actionLabel: 'Open Instagram',
      proofFields: [
        { id: 'handle', input: 'text', label: 'Your Instagram @username', placeholder: '@yourhandle', requiredWhenBonus: true },
      ],
    },
    {
      id: 'tiktok',
      label: 'TikTok — follow us',
      description: 'Follow on TikTok for extra entries. We verify follows manually if you win.',
      tickets: 2,
      actionUrl: RAFFLE_DEFAULT_TT_,
      actionLabel: 'Open TikTok',
      proofFields: [
        { id: 'handle', input: 'text', label: 'Your TikTok @username', placeholder: '@yourhandle', requiredWhenBonus: true },
      ],
    },
    {
      id: 'facebook',
      label: 'Facebook — like our page',
      description: 'Like Spectrum Outfitters on Facebook (public page). Optional note helps us verify.',
      tickets: 2,
      actionUrl: RAFFLE_DEFAULT_FB_,
      actionLabel: 'Open Facebook',
      proofFields: [
        { id: 'note', input: 'text', label: 'First name on Facebook (optional)', placeholder: 'So we can spot your like', requiredWhenBonus: false },
      ],
    },
    {
      id: 'story_tag',
      label: 'Story or reel — tag us',
      description: 'Post a public story or reel tagging the shop. Link helps us verify faster.',
      tickets: 4,
      actionUrl: '',
      actionLabel: '',
      proofFields: [
        { id: 'handle', input: 'text', label: 'Your @ on that post', placeholder: '@yourhandle', requiredWhenBonus: true },
        { id: 'postUrl', input: 'url', label: 'Link to the post (optional)', placeholder: 'https://…', requiredWhenBonus: false },
      ],
    },
    {
      id: 'review',
      label: 'Leave a review',
      description: 'Google, Facebook, Yelp, etc. Tell us where and (if you can) paste the review link.',
      tickets: 6,
      actionUrl: '',
      actionLabel: '',
      proofFields: [
        { id: 'platform', input: 'text', label: 'Where did you review?', placeholder: 'e.g. Google Maps, Facebook', requiredWhenBonus: true },
        { id: 'reviewUrl', input: 'url', label: 'Link to your review (optional)', placeholder: 'https://…', requiredWhenBonus: false },
      ],
    },
    {
      id: 'referral',
      label: 'Refer a friend',
      description: 'They must submit their own entry and type your full name when asked.',
      tickets: 4,
      actionUrl: '',
      actionLabel: '',
      proofFields: [
        { id: 'friendName', input: 'text', label: "Friend's full name (as they'll enter it)", placeholder: 'First Last', requiredWhenBonus: true },
      ],
    },
  ];
}

function cloneProofFieldsFromBonus_(b) {
  if (!b || !Array.isArray(b.proofFields)) return [];
  var out = [];
  for (var i = 0; i < b.proofFields.length; i++) {
    var f = b.proofFields[i];
    if (!f || typeof f !== 'object') continue;
    var id = String(f.id || '').trim();
    if (!id) continue;
    out.push({
      id: id,
      input: String(f.input || 'text'),
      label: String(f.label || id),
      placeholder: f.placeholder != null ? String(f.placeholder) : '',
      requiredWhenBonus: Boolean(f.requiredWhenBonus),
    });
  }
  return out;
}

/**
 * Old workbooks stored bonusRulesJson as exactly three rules (instagram, review, referral) with no proofFields.
 * Those rows should use the current default ladder (TikTok, Facebook, story tag, proof fields, etc.).
 */
function isLegacyThreeRuleBonusConfig_(out) {
  if (!out || out.length !== 3) return false;
  var seen = { instagram: false, review: false, referral: false };
  for (var i = 0; i < out.length; i++) {
    var id = String(out[i].id || '').trim();
    if (id === 'instagram' || id === 'review' || id === 'referral') {
      if (seen[id]) return false;
      seen[id] = true;
    } else {
      return false;
    }
    var pf = out[i].proofFields;
    if (pf && pf.length) return false;
  }
  return seen.instagram && seen.review && seen.referral;
}

function getDefaultBonusById_(id) {
  var defs = getDefaultBonuses_();
  for (var di = 0; di < defs.length; di++) {
    if (defs[di].id === id) return defs[di];
  }
  return null;
}

/** Sheet JSON often omits proofFields / actionUrl — merge from getDefaultBonuses_ when id matches. */
function mergeParsedBonusWithDefaults_(rule) {
  var d = getDefaultBonusById_(rule.id);
  if (!d) return rule;
  var hasPf = rule.proofFields && rule.proofFields.length;
  var pf = hasPf ? rule.proofFields : cloneProofFieldsFromBonus_(d);
  var tickets = Number(rule.tickets);
  if (!tickets || tickets < 1 || tickets > 100) tickets = Number(d.tickets) || 1;
  return {
    id: rule.id,
    label: String(rule.label || d.label),
    description:
      rule.description != null && String(rule.description) !== '' ? String(rule.description) : String(d.description || ''),
    tickets: tickets,
    actionUrl: rule.actionUrl ? String(rule.actionUrl).trim() : d.actionUrl,
    actionLabel: rule.actionLabel ? String(rule.actionLabel).trim() : d.actionLabel,
    proofFields: pf,
  };
}

function parseBonusRulesFromRow_(o) {
  var raw = String(o.bonusRulesJson || o.bonus_rules_json || '').trim();
  if (!raw) return getDefaultBonuses_();
  try {
    var arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return getDefaultBonuses_();
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var b = arr[i];
      if (!b || typeof b !== 'object') continue;
      var id = String(b.id || '').trim();
      if (!id) continue;
      var tickets = Number(b.tickets);
      if (!tickets || tickets < 1 || tickets > 100) tickets = 1;
      var actionUrl = b.actionUrl != null ? String(b.actionUrl).trim() : '';
      var actionLabel = b.actionLabel != null ? String(b.actionLabel).trim() : '';
      out.push({
        id: id,
        label: String(b.label || id),
        description: String(b.description || ''),
        tickets: tickets,
        actionUrl: actionUrl,
        actionLabel: actionLabel,
        proofFields: cloneProofFieldsFromBonus_(b),
      });
    }
    if (!out.length) return getDefaultBonuses_();
    if (isLegacyThreeRuleBonusConfig_(out)) return getDefaultBonuses_();
    var merged = [];
    for (var mi = 0; mi < out.length; mi++) merged.push(mergeParsedBonusWithDefaults_(out[mi]));
    return merged;
  } catch (err) {
    return getDefaultBonuses_();
  }
}

function validateBonusProof_(proof, rules, bonusById) {
  proof = proof && typeof proof === 'object' && !Array.isArray(proof) ? proof : {};
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    if (!bonusById[rule.id]) continue;
    var fields = rule.proofFields || [];
    for (var j = 0; j < fields.length; j++) {
      var f = fields[j];
      if (!f.requiredWhenBonus) continue;
      var sub = proof[rule.id];
      var v = sub && sub[f.id] != null ? String(sub[f.id]).trim() : '';
      if (!v) {
        return 'Please fill in "' + f.label + '" for ' + rule.label + ' (required for those bonus tickets).';
      }
    }
    for (var k = 0; k < fields.length; k++) {
      var ff = fields[k];
      if (String(ff.input) !== 'url') continue;
      var sub2 = proof[rule.id];
      var v2 = sub2 && sub2[ff.id] != null ? String(sub2[ff.id]).trim() : '';
      if (!v2) continue;
      if (!/^https:\/\//i.test(v2)) {
        return 'For ' + rule.label + ', use an https:// link in "' + ff.label + '".';
      }
    }
  }
  return null;
}

function trimBonusProofForSubmit_(proof, rules) {
  proof = proof && typeof proof === 'object' && !Array.isArray(proof) ? proof : {};
  var out = {};
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    var sub = proof[rule.id];
    if (!sub || typeof sub !== 'object' || Array.isArray(sub)) continue;
    var cleaned = {};
    var fields = rule.proofFields || [];
    for (var j = 0; j < fields.length; j++) {
      var f = fields[j];
      var v = sub[f.id] != null ? String(sub[f.id]).trim().slice(0, 500) : '';
      if (v) cleaned[f.id] = v;
    }
    var keys = [];
    for (var key in cleaned) {
      if (cleaned.hasOwnProperty(key)) keys.push(key);
    }
    if (keys.length) out[rule.id] = cleaned;
  }
  return out;
}

function computeTicketsFromBonuses_(bonusById, rules) {
  var n = 1;
  for (var i = 0; i < rules.length; i++) {
    var id = rules[i].id;
    if (bonusById[id]) n += Number(rules[i].tickets) || 0;
  }
  return n;
}

function validateAdminKey_(slug, adminKey) {
  var found = findEventRow_(slug);
  if (!found) return false;
  var o = recordToObject_(found.headers, found.record);
  var per = String(o.adminKey || '').trim();
  if (per && per === String(adminKey).trim()) return true;
  var master = getAdminMasterKey_();
  if (master && master === String(adminKey).trim()) return true;
  return false;
}

function getRafflesForSlug_(slug) {
  var sh = getSpreadsheet_().getSheetByName(SHEET_RAFFLES);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var colSlug = headers.indexOf('slug');
  var colId = headers.indexOf('raffleId');
  var colTitle = headers.indexOf('title');
  var colSubtitle = headers.indexOf('subtitle');
  var colImage = headers.indexOf('imageUrl');
  var colValue = headers.indexOf('valueLabel');
  var colSort = headers.indexOf('sortOrder');
  var colActive = headers.indexOf('active');
  var colDrawAt = headers.indexOf('drawAt');
  if (colSlug < 0 || colId < 0 || colTitle < 0) {
    throw new Error('Raffles sheet needs slug, raffleId, title columns');
  }
  var list = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (String(row[colSlug]).trim() !== String(slug).trim()) continue;
    var active = colActive < 0 ? true : String(row[colActive]).toUpperCase() !== 'FALSE';
    if (!active) continue;
    list.push({
      id: String(row[colId]).trim(),
      title: String(row[colTitle]),
      subtitle: colSubtitle < 0 ? '' : String(row[colSubtitle] || ''),
      imageUrl: colImage < 0 ? '' : String(row[colImage] || ''),
      valueLabel: colValue < 0 ? '' : String(row[colValue] || ''),
      sortOrder: colSort < 0 ? r : Number(row[colSort]) || r,
      drawAt: colDrawAt < 0 ? '' : String(row[colDrawAt] || '').trim(),
    });
  }
  list.sort(function (a, b) {
    return a.sortOrder - b.sortOrder;
  });
  return list;
}

/** All raffle rows for slug (including inactive), for admin editor. */
function getRafflesAllForSlug_(slug) {
  var sh = getSpreadsheet_().getSheetByName(SHEET_RAFFLES);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var colSlug = headers.indexOf('slug');
  var colId = headers.indexOf('raffleId');
  var colTitle = headers.indexOf('title');
  var colSubtitle = headers.indexOf('subtitle');
  var colImage = headers.indexOf('imageUrl');
  var colValue = headers.indexOf('valueLabel');
  var colSort = headers.indexOf('sortOrder');
  var colActive = headers.indexOf('active');
  var colDrawAt = headers.indexOf('drawAt');
  if (colSlug < 0 || colId < 0 || colTitle < 0) {
    throw new Error('Raffles sheet needs slug, raffleId, title columns');
  }
  var list = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (String(row[colSlug]).trim() !== String(slug).trim()) continue;
    var active = colActive < 0 ? true : String(row[colActive]).toUpperCase() !== 'FALSE';
    list.push({
      id: String(row[colId]).trim(),
      raffleId: String(row[colId]).trim(),
      title: String(row[colTitle]),
      subtitle: colSubtitle < 0 ? '' : String(row[colSubtitle] || ''),
      imageUrl: colImage < 0 ? '' : String(row[colImage] || ''),
      valueLabel: colValue < 0 ? '' : String(row[colValue] || ''),
      sortOrder: colSort < 0 ? r : Number(row[colSort]) || r,
      active: active,
      drawAt: colDrawAt < 0 ? '' : String(row[colDrawAt] || '').trim(),
    });
  }
  list.sort(function (a, b) {
    return a.sortOrder - b.sortOrder;
  });
  return list;
}

function isValidRaffleId_(id) {
  var s = String(id || '').trim();
  if (s.length < 1 || s.length > 48) return false;
  return /^[a-zA-Z0-9_-]+$/.test(s);
}

function isSafeHttpsImageUrl_(url) {
  var u = String(url || '').trim();
  if (!u) return true;
  if (u.length > 2048) return false;
  var lower = u.toLowerCase();
  if (lower.indexOf('https://') === 0) return true;
  /* Same-origin uploads from raffle admin: /raffle-images/slug/file.jpg */
  if (lower.indexOf('/') === 0 && lower.indexOf('//') !== 0 && lower.indexOf('/raffle-images/') === 0) return true;
  return false;
}

function buildRaffleRowArray_(headers, slug, r) {
  var rid = String(r.raffleId || r.id || '').trim();
  var title = String(r.title || '').trim();
  var subtitle = String(r.subtitle || '');
  var imageUrl = String(r.imageUrl || '').trim();
  var valueLabel = String(r.valueLabel || '').trim().slice(0, 160);
  var sortOrder = Number(r.sortOrder);
  if (!isFinite(sortOrder) || sortOrder < 0) sortOrder = 0;
  var active = r.active === false || String(r.active).toUpperCase() === 'FALSE' ? false : true;
  var out = [];
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c]).trim();
    if (h === 'slug') out.push(slug);
    else if (h === 'raffleId') out.push(rid);
    else if (h === 'title') out.push(title);
    else if (h === 'subtitle') out.push(subtitle);
    else if (h === 'imageUrl') out.push(imageUrl);
    else if (h === 'valueLabel') out.push(valueLabel);
    else if (h === 'sortOrder') out.push(sortOrder);
    else if (h === 'active') out.push(active ? 'TRUE' : 'FALSE');
    else if (h === 'drawAt') out.push(String(r.drawAt != null ? r.drawAt : '').trim().slice(0, 50));
    else out.push('');
  }
  return out;
}

/** Inserts valueLabel column after imageUrl when missing (one-time migration on save). */
function ensureValueLabelColumn_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return;
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var names = [];
  var i;
  for (i = 0; i < headers.length; i++) {
    names.push(String(headers[i]).trim());
  }
  if (names.indexOf('valueLabel') >= 0) return;
  var imgIdx = names.indexOf('imageUrl');
  if (imgIdx >= 0) {
    sh.insertColumnAfter(imgIdx + 1);
    sh.getRange(1, imgIdx + 2).setValue('valueLabel');
  } else {
    sh.getRange(1, lastCol + 1).setValue('valueLabel');
  }
}

function ensureDrawAtColumn_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return;
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var names = [];
  var j;
  for (j = 0; j < headers.length; j++) {
    names.push(String(headers[j]).trim());
  }
  if (names.indexOf('drawAt') >= 0) return;
  sh.getRange(1, lastCol + 1).setValue('drawAt');
}

function replaceRafflesForSlug_(slug, raffles) {
  var sh = getSpreadsheet_().getSheetByName(SHEET_RAFFLES);
  if (!sh) throw new Error('Missing sheet: ' + SHEET_RAFFLES);
  ensureValueLabelColumn_(sh);
  ensureDrawAtColumn_(sh);
  var values = sh.getDataRange().getValues();
  if (!values.length) throw new Error('Raffles sheet is empty');
  var headers = values[0];
  var colSlug = headers.indexOf('slug');
  if (colSlug < 0) throw new Error('Raffles sheet needs slug column');
  var toDelete = [];
  var r;
  for (r = values.length - 1; r >= 1; r--) {
    if (String(values[r][colSlug]).trim() === String(slug).trim()) {
      toDelete.push(r + 1);
    }
  }
  toDelete.sort(function (a, b) {
    return b - a;
  });
  for (r = 0; r < toDelete.length; r++) {
    sh.deleteRow(toDelete[r]);
  }
  for (var i = 0; i < raffles.length; i++) {
    sh.appendRow(buildRaffleRowArray_(headers, slug, raffles[i]));
  }
}

function updateEventCellsForSlug_(slug, patch) {
  var found = findEventRow_(slug);
  if (!found) throw new Error('event_not_found');
  var sh = getSpreadsheet_().getSheetByName(SHEET_EVENTS);
  var headers = found.headers;
  var rowNum = found.row;
  var allowed = {
    name: true,
    description: true,
    logoUrl: true,
    primaryColor: true,
    secondaryColor: true,
    theme: true,
    active: true,
    defaultTestMode: true,
    blockTestWrite: true,
    bonusRulesJson: true,
  };
  var k;
  for (k in patch) {
    if (!Object.prototype.hasOwnProperty.call(patch, k) || !allowed[k]) continue;
    var col = headers.indexOf(k);
    if (col < 0) continue;
    var v = patch[k];
    if (k === 'active' || k === 'defaultTestMode' || k === 'blockTestWrite') {
      var on = v === true || String(v).toUpperCase() === 'TRUE';
      sh.getRange(rowNum, col + 1).setValue(on ? 'TRUE' : 'FALSE');
    } else if (k === 'bonusRulesJson') {
      sh.getRange(rowNum, col + 1).setValue(String(v || ''));
    } else {
      sh.getRange(rowNum, col + 1).setValue(String(v == null ? '' : v));
    }
  }
}

function handleGetAdminEventConfig_(data) {
  var slug = String(data.slug || '');
  var adminKey = String(data.adminKey || '');
  if (!slug || !validateAdminKey_(slug, adminKey)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }
  var found = findEventRow_(slug);
  if (!found) return jsonResponse({ ok: false, error: 'event_not_found' }, 404);
  var o = recordToObject_(found.headers, found.record);
  var eventOut = {
    name: String(o.name || ''),
    description: String(o.description || ''),
    logoUrl: String(o.logoUrl || ''),
    primaryColor: String(o.primaryColor || '#c9a227'),
    secondaryColor: String(o.secondaryColor || '#1a1a1a'),
    theme: String(o.theme || 'dark') === 'light' ? 'light' : 'dark',
    active: String(o.active || '').toUpperCase() === 'TRUE' || o.active === true,
    defaultTestMode: String(o.defaultTestMode || '').toUpperCase() === 'TRUE' || o.defaultTestMode === true,
    blockTestWrite: String(o.blockTestWrite || '').toUpperCase() === 'TRUE' || o.blockTestWrite === true,
    bonusRulesJson: String(o.bonusRulesJson || ''),
  };
  var raffles = getRafflesAllForSlug_(slug);
  return jsonResponse({ ok: true, slug: slug, event: eventOut, raffles: raffles });
}

function handleSaveEventConfig_(data) {
  var slug = String(data.slug || '');
  var adminKey = String(data.adminKey || '');
  if (!slug || !validateAdminKey_(slug, adminKey)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }
  var found = findEventRow_(slug);
  if (!found) return jsonResponse({ ok: false, error: 'event_not_found' }, 404);

  var eventPatch = data.event && typeof data.event === 'object' ? data.event : {};
  if (eventPatch.logoUrl != null && String(eventPatch.logoUrl).trim() !== '' && !isSafeHttpsImageUrl_(eventPatch.logoUrl)) {
    return jsonResponse({ ok: false, error: 'image_url_must_be_https_or_empty' }, 400);
  }
  if (eventPatch.theme && eventPatch.theme !== 'dark' && eventPatch.theme !== 'light') {
    delete eventPatch.theme;
  }
  if (eventPatch.bonusRulesJson != null && String(eventPatch.bonusRulesJson).trim() !== '') {
    try {
      JSON.parse(String(eventPatch.bonusRulesJson));
    } catch (e) {
      return jsonResponse({ ok: false, error: 'invalid_bonus_rules_json' }, 400);
    }
  }
  var raffles = data.raffles;
  if (!Array.isArray(raffles) || raffles.length < 1) {
    return jsonResponse({ ok: false, error: 'need_at_least_one_raffle' }, 400);
  }
  if (raffles.length > 24) {
    return jsonResponse({ ok: false, error: 'too_many_raffles' }, 400);
  }
  var i;
  var seenIds = {};
  for (i = 0; i < raffles.length; i++) {
    var rr = raffles[i];
    var rid = String(rr.raffleId || rr.id || '').trim();
    if (!isValidRaffleId_(rid)) {
      return jsonResponse({ ok: false, error: 'invalid_raffle_id', raffleIndex: i }, 400);
    }
    if (seenIds[rid]) {
      return jsonResponse({ ok: false, error: 'duplicate_raffle_id', raffleId: rid }, 400);
    }
    seenIds[rid] = true;
    if (String(rr.title || '').trim().length < 1 || String(rr.title).length > 200) {
      return jsonResponse({ ok: false, error: 'invalid_raffle_title', raffleIndex: i }, 400);
    }
    if (String(rr.subtitle || '').length > 500) {
      return jsonResponse({ ok: false, error: 'invalid_raffle_subtitle', raffleIndex: i }, 400);
    }
    if (!isSafeHttpsImageUrl_(rr.imageUrl)) {
      return jsonResponse({ ok: false, error: 'image_url_must_be_https_or_empty', raffleIndex: i }, 400);
    }
    if (String(rr.valueLabel || '').length > 160) {
      return jsonResponse({ ok: false, error: 'invalid_raffle_value_label', raffleIndex: i }, 400);
    }
    if (rr.drawAt != null && String(rr.drawAt).trim().length > 50) {
      return jsonResponse({ ok: false, error: 'invalid_raffle_draw_at', raffleIndex: i }, 400);
    }
    if (rr.drawAt != null && String(rr.drawAt).trim() !== '') {
      var dms = new Date(String(rr.drawAt).trim()).getTime();
      if (isNaN(dms)) {
        return jsonResponse({ ok: false, error: 'invalid_raffle_draw_at', raffleIndex: i }, 400);
      }
    }
  }

  try {
    updateEventCellsForSlug_(slug, eventPatch);
    replaceRafflesForSlug_(slug, raffles);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
  }

  var fresh = findEventRow_(slug);
  if (!fresh) return jsonResponse({ ok: false, error: 'event_not_found_after_save' }, 500);
  var o = recordToObject_(fresh.headers, fresh.record);
  var rafflesOut = getRafflesAllForSlug_(slug);
  var eventOut = {
    name: String(o.name || ''),
    description: String(o.description || ''),
    logoUrl: String(o.logoUrl || ''),
    primaryColor: String(o.primaryColor || '#c9a227'),
    secondaryColor: String(o.secondaryColor || '#1a1a1a'),
    theme: String(o.theme || 'dark') === 'light' ? 'light' : 'dark',
    active: String(o.active || '').toUpperCase() === 'TRUE' || o.active === true,
    defaultTestMode: String(o.defaultTestMode || '').toUpperCase() === 'TRUE' || o.defaultTestMode === true,
    blockTestWrite: String(o.blockTestWrite || '').toUpperCase() === 'TRUE' || o.blockTestWrite === true,
    bonusRulesJson: String(o.bonusRulesJson || ''),
  };
  return jsonResponse({ ok: true, slug: slug, event: eventOut, raffles: rafflesOut });
}

function normalizePhone_(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function rateLimitOk_(ip) {
  var cache = CacheService.getScriptCache();
  var key = 'rl:' + String(ip || 'unknown');
  var raw = cache.get(key);
  var now = Date.now();
  var windowMs = 60 * 60 * 1000;
  var maxHits = 10;
  var times = [];
  if (raw) {
    try {
      times = JSON.parse(raw);
    } catch (e) {
      times = [];
    }
  }
  times = times.filter(function (t) {
    return now - t < windowMs;
  });
  if (times.length >= maxHits) return false;
  times.push(now);
  cache.put(key, JSON.stringify(times), 3600);
  return true;
}

function phoneExistsForSlug_(slug, phoneNorm) {
  var sh = getSpreadsheet_().getSheetByName(SHEET_ENTRIES);
  if (!sh) return false;
  var last = sh.getLastRow();
  if (last < 2) return false;
  var lastCol = Math.max(13, sh.getLastColumn());
  var values = sh.getRange(2, 1, last, lastCol).getValues();
  for (var i = 0; i < values.length; i++) {
    var rowSlug = String(values[i][1] || '');
    var rowPhone = normalizePhone_(values[i][3]);
    if (rowSlug === slug && rowPhone === phoneNorm) return true;
  }
  return false;
}

function generateEntryToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function getEntryBaseUrl_() {
  var p = PropertiesService.getScriptProperties().getProperty('ENTRY_BASE_URL');
  return p ? String(p).trim().replace(/\/$/, '') : '';
}

function trySendManageEntryEmail_(email, entrantName, eventName, slug, token) {
  var base = getEntryBaseUrl_();
  if (!base || !email) return false;
  var path = '/e/' + encodeURIComponent(slug) + '/my-entry?token=' + encodeURIComponent(token);
  var url = base + path;
  var subject = 'Your raffle entry — ' + String(eventName || 'Event');
  var body =
    'Hi ' +
    String(entrantName || 'there') +
    ',\n\nUse this private link to see your tickets and change how they are split across prize pools (until 10 minutes before each scheduled draw, when set):\n\n' +
    url +
    '\n\nIf you did not enter this raffle, you can ignore this email.\n\n— Spectrum Outfitters';
  try {
    MailApp.sendEmail({ to: String(email).trim(), subject: subject, body: body });
    return true;
  } catch (e) {
    return false;
  }
}

function getEntriesExtrasColumnIndex_() {
  var sh = getSpreadsheet_().getSheetByName(SHEET_ENTRIES);
  if (!sh) return 13;
  var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  for (var i = 0; i < h.length; i++) {
    if (String(h[i]).trim() === 'extrasJson') return i;
  }
  return Math.max(0, h.length - 1);
}

function parseEntryExtrasJson_(jsonStr) {
  try {
    var o = JSON.parse(String(jsonStr || '{}'));
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (e) {
    return {};
  }
}

function readEntryRowsByToken_(slug, token) {
  var sh = getSpreadsheet_().getSheetByName(SHEET_ENTRIES);
  if (!sh || sh.getLastRow() < 2) return [];
  var lastCol = Math.max(13, sh.getLastColumn());
  var values = sh.getRange(2, 1, sh.getLastRow(), lastCol).getValues();
  var need = String(token || '').trim();
  var exCol = getEntriesExtrasColumnIndex_();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][1] || '').trim() !== String(slug).trim()) continue;
    var ex = parseEntryExtrasJson_(values[i][exCol]);
    if (String(ex.__entryToken || '') !== need) continue;
    out.push({
      sheetRow: i + 2,
      name: String(values[i][2] || ''),
      phoneNorm: normalizePhone_(values[i][3]),
      email: String(values[i][4] || ''),
      raffleId: String(values[i][5] || ''),
      tickets: Number(values[i][9]) || 0,
      extras: ex,
    });
  }
  return out;
}

function deleteEntrySheetRowsDescending_(rowNumbersHighToLow) {
  var sh = getSpreadsheet_().getSheetByName(SHEET_ENTRIES);
  if (!sh) return;
  for (var i = 0; i < rowNumbersHighToLow.length; i++) {
    sh.deleteRow(rowNumbersHighToLow[i]);
  }
}

function getRaffleDrawAtMsMapForSlug_(slug) {
  var all = getRafflesAllForSlug_(slug);
  var map = {};
  for (var i = 0; i < all.length; i++) {
    var rid = String(all[i].id || all[i].raffleId || '').trim();
    if (!rid) continue;
    var raw = all[i].drawAt != null ? String(all[i].drawAt).trim() : '';
    if (!raw) {
      map[rid] = null;
      continue;
    }
    var ms = new Date(raw).getTime();
    map[rid] = isNaN(ms) ? null : ms;
  }
  return map;
}

function entryUpdateLockedForRaffleIds_(slug, raffleIds) {
  var map = getRaffleDrawAtMsMapForSlug_(slug);
  var now = Date.now();
  var margin = 10 * 60 * 1000;
  for (var i = 0; i < raffleIds.length; i++) {
    var rid = String(raffleIds[i] || '').trim();
    if (!rid) continue;
    var ms = map[rid];
    if (ms != null && now >= ms - margin) return true;
  }
  return false;
}

function maskEmail_(email) {
  var e = String(email || '').trim();
  var at = e.indexOf('@');
  if (at < 1) return e ? e.charAt(0) + '***' : '';
  var left = e.substring(0, at);
  var right = e.substring(at + 1);
  var show = left.length <= 2 ? left.charAt(0) : left.substring(0, 2);
  return show + '***@' + right;
}

/** Entries columns: …, userAgent, extrasJson (JSON map of bonus toggles) */
function appendEntry_(row) {
  var sh = getSpreadsheet_().getSheetByName(SHEET_ENTRIES);
  if (!sh) throw new Error('Missing sheet: ' + SHEET_ENTRIES);
  sh.appendRow(row);
}

function legacyBonusBooleans_(bonusById) {
  var b = bonusById || {};
  return [
    b.instagram ? 'TRUE' : 'FALSE',
    b.review ? 'TRUE' : 'FALSE',
    b.referral ? 'TRUE' : 'FALSE',
  ];
}

/** One Entries row; rowTickets can be fractional for split pools. extras merges bonus toggles + optional __split* audit fields. */
function appendEntryRow_(slug, name, phoneNorm, email, raffleId, bonusById, rowTickets, splitMeta, testMode, ip, userAgent, bonusProofTrimmed, entryToken) {
  var b = bonusById || {};
  var extras = {};
  Object.keys(b).forEach(function (k) {
    extras[String(k)] = b[k];
  });
  if (splitMeta && splitMeta.split) {
    extras.__split = true;
    extras.__splitTotalTickets = splitMeta.totalAll;
    extras.__rowTickets = rowTickets;
    extras.__splitEvenly = splitMeta.evenly === true;
    if (splitMeta.poolIds && splitMeta.poolIds.length) extras.__splitRaffleIds = splitMeta.poolIds.slice();
  }
  if (entryToken) extras.__entryToken = String(entryToken);
  if (bonusProofTrimmed && typeof bonusProofTrimmed === 'object' && !Array.isArray(bonusProofTrimmed)) {
    var pk = Object.keys(bonusProofTrimmed);
    if (pk.length) extras.__bonusProof = bonusProofTrimmed;
  }
  var bb = legacyBonusBooleans_(b);
  appendEntry_([
    new Date(),
    slug,
    name,
    phoneNorm,
    email,
    raffleId,
    bb[0],
    bb[1],
    bb[2],
    rowTickets,
    testMode ? 'TRUE' : 'FALSE',
    ip,
    String(userAgent || ''),
    JSON.stringify(extras),
  ]);
}

/**
 * ticketMode "split": one row per pool with fractional tickets.
 * - splitRaffleIds (array, length >= 2, each id active): equal split across that subset only.
 * - Else splitEvenly !== false (or no ticketSplit): equal split across all active pools.
 * - Else: legacy custom ticketSplit must sum to totalEntries (± tolerance).
 */
function buildTicketSplitPlan_(p, raffles, totalEntries) {
  var allIds = [];
  for (var i = 0; i < raffles.length; i++) allIds.push(raffles[i].id);
  if (!allIds.length) return null;

  var targetIds = [];
  var rawSplit = p.splitRaffleIds;
  if (Array.isArray(rawSplit) && rawSplit.length) {
    var seenPick = {};
    for (var si = 0; si < rawSplit.length; si++) {
      var rid = String(rawSplit[si] || '').trim();
      if (!rid || seenPick[rid]) continue;
      var foundR = false;
      for (var t = 0; t < raffles.length; t++) {
        if (raffles[t].id === rid) {
          foundR = true;
          break;
        }
      }
      if (!foundR) throw new Error('Invalid pool in selection: ' + rid);
      seenPick[rid] = true;
      targetIds.push(rid);
    }
  } else {
    targetIds = allIds.slice();
  }

  if (targetIds.length < 2) {
    throw new Error('Split needs at least two prize pools — use single-pool entry for one pool.');
  }

  var explicitCustom =
    (!Array.isArray(rawSplit) || !rawSplit.length) &&
    p.splitEvenly === false &&
    p.ticketSplit &&
    typeof p.ticketSplit === 'object';

  if (!explicitCustom) {
    var n = targetIds.length;
    var rowsE = [];
    var acc = 0;
    for (var j = 0; j < n; j++) {
      var wj;
      if (j === n - 1) {
        wj = totalEntries - acc;
      } else {
        wj = totalEntries / n;
        acc += wj;
      }
      rowsE.push({ raffleId: targetIds[j], weight: wj });
    }
    return { rows: rowsE, evenly: true, poolIds: targetIds.slice() };
  }

  var raw = p.ticketSplit || {};
  var rowsC = [];
  var sum = 0;
  for (var k = 0; k < allIds.length; k++) {
    var id = allIds[k];
    var w = Number(raw[id]);
    if (!(w >= 0) || isNaN(w)) w = 0;
    rowsC.push({ raffleId: id, weight: w });
    sum += w;
  }
  var tol = Math.max(1e-6, 1e-4 * Math.max(1, totalEntries));
  if (Math.abs(sum - totalEntries) > tol) {
    throw new Error('Pool tickets must add up to your total (' + String(totalEntries) + ').');
  }
  var hasAny = false;
  for (var h = 0; h < rowsC.length; h++) {
    if (rowsC[h].weight > 0) hasAny = true;
  }
  if (!hasAny) return null;
  var poolIdsC = [];
  for (var pc = 0; pc < rowsC.length; pc++) {
    if (rowsC[pc].weight > 0) poolIdsC.push(rowsC[pc].raffleId);
  }
  return { rows: rowsC, evenly: false, poolIds: poolIdsC };
}

function doGet(e) {
  try {
    var action = (e.parameter && e.parameter.action) || '';
    if (action !== 'getEvent') {
      return jsonResponse({ ok: false, error: 'unknown_action' }, 400);
    }
    var slug = (e.parameter && e.parameter.slug) || '';
    if (!slug) return jsonResponse({ ok: false, error: 'missing_slug' }, 400);

    var found = findEventRow_(slug);
    if (!found) return jsonResponse({ ok: false, error: 'event_not_found' }, 404);
    var o = recordToObject_(found.headers, found.record);
    var active = String(o.active || '').toUpperCase() === 'TRUE' || o.active === true;
    if (!active) return jsonResponse({ ok: false, error: 'event_inactive' }, 403);

    var raffles = getRafflesForSlug_(slug);
    var bonuses = parseBonusRulesFromRow_(o);
    var event = {
      slug: slug,
      name: String(o.name || o.eventName || 'Event'),
      description: String(o.description || ''),
      logoUrl: String(o.logoUrl || ''),
      primaryColor: String(o.primaryColor || '#c9a227'),
      secondaryColor: String(o.secondaryColor || '#1a1a1a'),
      theme: String(o.theme || 'dark') === 'light' ? 'light' : 'dark',
      active: true,
      defaultTestMode:
        String(o.defaultTestMode || '').toUpperCase() === 'TRUE' || o.defaultTestMode === true,
      raffles: raffles,
      bonuses: bonuses,
    };
    return jsonResponse({ ok: true, event: event });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
  }
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  try {
    var action = data.action;
    if (action === 'submitEntry') return handleSubmitEntry_(data);
    if (action === 'getEntryByToken') return handleGetEntryByToken_(data);
    if (action === 'updateEntryByToken') return handleUpdateEntryByToken_(data);
    if (action === 'getAdminStats') return handleAdminStats_(data);
    if (action === 'drawWinner') return handleDrawWinner_(data);
    if (action === 'exportEntries') return handleExportEntries_(data);
    if (action === 'getAdminEventConfig') return handleGetAdminEventConfig_(data);
    if (action === 'saveEventConfig') return handleSaveEventConfig_(data);
    return jsonResponse({ ok: false, error: 'unknown_action' }, 400);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
  }
}

/**
 * Writes entry rows after validation. Sends magic-link email when sendMagicEmail is true and not test.
 * Returns JSON response object (already wrapped semantics — caller returns jsonResponse(...)).
 */
function runEntryWritesAndMaybeEmail_(
  slug,
  name,
  phoneNorm,
  email,
  p,
  ev,
  bonuses,
  bonusById,
  bonusProofTrimmed,
  totalEntries,
  ticketMode,
  raffleId,
  raffles,
  testMode,
  ip,
  ua,
  entryToken,
  sendMagicEmail
) {
  var userAgentStr = String(ua || '');
  var magicSent = false;
  try {
    if (ticketMode === 'split') {
      var plan = buildTicketSplitPlan_(p, raffles, totalEntries);
      if (!plan || !plan.rows.length) {
        return jsonResponse({ ok: false, error: 'Could not build ticket split.', code: 'split' }, 400);
      }
      var written = 0;
      for (var s = 0; s < plan.rows.length; s++) {
        var part = plan.rows[s];
        if (!(part.weight > 0)) continue;
        appendEntryRow_(
          slug,
          name,
          phoneNorm,
          email,
          part.raffleId,
          bonusById,
          part.weight,
          { split: true, totalAll: totalEntries, evenly: plan.evenly, poolIds: plan.poolIds },
          testMode,
          ip,
          userAgentStr,
          bonusProofTrimmed,
          entryToken
        );
        written++;
      }
      if (!written) {
        return jsonResponse({ ok: false, error: 'No ticket weight in split — check pools.', code: 'split' }, 400);
      }
      if (sendMagicEmail && !testMode) {
        magicSent = trySendManageEntryEmail_(email, name, String(ev.name || 'Giveaway'), slug, entryToken);
      }
      return jsonResponse({
        ok: true,
        totalEntries: totalEntries,
        ticketMode: 'split',
        poolsEntered: written,
        testMode: testMode,
        magicLinkSent: magicSent,
      });
    }

    appendEntryRow_(slug, name, phoneNorm, email, raffleId, bonusById, totalEntries, null, testMode, ip, userAgentStr, bonusProofTrimmed, entryToken);
    if (sendMagicEmail && !testMode) {
      magicSent = trySendManageEntryEmail_(email, name, String(ev.name || 'Giveaway'), slug, entryToken);
    }
    return jsonResponse({ ok: true, totalEntries: totalEntries, ticketMode: 'single', testMode: testMode, magicLinkSent: magicSent });
  } catch (errSplit) {
    var msg = String(errSplit && errSplit.message ? errSplit.message : errSplit);
    return jsonResponse({ ok: false, error: msg, code: 'split' }, 400);
  }
}

function handleSubmitEntry_(data) {
  var p = data.payload || {};
  if (p.company) {
    return jsonResponse({ ok: true, totalEntries: 0, message: 'received' });
  }
  var slug = String(p.slug || '');
  if (!slug) return jsonResponse({ ok: false, error: 'missing_slug', code: 'slug' }, 400);

  var found = findEventRow_(slug);
  if (!found) return jsonResponse({ ok: false, error: 'event_not_found' }, 404);
  var ev = recordToObject_(found.headers, found.record);
  var active = String(ev.active || '').toUpperCase() === 'TRUE' || ev.active === true;
  if (!active) return jsonResponse({ ok: false, error: 'event_inactive' }, 403);

  var ip = String(p.clientIp || 'unknown');
  if (!rateLimitOk_(ip)) {
    return jsonResponse({ ok: false, error: 'Rate limited', code: 'rate_limited' }, 429);
  }

  var name = String(p.name || '').trim();
  var email = String(p.email || '').trim();
  var phone = String(p.phone || '').trim();
  var raffleId = String(p.raffleId || '').trim();
  var ticketMode = String(p.ticketMode || 'single');

  if (!name || !email || !phone) {
    return jsonResponse({ ok: false, error: 'Missing required fields', code: 'fields' }, 400);
  }
  if (!p.termsAccepted) {
    return jsonResponse({ ok: false, error: 'Terms not accepted', code: 'terms' }, 400);
  }

  var raffles = getRafflesForSlug_(slug);
  if (ticketMode === 'split') {
    var srPick = p.splitRaffleIds;
    if (Array.isArray(srPick) && srPick.length) {
      var seenPick = {};
      var nUnique = 0;
      for (var pi = 0; pi < srPick.length; pi++) {
        var pid = String(srPick[pi] || '').trim();
        if (!pid || seenPick[pid]) continue;
        seenPick[pid] = true;
        var okPick = raffles.some(function (r) {
          return r.id === pid;
        });
        if (!okPick) {
          return jsonResponse({ ok: false, error: 'Unknown prize pool in selection.', code: 'raffle' }, 400);
        }
        nUnique++;
      }
      if (nUnique < 2) {
        return jsonResponse(
          {
            ok: false,
            error: 'Pick at least two prize pools to split tickets, or one pool for all tickets.',
            code: 'split_pools',
          },
          400
        );
      }
    } else if (raffles.length < 2) {
      return jsonResponse({ ok: false, error: 'Need at least two prize pools to split tickets.', code: 'split_pools' }, 400);
    }
  } else {
    if (!raffleId) {
      return jsonResponse({ ok: false, error: 'Missing required fields', code: 'fields' }, 400);
    }
    var okRaffle = raffles.some(function (r) {
      return r.id === raffleId;
    });
    if (!okRaffle) return jsonResponse({ ok: false, error: 'Invalid raffle', code: 'raffle' }, 400);
  }

  var bonuses = parseBonusRulesFromRow_(ev);
  var bonusById = {};
  if (p.bonusById && typeof p.bonusById === 'object' && !Array.isArray(p.bonusById)) {
    Object.keys(p.bonusById).forEach(function (k) {
      bonusById[String(k)] = Boolean(p.bonusById[k]);
    });
  } else {
    bonusById.instagram = Boolean(p.bonusInstagram);
    bonusById.review = Boolean(p.bonusReview);
    bonusById.referral = Boolean(p.bonusReferral);
  }

  var proofErr = validateBonusProof_(p.bonusProof, bonuses, bonusById);
  if (proofErr) {
    return jsonResponse({ ok: false, error: proofErr, code: 'bonus_proof' }, 400);
  }
  var bonusProofTrimmed = trimBonusProofForSubmit_(p.bonusProof, bonuses);

  var testMode = Boolean(p.testMode);

  var defaultTest =
    String(ev.defaultTestMode || '').toUpperCase() === 'TRUE' || ev.defaultTestMode === true;
  testMode = Boolean(p.testMode) || defaultTest;

  var phoneNorm = normalizePhone_(phone);
  if (phoneNorm.length < 10) {
    return jsonResponse({ ok: false, error: 'Invalid phone', code: 'phone' }, 400);
  }
  if (phoneExistsForSlug_(slug, phoneNorm)) {
    return jsonResponse({ ok: false, error: 'This phone is already entered for this event.', code: 'duplicate_phone' }, 409);
  }

  var totalEntries = computeTicketsFromBonuses_(bonusById, bonuses);

  if (testMode) {
    // Flag only — still written for QA; optional block: return without append
    // Requirement: "Prevent real submissions" — we skip sheet write in test when event column blockTestWrite is TRUE
    var block = String(ev.blockTestWrite || '').toUpperCase() === 'TRUE';
    if (block) {
      return jsonResponse({
        ok: true,
        totalEntries: totalEntries,
        message: 'Test mode: submission not stored (blockTestWrite)',
        testMode: true,
      });
    }
  }

  var ua = String(p.userAgent || '');
  var entryToken = generateEntryToken_();

  return runEntryWritesAndMaybeEmail_(
    slug,
    name,
    phoneNorm,
    email,
    p,
    ev,
    bonuses,
    bonusById,
    bonusProofTrimmed,
    totalEntries,
    ticketMode,
    raffleId,
    raffles,
    testMode,
    ip,
    ua,
    entryToken,
    true
  );
}

function handleGetEntryByToken_(data) {
  var p = data.payload || {};
  var slug = String(p.slug || '');
  var token = String(p.token || '').trim();
  if (!slug || !token) return jsonResponse({ ok: false, error: 'missing_fields', code: 'fields' }, 400);
  var ip = String(p.clientIp || 'unknown');
  if (!rateLimitOk_(ip)) {
    return jsonResponse({ ok: false, error: 'Rate limited', code: 'rate_limited' }, 429);
  }

  var found = findEventRow_(slug);
  if (!found) return jsonResponse({ ok: false, error: 'event_not_found' }, 404);
  var ev = recordToObject_(found.headers, found.record);
  var active = String(ev.active || '').toUpperCase() === 'TRUE' || ev.active === true;
  if (!active) return jsonResponse({ ok: false, error: 'event_inactive' }, 403);

  var rows = readEntryRowsByToken_(slug, token);
  if (!rows.length) return jsonResponse({ ok: false, error: 'entry_not_found', code: 'token' }, 404);

  var raffles = getRafflesForSlug_(slug);
  var titleById = {};
  var drawById = {};
  for (var ri = 0; ri < raffles.length; ri++) {
    titleById[raffles[ri].id] = raffles[ri].title;
    drawById[raffles[ri].id] = raffles[ri].drawAt || '';
  }

  var raffleIdsSeen = [];
  var byRid = {};
  for (var j = 0; j < rows.length; j++) {
    var rid = rows[j].raffleId;
    if (!byRid[rid]) {
      byRid[rid] = 0;
      raffleIdsSeen.push(rid);
    }
    byRid[rid] += Number(rows[j].tickets) || 0;
  }

  var pools = [];
  for (var k = 0; k < raffleIdsSeen.length; k++) {
    var rid2 = raffleIdsSeen[k];
    pools.push({
      raffleId: rid2,
      title: titleById[rid2] || rid2,
      tickets: byRid[rid2],
      drawAt: drawById[rid2] || '',
    });
  }

  var ex0 = rows[0].extras || {};
  var ticketMode = ex0.__split ? 'split' : 'single';
  var splitRaffleIds = Array.isArray(ex0.__splitRaffleIds) ? ex0.__splitRaffleIds.map(String) : raffleIdsSeen.slice();
  var totalTickets = 0;
  for (var t = 0; t < rows.length; t++) totalTickets += Number(rows[t].tickets) || 0;

  var bonusByIdOut = {};
  Object.keys(ex0).forEach(function (key) {
    if (key.indexOf('__') === 0) return;
    if (typeof ex0[key] === 'boolean') bonusByIdOut[key] = ex0[key];
  });

  var bonuses = parseBonusRulesFromRow_(ev);
  var locked = entryUpdateLockedForRaffleIds_(slug, raffleIdsSeen);

  return jsonResponse({
    ok: true,
    entry: {
      slug: slug,
      eventName: String(ev.name || 'Event'),
      name: String(rows[0].name || ''),
      emailMasked: maskEmail_(rows[0].email),
      phoneLast4: String(rows[0].phoneNorm || '').slice(-4),
      ticketMode: ticketMode,
      splitRaffleIds: ticketMode === 'split' ? splitRaffleIds : [],
      singleRaffleId: ticketMode === 'single' ? String(rows[0].raffleId || '') : '',
      pools: pools,
      totalTickets: totalTickets,
      bonusById: bonusByIdOut,
      bonusProof: ex0.__bonusProof || {},
      editLocked: locked,
      bonuses: bonuses,
    },
  });
}

function handleUpdateEntryByToken_(data) {
  var p = data.payload || {};
  var slug = String(p.slug || '');
  var token = String(p.token || '').trim();
  if (!slug || !token) return jsonResponse({ ok: false, error: 'missing_fields', code: 'fields' }, 400);

  var ip = String(p.clientIp || 'unknown');
  if (!rateLimitOk_(ip)) {
    return jsonResponse({ ok: false, error: 'Rate limited', code: 'rate_limited' }, 429);
  }

  var found = findEventRow_(slug);
  if (!found) return jsonResponse({ ok: false, error: 'event_not_found' }, 404);
  var ev = recordToObject_(found.headers, found.record);
  var active = String(ev.active || '').toUpperCase() === 'TRUE' || ev.active === true;
  if (!active) return jsonResponse({ ok: false, error: 'event_inactive' }, 403);

  var rows = readEntryRowsByToken_(slug, token);
  if (!rows.length) return jsonResponse({ ok: false, error: 'entry_not_found', code: 'token' }, 404);

  var raffleIdsForLock = [];
  for (var rli = 0; rli < rows.length; rli++) {
    raffleIdsForLock.push(rows[rli].raffleId);
  }
  if (entryUpdateLockedForRaffleIds_(slug, raffleIdsForLock)) {
    return jsonResponse(
      { ok: false, error: 'Edits are locked within 10 minutes of a scheduled draw for your pools.', code: 'locked' },
      409
    );
  }

  var name = String(p.name || '').trim();
  var email = String(p.email || '').trim();
  var phone = String(p.phone || '').trim();
  var phoneNorm = normalizePhone_(phone);
  if (phoneNorm !== rows[0].phoneNorm || email !== String(rows[0].email || '').trim() || name !== String(rows[0].name || '').trim()) {
    return jsonResponse({ ok: false, error: 'Details do not match this entry.', code: 'identity' }, 403);
  }

  if (!p.termsAccepted) {
    return jsonResponse({ ok: false, error: 'Terms not accepted', code: 'terms' }, 400);
  }

  var raffleId = String(p.raffleId || '').trim();
  var ticketMode = String(p.ticketMode || 'single');
  var raffles = getRafflesForSlug_(slug);
  if (ticketMode === 'split') {
    var srPick2 = p.splitRaffleIds;
    if (Array.isArray(srPick2) && srPick2.length) {
      var seenPick2 = {};
      var nUnique2 = 0;
      for (var pi2 = 0; pi2 < srPick2.length; pi2++) {
        var pid2 = String(srPick2[pi2] || '').trim();
        if (!pid2 || seenPick2[pid2]) continue;
        seenPick2[pid2] = true;
        var okPick2 = raffles.some(function (r) {
          return r.id === pid2;
        });
        if (!okPick2) {
          return jsonResponse({ ok: false, error: 'Unknown prize pool in selection.', code: 'raffle' }, 400);
        }
        nUnique2++;
      }
      if (nUnique2 < 2) {
        return jsonResponse(
          {
            ok: false,
            error: 'Pick at least two prize pools to split tickets, or one pool for all tickets.',
            code: 'split_pools',
          },
          400
        );
      }
    } else if (raffles.length < 2) {
      return jsonResponse({ ok: false, error: 'Need at least two prize pools to split tickets.', code: 'split_pools' }, 400);
    }
  } else {
    if (!raffleId) {
      return jsonResponse({ ok: false, error: 'Missing required fields', code: 'fields' }, 400);
    }
    var okRaffle2 = raffles.some(function (r) {
      return r.id === raffleId;
    });
    if (!okRaffle2) return jsonResponse({ ok: false, error: 'Invalid raffle', code: 'raffle' }, 400);
  }

  var bonuses = parseBonusRulesFromRow_(ev);
  var bonusById = {};
  if (p.bonusById && typeof p.bonusById === 'object' && !Array.isArray(p.bonusById)) {
    Object.keys(p.bonusById).forEach(function (k) {
      bonusById[String(k)] = Boolean(p.bonusById[k]);
    });
  } else {
    bonusById.instagram = Boolean(p.bonusInstagram);
    bonusById.review = Boolean(p.bonusReview);
    bonusById.referral = Boolean(p.bonusReferral);
  }

  var proofErr2 = validateBonusProof_(p.bonusProof, bonuses, bonusById);
  if (proofErr2) {
    return jsonResponse({ ok: false, error: proofErr2, code: 'bonus_proof' }, 400);
  }
  var bonusProofTrimmed = trimBonusProofForSubmit_(p.bonusProof, bonuses);

  var totalEntries = computeTicketsFromBonuses_(bonusById, bonuses);

  var testMode = Boolean(p.testMode);
  var defaultTest2 =
    String(ev.defaultTestMode || '').toUpperCase() === 'TRUE' || ev.defaultTestMode === true;
  testMode = Boolean(p.testMode) || defaultTest2;

  if (testMode) {
    var block2 = String(ev.blockTestWrite || '').toUpperCase() === 'TRUE';
    if (block2) {
      return jsonResponse({
        ok: true,
        totalEntries: totalEntries,
        message: 'Test mode: update not stored (blockTestWrite)',
        testMode: true,
      });
    }
  }

  var rowNums = rows.map(function (x) {
    return x.sheetRow;
  });
  rowNums.sort(function (a, b) {
    return b - a;
  });
  deleteEntrySheetRowsDescending_(rowNums);

  var ua = String(p.userAgent || '');

  return runEntryWritesAndMaybeEmail_(
    slug,
    name,
    phoneNorm,
    email,
    p,
    ev,
    bonuses,
    bonusById,
    bonusProofTrimmed,
    totalEntries,
    ticketMode,
    raffleId,
    raffles,
    testMode,
    ip,
    ua,
    token,
    false
  );
}

function readEntriesForSlug_(slug) {
  var sh = getSpreadsheet_().getSheetByName(SHEET_ENTRIES);
  if (!sh || sh.getLastRow() < 2) return [];
  var lastCol = Math.max(13, sh.getLastColumn());
  var range = sh.getRange(2, 1, sh.getLastRow(), lastCol);
  return range.getValues();
}

function handleAdminStats_(data) {
  var slug = String(data.slug || '');
  var adminKey = String(data.adminKey || '');
  if (!slug || !validateAdminKey_(slug, adminKey)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }
  var rows = readEntriesForSlug_(slug);
  var phones = {};
  var byRaffle = {};
  var raffles = getRafflesForSlug_(slug);
  var titleById = {};
  raffles.forEach(function (r) {
    titleById[r.id] = r.title;
  });

  var entryRowCount = 0;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (String(row[1]) !== slug) continue;
    entryRowCount++;
    var phone = String(row[3] || '');
    var raffleId = String(row[5] || '');
    var tickets = Number(row[9]) || 0;
    var isTest = String(row[10]).toUpperCase() === 'TRUE';

    phones[phone] = true;
    if (!byRaffle[raffleId]) {
      byRaffle[raffleId] = { raffleTitle: titleById[raffleId] || raffleId, tickets: 0, people: {} };
    }
    byRaffle[raffleId].tickets += tickets;
    byRaffle[raffleId].people[phone] = true;
  }

  var entriesByRaffle = {};
  Object.keys(byRaffle).forEach(function (k) {
    var ppl = byRaffle[k].people;
    var countPeople = 0;
    Object.keys(ppl).forEach(function () {
      countPeople++;
    });
    entriesByRaffle[k] = {
      raffleTitle: byRaffle[k].raffleTitle,
      tickets: byRaffle[k].tickets,
      people: countPeople,
    };
  });

  var uniqueParticipants = 0;
  Object.keys(phones).forEach(function () {
    uniqueParticipants++;
  });

  return jsonResponse({
    ok: true,
    stats: {
      slug: slug,
      totalParticipants: uniqueParticipants,
      uniqueParticipants: uniqueParticipants,
      entryRowCount: entryRowCount,
      entriesByRaffle: entriesByRaffle,
      lastUpdated: new Date().toISOString(),
    },
  });
}

function weightedPick_(pool) {
  // pool: [{ weight: n, row: {...}}]
  var total = 0;
  for (var i = 0; i < pool.length; i++) total += pool[i].weight;
  if (total <= 0 || !pool.length) return null;
  var r = Math.random() * total;
  var acc = 0;
  for (var j = 0; j < pool.length; j++) {
    acc += pool[j].weight;
    if (r <= acc) return pool[j];
  }
  return pool[pool.length - 1];
}

function handleDrawWinner_(data) {
  var slug = String(data.slug || '');
  var adminKey = String(data.adminKey || '');
  var raffleId = String(data.raffleId || '');
  var excludePhones = (data.excludePhones || []).map(function (p) {
    return normalizePhone_(p);
  });
  var testModeOnly = Boolean(data.testModeOnly);
  if (!slug || !raffleId || !validateAdminKey_(slug, adminKey)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  var rows = readEntriesForSlug_(slug);
  var pool = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (String(row[1]) !== slug) continue;
    if (String(row[5]) !== raffleId) continue;
    var isTest = String(row[10]).toUpperCase() === 'TRUE';
    if (testModeOnly && !isTest) continue;
    if (!testModeOnly && isTest) continue;
    var phone = String(row[3] || '');
    if (excludePhones.indexOf(phone) >= 0) continue;
    var w = Number(row[9]) || 0;
    if (w <= 0) continue;
    pool.push({
      weight: w,
      name: String(row[2]),
      phone: phone,
      email: String(row[4] || ''),
    });
  }
  var pick = weightedPick_(pool);
  if (!pick) return jsonResponse({ ok: false, error: 'no_entries' }, 400);

  var drawId = 'dw_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1e6);
  var ticketsInPool = 0;
  for (var t = 0; t < pool.length; t++) ticketsInPool += pool[t].weight;

  var wsh = getSpreadsheet_().getSheetByName(SHEET_WINNERS);
  if (wsh) {
    wsh.appendRow([
      drawId,
      new Date(),
      slug,
      raffleId,
      pick.name,
      pick.phone,
      pick.email,
      ticketsInPool,
      testModeOnly ? 'TRUE' : 'FALSE',
    ]);
  }

  return jsonResponse({
    ok: true,
    winner: {
      name: pick.name,
      phone: pick.phone,
      email: pick.email,
      raffleId: raffleId,
      ticketsInPool: ticketsInPool,
      drawId: drawId,
    },
  });
}

function handleExportEntries_(data) {
  var slug = String(data.slug || '');
  var adminKey = String(data.adminKey || '');
  if (!slug || !validateAdminKey_(slug, adminKey)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }
  var rows = readEntriesForSlug_(slug);
  var lines = [
    [
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
    ].join(','),
  ];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][1]) !== slug) continue;
    var cells = [
      rows[i][0] instanceof Date ? rows[i][0].toISOString() : rows[i][0],
      rows[i][1],
      rows[i][2],
      rows[i][3],
      rows[i][4],
      rows[i][5],
      rows[i][6],
      rows[i][7],
      rows[i][8],
      rows[i][9],
      rows[i][10],
      rows[i][11],
      rows[i][12],
      rows[i][13] != null ? rows[i][13] : '',
    ].map(function (c) {
      var s = String(c == null ? '' : c);
      if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    });
    lines.push(cells.join(','));
  }
  return jsonResponse({ ok: true, csv: lines.join('\r\n') });
}
