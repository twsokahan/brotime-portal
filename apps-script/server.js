// Apps Script shell around handleRequest. Spreadsheet ids live in Script Properties, never in this repo.
// Functions ending in _ are private to Apps Script; doPost, checkSetup and createSessionSecret are the entry points.

// Header text of the cadre list's title and email columns.
const CADRE_HEADERS = { title: '職務', emails: ['E-mail(1)', 'E-mail(2)'] };
const REQUIRED_PROPERTIES = ['CLIENT_ID', 'SESSION_SECRET', 'ROSTER_ID', 'ROSTER_SHEET', 'CADRE_ID', 'CADRE_SHEET', 'RESPONSES_ID'];
const CACHE_SECONDS = 600;
const ALLOWLIST_CACHE_KEY = 'allowlist';

function doPost(e) {
  let result;
  try {
    result = handleRequest(parseRequest_(e), serverDeps_());
  } catch (error) {
    console.error(error);
    result = { ok: false, error: 'server' };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function parseRequest_(e) {
  try {
    return JSON.parse(e.postData.contents);
  } catch {
    return null;
  }
}

function scriptProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error(`Script Property ${name} 還沒設定`);
  return value;
}

function serverDeps_() {
  const secret = scriptProperty_('SESSION_SECRET');
  let allowlist = null;
  return {
    clientId: scriptProperty_('CLIENT_ID'),
    now: () => Date.now(),
    sign: (text) => Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text, secret)),
    tokenInfo: fetchTokenInfo_,
    allowlist: () => allowlist || (allowlist = cachedAllowlist_()),
    stats: cachedStats_,
  };
}

function fetchTokenInfo_(idToken) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  return response.getResponseCode() === 200 ? JSON.parse(response.getContentText()) : null;
}

function namedSheet_(idProperty, sheetProperty, listName) {
  const name = scriptProperty_(sheetProperty);
  const sheet = SpreadsheetApp.openById(scriptProperty_(idProperty)).getSheetByName(name);
  if (!sheet) throw new Error(`${listName}找不到分頁「${name}」`);
  return sheet;
}

const rosterSheet_ = () => namedSheet_('ROSTER_ID', 'ROSTER_SHEET', '通訊錄');
const cadreSheet_ = () => namedSheet_('CADRE_ID', 'CADRE_SHEET', '幹部名單');

const displayValues_ = (sheet) => sheet.getDataRange().getDisplayValues();

function participantSheet_() {
  const sheets = SpreadsheetApp.openById(scriptProperty_('RESPONSES_ID')).getSheets();
  const isParticipant = (sheet) =>
    sheet.getLastColumn() > 0 && isParticipantHeader(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]);
  return sheets.find(isParticipant) || null;
}

function readLists_() {
  const roster = parseRoster(displayValues_(rosterSheet_()));
  const cadreValues = displayValues_(cadreSheet_());
  return {
    rosterEntries: roster.entries,
    circles: roster.circles,
    cadreValues,
    cadreEntries: parseCadres(cadreValues, roster.circles, CADRE_HEADERS),
  };
}

const mergeLists_ = (lists) => mergeAllowlist([lists.rosterEntries, lists.cadreEntries]);

function putInCache_(key, value) {
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(value), CACHE_SECONDS);
  } catch (error) {
    console.warn(`快取 ${key} 放不下，這次不快取：${error}`);
  }
}

function cachedAllowlist_() {
  const cached = CacheService.getScriptCache().get(ALLOWLIST_CACHE_KEY);
  if (cached) return JSON.parse(cached);
  const allowlist = mergeLists_(readLists_());
  putInCache_(ALLOWLIST_CACHE_KEY, allowlist);
  return allowlist;
}

function cachedStats_(scope) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(scope.districts));
  const key = `stats:${Utilities.base64EncodeWebSafe(digest)}`;
  const cached = CacheService.getScriptCache().get(key);
  if (cached) return JSON.parse(cached);
  const sheet = participantSheet_();
  if (!sheet) throw new Error('問卷回覆試算表裡找不到參加者問卷的分頁');
  const stats = statsFor(scope, groupSessions(parseResponses(sheet.getDataRange().getValues())));
  putInCache_(key, stats);
  return stats;
}

function checkSetup() {
  const properties = PropertiesService.getScriptProperties();
  const missing = REQUIRED_PROPERTIES.filter((name) => !properties.getProperty(name));
  if (missing.length) {
    Logger.log(`還沒設定的 Script Properties：${missing.join('、')}`);
    return;
  }
  const lists = readLists_();
  const allowlist = mergeLists_(lists);
  const levels = { all: 0, circle: 0, district: 0 };
  Object.keys(allowlist).forEach((email) => {
    levels[allowlist[email].level] += 1;
  });
  const unresolved = unresolvedPlaces(lists.cadreValues, lists.circles, CADRE_HEADERS);
  const participant = participantSheet_();
  Logger.log([
    `通訊錄：${lists.rosterEntries.length} 個信箱，${Object.keys(lists.circles).length} 個圈`,
    `幹部名單：${lists.cadreEntries.length} 個信箱`,
    `合併後：${Object.keys(allowlist).length} 人（看全部 ${levels.all}、看一個圈 ${levels.circle}、看一區 ${levels.district}）`,
    `幹部名單對不到圈或區的寫法：${unresolved.length ? unresolved.join('、') : '沒有'}`,
    participant ? `參加者問卷：分頁「${participant.getName()}」，${participant.getLastRow() - 1} 份回覆` : '參加者問卷：找不到分頁',
  ].join('\n'));
  CacheService.getScriptCache().remove(ALLOWLIST_CACHE_KEY);
}

function createSessionSecret() {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('SESSION_SECRET')) {
    Logger.log('SESSION_SECRET 已經有了，沒有更動（換掉的話每個人都要重新登入）');
    return;
  }
  properties.setProperty('SESSION_SECRET', [Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid()].join(''));
  Logger.log('SESSION_SECRET 設好了');
}
