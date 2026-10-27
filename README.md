# ប្រព័ន្ធតាមដាន Supply (Supply Tracking Web App) 🚀
**Modern Supply Tracking Web Application with Real-Time Google Sheets Auto-Sync**

ប្រព័ន្ធ Web App ទំនើប ស្អាត និងទាក់ទាញ ត្រូវបានរចនាឡើងយ៉ាងពិសេសសម្រាប់គ្រប់គ្រង និងតាមដានរាល់ដំណើរការ Order តាំងពីការចុះឈ្មោះ រហូតដល់ដឹកជញ្ជូនដល់ដៃអតិថិជន ដោយភ្ជាប់ទិន្នន័យស្វ័យប្រវត្តិ (Auto-Update) ទៅកាន់ Google Sheet ឈ្មោះ **"Tracking order"** និង Sheet Name **"Tracking"**។

---

## 🌟 លក្ខណៈពិសេសចម្បង (Key Features)

### ១. ម៉ូឌុលទាំង ៤ តាមលំដាប់លំដោយ (4 Core Modules)
1. **Module 1: Register Order (ការចុះឈ្មោះ Order ថ្មី)**
   - ✅ **Field SO#**: Input field (មានប៊ូតុង Auto-Generate លេខសម្គាល់រហ័ស)
   - ✅ **Field Customer name**: Dropdown select field (មានបញ្ជីអតិថិជនស្រាប់ + ជម្រើសបន្ថែមឈ្មោះថ្មី)
   - ✅ **Field City/Province**: Dropdown select field (រាជធានី-ខេត្តទាំង ២៥ ក្នុងប្រទេសកម្ពុជា)
   - ✅ **Field Khan**: Dropdown select field (ខណ្ឌទាំង ១៤ ក្នុងរាជធានីភ្នំពេញ និងស្រុកតាមបណ្តាខេត្ត)
   - ✅ **Field Packing List#**: Input field
   - ✅ **Field Invoice#**: Input field
   - ✅ **Field Invoice Amount**: Input field ជាមួយ Currency Selector (USD `$` / KHR `៛`)
   - ✅ **Field Total Package#**: Input field ជាមួយ Select Unit (Carton, Pallet, Bag, Box, Bundle, Drum, Crate)
   - ✅ **Field BU**: Dropdown select field (Healthcare, FMCG, Industrial, Agri-Business, Technology, Logistics)
   - ✅ **Field Document type**: Dropdown select field (Tax Invoice, Commercial Invoice, Delivery Order, etc.)
   - ✅ **Field Special Notes**: Input/Textarea field សម្រាប់ចំណាំពិសេស

2. **Module 2: Physical Picking (ការរៀបចំទំនិញក្នុងឃ្លាំង)**
   - ⏱️ ប៊ូតុង **Start Picking**: កត់ត្រាថ្ងៃខែឆ្នាំ និងម៉ោងចាប់ផ្ដើមជាក់ស្ដែង (Date/Time Timestamp)
   - ⏱️ ប៊ូតុង **End Picking**: កត់ត្រាថ្ងៃខែឆ្នាំ និងម៉ោងបញ្ចប់ជាក់ស្ដែង ព្រមទាំងគណនារយៈពេលសរុប (Duration) ស្វ័យប្រវត្តិ
   - 🔄 Auto-Update ចូលទៅ Google Sheet ភ្លាមៗ

3. **Module 3: Physical Checking (ការត្រួតពិនិត្យគុណភាព & ផ្ទៀងផ្ទាត់)**
   - ⏱️ ប៊ូតុង **Start Checking**: កត់ត្រាថ្ងៃខែឆ្នាំ និងម៉ោងចាប់ផ្ដើមត្រួតពិនិត្យ
   - ⏱️ ប៊ូតុង **End Checking**: កត់ត្រាថ្ងៃខែឆ្នាំ និងម៉ោងបញ្ចប់ ព្រមទាំងគណនារយៈពេល Checking
   - 🔄 Auto-Update ចូលទៅ Google Sheet ភ្លាមៗ

4. **Module 4: Delivery Tracking (ការដឹកជញ្ជូនដល់ដៃអតិថិជន)**
   - ⏱️ ប៊ូតុង **Start Delivery**: កត់ត្រាថ្ងៃខែឆ្នាំ និងម៉ោងចេញដំណើរដឹកជញ្ជូន
   - ⏱️ ប៊ូតុង **End Delivery**: កត់ត្រាថ្ងៃខែឆ្នាំ និងម៉ោងប្រគល់ទំនិញជោគជ័យ ព្រមទាំងគណនារយៈពេលដឹកជញ្ជូន
   - 🔄 Auto-Update ចូលទៅ Google Sheet ភ្លាមៗ

---

## 📊 ការតភ្ជាប់ Google Sheet (Google Sheets Auto-Sync)
- **Spreadsheet Name**: `Tracking order`
- **Sheet / Tab Name**: `Tracking`
- **ជួរឈរទាំង ២៥ ក្នុង Google Sheet ត្រូវបានរៀបចំស្វ័យប្រវត្តិ**:
  1. Timestamp (កាលបរិច្ឆេទបង្កើត)
  2. SO# (លេខបញ្ជាទិញ)
  3. Customer Name (ឈ្មោះអតិថិជន)
  4. City/Province (រាជធានី/ខេត្ត)
  5. Khan (ខណ្ឌ/ស្រុក)
  6. Packing List#
  7. Invoice#
  8. Invoice Amount
  9. Currency
  10. Total Package#
  11. Package Unit
  12. BU (Business Unit)
  13. Document Type
  14. Special Notes
  15. Overall Status
  16. Picking Start Time
  17. Picking End Time
  18. Picking Duration
  19. Checking Start Time
  20. Checking End Time
  21. Checking Duration
  22. Delivery Start Time
  23. Delivery End Time
  24. Delivery Duration
  25. Last Updated (កាលបរិច្ឆេទកែប្រែចុងក្រោយ)

---

## 🚀 របៀបបើកដំណើរការ Web App (How to Run)

1. Web App នេះត្រូវបានបង្កើតឡើងជា **Standalone Single-Page Web Application** មិនត្រូវការដំឡើង NodeJS ឬ Python ស្មុគស្មាញឡើយ!
2. គ្រាន់តែ **Double-Click លើ File `index.html`** ដើម្បីបើកដំណើរការលើ Browser ណាមួយក៏បាន (Google Chrome, Microsoft Edge, Safari, Firefox, Tablet, iPad ឬ ទូរសព្ទដៃ)។

---

## ⚙️ ការដំឡើង Google Sheets Auto-Sync (ចំណាយពេលត្រឹមតែ ២ នាទី)

1. បើក Google Drive រួចបង្កើត **Google Sheet** ថ្មីមួយ ដាក់ឈ្មោះ File ថា: **`Tracking order`**
2. ប្ដូរឈ្មោះ Tab ខាងក្រោម (Sheet tab) ទៅជា: **`Tracking`**
3. ចុចលើ Menu **Extensions** (ផ្នែកបន្ថែម) ➡️ **Apps Script**
4. លុបកូដចាស់ៗចេញទាំងអស់ រួច **Copy & Paste កូដពី File `GoogleAppsScript_Code.gs`** ចូល
5. ចុចប៊ូតុងពណ៌ខៀវ **Deploy** (ដាក់ឱ្យប្រើ) ➡️ ជ្រើសរើស **New deployment**
6. ចុចរូបកង់ធ្មេញ (Select type) ➡️ ជ្រើសយក **Web app**
7. កំណត់ដូចខាងក្រោម:
   - **Description**: `Order Tracking API`
   - **Execute as**: `Me` (គណនី Google របស់អ្នក)
   - **Who has access**: `Anyone` *(សំខាន់ណាស់ ដើម្បីឱ្យ Web App ផ្ញើទិន្នន័យបាន)*
8. ចុច **Deploy** (បើមានសួរ Authorize សូមចុច Continue / Allow)
9. Copy យក **Web app URL** (URL ដែលបញ្ចប់ដោយ `/exec`)
10. បើក Web App ➡️ ចុចលើប៊ូតុង **"ការកំណត់ (Settings)"** (រូបកង់ធ្មេញនៅខាងលើ) ➡️ Paste URL ចូល ➡️ ចុច **"សាកល្បងតភ្ជាប់ (Test Connection)"** ➡️ ចុច **"រក្សាទុក (Save)"** ជាការស្រេច!

---

## 📁 រចនាសម្ព័ន្ធ Folder (Project Structure)
```
Order Tracking Web Apps/
├── index.html                   # ទំព័រ Web App ចម្បង (UI/UX ទំនើប ស្អាត កម្រិតខ្ពស់)
├── GoogleAppsScript_Code.gs     # កូដ Google Apps Script សម្រាប់ Auto-Update Sheet
├── README.md                    # ឯកសារណែនាំការប្រើប្រាស់
├── css/
│   └── style.css                # Style សោភ័ណភាព, Font ខ្មែរ Kantumruy Pro, Animations
└── js/
    ├── app.js                   # Logic គ្រប់គ្រង Stage ទាំង ៤ និងផ្ទាំង Dashboard
    ├── data.js                  # ទិន្នន័យខេត្ត-ខណ្ឌ, BU, Doc Type, និងអតិថិជន
    └── sheets-sync.js           # ម៉ាស៊ីន Auto-Sync, Offline Queue, Retry Mechanism
```

---

## 💡 ចំណុចពិសេសបន្ថែម (Smart Features)
- **Offline Resilience**: ប្រសិនបើសេវាអ៊ីនធឺណិតដាច់ពេលកំពុង Picking ក្នុងឃ្លាំង ទិន្នន័យនឹងត្រូវរក្សាទុកក្នុង Local Storage ដោយស្វ័យប្រវត្តិ ហើយនឹង Sync ចូល Google Sheet ភ្លាមពេលមានអ៊ីនធឺណិតឡើងវិញ។
- **Live Search & Filter**: អាចស្វែងរកបានភ្លាមៗតាមរយៈ SO#, ឈ្មោះអតិថិជន, Invoice#, Packing List#, ខណ្ឌ ឬតាម Business Unit។
- **Print Friendly**: អាចចុច Print ប័ណ្ណតាមដាន Order បានគ្រប់ពេលវេលា។
