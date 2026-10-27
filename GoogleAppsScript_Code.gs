/**
 * =======================================================================
 * GOOGLE APPS SCRIPT: ORDER TRACKING SYSTEM (ប្រព័ន្ធតាមដាន Order)
 * Spreadsheet Target: "Tracking order"
 * 
 * Sheets/Tabs in Spreadsheet:
 * 1. "Tracking" (Order Tracking Records)
 * 2. "Customer Information" (Setup: Customer Directory with City & Khan)
 * 3. "BU" (Setup: Business Units)
 * 4. "Package Type" (Setup: Packaging Types: Carton, Pallet, Bag...)
 * 5. "Document Type" (Setup: Document Types: Tax Invoice, DO...)
 * =======================================================================
 * 
 * របៀបដំឡើង (Quick Setup Instructions):
 * 1. បង្កើត Google Sheet ថ្មីមួយ រួចដាក់ឈ្មោះ File ថា "Tracking order"
 * 2. ចុច Menu "Extensions" (ផ្នែកបន្ថែម) -> "Apps Script"
 * 3. លុបកូដចាស់ៗចេញ រួច Copy & Paste កូដទាំងអស់ក្នុង File នេះចូល
 * 4. ជ្រើស Function `setupAllSheets` រួចចុច "Run" ដើម្បីបង្កើត និងរៀបចំ Sheet ទាំង ៥ ស្វ័យប្រវត្តិ!
 * 5. ចុចប៊ូតុងពណ៌ខៀវ "Deploy" -> ជ្រើសរើស "New deployment" -> Select type "Web app"
 * 6. កំណត់:
 *    - Execute as: "Me" (គណនីរបស់អ្នក)
 *    - Who has access: "Anyone" (សំខាន់បំផុត ដើម្បីឱ្យ Web App ផ្ញើទិន្នន័យបាន)
 * 7. ចុច "Deploy" រួច Copy យក "Web App URL" (URL ចុងបញ្ចប់ដោយ /exec)
 * 8. យក URL ទៅដាក់ក្នុង Web App ត្រង់ Settings (ការកំណត់) ជាការស្រេច!
 */

const SPREADSHEET_NAME = "Tracking order";

// Sheet Names
const SHEET_TRACKING = "Tracking";
const SHEET_CUSTOMER = "Customer Information";
const SHEET_BU = "BU";
const SHEET_PACKAGE = "Package Type";
const SHEET_DOCUMENT = "Document Type";
const SHEET_USER = "User Management";
const SHEET_SETTINGS = "System Settings";

const HEADERS_SETTINGS = ["Setting Key", "Setting Value", "Last Updated", "Updated By"];

// 1. Column Definitions for "Tracking" (30 Columns)
const HEADERS_TRACKING = [
  "Timestamp",            // Col A (1)
  "SO#",                  // Col B (2) [Unique Key]
  "Customer Name",        // Col C (3)
  "City/Province",        // Col D (4)
  "Khan",                 // Col E (5)
  "Packing List#",        // Col F (6)
  "Invoice#",             // Col G (7)
  "Amount",               // Col H (8)
  "Currency",             // Col I (9)
  "Total Package#",       // Col J (10)
  "Package Unit",         // Col K (11)
  "BU",                   // Col L (12)
  "Document Type",        // Col M (13)
  "Special Notes",        // Col N (14)
  "Payment Receipt",      // Col O (15)
  "Overall Status",       // Col P (16)
  "Picking Start Time",   // Col Q (17)
  "Picking End Time",     // Col R (18)
  "Picking Duration",     // Col S (19)
  "Checking Start Time",  // Col T (20)
  "Checking End Time",    // Col U (21)
  "Checking Duration",    // Col V (22)
  "Delivery Start Time",  // Col W (23)
  "Delivery End Time",    // Col X (24)
  "Delivery Duration",    // Col Y (25)
  "Last Updated",         // Col Z (26)
  "Created by",           // Col AA (27)
  "Picker by",            // Col AB (28)
  "Checker by",           // Col AC (29)
  "Delivery by",          // Col AD (30)
  "Delivery Notes"        // Col AE (31)
];

// 2. Column Definitions for "Customer Information"
const HEADERS_CUSTOMER = [
  "Customer ID",
  "Customer Name",
  "City/Province",
  "Khan",
  "Last Updated"
];

// 3. Column Definitions for "BU"
const HEADERS_BU = [
  "BU ID",
  "BU Name",
  "Last Updated"
];

// 4. Column Definitions for "Package Type"
const HEADERS_PACKAGE = [
  "Package ID",
  "Package Type Name",
  "Short Code",
  "Last Updated"
];

// 5. Column Definitions for "Document Type"
const HEADERS_DOCUMENT = [
  "Document ID",
  "Document Type Name",
  "Last Updated"
];

// 6. Column Definitions for "User Management" (Setup Users & Permissions)
const HEADERS_USER = [
  "User ID",
  "Display Name",
  "Login Username",
  "Password",
  "Role",
  "Permission Access Right",
  "Last Updated"
];

/**
 * បង្កើត Custom Menu ពេលបើក Google Sheet
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚀 Order Tracking")
    .addItem("✨ Clean Headers & Durations (ដកអក្សរខ្មែរ & Format hh:mm)", "cleanAndFormatAllHeadersAndDurations")
    .addItem("⚡ Setup All 6 Sheets (បង្កើត & រៀបចំ Sheet ទាំង ៦)", "setupAllSheets")
    .addItem("🔄 Format Tracking Sheet Headers", "setupTrackingHeaders")
    .addToUi();
}

/**
 * ជំនួយការស្វែងរក Active Spreadsheet
 */
function getSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var files = DriveApp.getFilesByName(SPREADSHEET_NAME);
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      ss = SpreadsheetApp.create(SPREADSHEET_NAME);
    }
  }
  return ss;
}

/**
 * ស្វែងរក ឬ បង្កើត Sheet ដោយស្វ័យប្រវត្តិតាមឈ្មោះ
 */
function getOrCreateSheet(sheetName, headers) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  if (headers) {
    if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() === "") {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      formatSheetHeader(sheet, headers.length);
    } else if (sheetName === SHEET_TRACKING) {
      ensureTrackingHeaders(sheet);
    } else if (sheet.getLastColumn() < headers.length) {
      // Auto extend headers if new columns were added
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      formatSheetHeader(sheet, headers.length);
    }
  }
  return sheet;
}

/**
 * Format Header Style (Navy Blue background, white bold text, frozen row)
 */
function formatSheetHeader(sheet, colCount) {
  var headerRange = sheet.getRange(1, 1, 1, colCount);
  headerRange.setBackground("#1e293b");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
}

/**
 * បង្កើត និង រៀបចំ Sheet ទាំង ៦ ដោយស្វ័យប្រវត្តិ
 */
function setupAllSheets() {
  var ss = getSpreadsheet();
  
  // 1. Tracking Sheet
  var trackSheet = getOrCreateSheet(SHEET_TRACKING, HEADERS_TRACKING);
  trackSheet.getRange(1, 1, 1, HEADERS_TRACKING.length).setValues([HEADERS_TRACKING]);
  formatSheetHeader(trackSheet, HEADERS_TRACKING.length);
  
  // 2. Customer Information Sheet
  var custSheet = getOrCreateSheet(SHEET_CUSTOMER, HEADERS_CUSTOMER);
  custSheet.getRange(1, 1, 1, HEADERS_CUSTOMER.length).setValues([HEADERS_CUSTOMER]);
  formatSheetHeader(custSheet, HEADERS_CUSTOMER.length);
  if (custSheet.getLastRow() <= 1) {
    var seedCustomers = [
      ["CUST-001", "Calmette Hospital", "Phnom Penh", "Daun Penh", getNowString()],
      ["CUST-002", "DKSH Cambodia Ltd", "Phnom Penh", "Pou Senchey", getNowString()],
      ["CUST-003", "Chip Mong Retail / Supermarket", "Phnom Penh", "Sen Sok", getNowString()],
      ["CUST-004", "Phsar Leu Distribution Center", "Siem Reap", "Siem Reap City", getNowString()],
      ["CUST-005", "Aeon Mall Logistics Center", "Phnom Penh", "Chamkarmon", getNowString()],
      ["CUST-006", "Royal Phnom Penh Hospital", "Phnom Penh", "Tuol Kouk", getNowString()],
      ["CUST-007", "Sunrise Japan Hospital", "Phnom Penh", "Chroy Changvar", getNowString()]
    ];
    custSheet.getRange(2, 1, seedCustomers.length, HEADERS_CUSTOMER.length).setValues(seedCustomers);
  }
  
  // 3. BU Sheet
  var buSheet = getOrCreateSheet(SHEET_BU, HEADERS_BU);
  buSheet.getRange(1, 1, 1, HEADERS_BU.length).setValues([HEADERS_BU]);
  formatSheetHeader(buSheet, HEADERS_BU.length);
  if (buSheet.getLastRow() <= 1) {
    var seedBUs = [
      ["BU-001", "Healthcare & Pharma", getNowString()],
      ["BU-002", "Consumer Goods / FMCG", getNowString()],
      ["BU-003", "Industrial & Chemicals", getNowString()],
      ["BU-004", "Agri-Business & Food", getNowString()],
      ["BU-005", "Technology & Equipment", getNowString()],
      ["BU-006", "General Logistics & Supply Chain", getNowString()]
    ];
    buSheet.getRange(2, 1, seedBUs.length, HEADERS_BU.length).setValues(seedBUs);
  }
  
  // 4. Package Type Sheet
  var pkgSheet = getOrCreateSheet(SHEET_PACKAGE, HEADERS_PACKAGE);
  pkgSheet.getRange(1, 1, 1, HEADERS_PACKAGE.length).setValues([HEADERS_PACKAGE]);
  formatSheetHeader(pkgSheet, HEADERS_PACKAGE.length);
  if (pkgSheet.getLastRow() <= 1) {
    var seedPkgs = [
      ["PKG-001", "Carton", "Ctns", getNowString()],
      ["PKG-002", "Pallet", "Plts", getNowString()],
      ["PKG-003", "Bag", "Bags", getNowString()],
      ["PKG-004", "Box", "Boxes", getNowString()],
      ["PKG-005", "Bundle", "Bdls", getNowString()],
      ["PKG-006", "Drum", "Drums", getNowString()],
      ["PKG-007", "Crate", "Crts", getNowString()]
    ];
    pkgSheet.getRange(2, 1, seedPkgs.length, HEADERS_PACKAGE.length).setValues(seedPkgs);
  }
  
  // 5. Document Type Sheet
  var docSheet = getOrCreateSheet(SHEET_DOCUMENT, HEADERS_DOCUMENT);
  docSheet.getRange(1, 1, 1, HEADERS_DOCUMENT.length).setValues([HEADERS_DOCUMENT]);
  formatSheetHeader(docSheet, HEADERS_DOCUMENT.length);
  if (docSheet.getLastRow() <= 1) {
    var seedDocs = [
      ["DOC-001", "Tax Invoice", getNowString()],
      ["DOC-002", "Commercial Invoice", getNowString()],
      ["DOC-003", "Delivery Order / DO", getNowString()],
      ["DOC-004", "Packing List", getNowString()],
      ["DOC-005", "Inter-Warehouse Transfer", getNowString()],
      ["DOC-006", "Cash Sale Slip", getNowString()],
      ["DOC-007", "Consignment Note", getNowString()]
    ];
    docSheet.getRange(2, 1, seedDocs.length, HEADERS_DOCUMENT.length).setValues(seedDocs);
  }
  
  // 6. User Management Sheet
  var userSheet = getOrCreateSheet(SHEET_USER, HEADERS_USER);
  userSheet.getRange(1, 1, 1, HEADERS_USER.length).setValues([HEADERS_USER]);
  formatSheetHeader(userSheet, HEADERS_USER.length);
  if (userSheet.getLastRow() <= 1) {
    var seedUsers = [
      ["USR-001", "System Administrator", "admin", "123", "Admin", "dashboard, register, picking, checking, delivery, setup", getNowString()],
      ["USR-002", "Sophal Chan", "whm", "123", "Admin", "dashboard, register, picking, checking, delivery, setup", getNowString()],
      ["USR-003", "Lor Bunthavry", "thv", "123", "User", "dashboard, register, picking, checking, delivery", getNowString()],
      ["USR-004", "Kimheang", "heang", "123", "User", "register, picking, checking", getNowString()],
      ["USR-005", "Hem Sopheaktra", "tra", "123", "User", "register, picking, checking", getNowString()],
      ["USR-006", "Ngo Thin", "thin", "123", "User", "register, picking, checking", getNowString()]
    ];
    userSheet.getRange(2, 1, seedUsers.length, HEADERS_USER.length).setValues(seedUsers);
  }
  
  // 7. System Settings Sheet
  var setSheet = getOrCreateSheet(SHEET_SETTINGS, HEADERS_SETTINGS);
  setSheet.getRange(1, 1, 1, HEADERS_SETTINGS.length).setValues([HEADERS_SETTINGS]);
  formatSheetHeader(setSheet, HEADERS_SETTINGS.length);
  
  Logger.log("✅ All 7 Sheets setup successfully in Spreadsheet: " + SPREADSHEET_NAME);
}

function setupTrackingHeaders() {
  var sheet = getOrCreateSheet(SHEET_TRACKING, HEADERS_TRACKING);
  sheet.getRange(1, 1, 1, HEADERS_TRACKING.length).setValues([HEADERS_TRACKING]);
  formatSheetHeader(sheet, HEADERS_TRACKING.length);
}

/**
 * ធានាថា Tracking Sheet មាន Column "Payment Receipt" នៅជាប់ Column "Special Notes" (Col 15)
 */
function ensureTrackingHeaders(sheet) {
  if (!sheet) return;
  try {
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var curHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var payCol = -1, specCol = -1;
    for (var i = 0; i < curHeaders.length; i++) {
      var h = String(curHeaders[i] || "").trim().toLowerCase();
      if (h === "payment receipt") payCol = i + 1;
      if (h.indexOf("special notes") !== -1) specCol = i + 1;
    }
    if (payCol === -1) {
      var insertAfter = (specCol > 0) ? specCol : 14;
      sheet.insertColumnAfter(insertAfter);
      var newCol = insertAfter + 1;
      sheet.getRange(1, newCol).setValue("Payment Receipt");
      sheet.getRange(1, newCol)
        .setBackground("#f8fafc")
        .setFontWeight("bold")
        .setFontColor("#1e293b")
        .setHorizontalAlignment("center");
    }
  } catch(err) {
    Logger.log("ensureTrackingHeaders error: " + err);
  }
}

/**
 * បង្កើត និង កែសម្រួល Header គ្រប់ Sheet ទាំងអស់ទៅជាភាសាអង់គ្លេសសុទ្ធ (ដកអក្សរខ្មែរ)
 * និង កែសម្រួលទិន្នន័យ Duration ក្នុង Tracking Sheet ទៅជាទម្រង់ hh:mm (00:10, 00:01, 02:14...)
 */
function cleanAndFormatAllHeadersAndDurations() {
  var ss = getSpreadsheet();
  
  // 1. Ensure "Payment Receipt" column exists in SHEET_TRACKING right after "Special Notes"
  var trackSheet = ss.getSheetByName(SHEET_TRACKING);
  if (trackSheet) {
    ensureTrackingHeaders(trackSheet);
  }

  // Update Headers for all 6 sheets
  var sheetsDef = [
    { name: SHEET_TRACKING, headers: HEADERS_TRACKING },
    { name: SHEET_CUSTOMER, headers: HEADERS_CUSTOMER },
    { name: SHEET_BU, headers: HEADERS_BU },
    { name: SHEET_PACKAGE, headers: HEADERS_PACKAGE },
    { name: SHEET_DOCUMENT, headers: HEADERS_DOCUMENT },
    { name: SHEET_USER, headers: HEADERS_USER }
  ];

  sheetsDef.forEach(function(item) {
    var sheet = ss.getSheetByName(item.name);
    if (sheet) {
      sheet.getRange(1, 1, 1, item.headers.length).setValues([item.headers]);
      formatSheetHeader(sheet, item.headers.length);
    }
  });

  // 2. Format Duration Columns in "Tracking" Sheet
  var updatedCount = 0;
  if (trackSheet) {
    var lastRow = trackSheet.getLastRow();
    if (lastRow > 1) {
      var numRows = lastRow - 1;
      var range = trackSheet.getRange(2, 17, numRows, 9);
      var vals = range.getValues();
      var changed = false;

      var colPairs = [
        { sIdx: 0, eIdx: 1, dIdx: 2 }, // Picking: Start=col 17 (idx 0), End=col 18 (idx 1), Dur=col 19 (idx 2)
        { sIdx: 3, eIdx: 4, dIdx: 5 }, // Checking: Start=col 20 (idx 3), End=col 21 (idx 4), Dur=col 22 (idx 5)
        { sIdx: 6, eIdx: 7, dIdx: 8 }  // Delivery: Start=col 23 (idx 6), End=col 24 (idx 7), Dur=col 25 (idx 8)
      ];

      for (var r = 0; r < numRows; r++) {
        colPairs.forEach(function(c) {
          var curVal = vals[r][c.dIdx];
          var startVal = vals[r][c.sIdx];
          var endVal = vals[r][c.eIdx];

          if (curVal !== "" && curVal !== null && curVal !== undefined && String(curVal).trim() !== "-") {
            var formatted = formatDurationGAS(curVal, startVal, endVal);
            if (formatted && formatted !== "-" && formatted !== String(curVal).trim()) {
              vals[r][c.dIdx] = asTextDate(formatted);
              updatedCount++;
              changed = true;
            }
          } else if (startVal && endVal && String(startVal).trim() !== "" && String(endVal).trim() !== "" && String(startVal) !== "-" && String(endVal) !== "-") {
            var formatted = formatDurationGAS("", startVal, endVal);
            if (formatted && formatted !== "-") {
              vals[r][c.dIdx] = asTextDate(formatted);
              updatedCount++;
              changed = true;
            }
          }
        });
      }

      if (changed) {
        range.setValues(vals);
      }

      // Clear package quantity/unit for orders that have not completed Checking yet
      try {
        var allRows = trackSheet.getRange(2, 1, numRows, HEADERS_TRACKING.length).getValues();
        for (var r = 0; r < numRows; r++) {
          var status = String(allRows[r][15] || "").trim();
          var checkingEnd = String(allRows[r][20] || "").trim();
          if ((!checkingEnd || checkingEnd === "-") && (status === "Registered" || status === "In Picking" || status === "Waiting Checking" || status === "In Checking")) {
            if (allRows[r][9] !== "" || allRows[r][10] !== "") {
              trackSheet.getRange(r + 2, 10).setValue("");
              trackSheet.getRange(r + 2, 11).setValue("");
              updatedCount++;
            }
          }
        }
      } catch(ePkg) {}

      // Ensure Plain Text format for duration columns
      try {
        trackSheet.getRange(2, 19, numRows, 1).setNumberFormat("@");
        trackSheet.getRange(2, 22, numRows, 1).setNumberFormat("@");
        trackSheet.getRange(2, 25, numRows, 1).setNumberFormat("@");
      } catch(e) {}
    }
  }

  markDataUpdated();
  return {
    status: "success",
    message: "Headers cleaned to pure English & Durations formatted to hh:mm",
    updatedDurations: updatedCount
  };
}

/**
 * Helper ជំនួយការ Parse Date string ទៅជា Date object
 */
function parseDateTimeGAS(dateStr) {
  if (!dateStr || dateStr === "-") return null;
  if (dateStr instanceof Date) return dateStr;
  var s = String(dateStr).trim();
  if (s.charAt(0) === "'") s = s.substring(1);
  
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (m) {
    var day = parseInt(m[1], 10);
    var month = parseInt(m[2], 10) - 1;
    var year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    var hours = m[4] ? parseInt(m[4], 10) : 0;
    var mins = m[5] ? parseInt(m[5], 10) : 0;
    var secs = m[6] ? parseInt(m[6], 10) : 0;
    return new Date(year, month, day, hours, mins, secs);
  }
  var clean = s.indexOf("-") > -1 ? s.replace(" ", "T") : s;
  var parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Helper ជំនួយការ Convert Duration ទៅជាទម្រង់ hh:mm (00:10, 00:01, 02:14...)
 */
function formatDurationGAS(val, startStr, endStr) {
  if (startStr && endStr && String(startStr).trim() !== "" && String(endStr).trim() !== "" && startStr !== "-" && endStr !== "-") {
    var d1 = parseDateTimeGAS(startStr);
    var d2 = parseDateTimeGAS(endStr);
    if (d1 && d2) {
      var diffMs = d2.getTime() - d1.getTime();
      if (diffMs >= 0) {
        var totalMin = Math.floor(diffMs / (1000 * 60));
        if (totalMin === 0 && diffMs >= 3000) totalMin = 1;
        var h = Math.floor(totalMin / 60);
        var m = totalMin % 60;
        return (h < 10 ? "0" + h : "" + h) + ":" + (m < 10 ? "0" + m : "" + m);
      }
    }
  }
  if (!val || val === "-" || String(val).trim() === "") return "-";
  var s = String(val).trim();
  if (s.charAt(0) === "'") s = s.substring(1);
  
  var m1 = s.match(/^(\d{1,3}):(\d{2})(?::\d{2})?$/);
  if (m1) {
    var h = parseInt(m1[1], 10);
    var m = parseInt(m1[2], 10);
    return (h < 10 ? "0" + h : "" + h) + ":" + (m < 10 ? "0" + m : "" + m);
  }
  
  var hours = 0;
  var mins = 0;
  var hMatch = s.match(/(\d+)\s*(?:ម៉ោង|h|hr|hours?)/i);
  var mMatch = s.match(/(\d+)\s*(?:នាទី|m|min|mins?)/i);
  var sMatch = s.match(/(\d+)\s*(?:វិនាទី|s|sec|secs?)/i);
  if (hMatch) hours = parseInt(hMatch[1], 10);
  if (mMatch) mins = parseInt(mMatch[1], 10);
  if (!hMatch && !mMatch && sMatch) {
    mins = parseInt(sMatch[1], 10) > 0 ? 1 : 0;
  }
  if (hMatch || mMatch || sMatch) {
    return (hours < 10 ? "0" + hours : "" + hours) + ":" + (mins < 10 ? "0" + mins : "" + mins);
  }
  
  if (/^\d+$/.test(s)) {
    var tot = parseInt(s, 10);
    var hh = Math.floor(tot / 60);
    var mm = tot % 60;
    return (hh < 10 ? "0" + hh : "" + hh) + ":" + (mm < 10 ? "0" + mm : "" + mm);
  }
  
  return s;
}

/**
 * Helper ជំនួយការ Convert Date ទៅជាទម្រង់ dd/MM/yy HH:mm
 */
function formatDateTimeGAS(val) {
  if (!val) return "";
  if (val instanceof Date) {
    var formatted = Utilities.formatDate(val, Session.getScriptTimeZone() || "Asia/Phnom_Penh", "dd/MM/yy HH:mm");
    // Protection against Google Sheets US locale day/month swap:
    // If Day=10 and Month is 4 or 5 in 2026, it was parsed as MM/dd/yy (10/05/26) instead of dd/MM/yy (05/10/26)
    var m = formatted.match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}:\d{2})$/);
    if (m) {
      var d = parseInt(m[1], 10);
      var mo = parseInt(m[2], 10);
      var yr = m[3];
      var tm = m[4];
      if (d === 10 && (mo === 4 || mo === 5) && yr === "26") {
        return (mo < 10 ? "0" + mo : mo) + "/" + (d < 10 ? "0" + d : d) + "/" + yr + " " + tm;
      }
    }
    return formatted;
  }
  var str = String(val).trim();
  if (str.charAt(0) === "'") str = str.substring(1);
  if (str.length > 16 || str.indexOf("GMT") > -1 || str.indexOf("-") > -1) {
    var parsed = new Date(str.indexOf("-") > -1 ? str.replace(" ", "T") : str);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, Session.getScriptTimeZone() || "Asia/Phnom_Penh", "dd/MM/yy HH:mm");
    }
  }
  return str;
}

function asTextDate(val) {
  if (!val) return "";
  var s = String(val).trim();
  if (s.charAt(0) === "'") return s;
  return "'" + s;
}

function getNowString() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Asia/Phnom_Penh", "dd/MM/yy HH:mm");
}

/**
 * ជំនួយការកត់ត្រា និងទាញយកពេលវេលា Data Mutation (Live Real-Time Sync)
 * ប្រើប្រាស់ ScriptProperties ដែលដំណើរការលឿនខ្លាំង (30-50ms) ដោយមិនបាច់អាន Cell ក្នុង Sheet ឡើយ!
 */
function markDataUpdated() {
  try {
    var nowTs = String(Date.now());
    PropertiesService.getScriptProperties().setProperty("LAST_DATA_UPDATE", nowTs);
    return nowTs;
  } catch(e) {
    return String(Date.now());
  }
}

function getLastDataUpdate() {
  try {
    var val = PropertiesService.getScriptProperties().getProperty("LAST_DATA_UPDATE");
    if (!val) {
      val = String(Date.now());
      PropertiesService.getScriptProperties().setProperty("LAST_DATA_UPDATE", val);
    }
    return String(val);
  } catch(e) {
    return String(Date.now());
  }
}

/**
 * ជំនួយការគ្រប់គ្រង User Presence (អ្នកកំពុង Online លើ Web App & Phone)
 * ប្រើប្រាស់ ScriptProperties ដើម្បីតាមដាន User សកម្មក្នុងរយៈពេល 2 នាទីចុងក្រោយ (Heartbeat)
 */
function handleUserPresence(e) {
  try {
    var now = Date.now();
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty("PRESENCE_REGISTRY") || "{}";
    var registry = {};
    try {
      registry = JSON.parse(raw);
    } catch(err) {
      registry = {};
    }

    var username = (e && e.parameter && e.parameter.user) ? String(e.parameter.user).trim().toLowerCase() : "";
    var action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action).toLowerCase() : "";

    if (action === "logout_presence" && username) {
      for (var k in registry) {
        if (k.toLowerCase() === username || (registry[k] && registry[k].username && registry[k].username.toLowerCase() === username)) {
          delete registry[k];
        }
      }
      props.setProperty("PRESENCE_REGISTRY", JSON.stringify(registry));
      setLastDataUpdate();
    } else if (username) {
      var displayName = (e.parameter && e.parameter.name) ? String(e.parameter.name).trim() : username;
      var role = (e.parameter && e.parameter.role) ? String(e.parameter.role).trim() : "User";
      var device = (e.parameter && e.parameter.device) ? String(e.parameter.device).trim() : "PC";
      var tab = (e.parameter && e.parameter.tab) ? String(e.parameter.tab).trim() : "dashboard";
      
      // តាមដាន User ទាំងអស់ដែលកំពុង Online ក្នុងប្រព័ន្ធ ដោយមិនកំណត់ Role
      registry[username] = {
        username: username,
        displayName: displayName,
        role: role,
        device: device,
        tab: tab,
        lastSeen: now
      };
      props.setProperty("PRESENCE_REGISTRY", JSON.stringify(registry));
    }

    // Prune entries older than 25 seconds (since heartbeat is every 3.5s)
    var activeList = [];
    var changed = false;
    for (var u in registry) {
      if (registry.hasOwnProperty(u)) {
        var entry = registry[u];
        if (now - entry.lastSeen <= 25000) { // Active within last 25 seconds
          activeList.push(entry);
        } else if (now - entry.lastSeen > 60000) { // Clean up stale records older than 1 min
          delete registry[u];
          changed = true;
        }
      }
    }

    if (changed) {
      props.setProperty("PRESENCE_REGISTRY", JSON.stringify(registry));
    }

    return activeList;
  } catch(e) {
    return [];
  }
}

/**
 * ជំនួយការតាមដានបញ្ជី SO# ដែលបានបញ្ចប់ក្នុង Daily Delivery (Cross-Device Cloud Sync)
 */
function getDailyCompletedSosGAS() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty("DAILY_COMPLETED_SOS");
    if (raw) {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch(e) {}
  return ["SO-2026-4409", "DHC-0005349", "SO-2026-4534"];
}

function addDailyCompletedSoGAS(soNumber) {
  if (!soNumber) return;
  var s = String(soNumber).trim();
  try {
    var list = getDailyCompletedSosGAS();
    if (list.indexOf(s) === -1) {
      list.push(s);
      PropertiesService.getScriptProperties().setProperty("DAILY_COMPLETED_SOS", JSON.stringify(list));
      markDataUpdated();
    }
  } catch(e) {}
}

function removeDailyCompletedSoGAS(soNumber) {
  if (!soNumber) return;
  var s = String(soNumber).trim();
  try {
    var list = getDailyCompletedSosGAS();
    var idx = list.indexOf(s);
    if (idx !== -1) {
      list.splice(idx, 1);
      PropertiesService.getScriptProperties().setProperty("DAILY_COMPLETED_SOS", JSON.stringify(list));
      markDataUpdated();
    }
  } catch(e) {}
}

/**
 * ជំនួយការរក្សាទុក និងទាញយកការកំណត់ Telegram Bot (Cloud Synced សម្រាប់គ្រប់ Users & Devices)
 * Dual-Layer Persistence: 1) PropertiesService (Ultra-fast memory) + 2) Google Sheet "System Settings" (Permanent)
 */
function getTelegramConfigGAS() {
  // Layer 1: PropertiesService
  try {
    var raw = PropertiesService.getScriptProperties().getProperty("TELEGRAM_CONFIG");
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && (parsed.botToken || parsed.chatId)) {
        return parsed;
      }
    }
  } catch(e) {}

  // Layer 2: Sheet "System Settings" fallback
  try {
    var ss = getSpreadsheet();
    var setSheet = ss.getSheetByName(SHEET_SETTINGS);
    if (setSheet && setSheet.getLastRow() > 1) {
      var data = setSheet.getRange(2, 1, setSheet.getLastRow() - 1, 2).getValues();
      for (var i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim() === "TELEGRAM_CONFIG") {
          var val = String(data[i][1] || "").trim();
          if (val) {
            var parsedSheet = JSON.parse(val);
            if (parsedSheet && typeof parsedSheet === "object") {
              try { PropertiesService.getScriptProperties().setProperty("TELEGRAM_CONFIG", val); } catch(err) {}
              return parsedSheet;
            }
          }
        }
      }
    }
  } catch(e2) {}

  return null;
}

function setTelegramConfigGAS(configObj) {
  if (!configObj || typeof configObj !== "object") return null;
  var jsonStr = JSON.stringify(configObj);

  // Layer 1: PropertiesService
  try {
    PropertiesService.getScriptProperties().setProperty("TELEGRAM_CONFIG", jsonStr);
  } catch(e) {}

  // Layer 2: Google Sheet "System Settings"
  try {
    var ss = getSpreadsheet();
    var setSheet = getOrCreateSheet(SHEET_SETTINGS, HEADERS_SETTINGS);
    var lastRow = setSheet.getLastRow();
    var foundRow = -1;
    if (lastRow > 1) {
      var keys = setSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < keys.length; i++) {
        if (String(keys[i][0]).trim() === "TELEGRAM_CONFIG") {
          foundRow = i + 2;
          break;
        }
      }
    }
    var nowStr = getNowString();
    if (foundRow > -1) {
      setSheet.getRange(foundRow, 2, 1, 2).setValues([[jsonStr, nowStr]]);
    } else {
      setSheet.appendRow(["TELEGRAM_CONFIG", jsonStr, nowStr, "Admin"]);
    }
  } catch(eSheet) {}

  markDataUpdated();
  return configObj;
}

/**
 * Handle GET Requests (Fetch Orders and Setup Master Data)
 */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action).toLowerCase() : "fetch";
    
    // 1. Fast Ping Response (Zero sheet reads, latency < 100ms)
    if (action === "ping") {
      return createJsonResponse({
        status: "success",
        message: "pong",
        timestamp: new Date().toISOString()
      });
    }

    // Explicit Logout Presence (ពេល User ចុច Sign Out)
    if (action === "logout_presence") {
      var activeUsers = handleUserPresence(e);
      return createJsonResponse({
        status: "success",
        action: "LOGGED_OUT_PRESENCE",
        onlineUsers: activeUsers
      });
    }

    // 2. Fast Change-Detection & User Presence Check (Zero sheet reads, latency ~30-50ms!)
    // Web App លើទូរស័ព្ទដៃ និងកុំព្យូទ័រ ហៅមកកាន់ Endpoint នេះរៀងរាល់ 3-4s ដើម្បីដឹងថាមានទិន្នន័យថ្មី និង User ណាខ្លះកំពុង Online
    if (action === "check_update") {
      var clientSince = (e && e.parameter && e.parameter.since) ? String(e.parameter.since).trim() : "0";
      var serverLast = getLastDataUpdate();
      var hasChanges = (serverLast !== "0" && serverLast !== clientSince);
      var onlineUsers = handleUserPresence(e);
      return createJsonResponse({
        status: "success",
        hasChanges: hasChanges,
        serverTimestamp: serverLast,
        onlineUsers: onlineUsers,
        dailyCompletedSos: getDailyCompletedSosGAS(),
        telegramConfig: getTelegramConfigGAS(),
        checkedAt: Date.now()
      });
    }

    // Telegram Config Endpoint (សម្រាប់ទូរស័ព្ទដៃ ឬ PC ទាញយកការកំណត់ភ្លាមៗ)
    if (action === "get_telegram_config") {
      return createJsonResponse({
        status: "success",
        telegramConfig: getTelegramConfigGAS()
      });
    }

    // Explicit Clean Sheet Action (សម្អាត Header ដកអក្សរខ្មែរ & Format Duration ទៅជា hh:mm)
    if (action === "clean_sheet") {
      var cleanRes = cleanAndFormatAllHeadersAndDurations();
      return createJsonResponse(cleanRes);
    }

    var ss = getSpreadsheet();
    // Only execute heavy setup if explicitly requested or if Tracking sheet is missing
    if (action === "setup" || !ss.getSheetByName(SHEET_TRACKING)) {
      setupAllSheets();
    }
    
    // 1. Fetch Orders from "Tracking"
    var trackSheet = getOrCreateSheet(SHEET_TRACKING, HEADERS_TRACKING);
    ensureTrackingHeaders(trackSheet);
    // Auto-check if old Khmer headers still exist in row 1, if so auto-clean and migrate
    try {
      var firstHdr = trackSheet.getRange(1, 1).getValue();
      if (String(firstHdr).indexOf("(") > -1) {
        cleanAndFormatAllHeadersAndDurations();
      }
    } catch(eClean) {}
    var lastRow = trackSheet.getLastRow();
    var orders = [];
    if (lastRow > 1) {
      var numCols = Math.max(trackSheet.getLastColumn(), HEADERS_TRACKING.length);
      var hRow = trackSheet.getRange(1, 1, 1, numCols).getValues()[0];
      var colMap = {};
      for (var hi = 0; hi < hRow.length; hi++) {
        var hn = String(hRow[hi] || "").trim().toLowerCase();
        if (hn) colMap[hn] = hi;
      }
      function getColIdx(names, fallback) {
        for (var ni = 0; ni < names.length; ni++) {
          if (colMap[names[ni]] !== undefined) return colMap[names[ni]];
        }
        return fallback;
      }

      var cTs = getColIdx(["timestamp"], 0);
      var cSo = getColIdx(["so#"], 1);
      var cCust = getColIdx(["customer name"], 2);
      var cCity = getColIdx(["city/province", "city / province"], 3);
      var cKhan = getColIdx(["khan", "khan / district"], 4);
      var cPl = getColIdx(["packing list#"], 5);
      var cInv = getColIdx(["invoice#"], 6);
      var cAmt = getColIdx(["amount", "invoice amount"], 7);
      var cCurr = getColIdx(["currency"], 8);
      var cPkg = getColIdx(["total package#", "total package"], 9);
      var cUnit = getColIdx(["package unit"], 10);
      var cBu = getColIdx(["bu"], 11);
      var cDoc = getColIdx(["document type"], 12);
      var cSpec = getColIdx(["special notes"], 13);
      var cPay = getColIdx(["payment receipt"], -1);
      var hasPayCol = (cPay !== -1);
      var cStatus = getColIdx(["overall status", "status"], hasPayCol ? 15 : 14);
      var cPStart = getColIdx(["picking start time"], hasPayCol ? 16 : 15);
      var cPEnd = getColIdx(["picking end time"], hasPayCol ? 17 : 16);
      var cPDur = getColIdx(["picking duration"], hasPayCol ? 18 : 17);
      var cCStart = getColIdx(["checking start time"], hasPayCol ? 19 : 18);
      var cCEnd = getColIdx(["checking end time"], hasPayCol ? 20 : 19);
      var cCDur = getColIdx(["checking duration"], hasPayCol ? 21 : 20);
      var cDStart = getColIdx(["delivery start time"], hasPayCol ? 22 : 21);
      var cDEnd = getColIdx(["delivery end time"], hasPayCol ? 23 : 22);
      var cDDur = getColIdx(["delivery duration"], hasPayCol ? 24 : 23);
      var cUpdated = getColIdx(["last updated"], hasPayCol ? 25 : 24);
      var cCreated = getColIdx(["created by"], hasPayCol ? 26 : 25);
      var cPicker = getColIdx(["picker by"], hasPayCol ? 27 : 26);
      var cChecker = getColIdx(["checker by"], hasPayCol ? 28 : 27);
      var cDriver = getColIdx(["delivery by"], hasPayCol ? 29 : 28);
      var cDNotes = getColIdx(["delivery notes"], hasPayCol ? 30 : 29);

      var data = trackSheet.getRange(2, 1, lastRow - 1, numCols).getValues();
      orders = data.map(function(row) {
        var rawCheckingEnd = String(row[cCEnd] || "").trim();
        return {
          timestamp: formatDateTimeGAS(row[cTs]),
          soNumber: String(row[cSo] || ""),
          customerName: String(row[cCust] || ""),
          cityProvince: String(row[cCity] || ""),
          khan: String(row[cKhan] || ""),
          packingListNumber: String(row[cPl] || ""),
          invoiceNumber: String(row[cInv] || ""),
          invoiceAmount: row[cAmt] !== "" ? Number(row[cAmt]) : 0,
          currency: String(row[cCurr] || "USD"),
          totalPackage: (row[cPkg] !== "" && row[cPkg] !== null && Number(row[cPkg]) > 0 && rawCheckingEnd !== "" && rawCheckingEnd !== "-") ? Number(row[cPkg]) : "",
          packageUnit: (row[cPkg] !== "" && row[cPkg] !== null && Number(row[cPkg]) > 0 && rawCheckingEnd !== "" && rawCheckingEnd !== "-") ? String(row[cUnit] || "") : "",
          bu: String(row[cBu] || ""),
          documentType: String(row[cDoc] || ""),
          paymentReceipt: (cPay !== -1 && row[cPay] !== undefined && row[cPay] !== null) ? String(row[cPay] || "").trim() : "",
          specialNotes: (function() {
            var rawSpec = String(row[cSpec] || "");
            var rawDeliv = (cDNotes !== -1) ? String(row[cDNotes] || "") : "";
            if (rawSpec && !rawDeliv) {
              var parts = rawSpec.split(/\s*\|\s*|\r?\n/);
              var kept = [];
              for (var i = 0; i < parts.length; i++) {
                var p = parts[i].trim();
                if (!p) continue;
                if (!/^\[(?:Start\s+)?(?:\d+(?:st|nd|rd|th)\s+)?Delivery/i.test(p) &&
                    !/^\[Delivery\s+/i.test(p) &&
                    !/^\[.*(?:2nd|3rd|\d+th)\s+Delivery/i.test(p)) {
                  kept.push(p);
                }
              }
              return kept.join(" | ");
            }
            return rawSpec;
          })(),
          deliveryNotes: (function() {
            var rawSpec = String(row[cSpec] || "");
            var rawDeliv = (cDNotes !== -1) ? String(row[cDNotes] || "") : "";
            if (rawDeliv) return rawDeliv;
            if (rawSpec) {
              var parts = rawSpec.split(/\s*\|\s*|\r?\n/);
              var found = [];
              for (var i = 0; i < parts.length; i++) {
                var p = parts[i].trim();
                if (!p) continue;
                if (/^\[(?:Start\s+)?(?:\d+(?:st|nd|rd|th)\s+)?Delivery/i.test(p) ||
                    /^\[Delivery\s+/i.test(p) ||
                    /^\[.*(?:2nd|3rd|\d+th)\s+Delivery/i.test(p)) {
                  found.push(p);
                }
              }
              return found.join("\n");
            }
            return "";
          })(),
          status: String(row[cStatus] || "Registered"),
          deliveryAttempts: (function() {
            var st = String(row[cStatus] || "");
            var m = st.match(/^(\d+)(?:st|nd|rd|th)\s+(?:Success|Delivery)/i);
            if (m) return parseInt(m[1], 10);
            var notes = String(row[cSpec] || "") + " " + String((cDNotes !== -1 ? row[cDNotes] : "") || "");
            var nm = notes.match(/(?:Start|Delivery)\s+(\d+)(?:st|nd|rd|th)/i);
            if (nm) return parseInt(nm[1], 10);
            return 1;
          })(),
          pickingStartTime: formatDateTimeGAS(row[cPStart]),
          pickingEndTime: formatDateTimeGAS(row[cPEnd]),
          pickingDuration: formatDurationGAS(row[cPDur], row[cPStart], row[cPEnd]),
          checkingStartTime: formatDateTimeGAS(row[cCStart]),
          checkingEndTime: formatDateTimeGAS(row[cCEnd]),
          checkingDuration: formatDurationGAS(row[cCDur], row[cCStart], row[cCEnd]),
          deliveryStartTime: formatDateTimeGAS(row[cDStart]),
          deliveryEndTime: formatDateTimeGAS(row[cDEnd]),
          deliveryDuration: formatDurationGAS(row[cDDur], row[cDStart], row[cDEnd]),
          lastUpdated: formatDateTimeGAS(row[cUpdated]),
          createdBy: String(row[cCreated] || ""),
          pickerBy: String(row[cPicker] || ""),
          checkerBy: String(row[cChecker] || ""),
          deliveryBy: String(row[cDriver] || "")
        };
      });
    }
    
    // 2. Fetch Customers from "Customer Information"
    var custSheet = getOrCreateSheet(SHEET_CUSTOMER, HEADERS_CUSTOMER);
    var custLast = custSheet.getLastRow();
    var customers = [];
    if (custLast > 1) {
      var custData = custSheet.getRange(2, 1, custLast - 1, HEADERS_CUSTOMER.length).getValues();
      customers = custData.map(function(r) {
        return {
          id: String(r[0] || ""),
          name: String(r[1] || ""),
          cityProvince: String(r[2] || ""),
          khan: String(r[3] || ""),
          lastUpdated: formatDateTimeGAS(r[4])
        };
      }).filter(function(c) { return c.name.trim() !== ""; });
    }
    
    // 3. Fetch BUs from "BU"
    var buSheet = getOrCreateSheet(SHEET_BU, HEADERS_BU);
    var buLast = buSheet.getLastRow();
    var bus = [];
    if (buLast > 1) {
      var buData = buSheet.getRange(2, 1, buLast - 1, HEADERS_BU.length).getValues();
      bus = buData.map(function(r) {
        return {
          id: String(r[0] || ""),
          name: String(r[1] || ""),
          lastUpdated: formatDateTimeGAS(r[2])
        };
      }).filter(function(b) { return b.name.trim() !== ""; });
    }
    
    // 4. Fetch Package Types from "Package Type"
    var pkgSheet = getOrCreateSheet(SHEET_PACKAGE, HEADERS_PACKAGE);
    var pkgLast = pkgSheet.getLastRow();
    var packageTypes = [];
    if (pkgLast > 1) {
      var pkgData = pkgSheet.getRange(2, 1, pkgLast - 1, HEADERS_PACKAGE.length).getValues();
      packageTypes = pkgData.map(function(r) {
        return {
          id: String(r[0] || ""),
          name: String(r[1] || ""),
          short: String(r[2] || ""),
          lastUpdated: formatDateTimeGAS(r[3])
        };
      }).filter(function(p) { return p.name.trim() !== ""; });
    }
    
    // 5. Fetch Document Types from "Document Type"
    var docSheet = getOrCreateSheet(SHEET_DOCUMENT, HEADERS_DOCUMENT);
    var docLast = docSheet.getLastRow();
    var documentTypes = [];
    if (docLast > 1) {
      var docData = docSheet.getRange(2, 1, docLast - 1, HEADERS_DOCUMENT.length).getValues();
      documentTypes = docData.map(function(r) {
        return {
          id: String(r[0] || ""),
          name: String(r[1] || ""),
          lastUpdated: formatDateTimeGAS(r[2])
        };
      }).filter(function(d) { return d.name.trim() !== ""; });
    }
    
    // 6. Fetch Users from "User Management"
    var userSheet = getOrCreateSheet(SHEET_USER, HEADERS_USER);
    var userLast = userSheet.getLastRow();
    var users = [];
    if (userLast > 1) {
      var userData = userSheet.getRange(2, 1, userLast - 1, HEADERS_USER.length).getValues();
      users = userData.map(function(r) {
        var rawPerms = String(r[5] || "");
        var permsList = rawPerms.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
        var pwStr = String(r[3] !== undefined && r[3] !== null ? r[3] : "123").trim();
        if (pwStr.charAt(0) === "'") pwStr = pwStr.substring(1);
        return {
          id: String(r[0] || ""),
          displayName: String(r[1] || ""),
          username: String(r[2] || ""),
          password: pwStr || "123",
          role: String(r[4] || "User"),
          permissions: permsList,
          lastUpdated: formatDateTimeGAS(r[6])
        };
      }).filter(function(u) { return u.username.trim() !== ""; });
    }
    
    return createJsonResponse({
      status: "success",
      count: orders.length,
      serverTimestamp: getLastDataUpdate(),
      onlineUsers: handleUserPresence(e),
      dailyCompletedSos: getDailyCompletedSosGAS(),
      telegramConfig: getTelegramConfigGAS(),
      data: orders,
      setup: {
        customers: customers,
        bus: bus,
        packageTypes: packageTypes,
        documentTypes: documentTypes,
        users: users
      }
    });
  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: error.toString()
    });
  }
}

/**
 * Handle POST Requests (Orders & Setup CRUD Operations)
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  
  try {
    var ss = getSpreadsheet();
    if (!ss.getSheetByName(SHEET_TRACKING)) {
      setupAllSheets();
    }
    
    var payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = e.parameter;
    }
    
    var action = payload.action || "REGISTER_ORDER";
    var nowFormatted = getNowString();

    // ==========================================
    // ACTION: SAVE TELEGRAM CONFIG (CENTRALIZED SCRIPT PROPERTIES FOR ALL USERS)
    // ==========================================
    if (action === "SAVE_TELEGRAM_CONFIG") {
      var tgConfig = payload.config || payload.telegramConfig || payload;
      var savedCfg = setTelegramConfigGAS(tgConfig);
      return createJsonResponse({
        status: "success",
        message: "Telegram configuration saved to Cloud successfully",
        telegramConfig: savedCfg
      });
    }

    // ==========================================
    // ACTION: SEND TELEGRAM NOTIFICATION (PROXY)
    // ==========================================
    if (action === "sendTelegram") {
      var botToken = payload.botToken ? String(payload.botToken).trim() : "";
      var chatId = payload.chatId ? String(payload.chatId).trim() : "";
      var text = payload.text || "";
      if (!botToken || !chatId) {
        var cloudCfg = getTelegramConfigGAS();
        if (cloudCfg && cloudCfg.botToken && cloudCfg.chatId) {
          if (!botToken) botToken = cloudCfg.botToken;
          if (!chatId) chatId = cloudCfg.chatId;
        }
      }
      if (!botToken || !chatId || !text) {
        return createJsonResponse({ status: "error", message: "Missing botToken, chatId, or text" });
      }
      try {
        var tgUrl = "https://api.telegram.org/bot" + botToken + "/sendMessage";
        var tgResp = UrlFetchApp.fetch(tgUrl, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: "HTML",
            disable_web_page_preview: true
          }),
          muteHttpExceptions: true
        });
        var tgData = JSON.parse(tgResp.getContentText());
        return createJsonResponse({
          status: tgResp.getResponseCode() === 200 && tgData.ok ? "success" : "error",
          success: tgResp.getResponseCode() === 200 && tgData.ok,
          result: tgData
        });
      } catch (tgErr) {
        return createJsonResponse({ status: "error", message: tgErr.toString() });
      }
    }

    // ==========================================
    // ACTION: GET TELEGRAM UPDATES / AUTO-DETECT CHATS
    // ==========================================
    if (action === "getTelegramUpdates") {
      var botToken = payload.botToken ? String(payload.botToken).trim() : "";
      if (!botToken) {
        var cloudCfg = getTelegramConfigGAS();
        if (cloudCfg && cloudCfg.botToken) botToken = cloudCfg.botToken;
      }
      if (!botToken) {
        return createJsonResponse({ status: "error", message: "Missing botToken" });
      }
      try {
        var tgUrl = "https://api.telegram.org/bot" + botToken + "/getUpdates";
        var tgResp = UrlFetchApp.fetch(tgUrl, { method: "get", muteHttpExceptions: true });
        var tgData = JSON.parse(tgResp.getContentText());
        var chatMap = {};
        if (tgData && tgData.ok && Array.isArray(tgData.result)) {
          tgData.result.forEach(function(u) {
            var msg = u.message || u.channel_post || u.my_chat_member;
            if (msg && msg.chat) {
              var c = msg.chat;
              var id = String(c.id);
              var title = c.title || (c.first_name ? (c.first_name + " " + (c.last_name || "")).trim() : c.username) || "Chat";
              chatMap[id] = { id: id, title: title, type: c.type || "group" };
            }
          });
        }
        var chatList = [];
        for (var cid in chatMap) {
          chatList.push(chatMap[cid]);
        }
        return createJsonResponse({
          status: "success",
          success: true,
          chats: chatList
        });
      } catch (tgErr) {
        return createJsonResponse({ status: "error", message: tgErr.toString() });
      }
    }

    // ==========================================
    // ACTION: LOGOUT PRESENCE
    // ==========================================
    if (action === "logout_presence") {
      var logoutUser = payload.user ? String(payload.user).trim().toLowerCase() : "";
      if (logoutUser) {
        var props = PropertiesService.getScriptProperties();
        var raw = props.getProperty("PRESENCE_REGISTRY") || "{}";
        var registry = {};
        try { registry = JSON.parse(raw); } catch(err) { registry = {}; }
        for (var k in registry) {
          if (k.toLowerCase() === logoutUser || (registry[k] && registry[k].username && registry[k].username.toLowerCase() === logoutUser)) {
            delete registry[k];
          }
        }
        props.setProperty("PRESENCE_REGISTRY", JSON.stringify(registry));
        setLastDataUpdate();
      }
      return createJsonResponse({
        status: "success",
        action: "LOGGED_OUT_PRESENCE"
      });
    }

    // ==========================================
    // ACTION: REGISTER OR UPDATE ORDER
    // ==========================================
    if (action === "REGISTER_ORDER" || action === "SAVE_ORDER") {
      var sheet = getOrCreateSheet(SHEET_TRACKING, HEADERS_TRACKING);
      ensureTrackingHeaders(sheet);
      var order = payload.order || payload;
      var soNumber = String(order.soNumber || "").trim();
      var originalSo = String(payload.originalSoNumber || order.originalSoNumber || soNumber).trim();
      
      if (!soNumber) throw new Error("SO# is required!");
      
      var rowIndex = findRowByKey(sheet, 2, originalSo);
      if (rowIndex === -1 && originalSo !== soNumber) {
        rowIndex = findRowByKey(sheet, 2, soNumber);
      }
      var rowValues = [
        asTextDate(order.timestamp || nowFormatted),
        soNumber,
        order.customerName || "",
        order.cityProvince || "",
        order.khan || "",
        order.packingListNumber || "",
        order.invoiceNumber || "",
        order.invoiceAmount || 0,
        order.currency || "USD",
        (order.totalPackage !== undefined && order.totalPackage !== null && order.totalPackage !== "" && Number(order.totalPackage) > 0) ? Number(order.totalPackage) : "",
        (order.totalPackage !== undefined && order.totalPackage !== null && order.totalPackage !== "" && Number(order.totalPackage) > 0) ? (order.packageUnit || "") : "",
        order.bu || "",
        order.documentType || "",
        order.specialNotes || "",
        order.paymentReceipt || "",
        order.status || "Registered",
        asTextDate(order.pickingStartTime || ""),
        asTextDate(order.pickingEndTime || ""),
        order.pickingDuration && order.pickingDuration !== "-" ? asTextDate(formatDurationGAS(order.pickingDuration, order.pickingStartTime, order.pickingEndTime)) : "-",
        asTextDate(order.checkingStartTime || ""),
        asTextDate(order.checkingEndTime || ""),
        order.checkingDuration && order.checkingDuration !== "-" ? asTextDate(formatDurationGAS(order.checkingDuration, order.checkingStartTime, order.checkingEndTime)) : "-",
        asTextDate(order.deliveryStartTime || ""),
        asTextDate(order.deliveryEndTime || ""),
        order.deliveryDuration && order.deliveryDuration !== "-" ? asTextDate(formatDurationGAS(order.deliveryDuration, order.deliveryStartTime, order.deliveryEndTime)) : "-",
        asTextDate(nowFormatted),
        order.createdBy || "",
        order.pickerBy || "",
        order.checkerBy || "",
        order.deliveryBy || "",
        order.deliveryNotes || ""
      ];
      
      if (rowIndex > 0) {
        var existingRow = sheet.getRange(rowIndex, 1, 1, HEADERS_TRACKING.length).getValues()[0];
        if (!order.createdBy && existingRow[26]) rowValues[26] = existingRow[26];
        if (!order.pickerBy && existingRow[27]) rowValues[27] = existingRow[27];
        if (!order.checkerBy && existingRow[28]) rowValues[28] = existingRow[28];
        if (!order.deliveryBy && existingRow[29]) rowValues[29] = existingRow[29];
        sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
        return createJsonResponse({ status: "success", action: "UPDATED", soNumber: soNumber, row: rowIndex, serverTimestamp: markDataUpdated() });
      } else {
        sheet.appendRow(rowValues);
        return createJsonResponse({ status: "success", action: "INSERTED", soNumber: soNumber, row: sheet.getLastRow(), serverTimestamp: markDataUpdated() });
      }
    }
    
    // ==========================================
    // ACTION: UPDATE STAGE TIMESTAMPS
    // ==========================================
    else if (action === "UPDATE_STAGE") {
      var sheet = getOrCreateSheet(SHEET_TRACKING, HEADERS_TRACKING);
      ensureTrackingHeaders(sheet);
      var soNumber = String(payload.soNumber || "").trim();
      if (!soNumber) throw new Error("SO# is required!");
      
      var rowIndex = findRowByKey(sheet, 2, soNumber);
      if (rowIndex <= 0) throw new Error("SO# " + soNumber + " not found!");
      
      var stage = payload.stage;
      var time = payload.timestamp || nowFormatted;
      var duration = payload.duration || "";
      var newStatus = payload.status || "";

      var numCols = Math.max(sheet.getLastColumn(), HEADERS_TRACKING.length);
      var hRow = sheet.getRange(1, 1, 1, numCols).getValues()[0];
      function findTrackingCol(names, fallback) {
        for (var i = 0; i < hRow.length; i++) {
          var hn = String(hRow[i] || "").trim().toLowerCase();
          for (var j = 0; j < names.length; j++) {
            if (hn === names[j]) return i + 1; // 1-based index
          }
        }
        return fallback;
      }

      var colPayment = findTrackingCol(["payment receipt"], 15);
      var colStatus = findTrackingCol(["overall status", "status"], 16);
      var colPStart = findTrackingCol(["picking start time"], 17);
      var colPEnd = findTrackingCol(["picking end time"], 18);
      var colPDur = findTrackingCol(["picking duration"], 19);
      var colCStart = findTrackingCol(["checking start time"], 20);
      var colCEnd = findTrackingCol(["checking end time"], 21);
      var colCDur = findTrackingCol(["checking duration"], 22);
      var colDStart = findTrackingCol(["delivery start time"], 23);
      var colDEnd = findTrackingCol(["delivery end time"], 24);
      var colDDur = findTrackingCol(["delivery duration"], 25);
      var colUpdated = findTrackingCol(["last updated"], 26);
      var colCreated = findTrackingCol(["created by"], 27);
      var colPicker = findTrackingCol(["picker by"], 28);
      var colChecker = findTrackingCol(["checker by"], 29);
      var colDriver = findTrackingCol(["delivery by"], 30);
      var colDNotes = findTrackingCol(["delivery notes"], 31);
      var colSpecNotes = findTrackingCol(["special notes"], 14);
      var colPkg = findTrackingCol(["total package#", "total package"], 10);
      var colUnit = findTrackingCol(["package unit"], 11);
      
      if (stage === "PICKING_START") {
        sheet.getRange(rowIndex, colPStart).setValue(asTextDate(time));
        sheet.getRange(rowIndex, colStatus).setValue(newStatus || "In Picking");
        if (payload.pickerBy) sheet.getRange(rowIndex, colPicker).setValue(payload.pickerBy);
      } else if (stage === "PICKING_END") {
        sheet.getRange(rowIndex, colPEnd).setValue(asTextDate(time));
        var pStart = sheet.getRange(rowIndex, colPStart).getValue();
        var pDur = duration ? formatDurationGAS(duration, pStart, time) : "";
        if (pDur && pDur !== "-") sheet.getRange(rowIndex, colPDur).setValue(asTextDate(pDur));
        sheet.getRange(rowIndex, colStatus).setValue(newStatus || "Waiting Checking");
        if (payload.pickerBy) sheet.getRange(rowIndex, colPicker).setValue(payload.pickerBy);
      } else if (stage === "CHECKING_START") {
        sheet.getRange(rowIndex, colCStart).setValue(asTextDate(time));
        sheet.getRange(rowIndex, colStatus).setValue(newStatus || "In Checking");
        if (payload.checkerBy) sheet.getRange(rowIndex, colChecker).setValue(payload.checkerBy);
      } else if (stage === "CHECKING_END") {
        sheet.getRange(rowIndex, colCEnd).setValue(asTextDate(time));
        var cStart = sheet.getRange(rowIndex, colCStart).getValue();
        var cDur = duration ? formatDurationGAS(duration, cStart, time) : "";
        if (cDur && cDur !== "-") sheet.getRange(rowIndex, colCDur).setValue(asTextDate(cDur));
        sheet.getRange(rowIndex, colStatus).setValue(newStatus || "Waiting Delivery");
        if (payload.checkerBy) sheet.getRange(rowIndex, colChecker).setValue(payload.checkerBy);
      } else if (stage === "DELIVERY_START") {
        sheet.getRange(rowIndex, colDStart).setValue(asTextDate(time));
        sheet.getRange(rowIndex, colStatus).setValue(newStatus || "In Delivery");
        sheet.getRange(rowIndex, colDEnd).setValue(""); // Clear end time for 2nd delivery
        sheet.getRange(rowIndex, colDDur).setValue(""); // Clear duration for 2nd delivery
        if (payload.deliveryBy) sheet.getRange(rowIndex, colDriver).setValue(payload.deliveryBy);
      } else if (stage === "DELIVERY_END") {
        sheet.getRange(rowIndex, colDEnd).setValue(asTextDate(time));
        var dStart = sheet.getRange(rowIndex, colDStart).getValue();
        var dDur = duration ? formatDurationGAS(duration, dStart, time) : "";
        if (dDur && dDur !== "-") sheet.getRange(rowIndex, colDDur).setValue(asTextDate(dDur));
        sheet.getRange(rowIndex, colStatus).setValue(newStatus || "Success");
        if (payload.deliveryBy) sheet.getRange(rowIndex, colDriver).setValue(payload.deliveryBy);
        addDailyCompletedSoGAS(soNumber);
      }
      
      if (payload.specialNotes !== undefined && payload.specialNotes !== null) {
        sheet.getRange(rowIndex, colSpecNotes).setValue(payload.specialNotes);
      }
      if (payload.deliveryNotes !== undefined && payload.deliveryNotes !== null) {
        sheet.getRange(rowIndex, colDNotes).setValue(payload.deliveryNotes);
      }
      
      // Update Payment Receipt if provided
      if (payload.paymentReceipt !== undefined && payload.paymentReceipt !== null) {
        sheet.getRange(rowIndex, colPayment).setValue(payload.paymentReceipt);
      }

      // Update package quantity and unit if provided (e.g. from End Checking modal)
      if (payload.totalPackage !== undefined && payload.totalPackage !== null && payload.totalPackage !== "") {
        sheet.getRange(rowIndex, colPkg).setValue(Number(payload.totalPackage));
      }
      if (payload.packageUnit) {
        sheet.getRange(rowIndex, colUnit).setValue(payload.packageUnit);
      }

      // Update operator fields if explicitly provided
      if (payload.createdBy) sheet.getRange(rowIndex, colCreated).setValue(payload.createdBy);
      if (payload.pickerBy && stage !== "PICKING_START" && stage !== "PICKING_END") sheet.getRange(rowIndex, colPicker).setValue(payload.pickerBy);
      if (payload.checkerBy && stage !== "CHECKING_START" && stage !== "CHECKING_END") sheet.getRange(rowIndex, colChecker).setValue(payload.checkerBy);
      if (payload.deliveryBy && stage !== "DELIVERY_START" && stage !== "DELIVERY_END") sheet.getRange(rowIndex, colDriver).setValue(payload.deliveryBy);
      
      sheet.getRange(rowIndex, colUpdated).setValue(asTextDate(nowFormatted));
      return createJsonResponse({ status: "success", action: "STAGE_UPDATED", soNumber: soNumber, stage: stage, serverTimestamp: markDataUpdated() });
    }
    
    // ==========================================
    // ACTION: MARK OR UNMARK DAILY COMPLETED ORDERS
    // ==========================================
    else if (action === "MARK_DAILY_COMPLETED") {
      var soNumber = String(payload.soNumber || "").trim();
      if (soNumber) addDailyCompletedSoGAS(soNumber);
      return createJsonResponse({ status: "success", action: "DAILY_COMPLETED_MARKED", soNumber: soNumber, dailyCompletedSos: getDailyCompletedSosGAS(), serverTimestamp: markDataUpdated() });
    }
    else if (action === "UNMARK_DAILY_COMPLETED") {
      var soNumber = String(payload.soNumber || "").trim();
      if (soNumber) removeDailyCompletedSoGAS(soNumber);
      return createJsonResponse({ status: "success", action: "DAILY_COMPLETED_UNMARKED", soNumber: soNumber, dailyCompletedSos: getDailyCompletedSosGAS(), serverTimestamp: markDataUpdated() });
    }
    
    // ==========================================
    // ACTION: CUSTOMER INFORMATION CRUD
    // ==========================================
    else if (action === "SAVE_CUSTOMER") {
      var sheet = getOrCreateSheet(SHEET_CUSTOMER, HEADERS_CUSTOMER);
      var cust = payload.customer || {};
      var id = String(cust.id || "CUST-" + Math.floor(1000 + Math.random() * 9000));
      var name = String(cust.name || "").trim();
      var prov = String(cust.cityProvince || "");
      var khan = String(cust.khan || "");
      
      if (!name) throw new Error("Customer Name is required!");
      
      var rowIndex = findRowByKey(sheet, 1, id);
      if (rowIndex <= 0) rowIndex = findRowByKey(sheet, 2, name); // Check by name
      
      var values = [id, name, prov, khan, nowFormatted];
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
      } else {
        sheet.appendRow(values);
      }
      return createJsonResponse({ status: "success", action: "CUSTOMER_SAVED", id: id, name: name });
    }
    else if (action === "DELETE_CUSTOMER") {
      var sheet = getOrCreateSheet(SHEET_CUSTOMER, HEADERS_CUSTOMER);
      var id = String(payload.id || "");
      var name = String(payload.name || "");
      var rowIndex = id ? findRowByKey(sheet, 1, id) : findRowByKey(sheet, 2, name);
      if (rowIndex > 1) {
        sheet.deleteRow(rowIndex);
        return createJsonResponse({ status: "success", action: "CUSTOMER_DELETED", id: id });
      }
      return createJsonResponse({ status: "warning", message: "Customer not found to delete" });
    }
    
    // ==========================================
    // ACTION: BUSINESS UNIT (BU) CRUD
    // ==========================================
    else if (action === "SAVE_BU") {
      var sheet = getOrCreateSheet(SHEET_BU, HEADERS_BU);
      var bu = payload.bu || {};
      var id = String(bu.id || "BU-" + Math.floor(100 + Math.random() * 900));
      var name = String(bu.name || "").trim();
      if (!name) throw new Error("BU Name is required!");
      
      var rowIndex = findRowByKey(sheet, 1, id);
      if (rowIndex <= 0) rowIndex = findRowByKey(sheet, 2, name);
      
      var values = [id, name, nowFormatted];
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
      } else {
        sheet.appendRow(values);
      }
      return createJsonResponse({ status: "success", action: "BU_SAVED", id: id, name: name });
    }
    else if (action === "DELETE_BU") {
      var sheet = getOrCreateSheet(SHEET_BU, HEADERS_BU);
      var id = String(payload.id || "");
      var name = String(payload.name || "");
      var rowIndex = id ? findRowByKey(sheet, 1, id) : findRowByKey(sheet, 2, name);
      if (rowIndex > 1) {
        sheet.deleteRow(rowIndex);
        return createJsonResponse({ status: "success", action: "BU_DELETED", id: id });
      }
      return createJsonResponse({ status: "warning", message: "BU not found to delete" });
    }
    
    // ==========================================
    // ACTION: PACKAGE TYPE CRUD
    // ==========================================
    else if (action === "SAVE_PACKAGE_TYPE") {
      var sheet = getOrCreateSheet(SHEET_PACKAGE, HEADERS_PACKAGE);
      var pkg = payload.packageType || {};
      var id = String(pkg.id || "PKG-" + Math.floor(100 + Math.random() * 900));
      var name = String(pkg.name || "").trim();
      var shortCode = String(pkg.short || "");
      if (!name) throw new Error("Package Type Name is required!");
      
      var rowIndex = findRowByKey(sheet, 1, id);
      if (rowIndex <= 0) rowIndex = findRowByKey(sheet, 2, name);
      
      var values = [id, name, shortCode, nowFormatted];
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
      } else {
        sheet.appendRow(values);
      }
      return createJsonResponse({ status: "success", action: "PACKAGE_TYPE_SAVED", id: id, name: name });
    }
    else if (action === "DELETE_PACKAGE_TYPE") {
      var sheet = getOrCreateSheet(SHEET_PACKAGE, HEADERS_PACKAGE);
      var id = String(payload.id || "");
      var name = String(payload.name || "");
      var rowIndex = id ? findRowByKey(sheet, 1, id) : findRowByKey(sheet, 2, name);
      if (rowIndex > 1) {
        sheet.deleteRow(rowIndex);
        return createJsonResponse({ status: "success", action: "PACKAGE_DELETED", id: id });
      }
      return createJsonResponse({ status: "warning", message: "Package Type not found to delete" });
    }
    
    // ==========================================
    // ACTION: DOCUMENT TYPE CRUD
    // ==========================================
    else if (action === "SAVE_DOC_TYPE") {
      var sheet = getOrCreateSheet(SHEET_DOCUMENT, HEADERS_DOCUMENT);
      var doc = payload.docType || {};
      var id = String(doc.id || "DOC-" + Math.floor(100 + Math.random() * 900));
      var name = String(doc.name || "").trim();
      if (!name) throw new Error("Document Type Name is required!");
      
      var rowIndex = findRowByKey(sheet, 1, id);
      if (rowIndex <= 0) rowIndex = findRowByKey(sheet, 2, name);
      
      var values = [id, name, nowFormatted];
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
      } else {
        sheet.appendRow(values);
      }
      return createJsonResponse({ status: "success", action: "DOC_TYPE_SAVED", id: id, name: name });
    }
    else if (action === "DELETE_DOC_TYPE") {
      var sheet = getOrCreateSheet(SHEET_DOCUMENT, HEADERS_DOCUMENT);
      var id = String(payload.id || "");
      var name = String(payload.name || "");
      var rowIndex = id ? findRowByKey(sheet, 1, id) : findRowByKey(sheet, 2, name);
      if (rowIndex > 1) {
        sheet.deleteRow(rowIndex);
        return createJsonResponse({ status: "success", action: "DOC_TYPE_DELETED", id: id });
      }
      return createJsonResponse({ status: "warning", message: "Document Type not found to delete" });
    }
    
    // ==========================================
    // ACTION: USER MANAGEMENT CRUD
    // ==========================================
    else if (action === "SAVE_USER") {
      var sheet = getOrCreateSheet(SHEET_USER, HEADERS_USER);
      var user = payload.user || {};
      var id = String(user.id || "USR-" + Math.floor(100 + Math.random() * 900));
      var displayName = String(user.displayName || "").trim();
      var username = String(user.username || "").trim().toLowerCase();
      var password = String(user.password || "123");
      var role = String(user.role || "User");
      
      var perms = Array.isArray(user.permissions) ? user.permissions.join(", ") : String(user.permissions || "");
      if (role === "Admin" && !perms) {
        perms = "dashboard, register, picking, checking, delivery, incompleted-delivery, report, setup";
      }
      
      if (!username) throw new Error("Username is required!");
      
      var rowIndex = findRowByKey(sheet, 1, id);
      if (rowIndex <= 0) rowIndex = findRowByKey(sheet, 3, username);
      
      var values = [id, displayName, username, asTextDate(password), role, perms, nowFormatted];
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
      } else {
        sheet.appendRow(values);
      }
      return createJsonResponse({ status: "success", action: "USER_SAVED", id: id, username: username });
    }
    else if (action === "DELETE_USER") {
      var sheet = getOrCreateSheet(SHEET_USER, HEADERS_USER);
      var id = String(payload.id || "");
      var username = String(payload.username || "").toLowerCase();
      var rowIndex = id ? findRowByKey(sheet, 1, id) : findRowByKey(sheet, 3, username);
      if (rowIndex > 1) {
        sheet.deleteRow(rowIndex);
        return createJsonResponse({ status: "success", action: "USER_DELETED", id: id, username: username });
      }
      return createJsonResponse({ status: "warning", message: "User not found to delete" });
    }
    
    // ==========================================
    // ACTION: SYNC ALL SETUP MASTER DATA AT ONCE
    // ==========================================
    else if (action === "SYNC_ALL_SETUP") {
      var setup = payload.setup || {};
      
      // Sync Customers
      if (setup.customers && Array.isArray(setup.customers)) {
        var custSheet = getOrCreateSheet(SHEET_CUSTOMER, HEADERS_CUSTOMER);
        custSheet.clearContents();
        custSheet.getRange(1, 1, 1, HEADERS_CUSTOMER.length).setValues([HEADERS_CUSTOMER]);
        formatSheetHeader(custSheet, HEADERS_CUSTOMER.length);
        if (setup.customers.length > 0) {
          var cRows = setup.customers.map(function(c) {
            return [c.id || "", c.name || "", c.cityProvince || "", c.khan || "", nowFormatted];
          });
          custSheet.getRange(2, 1, cRows.length, HEADERS_CUSTOMER.length).setValues(cRows);
        }
      }
      
      // Sync BUs
      if (setup.bus && Array.isArray(setup.bus)) {
        var buSheet = getOrCreateSheet(SHEET_BU, HEADERS_BU);
        buSheet.clearContents();
        buSheet.getRange(1, 1, 1, HEADERS_BU.length).setValues([HEADERS_BU]);
        formatSheetHeader(buSheet, HEADERS_BU.length);
        if (setup.bus.length > 0) {
          var bRows = setup.bus.map(function(b) {
            return [b.id || "", b.name || "", nowFormatted];
          });
          buSheet.getRange(2, 1, bRows.length, HEADERS_BU.length).setValues(bRows);
        }
      }
      
      // Sync Package Types
      if (setup.packageTypes && Array.isArray(setup.packageTypes)) {
        var pkgSheet = getOrCreateSheet(SHEET_PACKAGE, HEADERS_PACKAGE);
        pkgSheet.clearContents();
        pkgSheet.getRange(1, 1, 1, HEADERS_PACKAGE.length).setValues([HEADERS_PACKAGE]);
        formatSheetHeader(pkgSheet, HEADERS_PACKAGE.length);
        if (setup.packageTypes.length > 0) {
          var pRows = setup.packageTypes.map(function(p) {
            return [p.id || "", p.name || "", p.short || "", nowFormatted];
          });
          pkgSheet.getRange(2, 1, pRows.length, HEADERS_PACKAGE.length).setValues(pRows);
        }
      }
      
      // Sync Document Types
      if (setup.documentTypes && Array.isArray(setup.documentTypes)) {
        var docSheet = getOrCreateSheet(SHEET_DOCUMENT, HEADERS_DOCUMENT);
        docSheet.clearContents();
        docSheet.getRange(1, 1, 1, HEADERS_DOCUMENT.length).setValues([HEADERS_DOCUMENT]);
        formatSheetHeader(docSheet, HEADERS_DOCUMENT.length);
        if (setup.documentTypes.length > 0) {
          var dRows = setup.documentTypes.map(function(d) {
            return [d.id || "", d.name || "", nowFormatted];
          });
          docSheet.getRange(2, 1, dRows.length, HEADERS_DOCUMENT.length).setValues(dRows);
        }
      }
      
      // Sync Users (User Management)
      if (setup.users && Array.isArray(setup.users)) {
        var userSheet = getOrCreateSheet(SHEET_USER, HEADERS_USER);
        userSheet.clearContents();
        userSheet.getRange(1, 1, 1, HEADERS_USER.length).setValues([HEADERS_USER]);
        formatSheetHeader(userSheet, HEADERS_USER.length);
        if (setup.users.length > 0) {
          var uRows = setup.users.map(function(u) {
            var perms = Array.isArray(u.permissions) ? u.permissions.join(", ") : String(u.permissions || "");
            if (u.role === "Admin" && !perms) {
              perms = "dashboard, register, picking, checking, delivery, incompleted-delivery, report, setup";
            }
            return [
              u.id || "",
              u.displayName || "",
              u.username || "",
              asTextDate(u.password || "123"),
              u.role || "User",
              perms,
              nowFormatted
            ];
          });
          userSheet.getRange(2, 1, uRows.length, HEADERS_USER.length).setValues(uRows);
        }
      }
      
      return createJsonResponse({ status: "success", action: "SYNC_ALL_SETUP_COMPLETED", message: "Setup master data (Customers, BU, Package Type, Document Type, Users) synced successfully to all sheets." });
    }
    
    return createJsonResponse({ status: "error", message: "Unknown action: " + action });
    
  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: err.toString()
    });
  } finally {
    try { markDataUpdated(); } catch(pe) {}
    try { SpreadsheetApp.flush(); } catch(e) {}
    lock.releaseLock();
  }
}

/**
 * Helper ស្វែងរក Row តាមរយៈតម្លៃ Key ក្នុង Column ជាក់លាក់មួយ
 */
function findRowByKey(sheet, colIndex, keyValue) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  var colValues = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
  var target = String(keyValue || "").trim().toUpperCase();
  for (var i = 0; i < colValues.length; i++) {
    if (String(colValues[i][0]).trim().toUpperCase() === target) {
      return i + 2;
    }
  }
  return -1;
}

/**
 * ជំនួយការបង្កើត JSON Response
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
