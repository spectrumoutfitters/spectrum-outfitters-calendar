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
 * Raffles
 *   slug, raffleId, title, subtitle, imageUrl, valueLabel, sortOrder, active
 *   - valueLabel: short text shown on the entry page (e.g. "$450+ retail · No purchase necessary")
 *
 * Events — optional column:
 *   bonusRulesJson: JSON array of { "id": "instagram", "label": "…", "description": "…", "tickets": 2 }
 *   If blank, defaults are Instagram (+2), Review (+5), Referral (+3).
 *
 * Entries (created automatically in column order)
 *   timestamp, slug, name, phone, email, raffleId, bonusInstagram, bonusReview, bonusReferral, totalEntries, isTest, ip, userAgent, extrasJson
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

function getDefaultBonuses_() {
  return [
    { id: 'instagram', label: 'Instagram follow or story mention', description: 'Follow us and tag the shop.', tickets: 2 },
    { id: 'review', label: 'Leave a review', description: 'Google or Facebook review for the business.', tickets: 5 },
    { id: 'referral', label: 'Refer a friend', description: 'Friend must mention your name on their entry.', tickets: 3 },
  ];
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
      out.push({
        id: id,
        label: String(b.label || id),
        description: String(b.description || ''),
        tickets: tickets,
      });
    }
    if (!out.length) return getDefaultBonuses_();
    return out;
  } catch (err) {
    return getDefaultBonuses_();
  }
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

function replaceRafflesForSlug_(slug, raffles) {
  var sh = getSpreadsheet_().getSheetByName(SHEET_RAFFLES);
  if (!sh) throw new Error('Missing sheet: ' + SHEET_RAFFLES);
  ensureValueLabelColumn_(sh);
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
function appendEntryRow_(slug, name, phoneNorm, email, raffleId, bonusById, rowTickets, splitMeta, testMode, ip, userAgent) {
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
 * ticketMode "split": one row per active pool with fractional tickets.
 * splitEvenly !== false with no valid ticketSplit → equal division.
 * splitEvenly === false → ticketSplit must sum to totalEntries (± tolerance).
 */
function buildTicketSplitPlan_(p, raffles, totalEntries) {
  var ids = [];
  for (var i = 0; i < raffles.length; i++) ids.push(raffles[i].id);
  if (!ids.length) return null;
  if (ids.length < 2) {
    throw new Error('Only one prize pool — use single-pool entry.');
  }
  var explicitCustom = p.splitEvenly === false && p.ticketSplit && typeof p.ticketSplit === 'object';
  if (!explicitCustom) {
    var n = ids.length;
    var each = totalEntries / n;
    var rowsE = [];
    for (var j = 0; j < n; j++) rowsE.push({ raffleId: ids[j], weight: each });
    return { rows: rowsE, evenly: true };
  }
  var raw = p.ticketSplit || {};
  var rowsC = [];
  var sum = 0;
  for (var k = 0; k < ids.length; k++) {
    var id = ids[k];
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
  return { rows: rowsC, evenly: false };
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
    if (raffles.length < 2) {
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
          { split: true, totalAll: totalEntries, evenly: plan.evenly },
          testMode,
          ip,
          ua
        );
        written++;
      }
      if (!written) {
        return jsonResponse({ ok: false, error: 'No ticket weight in split — check pools.', code: 'split' }, 400);
      }
      return jsonResponse({
        ok: true,
        totalEntries: totalEntries,
        ticketMode: 'split',
        poolsEntered: written,
        testMode: testMode,
      });
    }

    appendEntryRow_(slug, name, phoneNorm, email, raffleId, bonusById, totalEntries, null, testMode, ip, ua);
    return jsonResponse({ ok: true, totalEntries: totalEntries, ticketMode: 'single', testMode: testMode });
  } catch (errSplit) {
    var msg = String(errSplit && errSplit.message ? errSplit.message : errSplit);
    return jsonResponse({ ok: false, error: msg, code: 'split' }, 400);
  }
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
