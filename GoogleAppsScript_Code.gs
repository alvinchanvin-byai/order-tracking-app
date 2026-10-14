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

// 1. Column Definitions for "Tracking" (29 Columns)
const HEADERS_TRACKING = [
  "Timestamp (កាលបរិច្ឆេទបង្កើត)",       // Col A (1)
  "SO# (លេខបញ្ជាទិញ)",                    // Col B (2) [Unique Key]
  "Customer Name (ឈ្មោះអតិថិជន)",          // Col C (3)
  "City/Province (រាជធានី/ខេត្ត)",         // Col D (4)
  "Khan (ខណ្ឌ/ស្រុក)",                     // Col E (5)
  "Packing List# (លេខ Packing List)",     // Col F (6)
  "Invoice# (លេខ Invoice)",               // Col G (7)
  "Invoice Amount (ចំនួនទឹកប្រាក់)",        // Col H (8)
  "Currency (រូបិយប័ណ្ណ)",                 // Col I (9)
  "Total Package# (ចំនួនកញ្ចប់)",          // Col J (10)
  "Package Unit (ខ្នាត)",                  // Col K (11)
  "BU (Business Unit)",                   // Col L (12)
  "Document Type (ប្រភេទឯកសារ)",           // Col M (13)
  "Special Notes (ចំណាំពិសេស)",            // Col N (14)
  "Overall Status (ស្ថានភាពរួម)",          // Col O (15)
  "Picking Start Time (ចាប់ផ្ដើម Picking)",// Col P (16)
  "Picking End Time (បញ្ចប់ Picking)",     // Col Q (17)
  "Picking Duration (រយៈពេល Picking)",     // Col R (18)
  "Checking Start Time (ចាប់ផ្ដើម Checking)", // Col S (19)
  "Checking End Time (បញ្ចប់ Checking)",   // Col T (20)
  "Checking Duration (រយៈពេល Checking)",   // Col U (21)
  "Delivery Start Time (ចាប់ផ្ដើម Delivery)", // Col V (22)
  "Delivery End Time (បញ្ចប់ Delivery)",   // Col W (23)
  "Delivery Duration (រយៈពេល Delivery)",   // Col X (24)
  "Last Updated (កាលបរិច្ឆេទកែប្រែចុងក្រោយ)", // Col Y (25)
  "Created by (អ្នកបង្កើត)",               // Col Z (26)
  "Picker by (អ្នករៀបចំ)",                 // Col AA (27)
  "Checker by (អ្នកត្រួតពិនិត្យ)",          // Col AB (28)
  "Delivery by (អ្នកដឹកជញ្ជូន)",           // Col AC (29)
  "Delivery Notes (កំណត់សម្គាល់ Delivery)" // Col AD (30)
];

// 2. Column Definitions for "Customer Information"
const HEADERS_CUSTOMER = [
  "Customer ID",
  "Customer Name (ឈ្មោះអតិថិជន)",
  "City/Province (រាជធានី/ខេត្ត)",
  "Khan (ខណ្ឌ/ស្រុក)",
  "Last Updated"
];

// 3. Column Definitions for "BU"
const HEADERS_BU = [
  "BU ID",
  "BU Name (ឈ្មោះ Business Unit)",
  "Last Updated"
];

// 4. Column Definitions for "Package Type"
const HEADERS_PACKAGE = [
  "Package ID",
  "Package Type Name (ឈ្មោះប្រភេទកញ្ចប់)",
  "Short Code",
  "Last Updated"
];

// 5. Column Definitions for "Document Type"
const HEADERS_DOCUMENT = [
  "Document ID",
  "Document Type Name (ប្រភេទឯកសារ)",
  "Last Updated"
];

// 6. Column Definitions for "User Management" (Setup Users & Permissions)
const HEADERS_USER = [
  "User ID",
  "Display Name (ឈ្មោះបង្ហាញ)",
  "Login Username (ឈ្មោះគណនី)",
  "Password (ពាក្យសម្ងាត់)",
  "Role (តួនាទី)",
  "Permission Access Right (សិទ្ធិចូល Module)",
  "Last Updated"
];

/**
 * បង្កើត Custom Menu ពេលបើក Google Sheet
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚀 Order Tracking")
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
 * បង្កើត និង រៀបចំ Sheet ទាំង ៥ ដោយស្វ័យប្រវត្តិ
 */
function setupAllSheets() {
  var ss = getSpreadsheet();
  
  // 1. Tracking Sheet
  var trackSheet = getOrCreateSheet(SHEET_TRACKING, HEADERS_TRACKING);
  
  // 2. Customer Information Sheet
  var custSheet = getOrCreateSheet(SHEET_CUSTOMER, HEADERS_CUSTOMER);
  if (custSheet.getLastRow() <= 1) {
    var seedCustomers = [
      ["CUST-001", "Calmette Hospital (មន្ទីរពេទ្យកាល់ម៉ែត)", "Phnom Penh", "ខណ្ឌដូនពេញ (Daun Penh)", getNowString()],
      ["CUST-002", "DKSH Cambodia Ltd", "Phnom Penh", "ខណ្ឌពោធិ៍សែនជ័យ (Pou Senchey)", getNowString()],
      ["CUST-003", "Chip Mong Retail / Supermarket", "Phnom Penh", "ខណ្ឌសែនសុខ (Sen Sok)", getNowString()],
      ["CUST-004", "Phsar Leu Distribution Center", "Siem Reap", "ក្រុងសៀមរាប (Siem Reap City)", getNowString()],
      ["CUST-005", "Aeon Mall Logistics Center", "Phnom Penh", "ខណ្ឌចំការមន (Chamkarmon)", getNowString()],
      ["CUST-006", "Royal Phnom Penh Hospital", "Phnom Penh", "ខណ្ឌទួលគោក (Tuol Kouk)", getNowString()],
      ["CUST-007", "Sunrise Japan Hospital", "Phnom Penh", "ខណ្ឌជ្រោយចង្វារ (Chroy Changvar)", getNowString()]
    ];
    custSheet.getRange(2, 1, seedCustomers.length, HEADERS_CUSTOMER.length).setValues(seedCustomers);
  }
  
  // 3. BU Sheet
  var buSheet = getOrCreateSheet(SHEET_BU, HEADERS_BU);
  if (buSheet.getLastRow() <= 1) {
    var seedBUs = [
      ["BU-001", "Healthcare & Pharma (សុខាភិបាល)", getNowString()],
      ["BU-002", "Consumer Goods / FMCG (ទំនិញប្រើប្រាស់)", getNowString()],
      ["BU-003", "Industrial & Chemicals (ឧស្សាហកម្ម)", getNowString()],
      ["BU-004", "Agri-Business & Food (កសិកម្ម & អាហារ)", getNowString()],
      ["BU-005", "Technology & Equipment (បច្ចេកវិទ្យា)", getNowString()],
      ["BU-006", "General Logistics & Supply Chain", getNowString()]
    ];
    buSheet.getRange(2, 1, seedBUs.length, HEADERS_BU.length).setValues(seedBUs);
  }
  
  // 4. Package Type Sheet
  var pkgSheet = getOrCreateSheet(SHEET_PACKAGE, HEADERS_PACKAGE);
  if (pkgSheet.getLastRow() <= 1) {
    var seedPkgs = [
      ["PKG-001", "Carton (កេស)", "Ctns", getNowString()],
      ["PKG-002", "Pallet (ប៉ាឡែត)", "Plts", getNowString()],
      ["PKG-003", "Bag (បាវ/ថង់)", "Bags", getNowString()],
      ["PKG-004", "Box (ប្រអប់)", "Boxes", getNowString()],
      ["PKG-005", "Bundle (បាច់/ដុំ)", "Bdls", getNowString()],
      ["PKG-006", "Drum (ធុង/Barrel)", "Drums", getNowString()],
      ["PKG-007", "Crate (កន្ត្រក/ទ្រុង)", "Crts", getNowString()]
    ];
    pkgSheet.getRange(2, 1, seedPkgs.length, HEADERS_PACKAGE.length).setValues(seedPkgs);
  }
  
  // 5. Document Type Sheet
  var docSheet = getOrCreateSheet(SHEET_DOCUMENT, HEADERS_DOCUMENT);
  if (docSheet.getLastRow() <= 1) {
    var seedDocs = [
      ["DOC-001", "Tax Invoice (វិក្កយបត្រពន្ធ)", getNowString()],
      ["DOC-002", "Commercial Invoice (វិក្កយបត្រពាណិជ្ជកម្ម)", getNowString()],
      ["DOC-003", "Delivery Order / DO (ប័ណ្ណប្រគល់ទំនិញ)", getNowString()],
      ["DOC-004", "Packing List (បញ្ជីរាយទំនិញ)", getNowString()],
      ["DOC-005", "Inter-Warehouse Transfer (ប័ណ្ណផ្ទេរឃ្លាំង)", getNowString()],
      ["DOC-006", "Cash Sale Slip (វិក្កយបត្រលក់សាច់ប្រាក់)", getNowString()],
      ["DOC-007", "Consignment Note (ប័ណ្ណទំនិញផ្ញើលក់)", getNowString()]
    ];
    docSheet.getRange(2, 1, seedDocs.length, HEADERS_DOCUMENT.length).setValues(seedDocs);
  }
  
  // 6. User Management Sheet
  var userSheet = getOrCreateSheet(SHEET_USER, HEADERS_USER);
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
  
  Logger.log("✅ All 6 Sheets setup successfully in Spreadsheet: " + SPREADSHEET_NAME);
}

function setupTrackingHeaders() {
  var sheet = getOrCreateSheet(SHEET_TRACKING, HEADERS_TRACKING);
  sheet.getRange(1, 1, 1, HEADERS_TRACKING.length).setValues([HEADERS_TRACKING]);
  formatSheetHeader(sheet, HEADERS_TRACKING.length);
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
      delete registry[username];
      props.setProperty("PRESENCE_REGISTRY", JSON.stringify(registry));
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

    // Prune entries older than 2 minutes (120,000 ms) for all active users
    var activeList = [];
    var changed = false;
    for (var u in registry) {
      if (registry.hasOwnProperty(u)) {
        var entry = registry[u];
        if (now - entry.lastSeen <= 120000) { // Active within last 2 minutes
          activeList.push(entry);
        } else if (now - entry.lastSeen > 600000) { // Clean up stale records older than 10 mins
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
        checkedAt: Date.now()
      });
    }

    var ss = getSpreadsheet();
    // Only execute heavy setup if explicitly requested or if Tracking sheet is missing
    if (action === "setup" || !ss.getSheetByName(SHEET_TRACKING)) {
      setupAllSheets();
    }
    
    // 1. Fetch Orders from "Tracking"
    var trackSheet = getOrCreateSheet(SHEET_TRACKING, HEADERS_TRACKING);
    var lastRow = trackSheet.getLastRow();
    var orders = [];
    if (lastRow > 1) {
      var data = trackSheet.getRange(2, 1, lastRow - 1, HEADERS_TRACKING.length).getValues();
      orders = data.map(function(row) {
        return {
          timestamp: formatDateTimeGAS(row[0]),
          soNumber: String(row[1] || ""),
          customerName: String(row[2] || ""),
          cityProvince: String(row[3] || ""),
          khan: String(row[4] || ""),
          packingListNumber: String(row[5] || ""),
          invoiceNumber: String(row[6] || ""),
          invoiceAmount: row[7] !== "" ? Number(row[7]) : 0,
          currency: String(row[8] || "USD"),
          totalPackage: row[9] !== "" ? Number(row[9]) : 0,
          packageUnit: String(row[10] || "Carton"),
          bu: String(row[11] || ""),
          documentType: String(row[12] || ""),
          specialNotes: (function() {
            var rawSpec = String(row[13] || "");
            var rawDeliv = String(row[29] || "");
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
            var rawSpec = String(row[13] || "");
            var rawDeliv = String(row[29] || "");
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
          status: String(row[14] || "Registered"),
          deliveryAttempts: (function() {
            var st = String(row[14] || "");
            var m = st.match(/^(\d+)(?:st|nd|rd|th)\s+(?:Success|Delivery)/i);
            if (m) return parseInt(m[1], 10);
            var notes = String(row[13] || "") + " " + String(row[29] || "");
            var nm = notes.match(/(?:Start|Delivery)\s+(\d+)(?:st|nd|rd|th)/i);
            if (nm) return parseInt(nm[1], 10);
            return 1;
          })(),
          pickingStartTime: formatDateTimeGAS(row[15]),
          pickingEndTime: formatDateTimeGAS(row[16]),
          pickingDuration: String(row[17] || "-"),
          checkingStartTime: formatDateTimeGAS(row[18]),
          checkingEndTime: formatDateTimeGAS(row[19]),
          checkingDuration: String(row[20] || "-"),
          deliveryStartTime: formatDateTimeGAS(row[21]),
          deliveryEndTime: formatDateTimeGAS(row[22]),
          deliveryDuration: String(row[23] || "-"),
          lastUpdated: formatDateTimeGAS(row[24]),
          createdBy: String(row[25] || ""),
          pickerBy: String(row[26] || ""),
          checkerBy: String(row[27] || ""),
          deliveryBy: String(row[28] || "")
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
    // ACTION: REGISTER OR UPDATE ORDER
    // ==========================================
    if (action === "REGISTER_ORDER" || action === "SAVE_ORDER") {
      var sheet = getOrCreateSheet(SHEET_TRACKING, HEADERS_TRACKING);
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
        order.totalPackage || 1,
        order.packageUnit || "Carton",
        order.bu || "",
        order.documentType || "",
        order.specialNotes || "",
        order.status || "Registered",
        asTextDate(order.pickingStartTime || ""),
        asTextDate(order.pickingEndTime || ""),
        order.pickingDuration || "-",
        asTextDate(order.checkingStartTime || ""),
        asTextDate(order.checkingEndTime || ""),
        order.checkingDuration || "-",
        asTextDate(order.deliveryStartTime || ""),
        asTextDate(order.deliveryEndTime || ""),
        order.deliveryDuration || "-",
        asTextDate(nowFormatted),
        order.createdBy || "",
        order.pickerBy || "",
        order.checkerBy || "",
        order.deliveryBy || "",
        order.deliveryNotes || ""
      ];
      
      if (rowIndex > 0) {
        var existingRow = sheet.getRange(rowIndex, 1, 1, HEADERS_TRACKING.length).getValues()[0];
        if (!order.createdBy && existingRow[25]) rowValues[25] = existingRow[25];
        if (!order.pickerBy && existingRow[26]) rowValues[26] = existingRow[26];
        if (!order.checkerBy && existingRow[27]) rowValues[27] = existingRow[27];
        if (!order.deliveryBy && existingRow[28]) rowValues[28] = existingRow[28];
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
      var soNumber = String(payload.soNumber || "").trim();
      if (!soNumber) throw new Error("SO# is required!");
      
      var rowIndex = findRowByKey(sheet, 2, soNumber);
      if (rowIndex <= 0) throw new Error("SO# " + soNumber + " not found!");
      
      var stage = payload.stage;
      var time = payload.timestamp || nowFormatted;
      var duration = payload.duration || "";
      var newStatus = payload.status || "";
      
      if (stage === "PICKING_START") {
        sheet.getRange(rowIndex, 16).setValue(asTextDate(time));
        sheet.getRange(rowIndex, 15).setValue(newStatus || "In Picking");
        if (payload.pickerBy) sheet.getRange(rowIndex, 27).setValue(payload.pickerBy);
      } else if (stage === "PICKING_END") {
        sheet.getRange(rowIndex, 17).setValue(asTextDate(time));
        if (duration) sheet.getRange(rowIndex, 18).setValue(duration);
        sheet.getRange(rowIndex, 15).setValue(newStatus || "Waiting Checking");
        if (payload.pickerBy) sheet.getRange(rowIndex, 27).setValue(payload.pickerBy);
      } else if (stage === "CHECKING_START") {
        sheet.getRange(rowIndex, 19).setValue(asTextDate(time));
        sheet.getRange(rowIndex, 15).setValue(newStatus || "In Checking");
        if (payload.checkerBy) sheet.getRange(rowIndex, 28).setValue(payload.checkerBy);
      } else if (stage === "CHECKING_END") {
        sheet.getRange(rowIndex, 20).setValue(asTextDate(time));
        if (duration) sheet.getRange(rowIndex, 21).setValue(duration);
        sheet.getRange(rowIndex, 15).setValue(newStatus || "Waiting Delivery");
        if (payload.checkerBy) sheet.getRange(rowIndex, 28).setValue(payload.checkerBy);
      } else if (stage === "DELIVERY_START") {
        sheet.getRange(rowIndex, 22).setValue(asTextDate(time));
        sheet.getRange(rowIndex, 15).setValue(newStatus || "In Delivery");
        sheet.getRange(rowIndex, 23).setValue(""); // Clear end time for 2nd delivery
        sheet.getRange(rowIndex, 24).setValue(""); // Clear duration for 2nd delivery
        if (payload.deliveryBy) sheet.getRange(rowIndex, 29).setValue(payload.deliveryBy);
      } else if (stage === "DELIVERY_END") {
        sheet.getRange(rowIndex, 23).setValue(asTextDate(time));
        if (duration) sheet.getRange(rowIndex, 24).setValue(duration);
        sheet.getRange(rowIndex, 15).setValue(newStatus || "Success");
        if (payload.deliveryBy) sheet.getRange(rowIndex, 29).setValue(payload.deliveryBy);
      }
      
      if (payload.specialNotes !== undefined && payload.specialNotes !== null) {
        sheet.getRange(rowIndex, 14).setValue(payload.specialNotes);
      }
      if (payload.deliveryNotes !== undefined && payload.deliveryNotes !== null) {
        sheet.getRange(rowIndex, 30).setValue(payload.deliveryNotes);
      }
      
      // Update package quantity and unit if provided (e.g. from End Checking modal)
      if (payload.totalPackage !== undefined && payload.totalPackage !== null && payload.totalPackage !== "") {
        sheet.getRange(rowIndex, 10).setValue(Number(payload.totalPackage));
      }
      if (payload.packageUnit) {
        sheet.getRange(rowIndex, 11).setValue(payload.packageUnit);
      }

      // Update operator fields if explicitly provided
      if (payload.createdBy) sheet.getRange(rowIndex, 26).setValue(payload.createdBy);
      if (payload.pickerBy && stage !== "PICKING_START" && stage !== "PICKING_END") sheet.getRange(rowIndex, 27).setValue(payload.pickerBy);
      if (payload.checkerBy && stage !== "CHECKING_START" && stage !== "CHECKING_END") sheet.getRange(rowIndex, 28).setValue(payload.checkerBy);
      if (payload.deliveryBy && stage !== "DELIVERY_START" && stage !== "DELIVERY_END") sheet.getRange(rowIndex, 29).setValue(payload.deliveryBy);
      
      sheet.getRange(rowIndex, 25).setValue(asTextDate(nowFormatted));
      return createJsonResponse({ status: "success", action: "STAGE_UPDATED", soNumber: soNumber, stage: stage, serverTimestamp: markDataUpdated() });
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
