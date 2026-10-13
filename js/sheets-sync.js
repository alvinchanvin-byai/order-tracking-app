/**
 * Google Sheets Auto-Sync Engine
 * Handles communication with Google Apps Script Web App API
 * Includes offline queueing, retry logic, and real-time status callbacks
 */

const SheetsSync = {
    STORAGE_KEY_URL: "order_tracker_gas_url",
    STORAGE_KEY_QUEUE: "order_tracker_sync_queue",
    isSyncing: false,
    onStatusChange: null, // Callback for UI indicator

    // Get configured Web App URL
    getApiUrl() {
        return localStorage.getItem(this.STORAGE_KEY_URL) || "";
    },

    // Set and save Web App URL
    setApiUrl(url) {
        const trimmed = (url || "").trim();
        localStorage.setItem(this.STORAGE_KEY_URL, trimmed);
        this.updateStatusBadge();
        return trimmed;
    },

    // Check if configured
    isConfigured() {
        const url = this.getApiUrl();
        return url.startsWith("https://script.google.com/macros/s/");
    },

    // Update UI indicator
    updateStatusBadge(status = null, customText = null) {
        if (typeof this.onStatusChange === "function") {
            this.onStatusChange(status, customText);
        }
    },

    // Test connection to Google Apps Script
    async testConnection(urlToTest = null) {
        const url = urlToTest || this.getApiUrl();
        if (!url || !url.startsWith("https://script.google.com/macros/s/")) {
            return { success: false, message: "URL មិនត្រឹមត្រូវ! សូមប្រាកដថា URL ចាប់ផ្ដើមដោយ https://script.google.com/macros/s/..." };
        }

        try {
            this.updateStatusBadge("syncing", "កំពុងសាកល្បងភ្ជាប់...");
            // Use no-cache to avoid browser cache
            const testUrl = `${url}?action=ping&_t=${Date.now()}`;
            const response = await fetch(testUrl, {
                method: "GET",
                mode: "cors"
            });
            const data = await response.json();
            if (data.status === "success") {
                this.updateStatusBadge("online", "បានភ្ជាប់ទៅ Google Sheet រួចរាល់");
                return { success: true, message: "ការតភ្ជាប់បានជោគជ័យ! Google Sheet 'Tracking order' ដំណើរការល្អ។", data };
            } else {
                throw new Error(data.message || "Unknown error from Google Apps Script");
            }
        } catch (err) {
            console.error("Test connection failed:", err);
            this.updateStatusBadge("error", "បរាជ័យក្នុងការភ្ជាប់");
            return { 
                success: false, 
                message: "មិនអាចភ្ជាប់បានទេ: " + (err.message || "សូមពិនិត្យមើលសិទ្ធិ Access (Who has access: Anyone) ក្នុង Google Apps Script!") 
            };
        }
    },

    // Fetch existing orders and setup master data from Google Sheets
    async fetchAllData() {
        if (!this.isConfigured()) return null;
        try {
            this.updateStatusBadge("syncing", "កំពុងទាញទិន្នន័យពី Sheet...");
            const url = `${this.getApiUrl()}?action=fetch&_t=${Date.now()}`;
            const response = await fetch(url, { method: "GET", mode: "cors" });
            const result = await response.json();
            if (result.status === "success") {
                this.updateStatusBadge("online", "ទិន្នន័យ Sheet ស្របគ្នា");
                return {
                    orders: Array.isArray(result.data) ? result.data : [],
                    setup: result.setup || null
                };
            }
        } catch (err) {
            console.warn("Could not fetch data from Sheet:", err);
            this.updateStatusBadge("warning", "មិនអាចទាញទិន្នន័យ (ប្រើ Offline)");
        }
        return null;
    },

    // Backward compatibility for fetchOrders
    async fetchOrders() {
        const res = await this.fetchAllData();
        return res ? res.orders : null;
    },

    // Sync a registered or updated order to Google Sheets
    async syncOrder(order, originalSoNumber = null) {
        const payload = {
            action: "REGISTER_ORDER",
            order: order,
            originalSoNumber: originalSoNumber || order.originalSoNumber || null
        };
        return this.sendPayload(payload);
    },

    // Sync a stage change (Picking Start/End, Checking Start/End, Delivery Start/End)
    async syncStageUpdate(soNumber, stage, timestamp, duration, status, specialNotes, extraData = {}) {
        const payload = {
            action: "UPDATE_STAGE",
            soNumber: soNumber,
            stage: stage,
            timestamp: timestamp,
            duration: duration || "-",
            status: status,
            ...extraData
        };
        if (specialNotes !== undefined && specialNotes !== null) {
            payload.specialNotes = specialNotes;
        }
        return this.sendPayload(payload);
    },

    // ----------------------------------------
    // SETUP MASTER DATA SYNC METHODS
    // ----------------------------------------

    // Customer CRUD Sync
    async syncCustomer(customer) {
        return this.sendPayload({
            action: "SAVE_CUSTOMER",
            customer: customer
        });
    },

    async deleteCustomer(id, name) {
        return this.sendPayload({
            action: "DELETE_CUSTOMER",
            id: id,
            name: name
        });
    },

    // BU CRUD Sync
    async syncBU(bu) {
        return this.sendPayload({
            action: "SAVE_BU",
            bu: bu
        });
    },

    async deleteBU(id, name) {
        return this.sendPayload({
            action: "DELETE_BU",
            id: id,
            name: name
        });
    },

    // Package Type CRUD Sync
    async syncPackageType(packageType) {
        return this.sendPayload({
            action: "SAVE_PACKAGE_TYPE",
            packageType: packageType
        });
    },

    async deletePackageType(id, name) {
        return this.sendPayload({
            action: "DELETE_PACKAGE_TYPE",
            id: id,
            name: name
        });
    },

    // Document Type CRUD Sync
    async syncDocumentType(docType) {
        return this.sendPayload({
            action: "SAVE_DOC_TYPE",
            docType: docType
        });
    },

    async deleteDocumentType(id, name) {
        return this.sendPayload({
            action: "DELETE_DOC_TYPE",
            id: id,
            name: name
        });
    },

    // User Management CRUD Sync
    async syncUser(user) {
        return this.sendPayload({
            action: "SAVE_USER",
            user: user
        });
    },

    async deleteUser(id, username) {
        return this.sendPayload({
            action: "DELETE_USER",
            id: id,
            username: username
        });
    },

    // Sync all setup data at once
    async syncAllSetup(setupData) {
        return this.sendPayload({
            action: "SYNC_ALL_SETUP",
            setup: setupData
        });
    },

    // Low-level send with fallback to offline queue
    async sendPayload(payload) {
        if (!this.isConfigured()) {
            console.info("Google Sheet API URL not configured yet. Saved locally.");
            this.updateStatusBadge("offline", "ដំណើរការក្នុងកុំព្យូទ័រ (មិនទាន់ភ្ជាប់ Sheet)");
            return { success: false, reason: "NOT_CONFIGURED" };
        }

        try {
            this.updateStatusBadge("syncing", "កំពុងបញ្ជូនទៅ Google Sheet...");
            
            // Sending POST via fetch text/plain to avoid strict CORS preflight issues with Google Apps Script
            const response = await fetch(this.getApiUrl(), {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (result.status === "success") {
                this.updateStatusBadge("online", "បាន Auto-Update ទៅ Sheet ✅");
                // Attempt to process any pending offline queue items
                this.flushQueue();
                return { success: true, result };
            } else {
                throw new Error(result.message || "Failed to update sheet");
            }
        } catch (err) {
            console.error("Auto update failed, queueing for retry:", err);
            this.queuePayload(payload);
            this.updateStatusBadge("warning", "បានរក្សាទុកក្នុងម៉ាស៊ីន (រង់ចាំ Sync)");
            return { success: false, queued: true, error: err.message };
        }
    },

    // Queue failed requests to localStorage
    queuePayload(payload) {
        try {
            const queue = JSON.parse(localStorage.getItem(this.STORAGE_KEY_QUEUE) || "[]");
            queue.push({
                payload,
                queuedAt: new Date().toISOString()
            });
            localStorage.setItem(this.STORAGE_KEY_QUEUE, JSON.stringify(queue));
        } catch (e) {
            console.error("Error saving to sync queue:", e);
        }
    },

    // Process queued items when back online
    async flushQueue() {
        if (this.isSyncing) return;
        const queueStr = localStorage.getItem(this.STORAGE_KEY_QUEUE);
        if (!queueStr) return;
        
        const queue = JSON.parse(queueStr);
        if (!queue.length) return;

        this.isSyncing = true;
        console.log(`Flushing ${queue.length} queued sync items to Google Sheet...`);

        try {
            while (queue.length > 0) {
                const item = queue[0];
                const res = await fetch(this.getApiUrl(), {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify(item.payload)
                });
                const resJson = await res.json();
                if (resJson.status === "success") {
                    queue.shift();
                    localStorage.setItem(this.STORAGE_KEY_QUEUE, JSON.stringify(queue));
                } else {
                    break;
                }
            }
            if (queue.length === 0) {
                this.updateStatusBadge("online", "ទិន្នន័យទាំងអស់បាន Sync រួចរាល់");
            }
        } catch (e) {
            console.warn("Queue flush interrupted:", e);
        } finally {
            this.isSyncing = false;
        }
    }
};

// Auto listen for browser online event
window.addEventListener("online", () => {
    SheetsSync.flushQueue();
});
