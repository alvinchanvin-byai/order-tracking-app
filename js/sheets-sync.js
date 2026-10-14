/**
 * Google Sheets Auto-Sync & Real-Time Engine (Live Sync)
 * Handles communication with Google Apps Script Web App API
 * Includes:
 * 1. Ultra-fast Live Change-Detection Polling (30-50ms check via Script Properties)
 * 2. Instant Cross-Tab Synchronization via BroadcastChannel (<5ms)
 * 3. Offline Queueing & Automatic Flush on Reconnection
 * 4. Adaptive Polling (Active vs Hidden tabs) and Focus/Wakeup Listeners
 */

const SheetsSync = {
    STORAGE_KEY_URL: "order_tracker_gas_url",
    STORAGE_KEY_QUEUE: "order_tracker_sync_queue",
    STORAGE_KEY_SERVER_TS: "order_tracker_server_ts",
    
    clientId: "client_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
    lastServerTimestamp: localStorage.getItem("order_tracker_server_ts") || "0",
    
    isSyncing: false,
    isCheckingUpdates: false,
    pollTimer: null,
    pollIntervalMs: 3500,     // 3.5 seconds when active
    bgPollIntervalMs: 12000,  // 12 seconds when page is in background to save battery
    
    broadcastChannel: null,
    onlineUsers: [],            // List of active online users { username, displayName, role, device, tab, lastSeen }
    onStatusChange: null,       // Callback for UI indicator (Online / Syncing / Warning)
    onDataUpdated: null,        // Callback when live polling detects server changes
    onPresenceChange: null,     // Callback when online users presence list updates
    onBroadcastReceived: null,  // Callback for cross-tab local updates
    onLiveSyncPulse: null,      // Callback to flash the LIVE UI badge

    // Get parameters for user presence heartbeat (All Users regardless of role)
    getUserHeartbeatParams() {
        try {
            if (typeof AppState !== "undefined" && AppState.isLoggedOut) {
                return "";
            }
            const rawUser = localStorage.getItem("order_tracker_active_user_v1");
            const user = rawUser ? JSON.parse(rawUser) : null;
            if (!user || !user.username) return "";
            
            const isMobile = (typeof window !== "undefined") && (
                window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
            );
            const activeTab = (typeof AppState !== "undefined" && AppState.currentTab) ? AppState.currentTab : "dashboard";
            
            return `&user=${encodeURIComponent(user.username)}` +
                   `&name=${encodeURIComponent(user.displayName || user.username)}` +
                   `&role=${encodeURIComponent(user.role || 'User')}` +
                   `&device=${encodeURIComponent(isMobile ? 'Mobile' : 'PC')}` +
                   `&tab=${encodeURIComponent(activeTab)}`;
        } catch(e) {
            return "";
        }
    },

    // Process and dispatch online users presence list (All Users)
    handleOnlineUsers(userList, broadcast = true) {
        if (!Array.isArray(userList)) return;
        this.onlineUsers = userList;
        if (typeof this.onPresenceChange === "function") {
            this.onPresenceChange(this.onlineUsers);
        }
        if (broadcast) {
            this.broadcast("PRESENCE_SYNC", { onlineUsers: this.onlineUsers });
        }
    },

    // Explicitly notify server when user logs out
    async logoutPresence(username) {
        if (!username) return;
        const normUser = String(username).trim().toLowerCase();

        // 1. Immediately remove from local memory
        this.onlineUsers = (this.onlineUsers || []).filter(u => 
            !u.username || u.username.toLowerCase() !== normUser
        );

        // 2. Immediately notify local UI callback
        if (typeof this.onPresenceChange === "function") {
            this.onPresenceChange(this.onlineUsers);
        }

        // 3. Broadcast to all open tabs on this browser
        this.broadcast("USER_LOGOUT", { username: normUser });
        this.broadcast("PRESENCE_SYNC", { onlineUsers: this.onlineUsers });

        // 4. Send network request to Google Apps Script
        if (!this.isConfigured()) return;
        const url = `${this.getApiUrl()}?action=logout_presence&user=${encodeURIComponent(normUser)}&_t=${Date.now()}`;
        try {
            await fetch(url, { 
                method: "GET", 
                mode: "cors", 
                cache: "no-store",
                keepalive: true 
            });
        } catch(e) {
            if (typeof navigator !== "undefined" && navigator.sendBeacon) {
                try {
                    navigator.sendBeacon(url);
                } catch(err) {}
            }
        }
    },

    // Get configured Web App URL
    getApiUrl() {
        return localStorage.getItem(this.STORAGE_KEY_URL) || "";
    },

    // Set and save Web App URL
    setApiUrl(url) {
        const trimmed = (url || "").trim();
        localStorage.setItem(this.STORAGE_KEY_URL, trimmed);
        this.updateStatusBadge();
        if (this.isConfigured()) {
            this.startLivePolling();
        } else {
            this.stopLivePolling();
        }
        return trimmed;
    },

    // Check if configured
    isConfigured() {
        const url = this.getApiUrl();
        return url.startsWith("https://script.google.com/macros/s/");
    },

    // Track server timestamp for change detection
    setServerTimestamp(ts) {
        if (ts && String(ts) !== "0") {
            this.lastServerTimestamp = String(ts);
            try {
                localStorage.setItem(this.STORAGE_KEY_SERVER_TS, String(ts));
            } catch (e) {}
        }
    },

    // Update UI indicator
    updateStatusBadge(status = null, customText = null) {
        if (typeof this.onStatusChange === "function") {
            this.onStatusChange(status, customText);
        }
    },

    // Initialize cross-tab broadcasting
    initBroadcast() {
        if (this.broadcastChannel) return;
        if (typeof window !== "undefined" && "BroadcastChannel" in window) {
            try {
                this.broadcastChannel = new BroadcastChannel("order_tracker_live_channel");
                this.broadcastChannel.onmessage = (event) => {
                    this.handleBroadcastMessage(event.data);
                };
            } catch (e) {
                console.warn("BroadcastChannel initialization warning:", e);
            }
        }

        // Fallback cross-tab sync via storage event
        window.addEventListener("storage", (e) => {
            if (e.key === "order_tracker_broadcast_event" && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    this.handleBroadcastMessage(parsed);
                } catch(err) {}
            }
        });
    },

    // Broadcast change to other open tabs on the same device
    broadcast(type, payload = {}) {
        const msg = {
            type: type,
            payload: payload,
            senderId: this.clientId,
            timestamp: Date.now()
        };
        if (this.broadcastChannel) {
            try {
                this.broadcastChannel.postMessage(msg);
            } catch(e) {}
        }
        try {
            localStorage.setItem("order_tracker_broadcast_event", JSON.stringify(msg));
        } catch(e) {}
    },

    handleBroadcastMessage(msg) {
        if (!msg || msg.senderId === this.clientId) return;
        if (msg.type === "USER_LOGOUT" && msg.payload && msg.payload.username) {
            const outUser = String(msg.payload.username).toLowerCase();
            this.onlineUsers = (this.onlineUsers || []).filter(u => 
                !u.username || u.username.toLowerCase() !== outUser
            );
            if (typeof this.onPresenceChange === "function") {
                this.onPresenceChange(this.onlineUsers);
            }
        }
        if (msg.type === "PRESENCE_SYNC" && msg.payload && msg.payload.onlineUsers) {
            this.handleOnlineUsers(msg.payload.onlineUsers, false);
        }
        if (typeof this.onBroadcastReceived === "function") {
            this.onBroadcastReceived(msg);
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

    // Fetch existing orders and setup master data from Google Sheets with AbortController timeout
    async fetchAllData(timeoutMs = 15000, isSilent = false) {
        if (!this.isConfigured()) return null;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            if (!isSilent) {
                this.updateStatusBadge("syncing", "កំពុងទាញទិន្នន័យពី Sheet...");
            }
            const url = `${this.getApiUrl()}?action=fetch&_t=${Date.now()}${this.getUserHeartbeatParams()}`;
            const response = await fetch(url, { 
                method: "GET", 
                mode: "cors",
                cache: "no-store",
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const result = await response.json();
            if (result.status === "success") {
                if (result.onlineUsers) {
                    this.handleOnlineUsers(result.onlineUsers);
                }
                if (result.serverTimestamp) {
                    this.setServerTimestamp(result.serverTimestamp);
                }
                if (!isSilent) {
                    this.updateStatusBadge("online", "ទិន្នន័យ Sheet ស្របគ្នា");
                }
                return {
                    orders: Array.isArray(result.data) ? result.data : [],
                    setup: result.setup || null,
                    serverTimestamp: result.serverTimestamp || null,
                    onlineUsers: result.onlineUsers || []
                };
            }
        } catch (err) {
            clearTimeout(timeoutId);
            if (!isSilent) {
                console.warn("Could not fetch data from Sheet:", err);
                this.updateStatusBadge("warning", "មិនអាចទាញទិន្នន័យ (ប្រើ Offline)");
            }
        }
        return null;
    },

    // Backward compatibility for fetchOrders
    async fetchOrders() {
        const res = await this.fetchAllData();
        return res ? res.orders : null;
    },

    // Ultra-Fast Live Change-Detection Check (30-50ms check via ScriptProperties)
    async checkUpdates(force = false) {
        if (!this.isConfigured()) return null;
        if (this.isCheckingUpdates && !force) return null;
        if (this.isSyncing) return null; // Don't interrupt while sending a POST

        this.isCheckingUpdates = true;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

        try {
            // Include cache-busters for iOS Safari / Mobile WebKit and User Heartbeat
            const url = `${this.getApiUrl()}?action=check_update&since=${encodeURIComponent(this.lastServerTimestamp)}&_t=${Date.now()}&_r=${Math.floor(Math.random() * 100000)}${this.getUserHeartbeatParams()}`;
            const response = await fetch(url, {
                method: "GET",
                mode: "cors",
                cache: "no-store",
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const result = await response.json();

            if (result && result.status === "success") {
                // Update online users presence
                if (result.onlineUsers) {
                    this.handleOnlineUsers(result.onlineUsers);
                }

                // If hasChanges is true, or fallback if server returned full data directly
                const hasChanges = (result.hasChanges === true) || 
                    (result.hasChanges === undefined && Array.isArray(result.data) && result.data.length > 0);

                if (hasChanges) {
                    console.log("⚡ Live change detected on Google Sheets! Fetching latest state...");
                    // Server has detected changes from another device! Fetch complete data silently
                    const fullData = (result.hasChanges === undefined && Array.isArray(result.data))
                        ? { orders: result.data, setup: result.setup || null, serverTimestamp: result.serverTimestamp, onlineUsers: result.onlineUsers || [] }
                        : await this.fetchAllData(15000, true);

                    if (fullData) {
                        if (result.serverTimestamp) {
                            this.setServerTimestamp(result.serverTimestamp);
                        }
                        if (typeof this.onDataUpdated === "function") {
                            this.onDataUpdated(fullData);
                        }
                        if (typeof this.onLiveSyncPulse === "function") {
                            this.onLiveSyncPulse();
                        }
                    }
                    return { hasChanges: true, data: fullData };
                } else {
                    // Up to date
                    if (result.serverTimestamp && this.lastServerTimestamp === "0") {
                        this.setServerTimestamp(result.serverTimestamp);
                    }
                    return { hasChanges: false };
                }
            }
        } catch (err) {
            clearTimeout(timeoutId);
            // Silent during background polling to avoid disturbing user
        } finally {
            this.isCheckingUpdates = false;
        }
        return null;
    },

    // Start background live polling (resilient loop that cannot die on mobile)
    startLivePolling() {
        this.stopLivePolling();
        if (!this.isConfigured()) return;

        const loop = async () => {
            try {
                await this.checkUpdates();
            } catch (err) {
                console.warn("Live poll iteration error:", err);
            } finally {
                const delay = (typeof document !== "undefined" && document.hidden) 
                    ? this.bgPollIntervalMs 
                    : this.pollIntervalMs;
                this.pollTimer = setTimeout(loop, delay);
            }
        };

        // First check after 1.5 seconds, then recurring every 3.5s
        this.pollTimer = setTimeout(loop, 1500);
    },

    // Stop background live polling
    stopLivePolling() {
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
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

    // Low-level send with fallback to offline queue and timeout protection
    async sendPayload(payload, timeoutMs = 20000) {
        if (!this.isConfigured()) {
            console.info("Google Sheet API URL not configured yet. Saved locally.");
            this.updateStatusBadge("offline", "ដំណើរការក្នុងកុំព្យូទ័រ (មិនទាន់ភ្ជាប់ Sheet)");
            return { success: false, reason: "NOT_CONFIGURED" };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            this.updateStatusBadge("syncing", "កំពុងបញ្ជូនទៅ Google Sheet...");
            
            // Sending POST via fetch text/plain to avoid strict CORS preflight issues with Google Apps Script
            const response = await fetch(this.getApiUrl(), {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const result = await response.json();
            if (result.status === "success") {
                if (result.serverTimestamp) {
                    this.setServerTimestamp(result.serverTimestamp);
                }
                this.updateStatusBadge("online", "បាន Auto-Update ទៅ Sheet ✅");
                
                // Immediately notify all other tabs on this machine
                this.broadcast("LOCAL_MUTATION", { payload, serverTimestamp: result.serverTimestamp });
                
                // Attempt to process any pending offline queue items
                this.flushQueue();
                return { success: true, result };
            } else {
                throw new Error(result.message || "Failed to update sheet");
            }
        } catch (err) {
            clearTimeout(timeoutId);
            console.error("Auto update failed, queueing for retry:", err);
            this.queuePayload(payload);
            this.updateStatusBadge("warning", "បានរក្សាទុកក្នុងម៉ាស៊ីន (រង់ចាំ Sync)");
            return { success: false, queued: true, error: err.message };
        }
    },

    // Clean Sheet Headers (ដកអក្សរខ្មែរ) and Format Duration columns to hh:mm
    async cleanSheetHeadersAndDurations() {
        if (!this.isConfigured()) return { success: false, message: "Google Sheet មិនទាន់ភ្ជាប់ទេ" };
        try {
            const url = `${this.getApiUrl()}?action=clean_sheet&_t=${Date.now()}`;
            const res = await fetch(url, { method: "GET", mode: "cors" });
            const data = await res.json();
            return { success: data.status === "success", result: data };
        } catch(e) {
            return { success: false, error: e.message };
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
                    if (resJson.serverTimestamp) {
                        this.setServerTimestamp(resJson.serverTimestamp);
                    }
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

// Initialize BroadcastChannel immediately
SheetsSync.initBroadcast();

// Auto listen for browser online event
window.addEventListener("online", () => {
    SheetsSync.flushQueue();
    SheetsSync.checkUpdates(true);
});

// Immediately check for updates when window gains focus, unlocks, or tab becomes visible (Phone unlock or PC tab switch)
window.addEventListener("focus", () => {
    if (SheetsSync.isConfigured()) {
        SheetsSync.checkUpdates(true);
    }
});

window.addEventListener("pageshow", () => {
    if (SheetsSync.isConfigured()) {
        SheetsSync.checkUpdates(true);
    }
});

document.addEventListener("visibilitychange", () => {
    if (!document.hidden && SheetsSync.isConfigured()) {
        SheetsSync.checkUpdates(true);
    }
});

// Periodic touch trigger on mobile devices (triggers live check if 6s have elapsed since last check)
let lastUserInteractionCheck = 0;
window.addEventListener("pointerdown", () => {
    const now = Date.now();
    if (now - lastUserInteractionCheck > 6000 && SheetsSync.isConfigured()) {
        lastUserInteractionCheck = now;
        SheetsSync.checkUpdates(false);
    }
}, { passive: true });
