const GOOGLE_SHEET_ID = "ВСТАВИТЬ_ID_ТАБЛИЦЫ";

const SHEETS = {
  respondents: [
    "created_at", "internal_uuid", "public_code", "source", "submitted_at",
    "fio", "email", "phone", "telegram", "answers_json"
  ],
  project_reactions: [
    "created_at", "internal_uuid", "public_code", "project_id", "choice", "confident"
  ],
  design_ratings: [
    "created_at", "internal_uuid", "public_code", "object_name", "rating"
  ],
  neural_ratings: [
    "created_at", "internal_uuid", "public_code", "tool_name", "used", "rating"
  ],
  event_log: [
    "created_at", "internal_uuid", "public_code", "event_type", "event_ts", "payload_json"
  ]
};

function doPost(e) {
  try {
    ensureSheets_();

    const body = JSON.parse(e.postData.contents || "{}");
    const now = new Date();
    const submittedAt = body.submitted_at || now.toISOString();
    const internalUuid = Utilities.getUuid();
    const publicCode = buildPublicCode_(now);

    const ss = SpreadsheetApp.openById(GOOGLE_SHEET_ID);
    const contacts = (((body || {}).answers || {}).block10 || {}).q1 || {};

    appendRow_(ss.getSheetByName("respondents"), SHEETS.respondents, {
      created_at: now.toISOString(),
      internal_uuid: internalUuid,
      public_code: publicCode,
      source: body.source || "unknown",
      submitted_at: submittedAt,
      fio: contacts.fio || "",
      email: contacts.email || "",
      phone: contacts.phone || "",
      telegram: contacts.telegram || "",
      answers_json: JSON.stringify(body.answers || {})
    });

    const projects = ((((body || {}).answers || {}).block3 || {}).projects || []);
    projects.forEach(function(item) {
      appendRow_(ss.getSheetByName("project_reactions"), SHEETS.project_reactions, {
        created_at: now.toISOString(),
        internal_uuid: internalUuid,
        public_code: publicCode,
        project_id: item.project_id || "",
        choice: item.choice || "",
        confident: !!item.confident
      });
    });

    const design = ((((body || {}).answers || {}).block6 || {}).q1_7 || {});
    Object.keys(design).forEach(function(name) {
      appendRow_(ss.getSheetByName("design_ratings"), SHEETS.design_ratings, {
        created_at: now.toISOString(),
        internal_uuid: internalUuid,
        public_code: publicCode,
        object_name: name,
        rating: design[name]
      });
    });

    const tools = ((((body || {}).answers || {}).block8 || {}).tools || {});
    Object.keys(tools).forEach(function(name) {
      appendRow_(ss.getSheetByName("neural_ratings"), SHEETS.neural_ratings, {
        created_at: now.toISOString(),
        internal_uuid: internalUuid,
        public_code: publicCode,
        tool_name: name,
        used: !!tools[name].used,
        rating: tools[name].rating || ""
      });
    });

    (body.event_log || []).forEach(function(evt) {
      appendRow_(ss.getSheetByName("event_log"), SHEETS.event_log, {
        created_at: now.toISOString(),
        internal_uuid: internalUuid,
        public_code: publicCode,
        event_type: evt.type || "",
        event_ts: evt.ts || "",
        payload_json: JSON.stringify(evt.payload || {})
      });
    });

    return json_({ ok: true, internal_uuid: internalUuid, public_code: publicCode });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function buildPublicCode_(date) {
  const tz = Session.getScriptTimeZone() || "Europe/Moscow";
  const yymmdd = Utilities.formatDate(date, tz, "yyMMdd");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (var i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return "STEP3D-" + yymmdd + "-" + suffix;
}

function ensureSheets_() {
  const ss = SpreadsheetApp.openById(GOOGLE_SHEET_ID);
  Object.keys(SHEETS).forEach(function(name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    const current = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    const isSame = headers.every(function(h, i) { return current[i] === h; });
    if (!isSame) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
  });
}

function appendRow_(sheet, headers, data) {
  const row = headers.map(function(h) { return data[h] !== undefined ? data[h] : ""; });
  sheet.appendRow(row);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  ensureSheets_();
  return json_({ ok: true, message: "STEP 3D Web App is running" });
}
