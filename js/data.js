/**
 * Data Constants & Initial Demo Data for Order Tracking Web App
 */

const CAMBODIA_PROVINCES = [
    { id: "Phnom Penh", nameKh: "រាជធានីភ្នំពេញ", nameEn: "Phnom Penh" },
    { id: "Kandal", nameKh: "ខេត្តកណ្តាល", nameEn: "Kandal" },
    { id: "Siem Reap", nameKh: "ខេត្តសៀមរាប", nameEn: "Siem Reap" },
    { id: "Battambang", nameKh: "ខេត្តបាត់ដំបង", nameEn: "Battambang" },
    { id: "Preah Sihanouk", nameKh: "ខេត្តព្រះសីហនុ", nameEn: "Preah Sihanouk" },
    { id: "Kampong Cham", nameKh: "ខេត្តកំពង់ចាម", nameEn: "Kampong Cham" },
    { id: "Kampong Chhnang", nameKh: "ខេត្តកំពង់ឆ្នាំង", nameEn: "Kampong Chhnang" },
    { id: "Kampong Speu", nameKh: "ខេត្តកំពង់ស្ពឺ", nameEn: "Kampong Speu" },
    { id: "Kampong Thom", nameKh: "ខេត្តកំពង់ធំ", nameEn: "Kampong Thom" },
    { id: "Kampot", nameKh: "ខេត្តកំពត", nameEn: "Kampot" },
    { id: "Kep", nameKh: "ខេត្តកែប", nameEn: "Kep" },
    { id: "Koh Kong", nameKh: "ខេត្តកោះកុង", nameEn: "Koh Kong" },
    { id: "Kratie", nameKh: "ខេត្តក្រចេះ", nameEn: "Kratie" },
    { id: "Mondulkiri", nameKh: "ខេត្តមណ្ឌលគិរី", nameEn: "Mondulkiri" },
    { id: "Oddar Meanchey", nameKh: "ខេត្តឧត្តរមានជ័យ", nameEn: "Oddar Meanchey" },
    { id: "Pailin", nameKh: "ខេត្តប៉ៃលិន", nameEn: "Pailin" },
    { id: "Preah Vihear", nameKh: "ខេត្តព្រះវិហារ", nameEn: "Preah Vihear" },
    { id: "Prey Veng", nameKh: "ខេត្តព្រៃវែង", nameEn: "Prey Veng" },
    { id: "Pursat", nameKh: "ខេត្តពោធិ៍សាត់", nameEn: "Pursat" },
    { id: "Ratanakiri", nameKh: "ខេត្តរតនគិរី", nameEn: "Ratanakiri" },
    { id: "Stung Treng", nameKh: "ខេត្តស្ទឹងត្រែង", nameEn: "Stung Treng" },
    { id: "Svay Rieng", nameKh: "ខេត្តស្វាយរៀង", nameEn: "Svay Rieng" },
    { id: "Takeo", nameKh: "ខេត្តតាកែវ", nameEn: "Takeo" },
    { id: "Tboung Khmum", nameKh: "ខេត្តត្បូងឃ្មុំ", nameEn: "Tboung Khmum" },
    { id: "Banteay Meanchey", nameKh: "ខេត្តបន្ទាយមានជ័យ", nameEn: "Banteay Meanchey" }
];

const KHAN_DISTRICTS_MAP = {
    "Phnom Penh": [
        "Chamkarmon",
        "Daun Penh",
        "Prampir Meakkakra",
        "Tuol Kouk",
        "Dangkao",
        "Mean Chey",
        "Russey Keo",
        "Sen Sok",
        "Pou Senchey",
        "Chroy Changvar",
        "Prek Pnov",
        "Chbar Ampov",
        "Boeng Keng Kang",
        "Kamboul"
    ],
    "Kampong Chhnang": [
        "Kampong Chhnang City",
        "Rolea B'ier",
        "Baribour",
        "Kampong Tralach",
        "Kampong Leaeng",
        "Sameakki Mean Chey",
        "Chol Kiri",
        "Tuek Phos"
    ],
    "Kandal": [
        "Ta Khmau",
        "Arey Ksat City",
        "Sampov Poun City",
        "Kandal Stueng",
        "Kien Svay",
        "Khsach Kandal",
        "Koh Thom",
        "Mukh Kampul",
        "Angk Snuol",
        "Ponhea Lueu",
        "S'ang"
    ],
    "Siem Reap": [
        "Siem Reap City",
        "Run Ta Ek Techo Sen City",
        "Banteay Srei",
        "Prasat Bakong",
        "Puok",
        "Soutr Nikom",
        "Chi Kraeng",
        "Angkor Thom",
        "Kralanh",
        "Varin",
        "Svay Leu",
        "Angkor Chum"
    ],
    "Battambang": [
        "Battambang City",
        "Thma Koul",
        "Banan",
        "Moung Ruessei",
        "Rotanak Mondol",
        "Sangkae",
        "Samlout",
        "Aek Phnum",
        "Kamrieng",
        "Phnum Proek",
        "Sampov Loun",
        "Bavel",
        "Koas Krala",
        "Rukh Kiri"
    ],
    "Preah Sihanouk": [
        "Sihanoukville",
        "Koh Rong City",
        "Prey Nob",
        "Stung Hav",
        "Kampong Seila"
    ],
    "Kampong Cham": [
        "Kampong Cham City",
        "Batheay",
        "Chamkar Leu",
        "Cheung Prey",
        "Kampong Siem",
        "Kang Meas",
        "Koh Sotin",
        "Prey Chhor",
        "Srei Santhor",
        "Stueng Trang"
    ],
    "Kampong Speu": [
        "Chbar Mon City",
        "Udong Meanchey City",
        "Samraong Tong",
        "Kong Pisei",
        "Basedth",
        "Phnum Sruoch",
        "Thpong",
        "Aoral",
        "Sameakki Muni Chey"
    ],
    "Kampong Thom": [
        "Stueng Saen City",
        "Baray",
        "Taing Kouk",
        "Kampong Svay",
        "Stoung",
        "Prasat Balangk",
        "Prasat Sambour",
        "Sandan",
        "Santuk"
    ],
    "Kampot": [
        "Kampot City",
        "Bokor City",
        "Tuek Chhou",
        "Angkor Chey",
        "Banteay Meas",
        "Chhuk",
        "Chum Kiri",
        "Dang Tong",
        "Kampong Trach"
    ],
    "Kep": [
        "Kep City",
        "Damnak Chang'aeur"
    ],
    "Koh Kong": [
        "Khemarak Phoumin City",
        "Botum Sakor",
        "Kiri Sakor",
        "Koh Kong",
        "Mondol Seima",
        "Sre Ambel",
        "Thma Bang"
    ],
    "Kratie": [
        "Kratie City",
        "Chhloung",
        "Prek Prasab",
        "Sambour",
        "Snuol",
        "Chetr Borei"
    ],
    "Mondulkiri": [
        "Sen Monorom City",
        "Keo Seima",
        "Koh Nhek",
        "Ou Reang",
        "Pechr Chenda"
    ],
    "Oddar Meanchey": [
        "Samraong City",
        "Anlong Veng",
        "Banteay Ampil",
        "Chong Kal",
        "Trapeang Prasat"
    ],
    "Pailin": [
        "Pailin City",
        "Sala Krau"
    ],
    "Preah Vihear": [
        "Preah Vihear City",
        "Chey Saen",
        "Chhaeb",
        "Choam Khsant",
        "Kuleaen",
        "Rovieng",
        "Sangkum Thmei",
        "Tbaeng Mean Chey"
    ],
    "Prey Veng": [
        "Prey Veng City",
        "Ba Phnum",
        "Kamchay Mear",
        "Kampong Trabaek",
        "Kanhchriech",
        "Me Sang",
        "Peam Chor",
        "Peam Ro",
        "Pea Reang",
        "Preah Sdach",
        "Pou Rieng",
        "Sithor Kandal",
        "Svay Antor"
    ],
    "Pursat": [
        "Pursat City",
        "Bakan",
        "Kandieng",
        "Krakor",
        "Phnum Kravanh",
        "Veal Veaeng",
        "Talo Senchey"
    ],
    "Ratanakiri": [
        "Banlung City",
        "Andoung Meas",
        "Bar Kaev",
        "Koun Mom",
        "Lumphat",
        "Ou Chum",
        "Ou Ya Dav",
        "Ta Veaeng",
        "Veun Sai"
    ],
    "Stung Treng": [
        "Stung Treng City",
        "Sesan",
        "Siem Bouk",
        "Siem Pang",
        "Thala Barivat",
        "Borei O'Svay Sen Chey"
    ],
    "Svay Rieng": [
        "Svay Rieng City",
        "Bavet City",
        "Chantrea",
        "Kampong Rou",
        "Svay Chrum",
        "Romdoul",
        "Romeas Haek",
        "Svay Teab"
    ],
    "Takeo": [
        "Doun Kaev City",
        "Angkor Borei",
        "Bati",
        "Borei Cholsar",
        "Kiri Vong",
        "Koh Andaet",
        "Prey Kabbas",
        "Samraong",
        "Tram Kak",
        "Treang"
    ],
    "Tboung Khmum": [
        "Suong City",
        "Dambae",
        "Krouch Chhmar",
        "Memot",
        "Ou Reang Ov",
        "Ponhea Kraek",
        "Tboung Khmum"
    ],
    "Banteay Meanchey": [
        "Serei Saophoan City",
        "Poipet City",
        "Mongkol Borei",
        "Phnum Srok",
        "Preah Netr Preah",
        "Ou Chrov",
        "Thma Puok",
        "Svay Chek",
        "Malai"
    ]
};

// Default Customer Information with City/Province and Khan
const DEFAULT_SETUP_CUSTOMERS = [
    { id: "CUST-001", name: "Calmette Hospital (មន្ទីរពេទ្យកាល់ម៉ែត)", cityProvince: "Phnom Penh", khan: "Daun Penh" },
    { id: "CUST-002", name: "DKSH Cambodia Ltd", cityProvince: "Phnom Penh", khan: "Pou Senchey" },
    { id: "CUST-003", name: "Chip Mong Retail / Supermarket", cityProvince: "Phnom Penh", khan: "Sen Sok" },
    { id: "CUST-004", name: "Phsar Leu Distribution Center", cityProvince: "Siem Reap", khan: "Siem Reap City" },
    { id: "CUST-005", name: "Aeon Mall Logistics Center", cityProvince: "Phnom Penh", khan: "Chamkarmon" },
    { id: "CUST-006", name: "Royal Phnom Penh Hospital", cityProvince: "Phnom Penh", khan: "Tuol Kouk" },
    { id: "CUST-007", name: "Sunrise Japan Hospital", cityProvince: "Phnom Penh", khan: "Chroy Changvar" },
    { id: "CUST-008", name: "Lucky Supermarket Group", cityProvince: "Phnom Penh", khan: "Boeng Keng Kang" },
    { id: "CUST-009", name: "U-Care Pharmacy Central Depot", cityProvince: "Phnom Penh", khan: "Daun Penh" },
    { id: "CUST-010", name: "Pharmacare Cambodia Co., Ltd", cityProvince: "Phnom Penh", khan: "Prampir Meakkakra" },
    { id: "CUST-011", name: "TotalEnergies Marketing Cambodia", cityProvince: "Phnom Penh", khan: "Mean Chey" },
    { id: "CUST-012", name: "Angkor Dairy Products Co., Ltd", cityProvince: "Preah Sihanouk", khan: "Prey Nob" }
];

// Default Business Units
const DEFAULT_SETUP_BU = [
    { id: "BU-001", name: "Healthcare & Pharma (សុខាភិបាល)" },
    { id: "BU-002", name: "Consumer Goods / FMCG (ទំនិញប្រើប្រាស់)" },
    { id: "BU-003", name: "Industrial & Chemicals (ឧស្សាហកម្ម)" },
    { id: "BU-004", name: "Agri-Business & Food (កសិកម្ម & អាហារ)" },
    { id: "BU-005", name: "Technology & Equipment (បច្ចេកវិទ្យា)" },
    { id: "BU-006", name: "General Logistics & Supply Chain" }
];

// Default Package Types
const DEFAULT_SETUP_PACKAGE_TYPES = [
    { id: "PKG-001", name: "Carton (កេស)", short: "Ctns" },
    { id: "PKG-002", name: "Pallet (ប៉ាឡែត)", short: "Plts" },
    { id: "PKG-003", name: "Bag (បាវ/ថង់)", short: "Bags" },
    { id: "PKG-004", name: "Box (ប្រអប់)", short: "Boxes" },
    { id: "PKG-005", name: "Bundle (បាច់/ដុំ)", short: "Bdls" },
    { id: "PKG-006", name: "Drum (ធុង/Barrel)", short: "Drums" },
    { id: "PKG-007", name: "Crate (កន្ត្រក/ទ្រុង)", short: "Crts" }
];

// Default Document Types
const DEFAULT_SETUP_DOC_TYPES = [
    { id: "DOC-001", name: "SO to customer" },
    { id: "DOC-002", name: "Stock Transfer" },
    { id: "DOC-003", name: "Sample" },
    { id: "DOC-004", name: "Consignment" },
    { id: "DOC-005", name: "Tax Invoice (វិក្កយបត្រពន្ធ)" },
    { id: "DOC-006", name: "Commercial Invoice (វិក្កយបត្រពាណិជ្ជកម្ម)" },
    { id: "DOC-007", name: "Delivery Order / DO (ប័ណ្ណប្រគល់ទំនិញ)" },
    { id: "DOC-008", name: "Packing List (បញ្ជីរាយទំនិញ)" },
    { id: "DOC-009", name: "Inter-Warehouse Transfer (ប័ណ្ណផ្ទេរឃ្លាំង)" },
    { id: "DOC-010", name: "Cash Sale Slip (វិក្កយបត្រលក់សាច់ប្រាក់)" }
];

// Available App Modules & Permission Identifiers
const APP_MODULES = [
    { id: "daily-delivery", name: "១. Daily Delivery (ការដឹកជញ្ជូនប្រចាំថ្ងៃ)", icon: "calendar-check" },
    { id: "register", name: "២. Register Order (ចុះឈ្មោះ)", icon: "file-plus-2" },
    { id: "picking", name: "៣. Physical Picking (រៀបចំ)", icon: "package" },
    { id: "checking", name: "៤. Physical Checking (ត្រួតពិនិត្យ)", icon: "clipboard-check" },
    { id: "delivery", name: "៥. Delivery (ដឹកជញ្ជូន)", icon: "truck" },
    { id: "incompleted-delivery", name: "៦. In Completed Delivery (មិនទាន់ចប់)", icon: "alert-triangle" },
    { id: "dashboard", name: "៧. ផ្ទាំងគ្រប់គ្រង (Dashboard)", icon: "layout-dashboard" },
    { id: "report", name: "៨. Report (របាយការណ៍)", icon: "bar-chart-3" },
    { id: "setup", name: "៩. Setup (ទិន្នន័យមេ)", icon: "sliders" }
];

// Default Setup Users with Roles & Module Access Rights
const DEFAULT_SETUP_USERS = [
    {
        id: "USR-001",
        username: "admin",
        password: "123",
        displayName: "System Administrator",
        role: "Admin",
        permissions: ["daily-delivery", "register", "picking", "checking", "delivery", "incompleted-delivery", "dashboard", "report", "setup"],
        lastUpdated: "08/10/26 15:00"
    },
    {
        id: "USR-002",
        username: "whm",
        password: "123",
        displayName: "Sophal Chan",
        role: "Admin",
        permissions: ["daily-delivery", "register", "picking", "checking", "delivery", "incompleted-delivery", "dashboard", "report", "setup"],
        lastUpdated: "08/10/26 15:39"
    },
    {
        id: "USR-003",
        username: "thv",
        password: "123",
        displayName: "Lor Bunthavry",
        role: "User",
        permissions: ["dashboard", "register", "picking", "checking", "delivery"],
        lastUpdated: "08/10/26 15:41"
    },
    {
        id: "USR-004",
        username: "heang",
        password: "123",
        displayName: "Kimheang",
        role: "User",
        permissions: ["register", "picking", "checking"],
        lastUpdated: "08/10/26 15:41"
    },
    {
        id: "USR-005",
        username: "tra",
        password: "123",
        displayName: "Hem Sopheaktra",
        role: "User",
        permissions: ["register", "picking", "checking"],
        lastUpdated: "08/10/26 15:41"
    },
    {
        id: "USR-006",
        username: "thin",
        password: "123",
        displayName: "Ngo Thin",
        role: "User",
        permissions: ["register", "picking", "checking"],
        lastUpdated: "08/10/26 15:41"
    },
    {
        id: "USR-007",
        username: "vanna",
        password: "123",
        displayName: "Sok Chanvanna",
        role: "User",
        permissions: ["dashboard", "delivery", "incompleted-delivery", "daily-delivery"],
        lastUpdated: "13/10/26 13:00"
    }
];

// Fallback arrays for backward compatibility
const DEFAULT_CUSTOMERS = DEFAULT_SETUP_CUSTOMERS.map(c => c.name);
const BUSINESS_UNITS = DEFAULT_SETUP_BU.map((b, idx) => ({ id: b.id, name: b.name }));
const DOCUMENT_TYPES = DEFAULT_SETUP_DOC_TYPES.map(d => d.name);
const PACKAGE_UNITS = DEFAULT_SETUP_PACKAGE_TYPES.map(p => ({ id: p.name.split(" ")[0], nameKh: p.name, short: p.short }));

// Helper to format date-time strictly in dd/mm/yy hh:mm (e.g. 04/10/26 22:53)
function formatAppDateTime(date = new Date()) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const yy = String(d.getFullYear()).slice(-2);
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${day}/${month}/${yy} ${hours}:${minutes}`;
}

// Convert any input date string (including Google Sheets raw format) to dd/mm/yy hh:mm
function formatDateTimeDisplay(dateVal) {
    if (!dateVal || dateVal === "-" || String(dateVal).trim() === "") return "-";
    if (dateVal instanceof Date) {
        return formatAppDateTime(dateVal);
    }
    
    const str = String(dateVal).trim();
    const pad = (n) => String(n).padStart(2, '0');
    
    // Check if already in dd/mm/yy hh:mm format (e.g. 04/10/26 22:53)
    const ddmmyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{1,2})$/;
    const m2 = str.match(ddmmyyRegex);
    if (m2) {
        let p1 = parseInt(m2[1], 10);
        let p2 = parseInt(m2[2], 10);
        let yy = m2[3];
        let hh = pad(m2[4]);
        let mm = pad(m2[5]);

        // Correction for swapped dates (MM/DD/YY vs DD/MM/YY):
        // In Cambodia, today is October 5, 2026 (05/10/26).
        // If p1 is 10 and p2 is 5 (or 4) in 2026, it was parsed by US-locale as MM/DD/YY (10/05/26) instead of DD/MM/YY (05/10/26).
        // Also if p2 > 12, p2 must be the day, so swap!
        if (p2 > 12 && p1 <= 12) {
            const tmp = p1; p1 = p2; p2 = tmp;
        } else if (p1 === 10 && (p2 === 4 || p2 === 5) && yy === "26") {
            const tmp = p1; p1 = p2; p2 = tmp;
        }

        return `${pad(p1)}/${pad(p2)}/${yy} ${hh}:${mm}`;
    }
    
    // Check if in dd/mm/yyyy hh:mm(:ss) format (e.g. 04/10/2026 22:53)
    const ddmmyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/;
    const m4 = str.match(ddmmyyyyRegex);
    if (m4) {
        let p1 = parseInt(m4[1], 10);
        let p2 = parseInt(m4[2], 10);
        let yy = m4[3].slice(-2);
        let hh = m4[4] ? pad(m4[4]) : "00";
        let mm = m4[5] ? pad(m4[5]) : "00";

        if (p2 > 12 && p1 <= 12) {
            const tmp = p1; p1 = p2; p2 = tmp;
        } else if (p1 === 10 && (p2 === 4 || p2 === 5) && yy === "26") {
            const tmp = p1; p1 = p2; p2 = tmp;
        }

        return `${pad(p1)}/${pad(p2)}/${yy} ${hh}:${mm}`;
    }

    // Check if in ISO or YYYY-MM-DD format (e.g. 2026-10-05 09:35 or 2026-10-05T09:35:00)
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2}))?/);
    if (isoMatch) {
        const yy = isoMatch[1].slice(-2);
        const mm = pad(isoMatch[2]);
        const dd = pad(isoMatch[3]);
        const hh = isoMatch[4] ? pad(isoMatch[4]) : "00";
        const min = isoMatch[5] ? pad(isoMatch[5]) : "00";
        return `${dd}/${mm}/${yy} ${hh}:${min}`;
    }

    // Try parsing standard Date (handles "Sun Oct 04 2026 22:53:08 GMT+0700...", etc.)
    const cleanStr = str.includes("-") ? str.replace(" ", "T") : str;
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
        return formatAppDateTime(d);
    }
    
    return str;
}

// Parse dd/mm/yy hh:mm or any date string to Date object
function parseAppDateTime(dateStr) {
    if (!dateStr || dateStr === "-") return null;
    const s = String(dateStr).trim();
    
    // Match dd/mm/yy hh:mm or dd/mm/yyyy hh:mm(:ss)
    const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        let year = parseInt(match[3], 10);
        if (year < 100) year += 2000;
        const hours = match[4] ? parseInt(match[4], 10) : 0;
        const mins = match[5] ? parseInt(match[5], 10) : 0;
        const secs = match[6] ? parseInt(match[6], 10) : 0;
        return new Date(year, month, day, hours, mins, secs);
    }
    
    const fallback = new Date(s.includes("-") ? s.replace(" ", "T") : s);
    return isNaN(fallback.getTime()) ? null : fallback;
}

// Calculate elapsed duration strictly in hh:mm format (e.g., "00:10", "00:01", "02:14")
function calculateDuration(startStr, endStr) {
    if (!startStr || !endStr || startStr === "-" || endStr === "-") return "-";
    const startDate = parseAppDateTime(startStr);
    const endDate = parseAppDateTime(endStr);
    if (!startDate || !endDate) return "-";
    
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 0) return "-";
    
    let totalMinutes = Math.floor(diffMs / (1000 * 60));
    // If completed in less than 1 min but >= 3 seconds, record as at least 00:01
    if (totalMinutes === 0 && diffMs >= 3000) {
        totalMinutes = 1;
    }
    
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Convert any duration representation (Khmer, numeric minutes, hh:mm:ss, etc.) into strict hh:mm format
function formatDurationHhMm(val, startStr, endStr) {
    if (startStr && endStr && String(startStr).trim() !== "" && String(endStr).trim() !== "" && startStr !== "-" && endStr !== "-") {
        const calculated = calculateDuration(startStr, endStr);
        if (calculated && calculated !== "-") return calculated;
    }
    if (!val || val === "-" || String(val).trim() === "") return "-";
    const str = String(val).trim();
    
    // Check if already in hh:mm format (e.g. 00:10, 02:14)
    const m = str.match(/^(\d{1,3}):(\d{2})(?::\d{2})?$/);
    if (m) {
        const h = String(parseInt(m[1], 10)).padStart(2, '0');
        const min = String(parseInt(m[2], 10)).padStart(2, '0');
        return `${h}:${min}`;
    }
    
    // Parse Khmer or verbal duration strings like "27នាទី", "1ម៉ោង 12នាទី", "45 វិនាទី"
    let hours = 0;
    let mins = 0;
    const hourMatch = str.match(/(\d+)\s*(?:ម៉ោង|h|hr|hours?)/i);
    const minMatch = str.match(/(\d+)\s*(?:នាទី|m|min|mins?)/i);
    const secMatch = str.match(/(\d+)\s*(?:វិនាទី|s|sec|secs?)/i);

    if (hourMatch) hours = parseInt(hourMatch[1], 10);
    if (minMatch) mins = parseInt(minMatch[1], 10);
    if (!hourMatch && !minMatch && secMatch) {
        const secs = parseInt(secMatch[1], 10);
        mins = secs > 0 ? 1 : 0;
    }

    if (hourMatch || minMatch || secMatch) {
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }

    // Pure number of minutes
    if (/^\d+$/.test(str)) {
        const total = parseInt(str, 10);
        const h = Math.floor(total / 60);
        const min = total % 60;
        return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }

    return str;
}

window.calculateDuration = calculateDuration;
window.calculateDurationHhMm = calculateDuration;
window.formatDurationHhMm = formatDurationHhMm;


