/**
 * Order Tracking Web App - Core Controller
 * Manages State, Form Validation, Stage Progression, Google Sheets Auto-Sync & Views
 */

// Global State
const AppState = {
    orders: [],
    currentTab: "daily-delivery", // daily-delivery, register, picking, checking, delivery, incompleted-delivery, dashboard, report, setup
    filterStatus: "ALL",
    searchQuery: "",
    filterBU: "ALL",
    tableCurrentPage: 1,
    tablePageSize: 10,
    activeTimerInterval: null,
    setup: {
        customers: [],
        bus: [],
        packageTypes: [],
        documentTypes: [],
        users: []
    },
    currentUser: null,
    onlineUsers: [], // Real-time active users presence list
    currentSetupSubTab: "customer",
    highlightedOrders: new Set(),
    highlightColor: null,
    dashboardSortColumn: "datetime",
    dashboardSortDirection: "desc",
    report: {
        activeTab: "register", // "register", "picking", "checking", "delivery"
        filterYear: "ALL",
        filterMonth: "ALL",
        filterFromDate: "",
        filterToDate: "",
        searchQuery: "",
        currentPage: 1,
        pageSize: 10,
        sortColumn: "soDate",
        sortDirection: "desc"
    },
    dailyDelivery: {
        searchQuery: "",
        datePreset: "ALL", // "ALL", "TODAY", "YESTERDAY", "THIS_MONTH"
        filterDate: "",
        sortColumn: "soDate",
        sortDirectionTable1: "desc",
        sortDirectionTable2: "desc",
        pageTable2: 1,
        pageSizeTable2: 15
    }
};

// LocalStorage Keys
const STORAGE_ORDERS_KEY = "order_tracker_orders_data_v1";
const STORAGE_SETUP_CUSTOMERS = "order_tracker_setup_customers_v1";
const STORAGE_SETUP_BU = "order_tracker_setup_bu_v1";
const STORAGE_SETUP_PKG = "order_tracker_setup_pkg_v1";
const STORAGE_SETUP_DOC = "order_tracker_setup_doc_v1";
const STORAGE_SETUP_USERS = "order_tracker_setup_users_v1";
const STORAGE_ACTIVE_USER = "order_tracker_active_user_v1";
const STORAGE_REMEMBER_ME_USER = "order_tracker_remembered_username_v1";
const STORAGE_REMEMBER_ME_PASS = "order_tracker_remembered_password_v1";
const STORAGE_REMEMBER_ME_CHECKED = "order_tracker_remember_me_v1";
const STORAGE_COL_PREFS = "order_tracker_column_prefs_v1";
const STORAGE_PER_CARD_COL_PREFS = "order_tracker_per_card_col_prefs_v2";
const STORAGE_HIGHLIGHT_COLOR = "order_tracker_highlight_color_v2";
const STORAGE_HIGHLIGHTED_ORDERS = "order_tracker_highlighted_orders_v2";

// Table Columns Definition for Personal Display (All English Headers)
const DASHBOARD_COLUMNS = [
    { key: "status", label: "Status" },
    { key: "datetime", label: "Date & Time" },
    { key: "soNumber", label: "SO#" },
    { key: "customerName", label: "Customer Name" },
    { key: "cityProvince", label: "City / Province" },
    { key: "khan", label: "Khan / District" },
    { key: "packingList", label: "Packing List#" },
    { key: "invoiceNumber", label: "Invoice#" },
    { key: "invoiceAmount", label: "Invoice Amount" },
    { key: "totalPackage", label: "Total Package" },
    { key: "bu", label: "BU" },
    { key: "documentType", label: "Document Type" },
    { key: "createdBy", label: "Created by" },
    { key: "pickerBy", label: "Picker by" },
    { key: "checkerBy", label: "Checker by" },
    { key: "deliveryBy", label: "Delivery by" },
    { key: "specialNotes", label: "Special Notes" },
    { key: "paymentReceipt", label: "Payment Receipt" },
    { key: "deliveryNotes", label: "Delivery Notes" },
    { key: "processTimeline", label: "Process Timeline" },
    { key: "actions", label: "Actions" }
];

function getActiveCardKey() {
    return AppState.filterStatus || "ALL";
}

function getCardDisplayName(cardKey) {
    const map = {
        "ALL": "All Statuses (គ្រប់ស្ថានភាព)",
        "REGISTERED": "Register order",
        "PICKING": "កំពុង Picking",
        "CHECKING": "កំពុង Checking",
        "DELIVERY": "កំពុង Delivery",
        "INCOMPLETE": "In Completed Delivery",
        "COMPLETED": "ជោគជ័យ (Success)"
    };
    return map[cardKey] || cardKey;
}

function getAllCardColumnPrefs() {
    const saved = localStorage.getItem(STORAGE_PER_CARD_COL_PREFS);
    let allPrefs = {};
    if (saved) {
        try {
            allPrefs = JSON.parse(saved);
        } catch (e) {
            console.error("Error parsing per-card column prefs:", e);
        }
    }
    return allPrefs;
}

// Get column preferences specifically for a card (defaulting if not yet set)
function getColumnPrefs(cardKey = null) {
    const key = cardKey || getActiveCardKey();
    const allPrefs = getAllCardColumnPrefs();

    if (allPrefs[key]) {
        return allPrefs[key];
    }

    // Default configuration for a card
    const defaults = {};
    DASHBOARD_COLUMNS.forEach(c => { defaults[c.key] = true; });

    // Seed default for REGISTERED as requested in user example:
    // "Example: ដូចរូបខាងលេី Card Register Order Personal display ត្រូវបានដក invoice amount, Total package, Process time."
    if (key === "REGISTERED") {
        defaults.invoiceAmount = false;
        defaults.totalPackage = false;
        defaults.processTimeline = false;
    }

    return defaults;
}

// Save column preferences specifically for a card
function saveColumnPrefs(prefs, cardKey = null) {
    const key = cardKey || getActiveCardKey();
    const allPrefs = getAllCardColumnPrefs();
    allPrefs[key] = prefs;
    localStorage.setItem(STORAGE_PER_CARD_COL_PREFS, JSON.stringify(allPrefs));
    applyColumnVisibility(prefs);
}

// Reset column preferences for the active card
function resetColumnPrefsForActiveCard() {
    const key = getActiveCardKey();
    const allPrefs = getAllCardColumnPrefs();
    delete allPrefs[key];
    localStorage.setItem(STORAGE_PER_CARD_COL_PREFS, JSON.stringify(allPrefs));
    const freshDefaults = getColumnPrefs(key);
    applyColumnVisibility(freshDefaults);
    return freshDefaults;
}

// Update column count badge (e.g., 5/19, 19/19) on button and popover header/footer
function updatePersonalDisplayCountBadge(prefs = null) {
    const cardKey = getActiveCardKey();
    const curPrefs = prefs || getColumnPrefs(cardKey);
    const total = DASHBOARD_COLUMNS.length; // 19
    const selectedCount = DASHBOARD_COLUMNS.filter(c => curPrefs[c.key] !== false).length;
    const countText = `${selectedCount}/${total}`;

    const btnBadge = document.getElementById("personalDisplayCountBadge");
    if (btnBadge) {
        btnBadge.textContent = countText;
        btnBadge.className = selectedCount < total
            ? "text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-mono shadow-xs transition"
            : "text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono border border-blue-200 transition";
    }

    const headerBadge = document.getElementById("personalDisplayHeaderBadge");
    if (headerBadge) {
        headerBadge.textContent = countText;
        headerBadge.className = selectedCount < total
            ? "text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-mono shadow-xs transition"
            : "text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono border border-blue-200 transition";
    }

    const footerBadge = document.getElementById("personalDisplayFooterCountBadge");
    if (footerBadge) {
        footerBadge.textContent = countText;
        footerBadge.className = selectedCount < total
            ? "text-[11px] font-bold font-mono text-white bg-blue-600 px-1.5 py-0.5 rounded shadow-xs transition"
            : "text-[11px] font-bold font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 transition";
    }
}
window.updatePersonalDisplayCountBadge = updatePersonalDisplayCountBadge;

// Apply column visibility CSS based on the active card's preferences
function applyColumnVisibility(prefs = null) {
    const curPrefs = prefs || getColumnPrefs();
    let styleEl = document.getElementById("personalDisplayStyles");
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "personalDisplayStyles";
        document.head.appendChild(styleEl);
    }

    const hiddenKeys = Object.keys(curPrefs).filter(k => curPrefs[k] === false);
    if (hiddenKeys.length === 0) {
        styleEl.textContent = "";
    } else {
        const rules = hiddenKeys.map(k => `[data-col="${k}"] { display: none !important; }`).join("\n");
        styleEl.textContent = rules;
    }
    updatePersonalDisplayCountBadge(curPrefs);
}

// Ordinal helper: 1st, 2nd, 3rd, 4th, 5th...
function getOrdinal(n) {
    const num = Number(n) || 1;
    const s = ["th", "st", "nd", "rd"];
    const v = num % 100;
    return num + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Compute success status string: 1st attempt -> "Success", 2nd attempt -> "2nd Success", 3rd -> "3rd Success"...
function getSuccessStatusName(attempts) {
    const att = Number(attempts) || 1;
    if (att <= 1) return "Success";
    return `${getOrdinal(att)} Success`;
}

// Compute delivery status string: 1st attempt -> "In Delivery", 2nd attempt -> "2nd Delivery", 3rd -> "3rd Delivery"...
function getDeliveryStatusName(attempts) {
    const att = Number(attempts) || 1;
    if (att <= 1) return "In Delivery";
    return `${getOrdinal(att)} Delivery`;
}

// Color styling for Document Types (SO to customer, Stock Transfer, Sample, Consignment)
function getDocumentTypeBadgeClass(docType) {
    const raw = String(docType || "").trim().toLowerCase();
    if (raw.includes("so to customer") || raw.includes("sales order") || raw.includes("so to") || raw === "so") {
        return "bg-blue-50 text-blue-700 border-blue-200/90";
    }
    if (raw.includes("stock transfer") || raw.includes("transfer") || raw.includes("stock")) {
        return "bg-emerald-50 text-emerald-700 border-emerald-200/90";
    }
    if (raw.includes("sample")) {
        return "bg-purple-50 text-purple-700 border-purple-200/90";
    }
    if (raw.includes("consignment")) {
        return "bg-amber-50 text-amber-800 border-amber-200/90";
    }
    return "bg-slate-50 text-slate-700 border-slate-200/90";
}

function renderDocumentTypeBadge(docType, extraClasses = "") {
    const name = docType || "SO to customer";
    const colorClass = getDocumentTypeBadgeClass(name);
    return `<span class="text-xs px-2 py-0.5 rounded-md font-semibold border ${colorClass} ${extraClasses}" title="Document Type: ${escapeHtml(name)}">${escapeHtml(name)}</span>`;
}

// Generate Next Auto SO Number in format: SO-FSCO-YYMMxxx (e.g. SO-FSCO-2610001, SO-FSCO-2610002)
function generateNextAutoSONumber() {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `SO-FSCO-${yy}${mm}`;
    const normPrefix = `SOFSCO${yy}${mm}`;

    let maxSeq = 0;
    let orders = (window.AppState && Array.isArray(AppState.orders)) ? AppState.orders.slice() : [];

    // Also include saved orders from localStorage if any
    try {
        const raw = localStorage.getItem("order_tracker_orders_data_v1");
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const seenSos = new Set(orders.map(o => String(o?.soNumber || o?.orderNumber || o?.so || "").trim().toUpperCase()));
                parsed.forEach(p => {
                    const s = String(p?.soNumber || p?.orderNumber || p?.so || "").trim().toUpperCase();
                    if (s && !seenSos.has(s)) {
                        orders.push(p);
                        seenSos.add(s);
                    }
                });
            }
        }
    } catch (e) {}

    orders.forEach(o => {
        if (!o) return;
        const rawSo = String(o.soNumber || o.orderNumber || o.so || "").trim().toUpperCase();
        if (!rawSo) return;
        const normSo = rawSo.replace(/[-_\s]+/g, "");
        if (normSo.startsWith(normPrefix)) {
            const suffix = normSo.slice(normPrefix.length);
            const match = suffix.match(/^(\d+)/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (!isNaN(num) && num > maxSeq) {
                    maxSeq = num;
                }
            }
        }
    });

    const nextSeq = maxSeq + 1;
    const seqStr = String(nextSeq).padStart(3, "0");
    return `${prefix}${seqStr}`;
}

// Clean English status mapping
function normalizeOrderStatus(status, attempts = 1) {
    if (!status) return "Registered";
    const str = String(status).trim();
    const s = str.toLowerCase();
    if (s === "incomplete" || s.includes("incomplete") || s.includes("មិនបានជោគជ័យ") || s.includes("មិនពេញលេញ")) return "Incomplete";
    if (s === "return" || s.includes("return") || s.includes("ត្រឡប់") || s.includes("បង្វែរ")) return "Return";

    // Support and preserve "2nd Success", "3rd Success", "Nth Success"
    const match = str.match(/^(\d+(?:st|nd|rd|th))\s+Success$/i);
    if (match) {
        return `${match[1]} Success`;
    }
    if (s === "2nd success" || s.includes("2nd success")) return "2nd Success";
    if (s === "3rd success" || s.includes("3rd success")) return "3rd Success";

    // Support and preserve "2nd Delivery", "3rd Delivery", "Nth Delivery"
    const delivMatch = str.match(/^(\d+(?:st|nd|rd|th))\s+Delivery$/i);
    if (delivMatch) {
        return `${delivMatch[1]} Delivery`;
    }
    if (s === "2nd delivery" || s.includes("2nd delivery")) return "2nd Delivery";
    if (s === "3rd delivery" || s.includes("3rd delivery")) return "3rd Delivery";

    if (s === "success" || s.includes("success") || s === "delivered" || s.includes("delivered") || s.includes("ប្រគល់") || s.includes("ជោគជ័យ") || s.includes("completed")) {
        const att = Number(attempts) || 1;
        return att > 1 ? getSuccessStatusName(att) : "Success";
    }
    if (s.includes("in delivery") || s === "delivery" || s.includes("កំពុងដឹក")) {
        const att = Number(attempts) || 1;
        return att > 1 ? getDeliveryStatusName(att) : "In Delivery";
    }
    if (s.includes("waiting delivery") || s.includes("ready for delivery") || s.includes("checking completed") || s.includes("រង់ចាំដឹក")) return "Waiting Delivery";
    if (s.includes("in checking") || s === "checking" || s.includes("កំពុងពិនិត្យ") || s.includes("កំពុងត្រួតពិនិត្យ")) return "In Checking";
    if (s.includes("waiting checking") || s.includes("ready for checking") || s.includes("picking completed") || s.includes("រង់ចាំពិនិត្យ") || s.includes("រង់ចាំត្រួតពិនិត្យ")) return "Waiting Checking";
    if (s.includes("in picking") || s === "picking" || s.includes("កំពុងរៀបចំ")) return "In Picking";
    if (s.includes("registered") || s.includes("ចុះឈ្មោះ")) return "Registered";
    return status;
}

// Utility to separate genuine Special Notes from 2nd/3rd Delivery notes & retry logs
function separateSpecialAndDeliveryNotes(order) {
    if (!order) return order;
    let spec = (order.specialNotes || "").trim();
    let deliv = (order.deliveryNotes || "").trim();

    if (spec) {
        // Split by ' | ' or newlines
        const parts = spec.split(/\s*\|\s*|\r?\n/).map(p => p.trim()).filter(Boolean);
        const keptSpecial = [];
        const foundDelivery = [];

        for (const p of parts) {
            const isDeliveryLog =
                /^\[(?:Start\s+)?(?:\d+(?:st|nd|rd|th)\s+)?Delivery[^\]]*\]/i.test(p) ||
                /^\[Delivery\s+[^\]]+\]/i.test(p) ||
                /^\[(?:Success|\d+(?:st|nd|rd|th)\s+Success|Incomplete|Return)(?:\s*\([^)]*\))?\]/i.test(p) ||
                /^\[.*(?:2nd|3rd|\d+th)\s+Delivery.*\]/i.test(p);

            if (isDeliveryLog) {
                foundDelivery.push(p);
            } else {
                keptSpecial.push(p);
            }
        }

        order.specialNotes = keptSpecial.join(" | ");

        if (foundDelivery.length > 0) {
            const combinedDelivery = deliv ? (deliv.split(/\r?\n/).concat(foundDelivery)) : foundDelivery;
            const uniqueDelivery = [];
            const seen = new Set();
            for (const item of combinedDelivery) {
                const clean = item.trim();
                if (clean && !seen.has(clean)) {
                    seen.add(clean);
                    uniqueDelivery.push(clean);
                }
            }
            order.deliveryNotes = uniqueDelivery.join("\n");
        }
    }

    if (!order.deliveryNotes) {
        order.deliveryNotes = deliv || "";
    }

    return order;
}

// Render delivery notes entries into nicely styled badges/lines with icons
function renderDeliveryNotesItems(rawNotes) {
    if (!rawNotes) return "";
    const lines = String(rawNotes)
        .split(/\r?\n|\s*\|\s*(?=\[)/)
        .map(l => l.trim())
        .filter(Boolean);

    if (lines.length === 0) return "";

    return lines.map(line => {
        const isStart = /^\[Start/i.test(line);
        const isIncomplete = /incomplete/i.test(line);
        const isReturn = /return/i.test(line);
        const isSuccess = /success/i.test(line);

        let icon = "navigation";
        let badgeClass = "bg-white/95 border-sky-200 text-sky-900";
        let iconClass = "text-sky-600";

        if (isIncomplete) {
            icon = "alert-triangle";
            badgeClass = "bg-amber-100/80 border-amber-300 text-amber-950";
            iconClass = "text-amber-700";
        } else if (isReturn) {
            icon = "rotate-ccw";
            badgeClass = "bg-rose-100/80 border-rose-300 text-rose-950";
            iconClass = "text-rose-700";
        } else if (isSuccess) {
            icon = "check-circle-2";
            badgeClass = "bg-emerald-100/80 border-emerald-300 text-emerald-950";
            iconClass = "text-emerald-700";
        } else if (isStart) {
            icon = "navigation";
            badgeClass = "bg-blue-50/90 border-blue-200 text-blue-950";
            iconClass = "text-blue-600";
        }

        return `
            <div class="flex items-start gap-1.5 p-1.5 rounded-lg border ${badgeClass} text-[11px] leading-snug">
                <i data-lucide="${icon}" class="w-3.5 h-3.5 ${iconClass} shrink-0 mt-0.5"></i>
                <span class="break-words font-medium font-mono">${escapeHtml(line)}</span>
            </div>
        `;
    }).join("");
}

// Check if an order has reached or completed End Checking and has a valid Total Package count
function hasOrderTotalPackage(order) {
    if (!order) return false;
    const hasEndedChecking = !!(order.checkingEndTime && String(order.checkingEndTime).trim() !== "" && String(order.checkingEndTime).trim() !== "-");
    const isPostCheckingStatus = /Waiting Delivery|Delivery|Success|Return|Incomplete|In Complete|Completed/i.test(String(order.status || ""));
    const isChecked = hasEndedChecking || isPostCheckingStatus;
    const hasValidNum = (order.totalPackage !== undefined && order.totalPackage !== null && order.totalPackage !== "" && Number(order.totalPackage) > 0);
    return Boolean(isChecked && hasValidNum);
}
window.hasOrderTotalPackage = hasOrderTotalPackage;

// Parse a payment receipt string (e.g. "Paid to Company Account ($10,200.00)" or "Company Account: $10,200 | Cash: ៛450,000")
function parsePaymentReceiptString(str, baseCurr = "USD") {
    if (!str || typeof str !== "string") return null;
    str = str.trim();
    if (!str || str === "-") return null;

    let res = {
        type: "",
        accountAmount: 0,
        accountCurrency: "USD",
        cashAmount: 0,
        cashCurrency: "USD",
        totalAmount: 0
    };

    const hasAcc = /Company Account|ABA|Acleda|Wing/i.test(str);
    const hasCash = /Cash/i.test(str);

    if (hasAcc && hasCash) {
        res.type = "Paid to Company Account & Cash";
        const mAcc = str.match(/Company Account:\s*([$៛]?)\s*([\d,]+(?:\.\d+)?)/i);
        if (mAcc) {
            res.accountCurrency = (mAcc[1] === "៛") ? "KHR" : (mAcc[1] === "$" ? "USD" : baseCurr);
            res.accountAmount = parseFloat(mAcc[2].replace(/,/g, "")) || 0;
        }
        const mCash = str.match(/Cash:\s*([$៛]?)\s*([\d,]+(?:\.\d+)?)/i);
        if (mCash) {
            res.cashCurrency = (mCash[1] === "៛") ? "KHR" : (mCash[1] === "$" ? "USD" : baseCurr);
            res.cashAmount = parseFloat(mCash[2].replace(/,/g, "")) || 0;
        }
        res.totalAmount = res.accountAmount + res.cashAmount;
        return res;
    }

    if (hasAcc) {
        res.type = "Paid to Company Account";
        const m = str.match(/(?:Company Account|Paid to Company Account|\()\s*([$៛]?)\s*([\d,]+(?:\.\d+)?)/i);
        if (m) {
            res.accountCurrency = (m[1] === "៛" || str.includes("៛")) ? "KHR" : (m[1] === "$" || str.includes("$") ? "USD" : baseCurr);
            res.accountAmount = parseFloat(m[2].replace(/,/g, "")) || 0;
            res.totalAmount = res.accountAmount;
        }
        return res;
    }

    if (hasCash) {
        res.type = "Cash";
        const m = str.match(/(?:Cash|\()\s*([$៛]?)\s*([\d,]+(?:\.\d+)?)/i);
        if (m) {
            res.cashCurrency = (m[1] === "៛" || str.includes("៛")) ? "KHR" : (m[1] === "$" || str.includes("$") ? "USD" : baseCurr);
            res.cashAmount = parseFloat(m[2].replace(/,/g, "")) || 0;
            res.totalAmount = res.cashAmount;
        }
        return res;
    }

    // Generic fallback for amounts in string
    const mGen = str.match(/([$៛]?)\s*([\d,]+(?:\.\d+)?)/);
    if (mGen) {
        const curr = (mGen[1] === "៛" || str.includes("៛")) ? "KHR" : "USD";
        const amt = parseFloat(mGen[2].replace(/,/g, "")) || 0;
        res.type = "Paid to Company Account";
        res.accountAmount = amt;
        res.accountCurrency = curr;
        res.totalAmount = amt;
        return res;
    }

    return null;
}
window.parsePaymentReceiptString = parsePaymentReceiptString;

// Normalize all date and status fields of an order object
function normalizeOrderDates(order) {
    if (!order) return order;
    let attempts = Number(order.deliveryAttempts) || 1;
    if (order.status) {
        const m = String(order.status).match(/^(\d+)(?:st|nd|rd|th)\s+(?:Success|Delivery)$/i);
        if (m) attempts = Math.max(attempts, parseInt(m[1], 10));
    }

    // Separate genuine specialNotes from 2nd/3rd delivery notes
    order = separateSpecialAndDeliveryNotes(order);

    const docType = (order.documentType && order.documentType.trim() && order.documentType !== "General")
        ? order.documentType.trim()
        : "SO to customer";

    // Total Package & Unit: strictly only available after End Checking has occurred
    const hasEndedChecking = !!(order.checkingEndTime && String(order.checkingEndTime).trim() !== "" && String(order.checkingEndTime).trim() !== "-");
    const isPostCheckingStatus = /Waiting Delivery|Delivery|Success|Return|Incomplete|In Complete|Completed/i.test(String(order.status || ""));
    const isChecked = hasEndedChecking || isPostCheckingStatus;

    let cleanTotalPackage = "";
    let cleanPackageUnit = "";
    if (isChecked && order.totalPackage !== undefined && order.totalPackage !== null && order.totalPackage !== "" && Number(order.totalPackage) > 0) {
        cleanTotalPackage = Number(order.totalPackage);
        cleanPackageUnit = String(order.packageUnit || "Carton").trim();
    }

    const rawPay = String(order.paymentReceipt || "").trim();
    const payParsed = (rawPay && rawPay !== "-" && (!order.paymentReceiptType || (!order.paymentAccountAmount && !order.paymentCashAmount)))
        ? parsePaymentReceiptString(rawPay, order.currency || "USD")
        : null;

    const payType = order.paymentReceiptType || (payParsed ? payParsed.type : "");
    const payAccAmt = (order.paymentAccountAmount !== undefined && order.paymentAccountAmount !== null && order.paymentAccountAmount !== "" && Number(order.paymentAccountAmount) > 0)
        ? Number(order.paymentAccountAmount)
        : (payParsed ? payParsed.accountAmount : 0);
    const payCashAmt = (order.paymentCashAmount !== undefined && order.paymentCashAmount !== null && order.paymentCashAmount !== "" && Number(order.paymentCashAmount) > 0)
        ? Number(order.paymentCashAmount)
        : (payParsed ? payParsed.cashAmount : 0);
    const payTotAmt = (order.paymentReceiptAmount !== undefined && order.paymentReceiptAmount !== null && order.paymentReceiptAmount !== "" && Number(order.paymentReceiptAmount) > 0)
        ? Number(order.paymentReceiptAmount)
        : (payAccAmt + payCashAmt || (payParsed ? payParsed.totalAmount : 0));

    const payAccCurr = order.paymentAccountCurrency || (payParsed ? payParsed.accountCurrency : (rawPay.includes("៛") ? "KHR" : (order.currency || "USD")));
    const payCashCurr = order.paymentCashCurrency || (payParsed ? payParsed.cashCurrency : (rawPay.includes("៛") ? "KHR" : (order.currency || "USD")));
    const payReceiptCurr = order.paymentReceiptCurrency || (rawPay.includes("៛") ? "KHR" : (order.currency || "USD"));

    return {
        ...order,
        deliveryAttempts: attempts,
        status: normalizeOrderStatus(order.status, attempts),
        documentType: docType,
        totalPackage: cleanTotalPackage,
        packageUnit: cleanPackageUnit,
        specialNotes: order.specialNotes || "",
        deliveryNotes: order.deliveryNotes || "",
        timestamp: formatDateTimeDisplay(order.timestamp),
        pickingStartTime: order.pickingStartTime ? formatDateTimeDisplay(order.pickingStartTime) : "",
        pickingEndTime: order.pickingEndTime ? formatDateTimeDisplay(order.pickingEndTime) : "",
        pickingDuration: (typeof formatDurationHhMm === "function") 
            ? formatDurationHhMm(order.pickingDuration, order.pickingStartTime, order.pickingEndTime)
            : (order.pickingDuration || "-"),
        checkingStartTime: order.checkingStartTime ? formatDateTimeDisplay(order.checkingStartTime) : "",
        checkingEndTime: order.checkingEndTime ? formatDateTimeDisplay(order.checkingEndTime) : "",
        checkingDuration: (typeof formatDurationHhMm === "function")
            ? formatDurationHhMm(order.checkingDuration, order.checkingStartTime, order.checkingEndTime)
            : (order.checkingDuration || "-"),
        deliveryStartTime: order.deliveryStartTime ? formatDateTimeDisplay(order.deliveryStartTime) : "",
        deliveryEndTime: order.deliveryEndTime ? formatDateTimeDisplay(order.deliveryEndTime) : "",
        deliveryDuration: (typeof formatDurationHhMm === "function")
            ? formatDurationHhMm(order.deliveryDuration, order.deliveryStartTime, order.deliveryEndTime)
            : (order.deliveryDuration || "-"),
        lastUpdated: order.lastUpdated ? formatDateTimeDisplay(order.lastUpdated) : "",
        createdBy: order.createdBy || "Admin",
        pickerBy: order.pickerBy || "",
        checkerBy: order.checkerBy || "",
        deliveryBy: order.deliveryBy || "",
        paymentReceipt: rawPay,
        paymentReceiptType: payType,
        paymentReceiptAmount: payTotAmt,
        paymentAccountAmount: payAccAmt,
        paymentCashAmount: payCashAmt,
        paymentAccountCurrency: payAccCurr,
        paymentCashCurrency: payCashCurr,
        paymentReceiptCurrency: payReceiptCurr
    };
}

// ========================================================
// PAYMENT RECEIPT HELPERS: FORMAT & BADGE RENDERER
// ========================================================
function getPaymentReceiptCurrencies(order) {
    if (!order) return { accSym: "$", cashSym: "$", accCurr: "USD", cashCurr: "USD" };

    const rawStr = String(order.paymentReceipt || "");
    const baseCurr = (order.currency === "KHR") ? "KHR" : "USD";

    // 1. Account currency & symbol
    let accCurr = order.paymentAccountCurrency;
    if (!accCurr) {
        if (/Company Account:[^|]*៛/i.test(rawStr) || /Paid to Company Account.*៛/i.test(rawStr)) {
            accCurr = "KHR";
        } else if (/Company Account:[^|]*\$/i.test(rawStr) || /Paid to Company Account.*\$/i.test(rawStr)) {
            accCurr = "USD";
        } else {
            accCurr = baseCurr;
        }
    }
    const accSym = (accCurr === "KHR") ? "៛" : "$";

    // 2. Cash currency & symbol
    let cashCurr = order.paymentCashCurrency;
    if (!cashCurr) {
        if (/Cash:[^|]*៛/i.test(rawStr) || /Cash.*៛/i.test(rawStr)) {
            cashCurr = "KHR";
        } else if (/Cash:[^|]*\$/i.test(rawStr) || /Cash.*\$/i.test(rawStr)) {
            cashCurr = "USD";
        } else {
            cashCurr = baseCurr;
        }
    }
    const cashSym = (cashCurr === "KHR") ? "៛" : "$";

    return { accSym, cashSym, accCurr, cashCurr };
}
window.getPaymentReceiptCurrencies = getPaymentReceiptCurrencies;

function formatPaymentReceiptDisplay(order) {
    if (!order) return "-";
    const type = order.paymentReceiptType || "";
    const accAmt = Number(order.paymentAccountAmount || 0);
    const cashAmt = Number(order.paymentCashAmount || 0);
    const totalAmt = Number(order.paymentReceiptAmount || 0);
    const { accSym, cashSym } = getPaymentReceiptCurrencies(order);

    if (type === "Paid to Company Account & Cash" || (accAmt > 0 && cashAmt > 0)) {
        return `Company Account: ${accSym}${accAmt.toLocaleString()} | Cash: ${cashSym}${cashAmt.toLocaleString()}`;
    }
    if (type === "Paid to Company Account" || (accAmt > 0 && cashAmt === 0)) {
        const amt = accAmt > 0 ? accAmt : totalAmt;
        return amt > 0 ? `Paid to Company Account (${accSym}${amt.toLocaleString()})` : "Paid to Company Account";
    }
    if (type === "Cash" || (cashAmt > 0 && accAmt === 0)) {
        const amt = cashAmt > 0 ? cashAmt : totalAmt;
        return amt > 0 ? `Cash (${cashSym}${amt.toLocaleString()})` : "Cash";
    }
    if (order.paymentReceipt && String(order.paymentReceipt).trim() && String(order.paymentReceipt).trim() !== "-") {
        return String(order.paymentReceipt).trim();
    }
    return "-";
}
window.formatPaymentReceiptDisplay = formatPaymentReceiptDisplay;

function renderPaymentReceiptBadge(order) {
    if (!order) return '<span class="text-slate-300 font-semibold">-</span>';
    const type = order.paymentReceiptType || "";
    const accAmt = Number(order.paymentAccountAmount || 0);
    const cashAmt = Number(order.paymentCashAmount || 0);
    const totalAmt = Number(order.paymentReceiptAmount || 0);
    const { accSym, cashSym } = getPaymentReceiptCurrencies(order);

    // 1. Both Company Account & Cash
    if (type === "Paid to Company Account & Cash" || (accAmt > 0 && cashAmt > 0)) {
        return `
            <div class="flex flex-col gap-1 items-start">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 font-bold text-[11px] whitespace-nowrap shadow-2xs">
                    <i data-lucide="building-2" class="w-3 h-3 text-blue-600 shrink-0"></i>
                    <span>Account: ${accSym}${accAmt.toLocaleString()}</span>
                </span>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold text-[11px] whitespace-nowrap shadow-2xs">
                    <i data-lucide="banknote" class="w-3 h-3 text-emerald-600 shrink-0"></i>
                    <span>Cash: ${cashSym}${cashAmt.toLocaleString()}</span>
                </span>
            </div>
        `;
    }

    // 2. Company Account only
    if (type === "Paid to Company Account" || (accAmt > 0 && cashAmt === 0)) {
        const amt = accAmt > 0 ? accAmt : totalAmt;
        const amtText = amt > 0 ? `: ${accSym}${amt.toLocaleString()}` : "";
        return `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80 font-bold text-xs whitespace-nowrap shadow-2xs" title="Paid to Company Account">
                <i data-lucide="building-2" class="w-3.5 h-3.5 text-blue-600 shrink-0"></i>
                <span>Company Account${amtText}</span>
            </span>
        `;
    }

    // 3. Cash only
    if (type === "Cash" || (cashAmt > 0 && accAmt === 0)) {
        const amt = cashAmt > 0 ? cashAmt : totalAmt;
        const amtText = amt > 0 ? `: ${cashSym}${amt.toLocaleString()}` : "";
        return `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold text-xs whitespace-nowrap shadow-2xs" title="Cash">
                <i data-lucide="banknote" class="w-3.5 h-3.5 text-emerald-600 shrink-0"></i>
                <span>Cash${amtText}</span>
            </span>
        `;
    }

    // 4. Fallback from string format
    const raw = String(order.paymentReceipt || "").trim();
    if (raw && raw !== "-") {
        const isCash = /cash/i.test(raw);
        const isAcc = /account|aba|acleda|wing/i.test(raw);
        if (isAcc) {
            return `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80 font-bold text-xs whitespace-nowrap shadow-2xs">
                    <i data-lucide="building-2" class="w-3.5 h-3.5 text-blue-600 shrink-0"></i>
                    <span>${escapeHtml(raw)}</span>
                </span>
            `;
        } else if (isCash) {
            return `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold text-xs whitespace-nowrap shadow-2xs">
                    <i data-lucide="banknote" class="w-3.5 h-3.5 text-emerald-600 shrink-0"></i>
                    <span>${escapeHtml(raw)}</span>
                </span>
            `;
        }
        return `<span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-xs whitespace-nowrap">${escapeHtml(raw)}</span>`;
    }

    return '<span class="text-slate-300 font-semibold">-</span>';
}
window.renderPaymentReceiptBadge = renderPaymentReceiptBadge;

function onPaymentCurrencyChange(type) {
    if (type === "account") {
        const curr = document.getElementById("currencyPaymentAccount")?.value || "USD";
        const amtInput = document.getElementById("amountPaymentAccount");
        if (amtInput) {
            amtInput.placeholder = (curr === "KHR") ? "0" : "0.00";
            amtInput.step = (curr === "KHR") ? "100" : "any";
        }
    } else if (type === "cash") {
        const curr = document.getElementById("currencyPaymentCash")?.value || "USD";
        const amtInput = document.getElementById("amountPaymentCash");
        if (amtInput) {
            amtInput.placeholder = (curr === "KHR") ? "0" : "0.00";
            amtInput.step = (curr === "KHR") ? "100" : "any";
        }
    }
}
window.onPaymentCurrencyChange = onPaymentCurrencyChange;

function togglePaymentOption(type) {
    const chkAccount = document.getElementById("chkPaymentAccount");
    const chkCash = document.getElementById("chkPaymentCash");
    const grpAccount = document.getElementById("inputGroupPaymentAccount");
    const grpCash = document.getElementById("inputGroupPaymentCash");
    const cardAccount = document.getElementById("cardPaymentAccount");
    const cardCash = document.getElementById("cardPaymentCash");
    const amtAccount = document.getElementById("amountPaymentAccount");
    const amtCash = document.getElementById("amountPaymentCash");

    const soNumber = document.getElementById("endDeliverySONumber")?.value;
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    const invoiceAmt = order ? (Number(order.invoiceAmount) || 0) : 0;
    const invoiceCurr = (order && order.currency === "KHR") ? "KHR" : "USD";

    if (type === "account") {
        if (chkAccount && chkAccount.checked) {
            if (grpAccount) grpAccount.classList.remove("hidden");
            if (cardAccount) cardAccount.className = "p-3 rounded-xl border-2 border-blue-500 bg-blue-50/30 transition-all";
            const selCurr = document.getElementById("currencyPaymentAccount")?.value || invoiceCurr;
            if (amtAccount && (!amtAccount.value || amtAccount.value === "0")) {
                let fillVal = invoiceAmt;
                if (invoiceCurr === "USD" && selCurr === "KHR") {
                    fillVal = Math.round(invoiceAmt * 4100);
                } else if (invoiceCurr === "KHR" && selCurr === "USD") {
                    fillVal = parseFloat((invoiceAmt / 4100).toFixed(2));
                }
                if (fillVal > 0) amtAccount.value = fillVal;
            }
            if (amtAccount) amtAccount.focus();
        } else {
            if (grpAccount) grpAccount.classList.add("hidden");
            if (cardAccount) cardAccount.className = "p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all";
            if (amtAccount) amtAccount.value = "";
        }
    } else if (type === "cash") {
        if (chkCash && chkCash.checked) {
            if (grpCash) grpCash.classList.remove("hidden");
            if (cardCash) cardCash.className = "p-3 rounded-xl border-2 border-emerald-500 bg-emerald-50/30 transition-all";
            const selCurr = document.getElementById("currencyPaymentCash")?.value || invoiceCurr;
            if (amtCash && (!amtCash.value || amtCash.value === "0")) {
                let fillVal = invoiceAmt;
                if (invoiceCurr === "USD" && selCurr === "KHR") {
                    fillVal = Math.round(invoiceAmt * 4100);
                } else if (invoiceCurr === "KHR" && selCurr === "USD") {
                    fillVal = parseFloat((invoiceAmt / 4100).toFixed(2));
                }
                if (fillVal > 0) amtCash.value = fillVal;
            }
            if (amtCash) amtCash.focus();
        } else {
            if (grpCash) grpCash.classList.add("hidden");
            if (cardCash) cardCash.className = "p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition-all";
            if (amtCash) amtCash.value = "";
        }
    }
}
window.togglePaymentOption = togglePaymentOption;

function quickFillPaymentAmount(type) {
    const soNumber = document.getElementById("endDeliverySONumber")?.value;
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    const invoiceAmt = order ? (Number(order.invoiceAmount) || 0) : 0;
    const invoiceCurr = (order && order.currency === "KHR") ? "KHR" : "USD";

    if (type === "account") {
        const chk = document.getElementById("chkPaymentAccount");
        if (chk && !chk.checked) {
            chk.checked = true;
            togglePaymentOption("account");
        }
        const selCurr = document.getElementById("currencyPaymentAccount")?.value || invoiceCurr;
        const amtEl = document.getElementById("amountPaymentAccount");
        if (amtEl) {
            let fillVal = invoiceAmt;
            if (invoiceCurr === "USD" && selCurr === "KHR") {
                fillVal = Math.round(invoiceAmt * 4100);
            } else if (invoiceCurr === "KHR" && selCurr === "USD") {
                fillVal = parseFloat((invoiceAmt / 4100).toFixed(2));
            }
            amtEl.value = fillVal > 0 ? fillVal : "";
        }
    } else if (type === "cash") {
        const chk = document.getElementById("chkPaymentCash");
        if (chk && !chk.checked) {
            chk.checked = true;
            togglePaymentOption("cash");
        }
        const selCurr = document.getElementById("currencyPaymentCash")?.value || invoiceCurr;
        const amtEl = document.getElementById("amountPaymentCash");
        if (amtEl) {
            let fillVal = invoiceAmt;
            if (invoiceCurr === "USD" && selCurr === "KHR") {
                fillVal = Math.round(invoiceAmt * 4100);
            } else if (invoiceCurr === "KHR" && selCurr === "USD") {
                fillVal = parseFloat((invoiceAmt / 4100).toFixed(2));
            }
            amtEl.value = fillVal > 0 ? fillVal : "";
        }
    }
}
window.quickFillPaymentAmount = quickFillPaymentAmount;

// ========================================================
// LOCATION HELPERS: STRICT ENGLISH MAPPING FOR CITY & KHAN
// ========================================================
function getCleanEnglishLocation(val) {
    if (!val) return "";
    val = String(val).trim();
    // 1. If contains parentheses like "រាជធានីភ្នំពេញ (Phnom Penh)" or "ខណ្ឌចំការមន (Chamkarmon)"
    const match = val.match(/\(([^)]+)\)/);
    if (match && match[1]) {
        return match[1].trim();
    }
    // 2. If matching a CAMBODIA_PROVINCES entry by Khmer or English
    if (typeof CAMBODIA_PROVINCES !== "undefined" && Array.isArray(CAMBODIA_PROVINCES)) {
        const prov = CAMBODIA_PROVINCES.find(p => 
            p.id.toLowerCase() === val.toLowerCase() || 
            p.nameEn.toLowerCase() === val.toLowerCase() || 
            p.nameKh.toLowerCase() === val.toLowerCase()
        );
        if (prov) {
            return prov.nameEn;
        }
    }
    return val;
}

function getEnglishKhansForProvince(provinceIdOrName) {
    if (!provinceIdOrName) return [];
    const provClean = getCleanEnglishLocation(provinceIdOrName);
    
    if (typeof KHAN_DISTRICTS_MAP !== "undefined" && KHAN_DISTRICTS_MAP) {
        // Direct match by English key in KHAN_DISTRICTS_MAP
        if (KHAN_DISTRICTS_MAP[provClean]) {
            return KHAN_DISTRICTS_MAP[provClean].map(k => getCleanEnglishLocation(k));
        }

        // Try finding by province id or nameEn in CAMBODIA_PROVINCES
        if (typeof CAMBODIA_PROVINCES !== "undefined") {
            const provObj = CAMBODIA_PROVINCES.find(p => 
                p.id.toLowerCase() === provClean.toLowerCase() ||
                p.nameEn.toLowerCase() === provClean.toLowerCase() ||
                p.nameKh.toLowerCase() === provClean.toLowerCase()
            );
            if (provObj && KHAN_DISTRICTS_MAP[provObj.nameEn]) {
                return KHAN_DISTRICTS_MAP[provObj.nameEn].map(k => getCleanEnglishLocation(k));
            }
        }

        // Fallback: check if any key matches partially
        for (const [key, districts] of Object.entries(KHAN_DISTRICTS_MAP)) {
            if (key.toLowerCase() === provClean.toLowerCase() || provClean.toLowerCase().includes(key.toLowerCase())) {
                return districts.map(k => getCleanEnglishLocation(k));
            }
        }
    }

    return [
        "Central District",
        "Suburban Area",
        "Other District"
    ];
}

// Initial Demo Seed Data if empty
const DEMO_ORDERS = [
    {
        timestamp: "04/10/26 08:30",
        soNumber: "SO-2026-0089",
        customerName: "Calmette Hospital (មន្ទីរពេទ្យកាល់ម៉ែត)",
        cityProvince: "Phnom Penh",
        khan: "Daun Penh",
        packingListNumber: "PL-9921",
        invoiceNumber: "INV-2026-041",
        invoiceAmount: 4850,
        currency: "USD",
        totalPackage: "",
        packageUnit: "",
        bu: "Healthcare & Pharma (សុខាភិបាល)",
        documentType: "Tax Invoice (វិក្កយបត្រពន្ធ)",
        specialNotes: "ទំនិញឱសថត្រជាក់ សីតុណ្ហភាព 2-8°C សូមប្រយ័ត្ន",
        status: "In Checking",
        pickingStartTime: "04/10/26 09:15",
        pickingEndTime: "04/10/26 09:42",
        pickingDuration: "00:27",
        checkingStartTime: "04/10/26 10:00",
        checkingEndTime: "",
        checkingDuration: "-",
        deliveryStartTime: "",
        deliveryEndTime: "",
        deliveryDuration: "-",
        lastUpdated: "04/10/26 10:00",
        createdBy: "Administrator",
        pickerBy: "Bona Picker",
        checkerBy: "Chanthy Checker",
        deliveryBy: ""
    },
    {
        timestamp: "04/10/26 09:10",
        soNumber: "SO-2026-0090",
        customerName: "DKSH Cambodia Ltd",
        cityProvince: "Phnom Penh",
        khan: "Pou Senchey",
        packingListNumber: "PL-9922",
        invoiceNumber: "INV-2026-042",
        invoiceAmount: 12500,
        currency: "USD",
        totalPackage: "",
        packageUnit: "",
        bu: "Consumer Goods / FMCG (ទំនិញប្រើប្រាស់)",
        documentType: "Commercial Invoice (វិក្កយបត្រពាណិជ្ជកម្ម)",
        specialNotes: "ទាមទារឡានដឹកធំ មានជណ្ដើរលើក Forklift",
        status: "In Picking",
        pickingStartTime: "04/10/26 10:15",
        pickingEndTime: "",
        pickingDuration: "-",
        checkingStartTime: "",
        checkingEndTime: "",
        checkingDuration: "-",
        deliveryStartTime: "",
        deliveryEndTime: "",
        deliveryDuration: "-",
        lastUpdated: "04/10/26 10:15",
        createdBy: "Administrator",
        pickerBy: "Bona Picker",
        checkerBy: "",
        deliveryBy: ""
    },
    {
        timestamp: "04/10/26 07:45",
        soNumber: "SO-2026-0088",
        customerName: "Chip Mong Retail / Supermarket",
        cityProvince: "Phnom Penh",
        khan: "Sen Sok",
        packingListNumber: "PL-9918",
        invoiceNumber: "INV-2026-039",
        invoiceAmount: 3200,
        currency: "USD",
        totalPackage: 25,
        packageUnit: "Carton",
        bu: "Consumer Goods / FMCG (ទំនិញប្រើប្រាស់)",
        documentType: "Tax Invoice (វិក្កយបត្រពន្ធ)",
        specialNotes: "ប្រគល់នៅឃ្លាំងទទួលទំនិញខាងក្រោយផ្សារ",
        status: "Success",
        pickingStartTime: "04/10/26 08:00",
        pickingEndTime: "04/10/26 08:35",
        pickingDuration: "00:35",
        checkingStartTime: "04/10/26 08:40",
        checkingEndTime: "04/10/26 08:58",
        checkingDuration: "00:18",
        deliveryStartTime: "04/10/26 09:10",
        deliveryEndTime: "04/10/26 09:55",
        deliveryDuration: "00:45",
        lastUpdated: "04/10/26 09:55",
        createdBy: "Administrator",
        pickerBy: "Bona Picker",
        checkerBy: "Chanthy Checker",
        deliveryBy: "Dara Driver",
        paymentReceiptType: "Paid to Company Account",
        paymentAccountAmount: 3200,
        paymentCashAmount: 0,
        paymentReceiptAmount: 3200,
        paymentReceipt: "Paid to Company Account ($3,200.00)"
    },
    {
        timestamp: "04/10/26 10:30",
        soNumber: "SO-2026-0091",
        customerName: "Pharmaproduct Manufacturing (PPM)",
        cityProvince: "Phnom Penh",
        khan: "Dangkao",
        packingListNumber: "PL-9925",
        invoiceNumber: "INV-2026-045",
        invoiceAmount: 5600,
        currency: "USD",
        totalPackage: "",
        packageUnit: "",
        bu: "Healthcare & Pharma (សុខាភិបាល)",
        documentType: "Tax Invoice (វិក្កយបត្រពន្ធ)",
        specialNotes: "ទំនិញថ្មីចុះឈ្មោះ រង់ចាំក្រុមការងារចាប់ផ្ដើម Picking",
        status: "Registered",
        pickingStartTime: "",
        pickingEndTime: "",
        pickingDuration: "-",
        checkingStartTime: "",
        checkingEndTime: "",
        checkingDuration: "-",
        deliveryStartTime: "",
        deliveryEndTime: "",
        deliveryDuration: "-",
        lastUpdated: "04/10/26 10:30",
        createdBy: "Administrator",
        pickerBy: "",
        checkerBy: "",
        deliveryBy: ""
    }
];

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    initAppState();
    initHighlightSystem();
    setupDropdownOptions();
    setupEventListeners();
    initSidebarState();
    setupSheetsStatusCallback();
    applyColumnVisibility();
    renderCurrentUserProfile();
    updateOnlineUsersPresence();
    showOnlyView(AppState.currentTab || "daily-delivery");
    updateNavbarActiveBtn(AppState.currentTab || "daily-delivery");
    updateKpiCardsVisibility();
    renderAll(true);
    startLiveTimers();

    // Auto sync from Google Sheet on start if configured
    if (SheetsSync.isConfigured()) {
        syncFromGoogleSheet();
    }
});

// Load Orders & Setup Data from localStorage or default
function initAppState() {
    // 1. Orders
    const saved = localStorage.getItem(STORAGE_ORDERS_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            AppState.orders = Array.isArray(parsed) 
                ? parsed.map(o => {
                    const norm = normalizeOrderDates(o);
                    norm.cityProvince = getCleanEnglishLocation(norm.cityProvince);
                    norm.khan = getCleanEnglishLocation(norm.khan);
                    return norm;
                }) 
                : DEMO_ORDERS.map(normalizeOrderDates);
            // Ensure at least one registered order is present for testing
            if (!AppState.orders.some(isOrderRegistered)) {
                const sampleReg = DEMO_ORDERS.find(o => o.status === "Registered");
                if (sampleReg) AppState.orders.unshift(normalizeOrderDates(sampleReg));
            }
            saveOrdersToStorage();
        } catch (e) {
            AppState.orders = DEMO_ORDERS.map(normalizeOrderDates);
        }
    } else {
        AppState.orders = DEMO_ORDERS.map(normalizeOrderDates);
        saveOrdersToStorage();
    }

    // Apply Daily Completed state to orders
    const dailySos = getDailyCompletedOrderSos();
    AppState.orders.forEach(o => {
        if (dailySos.has(o.soNumber)) o.completedFromDailyDelivery = true;
    });

    // 2. Setup Master Data
    initSetupState();
}

// Initialize Setup Master Data
function initSetupState() {
    // Customers
    const savedCust = localStorage.getItem(STORAGE_SETUP_CUSTOMERS);
    let rawCust = savedCust ? JSON.parse(savedCust) : DEFAULT_SETUP_CUSTOMERS;
    if (Array.isArray(rawCust)) {
        AppState.setup.customers = rawCust.map(c => ({
            ...c,
            cityProvince: getCleanEnglishLocation(c.cityProvince),
            khan: getCleanEnglishLocation(c.khan)
        }));
    } else {
        AppState.setup.customers = DEFAULT_SETUP_CUSTOMERS;
    }

    // BUs
    const savedBU = localStorage.getItem(STORAGE_SETUP_BU);
    AppState.setup.bus = savedBU ? JSON.parse(savedBU) : DEFAULT_SETUP_BU;

    // Package Types
    const savedPkg = localStorage.getItem(STORAGE_SETUP_PKG);
    AppState.setup.packageTypes = savedPkg ? JSON.parse(savedPkg) : DEFAULT_SETUP_PACKAGE_TYPES;

    // Document Types
    const savedDoc = localStorage.getItem(STORAGE_SETUP_DOC);
    let docTypes = savedDoc ? JSON.parse(savedDoc) : DEFAULT_SETUP_DOC_TYPES;
    if (Array.isArray(docTypes) && !docTypes.some(d => d.name === "SO to customer")) {
        const toAdd = DEFAULT_SETUP_DOC_TYPES.filter(def => !docTypes.some(d => d.name === def.name));
        docTypes = toAdd.concat(docTypes);
    }
    AppState.setup.documentTypes = docTypes;

    // Users (User Management)
    const savedUsers = localStorage.getItem(STORAGE_SETUP_USERS);
    if (savedUsers) {
        try {
            const parsed = JSON.parse(savedUsers);
            if (Array.isArray(parsed) && parsed.some(u => u.username === "user_a") && !parsed.some(u => u.username === "whm")) {
                AppState.setup.users = DEFAULT_SETUP_USERS;
            } else {
                AppState.setup.users = parsed;
            }
        } catch (e) {
            AppState.setup.users = DEFAULT_SETUP_USERS;
        }
    } else {
        AppState.setup.users = DEFAULT_SETUP_USERS;
    }

    // Attach any cached photo avatars to setup users
    if (Array.isArray(AppState.setup.users)) {
        AppState.setup.users.forEach(u => {
            if (!u.photoUrl && u.username) {
                const cached = localStorage.getItem("order_app_avatar_" + u.username.toLowerCase());
                if (cached) u.photoUrl = cached;
            }
        });
    }

    // Active User Session
    const savedActiveUser = localStorage.getItem(STORAGE_ACTIVE_USER);
    if (savedActiveUser) {
        try {
            const parsed = JSON.parse(savedActiveUser);
            const found = AppState.setup.users.find(u => u.id === parsed.id || u.username === parsed.username);
            AppState.currentUser = found || AppState.setup.users[0];
        } catch (e) {
            AppState.currentUser = AppState.setup.users[0];
        }
    } else {
        AppState.currentUser = AppState.setup.users[0] || null;
    }

    if (AppState.currentUser && !AppState.currentUser.photoUrl && AppState.currentUser.username) {
        const cached = localStorage.getItem("order_app_avatar_" + AppState.currentUser.username.toLowerCase());
        if (cached) AppState.currentUser.photoUrl = cached;
    }

    saveSetupState();
}

// Persist Setup Data
function saveSetupState(category = null) {
    if (!category || category === "customers") {
        localStorage.setItem(STORAGE_SETUP_CUSTOMERS, JSON.stringify(AppState.setup.customers));
    }
    if (!category || category === "bus") {
        localStorage.setItem(STORAGE_SETUP_BU, JSON.stringify(AppState.setup.bus));
    }
    if (!category || category === "packageTypes") {
        localStorage.setItem(STORAGE_SETUP_PKG, JSON.stringify(AppState.setup.packageTypes));
    }
    if (!category || category === "documentTypes") {
        localStorage.setItem(STORAGE_SETUP_DOC, JSON.stringify(AppState.setup.documentTypes));
    }
    if (!category || category === "users") {
        localStorage.setItem(STORAGE_SETUP_USERS, JSON.stringify(AppState.setup.users));
    }
}

// Persist Orders Locally & Broadcast across open tabs
function saveOrdersToStorage(broadcast = true) {
    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(AppState.orders));
    if (broadcast && window.SheetsSync && typeof SheetsSync.broadcast === "function") {
        SheetsSync.broadcast("ORDERS_LOCAL_UPDATE", { timestamp: Date.now() });
    }
}

// Populate BU, Document Type, Package Unit dropdowns and Customer Modal from Setup
function setupDropdownOptions() {
    // Provinces in Customer Modal
    const modalProvSelect = document.getElementById("customerModalProvince");
    if (modalProvSelect) {
        modalProvSelect.innerHTML = `<option value="">-- ជ្រើសរើស City/Province --</option>` +
            CAMBODIA_PROVINCES.map(p => `<option value="${p.nameEn}">${p.nameEn}</option>`).join("");
        if (!modalProvSelect.value) modalProvSelect.value = "Phnom Penh";
        updateCustomerModalKhan("Phnom Penh");
    }

    // Business Units Dropdown in Register Order (Populated from Setup BU)
    const buSelect = document.getElementById("fieldBU");
    if (buSelect) {
        const curVal = buSelect.value;
        buSelect.innerHTML = `<option value="">-- ជ្រើសរើស Business Unit --</option>` +
            AppState.setup.bus.map(b => `<option value="${b.name}">${b.name}</option>`).join("");
        if (curVal && AppState.setup.bus.some(b => b.name === curVal)) {
            buSelect.value = curVal;
        }
    }

    // Filter BU in Dashboard header (Populated from Setup BU)
    const filterBUSelect = document.getElementById("filterBU");
    if (filterBUSelect) {
        const curVal = filterBUSelect.value;
        filterBUSelect.innerHTML = `<option value="ALL">គ្រប់ BU ទាំងអស់</option>` +
            AppState.setup.bus.map(b => `<option value="${b.name}">${b.name}</option>`).join("");
        if (curVal) filterBUSelect.value = curVal;
    }

    // Document Types Dropdown in Register Order (Populated from Setup Document Type)
    const docSelect = document.getElementById("fieldDocType");
    if (docSelect) {
        const curVal = docSelect.value;
        docSelect.innerHTML = `<option value="">-- ជ្រើសរើស ប្រភេទឯកសារ --</option>` +
            AppState.setup.documentTypes.map(d => `<option value="${d.name}">${d.name}</option>`).join("");
        if (curVal && AppState.setup.documentTypes.some(d => d.name === curVal)) {
            docSelect.value = curVal;
        } else if (!curVal && AppState.setup.documentTypes.some(d => d.name === "SO to customer")) {
            docSelect.value = "SO to customer";
        }
    }

    // Package Units Dropdown in Register Order (Populated from Setup Package Type)
    const unitSelect = document.getElementById("fieldPackageUnit");
    if (unitSelect) {
        const curVal = unitSelect.value;
        unitSelect.innerHTML = AppState.setup.packageTypes.map(u => {
            const shortStr = u.short ? ` (${u.short})` : '';
            return `<option value="${u.name}">${u.name}${shortStr}</option>`;
        }).join("");
        if (curVal && AppState.setup.packageTypes.some(u => u.name === curVal)) {
            unitSelect.value = curVal;
        }
    }
}

// Update Khan dropdown in Customer Setup Modal based on selected province
function updateCustomerModalKhan(province) {
    const khanSelect = document.getElementById("customerModalKhan");
    if (!khanSelect) return;

    const list = getEnglishKhansForProvince(province);

    khanSelect.innerHTML = `<option value="">-- ជ្រើសរើស Khan/District --</option>` +
        list.map(k => `<option value="${k}">${k}</option>`).join("");
    
    if (list.length > 0) {
        khanSelect.selectedIndex = 1; // Default first district (e.g. Chamkarmon for Phnom Penh)
    }
}

// Helper to escape HTML characters
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function navigateToCustomerSetup(name = "") {
    switchTab("setup");
    switchSetupSubTab("customer");
    openAddCustomerModal();
    if (name) {
        const nameInput = document.getElementById("customerModalName");
        if (nameInput) nameInput.value = name;
    }
}
window.navigateToCustomerSetup = navigateToCustomerSetup;

// ========================================================
// SEARCH FIELDS CONTROLLERS: CUSTOMER NAME, CITY/PROVINCE, AND KHAN
// ========================================================

function initRegisterSearchFields() {
    initCustomerSearchField();
    initProvinceSearchField();
    initKhanSearchField();

    // Close any suggestion popups when clicking outside
    document.addEventListener("click", (e) => {
        if (!e.target.closest("#customerSearchContainer")) {
            const list = document.getElementById("customerSuggestionsList");
            if (list) list.classList.add("hidden");
        }
        if (!e.target.closest("#provinceSearchContainer")) {
            const list = document.getElementById("provinceSuggestionsList");
            if (list) list.classList.add("hidden");
        }
        if (!e.target.closest("#khanSearchContainer")) {
            const list = document.getElementById("khanSuggestionsList");
            if (list) list.classList.add("hidden");
        }
    });
}

// 1. Customer Name Search Field
function initCustomerSearchField() {
    const input = document.getElementById("fieldCustomerName");
    const list = document.getElementById("customerSuggestionsList");
    const clearBtn = document.getElementById("btnClearCustomer");
    if (!input || !list) return;

    let selectedIndex = -1;

    function updateHighlight(items) {
        items.forEach((item, idx) => {
            if (idx === selectedIndex) {
                item.classList.add("is-active", "bg-blue-100/90");
                item.setAttribute("aria-selected", "true");
                item.scrollIntoView({ block: "nearest", inline: "nearest" });
            } else {
                item.classList.remove("is-active", "bg-blue-100/90");
                item.removeAttribute("aria-selected");
            }
        });
    }

    function selectCustomerItem(item) {
        if (!item) return;
        const name = item.getAttribute("data-name");
        const province = getCleanEnglishLocation(item.getAttribute("data-province"));
        const khan = getCleanEnglishLocation(item.getAttribute("data-khan"));

        input.value = name;
        
        // Auto-fill City/Province (pure English)
        const provInput = document.getElementById("fieldCityProvince");
        if (provInput && province) {
            provInput.value = province;
            const clearProvBtn = document.getElementById("btnClearProvince");
            if (clearProvBtn) clearProvBtn.classList.remove("hidden");
        }

        // Auto-fill Khan (pure English)
        const khanInput = document.getElementById("fieldKhan");
        if (khanInput && khan) {
            khanInput.value = khan;
            const clearKhanBtn = document.getElementById("btnClearKhan");
            if (clearKhanBtn) clearKhanBtn.classList.remove("hidden");
        }

        list.classList.add("hidden");
        selectedIndex = -1;
        if (clearBtn) clearBtn.classList.remove("hidden");
    }

    function renderSuggestions(q = "") {
        const query = q.toLowerCase().trim();
        
        // Wait until user searches: do not show dropdown if query is empty
        if (!query) {
            list.classList.add("hidden");
            list.innerHTML = "";
            selectedIndex = -1;
            return;
        }

        const customers = AppState.setup.customers || [];
        const filtered = customers.filter(c => 
            (c.name && c.name.toLowerCase().includes(query)) ||
            (c.khan && c.khan.toLowerCase().includes(query)) ||
            (c.cityProvince && c.cityProvince.toLowerCase().includes(query))
        );

        selectedIndex = -1;

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="p-4 text-xs text-slate-500 text-center">
                    <p class="font-medium text-slate-700">មិនមានអតិថិជន "${escapeHtml(q)}" ក្នុងបញ្ជីឡើយ</p>
                    <p class="text-[11px] text-slate-400 mt-1">អ្នកអាចវាយឈ្មោះនេះជាអតិថិជនថ្មី ឬចុចខាងក្រោមដើម្បី Add ចូល Setup</p>
                    <button type="button" onclick="navigateToCustomerSetup('${escapeHtml(q)}')" class="mt-2.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-xs inline-flex items-center gap-1 transition">
                        <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
                        <span>+ បន្ថែមអតិថិជនថ្មីក្នុង Setup</span>
                    </button>
                </div>
            `;
            list.classList.remove("hidden");
            lucide.createIcons();
            return;
        }

        const itemsHtml = filtered.map((c, idx) => {
            const cleanKhan = getCleanEnglishLocation(c.khan);
            const cleanProv = getCleanEnglishLocation(c.cityProvince);
            return `
            <div class="customer-item px-3.5 py-2.5 hover:bg-blue-50/80 cursor-pointer transition flex items-center justify-between gap-3 text-left select-none"
                data-index="${idx}"
                data-id="${escapeHtml(c.id || '')}"
                data-name="${escapeHtml(c.name)}"
                data-province="${escapeHtml(cleanProv || '')}"
                data-khan="${escapeHtml(cleanKhan || '')}">
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-sm text-slate-900 truncate">${escapeHtml(c.name)}</div>
                    <div class="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span class="text-slate-400">📍</span>
                        <span class="font-medium text-blue-700">${escapeHtml(cleanKhan || '-')}</span>
                        <span class="text-slate-300">•</span>
                        <span>${escapeHtml(cleanProv || '-')}</span>
                    </div>
                </div>
                <div class="text-[11px] font-mono font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    ${escapeHtml(c.id || 'CUST')}
                </div>
            </div>
            `;
        }).join("");

        const footerHint = `
            <div class="px-3.5 py-1.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between select-none">
                <span class="flex items-center gap-1">
                    <kbd class="px-1 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600">↑</kbd>
                    <kbd class="px-1 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600">↓</kbd>
                    <span>រំកិល</span>
                </span>
                <span class="flex items-center gap-1">
                    <kbd class="px-1 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600">Enter</kbd>
                    <span>ជ្រើសរើស</span>
                </span>
                <span class="flex items-center gap-1">
                    <kbd class="px-1 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600">Esc</kbd>
                    <span>បិទ</span>
                </span>
            </div>
        `;

        list.innerHTML = itemsHtml + footerHint;

        const items = list.querySelectorAll(".customer-item");

        items.forEach((item, idx) => {
            item.addEventListener("click", () => {
                selectCustomerItem(item);
            });
            item.addEventListener("mouseenter", () => {
                selectedIndex = idx;
                updateHighlight(items);
            });
        });

        list.classList.remove("hidden");
        lucide.createIcons();
    }

    input.addEventListener("input", (e) => {
        const val = e.target.value;
        if (clearBtn) clearBtn.classList.toggle("hidden", !val);
        if (val && val.trim()) {
            renderSuggestions(val);
        } else {
            list.classList.add("hidden");
            list.innerHTML = "";
            selectedIndex = -1;
        }
    });

    input.addEventListener("focus", () => {
        // Do not auto-dropdown if empty; only show when user has searched/typed text
        if (input.value && input.value.trim()) {
            renderSuggestions(input.value);
        } else {
            list.classList.add("hidden");
        }
    });

    input.addEventListener("keydown", (e) => {
        const items = list.querySelectorAll(".customer-item");
        const isOpen = !list.classList.contains("hidden");

        if (e.key === "ArrowDown") {
            if (!isOpen) {
                if (input.value && input.value.trim()) {
                    renderSuggestions(input.value);
                }
                return;
            }
            if (items.length === 0) return;
            e.preventDefault();
            if (selectedIndex < items.length - 1) {
                selectedIndex++;
            } else {
                selectedIndex = 0; // Wrap around
            }
            updateHighlight(items);
        } else if (e.key === "ArrowUp") {
            if (!isOpen) return;
            if (items.length === 0) return;
            e.preventDefault();
            if (selectedIndex > 0) {
                selectedIndex--;
            } else {
                selectedIndex = items.length - 1; // Wrap around
            }
            updateHighlight(items);
        } else if (e.key === "Enter") {
            if (isOpen && items.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                if (selectedIndex >= 0 && selectedIndex < items.length) {
                    selectCustomerItem(items[selectedIndex]);
                } else if (items.length === 1) {
                    selectCustomerItem(items[0]);
                }
            }
        } else if (e.key === "Escape") {
            if (isOpen) {
                e.preventDefault();
                e.stopPropagation();
                list.classList.add("hidden");
                selectedIndex = -1;
            }
        } else if (e.key === "Tab") {
            if (isOpen && selectedIndex >= 0 && selectedIndex < items.length) {
                selectCustomerItem(items[selectedIndex]);
            }
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            input.value = "";
            clearBtn.classList.add("hidden");
            list.classList.add("hidden");
            list.innerHTML = "";
            selectedIndex = -1;
            input.focus();
        });
    }
}

// 2. City/Province Search Field
function initProvinceSearchField() {
    const input = document.getElementById("fieldCityProvince");
    const list = document.getElementById("provinceSuggestionsList");
    const clearBtn = document.getElementById("btnClearProvince");
    if (!input || !list) return;

    let selectedIndex = -1;

    function updateHighlight(items) {
        items.forEach((item, idx) => {
            if (idx === selectedIndex) {
                item.classList.add("is-active", "bg-blue-100/90");
                item.setAttribute("aria-selected", "true");
                item.scrollIntoView({ block: "nearest", inline: "nearest" });
            } else {
                item.classList.remove("is-active", "bg-blue-100/90");
                item.removeAttribute("aria-selected");
            }
        });
    }

    function selectProvinceItem(item) {
        if (!item) return;
        const display = item.getAttribute("data-display");
        input.value = getCleanEnglishLocation(display);
        list.classList.add("hidden");
        selectedIndex = -1;
        if (clearBtn) clearBtn.classList.remove("hidden");
    }

    function renderSuggestions(q = "") {
        const query = q.toLowerCase().trim();
        let filtered = CAMBODIA_PROVINCES;
        if (query) {
            filtered = CAMBODIA_PROVINCES.filter(p => 
                p.nameEn.toLowerCase().includes(query) ||
                p.nameKh.toLowerCase().includes(query) ||
                p.id.toLowerCase().includes(query)
            );
        }

        selectedIndex = -1;

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="p-3 text-xs text-slate-500 text-center">
                    មិនមាន City/Province "${escapeHtml(q)}" ក្នុងបញ្ជីឡើយ
                </div>
            `;
            list.classList.remove("hidden");
            return;
        }

        const itemsHtml = filtered.map((p, idx) => `
            <div class="province-item px-3.5 py-2.5 hover:bg-blue-50/80 cursor-pointer transition flex items-center justify-between text-left select-none"
                data-index="${idx}"
                data-id="${escapeHtml(p.id)}"
                data-display="${escapeHtml(p.nameEn)}">
                <div>
                    <span class="font-bold text-xs sm:text-sm text-slate-900">${escapeHtml(p.nameEn)}</span>
                </div>
                <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400"></i>
            </div>
        `).join("");

        const footerHint = `
            <div class="px-3.5 py-1.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between select-none">
                <span class="flex items-center gap-1">
                    <kbd class="px-1 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600">↑</kbd>
                    <kbd class="px-1 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600">↓</kbd>
                    <span>រំកិល</span>
                </span>
                <span class="flex items-center gap-1">
                    <kbd class="px-1 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600">Enter</kbd>
                    <span>ជ្រើសរើស</span>
                </span>
            </div>
        `;

        list.innerHTML = itemsHtml + footerHint;

        const items = list.querySelectorAll(".province-item");

        items.forEach((item, idx) => {
            item.addEventListener("click", () => {
                selectProvinceItem(item);
            });
            item.addEventListener("mouseenter", () => {
                selectedIndex = idx;
                updateHighlight(items);
            });
        });

        list.classList.remove("hidden");
        lucide.createIcons();
    }

    input.addEventListener("input", (e) => {
        const val = e.target.value;
        if (clearBtn) clearBtn.classList.toggle("hidden", !val);
        renderSuggestions(val);
    });

    input.addEventListener("focus", () => {
        renderSuggestions(input.value);
    });

    input.addEventListener("keydown", (e) => {
        const items = list.querySelectorAll(".province-item");
        const isOpen = !list.classList.contains("hidden");

        if (e.key === "ArrowDown") {
            if (!isOpen) {
                renderSuggestions(input.value);
                return;
            }
            if (items.length === 0) return;
            e.preventDefault();
            if (selectedIndex < items.length - 1) {
                selectedIndex++;
            } else {
                selectedIndex = 0;
            }
            updateHighlight(items);
        } else if (e.key === "ArrowUp") {
            if (!isOpen) return;
            if (items.length === 0) return;
            e.preventDefault();
            if (selectedIndex > 0) {
                selectedIndex--;
            } else {
                selectedIndex = items.length - 1;
            }
            updateHighlight(items);
        } else if (e.key === "Enter") {
            if (isOpen && items.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                if (selectedIndex >= 0 && selectedIndex < items.length) {
                    selectProvinceItem(items[selectedIndex]);
                } else if (items.length === 1) {
                    selectProvinceItem(items[0]);
                }
            }
        } else if (e.key === "Escape") {
            if (isOpen) {
                e.preventDefault();
                e.stopPropagation();
                list.classList.add("hidden");
                selectedIndex = -1;
            }
        } else if (e.key === "Tab") {
            if (isOpen && selectedIndex >= 0 && selectedIndex < items.length) {
                selectProvinceItem(items[selectedIndex]);
            }
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            input.value = "";
            clearBtn.classList.add("hidden");
            input.focus();
            renderSuggestions("");
        });
    }
}

// 3. Khan / District Search Field
function initKhanSearchField() {
    const input = document.getElementById("fieldKhan");
    const list = document.getElementById("khanSuggestionsList");
    const clearBtn = document.getElementById("btnClearKhan");
    const provInput = document.getElementById("fieldCityProvince");
    if (!input || !list) return;

    let selectedIndex = -1;

    function getAvailableKhans() {
        const provVal = (provInput ? provInput.value : "").toLowerCase().trim();
        let targetList = [];

        if (provVal) {
            targetList = getEnglishKhansForProvince(provVal);
        }

        // If still empty (e.g. no province chosen or all districts), combine all
        if (targetList.length === 0) {
            const set = new Set();
            Object.values(KHAN_DISTRICTS_MAP).forEach(arr => arr.forEach(k => set.add(getCleanEnglishLocation(k))));
            (AppState.setup.customers || []).forEach(c => {
                if (c.khan) set.add(getCleanEnglishLocation(c.khan));
            });
            targetList = Array.from(set);
        }

        return targetList;
    }

    function updateHighlight(items) {
        items.forEach((item, idx) => {
            if (idx === selectedIndex) {
                item.classList.add("is-active", "bg-blue-100/90");
                item.setAttribute("aria-selected", "true");
                item.scrollIntoView({ block: "nearest", inline: "nearest" });
            } else {
                item.classList.remove("is-active", "bg-blue-100/90");
                item.removeAttribute("aria-selected");
            }
        });
    }

    function selectKhanItem(item) {
        if (!item) return;
        const khan = item.getAttribute("data-khan");
        input.value = getCleanEnglishLocation(khan);
        list.classList.add("hidden");
        selectedIndex = -1;
        if (clearBtn) clearBtn.classList.remove("hidden");
    }

    function renderSuggestions(q = "") {
        const query = q.toLowerCase().trim();
        const available = getAvailableKhans();
        
        let filtered = available;
        if (query) {
            filtered = available.filter(k => k.toLowerCase().includes(query));
        }

        selectedIndex = -1;

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="p-3 text-xs text-slate-500 text-center">
                    <p>មិនមានក្នុងបញ្ជីគំរូ - អ្នកអាចប្រើ <b>"${escapeHtml(q)}"</b> ជា Khan/District ផ្ទាល់បាន</p>
                </div>
            `;
            list.classList.remove("hidden");
            return;
        }

        const itemsHtml = filtered.map((k, idx) => {
            const cleanK = getCleanEnglishLocation(k);
            return `
            <div class="khan-item px-3.5 py-2.5 hover:bg-blue-50/80 cursor-pointer transition flex items-center justify-between text-left select-none"
                data-index="${idx}"
                data-khan="${escapeHtml(cleanK)}">
                <span class="font-medium text-xs sm:text-sm text-slate-800">${escapeHtml(cleanK)}</span>
                <i data-lucide="check" class="w-3.5 h-3.5 text-blue-500 opacity-0 hover:opacity-100"></i>
            </div>
            `;
        }).join("");

        const footerHint = `
            <div class="px-3.5 py-1.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between select-none">
                <span class="flex items-center gap-1">
                    <kbd class="px-1 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600">↑</kbd>
                    <kbd class="px-1 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600">↓</kbd>
                    <span>រំកិល</span>
                </span>
                <span class="flex items-center gap-1">
                    <kbd class="px-1 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600">Enter</kbd>
                    <span>ជ្រើសរើស</span>
                </span>
            </div>
        `;

        list.innerHTML = itemsHtml + footerHint;

        const items = list.querySelectorAll(".khan-item");

        items.forEach((item, idx) => {
            item.addEventListener("click", () => {
                selectKhanItem(item);
            });
            item.addEventListener("mouseenter", () => {
                selectedIndex = idx;
                updateHighlight(items);
            });
        });

        list.classList.remove("hidden");
        lucide.createIcons();
    }

    input.addEventListener("input", (e) => {
        const val = e.target.value;
        if (clearBtn) clearBtn.classList.toggle("hidden", !val);
        renderSuggestions(val);
    });

    input.addEventListener("focus", () => {
        renderSuggestions(input.value);
    });

    input.addEventListener("keydown", (e) => {
        const items = list.querySelectorAll(".khan-item");
        const isOpen = !list.classList.contains("hidden");

        if (e.key === "ArrowDown") {
            if (!isOpen) {
                renderSuggestions(input.value);
                return;
            }
            if (items.length === 0) return;
            e.preventDefault();
            if (selectedIndex < items.length - 1) {
                selectedIndex++;
            } else {
                selectedIndex = 0;
            }
            updateHighlight(items);
        } else if (e.key === "ArrowUp") {
            if (!isOpen) return;
            if (items.length === 0) return;
            e.preventDefault();
            if (selectedIndex > 0) {
                selectedIndex--;
            } else {
                selectedIndex = items.length - 1;
            }
            updateHighlight(items);
        } else if (e.key === "Enter") {
            if (isOpen && items.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                if (selectedIndex >= 0 && selectedIndex < items.length) {
                    selectKhanItem(items[selectedIndex]);
                } else if (items.length === 1) {
                    selectKhanItem(items[0]);
                }
            }
        } else if (e.key === "Escape") {
            if (isOpen) {
                e.preventDefault();
                e.stopPropagation();
                list.classList.add("hidden");
                selectedIndex = -1;
            }
        } else if (e.key === "Tab") {
            if (isOpen && selectedIndex >= 0 && selectedIndex < items.length) {
                selectKhanItem(items[selectedIndex]);
            }
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            input.value = "";
            clearBtn.classList.add("hidden");
            input.focus();
            renderSuggestions("");
        });
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Navigation Tabs (Clicks on Modules show Table View)
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const tabName = btn.getAttribute("data-tab");
            switchNavbarModule(tabName);
        });
    });

    // Sidebar triggers (Desktop collapse & Mobile drawer)
    const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
    const mobileMenuToggle = document.getElementById("mobileMenuToggle");
    const closeSidebarBtn = document.getElementById("closeSidebarBtn");
    const sidebarLogoMini = document.getElementById("sidebarLogoMini");
    const mobileSidebarBackdrop = document.getElementById("mobileSidebarBackdrop");

    if (sidebarToggleBtn) {
        sidebarToggleBtn.onclick = function(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            toggleSidebar();
        };
    }
    if (mobileMenuToggle && mobileMenuToggle !== sidebarToggleBtn) {
        mobileMenuToggle.onclick = function(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            toggleSidebar();
        };
    }
    if (closeSidebarBtn) {
        closeSidebarBtn.onclick = function(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            toggleSidebar(false);
        };
    }
    if (sidebarLogoMini) {
        sidebarLogoMini.onclick = function(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            toggleSidebar(true);
        };
    }
    if (mobileSidebarBackdrop) {
        mobileSidebarBackdrop.onclick = function(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            toggleSidebar(false);
        };
    }

    // Keyboard shortcuts: Ctrl+B/Cmd+B for sidebar, Ctrl+K/Cmd+K for search
    window.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
            e.preventDefault();
            toggleSidebar();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            if (typeof focusActiveSearchInput === "function") {
                focusActiveSearchInput();
            }
        }
    });

    // Window resize handler to maintain consistent sidebar responsive state
    window.addEventListener("resize", () => {
        const sidebar = document.getElementById("appSidebar");
        const backdrop = document.getElementById("mobileSidebarBackdrop");
        if (isDesktopView()) {
            if (backdrop) backdrop.classList.add("hidden");
            document.body.classList.remove("overflow-hidden");
            if (sidebar) sidebar.classList.remove("-translate-x-full");
            const isCollapsed = document.body.classList.contains("sidebar-collapsed");
            updateSidebarToggleIconState(isCollapsed);
        } else {
            const isHidden = !sidebar || sidebar.classList.contains("-translate-x-full");
            updateSidebarToggleIconState(isHidden);
        }
    });

    // Initialize Search Fields for Customer Name, City/Province, and Khan
    initRegisterSearchFields();

    // Customer Modal Province change
    const custModalProv = document.getElementById("customerModalProvince");
    if (custModalProv) {
        custModalProv.addEventListener("change", (e) => {
            updateCustomerModalKhan(e.target.value);
        });
    }

    // Setup Form Submissions
    const customerForm = document.getElementById("customerForm");
    if (customerForm) customerForm.addEventListener("submit", handleCustomerFormSubmit);

    const buForm = document.getElementById("buForm");
    if (buForm) buForm.addEventListener("submit", handleBUFormSubmit);

    const pkgForm = document.getElementById("packageForm");
    if (pkgForm) pkgForm.addEventListener("submit", handlePackageFormSubmit);

    const docForm = document.getElementById("docForm");
    if (docForm) docForm.addEventListener("submit", handleDocFormSubmit);

    // Setup Search Inputs (Debounced for smooth typing)
    const searchCustInput = document.getElementById("searchCustomerSetupInput");
    if (searchCustInput) {
        searchCustInput.addEventListener("input", debounce(() => renderCustomerSetupTable(), 180));
    }

    const searchBUInput = document.getElementById("searchBUSetupInput");
    if (searchBUInput) {
        searchBUInput.addEventListener("input", debounce(() => renderBUSetupTable(), 180));
    }

    const searchPkgInput = document.getElementById("searchPkgSetupInput");
    if (searchPkgInput) {
        searchPkgInput.addEventListener("input", debounce(() => renderPackageTypeSetupTable(), 180));
    }

    const searchDocInput = document.getElementById("searchDocSetupInput");
    if (searchDocInput) {
        searchDocInput.addEventListener("input", debounce(() => renderDocTypeSetupTable(), 180));
    }

    // Sync All Setup Button
    const btnSyncAllSetup = document.getElementById("btnSyncAllSetup");
    if (btnSyncAllSetup) {
        btnSyncAllSetup.addEventListener("click", syncAllSetupToSheets);
    }

    // Auto Generate SO# Button
    const btnGenSO = document.getElementById("btnGenSO");
    if (btnGenSO) {
        btnGenSO.addEventListener("click", () => {
            const soInput = document.getElementById("fieldSONumber");
            if (soInput) soInput.value = generateNextAutoSONumber();
        });
    }

    // Order Registration Form Submit
    const registerForm = document.getElementById("orderRegisterForm");
    if (registerForm) {
        registerForm.addEventListener("submit", handleOrderRegistration);
    }

    // Reset Form Button
    const btnResetForm = document.getElementById("btnResetForm");
    if (btnResetForm) {
        btnResetForm.addEventListener("click", () => {
            registerForm.reset();
            document.getElementById("btnClearCustomer")?.classList.add("hidden");
            document.getElementById("btnClearProvince")?.classList.add("hidden");
            document.getElementById("btnClearKhan")?.classList.add("hidden");
            document.getElementById("customerSuggestionsList")?.classList.add("hidden");
            document.getElementById("provinceSuggestionsList")?.classList.add("hidden");
            document.getElementById("khanSuggestionsList")?.classList.add("hidden");
            const soInput = document.getElementById("fieldSONumber");
            if (soInput) soInput.value = generateNextAutoSONumber();
        });
    }

    // Search and Filter Listeners (Debounced 180ms for ultra-responsive rendering)
    const searchInput = document.getElementById("searchOrderInput");
    if (searchInput) {
        searchInput.addEventListener("input", debounce((e) => {
            AppState.searchQuery = e.target.value.toLowerCase().trim();
            AppState.tableCurrentPage = 1;
            renderDashboardTable();
        }, 180));
    }

    const filterStatusSelect = document.getElementById("filterStatus");
    if (filterStatusSelect) {
        filterStatusSelect.addEventListener("change", (e) => {
            AppState.filterStatus = e.target.value;
            AppState.tableCurrentPage = 1;

            // Sync Navbar active tab button
            const statusToTab = {
                "ALL": "dashboard",
                "REGISTERED": "register",
                "PICKING": "picking",
                "CHECKING": "checking",
                "WAITING_CHECKING": "checking",
                "DELIVERY": "delivery",
                "WAITING_DELIVERY": "delivery",
                "INCOMPLETE": "incompleted-delivery",
                "COMPLETED": "dashboard"
            };
            const activeTab = statusToTab[AppState.filterStatus] || "dashboard";
            AppState.currentTab = activeTab;
            updateNavbarActiveBtn(activeTab);
            updateKpiCardsVisibility();

            updateCardActiveStates();
            applyColumnVisibility();
            if (typeof refreshPersonalDisplayMenu === "function") {
                refreshPersonalDisplayMenu();
            }
            renderDashboardTable();
        });
    }

    const filterBUSelect = document.getElementById("filterBU");
    if (filterBUSelect) {
        filterBUSelect.addEventListener("change", (e) => {
            AppState.filterBU = e.target.value;
            AppState.tableCurrentPage = 1;
            renderDashboardTable();
        });
    }

    // Settings Modal
    const btnOpenSettings = document.getElementById("btnOpenSettings");
    const settingsModal = document.getElementById("settingsModal");
    const btnCloseSettings = document.getElementById("btnCloseSettings");
    const btnSaveSettings = document.getElementById("btnSaveSettings");
    const btnTestConnection = document.getElementById("btnTestConnection");
    const gasUrlInput = document.getElementById("gasUrlInput");

    if (btnOpenSettings && settingsModal) {
        btnOpenSettings.addEventListener("click", () => {
            const user = getCurrentUser();
            if (!user || user.role !== "Admin") {
                showToast("មានតែ Admin ប៉ុណ្ណោះដែលអាចបើក Settings បាន!", "warning");
                return;
            }
            if (gasUrlInput) gasUrlInput.value = SheetsSync.getApiUrl();

            // Populate Telegram Settings
            if (window.TelegramNotify) {
                const tgCfg = window.TelegramNotify.getConfig();
                const tgTokenEl = document.getElementById("tgBotTokenInput");
                const tgChatEl = document.getElementById("tgChatIdInput");
                const tgToggleEl = document.getElementById("tgEnabledToggle");
                const tgOnStartEl = document.getElementById("tgNotifyOnStart");
                const tgOnEndEl = document.getElementById("tgNotifyOnEnd");
                const tgIncludePayEl = document.getElementById("tgIncludePayment");
                if (tgTokenEl) tgTokenEl.value = tgCfg.botToken || "";
                if (tgChatEl) tgChatEl.value = tgCfg.chatId || "";
                if (tgToggleEl) tgToggleEl.checked = Boolean(tgCfg.enabled);
                if (tgOnStartEl) tgOnStartEl.checked = Boolean(tgCfg.notifyOnStart);
                if (tgOnEndEl) tgOnEndEl.checked = Boolean(tgCfg.notifyOnEnd);
                if (tgIncludePayEl) tgIncludePayEl.checked = Boolean(tgCfg.includePayment);
            }

            settingsModal.classList.remove("hidden");
            if (typeof lucide !== "undefined" && lucide.createIcons) {
                lucide.createIcons();
            }
        });
        if (btnCloseSettings) {
            btnCloseSettings.addEventListener("click", () => {
                settingsModal.classList.add("hidden");
            });
        }
        const btnResetDefaultUrl = document.getElementById("btnResetDefaultUrl");
        if (btnResetDefaultUrl) {
            btnResetDefaultUrl.addEventListener("click", () => {
                if (gasUrlInput) {
                    gasUrlInput.value = SheetsSync.MASTER_GAS_URL;
                    showToast("បានកំណត់ជា Master URL ដើមរួចរាល់!", "info");
                }
            });
        }
        if (btnSaveSettings) {
            btnSaveSettings.addEventListener("click", () => {
                const user = getCurrentUser();
                if (!user || user.role !== "Admin") {
                    showToast("មានតែ Admin ប៉ុណ្ណោះដែលអាចរក្សាទុកការកំណត់នេះបាន!", "error");
                    return;
                }
                const url = gasUrlInput.value.trim();
                const savedUrl = SheetsSync.setApiUrl(url);
                if (gasUrlInput) gasUrlInput.value = savedUrl;

                Swal.fire({
                    title: "រក្សាទុក Master URL បានជោគជ័យ! ✅",
                    text: "URL នេះត្រូវបានកំណត់ជាមេ (Master URL)។ រាល់ User ទាំងអស់លើគ្រប់ឧបករណ៍ (Phone & PC) នឹងអាចប្រើប្រាស់ និង Auto-Sync ទិន្នន័យបានដោយស្វ័យប្រវត្តិ ដោយមិនបាច់ Setup ឡើយ។",
                    icon: "success",
                    confirmButtonText: "យល់ព្រម",
                    confirmButtonColor: "#2563eb"
                });
                settingsModal.classList.add("hidden");

                if (typeof syncFromGoogleSheet === "function") {
                    syncFromGoogleSheet();
                }
            });
        }
        if (btnTestConnection) {
            btnTestConnection.addEventListener("click", async () => {
                const url = gasUrlInput.value.trim();
                btnTestConnection.disabled = true;
                btnTestConnection.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin inline mr-1"></i> កំពុងតេស្ត...`;
                const result = await SheetsSync.testConnection(url);
                btnTestConnection.disabled = false;
                btnTestConnection.innerHTML = `<i data-lucide="plug" class="w-4 h-4 inline mr-1"></i> សាកល្បងតភ្ជាប់ (Test Connection)`;
                lucide.createIcons();

                if (result.success) {
                    Swal.fire({
                        title: "តភ្ជាប់បានជោគជ័យ! 🎉",
                        text: "Google Sheet 'Tracking order' និង Sheet 'Tracking' ដំណើរការយ៉ាងល្អ។ រាល់ទិន្នន័យថ្មីនឹងត្រូវ Auto-update ដោយស្វ័យប្រវត្តិ!",
                        icon: "success",
                        confirmButtonText: "យល់ព្រម",
                        confirmButtonColor: "#2563eb"
                    });
                } else {
                    Swal.fire({
                        title: "បរាជ័យក្នុងការតភ្ជាប់!",
                        text: result.message,
                        icon: "error",
                        confirmButtonText: "បិទ",
                        confirmButtonColor: "#ef4444"
                    });
                }
            });
        }

        // Telegram Settings Events
        const btnSaveTelegramSettings = document.getElementById("btnSaveTelegramSettings");
        if (btnSaveTelegramSettings) {
            btnSaveTelegramSettings.addEventListener("click", () => {
                const user = getCurrentUser();
                if (!user || user.role !== "Admin") {
                    showToast("មានតែ Admin ប៉ុណ្ណោះដែលអាចរក្សាទុកការកំណត់ Telegram បាន!", "error");
                    return;
                }
                const token = document.getElementById("tgBotTokenInput")?.value.trim() || "";
                const chatId = document.getElementById("tgChatIdInput")?.value.trim() || "";
                const enabled = Boolean(document.getElementById("tgEnabledToggle")?.checked);
                const notifyOnStart = Boolean(document.getElementById("tgNotifyOnStart")?.checked);
                const notifyOnEnd = Boolean(document.getElementById("tgNotifyOnEnd")?.checked);
                const includePayment = Boolean(document.getElementById("tgIncludePayment")?.checked);

                if (window.TelegramNotify) {
                    window.TelegramNotify.saveConfig({
                        enabled,
                        botToken: token,
                        chatId,
                        notifyOnStart,
                        notifyOnEnd,
                        includePayment
                    });
                }

                Swal.fire({
                    title: "រក្សាទុកការកំណត់ Telegram រួចរាល់! ✈️✅",
                    text: "រាល់ការផ្លាស់ប្ដូរត្រូវបានរក្សាទុក និង Sync ទៅកាន់គ្រប់ឧបករណ៍ទាំងអស់ដោយស្វ័យប្រវត្តិ។",
                    icon: "success",
                    confirmButtonText: "យល់ព្រម",
                    confirmButtonColor: "#0284c7"
                });
                settingsModal.classList.add("hidden");
            });
        }

        const btnTestTelegram = document.getElementById("btnTestTelegram");
        if (btnTestTelegram) {
            btnTestTelegram.addEventListener("click", async () => {
                const token = document.getElementById("tgBotTokenInput")?.value.trim() || "";
                const chatId = document.getElementById("tgChatIdInput")?.value.trim() || "";
                if (!token || !chatId) {
                    showToast("សូមបញ្ចូល Telegram Bot Token និង Chat ID ជាមុនសិន!", "warning");
                    return;
                }

                btnTestTelegram.disabled = true;
                btnTestTelegram.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin inline mr-1"></i> កំពុងផ្ញើសារសាកល្បង...`;
                if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();

                const res = await window.TelegramNotify.testConnection(token, chatId);
                btnTestTelegram.disabled = false;
                btnTestTelegram.innerHTML = `<i data-lucide="send" class="w-4 h-4 inline mr-1"></i> សាកល្បងផ្ញើសារ (Test Send)`;
                if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();

                if (res.success) {
                    Swal.fire({
                        title: "ផ្ញើសារសាកល្បងជោគជ័យ! 🎉✈️",
                        text: "Bot បានបញ្ជូនសារ Test ចូលទៅកាន់ Telegram Group / Channel របស់អ្នកដោយជោគជ័យ!",
                        icon: "success",
                        confirmButtonText: "អស្ចារ្យ",
                        confirmButtonColor: "#0284c7"
                    });
                } else {
                    Swal.fire({
                        title: "ផ្ញើសារបរាជ័យ! ⚠️",
                        html: `ប្រព័ន្ធមិនអាចផ្ញើសារទៅកាន់ Telegram បានឡើយ:<br><b class="text-rose-600">${res.error || "Unknown error"}</b><br><br><span class="text-xs text-slate-500">សូមប្រាកដថា៖<br>1. Token ត្រឹមត្រូវពី @BotFather<br>2. Chat ID ត្រឹមត្រូវ<br>3. បានទាញ Bot ចូល Group/Channel និងកំណត់ជា Admin</span>`,
                        icon: "error",
                        confirmButtonText: "ពិនិត្យឡើងវិញ",
                        confirmButtonColor: "#ef4444"
                    });
                }
            });
        }

        const btnAutoDetectChatId = document.getElementById("btnAutoDetectChatId");
        if (btnAutoDetectChatId) {
            btnAutoDetectChatId.addEventListener("click", async () => {
                const token = document.getElementById("tgBotTokenInput")?.value.trim() || "";
                if (!token) {
                    showToast("សូមបញ្ចូល Telegram Bot Token ជាមុនសិន!", "warning");
                    document.getElementById("tgBotTokenInput")?.focus();
                    return;
                }

                btnAutoDetectChatId.disabled = true;
                btnAutoDetectChatId.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin text-sky-600 inline mr-1"></i><span>កំពុងស្វែងរក...</span>`;
                if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();

                const res = await window.TelegramNotify.getRecentChats(token);
                btnAutoDetectChatId.disabled = false;
                btnAutoDetectChatId.innerHTML = `<i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-500 inline mr-1"></i><span>🔍 ស្វែងរក Chat ID ស្វ័យប្រវត្តិ</span>`;
                if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();

                if (!res.success) {
                    Swal.fire({
                        title: "មិនអាចស្វែងរកបានឡើយ!",
                        text: res.error || "Token មិនត្រឹមត្រូវ",
                        icon: "error",
                        confirmButtonText: "បិទ",
                        confirmButtonColor: "#ef4444"
                    });
                    return;
                }

                const chats = res.chats || [];
                if (chats.length === 0) {
                    Swal.fire({
                        title: "មិនទាន់រកឃើញ Chat ឬ Group ឡើយ! ⚠️",
                        html: `
                            <p class="text-xs text-slate-600 mb-2 leading-relaxed">
                                Bot មិនទាន់ទទួលបានសារណាមួយពី Telegram នៅឡើយទេ។<br>
                                សូមអនុវត្តជំហានណាមួយខាងក្រោម៖
                            </p>
                            <div class="text-left bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-700">
                                <div><b>ករណីទី ១ (Group):</b> Add Bot ចូល Group រួចវាយសារអ្វីមួយ (ឧ. <code>hello</code> ឬ <code>/start</code>) ក្នុង Group នោះ</div>
                                <div><b>ករណីទី ២ (Private):</b> ចូលទៅកាន់ Bot របស់អ្នក រួចចុច <b>"Start"</b></div>
                            </div>
                            <p class="text-[11px] text-sky-700 font-semibold mt-2">រួចហើយចុចប៊ូតុង "ស្វែងរក Chat ID ស្វ័យប្រវត្តិ" នេះម្ដងទៀត!</p>
                        `,
                        icon: "info",
                        confirmButtonText: "យល់ព្រម",
                        confirmButtonColor: "#0284c7"
                    });
                    return;
                }

                if (chats.length === 1) {
                    const c = chats[0];
                    const chatInput = document.getElementById("tgChatIdInput");
                    if (chatInput) chatInput.value = c.id;
                    Swal.fire({
                        title: "រកឃើញ Chat ID ជោគជ័យ! 🎉",
                        html: `ឈ្មោះ: <b>${escapeHtml(c.title)}</b><br>ប្រភេទ: <span class="font-mono text-xs text-sky-700">${escapeHtml(c.type)}</span><br>Chat ID: <b class="font-mono text-emerald-600">${escapeHtml(c.id)}</b><br><br><span class="text-xs text-slate-500">ប្រព័ន្ធបានបំពេញ Chat ID នេះចូលក្នុងប្រអប់រួចរាល់! លោកអ្នកអាចចុច "សាកល្បងផ្ញើសារ (Test Send)" បានឥឡូវនេះ។</span>`,
                        icon: "success",
                        confirmButtonText: "អស្ចារ្យ",
                        confirmButtonColor: "#0284c7"
                    });
                } else {
                    const optionsHtml = chats.map((c, i) => `
                        <label class="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 cursor-pointer transition select-none text-left">
                            <div class="flex items-center gap-2">
                                <input type="radio" name="selectedDetectedChat" value="${escapeHtml(c.id)}" ${i === 0 ? 'checked' : ''} class="w-4 h-4 text-sky-600">
                                <div>
                                    <div class="font-bold text-xs text-slate-800">${escapeHtml(c.title)}</div>
                                    <div class="text-[10px] text-slate-400">${escapeHtml(c.type)}</div>
                                </div>
                            </div>
                            <span class="font-mono text-xs font-bold text-sky-700">${escapeHtml(c.id)}</span>
                        </label>
                    `).join("");

                    Swal.fire({
                        title: "ជ្រើសរើស Group / Chat របស់អ្នក",
                        html: `
                            <p class="text-xs text-slate-500 mb-2">ប្រព័ន្ធរកឃើញចំនួន ${chats.length} Chats ដូចខាងក្រោម៖</p>
                            <div class="space-y-1.5 max-h-56 overflow-y-auto p-1 text-left">
                                ${optionsHtml}
                            </div>
                        `,
                        icon: "question",
                        showCancelButton: true,
                        confirmButtonText: "ជ្រើសរើស (Select)",
                        cancelButtonText: "បោះបង់",
                        confirmButtonColor: "#0284c7"
                    }).then(res => {
                        if (res.isConfirmed) {
                            const selected = document.querySelector("input[name='selectedDetectedChat']:checked");
                            if (selected) {
                                const chatInput = document.getElementById("tgChatIdInput");
                                if (chatInput) chatInput.value = selected.value;
                                showToast(`បានកំណត់ Chat ID: ${selected.value}`, "success");
                            }
                        }
                    });
                }
            });
        }
    }

    // Settings Navigation Tab Switcher
    window.switchSettingsTab = function(tabName) {
        const tabGas = document.getElementById("tabBtnSettingsGas");
        const tabTg = document.getElementById("tabBtnSettingsTelegram");
        const panelGas = document.getElementById("settingsPanel-gas");
        const panelTg = document.getElementById("settingsPanel-telegram");
        if (!tabGas || !tabTg || !panelGas || !panelTg) return;

        if (tabName === "telegram") {
            tabGas.className = "settings-nav-tab flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition text-slate-600 hover:text-blue-700 cursor-pointer";
            tabTg.className = "settings-nav-tab flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition bg-white text-sky-700 shadow-xs cursor-pointer";
            panelGas.classList.add("hidden");
            panelTg.classList.remove("hidden");
        } else {
            tabGas.className = "settings-nav-tab flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition bg-white text-blue-700 shadow-xs cursor-pointer";
            tabTg.className = "settings-nav-tab flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition text-slate-600 hover:text-sky-700 cursor-pointer";
            panelGas.classList.remove("hidden");
            panelTg.classList.add("hidden");
        }
        if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
    };

    window.togglePasswordVisibility = function(inputId) {
        const el = document.getElementById(inputId);
        if (!el) return;
        el.type = (el.type === "password") ? "text" : "password";
    };

    // Sync From Sheet Button
    const btnSyncNow = document.getElementById("btnSyncNow");
    if (btnSyncNow) {
        btnSyncNow.addEventListener("click", syncFromGoogleSheet);
    }

    // Personal Display Columns Initialization
    initPersonalDisplay();

    // Edit Order Form Submit & SO# Live Badge Sync
    const editOrderForm = document.getElementById("editOrderForm");
    if (editOrderForm) {
        editOrderForm.addEventListener("submit", handleEditOrderSubmit);
    }
    const editSoInput = document.getElementById("editOrderSONumber");
    if (editSoInput) {
        editSoInput.addEventListener("input", (e) => {
            const badge = document.getElementById("editModalSOBadge");
            if (badge) badge.textContent = e.target.value.trim() || "SO#";
        });
    }

    // User Setup Search Input (Debounced)
    const searchUserSetup = document.getElementById("searchUserSetupInput");
    if (searchUserSetup) {
        searchUserSetup.addEventListener("input", debounce((e) => {
            AppState.setupSearchQuery = e.target.value.toLowerCase().trim();
            renderUserSetupTable();
        }, 180));
    }

    // User Form Submit (Add/Edit User)
    const userForm = document.getElementById("userForm");
    if (userForm) {
        userForm.addEventListener("submit", handleUserFormSubmit);
    }

    // Login Form Submit & Remember Me Dynamic Pre-fill
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", handleLoginFormSubmit);
    }

    const loginUsernameInput = document.getElementById("loginUsernameInput");
    if (loginUsernameInput) {
        loginUsernameInput.addEventListener("input", (e) => {
            const val = e.target.value.trim().toLowerCase();
            const remUser = (localStorage.getItem(STORAGE_REMEMBER_ME_USER) || "").toLowerCase();
            const isRem = localStorage.getItem(STORAGE_REMEMBER_ME_CHECKED) === "true";
            const pwInput = document.getElementById("loginPasswordInput");
            if (pwInput && isRem && remUser) {
                if (val === remUser) {
                    const remPassRaw = localStorage.getItem(STORAGE_REMEMBER_ME_PASS) || "";
                    if (remPassRaw) {
                        pwInput.value = decodeRememberedPassword(remPassRaw);
                    }
                } else if (pwInput.value && val !== remUser) {
                    pwInput.value = "";
                }
            }
        });
    }

    const loginRememberMeCheckbox = document.getElementById("loginRememberMeCheckbox");
    if (loginRememberMeCheckbox) {
        loginRememberMeCheckbox.addEventListener("change", (e) => {
            if (!e.target.checked) {
                localStorage.removeItem(STORAGE_REMEMBER_ME_CHECKED);
                localStorage.removeItem(STORAGE_REMEMBER_ME_USER);
                localStorage.removeItem(STORAGE_REMEMBER_ME_PASS);
            }
        });
    }

    // Modal Esc Key and Backdrop Click Handlers
    initModalEscAndBackdrop();
}

// Google Sheets Status Indicator & Live Real-Time Polling Hooks
function setupSheetsStatusCallback() {
    SheetsSync.onStatusChange = (status, text) => {
        const badge = document.getElementById("sheetsStatusBadge");
        const statusText = document.getElementById("sheetsStatusText");
        const indicatorDot = document.getElementById("sheetsStatusDot");
        if (!badge || !statusText || !indicatorDot) return;

        if (status === "online") {
            badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50/90 text-emerald-700 border border-emerald-200/90 shadow-2xs cursor-pointer hover:bg-emerald-100/80 transition";
            indicatorDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 pulse-dot-green";
            statusText.textContent = text || "Google Sheets: បានភ្ជាប់";
        } else if (status === "syncing") {
            badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50/90 text-blue-700 border border-blue-200/90 shadow-2xs cursor-pointer hover:bg-blue-100/80 transition";
            indicatorDot.className = "w-2.5 h-2.5 rounded-full bg-blue-500 animate-spin";
            statusText.textContent = text || "កំពុង Auto-Sync...";
        } else if (status === "warning") {
            badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50/90 text-amber-700 border border-amber-200/90 shadow-2xs cursor-pointer hover:bg-amber-100/80 transition";
            indicatorDot.className = "w-2.5 h-2.5 rounded-full bg-amber-500";
            statusText.textContent = text || "Offline Mode (Queued)";
        } else {
            badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/80 backdrop-blur-md text-slate-700 border border-slate-200/90 shadow-2xs cursor-pointer hover:bg-slate-50 transition";
            indicatorDot.className = "w-2.5 h-2.5 rounded-full bg-slate-400";
            statusText.textContent = text || "Google Sheets: Disconnected";
        }
    };

    // Live Server Update Callback (triggered when Google Sheet has new data)
    SheetsSync.onDataUpdated = (fullData) => {
        applyLiveServerUpdate(fullData);
    };

    // Live Cross-Tab Update Callback (triggered across open tabs in same browser)
    SheetsSync.onBroadcastReceived = (msg) => {
        applyBroadcastEvent(msg);
    };

    // Pulse dot callback
    SheetsSync.onLiveSyncPulse = () => {
        pulseLiveSyncBadge(false);
    };

    // Live User Presence Callback (triggered when online users list updates)
    SheetsSync.onPresenceChange = (users) => {
        updateOnlineUsersPresence(users);
    };

    if (SheetsSync.isConfigured()) {
        SheetsSync.updateStatusBadge("online", "Google Sheets: Connected");
        SheetsSync.startLivePolling();
    } else {
        SheetsSync.updateStatusBadge("offline", "Google Sheets: Disconnected");
    }
}

// Handle real-time updates arriving silently from cloud (Google Sheets)
function applyLiveServerUpdate(fullData) {
    if (!fullData) return;
    let hasOrderChanges = false;

    if (fullData.orders && Array.isArray(fullData.orders)) {
        const incomingOrders = fullData.orders.map(normalizeOrderDates);
        
        // Fast signature comparison (including paymentReceipt)
        const makeSig = (list) => list.map(o => 
            `${o.soNumber}|${o.status}|${o.pickingStartTime || ''}|${o.pickingEndTime || ''}|${o.checkingStartTime || ''}|${o.checkingEndTime || ''}|${o.deliveryStartTime || ''}|${o.deliveryEndTime || ''}|${o.pickerBy || ''}|${o.checkerBy || ''}|${o.deliveryBy || ''}|${o.specialNotes || ''}|${o.deliveryNotes || ''}|${o.paymentReceipt || ''}`
        ).join("###");

        if (makeSig(AppState.orders) !== makeSig(incomingOrders)) {
            console.log("⚡ Live Update: Merging fresh orders from Google Sheet...");
            // Smart Merge: Don't let an empty cloud paymentReceipt overwrite a locally recorded paymentReceipt
            const merged = incomingOrders.map(inc => {
                const existing = AppState.orders.find(o => o.soNumber === inc.soNumber);
                if (existing) {
                    if ((!inc.paymentReceipt || inc.paymentReceipt === "-") && existing.paymentReceipt && existing.paymentReceipt !== "-") {
                        inc.paymentReceipt = existing.paymentReceipt;
                        inc.paymentReceiptType = existing.paymentReceiptType;
                        inc.paymentReceiptAmount = existing.paymentReceiptAmount;
                        inc.paymentAccountAmount = existing.paymentAccountAmount;
                        inc.paymentCashAmount = existing.paymentCashAmount;
                        inc.paymentAccountCurrency = existing.paymentAccountCurrency;
                        inc.paymentCashCurrency = existing.paymentCashCurrency;
                        inc.paymentReceiptCurrency = existing.paymentReceiptCurrency;
                    }
                }
                return inc;
            });
            AppState.orders = merged;
            saveOrdersToStorage(false); // Do not re-broadcast locally
            hasOrderChanges = true;
        }
    }

    if (fullData.setup) {
        let setupChanged = false;
        if (Array.isArray(fullData.setup.customers) && fullData.setup.customers.length > 0) { 
            AppState.setup.customers = fullData.setup.customers; 
            saveSetupState("customers"); 
            setupChanged = true; 
        }
        if (Array.isArray(fullData.setup.bus) && fullData.setup.bus.length > 0) { 
            AppState.setup.bus = fullData.setup.bus; 
            saveSetupState("bus"); 
            setupChanged = true; 
        }
        if (Array.isArray(fullData.setup.packageTypes) && fullData.setup.packageTypes.length > 0) { 
            AppState.setup.packageTypes = fullData.setup.packageTypes; 
            saveSetupState("packageTypes"); 
            setupChanged = true; 
        }
        if (Array.isArray(fullData.setup.documentTypes) && fullData.setup.documentTypes.length > 0) { 
            AppState.setup.documentTypes = fullData.setup.documentTypes; 
            saveSetupState("documentTypes"); 
            setupChanged = true; 
        }
        if (Array.isArray(fullData.setup.users) && fullData.setup.users.length > 0) { 
            AppState.setup.users = fullData.setup.users; 
            saveSetupState("users"); 
            renderCurrentUserProfile();
            setupChanged = true; 
        }
        if (setupChanged) setupDropdownOptions();
    }

    if (fullData.onlineUsers && Array.isArray(fullData.onlineUsers)) {
        updateOnlineUsersPresence(fullData.onlineUsers);
    }

    if (hasOrderChanges) {
        renderAll(false);
        pulseLiveSyncBadge(true);
    }
}

// ==============================================================================
// ULTRA-FAST REAL-TIME ACTION APPLIER (PC <-> MOBILE <50ms SYNC)
// ==============================================================================
function applyIncomingRealtimeAction(action, payload) {
    if (!action || !payload) return;

    let hasChanged = false;

    // 1. REGISTER OR SAVE ORDER
    if (action === "REGISTER_ORDER" || action === "SAVE_ORDER") {
        const order = payload.order || payload;
        if (order && order.soNumber) {
            const cleanSo = String(order.soNumber).trim();
            const originalSo = String(payload.originalSoNumber || order.originalSoNumber || cleanSo).trim();
            let idx = AppState.orders.findIndex(o => (o.soNumber || "").toLowerCase() === cleanSo.toLowerCase());
            if (idx === -1 && originalSo !== cleanSo) {
                idx = AppState.orders.findIndex(o => (o.soNumber || "").toLowerCase() === originalSo.toLowerCase());
            }

            const normalized = normalizeOrderDates(order);
            if (idx > -1) {
                AppState.orders[idx] = Object.assign({}, AppState.orders[idx], normalized);
            } else {
                AppState.orders.unshift(normalized);
            }
            hasChanged = true;
        }
    }
    // 2. UPDATE STAGE (PICKING, CHECKING, DELIVERY START / END)
    else if (action === "UPDATE_STAGE") {
        const { soNumber, stage, timestamp, duration, status, specialNotes } = payload;
        if (soNumber) {
            const order = AppState.orders.find(o => (o.soNumber || "").toLowerCase() === String(soNumber).toLowerCase());
            if (order) {
                const nowTime = timestamp || formatAppDateTime();
                order.lastUpdated = nowTime;

                switch (stage) {
                    case "PICKING_START":
                        order.pickingStartTime = nowTime;
                        order.pickerBy = payload.pickerBy || order.pickerBy || "Picker";
                        order.status = status || "In Picking";
                        break;
                    case "PICKING_END":
                        order.pickingEndTime = nowTime;
                        order.pickingDuration = duration || calculateDuration(order.pickingStartTime, nowTime);
                        order.status = status || "Waiting Checking";
                        order.pickerBy = payload.pickerBy || order.pickerBy;
                        break;
                    case "CHECKING_START":
                        order.checkingStartTime = nowTime;
                        order.checkerBy = payload.checkerBy || order.checkerBy || "Checker";
                        order.status = status || "In Checking";
                        break;
                    case "CHECKING_END":
                        order.checkingEndTime = nowTime;
                        order.checkingDuration = duration || calculateDuration(order.checkingStartTime, nowTime);
                        order.status = status || "Waiting Delivery";
                        order.checkerBy = payload.checkerBy || order.checkerBy;
                        if (payload.totalPackage !== undefined && payload.totalPackage !== null && payload.totalPackage !== "") {
                            order.totalPackage = payload.totalPackage;
                        }
                        if (payload.packageUnit) order.packageUnit = payload.packageUnit;
                        if (specialNotes !== undefined && specialNotes !== null) order.specialNotes = specialNotes;
                        break;
                    case "DELIVERY_START":
                        order.deliveryStartTime = nowTime;
                        order.deliveryBy = payload.deliveryBy || order.deliveryBy || "Driver";
                        order.status = status || "In Delivery";
                        if (payload.deliveryAttempts) order.deliveryAttempts = payload.deliveryAttempts;
                        if (payload.deliveryNotes) order.deliveryNotes = payload.deliveryNotes;
                        order.completedFromDailyDelivery = false;
                        unmarkOrderCompletedFromDaily(order.soNumber, false);
                        break;
                    case "DELIVERY_END":
                        order.deliveryEndTime = nowTime;
                        order.deliveryDuration = duration || calculateDuration(order.deliveryStartTime, nowTime);
                        order.status = status || order.status;
                        order.deliveryBy = payload.deliveryBy || order.deliveryBy;
                        if (payload.deliveryAttempts !== undefined) order.deliveryAttempts = payload.deliveryAttempts;
                        if (payload.deliveryNotes !== undefined) order.deliveryNotes = payload.deliveryNotes;
                        if (payload.paymentReceipt !== undefined) order.paymentReceipt = payload.paymentReceipt;
                        if (payload.paymentReceiptType !== undefined) order.paymentReceiptType = payload.paymentReceiptType;
                        if (payload.paymentReceiptAmount !== undefined) order.paymentReceiptAmount = payload.paymentReceiptAmount;
                        if (payload.paymentAccountAmount !== undefined) order.paymentAccountAmount = payload.paymentAccountAmount;
                        if (payload.paymentCashAmount !== undefined) order.paymentCashAmount = payload.paymentCashAmount;
                        if (payload.paymentAccountCurrency !== undefined) order.paymentAccountCurrency = payload.paymentAccountCurrency;
                        if (payload.paymentCashCurrency !== undefined) order.paymentCashCurrency = payload.paymentCashCurrency;
                        break;
                    case "RESTART_PICKING":
                        order.pickingStartTime = "";
                        order.pickingEndTime = "";
                        order.pickingDuration = "-";
                        order.status = "Registered";
                        break;
                    case "RESTART_CHECKING":
                        order.checkingStartTime = "";
                        order.checkingEndTime = "";
                        order.checkingDuration = "-";
                        order.status = "Waiting Checking";
                        break;
                    case "RESTART_DELIVERY":
                        order.deliveryStartTime = "";
                        order.deliveryEndTime = "";
                        order.deliveryDuration = "-";
                        order.status = "Waiting Delivery";
                        break;
                }
                hasChanged = true;

                // Refresh details modal if currently open for this order
                const detailsModal = document.getElementById("orderDetailsModal");
                if (detailsModal && !detailsModal.classList.contains("hidden")) {
                    const curDetailSo = document.getElementById("detailModalSOBadge")?.textContent?.trim();
                    if (curDetailSo && curDetailSo.toLowerCase() === order.soNumber.toLowerCase()) {
                        viewOrderDetails(order.soNumber);
                    }
                }
            } else {
                // Order not found in memory (e.g. registered on phone earlier), pull fresh state
                if (window.SheetsSync && typeof SheetsSync.checkUpdates === "function") {
                    SheetsSync.checkUpdates(true);
                }
            }
        }
    }
    // 3. DAILY COMPLETED TOGGLES
    else if (action === "MARK_DAILY_COMPLETED") {
        if (payload.soNumber) {
            unmarkOrderCompletedFromDaily(payload.soNumber, false);
            const order = AppState.orders.find(o => (o.soNumber || "").toLowerCase() === String(payload.soNumber).toLowerCase());
            if (order) order.completedFromDailyDelivery = true;
            try {
                const set = getDailyCompletedOrderSos();
                set.add(String(payload.soNumber).trim());
                localStorage.setItem(STORAGE_DAILY_COMPLETED_ORDERS, JSON.stringify(Array.from(set)));
            } catch (e) {}
            hasChanged = true;
        }
    }
    else if (action === "UNMARK_DAILY_COMPLETED") {
        if (payload.soNumber) {
            unmarkOrderCompletedFromDaily(payload.soNumber, false);
            const order = AppState.orders.find(o => (o.soNumber || "").toLowerCase() === String(payload.soNumber).toLowerCase());
            if (order) order.completedFromDailyDelivery = false;
            hasChanged = true;
        }
    }
    // 4. SETUP MASTER DATA CRUD
    else if (action === "SAVE_CUSTOMER" && payload.customer) {
        if (Array.isArray(AppState.setup.customers)) {
            const cid = payload.customer.id;
            const idx = AppState.setup.customers.findIndex(c => c.id === cid || c.name === payload.customer.name);
            if (idx > -1) AppState.setup.customers[idx] = payload.customer;
            else AppState.setup.customers.push(payload.customer);
            saveSetupState("customers");
            setupDropdownOptions();
            if (AppState.currentTab === "setup") renderSetupCustomers();
        }
    }
    else if (action === "DELETE_CUSTOMER" && payload.id) {
        if (Array.isArray(AppState.setup.customers)) {
            AppState.setup.customers = AppState.setup.customers.filter(c => c.id !== payload.id);
            saveSetupState("customers");
            setupDropdownOptions();
            if (AppState.currentTab === "setup") renderSetupCustomers();
        }
    }
    else if (action === "SAVE_BU" && payload.bu) {
        if (Array.isArray(AppState.setup.bus)) {
            const idx = AppState.setup.bus.findIndex(b => b.id === payload.bu.id || b.name === payload.bu.name);
            if (idx > -1) AppState.setup.bus[idx] = payload.bu;
            else AppState.setup.bus.push(payload.bu);
            saveSetupState("bus");
            setupDropdownOptions();
            if (AppState.currentTab === "setup") renderSetupBU();
        }
    }
    else if (action === "DELETE_BU" && payload.id) {
        if (Array.isArray(AppState.setup.bus)) {
            AppState.setup.bus = AppState.setup.bus.filter(b => b.id !== payload.id);
            saveSetupState("bus");
            setupDropdownOptions();
            if (AppState.currentTab === "setup") renderSetupBU();
        }
    }

    if (hasChanged) {
        saveOrdersToStorage(false);
        renderAll(false);
        pulseLiveSyncBadge(true);
    }
}
window.applyIncomingRealtimeAction = applyIncomingRealtimeAction;

// Handle real-time updates arriving across browser tabs on the same computer (<5ms)
function applyBroadcastEvent(msg) {
    if (!msg) return;
    if (msg.type === "REALTIME_MUTATION" && msg.payload && typeof window.applyIncomingRealtimeAction === "function") {
        window.applyIncomingRealtimeAction(msg.payload.action, msg.payload);
        return;
    }
    if (msg.type === "ORDERS_LOCAL_UPDATE" || msg.type === "LOCAL_MUTATION") {
        const saved = localStorage.getItem(STORAGE_ORDERS_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    AppState.orders = parsed.map(normalizeOrderDates);
                    renderAll(false);
                    pulseLiveSyncBadge(true);
                }
            } catch (e) {}
        }
    }
}

// Subtle visual pulse on LIVE badge in header
function pulseLiveSyncBadge(dataChanged = false) {
    const badge = document.getElementById("liveSyncStatusBadge");
    const dot = document.getElementById("liveSyncPulseDot");
    const text = document.getElementById("liveSyncStatusText");
    if (!badge) return;

    if (dataChanged) {
        badge.classList.remove("bg-emerald-50", "text-emerald-700", "border-emerald-200/80");
        badge.classList.add("bg-blue-100", "text-blue-800", "border-blue-300");
        if (text) text.textContent = "LIVE UPDATED ⚡";
        setTimeout(() => {
            badge.classList.remove("bg-blue-100", "text-blue-800", "border-blue-300");
            badge.classList.add("bg-emerald-50", "text-emerald-700", "border-emerald-200/80");
            if (text) text.textContent = "LIVE SYNC";
        }, 1800);
    } else {
        if (dot) {
            dot.classList.add("scale-150");
            setTimeout(() => dot.classList.remove("scale-150"), 400);
        }
    }
}

// Force immediate check when clicking Live badge
async function forceCheckLiveUpdates() {
    pulseLiveSyncBadge(false);
    if (!SheetsSync.isConfigured()) {
        switchTab("settings");
        return;
    }
    const dot = document.getElementById("liveSyncPulseDot");
    if (dot) dot.classList.add("animate-spin");
    try {
        const res = await SheetsSync.checkUpdates(true);
        if (!res || !res.hasChanges) {
            if (typeof Toastify === "function") {
                Toastify({
                    text: "⚡ Live Sync: ទិន្នន័យស្របគ្នាទាំងអស់ (Up to date)",
                    duration: 2000,
                    gravity: "top",
                    position: "center",
                    style: {
                        background: "linear-gradient(to right, #059669, #10b981)",
                        borderRadius: "12px",
                        fontWeight: "bold",
                        fontSize: "12px",
                        boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.4)"
                    }
                }).showToast();
            }
        }
    } finally {
        if (dot) dot.classList.remove("animate-spin");
    }
}
window.forceCheckLiveUpdates = forceCheckLiveUpdates;
window.pulseLiveSyncBadge = pulseLiveSyncBadge;

// Helper to check if current screen is desktop (>= 1024px)
function isDesktopView() {
    return window.innerWidth >= 1024;
}

// Update Toggle Button Icon and Tooltip State (Matches Image 1 & 2)
function updateSidebarToggleIconState(isCollapsed) {
    const toggleBtn = document.getElementById("sidebarToggleBtn");
    if (!toggleBtn) return;

    let iconName = "menu";
    if (isDesktopView()) {
        iconName = "menu";
        if (isCollapsed) {
            toggleBtn.setAttribute("title", "ពង្រីក Sidebar (Expand) [Ctrl+B]");
            toggleBtn.classList.add("text-blue-600", "bg-blue-50/80", "border-blue-200");
            toggleBtn.classList.remove("text-slate-700", "bg-white", "border-slate-200/90");
        } else {
            toggleBtn.setAttribute("title", "បង្រួម Sidebar (Collapse) [Ctrl+B]");
            toggleBtn.classList.remove("text-blue-600", "bg-blue-50/80", "border-blue-200");
            toggleBtn.classList.add("text-slate-700", "bg-white", "border-slate-200/90");
        }
    } else {
        const sidebar = document.getElementById("appSidebar");
        const isOpen = sidebar && !sidebar.classList.contains("-translate-x-full");
        if (isOpen) {
            iconName = "x";
            toggleBtn.setAttribute("title", "បិទ Sidebar");
        } else {
            iconName = "menu";
            toggleBtn.setAttribute("title", "បើក Sidebar");
        }
    }

    toggleBtn.innerHTML = `<i id="sidebarToggleIcon" data-lucide="${iconName}" class="w-5 h-5"></i>`;

    if (window.lucide && typeof window.lucide.createIcons === "function") {
        window.lucide.createIcons();
    }
}

let isSidebarToggleBusy = false;

// Toggle Left Sidebar (Desktop collapse & Mobile off-canvas drawer)
function toggleSidebar(forceState) {
    if (isSidebarToggleBusy) return;
    isSidebarToggleBusy = true;
    setTimeout(() => { isSidebarToggleBusy = false; }, 150);

    // Normalize forceState: if passed an event or non-boolean, treat as undefined (toggle)
    if (typeof forceState !== "boolean") {
        forceState = undefined;
    }

    const sidebar = document.getElementById("appSidebar");
    const backdrop = document.getElementById("mobileSidebarBackdrop");
    if (!sidebar) return;

    if (isDesktopView()) {
        const isCurrentlyCollapsed = document.body.classList.contains("sidebar-collapsed");
        const shouldCollapse = (forceState === undefined) ? !isCurrentlyCollapsed : !forceState;

        if (shouldCollapse) {
            document.body.classList.add("sidebar-collapsed");
            localStorage.setItem("order_app_sidebar_collapsed", "true");
        } else {
            document.body.classList.remove("sidebar-collapsed");
            localStorage.setItem("order_app_sidebar_collapsed", "false");
        }
        updateSidebarToggleIconState(shouldCollapse);
    } else {
        const isCurrentlyHidden = sidebar.classList.contains("-translate-x-full");
        const shouldShow = (forceState === undefined) ? isCurrentlyHidden : forceState;

        if (shouldShow) {
            sidebar.classList.remove("-translate-x-full");
            if (backdrop) backdrop.classList.remove("hidden");
            document.body.classList.add("overflow-hidden");
        } else {
            sidebar.classList.add("-translate-x-full");
            if (backdrop) backdrop.classList.add("hidden");
            document.body.classList.remove("overflow-hidden");
        }
        updateSidebarToggleIconState(!shouldShow);
    }
}
window.toggleSidebar = toggleSidebar;

// Initialize Saved Sidebar State
function initSidebarState() {
    if (isDesktopView()) {
        const savedCollapsed = localStorage.getItem("order_app_sidebar_collapsed");
        if (savedCollapsed === "true") {
            document.body.classList.add("sidebar-collapsed");
            updateSidebarToggleIconState(true);
        } else {
            document.body.classList.remove("sidebar-collapsed");
            updateSidebarToggleIconState(false);
        }
    } else {
        updateSidebarToggleIconState(true);
    }
}
window.initSidebarState = initSidebarState;

// Theme colors for sidebar module badges
function getNavBadgeTheme(tab) {
    switch (tab) {
        case "register":
            return "bg-blue-50 text-blue-700 border border-blue-200/80";
        case "picking":
            return "bg-amber-50 text-amber-700 border border-amber-200/80";
        case "checking":
            return "bg-purple-50 text-purple-700 border border-purple-200/80";
        case "delivery":
            return "bg-sky-50 text-sky-700 border border-sky-200/80";
        case "incompleted-delivery":
            return "bg-orange-50 text-orange-700 border border-orange-200/80";
        case "daily-delivery":
            return "bg-emerald-50 text-emerald-700 border border-emerald-200/80";
        case "dashboard":
            return "bg-slate-100 text-slate-700 border border-slate-200/80";
        default:
            return "bg-slate-100 text-slate-600 border border-slate-200/60";
    }
}

// Helper to update active nav button styling
function updateNavbarActiveBtn(tabName) {
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
        const tab = btn.getAttribute("data-tab");
        const isActive = (tab === tabName);
        const badge = btn.querySelector(".nav-tab-badge");

        if (isActive) {
            btn.classList.add("bg-blue-600", "text-white", "shadow-sm");
            btn.classList.remove("text-slate-600", "hover:bg-slate-100");
            if (badge) {
                badge.className = "nav-tab-badge sidebar-expanded-only text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/25 shrink-0 transition-all";
            }
        } else {
            btn.classList.remove("bg-blue-600", "text-white", "shadow-sm");
            btn.classList.add("text-slate-600", "hover:bg-slate-100");
            if (badge) {
                badge.className = `nav-tab-badge sidebar-expanded-only text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 transition-all ${getNavBadgeTheme(tab)}`;
            }
        }
    });

    // Close mobile drawer ONLY when on mobile (< 1024px)
    if (!isDesktopView()) {
        toggleSidebar(false);
    }

    // Update Top Header Page Title
    const headerTitleEl = document.getElementById("headerCurrentPageTitle");
    if (headerTitleEl && typeof getModuleNameKh === "function") {
        headerTitleEl.textContent = getModuleNameKh(tabName);
    }
}

// Helper to show only a single main view section
function showOnlyView(viewName) {
    // Hide floating sort dropdown menus
    const dashMenu = document.getElementById("dashboardDateTimeDropdownMenu");
    if (dashMenu) dashMenu.classList.add("hidden");
    const repMenu = document.getElementById("reportSoDateDropdownMenu");
    if (repMenu) repMenu.classList.add("hidden");

    const views = ["daily-delivery", "register", "picking", "checking", "delivery", "incompleted-delivery", "dashboard", "report", "setup"];
    views.forEach(v => {
        const viewEl = document.getElementById(`view-${v}`);
        if (viewEl) {
            if (v === viewName) {
                viewEl.classList.remove("hidden");
            } else {
                viewEl.classList.add("hidden");
            }
        }
    });

    if (typeof updateOnlineUsersPresence === "function") {
        updateOnlineUsersPresence();
    }
}

// Helper to control 6 KPI Cards visibility:
// Shown ONLY on "dashboard" module overview.
// Individual cards are filtered strictly by user permissions.
function updateKpiCardsVisibility() {
    const kpiContainer = document.getElementById("dashboardMetricCardsContainer");
    if (!kpiContainer) return;

    const user = getCurrentUser();

    if (AppState.currentTab !== "dashboard") {
        kpiContainer.classList.add("hidden");
        kpiContainer.style.display = "none";
    } else {
        kpiContainer.classList.remove("hidden");
        kpiContainer.style.display = "";

        // Map each KPI card to its required permission
        const kpiCardPermMap = [
            { id: "cardFilterRegistered", perm: "register" },
            { id: "cardFilterPicking", perm: "picking" },
            { id: "cardFilterChecking", perm: "checking" },
            { id: "cardFilterDelivery", perm: "delivery" },
            { id: "cardFilterIncomplete", perm: "incompleted-delivery" },
            { 
                id: "cardFilterCompleted", 
                check: (u) => u && (u.role === "Admin" || u.role === "Manager" || (Array.isArray(u.permissions) && (u.permissions.includes("report") || u.permissions.includes("completed"))))
            }
        ];

        let visibleCardsCount = 0;
        kpiCardPermMap.forEach(item => {
            const cardEl = document.getElementById(item.id);
            if (!cardEl) return;

            let isPermitted = false;
            if (user) {
                if (user.role === "Admin") {
                    isPermitted = true;
                } else if (item.check) {
                    isPermitted = Boolean(item.check(user));
                } else if (item.perm) {
                    isPermitted = hasUserPermission(item.perm);
                }
            }

            if (isPermitted) {
                cardEl.classList.remove("hidden");
                cardEl.style.display = "";
                visibleCardsCount++;
            } else {
                cardEl.classList.add("hidden");
                cardEl.style.display = "none";
            }
        });

        // Dynamically adjust responsive grid layout based on number of visible cards
        let gridColsClass = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";
        if (visibleCardsCount === 1) {
            gridColsClass = "grid-cols-1 max-w-sm";
        } else if (visibleCardsCount === 2) {
            gridColsClass = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 max-w-2xl";
        } else if (visibleCardsCount === 3) {
            gridColsClass = "grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 max-w-4xl";
        } else if (visibleCardsCount === 4) {
            gridColsClass = "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4";
        } else if (visibleCardsCount === 5) {
            gridColsClass = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";
        } else if (visibleCardsCount === 0) {
            gridColsClass = "grid-cols-1";
        }
        kpiContainer.className = `grid ${gridColsClass} gap-3 sm:gap-4 transition-all duration-300`;
    }

    // Role-based visibility for Dashboard Orders Toolbar & Master Table:
    // Admin & Manager: SHOW toolbar and orders table
    // User: HIDE toolbar and orders table (leave ONLY KPI Cards)
    const canViewTable = user && (user.role === "Admin" || user.role === "Manager");
    const dashTableSection = document.getElementById("dashboardOrdersTableSection");
    if (dashTableSection) {
        dashTableSection.classList.toggle("hidden", !canViewTable);
    }
}
window.updateKpiCardsVisibility = updateKpiCardsVisibility;

// 1. Switch Module from Navbar: SHOWS AS TABLE (Filtered to that module status)
function switchNavbarModule(moduleName) {
    // Permission Access Right Check
    if (!hasUserPermission(moduleName)) {
        const u = getCurrentUser();
        Swal.fire({
            icon: "warning",
            title: "គ្មានសិទ្ធិចូលប្រើប្រាស់! ⛔",
            html: `គណនី <b>${escapeHtml(u.displayName)}</b> (Role: <span class="text-blue-600 font-bold">${escapeHtml(u.role)}</span>)<br>មិនត្រូវបានអនុញ្ញាតឱ្យចូលកាន់ <b>${escapeHtml(getModuleNameKh(moduleName))}</b> ឡើយ។<br><span class="text-xs text-slate-500 mt-2 block">សូមទាក់ទង Admin ដើម្បីបើកសិទ្ធិ ឬប្ដូរ User ផ្សេង។</span>`,
            confirmButtonText: "យល់ព្រម",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    if (moduleName === "setup") {
        AppState.currentTab = "setup";
        updateNavbarActiveBtn("setup");
        showOnlyView("setup");
        renderSetupView();
        lucide.createIcons();
        return;
    }

    if (moduleName === "report") {
        AppState.currentTab = "report";
        updateNavbarActiveBtn("report");
        showOnlyView("report");
        updateKpiCardsVisibility();
        renderReportView();
        lucide.createIcons();
        return;
    }

    if (moduleName === "daily-delivery") {
        AppState.currentTab = "daily-delivery";
        updateNavbarActiveBtn("daily-delivery");
        showOnlyView("daily-delivery");
        updateKpiCardsVisibility();
        renderDailyDeliveryView();
        lucide.createIcons();
        return;
    }

    const u = getCurrentUser();
    const canViewTable = u && (u.role === "Admin" || u.role === "Manager");

    // If User (non-Admin & non-Manager) clicks a workflow module tab, route directly to its Cards view!
    if (!canViewTable && moduleName !== "dashboard") {
        openModuleCards(moduleName);
        return;
    }

    const statusMap = {
        "dashboard": "ALL",
        "register": "REGISTERED",
        "picking": "PICKING",
        "checking": "CHECKING",
        "delivery": "DELIVERY",
        "incompleted-delivery": "INCOMPLETE"
    };

    const targetStatus = statusMap[moduleName] || "ALL";
    AppState.filterStatus = targetStatus;
    AppState.currentTab = moduleName;
    AppState.tableCurrentPage = 1;

    // Show Table view (view-dashboard)
    showOnlyView("dashboard");
    updateNavbarActiveBtn(moduleName);

    // Sync filter dropdown
    const filterSelect = document.getElementById("filterStatus");
    if (filterSelect) {
        filterSelect.value = targetStatus;
    }

    // Explicitly toggle KPI Cards: Only visible on Dashboard, hidden on modules
    updateKpiCardsVisibility();

    updateCardActiveStates();
    applyColumnVisibility();
    if (typeof refreshPersonalDisplayMenu === "function") {
        refreshPersonalDisplayMenu();
    }
    renderDashboardTable();
    lucide.createIcons();
}

// 2. Click KPI Cards on Dashboard: SHOWS ORDER CARDS VIEW
function openModuleCards(moduleName) {
    if (moduleName === "completed") {
        const u = getCurrentUser();
        const canViewTable = u && (u.role === "Admin" || u.role === "Manager");
        if (!canViewTable) {
            Swal.fire({
                icon: "info",
                title: "បានប្រគល់រួច (Completed Orders)",
                html: `តារាងទិន្នន័យ Orders បានប្រគល់រួច (Completed Table) ត្រូវបានអនុញ្ញាតសម្រាប់តែ Role <b>Admin</b> និង <b>Manager</b> ប៉ុណ្ណោះ។`,
                confirmButtonText: "យល់ព្រម",
                confirmButtonColor: "#2563eb"
            });
            return;
        }
        switchNavbarModule("dashboard");
        AppState.filterStatus = "COMPLETED";
        AppState.tableCurrentPage = 1;
        const filterSelect = document.getElementById("filterStatus");
        if (filterSelect) filterSelect.value = "COMPLETED";
        updateCardActiveStates();
        renderDashboardTable();
        return;
    }

    const validModules = ["register", "picking", "checking", "delivery", "incompleted-delivery"];
    let targetModule = moduleName;
    if (moduleName === "incomplete" || moduleName === "incompleted" || moduleName === "incompleted-delivery") targetModule = "incompleted-delivery";
    if (!validModules.includes(targetModule)) targetModule = "register";

    // Permission Access Right Check
    if (!hasUserPermission(targetModule)) {
        const u = getCurrentUser();
        Swal.fire({
            icon: "warning",
            title: "គ្មានសិទ្ធិចូលប្រើប្រាស់! ⛔",
            html: `គណនី <b>${escapeHtml(u.displayName)}</b> (Role: <span class="text-blue-600 font-bold">${escapeHtml(u.role)}</span>)<br>មិនមានសិទ្ធិចូលកាន់ Order Cards នៃ <b>${escapeHtml(getModuleNameKh(targetModule))}</b> ឡើយ។`,
            confirmButtonText: "យល់ព្រម",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    AppState.currentTab = targetModule;
    updateNavbarActiveBtn(targetModule);
    updateKpiCardsVisibility();
    showOnlyView(targetModule);

    // Sync search input value for this module if already filtered
    const inputMap = {
        "register": "searchCardsRegisterInput",
        "picking": "searchCardsPickingInput",
        "checking": "searchCardsCheckingInput",
        "delivery": "searchCardsDeliveryInput",
        "incompleted-delivery": "searchCardsIncompletedInput"
    };
    const sInput = document.getElementById(inputMap[targetModule]);
    if (sInput) {
        sInput.value = cardsSearchQueries[targetModule] || "";
    }

    if (targetModule === "register") renderRegisterView();
    if (targetModule === "picking") renderPickingView();
    if (targetModule === "checking") renderCheckingView();
    if (targetModule === "delivery") renderDeliveryView();
    if (targetModule === "incompleted-delivery") renderIncompletedDeliveryView();

    lucide.createIcons();
}

// Backward compatibility for switchTab
function switchTab(tabName, preserveFilter = false) {
    if (tabName === "setup") {
        switchNavbarModule("setup");
    } else if (tabName === "dashboard") {
        switchNavbarModule("dashboard");
    } else {
        openModuleCards(tabName);
    }
}

// Debounce helper for input and performance-sensitive actions
function debounce(fn, delay = 160) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Scheduled requestAnimationFrame Lucide icon creator (eliminates layout thrashing)
let lucideScheduleTimer = null;
function scheduleLucideIcons() {
    if (lucideScheduleTimer) cancelAnimationFrame(lucideScheduleTimer);
    lucideScheduleTimer = requestAnimationFrame(() => {
        if (window.lucide && typeof lucide.createIcons === "function") {
            try { lucide.createIcons(); } catch (e) {}
        }
    });
}
window.scheduleLucideIcons = scheduleLucideIcons;

// Render Components (Optimized: Renders active view + counters only, saving 80% DOM overhead)
function renderAll(forceAll = false) {
    renderStatsCounters();
    renderCurrentUserProfile();

    const currentTab = AppState.currentTab || "dashboard";
    if (forceAll) {
        renderDashboardTable();
        renderRegisterView();
        renderPickingView();
        renderCheckingView();
        renderDeliveryView();
        renderIncompletedDeliveryView();
        renderDailyDeliveryView();
        renderReportView();
        renderSetupView();
    } else {
        switch (currentTab) {
            case "dashboard":
                renderDashboardTable();
                break;
            case "register":
                renderRegisterView();
                break;
            case "picking":
                renderPickingView();
                break;
            case "checking":
                renderCheckingView();
                break;
            case "delivery":
                renderDeliveryView();
                break;
            case "incompleted-delivery":
                renderIncompletedDeliveryView();
                break;
            case "daily-delivery":
                renderDailyDeliveryView();
                break;
            case "report":
                renderReportView();
                break;
            case "setup":
                renderSetupView();
                break;
            default:
                renderDashboardTable();
                break;
        }
    }

    scheduleLucideIcons();
}

// Order Status Category Checks (Consistent between KPI counters, Cards, and Dashboard Table)
function isOrderRegistered(order) {
    if (!order) return false;
    const s = (order.status || "").toLowerCase();
    if (order.deliveryEndTime || s === "delivered" || s === "success" || s === "incomplete" || s === "return" || s.includes("ប្រគល់") || s.includes("មិនបានជោគជ័យ")) return false;
    if (order.pickingStartTime || order.checkingStartTime || order.deliveryStartTime) return false;
    if (s.includes("picking") || s.includes("checking") || s.includes("delivery")) return false;
    return true;
}

function isOrderPicking(order) {
    if (!order) return false;
    return !!(order.pickingStartTime && !order.pickingEndTime);
}

function isOrderChecking(order) {
    if (!order) return false;
    return !!(order.pickingEndTime && !order.checkingEndTime);
}

function isOrderDelivery(order) {
    if (!order) return false;
    if (isOrderIncompletedDelivery(order)) return false;
    if (isOrderCompleted(order)) return false;
    const s = (order.status || "").toLowerCase().trim();
    if (s === "waiting delivery" || s.includes("waiting delivery") || s.includes("ready for delivery") || s.includes("រង់ចាំដឹក")) return true;
    if (s === "in delivery" || s.includes("in delivery") || s.includes("កំពុងដឹក") || /^(\d+(?:st|nd|rd|th))\s+delivery$/i.test(s)) return true;
    return !!(order.checkingEndTime && !order.deliveryEndTime);
}

function isOrderIncompletedDelivery(order) {
    if (!order) return false;
    const s = (order.status || "").toLowerCase().trim();
    return (s === "incomplete" || s.includes("incomplete") || s.includes("មិនបានជោគជ័យ")) && !s.includes("delivery");
}

function isOrderCompleted(order) {
    if (!order) return false;
    if (isOrderIncompletedDelivery(order)) return false;
    const s = (order.status || "").toLowerCase().trim();
    if (s === "return" || s.includes("return") || s.includes("ត្រឡប់") || s.includes("បង្វែរ")) return true;
    if (s === "delivered" || s === "completed" || s === "success" || s.includes("success") || s.includes("ប្រគល់") || s.includes("ជោគជ័យ")) return true;
    if (order.deliveryEndTime && order.deliveryEndTime !== "") return true;
    return false;
}

// Daily Delivery Storage & Helper for Tracking Orders Completed from Recent Order (Cross-Device Cloud Synced)
const STORAGE_DAILY_COMPLETED_ORDERS = "order_tracker_daily_completed_sos_v3";
const DEFAULT_DAILY_COMPLETED_SOS = ["SO-2026-4409", "DHC-0005349", "SO-2026-4534"];

function getDailyCompletedOrderSos() {
    const set = new Set();
    try {
        const raw = localStorage.getItem(STORAGE_DAILY_COMPLETED_ORDERS);
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
                arr.forEach(s => {
                    const clean = String(s || "").trim();
                    if (clean) set.add(clean);
                });
            }
        }
    } catch (e) {
        console.warn("Error reading daily completed orders:", e);
    }
    // Always guarantee verified base daily completed SOs are present
    DEFAULT_DAILY_COMPLETED_SOS.forEach(s => set.add(s));
    return set;
}

function mergeDailyCompletedOrderSos(incomingList) {
    if (!Array.isArray(incomingList) || incomingList.length === 0) return;
    try {
        const set = getDailyCompletedOrderSos();
        let changed = false;
        incomingList.forEach(so => {
            const clean = String(so || "").trim();
            if (clean && !set.has(clean)) {
                set.add(clean);
                changed = true;
            }
        });
        if (changed) {
            localStorage.setItem(STORAGE_DAILY_COMPLETED_ORDERS, JSON.stringify(Array.from(set)));
            if (Array.isArray(AppState.orders)) {
                AppState.orders.forEach(o => {
                    if (set.has(o.soNumber)) o.completedFromDailyDelivery = true;
                });
            }
            if (AppState.currentTab === "daily-delivery" && typeof renderDailyDeliveryView === "function") {
                renderDailyDeliveryView();
            }
        }
    } catch (e) {
        console.warn("Error merging daily completed orders:", e);
    }
}
window.mergeDailyCompletedOrderSos = mergeDailyCompletedOrderSos;

function markOrderCompletedFromDaily(soNumber, broadcastCloud = true) {
    if (!soNumber) return;
    const clean = String(soNumber).trim();
    try {
        const set = getDailyCompletedOrderSos();
        set.add(clean);
        localStorage.setItem(STORAGE_DAILY_COMPLETED_ORDERS, JSON.stringify(Array.from(set)));
    } catch (e) {
        console.warn("Error saving daily completed orders:", e);
    }
    const order = AppState.orders.find(o => o.soNumber === clean);
    if (order) order.completedFromDailyDelivery = true;

    if (broadcastCloud && window.SheetsSync) {
        if (typeof SheetsSync.broadcast === "function") {
            SheetsSync.broadcast("DAILY_COMPLETED_UPDATE", { soNumber: clean, action: "ADD" });
        }
        if (typeof SheetsSync.syncDailyCompletedOrder === "function") {
            SheetsSync.syncDailyCompletedOrder(clean, true);
        }
    }
}

function unmarkOrderCompletedFromDaily(soNumber, broadcastCloud = true) {
    if (!soNumber) return;
    const clean = String(soNumber).trim();
    try {
        const set = getDailyCompletedOrderSos();
        set.delete(clean);
        localStorage.setItem(STORAGE_DAILY_COMPLETED_ORDERS, JSON.stringify(Array.from(set)));
    } catch (e) {
        console.warn("Error updating daily completed orders:", e);
    }
    const order = AppState.orders.find(o => o.soNumber === clean);
    if (order) order.completedFromDailyDelivery = false;

    if (broadcastCloud && window.SheetsSync) {
        if (typeof SheetsSync.broadcast === "function") {
            SheetsSync.broadcast("DAILY_COMPLETED_UPDATE", { soNumber: clean, action: "REMOVE" });
        }
        if (typeof SheetsSync.syncDailyCompletedOrder === "function") {
            SheetsSync.syncDailyCompletedOrder(clean, false);
        }
    }
}

// Daily Delivery Predicates
// Table 1: Recent Order (បាន Start Delivery ហើយកំពុងស្ថិតនៅលើផ្លូវ)
function isDailyDeliveryRecentOrder(order) {
    if (!order) return false;
    const s = (order.status || "").toLowerCase().trim();

    // បើ order បានបញ្ចប់ការដឹក (មាន deliveryEndTime ឬ status Success/Incomplete/Return) គឺមិនស្ថិតក្នុង Recent Order ទេ
    if (order.deliveryEndTime && String(order.deliveryEndTime).trim() !== "" && String(order.deliveryEndTime).trim() !== "-") return false;
    if (s === "success" || s.endsWith("success") || s === "delivered" || s === "incomplete" || s === "return" || 
        s.includes("ជោគជ័យ") || s.includes("មិនបានជោគជ័យ") || s.includes("ត្រឡប់") || s.includes("បង្វែរ")) return false;

    // ត្រូវតែបានចុច Start Delivery (មាន deliveryStartTime) ឬ status ជា In Delivery / Nth Delivery
    if (order.deliveryStartTime && String(order.deliveryStartTime).trim() !== "" && String(order.deliveryStartTime).trim() !== "-") {
        return true;
    }
    if (s === "in delivery" || s.includes("in delivery") || /^(\d+(?:st|nd|rd|th))\s+delivery$/i.test(s) || s.includes("កំពុងដឹក")) {
        return true;
    }
    return false;
}

// Table 2: Completed Order (Order ពីតារាង Recent Order ដែលបានបញ្ចប់ការដឹក Success, Incompleted, ឬ Return)
function isDailyDeliveryCompletedOrder(order) {
    if (!order) return false;
    if (isDailyDeliveryRecentOrder(order)) return false;

    const s = (order.status || "").toLowerCase().trim();
    const isCompletedStatus = (s === "success" || s.endsWith("success") || s === "delivered" || s.includes("ជោគជ័យ") ||
                               s === "incomplete" || s.includes("incomplete") || s.includes("មិនបានជោគជ័យ") ||
                               s === "return" || s.includes("return") || s.includes("ត្រឡប់") || s.includes("បង្វែរ"));

    // ត្រូវតែជា order ដែលបានបញ្ចប់ការដឹក (status completed ឬមាន deliveryEndTime)
    if (!isCompletedStatus && (!order.deliveryEndTime || String(order.deliveryEndTime).trim() === "" || String(order.deliveryEndTime).trim() === "-")) {
        return false;
    }

    // 1. សំខាន់បំផុត៖ ត្រូវតែជា Order ដែលបានបញ្ចប់ចេញពី Recent Order (synced list, flag, or verified batch)
    if (order.completedFromDailyDelivery === true || getDailyCompletedOrderSos().has(order.soNumber)) {
        return true;
    }

    // 2. Auto-Detect: បើ Order មាន deliveryEndTime ក្នុងថ្ងៃនេះ (Today / Active Daily Session) ហើយបានបញ្ចប់ការដឹក
    if (isCompletedStatus && order.deliveryEndTime && order.deliveryStartTime) {
        const endStr = String(order.deliveryEndTime).trim();
        const startStr = String(order.deliveryStartTime).trim();
        if (endStr !== "" && endStr !== "-" && startStr !== "" && startStr !== "-") {
            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const todayShort = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${String(now.getFullYear()).slice(-2)}`;
            const todayFull = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
            
            if (endStr.startsWith(todayShort) || endStr.startsWith(todayFull)) {
                markOrderCompletedFromDaily(order.soNumber, false);
                return true;
            }
        }
    }

    return false;
}

// Update Top KPI Cards & Sidebar Navigation Badges
function renderStatsCounters() {
    const registered = AppState.orders.filter(isOrderRegistered).length;
    const inPicking = AppState.orders.filter(isOrderPicking).length;
    const inChecking = AppState.orders.filter(isOrderChecking).length;
    const inDelivery = AppState.orders.filter(isOrderDelivery).length;
    const incompletedDelivery = AppState.orders.filter(isOrderIncompletedDelivery).length;
    const completed = AppState.orders.filter(isOrderCompleted).length;
    const recentDailyDelivery = AppState.orders.filter(isDailyDeliveryRecentOrder).length;
    const totalOrders = AppState.orders.length;

    // 1. Top KPI Metric Cards
    const elRegistered = document.getElementById("statRegisterOrder") || document.getElementById("statTotalOrders");
    const elPicking = document.getElementById("statInPicking");
    const elChecking = document.getElementById("statInChecking");
    const elDelivery = document.getElementById("statInDelivery");
    const elIncompleted = document.getElementById("statIncompletedDelivery");
    const elCompleted = document.getElementById("statCompleted");

    if (elRegistered) elRegistered.textContent = registered;
    if (elPicking) elPicking.textContent = inPicking;
    if (elChecking) elChecking.textContent = inChecking;
    if (elDelivery) elDelivery.textContent = inDelivery;
    if (elIncompleted) elIncompleted.textContent = incompletedDelivery;
    if (elCompleted) elCompleted.textContent = completed;

    // 2. Sidebar Navigation Badges (ចំនួននៅខាងស្តាំនៃ module នីមួយៗ)
    const navBadgeDashboard = document.getElementById("navBadgeDashboard");
    const navBadgeRegister = document.getElementById("navBadgeRegister");
    const navBadgePicking = document.getElementById("navBadgePicking");
    const navBadgeChecking = document.getElementById("navBadgeChecking");
    const navBadgeDelivery = document.getElementById("navBadgeDelivery");
    const navBadgeIncomplete = document.getElementById("navBadgeIncomplete");
    const navBadgeDailyDelivery = document.getElementById("navBadgeDailyDelivery");

    if (navBadgeDashboard) navBadgeDashboard.textContent = totalOrders;
    if (navBadgeRegister) navBadgeRegister.textContent = registered;
    if (navBadgePicking) navBadgePicking.textContent = inPicking;
    if (navBadgeChecking) navBadgeChecking.textContent = inChecking;
    if (navBadgeDelivery) navBadgeDelivery.textContent = inDelivery;
    if (navBadgeIncomplete) navBadgeIncomplete.textContent = incompletedDelivery;
    if (navBadgeDailyDelivery) navBadgeDailyDelivery.textContent = recentDailyDelivery;

    // Refresh active/inactive styles of badges
    if (typeof updateNavbarActiveBtn === "function" && AppState.currentTab) {
        updateNavbarActiveBtn(AppState.currentTab);
    }

    updateCardActiveStates();
}

// Visual active states for KPI Metric Cards
function updateCardActiveStates() {
    const activeStatus = AppState.filterStatus || "ALL";

    const cardConfigs = [
        { id: "cardFilterRegistered", badgeId: "activeBadgeRegistered", status: "REGISTERED", activeClasses: ["ring-2", "ring-blue-500", "bg-blue-50/70", "border-blue-400", "shadow-md"] },
        { id: "cardFilterPicking", badgeId: "activeBadgePicking", status: "PICKING", activeClasses: ["ring-2", "ring-amber-500", "bg-amber-50/70", "border-amber-400", "shadow-md"] },
        { id: "cardFilterChecking", badgeId: "activeBadgeChecking", status: "CHECKING", activeClasses: ["ring-2", "ring-purple-500", "bg-purple-50/70", "border-purple-400", "shadow-md"] },
        { id: "cardFilterDelivery", badgeId: "activeBadgeDelivery", status: "DELIVERY", activeClasses: ["ring-2", "ring-sky-500", "bg-sky-50/70", "border-sky-400", "shadow-md"] },
        { id: "cardFilterIncomplete", badgeId: "activeBadgeIncomplete", status: "INCOMPLETE", activeClasses: ["ring-2", "ring-orange-500", "bg-orange-50/70", "border-orange-400", "shadow-md"] },
        { id: "cardFilterCompleted", badgeId: "activeBadgeCompleted", status: "COMPLETED", activeClasses: ["ring-2", "ring-emerald-500", "bg-emerald-50/70", "border-emerald-400", "shadow-md"] }
    ];

    cardConfigs.forEach(cfg => {
        const card = document.getElementById(cfg.id);
        const badge = document.getElementById(cfg.badgeId);
        if (!card) return;

        if (activeStatus === cfg.status) {
            cfg.activeClasses.forEach(cls => card.classList.add(cls));
            card.classList.remove("border-slate-200", "border-slate-200/90");
            if (badge) badge.classList.remove("hidden");
        } else {
            cfg.activeClasses.forEach(cls => card.classList.remove(cls));
            card.classList.add("border-slate-200/90");
            if (badge) badge.classList.add("hidden");
        }
    });
}

// Filter Dashboard Table by Status directly from card click (with toggle behavior)
function filterByStatusFromCard(status) {
    if (AppState.currentTab !== "dashboard") {
        switchTab("dashboard", true);
    }

    // Toggle off if already selected
    if (AppState.filterStatus === status) {
        AppState.filterStatus = "ALL";
    } else {
        AppState.filterStatus = status;
    }

    const filterSelect = document.getElementById("filterStatus");
    if (filterSelect) {
        filterSelect.value = AppState.filterStatus;
    }

    updateCardActiveStates();
    applyColumnVisibility();
    if (typeof refreshPersonalDisplayMenu === "function") {
        refreshPersonalDisplayMenu();
    }
    AppState.tableCurrentPage = 1;
    renderDashboardTable();
}

// Filter Orders List
function getFilteredOrders() {
    const filtered = AppState.orders.filter(order => {
        // Status filter
        if (AppState.filterStatus && AppState.filterStatus !== "ALL") {
            const raw = (order.status || "").toLowerCase();
            if (AppState.filterStatus === "REGISTERED" && !isOrderRegistered(order)) return false;
            if (AppState.filterStatus === "PICKING" && !isOrderPicking(order)) return false;
            if (AppState.filterStatus === "WAITING_CHECKING") {
                if (raw !== "waiting checking" && !(order.pickingEndTime && !order.checkingStartTime)) return false;
            }
            if (AppState.filterStatus === "IN_CHECKING") {
                if (raw !== "in checking" && !(order.checkingStartTime && !order.checkingEndTime)) return false;
            }
            if (AppState.filterStatus === "CHECKING" && !isOrderChecking(order)) return false;
            if (AppState.filterStatus === "WAITING_DELIVERY") {
                if (raw !== "waiting delivery" && !(order.checkingEndTime && !order.deliveryStartTime)) return false;
            }
            if (AppState.filterStatus === "IN_DELIVERY") {
                if (!isOrderDelivery(order) || raw === "waiting delivery") return false;
            }
            if (AppState.filterStatus === "DELIVERY_1ST") {
                const att = Number(order.deliveryAttempts) || 1;
                if (!isOrderDelivery(order) || att > 1 || raw !== "in delivery") return false;
            }
            if (AppState.filterStatus === "DELIVERY_2ND") {
                const att = Number(order.deliveryAttempts) || 1;
                if (!isOrderDelivery(order) || (att !== 2 && raw !== "2nd delivery")) return false;
            }
            if (AppState.filterStatus === "DELIVERY_3RD") {
                const att = Number(order.deliveryAttempts) || 1;
                if (!isOrderDelivery(order) || (att !== 3 && raw !== "3rd delivery")) return false;
            }
            if (AppState.filterStatus === "DELIVERY" && !isOrderDelivery(order)) return false;
            if ((AppState.filterStatus === "COMPLETED" || AppState.filterStatus === "SUCCESS") && !isOrderCompleted(order)) return false;
            if (AppState.filterStatus === "SUCCESS_1ST") {
                const att = Number(order.deliveryAttempts) || 1;
                if (!isOrderCompleted(order) || att > 1 || raw.includes("2nd") || raw.includes("3rd")) return false;
            }
            if (AppState.filterStatus === "SUCCESS_2ND") {
                const att = Number(order.deliveryAttempts) || 1;
                if (!isOrderCompleted(order) || (att !== 2 && !raw.includes("2nd success"))) return false;
            }
            if (AppState.filterStatus === "SUCCESS_3RD") {
                const att = Number(order.deliveryAttempts) || 1;
                if (!isOrderCompleted(order) || (att !== 3 && !raw.includes("3rd success"))) return false;
            }
            if (AppState.filterStatus === "INCOMPLETE" && !isOrderIncompletedDelivery(order)) return false;
            if (AppState.filterStatus === "RETURN" && raw !== "return" && !raw.includes("return") && !raw.includes("ត្រឡប់")) return false;
        }

        // BU filter
        if (AppState.filterBU !== "ALL" && order.bu !== AppState.filterBU) {
            return false;
        }

        // Search text across all columns
        if (AppState.searchQuery) {
            const q = AppState.searchQuery;
            const matchesSO = (order.soNumber || "").toLowerCase().includes(q);
            const matchesDate = (order.timestamp || "").toLowerCase().includes(q);
            const matchesCustomer = (order.customerName || "").toLowerCase().includes(q);
            const matchesCity = (order.cityProvince || "").toLowerCase().includes(q);
            const matchesKhan = (order.khan || "").toLowerCase().includes(q);
            const matchesPacking = (order.packingListNumber || "").toLowerCase().includes(q);
            const matchesInvoice = (order.invoiceNumber || "").toLowerCase().includes(q);
            const matchesAmount = String(order.invoiceAmount || "").toLowerCase().includes(q);
            const matchesBU = (order.bu || "").toLowerCase().includes(q);
            const matchesDoc = (order.documentType || "").toLowerCase().includes(q);
            const matchesNotes = (order.specialNotes || "").toLowerCase().includes(q) || (order.deliveryNotes || "").toLowerCase().includes(q);
            const matchesStatus = (order.status || "").toLowerCase().includes(q);
            return matchesSO || matchesDate || matchesCustomer || matchesCity || matchesKhan || 
                   matchesPacking || matchesInvoice || matchesAmount || matchesBU || matchesDoc || 
                   matchesNotes || matchesStatus;
        }

        return true;
    });

    // Sort Dashboard Orders by Date & Time (Ascending A-Z or Descending Z-A)
    const sortCol = AppState.dashboardSortColumn || "datetime";
    const sortDir = AppState.dashboardSortDirection || "desc";

    if (sortCol === "datetime") {
        const factor = sortDir === "asc" ? 1 : -1;
        filtered.sort((a, b) => {
            const timeA = getOrderSoDateTimestamp(a);
            const timeB = getOrderSoDateTimestamp(b);
            if (timeA !== timeB) {
                return (timeA - timeB) * factor;
            }
            return String(a.soNumber || "").localeCompare(String(b.soNumber || ""), undefined, { numeric: true }) * factor;
        });
    }

    return filtered;
}

// Render Dashboard Table (with 10 items per page pagination)
function renderDashboardTable() {
    const tbody = document.getElementById("ordersTableBody");
    if (!tbody) return;

    const filtered = getFilteredOrders();
    const totalOrders = filtered.length;
    const pageSize = AppState.tablePageSize || 10;
    const totalPages = Math.ceil(totalOrders / pageSize) || 1;

    // Normalize current page to valid range [1, totalPages]
    if (AppState.tableCurrentPage > totalPages) {
        AppState.tableCurrentPage = totalPages;
    }
    if (AppState.tableCurrentPage < 1) {
        AppState.tableCurrentPage = 1;
    }

    if (totalOrders === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="19" class="text-center py-12 text-slate-400">
                    <i data-lucide="package-search" class="w-12 h-12 mx-auto stroke-1 mb-2"></i>
                    <p class="font-medium">មិនមានទិន្នន័យ Order ដែលត្រូវនឹងលក្ខខណ្ឌស្វែងរកទេ</p>
                </td>
            </tr>
        `;
        renderTablePagination(0, 0, 0, 0);
        lucide.createIcons();
        return;
    }

    const startIndex = (AppState.tableCurrentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalOrders);
    const pageOrders = filtered.slice(startIndex, endIndex);

    tbody.innerHTML = pageOrders.map(order => {
        const badgeInfo = getStatusBadgeInfo(order);
        const stageProgress = getStageProgressHtml(order);
        const isHighlighted = AppState.highlightedOrders && AppState.highlightedOrders.has(order.soNumber);

        return `
            <tr id="row-order-${escapeHtml(order.soNumber)}"
                data-so="${escapeHtml(order.soNumber)}"
                onclick="toggleOrderRowHighlight('${escapeHtml(order.soNumber)}', event)"
                class="order-table-row transition-all border-b border-slate-100 text-xs cursor-pointer select-none ${isHighlighted ? 'order-row-highlighted' : 'hover:bg-slate-50/80'}"
                title="ចុចដើម្បី Highlight (ចុច Shift ឬ Ctrl ដើម្បីជ្រើសរើសច្រើន Multi-select)">
                <!-- 1. Status -->
                <td data-col="status" class="py-3 px-3.5 text-center whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badgeInfo.class}">
                        ${badgeInfo.text}
                    </span>
                </td>

                <!-- 2. Column Date (Date & Time) -->
                <td data-col="datetime" class="py-3 px-3.5 font-mono text-slate-600 font-medium whitespace-nowrap">
                    ${formatDateTimeDisplay(order.timestamp)}
                </td>

                <!-- 3. SO# -->
                <td data-col="soNumber" class="py-3 px-3.5 font-bold text-blue-700 tracking-wide font-mono whitespace-nowrap">
                    <span class="cursor-pointer hover:underline inline-flex items-center gap-1" onclick="event.stopPropagation(); viewOrderDetails('${escapeHtml(order.soNumber)}')">
                        ${escapeHtml(order.soNumber)}
                    </span>
                </td>

                <!-- 4. Customer Name -->
                <td data-col="customerName" class="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap max-w-[240px] truncate" title="${escapeHtml(order.customerName)}">
                    ${escapeHtml(order.customerName)}
                </td>

                <!-- 5. City/Province -->
                <td data-col="cityProvince" class="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                    <span class="inline-flex items-center gap-1">
                        <i data-lucide="map-pin" class="w-3 h-3 text-red-500"></i>
                        <span>${escapeHtml(order.cityProvince || "-")}</span>
                    </span>
                </td>

                <!-- 6. Khan -->
                <td data-col="khan" class="py-3 px-3.5 text-slate-700 font-medium whitespace-nowrap">
                    ${escapeHtml(order.khan || "-")}
                </td>

                <!-- 7. Packing List# -->
                <td data-col="packingList" class="py-3 px-3.5 font-mono text-slate-700 font-medium whitespace-nowrap">
                    ${escapeHtml(order.packingListNumber || "-")}
                </td>

                <!-- 8. Invoice# -->
                <td data-col="invoiceNumber" class="py-3 px-3.5 font-mono text-slate-800 font-medium whitespace-nowrap">
                    ${escapeHtml(order.invoiceNumber || "-")}
                </td>

                <!-- 9. Invoice Amount -->
                <td data-col="invoiceAmount" class="py-3 px-3.5 text-right font-bold text-emerald-700 font-mono whitespace-nowrap">
                    ${order.currency === "USD" ? "$" : "៛"}${Number(order.invoiceAmount || 0).toLocaleString()}
                </td>

                <!-- 10. Total Package# -->
                <td data-col="totalPackage" class="py-3 px-3.5 whitespace-nowrap">
                    ${hasOrderTotalPackage(order) ? `
                        <span class="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-xs">
                            ${order.totalPackage} ${escapeHtml(order.packageUnit || "")}
                        </span>
                    ` : '<span class="text-slate-300 font-semibold">-</span>'}
                </td>

                <!-- 11. BU -->
                <td data-col="bu" class="py-3 px-3.5 text-slate-700 whitespace-nowrap max-w-[180px] truncate" title="${escapeHtml(order.bu || "-")}">
                    <span class="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-medium text-xs">
                        ${escapeHtml(order.bu || "-")}
                    </span>
                </td>

                <!-- 12. Document Type -->
                <td data-col="documentType" class="py-3 px-3.5 whitespace-nowrap max-w-[160px] truncate" title="${escapeHtml(order.documentType || "-")}">
                    ${renderDocumentTypeBadge(order.documentType || "-")}
                </td>

                <!-- Created by -->
                <td data-col="createdBy" class="py-3 px-3.5 text-slate-700 whitespace-nowrap text-xs">
                    ${order.createdBy ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium"><i data-lucide="user" class="w-3 h-3 text-blue-500"></i>${escapeHtml(order.createdBy)}</span>` : '<span class="text-slate-300">-</span>'}
                </td>

                <!-- Picker by -->
                <td data-col="pickerBy" class="py-3 px-3.5 text-slate-700 whitespace-nowrap text-xs">
                    ${order.pickerBy ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium"><i data-lucide="package" class="w-3 h-3 text-amber-500"></i>${escapeHtml(order.pickerBy)}</span>` : '<span class="text-slate-300">-</span>'}
                </td>

                <!-- Checker by -->
                <td data-col="checkerBy" class="py-3 px-3.5 text-slate-700 whitespace-nowrap text-xs">
                    ${order.checkerBy ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium"><i data-lucide="clipboard-check" class="w-3 h-3 text-purple-500"></i>${escapeHtml(order.checkerBy)}</span>` : '<span class="text-slate-300">-</span>'}
                </td>

                <!-- Delivery by -->
                <td data-col="deliveryBy" class="py-3 px-3.5 text-slate-700 whitespace-nowrap text-xs">
                    ${order.deliveryBy ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-medium"><i data-lucide="truck" class="w-3 h-3 text-sky-500"></i>${escapeHtml(order.deliveryBy)}</span>` : '<span class="text-slate-300">-</span>'}
                </td>

                <!-- 13. Special Notes -->
                <td data-col="specialNotes" class="py-3 px-3.5 text-slate-600 whitespace-nowrap max-w-[200px] truncate italic" title="${escapeHtml(order.specialNotes || "គ្មាន")}">
                    ${order.specialNotes ? escapeHtml(order.specialNotes) : '<span class="text-slate-300 not-italic">-</span>'}
                </td>

                <!-- 13.1 Payment Receipt -->
                <td data-col="paymentReceipt" class="py-3 px-3.5 whitespace-nowrap">
                    ${renderPaymentReceiptBadge(order)}
                </td>

                <!-- 13.2 Delivery Notes -->
                <td data-col="deliveryNotes" class="py-3 px-3.5 text-slate-600 whitespace-nowrap max-w-[200px] truncate font-mono text-[11px]" title="${escapeHtml(order.deliveryNotes || "គ្មាន")}">
                    ${order.deliveryNotes ? escapeHtml(order.deliveryNotes.replace(/\r?\n/g, ' | ')) : '<span class="text-slate-300 font-sans not-italic">-</span>'}
                </td>

                <!-- 14. Process Timeline (4 Stages) -->
                <td data-col="processTimeline" class="py-3 px-3.5 text-center whitespace-nowrap">
                    ${stageProgress}
                </td>

                <!-- 15. Actions -->
                <td data-col="actions" class="py-3 px-3.5 text-right whitespace-nowrap" onclick="event.stopPropagation()">
                    <div class="flex items-center justify-end gap-1.5">
                        <button onclick="event.stopPropagation(); viewOrderDetails('${escapeHtml(order.soNumber)}')" class="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition" title="មើលព័ត៌មានលម្អិត (View Details)">
                            <i data-lucide="eye" class="w-4 h-4"></i>
                        </button>
                        <button onclick="event.stopPropagation(); openEditOrderModal('${escapeHtml(order.soNumber)}')" class="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition" title="កែប្រែទិន្នន័យ (Edit Order)">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="event.stopPropagation(); quickActionNavigate('${escapeHtml(order.soNumber)}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition flex items-center gap-1 shadow-xs">
                            <span>ដំណើរការ</span>
                            <i data-lucide="arrow-right" class="w-3 h-3"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    renderTablePagination(totalOrders, totalPages, startIndex + 1, endIndex);
    lucide.createIcons();
}

// Render Table Pagination Controls (10 Orders Per Page)
function renderTablePagination(totalOrders, totalPages, startIdx, endIdx) {
    const container = document.getElementById("tablePaginationContainer");
    if (!container) return;

    if (totalOrders === 0) {
        container.classList.add("hidden");
        return;
    }
    container.classList.remove("hidden");

    const currentPage = AppState.tableCurrentPage;
    const rangeText = `${startIdx} - ${endIdx}`;

    // Previous Button
    const prevDisabled = currentPage <= 1;
    let pageButtonsHtml = `
        <button type="button" 
            onclick="changeTablePage(${currentPage - 1})"
            ${prevDisabled ? "disabled" : ""}
            class="px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold flex items-center gap-1 transition ${prevDisabled ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-white hover:bg-slate-50 text-slate-700 active:scale-95 cursor-pointer shadow-2xs'}"
            title="ទំព័រមុន (Previous Page)">
            <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
            <span class="hidden sm:inline">មុន</span>
        </button>
    `;

    // Numeric page buttons
    let pages = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        if (currentPage > 3) pages.push("...");
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) {
            if (!pages.includes(i)) pages.push(i);
        }
        if (currentPage < totalPages - 2) pages.push("...");
        if (!pages.includes(totalPages)) pages.push(totalPages);
    }

    pages.forEach(p => {
        if (p === "...") {
            pageButtonsHtml += `<span class="px-1.5 py-1 text-slate-400 font-bold select-none text-xs">...</span>`;
        } else {
            const isActive = p === currentPage;
            pageButtonsHtml += `
                <button type="button" 
                    onclick="changeTablePage(${p})"
                    class="w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${isActive ? 'bg-blue-600 text-white shadow-xs' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 active:scale-95 shadow-2xs'}">
                    ${p}
                </button>
            `;
        }
    });

    // Next Button
    const nextDisabled = currentPage >= totalPages;
    pageButtonsHtml += `
        <button type="button" 
            onclick="changeTablePage(${currentPage + 1})"
            ${nextDisabled ? "disabled" : ""}
            class="px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold flex items-center gap-1 transition ${nextDisabled ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-white hover:bg-slate-50 text-slate-700 active:scale-95 cursor-pointer shadow-2xs'}"
            title="ទំព័របន្ទាប់ (Next Page)">
            <span class="hidden sm:inline">បន្ទាប់</span>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
        </button>
    `;

    container.innerHTML = `
        <div class="flex items-center gap-1.5 sm:gap-2 text-slate-500 font-medium text-xs">
            <span>បង្ហាញ</span>
            <span class="font-bold text-slate-900 px-2 py-0.5 rounded-lg bg-white border border-slate-200/90 shadow-2xs">${rangeText}</span>
            <span>នៃ</span>
            <span class="font-bold text-blue-700 px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200/70 shadow-2xs">${totalOrders}</span>
            <span>Orders</span>
            <span class="text-slate-300 mx-0.5 hidden md:inline">|</span>
            <span class="hidden md:inline text-slate-400">ទំព័រ <b class="text-slate-800">${currentPage}</b> / <b>${totalPages}</b> (10 Orders / Page)</span>
        </div>
        <div class="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center sm:justify-end">
            ${pageButtonsHtml}
        </div>
    `;
}
window.renderTablePagination = renderTablePagination;

// Change Table Page Handler
function changeTablePage(page) {
    const filtered = getFilteredOrders();
    const pageSize = AppState.tablePageSize || 10;
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;

    let target = Number(page) || 1;
    if (target < 1) target = 1;
    if (target > totalPages) target = totalPages;

    AppState.tableCurrentPage = target;
    renderDashboardTable();

    // Scroll smoothly to top of table
    const tableEl = document.getElementById("ordersTableBody");
    if (tableEl) {
        const tableCard = tableEl.closest(".glass-panel-elevated");
        if (tableCard) {
            tableCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }
}
window.changeTablePage = changeTablePage;

// Set Dashboard Date & Time Sort Explicitly ("asc" or "desc")
function setDashboardDateTimeSort(direction) {
    AppState.dashboardSortColumn = "datetime";
    AppState.dashboardSortDirection = (direction === "asc" || direction === "ascend" || direction === "a-z") ? "asc" : "desc";
    AppState.tableCurrentPage = 1;

    // Sync checkmark indicators in dropdown
    const isAsc = (AppState.dashboardSortDirection === "asc");
    const optAsc = document.getElementById("dashboardMenuOptAsc");
    const optDesc = document.getElementById("dashboardMenuOptDesc");
    const checkAsc = document.getElementById("dashboardMenuCheckAsc");
    const checkDesc = document.getElementById("dashboardMenuCheckDesc");

    if (optAsc && optDesc) {
        if (isAsc) {
            optAsc.classList.add("bg-indigo-50/90", "text-indigo-700");
            optDesc.classList.remove("bg-indigo-50/90", "text-indigo-700");
            if (checkAsc) checkAsc.classList.remove("hidden");
            if (checkDesc) checkDesc.classList.add("hidden");
        } else {
            optDesc.classList.add("bg-indigo-50/90", "text-indigo-700");
            optAsc.classList.remove("bg-indigo-50/90", "text-indigo-700");
            if (checkDesc) checkDesc.classList.remove("hidden");
            if (checkAsc) checkAsc.classList.add("hidden");
        }
    }

    renderDashboardTable();
}
window.setDashboardDateTimeSort = setDashboardDateTimeSort;

// Toggle Dashboard Date & Time Excel-style Dropdown Menu (ដូច SO Date ក្នុងរូបទី២)
function toggleDashboardDateTimeMenu(event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const menu = document.getElementById("dashboardDateTimeDropdownMenu");
    if (!menu) return;
    const btn = document.getElementById("dashboardDateTimeDropdownBtn") || document.getElementById("dashboardThDateTime");

    if (menu.classList.contains("hidden")) {
        // Sync active checkmarks and highlight in dropdown
        const isAsc = (AppState.dashboardSortDirection === "asc");
        const optAsc = document.getElementById("dashboardMenuOptAsc");
        const optDesc = document.getElementById("dashboardMenuOptDesc");
        const checkAsc = document.getElementById("dashboardMenuCheckAsc");
        const checkDesc = document.getElementById("dashboardMenuCheckDesc");

        if (optAsc && optDesc) {
            if (isAsc) {
                optAsc.classList.add("bg-indigo-50/90", "text-indigo-700");
                optDesc.classList.remove("bg-indigo-50/90", "text-indigo-700");
                if (checkAsc) checkAsc.classList.remove("hidden");
                if (checkDesc) checkDesc.classList.add("hidden");
            } else {
                optDesc.classList.add("bg-indigo-50/90", "text-indigo-700");
                optAsc.classList.remove("bg-indigo-50/90", "text-indigo-700");
                if (checkDesc) checkDesc.classList.remove("hidden");
                if (checkAsc) checkAsc.classList.add("hidden");
            }
        }

        // Dynamically position dropdown menu right below Date & Time column header
        if (btn) {
            const btnRect = btn.getBoundingClientRect();
            const th = document.getElementById("dashboardThDateTime");
            const thRect = th ? th.getBoundingClientRect() : btnRect;

            menu.style.position = "fixed";
            const menuHeight = 125;
            let topPos = Math.round(btnRect.bottom + 4);
            if (btnRect.bottom + menuHeight > window.innerHeight && btnRect.top > menuHeight) {
                topPos = Math.max(10, Math.round(btnRect.top - menuHeight - 4));
            }

            const menuWidth = 224;
            let leftPos = Math.round(thRect.left);
            const maxLeft = window.innerWidth - menuWidth - 12;
            if (leftPos > maxLeft) leftPos = maxLeft;
            if (leftPos < 12) leftPos = 12;

            menu.style.top = `${topPos}px`;
            menu.style.left = `${leftPos}px`;
            menu.style.zIndex = "99999";
        }

        menu.classList.remove("hidden");
        lucide.createIcons();
    } else {
        menu.classList.add("hidden");
    }
}
window.toggleDashboardDateTimeMenu = toggleDashboardDateTimeMenu;

// Select sort direction from dashboard dropdown menu
function selectDashboardSortDirection(direction, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const menu = document.getElementById("dashboardDateTimeDropdownMenu");
    if (menu) menu.classList.add("hidden");
    setDashboardDateTimeSort(direction);
}
window.selectDashboardSortDirection = selectDashboardSortDirection;

// Generate Mini Pipeline Progress Bar for Table
function getStageProgressHtml(order) {
    const isPickDone = !!order.pickingEndTime;
    const isPickRunning = !!order.pickingStartTime && !order.pickingEndTime;

    const isCheckDone = !!order.checkingEndTime;
    const isCheckRunning = !!order.checkingStartTime && !order.checkingEndTime;

    const isDeliverDone = !!order.deliveryEndTime;
    const isDeliverRunning = !!order.deliveryStartTime && !order.deliveryEndTime;

    return `
        <div class="flex items-center gap-1.5">
            <!-- Stage 1: Registered -->
            <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-200 text-slate-700" title="Registered: ${formatDateTimeDisplay(order.timestamp)}">
                1
            </div>
            <div class="w-3 h-0.5 ${isPickRunning || isPickDone ? 'bg-amber-500' : 'bg-slate-200'}"></div>

            <!-- Stage 2: Picking -->
            <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isPickDone ? 'bg-amber-500 text-white' : 
                isPickRunning ? 'bg-amber-100 text-amber-700 border-2 border-amber-500 pulse-active' : 'bg-slate-200 text-slate-400'
            }" title="Picking: ${isPickDone ? order.pickingDuration : isPickRunning ? 'In Progress' : 'Pending'}">
                2
            </div>
            <div class="w-3 h-0.5 ${isCheckRunning || isCheckDone ? 'bg-purple-500' : 'bg-slate-200'}"></div>

            <!-- Stage 3: Checking -->
            <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isCheckDone ? 'bg-purple-600 text-white' : 
                isCheckRunning ? 'bg-purple-100 text-purple-700 border-2 border-purple-500 pulse-active' : 'bg-slate-200 text-slate-400'
            }" title="Checking: ${isCheckDone ? order.checkingDuration : isCheckRunning ? 'In Progress' : 'Pending'}">
                3
            </div>
            <div class="w-3 h-0.5 ${isDeliverRunning || isDeliverDone ? 'bg-emerald-500' : 'bg-slate-200'}"></div>

            <!-- Stage 4: Delivery -->
            <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isDeliverDone ? 'bg-emerald-600 text-white' : 
                isDeliverRunning ? 'bg-blue-100 text-blue-700 border-2 border-blue-500 pulse-active' : 'bg-slate-200 text-slate-400'
            }" title="Delivery: ${isDeliverDone ? 'Completed' : isDeliverRunning ? 'On the road' : 'Pending'}">
                4
            </div>
        </div>
    `;
}

// Get Badge Color and Text based on order state (Clean English status names without Khmer text)
function getStatusBadgeInfo(order) {
    if (!order) return { text: "Registered", class: "bg-blue-50 text-blue-700 border border-blue-200 font-medium" };

    const rawStatus = (order.status || "").toLowerCase().trim();

    // 1. Incomplete
    if (rawStatus === "incomplete" || rawStatus.includes("incomplete") || rawStatus.includes("មិនបានជោគជ័យ") || rawStatus.includes("មិនពេញលេញ")) {
        return { text: "Incomplete", class: "bg-amber-100 text-amber-800 border border-amber-300 font-bold" };
    }

    // 2. Return
    if (rawStatus === "return" || rawStatus.includes("return") || rawStatus.includes("ត្រឡប់") || rawStatus.includes("បង្វែរ")) {
        return { text: "Return", class: "bg-rose-100 text-rose-800 border border-rose-300 font-bold" };
    }

    // 3. Delivered / Success (including 2nd Success, 3rd Success, etc.)
    const isSuccessLike = rawStatus === "success" || rawStatus.includes("success") || 
                          rawStatus === "delivered" || rawStatus.includes("delivered") || 
                          rawStatus.includes("completed") || rawStatus.includes("ជោគជ័យ") || 
                          rawStatus.includes("ប្រគល់") || 
                          (order.deliveryEndTime && !rawStatus.includes("incomplete") && !rawStatus.includes("return"));

    if (isSuccessLike) {
        let badgeText = "Success";
        const att = Number(order.deliveryAttempts) || 1;

        const m = (order.status || "").match(/^(\d+(?:st|nd|rd|th))\s+Success$/i);
        if (m) {
            badgeText = `${m[1]} Success`;
        } else if (rawStatus.includes("2nd success")) {
            badgeText = "2nd Success";
        } else if (rawStatus.includes("3rd success")) {
            badgeText = "3rd Success";
        } else if (att > 1) {
            badgeText = getSuccessStatusName(att);
        }

        const isRepeatedSuccess = badgeText !== "Success";
        const badgeClass = isRepeatedSuccess
            ? "bg-emerald-100 text-emerald-900 border border-emerald-400 font-bold shadow-2xs"
            : "bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold";

        return { text: badgeText, class: badgeClass };
    }

    // 4. In Delivery / 2nd Delivery / 3rd Delivery
    const isDeliveryActive = rawStatus === "in delivery" || rawStatus.includes("delivery") ||
                            rawStatus.includes("កំពុងដឹក") ||
                            /^(\d+(?:st|nd|rd|th))\s+delivery$/i.test(rawStatus) ||
                            (order.deliveryStartTime && !order.deliveryEndTime && !isOrderIncompletedDelivery(order));

    if (isDeliveryActive && rawStatus !== "waiting delivery" && !rawStatus.includes("waiting delivery")) {
        let badgeText = "In Delivery";
        const att = Number(order.deliveryAttempts) || 1;

        const dm = (order.status || "").match(/^(\d+(?:st|nd|rd|th))\s+Delivery$/i);
        if (dm) {
            badgeText = `${dm[1]} Delivery`;
        } else if (rawStatus.includes("2nd delivery")) {
            badgeText = "2nd Delivery";
        } else if (rawStatus.includes("3rd delivery")) {
            badgeText = "3rd Delivery";
        } else if (att > 1) {
            badgeText = getDeliveryStatusName(att);
        }

        const isRepeatedDelivery = badgeText !== "In Delivery";
        const badgeClass = isRepeatedDelivery
            ? "bg-sky-100 text-sky-900 border border-sky-400 font-bold shadow-2xs"
            : "bg-sky-100 text-sky-800 border border-sky-200 font-bold";

        return { text: badgeText, class: badgeClass };
    }

    // 5. Waiting Delivery
    if (rawStatus === "waiting delivery" || rawStatus.includes("waiting delivery") || rawStatus.includes("ready for delivery") || rawStatus.includes("checking completed") || (order.checkingEndTime && !order.deliveryStartTime)) {
        return { text: "Waiting Delivery", class: "bg-sky-50 text-sky-700 border border-sky-300 font-medium" };
    }

    // 6. In Checking
    if (rawStatus === "in checking" || rawStatus.includes("in checking") || rawStatus.includes("កំពុងពិនិត្យ") || rawStatus.includes("កំពុងត្រួតពិនិត្យ") || (order.checkingStartTime && !order.checkingEndTime)) {
        return { text: "In Checking", class: "bg-purple-100 text-purple-800 border border-purple-200 font-bold" };
    }

    // 7. Waiting Checking
    if (rawStatus === "waiting checking" || rawStatus.includes("waiting checking") || rawStatus.includes("ready for checking") || rawStatus.includes("picking completed") || (order.pickingEndTime && !order.checkingStartTime)) {
        return { text: "Waiting Checking", class: "bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium" };
    }

    // 8. In Picking
    if (rawStatus === "in picking" || rawStatus.includes("in picking") || rawStatus.includes("កំពុងរៀបចំ") || (order.pickingStartTime && !order.pickingEndTime)) {
        return { text: "In Picking", class: "bg-amber-100 text-amber-800 border border-amber-200 font-bold" };
    }

    // 9. Registered
    return { text: "Registered", class: "bg-blue-50 text-blue-700 border border-blue-200 font-medium" };
}

// Handle Order Registration Form Submission
async function handleOrderRegistration(e) {
    e.preventDefault();

    let soNumber = document.getElementById("fieldSONumber").value.trim();
    let customerName = document.getElementById("fieldCustomerName").value.trim();
    const cityProvince = getCleanEnglishLocation(document.getElementById("fieldCityProvince").value.trim());
    const khan = getCleanEnglishLocation(document.getElementById("fieldKhan").value.trim());
    const packingListNumber = document.getElementById("fieldPackingList").value.trim();
    const invoiceNumber = document.getElementById("fieldInvoiceNumber").value.trim();
    const invoiceAmount = parseFloat(document.getElementById("fieldInvoiceAmount").value) || 0;
    const currency = document.getElementById("fieldCurrency")?.value || "USD";
    // Total Package & Unit are NOT set at registration; they are entered upon End Checking
    const totalPackage = "";
    const packageUnit = "";
    const bu = document.getElementById("fieldBU")?.value || "";
    const documentType = document.getElementById("fieldDocType")?.value.trim() || "SO to customer";
    const specialNotes = document.getElementById("fieldSpecialNotes").value.trim();

    // Auto-generate SO# if empty (format: SO-FSCO-YYMMxxx)
    if (!soNumber) {
        soNumber = generateNextAutoSONumber();
    }
    if (!customerName) {
        customerName = "-";
    }

    // Check Duplicate SO#
    const exists = AppState.orders.find(o => o.soNumber.toLowerCase() === soNumber.toLowerCase());
    if (exists) {
        Swal.fire({
            title: "លេខ SO# នេះមានរួចហើយ!",
            text: `SO# ${soNumber} ត្រូវបានចុះឈ្មោះក្នុងប្រព័ន្ធរួចហើយ។ សូមប្រើប្រាស់លេខថ្មី!`,
            icon: "warning",
            confirmButtonText: "ប្ដូរលេខ SO#",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    const newOrder = {
        timestamp: formatAppDateTime(),
        soNumber: soNumber,
        customerName: customerName,
        cityProvince: cityProvince,
        khan: khan,
        packingListNumber: packingListNumber,
        invoiceNumber: invoiceNumber,
        invoiceAmount: invoiceAmount,
        currency: currency,
        totalPackage: totalPackage,
        packageUnit: packageUnit,
        bu: bu,
        documentType: documentType,
        specialNotes: specialNotes,
        deliveryNotes: "",
        status: "Registered",
        pickingStartTime: "",
        pickingEndTime: "",
        pickingDuration: "-",
        checkingStartTime: "",
        checkingEndTime: "",
        checkingDuration: "-",
        deliveryStartTime: "",
        deliveryEndTime: "",
        deliveryDuration: "-",
        lastUpdated: formatAppDateTime(),
        createdBy: (() => {
            const curU = getCurrentUser();
            return curU ? (curU.displayName || curU.username) : "Admin";
        })(),
        pickerBy: "",
        checkerBy: "",
        deliveryBy: ""
    };

    // Save locally first (instant UI update)
    AppState.orders.unshift(newOrder);
    saveOrdersToStorage();
    renderAll();

    // Auto-update to Google Sheets
    SheetsSync.syncOrder(newOrder);

    // Reset Form
    document.getElementById("orderRegisterForm").reset();
    document.getElementById("btnClearCustomer")?.classList.add("hidden");
    document.getElementById("btnClearProvince")?.classList.add("hidden");
    document.getElementById("btnClearKhan")?.classList.add("hidden");
    document.getElementById("customerSuggestionsList")?.classList.add("hidden");
    document.getElementById("provinceSuggestionsList")?.classList.add("hidden");
    document.getElementById("khanSuggestionsList")?.classList.add("hidden");

    closeCreateOrderModal();

    // Navigate to Register Order Module
    switchTab("register");

    Swal.fire({
        title: "ចុះឈ្មោះ Order បានជោគជ័យ! 📦",
        html: `Order <b>${soNumber}</b> ត្រូវបានបង្កើត និងធ្លាក់ចូលទៅកាន់ <b>Register Order</b> រួចរាល់។<br>លោកអ្នកអាចចុច <b>"Start Picking"</b> ដើម្បីចាប់ផ្ដើមរៀបចំទំនិញភ្លាមៗ!`,
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "Start Picking ភ្លាម",
        cancelButtonText: "មើលក្នុង Register Order",
        confirmButtonColor: "#f59e0b",
        cancelButtonColor: "#2563eb"
    }).then((result) => {
        if (result.isConfirmed) {
            startPicking(soNumber);
        }
    });
}

// -------------------------------------------------------------
// MODULE CARDS SEARCH STATE & HELPERS
// -------------------------------------------------------------
const cardsSearchQueries = {
    "register": "",
    "picking": "",
    "checking": "",
    "delivery": "",
    "incompleted-delivery": ""
};

function matchCardsSearch(order, q) {
    if (!q) return true;
    const term = q.toLowerCase();
    const fieldsToSearch = [
        order.soNumber,
        order.customerName,
        order.invoiceNumber,
        order.packingListNumber,
        order.khan,
        order.cityProvince,
        order.bu,
        order.documentType,
        order.specialNotes,
        order.deliveryNotes,
        order.createdBy,
        order.pickerBy,
        order.checkerBy,
        order.deliveryBy,
        order.driverName,
        order.driverPhone,
        order.status,
        order.totalPackage ? String(order.totalPackage) : "",
        order.invoiceAmount ? String(order.invoiceAmount) : ""
    ];
    return fieldsToSearch.some(val => val && String(val).toLowerCase().includes(term));
}

function onCardsSearchInput(moduleName, value) {
    cardsSearchQueries[moduleName] = (value || "").trim();
    if (moduleName === "register") renderRegisterView();
    else if (moduleName === "picking") renderPickingView();
    else if (moduleName === "checking") renderCheckingView();
    else if (moduleName === "delivery") renderDeliveryView();
    else if (moduleName === "incompleted-delivery") renderIncompletedDeliveryView();
}
window.onCardsSearchInput = onCardsSearchInput;

function clearCardsSearch(moduleName) {
    cardsSearchQueries[moduleName] = "";
    const inputMap = {
        "register": "searchCardsRegisterInput",
        "picking": "searchCardsPickingInput",
        "checking": "searchCardsCheckingInput",
        "delivery": "searchCardsDeliveryInput",
        "incompleted-delivery": "searchCardsIncompletedInput"
    };
    const input = document.getElementById(inputMap[moduleName]);
    if (input) {
        input.value = "";
        input.focus();
    }
    onCardsSearchInput(moduleName, "");
}
window.clearCardsSearch = clearCardsSearch;

function focusActiveSearchInput() {
    const currentTab = AppState.currentTab;
    let targetId = "searchOrderInput";
    if (currentTab === "register") targetId = "searchCardsRegisterInput";
    else if (currentTab === "picking") targetId = "searchCardsPickingInput";
    else if (currentTab === "checking") targetId = "searchCardsCheckingInput";
    else if (currentTab === "delivery") targetId = "searchCardsDeliveryInput";
    else if (currentTab === "incompleted-delivery") targetId = "searchCardsIncompletedInput";
    else if (currentTab === "daily-delivery") targetId = "dailyDeliverySearchInput";

    const input = document.getElementById(targetId);
    if (input) {
        input.focus();
        input.select();
    }
}
window.focusActiveSearchInput = focusActiveSearchInput;

function goToDashboard() {
    switchNavbarModule("dashboard");
}
window.goToDashboard = goToDashboard;

// -------------------------------------------------------------
// MODULE 1: REGISTER ORDER (បញ្ជី ORDER បានចុះឈ្មោះ)
// -------------------------------------------------------------
function renderRegisterView() {
    const container = document.getElementById("registerOrdersContainer");
    if (!container) return;

    // Filter orders with status 'Registered' (not yet started picking)
    let registerOrders = AppState.orders.filter(isOrderRegistered);
    const totalCount = registerOrders.length;

    const q = (cardsSearchQueries["register"] || "").toLowerCase().trim();
    if (q) {
        registerOrders = registerOrders.filter(order => matchCardsSearch(order, q));
    }

    // Update count badge & clear button
    const badge = document.getElementById("cardsRegisterCountBadge");
    if (badge) {
        badge.textContent = q ? `${registerOrders.length} / ${totalCount} Orders` : `${totalCount} Orders`;
    }
    const clearBtn = document.getElementById("clearCardsRegisterSearchBtn");
    if (clearBtn) {
        clearBtn.classList.toggle("hidden", !q);
    }

    if (registerOrders.length === 0) {
        if (totalCount > 0 && q) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <i data-lucide="search-x" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
                    <h4 class="text-slate-700 font-bold text-sm sm:text-base">រកមិនឃើញ Order ដែលត្រូវគ្នានឹង "${escapeHtml(q)}" ឡើយ</h4>
                    <p class="text-xs text-slate-400 mt-1 mb-3">សូមសាកល្បងស្វែងរកដោយ SO#, ឈ្មោះអតិថិជន, ឬ Invoice# ផ្សេងទៀត</p>
                    <button type="button" onclick="clearCardsSearch('register')" class="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition cursor-pointer">
                        សម្អាតការស្វែងរក (Clear Search)
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <div class="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                        <i data-lucide="file-plus-2" class="w-7 h-7"></i>
                    </div>
                    <h4 class="text-slate-800 font-bold text-base">មិនមាន Order ក្នុងបញ្ជីចុះឈ្មោះទេ</h4>
                    <p class="text-xs text-slate-500 mt-1 mb-4">រាល់ Order ថ្មីដែលបាន Register នឹងបង្ហាញនៅទីនេះ រួមជាមួយប៊ូតុង "Start Picking"</p>
                    <button type="button" onclick="openCreateOrderModal()" class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        <span>+ ចុះឈ្មោះ Order ថ្មី</span>
                    </button>
                </div>
            `;
        }
        lucide.createIcons();
        return;
    }

    container.innerHTML = registerOrders.map(order => {
        return `
            <div class="order-card p-5 rounded-2xl border border-blue-200 bg-white hover:shadow-md transition-all">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="min-w-0 flex-1">
                        <span class="text-lg font-bold text-slate-900 font-mono break-all sm:break-normal">${escapeHtml(order.soNumber)}</span>
                        <p class="text-sm font-semibold text-blue-700 mt-0.5 line-clamp-2">${escapeHtml(order.customerName)}</p>
                    </div>
                    <div class="flex flex-col items-end gap-1.5 shrink-0">
                        <span class="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200 flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span> Registered
                        </span>
                        ${renderDocumentTypeBadge(order.documentType)}
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-100 mb-4">
                    <div><b>Invoice#:</b> ${escapeHtml(order.invoiceNumber || "-")}</div>
                    <div><b>Invoice Amount:</b> <span class="font-semibold text-emerald-700">${order.currency === "USD" ? "$" : "៛"}${Number(order.invoiceAmount || 0).toLocaleString()}</span></div>
                    <div><b>Packing list:</b> ${escapeHtml(order.packingListNumber || "-")}</div>
                    <div><b>Location:</b> ${escapeHtml(order.khan || order.cityProvince || "-")}</div>
                </div>

                <!-- Timestamps Display -->
                <div class="space-y-1.5 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl">
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500">កាលបរិច្ឆេទចុះឈ្មោះ:</span>
                        <span class="font-mono font-medium text-slate-700">${formatDateTimeDisplay(order.timestamp)}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500">អ្នកបង្កើត (Created by):</span>
                        <span class="font-semibold text-blue-700">${escapeHtml(order.createdBy || "Admin")}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-slate-500 whitespace-nowrap">Special Notes:</span>
                        ${order.specialNotes && order.specialNotes.trim() ? `
                            <span class="font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 text-right truncate max-w-[200px]" title="${escapeHtml(order.specialNotes)}">${escapeHtml(order.specialNotes)}</span>
                        ` : `
                            <span class="font-mono font-medium text-slate-400">-</span>
                        `}
                    </div>
                </div>

                <!-- Action Button -->
                <div class="flex items-center gap-2">
                    <button onclick="startPicking('${escapeHtml(order.soNumber)}')" class="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2">
                        <i data-lucide="play" class="w-4 h-4 fill-white"></i>
                        <span>Start Picking</span>
                    </button>
                    <button onclick="viewOrderDetails('${escapeHtml(order.soNumber)}')" class="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition" title="មើលព័ត៌មានលម្អិត">
                        <i data-lucide="eye" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
    }).join("");

    lucide.createIcons();
}

function openCreateOrderModal() {
    if (!hasUserPermission("register")) {
        showToast("គ្មានសិទ្ធិចុះឈ្មោះ Order ថ្មីឡើយ! ⛔", "warning");
        return;
    }
    const modal = document.getElementById("createOrderModal");
    if (!modal) return;

    // Display current active operator
    const userBadge = document.getElementById("createOrderUserName");
    if (userBadge) {
        const curU = getCurrentUser();
        userBadge.textContent = curU ? (curU.displayName || curU.username) : "Admin";
    }

    // Auto generate SO# (format: SO-FSCO-YYMMxxx, consecutive sequence)
    const soInput = document.getElementById("fieldSONumber");
    if (soInput) {
        soInput.value = generateNextAutoSONumber();
    }

    // Ensure all suggestion dropdowns are closed upon opening modal
    ["customerSuggestionsList", "provinceSuggestionsList", "khanSuggestionsList"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add("hidden");
            el.innerHTML = "";
        }
    });

    modal.classList.remove("hidden");
    lucide.createIcons();

    // Auto-focus Customer Name field for immediate keyboard typing without opening dropdown
    const custInput = document.getElementById("fieldCustomerName");
    if (custInput) {
        setTimeout(() => {
            custInput.focus();
            const list = document.getElementById("customerSuggestionsList");
            if (list) list.classList.add("hidden");
        }, 100);
    }
}

function closeCreateOrderModal() {
    const modal = document.getElementById("createOrderModal");
    if (modal) modal.classList.add("hidden");

    // Reset SO number input so next opening calculates fresh
    const soInput = document.getElementById("fieldSONumber");
    if (soInput) soInput.value = "";

    // Close any open autocomplete dropdowns
    ["customerSuggestionsList", "provinceSuggestionsList", "khanSuggestionsList"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });
}

// -------------------------------------------------------------
// MODULE 2: PHYSICAL PICKING (ការរៀបចំទំនិញ)
// -------------------------------------------------------------
function renderPickingView() {
    const container = document.getElementById("pickingOrdersContainer");
    if (!container) return;

    // Filter orders currently in picking
    let pickingOrders = AppState.orders.filter(isOrderPicking);
    const totalCount = pickingOrders.length;

    const q = (cardsSearchQueries["picking"] || "").toLowerCase().trim();
    if (q) {
        pickingOrders = pickingOrders.filter(order => matchCardsSearch(order, q));
    }

    // Update count badge & clear button
    const badge = document.getElementById("cardsPickingCountBadge");
    if (badge) {
        badge.textContent = q ? `${pickingOrders.length} / ${totalCount} Orders` : `${totalCount} Orders`;
    }
    const clearBtn = document.getElementById("clearCardsPickingSearchBtn");
    if (clearBtn) {
        clearBtn.classList.toggle("hidden", !q);
    }

    if (pickingOrders.length === 0) {
        if (totalCount > 0 && q) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <i data-lucide="search-x" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
                    <h4 class="text-slate-700 font-bold text-sm sm:text-base">រកមិនឃើញ Order ដែលត្រូវគ្នានឹង "${escapeHtml(q)}" ឡើយ</h4>
                    <p class="text-xs text-slate-400 mt-1 mb-3">សូមសាកល្បងស្វែងរកដោយ SO#, ឈ្មោះអតិថិជន, ឬ Invoice# ផ្សេងទៀត</p>
                    <button type="button" onclick="clearCardsSearch('picking')" class="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs transition cursor-pointer">
                        សម្អាតការស្វែងរក (Clear Search)
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <i data-lucide="package" class="w-12 h-12 text-slate-300 mx-auto mb-2"></i>
                    <h4 class="text-slate-600 font-semibold">មិនមាន Order កំពុង Picking ទេ</h4>
                    <p class="text-xs text-slate-400 mt-1">Order នឹងមកទីនេះបន្ទាប់ពីចុច "Start Picking" នៅក្នុង Register Order Module</p>
                </div>
            `;
        }
        lucide.createIcons();
        return;
    }

    container.innerHTML = pickingOrders.map(order => {
        return `
            <div class="order-card p-5 rounded-2xl border border-amber-400 bg-amber-50/20 ring-2 ring-amber-400/20 transition-all">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="min-w-0 flex-1">
                        <span class="text-lg font-bold text-slate-900 font-mono break-all sm:break-normal">${escapeHtml(order.soNumber)}</span>
                        <p class="text-sm font-semibold text-blue-700 mt-0.5 line-clamp-2">${escapeHtml(order.customerName)}</p>
                    </div>
                    <div class="flex flex-col items-end gap-1.5 shrink-0">
                        <span class="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-amber-500"></span> In Picking
                        </span>
                        ${renderDocumentTypeBadge(order.documentType)}
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white/80 p-3 rounded-xl border border-slate-100 mb-4">
                    <div><b>Invoice#:</b> ${escapeHtml(order.invoiceNumber || "-")}</div>
                    <div><b>Invoice Amount:</b> <span class="font-semibold text-emerald-700">${order.currency === "USD" ? "$" : "៛"}${Number(order.invoiceAmount || 0).toLocaleString()}</span></div>
                    <div><b>Packing list:</b> ${escapeHtml(order.packingListNumber || "-")}</div>
                    <div><b>Location:</b> ${escapeHtml(order.khan || order.cityProvince || "-")}</div>
                </div>

                <!-- Timestamps Display (Matching Image 2) -->
                <div class="space-y-1.5 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl">
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500">អ្នករៀបចំ (Picker by):</span>
                        <span class="font-semibold text-amber-700">${escapeHtml(order.pickerBy || "-")}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500">ម៉ោងចាប់ផ្ដើម (Start):</span>
                        <span class="font-mono font-medium text-blue-700">${formatDateTimeDisplay(order.pickingStartTime)}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500">ម៉ោងបញ្ចប់ (End):</span>
                        <span class="font-mono font-medium text-slate-400">មិនទាន់បញ្ចប់</span>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-slate-500 whitespace-nowrap">Special Notes:</span>
                        ${order.specialNotes && order.specialNotes.trim() ? `
                            <span class="font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 text-right truncate max-w-[200px]" title="${escapeHtml(order.specialNotes)}">${escapeHtml(order.specialNotes)}</span>
                        ` : `
                            <span class="font-mono font-medium text-slate-400">-</span>
                        `}
                    </div>
                </div>

                <!-- Action Button (Matching Image 2) -->
                <div class="flex items-center gap-2">
                    <button onclick="endPicking('${escapeHtml(order.soNumber)}')" class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2">
                        <i data-lucide="square" class="w-4 h-4 fill-white"></i>
                        <span>End Picking</span>
                    </button>
                </div>
            </div>
        `;
    }).join("");

    lucide.createIcons();
}

// Start Picking Handler
async function startPicking(soNumber) {
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    const curUser = getCurrentUser();
    const pickerName = curUser ? (curUser.displayName || curUser.username) : "Admin";

    const now = formatAppDateTime();
    order.pickingStartTime = now;
    order.pickerBy = pickerName;
    order.status = "In Picking";
    order.lastUpdated = now;

    saveOrdersToStorage();
    renderAll();

    // Auto sync to Google Sheets
    SheetsSync.syncStageUpdate(soNumber, "PICKING_START", now, null, "In Picking", null, { pickerBy: pickerName });

    Swal.fire({
        title: "ចាប់ផ្ដើម Picking! 📦",
        html: `Order <b>${soNumber}</b> បានចាប់ផ្ដើម Picking ដោយ <b>${escapeHtml(pickerName)}</b> និងបញ្ជូនទៅ <b>Physical Picking</b> រួចរាល់។`,
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "ទៅកាន់ Physical Picking",
        cancelButtonText: "នៅទីនេះ",
        confirmButtonColor: "#f59e0b"
    }).then(res => {
        if (res.isConfirmed) switchTab("picking");
    });
}

// End Picking Handler
async function endPicking(soNumber) {
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    const curUser = getCurrentUser();
    const pickerName = order.pickerBy || (curUser ? (curUser.displayName || curUser.username) : "Admin");

    const now = formatAppDateTime();
    order.pickingEndTime = now;
    order.pickingDuration = calculateDuration(order.pickingStartTime, now);
    order.status = "Waiting Checking";
    order.pickerBy = pickerName;
    order.lastUpdated = now;

    saveOrdersToStorage();
    renderAll();

    // Auto sync to Google Sheets
    SheetsSync.syncStageUpdate(soNumber, "PICKING_END", now, order.pickingDuration, "Waiting Checking", null, { pickerBy: pickerName });

    Swal.fire({
        title: "បញ្ចប់ Picking រួចរាល់! 📦",
        html: `SO#: <b>${soNumber}</b><br>អ្នករៀបចំ: <b class="text-blue-700">${escapeHtml(pickerName)}</b><br>រយៈពេល Picking: <b class="text-amber-600">${order.pickingDuration}</b><br>Order ត្រូវបានបញ្ជូនទៅកាន់ <b>Physical Checking</b> (Status: <b>Waiting Checking</b>)។`,
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "ទៅកាន់ Physical Checking",
        cancelButtonText: "នៅទីនេះ",
        confirmButtonColor: "#9333ea"
    }).then(res => {
        if (res.isConfirmed) switchTab("checking");
    });
}

function restartPicking(soNumber) {
    Swal.fire({
        title: "ចាប់ផ្ដើម Picking ឡើងវិញ?",
        text: "តើអ្នកចង់កំណត់ម៉ោង Picking សារជាថ្មីមែនទេ?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "បាទ/ចាស",
        cancelButtonText: "មិនមែនទេ"
    }).then(res => {
        if (res.isConfirmed) {
            const order = AppState.orders.find(o => o.soNumber === soNumber);
            if (order) {
                order.pickingStartTime = "";
                order.pickingEndTime = "";
                order.pickingDuration = "-";
                order.status = "Registered";
                saveOrdersToStorage();
                renderAll();
                showToast(`បាន Reset Picking សម្រាប់ ${soNumber}`, "info");
            }
        }
    });
}

// -------------------------------------------------------------
// MODULE 3: PHYSICAL CHECKING (ការត្រួតពិនិត្យ QC)
// -------------------------------------------------------------
function renderCheckingView() {
    const container = document.getElementById("checkingOrdersContainer");
    if (!container) return;

    // Show orders that have completed picking and are in checking stage
    let checkingOrders = AppState.orders.filter(isOrderChecking);
    const totalCount = checkingOrders.length;

    const q = (cardsSearchQueries["checking"] || "").toLowerCase().trim();
    if (q) {
        checkingOrders = checkingOrders.filter(order => matchCardsSearch(order, q));
    }

    // Update count badge & clear button
    const badge = document.getElementById("cardsCheckingCountBadge");
    if (badge) {
        badge.textContent = q ? `${checkingOrders.length} / ${totalCount} Orders` : `${totalCount} Orders`;
    }
    const clearBtn = document.getElementById("clearCardsCheckingSearchBtn");
    if (clearBtn) {
        clearBtn.classList.toggle("hidden", !q);
    }

    if (checkingOrders.length === 0) {
        if (totalCount > 0 && q) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <i data-lucide="search-x" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
                    <h4 class="text-slate-700 font-bold text-sm sm:text-base">រកមិនឃើញ Order ដែលត្រូវគ្នានឹង "${escapeHtml(q)}" ឡើយ</h4>
                    <p class="text-xs text-slate-400 mt-1 mb-3">សូមសាកល្បងស្វែងរកដោយ SO#, ឈ្មោះអតិថិជន, ឬ Invoice# ផ្សេងទៀត</p>
                    <button type="button" onclick="clearCardsSearch('checking')" class="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition cursor-pointer">
                        សម្អាតការស្វែងរក (Clear Search)
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <i data-lucide="clipboard-check" class="w-12 h-12 text-slate-300 mx-auto mb-2"></i>
                    <h4 class="text-slate-600 font-semibold">មិនមាន Order រង់ចាំ Checking ទេ</h4>
                    <p class="text-xs text-slate-400 mt-1">រាល់ Order ត្រូវបញ្ចប់ Picking ជាមុនសិន</p>
                </div>
            `;
        }
        lucide.createIcons();
        return;
    }

    container.innerHTML = checkingOrders.map(order => {
        const isStarted = !!order.checkingStartTime;
        const isEnded = !!order.checkingEndTime;

        return `
            <div class="order-card p-5 rounded-2xl border ${isStarted ? 'border-purple-400 bg-purple-50/20 ring-2 ring-purple-400/20' : 'border-slate-200 bg-white'} transition-all">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="min-w-0 flex-1">
                        <span class="text-lg font-bold text-slate-900 font-mono break-all sm:break-normal">${escapeHtml(order.soNumber)}</span>
                        <p class="text-sm font-semibold text-blue-700 mt-0.5 line-clamp-2">${escapeHtml(order.customerName)}</p>
                    </div>
                    <div class="flex flex-col items-end gap-1.5 shrink-0">
                        ${isStarted ? `
                            <span class="px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full flex items-center gap-1.5 animate-pulse">
                                <span class="w-2 h-2 rounded-full bg-purple-500"></span> In Checking
                            </span>
                        ` : `
                            <span class="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200 flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full bg-indigo-500"></span> Waiting Checking
                            </span>
                        `}
                        ${renderDocumentTypeBadge(order.documentType)}
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white/80 p-3 rounded-xl border border-slate-100 mb-4">
                    <div><b>ចំនួនកញ្ចប់:</b> ${hasOrderTotalPackage(order) ? `${order.totalPackage} ${escapeHtml(order.packageUnit || "")}` : '<span class="text-slate-400 font-normal">-</span>'}</div>
                    <div><b>Packing List:</b> ${escapeHtml(order.packingListNumber || "-")}</div>
                    <div><b>Invoice#:</b> ${escapeHtml(order.invoiceNumber || "-")}</div>
                    <div><b>Invoice Amount:</b> <span class="font-semibold text-emerald-700">${order.currency === "USD" ? "$" : "៛"}${Number(order.invoiceAmount || 0).toLocaleString()}</span></div>
                </div>

                <!-- Timestamps Display (Matching Image 3) -->
                <div class="space-y-1.5 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl">
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500">អ្នកត្រួតពិនិត្យ (Checker by):</span>
                        <span class="font-semibold text-purple-700">${escapeHtml(order.checkerBy || "-")}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500">ម៉ោងចាប់ផ្ដើម Checking:</span>
                        <span class="font-mono font-medium ${isStarted ? 'text-purple-700' : 'text-slate-400'}">${isStarted ? formatDateTimeDisplay(order.checkingStartTime) : "មិនទាន់ចាប់ផ្ដើម"}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500">ម៉ោងបញ្ចប់ Checking:</span>
                        <span class="font-mono font-medium ${isEnded ? 'text-emerald-700' : 'text-slate-400'}">${isEnded ? formatDateTimeDisplay(order.checkingEndTime) : "មិនទាន់បញ្ចប់"}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-slate-500 whitespace-nowrap">Special Notes:</span>
                        ${order.specialNotes && order.specialNotes.trim() ? `
                            <span class="font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 text-right truncate max-w-[200px]" title="${escapeHtml(order.specialNotes)}">${escapeHtml(order.specialNotes)}</span>
                        ` : `
                            <span class="font-mono font-medium text-slate-400">-</span>
                        `}
                    </div>
                </div>

                <!-- Action Buttons (Matching Image 3) -->
                <div class="flex items-center gap-2">
                    ${!isStarted ? `
                        <button onclick="startChecking('${escapeHtml(order.soNumber)}')" class="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2">
                            <i data-lucide="play" class="w-4 h-4 fill-white"></i>
                            <span>Start Checking</span>
                        </button>
                    ` : `
                        <button onclick="openEndCheckingModal('${escapeHtml(order.soNumber)}')" class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2">
                            <i data-lucide="check-circle" class="w-4 h-4"></i>
                            <span>End Checking</span>
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join("");

    lucide.createIcons();
}

async function startChecking(soNumber) {
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    const curUser = getCurrentUser();
    const checkerName = curUser ? (curUser.displayName || curUser.username) : "Admin";

    const now = formatAppDateTime();
    order.checkingStartTime = now;
    order.checkerBy = checkerName;
    order.status = "In Checking";
    order.lastUpdated = now;

    saveOrdersToStorage();
    renderAll();

    // Auto sync to Google Sheets
    SheetsSync.syncStageUpdate(soNumber, "CHECKING_START", now, null, "In Checking", null, { checkerBy: checkerName });
    showToast(`បានចាប់ផ្ដើម Checking ដោយ ${checkerName} សម្រាប់ ${soNumber}`, "info");
}

function openEndCheckingModal(soNumber) {
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    const modal = document.getElementById("endCheckingModal");
    const soBadge = document.getElementById("endCheckingSOBadge");
    const soInput = document.getElementById("endCheckingSONumber");
    const customerEl = document.getElementById("endCheckingCustomerName");
    const invEl = document.getElementById("endCheckingInvoiceNumber");
    const pkEl = document.getElementById("endCheckingPackingList");
    const checkerEl = document.getElementById("endCheckingCheckerBy");
    const totalPkgInput = document.getElementById("endCheckingTotalPackage");
    const unitSelect = document.getElementById("endCheckingPackageUnit");
    const notesInput = document.getElementById("endCheckingNotes");

    if (soBadge) soBadge.textContent = order.soNumber;
    if (soInput) soInput.value = order.soNumber;
    if (customerEl) customerEl.textContent = order.customerName || "-";
    if (invEl) invEl.textContent = order.invoiceNumber || "-";
    if (pkEl) pkEl.textContent = order.packingListNumber || "-";

    const curUser = getCurrentUser();
    const currentChecker = order.checkerBy || (curUser ? (curUser.displayName || curUser.username) : "Admin");
    if (checkerEl) checkerEl.textContent = currentChecker;

    // Prefill total package quantity (empty if not yet set so checker inputs count)
    if (totalPkgInput) {
        totalPkgInput.value = (order.totalPackage !== undefined && order.totalPackage !== null && order.totalPackage !== "" && Number(order.totalPackage) > 0)
            ? order.totalPackage
            : "";

        if (!totalPkgInput._hasEnterListener) {
            totalPkgInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    confirmEndChecking();
                }
            });
            totalPkgInput._hasEnterListener = true;
        }
    }

    // Populate package units from Setup Master Data
    if (unitSelect) {
        const units = (AppState.setup && AppState.setup.packageTypes && AppState.setup.packageTypes.length > 0)
            ? AppState.setup.packageTypes
            : [
                { name: "Carton", short: "កេស" },
                { name: "Box", short: "ប្រអប់" },
                { name: "Pallet", short: "ប៉ាឡែត" },
                { name: "Pack", short: "កញ្ចប់" },
                { name: "Piece", short: "ដុំ" }
            ];
        unitSelect.innerHTML = units.map(u => {
            const isMatch = (order.packageUnit && order.packageUnit.toLowerCase() === u.name.toLowerCase());
            return `<option value="${escapeHtml(u.name)}" ${isMatch ? "selected" : ""}>${escapeHtml(u.name)}${u.short ? ' (' + escapeHtml(u.short) + ')' : ''}</option>`;
        }).join("");
    }

    if (notesInput) notesInput.value = "";

    if (modal) {
        modal.classList.remove("hidden");
        setTimeout(() => {
            if (totalPkgInput) {
                totalPkgInput.focus();
                totalPkgInput.select();
            }
        }, 120);
    }
    lucide.createIcons();
}

function closeEndCheckingModal() {
    const modal = document.getElementById("endCheckingModal");
    if (modal) modal.classList.add("hidden");
}

function adjustEndCheckingTotalPkg(delta) {
    const input = document.getElementById("endCheckingTotalPackage");
    if (!input) return;
    let val = parseInt(input.value, 10) || 0;
    val += delta;
    if (val < 1) val = 1;
    input.value = val;
}

async function confirmEndChecking() {
    const soInput = document.getElementById("endCheckingSONumber");
    const soNumber = soInput ? soInput.value : "";
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) {
        showToast("រកមិនឃើញ Order នេះទេ!", "error");
        return;
    }

    const totalPkgInput = document.getElementById("endCheckingTotalPackage");
    const rawTotalPkg = totalPkgInput ? parseInt(totalPkgInput.value, 10) : 1;
    if (isNaN(rawTotalPkg) || rawTotalPkg <= 0) {
        showToast("សូមបញ្ចូលចំនួនកញ្ចប់ (Total Package) យ៉ាងតិច 1!", "warning");
        if (totalPkgInput) totalPkgInput.focus();
        return;
    }

    const unitSelect = document.getElementById("endCheckingPackageUnit");
    const selectedUnit = unitSelect ? unitSelect.value : (order.packageUnit || "Carton");

    const notesInput = document.getElementById("endCheckingNotes");
    const qcNotes = notesInput ? notesInput.value.trim() : "";

    // Update order with new total package and unit
    order.totalPackage = rawTotalPkg;
    order.packageUnit = selectedUnit;

    if (qcNotes) {
        if (order.specialNotes) {
            order.specialNotes += ` | [QC]: ${qcNotes}`;
        } else {
            order.specialNotes = `[QC]: ${qcNotes}`;
        }
    }

    const curUser = getCurrentUser();
    const checkerName = order.checkerBy || (curUser ? (curUser.displayName || curUser.username) : "Admin");

    const now = formatAppDateTime();
    order.checkingEndTime = now;
    order.checkingDuration = calculateDuration(order.checkingStartTime, now);
    order.status = "Waiting Delivery";
    order.checkerBy = checkerName;
    order.lastUpdated = now;

    saveOrdersToStorage();
    closeEndCheckingModal();
    renderAll();
    const detailsModal = document.getElementById("orderDetailsModal");
    if (detailsModal && !detailsModal.classList.contains("hidden")) {
        viewOrderDetails(soNumber);
    }

    // Auto sync to Google Sheets
    SheetsSync.syncStageUpdate(soNumber, "CHECKING_END", now, order.checkingDuration, "Waiting Delivery", order.specialNotes, {
        checkerBy: checkerName,
        totalPackage: rawTotalPkg,
        packageUnit: selectedUnit
    });

    Swal.fire({
        title: "ត្រួតពិនិត្យ Checking រួចរាល់! 🔍",
        html: `SO#: <b>${escapeHtml(soNumber)}</b><br>` +
              `ចំនួនកញ្ចប់ (Total Package): <b class="text-emerald-700 font-mono text-base">${rawTotalPkg} ${escapeHtml(selectedUnit)}</b><br>` +
              `អ្នកត្រួតពិនិត្យ: <b class="text-purple-700">${escapeHtml(checkerName)}</b><br>` +
              `រយៈពេល Checking: <b class="text-purple-600">${order.checkingDuration}</b><br><br>` +
              `Order ត្រូវបានបញ្ជូនទៅកាន់ <b>Delivery</b> (Status: <b>Waiting Delivery</b>)។`,
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "ទៅកាន់ Delivery",
        cancelButtonText: "នៅទីនេះ",
        confirmButtonColor: "#0284c7"
    }).then(res => {
        if (res.isConfirmed) switchTab("delivery");
    });
}

async function endChecking(soNumber) {
    openEndCheckingModal(soNumber);
}

// -------------------------------------------------------------
// MODULE 4: DELIVERY TRACKING (ការដឹកជញ្ជូន)
// -------------------------------------------------------------
function renderDeliveryView() {
    const container = document.getElementById("deliveryOrdersContainer");
    if (!container) return;

    // Show orders that completed checking and are currently in active delivery pipeline: Waiting Delivery, In Delivery, 2nd Delivery, 3rd Delivery...
    let deliveryOrders = AppState.orders.filter(isOrderDelivery);
    const totalCount = deliveryOrders.length;

    const q = (cardsSearchQueries["delivery"] || "").toLowerCase().trim();
    if (q) {
        deliveryOrders = deliveryOrders.filter(order => matchCardsSearch(order, q));
    }

    // Update count badge & clear button
    const badge = document.getElementById("cardsDeliveryCountBadge");
    if (badge) {
        badge.textContent = q ? `${deliveryOrders.length} / ${totalCount} Orders` : `${totalCount} Orders`;
    }
    const clearBtn = document.getElementById("clearCardsDeliverySearchBtn");
    if (clearBtn) {
        clearBtn.classList.toggle("hidden", !q);
    }

    if (deliveryOrders.length === 0) {
        if (totalCount > 0 && q) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <i data-lucide="search-x" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
                    <h4 class="text-slate-700 font-bold text-sm sm:text-base">រកមិនឃើញ Order ដែលត្រូវគ្នានឹង "${escapeHtml(q)}" ឡើយ</h4>
                    <p class="text-xs text-slate-400 mt-1 mb-3">សូមសាកល្បងស្វែងរកដោយ SO#, ឈ្មោះអតិថិជន, ឬ Invoice# ផ្សេងទៀត</p>
                    <button type="button" onclick="clearCardsSearch('delivery')" class="px-3.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs transition cursor-pointer">
                        សម្អាតការស្វែងរក (Clear Search)
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <i data-lucide="truck" class="w-12 h-12 text-slate-300 mx-auto mb-2"></i>
                    <h4 class="text-slate-600 font-semibold">មិនមាន Order កំពុងស្ថិតក្នុងការដឹកជញ្ជូនទេ</h4>
                    <p class="text-xs text-slate-400 mt-1">រាល់ Order ដែល End Delivery (Success/Return) ត្រូវបានផ្លាស់ទីទៅកាន់ "បានប្រគល់រួច (Completed)"</p>
                </div>
            `;
        }
        lucide.createIcons();
        return;
    }

    container.innerHTML = deliveryOrders.map(order => {
        const isStarted = !!order.deliveryStartTime;
        const isEnded = !!order.deliveryEndTime;
        const attempts = Number(order.deliveryAttempts) || 1;
        const is2nd = attempts > 1;

        let statusClass = "border-sky-200 bg-white";
        let statusBadge = `<span class="px-2.5 py-1 bg-sky-50 text-sky-800 text-xs font-semibold rounded-full border border-sky-200 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-sky-500"></span> Waiting Delivery
        </span>`;

        if (isStarted && !isEnded) {
            statusClass = "border-sky-400 bg-sky-50/20 ring-2 ring-sky-400/20";
            const deliveryStatusTitle = order.status || getDeliveryStatusName(attempts);
            statusBadge = `<span class="px-2.5 py-1 bg-sky-100 text-sky-900 text-xs font-bold rounded-full border border-sky-300 flex items-center gap-1.5 animate-pulse shadow-2xs">
                <i data-lucide="truck" class="w-3.5 h-3.5 text-sky-700"></i> ${escapeHtml(deliveryStatusTitle)}
            </span>`;
        } else if (isEnded) {
            const raw = (order.status || "").toLowerCase();
            if (raw === "incomplete" || raw.includes("incomplete") || raw.includes("មិនបានជោគជ័យ")) {
                statusClass = "border-amber-300 bg-amber-50/20";
                statusBadge = `<span class="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-300 flex items-center gap-1">
                    <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-amber-600"></i> Incomplete
                </span>`;
            } else if (raw === "return" || raw.includes("return") || raw.includes("ត្រឡប់")) {
                statusClass = "border-rose-300 bg-rose-50/20";
                statusBadge = `<span class="px-2.5 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-full border border-rose-300 flex items-center gap-1">
                    <i data-lucide="rotate-ccw" class="w-3.5 h-3.5 text-rose-600"></i> Return
                </span>`;
            } else {
                statusClass = "border-emerald-300 bg-emerald-50/20";
                const displaySuccess = order.status || getSuccessStatusName(attempts);
                statusBadge = `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-300 flex items-center gap-1">
                    <i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-600"></i> ${escapeHtml(displaySuccess)}
                </span>`;
            }
        }

        return `
            <div class="order-card p-5 rounded-2xl border ${statusClass} transition-all">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-lg font-bold text-slate-900 font-mono break-all sm:break-normal">${escapeHtml(order.soNumber)}</span>
                            <span class="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                                ${order.currency === "USD" ? "$" : "៛"}${Number(order.invoiceAmount || 0).toLocaleString()}
                            </span>
                            ${is2nd ? `
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                ${getOrdinal(order.deliveryAttempts)} Delivery (លើកទី ${order.deliveryAttempts})
                            </span>` : ''}
                        </div>
                        <p class="text-sm font-semibold text-blue-700 mt-0.5 line-clamp-2">${escapeHtml(order.customerName)}</p>
                    </div>
                    <div class="flex flex-col items-end gap-1.5 shrink-0">
                        ${statusBadge}
                        ${renderDocumentTypeBadge(order.documentType)}
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white/80 p-3 rounded-xl border border-slate-100 mb-4">
                    <div><b>ចំនួនកញ្ចប់:</b> ${hasOrderTotalPackage(order) ? `${order.totalPackage} ${escapeHtml(order.packageUnit || "")}` : '<span class="text-slate-400 font-normal">-</span>'}</div>
                    <div><b>Invoice#:</b> ${escapeHtml(order.invoiceNumber || "-")}</div>
                    <div class="col-span-2 flex items-center gap-1.5 text-slate-700 pt-1.5 border-t border-slate-100/80">
                        <i data-lucide="map-pin" class="w-3.5 h-3.5 text-red-500 shrink-0"></i>
                        <b>ទិសដៅ:</b> <span>${escapeHtml(order.khan || "-")}, ${escapeHtml(order.cityProvince || "-")}</span>
                    </div>
                </div>

                <!-- Timestamps Display -->
                <div class="space-y-1.5 text-xs text-slate-600 mb-3 bg-slate-50 p-3 rounded-xl">
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500">អ្នកដឹកជញ្ជូន (Delivery by):</span>
                        <span class="font-semibold text-sky-700">${escapeHtml(order.deliveryBy || "-")}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500">ចេញដំណើរ (Start Delivery):</span>
                        <span class="font-mono font-medium ${isStarted ? 'text-sky-700' : 'text-slate-400'}">${isStarted ? formatDateTimeDisplay(order.deliveryStartTime) : "មិនទាន់ចេញដំណើរ"}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500">ដល់ទីតាំង (End Delivery):</span>
                        <span class="font-mono font-medium ${isEnded ? 'text-emerald-700' : 'text-slate-400'}">${isEnded ? formatDateTimeDisplay(order.deliveryEndTime) : "មិនទាន់ដល់"}</span>
                    </div>
                    ${isEnded ? `
                    <div class="flex items-center justify-between pt-1 border-t border-slate-200">
                        <span class="text-slate-600 font-semibold">រយៈពេលដឹកជញ្ជូន:</span>
                        <span class="font-bold text-emerald-700 font-mono">${order.deliveryDuration || "-"}</span>
                    </div>` : ''}
                </div>

                <!-- Special Notes Display (Pure order note only) -->
                ${order.specialNotes && order.specialNotes.trim() ? `
                <div class="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/90 text-xs text-amber-950 mb-2 flex items-start gap-1.5 shadow-2xs">
                    <i data-lucide="alert-circle" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"></i>
                    <div class="flex-1 min-w-0">
                        <span class="font-bold text-amber-900">Special Notes:</span>
                        <span class="font-medium text-amber-950 ml-1 break-words">${escapeHtml(order.specialNotes)}</span>
                    </div>
                </div>` : ''}

                <!-- Dedicated 2nd / 3rd Delivery Notes Box -->
                ${order.deliveryNotes && order.deliveryNotes.trim() ? `
                <div class="p-2.5 rounded-xl bg-sky-50/80 border border-sky-200/90 text-xs text-sky-950 mb-3 shadow-2xs">
                    <div class="flex items-center justify-between mb-1.5">
                        <div class="flex items-center gap-1.5 font-bold text-sky-900">
                            <i data-lucide="truck" class="w-4 h-4 text-sky-600"></i>
                            <span>${(Number(order.deliveryAttempts) || 1) >= 2 ? '2nd / 3rd Delivery Notes:' : 'Delivery Notes:'}</span>
                        </div>
                        <span class="text-[10px] font-mono px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded-md font-semibold">Attempt ${(Number(order.deliveryAttempts) || 1)}</span>
                    </div>
                    <div class="space-y-1">
                        ${renderDeliveryNotesItems(order.deliveryNotes)}
                    </div>
                </div>` : ''}

                <!-- Action Buttons -->
                <div class="flex items-center gap-2">
                    ${!isStarted ? `
                        <button onclick="startDelivery('${escapeHtml(order.soNumber)}')" class="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2">
                            <i data-lucide="navigation" class="w-4 h-4"></i>
                            <span>Start Delivery</span>
                        </button>
                    ` : !isEnded ? `
                        <button onclick="openEndDeliveryModal('${escapeHtml(order.soNumber)}')" class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2">
                            <i data-lucide="check-circle" class="w-4 h-4"></i>
                            <span>End Delivery</span>
                        </button>
                    ` : `
                        <div class="w-full py-2 px-3 rounded-xl bg-slate-100 text-slate-700 text-center text-xs font-semibold flex items-center justify-center gap-1.5">
                            <i data-lucide="award" class="w-4 h-4 text-emerald-600"></i>
                            <span>ដំណើរការបានបញ្ចប់ (${escapeHtml(order.status || "Completed")})</span>
                        </div>
                    `}
                </div>
            </div>
        `;
    }).join("");

    lucide.createIcons();
}

async function startDelivery(soNumber) {
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    const curUser = getCurrentUser();
    const deliveryName = curUser ? (curUser.displayName || curUser.username) : "Admin";

    const now = formatAppDateTime();
    order.deliveryStartTime = now;
    order.deliveryEndTime = "";
    order.deliveryDuration = "-";
    order.deliveryBy = deliveryName;
    order.completedFromDailyDelivery = false;
    unmarkOrderCompletedFromDaily(soNumber);
    const att = Number(order.deliveryAttempts) || 1;
    const deliveryStatus = getDeliveryStatusName(att);
    order.status = deliveryStatus;
    order.lastUpdated = now;

    saveOrdersToStorage();
    renderAll();

    // Auto sync to Google Sheets
    SheetsSync.syncStageUpdate(soNumber, "DELIVERY_START", now, null, deliveryStatus, null, { deliveryBy: deliveryName, deliveryAttempts: att });
    showToast(`ឡានបានចេញដំណើរដឹក ${soNumber} (${deliveryStatus}) ដោយ ${deliveryName}`, "info");

    // Telegram Notification: Queue Start Delivery (buffers multiple started orders into 1 Telegram report)
    if (window.TelegramNotify && typeof window.TelegramNotify.queueDeliveryStart === "function") {
        window.TelegramNotify.queueDeliveryStart(order, deliveryName);
    }
}

async function batchStartWaitingDeliveryOrders() {
    if (!hasUserPermission("delivery")) {
        showToast("លោកអ្នកគ្មានសិទ្ធិដំណើរការ Delivery ឡើយ! ⛔", "warning");
        return;
    }

    const waitingOrders = AppState.orders.filter(o => isOrderDelivery(o) && !o.deliveryStartTime);
    if (waitingOrders.length === 0) {
        showToast("មិនមាន Order ណាមួយកំពុងរង់ចាំ Start Delivery ឡើយ!", "info");
        return;
    }

    const curUser = getCurrentUser();
    const deliveryName = curUser ? (curUser.displayName || curUser.username) : "Admin";

    const listPreview = waitingOrders.map((o, idx) => `
        <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100">
            <span class="font-bold text-sky-800">${idx + 1}. ${escapeHtml(o.soNumber)}</span>
            <span class="text-slate-600 truncate max-w-[200px] text-right">${escapeHtml(o.customerName || "-")}</span>
        </div>
    `).join("");

    const confirmRes = await Swal.fire({
        title: `ចាប់ផ្ដើមដឹក (Start Delivery) ${waitingOrders.length} Orders? 🚚`,
        html: `
            <p class="text-xs text-slate-600 mb-2">តើលោកអ្នកចង់ចុច Start Delivery លើចំនួន <b>${waitingOrders.length} Orders</b> នេះក្នុងពេលតែមួយមែនទេ?</p>
            <div class="max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-0.5">
                ${listPreview}
            </div>
            <p class="text-[11px] text-sky-700 font-semibold mt-2">✨ ប្រព័ន្ធនឹងបញ្ជូន Report រួមគ្នានៃ Orders ទាំង ${waitingOrders.length} នេះទៅ Telegram ស្វ័យប្រវត្តិ!</p>
        `,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: `Start ${waitingOrders.length} Orders ឥឡូវ`,
        cancelButtonText: "បោះបង់",
        confirmButtonColor: "#0284c7",
        cancelButtonColor: "#64748b"
    });

    if (!confirmRes.isConfirmed) return;

    const now = formatAppDateTime();
    waitingOrders.forEach(order => {
        order.deliveryStartTime = now;
        order.deliveryEndTime = "";
        order.deliveryDuration = "-";
        order.deliveryBy = deliveryName;
        order.completedFromDailyDelivery = false;
        unmarkOrderCompletedFromDaily(order.soNumber);
        const att = Number(order.deliveryAttempts) || 1;
        const deliveryStatus = getDeliveryStatusName(att);
        order.status = deliveryStatus;
        order.lastUpdated = now;

        SheetsSync.syncStageUpdate(order.soNumber, "DELIVERY_START", now, null, deliveryStatus, null, { deliveryBy: deliveryName, deliveryAttempts: att });

        if (window.TelegramNotify && typeof window.TelegramNotify.queueDeliveryStart === "function") {
            window.TelegramNotify.queueDeliveryStart(order, deliveryName);
        }
    });

    saveOrdersToStorage();
    renderAll(true);

    if (window.TelegramNotify && typeof window.TelegramNotify.flushStartDeliveryQueue === "function") {
        window.TelegramNotify.flushStartDeliveryQueue();
    }

    Swal.fire({
        title: "ចាប់ផ្ដើមដឹកជោគជ័យ! 🚚🎉",
        text: `បានចុច Start Delivery លើ ${waitingOrders.length} Orders ដោយជោគជ័យ និងបានបញ្ជូន Report ទៅ Telegram រួចរាល់!`,
        icon: "success",
        confirmButtonText: "យល់ព្រម",
        confirmButtonColor: "#0284c7"
    });
}
window.batchStartWaitingDeliveryOrders = batchStartWaitingDeliveryOrders;

function openEndDeliveryModal(soNumber) {
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    const modal = document.getElementById("endDeliveryModal");
    const soBadge = document.getElementById("endDeliverySOBadge");
    const soInput = document.getElementById("endDeliverySONumber");
    const notesInput = document.getElementById("endDeliveryNotes");

    if (soBadge) soBadge.textContent = order.soNumber;
    if (soInput) soInput.value = order.soNumber;
    if (notesInput) notesInput.value = "";

    // Dynamic success title based on delivery attempt: 1st -> Success, 2nd -> 2nd Success, 3rd -> 3rd Success...
    const attempts = Number(order.deliveryAttempts) || 1;
    const successTitleEl = document.getElementById("endDeliverySuccessTitle");
    const successBadgeEl = document.getElementById("endDeliverySuccessBadge");
    const successName = getSuccessStatusName(attempts);
    if (successTitleEl) {
        if (attempts > 1) {
            successTitleEl.textContent = `${successName} (បានប្រគល់ជោគជ័យលើកទី ${attempts})`;
        } else {
            successTitleEl.textContent = "Success (បានប្រគល់ជោគជ័យ)";
        }
    }
    if (successBadgeEl) {
        successBadgeEl.textContent = attempts > 1 ? successName : "ជោគជ័យ";
    }

    // Setup Payment Receipt UI with order currencies and existing values
    const accCurr = order.paymentAccountCurrency || (order.paymentReceipt && order.paymentReceipt.includes("៛") ? "KHR" : (order.currency || "USD"));
    const cashCurr = order.paymentCashCurrency || (order.paymentReceipt && order.paymentReceipt.includes("៛") ? "KHR" : (order.currency || "USD"));

    const selAccCurr = document.getElementById("currencyPaymentAccount");
    const selCashCurr = document.getElementById("currencyPaymentCash");
    if (selAccCurr) selAccCurr.value = (accCurr === "KHR") ? "KHR" : "USD";
    if (selCashCurr) selCashCurr.value = (cashCurr === "KHR") ? "KHR" : "USD";
    onPaymentCurrencyChange("account");
    onPaymentCurrencyChange("cash");

    const chkAcc = document.getElementById("chkPaymentAccount");
    const chkCash = document.getElementById("chkPaymentCash");
    const amtAcc = document.getElementById("amountPaymentAccount");
    const amtCash = document.getElementById("amountPaymentCash");
    const grpAcc = document.getElementById("inputGroupPaymentAccount");
    const grpCash = document.getElementById("inputGroupPaymentCash");
    const cardAcc = document.getElementById("cardPaymentAccount");
    const cardCash = document.getElementById("cardPaymentCash");

    const hasAcc = (order.paymentReceiptType === "Paid to Company Account" || order.paymentReceiptType === "Paid to Company Account & Cash" || (Number(order.paymentAccountAmount) > 0));
    const hasCash = (order.paymentReceiptType === "Cash" || order.paymentReceiptType === "Paid to Company Account & Cash" || (Number(order.paymentCashAmount) > 0));

    if (chkAcc) {
        chkAcc.checked = hasAcc;
        if (hasAcc) {
            if (grpAcc) grpAcc.classList.remove("hidden");
            if (cardAcc) cardAcc.className = "p-3 rounded-xl border-2 border-blue-500 bg-blue-50/30 transition-all";
            if (amtAcc) amtAcc.value = Number(order.paymentAccountAmount) || Number(order.paymentReceiptAmount) || (Number(order.invoiceAmount) || "");
        } else {
            if (grpAcc) grpAcc.classList.add("hidden");
            if (cardAcc) cardAcc.className = "p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all";
            if (amtAcc) amtAcc.value = "";
        }
    }

    if (chkCash) {
        chkCash.checked = hasCash;
        if (hasCash) {
            if (grpCash) grpCash.classList.remove("hidden");
            if (cardCash) cardCash.className = "p-3 rounded-xl border-2 border-emerald-500 bg-emerald-50/30 transition-all";
            if (amtCash) amtCash.value = Number(order.paymentCashAmount) || (Number(order.invoiceAmount) || "");
        } else {
            if (grpCash) grpCash.classList.add("hidden");
            if (cardCash) cardCash.className = "p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition-all";
            if (amtCash) amtCash.value = "";
        }
    }

    // Reset radio to Success
    const defaultRadio = document.querySelector("input[name='deliveryFinalStatus'][value='Success']") ||
                         document.querySelector("input[name='deliveryFinalStatus'][value='Delivered']");
    if (defaultRadio) {
        defaultRadio.checked = true;
    }
    updateDeliveryOptionStyles("Success");

    if (modal) modal.classList.remove("hidden");
    lucide.createIcons();
}

function closeEndDeliveryModal() {
    const modal = document.getElementById("endDeliveryModal");
    if (modal) modal.classList.add("hidden");
}

function updateDeliveryOptionStyles(selectedStatus) {
    const optSuccess = document.getElementById("optSuccessLabel");
    const optIncomplete = document.getElementById("optIncompleteLabel");
    const optReturn = document.getElementById("optReturnLabel");

    const isSuccess = (selectedStatus === "Success" || selectedStatus === "Delivered");
    const isIncomplete = (selectedStatus === "Incomplete");
    const isReturn = (selectedStatus === "Return");

    if (optSuccess) {
        if (isSuccess) {
            optSuccess.className = "delivery-status-option flex items-start gap-3 p-3.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 cursor-pointer transition-all select-none";
        } else {
            optSuccess.className = "delivery-status-option flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white cursor-pointer hover:bg-emerald-50/30 transition-all select-none";
        }
    }

    if (optIncomplete) {
        if (isIncomplete) {
            optIncomplete.className = "delivery-status-option flex items-start gap-3 p-3.5 rounded-2xl border-2 border-amber-500 bg-amber-50/50 cursor-pointer transition-all select-none";
        } else {
            optIncomplete.className = "delivery-status-option flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white cursor-pointer hover:bg-amber-50/30 transition-all select-none";
        }
    }

    if (optReturn) {
        if (isReturn) {
            optReturn.className = "delivery-status-option flex items-start gap-3 p-3.5 rounded-2xl border-2 border-rose-500 bg-rose-50/50 cursor-pointer transition-all select-none";
        } else {
            optReturn.className = "delivery-status-option flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white cursor-pointer hover:bg-rose-50/30 transition-all select-none";
        }
    }
}

function endDelivery(soNumber) {
    openEndDeliveryModal(soNumber);
}

async function confirmEndDelivery() {
    const soInput = document.getElementById("endDeliverySONumber");
    const soNumber = soInput ? soInput.value : "";
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    const selectedRadio = document.querySelector("input[name='deliveryFinalStatus']:checked");
    let statusVal = selectedRadio ? selectedRadio.value : "Success";
    if (statusVal === "Delivered") statusVal = "Success";

    // Dynamic success status based on delivery attempts:
    // 1st delivery -> "Success"
    // 2nd delivery -> "2nd Success"
    // 3rd delivery -> "3rd Success"
    // Nth delivery -> "Nth Success"
    if (statusVal === "Success") {
        const attempts = Number(order.deliveryAttempts) || 1;
        statusVal = getSuccessStatusName(attempts);
    }

    const notes = document.getElementById("endDeliveryNotes")?.value.trim() || "";

    // Payment Receipt handling (Paid to Company Account & Cash)
    const chkAcc = document.getElementById("chkPaymentAccount");
    const chkCash = document.getElementById("chkPaymentCash");
    const amtAccEl = document.getElementById("amountPaymentAccount");
    const amtCashEl = document.getElementById("amountPaymentCash");

    let isAccChecked = Boolean(chkAcc && chkAcc.checked);
    let isCashChecked = Boolean(chkCash && chkCash.checked);
    let accAmt = isAccChecked ? (parseFloat(amtAccEl?.value) || 0) : 0;
    let cashAmt = isCashChecked ? (parseFloat(amtCashEl?.value) || 0) : 0;

    if (isAccChecked && accAmt <= 0) {
        showToast("សូមបញ្ចូលចំនួនទឹកប្រាក់សម្រាប់ Paid to Company Account!", "warning");
        if (amtAccEl) amtAccEl.focus();
        return;
    }
    if (isCashChecked && cashAmt <= 0) {
        showToast("សូមបញ្ចូលចំនួនទឹកប្រាក់សម្រាប់ Cash!", "warning");
        if (amtCashEl) amtCashEl.focus();
        return;
    }

    const selAccCurr = document.getElementById("currencyPaymentAccount");
    const selCashCurr = document.getElementById("currencyPaymentCash");
    const accCurr = selAccCurr ? selAccCurr.value : "USD";
    const cashCurr = selCashCurr ? selCashCurr.value : "USD";
    const accSym = (accCurr === "KHR") ? "៛" : "$";
    const cashSym = (cashCurr === "KHR") ? "៛" : "$";

    let paymentType = "";
    let paymentReceiptStr = "";

    if (isAccChecked && isCashChecked) {
        paymentType = "Paid to Company Account & Cash";
        paymentReceiptStr = `Company Account: ${accSym}${accAmt.toLocaleString()} | Cash: ${cashSym}${cashAmt.toLocaleString()}`;
    } else if (isAccChecked) {
        paymentType = "Paid to Company Account";
        paymentReceiptStr = `Paid to Company Account (${accSym}${accAmt.toLocaleString()})`;
    } else if (isCashChecked) {
        paymentType = "Cash";
        paymentReceiptStr = `Cash (${cashSym}${cashAmt.toLocaleString()})`;
    }

    order.paymentReceiptType = paymentType;
    order.paymentAccountAmount = accAmt;
    order.paymentCashAmount = cashAmt;
    order.paymentAccountCurrency = accCurr;
    order.paymentCashCurrency = cashCurr;
    order.paymentReceiptCurrency = (isAccChecked && !isCashChecked) ? accCurr : (isCashChecked && !isAccChecked ? cashCurr : (accCurr === cashCurr ? accCurr : "MIXED"));
    order.paymentReceiptAmount = accAmt + cashAmt;
    order.paymentReceipt = paymentReceiptStr;

    const curUser = getCurrentUser();
    const deliveryName = order.deliveryBy || (curUser ? (curUser.displayName || curUser.username) : "Admin");

    const now = formatAppDateTime();
    order.deliveryEndTime = now;
    order.deliveryDuration = calculateDuration(order.deliveryStartTime, now);
    order.status = statusVal;
    order.deliveryBy = deliveryName;
    order.completedFromDailyDelivery = true;
    markOrderCompletedFromDaily(soNumber);
    if (notes) {
        const attNum = Number(order.deliveryAttempts) || 1;
        const attLabel = attNum > 1 ? ` (${getOrdinal(attNum)} Delivery)` : "";
        const deliveryLog = `[Delivery ${statusVal}${attLabel}]: ${notes}`;
        order.deliveryNotes = order.deliveryNotes ? `${order.deliveryNotes}\n${deliveryLog}` : deliveryLog;
    }

    saveOrdersToStorage();
    renderAll(true);
    if (typeof renderDashboardTable === "function") renderDashboardTable();
    if (typeof renderReportView === "function") renderReportView();
    closeEndDeliveryModal();
    const detailsModal = document.getElementById("orderDetailsModal");
    if (detailsModal && !detailsModal.classList.contains("hidden")) {
        viewOrderDetails(soNumber);
    }

    // Auto sync to Google Sheets
    SheetsSync.syncStageUpdate(soNumber, "DELIVERY_END", now, order.deliveryDuration, statusVal, order.specialNotes, {
        deliveryBy: deliveryName,
        deliveryAttempts: order.deliveryAttempts,
        deliveryNotes: order.deliveryNotes,
        paymentReceipt: order.paymentReceipt,
        paymentReceiptType: order.paymentReceiptType,
        paymentReceiptAmount: order.paymentReceiptAmount,
        paymentAccountAmount: order.paymentAccountAmount,
        paymentCashAmount: order.paymentCashAmount,
        paymentAccountCurrency: order.paymentAccountCurrency,
        paymentCashCurrency: order.paymentCashCurrency
    });

    // Telegram Notification: Alert End Delivery immediately
    if (window.TelegramNotify && typeof window.TelegramNotify.sendDeliveryEndReport === "function") {
        window.TelegramNotify.sendDeliveryEndReport(order, statusVal, order.deliveryDuration, notes);
    }

    const isSuccess = (statusVal === "Success" || statusVal.endsWith("Success") || statusVal === "Delivered");

    if (isSuccess && typeof confetti === "function") {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
    }

    if (statusVal === "Incomplete") {
        const nextAttempt = (Number(order.deliveryAttempts) || 1) + 1;
        Swal.fire({
            title: "ស្ថានភាព: មិនបានជោគជ័យ (Incomplete) ⚠️",
            html: `SO#: <b>${soNumber}</b><br>អតិថិជន: <b>${escapeHtml(order.customerName)}</b><br>ស្ថានភាពចុងក្រោយ: <b class="text-amber-600">Incomplete</b><br>រយៈពេលដឹកជញ្ជូន: <b class="text-slate-700">${order.deliveryDuration}</b><br><br>Order នេះត្រូវបានផ្លាស់ទីទៅកាន់ <b>In Completed Delivery</b> រួចរាល់។<br><span class="text-xs text-slate-500">លោកអ្នកអាចចុច "Start ${getOrdinal(nextAttempt)} Delivery" នៅក្នុង In Completed Delivery ដើម្បីដឹកជញ្ជូនម្ដងទៀត។</span>`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "ទៅកាន់ In Completed Delivery",
            cancelButtonText: "នៅទីនេះ",
            confirmButtonColor: "#f59e0b",
            cancelButtonColor: "#64748b"
        }).then(res => {
            if (res.isConfirmed) {
                openModuleCards("incompleted-delivery");
            }
        });
        return;
    }

    const titleText = isSuccess ? (statusVal === "Success" ? "ការដឹកជញ្ជូនបានជោគជ័យ! 🚚✨" : `ការដឹកជញ្ជូន (${statusVal}) បានជោគជ័យ! 🚚✨`) :
                      "ស្ថានភាព: ត្រឡប់មកវិញ (Return) ↩️";

    const iconType = isSuccess ? "success" : "error";

    Swal.fire({
        title: titleText,
        html: `SO#: <b>${soNumber}</b><br>អតិថិជន: <b>${escapeHtml(order.customerName)}</b><br>ស្ថានភាពចុងក្រោយ: <b class="text-emerald-700 font-bold">${statusVal}</b><br>រយៈពេលដឹកជញ្ជូន: <b class="text-slate-700">${order.deliveryDuration}</b><br>${order.paymentReceipt ? `បង្កាន់ដៃទូទាត់ (Payment): <b class="text-indigo-700">${escapeHtml(order.paymentReceipt)}</b><br>` : ''}ទិន្នន័យបាន Auto-Update ទៅ Google Sheet។`,
        icon: iconType,
        confirmButtonText: "រួចរាល់",
        confirmButtonColor: isSuccess ? "#10b981" : "#ef4444"
    });
}

// -------------------------------------------------------------
// MODULE 5: IN COMPLETED DELIVERY (មិនបានជោគជ័យ - ត្រៀមដឹកជញ្ជូនលើកទី ២)
// -------------------------------------------------------------
function renderIncompletedDeliveryView() {
    const container = document.getElementById("incompletedDeliveryOrdersContainer");
    if (!container) return;

    let incompletedOrders = AppState.orders.filter(isOrderIncompletedDelivery);
    const totalCount = incompletedOrders.length;

    const q = (cardsSearchQueries["incompleted-delivery"] || "").toLowerCase().trim();
    if (q) {
        incompletedOrders = incompletedOrders.filter(order => matchCardsSearch(order, q));
    }

    // Update count badge & clear button
    const badge = document.getElementById("cardsIncompletedCountBadge");
    if (badge) {
        badge.textContent = q ? `${incompletedOrders.length} / ${totalCount} Orders` : `${totalCount} Orders`;
    }
    const clearBtn = document.getElementById("clearCardsIncompletedSearchBtn");
    if (clearBtn) {
        clearBtn.classList.toggle("hidden", !q);
    }

    if (incompletedOrders.length === 0) {
        if (totalCount > 0 && q) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <i data-lucide="search-x" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
                    <h4 class="text-slate-700 font-bold text-sm sm:text-base">រកមិនឃើញ Order ដែលត្រូវគ្នានឹង "${escapeHtml(q)}" ឡើយ</h4>
                    <p class="text-xs text-slate-400 mt-1 mb-3">សូមសាកល្បងស្វែងរកដោយ SO#, ឈ្មោះអតិថិជន, ឬ Invoice# ផ្សេងទៀត</p>
                    <button type="button" onclick="clearCardsSearch('incompleted-delivery')" class="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs transition cursor-pointer">
                        សម្អាតការស្វែងរក (Clear Search)
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <div class="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                        <i data-lucide="truck" class="w-8 h-8"></i>
                    </div>
                    <h4 class="text-slate-700 font-bold text-base">មិនមាន Order ដឹកមិនបានជោគជ័យ (Incomplete) ទេ 🎉</h4>
                    <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto">រាល់ Order ដែលពេល End Delivery ជ្រើសរើសយក "Incomplete (មិនបានជោគជ័យ)" នឹងត្រូវ Move មកទីនេះ ដើម្បីអាចចុច "Start 2nd Delivery" ដឹកម្ដងទៀតបាន</p>
                </div>
            `;
        }
        lucide.createIcons();
        return;
    }

    container.innerHTML = incompletedOrders.map(order => {
        const attempts = Number(order.deliveryAttempts) || 1;
        const nextAttempt = attempts + 1;

        return `
            <div class="order-card p-5 rounded-2xl border-2 border-amber-300 bg-amber-50/20 transition-all shadow-xs hover:shadow-md">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-lg font-bold text-slate-900 font-mono break-all sm:break-normal">${escapeHtml(order.soNumber)}</span>
                            <span class="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                                ${order.currency === "USD" ? "$" : "៛"}${Number(order.invoiceAmount || 0).toLocaleString()}
                            </span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                ដឹកលើកទី ${attempts}
                            </span>
                        </div>
                        <p class="text-sm font-semibold text-blue-700 mt-0.5 line-clamp-2">${escapeHtml(order.customerName)}</p>
                    </div>
                    <div class="flex flex-col items-end gap-1.5 shrink-0">
                        <span class="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-300 flex items-center gap-1 shadow-2xs">
                            <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-amber-600"></i> Incomplete
                        </span>
                        ${renderDocumentTypeBadge(order.documentType)}
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white/90 p-3 rounded-xl border border-amber-100 mb-3 shadow-2xs">
                    <div><b>ចំនួនកញ្ចប់:</b> ${hasOrderTotalPackage(order) ? `${order.totalPackage} ${escapeHtml(order.packageUnit || "")}` : '<span class="text-slate-400 font-normal">-</span>'}</div>
                    <div><b>Invoice#:</b> ${escapeHtml(order.invoiceNumber || "-")}</div>
                    <div><b>Packing List:</b> ${escapeHtml(order.packingListNumber || "-")}</div>
                    <div><b>Location:</b> ${escapeHtml(order.khan || order.cityProvince || "-")}</div>
                </div>

                <!-- Previous Delivery Timestamps & Info -->
                <div class="space-y-1.5 text-xs text-slate-600 mb-3 bg-white/80 p-3 rounded-xl border border-slate-100">
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500">អ្នកដឹកជញ្ជូនលើកមុន:</span>
                        <span class="font-semibold text-slate-800">${escapeHtml(order.deliveryBy || "-")}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500">ម៉ោងបញ្ចប់លើកមុន:</span>
                        <span class="font-mono font-medium text-amber-700">${formatDateTimeDisplay(order.deliveryEndTime) || "-"}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500">រយៈពេលដឹកលើកមុន:</span>
                        <span class="font-bold text-slate-700 font-mono">${order.deliveryDuration || "-"}</span>
                    </div>
                </div>

                <!-- Pure Special Notes Display -->
                ${order.specialNotes && order.specialNotes.trim() ? `
                <div class="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/90 text-xs text-amber-950 mb-2 flex items-start gap-1.5 shadow-2xs">
                    <i data-lucide="alert-circle" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"></i>
                    <div class="flex-1 min-w-0">
                        <span class="font-bold text-amber-900">Special Notes:</span>
                        <span class="font-medium text-amber-950 ml-1 break-words">${escapeHtml(order.specialNotes)}</span>
                    </div>
                </div>` : ''}

                <!-- Dedicated 2nd / 3rd Delivery Notes (មូលហេតុមិនជោគជ័យ) -->
                ${order.deliveryNotes && order.deliveryNotes.trim() ? `
                <div class="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200/90 text-xs text-rose-950 mb-4 shadow-2xs">
                    <div class="flex items-center justify-between mb-1.5">
                        <div class="flex items-center gap-1.5 font-bold text-rose-900">
                            <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600"></i>
                            <span>2nd / 3rd Delivery Notes (មូលហេតុដឹកមិនជោគជ័យ):</span>
                        </div>
                        <span class="text-[10px] font-mono px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-md font-semibold">Attempt ${(Number(order.deliveryAttempts) || 1)}</span>
                    </div>
                    <div class="space-y-1">
                        ${renderDeliveryNotesItems(order.deliveryNotes)}
                    </div>
                </div>` : ''}

                <!-- Action Button: Start 2nd / 3rd Delivery -->
                <div class="flex items-center gap-2">
                    <button onclick="startSecondDelivery('${escapeHtml(order.soNumber)}')" class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2">
                        <i data-lucide="navigation" class="w-4 h-4"></i>
                        <span>Start ${getOrdinal(nextAttempt)} Delivery (ដឹកជញ្ជូនលើកទី ${nextAttempt})</span>
                    </button>
                </div>
            </div>
        `;
    }).join("");

    lucide.createIcons();
}

async function startSecondDelivery(soNumber) {
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    const curUser = getCurrentUser();
    const deliveryName = curUser ? (curUser.displayName || curUser.username) : "Admin";
    const nextAttempt = (Number(order.deliveryAttempts) || 1) + 1;
    const nextAttemptName = getOrdinal(nextAttempt);

    const confirmRes = await Swal.fire({
        title: `ចាប់ផ្ដើមដឹកលើកទី ${nextAttempt}? 🚚`,
        html: `Order: <b class="font-mono text-blue-700">${escapeHtml(order.soNumber)}</b><br>អតិថិជន: <b>${escapeHtml(order.customerName)}</b><br><br>តើអ្នកពិតជាចង់ចាប់ផ្ដើម <b>Start ${nextAttemptName} Delivery</b> មែនទេ?<br><span class="text-xs text-slate-500">Order នេះនឹងត្រូវរត់ត្រឡប់ចូលទៅកាន់ <b>Delivery</b> វិញជាមួយស្ថានភាព <b>"${nextAttemptName} Delivery"</b>។</span>`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: `បាទ/ចាស ចាប់ផ្ដើមលើកទី ${nextAttempt}`,
        cancelButtonText: "បោះបង់",
        confirmButtonColor: "#f59e0b",
        cancelButtonColor: "#64748b"
    });

    if (!confirmRes.isConfirmed) return;

    const now = formatAppDateTime();
    order.deliveryAttempts = nextAttempt;
    order.deliveryStartTime = now;
    order.deliveryEndTime = "";
    order.deliveryDuration = "-";
    const nextStatus = getDeliveryStatusName(nextAttempt);
    order.status = nextStatus;
    order.deliveryBy = deliveryName;
    order.completedFromDailyDelivery = false;
    unmarkOrderCompletedFromDaily(soNumber);
    order.lastUpdated = now;

    const noteAdd = `[Start ${nextAttemptName} Delivery by ${deliveryName} at ${now}]`;
    order.deliveryNotes = order.deliveryNotes ? `${order.deliveryNotes}\n${noteAdd}` : noteAdd;

    saveOrdersToStorage();
    renderAll();

    // Auto sync to Google Sheets
    SheetsSync.syncStageUpdate(soNumber, "DELIVERY_START", now, null, nextStatus, order.specialNotes, {
        deliveryBy: deliveryName,
        deliveryAttempts: order.deliveryAttempts,
        deliveryNotes: order.deliveryNotes
    });

    // Telegram Notification: Queue Start Delivery
    if (window.TelegramNotify && typeof window.TelegramNotify.queueDeliveryStart === "function") {
        window.TelegramNotify.queueDeliveryStart(order, deliveryName);
    }

    Swal.fire({
        title: `បានចាប់ផ្ដើមដឹកលើកទី ${nextAttempt} (${nextStatus})! 🚀`,
        html: `Order <b class="font-mono text-blue-700">${escapeHtml(order.soNumber)}</b> បានរត់ត្រឡប់ចូលទៅកាន់ <b>Delivery</b> ជាមួយស្ថានភាព <b>"${nextStatus}"</b> (លើកទី ${nextAttempt}) រួចរាល់។`,
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "ទៅកាន់ Delivery ឥឡូវ",
        cancelButtonText: "នៅទីនេះ",
        confirmButtonColor: "#0284c7",
        cancelButtonColor: "#64748b"
    }).then(res => {
        if (res.isConfirmed) {
            openModuleCards("delivery");
        }
    });
}

// ========================================================
// DAILY DELIVERY MODULE ENGINE (ការដឹកជញ្ជូនប្រចាំថ្ងៃ)
// Recent Order (កំពុងដឹក) | Completed Order (បានបញ្ចប់)
// ========================================================

// ========================================================
// DAILY DELIVERY PERSONAL DISPLAY (ជួរឈរផ្ទាល់ខ្លួនតាមតារាងនីមួយៗ)
// Table 1: Recent Order (13 Columns)
// Table 2: Completed Order (15 Columns)
// ========================================================

// Table 1: Recent Order Columns (13 Columns)
const DAILY_T1_COLUMNS = [
    { key: "status", label: "Status" },
    { key: "soDate", label: "SO Date" },
    { key: "soNumber", label: "SO#" },
    { key: "customerName", label: "Customer Name" },
    { key: "cityProvince", label: "City / Province" },
    { key: "khan", label: "Khan / District" },
    { key: "packingList", label: "Packing List#" },
    { key: "invoiceNumber", label: "Invoice#" },
    { key: "invoiceAmount", label: "Invoice Amount" },
    { key: "totalPackage", label: "Total Packages" },
    { key: "driver", label: "អ្នកដឹក (Driver)" },
    { key: "startTime", label: "ពេលចេញ (Start)" },
    { key: "actions", label: "សកម្មភាព (Action)" }
];

// Table 2: Completed Order Columns (15 Columns)
const DAILY_T2_COLUMNS = [
    { key: "status", label: "Status" },
    { key: "soDate", label: "SO Date" },
    { key: "soNumber", label: "SO#" },
    { key: "customerName", label: "Customer Name" },
    { key: "cityProvince", label: "City / Province" },
    { key: "khan", label: "Khan / District" },
    { key: "packingList", label: "Packing List#" },
    { key: "invoiceNumber", label: "Invoice#" },
    { key: "invoiceAmount", label: "Invoice Amount" },
    { key: "driver", label: "អ្នកដឹក (Driver)" },
    { key: "startTime", label: "ពេលចេញ (Start)" },
    { key: "endTime", label: "ពេលដល់ (End)" },
    { key: "duration", label: "រយៈពេល (Duration)" },
    { key: "paymentReceipt", label: "Payment Receipt" },
    { key: "actions", label: "សកម្មភាព (Action)" }
];

const STORAGE_DAILY_T1_COL_PREFS = "order_tracker_daily_t1_col_prefs_v1";
const STORAGE_DAILY_T2_COL_PREFS = "order_tracker_daily_t2_col_prefs_v1";

// --- TABLE 1 (Recent Order) PERSONAL DISPLAY FUNCTIONS ---
function getDailyT1ColumnPrefs() {
    try {
        const raw = localStorage.getItem(STORAGE_DAILY_T1_COL_PREFS);
        if (raw) {
            const prefs = JSON.parse(raw);
            if (prefs && typeof prefs === "object") return prefs;
        }
    } catch (e) {
        console.warn("Error reading daily T1 column prefs:", e);
    }
    const defaults = {};
    DAILY_T1_COLUMNS.forEach(c => { defaults[c.key] = true; });
    return defaults;
}

function saveDailyT1ColumnPrefs(prefs) {
    try {
        localStorage.setItem(STORAGE_DAILY_T1_COL_PREFS, JSON.stringify(prefs));
    } catch (e) {
        console.warn("Error saving daily T1 column prefs:", e);
    }
    applyDailyT1ColumnVisibility(prefs);
}

function updateDailyT1PersonalDisplayBadges(prefs = null) {
    const curPrefs = prefs || getDailyT1ColumnPrefs();
    const total = DAILY_T1_COLUMNS.length; // 13
    const selectedCount = DAILY_T1_COLUMNS.filter(c => curPrefs[c.key] !== false).length;
    const countText = `${selectedCount}/${total}`;

    const btnBadge = document.getElementById("dailyT1PersonalDisplayCountBadge");
    if (btnBadge) {
        btnBadge.textContent = countText;
        btnBadge.className = selectedCount < total
            ? "text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-sky-600 text-white font-mono shadow-xs transition"
            : "text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-sky-50 text-sky-700 font-mono border border-sky-200 transition";
    }

    const headerBadge = document.getElementById("dailyT1PersonalDisplayHeaderBadge");
    if (headerBadge) {
        headerBadge.textContent = countText;
        headerBadge.className = selectedCount < total
            ? "text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-sky-600 text-white font-mono shadow-xs transition"
            : "text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-sky-50 text-sky-700 font-mono border border-sky-200 transition";
    }

    const footerBadge = document.getElementById("dailyT1PersonalDisplayFooterCountBadge");
    if (footerBadge) {
        footerBadge.textContent = countText;
        footerBadge.className = selectedCount < total
            ? "text-[11px] font-bold font-mono text-white bg-sky-600 px-1.5 py-0.5 rounded shadow-xs transition"
            : "text-[11px] font-bold font-mono text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 transition";
    }
}

function applyDailyT1ColumnVisibility(prefs = null) {
    const curPrefs = prefs || getDailyT1ColumnPrefs();
    let styleEl = document.getElementById("dailyT1PersonalDisplayStyles");
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "dailyT1PersonalDisplayStyles";
        document.head.appendChild(styleEl);
    }

    const hiddenKeys = Object.keys(curPrefs).filter(k => curPrefs[k] === false);
    if (hiddenKeys.length === 0) {
        styleEl.textContent = "";
    } else {
        const rules = hiddenKeys.map(k => `[data-daily-t1-col="${k}"] { display: none !important; }`).join("\n");
        styleEl.textContent = rules;
    }
    updateDailyT1PersonalDisplayBadges(curPrefs);
}

function renderDailyT1PersonalDisplayCheckboxes() {
    const listEl = document.getElementById("dailyT1ColumnCheckboxesList");
    if (!listEl) return;
    const prefs = getDailyT1ColumnPrefs();
    updateDailyT1PersonalDisplayBadges(prefs);

    listEl.innerHTML = DAILY_T1_COLUMNS.map(col => {
        const isChecked = prefs[col.key] !== false;
        return `
            <label class="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-sky-50/70 border ${isChecked ? 'border-slate-200 bg-white text-slate-800' : 'border-slate-100 bg-slate-50/70 text-slate-400 opacity-60'} cursor-pointer select-none transition shadow-2xs">
                <input type="checkbox" data-daily-t1-col-key="${col.key}" ${isChecked ? "checked" : ""} class="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer accent-sky-600">
                <span class="font-medium text-xs truncate">${col.label}</span>
            </label>
        `;
    }).join("");

    listEl.querySelectorAll("input[type='checkbox']").forEach(cb => {
        cb.addEventListener("change", () => {
            const key = cb.getAttribute("data-daily-t1-col-key");
            const currentPrefs = getDailyT1ColumnPrefs();
            currentPrefs[key] = cb.checked;
            saveDailyT1ColumnPrefs(currentPrefs);
            renderDailyT1PersonalDisplayCheckboxes();
        });
    });
}

function toggleDailyT1PersonalDisplayMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById("dailyT1PersonalDisplayMenu");
    if (!menu) return;
    const isHidden = menu.classList.contains("hidden");
    if (isHidden) {
        closeDailyT2PersonalDisplayMenu();
        renderDailyT1PersonalDisplayCheckboxes();
        menu.classList.remove("hidden");
    } else {
        menu.classList.add("hidden");
    }
}

function closeDailyT1PersonalDisplayMenu() {
    const menu = document.getElementById("dailyT1PersonalDisplayMenu");
    if (menu) menu.classList.add("hidden");
}

function setDailyT1PersonalDisplayAll(enabled = true) {
    const prefs = {};
    DAILY_T1_COLUMNS.forEach(c => { prefs[c.key] = Boolean(enabled); });
    saveDailyT1ColumnPrefs(prefs);
    renderDailyT1PersonalDisplayCheckboxes();
}

function resetDailyT1PersonalDisplay() {
    try {
        localStorage.removeItem(STORAGE_DAILY_T1_COL_PREFS);
    } catch (e) {}
    const defaults = {};
    DAILY_T1_COLUMNS.forEach(c => { defaults[c.key] = true; });
    saveDailyT1ColumnPrefs(defaults);
    renderDailyT1PersonalDisplayCheckboxes();
}

// --- TABLE 2 (Completed Order) PERSONAL DISPLAY FUNCTIONS ---
function getDailyT2ColumnPrefs() {
    try {
        const raw = localStorage.getItem(STORAGE_DAILY_T2_COL_PREFS);
        if (raw) {
            const prefs = JSON.parse(raw);
            if (prefs && typeof prefs === "object") return prefs;
        }
    } catch (e) {
        console.warn("Error reading daily T2 column prefs:", e);
    }
    const defaults = {};
    DAILY_T2_COLUMNS.forEach(c => { defaults[c.key] = true; });
    return defaults;
}

function saveDailyT2ColumnPrefs(prefs) {
    try {
        localStorage.setItem(STORAGE_DAILY_T2_COL_PREFS, JSON.stringify(prefs));
    } catch (e) {
        console.warn("Error saving daily T2 column prefs:", e);
    }
    applyDailyT2ColumnVisibility(prefs);
}

function updateDailyT2PersonalDisplayBadges(prefs = null) {
    const curPrefs = prefs || getDailyT2ColumnPrefs();
    const total = DAILY_T2_COLUMNS.length; // 15
    const selectedCount = DAILY_T2_COLUMNS.filter(c => curPrefs[c.key] !== false).length;
    const countText = `${selectedCount}/${total}`;

    const btnBadge = document.getElementById("dailyT2PersonalDisplayCountBadge");
    if (btnBadge) {
        btnBadge.textContent = countText;
        btnBadge.className = selectedCount < total
            ? "text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-mono shadow-xs transition"
            : "text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-mono border border-emerald-200 transition";
    }

    const headerBadge = document.getElementById("dailyT2PersonalDisplayHeaderBadge");
    if (headerBadge) {
        headerBadge.textContent = countText;
        headerBadge.className = selectedCount < total
            ? "text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-mono shadow-xs transition"
            : "text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-mono border border-emerald-200 transition";
    }

    const footerBadge = document.getElementById("dailyT2PersonalDisplayFooterCountBadge");
    if (footerBadge) {
        footerBadge.textContent = countText;
        footerBadge.className = selectedCount < total
            ? "text-[11px] font-bold font-mono text-white bg-emerald-600 px-1.5 py-0.5 rounded shadow-xs transition"
            : "text-[11px] font-bold font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 transition";
    }
}

function applyDailyT2ColumnVisibility(prefs = null) {
    const curPrefs = prefs || getDailyT2ColumnPrefs();
    let styleEl = document.getElementById("dailyT2PersonalDisplayStyles");
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "dailyT2PersonalDisplayStyles";
        document.head.appendChild(styleEl);
    }

    const hiddenKeys = Object.keys(curPrefs).filter(k => curPrefs[k] === false);
    if (hiddenKeys.length === 0) {
        styleEl.textContent = "";
    } else {
        const rules = hiddenKeys.map(k => `[data-daily-t2-col="${k}"] { display: none !important; }`).join("\n");
        styleEl.textContent = rules;
    }
    updateDailyT2PersonalDisplayBadges(curPrefs);
}

function renderDailyT2PersonalDisplayCheckboxes() {
    const listEl = document.getElementById("dailyT2ColumnCheckboxesList");
    if (!listEl) return;
    const prefs = getDailyT2ColumnPrefs();
    updateDailyT2PersonalDisplayBadges(prefs);

    listEl.innerHTML = DAILY_T2_COLUMNS.map(col => {
        const isChecked = prefs[col.key] !== false;
        return `
            <label class="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-emerald-50/70 border ${isChecked ? 'border-slate-200 bg-white text-slate-800' : 'border-slate-100 bg-slate-50/70 text-slate-400 opacity-60'} cursor-pointer select-none transition shadow-2xs">
                <input type="checkbox" data-daily-t2-col-key="${col.key}" ${isChecked ? "checked" : ""} class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer accent-emerald-600">
                <span class="font-medium text-xs truncate">${col.label}</span>
            </label>
        `;
    }).join("");

    listEl.querySelectorAll("input[type='checkbox']").forEach(cb => {
        cb.addEventListener("change", () => {
            const key = cb.getAttribute("data-daily-t2-col-key");
            const currentPrefs = getDailyT2ColumnPrefs();
            currentPrefs[key] = cb.checked;
            saveDailyT2ColumnPrefs(currentPrefs);
            renderDailyT2PersonalDisplayCheckboxes();
        });
    });
}

function toggleDailyT2PersonalDisplayMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById("dailyT2PersonalDisplayMenu");
    if (!menu) return;
    const isHidden = menu.classList.contains("hidden");
    if (isHidden) {
        closeDailyT1PersonalDisplayMenu();
        renderDailyT2PersonalDisplayCheckboxes();
        menu.classList.remove("hidden");
    } else {
        menu.classList.add("hidden");
    }
}

function closeDailyT2PersonalDisplayMenu() {
    const menu = document.getElementById("dailyT2PersonalDisplayMenu");
    if (menu) menu.classList.add("hidden");
}

function setDailyT2PersonalDisplayAll(enabled = true) {
    const prefs = {};
    DAILY_T2_COLUMNS.forEach(c => { prefs[c.key] = Boolean(enabled); });
    saveDailyT2ColumnPrefs(prefs);
    renderDailyT2PersonalDisplayCheckboxes();
}

function resetDailyT2PersonalDisplay() {
    try {
        localStorage.removeItem(STORAGE_DAILY_T2_COL_PREFS);
    } catch (e) {}
    const defaults = {};
    DAILY_T2_COLUMNS.forEach(c => { defaults[c.key] = true; });
    saveDailyT2ColumnPrefs(defaults);
    renderDailyT2PersonalDisplayCheckboxes();
}

function matchesDailyDeliveryFilter(order) {
    if (!order) return false;
    const dd = AppState.dailyDelivery || {};
    const q = (dd.searchQuery || "").toLowerCase().trim();

    // 1. Text Search Filter across multiple fields
    if (q) {
        const so = String(order.soNumber || "").toLowerCase();
        const cust = String(order.customerName || "").toLowerCase();
        const inv = String(order.invoiceNumber || "").toLowerCase();
        const pkg = String(order.packingListNumber || "").toLowerCase();
        const driver = String(order.deliveryBy || "").toLowerCase();
        const city = String(order.cityProvince || "").toLowerCase();
        const khan = String(order.khan || "").toLowerCase();
        const status = String(order.status || "").toLowerCase();
        const phone = String(order.phone || "").toLowerCase();

        const match = so.includes(q) || cust.includes(q) || inv.includes(q) || pkg.includes(q) || 
                      driver.includes(q) || city.includes(q) || khan.includes(q) || status.includes(q) || phone.includes(q);
        if (!match) return false;
    }

    // 2. Date Filter
    const preset = dd.datePreset || "ALL";
    const customDate = dd.filterDate || "";

    if (customDate) {
        // Custom Date matching (YYYY-MM-DD)
        const orderDate = order.timestamp || order.soDate || order.so_date || order.date || order.deliveryStartTime || order.deliveryEndTime;
        const d = parseAppDateTime(orderDate);
        if (!d || isNaN(d.getTime())) return false;
        const pad = n => String(n).padStart(2, '0');
        const orderDateIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (orderDateIso !== customDate) return false;
    } else if (preset !== "ALL") {
        const orderDate = order.timestamp || order.soDate || order.so_date || order.date || order.deliveryStartTime || order.deliveryEndTime;
        const d = parseAppDateTime(orderDate);
        if (!d || isNaN(d.getTime())) return false;

        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const todayStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
        const orderDayStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

        if (preset === "TODAY") {
            if (orderDayStr !== todayStr) return false;
        } else if (preset === "YESTERDAY") {
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const yestStr = `${pad(yesterday.getDate())}/${pad(yesterday.getMonth() + 1)}/${yesterday.getFullYear()}`;
            if (orderDayStr !== yestStr) return false;
        } else if (preset === "THIS_MONTH") {
            if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
        }
    }

    return true;
}

// -------------------------------------------------------------
// DAILY DELIVERY ANALYTICS & STATUS CHART CARD
// -------------------------------------------------------------
let dailyDeliveryChartInstance = null;

function renderDailyDeliveryAnalyticsChart(stats) {
    const cSuccess = stats.successCount || 0;
    const cIncomplete = stats.incompleteCount || 0;
    const cReturn = stats.returnCount || 0;
    const cInDelivery = stats.inDeliveryCount || 0;
    const total = cSuccess + cIncomplete + cReturn + cInDelivery;

    // Percentages
    const pctSuccess = total > 0 ? ((cSuccess / total) * 100).toFixed(1) : "0.0";
    const pctIncomplete = total > 0 ? ((cIncomplete / total) * 100).toFixed(1) : "0.0";
    const pctReturn = total > 0 ? ((cReturn / total) * 100).toFixed(1) : "0.0";
    const pctInDelivery = total > 0 ? ((cInDelivery / total) * 100).toFixed(1) : "0.0";

    const finishedTotal = cSuccess + cIncomplete + cReturn;
    const successRate = finishedTotal > 0 ? ((cSuccess / finishedTotal) * 100).toFixed(1) : (total > 0 ? ((cSuccess / total) * 100).toFixed(1) : "0.0");

    // 1. Update Header Badge & Center Overlays
    const elBadge = document.getElementById("dailyChartTotalBadge");
    if (elBadge) elBadge.textContent = `${total} ${total === 1 ? "Order" : "Orders"}`;

    const elCenterTotal = document.getElementById("dailyChartCenterTotal");
    if (elCenterTotal) elCenterTotal.textContent = total;

    const elCenterRate = document.getElementById("dailyChartCenterSuccessRate");
    if (elCenterRate) elCenterRate.textContent = `${successRate}% ជោគជ័យ`;

    // 2. Counts and Percentages in Right Column
    const elCountSuccess = document.getElementById("dailyChartCountSuccess");
    if (elCountSuccess) elCountSuccess.textContent = cSuccess;
    const elPctSuccess = document.getElementById("dailyChartPctSuccess");
    if (elPctSuccess) elPctSuccess.textContent = `${pctSuccess}%`;
    const elBarSuccess = document.getElementById("dailyChartBarSuccess");
    if (elBarSuccess) elBarSuccess.style.width = `${pctSuccess}%`;

    const elCountIncomplete = document.getElementById("dailyChartCountIncomplete");
    if (elCountIncomplete) elCountIncomplete.textContent = cIncomplete;
    const elPctIncomplete = document.getElementById("dailyChartPctIncomplete");
    if (elPctIncomplete) elPctIncomplete.textContent = `${pctIncomplete}%`;
    const elBarIncomplete = document.getElementById("dailyChartBarIncomplete");
    if (elBarIncomplete) elBarIncomplete.style.width = `${pctIncomplete}%`;

    const elCountReturn = document.getElementById("dailyChartCountReturn");
    if (elCountReturn) elCountReturn.textContent = cReturn;
    const elPctReturn = document.getElementById("dailyChartPctReturn");
    if (elPctReturn) elPctReturn.textContent = `${pctReturn}%`;
    const elBarReturn = document.getElementById("dailyChartBarReturn");
    if (elBarReturn) elBarReturn.style.width = `${pctReturn}%`;

    const elCountInDelivery = document.getElementById("dailyChartCountInDelivery");
    if (elCountInDelivery) elCountInDelivery.textContent = cInDelivery;
    const elPctInDelivery = document.getElementById("dailyChartPctInDelivery");
    if (elPctInDelivery) elPctInDelivery.textContent = `${pctInDelivery}%`;
    const elBarInDelivery = document.getElementById("dailyChartBarInDelivery");
    if (elBarInDelivery) elBarInDelivery.style.width = `${pctInDelivery}%`;

    // 3. Bottom Summary Strip
    const elFinished = document.getElementById("dailyChartFinishedCount");
    if (elFinished) elFinished.textContent = finishedTotal;
    const elRateBottom = document.getElementById("dailyChartSuccessRateBottom");
    if (elRateBottom) elRateBottom.textContent = `${successRate}%`;

    // 4. Update Filter Context Text
    const elFilterContext = document.getElementById("dailyChartFilterContextText");
    if (elFilterContext && AppState.dailyDelivery) {
        const p = AppState.dailyDelivery.datePreset;
        const d = AppState.dailyDelivery.filterDate;
        if (d) {
            elFilterContext.textContent = d;
        } else if (p === "TODAY") {
            elFilterContext.textContent = "ថ្ងៃនេះ (Today)";
        } else if (p === "YESTERDAY") {
            elFilterContext.textContent = "ម្សិលមិញ (Yesterday)";
        } else if (p === "THIS_MONTH") {
            elFilterContext.textContent = "ខែនេះ (This Month)";
        } else {
            elFilterContext.textContent = "ទាំងអស់ (All)";
        }
    }

    // 5. Restore saved collapse state if any
    try {
        const isCollapsed = localStorage.getItem("dailyDeliveryChartCardCollapsed") === "true";
        const body = document.getElementById("dailyChartCardBody");
        const icon = document.getElementById("iconToggleDailyChart");
        if (body && isCollapsed && !body.classList.contains("hidden")) {
            body.classList.add("hidden");
            if (icon) icon.classList.add("rotate-180");
        }
    } catch(e){}

    // 6. Update Donut Chart
    updateDailyDeliveryDoughnutCanvas(cSuccess, cIncomplete, cReturn, cInDelivery, total);
}

function updateDailyDeliveryDoughnutCanvas(cSuccess, cIncomplete, cReturn, cInDelivery, total) {
    const canvas = document.getElementById("dailyDeliveryDoughnutCanvas");
    if (!canvas) return;

    if (typeof Chart !== "undefined") {
        if (dailyDeliveryChartInstance) {
            try { dailyDeliveryChartInstance.destroy(); } catch(e){}
            dailyDeliveryChartInstance = null;
        }

        const isZero = total === 0;
        const dataArr = isZero ? [1] : [cSuccess, cIncomplete, cReturn, cInDelivery];
        const bgColors = isZero 
            ? ["#e2e8f0"] 
            : ["#10b981", "#f59e0b", "#f43f5e", "#0ea5e9"];
        const hoverColors = isZero 
            ? ["#cbd5e1"] 
            : ["#059669", "#d97706", "#e11d48", "#0284c7"];
        const labels = isZero 
            ? ["មិនទាន់មាន Order"] 
            : ["Completed (ជោគជ័យ)", "Incompleted (មិនបានជោគជ័យ)", "Return (ត្រឡប់)", "In Delivery (កំពុងដឹក)"];

        const ctx = canvas.getContext("2d");
        dailyDeliveryChartInstance = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: labels,
                datasets: [{
                    data: dataArr,
                    backgroundColor: bgColors,
                    hoverBackgroundColor: hoverColors,
                    borderWidth: isZero ? 0 : 3,
                    borderColor: "#ffffff",
                    hoverOffset: isZero ? 0 : 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "75%",
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: !isZero,
                        callbacks: {
                            label: function(context) {
                                const val = context.raw || 0;
                                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0.0";
                                return ` ${context.label}: ${val} Orders (${pct}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 500
                }
            }
        });
    } else {
        // Fallback: Canvas 2D manual draw
        drawFallbackCanvasDonut(canvas, cSuccess, cIncomplete, cReturn, cInDelivery, total);
    }
}

function drawFallbackCanvasDonut(canvas, cSuccess, cIncomplete, cReturn, cInDelivery, total) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width || 220;
    const h = canvas.height || 220;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 16;
    const lineWidth = 20;

    if (total === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = "#e2e8f0";
        ctx.stroke();
        return;
    }

    const segments = [
        { count: cSuccess, color: "#10b981" },
        { count: cIncomplete, color: "#f59e0b" },
        { count: cReturn, color: "#f43f5e" },
        { count: cInDelivery, color: "#0ea5e9" }
    ];

    let startAngle = -Math.PI / 2;
    segments.forEach(seg => {
        if (seg.count > 0) {
            const sliceAngle = (seg.count / total) * (2 * Math.PI);
            ctx.beginPath();
            ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = seg.color;
            ctx.stroke();
            startAngle += sliceAngle;
        }
    });
}

function toggleDailyDeliveryChartCard() {
    const body = document.getElementById("dailyChartCardBody");
    const icon = document.getElementById("iconToggleDailyChart");
    if (!body) return;
    const isHidden = body.classList.contains("hidden");
    if (isHidden) {
        body.classList.remove("hidden");
        if (icon) icon.classList.remove("rotate-180");
        try { localStorage.setItem("dailyDeliveryChartCardCollapsed", "false"); } catch(e){}
    } else {
        body.classList.add("hidden");
        if (icon) icon.classList.add("rotate-180");
        try { localStorage.setItem("dailyDeliveryChartCardCollapsed", "true"); } catch(e){}
    }
    if (typeof scheduleLucideIcons === "function") scheduleLucideIcons();
}

function renderDailyDeliveryView() {
    if (!AppState.dailyDelivery) {
        AppState.dailyDelivery = {
            searchQuery: "",
            datePreset: "ALL",
            filterDate: "",
            sortColumn: "soDate",
            sortDirectionTable1: "desc",
            sortDirectionTable2: "desc",
            pageTable2: 1,
            pageSizeTable2: 15
        };
    }

    // Filter orders for both tables
    const allRecentOrders = AppState.orders.filter(isDailyDeliveryRecentOrder);
    const allCompletedOrders = AppState.orders.filter(isDailyDeliveryCompletedOrder);

    const filteredRecent = allRecentOrders.filter(matchesDailyDeliveryFilter);
    const filteredCompleted = allCompletedOrders.filter(matchesDailyDeliveryFilter);

    // 1. Sort Table 1 (Recent Order)
    const dir1 = AppState.dailyDelivery.sortDirectionTable1 || "desc";
    filteredRecent.sort((a, b) => {
        const tA = getOrderSoDateTimestamp(a);
        const tB = getOrderSoDateTimestamp(b);
        return dir1 === "asc" ? (tA - tB) : (tB - tA);
    });

    // 2. Sort Table 2 (Completed Order)
    const dir2 = AppState.dailyDelivery.sortDirectionTable2 || "desc";
    filteredCompleted.sort((a, b) => {
        const tA = getOrderSoDateTimestamp(a);
        const tB = getOrderSoDateTimestamp(b);
        return dir2 === "asc" ? (tA - tB) : (tB - tA);
    });

    // 3. Update KPI Card Metrics
    const elRecentCount = document.getElementById("dailyKpiRecentCount");
    const elRecentAmt = document.getElementById("dailyKpiRecentAmount");
    const elCompletedCount = document.getElementById("dailyKpiCompletedCount");
    const elCompletedAmt = document.getElementById("dailyKpiCompletedAmount");
    const elSuccessCount = document.getElementById("dailyKpiSuccessCount");
    const elIncompleteCount = document.getElementById("dailyKpiIncompleteCount");
    const elBadge1 = document.getElementById("table1RecentBadgeCount");
    const elBadge2 = document.getElementById("table2CompletedBadgeCount");

    const recentTotalUsd = filteredRecent.reduce((sum, o) => sum + (parseFloat(o.invoiceAmount) || 0), 0);
    const completedTotalUsd = filteredCompleted.reduce((sum, o) => sum + (parseFloat(o.invoiceAmount) || 0), 0);
    const successOrders = filteredCompleted.filter(o => {
        const s = (o.status || "").toLowerCase();
        return s === "success" || s.endsWith("success") || s === "delivered" || s.includes("ជោគជ័យ");
    });
    const returnOrders = filteredCompleted.filter(o => {
        const s = (o.status || "").toLowerCase();
        return s === "return" || s.includes("return") || s.includes("ត្រឡប់") || s.includes("បង្វែរ");
    });
    const strictlyIncompleteOrders = filteredCompleted.filter(o => {
        const s = (o.status || "").toLowerCase();
        if (s === "return" || s.includes("return") || s.includes("ត្រឡប់") || s.includes("បង្វែរ")) return false;
        return s === "incomplete" || s.includes("incomplete") || s.includes("មិនបានជោគជ័យ");
    });
    const incompleteOrders = filteredCompleted.filter(o => {
        const s = (o.status || "").toLowerCase();
        return s === "incomplete" || s.includes("incomplete") || s === "return" || s.includes("return");
    });

    if (elRecentCount) elRecentCount.textContent = filteredRecent.length;
    if (elRecentAmt) elRecentAmt.textContent = `$${recentTotalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elCompletedCount) elCompletedCount.textContent = filteredCompleted.length;
    if (elCompletedAmt) elCompletedAmt.textContent = `$${completedTotalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elSuccessCount) elSuccessCount.textContent = successOrders.length;
    if (elIncompleteCount) elIncompleteCount.textContent = incompleteOrders.length;
    if (elBadge1) elBadge1.textContent = `${filteredRecent.length} Orders`;
    if (elBadge2) elBadge2.textContent = `${filteredCompleted.length} Orders`;

    const summaryText = document.getElementById("table2SummaryText");
    if (summaryText) summaryText.textContent = `សរុប: ${filteredCompleted.length} Orders (ជោគជ័យ: ${successOrders.length}, មិនជោគជ័យ: ${strictlyIncompleteOrders.length}, ត្រឡប់: ${returnOrders.length})`;

    // 4. Update the New Modern Analytics Chart Card (Donut Chart & Percentages)
    if (typeof renderDailyDeliveryAnalyticsChart === "function") {
        renderDailyDeliveryAnalyticsChart({
            successCount: successOrders.length,
            incompleteCount: strictlyIncompleteOrders.length,
            returnCount: returnOrders.length,
            inDeliveryCount: filteredRecent.length
        });
    }

    // 5. Render Table 1 and Table 2
    renderDailyDeliveryTable1(filteredRecent);
    renderDailyDeliveryTable2(filteredCompleted);

    // Apply column visibility preferences for each table individually
    applyDailyT1ColumnVisibility();
    applyDailyT2ColumnVisibility();

    // 5. Sync Clear Search Button state
    const clearBtn = document.getElementById("dailyDeliveryClearSearchBtn");
    if (clearBtn) {
        if (AppState.dailyDelivery.searchQuery) {
            clearBtn.classList.remove("hidden");
        } else {
            clearBtn.classList.add("hidden");
        }
    }

    scheduleLucideIcons();
}

function renderDailyDeliveryTable1(orders) {
    const thead = document.getElementById("dailyDeliveryTable1Head");
    const tbody = document.getElementById("dailyDeliveryTable1Body");
    if (!thead || !tbody) return;

    const dir1 = AppState.dailyDelivery.sortDirectionTable1 || "desc";
    const sortIcon = dir1 === "asc" ? "arrow-up" : "arrow-down";

    thead.innerHTML = `
        <tr class="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-xs tracking-tight">
            <th data-daily-t1-col="status" class="py-3 px-3 text-center whitespace-nowrap">Status</th>
            <th data-daily-t1-col="soDate" class="py-3 px-3 text-center whitespace-nowrap select-none group" title="ចុចដើម្បី Sort SO Date">
                <div class="inline-flex items-center justify-center gap-1">
                    <span class="cursor-pointer hover:text-emerald-700 transition" onclick="toggleDailyTable1Sort()">SO Date</span>
                    <button type="button" onclick="toggleDailyTable1Sort()" class="inline-flex items-center justify-center w-5 h-5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 hover:text-emerald-700 shadow-2xs transition active:scale-95 cursor-pointer ml-0.5" title="Sort SO Date">
                        <i data-lucide="${sortIcon}" class="w-3 h-3"></i>
                    </button>
                </div>
            </th>
            <th data-daily-t1-col="soNumber" class="py-3.5 px-3 text-left whitespace-nowrap">SO#</th>
            <th data-daily-t1-col="customerName" class="py-3.5 px-3 text-left whitespace-nowrap">Customer Name</th>
            <th data-daily-t1-col="cityProvince" class="py-3.5 px-3 text-left whitespace-nowrap">City / Province</th>
            <th data-daily-t1-col="khan" class="py-3.5 px-3 text-left whitespace-nowrap">Khan / District</th>
            <th data-daily-t1-col="packingList" class="py-3.5 px-3 text-left whitespace-nowrap">Packing List#</th>
            <th data-daily-t1-col="invoiceNumber" class="py-3.5 px-3 text-left whitespace-nowrap">Invoice#</th>
            <th data-daily-t1-col="invoiceAmount" class="py-3.5 px-3 text-right whitespace-nowrap">Invoice Amount</th>
            <th data-daily-t1-col="totalPackage" class="py-3.5 px-3 text-center whitespace-nowrap">Total Packages</th>
            <th data-daily-t1-col="driver" class="py-3.5 px-3 text-left whitespace-nowrap">អ្នកដឹក (Driver)</th>
            <th data-daily-t1-col="startTime" class="py-3.5 px-3 text-center whitespace-nowrap">ពេលចេញ (Start)</th>
            <th data-daily-t1-col="actions" class="py-3.5 px-3 text-center whitespace-nowrap">សកម្មភាព (Action)</th>
        </tr>
    `;

    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="100%" class="text-center py-12 text-slate-400 bg-white">
                    <i data-lucide="truck" class="w-10 h-10 mx-auto stroke-1 mb-2 text-slate-300"></i>
                    <p class="font-medium text-slate-600">មិនមាន Order កំពុងដឹកជញ្ជូន (In Delivery) ទេ</p>
                    <p class="text-xs text-slate-400 mt-1">រាល់ពេលចុច Start Delivery លើ Order ណាមួយ វានឹងបង្ហាញក្នុង Recent Order នេះភ្លាមៗ</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = orders.map(order => {
        const badge = getStatusBadgeInfo(order);
        const soDateStr = formatSoDateDisplay(order.timestamp || order.soDate || order.so_date || order.date);
        const amtStr = formatInvoiceAmountWithCurrency(order.invoiceAmount, order.currency);
        const pkgStr = formatPackageWithUnit(order.totalPackage, order.packageUnit);
        const startTimeStr = order.deliveryStartTime ? formatDateTimeDisplay(order.deliveryStartTime) : "-";

        return `
            <tr class="hover:bg-sky-50/40 transition border-b border-slate-100 text-xs">
                <!-- 1. Status -->
                <td data-daily-t1-col="status" class="py-3 px-3 text-center whitespace-nowrap">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badge.class}">
                        ${badge.text}
                    </span>
                </td>

                <!-- 2. SO Date -->
                <td data-daily-t1-col="soDate" class="py-3 px-3 font-mono text-slate-600 text-center whitespace-nowrap font-medium">
                    ${soDateStr}
                </td>

                <!-- 3. SO# -->
                <td data-daily-t1-col="soNumber" class="py-3 px-3 font-bold font-mono text-blue-700 whitespace-nowrap">
                    <span class="cursor-pointer hover:underline" onclick="viewOrderDetails('${escapeHtml(order.soNumber)}')">
                        ${escapeHtml(order.soNumber || "-")}
                    </span>
                </td>

                <!-- 4. Customer Name -->
                <td data-daily-t1-col="customerName" class="py-3 px-3 font-bold text-slate-900 whitespace-nowrap max-w-[200px] truncate" title="${escapeHtml(order.customerName || '')}">
                    ${escapeHtml(order.customerName || "-")}
                </td>

                <!-- 5. City/Province -->
                <td data-daily-t1-col="cityProvince" class="py-3 px-3 text-slate-600 whitespace-nowrap">
                    ${escapeHtml(order.cityProvince || "-")}
                </td>

                <!-- 6. Khan -->
                <td data-daily-t1-col="khan" class="py-3 px-3 text-slate-600 whitespace-nowrap">
                    ${escapeHtml(order.khan || "-")}
                </td>

                <!-- 7. Packing List# -->
                <td data-daily-t1-col="packingList" class="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                    ${escapeHtml(order.packingListNumber || "-")}
                </td>

                <!-- 8. Invoice# -->
                <td data-daily-t1-col="invoiceNumber" class="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                    ${escapeHtml(order.invoiceNumber || "-")}
                </td>

                <!-- 9. Invoice Amount -->
                <td data-daily-t1-col="invoiceAmount" class="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                    ${amtStr}
                </td>

                <!-- 10. Total Packages -->
                <td data-daily-t1-col="totalPackage" class="py-3 px-3 text-center whitespace-nowrap">
                    ${pkgStr !== "-" ? `<span class="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-xs">${pkgStr}</span>` : '<span class="text-slate-300 font-semibold">-</span>'}
                </td>

                <!-- 11. Driver -->
                <td data-daily-t1-col="driver" class="py-3 px-3 text-sky-700 font-bold whitespace-nowrap">
                    <span class="inline-flex items-center gap-1">
                        <i data-lucide="user-check" class="w-3.5 h-3.5 text-sky-600"></i>
                        <span>${escapeHtml(order.deliveryBy || "-")}</span>
                    </span>
                </td>

                <!-- 12. Start Delivery -->
                <td data-daily-t1-col="startTime" class="py-3 px-3 font-mono text-slate-600 text-center whitespace-nowrap text-xs">
                    ${startTimeStr}
                </td>

                <!-- 13. Action: End Delivery Button -->
                <td data-daily-t1-col="actions" class="py-3 px-3 text-center whitespace-nowrap">
                    <button type="button" 
                        onclick="openEndDeliveryModal('${escapeHtml(order.soNumber)}')" 
                        class="py-1 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer whitespace-nowrap mx-auto"
                        title="បញ្ចប់ការដឹកជញ្ជូន (Success, Incompleted, ឬ Return)">
                        <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                        <span>End Delivery</span>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderDailyDeliveryTable2(orders) {
    const thead = document.getElementById("dailyDeliveryTable2Head");
    const tbody = document.getElementById("dailyDeliveryTable2Body");
    const paginationEl = document.getElementById("dailyDeliveryTable2Pagination");
    if (!thead || !tbody) return;

    const dir2 = AppState.dailyDelivery.sortDirectionTable2 || "desc";
    const sortIcon = dir2 === "asc" ? "arrow-up" : "arrow-down";

    thead.innerHTML = `
        <tr class="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-xs tracking-tight">
            <th data-daily-t2-col="status" class="py-3 px-3 text-center whitespace-nowrap">Status</th>
            <th data-daily-t2-col="soDate" class="py-3 px-3 text-center whitespace-nowrap select-none group" title="ចុចដើម្បី Sort SO Date">
                <div class="inline-flex items-center justify-center gap-1">
                    <span class="cursor-pointer hover:text-emerald-700 transition" onclick="toggleDailyTable2Sort()">SO Date</span>
                    <button type="button" onclick="toggleDailyTable2Sort()" class="inline-flex items-center justify-center w-5 h-5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 hover:text-emerald-700 shadow-2xs transition active:scale-95 cursor-pointer ml-0.5" title="Sort SO Date">
                        <i data-lucide="${sortIcon}" class="w-3 h-3"></i>
                    </button>
                </div>
            </th>
            <th data-daily-t2-col="soNumber" class="py-3.5 px-3 text-left whitespace-nowrap">SO#</th>
            <th data-daily-t2-col="customerName" class="py-3.5 px-3 text-left whitespace-nowrap">Customer Name</th>
            <th data-daily-t2-col="cityProvince" class="py-3.5 px-3 text-left whitespace-nowrap">City / Province</th>
            <th data-daily-t2-col="khan" class="py-3.5 px-3 text-left whitespace-nowrap">Khan / District</th>
            <th data-daily-t2-col="packingList" class="py-3.5 px-3 text-left whitespace-nowrap">Packing List#</th>
            <th data-daily-t2-col="invoiceNumber" class="py-3.5 px-3 text-left whitespace-nowrap">Invoice#</th>
            <th data-daily-t2-col="invoiceAmount" class="py-3.5 px-3 text-right whitespace-nowrap">Invoice Amount</th>
            <th data-daily-t2-col="driver" class="py-3.5 px-3 text-left whitespace-nowrap">អ្នកដឹក (Driver)</th>
            <th data-daily-t2-col="startTime" class="py-3.5 px-3 text-center whitespace-nowrap">ពេលចេញ (Start)</th>
            <th data-daily-t2-col="endTime" class="py-3.5 px-3 text-center whitespace-nowrap">ពេលដល់ (End)</th>
            <th data-daily-t2-col="duration" class="py-3.5 px-3 text-center whitespace-nowrap">រយៈពេល (Duration)</th>
            <th data-daily-t2-col="paymentReceipt" class="py-3.5 px-3 text-left whitespace-nowrap">Payment Receipt</th>
            <th data-daily-t2-col="actions" class="py-3.5 px-3 text-center whitespace-nowrap">សកម្មភាព (Action)</th>
        </tr>
    `;

    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="100%" class="text-center py-12 text-slate-400 bg-white">
                    <i data-lucide="check-check" class="w-10 h-10 mx-auto stroke-1 mb-2 text-slate-300"></i>
                    <p class="font-medium text-slate-600">មិនមាន Order ដែលបានបញ្ចប់ការដឹកជញ្ជូនទេ</p>
                    <p class="text-xs text-slate-400 mt-1">ពេល Order ក្នុង Recent Order បញ្ចប់ការដឹកជញ្ជូន វានឹងត្រូវផ្លាស់ទីមកកាន់ Completed Order នេះ</p>
                </td>
            </tr>
        `;
        if (paginationEl) paginationEl.innerHTML = "";
        return;
    }

    // Pagination Calculation
    const pageSize = AppState.dailyDelivery.pageSizeTable2 || 15;
    const totalOrders = orders.length;
    const totalPages = Math.ceil(totalOrders / pageSize);
    let currentPage = AppState.dailyDelivery.pageTable2 || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    AppState.dailyDelivery.pageTable2 = currentPage;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalOrders);
    const pageOrders = orders.slice(startIndex, endIndex);

    tbody.innerHTML = pageOrders.map(order => {
        const badge = getStatusBadgeInfo(order);
        const soDateStr = formatSoDateDisplay(order.timestamp || order.soDate || order.so_date || order.date);
        const amtStr = formatInvoiceAmountWithCurrency(order.invoiceAmount, order.currency);
        const startTimeStr = order.deliveryStartTime ? formatDateTimeDisplay(order.deliveryStartTime) : "-";
        const endTimeStr = order.deliveryEndTime ? formatDateTimeDisplay(order.deliveryEndTime) : "-";
        const durationStr = order.deliveryDuration || calculateDurationHhMm(order.deliveryStartTime, order.deliveryEndTime);
        const isIncomplete = isOrderIncompletedDelivery(order) || (order.status || "").toLowerCase().includes("incomplete");

        return `
            <tr class="hover:bg-emerald-50/40 transition border-b border-slate-100 text-xs">
                <!-- 1. Status -->
                <td data-daily-t2-col="status" class="py-3 px-3 text-center whitespace-nowrap">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badge.class}">
                        ${badge.text}
                    </span>
                </td>

                <!-- 2. SO Date -->
                <td data-daily-t2-col="soDate" class="py-3 px-3 font-mono text-slate-600 text-center whitespace-nowrap font-medium">
                    ${soDateStr}
                </td>

                <!-- 3. SO# -->
                <td data-daily-t2-col="soNumber" class="py-3 px-3 font-bold font-mono text-blue-700 whitespace-nowrap">
                    <span class="cursor-pointer hover:underline" onclick="viewOrderDetails('${escapeHtml(order.soNumber)}')">
                        ${escapeHtml(order.soNumber || "-")}
                    </span>
                </td>

                <!-- 4. Customer Name -->
                <td data-daily-t2-col="customerName" class="py-3 px-3 font-bold text-slate-900 whitespace-nowrap max-w-[200px] truncate" title="${escapeHtml(order.customerName || '')}">
                    ${escapeHtml(order.customerName || "-")}
                </td>

                <!-- 5. City/Province -->
                <td data-daily-t2-col="cityProvince" class="py-3 px-3 text-slate-600 whitespace-nowrap">
                    ${escapeHtml(order.cityProvince || "-")}
                </td>

                <!-- 6. Khan -->
                <td data-daily-t2-col="khan" class="py-3 px-3 text-slate-600 whitespace-nowrap">
                    ${escapeHtml(order.khan || "-")}
                </td>

                <!-- 7. Packing List# -->
                <td data-daily-t2-col="packingList" class="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                    ${escapeHtml(order.packingListNumber || "-")}
                </td>

                <!-- 8. Invoice# -->
                <td data-daily-t2-col="invoiceNumber" class="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                    ${escapeHtml(order.invoiceNumber || "-")}
                </td>

                <!-- 9. Invoice Amount -->
                <td data-daily-t2-col="invoiceAmount" class="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                    ${amtStr}
                </td>

                <!-- 10. Driver -->
                <td data-daily-t2-col="driver" class="py-3 px-3 text-slate-700 font-semibold whitespace-nowrap">
                    ${escapeHtml(order.deliveryBy || "-")}
                </td>

                <!-- 11. Start Delivery -->
                <td data-daily-t2-col="startTime" class="py-3 px-3 font-mono text-slate-600 text-center whitespace-nowrap text-xs">
                    ${startTimeStr}
                </td>

                <!-- 12. End Delivery -->
                <td data-daily-t2-col="endTime" class="py-3 px-3 font-mono text-emerald-700 text-center whitespace-nowrap text-xs font-semibold">
                    ${endTimeStr}
                </td>

                <!-- 13. Duration -->
                <td data-daily-t2-col="duration" class="py-3 px-3 text-center whitespace-nowrap">
                    ${durationStr !== "-" ? `<span class="font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs">${durationStr}</span>` : '<span class="text-slate-300">-</span>'}
                </td>

                <!-- 14. Payment Receipt -->
                <td data-daily-t2-col="paymentReceipt" class="py-3 px-3 whitespace-nowrap">
                    ${renderPaymentReceiptBadge(order)}
                </td>

                <!-- 15. Action -->
                <td data-daily-t2-col="actions" class="py-3 px-3 text-center whitespace-nowrap">
                    ${isIncomplete ? `
                        <div class="flex items-center justify-center gap-1.5">
                            <button type="button" 
                                onclick="startSecondDelivery('${escapeHtml(order.soNumber)}')" 
                                class="py-1 px-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs shadow-2xs transition flex items-center gap-1 cursor-pointer whitespace-nowrap active:scale-95"
                                title="ដឹកជញ្ជូនម្ដងទៀត (រត់ត្រឡប់ទៅ Recent Order)">
                                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                                <span>Start 2nd</span>
                            </button>
                            <button type="button" 
                                onclick="viewOrderDetails('${escapeHtml(order.soNumber)}')" 
                                class="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer" 
                                title="មើលព័ត៌មានលម្អិត">
                                <i data-lucide="eye" class="w-4 h-4"></i>
                            </button>
                        </div>
                    ` : `
                        <button type="button" 
                            onclick="viewOrderDetails('${escapeHtml(order.soNumber)}')" 
                            class="py-1 px-2.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap mx-auto"
                            title="មើលព័ត៌មានលម្អិត">
                            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                            <span>Detail</span>
                        </button>
                    `}
                </td>
            </tr>
        `;
    }).join("");

    // Render Table 2 Pagination
    if (paginationEl) {
        paginationEl.innerHTML = `
            <div class="flex items-center gap-2">
                <span>បង្ហាញ <b>${startIndex + 1} - ${endIndex}</b> នៃ <b>${totalOrders}</b> Orders</span>
            </div>
            <div class="flex items-center gap-1.5">
                <button type="button" 
                    onclick="changeDailyTable2Page(${currentPage - 1})" 
                    ${currentPage <= 1 ? 'disabled class="py-1 px-2.5 rounded-lg border border-slate-200 text-slate-300 cursor-not-allowed"' : 'class="py-1 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold cursor-pointer shadow-2xs transition"'}>
                    Prev
                </button>
                <span class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80">
                    ${currentPage} / ${totalPages || 1}
                </span>
                <button type="button" 
                    onclick="changeDailyTable2Page(${currentPage + 1})" 
                    ${currentPage >= totalPages ? 'disabled class="py-1 px-2.5 rounded-lg border border-slate-200 text-slate-300 cursor-not-allowed"' : 'class="py-1 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold cursor-pointer shadow-2xs transition"'}>
                    Next
                </button>
            </div>
        `;
    }
}

function changeDailyTable2Page(newPage) {
    if (!AppState.dailyDelivery) return;
    AppState.dailyDelivery.pageTable2 = newPage;
    renderDailyDeliveryView();
}

function toggleDailyTable1Sort() {
    if (!AppState.dailyDelivery) return;
    const cur = AppState.dailyDelivery.sortDirectionTable1 || "desc";
    AppState.dailyDelivery.sortDirectionTable1 = (cur === "asc") ? "desc" : "asc";
    renderDailyDeliveryView();
}

function toggleDailyTable2Sort() {
    if (!AppState.dailyDelivery) return;
    const cur = AppState.dailyDelivery.sortDirectionTable2 || "desc";
    AppState.dailyDelivery.sortDirectionTable2 = (cur === "asc") ? "desc" : "asc";
    renderDailyDeliveryView();
}

function onDailyDeliverySearchInput(e) {
    if (!AppState.dailyDelivery) return;
    AppState.dailyDelivery.searchQuery = e.target.value;
    AppState.dailyDelivery.pageTable2 = 1;
    renderDailyDeliveryView();
}

function clearDailyDeliverySearch() {
    const input = document.getElementById("dailyDeliverySearchInput");
    if (input) input.value = "";
    if (AppState.dailyDelivery) {
        AppState.dailyDelivery.searchQuery = "";
        AppState.dailyDelivery.pageTable2 = 1;
    }
    renderDailyDeliveryView();
}

function setDailyDeliveryDatePreset(preset) {
    if (!AppState.dailyDelivery) return;
    AppState.dailyDelivery.datePreset = preset;
    AppState.dailyDelivery.filterDate = "";
    AppState.dailyDelivery.pageTable2 = 1;

    // Reset date input UI
    const dateInput = document.getElementById("dailyDeliveryDateFilter");
    if (dateInput) dateInput.value = "";

    // Sync button active styles
    const presets = ["ALL", "TODAY", "YESTERDAY", "THIS_MONTH"];
    presets.forEach(p => {
        const btn = document.getElementById(`dailyPresetBtn-${p}`);
        if (btn) {
            if (p === preset) {
                btn.className = "daily-date-preset-btn px-2.5 py-1 text-xs font-bold rounded-lg transition bg-white text-emerald-700 shadow-xs";
            } else {
                btn.className = "daily-date-preset-btn px-2.5 py-1 text-xs font-semibold rounded-lg transition text-slate-600 hover:text-emerald-700";
            }
        }
    });

    renderDailyDeliveryView();
}

function onDailyDeliveryDateFilterChange() {
    const dateInput = document.getElementById("dailyDeliveryDateFilter");
    if (!dateInput || !AppState.dailyDelivery) return;

    AppState.dailyDelivery.filterDate = dateInput.value;
    AppState.dailyDelivery.datePreset = "CUSTOM";
    AppState.dailyDelivery.pageTable2 = 1;

    // Reset preset buttons styling
    const presets = ["ALL", "TODAY", "YESTERDAY", "THIS_MONTH"];
    presets.forEach(p => {
        const btn = document.getElementById(`dailyPresetBtn-${p}`);
        if (btn) {
            btn.className = "daily-date-preset-btn px-2.5 py-1 text-xs font-semibold rounded-lg transition text-slate-600 hover:text-emerald-700";
        }
    });

    renderDailyDeliveryView();
}

function resetDailyDeliveryFilters() {
    const searchInput = document.getElementById("dailyDeliverySearchInput");
    if (searchInput) searchInput.value = "";

    const dateInput = document.getElementById("dailyDeliveryDateFilter");
    if (dateInput) dateInput.value = "";

    if (AppState.dailyDelivery) {
        AppState.dailyDelivery.searchQuery = "";
        AppState.dailyDelivery.filterDate = "";
        AppState.dailyDelivery.datePreset = "ALL";
        AppState.dailyDelivery.pageTable2 = 1;
    }

    const presets = ["ALL", "TODAY", "YESTERDAY", "THIS_MONTH"];
    presets.forEach(p => {
        const btn = document.getElementById(`dailyPresetBtn-${p}`);
        if (btn) {
            if (p === "ALL") {
                btn.className = "daily-date-preset-btn px-2.5 py-1 text-xs font-bold rounded-lg transition bg-white text-emerald-700 shadow-xs";
            } else {
                btn.className = "daily-date-preset-btn px-2.5 py-1 text-xs font-semibold rounded-lg transition text-slate-600 hover:text-emerald-700";
            }
        }
    });

    renderDailyDeliveryView();
    showToast("បានកំណត់ Filters ឡើងវិញ (Reset Filters) រួចរាល់!", "info");
}

function exportDailyDeliveryToExcel() {
    if (!window.XLSX) {
        showToast("កំពុងទាញយកបណ្ណាល័យ Excel សូមរង់ចាំបន្តិច...", "info");
        return;
    }

    const allRecentOrders = AppState.orders.filter(isDailyDeliveryRecentOrder).filter(matchesDailyDeliveryFilter);
    const allCompletedOrders = AppState.orders.filter(isDailyDeliveryCompletedOrder).filter(matchesDailyDeliveryFilter);

    const wb = XLSX.utils.book_new();

    // 1. Sheet 1: Recent Orders (In Delivery)
    const headers1 = [
        "Status", "SO Date", "SO#", "Customer Name", "City / Province", "Khan / District", 
        "Packing List#", "Invoice#", "Invoice Amount", "Total Packages", "Driver", "Start Delivery Time"
    ];
    const rows1 = allRecentOrders.map(o => [
        getStatusBadgeInfo(o).text,
        formatSoDateDisplay(o.timestamp || o.soDate || o.so_date || o.date),
        o.soNumber || "-",
        o.customerName || "-",
        o.cityProvince || "-",
        o.khan || "-",
        o.packingListNumber || "-",
        o.invoiceNumber || "-",
        formatInvoiceAmountWithCurrency(o.invoiceAmount, o.currency),
        formatPackageWithUnit(o.totalPackage, o.packageUnit),
        o.deliveryBy || "-",
        o.deliveryStartTime ? formatDateTimeDisplay(o.deliveryStartTime) : "-"
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([headers1, ...rows1]);
    XLSX.utils.book_append_sheet(wb, ws1, "Recent Orders (In Delivery)");

    // Sheet 2: Completed Orders
    const headers2 = [
        "Status", "SO Date", "SO#", "Customer Name", "City / Province", "Khan / District", 
        "Packing List#", "Invoice#", "Invoice Amount", "Driver", "Start Delivery Time", 
        "End Delivery Time", "Duration", "Payment Receipt"
    ];
    const rows2 = allCompletedOrders.map(o => [
        getStatusBadgeInfo(o).text,
        formatSoDateDisplay(o.timestamp || o.soDate || o.so_date || o.date),
        o.soNumber || "-",
        o.customerName || "-",
        o.cityProvince || "-",
        o.khan || "-",
        o.packingListNumber || "-",
        o.invoiceNumber || "-",
        formatInvoiceAmountWithCurrency(o.invoiceAmount, o.currency),
        o.deliveryBy || "-",
        o.deliveryStartTime ? formatDateTimeDisplay(o.deliveryStartTime) : "-",
        o.deliveryEndTime ? formatDateTimeDisplay(o.deliveryEndTime) : "-",
        o.deliveryDuration || "-",
        formatPaymentReceiptDisplay(o)
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([headers2, ...rows2]);
    XLSX.utils.book_append_sheet(wb, ws2, "Completed Orders");

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    XLSX.writeFile(wb, `Daily_Delivery_Report_${dateStr}.xlsx`);
    showToast("បាន Export ឯកសារ Daily Delivery Excel ជោគជ័យ!", "success");
}

window.renderDailyDeliveryView = renderDailyDeliveryView;
window.renderDailyDeliveryTable1 = renderDailyDeliveryTable1;
window.renderDailyDeliveryTable2 = renderDailyDeliveryTable2;
window.toggleDailyTable1Sort = toggleDailyTable1Sort;
window.toggleDailyTable2Sort = toggleDailyTable2Sort;
window.onDailyDeliverySearchInput = onDailyDeliverySearchInput;
window.clearDailyDeliverySearch = clearDailyDeliverySearch;
window.setDailyDeliveryDatePreset = setDailyDeliveryDatePreset;
window.onDailyDeliveryDateFilterChange = onDailyDeliveryDateFilterChange;
window.resetDailyDeliveryFilters = resetDailyDeliveryFilters;
window.changeDailyTable2Page = changeDailyTable2Page;
window.exportDailyDeliveryToExcel = exportDailyDeliveryToExcel;
window.isDailyDeliveryRecentOrder = isDailyDeliveryRecentOrder;
window.isDailyDeliveryCompletedOrder = isDailyDeliveryCompletedOrder;
window.toggleDailyT1PersonalDisplayMenu = toggleDailyT1PersonalDisplayMenu;
window.closeDailyT1PersonalDisplayMenu = closeDailyT1PersonalDisplayMenu;
window.setDailyT1PersonalDisplayAll = setDailyT1PersonalDisplayAll;
window.resetDailyT1PersonalDisplay = resetDailyT1PersonalDisplay;
window.renderDailyT1PersonalDisplayCheckboxes = renderDailyT1PersonalDisplayCheckboxes;
window.applyDailyT1ColumnVisibility = applyDailyT1ColumnVisibility;
window.getDailyT1ColumnPrefs = getDailyT1ColumnPrefs;
window.saveDailyT1ColumnPrefs = saveDailyT1ColumnPrefs;

window.toggleDailyT2PersonalDisplayMenu = toggleDailyT2PersonalDisplayMenu;
window.closeDailyT2PersonalDisplayMenu = closeDailyT2PersonalDisplayMenu;
window.setDailyT2PersonalDisplayAll = setDailyT2PersonalDisplayAll;
window.resetDailyT2PersonalDisplay = resetDailyT2PersonalDisplay;
window.renderDailyT2PersonalDisplayCheckboxes = renderDailyT2PersonalDisplayCheckboxes;
window.applyDailyT2ColumnVisibility = applyDailyT2ColumnVisibility;
window.getDailyT2ColumnPrefs = getDailyT2ColumnPrefs;
window.saveDailyT2ColumnPrefs = saveDailyT2ColumnPrefs;

// View Full Order Details Modal
function viewOrderDetails(soNumber) {
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    const modal = document.getElementById("orderDetailsModal");
    const content = document.getElementById("orderDetailsContent");
    if (!modal || !content) return;

    const badgeInfo = getStatusBadgeInfo(order);

    content.innerHTML = `
        <div class="border-b border-slate-200/90 pb-5 mb-5">
            <!-- Top line with badges and clearance from header controls -->
            <div class="flex flex-wrap items-center justify-between gap-3 pr-24 sm:pr-36 mb-3">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold px-3 py-1.5 rounded-xl border ${getDocumentTypeBadgeClass(order.documentType)} shadow-2xs flex items-center gap-1.5" title="Document Type">
                        <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
                        <span>${escapeHtml(order.documentType || "SO to customer")}</span>
                    </span>
                    <span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${badgeInfo.class} shadow-2xs">
                        ${badgeInfo.text}
                    </span>
                </div>
                
                <div class="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
                    <span class="text-slate-400">កាលបរិច្ឆេទបង្កើត:</span>
                    <span class="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">${formatDateTimeDisplay(order.timestamp)}</span>
                </div>
            </div>

            <!-- Title, Customer & Action button -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
                <div>
                    <div class="flex items-center gap-2.5">
                        <span class="text-xs font-mono font-bold text-slate-400">SO#:</span>
                        <h3 class="text-2xl sm:text-3xl font-black text-blue-700 tracking-tight font-mono">${escapeHtml(order.soNumber)}</h3>
                    </div>
                    <div class="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg mt-1">
                        <i data-lucide="user" class="w-4 h-4 text-blue-600"></i>
                        <span>${escapeHtml(order.customerName)}</span>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="openEditOrderModal('${escapeHtml(order.soNumber)}')" class="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                        <span>កែប្រែទិន្នន័យ (Edit Order)</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Metric & Detail Cards Grid (Full display 4 columns on large screens) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
            <!-- 1. Location -->
            <div class="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 shadow-2xs space-y-1">
                <div class="flex items-center justify-between text-xs text-slate-400">
                    <span class="font-medium">ទីតាំងដឹកជញ្ជូន</span>
                    <i data-lucide="map-pin" class="w-4 h-4 text-red-500"></i>
                </div>
                <div class="text-sm font-bold text-slate-800 truncate" title="${escapeHtml(order.khan || "-")}">
                    ${escapeHtml(order.khan || "-")}
                </div>
                <div class="text-xs text-slate-500 truncate" title="${escapeHtml(order.cityProvince || "-")}">
                    ${escapeHtml(order.cityProvince || "-")}
                </div>
            </div>

            <!-- 2. Total Package -->
            <div class="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 shadow-2xs space-y-1">
                <div class="flex items-center justify-between text-xs text-purple-700">
                    <span class="font-medium">ចំនួនកញ្ចប់សរុប</span>
                    <i data-lucide="package" class="w-4 h-4 text-purple-600"></i>
                </div>
                <div class="text-xl font-extrabold text-purple-900 font-mono">
                    ${hasOrderTotalPackage(order)
                        ? `${order.totalPackage} <span class="text-xs font-semibold text-purple-700 font-sans">${escapeHtml(order.packageUnit || "")}</span>`
                        : '<span class="text-slate-400 font-medium text-lg">-</span>'}
                </div>
                <div class="text-[11px] text-purple-600">
                    ប្រភេទកញ្ចប់ / Unit
                </div>
            </div>

            <!-- 3. Invoice Amount -->
            <div class="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 shadow-2xs space-y-1">
                <div class="flex items-center justify-between text-xs text-emerald-700">
                    <span class="font-medium">ចំនួនទឹកប្រាក់សរុប</span>
                    <i data-lucide="banknote" class="w-4 h-4 text-emerald-600"></i>
                </div>
                <div class="text-xl font-extrabold text-emerald-800 font-mono">
                    ${order.currency === 'USD' ? '$' : '៛'} ${Number(order.invoiceAmount || 0).toLocaleString()}
                </div>
                <div class="text-[11px] text-emerald-600">
                    រូបិយប័ណ្ណ: ${order.currency || "USD"}
                </div>
            </div>

            <!-- 4. Documents & References -->
            <div class="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 shadow-2xs space-y-1 text-xs">
                <div class="flex items-center justify-between text-blue-700">
                    <span class="font-medium">ឯកសារ &amp; លេខយោង</span>
                    <i data-lucide="file-text" class="w-4 h-4 text-blue-600"></i>
                </div>
                <div class="text-slate-700 truncate">
                    <span class="text-slate-400">PL#:</span> <b class="font-mono text-slate-800">${escapeHtml(order.packingListNumber || "-")}</b>
                </div>
                <div class="text-slate-700 truncate">
                    <span class="text-slate-400">INV#:</span> <b class="font-mono text-slate-800">${escapeHtml(order.invoiceNumber || "-")}</b>
                </div>
                <div class="text-[11px] text-slate-500 truncate" title="${escapeHtml(order.documentType || "-")}">
                    ${escapeHtml(order.documentType || "-")}
                </div>
            </div>
        </div>

        <!-- Notes Section: Separated Special Notes & Delivery Notes -->
        <div class="grid grid-cols-1 ${order.deliveryNotes && order.deliveryNotes.trim() ? 'md:grid-cols-2' : ''} gap-3 mb-6">
            <!-- 1. Special Notes -->
            <div class="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-start gap-2.5 text-xs text-slate-700 shadow-2xs">
                <i data-lucide="info" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"></i>
                <div class="flex-1 min-w-0">
                    <span class="font-bold text-amber-950 block mb-0.5">កំណត់ចំណាំពិសេស (Special Notes):</span>
                    <span class="text-slate-700 font-medium">${order.specialNotes && order.specialNotes.trim() ? escapeHtml(order.specialNotes) : '<span class="italic text-slate-400">គ្មានកំណត់ចំណាំ</span>'}</span>
                </div>
            </div>

            <!-- 2. Dedicated 2nd / 3rd Delivery Notes & History -->
            ${order.deliveryNotes && order.deliveryNotes.trim() ? `
            <div class="p-3.5 rounded-2xl bg-sky-50/75 border border-sky-200/90 flex items-start gap-2.5 text-xs text-slate-700 shadow-2xs">
                <i data-lucide="truck" class="w-4 h-4 text-sky-600 shrink-0 mt-0.5"></i>
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-sky-950 flex items-center justify-between mb-1.5">
                        <span>កំណត់សម្គាល់ការដឹកជញ្ជូន (2nd / 3rd Delivery Notes):</span>
                        <span class="text-[10px] font-mono px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded-md font-semibold">Attempt ${Number(order.deliveryAttempts) || 1}</span>
                    </div>
                    <div class="space-y-1">
                        ${renderDeliveryNotesItems(order.deliveryNotes)}
                    </div>
                </div>
            </div>` : ''}
        </div>

        <!-- Payment Receipt Info (ប្រសិនបើមាន) -->
        ${(order.paymentReceipt && order.paymentReceipt !== '-' && order.paymentReceipt.trim() !== '') ? `
        <div class="mb-4 p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/90 flex items-start gap-2.5 text-xs text-slate-700 shadow-2xs">
            <i data-lucide="receipt" class="w-4 h-4 text-indigo-600 shrink-0 mt-0.5"></i>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1.5">
                    <span class="font-bold text-indigo-950">បង្កាន់ដៃទូទាត់ប្រាក់ (Payment Receipt):</span>
                    <span class="text-[10px] font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md">${escapeHtml(order.paymentReceiptType || "Payment Collected")}</span>
                </div>
                <div class="font-semibold text-slate-800 flex items-center gap-2">
                    ${renderPaymentReceiptBadge(order)}
                </div>
            </div>
        </div>` : ''}

        <!-- 4 Modules Step Progress Timeline (Horizontal 4-columns layout) -->
        <div class="mb-4">
            <h4 class="font-bold text-slate-800 mb-3 text-sm flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i data-lucide="git-commit" class="w-4 h-4 text-blue-600"></i>
                    <span>ដំណាក់កាលទាំង 4 (Modules &amp; Process Timeline)</span>
                </div>
                <span class="text-xs text-slate-400 font-normal">ដំណើរការតាមលំដាប់លំដោយ</span>
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <!-- Stage 1: Register Order -->
                <div class="p-4 rounded-2xl bg-white border-2 border-blue-200 shadow-xs relative flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="w-7 h-7 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">1</span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">ជោគជ័យ</span>
                        </div>
                        <h5 class="text-xs font-bold text-slate-900">Register Order</h5>
                        <p class="text-[11px] text-slate-500 mt-0.5">បានចុះឈ្មោះក្នុងប្រព័ន្ធ</p>
                    </div>
                    <div class="mt-3 pt-2 border-t border-slate-100 font-mono text-[11px] text-slate-600 space-y-0.5">
                        <div class="flex justify-between"><span class="text-slate-400">Created by:</span> <span class="font-bold text-blue-700">${escapeHtml(order.createdBy || "Admin")}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">កាលបរិច្ឆេទ:</span> <span>${formatDateTimeDisplay(order.timestamp)}</span></div>
                    </div>
                    <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-center text-xs font-bold text-blue-700 bg-blue-50/70 border border-blue-200/80 rounded-xl py-1.5 px-2">
                        <i data-lucide="check" class="w-3.5 h-3.5 stroke-[2.5] mr-1"></i>
                        <span>Registered</span>
                    </div>
                </div>

                <!-- Stage 2: Physical Picking -->
                <div class="p-4 rounded-2xl ${order.pickingEndTime ? 'bg-white border-2 border-emerald-300 shadow-xs' : order.pickingStartTime ? 'bg-amber-50/70 border-2 border-amber-300' : 'bg-slate-50/70 border border-slate-200'} relative flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="w-7 h-7 rounded-xl ${order.pickingEndTime ? 'bg-emerald-600' : order.pickingStartTime ? 'bg-amber-500' : 'bg-slate-300'} text-white font-bold text-xs flex items-center justify-center shadow-xs">2</span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${order.pickingEndTime ? 'bg-emerald-100 text-emerald-800' : order.pickingStartTime ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-slate-200 text-slate-600'}">
                                ${order.pickingEndTime ? 'រួចរាល់' : order.pickingStartTime ? 'កំពុងរៀបចំ' : 'រង់ចាំ'}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <h5 class="text-xs font-bold text-slate-900">Physical Picking</h5>
                            ${order.pickingDuration && order.pickingDuration !== '-' ? `<span class="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">${order.pickingDuration}</span>` : ''}
                        </div>
                        <p class="text-[11px] text-slate-500 mt-0.5">រៀបចំទំនិញក្នុងឃ្លាំង</p>
                    </div>
                    <div class="mt-3 pt-2 border-t border-slate-100 font-mono text-[11px] text-slate-600 space-y-0.5">
                        <div class="flex justify-between"><span class="text-slate-400">Picker by:</span> <span class="font-bold text-amber-700">${escapeHtml(order.pickerBy || "-")}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Start:</span> <span class="font-bold ${order.pickingStartTime ? 'text-amber-700' : 'text-slate-500'}">${formatDateTimeDisplay(order.pickingStartTime) || "-"}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">End:</span> <span class="font-bold ${order.pickingEndTime ? 'text-emerald-700' : 'text-slate-500'}">${formatDateTimeDisplay(order.pickingEndTime) || "-"}</span></div>
                    </div>
                    <!-- Action Buttons: Start & End Picking -->
                    <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2">
                        <button type="button" onclick="startPickingFromModal('${escapeHtml(order.soNumber)}')" class="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer ${order.pickingStartTime ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200' : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white'}" title="${order.pickingStartTime ? 'បាន Start: ' + formatDateTimeDisplay(order.pickingStartTime) : 'ចុច Start Physical Picking'}">
                            <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
                            <span>Start</span>
                        </button>
                        <button type="button" onclick="endPickingFromModal('${escapeHtml(order.soNumber)}')" class="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer ${order.pickingEndTime ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200' : (order.pickingStartTime ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white animate-pulse' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200')}" title="${order.pickingEndTime ? 'បាន End: ' + formatDateTimeDisplay(order.pickingEndTime) : 'ចុច End Physical Picking'}">
                            <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                            <span>End</span>
                        </button>
                    </div>
                </div>

                <!-- Stage 3: Physical Checking -->
                <div class="p-4 rounded-2xl ${order.checkingEndTime ? 'bg-white border-2 border-emerald-300 shadow-xs' : order.checkingStartTime ? 'bg-purple-50/70 border-2 border-purple-300' : 'bg-slate-50/70 border border-slate-200'} relative flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="w-7 h-7 rounded-xl ${order.checkingEndTime ? 'bg-emerald-600' : order.checkingStartTime ? 'bg-purple-600' : 'bg-slate-300'} text-white font-bold text-xs flex items-center justify-center shadow-xs">3</span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${order.checkingEndTime ? 'bg-emerald-100 text-emerald-800' : order.checkingStartTime ? 'bg-purple-100 text-purple-800 animate-pulse' : 'bg-slate-200 text-slate-600'}">
                                ${order.checkingEndTime ? 'រួចរាល់' : order.checkingStartTime ? 'កំពុងពិនិត្យ' : 'រង់ចាំ'}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <h5 class="text-xs font-bold text-slate-900">Physical Checking</h5>
                            ${order.checkingDuration && order.checkingDuration !== '-' ? `<span class="text-[11px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">${order.checkingDuration}</span>` : ''}
                        </div>
                        <p class="text-[11px] text-slate-500 mt-0.5">ផ្ទៀងផ្ទាត់គុណភាព &amp; ចំនួន</p>
                    </div>
                    <div class="mt-3 pt-2 border-t border-slate-100 font-mono text-[11px] text-slate-600 space-y-0.5">
                        <div class="flex justify-between"><span class="text-slate-400">Checker by:</span> <span class="font-bold text-purple-700">${escapeHtml(order.checkerBy || "-")}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Start:</span> <span class="font-bold ${order.checkingStartTime ? 'text-purple-700' : 'text-slate-500'}">${formatDateTimeDisplay(order.checkingStartTime) || "-"}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">End:</span> <span class="font-bold ${order.checkingEndTime ? 'text-emerald-700' : 'text-slate-500'}">${formatDateTimeDisplay(order.checkingEndTime) || "-"}</span></div>
                    </div>
                    <!-- Action Buttons: Start & End Checking -->
                    <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2">
                        <button type="button" onclick="startCheckingFromModal('${escapeHtml(order.soNumber)}')" class="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer ${order.checkingStartTime ? 'bg-purple-100 text-purple-900 border border-purple-300 hover:bg-purple-200' : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white'}" title="${order.checkingStartTime ? 'បាន Start: ' + formatDateTimeDisplay(order.checkingStartTime) : 'ចុច Start Physical Checking'}">
                            <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
                            <span>Start</span>
                        </button>
                        <button type="button" onclick="endCheckingFromModal('${escapeHtml(order.soNumber)}')" class="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer ${order.checkingEndTime ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200' : (order.checkingStartTime ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white animate-pulse' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200')}" title="${order.checkingEndTime ? 'បាន End: ' + formatDateTimeDisplay(order.checkingEndTime) : 'ចុច End Physical Checking'}">
                            <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                            <span>End</span>
                        </button>
                    </div>
                </div>

                <!-- Stage 4: Delivery Tracking -->
                <div class="p-4 rounded-2xl ${order.deliveryEndTime ? 'bg-white border-2 border-emerald-300 shadow-xs' : order.deliveryStartTime ? 'bg-sky-50/70 border-2 border-sky-300' : 'bg-slate-50/70 border border-slate-200'} relative flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="w-7 h-7 rounded-xl ${order.deliveryEndTime ? 'bg-emerald-600' : order.deliveryStartTime ? 'bg-sky-600' : 'bg-slate-300'} text-white font-bold text-xs flex items-center justify-center shadow-xs">4</span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${order.deliveryEndTime ? 'bg-emerald-100 text-emerald-800' : order.deliveryStartTime ? 'bg-sky-100 text-sky-800 animate-pulse' : 'bg-slate-200 text-slate-600'}">
                                ${order.deliveryEndTime ? 'បានប្រគល់' : order.deliveryStartTime ? 'កំពុងដឹកជញ្ជូន' : 'រង់ចាំ'}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <h5 class="text-xs font-bold text-slate-900">Delivery</h5>
                            ${order.deliveryDuration && order.deliveryDuration !== '-' ? `<span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">${order.deliveryDuration}</span>` : ''}
                        </div>
                        <p class="text-[11px] text-slate-500 mt-0.5">ដឹកជញ្ជូនដល់អតិថិជន</p>
                    </div>
                    <div class="mt-3 pt-2 border-t border-slate-100 font-mono text-[11px] text-slate-600 space-y-0.5">
                        <div class="flex justify-between"><span class="text-slate-400">Delivery by:</span> <span class="font-bold text-sky-700">${escapeHtml(order.deliveryBy || "-")}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Start:</span> <span class="font-bold ${order.deliveryStartTime ? 'text-sky-700' : 'text-slate-500'}">${formatDateTimeDisplay(order.deliveryStartTime) || "-"}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">End:</span> <span class="font-bold ${order.deliveryEndTime ? 'text-emerald-700' : 'text-slate-500'}">${formatDateTimeDisplay(order.deliveryEndTime) || "-"}</span></div>
                    </div>
                    <!-- Action Buttons: Start & End Delivery -->
                    <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2">
                        <button type="button" onclick="startDeliveryFromModal('${escapeHtml(order.soNumber)}')" class="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer ${order.deliveryStartTime ? 'bg-sky-100 text-sky-900 border border-sky-300 hover:bg-sky-200' : 'bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white'}" title="${order.deliveryStartTime ? 'បាន Start: ' + formatDateTimeDisplay(order.deliveryStartTime) : 'ចុច Start Delivery'}">
                            <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
                            <span>Start</span>
                        </button>
                        <button type="button" onclick="endDeliveryFromModal('${escapeHtml(order.soNumber)}')" class="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer ${order.deliveryEndTime ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200' : (order.deliveryStartTime ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white animate-pulse' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200')}" title="${order.deliveryEndTime ? 'បាន End: ' + formatDateTimeDisplay(order.deliveryEndTime) : 'ចុច End Delivery'}">
                            <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                            <span>End</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Wire up footer Edit button
    const btnFooterEdit = document.getElementById("btnModalEditOrder");
    if (btnFooterEdit) {
        btnFooterEdit.onclick = () => openEditOrderModal(order.soNumber);
    }

    modal.classList.remove("hidden");
    lucide.createIcons();
}

function closeOrderDetails() {
    const modal = document.getElementById("orderDetailsModal");
    const dialog = document.getElementById("orderDetailsDialog");
    const icon = document.getElementById("iconFullscreenOrder");
    if (modal) modal.classList.add("hidden");
    if (dialog) dialog.classList.remove("is-fullscreen");
    if (modal) modal.classList.remove("p-0-fullscreen");
    if (icon) {
        icon.setAttribute("data-lucide", "maximize-2");
        lucide.createIcons();
    }
}

function toggleFullscreenOrderModal() {
    const modal = document.getElementById("orderDetailsModal");
    const dialog = document.getElementById("orderDetailsDialog");
    const icon = document.getElementById("iconFullscreenOrder");
    if (!dialog) return;

    dialog.classList.toggle("is-fullscreen");
    if (modal) modal.classList.toggle("p-0-fullscreen");

    const isFull = dialog.classList.contains("is-fullscreen");
    if (icon) {
        icon.setAttribute("data-lucide", isFull ? "minimize-2" : "maximize-2");
        lucide.createIcons();
    }
}

// ==============================================================================
// ORDER DETAILS MODAL ACTIONS (Start & End for Picking, Checking, Delivery)
// ==============================================================================
async function startPickingFromModal(soNumber) {
    if (!hasUserPermission("picking")) {
        showToast("លោកអ្នកគ្មានសិទ្ធិដំណើរការ Physical Picking ឡើយ! ⛔", "warning");
        return;
    }
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    const curUser = getCurrentUser();
    const pickerName = curUser ? (curUser.displayName || curUser.username) : "Admin";
    const now = formatAppDateTime();

    order.pickingStartTime = now;
    order.pickerBy = pickerName;
    order.status = "In Picking";
    order.lastUpdated = now;

    saveOrdersToStorage();
    renderAll(false);
    viewOrderDetails(soNumber);

    SheetsSync.syncStageUpdate(soNumber, "PICKING_START", now, null, "In Picking", null, { pickerBy: pickerName });
    showToast(`បានចាប់ផ្ដើម Picking សម្រាប់ ${soNumber} ដោយ ${pickerName}`, "info");
}

async function endPickingFromModal(soNumber) {
    if (!hasUserPermission("picking")) {
        showToast("លោកអ្នកគ្មានសិទ្ធិដំណើរការ Physical Picking ឡើយ! ⛔", "warning");
        return;
    }
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    const curUser = getCurrentUser();
    const pickerName = order.pickerBy || (curUser ? (curUser.displayName || curUser.username) : "Admin");
    const now = formatAppDateTime();

    if (!order.pickingStartTime) {
        order.pickingStartTime = now;
    }

    order.pickingEndTime = now;
    order.pickingDuration = calculateDuration(order.pickingStartTime, now);
    order.status = "Waiting Checking";
    order.pickerBy = pickerName;
    order.lastUpdated = now;

    saveOrdersToStorage();
    renderAll(false);
    viewOrderDetails(soNumber);

    SheetsSync.syncStageUpdate(soNumber, "PICKING_END", now, order.pickingDuration, "Waiting Checking", null, { pickerBy: pickerName });
    showToast(`បានបញ្ចប់ Picking សម្រាប់ ${soNumber} (រយៈពេល: ${order.pickingDuration})`, "info");
}

async function startCheckingFromModal(soNumber) {
    if (!hasUserPermission("checking")) {
        showToast("លោកអ្នកគ្មានសិទ្ធិដំណើរការ Physical Checking ឡើយ! ⛔", "warning");
        return;
    }
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    const curUser = getCurrentUser();
    const checkerName = curUser ? (curUser.displayName || curUser.username) : "Admin";
    const now = formatAppDateTime();

    order.checkingStartTime = now;
    order.checkerBy = checkerName;
    order.status = "In Checking";
    order.lastUpdated = now;

    saveOrdersToStorage();
    renderAll(false);
    viewOrderDetails(soNumber);

    SheetsSync.syncStageUpdate(soNumber, "CHECKING_START", now, null, "In Checking", null, { checkerBy: checkerName });
    showToast(`បានចាប់ផ្ដើម Checking សម្រាប់ ${soNumber} ដោយ ${checkerName}`, "info");
}

function endCheckingFromModal(soNumber) {
    if (!hasUserPermission("checking")) {
        showToast("លោកអ្នកគ្មានសិទ្ធិដំណើរការ Physical Checking ឡើយ! ⛔", "warning");
        return;
    }
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    if (!order.checkingStartTime) {
        order.checkingStartTime = formatAppDateTime();
        const curUser = getCurrentUser();
        order.checkerBy = order.checkerBy || (curUser ? (curUser.displayName || curUser.username) : "Admin");
    }
    openEndCheckingModal(soNumber);
}

async function startDeliveryFromModal(soNumber) {
    if (!hasUserPermission("delivery")) {
        showToast("លោកអ្នកគ្មានសិទ្ធិដំណើរការ Delivery ឡើយ! ⛔", "warning");
        return;
    }
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    const curUser = getCurrentUser();
    const deliveryName = curUser ? (curUser.displayName || curUser.username) : "Admin";
    const now = formatAppDateTime();

    order.deliveryStartTime = now;
    order.deliveryEndTime = "";
    order.deliveryDuration = "-";
    order.deliveryBy = deliveryName;
    order.completedFromDailyDelivery = false;
    unmarkOrderCompletedFromDaily(soNumber, false);
    const att = Number(order.deliveryAttempts) || 1;
    const deliveryStatus = getDeliveryStatusName(att);
    order.status = deliveryStatus;
    order.lastUpdated = now;

    saveOrdersToStorage();
    renderAll(false);
    viewOrderDetails(soNumber);

    SheetsSync.syncStageUpdate(soNumber, "DELIVERY_START", now, null, deliveryStatus, null, { deliveryBy: deliveryName, deliveryAttempts: att });
    showToast(`ឡានបានចេញដំណើរដឹក ${soNumber} (${deliveryStatus}) ដោយ ${deliveryName}`, "info");

    // Telegram Notification: Queue Start Delivery
    if (window.TelegramNotify && typeof window.TelegramNotify.queueDeliveryStart === "function") {
        window.TelegramNotify.queueDeliveryStart(order, deliveryName);
    }
}

function endDeliveryFromModal(soNumber) {
    if (!hasUserPermission("delivery")) {
        showToast("លោកអ្នកគ្មានសិទ្ធិដំណើរការ Delivery ឡើយ! ⛔", "warning");
        return;
    }
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    if (!order.deliveryStartTime) {
        order.deliveryStartTime = formatAppDateTime();
        const curUser = getCurrentUser();
        order.deliveryBy = order.deliveryBy || (curUser ? (curUser.displayName || curUser.username) : "Admin");
    }
    openEndDeliveryModal(soNumber);
}

window.startPickingFromModal = startPickingFromModal;
window.endPickingFromModal = endPickingFromModal;
window.startCheckingFromModal = startCheckingFromModal;
window.endCheckingFromModal = endCheckingFromModal;
window.startDeliveryFromModal = startDeliveryFromModal;
window.endDeliveryFromModal = endDeliveryFromModal;

// ========================================================
// ESCAPE KEY & BACKDROP CLOSE CONTROLLER
// ========================================================
function closeTopActiveModal() {
    // 0. Online Users Modal (Esc to close)
    const onlineUsersModal = document.getElementById("onlineUsersModal");
    if (onlineUsersModal && !onlineUsersModal.classList.contains("hidden")) {
        closeOnlineUsersModal();
        return true;
    }

    // 0.05 Date & Time / SO Date Sort Dropdown Menus (Esc to close)
    const dashSortMenu = document.getElementById("dashboardDateTimeDropdownMenu");
    if (dashSortMenu && !dashSortMenu.classList.contains("hidden")) {
        dashSortMenu.classList.add("hidden");
        return true;
    }
    const reportSortMenu = document.getElementById("reportSoDateDropdownMenu");
    if (reportSortMenu && !reportSortMenu.classList.contains("hidden")) {
        reportSortMenu.classList.add("hidden");
        return true;
    }

    // 0.1 Autocomplete suggestions dropdowns (Customer, Province, Khan)
    const customerList = document.getElementById("customerSuggestionsList");
    if (customerList && !customerList.classList.contains("hidden")) {
        customerList.classList.add("hidden");
        return true;
    }
    const provinceList = document.getElementById("provinceSuggestionsList");
    if (provinceList && !provinceList.classList.contains("hidden")) {
        provinceList.classList.add("hidden");
        return true;
    }
    const khanList = document.getElementById("khanSuggestionsList");
    if (khanList && !khanList.classList.contains("hidden")) {
        khanList.classList.add("hidden");
        return true;
    }

    // 1. Order details modal
    const orderDetailsModal = document.getElementById("orderDetailsModal");
    if (orderDetailsModal && !orderDetailsModal.classList.contains("hidden")) {
        closeOrderDetails();
        return true;
    }
    // 2. Edit order modal
    const editOrderModal = document.getElementById("editOrderModal");
    if (editOrderModal && !editOrderModal.classList.contains("hidden")) {
        closeEditOrderModal();
        return true;
    }
    // 2.1 Create order modal
    const createOrderModal = document.getElementById("createOrderModal");
    if (createOrderModal && !createOrderModal.classList.contains("hidden")) {
        closeCreateOrderModal();
        return true;
    }
    // 2.2 End delivery modal
    const endDeliveryModal = document.getElementById("endDeliveryModal");
    if (endDeliveryModal && !endDeliveryModal.classList.contains("hidden")) {
        closeEndDeliveryModal();
    const detailsModal = document.getElementById("orderDetailsModal");
    if (detailsModal && !detailsModal.classList.contains("hidden")) {
        viewOrderDetails(soNumber);
    }
        return true;
    }
    // 2.3 End checking modal
    const endCheckingModal = document.getElementById("endCheckingModal");
    if (endCheckingModal && !endCheckingModal.classList.contains("hidden")) {
        closeEndCheckingModal();
        return true;
    }
    // 3. Customer modal
    const customerModal = document.getElementById("customerModal");
    if (customerModal && !customerModal.classList.contains("hidden")) {
        closeCustomerModal();
        return true;
    }
    // 4. BU modal
    const buModal = document.getElementById("buModal");
    if (buModal && !buModal.classList.contains("hidden")) {
        closeBUModal();
        return true;
    }
    // 5. Package modal
    const packageModal = document.getElementById("packageModal");
    if (packageModal && !packageModal.classList.contains("hidden")) {
        closePackageModal();
        return true;
    }
    // 6. Doc modal
    const docModal = document.getElementById("docModal");
    if (docModal && !docModal.classList.contains("hidden")) {
        closeDocModal();
        return true;
    }
    // 7. Settings modal
    const settingsModal = document.getElementById("settingsModal");
    if (settingsModal && !settingsModal.classList.contains("hidden")) {
        settingsModal.classList.add("hidden");
        return true;
    }
    // 7.1 Mobile Guide modal
    const mobileGuideModal = document.getElementById("mobileGuideModal");
    if (mobileGuideModal && !mobileGuideModal.classList.contains("hidden")) {
        if (typeof closeMobileGuideModal === "function") {
            closeMobileGuideModal();
        } else {
            mobileGuideModal.classList.add("hidden");
        }
        return true;
    }
    // 8. Popover menus
    const personalMenu = document.getElementById("personalDisplayMenu");
    if (personalMenu && !personalMenu.classList.contains("hidden")) {
        personalMenu.classList.add("hidden");
        return true;
    }
    const dailyT1PersonalMenu = document.getElementById("dailyT1PersonalDisplayMenu");
    if (dailyT1PersonalMenu && !dailyT1PersonalMenu.classList.contains("hidden")) {
        dailyT1PersonalMenu.classList.add("hidden");
        return true;
    }
    const dailyT2PersonalMenu = document.getElementById("dailyT2PersonalDisplayMenu");
    if (dailyT2PersonalMenu && !dailyT2PersonalMenu.classList.contains("hidden")) {
        dailyT2PersonalMenu.classList.add("hidden");
        return true;
    }
    const highlightMenu = document.getElementById("highlightColorMenu");
    if (highlightMenu && !highlightMenu.classList.contains("hidden")) {
        highlightMenu.classList.add("hidden");
        return true;
    }
    return false;
}

function initModalEscAndBackdrop() {
    // Escape key listener (Closes top active modal or menu)
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || e.code === "Escape" || e.keyCode === 27) {
            if (typeof Swal !== "undefined" && Swal.isVisible && Swal.isVisible()) {
                Swal.close();
                return;
            }
            closeTopActiveModal();
        }
    });

    // Close on backdrop click (click on modal overlay outside modal dialog)
    const modalIds = [
        "onlineUsersModal",
        "mobileGuideModal",
        "orderDetailsModal",
        "editOrderModal",
        "createOrderModal",
        "endDeliveryModal",
        "endCheckingModal",
        "settingsModal",
        "customerModal",
        "buModal",
        "packageModal",
        "docModal"
    ];

    modalIds.forEach(id => {
        const modalEl = document.getElementById(id);
        if (modalEl) {
            modalEl.addEventListener("mousedown", (e) => {
                // If user clicked directly on the overlay background
                if (e.target === modalEl) {
                    closeTopActiveModal();
                }
            });
        }
    });
}

// ========================================================
// EDIT ORDER MODAL CONTROLLER
// ========================================================
function openEditOrderModal(soNumber) {
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    // SO# Input, Original SO# and Badge
    const soInput = document.getElementById("editOrderSONumber");
    const origSoInput = document.getElementById("editOrderOriginalSONumber");
    const soBadge = document.getElementById("editModalSOBadge");
    if (soInput) soInput.value = order.soNumber;
    if (origSoInput) origSoInput.value = order.soNumber;
    if (soBadge) soBadge.textContent = order.soNumber;

    // Populate Province select
    const provSelect = document.getElementById("editCityProvince");
    if (provSelect) {
        const curProv = getCleanEnglishLocation(order.cityProvince);
        provSelect.innerHTML = `<option value="">-- ជ្រើសរើស City/Province --</option>` +
            CAMBODIA_PROVINCES.map(p => {
                const isSelected = curProv === p.nameEn || curProv === p.id;
                return `<option value="${p.nameEn}" ${isSelected ? "selected" : ""}>${p.nameEn}</option>`;
            }).join("");

        function updateEditKhanDatalist(provinceId) {
            const dl = document.getElementById("editKhanDatalist");
            if (!dl) return;
            const list = getEnglishKhansForProvince(provinceId);
            dl.innerHTML = list.map(k => `<option value="${k}">`).join("");
        }

        provSelect.onchange = (e) => updateEditKhanDatalist(e.target.value);
        updateEditKhanDatalist(provSelect.value);
    }

    // Populate BU select
    const buSelect = document.getElementById("editBU");
    if (buSelect) {
        buSelect.innerHTML = `<option value="">-- ជ្រើសរើស Business Unit --</option>` +
            AppState.setup.bus.map(b => 
                `<option value="${b.name}" ${order.bu === b.name ? "selected" : ""}>${b.name}</option>`
            ).join("");
    }

    // Populate Document Type select
    const docSelect = document.getElementById("editDocType");
    if (docSelect) {
        docSelect.innerHTML = `<option value="">-- ជ្រើសរើស ប្រភេទឯកសារ --</option>` +
            AppState.setup.documentTypes.map(d => 
                `<option value="${d.name}" ${order.documentType === d.name ? "selected" : ""}>${d.name}</option>`
            ).join("");
    }

    // Populate Package Unit select
    const unitSelect = document.getElementById("editPackageUnit");
    if (unitSelect) {
        unitSelect.innerHTML = AppState.setup.packageTypes.map(u => 
            `<option value="${u.name}" ${order.packageUnit === u.name ? "selected" : ""}>${u.name}${u.short ? ' (' + u.short + ')' : ''}</option>`
        ).join("");
    }

    // Populate values
    const custInput = document.getElementById("editCustomerName");
    if (custInput) custInput.value = order.customerName || "";

    const khanInput = document.getElementById("editKhan");
    if (khanInput) khanInput.value = getCleanEnglishLocation(order.khan) || "";

    const pkInput = document.getElementById("editPackingList");
    if (pkInput) pkInput.value = order.packingListNumber || "";

    const invInput = document.getElementById("editInvoiceNumber");
    if (invInput) invInput.value = order.invoiceNumber || "";

    const amountInput = document.getElementById("editInvoiceAmount");
    if (amountInput) amountInput.value = order.invoiceAmount || 0;

    const currSelect = document.getElementById("editCurrency");
    if (currSelect) currSelect.value = order.currency || "USD";

    const totalPkgInput = document.getElementById("editTotalPackage");
    if (totalPkgInput) totalPkgInput.value = hasOrderTotalPackage(order) ? (order.totalPackage || "") : "";

    const notesInput = document.getElementById("editSpecialNotes");
    if (notesInput) notesInput.value = order.specialNotes || "";

    const payTypeSelect = document.getElementById("editPaymentReceiptType");
    if (payTypeSelect) payTypeSelect.value = order.paymentReceiptType || "";

    const payAmtInput = document.getElementById("editPaymentReceiptAmount");
    if (payAmtInput) payAmtInput.value = (order.paymentReceiptAmount !== undefined && order.paymentReceiptAmount !== null && order.paymentReceiptAmount !== "") ? order.paymentReceiptAmount : "";

    const payCurrSelect = document.getElementById("editPaymentReceiptCurrency");
    if (payCurrSelect) {
        const orderCurr = order.paymentReceiptCurrency || order.paymentAccountCurrency || order.paymentCashCurrency || (order.paymentReceipt && order.paymentReceipt.includes("៛") ? "KHR" : (order.currency || "USD"));
        payCurrSelect.value = (orderCurr === "KHR") ? "KHR" : "USD";
    }

    const editModal = document.getElementById("editOrderModal");
    if (editModal) editModal.classList.remove("hidden");
    lucide.createIcons();
}

function closeEditOrderModal() {
    const editModal = document.getElementById("editOrderModal");
    if (editModal) editModal.classList.add("hidden");
}

async function handleEditOrderSubmit(e) {
    e.preventDefault();
    const originalSoNumber = (document.getElementById("editOrderOriginalSONumber")?.value || "").trim();
    const newSoNumber = (document.getElementById("editOrderSONumber")?.value || "").trim();

    if (!newSoNumber) {
        showToast("សូមបញ្ចូលលេខ SO#!", "error");
        return;
    }

    const orderIndex = AppState.orders.findIndex(o => o.soNumber === (originalSoNumber || newSoNumber));
    if (orderIndex === -1) {
        showToast("រកមិនឃើញ Order នេះឡើយ!", "error");
        return;
    }

    const order = AppState.orders[orderIndex];
    const isSoChanged = originalSoNumber && (originalSoNumber.toLowerCase() !== newSoNumber.toLowerCase());

    // Check duplicate if SO# was changed
    if (isSoChanged) {
        const duplicate = AppState.orders.find(o => 
            o.soNumber.toLowerCase() === newSoNumber.toLowerCase() && 
            o.soNumber.toLowerCase() !== originalSoNumber.toLowerCase()
        );
        if (duplicate) {
            Swal.fire({
                title: "លេខ SO# នេះមានរួចហើយ!",
                text: `លេខ SO# "${newSoNumber}" មានក្នុងប្រព័ន្ធរួចហើយ។ សូមប្រើប្រាស់លេខផ្សេង!`,
                icon: "warning",
                confirmButtonText: "ប្ដូរលេខ SO#",
                confirmButtonColor: "#2563eb"
            });
            return;
        }
    }

    // Determine province display name (pure English)
    const provSelect = document.getElementById("editCityProvince");
    const provId = provSelect ? provSelect.value : "";
    const provDisplayName = getCleanEnglishLocation(provId) || "-";

    // Update SO#
    order.soNumber = newSoNumber;

    // Update highlights set if SO# changed
    if (isSoChanged && AppState.highlightedOrders) {
        if (AppState.highlightedOrders.has(originalSoNumber)) {
            AppState.highlightedOrders.delete(originalSoNumber);
            AppState.highlightedOrders.add(newSoNumber);
            saveHighlightsToStorage();
        }
    }

    // Update Order fields
    order.customerName = document.getElementById("editCustomerName").value.trim() || "-";
    order.cityProvince = provDisplayName;
    order.khan = getCleanEnglishLocation(document.getElementById("editKhan").value.trim());
    order.packingListNumber = document.getElementById("editPackingList").value.trim();
    order.invoiceNumber = document.getElementById("editInvoiceNumber").value.trim();
    order.invoiceAmount = parseFloat(document.getElementById("editInvoiceAmount").value) || 0;
    order.currency = document.getElementById("editCurrency")?.value || "USD";
    const editPkgVal = document.getElementById("editTotalPackage")?.value.trim();
    if (editPkgVal && parseInt(editPkgVal, 10) > 0) {
        order.totalPackage = parseInt(editPkgVal, 10);
        order.packageUnit = document.getElementById("editPackageUnit")?.value || "";
    } else {
        order.totalPackage = "";
        order.packageUnit = "";
    }
    order.bu = document.getElementById("editBU")?.value || "";
    order.documentType = document.getElementById("editDocType")?.value || "";
    order.specialNotes = document.getElementById("editSpecialNotes").value.trim();

    // Update Payment Receipt fields from edit modal
    const editPayType = document.getElementById("editPaymentReceiptType")?.value || "";
    const editPayAmt = parseFloat(document.getElementById("editPaymentReceiptAmount")?.value) || 0;
    const editPayCurr = document.getElementById("editPaymentReceiptCurrency")?.value || "USD";
    order.paymentReceiptType = editPayType;
    order.paymentReceiptAmount = editPayAmt;
    order.paymentReceiptCurrency = editPayCurr;
    order.paymentAccountCurrency = editPayCurr;
    order.paymentCashCurrency = editPayCurr;
    const currSym = (editPayCurr === "KHR") ? "៛" : "$";
    if (editPayType === "Paid to Company Account") {
        order.paymentAccountAmount = editPayAmt;
        order.paymentCashAmount = 0;
        order.paymentReceipt = editPayAmt > 0 ? `Paid to Company Account (${currSym}${editPayAmt.toLocaleString()})` : "Paid to Company Account";
    } else if (editPayType === "Cash") {
        order.paymentCashAmount = editPayAmt;
        order.paymentAccountAmount = 0;
        order.paymentReceipt = editPayAmt > 0 ? `Cash (${currSym}${editPayAmt.toLocaleString()})` : "Cash";
    } else if (editPayType === "Paid to Company Account & Cash") {
        order.paymentReceipt = editPayAmt > 0 ? `Paid (${currSym}${editPayAmt.toLocaleString()})` : "Paid to Company Account & Cash";
    } else {
        order.paymentAccountAmount = 0;
        order.paymentCashAmount = 0;
        order.paymentReceipt = "";
    }

    order.lastUpdated = formatDateTimeDisplay(new Date());

    saveOrdersToStorage();
    renderAll();
    closeEditOrderModal();

    // If orderDetailsModal is open, refresh it with updated data
    const detailsModal = document.getElementById("orderDetailsModal");
    if (detailsModal && !detailsModal.classList.contains("hidden")) {
        viewOrderDetails(order.soNumber);
    }

    // Auto sync to Google Sheets (passing originalSoNumber so row can be updated if SO# changed)
    if (SheetsSync.isConfigured()) {
        SheetsSync.syncOrder(order, originalSoNumber).then(res => {
            if (res && res.success) {
                showToast(`✅ Auto-synced ${order.soNumber} to Google Sheet!`, "success");
            }
        });
    }

    Swal.fire({
        title: "កែប្រែបានជោគជ័យ! 🎉",
        text: isSoChanged
            ? `Order ត្រូវបានប្ដូរលេខ SO# ពី "${originalSoNumber}" ទៅជា "${order.soNumber}" និង Auto-Update ទៅ Google Sheet រួចរាល់។`
            : `Order ${order.soNumber} ត្រូវបានកែប្រែព័ត៌មាន និង Auto-Update ទៅ Google Sheet រួចរាល់។`,
        icon: "success",
        confirmButtonText: "យល់ព្រម",
        confirmButtonColor: "#2563eb"
    });
}

// ========================================================
// PERSONAL DISPLAY (COLUMN VISIBILITY) LOGIC
// ========================================================
function initPersonalDisplay() {
    const btnToggle = document.getElementById("btnPersonalDisplay");
    const menu = document.getElementById("personalDisplayMenu");
    const container = document.getElementById("personalDisplayDropdownContainer");
    const listEl = document.getElementById("columnCheckboxesList");
    const btnSelectAll = document.getElementById("btnSelectAllCols");
    const btnReset = document.getElementById("btnResetCols");

    if (!btnToggle || !menu || !listEl) return;

    function renderCheckboxes() {
        const cardKey = getActiveCardKey();
        const prefs = getColumnPrefs(cardKey);
        
        const cardNameBadge = document.getElementById("personalDisplayCardName");
        if (cardNameBadge) {
            cardNameBadge.textContent = getCardDisplayName(cardKey);
        }

        updatePersonalDisplayCountBadge(prefs);

        listEl.innerHTML = DASHBOARD_COLUMNS.map(col => {
            const isChecked = prefs[col.key] !== false;
            return `
                <label class="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-blue-50/70 border ${isChecked ? 'border-slate-200 bg-white text-slate-800' : 'border-slate-100 bg-slate-50/70 text-slate-400 opacity-60'} cursor-pointer select-none transition shadow-2xs">
                    <input type="checkbox" data-col-key="${col.key}" ${isChecked ? "checked" : ""} class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer accent-blue-600">
                    <span class="font-medium text-xs truncate">${col.label}</span>
                </label>
            `;
        }).join("");

        listEl.querySelectorAll("input[type='checkbox']").forEach(cb => {
            cb.addEventListener("change", () => {
                const key = cb.getAttribute("data-col-key");
                const currentPrefs = getColumnPrefs(cardKey);
                currentPrefs[key] = cb.checked;
                saveColumnPrefs(currentPrefs, cardKey);
                renderCheckboxes();
            });
        });
    }

    function refreshPersonalDisplayMenu() {
        const cardKey = getActiveCardKey();
        const cardNameBadge = document.getElementById("personalDisplayCardName");
        if (cardNameBadge) {
            cardNameBadge.textContent = getCardDisplayName(cardKey);
        }
        updatePersonalDisplayCountBadge();
        renderCheckboxes();
    }
    window.refreshPersonalDisplayMenu = refreshPersonalDisplayMenu;

    btnToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.toggle("hidden");
        if (!menu.classList.contains("hidden")) {
            refreshPersonalDisplayMenu();
        }
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
        if (container && !container.contains(e.target)) {
            menu.classList.add("hidden");
        }
        const dailyT1Container = document.getElementById("dailyT1PersonalDisplayDropdownContainer");
        const dailyT1Menu = document.getElementById("dailyT1PersonalDisplayMenu");
        if (dailyT1Container && dailyT1Menu && !dailyT1Container.contains(e.target)) {
            dailyT1Menu.classList.add("hidden");
        }
        const dailyT2Container = document.getElementById("dailyT2PersonalDisplayDropdownContainer");
        const dailyT2Menu = document.getElementById("dailyT2PersonalDisplayMenu");
        if (dailyT2Container && dailyT2Menu && !dailyT2Container.contains(e.target)) {
            dailyT2Menu.classList.add("hidden");
        }
    });

    if (btnSelectAll) {
        btnSelectAll.addEventListener("click", (e) => {
            e.stopPropagation();
            const cardKey = getActiveCardKey();
            const prefs = {};
            DASHBOARD_COLUMNS.forEach(c => { prefs[c.key] = true; });
            saveColumnPrefs(prefs, cardKey);
            renderCheckboxes();
        });
    }

    if (btnReset) {
        btnReset.addEventListener("click", (e) => {
            e.stopPropagation();
            resetColumnPrefsForActiveCard();
            renderCheckboxes();
            showToast(`បានកំណត់ជួរឈររបស់ "${getCardDisplayName(getActiveCardKey())}" ទៅលំនាំដើម`, "info");
        });
    }

    applyColumnVisibility();
}

// ========================================================
// ROW HIGHLIGHT & CUSTOM COLOR PICKER LOGIC
// ========================================================
const HIGHLIGHT_COLOR_PRESETS = [
    { id: "amber", name: "Amber Yellow", hex: "#eab308", bg: "rgba(254, 240, 138, 0.45)", border: "#facc15" },
    { id: "blue", name: "Sky Blue", hex: "#0284c7", bg: "rgba(186, 230, 253, 0.50)", border: "#38bdf8" },
    { id: "emerald", name: "Emerald Green", hex: "#059669", bg: "rgba(167, 243, 208, 0.50)", border: "#34d399" },
    { id: "purple", name: "Purple", hex: "#7c3aed", bg: "rgba(221, 214, 254, 0.50)", border: "#a78bfa" },
    { id: "rose", name: "Rose Pink", hex: "#e11d48", bg: "rgba(254, 205, 211, 0.50)", border: "#fb7185" },
    { id: "orange", name: "Vibrant Orange", hex: "#ea580c", bg: "rgba(254, 215, 170, 0.55)", border: "#fb923c" }
];

function hexToLightRgba(hex, alpha = 0.45) {
    if (!hex) return `rgba(254, 240, 138, ${alpha})`;
    let cleanHex = hex.replace("#", "");
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split("").map(c => c + c).join("");
    }
    const r = parseInt(cleanHex.substring(0, 2), 16) || 254;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 240;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 138;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function initHighlightSystem() {
    // 1. Load saved color or default
    const savedColor = localStorage.getItem(STORAGE_HIGHLIGHT_COLOR);
    if (savedColor) {
        try {
            AppState.highlightColor = JSON.parse(savedColor);
        } catch (e) {
            AppState.highlightColor = HIGHLIGHT_COLOR_PRESETS[0];
        }
    } else {
        AppState.highlightColor = HIGHLIGHT_COLOR_PRESETS[0];
    }

    // 2. Load highlighted orders
    const savedHighlights = localStorage.getItem(STORAGE_HIGHLIGHTED_ORDERS);
    if (savedHighlights) {
        try {
            const arr = JSON.parse(savedHighlights);
            AppState.highlightedOrders = new Set(Array.isArray(arr) ? arr : []);
        } catch (e) {
            AppState.highlightedOrders = new Set();
        }
    } else {
        AppState.highlightedOrders = new Set();
    }

    // 3. Apply color styles
    applyHighlightColor(AppState.highlightColor, false);
    updateHighlightCountBadge();

    // 4. Setup dropdown UI and swatches
    setupHighlightColorMenu();
}

function applyHighlightColor(colorObj, save = true) {
    if (!colorObj) {
        colorObj = HIGHLIGHT_COLOR_PRESETS[0];
    }
    AppState.highlightColor = colorObj;
    if (save) {
        localStorage.setItem(STORAGE_HIGHLIGHT_COLOR, JSON.stringify(colorObj));
    }

    // Dynamic style element
    let styleEl = document.getElementById("tableHighlightStyles");
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "tableHighlightStyles";
        document.head.appendChild(styleEl);
    }

    const bg = colorObj.bg || hexToLightRgba(colorObj.hex, 0.45);
    const border = colorObj.border || colorObj.hex;

    styleEl.textContent = `
        :root {
            --table-highlight-bg: ${bg};
            --table-highlight-border: ${border};
        }
        tr.order-row-highlighted {
            background-color: var(--table-highlight-bg) !important;
            box-shadow: inset 4px 0 0 var(--table-highlight-border);
        }
        tr.order-row-highlighted td {
            background-color: var(--table-highlight-bg) !important;
        }
        tr.order-row-highlighted:hover {
            filter: brightness(0.97);
        }
    `;

    // Update UI elements in the menu and button
    const swatchPreview = document.getElementById("highlightColorSwatchPreview");
    if (swatchPreview) {
        swatchPreview.style.backgroundColor = colorObj.hex;
    }

    const hexLabel = document.getElementById("customColorHex");
    if (hexLabel) {
        hexLabel.textContent = colorObj.hex.toUpperCase();
    }

    const customInput = document.getElementById("customColorInput");
    if (customInput && customInput.value.toLowerCase() !== colorObj.hex.toLowerCase()) {
        customInput.value = colorObj.hex;
    }

    // Update active ring on swatches
    document.querySelectorAll(".preset-color-btn").forEach(btn => {
        const id = btn.getAttribute("data-preset-id");
        if (id && colorObj.id === id) {
            btn.classList.add("ring-2", "ring-offset-2", "ring-blue-600", "scale-110");
        } else {
            btn.classList.remove("ring-2", "ring-offset-2", "ring-blue-600", "scale-110");
        }
    });
}

function toggleOrderRowHighlight(soNumber, event) {
    if (!soNumber) return;

    if (!AppState.highlightedOrders) {
        AppState.highlightedOrders = new Set();
    }

    const isMultiSelect = event && (event.shiftKey || event.ctrlKey || event.metaKey);

    if (isMultiSelect) {
        // Multi-select mode (holding Shift or Ctrl)
        if (AppState.highlightedOrders.has(soNumber)) {
            AppState.highlightedOrders.delete(soNumber);
        } else {
            AppState.highlightedOrders.add(soNumber);
        }
    } else {
        // Single-select mode:
        // If clicking the only order currently highlighted, toggle it off (unselect)
        const isCurrentlyOnlySelected = AppState.highlightedOrders.has(soNumber) && AppState.highlightedOrders.size === 1;

        AppState.highlightedOrders.clear();

        if (!isCurrentlyOnlySelected) {
            // Select only this clicked order
            AppState.highlightedOrders.add(soNumber);
        }
    }

    // Synchronize highlight visual styling across all visible table rows
    document.querySelectorAll("tr.order-table-row").forEach(row => {
        const rowSo = row.getAttribute("data-so");
        if (rowSo && AppState.highlightedOrders.has(rowSo)) {
            row.classList.add("order-row-highlighted");
            row.classList.remove("hover:bg-slate-50/80");
        } else {
            row.classList.remove("order-row-highlighted");
            row.classList.add("hover:bg-slate-50/80");
        }
    });

    saveHighlightedOrders();
    updateHighlightCountBadge();
}

function saveHighlightedOrders() {
    const list = Array.from(AppState.highlightedOrders || []);
    localStorage.setItem(STORAGE_HIGHLIGHTED_ORDERS, JSON.stringify(list));
}

function clearAllHighlights() {
    if (!AppState.highlightedOrders || AppState.highlightedOrders.size === 0) {
        showToast("មិនមាន Order ណាត្រូវបាន Highlight ទេ", "info");
        return;
    }

    AppState.highlightedOrders.clear();
    saveHighlightedOrders();

    document.querySelectorAll("tr.order-row-highlighted").forEach(row => {
        row.classList.remove("order-row-highlighted");
        row.classList.add("hover:bg-slate-50/80");
    });

    updateHighlightCountBadge();
    showToast("បានដក Highlight ទាំងអស់ចេញពីតារាង", "info");
}

function updateHighlightCountBadge() {
    const badge = document.getElementById("highlightCountBadge");
    if (!badge) return;
    const count = AppState.highlightedOrders ? AppState.highlightedOrders.size : 0;
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove("hidden");
    } else {
        badge.classList.add("hidden");
    }
}

function selectHighlightPreset(presetId) {
    const preset = HIGHLIGHT_COLOR_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    applyHighlightColor(preset, true);
    showToast(`🎨 ពណ៌ Highlight: ${preset.name}`, "info");
}

function setupHighlightColorMenu() {
    const btnToggle = document.getElementById("btnHighlightColor");
    const menu = document.getElementById("highlightColorMenu");
    const container = document.getElementById("highlightColorDropdownContainer");
    const presetsContainer = document.getElementById("presetColorsList");
    const customInput = document.getElementById("customColorInput");
    const clearBtn = document.getElementById("btnClearHighlights");

    if (!btnToggle || !menu) return;

    // Render preset buttons
    if (presetsContainer) {
        presetsContainer.innerHTML = HIGHLIGHT_COLOR_PRESETS.map(p => `
            <button type="button"
                data-preset-id="${p.id}"
                onclick="selectHighlightPreset('${p.id}')"
                class="preset-color-btn w-8 h-8 rounded-xl border border-black/10 transition-transform hover:scale-110 flex items-center justify-center shadow-2xs cursor-pointer ${AppState.highlightColor && AppState.highlightColor.id === p.id ? 'ring-2 ring-offset-2 ring-blue-600 scale-110' : ''}"
                style="background-color: ${p.hex};"
                title="${p.name}">
            </button>
        `).join("");
    }

    // Custom color input listener
    if (customInput) {
        customInput.addEventListener("input", (e) => {
            const hex = e.target.value;
            const customObj = {
                id: "custom",
                name: "Custom",
                hex: hex,
                bg: hexToLightRgba(hex, 0.40),
                border: hex
            };
            applyHighlightColor(customObj, true);
        });
    }

    // Clear highlights button
    if (clearBtn) {
        clearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            clearAllHighlights();
        });
    }

    // Dropdown toggle
    btnToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.toggle("hidden");
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
        if (container && !container.contains(e.target)) {
            menu.classList.add("hidden");
        }
        const dailyT1Container = document.getElementById("dailyT1PersonalDisplayDropdownContainer");
        const dailyT1Menu = document.getElementById("dailyT1PersonalDisplayMenu");
        if (dailyT1Container && dailyT1Menu && !dailyT1Container.contains(e.target)) {
            dailyT1Menu.classList.add("hidden");
        }
        const dailyT2Container = document.getElementById("dailyT2PersonalDisplayDropdownContainer");
        const dailyT2Menu = document.getElementById("dailyT2PersonalDisplayMenu");
        if (dailyT2Container && dailyT2Menu && !dailyT2Container.contains(e.target)) {
            dailyT2Menu.classList.add("hidden");
        }
    });
}

// Quick jump to next logical action
function quickActionNavigate(soNumber) {
    const order = AppState.orders.find(o => o.soNumber === soNumber);
    if (!order) return;

    if (!order.pickingEndTime) {
        switchTab("picking");
    } else if (!order.checkingEndTime) {
        switchTab("checking");
    } else {
        switchTab("delivery");
    }
}

// ========================================================
// MODULE 5: SETUP MASTER DATA (CONTROLLERS & CRUD)
// ========================================================

// Ensure every setup item has an ID
function ensureSetupIds() {
    if (AppState.setup.customers) {
        AppState.setup.customers.forEach((c, idx) => {
            if (!c.id) c.id = `CUST-${String(idx + 1).padStart(3, '0')}`;
        });
    }
    if (AppState.setup.bus) {
        AppState.setup.bus.forEach((b, idx) => {
            if (!b.id) b.id = `BU-${String(idx + 1).padStart(3, '0')}`;
        });
    }
    if (AppState.setup.packageTypes) {
        AppState.setup.packageTypes.forEach((p, idx) => {
            if (!p.id) p.id = `PKG-${String(idx + 1).padStart(3, '0')}`;
        });
    }
    if (AppState.setup.documentTypes) {
        AppState.setup.documentTypes.forEach((d, idx) => {
            if (!d.id) d.id = `DOC-${String(idx + 1).padStart(3, '0')}`;
        });
    }
    if (AppState.setup.users) {
        AppState.setup.users.forEach((u, idx) => {
            if (!u.id) u.id = `USR-${String(idx + 1).padStart(3, '0')}`;
        });
    }
}

// Switch Setup Sub-Tab (customer, bu, package, doc, user)
function switchSetupSubTab(subTabName) {
    const user = getCurrentUser();
    if (subTabName === "user" && (!user || user.role !== "Admin")) {
        subTabName = "customer";
    }
    AppState.currentSetupSubTab = subTabName;
    const subTabs = ["customer", "bu", "package", "doc", "user"];

    subTabs.forEach(tab => {
        const btn = document.getElementById(`setupTabBtn-${tab}`);
        const panel = document.getElementById(`setupPanel-${tab}`);
        const badge = document.getElementById(
            tab === "customer" ? "badgeCountCustomer" :
            tab === "bu" ? "badgeCountBU" :
            tab === "package" ? "badgeCountPkg" :
            tab === "doc" ? "badgeCountDoc" : "badgeCountUser"
        );

        if (tab === subTabName) {
            if (btn) {
                btn.className = "setup-subtab-btn flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition bg-blue-600 text-white shadow-xs";
                const icon = btn.querySelector("i");
                if (icon) icon.className = "w-4 h-4 text-white";
            }
            if (badge) {
                badge.className = "px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white";
            }
            if (panel) panel.classList.remove("hidden");
        } else {
            if (btn) {
                btn.className = "setup-subtab-btn flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition text-slate-600 hover:bg-slate-100";
                const icon = btn.querySelector("i");
                if (icon) icon.className = "w-4 h-4 text-slate-500";
            }
            if (badge) {
                badge.className = "px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700";
            }
            if (panel) panel.classList.add("hidden");
        }
    });

    if (subTabName === "customer") renderCustomerSetupTable();
    if (subTabName === "bu") renderBUSetupTable();
    if (subTabName === "package") renderPackageTypeSetupTable();
    if (subTabName === "doc") renderDocTypeSetupTable();
    if (subTabName === "user") renderUserSetupTable();

    lucide.createIcons();
}

// =========================================================================
// MODULE: REPORT & ANALYTICS (របាយការណ៍លម្អិត & EXPORT EXCEL)
// =========================================================================

// Calculate Duration strictly in hh:mm format (end - start)
function calculateDurationHhMm(startStr, endStr) {
    if (!startStr || !endStr || startStr === "-" || endStr === "-") return "-";
    const startDate = parseAppDateTime(startStr);
    const endDate = parseAppDateTime(endStr);
    if (!startDate || !endDate) return "-";

    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 0) return "-";

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
window.calculateDurationHhMm = calculateDurationHhMm;

// Format SO Date as dd/mm/yy
function formatSoDateDisplay(dateVal) {
    if (!dateVal || dateVal === "-" || String(dateVal).trim() === "") return "-";
    const d = parseAppDateTime(dateVal);
    const pad = n => String(n).padStart(2, '0');
    if (d && !isNaN(d.getTime())) {
        const yy = String(d.getFullYear()).slice(-2);
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${yy}`;
    }
    // Fallback if string cannot be parsed directly by parseAppDateTime
    const raw = String(dateVal).trim().split(" ")[0];
    const slashParts = raw.split("/");
    if (slashParts.length === 3) {
        const dd = pad(slashParts[0]);
        const mm = pad(slashParts[1]);
        const yy = slashParts[2].length === 4 ? slashParts[2].slice(-2) : pad(slashParts[2]);
        return `${dd}/${mm}/${yy}`;
    }
    const dashParts = raw.split("-");
    if (dashParts.length === 3) {
        if (dashParts[0].length === 4) {
            return `${pad(dashParts[2])}/${pad(dashParts[1])}/${dashParts[0].slice(-2)}`;
        }
    }
    return raw || "-";
}
window.formatSoDateDisplay = formatSoDateDisplay;

// Extract SO Date timestamp for precise chronological sorting
function getOrderSoDateTimestamp(order) {
    if (!order) return 0;
    const dateVal = order.timestamp || order.soDate || order.so_date || order.date || order.lastUpdated || order.pickingStartTime || order.createdAt;
    if (!dateVal || dateVal === "-" || String(dateVal).trim() === "") return 0;

    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
        return dateVal.getTime();
    }
    if (typeof dateVal === 'number' && !isNaN(dateVal)) {
        return dateVal;
    }

    const d = parseAppDateTime(dateVal);
    if (d && !isNaN(d.getTime())) return d.getTime();

    const str = String(dateVal).trim();
    const parsedNative = Date.parse(str.replace(" ", "T"));
    if (!isNaN(parsedNative)) return parsedNative;

    // Fallback if string formatted as dd/mm/yy or dd/mm/yyyy
    const raw = str.split(" ")[0];
    if (raw.includes("/")) {
        const parts = raw.split("/");
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            const testD = new Date(year, month, day);
            if (!isNaN(testD.getTime())) return testD.getTime();
        }
    } else if (raw.includes("-")) {
        const parts = raw.split("-");
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                const testD = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                if (!isNaN(testD.getTime())) return testD.getTime();
            } else {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                let year = parseInt(parts[2], 10);
                if (year < 100) year += 2000;
                const testD = new Date(year, month, day);
                if (!isNaN(testD.getTime())) return testD.getTime();
            }
        }
    }
    return 0;
}
window.getOrderSoDateTimestamp = getOrderSoDateTimestamp;

// Set Report SO Date Sort Explicitly ("asc" for A-Z, "desc" for Z-A)
function setReportSoDateSort(direction) {
    if (!AppState.report) {
        AppState.report = { 
            activeTab: "register", 
            filterYear: "ALL", 
            filterMonth: "ALL", 
            filterFromDate: "", 
            filterToDate: "", 
            searchQuery: "", 
            currentPage: 1, 
            pageSize: 10,
            sortColumn: "soDate",
            sortDirection: "desc"
        };
    }

    AppState.report.sortColumn = "soDate";
    AppState.report.sortDirection = (direction === "asc" || direction === "ascend" || direction === "a-z") ? "asc" : "desc";
    AppState.report.currentPage = 1;
    renderReportView();
}
window.setReportSoDateSort = setReportSoDateSort;

// Toggle SO Date Sort (Ascending / Descending) in Report Table
function toggleReportSoDateSort() {
    if (!AppState.report) {
        AppState.report = { 
            activeTab: "register", 
            filterYear: "ALL", 
            filterMonth: "ALL", 
            filterFromDate: "", 
            filterToDate: "", 
            searchQuery: "", 
            currentPage: 1, 
            pageSize: 10,
            sortColumn: "soDate",
            sortDirection: "desc"
        };
    }

    if (AppState.report.sortColumn === "soDate") {
        AppState.report.sortDirection = AppState.report.sortDirection === "asc" ? "desc" : "asc";
    } else {
        AppState.report.sortColumn = "soDate";
        AppState.report.sortDirection = "desc";
    }

    // Reset to page 1 to see the sorted results from beginning
    AppState.report.currentPage = 1;
    renderReportView();
}
window.toggleReportSoDateSort = toggleReportSoDateSort;

// Toggle SO Date Excel-style Dropdown Menu (ដូចរូបទី២)
function toggleReportSoDateMenu(event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const menu = document.getElementById("reportSoDateDropdownMenu");
    if (!menu) return;
    const btn = document.getElementById("reportSoDateDropdownBtn");

    if (menu.classList.contains("hidden")) {
        // Sync active checkmarks and highlight in dropdown
        const isAsc = (AppState.report && AppState.report.sortDirection === "asc");
        const optAsc = document.getElementById("reportMenuOptAsc");
        const optDesc = document.getElementById("reportMenuOptDesc");
        const checkAsc = document.getElementById("reportMenuCheckAsc");
        const checkDesc = document.getElementById("reportMenuCheckDesc");

        if (optAsc && optDesc) {
            if (isAsc) {
                optAsc.classList.add("bg-indigo-50/90", "text-indigo-700");
                optDesc.classList.remove("bg-indigo-50/90", "text-indigo-700");
                if (checkAsc) checkAsc.classList.remove("hidden");
                if (checkDesc) checkDesc.classList.add("hidden");
            } else {
                optDesc.classList.add("bg-indigo-50/90", "text-indigo-700");
                optAsc.classList.remove("bg-indigo-50/90", "text-indigo-700");
                if (checkDesc) checkDesc.classList.remove("hidden");
                if (checkAsc) checkAsc.classList.add("hidden");
            }
        }

        // Dynamically position dropdown menu right below SO Date column header
        if (btn) {
            const btnRect = btn.getBoundingClientRect();
            const th = btn.closest("th");
            const thRect = th ? th.getBoundingClientRect() : btnRect;

            menu.style.position = "fixed";
            const menuHeight = 125;
            let topPos = Math.round(btnRect.bottom + 4);
            if (btnRect.bottom + menuHeight > window.innerHeight && btnRect.top > menuHeight) {
                topPos = Math.max(10, Math.round(btnRect.top - menuHeight - 4));
            }

            const menuWidth = 224;
            let leftPos = Math.round(thRect.left);
            const maxLeft = window.innerWidth - menuWidth - 12;
            if (leftPos > maxLeft) leftPos = maxLeft;
            if (leftPos < 12) leftPos = 12;

            menu.style.top = `${topPos}px`;
            menu.style.left = `${leftPos}px`;
            menu.style.zIndex = "99999";
        }

        menu.classList.remove("hidden");
        lucide.createIcons();
    } else {
        menu.classList.add("hidden");
    }
}
window.toggleReportSoDateMenu = toggleReportSoDateMenu;

// Select sort direction from dropdown menu
function selectReportSortDirection(direction) {
    const menu = document.getElementById("reportSoDateDropdownMenu");
    if (menu) menu.classList.add("hidden");
    setReportSoDateSort(direction);
}
window.selectReportSortDirection = selectReportSortDirection;

// Automatically close SO Date and Dashboard Date & Time dropdown when clicking outside or scrolling
if (!window._tableSortMenuListenerAttached) {
    window._tableSortMenuListenerAttached = true;
    document.addEventListener("click", function(e) {
        // Report SO Date Menu
        const repMenu = document.getElementById("reportSoDateDropdownMenu");
        if (repMenu && !repMenu.classList.contains("hidden")) {
            const repBtn = document.getElementById("reportSoDateDropdownBtn");
            if (!repMenu.contains(e.target) && (!repBtn || !repBtn.contains(e.target))) {
                repMenu.classList.add("hidden");
            }
        }
        // Dashboard Date & Time Menu
        const dashMenu = document.getElementById("dashboardDateTimeDropdownMenu");
        if (dashMenu && !dashMenu.classList.contains("hidden")) {
            const dashBtn = document.getElementById("dashboardDateTimeDropdownBtn") || document.getElementById("dashboardThDateTime");
            if (!dashMenu.contains(e.target) && (!dashBtn || !dashBtn.contains(e.target))) {
                dashMenu.classList.add("hidden");
            }
        }
    });

    // Close on any scroll (window scroll or table overflow scroll)
    window.addEventListener("scroll", function() {
        const repMenu = document.getElementById("reportSoDateDropdownMenu");
        if (repMenu && !repMenu.classList.contains("hidden")) {
            repMenu.classList.add("hidden");
        }
        const dashMenu = document.getElementById("dashboardDateTimeDropdownMenu");
        if (dashMenu && !dashMenu.classList.contains("hidden")) {
            dashMenu.classList.add("hidden");
        }
    }, { capture: true, passive: true });
}

// Format Invoice amount with currency
function formatInvoiceAmountWithCurrency(amount, currency) {
    if (amount === null || amount === undefined || amount === "" || amount === "-") return "-";
    const num = Number(String(amount).replace(/[^0-9.-]+/g, ""));
    if (isNaN(num)) return `${amount} ${currency || ""}`.trim();
    const curr = (currency || "$").trim();
    if (curr === "$" || curr.toUpperCase() === "USD") {
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${num.toLocaleString('en-US')} ${curr}`;
}
window.formatInvoiceAmountWithCurrency = formatInvoiceAmountWithCurrency;

// Format Total package with package unit
function formatPackageWithUnit(pkg, unit) {
    if (pkg === undefined || pkg === null || pkg === "" || Number(pkg) <= 0) {
        return "-";
    }
    const u = (unit && String(unit).trim()) ? unit.trim() : "Carton";
    return `${pkg} ${u}`;
}
window.formatPackageWithUnit = formatPackageWithUnit;

// Extract date object for an order based on current report stage
function getOrderDateObj(order, stage = "register") {
    let dateStr = "";
    if (stage === "picking") {
        dateStr = order.pickingStartTime || order.timestamp;
    } else if (stage === "checking") {
        dateStr = order.checkingStartTime || order.timestamp;
    } else if (stage === "delivery") {
        dateStr = order.deliveryStartTime || order.timestamp;
    } else {
        dateStr = order.timestamp;
    }
    return parseAppDateTime(dateStr) || (order.timestamp ? parseAppDateTime(order.timestamp) : null);
}

// Switch Report Sub-tab (register, picking, checking, delivery)
function switchReportTab(subTab) {
    const menu = document.getElementById("reportSoDateDropdownMenu");
    if (menu) menu.classList.add("hidden");
    if (!AppState.report) {
        AppState.report = { activeTab: "register", filterYear: "ALL", filterMonth: "ALL", filterFromDate: "", filterToDate: "", searchQuery: "", currentPage: 1, pageSize: 10 };
    }
    AppState.report.activeTab = subTab;
    AppState.report.currentPage = 1;
    renderReportView();
}
window.switchReportTab = switchReportTab;

// Populate Report Year Dropdown dynamically
function populateReportYearFilter() {
    const yearSelect = document.getElementById("reportFilterYear");
    if (!yearSelect) return;

    const currentYear = new Date().getFullYear();
    const yearsSet = new Set([currentYear]);

    AppState.orders.forEach(o => {
        const d = parseAppDateTime(o.timestamp);
        if (d && !isNaN(d.getFullYear())) {
            yearsSet.add(d.getFullYear());
        }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
    const selectedVal = (AppState.report && AppState.report.filterYear) ? AppState.report.filterYear : "ALL";

    let html = `<option value="ALL" ${selectedVal === "ALL" ? "selected" : ""}>All Years (គ្រប់ឆ្នាំ)</option>`;
    sortedYears.forEach(y => {
        html += `<option value="${y}" ${String(selectedVal) === String(y) ? "selected" : ""}>${y}</option>`;
    });

    yearSelect.innerHTML = html;
}

// Filter Change Handler for Report
const debouncedRenderReportView = debounce(() => renderReportView(), 180);

function onReportFilterChange() {
    if (!AppState.report) {
        AppState.report = { activeTab: "register", filterYear: "ALL", filterMonth: "ALL", filterFromDate: "", filterToDate: "", searchQuery: "", currentPage: 1, pageSize: 10 };
    }
    const yearEl = document.getElementById("reportFilterYear");
    const monthEl = document.getElementById("reportFilterMonth");
    const fromEl = document.getElementById("reportFilterFromDate");
    const toEl = document.getElementById("reportFilterToDate");
    const searchEl = document.getElementById("reportFilterSearch");

    AppState.report.filterYear = yearEl ? yearEl.value : "ALL";
    AppState.report.filterMonth = monthEl ? monthEl.value : "ALL";
    AppState.report.filterFromDate = fromEl ? fromEl.value : "";
    AppState.report.filterToDate = toEl ? toEl.value : "";
    AppState.report.searchQuery = searchEl ? searchEl.value.toLowerCase().trim() : "";
    AppState.report.currentPage = 1;

    debouncedRenderReportView();
}
window.onReportFilterChange = onReportFilterChange;

// Reset Report Filters
function resetReportFilters() {
    const menu = document.getElementById("reportSoDateDropdownMenu");
    if (menu) menu.classList.add("hidden");
    if (!AppState.report) {
        AppState.report = { activeTab: "register", filterYear: "ALL", filterMonth: "ALL", filterFromDate: "", filterToDate: "", searchQuery: "", currentPage: 1, pageSize: 10, sortColumn: "soDate", sortDirection: "desc" };
    }
    AppState.report.filterYear = "ALL";
    AppState.report.filterMonth = "ALL";
    AppState.report.filterFromDate = "";
    AppState.report.filterToDate = "";
    AppState.report.searchQuery = "";
    AppState.report.currentPage = 1;
    AppState.report.sortColumn = "soDate";
    AppState.report.sortDirection = "desc";

    const yearEl = document.getElementById("reportFilterYear");
    const monthEl = document.getElementById("reportFilterMonth");
    const fromEl = document.getElementById("reportFilterFromDate");
    const toEl = document.getElementById("reportFilterToDate");
    const searchEl = document.getElementById("reportFilterSearch");

    if (yearEl) yearEl.value = "ALL";
    if (monthEl) monthEl.value = "ALL";
    if (fromEl) fromEl.value = "";
    if (toEl) toEl.value = "";
    if (searchEl) searchEl.value = "";

    renderReportView();
}
window.resetReportFilters = resetReportFilters;

// Get filtered orders for a report sub-tab
function getFilteredReportOrders(subTab = "register") {
    const rep = AppState.report || { filterYear: "ALL", filterMonth: "ALL", filterFromDate: "", filterToDate: "", searchQuery: "" };
    
    const filtered = AppState.orders.filter(order => {
        // 1. Stage filter
        if (subTab === "picking") {
            const hasPick = !!(order.pickingStartTime || order.pickerBy || (order.status && order.status.toLowerCase().includes("picking")));
            const isBeyond = !!(order.checkingStartTime || order.deliveryStartTime || order.deliveryEndTime);
            if (!hasPick && !isBeyond) return false;
        } else if (subTab === "checking") {
            const hasCheck = !!(order.checkingStartTime || order.checkerBy || (order.status && order.status.toLowerCase().includes("checking")));
            const isBeyond = !!(order.deliveryStartTime || order.deliveryEndTime);
            if (!hasCheck && !isBeyond) return false;
        } else if (subTab === "delivery") {
            const hasDeliv = !!(order.deliveryStartTime || order.deliveryBy || (order.status && (order.status.toLowerCase().includes("delivery") || order.status.toLowerCase().includes("success") || order.status.toLowerCase().includes("incomplete") || order.status.toLowerCase().includes("return"))));
            if (!hasDeliv) return false;
        }

        // 2. Date filters (By Year, By Month, From Date to Date)
        const dateObj = getOrderDateObj(order, subTab);
        if (dateObj) {
            // Filter by Year
            if (rep.filterYear && rep.filterYear !== "ALL") {
                if (dateObj.getFullYear() !== parseInt(rep.filterYear, 10)) {
                    return false;
                }
            }
            // Filter by Month (1-12)
            if (rep.filterMonth && rep.filterMonth !== "ALL") {
                if ((dateObj.getMonth() + 1) !== parseInt(rep.filterMonth, 10)) {
                    return false;
                }
            }
            // Filter from Date
            if (rep.filterFromDate) {
                const fromD = new Date(rep.filterFromDate + "T00:00:00");
                if (dateObj < fromD) return false;
            }
            // Filter to Date
            if (rep.filterToDate) {
                const toD = new Date(rep.filterToDate + "T23:59:59");
                if (dateObj > toD) return false;
            }
        } else {
            if ((rep.filterYear && rep.filterYear !== "ALL") || (rep.filterMonth && rep.filterMonth !== "ALL") || rep.filterFromDate || rep.filterToDate) {
                return false;
            }
        }

        // 3. Search Query filter
        if (rep.searchQuery) {
            const q = rep.searchQuery.toLowerCase();
            const textToMatch = [
                order.soNumber,
                order.customerName,
                order.cityProvince,
                order.khan,
                order.packingListNumber,
                order.invoiceNumber,
                order.bu,
                order.documentType,
                order.specialNotes,
                order.status,
                order.createdBy,
                order.pickerBy,
                order.checkerBy,
                order.deliveryBy
            ].filter(Boolean).join(" ").toLowerCase();

            if (!textToMatch.includes(q)) return false;
        }

        return true;
    });

    // 4. Sort Orders by SO Date (Ascending A-Z or Descending Z-A)
    const sortCol = rep.sortColumn || "soDate";
    const sortDir = rep.sortDirection || "desc";

    if (sortCol === "soDate") {
        const factor = sortDir === "asc" ? 1 : -1;
        filtered.sort((a, b) => {
            const timeA = getOrderSoDateTimestamp(a);
            const timeB = getOrderSoDateTimestamp(b);
            if (timeA !== timeB) {
                return (timeA - timeB) * factor;
            }
            return String(a.soNumber || "").localeCompare(String(b.soNumber || ""), undefined, { numeric: true }) * factor;
        });
    }

    return filtered;
}
window.getFilteredReportOrders = getFilteredReportOrders;

// Headers list matching prompt specs for each sub-tab
function getReportHeaders(subTab) {
    const common = [
        "Status",
        "SO Date",
        "SO#",
        "Customer Name",
        "City / Province",
        "Khan / District",
        "Packing List#",
        "Invoice#",
        "Invoice Amount",
        "Total Package",
        "BU",
        "Document Type",
        "Special Note",
        "Payment Receipt"
    ];

    if (subTab === "register") {
        return [...common, "Registered By"];
    } else if (subTab === "picking") {
        return [...common, "Picking Start", "Picking End", "Picker By", "Duration Picking (hh:mm)"];
    } else if (subTab === "checking") {
        return [...common, "Checking Start", "Checking End", "Checker By", "Duration Checking (hh:mm)"];
    } else if (subTab === "delivery") {
        return [...common, "Delivery Start", "Delivery End", "Delivery By", "Duration Delivery (hh:mm)"];
    } else if (subTab === "master") {
        return [
            ...common,
            "Registered By",
            "Picking Start",
            "Picking End",
            "Picker By",
            "Duration Picking (hh:mm)",
            "Checking Start",
            "Checking End",
            "Checker By",
            "Duration Checking (hh:mm)",
            "Delivery Start",
            "Delivery End",
            "Delivery By",
            "Duration Delivery (hh:mm)"
        ];
    }
    return common;
}

// Row data array matching headers for Excel Export
function getReportRowData(order, subTab) {
    const common = [
        order.status || "Registered",
        formatSoDateDisplay(order.timestamp || order.soDate || order.so_date || order.date),
        order.soNumber || "-",
        order.customerName || "-",
        order.cityProvince || "-",
        order.khan || "-",
        order.packingListNumber || "-",
        order.invoiceNumber || "-",
        formatInvoiceAmountWithCurrency(order.invoiceAmount, order.currency),
        formatPackageWithUnit(order.totalPackage, order.packageUnit),
        order.bu || "-",
        order.documentType || "SO to customer",
        order.specialNotes || "-",
        formatPaymentReceiptDisplay(order)
    ];

    if (subTab === "register") {
        return [...common, order.createdBy || "Admin"];
    } else if (subTab === "picking") {
        return [
            ...common,
            order.pickingStartTime ? formatDateTimeDisplay(order.pickingStartTime) : "-",
            order.pickingEndTime ? formatDateTimeDisplay(order.pickingEndTime) : "-",
            order.pickerBy || "-",
            calculateDurationHhMm(order.pickingStartTime, order.pickingEndTime)
        ];
    } else if (subTab === "checking") {
        return [
            ...common,
            order.checkingStartTime ? formatDateTimeDisplay(order.checkingStartTime) : "-",
            order.checkingEndTime ? formatDateTimeDisplay(order.checkingEndTime) : "-",
            order.checkerBy || "-",
            calculateDurationHhMm(order.checkingStartTime, order.checkingEndTime)
        ];
    } else if (subTab === "delivery") {
        return [
            ...common,
            order.deliveryStartTime ? formatDateTimeDisplay(order.deliveryStartTime) : "-",
            order.deliveryEndTime ? formatDateTimeDisplay(order.deliveryEndTime) : "-",
            order.deliveryBy || "-",
            calculateDurationHhMm(order.deliveryStartTime, order.deliveryEndTime)
        ];
    } else if (subTab === "master") {
        return [
            ...common,
            order.createdBy || "Admin",
            order.pickingStartTime ? formatDateTimeDisplay(order.pickingStartTime) : "-",
            order.pickingEndTime ? formatDateTimeDisplay(order.pickingEndTime) : "-",
            order.pickerBy || "-",
            calculateDurationHhMm(order.pickingStartTime, order.pickingEndTime),
            order.checkingStartTime ? formatDateTimeDisplay(order.checkingStartTime) : "-",
            order.checkingEndTime ? formatDateTimeDisplay(order.checkingEndTime) : "-",
            order.checkerBy || "-",
            calculateDurationHhMm(order.checkingStartTime, order.checkingEndTime),
            order.deliveryStartTime ? formatDateTimeDisplay(order.deliveryStartTime) : "-",
            order.deliveryEndTime ? formatDateTimeDisplay(order.deliveryEndTime) : "-",
            order.deliveryBy || "-",
            calculateDurationHhMm(order.deliveryStartTime, order.deliveryEndTime)
        ];
    }
    return common;
}

// Render Report View
function renderReportView() {
    const reportSection = document.getElementById("view-report");
    if (!reportSection) return;

    if (!AppState.report) {
        AppState.report = { activeTab: "register", filterYear: "ALL", filterMonth: "ALL", filterFromDate: "", filterToDate: "", searchQuery: "", currentPage: 1, pageSize: 10 };
    }
    const currentSubTab = AppState.report.activeTab || "register";

    // 1. Update Sub-Tabs Navigation Styling and Counter Badges
    const tabs = ["register", "picking", "checking", "delivery", "master"];
    const subTabLabels = {
        "register": "1. Register order",
        "picking": "2. Physical Picking",
        "checking": "3. Physical Checking",
        "delivery": "4. Delivery",
        "master": "5. Master Report"
    };

    tabs.forEach(t => {
        const btn = document.getElementById(`reportTabBtn-${t}`);
        const countBadge = document.getElementById(`reportCount-${t}`);
        const filteredCount = getFilteredReportOrders(t).length;

        if (countBadge) {
            countBadge.textContent = filteredCount;
        }

        if (btn) {
            if (t === currentSubTab) {
                btn.className = "report-subtab-btn py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300";
                if (countBadge) countBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white";
            } else {
                btn.className = "report-subtab-btn py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50";
                if (countBadge) countBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600";
            }
        }
    });

    // Update Header Active Badge
    const activeBadge = document.getElementById("reportActiveBadge");
    if (activeBadge) {
        activeBadge.textContent = subTabLabels[currentSubTab] || "Register order";
    }

    // 2. Populate Year Filter Options
    populateReportYearFilter();

    // 3. Get Filtered Orders for the Active Sub-Tab
    const filteredOrders = getFilteredReportOrders(currentSubTab);
    const totalOrders = filteredOrders.length;
    const pageSize = AppState.report.pageSize || 10;
    const totalPages = Math.ceil(totalOrders / pageSize) || 1;

    if (AppState.report.currentPage > totalPages) AppState.report.currentPage = totalPages;
    if (AppState.report.currentPage < 1) AppState.report.currentPage = 1;

    // 4. Update KPI Summary Metric Cards
    let invoiceUSD = 0, invoiceKHR = 0;
    let countInvoiceUSD = 0, countInvoiceKHR = 0;
    let totalPackages = 0;
    let accountUSD = 0, accountKHR = 0;
    let cashUSD = 0, cashKHR = 0;
    let paidOrdersCount = 0;

    filteredOrders.forEach(o => {
        const amt = Number(String(o.invoiceAmount || 0).replace(/[^0-9.-]+/g, ""));
        const rawCurr = String(o.currency || "$").trim().toUpperCase();
        const isKHR = (rawCurr === "KHR" || rawCurr === "៛");

        if (!isNaN(amt) && amt > 0) {
            if (isKHR) {
                invoiceKHR += amt;
                countInvoiceKHR++;
            } else {
                invoiceUSD += amt;
                countInvoiceUSD++;
            }
        }

        if (hasOrderTotalPackage(o)) {
            const pkg = Number(String(o.totalPackage || 0).replace(/[^0-9.-]+/g, ""));
            if (!isNaN(pkg)) totalPackages += pkg;
        }

        // Aggregate Payment Receipt (Company Account & Cash with Currency)
        const rawReceipt = String(o.paymentReceipt || "").trim();
        const hasReceipt = rawReceipt && rawReceipt !== "-";
        const payType = o.paymentReceiptType || "";
        let accAmt = Number(o.paymentAccountAmount || 0);
        let cashAmt = Number(o.paymentCashAmount || 0);
        const totalPayAmt = Number(o.paymentReceiptAmount || 0);

        // Fallback for older orders or string-only data
        if (accAmt === 0 && cashAmt === 0 && (totalPayAmt > 0 || hasReceipt)) {
            if (payType === "Paid to Company Account") {
                accAmt = totalPayAmt;
            } else if (payType === "Cash") {
                cashAmt = totalPayAmt;
            } else if (hasReceipt) {
                const isCash = /cash/i.test(rawReceipt);
                const isAcc = /company account|aba|acleda|wing/i.test(rawReceipt);
                if (isAcc && isCash) {
                    const mAcc = rawReceipt.match(/Company Account:\s*([$៛]?)\s*([\d,]+(?:\.\d+)?)/i);
                    const mCash = rawReceipt.match(/Cash:\s*([$៛]?)\s*([\d,]+(?:\.\d+)?)/i);
                    if (mAcc) accAmt = parseFloat(mAcc[2].replace(/,/g, "")) || 0;
                    if (mCash) cashAmt = parseFloat(mCash[2].replace(/,/g, "")) || 0;
                } else if (isAcc) {
                    const m = rawReceipt.match(/([$៛]?)\s*([\d,]+(?:\.\d+)?)/);
                    if (m) accAmt = parseFloat(m[2].replace(/,/g, "")) || totalPayAmt;
                } else if (isCash) {
                    const m = rawReceipt.match(/([$៛]?)\s*([\d,]+(?:\.\d+)?)/);
                    if (m) cashAmt = parseFloat(m[2].replace(/,/g, "")) || totalPayAmt;
                }
            }
        }

        if (accAmt > 0 || cashAmt > 0 || hasReceipt) {
            paidOrdersCount++;
        }

        const { accCurr, cashCurr } = getPaymentReceiptCurrencies(o);

        if (accAmt > 0) {
            if (accCurr === "KHR") accountKHR += accAmt;
            else accountUSD += accAmt;
        }
        if (cashAmt > 0) {
            if (cashCurr === "KHR") cashKHR += cashAmt;
            else cashUSD += cashAmt;
        }
    });

    const sumTotalOrders = document.getElementById("reportSummaryTotalOrders");
    const elInvoiceUSD = document.getElementById("reportSummaryInvoiceUSD");
    const elInvoiceKHR = document.getElementById("reportSummaryInvoiceKHR");
    const elInvoiceBadge = document.getElementById("reportSummaryInvoiceBadge");
    const sumTotalAmount = document.getElementById("reportSummaryTotalAmount");
    const sumTotalPackages = document.getElementById("reportSummaryTotalPackages");
    const elPayAccount = document.getElementById("reportSummaryPaymentAccount");
    const elPayCash = document.getElementById("reportSummaryPaymentCash");
    const elPayBadge = document.getElementById("reportSummaryPaymentReceiptBadge");
    const elPayTotal = document.getElementById("reportSummaryPaymentTotal");

    if (sumTotalOrders) sumTotalOrders.textContent = totalOrders.toLocaleString();
    if (sumTotalPackages) sumTotalPackages.textContent = totalPackages.toLocaleString();

    // KPI Card 2: Invoice Amount Breakdown by Currency
    if (elInvoiceUSD) {
        elInvoiceUSD.textContent = `$${invoiceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    if (elInvoiceKHR) {
        elInvoiceKHR.textContent = `៛${invoiceKHR.toLocaleString('en-US')}`;
    }

    const elInvoiceCount = document.getElementById("reportSummaryInvoiceOrdersCount");
    if (elInvoiceCount) {
        elInvoiceCount.textContent = `${totalOrders.toLocaleString()} orders`;
    }

    if (elInvoiceBadge) {
        if (invoiceUSD > 0 && invoiceKHR > 0) {
            elInvoiceBadge.textContent = "USD & KHR";
            elInvoiceBadge.className = "text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-mono";
        } else if (invoiceKHR > 0) {
            elInvoiceBadge.textContent = "KHR only";
            elInvoiceBadge.className = "text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70 font-mono";
        } else {
            elInvoiceBadge.textContent = "USD only";
            elInvoiceBadge.className = "text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-mono";
        }
    }

    if (sumTotalAmount) {
        const invParts = [];
        if (invoiceUSD > 0) invParts.push(`$${invoiceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        if (invoiceKHR > 0) invParts.push(`៛${invoiceKHR.toLocaleString('en-US')}`);
        sumTotalAmount.textContent = invParts.join(" | ") || "$0.00";
    }

    function formatPaymentCurrencyPair(usd, khr) {
        const parts = [];
        if (usd > 0) parts.push(`<span class="text-emerald-600 font-bold">$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`);
        if (khr > 0) parts.push(`<span class="text-amber-600 font-bold">៛${khr.toLocaleString('en-US')}</span>`);
        if (parts.length === 0) return '<span class="text-slate-400 font-normal">$0.00</span>';
        return parts.join(' <span class="text-slate-300 font-normal">|</span> ');
    }

    if (elPayAccount) elPayAccount.innerHTML = formatPaymentCurrencyPair(accountUSD, accountKHR);
    if (elPayCash) elPayCash.innerHTML = formatPaymentCurrencyPair(cashUSD, cashKHR);
    if (elPayBadge) elPayBadge.textContent = `${paidOrdersCount.toLocaleString()} paid`;

    const totalPayUSD = accountUSD + cashUSD;
    const totalPayKHR = accountKHR + cashKHR;

    const elPayTotalUSD = document.getElementById("reportSummaryPaymentTotalUSD");
    const elPayTotalKHR = document.getElementById("reportSummaryPaymentTotalKHR");

    if (elPayTotalUSD) {
        elPayTotalUSD.textContent = `$${totalPayUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (elPayTotalKHR) {
        elPayTotalKHR.textContent = `៛${totalPayKHR.toLocaleString('en-US')}`;
    }

    if (elPayTotal) {
        const totParts = [];
        if (totalPayUSD > 0) totParts.push(`$${totalPayUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        if (totalPayKHR > 0) totParts.push(`៛${totalPayKHR.toLocaleString('en-US')}`);
        elPayTotal.textContent = totParts.join(" | ") || "$0.00";
    }

    // 5. Render Table Thead based on subTab (with interactive Sort on SO Date)
    const thead = document.getElementById("reportTableHead");
    if (thead) {
        const headers = getReportHeaders(currentSubTab);
        const isSoDateSort = Boolean(AppState.report && AppState.report.sortColumn === "soDate");
        const sortDir = (AppState.report && AppState.report.sortDirection) ? AppState.report.sortDirection : "desc";

        thead.innerHTML = `
            <tr class="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-xs tracking-tight">
                ${headers.map((h, idx) => {
                    let align = "text-left";
                    if (h === "Status" || h === "SO Date" || h.includes("(hh:mm)")) align = "text-center";
                    if (h.includes("Amount")) align = "text-right";

                    if (h === "SO Date") {
                        const isAsc = sortDir === "asc";
                        const sortTitle = isAsc 
                            ? "កំពុង Sort: A ➔ Z - ចុចសញ្ញាព្រួញចុះដើម្បីជ្រើសរើស (Sort A to Z / Sort Z to A)" 
                            : "កំពុង Sort: Z ➔ A - ចុចសញ្ញាព្រួញចុះដើម្បីជ្រើសរើស (Sort A to Z / Sort Z to A)";

                        return `
                            <th class="py-3 px-3.5 whitespace-nowrap text-center select-none group" title="${sortTitle}">
                                <div class="inline-flex items-center justify-center gap-1.5 font-bold text-slate-800">
                                    <span class="cursor-pointer hover:text-indigo-600 transition" onclick="toggleReportSoDateMenu(event)">SO Date</span>
                                    <!-- Down Arrow Button (សញ្ញា ព្រួញចុះ ដូចរូបទី២) -->
                                    <button type="button" 
                                        id="reportSoDateDropdownBtn"
                                        onclick="toggleReportSoDateMenu(event)"
                                        class="inline-flex items-center justify-center w-6 h-6 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 hover:text-indigo-600 shadow-2xs transition active:scale-95 cursor-pointer ml-0.5"
                                        title="ចុចសញ្ញាព្រួញចុះដើម្បីបើកជម្រើស Sort A to Z / Sort Z to A">
                                        <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                                    </button>
                                </div>
                            </th>
                        `;
                    }

                    return `<th class="py-3.5 px-3.5 whitespace-nowrap ${align}">${escapeHtml(h)}</th>`;
                }).join("")}
            </tr>
        `;
    }

    // 6. Render Table Tbody (Paginated)
    const tbody = document.getElementById("reportTableBody");
    if (!tbody) return;

    if (totalOrders === 0) {
        const colCount = getReportHeaders(currentSubTab).length;
        tbody.innerHTML = `
            <tr>
                <td colspan="${colCount}" class="text-center py-12 text-slate-400">
                    <i data-lucide="file-search" class="w-12 h-12 mx-auto stroke-1 mb-2 text-slate-300"></i>
                    <p class="font-medium text-slate-500">មិនមានទិន្នន័យ Report ដែលត្រូវនឹងលក្ខខណ្ឌ Filter នេះទេ</p>
                    <p class="text-xs text-slate-400 mt-1">សូមសាកល្បងប្តូរ Year, Month ឬចុច Reset Filters</p>
                </td>
            </tr>
        `;
        renderReportPagination(0, 0, 0, 0);
        lucide.createIcons();
        return;
    }

    const startIndex = (AppState.report.currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalOrders);
    const pageOrders = filteredOrders.slice(startIndex, endIndex);

    tbody.innerHTML = pageOrders.map(order => {
        const badgeInfo = getStatusBadgeInfo(order);
        const soDateStr = formatSoDateDisplay(order.timestamp || order.soDate || order.so_date || order.date);
        const amtStr = formatInvoiceAmountWithCurrency(order.invoiceAmount, order.currency);
        const pkgStr = formatPackageWithUnit(order.totalPackage, order.packageUnit);

        // Stage specific columns
        let stageColsHtml = "";
        if (currentSubTab === "register") {
            stageColsHtml = `
                <td class="py-3 px-3.5 text-slate-700 font-medium whitespace-nowrap">
                    <span class="inline-flex items-center gap-1.5 text-slate-800">
                        <i data-lucide="user" class="w-3.5 h-3.5 text-blue-600"></i>
                        ${escapeHtml(order.createdBy || "Admin")}
                    </span>
                </td>
            `;
        } else if (currentSubTab === "picking") {
            const duration = calculateDurationHhMm(order.pickingStartTime, order.pickingEndTime);
            stageColsHtml = `
                <td class="py-3 px-3.5 font-mono text-slate-600 text-xs whitespace-nowrap">${order.pickingStartTime ? formatDateTimeDisplay(order.pickingStartTime) : "-"}</td>
                <td class="py-3 px-3.5 font-mono text-slate-600 text-xs whitespace-nowrap">${order.pickingEndTime ? formatDateTimeDisplay(order.pickingEndTime) : "-"}</td>
                <td class="py-3 px-3.5 text-amber-700 font-bold whitespace-nowrap">${escapeHtml(order.pickerBy || "-")}</td>
                <td class="py-3 px-3.5 text-center whitespace-nowrap">
                    <span class="font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 text-xs">${duration}</span>
                </td>
            `;
        } else if (currentSubTab === "checking") {
            const duration = calculateDurationHhMm(order.checkingStartTime, order.checkingEndTime);
            stageColsHtml = `
                <td class="py-3 px-3.5 font-mono text-slate-600 text-xs whitespace-nowrap">${order.checkingStartTime ? formatDateTimeDisplay(order.checkingStartTime) : "-"}</td>
                <td class="py-3 px-3.5 font-mono text-slate-600 text-xs whitespace-nowrap">${order.checkingEndTime ? formatDateTimeDisplay(order.checkingEndTime) : "-"}</td>
                <td class="py-3 px-3.5 text-purple-700 font-bold whitespace-nowrap">${escapeHtml(order.checkerBy || "-")}</td>
                <td class="py-3 px-3.5 text-center whitespace-nowrap">
                    <span class="font-mono font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80 text-xs">${duration}</span>
                </td>
            `;
        } else if (currentSubTab === "delivery") {
            const duration = calculateDurationHhMm(order.deliveryStartTime, order.deliveryEndTime);
            stageColsHtml = `
                <td class="py-3 px-3.5 font-mono text-slate-600 text-xs whitespace-nowrap">${order.deliveryStartTime ? formatDateTimeDisplay(order.deliveryStartTime) : "-"}</td>
                <td class="py-3 px-3.5 font-mono text-slate-600 text-xs whitespace-nowrap">${order.deliveryEndTime ? formatDateTimeDisplay(order.deliveryEndTime) : "-"}</td>
                <td class="py-3 px-3.5 text-sky-700 font-bold whitespace-nowrap">${escapeHtml(order.deliveryBy || "-")}</td>
                <td class="py-3 px-3.5 text-center whitespace-nowrap">
                    <span class="font-mono font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/80 text-xs">${duration}</span>
                </td>
            `;
        } else if (currentSubTab === "master") {
            const pickDuration = calculateDurationHhMm(order.pickingStartTime, order.pickingEndTime);
            const checkDuration = calculateDurationHhMm(order.checkingStartTime, order.checkingEndTime);
            const delivDuration = calculateDurationHhMm(order.deliveryStartTime, order.deliveryEndTime);
            stageColsHtml = `
                <!-- 14. Registered by -->
                <td class="py-3 px-3.5 text-slate-700 font-medium whitespace-nowrap">
                    <span class="inline-flex items-center gap-1.5 text-slate-800">
                        <i data-lucide="user" class="w-3.5 h-3.5 text-blue-600"></i>
                        ${escapeHtml(order.createdBy || "Admin")}
                    </span>
                </td>
                <!-- 15. Picking Start -->
                <td class="py-3 px-3.5 font-mono text-slate-600 text-xs whitespace-nowrap">${order.pickingStartTime ? formatDateTimeDisplay(order.pickingStartTime) : "-"}</td>
                <!-- 16. Picking End -->
                <td class="py-3 px-3.5 font-mono text-slate-600 text-xs whitespace-nowrap">${order.pickingEndTime ? formatDateTimeDisplay(order.pickingEndTime) : "-"}</td>
                <!-- 17. Picker by -->
                <td class="py-3 px-3.5 text-amber-700 font-bold whitespace-nowrap">${escapeHtml(order.pickerBy || "-")}</td>
                <!-- 18. Duration picking (hh:mm) -->
                <td class="py-3 px-3.5 text-center whitespace-nowrap">
                    <span class="font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 text-xs">${pickDuration}</span>
                </td>
                <!-- 19. Checking Start -->
                <td class="py-3 px-3.5 font-mono text-slate-600 text-xs whitespace-nowrap">${order.checkingStartTime ? formatDateTimeDisplay(order.checkingStartTime) : "-"}</td>
                <!-- 20. Checking End -->
                <td class="py-3 px-3.5 font-mono text-slate-600 text-xs whitespace-nowrap">${order.checkingEndTime ? formatDateTimeDisplay(order.checkingEndTime) : "-"}</td>
                <!-- 21. Checker by -->
                <td class="py-3 px-3.5 text-purple-700 font-bold whitespace-nowrap">${escapeHtml(order.checkerBy || "-")}</td>
                <!-- 22. Duration checking (hh:mm) -->
                <td class="py-3 px-3.5 text-center whitespace-nowrap">
                    <span class="font-mono font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80 text-xs">${checkDuration}</span>
                </td>
                <!-- 23. Delivery Start -->
                <td class="py-3 px-3.5 font-mono text-slate-600 text-xs whitespace-nowrap">${order.deliveryStartTime ? formatDateTimeDisplay(order.deliveryStartTime) : "-"}</td>
                <!-- 24. Delivery End -->
                <td class="py-3 px-3.5 font-mono text-slate-600 text-xs whitespace-nowrap">${order.deliveryEndTime ? formatDateTimeDisplay(order.deliveryEndTime) : "-"}</td>
                <!-- 25. Delivery by -->
                <td class="py-3 px-3.5 text-sky-700 font-bold whitespace-nowrap">${escapeHtml(order.deliveryBy || "-")}</td>
                <!-- 26. Duration Delivery (hh:mm) -->
                <td class="py-3 px-3.5 text-center whitespace-nowrap">
                    <span class="font-mono font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/80 text-xs">${delivDuration}</span>
                </td>
            `;
        }

        return `
            <tr class="hover:bg-slate-50/90 transition border-b border-slate-100 text-xs">
                <!-- 1. Status -->
                <td class="py-3 px-3.5 text-center whitespace-nowrap">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badgeInfo.class}">
                        ${badgeInfo.text}
                    </span>
                </td>

                <!-- 2. SO Date -->
                <td class="py-3 px-3.5 font-mono text-slate-600 text-center whitespace-nowrap font-medium">
                    ${soDateStr}
                </td>

                <!-- 3. SO# -->
                <td class="py-3 px-3.5 font-bold font-mono text-blue-700 whitespace-nowrap">
                    <span class="cursor-pointer hover:underline" onclick="viewOrderDetails('${escapeHtml(order.soNumber)}')">
                        ${escapeHtml(order.soNumber || "-")}
                    </span>
                </td>

                <!-- 4. Customer Name -->
                <td class="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap max-w-[220px] truncate" title="${escapeHtml(order.customerName || '')}">
                    ${escapeHtml(order.customerName || "-")}
                </td>

                <!-- 5. City/Province -->
                <td class="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                    ${escapeHtml(order.cityProvince || "-")}
                </td>

                <!-- 6. Khan -->
                <td class="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                    ${escapeHtml(order.khan || "-")}
                </td>

                <!-- 7. Packing list# -->
                <td class="py-3 px-3.5 font-mono text-slate-600 whitespace-nowrap">
                    ${escapeHtml(order.packingListNumber || "-")}
                </td>

                <!-- 8. Invoice# -->
                <td class="py-3 px-3.5 font-mono text-slate-600 whitespace-nowrap">
                    ${escapeHtml(order.invoiceNumber || "-")}
                </td>

                <!-- 9. Invoice amount with currency -->
                <td class="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                    ${amtStr}
                </td>

                <!-- 10. Total package with package unit -->
                <td class="py-3 px-3.5 whitespace-nowrap">
                    ${pkgStr !== "-" ? `<span class="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-xs">${pkgStr}</span>` : '<span class="text-slate-300 font-semibold">-</span>'}
                </td>

                <!-- 11. BU -->
                <td class="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                    ${escapeHtml(order.bu || "-")}
                </td>

                <!-- 12. Document type -->
                <td class="py-3 px-3.5 whitespace-nowrap">
                    ${renderDocumentTypeBadge(order.documentType)}
                </td>

                <!-- 13. Special Note -->
                <td class="py-3 px-3.5 text-slate-600 whitespace-nowrap max-w-[200px] truncate" title="${escapeHtml(order.specialNotes || '')}">
                    ${escapeHtml(order.specialNotes || "-")}
                </td>

                <!-- 13.1 Payment Receipt -->
                <td class="py-3 px-3.5 whitespace-nowrap">
                    ${renderPaymentReceiptBadge(order)}
                </td>

                <!-- Stage Specific Columns (14-17) -->
                ${stageColsHtml}
            </tr>
        `;
    }).join("");

    // 7. Render Pagination Controls
    renderReportPagination(totalOrders, totalPages, startIndex + 1, endIndex);
    lucide.createIcons();
}
window.renderReportView = renderReportView;

// Render Report Pagination Controls Footer
function renderReportPagination(totalOrders, totalPages, startIdx, endIdx) {
    const container = document.getElementById("reportPaginationContainer");
    if (!container) return;

    if (totalOrders === 0) {
        container.classList.add("hidden");
        return;
    }
    container.classList.remove("hidden");

    const currentPage = (AppState.report && AppState.report.currentPage) ? AppState.report.currentPage : 1;
    const rangeText = `${startIdx} - ${endIdx}`;

    // Prev Button
    const prevDisabled = currentPage <= 1;
    let pageButtonsHtml = `
        <button type="button" 
            onclick="changeReportPage(${currentPage - 1})"
            ${prevDisabled ? "disabled" : ""}
            class="px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold flex items-center gap-1 transition ${prevDisabled ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-white hover:bg-slate-50 text-slate-700 active:scale-95 cursor-pointer shadow-2xs'}"
            title="ទំព័រមុន (Previous Page)">
            <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
            <span class="hidden sm:inline">មុន</span>
        </button>
    `;

    // Numeric buttons
    let pages = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        if (currentPage > 3) pages.push("...");
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) {
            if (!pages.includes(i)) pages.push(i);
        }
        if (currentPage < totalPages - 2) pages.push("...");
        if (!pages.includes(totalPages)) pages.push(totalPages);
    }

    pages.forEach(p => {
        if (p === "...") {
            pageButtonsHtml += `<span class="px-1.5 py-1 text-slate-400 font-bold select-none text-xs">...</span>`;
        } else {
            const isActive = p === currentPage;
            pageButtonsHtml += `
                <button type="button" 
                    onclick="changeReportPage(${p})"
                    class="w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${isActive ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 active:scale-95 shadow-2xs'}">
                    ${p}
                </button>
            `;
        }
    });

    // Next Button
    const nextDisabled = currentPage >= totalPages;
    pageButtonsHtml += `
        <button type="button" 
            onclick="changeReportPage(${currentPage + 1})"
            ${nextDisabled ? "disabled" : ""}
            class="px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold flex items-center gap-1 transition ${nextDisabled ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-white hover:bg-slate-50 text-slate-700 active:scale-95 cursor-pointer shadow-2xs'}"
            title="ទំព័របន្ទាប់ (Next Page)">
            <span class="hidden sm:inline">បន្ទាប់</span>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
        </button>
    `;

    container.innerHTML = `
        <div class="flex items-center gap-1.5 sm:gap-2 text-slate-500 font-medium text-xs">
            <span>បង្ហាញ</span>
            <span class="font-bold text-slate-900 px-2 py-0.5 rounded-lg bg-white border border-slate-200/90 shadow-2xs">${rangeText}</span>
            <span>នៃ</span>
            <span class="font-bold text-indigo-700 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200/70 shadow-2xs">${totalOrders}</span>
            <span>Orders</span>
            <span class="text-slate-300 mx-0.5 hidden md:inline">|</span>
            <span class="hidden md:inline text-slate-400">ទំព័រ <b class="text-slate-800">${currentPage}</b> / <b>${totalPages}</b> (10 Orders / Page)</span>
        </div>
        <div class="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center sm:justify-end">
            ${pageButtonsHtml}
        </div>
    `;
}
window.renderReportPagination = renderReportPagination;

// Change Report Page
function changeReportPage(page) {
    if (!AppState.report) return;
    const subTab = AppState.report.activeTab || "register";
    const filtered = getFilteredReportOrders(subTab);
    const pageSize = AppState.report.pageSize || 10;
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;

    let target = Number(page) || 1;
    if (target < 1) target = 1;
    if (target > totalPages) target = totalPages;

    AppState.report.currentPage = target;
    renderReportView();

    const tableEl = document.getElementById("reportTableBody");
    if (tableEl) {
        const tableCard = tableEl.closest(".glass-panel-elevated");
        if (tableCard) tableCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}
window.changeReportPage = changeReportPage;

// Export Current Report to Excel (.xlsx or fallback .csv)
function exportCurrentReportToExcel() {
    if (!AppState.report) {
        AppState.report = { activeTab: "register", filterYear: "ALL", filterMonth: "ALL", filterFromDate: "", filterToDate: "", searchQuery: "", currentPage: 1, pageSize: 10 };
    }
    const subTab = AppState.report.activeTab || "register";
    const subTabFileNames = {
        "register": "Report_Register_Order",
        "picking": "Report_Physical_Picking",
        "checking": "Report_Physical_Checking",
        "delivery": "Report_Delivery",
        "master": "Report_Master"
    };
    const subTabSheetNames = {
        "register": "Register Order",
        "picking": "Physical Picking",
        "checking": "Physical Checking",
        "delivery": "Delivery",
        "master": "Master Report"
    };

    const baseName = subTabFileNames[subTab] || "Report";
    const todayStr = new Date().toISOString().slice(0, 10);
    const fileName = `${baseName}_${todayStr}`;

    const filtered = getFilteredReportOrders(subTab);
    if (filtered.length === 0) {
        Swal.fire({
            title: "មិនមានទិន្នន័យ!",
            text: "មិនមានទិន្នន័យស្របតាម Filter ដើម្បីធ្វើការ Export ទៅជា Excel ឡើយ។",
            icon: "info",
            confirmButtonText: "យល់ព្រម",
            confirmButtonColor: "#4f46e5"
        });
        return;
    }

    const headers = getReportHeaders(subTab);
    const dataRows = filtered.map(order => getReportRowData(order, subTab));

    // Try SheetJS XLSX export first
    if (window.XLSX && typeof window.XLSX.utils !== "undefined") {
        try {
            const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

            // Set column auto widths
            const colWidths = headers.map((h, i) => {
                let maxLen = h.length;
                dataRows.forEach(row => {
                    const cellVal = String(row[i] || "");
                    if (cellVal.length > maxLen) maxLen = cellVal.length;
                });
                return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
            });
            ws['!cols'] = colWidths;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, subTabSheetNames[subTab] || "Report");
            XLSX.writeFile(wb, `${fileName}.xlsx`);

            Swal.fire({
                title: "Export ជោគជ័យ! 📊",
                text: `បានទាញយកឯកសារ Excel: ${fileName}.xlsx រួចរាល់ (${dataRows.length} ជួរ)`,
                icon: "success",
                confirmButtonText: "យល់ព្រម",
                confirmButtonColor: "#059669"
            });
            return;
        } catch (err) {
            console.error("XLSX export error, using CSV fallback:", err);
        }
    }

    // Fallback: UTF-8 BOM CSV
    exportToCsvFallback(headers, dataRows, `${fileName}.csv`);
}
window.exportCurrentReportToExcel = exportCurrentReportToExcel;

// CSV Fallback export helper
function exportToCsvFallback(headers, dataRows, fileName) {
    const csvContent = "\uFEFF" + [headers, ...dataRows]
        .map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(","))
        .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire({
        title: "Export ជោគជ័យ! 📊",
        text: `បានទាញយកឯកសារ: ${fileName} រួចរាល់ (${dataRows.length} ជួរ)`,
        icon: "success",
        confirmButtonText: "យល់ព្រម",
        confirmButtonColor: "#059669"
    });
}
window.exportToCsvFallback = exportToCsvFallback;

// Render Setup View Counters & Tables
function renderSetupView() {
    ensureSetupIds();

    const badgeCust = document.getElementById("badgeCountCustomer");
    const badgeBU = document.getElementById("badgeCountBU");
    const badgePkg = document.getElementById("badgeCountPkg");
    const badgeDoc = document.getElementById("badgeCountDoc");
    const badgeUser = document.getElementById("badgeCountUser");

    if (badgeCust) badgeCust.textContent = AppState.setup.customers.length;
    if (badgeBU) badgeBU.textContent = AppState.setup.bus.length;
    if (badgePkg) badgePkg.textContent = AppState.setup.packageTypes.length;
    if (badgeDoc) badgeDoc.textContent = AppState.setup.documentTypes.length;
    if (badgeUser) badgeUser.textContent = (AppState.setup.users || []).length;

    renderCustomerSetupTable();
    renderBUSetupTable();
    renderPackageTypeSetupTable();
    renderDocTypeSetupTable();
    renderUserSetupTable();
    lucide.createIcons();
}

// ----------------------------------------------------
// 1. CUSTOMER INFORMATION SETUP CRUD
// ----------------------------------------------------
function renderCustomerSetupTable() {
    const tbody = document.getElementById("customerTableBody");
    if (!tbody) return;

    const q = (document.getElementById("searchCustomerSetupInput")?.value || "").toLowerCase().trim();
    const list = AppState.setup.customers.filter(c => {
        if (!q) return true;
        return (c.id && c.id.toLowerCase().includes(q)) ||
               (c.name && c.name.toLowerCase().includes(q)) ||
               (c.cityProvince && c.cityProvince.toLowerCase().includes(q)) ||
               (c.khan && c.khan.toLowerCase().includes(q));
    });

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-8 text-slate-400">
                    <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
                    ${q ? "មិនមានអតិថិជនត្រូវនឹងពាក្យស្វែងរកឡើយ" : "មិនទាន់មានទិន្នន័យអតិថិជននៅឡើយ"}
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = list.map(c => `
        <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="py-3 px-4 font-mono font-medium text-slate-600 text-xs">${c.id || "-"}</td>
            <td class="py-3 px-4 font-semibold text-slate-900">${c.name}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                    ${getCleanEnglishLocation(c.cityProvince) || "-"}
                </span>
            </td>
            <td class="py-3 px-4 text-slate-700 text-xs">${getCleanEnglishLocation(c.khan) || "-"}</td>
            <td class="py-3 px-4 font-mono text-slate-500 text-xs">${formatDateTimeDisplay(c.updatedAt || c.lastUpdated || '')}</td>
            <td class="py-3 px-4 text-right">
                <div class="inline-flex items-center gap-1.5">
                    <button onclick="openEditCustomerModal('${c.id}')" class="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition" title="កែប្រែ (Edit)">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteCustomerItem('${c.id}')" class="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition" title="លុប (Delete)">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    lucide.createIcons();
}

function openAddCustomerModal() {
    const modal = document.getElementById("customerModal");
    const title = document.getElementById("customerModalTitle");
    const idInput = document.getElementById("customerModalId");
    const nameInput = document.getElementById("customerModalName");
    const provSelect = document.getElementById("customerModalProvince");

    if (title) title.textContent = "បន្ថែមអតិថិជនថ្មី (Add Customer)";
    if (idInput) idInput.value = "";
    if (nameInput) nameInput.value = "";
    if (provSelect) {
        provSelect.value = "Phnom Penh";
        updateCustomerModalKhan("Phnom Penh");
    }

    if (modal) modal.classList.remove("hidden");
    if (nameInput) nameInput.focus();
}

function openEditCustomerModal(id) {
    const cust = AppState.setup.customers.find(c => String(c.id) === String(id) || c.name === id);
    if (!cust) return;

    const modal = document.getElementById("customerModal");
    const title = document.getElementById("customerModalTitle");
    const idInput = document.getElementById("customerModalId");
    const nameInput = document.getElementById("customerModalName");
    const provSelect = document.getElementById("customerModalProvince");
    const khanSelect = document.getElementById("customerModalKhan");

    if (title) title.textContent = "កែប្រែព័ត៌មានអតិថិជន (Edit Customer)";
    if (idInput) idInput.value = cust.id || "";
    if (nameInput) nameInput.value = cust.name || "";
    
    const cleanProv = getCleanEnglishLocation(cust.cityProvince) || "Phnom Penh";
    const cleanKhan = getCleanEnglishLocation(cust.khan);

    if (provSelect) {
        provSelect.value = cleanProv;
        updateCustomerModalKhan(cleanProv);
    }
    if (khanSelect && cleanKhan) {
        khanSelect.value = cleanKhan;
    }

    if (modal) modal.classList.remove("hidden");
    if (nameInput) nameInput.focus();
}

function closeCustomerModal() {
    const modal = document.getElementById("customerModal");
    if (modal) modal.classList.add("hidden");
}

async function handleCustomerFormSubmit(e) {
    e.preventDefault();
    const idInput = document.getElementById("customerModalId");
    const nameInput = document.getElementById("customerModalName");
    const provSelect = document.getElementById("customerModalProvince");
    const khanSelect = document.getElementById("customerModalKhan");

    const id = idInput ? idInput.value.trim() : "";
    const name = nameInput ? nameInput.value.trim() : "";
    const cityProvince = provSelect ? getCleanEnglishLocation(provSelect.value) : "";
    const khan = khanSelect ? getCleanEnglishLocation(khanSelect.value) : "";

    if (!name) {
        showToast("សូមបញ្ចូលឈ្មោះអតិថិជន!", "error");
        return;
    }

    const now = formatAppDateTime();
    let targetCust = null;

    if (id) {
        // Edit existing
        targetCust = AppState.setup.customers.find(c => String(c.id) === String(id));
        if (targetCust) {
            targetCust.name = name;
            targetCust.cityProvince = cityProvince;
            targetCust.khan = khan;
            targetCust.updatedAt = now;
            targetCust.lastUpdated = now;
        }
        showToast(`បានកែប្រែព័ត៌មានអតិថិជន ${name} ជោគជ័យ!`, "success");
    } else {
        // Create new
        const newId = `CUST-${String(AppState.setup.customers.length + 1).padStart(3, '0')}`;
        targetCust = {
            id: newId,
            name: name,
            cityProvince: cityProvince,
            khan: khan,
            updatedAt: now,
            lastUpdated: now
        };
        AppState.setup.customers.unshift(targetCust);
        showToast(`បានបន្ថែមអតិថិជន ${name} ជោគជ័យ!`, "success");
    }

    saveSetupState("customers");
    setupDropdownOptions();
    renderSetupView();
    closeCustomerModal();

    // Auto sync to Google Sheets
    if (targetCust) {
        SheetsSync.syncCustomer(targetCust);
    }
}

async function deleteCustomerItem(id) {
    const cust = AppState.setup.customers.find(c => String(c.id) === String(id) || c.name === id);
    if (!cust) return;

    const result = await Swal.fire({
        title: "តើអ្នកប្រាកដថាចង់លុបអតិថិជននេះទេ?",
        html: `អតិថិជន: <b class="text-red-600">${cust.name}</b><br><span class="text-xs text-slate-500">ទីតាំង: ${cust.khan || '-'}, ${cust.cityProvince || '-'}</span>`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#64748b",
        confirmButtonText: "បាទ/ចាស, លុប!",
        cancelButtonText: "បោះបង់"
    });

    if (result.isConfirmed) {
        AppState.setup.customers = AppState.setup.customers.filter(c => String(c.id) !== String(cust.id));
        saveSetupState("customers");
        setupDropdownOptions();
        renderSetupView();
        showToast(`បានលុបអតិថិជន ${cust.name}`, "info");

        // Auto sync deletion to Google Sheets
        SheetsSync.deleteCustomer(cust.id, cust.name);
    }
}

// ----------------------------------------------------
// 2. BUSINESS UNIT (BU) SETUP CRUD
// ----------------------------------------------------
function renderBUSetupTable() {
    const tbody = document.getElementById("buTableBody");
    if (!tbody) return;

    const q = (document.getElementById("searchBUSetupInput")?.value || "").toLowerCase().trim();
    const list = AppState.setup.bus.filter(b => {
        if (!q) return true;
        return (b.id && b.id.toLowerCase().includes(q)) ||
               (b.name && b.name.toLowerCase().includes(q));
    });

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-8 text-slate-400">
                    <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
                    ${q ? "មិនមាន BU ត្រូវនឹងពាក្យស្វែងរកឡើយ" : "មិនទាន់មានទិន្នន័យ BU នៅឡើយ"}
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = list.map(b => `
        <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="py-3 px-4 font-mono font-medium text-slate-600 text-xs">${b.id || "-"}</td>
            <td class="py-3 px-4 font-semibold text-slate-900">${b.name}</td>
            <td class="py-3 px-4 font-mono text-slate-500 text-xs">${formatDateTimeDisplay(b.updatedAt || b.lastUpdated || '')}</td>
            <td class="py-3 px-4 text-right">
                <div class="inline-flex items-center gap-1.5">
                    <button onclick="openEditBUModal('${b.id}')" class="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition" title="កែប្រែ (Edit)">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteBUItem('${b.id}')" class="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition" title="លុប (Delete)">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    lucide.createIcons();
}

function openAddBUModal() {
    const modal = document.getElementById("buModal");
    const title = document.getElementById("buModalTitle");
    const idInput = document.getElementById("buModalId");
    const nameInput = document.getElementById("buModalName");

    if (title) title.textContent = "បន្ថែម Business Unit (BU) ថ្មី";
    if (idInput) idInput.value = "";
    if (nameInput) nameInput.value = "";

    if (modal) modal.classList.remove("hidden");
    if (nameInput) nameInput.focus();
}

function openEditBUModal(id) {
    const bu = AppState.setup.bus.find(b => String(b.id) === String(id) || b.name === id);
    if (!bu) return;

    const modal = document.getElementById("buModal");
    const title = document.getElementById("buModalTitle");
    const idInput = document.getElementById("buModalId");
    const nameInput = document.getElementById("buModalName");

    if (title) title.textContent = "កែប្រែ Business Unit (Edit BU)";
    if (idInput) idInput.value = bu.id || "";
    if (nameInput) nameInput.value = bu.name || "";

    if (modal) modal.classList.remove("hidden");
    if (nameInput) nameInput.focus();
}

function closeBUModal() {
    const modal = document.getElementById("buModal");
    if (modal) modal.classList.add("hidden");
}

async function handleBUFormSubmit(e) {
    e.preventDefault();
    const idInput = document.getElementById("buModalId");
    const nameInput = document.getElementById("buModalName");

    const id = idInput ? idInput.value.trim() : "";
    const name = nameInput ? nameInput.value.trim() : "";

    if (!name) {
        showToast("សូមបញ្ចូលឈ្មោះ Business Unit!", "error");
        return;
    }

    const now = formatAppDateTime();
    let targetBU = null;

    if (id) {
        targetBU = AppState.setup.bus.find(b => String(b.id) === String(id));
        if (targetBU) {
            targetBU.name = name;
            targetBU.updatedAt = now;
            targetBU.lastUpdated = now;
        }
        showToast(`បានកែប្រែ BU ${name} ជោគជ័យ!`, "success");
    } else {
        const newId = `BU-${String(AppState.setup.bus.length + 1).padStart(3, '0')}`;
        targetBU = {
            id: newId,
            name: name,
            updatedAt: now,
            lastUpdated: now
        };
        AppState.setup.bus.push(targetBU);
        showToast(`បានបន្ថែម BU ${name} ជោគជ័យ!`, "success");
    }

    saveSetupState("bus");
    setupDropdownOptions();
    renderSetupView();
    closeBUModal();

    if (targetBU) {
        SheetsSync.syncBU(targetBU);
    }
}

async function deleteBUItem(id) {
    const bu = AppState.setup.bus.find(b => String(b.id) === String(id) || b.name === id);
    if (!bu) return;

    const result = await Swal.fire({
        title: "តើអ្នកប្រាកដថាចង់លុប BU នេះទេ?",
        html: `Business Unit: <b class="text-red-600">${bu.name}</b>`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#64748b",
        confirmButtonText: "បាទ/ចាស, លុប!",
        cancelButtonText: "បោះបង់"
    });

    if (result.isConfirmed) {
        AppState.setup.bus = AppState.setup.bus.filter(b => String(b.id) !== String(bu.id));
        saveSetupState("bus");
        setupDropdownOptions();
        renderSetupView();
        showToast(`បានលុប BU ${bu.name}`, "info");

        SheetsSync.deleteBU(bu.id, bu.name);
    }
}

// ----------------------------------------------------
// 3. PACKAGE TYPE SETUP CRUD
// ----------------------------------------------------
function renderPackageTypeSetupTable() {
    const tbody = document.getElementById("packageTableBody");
    if (!tbody) return;

    const q = (document.getElementById("searchPkgSetupInput")?.value || "").toLowerCase().trim();
    const list = AppState.setup.packageTypes.filter(p => {
        if (!q) return true;
        return (p.id && p.id.toLowerCase().includes(q)) ||
               (p.name && p.name.toLowerCase().includes(q)) ||
               (p.short && p.short.toLowerCase().includes(q));
    });

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-8 text-slate-400">
                    <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
                    ${q ? "មិនមាន Package Type ត្រូវនឹងពាក្យស្វែងរកឡើយ" : "មិនទាន់មានទិន្នន័យ Package Type នៅឡើយ"}
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = list.map(p => `
        <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="py-3 px-4 font-mono font-medium text-slate-600 text-xs">${p.id || "-"}</td>
            <td class="py-3 px-4 font-semibold text-slate-900">${p.name}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-mono font-medium">
                    ${p.short || "-"}
                </span>
            </td>
            <td class="py-3 px-4 font-mono text-slate-500 text-xs">${formatDateTimeDisplay(p.updatedAt || p.lastUpdated || '')}</td>
            <td class="py-3 px-4 text-right">
                <div class="inline-flex items-center gap-1.5">
                    <button onclick="openEditPackageTypeModal('${p.id}')" class="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition" title="កែប្រែ (Edit)">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deletePackageTypeItem('${p.id}')" class="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition" title="លុប (Delete)">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    lucide.createIcons();
}

function openAddPackageTypeModal() {
    const modal = document.getElementById("packageModal");
    const title = document.getElementById("packageModalTitle");
    const idInput = document.getElementById("packageModalId");
    const nameInput = document.getElementById("packageModalName");
    const shortInput = document.getElementById("packageModalShort");

    if (title) title.textContent = "បន្ថែម Package Type ថ្មី";
    if (idInput) idInput.value = "";
    if (nameInput) nameInput.value = "";
    if (shortInput) shortInput.value = "";

    if (modal) modal.classList.remove("hidden");
    if (nameInput) nameInput.focus();
}

function openEditPackageTypeModal(id) {
    const pkg = AppState.setup.packageTypes.find(p => String(p.id) === String(id) || p.name === id);
    if (!pkg) return;

    const modal = document.getElementById("packageModal");
    const title = document.getElementById("packageModalTitle");
    const idInput = document.getElementById("packageModalId");
    const nameInput = document.getElementById("packageModalName");
    const shortInput = document.getElementById("packageModalShort");

    if (title) title.textContent = "កែប្រែ Package Type";
    if (idInput) idInput.value = pkg.id || "";
    if (nameInput) nameInput.value = pkg.name || "";
    if (shortInput) shortInput.value = pkg.short || "";

    if (modal) modal.classList.remove("hidden");
    if (nameInput) nameInput.focus();
}

function closePackageModal() {
    const modal = document.getElementById("packageModal");
    if (modal) modal.classList.add("hidden");
}

async function handlePackageFormSubmit(e) {
    e.preventDefault();
    const idInput = document.getElementById("packageModalId");
    const nameInput = document.getElementById("packageModalName");
    const shortInput = document.getElementById("packageModalShort");

    const id = idInput ? idInput.value.trim() : "";
    const name = nameInput ? nameInput.value.trim() : "";
    const short = shortInput ? shortInput.value.trim() : "";

    if (!name) {
        showToast("សូមបញ្ចូលឈ្មោះ Package Type!", "error");
        return;
    }

    const now = formatAppDateTime();
    let targetPkg = null;

    if (id) {
        targetPkg = AppState.setup.packageTypes.find(p => String(p.id) === String(id));
        if (targetPkg) {
            targetPkg.name = name;
            targetPkg.short = short;
            targetPkg.updatedAt = now;
            targetPkg.lastUpdated = now;
        }
        showToast(`បានកែប្រែ ${name} ជោគជ័យ!`, "success");
    } else {
        const newId = `PKG-${String(AppState.setup.packageTypes.length + 1).padStart(3, '0')}`;
        targetPkg = {
            id: newId,
            name: name,
            short: short,
            updatedAt: now,
            lastUpdated: now
        };
        AppState.setup.packageTypes.push(targetPkg);
        showToast(`បានបន្ថែម ${name} ជោគជ័យ!`, "success");
    }

    saveSetupState("packageTypes");
    setupDropdownOptions();
    renderSetupView();
    closePackageModal();

    if (targetPkg) {
        SheetsSync.syncPackageType(targetPkg);
    }
}

async function deletePackageTypeItem(id) {
    const pkg = AppState.setup.packageTypes.find(p => String(p.id) === String(id) || p.name === id);
    if (!pkg) return;

    const result = await Swal.fire({
        title: "តើអ្នកប្រាកដថាចង់លុប Package Type នេះទេ?",
        html: `Package Type: <b class="text-red-600">${pkg.name}</b>`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#64748b",
        confirmButtonText: "បាទ/ចាស, លុប!",
        cancelButtonText: "បោះបង់"
    });

    if (result.isConfirmed) {
        AppState.setup.packageTypes = AppState.setup.packageTypes.filter(p => String(p.id) !== String(pkg.id));
        saveSetupState("packageTypes");
        setupDropdownOptions();
        renderSetupView();
        showToast(`បានលុប ${pkg.name}`, "info");

        SheetsSync.deletePackageType(pkg.id, pkg.name);
    }
}

// ----------------------------------------------------
// 4. DOCUMENT TYPE SETUP CRUD
// ----------------------------------------------------
function renderDocTypeSetupTable() {
    const tbody = document.getElementById("docTableBody");
    if (!tbody) return;

    const q = (document.getElementById("searchDocSetupInput")?.value || "").toLowerCase().trim();
    const list = AppState.setup.documentTypes.filter(d => {
        if (!q) return true;
        return (d.id && d.id.toLowerCase().includes(q)) ||
               (d.name && d.name.toLowerCase().includes(q));
    });

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-8 text-slate-400">
                    <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
                    ${q ? "មិនមាន Document Type ត្រូវនឹងពាក្យស្វែងរកឡើយ" : "មិនទាន់មានទិន្នន័យ Document Type នៅឡើយ"}
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = list.map(d => `
        <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="py-3 px-4 font-mono font-medium text-slate-600 text-xs">${d.id || "-"}</td>
            <td class="py-3 px-4">${renderDocumentTypeBadge(d.name)}</td>
            <td class="py-3 px-4 font-mono text-slate-500 text-xs">${formatDateTimeDisplay(d.updatedAt || d.lastUpdated || '')}</td>
            <td class="py-3 px-4 text-right">
                <div class="inline-flex items-center gap-1.5">
                    <button onclick="openEditDocTypeModal('${d.id}')" class="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition" title="កែប្រែ (Edit)">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteDocTypeItem('${d.id}')" class="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition" title="លុប (Delete)">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    lucide.createIcons();
}

function openAddDocTypeModal() {
    const modal = document.getElementById("docModal");
    const title = document.getElementById("docModalTitle");
    const idInput = document.getElementById("docModalId");
    const nameInput = document.getElementById("docModalName");

    if (title) title.textContent = "បន្ថែម Document Type ថ្មី";
    if (idInput) idInput.value = "";
    if (nameInput) nameInput.value = "";

    if (modal) modal.classList.remove("hidden");
    if (nameInput) nameInput.focus();
}

function openEditDocTypeModal(id) {
    const doc = AppState.setup.documentTypes.find(d => String(d.id) === String(id) || d.name === id);
    if (!doc) return;

    const modal = document.getElementById("docModal");
    const title = document.getElementById("docModalTitle");
    const idInput = document.getElementById("docModalId");
    const nameInput = document.getElementById("docModalName");

    if (title) title.textContent = "កែប្រែ Document Type";
    if (idInput) idInput.value = doc.id || "";
    if (nameInput) nameInput.value = doc.name || "";

    if (modal) modal.classList.remove("hidden");
    if (nameInput) nameInput.focus();
}

function closeDocModal() {
    const modal = document.getElementById("docModal");
    if (modal) modal.classList.add("hidden");
}

async function handleDocFormSubmit(e) {
    e.preventDefault();
    const idInput = document.getElementById("docModalId");
    const nameInput = document.getElementById("docModalName");

    const id = idInput ? idInput.value.trim() : "";
    const name = nameInput ? nameInput.value.trim() : "";

    if (!name) {
        showToast("សូមបញ្ចូលឈ្មោះ Document Type!", "error");
        return;
    }

    const now = formatAppDateTime();
    let targetDoc = null;

    if (id) {
        targetDoc = AppState.setup.documentTypes.find(d => String(d.id) === String(id));
        if (targetDoc) {
            targetDoc.name = name;
            targetDoc.updatedAt = now;
            targetDoc.lastUpdated = now;
        }
        showToast(`បានកែប្រែ ${name} ជោគជ័យ!`, "success");
    } else {
        const newId = `DOC-${String(AppState.setup.documentTypes.length + 1).padStart(3, '0')}`;
        targetDoc = {
            id: newId,
            name: name,
            updatedAt: now,
            lastUpdated: now
        };
        AppState.setup.documentTypes.push(targetDoc);
        showToast(`បានបន្ថែម ${name} ជោគជ័យ!`, "success");
    }

    saveSetupState("documentTypes");
    setupDropdownOptions();
    renderSetupView();
    closeDocModal();

    if (targetDoc) {
        SheetsSync.syncDocumentType(targetDoc);
    }
}

async function deleteDocTypeItem(id) {
    const doc = AppState.setup.documentTypes.find(d => String(d.id) === String(id) || d.name === id);
    if (!doc) return;

    const result = await Swal.fire({
        title: "តើអ្នកប្រាកដថាចង់លុប Document Type នេះទេ?",
        html: `Document Type: <b class="text-red-600">${doc.name}</b>`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#64748b",
        confirmButtonText: "បាទ/ចាស, លុប!",
        cancelButtonText: "បោះបង់"
    });

    if (result.isConfirmed) {
        AppState.setup.documentTypes = AppState.setup.documentTypes.filter(d => String(d.id) !== String(doc.id));
        saveSetupState("documentTypes");
        setupDropdownOptions();
        renderSetupView();
        showToast(`បានលុប ${doc.name}`, "info");

        SheetsSync.deleteDocumentType(doc.id, doc.name);
    }
}

// ----------------------------------------------------
// 5. SYNC ALL SETUP TO GOOGLE SHEETS
// ----------------------------------------------------
async function syncAllSetupToSheets() {
    if (!SheetsSync.isConfigured()) {
        Swal.fire({
            title: "មិនទាន់ភ្ជាប់ Google Sheet!",
            text: "សូមចូលទៅកាន់ 'ការកំណត់ (Settings)' រួចបញ្ចូល Web App URL ជាមុនសិន។",
            icon: "warning",
            confirmButtonText: "យល់ព្រម",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    const btn = document.getElementById("btnSyncAllSetup");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin text-emerald-600"></i><span>កំពុង Sync ទៅ Sheet...</span>`;
        lucide.createIcons();
    }

    try {
        const res = await SheetsSync.syncAllSetup(AppState.setup);
        if (res.success) {
            Swal.fire({
                title: "Sync Setup បានជោគជ័យ! 🎉",
                html: `បានបញ្ជូនទិន្នន័យ Master Data ទៅកាន់ Google Sheet "Tracking order":<br>
                - <b>Customer Information:</b> ${AppState.setup.customers.length} ជួរ<br>
                - <b>BU:</b> ${AppState.setup.bus.length} ជួរ<br>
                - <b>Package Type:</b> ${AppState.setup.packageTypes.length} ជួរ<br>
                - <b>Document Type:</b> ${AppState.setup.documentTypes.length} ជួរ<br>
                - <b>User Management:</b> ${AppState.setup.users.length} គណនី`,
                icon: "success",
                confirmButtonText: "អស្ចារ្យ",
                confirmButtonColor: "#10b981"
            });
        } else {
            Swal.fire({
                title: "បរាជ័យក្នុងការ Sync!",
                text: res.error || "សូមពិនិត្យមើលការតភ្ជាប់អ៊ីនធឺណិត ឬសិទ្ធិ Access ក្នុង Google Apps Script!",
                icon: "error",
                confirmButtonText: "បិទ",
                confirmButtonColor: "#ef4444"
            });
        }
    } catch (err) {
        Swal.fire({
            title: "បញ្ហាបច្ចេកទេស",
            text: err.message,
            icon: "error",
            confirmButtonText: "បិទ"
        });
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="cloud-upload" class="w-4 h-4 text-emerald-600"></i><span>Sync ទៅ Google Sheet</span>`;
            lucide.createIcons();
        }
    }
}

// Sync from Google Sheet explicitly (Orders & Setup Master Data)
async function syncFromGoogleSheet() {
    const btnTopSync = document.getElementById("topBtnSyncNow");
    const btnSideSync = document.getElementById("btnSyncNow");
    const iconTop = btnTopSync ? btnTopSync.querySelector("i, svg") : null;
    const iconSide = btnSideSync ? btnSideSync.querySelector("i, svg") : null;

    if (iconTop) iconTop.classList.add("animate-spin");
    if (iconSide) iconSide.classList.add("animate-spin");
    if (btnTopSync) btnTopSync.disabled = true;
    if (btnSideSync) btnSideSync.disabled = true;

    try {
        const data = await SheetsSync.fetchAllData();
        if (!data) return;

        let updatedMsg = [];
        if (data.orders && data.orders.length > 0) {
            const incomingOrders = data.orders.map(normalizeOrderDates);
            const dailySos = getDailyCompletedOrderSos();
            const merged = incomingOrders.map(inc => {
                const existing = AppState.orders.find(o => o.soNumber === inc.soNumber);
                if (existing) {
                    if ((!inc.paymentReceipt || inc.paymentReceipt === "-") && existing.paymentReceipt && existing.paymentReceipt !== "-") {
                        inc.paymentReceipt = existing.paymentReceipt;
                        inc.paymentReceiptType = existing.paymentReceiptType;
                        inc.paymentReceiptAmount = existing.paymentReceiptAmount;
                        inc.paymentAccountAmount = existing.paymentAccountAmount;
                        inc.paymentCashAmount = existing.paymentCashAmount;
                        inc.paymentAccountCurrency = existing.paymentAccountCurrency;
                        inc.paymentCashCurrency = existing.paymentCashCurrency;
                        inc.paymentReceiptCurrency = existing.paymentReceiptCurrency;
                    }
                    if (existing.completedFromDailyDelivery) {
                        inc.completedFromDailyDelivery = true;
                    }
                }
                if (dailySos.has(inc.soNumber)) {
                    inc.completedFromDailyDelivery = true;
                }
                return inc;
            });
            AppState.orders = merged;
            saveOrdersToStorage();
            updatedMsg.push(`${data.orders.length} Orders`);
        }

        if (data.setup) {
            if (Array.isArray(data.setup.customers) && data.setup.customers.length > 0) {
                AppState.setup.customers = data.setup.customers;
                saveSetupState("customers");
            }
            if (Array.isArray(data.setup.bus) && data.setup.bus.length > 0) {
                AppState.setup.bus = data.setup.bus;
                saveSetupState("bus");
            }
            if (Array.isArray(data.setup.packageTypes) && data.setup.packageTypes.length > 0) {
                AppState.setup.packageTypes = data.setup.packageTypes;
                saveSetupState("packageTypes");
            }
            if (Array.isArray(data.setup.documentTypes) && data.setup.documentTypes.length > 0) {
                AppState.setup.documentTypes = data.setup.documentTypes;
                saveSetupState("documentTypes");
            }
            if (Array.isArray(data.setup.users) && data.setup.users.length > 0) {
                AppState.setup.users = data.setup.users;
                saveSetupState("users");
                renderCurrentUserProfile();
            }
            setupDropdownOptions();
            updatedMsg.push("Setup Master Data");
        }

        renderAll(false);
        if (updatedMsg.length > 0 && typeof Toastify === "function") {
            Toastify({
                text: `✅ ធ្វើសមកាលកម្មទិន្នន័យជោគជ័យ: ${updatedMsg.join(" & ")}`,
                duration: 3000,
                gravity: "top",
                position: "center",
                style: {
                    background: "linear-gradient(to right, #059669, #10b981)",
                    borderRadius: "12px",
                    fontWeight: "bold",
                    fontSize: "13px",
                    boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.4)"
                }
            }).showToast();
        }
    } finally {
        if (iconTop) iconTop.classList.remove("animate-spin");
        if (iconSide) iconSide.classList.remove("animate-spin");
        if (btnTopSync) btnTopSync.disabled = false;
        if (btnSideSync) btnSideSync.disabled = false;
    }
}
window.syncFromGoogleSheet = syncFromGoogleSheet;

// Clean Google Sheet Headers (remove Khmer) and format durations to hh:mm
async function cleanGoogleSheetNow() {
    if (!SheetsSync.isConfigured()) {
        showToast("Google Sheet មិនទាន់ភ្ជាប់ទេ!", "warning");
        return;
    }
    showToast("កំពុង Clean Headers & Durations ក្នុង Google Sheet...", "info");
    try {
        const res = await SheetsSync.cleanSheetHeadersAndDurations();
        if (res.success) {
            showToast("✅ បានសម្អាត Headers និង Format Duration ទៅជា hh:mm ជោគជ័យ!", "success");
            syncFromGoogleSheet();
        } else {
            showToast("❌ បរាជ័យក្នុងការ Clean Sheet: " + (res.error || res.message || ""), "error");
        }
    } catch(e) {
        showToast("❌ បរាជ័យ: " + e.message, "error");
    }
}
window.cleanGoogleSheetNow = cleanGoogleSheetNow;

// ========================================================
// USER MANAGEMENT & PERMISSION ACCESS RIGHT CONTROLLER
// ========================================================

// Get currently active logged-in user
function getCurrentUser() {
    if (AppState.isLoggedOut) {
        return null;
    }
    if (!AppState.currentUser) {
        const saved = localStorage.getItem(STORAGE_ACTIVE_USER);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const found = (AppState.setup.users || []).find(u => u.id === parsed.id || u.username === parsed.username);
                AppState.currentUser = found || parsed || null;
            } catch (e) {
                AppState.currentUser = null;
            }
        } else {
            AppState.currentUser = null;
        }
    }
    if (AppState.currentUser && !AppState.currentUser.photoUrl && AppState.currentUser.username) {
        const cached = localStorage.getItem("order_app_avatar_" + AppState.currentUser.username.toLowerCase());
        if (cached) {
            AppState.currentUser.photoUrl = cached;
        }
    }
    return AppState.currentUser || {
        id: "USR-001",
        username: "admin",
        displayName: "Administrator",
        role: "Admin",
        permissions: ["dashboard", "register", "picking", "checking", "delivery", "incompleted-delivery", "daily-delivery", "report", "setup"]
    };
}

// Check if user has permission to access a specific module
function hasUserPermission(moduleName) {
    const user = getCurrentUser();
    if (!user) return false;
    if (user.role === "Admin") return true;
    if (!Array.isArray(user.permissions)) return false;
    // Users with delivery permission automatically have access to In Completed Delivery & Daily Delivery
    if (moduleName === "incompleted-delivery" && user.permissions.includes("delivery")) return true;
    if (moduleName === "daily-delivery" && user.permissions.includes("delivery")) return true;
    return user.permissions.includes(moduleName);
}

// Module Display Name (Clean names matching Sidebar)
function getModuleNameKh(moduleName) {
    const map = {
        "dashboard": "Dashboard",
        "register": "Register Order",
        "picking": "Physical Picking",
        "checking": "Physical Checking",
        "delivery": "Delivery",
        "incompleted-delivery": "In Completed Delivery",
        "daily-delivery": "Daily Delivery",
        "report": "Report",
        "setup": "Setup"
    };
    return map[moduleName] || moduleName;
}

// Render Header Profile & Navbar Permission Locks
function renderCurrentUserProfile() {
    const user = getCurrentUser();
    if (!user) {
        const nameEl = document.getElementById("currentUserName");
        if (nameEl) nameEl.textContent = "ចូលគណនី (Login)";
        const topHeaderUserEl = document.getElementById("headerUserNameText");
        if (topHeaderUserEl) topHeaderUserEl.textContent = "ចូលគណនី (Login)";
        const mobName = document.getElementById("mobileUserName");
        if (mobName) mobName.textContent = "ចូលគណនី";
        const roleEl = document.getElementById("currentUserRoleBadge");
        if (roleEl) {
            roleEl.textContent = "Guest";
            roleEl.className = "text-[10px] font-bold text-slate-400 leading-tight";
        }
        const topBtnMobileGuide = document.getElementById("topBtnMobileGuide");
        if (topBtnMobileGuide) topBtnMobileGuide.classList.add("hidden");
        return;
    }

    // Restore cached avatar photo if missing
    if (!user.photoUrl && user.username) {
        const cachedPhoto = localStorage.getItem("order_app_avatar_" + user.username.toLowerCase());
        if (cachedPhoto) {
            user.photoUrl = cachedPhoto;
        }
    }

    const isAdmin = user.role === "Admin";
    const userInitial = (user.displayName || user.username || "U").charAt(0).toUpperCase();
    const roleGradient = isAdmin ? "bg-gradient-to-tr from-purple-600 to-indigo-600 text-white" :
                         user.role === "Manager" ? "bg-gradient-to-tr from-blue-600 to-sky-600 text-white" :
                         "bg-gradient-to-tr from-emerald-600 to-teal-600 text-white";

    // 1. Avatar (Sidebar pill)
    const avatarEl = document.getElementById("currentUserAvatar");
    if (avatarEl) {
        if (user.photoUrl) {
            avatarEl.className = "w-8 h-8 rounded-full shadow-xs ring-2 ring-white overflow-hidden bg-slate-100 flex items-center justify-center shrink-0";
            avatarEl.innerHTML = `<img src="${user.photoUrl}" alt="${escapeHtml(user.displayName || user.username)}" class="w-full h-full object-cover">`;
        } else {
            avatarEl.className = `w-8 h-8 rounded-full ${roleGradient} flex items-center justify-center text-xs font-black uppercase shadow-xs ring-2 ring-white shrink-0`;
            avatarEl.textContent = userInitial;
        }
    }

    // 2. Avatar (Dropdown header)
    const dropAvatar = document.getElementById("dropdownUserAvatar");
    if (dropAvatar) {
        if (user.photoUrl) {
            dropAvatar.className = "w-14 h-14 min-w-[3.5rem] min-h-[3.5rem] max-w-[3.5rem] max-h-[3.5rem] rounded-full ring-2 ring-white/80 shadow-md overflow-hidden bg-slate-800 flex items-center justify-center cursor-pointer transition active:scale-95 shrink-0";
            dropAvatar.innerHTML = `<img src="${user.photoUrl}" alt="${escapeHtml(user.displayName || user.username)}" class="w-full h-full object-cover">`;
        } else {
            dropAvatar.className = `w-14 h-14 min-w-[3.5rem] min-h-[3.5rem] max-w-[3.5rem] max-h-[3.5rem] rounded-full ring-2 ring-white/80 ${roleGradient} flex items-center justify-center text-lg font-black uppercase shadow-md overflow-hidden cursor-pointer transition active:scale-95 shrink-0`;
            dropAvatar.textContent = userInitial;
        }
    }

    // 3. Remove Photo Button in Dropdown Header
    const btnRemovePhoto = document.getElementById("btnRemoveProfilePhoto");
    if (btnRemovePhoto) {
        if (user.photoUrl) {
            btnRemovePhoto.classList.remove("hidden");
        } else {
            btnRemovePhoto.classList.add("hidden");
        }
    }

    // 4. Header Name & Role Badge
    const nameEl = document.getElementById("currentUserName");
    if (nameEl) nameEl.textContent = user.displayName || user.username;

    const topHeaderUserEl = document.getElementById("headerUserNameText");
    if (topHeaderUserEl) topHeaderUserEl.textContent = user.displayName || user.username;

    const mobName = document.getElementById("mobileUserName");
    if (mobName) mobName.textContent = user.displayName || user.username;

    const roleEl = document.getElementById("currentUserRoleBadge");
    if (roleEl) {
        roleEl.textContent = user.role;
        roleEl.className = isAdmin ? "text-[10px] font-bold text-purple-600 leading-tight" :
                           user.role === "Manager" ? "text-[10px] font-bold text-blue-600 leading-tight" :
                           "text-[10px] font-bold text-emerald-600 leading-tight";
    }

    // 5. Dropdown details (Option 2)
    const dropName = document.getElementById("dropdownUserDisplayName");
    if (dropName) dropName.textContent = user.displayName || user.username;
    
    const dropUser = document.getElementById("dropdownUserUsername");
    if (dropUser) dropUser.textContent = `@${user.username}`;
    
    const dropRole = document.getElementById("dropdownUserRole");
    if (dropRole) {
        const icon = isAdmin ? "👑" : user.role === "Manager" ? "🛡️" : "👤";
        dropRole.textContent = `${icon} ${user.role}`;
    }

    const dropPerm = document.getElementById("dropdownUserPermCount");
    if (dropPerm) {
        const count = isAdmin ? 8 : (user.permissions ? user.permissions.length : 0);
        dropPerm.textContent = isAdmin ? "Full Access (8)" : `${count} Modules`;
    }

    const dropRoleChip = document.getElementById("dropdownUserRoleChip");
    if (dropRoleChip) {
        dropRoleChip.textContent = user.role;
    }

    // 6. Role-Based Visibility: Settings, Sync Now, Mobile Guide, Switch Account, and User Management
    // Non-Admin users: HIDE Settings, Mobile Guide, Sync Now, Switch Account, and User Management
    const btnOpenSettings = document.getElementById("btnOpenSettings");
    const btnSyncNow = document.getElementById("btnSyncNow");
    const topBtnSyncNow = document.getElementById("topBtnSyncNow");
    const topBtnMobileGuide = document.getElementById("topBtnMobileGuide");
    const sidebarActionGrid = document.getElementById("sidebarActionGrid");

    // Top Header Sync Now is ALWAYS visible for all roles (including non-Admin) as requested
    if (topBtnSyncNow) topBtnSyncNow.classList.remove("hidden");

    if (isAdmin) {
        if (btnOpenSettings) btnOpenSettings.classList.remove("hidden");
        if (btnSyncNow) btnSyncNow.classList.remove("hidden");
        if (sidebarActionGrid) sidebarActionGrid.classList.remove("hidden");
        if (topBtnMobileGuide) topBtnMobileGuide.classList.remove("hidden");
    } else {
        if (btnOpenSettings) btnOpenSettings.classList.add("hidden");
        if (btnSyncNow) btnSyncNow.classList.add("hidden");
        if (sidebarActionGrid) sidebarActionGrid.classList.add("hidden");
        if (topBtnMobileGuide) topBtnMobileGuide.classList.add("hidden");
    }

    const switchUserItem = document.getElementById("dropdownItemSwitchUser");
    if (switchUserItem) {
        if (isAdmin) {
            switchUserItem.classList.remove("hidden");
        } else {
            switchUserItem.classList.add("hidden");
        }
    }

    const userMgmtItem = document.getElementById("dropdownItemUserManagement");
    if (userMgmtItem) {
        if (isAdmin) {
            userMgmtItem.classList.remove("hidden");
        } else {
            userMgmtItem.classList.add("hidden");
        }
    }

    const setupUserTabBtn = document.getElementById("setupTabBtn-user");
    if (setupUserTabBtn) {
        if (isAdmin) {
            setupUserTabBtn.classList.remove("hidden");
        } else {
            setupUserTabBtn.classList.add("hidden");
        }
    }

    // 7. Role-Based Visibility: Dashboard Orders Toolbar & Master Table (Image 2)
    // Admin & Manager: SHOW Search/Filter toolbar + Orders Table
    // User (non-Admin & non-Manager): HIDE Search/Filter toolbar + Orders Table (leaving ONLY KPI Cards)
    const canViewDashboardTable = user && (user.role === "Admin" || user.role === "Manager");
    const dashTableSection = document.getElementById("dashboardOrdersTableSection");
    if (dashTableSection) {
        dashTableSection.classList.toggle("hidden", !canViewDashboardTable);
    }

    // 8. Online Button & Modal Permission: Only Admin and Manager can open the modal to view online list
    const canViewOnlineModal = user && (user.role === "Admin" || user.role === "Manager");
    const topOnlineBtn = document.getElementById("topBtnOnlineUsers");
    if (topOnlineBtn) {
        if (canViewOnlineModal) {
            topOnlineBtn.classList.remove("cursor-default", "opacity-80");
            topOnlineBtn.classList.add("cursor-pointer");
            topOnlineBtn.title = "មើលអ្នកណាខ្លះកំពុង Online លើ Web App (ចុចដើម្បីមើល)";
        } else {
            topOnlineBtn.classList.remove("cursor-pointer");
            topOnlineBtn.classList.add("cursor-default", "opacity-80");
            topOnlineBtn.title = "ចំនួនអ្នកកំពុង Online សរុប (សិទ្ធិចុចមើលលម្អិតសម្រាប់តែ Admin & Manager)";
        }
    }

    const dropdownOnlineItem = document.getElementById("dropdownItemOnlineUsers");
    if (dropdownOnlineItem) {
        dropdownOnlineItem.classList.toggle("hidden", !canViewOnlineModal);
    }

    renderNavbarPermissions();
    if (window.lucide) lucide.createIcons();
}

// ========================================================
// PROFILE PHOTO UPLOAD & PERSISTENCE
// ========================================================

// Trigger hidden file picker
function triggerProfilePhotoUpload() {
    const fileInput = document.getElementById("userProfilePhotoInput");
    if (fileInput) {
        fileInput.value = "";
        fileInput.click();
    }
}

// Handle Photo File Selected & Compress to max 256x256 JPEG
function handleProfilePhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        Swal.fire({
            icon: "error",
            title: "ឯកសារមិនត្រឹមត្រូវ!",
            text: "សូមជ្រើសរើសប្រភេទ File រូបភាព (JPG, PNG, WebP) ប៉ុណ្ណោះ។",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxDim = 256;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxDim) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                }
            } else {
                if (height > maxDim) {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
            saveCurrentUserPhoto(compressedDataUrl);
        };
        img.onerror = () => {
            showToast("មិនអាចផ្ទុករូបភាពបានឡើយ!", "error");
        };
        img.src = e.target.result;
    };
    reader.onerror = () => {
        showToast("មានបញ្ហាក្នុងការអាន File រូបភាព!", "error");
    };
    reader.readAsDataURL(file);
}

// Save Profile Photo with Full Persistence & Cloud Sync
function saveCurrentUserPhoto(photoDataUrl) {
    const user = getCurrentUser();
    if (!user) return;

    user.photoUrl = photoDataUrl;
    AppState.currentUser = user;

    // 1. Cache in dedicated localStorage key by username (guarantees persistence across logout/login)
    if (user.username) {
        localStorage.setItem("order_app_avatar_" + user.username.toLowerCase(), photoDataUrl);
    }

    // 2. Save active user session
    localStorage.setItem(STORAGE_ACTIVE_USER, JSON.stringify(user));

    // 3. Update in AppState.setup.users & save to storage
    const targetUser = (AppState.setup.users || []).find(u => u.id === user.id || u.username === user.username);
    if (targetUser) {
        targetUser.photoUrl = photoDataUrl;
    }
    saveSetupState("users");

    // 4. Auto sync to Google Sheets
    if (window.SheetsSync && SheetsSync.syncUser) {
        SheetsSync.syncUser(user);
    }

    // 5. Re-render UI
    renderCurrentUserProfile();
    renderUserSetupTable();

    Swal.fire({
        icon: "success",
        title: "ជោគជ័យ! 📸",
        text: "រូបថត Profile របស់អ្នកត្រូវបានរក្សាទុក និង Sync រួចរាល់។",
        timer: 2000,
        showConfirmButton: false
    });
}

// Remove Profile Photo
function removeProfilePhoto() {
    const user = getCurrentUser();
    if (!user || !user.photoUrl) return;

    Swal.fire({
        title: "លុបរូបថត Profile?",
        text: "តើអ្នកចង់លុបរូបថត Profile នេះចេញមែនទេ? ប្រព័ន្ធនឹងត្រឡប់ទៅប្រើរូបអក្សរដំបូងនៃឈ្មោះរបស់អ្នកវិញ។",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "បាទ/ចាស លុប",
        cancelButtonText: "បោះបង់",
        confirmButtonColor: "#ef4444"
    }).then(res => {
        if (res.isConfirmed) {
            delete user.photoUrl;
            AppState.currentUser = user;

            // 1. Remove from dedicated localStorage cache
            if (user.username) {
                localStorage.removeItem("order_app_avatar_" + user.username.toLowerCase());
            }

            // 2. Save active user session
            localStorage.setItem(STORAGE_ACTIVE_USER, JSON.stringify(user));

            // 3. Update in AppState.setup.users
            const targetUser = (AppState.setup.users || []).find(u => u.id === user.id || u.username === user.username);
            if (targetUser) {
                delete targetUser.photoUrl;
            }
            saveSetupState("users");

            // 4. Auto sync to Google Sheets
            if (window.SheetsSync && SheetsSync.syncUser) {
                SheetsSync.syncUser(user);
            }

            // 5. Re-render UI
            renderCurrentUserProfile();
            renderUserSetupTable();

            showToast("បានលុបរូបថត Profile រួចរាល់!", "info");
        }
    });
}

window.triggerProfilePhotoUpload = triggerProfilePhotoUpload;
window.handleProfilePhotoSelected = handleProfilePhotoSelected;
window.saveCurrentUserPhoto = saveCurrentUserPhoto;
window.removeProfilePhoto = removeProfilePhoto;

// Quick Change Password Modal from Dropdown
function openChangePasswordQuickModal() {
    const user = getCurrentUser();
    if (!user) return;
    const dd = document.getElementById("userMenuDropdown");
    if (dd) dd.classList.add("hidden");

    Swal.fire({
        title: "ប្ដូរលេខសម្ងាត់ (Change Password)",
        html: `
            <div class="text-left text-xs text-slate-600 mb-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                គណនី: <b class="text-slate-900">${escapeHtml(user.displayName || user.username)}</b> (@${escapeHtml(user.username)})<br>
                តួនាទី: <span class="text-indigo-600 font-bold">${escapeHtml(user.role)}</span>
            </div>
            <div class="space-y-3 text-left">
                <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">លេខសម្ងាត់ថ្មី (New Password):</label>
                    <input type="password" id="swalNewPassword" class="swal2-input !m-0 !w-full !text-sm !h-10 !rounded-xl" placeholder="វាយបញ្ចូលលេខសម្ងាត់ថ្មី...">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">បញ្ជាក់លេខសម្ងាត់ (Confirm Password):</label>
                    <input type="password" id="swalConfirmPassword" class="swal2-input !m-0 !w-full !text-sm !h-10 !rounded-xl" placeholder="វាយបញ្ជាក់លេខសម្ងាត់ម្តងទៀត...">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: "រក្សាទុក (Save)",
        cancelButtonText: "បោះបង់ (Cancel)",
        confirmButtonColor: "#4f46e5",
        preConfirm: () => {
            const p1 = document.getElementById("swalNewPassword").value.trim();
            const p2 = document.getElementById("swalConfirmPassword").value.trim();
            if (!p1) {
                Swal.showValidationMessage("សូមបញ្ចូលលេខសម្ងាត់ថ្មី!");
                return false;
            }
            if (p1.length < 4) {
                Swal.showValidationMessage("លេខសម្ងាត់ត្រូវមានយ៉ាងហោច ៤ តួអក្សរឡើងទៅ!");
                return false;
            }
            if (p1 !== p2) {
                Swal.showValidationMessage("លេខសម្ងាត់ទាំងពីរមិនដូចគ្នាទេ!");
                return false;
            }
            return p1;
        }
    }).then((res) => {
        if (res.isConfirmed && res.value) {
            const newPw = res.value;
            user.password = newPw;
            const targetUser = (AppState.setup.users || []).find(u => u.id === user.id || u.username === user.username);
            if (targetUser) targetUser.password = newPw;
            saveSetupState("users");
            localStorage.setItem(STORAGE_ACTIVE_USER, JSON.stringify(user));

            // Sync remembered password if this user was remembered
            const isRemembered = localStorage.getItem(STORAGE_REMEMBER_ME_CHECKED) === "true";
            const rememberedUser = localStorage.getItem(STORAGE_REMEMBER_ME_USER) || "";
            if (isRemembered && rememberedUser.toLowerCase() === user.username.toLowerCase()) {
                localStorage.setItem(STORAGE_REMEMBER_ME_PASS, encodeRememberedPassword(newPw));
            }
            if (window.SheetsSync && SheetsSync.syncUser) {
                SheetsSync.syncUser(user);
            }
            renderUserSetupTable();
            Swal.fire({
                title: "ជោគជ័យ! 🔒",
                text: "លេខសម្ងាត់របស់អ្នកត្រូវបានផ្លាស់ប្តូរ និង Auto-Sync ទៅ Google Sheet រួចរាល់។",
                icon: "success",
                confirmButtonColor: "#059669"
            });
        }
    });
}
window.openChangePasswordQuickModal = openChangePasswordQuickModal;

// Filter Navbar tabs and Dashboard KPI cards strictly based on User Access Rights
function renderNavbarPermissions() {
    const navButtons = document.querySelectorAll(".nav-tab-btn");
    navButtons.forEach(btn => {
        const tab = btn.getAttribute("data-tab");
        if (!tab) return;
        const permitted = hasUserPermission(tab);
        const lockIcon = btn.querySelector(".perm-lock-icon");
        if (lockIcon) lockIcon.remove();
        btn.classList.remove("opacity-40");
        
        if (permitted) {
            btn.classList.remove("hidden");
            btn.style.display = "";
            btn.removeAttribute("data-restricted");
        } else {
            // Strict hiding for restricted modules as requested (hide completely)
            btn.classList.add("hidden");
            btn.style.display = "none";
            btn.setAttribute("data-restricted", "true");
        }
    });

    // Also update Dashboard KPI metric cards visibility to stay strictly in sync
    if (typeof updateKpiCardsVisibility === "function") {
        updateKpiCardsVisibility();
    }

    // Check if current active tab is forbidden for this user, if so redirect to first permitted tab
    if (AppState.currentTab && !hasUserPermission(AppState.currentTab)) {
        const allModules = ["daily-delivery", "register", "picking", "checking", "delivery", "incompleted-delivery", "dashboard", "report", "setup"];
        const firstAllowed = allModules.find(m => hasUserPermission(m));
        if (firstAllowed) {
            switchNavbarModule(firstAllowed);
        }
    }
}

// Toggle header user dropdown
function toggleUserMenuDropdown() {
    const dd = document.getElementById("userMenuDropdown");
    if (dd) {
        dd.classList.toggle("hidden");
        if (!dd.classList.contains("hidden")) {
            lucide.createIcons();
        }
    }
}

document.addEventListener("click", (e) => {
    const dd = document.getElementById("userMenuDropdown");
    const btn = document.getElementById("btnUserProfile");
    if (!dd || !btn) return;
    if (!dd.contains(e.target) && !btn.contains(e.target)) {
        dd.classList.add("hidden");
    }
});

// Obfuscation helpers for remembered password in localStorage
function encodeRememberedPassword(pass) {
    if (!pass) return "";
    try {
        return btoa(encodeURIComponent(pass));
    } catch (e) {
        return pass;
    }
}

function decodeRememberedPassword(encoded) {
    if (!encoded) return "";
    try {
        return decodeURIComponent(atob(encoded));
    } catch (e) {
        return encoded;
    }
}

// Open Login Modal
function openLoginModal() {
    const modal = document.getElementById("loginModal");
    if (!modal) return;
    
    // Close dropdown
    const dd = document.getElementById("userMenuDropdown");
    if (dd) dd.classList.add("hidden");

    // Remember Me check and pre-fill both username and password
    const loginUserIn = document.getElementById("loginUsernameInput");
    const loginPwIn = document.getElementById("loginPasswordInput");
    const rememberCb = document.getElementById("loginRememberMeCheckbox");

    const isRemembered = localStorage.getItem(STORAGE_REMEMBER_ME_CHECKED) === "true";
    const rememberedUser = localStorage.getItem(STORAGE_REMEMBER_ME_USER) || "";
    const rememberedPassRaw = localStorage.getItem(STORAGE_REMEMBER_ME_PASS) || "";

    let rememberedPass = "";
    if (rememberedPassRaw) {
        rememberedPass = decodeRememberedPassword(rememberedPassRaw);
    } else if (isRemembered && rememberedUser && AppState.setup && Array.isArray(AppState.setup.users)) {
        // Fallback: if username was saved previously, pre-fill password from setup users so user doesn't have to retype
        const matchedUser = AppState.setup.users.find(u => u.username.toLowerCase() === rememberedUser.toLowerCase());
        if (matchedUser && matchedUser.password) {
            rememberedPass = matchedUser.password;
            localStorage.setItem(STORAGE_REMEMBER_ME_PASS, encodeRememberedPassword(rememberedPass));
        }
    }

    if (rememberCb) {
        rememberCb.checked = isRemembered;
    }
    if (loginUserIn) {
        loginUserIn.value = isRemembered ? rememberedUser : "";
    }
    if (loginPwIn) {
        loginPwIn.value = isRemembered ? rememberedPass : "";
    }

    modal.classList.remove("hidden");
    lucide.createIcons();

    setTimeout(() => {
        if (loginUserIn && isRemembered && rememberedUser && rememberedPass) {
            // Both are filled, focus password so user can hit enter directly
            loginPwIn?.focus();
        } else if (loginUserIn && isRemembered && rememberedUser) {
            loginPwIn?.focus();
        } else {
            loginUserIn?.focus();
        }
    }, 100);
}

function closeLoginModal() {
    const modal = document.getElementById("loginModal");
    if (modal) modal.classList.add("hidden");
}

function handleLoginFormSubmit(e) {
    e.preventDefault();
    const username = document.getElementById("loginUsernameInput").value.trim().toLowerCase();
    const password = document.getElementById("loginPasswordInput").value.trim();
    const rememberCb = document.getElementById("loginRememberMeCheckbox");
    const isRemember = rememberCb ? rememberCb.checked : false;

    const users = AppState.setup.users || [];
    const matched = users.find(u => u.username.toLowerCase() === username && u.password === password);

    if (matched) {
        if (isRemember) {
            localStorage.setItem(STORAGE_REMEMBER_ME_CHECKED, "true");
            localStorage.setItem(STORAGE_REMEMBER_ME_USER, matched.username);
            localStorage.setItem(STORAGE_REMEMBER_ME_PASS, encodeRememberedPassword(password));
        } else {
            localStorage.removeItem(STORAGE_REMEMBER_ME_CHECKED);
            localStorage.removeItem(STORAGE_REMEMBER_ME_USER);
            localStorage.removeItem(STORAGE_REMEMBER_ME_PASS);
        }
        loginUser(matched);
    } else {
        Swal.fire({
            icon: "error",
            title: "ចូលគណនីមិនបានជោគជ័យ!",
            text: "Username ឬ Password មិនត្រឹមត្រូវឡើយ។ សូមពិនិត្យឡើងវិញ!",
            confirmButtonColor: "#2563eb"
        });
    }
}

function quickSwitchUser(username) {
    const users = AppState.setup.users || [];
    const matched = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (matched) {
        const oldUser = getCurrentUser();
        if (oldUser && oldUser.username && oldUser.username.toLowerCase() !== matched.username.toLowerCase()) {
            if (window.SheetsSync) {
                SheetsSync.logoutPresence(oldUser.username);
            }
            AppState.onlineUsers = (AppState.onlineUsers || []).filter(u => 
                !u.username || u.username.toLowerCase() !== oldUser.username.toLowerCase()
            );
        }
        loginUser(matched);
    }
}

function loginUser(user) {
    AppState.isLoggedOut = false;
    // Restore cached avatar photo if present
    if (user.username) {
        const cachedPhoto = localStorage.getItem("order_app_avatar_" + user.username.toLowerCase());
        if (cachedPhoto) {
            user.photoUrl = cachedPhoto;
        }
    }

    AppState.currentUser = user;
    localStorage.setItem(STORAGE_ACTIVE_USER, JSON.stringify(user));
    closeLoginModal();
    renderCurrentUserProfile();

    const permDesc = user.role === "Admin" ? "គ្រប់ Module ទាំងអស់ (Full Access)" : (user.permissions || []).map(p => getModuleNameKh(p)).join(", ");

    Swal.fire({
        icon: "success",
        title: `ស្វាគមន៍! 👤 ${user.displayName}`,
        html: `អ្នកបាន Login ជា <b>${user.role}</b> (@${user.username})<br><div class="mt-2 text-xs text-left bg-slate-50 p-2.5 rounded-xl border border-slate-200"><b>សិទ្ធិចូលប្រើ Module:</b><br>${permDesc || 'គ្មានសិទ្ធិ'}</div>`,
        timer: 2500,
        showConfirmButton: false
    });

    // Check if current view is permitted, if not navigate to first permitted
    if (!hasUserPermission(AppState.currentTab)) {
        const allModules = ["daily-delivery", "register", "picking", "checking", "delivery", "incompleted-delivery", "dashboard", "report", "setup"];
        const firstAllowed = allModules.find(m => hasUserPermission(m)) || "daily-delivery";
        switchNavbarModule(firstAllowed);
    }

    if (typeof updateOnlineUsersPresence === "function") {
        updateOnlineUsersPresence();
    }
    if (window.SheetsSync && SheetsSync.isConfigured()) {
        SheetsSync.checkUpdates(true);
    }
}

function logoutCurrentUser() {
    const dd = document.getElementById("userMenuDropdown");
    if (dd) dd.classList.add("hidden");

    Swal.fire({
        title: "ចាកចេញពីគណនី?",
        text: "តើអ្នកចង់ចាកចេញពីគណនីបច្ចុប្បន្នមែនទេ?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "បាទ/ចាស ចាកចេញ",
        cancelButtonText: "បោះបង់",
        confirmButtonColor: "#ef4444"
    }).then(async (res) => {
        if (res.isConfirmed) {
            const user = getCurrentUser();
            const loggedOutUsername = user ? user.username : null;

            AppState.isLoggedOut = true;
            AppState.currentUser = null;
            localStorage.removeItem(STORAGE_ACTIVE_USER);

            if (loggedOutUsername) {
                // 1. Immediately remove from local AppState.onlineUsers
                AppState.onlineUsers = (AppState.onlineUsers || []).filter(u => 
                    !u.username || u.username.toLowerCase() !== loggedOutUsername.toLowerCase()
                );
                // 2. Notify SheetsSync to update its cache, broadcast across tabs, and send server logout
                if (window.SheetsSync) {
                    await SheetsSync.logoutPresence(loggedOutUsername);
                }
            }

            updateOnlineUsersPresence();
            renderCurrentUserProfile();
            openLoginModal();
        }
    });
}

// ========================================================
// ONLINE USERS PRESENCE ENGINE (អ្នកកំពុង Online ផ្ទាល់)
// ========================================================
function getTabFriendlyName(tab) {
    const map = {
        "dashboard": "Dashboard (ទំព័រដើម)",
        "register": "1. Register Order",
        "picking": "2. Physical Picking",
        "checking": "3. Physical Checking",
        "delivery": "4. Delivery",
        "incompleted-delivery": "5. Incomplete Delivery",
        "daily-delivery": "6. Daily Delivery",
        "report": "7. Report",
        "setup": "8. Setup (ការកំណត់)"
    };
    return map[tab] || tab || "Dashboard";
}

function updateOnlineUsersPresence(userList = null) {
    if (Array.isArray(userList)) {
        AppState.onlineUsers = userList;
    }

    const currentU = getCurrentUser();
    const isMobile = (window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
    
    // Ensure current active user session is merged into the list regardless of role
    let displayList = [...(AppState.onlineUsers || [])];
    if (currentU && currentU.username && !AppState.isLoggedOut) {
        const existingIdx = displayList.findIndex(u => 
            u.username && u.username.toLowerCase() === currentU.username.toLowerCase()
        );
        const myEntry = {
            username: currentU.username,
            displayName: currentU.displayName || currentU.username,
            role: currentU.role || "User",
            device: isMobile ? "Mobile" : "PC",
            tab: AppState.currentTab || "dashboard",
            lastSeen: Date.now(),
            isSelf: true
        };
        if (existingIdx >= 0) {
            displayList[existingIdx] = { ...displayList[existingIdx], ...myEntry };
        } else {
            displayList.unshift(myEntry);
        }
    } else {
        // If current user is logged out, ensure no entry is marked as self
        displayList = displayList.filter(u => !u.isSelf);
    }

    // Deduplicate by unique username
    const uniqueMap = new Map();
    displayList.forEach(u => {
        if (u && u.username) {
            const key = u.username.toLowerCase();
            if (!uniqueMap.has(key) || u.isSelf) {
                uniqueMap.set(key, u);
            }
        }
    });
    displayList = Array.from(uniqueMap.values());

    AppState.onlineUsers = displayList;
    const totalCount = displayList.length;
    const pcCount = displayList.filter(u => (u.device || '').toLowerCase() === 'pc').length;
    const mobileCount = displayList.filter(u => (u.device || '').toLowerCase() === 'mobile').length;

    // 1. Update Header Pill
    const topOnlineText = document.getElementById("topOnlineCountText");
    if (topOnlineText) {
        topOnlineText.textContent = `${totalCount} Online`;
    }

    // 2. Update Profile Dropdown Badges & Active Chip
    const dropdownActiveText = document.getElementById("profileDropdownActiveText");
    const dropdownOnlineCount = document.getElementById("profileDropdownOnlineCount");
    const dropdownOnlineBadge = document.getElementById("profileDropdownOnlineBadge");
    if (dropdownOnlineCount) dropdownOnlineCount.textContent = totalCount;
    if (dropdownActiveText) dropdownActiveText.innerHTML = `<span id="profileDropdownOnlineCount">${totalCount}</span> Online`;
    if (dropdownOnlineBadge) dropdownOnlineBadge.textContent = `${totalCount} Online`;

    // 3. Update Modal Stats
    const modalOnlineBadge = document.getElementById("modalOnlineCountBadge");
    const modalTotal = document.getElementById("modalStatTotalOnline");
    const modalPc = document.getElementById("modalStatPcOnline");
    const modalMobile = document.getElementById("modalStatMobileOnline");
    if (modalOnlineBadge) modalOnlineBadge.textContent = `${totalCount} Online`;
    if (modalTotal) modalTotal.textContent = totalCount;
    if (modalPc) modalPc.textContent = pcCount;
    if (modalMobile) modalMobile.textContent = mobileCount;

    // 4. Render Modal List if container exists
    renderOnlineUsersList();

    // 5. Update User Management Table if visible
    const userTableBody = document.getElementById("userTableBody");
    if (userTableBody && AppState.currentTab === "setup" && AppState.currentSetupSubTab === "user") {
        renderUserSetupTable();
    }
}

function renderOnlineUsersList() {
    const container = document.getElementById("onlineUsersListContainer");
    if (!container) return;

    const list = AppState.onlineUsers || [];
    if (list.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center text-slate-400 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                <i data-lucide="users" class="w-8 h-8 mx-auto text-slate-300 mb-2"></i>
                <p class="text-xs font-semibold">មិនទាន់មានអ្នកប្រើប្រាស់ Online នៅឡើយទេ</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const currentU = getCurrentUser();

    container.innerHTML = list.map(u => {
        const isSelf = (currentU && u.username && u.username.toLowerCase() === currentU.username.toLowerCase()) || u.isSelf;
        const initial = (u.displayName || u.username || 'U').charAt(0).toUpperCase();
        
        // Find matching setup user for photo or extra info if available
        const setupUser = (AppState.setup.users || []).find(su => 
            su.username && u.username && su.username.toLowerCase() === u.username.toLowerCase()
        );
        const photoUrl = (setupUser && setupUser.photoUrl) || (isSelf && currentU && currentU.photoUrl) || null;

        const roleBadge = u.role === "Admin"
            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200 shrink-0">👑 Admin</span>`
            : u.role === "Manager"
            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">💼 Manager</span>`
            : `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">👤 User</span>`;

        const isMobile = (u.device || '').toLowerCase() === 'mobile';
        const deviceBadge = isMobile
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0">
                <i data-lucide="smartphone" class="w-3 h-3 text-indigo-600"></i>
                <span>Mobile (ទូរស័ព្ទ)</span>
               </span>`
            : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80 shrink-0">
                <i data-lucide="monitor" class="w-3 h-3 text-blue-600"></i>
                <span>PC (កុំព្យូទ័រ)</span>
               </span>`;

        const tabTitle = getTabFriendlyName(u.tab || 'dashboard');

        // Time ago
        let timeText = "សកម្មពេលនេះ (Active now)";
        if (u.lastSeen && !isSelf) {
            const diffSec = Math.max(0, Math.floor((Date.now() - u.lastSeen) / 1000));
            if (diffSec < 10) timeText = "សកម្មពេលនេះ";
            else if (diffSec < 60) timeText = `${diffSec} វិនាទីមុន`;
            else timeText = `${Math.floor(diffSec / 60)} នាទីមុន`;
        }

        const avatarHtml = photoUrl
            ? `<img src="${photoUrl}" alt="${escapeHtml(u.displayName || u.username)}" class="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/80 shadow-xs shrink-0">`
            : `<div class="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex items-center justify-center text-xs font-black ring-2 ring-emerald-500/80 shadow-xs uppercase shrink-0">${initial}</div>`;

        return `
            <div class="p-3 rounded-2xl border ${isSelf ? 'border-emerald-200 bg-emerald-50/40 ring-1 ring-emerald-300/40' : 'border-slate-200/80 bg-white hover:bg-slate-50/80'} shadow-2xs transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="relative shrink-0">
                        ${avatarHtml}
                        <span class="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white absolute -bottom-0.5 -right-0.5 flex items-center justify-center">
                            <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                        </span>
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-xs sm:text-sm font-extrabold text-slate-900 truncate">${escapeHtml(u.displayName || u.username)}</span>
                            ${isSelf ? '<span class="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-600 text-white">You (ឧបករណ៍នេះ)</span>' : ''}
                            ${roleBadge}
                        </div>
                        <div class="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                            <span class="font-mono text-slate-400">@${escapeHtml(u.username)}</span>
                            <span class="text-slate-300">•</span>
                            <span class="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                ${timeText}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 flex-wrap self-end sm:self-center shrink-0">
                    ${deviceBadge}
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        <i data-lucide="layers" class="w-3 h-3 text-slate-500"></i>
                        <span>${tabTitle}</span>
                    </span>
                </div>
            </div>
        `;
    }).join("");

    lucide.createIcons();
}

function openOnlineUsersModal() {
    // សិទ្ធិចូលមើលផ្ទាំង Online Users: អនុញ្ញាតតែ Role: Admin និង Manager ប៉ុណ្ណោះ
    const currentU = getCurrentUser();
    const canViewOnlineList = currentU && (currentU.role === "Admin" || currentU.role === "Manager");
    if (!canViewOnlineList) {
        if (typeof Swal !== "undefined") {
            Swal.fire({
                icon: "info",
                title: "សិទ្ធិមើលបញ្ជីអ្នក Online 🔒",
                text: "មានតែគណនី Role: Admin និង Manager ប៉ុណ្ណោះដែលអាចបើកមើលផ្ទាំងអ្នក Online លម្អិតបាន។",
                confirmButtonColor: "#2563eb",
                confirmButtonText: "យល់ព្រម"
            });
        }
        return;
    }

    const modal = document.getElementById("onlineUsersModal");
    if (!modal) return;
    
    // Close sidebar profile dropdown if open
    const dd = document.getElementById("userMenuDropdown");
    if (dd) dd.classList.add("hidden");

    updateOnlineUsersPresence();
    modal.classList.remove("hidden");
    lucide.createIcons();

    // Trigger an immediate heartbeat check with cloud to get latest list
    if (window.SheetsSync && SheetsSync.isConfigured()) {
        SheetsSync.checkUpdates(true);
    }
}

function closeOnlineUsersModal() {
    const modal = document.getElementById("onlineUsersModal");
    if (modal) modal.classList.add("hidden");
}

async function refreshOnlineUsersNow() {
    if (!window.SheetsSync || !SheetsSync.isConfigured()) {
        updateOnlineUsersPresence();
        if (typeof showToast === "function") showToast("ដំណើរការ Offline (អ្នកប្រើប្រាស់នៅលើ Browser នេះ)", "info");
        return;
    }

    try {
        if (typeof showToast === "function") showToast("កំពុង Update បញ្ជីអ្នក Online...", "info");
        await SheetsSync.checkUpdates(true);
        updateOnlineUsersPresence();
        if (typeof showToast === "function") showToast("បាន Update បញ្ជីអ្នក Online រួចរាល់!", "success");
    } catch(e) {
        updateOnlineUsersPresence();
    }
}

window.openOnlineUsersModal = openOnlineUsersModal;
window.closeOnlineUsersModal = closeOnlineUsersModal;
window.refreshOnlineUsersNow = refreshOnlineUsersNow;
window.updateOnlineUsersPresence = updateOnlineUsersPresence;
window.getTabFriendlyName = getTabFriendlyName;

function navigateToUserManagement() {
    const dd = document.getElementById("userMenuDropdown");
    if (dd) dd.classList.add("hidden");

    const user = getCurrentUser();
    if (!user || user.role !== "Admin") {
        Swal.fire({
            icon: "warning",
            title: "គ្មានសិទ្ធិចូលប្រើប្រាស់!",
            text: "មានតែ Admin ប៉ុណ្ណោះដែលអាចចូលប្រើប្រាស់ និងគ្រប់គ្រង User Management បាន។",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    switchNavbarModule("setup");
    switchSetupSubTab("user");
}

// ----------------------------------------------------
// USER MANAGEMENT SETUP CRUD (SUB-PANEL 5)
// ----------------------------------------------------
function renderUserSetupTable() {
    const tbody = document.getElementById("userTableBody");
    if (!tbody) return;

    const query = (AppState.setupSearchQuery || "").toLowerCase().trim();
    const users = AppState.setup.users || [];

    let filtered = users;
    if (query) {
        filtered = users.filter(u => 
            (u.username && u.username.toLowerCase().includes(query)) ||
            (u.displayName && u.displayName.toLowerCase().includes(query)) ||
            (u.role && u.role.toLowerCase().includes(query)) ||
            (u.id && u.id.toLowerCase().includes(query))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-8 text-slate-400">
                    <div class="flex flex-col items-center gap-2">
                        <i data-lucide="shield-alert" class="w-8 h-8 text-slate-300"></i>
                        <span class="text-xs">មិនមានអ្នកប្រើប្រាស់ដែលត្រូវនឹងការស្វែងរកឡើយ</span>
                    </div>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    const currentU = getCurrentUser();

    tbody.innerHTML = filtered.map(u => {
        const isCurrent = currentU && (currentU.id === u.id || (currentU.username && u.username && currentU.username.toLowerCase() === u.username.toLowerCase()));
        const roleBadge = u.role === "Admin" 
            ? `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-1">👑 Admin</span>`
            : u.role === "Manager"
            ? `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">💼 Manager</span>`
            : `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1">👤 User</span>`;

        // Live Presence Status (All Roles)
        const onlineEntry = (AppState.onlineUsers || []).find(o => 
            (o.username && u.username && o.username.toLowerCase() === u.username.toLowerCase())
        );
        const isOnline = !!onlineEntry || isCurrent;
        const deviceType = onlineEntry ? onlineEntry.device : (isCurrent ? ((window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) ? 'Mobile' : 'PC') : 'PC');
        const activeTab = onlineEntry ? (onlineEntry.tab || 'dashboard') : (isCurrent ? AppState.currentTab : '');
        const tabTitle = getTabFriendlyName(activeTab);

        const liveStatusBadge = isOnline
            ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Online</span>
                <span class="text-[10px] text-slate-400 font-medium">(${deviceType === 'Mobile' ? '📱 Mobile' : '💻 PC'}${tabTitle ? ' • ' + tabTitle : ''})</span>
               </span>`
            : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-50 text-slate-400 border border-slate-200/70">
                <span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                <span>Offline</span>
               </span>`;

        // Permission Badges
        const perms = u.role === "Admin" 
            ? ["dashboard", "register", "picking", "checking", "delivery", "incompleted-delivery", "daily-delivery", "report", "setup"] 
            : (u.permissions || []);
        
        const permLabels = {
            "dashboard": "Dashboard",
            "register": "1.Register",
            "picking": "2.Picking",
            "checking": "3.Checking",
            "delivery": "4.Delivery",
            "incompleted-delivery": "5.Incomplete",
            "daily-delivery": "6.Daily",
            "report": "7.Report",
            "setup": "8.Setup"
        };
        const permColors = {
            "dashboard": "bg-blue-50 text-blue-700 border-blue-200",
            "register": "bg-blue-50 text-blue-700 border-blue-200",
            "picking": "bg-amber-50 text-amber-700 border-amber-200",
            "checking": "bg-purple-50 text-purple-700 border-purple-200",
            "delivery": "bg-sky-50 text-sky-700 border-sky-200",
            "incompleted-delivery": "bg-amber-50 text-amber-750 border-amber-300",
            "daily-delivery": "bg-emerald-50 text-emerald-700 border-emerald-200",
            "report": "bg-indigo-50 text-indigo-700 border-indigo-200",
            "setup": "bg-emerald-50 text-emerald-700 border-emerald-200"
        };

        const permsHtml = perms.map(p => `
            <span class="inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${permColors[p] || 'bg-slate-50 text-slate-600 border-slate-200'}">
                ${permLabels[p] || p}
            </span>
        `).join(" ");

        const userInitial = (u.displayName || u.username || 'U').charAt(0).toUpperCase();
        const avatarThumbnail = u.photoUrl
            ? `<img src="${u.photoUrl}" alt="${escapeHtml(u.displayName)}" class="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200 shrink-0">`
            : `<span class="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">${userInitial}</span>`;

        return `
            <tr class="hover:bg-slate-50/80 transition ${isCurrent ? 'bg-indigo-50/40' : ''}">
                <td class="py-3 px-4 font-mono font-medium text-slate-500 text-xs">${escapeHtml(u.id || '')}</td>
                <td class="py-3 px-4 font-bold text-slate-900">
                    <div class="flex items-center gap-2">
                        ${avatarThumbnail}
                        <span>${escapeHtml(u.displayName)}</span>
                        ${isCurrent ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">You</span>' : ''}
                    </div>
                </td>
                <td class="py-3 px-4 font-mono font-semibold text-slate-700 text-xs">
                    <span class="text-slate-400">@</span>${escapeHtml(u.username)}
                </td>
                <td class="py-3 px-4 whitespace-nowrap">${liveStatusBadge}</td>
                <td class="py-3 px-4 text-xs font-mono">
                    <div class="flex items-center gap-1.5">
                        <span id="pw-mask-${u.id}" class="text-slate-600 font-bold">••••••</span>
                        <button type="button" onclick="toggleTablePasswordVisibility('${u.id}', '${escapeHtml(u.password || '')}')" class="text-slate-400 hover:text-slate-600 p-0.5 rounded" title="មើល / លាក់ Password">
                            <i data-lucide="eye" class="w-3.5 h-3.5" id="pw-eye-${u.id}"></i>
                        </button>
                    </div>
                </td>
                <td class="py-3 px-4 whitespace-nowrap">${roleBadge}</td>
                <td class="py-3 px-4">
                    <div class="flex flex-wrap gap-1 max-w-[340px]">
                        ${permsHtml || '<span class="text-xs text-slate-400 italic">គ្មានសិទ្ធិ</span>'}
                    </div>
                </td>
                <td class="py-3 px-4 text-slate-400 text-xs">${escapeHtml(u.lastUpdated || formatAppDateTime())}</td>
                <td class="py-3 px-4 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-1.5">
                        <button onclick="quickSwitchUser('${escapeHtml(u.username)}')" class="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition" title="Login ជា User នេះភ្លាមៗ (Quick Switch)">
                            <i data-lucide="log-in" class="w-4 h-4"></i>
                        </button>
                        <button onclick="openEditUserModal('${escapeHtml(u.id)}')" class="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition" title="កែប្រែ (Edit)">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deleteUserItem('${escapeHtml(u.id)}')" class="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition ${isCurrent ? 'opacity-30 cursor-not-allowed' : ''}" title="${isCurrent ? 'មិនអាចលុបគណនីកំពុង Login បានទេ' : 'លុប (Delete)'}">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    lucide.createIcons();
}

function toggleTablePasswordVisibility(id, actualPw) {
    const maskEl = document.getElementById(`pw-mask-${id}`);
    if (!maskEl) return;
    if (maskEl.textContent === "••••••") {
        maskEl.textContent = actualPw || "123";
        maskEl.classList.add("text-indigo-600");
    } else {
        maskEl.textContent = "••••••";
        maskEl.classList.remove("text-indigo-600");
    }
}

function openAddUserModal() {
    const form = document.getElementById("userForm");
    if (form) form.reset();
    document.getElementById("userModalId").value = "";
    document.getElementById("userModalTitle").textContent = "បន្ថែមអ្នកប្រើប្រាស់ថ្មី (Add User)";
    document.getElementById("userModalRole").value = "User";

    // Default permissions for new User: register only
    setUserPermissionAll(false);
    const regCb = document.querySelector('input[name="userPermCheckbox"][value="register"]');
    if (regCb) regCb.checked = true;

    document.getElementById("userModal").classList.remove("hidden");
    lucide.createIcons();
}

function openEditUserModal(userId) {
    const user = (AppState.setup.users || []).find(u => u.id === userId);
    if (!user) {
        showToast("រកមិនឃើញអ្នកប្រើប្រាស់នេះឡើយ!", "error");
        return;
    }

    document.getElementById("userModalId").value = user.id;
    document.getElementById("userModalTitle").textContent = `កែប្រែអ្នកប្រើប្រាស់ (${user.username})`;
    document.getElementById("userModalDisplayName").value = user.displayName || "";
    document.getElementById("userModalUsername").value = user.username || "";
    document.getElementById("userModalPassword").value = user.password || "";
    document.getElementById("userModalRole").value = user.role || "User";

    const perms = user.role === "Admin" 
        ? ["dashboard", "register", "picking", "checking", "delivery", "incompleted-delivery", "daily-delivery", "report", "setup"] 
        : (user.permissions || []);
    
    document.querySelectorAll('input[name="userPermCheckbox"]').forEach(cb => {
        cb.checked = perms.includes(cb.value);
    });

    document.getElementById("userModal").classList.remove("hidden");
    lucide.createIcons();
}

function closeUserModal() {
    const modal = document.getElementById("userModal");
    if (modal) modal.classList.add("hidden");
}

function handleUserRoleChange(role) {
    if (role === "Admin") {
        setUserPermissionAll(true);
    } else if (role === "Manager") {
        document.querySelectorAll('input[name="userPermCheckbox"]').forEach(cb => {
            cb.checked = (cb.value !== "setup");
        });
    }
}

function setUserPermissionAll(checked) {
    document.querySelectorAll('input[name="userPermCheckbox"]').forEach(cb => {
        cb.checked = checked;
    });
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
}

function handleUserFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("userModalId").value.trim();
    const displayName = document.getElementById("userModalDisplayName").value.trim();
    const username = document.getElementById("userModalUsername").value.trim().toLowerCase();
    const password = document.getElementById("userModalPassword").value.trim();
    const role = document.getElementById("userModalRole").value;

    const checkedPerms = [];
    document.querySelectorAll('input[name="userPermCheckbox"]:checked').forEach(cb => {
        checkedPerms.push(cb.value);
    });

    if (!displayName || !username || !password) {
        showToast("សូមបំពេញ Display Name, Username, និង Password!", "error");
        return;
    }

    // Check username uniqueness
    const duplicate = AppState.setup.users.find(u => u.username.toLowerCase() === username && u.id !== id);
    if (duplicate) {
        showToast(`Username "${username}" នេះត្រូវបានប្រើប្រាស់រួចហើយ!`, "error");
        return;
    }

    const now = formatAppDateTime();

    let targetUser = null;

    if (id) {
        // Edit existing user
        const idx = AppState.setup.users.findIndex(u => u.id === id);
        if (idx !== -1) {
            targetUser = {
                ...AppState.setup.users[idx],
                displayName,
                username,
                password,
                role,
                permissions: role === "Admin" ? ["dashboard", "register", "picking", "checking", "delivery", "incompleted-delivery", "daily-delivery", "report", "setup"] : checkedPerms,
                lastUpdated: now
            };
            AppState.setup.users[idx] = targetUser;

            // If active user is this user, update active user too
            if (AppState.currentUser && AppState.currentUser.id === id) {
                AppState.currentUser = targetUser;
                localStorage.setItem(STORAGE_ACTIVE_USER, JSON.stringify(AppState.currentUser));
            }
            showToast(`បានកែប្រែអ្នកប្រើប្រាស់ ${displayName} ជោគជ័យ!`, "success");
        }
    } else {
        // Add new user
        const newId = `USR-${String(AppState.setup.users.length + 1).padStart(3, '0')}`;
        targetUser = {
            id: newId,
            displayName,
            username,
            password,
            role,
            permissions: role === "Admin" ? ["dashboard", "register", "picking", "checking", "delivery", "incompleted-delivery", "daily-delivery", "report", "setup"] : checkedPerms,
            lastUpdated: now
        };
        AppState.setup.users.push(targetUser);
        showToast(`បានបន្ថែមអ្នកប្រើប្រាស់ ${displayName} ជោគជ័យ!`, "success");
    }

    saveSetupState("users");
    closeUserModal();
    renderSetupView();
    renderUserSetupTable();
    renderCurrentUserProfile();

    // Auto sync user to Google Sheets
    if (targetUser) {
        SheetsSync.syncUser(targetUser);
    }
}

function deleteUserItem(userId) {
    const currentU = getCurrentUser();
    if (currentU && currentU.id === userId) {
        Swal.fire({
            icon: "error",
            title: "មិនអាចលុបបានទេ!",
            text: "អ្នកមិនអាចលុបគណនីដែលកំពុង Login ប្រើប្រាស់ពេលនេះបានឡើយ។"
        });
        return;
    }

    const user = AppState.setup.users.find(u => u.id === userId);
    if (!user) return;

    // Check if this is the only Admin
    if (user.role === "Admin") {
        const adminCount = AppState.setup.users.filter(u => u.role === "Admin").length;
        if (adminCount <= 1) {
            Swal.fire({
                icon: "warning",
                title: "មិនអាចលុបបានទេ!",
                text: "ត្រូវតែមាន Admin យ៉ាងហោចណាស់ម្នាក់ក្នុងប្រព័ន្ធ!"
            });
            return;
        }
    }

    Swal.fire({
        title: `លុបអ្នកប្រើប្រាស់ "${user.displayName}"?`,
        text: `តើអ្នកប្រាកដថាចង់លុបគណនី @${user.username} នេះចេញពីប្រព័ន្ធមែនទេ?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "បាទ/ចាស លុប",
        cancelButtonText: "បោះបង់",
        confirmButtonColor: "#ef4444"
    }).then(res => {
        if (res.isConfirmed) {
            AppState.setup.users = AppState.setup.users.filter(u => u.id !== userId);
            saveSetupState("users");
            renderSetupView();
            renderUserSetupTable();
            showToast(`បានលុបអ្នកប្រើប្រាស់ ${user.displayName} រួចរាល់!`, "success");

            // Auto sync deletion to Google Sheets
            SheetsSync.deleteUser(user.id, user.username);
        }
    });
}

// Live timer updater for currently running steps
function startLiveTimers() {
    if (AppState.activeTimerInterval) clearInterval(AppState.activeTimerInterval);
    AppState.activeTimerInterval = setInterval(() => {
        // Keeps any ongoing UI clocks fresh
    }, 1000);
}

// Notification helper - suppressed bottom-right toasts as requested by user
function showToast(message, type = "info") {
    // If warning or error, present via clean SweetAlert modal instead of bottom-right toast
    if (type === "error" || type === "warning") {
        if (typeof Swal !== "undefined") {
            Swal.fire({
                icon: type === "error" ? "error" : "warning",
                title: message,
                confirmButtonText: "យល់ព្រម",
                confirmButtonColor: "#2563eb"
            });
            return;
        }
    }
    // Suppress bottom-right toast popups completely
    console.log(`[Notification] ${type}: ${message}`);
}

// Explicit Global Window Bindings for inline DOM actions
window.switchTab = switchTab;
window.viewOrderDetails = viewOrderDetails;
window.quickActionNavigate = quickActionNavigate;
window.startPicking = startPicking;
window.endPicking = endPicking;
window.restartPicking = restartPicking;
window.generateNextAutoSONumber = generateNextAutoSONumber;
window.startChecking = startChecking;
window.endChecking = endChecking;
window.startDelivery = startDelivery;
window.endDelivery = endDelivery;
window.closeOrderDetails = closeOrderDetails;
window.syncFromGoogleSheet = syncFromGoogleSheet;

// Setup Sub-Tab & CRUD Modals Global Bindings
window.switchSetupSubTab = switchSetupSubTab;

window.openAddCustomerModal = openAddCustomerModal;
window.openEditCustomerModal = openEditCustomerModal;
window.closeCustomerModal = closeCustomerModal;
window.deleteCustomerItem = deleteCustomerItem;

window.openAddBUModal = openAddBUModal;
window.openEditBUModal = openEditBUModal;
window.closeBUModal = closeBUModal;
window.deleteBUItem = deleteBUItem;

window.openAddPackageTypeModal = openAddPackageTypeModal;
window.openEditPackageTypeModal = openEditPackageTypeModal;
window.closePackageModal = closePackageModal;
window.deletePackageTypeItem = deletePackageTypeItem;

window.openAddDocTypeModal = openAddDocTypeModal;
window.openEditDocTypeModal = openEditDocTypeModal;
window.closeDocModal = closeDocModal;
window.deleteDocTypeItem = deleteDocTypeItem;

window.syncAllSetupToSheets = syncAllSetupToSheets;

// Order Edit Modal Bindings
window.openEditOrderModal = openEditOrderModal;
window.closeEditOrderModal = closeEditOrderModal;
window.filterByStatusFromCard = filterByStatusFromCard;
window.updateCardActiveStates = updateCardActiveStates;

// Personal Display & Highlight System Bindings
// Note: window.refreshPersonalDisplayMenu is already exported inside initPersonalDisplayDropdown()
window.updatePersonalDisplayCountBadge = updatePersonalDisplayCountBadge;
window.toggleOrderRowHighlight = toggleOrderRowHighlight;
window.selectHighlightPreset = selectHighlightPreset;
window.clearAllHighlights = clearAllHighlights;

// Modal Controls Bindings
window.toggleFullscreenOrderModal = toggleFullscreenOrderModal;
window.closeTopActiveModal = closeTopActiveModal;

// Pipeline Modules & Flow Bindings
window.renderRegisterView = renderRegisterView;
window.openCreateOrderModal = openCreateOrderModal;
window.closeCreateOrderModal = closeCreateOrderModal;
window.openEndDeliveryModal = openEndDeliveryModal;
window.closeEndDeliveryModal = closeEndDeliveryModal;
window.confirmEndDelivery = confirmEndDelivery;
window.updateDeliveryOptionStyles = updateDeliveryOptionStyles;
window.openEndCheckingModal = openEndCheckingModal;
window.closeEndCheckingModal = closeEndCheckingModal;
window.confirmEndChecking = confirmEndChecking;
window.adjustEndCheckingTotalPkg = adjustEndCheckingTotalPkg;
window.endChecking = endChecking;
window.restartPicking = restartPicking;
window.switchNavbarModule = switchNavbarModule;
window.goToDashboard = goToDashboard;
window.openModuleCards = openModuleCards;
window.onCardsSearchInput = onCardsSearchInput;
window.clearCardsSearch = clearCardsSearch;
window.focusActiveSearchInput = focusActiveSearchInput;
window.renderIncompletedDeliveryView = renderIncompletedDeliveryView;
window.startSecondDelivery = startSecondDelivery;
window.getOrdinal = getOrdinal;
window.getSuccessStatusName = getSuccessStatusName;
window.getDocumentTypeBadgeClass = getDocumentTypeBadgeClass;
window.renderDocumentTypeBadge = renderDocumentTypeBadge;

// Module: Report Global Bindings
window.switchReportTab = switchReportTab;
window.renderReportView = renderReportView;
window.toggleReportSoDateSort = toggleReportSoDateSort;
window.setReportSoDateSort = setReportSoDateSort;
window.toggleReportSoDateMenu = toggleReportSoDateMenu;
window.selectReportSortDirection = selectReportSortDirection;
window.onReportFilterChange = onReportFilterChange;
window.resetReportFilters = resetReportFilters;
window.changeReportPage = changeReportPage;
window.exportCurrentReportToExcel = exportCurrentReportToExcel;

// User Management & Login System Bindings
window.getCurrentUser = getCurrentUser;
window.hasUserPermission = hasUserPermission;
window.renderCurrentUserProfile = renderCurrentUserProfile;
window.renderNavbarPermissions = renderNavbarPermissions;
window.toggleUserMenuDropdown = toggleUserMenuDropdown;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.quickSwitchUser = quickSwitchUser;
window.loginUser = loginUser;
window.logoutCurrentUser = logoutCurrentUser;
window.navigateToUserManagement = navigateToUserManagement;
window.renderUserSetupTable = renderUserSetupTable;
window.toggleTablePasswordVisibility = toggleTablePasswordVisibility;
window.openAddUserModal = openAddUserModal;
window.openEditUserModal = openEditUserModal;
window.closeUserModal = closeUserModal;
window.handleUserRoleChange = handleUserRoleChange;
window.setUserPermissionAll = setUserPermissionAll;
window.togglePasswordVisibility = togglePasswordVisibility;
window.deleteUserItem = deleteUserItem;

// ========================================================
// MOBILE QR & BARCODE CAMERA SCANNER CONTROLLER
// Supports: SO#, Packing List#, Invoice# auto-fill via Camera
// ========================================================
var currentQrTargetInputId = null;
var currentQrTargetLabel = "";
var html5QrScannerInstance = null;
var currentCameraIndex = 0;
var availableVideoDevices = [];
var isScannerTorchOn = false;

// Audio Beep Feedback (Web Audio API synth - works offline)
function playScanSuccessBeep() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const audioCtx = new AudioContextClass();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(987.77, audioCtx.currentTime); // B5 tone
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.18);
    } catch (e) {
        // Silently ignore if audio blocked by browser policy
    }
}

// Smart text cleaner for QR / Barcode data
function cleanScannedCode(rawText, targetFieldId) {
    if (!rawText) return "";
    let str = String(rawText).trim();

    // If encoded as JSON string (e.g. {"so": "SO-DHC-0001234"})
    if (str.startsWith("{") && str.endsWith("}")) {
        try {
            const parsed = JSON.parse(str);
            if ((targetFieldId === "fieldSONumber" || targetFieldId === "editOrderSONumber") && (parsed.so || parsed.soNumber || parsed.so_number)) {
                return String(parsed.so || parsed.soNumber || parsed.so_number).trim();
            }
            if ((targetFieldId === "fieldPackingList" || targetFieldId === "editPackingList") && (parsed.pl || parsed.packingList || parsed.packing_list)) {
                return String(parsed.pl || parsed.packingList || parsed.packing_list).trim();
            }
            if ((targetFieldId === "fieldInvoiceNumber" || targetFieldId === "editInvoiceNumber") && (parsed.inv || parsed.invoice || parsed.invoiceNumber)) {
                return String(parsed.inv || parsed.invoice || parsed.invoiceNumber).trim();
            }
        } catch (e) {}
    }

    // Strip common human-readable prefixes like "SO: ", "SO# ", "PL# ", "INV: "
    if (targetFieldId === "fieldSONumber" || targetFieldId === "editOrderSONumber") {
        str = str.replace(/^(SO#?|SO\s*Number|Sale\s*Order#?)\s*[:=\-]?\s*/i, "").trim();
    } else if (targetFieldId === "fieldPackingList" || targetFieldId === "editPackingList") {
        str = str.replace(/^(PL#?|Packing\s*List#?)\s*[:=\-]?\s*/i, "").trim();
    } else if (targetFieldId === "fieldInvoiceNumber" || targetFieldId === "editInvoiceNumber") {
        str = str.replace(/^(INV#?|Invoice#?)\s*[:=\-]?\s*/i, "").trim();
    }
    return str;
}

// Open Scanner Modal for a specific input field
async function openQrScannerModal(targetInputId, fieldLabelKh) {
    currentQrTargetInputId = targetInputId;
    currentQrTargetLabel = fieldLabelKh || targetInputId;

    const modal = document.getElementById("qrScannerModal");
    const targetLabelEl = document.getElementById("qrScanTargetLabel");
    const statusOverlay = document.getElementById("qrScanStatusOverlay");
    const statusText = document.getElementById("qrScanStatusText");

    if (targetLabelEl) targetLabelEl.textContent = currentQrTargetLabel;
    if (statusOverlay) statusOverlay.classList.remove("hidden");
    if (statusText) statusText.textContent = "កំពុងបើកកាមេរ៉ាទូរស័ព្ទ...";

    if (modal) modal.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();

    if (typeof Html5Qrcode === "undefined") {
        Swal.fire({
            icon: "error",
            title: "កំហុស QR Scanner!",
            text: "មិនអាចទាញយកបណ្ណាល័យ HTML5 QR Scanner បានឡើយ។ សូមពិនិត្យការតភ្ជាប់!",
            confirmButtonColor: "#2563eb"
        });
        closeQrScannerModal();
        return;
    }

    startCameraScanner();
}

// Start Camera Stream with HTML5 QR Code Scanner
async function startCameraScanner() {
    const statusOverlay = document.getElementById("qrScanStatusOverlay");
    const statusText = document.getElementById("qrScanStatusText");
    const viewportId = "qrScannerViewport";

    // Clean up previous instance if running
    if (html5QrScannerInstance) {
        try {
            await html5QrScannerInstance.stop();
        } catch (e) {}
        try {
            html5QrScannerInstance.clear();
        } catch (e) {}
        html5QrScannerInstance = null;
    }

    try {
        html5QrScannerInstance = new Html5Qrcode(viewportId);

        // Fetch available camera devices
        try {
            availableVideoDevices = await Html5Qrcode.getCameras();
        } catch (e) {
            availableVideoDevices = [];
        }

        const cameraConfig = {
            facingMode: "environment" // Mobile back camera preference
        };

        const scanConfig = {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const qrBoxSize = Math.floor(minEdge * 0.75);
                return {
                    width: Math.max(qrBoxSize, 200),
                    height: Math.max(qrBoxSize, 200)
                };
            },
            aspectRatio: 1.0,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.CODE_93,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.DATA_MATRIX,
                Html5QrcodeSupportedFormats.ITF
            ]
        };

        await html5QrScannerInstance.start(
            cameraConfig,
            scanConfig,
            onQrCodeSuccess,
            (errorMessage) => {
                // Ignore transient frame scan errors
            }
        );

        if (statusOverlay) statusOverlay.classList.add("hidden");
    } catch (err) {
        console.warn("Camera start error:", err);
        if (statusOverlay) statusOverlay.classList.remove("hidden");
        if (statusText) {
            const isHttpInsecure = window.location.protocol === "http:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
            if (isHttpInsecure) {
                statusText.innerHTML = `
                    <div class="space-y-2">
                        <span class="text-amber-400 font-bold block text-xs">ទូរស័ព្ទតម្រូវឱ្យ HTTPS ដើម្បីបើកកាមេរ៉ា Live</span>
                        <p class="text-slate-300 text-[11px] leading-relaxed">
                            សូមចុចប៊ូតុងខាងក្រោមដើម្បីថតរូបស្កេន QR ភ្លាមៗ (ដំណើរការ 100% គ្រប់ទូរស័ព្ទ)៖
                        </p>
                        <button type="button" onclick="document.getElementById('qrCameraSnapInput').click()" class="mt-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer">
                            <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                            <span>ថតរូបស្កេន QR (Snap Photo)</span>
                        </button>
                    </div>
                `;
            } else {
                statusText.innerHTML = `
                    <div class="space-y-2">
                        <span class="text-rose-400 font-bold block text-xs">មិនអាចបើកកាមេរ៉ាផ្ទាល់បានទេ</span>
                        <p class="text-slate-300 text-[11px]">សូមអនុញ្ញាត Camera Permissions ក្នុង Browser ឬចុចថតរូបស្កេនខាងក្រោម៖</p>
                        <button type="button" onclick="document.getElementById('qrCameraSnapInput').click()" class="mt-1 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer">
                            <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                            <span>ថតរូបស្កេន QR (Snap Photo)</span>
                        </button>
                    </div>
                `;
            }
            if (window.lucide) lucide.createIcons();
        }
    }
}

// Scan Success Handler: Auto-fill target field and give sound/visual feedback
function onQrCodeSuccess(decodedText, decodedResult) {
    if (!decodedText || !currentQrTargetInputId) return;

    const cleanedText = cleanScannedCode(decodedText, currentQrTargetInputId);
    if (!cleanedText) return;

    // 1. Audio and Haptic feedback
    playScanSuccessBeep();
    if (navigator.vibrate) {
        try { navigator.vibrate([100, 50, 100]); } catch (e) {}
    }

    // 2. Fill in target input inside createOrderModal
    const targetInput = document.getElementById(currentQrTargetInputId);
    if (targetInput) {
        targetInput.value = cleanedText;
        targetInput.dispatchEvent(new Event("input", { bubbles: true }));
        targetInput.dispatchEvent(new Event("change", { bubbles: true }));

        // Flash visual highlight on the input
        targetInput.classList.add("ring-4", "ring-emerald-400", "bg-emerald-50");
        setTimeout(() => {
            targetInput.classList.remove("ring-4", "ring-emerald-400", "bg-emerald-50");
        }, 1200);

        targetInput.focus();
    }

    // 3. Success Toast
    if (typeof Toastify === "function") {
        Toastify({
            text: `✅ ស្កេនជោគជ័យ: ${cleanedText} បានបំពេញក្នុង ${currentQrTargetLabel}`,
            duration: 3500,
            gravity: "top",
            position: "center",
            style: {
                background: "linear-gradient(to right, #059669, #10b981)",
                borderRadius: "14px",
                fontWeight: "bold",
                fontSize: "13px",
                boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.5)"
            }
        }).showToast();
    }

    // 4. Close scanner modal
    closeQrScannerModal();
}

// Image File Scan Fallback
async function handleQrFileScan(event) {
    const file = event.target.files && event.target.files[0];
    if (!file || !currentQrTargetInputId) return;

    const statusOverlay = document.getElementById("qrScanStatusOverlay");
    const statusText = document.getElementById("qrScanStatusText");
    if (statusOverlay) statusOverlay.classList.remove("hidden");
    if (statusText) statusText.textContent = "កំពុងស្កេនរូបភាព...";

    try {
        const fileScanner = new Html5Qrcode("qrScannerViewport");
        const decodedText = await fileScanner.scanFile(file, true);
        if (decodedText) {
            onQrCodeSuccess(decodedText, null);
        }
    } catch (err) {
        console.warn("Scan from file failed:", err);
        Swal.fire({
            icon: "warning",
            title: "មិនឃើញ QR / Barcode!",
            text: "មិនអាចស្វែងរក QR Code ឬ Barcode ក្នុងរូបភាពនេះឡើយ។ សូមសាកល្បងម្ដងទៀត!",
            confirmButtonColor: "#2563eb"
        });
        if (statusOverlay) statusOverlay.classList.add("hidden");
    } finally {
        event.target.value = "";
    }
}

// Close and stop camera
async function closeQrScannerModal() {
    const modal = document.getElementById("qrScannerModal");
    if (modal) modal.classList.add("hidden");

    if (html5QrScannerInstance) {
        try {
            await html5QrScannerInstance.stop();
        } catch (e) {}
        try {
            html5QrScannerInstance.clear();
        } catch (e) {}
        html5QrScannerInstance = null;
    }
    isScannerTorchOn = false;
    const btnText = document.getElementById("torchBtnText");
    if (btnText) btnText.textContent = "Flash";
    currentQrTargetInputId = null;
}

// Torch / Flashlight Toggle
async function toggleScannerTorch() {
    if (!html5QrScannerInstance) return;
    try {
        isScannerTorchOn = !isScannerTorchOn;
        await html5QrScannerInstance.applyVideoConstraints({
            advanced: [{ torch: isScannerTorchOn }]
        });
        const btnText = document.getElementById("torchBtnText");
        if (btnText) btnText.textContent = isScannerTorchOn ? "Flash On" : "Flash";
    } catch (e) {
        if (typeof Toastify === "function") {
            Toastify({
                text: "ឧបករណ៍នេះមិនគាំទ្រ Flashlight តាម Web ទេ",
                duration: 2000,
                style: { background: "#e11d48", borderRadius: "10px" }
            }).showToast();
        }
    }
}

// Switch Camera Front / Back
async function switchScannerCamera() {
    if (!html5QrScannerInstance) return;
    if (!availableVideoDevices || availableVideoDevices.length <= 1) {
        if (typeof Toastify === "function") {
            Toastify({
                text: "មានកាមេរ៉ាតែមួយប៉ុណ្ណោះលើឧបករណ៍នេះ",
                duration: 2000,
                style: { background: "#475569", borderRadius: "10px" }
            }).showToast();
        }
        return;
    }

    currentCameraIndex = (currentCameraIndex + 1) % availableVideoDevices.length;
    const nextCamera = availableVideoDevices[currentCameraIndex];
    if (!nextCamera) return;

    try {
        await html5QrScannerInstance.stop();
        const scanConfig = {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };
        await html5QrScannerInstance.start(
            nextCamera.id,
            scanConfig,
            onQrCodeSuccess,
            () => {}
        );
    } catch (e) {
        console.error("Camera switch error:", e);
    }
}

// Window Bindings for QR Scanner
window.openQrScannerModal = openQrScannerModal;
window.closeQrScannerModal = closeQrScannerModal;
window.handleQrFileScan = handleQrFileScan;
window.toggleScannerTorch = toggleScannerTorch;
window.switchScannerCamera = switchScannerCamera;

// Window Bindings for Location Helpers
window.getCleanEnglishLocation = getCleanEnglishLocation;
window.getEnglishKhansForProvince = getEnglishKhansForProvince;

// ==============================================================================
// MOBILE PHONE GUIDE & QR ACCESS MODAL
// ==============================================================================
function openMobileGuideModal() {
    const user = getCurrentUser();
    if (!user || user.role !== "Admin") {
        if (typeof showToast === "function") {
            showToast("មុខងារ 'បើកលើទូរស័ព្ទ' អាចប្រើប្រាស់បានតែ Role Admin ប៉ុណ្ណោះ!", "warning");
        }
        return;
    }

    const modal = document.getElementById("mobileGuideModal");
    if (!modal) return;

    let targetUrl = window.location.href;
    // When opened directly via local file protocol, point to the local Wi-Fi IP
    if (window.location.protocol === "file:") {
        targetUrl = "http://192.168.1.173:8080/index.html";
    }

    const urlInput = document.getElementById("mobileGuideUrlInput");
    if (urlInput) urlInput.value = targetUrl;

    const qrImg = document.getElementById("mobileGuideQrImg");
    if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(targetUrl)}`;
    }

    modal.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
}

function closeMobileGuideModal() {
    const modal = document.getElementById("mobileGuideModal");
    if (modal) modal.classList.add("hidden");
}

function copyMobileGuideUrl() {
    const urlInput = document.getElementById("mobileGuideUrlInput");
    if (!urlInput) return;
    urlInput.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(urlInput.value).then(() => {
            if (typeof Toastify === "function") {
                Toastify({
                    text: "📋 បានចម្លង Link ជោគជ័យ!",
                    duration: 2500,
                    style: { background: "#2563eb", borderRadius: "10px" }
                }).showToast();
            }
        }).catch(() => {
            document.execCommand("copy");
        });
    } else {
        document.execCommand("copy");
    }
}

window.openMobileGuideModal = openMobileGuideModal;
window.closeMobileGuideModal = closeMobileGuideModal;
window.copyMobileGuideUrl = copyMobileGuideUrl;

