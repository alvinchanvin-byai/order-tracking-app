/**
 * ========================================================
 * TELEGRAM NOTIFICATION MODULE FOR ORDER TRACKING APP
 * Version: 1.0.0
 * Features:
 *  - Direct Telegram Bot API integration (via CORS-supported sendMessage)
 *  - Fallback through Google Apps Script proxy if needed
 *  - Smart debounced Start Delivery report (groups multiple orders into 1 clean message)
 *  - Instant End Delivery report (Success / Incomplete / Return with duration & payment)
 *  - Comprehensive Daily Delivery Summary Report
 *  - LocalStorage + WebSocket real-time broadcast of config across all devices
 * ========================================================
 */

const TelegramNotify = (function () {
    const STORAGE_KEY = "order_tracker_telegram_config_v1";

    // Track the last time Admin saved locally to guard against race condition overwrites from background polling
    let lastLocalSaveTimestamp = 0;

    // Default configuration
    const defaultConfig = {
        enabled: true,
        botToken: "",
        chatId: "",
        notifyOnStart: true,
        notifyOnEnd: true,
        notifyDailySummary: true,
        includePayment: true,
        includeLocation: true
    };

    // In-memory queue for Start Delivery debouncing
    let pendingStartOrders = [];
    let startDebounceTimer = null;
    const START_DEBOUNCE_MS = 3500; // 3.5 seconds window to group multiple started orders

    /**
     * Escape special HTML characters for Telegram HTML mode
     */
    function escapeTg(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    /**
     * Retrieve stored configuration
     */
    function getConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return { ...defaultConfig, ...parsed };
            }
        } catch (e) {
            console.warn("[TelegramNotify] Failed to parse stored config:", e);
        }
        return { ...defaultConfig };
    }

    /**
     * Apply synced configuration from Cloud (Google Apps Script) or Realtime Relay
     * Allows all devices and non-admin roles (Manager & User) to inherit Telegram config automatically
     */
    function applySyncedConfig(incoming) {
        if (!incoming || typeof incoming !== "object") return;

        // Guard against race conditions: If the local Admin recently saved a config (<25 seconds ago),
        // protect the newly saved settings from being overwritten by stale incoming polling data!
        if (Date.now() - lastLocalSaveTimestamp < 25000) {
            return getConfig();
        }

        const current = getConfig();

        // Guard: Do not overwrite valid token or chatId with empty/null strings
        const incomingToken = incoming.botToken ? String(incoming.botToken).trim() : "";
        const incomingChatId = incoming.chatId ? String(incoming.chatId).trim() : "";
        const merged = { ...current, ...incoming };
        if (!incomingToken && current.botToken) merged.botToken = current.botToken;
        if (!incomingChatId && current.chatId) merged.chatId = current.chatId;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch (e) {
            console.warn("[TelegramNotify] Failed to cache synced config:", e);
        }

        // If the settings modal inputs are currently rendered on screen, update them
        const tgTokenEl = document.getElementById("tgBotTokenInput");
        const tgChatEl = document.getElementById("tgChatIdInput");
        const tgToggleEl = document.getElementById("tgEnabledToggle");
        const tgOnStartEl = document.getElementById("tgNotifyOnStart");
        const tgOnEndEl = document.getElementById("tgNotifyOnEnd");
        const tgIncludePayEl = document.getElementById("tgIncludePayment");
        if (tgTokenEl && document.activeElement !== tgTokenEl && merged.botToken) {
            tgTokenEl.value = merged.botToken;
        }
        if (tgChatEl && document.activeElement !== tgChatEl && merged.chatId) {
            tgChatEl.value = merged.chatId;
        }
        if (tgToggleEl && merged.enabled !== undefined) tgToggleEl.checked = Boolean(merged.enabled);
        if (tgOnStartEl && merged.notifyOnStart !== undefined) tgOnStartEl.checked = Boolean(merged.notifyOnStart);
        if (tgOnEndEl && merged.notifyOnEnd !== undefined) tgOnEndEl.checked = Boolean(merged.notifyOnEnd);
        if (tgIncludePayEl && merged.includePayment !== undefined) tgIncludePayEl.checked = Boolean(merged.includePayment);

        return merged;
    }

    /**
     * If this device already has Telegram Bot Token & Chat ID configured (e.g. PC),
     * auto-broadcast and push it to Google Apps Script Cloud so that Mobile & other users inherit it immediately!
     */
    function ensureCloudSynced() {
        const cfg = getConfig();
        if (cfg && cfg.botToken && cfg.botToken.trim() && cfg.chatId && cfg.chatId.trim()) {
            if (window.SheetsSync && typeof window.SheetsSync.syncTelegramConfig === "function") {
                window.SheetsSync.syncTelegramConfig(cfg);
            }
            if (window.SheetsSync && typeof window.SheetsSync.broadcastRealtime === "function") {
                window.SheetsSync.broadcastRealtime({
                    action: "SAVE_TELEGRAM_CONFIG",
                    type: "TELEGRAM_CONFIG_UPDATE",
                    config: cfg
                });
            }
        }
    }

    /**
     * Save configuration and broadcast to other tabs/devices
     * Returns a Promise that resolves when local + cloud save completes
     */
    async function saveConfig(newConfig, broadcastCloud = true) {
        lastLocalSaveTimestamp = Date.now();
        const merged = { ...getConfig(), ...newConfig };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch (e) {
            console.error("[TelegramNotify] Error saving config:", e);
        }

        // 1. Broadcast across open tabs on the same computer (<5ms)
        if (window.SheetsSync && typeof window.SheetsSync.broadcast === "function") {
            window.SheetsSync.broadcast("TELEGRAM_CONFIG_UPDATE", merged);
        }

        // 2. Broadcast across all devices (PC <-> Mobile) via Realtime Relay (<50ms)
        if (broadcastCloud && window.SheetsSync && typeof window.SheetsSync.broadcastRealtime === "function") {
            window.SheetsSync.broadcastRealtime({
                action: "SAVE_TELEGRAM_CONFIG",
                type: "TELEGRAM_CONFIG_UPDATE",
                config: merged
            });
        }

        // 3. Save to Google Apps Script cloud storage for persistence across all users
        let cloudRes = null;
        if (broadcastCloud && window.SheetsSync && typeof window.SheetsSync.syncTelegramConfig === "function") {
            try {
                cloudRes = await window.SheetsSync.syncTelegramConfig(merged);
            } catch (err) {
                console.warn("[TelegramNotify] Cloud save warning:", err);
            }
        }

        return { success: true, config: merged, cloudResult: cloudRes };
    }

    /**
     * Check if Telegram notifications are properly configured and enabled
     */
    function isConfigured() {
        const cfg = getConfig();
        return Boolean(cfg.enabled && cfg.botToken && cfg.botToken.trim() && cfg.chatId && cfg.chatId.trim());
    }

    /**
     * Send raw HTML message to Telegram Bot API
     * Primary: direct fetch() to https://api.telegram.org/bot<TOKEN>/sendMessage
     * Secondary: fallback via Google Apps Script POST if configured and direct fetch fails
     */
    async function sendMessage(htmlText, customToken, customChatId) {
        const cfg = getConfig();
        const token = (customToken || cfg.botToken || "").trim();
        const chatId = (customChatId || cfg.chatId || "").trim();

        if (!token || !chatId) {
            console.warn("[TelegramNotify] Bot token or Chat ID is missing. Notification skipped.");
            return { success: false, error: "Bot token or Chat ID missing" };
        }

        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const payload = {
            chat_id: chatId,
            text: htmlText,
            parse_mode: "HTML",
            disable_web_page_preview: true
        };

        // Try direct browser fetch first (Telegram API supports CORS)
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok) {
                return { success: true, result: data.result };
            } else {
                console.warn("[TelegramNotify] Direct API returned error:", data);
                // Fall back if needed
                throw new Error(data.description || `HTTP ${res.status}`);
            }
        } catch (directErr) {
            console.warn("[TelegramNotify] Direct fetch failed:", directErr.message);

            // Attempt fallback through Google Apps Script if available
            if (window.SheetsSync && window.SheetsSync.isConfigured && window.SheetsSync.isConfigured()) {
                try {
                    const gasUrl = window.SheetsSync.getApiUrl();
                    const gasRes = await fetch(gasUrl, {
                        method: "POST",
                        headers: { "Content-Type": "text/plain;charset=utf-8" },
                        body: JSON.stringify({
                            action: "sendTelegram",
                            botToken: token,
                            chatId: chatId,
                            text: htmlText
                        })
                    });
                    const gasData = await gasRes.json().catch(() => ({}));
                    if (gasData.success) {
                        return { success: true, result: gasData.result };
                    }
                } catch (gasErr) {
                    console.warn("[TelegramNotify] Apps Script proxy fallback also failed:", gasErr.message);
                }
            }

            return { success: false, error: directErr.message };
        }
    }

    /**
     * Send test message to verify Bot Token and Chat ID
     */
    async function testConnection(customToken, customChatId) {
        const timeStr = typeof formatAppDateTime === "function" ? formatAppDateTime() : new Date().toLocaleString();
        const testHtml = 
`🎉 <b>សាកល្បងការតភ្ជាប់ជោគជ័យ! (Test Successful)</b>
━━━━━━━━━━━━━
🤖 <b>ប្រព័ន្ធ:</b> Order Tracking &amp; Delivery System
⏰ <b>កាលបរិច្ឆេទ:</b> <code>${escapeTg(timeStr)}</code>
✅ <b>ស្ថានភាព:</b> Telegram Bot ដំណើរការធម្មតា និងរួចរាល់សម្រាប់ការផ្ញើ Report ស្វ័យប្រវត្តិ!`;

        return await sendMessage(testHtml, customToken, customChatId);
    }

    /**
     * Retrieve recent chats that have messaged or added the Bot
     * Helps auto-detect Chat ID easily without user having to manually find it.
     */
    async function getRecentChats(customToken) {
        const cfg = getConfig();
        const token = (customToken || cfg.botToken || "").trim();
        if (!token) {
            return { success: false, error: "សូមបញ្ចូល Telegram Bot Token ជាមុនសិន!" };
        }

        const url = `https://api.telegram.org/bot${token}/getUpdates`;

        // Direct fetch first
        try {
            const res = await fetch(url);
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok) {
                const updates = Array.isArray(data.result) ? data.result : [];
                const chatMap = new Map();
                updates.forEach(u => {
                    const msg = u.message || u.channel_post || u.my_chat_member;
                    if (msg && msg.chat) {
                        const c = msg.chat;
                        const id = String(c.id);
                        const title = c.title || (c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : c.username) || "Chat";
                        const type = c.type || "group";
                        chatMap.set(id, { id, title, type });
                    }
                });
                return { success: true, chats: Array.from(chatMap.values()) };
            } else {
                throw new Error(data.description || `HTTP ${res.status}`);
            }
        } catch (err) {
            // Fallback via Google Apps Script
            if (window.SheetsSync && window.SheetsSync.isConfigured && window.SheetsSync.isConfigured()) {
                try {
                    const gasUrl = window.SheetsSync.getApiUrl();
                    const gasRes = await fetch(gasUrl, {
                        method: "POST",
                        headers: { "Content-Type": "text/plain;charset=utf-8" },
                        body: JSON.stringify({ action: "getTelegramUpdates", botToken: token })
                    });
                    const gasData = await gasRes.json().catch(() => ({}));
                    if (gasData.success && Array.isArray(gasData.chats)) {
                        return { success: true, chats: gasData.chats };
                    }
                } catch (gasErr) {}
            }
            return { success: false, error: err.message };
        }
    }

    /**
     * Queue an order that has just started delivery.
     * Uses a debounce timer (3.5s) to bundle multiple orders started together
     * into a single clean Telegram message.
     */
    function queueDeliveryStart(order, driverName) {
        const cfg = getConfig();
        if (!cfg.enabled || !cfg.notifyOnStart) return;
        if (!cfg.botToken || !cfg.chatId) return;
        if (!order || !order.soNumber) return;

        // Check if already queued
        const existingIdx = pendingStartOrders.findIndex(item => item.order.soNumber === order.soNumber);
        if (existingIdx >= 0) {
            pendingStartOrders[existingIdx] = { order, driverName, time: formatAppDateTime() };
        } else {
            pendingStartOrders.push({ order, driverName, time: formatAppDateTime() });
        }

        // Reset debounce timer
        if (startDebounceTimer) {
            clearTimeout(startDebounceTimer);
        }

        startDebounceTimer = setTimeout(() => {
            flushStartDeliveryQueue();
        }, START_DEBOUNCE_MS);
    }

    /**
     * Immediately flush the pending Start Delivery queue and dispatch Telegram notification
     */
    async function flushStartDeliveryQueue() {
        if (startDebounceTimer) {
            clearTimeout(startDebounceTimer);
            startDebounceTimer = null;
        }

        if (pendingStartOrders.length === 0) return;

        const ordersToDispatch = [...pendingStartOrders];
        pendingStartOrders = [];

        // Group by driver
        const byDriver = {};
        ordersToDispatch.forEach(item => {
            const drv = item.driverName || item.order.deliveryBy || "Driver";
            if (!byDriver[drv]) byDriver[drv] = [];
            byDriver[drv].push(item);
        });

        // Send one message per driver (usually just 1)
        for (const drv in byDriver) {
            const items = byDriver[drv];
            const count = items.length;
            const timeStr = items[0].time || (typeof formatAppDateTime === "function" ? formatAppDateTime() : new Date().toLocaleString());

            let listHtml = "";
            const destinations = new Set();
            const docTypeSet = new Set();
            let totalPkgSum = 0;
            const unitSet = new Set();
            const specialNotesList = [];

            items.forEach((item, idx) => {
                const o = item.order;
                const so = escapeTg(o.soNumber);
                const cust = escapeTg(o.customerName || "អតិថិជនទូទៅ");
                const loc = [o.cityProvince, o.khan].filter(Boolean).map(escapeTg).join(", ");
                if (loc) destinations.add(loc);

                const dt = (o.documentType && o.documentType.trim() && o.documentType !== "General")
                    ? o.documentType.trim()
                    : "SO to customer";
                docTypeSet.add(dt);

                if (o.totalPackage !== undefined && o.totalPackage !== null && o.totalPackage !== "" && Number(o.totalPackage) > 0) {
                    totalPkgSum += Number(o.totalPackage);
                    if (o.packageUnit && o.packageUnit.trim()) {
                        unitSet.add(o.packageUnit.trim());
                    }
                }

                if (o.specialNotes && o.specialNotes.trim()) {
                    specialNotesList.push(o.specialNotes.trim());
                }

                const plNum = o.packingListNumber || o.packingList || o.packing_list || "";
                const amt = (typeof formatInvoiceAmountWithCurrency === "function") 
                    ? formatInvoiceAmountWithCurrency(o.invoiceAmount, o.currency)
                    : (o.invoiceAmount ? `$${o.invoiceAmount}` : "");

                listHtml += `${idx + 1}. <b>${so}</b>  |  <b>Packing List#:</b> ${escapeTg(plNum)}\n🏢 <b>${cust}</b>${amt ? ` (${escapeTg(amt)})` : ""}\n`;
                if (idx < items.length - 1) {
                    listHtml += "\n";
                }
            });

            const docTypeStr = docTypeSet.size > 0 ? Array.from(docTypeSet).join(", ") : "SO to customer";

            let packageUnitStr = "Carton (កេស)";
            if (unitSet.size === 1) {
                packageUnitStr = Array.from(unitSet)[0];
            } else if (unitSet.size > 1) {
                packageUnitStr = "Packages";
            }
            const packageStr = totalPkgSum > 0 ? `${totalPkgSum} ${packageUnitStr}` : "-";

            const notesSummary = specialNotesList.length > 0 ? specialNotesList.join(" | ") : "";

            const destSummary = destinations.size > 0 
                ? Array.from(destinations).slice(0, 3).join(" • ") + (destinations.size > 3 ? "..." : "")
                : "";

            const msgHtml = 
`🚚 <b>ចាប់ផ្ដើមដឹកជញ្ជូន (Start Delivery)</b>
━━━━━━━━━━━━━
👤 <b>អ្នកដឹក (Driver):</b> ${escapeTg(drv)}
⏰ <b>ម៉ោងចេញ:</b> <code>${escapeTg(timeStr)}</code>  |  <b>Document type:</b> ${escapeTg(docTypeStr)}
📦 <b>ចំនួន Order:</b> <b>${count} ${count > 1 ? "Orders" : "Order"}</b>  |  <b>ចំនួន Package:</b> <b>${escapeTg(packageStr)}</b>
📝 <b>Special Notes:</b> ${notesSummary ? `<b>${escapeTg(notesSummary)}</b>` : ""}

━━━━━━━━━━━━━
${listHtml.trim()}
━━━━━━━━━━━━━
${destSummary ? `📍 <b>គោលដៅ:</b> ${destSummary}\n` : ""}📱 <i>ចេញដំណើរពីប្រព័ន្ធ Order Tracking</i>`;

            await sendMessage(msgHtml);
        }
    }

    /**
     * Dispatch End Delivery notification immediately when an order is completed/ended.
     */
    async function sendDeliveryEndReport(order, statusVal, duration, customNotes) {
        const cfg = getConfig();
        if (!cfg.enabled || !cfg.notifyOnEnd) return;
        if (!cfg.botToken || !cfg.chatId) return;
        if (!order || !order.soNumber) return;

        const timeStr = typeof formatAppDateTime === "function" ? formatAppDateTime() : new Date().toLocaleString();
        const attempts = Number(order.deliveryAttempts) || 1;
        const driverName = order.deliveryBy || "Admin / Driver";
        const locationStr = [order.cityProvince, order.khan].filter(Boolean).map(escapeTg).join(" - ") || "មិនបានបញ្ជាក់";
        const durStr = duration || order.deliveryDuration || "-";

        const isSuccess = (statusVal === "Success" || (statusVal && statusVal.endsWith("Success")) || statusVal === "Delivered");
        const isIncomplete = (statusVal === "Incomplete");
        const isReturn = (statusVal === "Return");

        let iconHeader = "✅";
        let statusTitle = `ការដឹកជញ្ជូនបានបញ្ចប់ (${escapeTg(statusVal || "Completed")})`;
        let statusBadge = `<b>${escapeTg(statusVal || "Completed")}</b>`;

        if (isIncomplete) {
            iconHeader = "⚠️";
            statusTitle = `ការដឹកមិនបានជោគជ័យ (Delivery Incomplete)`;
            statusBadge = `<b style="color: #f59e0b;">Incomplete (លើកទី ${attempts})</b>`;
        } else if (isReturn) {
            iconHeader = "↩️";
            statusTitle = `ទំនិញត្រឡប់មកវិញ (Delivery Return)`;
            statusBadge = `<b>Return</b>`;
        } else if (isSuccess) {
            if (attempts > 1) {
                statusBadge = `<b>${escapeTg(statusVal)} (ជោគជ័យលើកទី ${attempts})</b>`;
            } else {
                statusBadge = `<b>Success (ជោគជ័យ)</b>`;
            }
        }

        // Payment info if enabled
        let paymentLine = "";
        if (cfg.includePayment) {
            if (order.paymentReceipt && order.paymentReceipt.trim()) {
                paymentLine = `💵 <b>ការទូទាត់:</b> ${escapeTg(order.paymentReceipt)}\n`;
            } else if (order.invoiceAmount) {
                const amtFormatted = (typeof formatInvoiceAmountWithCurrency === "function")
                    ? formatInvoiceAmountWithCurrency(order.invoiceAmount, order.currency)
                    : `$${order.invoiceAmount}`;
                paymentLine = `💵 <b>ទឹកប្រាក់វិក្កយបត្រ:</b> <b>${escapeTg(amtFormatted)}</b>\n`;
            }
        }

        // Package line if any
        let pkgLine = "";
        if (order.totalPackage && Number(order.totalPackage) > 0) {
            pkgLine = `📦 <b>ចំនួន Package:</b> <b>${order.totalPackage} ${escapeTg(order.packageUnit || "Carton")}</b>\n`;
        }

        // Location line if enabled
        let locLine = "";
        if (cfg.includeLocation && locationStr !== "មិនបានបញ្ជាក់") {
            locLine = `📍 <b>ទីតាំង:</b> ${locationStr}\n`;
        }

        // Notes if any
        let notesLine = "";
        const finalNotes = customNotes || order.deliveryNotes || order.specialNotes || "";
        if (finalNotes && finalNotes.trim()) {
            // Keep last 100 characters of notes
            const cleanNotes = finalNotes.trim().split("\n").pop();
            notesLine = `📝 <b>កំណត់សម្គាល់:</b> <i>${escapeTg(cleanNotes)}</i>\n`;
        }

        const msgHtml = 
`${iconHeader} <b>${statusTitle}</b>
━━━━━━━━━━━━━
📋 <b>SO#:</b> <code>${escapeTg(order.soNumber)}</code>
👤 <b>អតិថិជន:</b> <b>${escapeTg(order.customerName || "អតិថិជនទូទៅ")}</b>
🎯 <b>ស្ថានភាព:</b> ${statusBadge}
⏱ <b>រយៈពេលដឹក:</b> <b>${escapeTg(durStr)}</b>
🛵 <b>អ្នកដឹក (Driver):</b> <b>${escapeTg(driverName)}</b>
${pkgLine}${locLine}${paymentLine}${notesLine}⏰ <b>ម៉ោងបញ្ចប់:</b> <code>${escapeTg(timeStr)}</code>
━━━━━━━━━━━━━
📱 <i>Order Tracking System</i>`;

        return await sendMessage(msgHtml);
    }

    /**
     * Dispatch Comprehensive Daily Delivery Summary Report to Telegram
     * Can be invoked manually via button or triggered end-of-day.
     */
    async function sendDailySummaryReport(targetDateStr) {
        if (!isConfigured()) {
            if (typeof showToast === "function") {
                showToast("សូមឱ្យ Admin កំណត់ Telegram Bot Token និង Chat ID ក្នុង System Settings ជាមុនសិន!", "warning");
            }
            return { success: false, error: "Not configured" };
        }

        const orders = (window.AppState && Array.isArray(window.AppState.orders)) ? window.AppState.orders : [];
        if (orders.length === 0) {
            if (typeof showToast === "function") {
                showToast("មិនទាន់មានទិន្នន័យ Order ក្នុងប្រព័ន្ធឡើយ!", "warning");
            }
            return { success: false, error: "No orders" };
        }

        // Determine date
        let todayIso = "";
        try {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, "0");
            const d = String(now.getDate()).padStart(2, "0");
            todayIso = `${y}-${m}-${d}`;
        } catch (e) {
            todayIso = "";
        }

        const filterDate = targetDateStr || todayIso;

        // Filter orders for the day (deliveryStartTime or deliveryEndTime matches)
        const dailyOrders = orders.filter(o => {
            const startD = (o.deliveryStartTime || "").substring(0, 10);
            const endD = (o.deliveryEndTime || "").substring(0, 10);
            const soD = (o.soDate || o.so_date || o.timestamp || "").substring(0, 10);
            return startD.includes(filterDate) || endD.includes(filterDate) || soD.includes(filterDate);
        });

        const targetList = dailyOrders.length > 0 ? dailyOrders : orders;

        // Statistics
        let countInDelivery = 0;
        let countSuccess = 0;
        let countIncomplete = 0;
        let countReturn = 0;
        let countWaiting = 0;
        let totalUsd = 0;
        let totalKhr = 0;

        const driverStats = {};

        targetList.forEach(o => {
            const st = (o.status || "").toLowerCase();
            const drv = o.deliveryBy || "Unassigned";

            if (!driverStats[drv]) {
                driverStats[drv] = { total: 0, completed: 0, inDelivery: 0 };
            }
            driverStats[drv].total++;

            if (st.includes("in delivery") || st.includes("កំពុងដឹក")) {
                countInDelivery++;
                driverStats[drv].inDelivery++;
            } else if (st.includes("incomplete") || st.includes("មិនបានជោគជ័យ")) {
                countIncomplete++;
                driverStats[drv].completed++;
            } else if (st.includes("return") || st.includes("ត្រឡប់") || st.includes("បង្វែរ")) {
                countReturn++;
                driverStats[drv].completed++;
            } else if (st.includes("success") || st.includes("delivered") || st.includes("ជោគជ័យ") || (o.deliveryEndTime && String(o.deliveryEndTime).trim() !== "" && String(o.deliveryEndTime).trim() !== "-" && !st.includes("incomplete") && !st.includes("return"))) {
                countSuccess++;
                driverStats[drv].completed++;
            } else {
                countWaiting++;
            }

            // Amounts
            const amt = parseFloat(o.invoiceAmount) || 0;
            const curr = (o.currency || "USD").toUpperCase();
            if (curr === "KHR" || (o.paymentReceipt && o.paymentReceipt.includes("៛"))) {
                totalKhr += amt;
            } else {
                totalUsd += amt;
            }
        });

        const totalCompleted = countSuccess + countIncomplete + countReturn;
        const totalActive = countInDelivery + totalCompleted;

        // Driver breakdown text
        let driverListText = "";
        for (const drv in driverStats) {
            const s = driverStats[drv];
            driverListText += `• <b>${escapeTg(drv)}:</b> ${s.completed} បានបញ្ចប់, ${s.inDelivery} កំពុងដឹក\n`;
        }
        if (!driverListText) driverListText = "• មិនទាន់មានទិន្នន័យអ្នកដឹក\n";

        const displayDate = filterDate || (typeof formatAppDateTime === "function" ? formatAppDateTime() : new Date().toLocaleDateString());

        const reportHtml = 
`📊 <b>របាយការណ៍ដឹកជញ្ជូនប្រចាំថ្ងៃ (Daily Delivery Report)</b>
━━━━━━━━━━━━━
📅 <b>កាលបរិច្ឆេទ:</b> <code>${escapeTg(displayDate)}</code>
📦 <b>ការដឹកសរុប:</b> <b>${totalActive} Orders</b>
━━━━━━━━━━━━━
✅ <b>បានបញ្ចប់ជោគជ័យ (Success):</b> <b>${countSuccess} Orders</b>
⚠️ <b>មិនជោគជ័យ (Incomplete):</b> <b>${countIncomplete} Orders</b>
↩️ <b>ត្រឡប់មកវិញ (Return):</b> <b>${countReturn} Orders</b>
🚚 <b>កំពុងដឹកជញ្ជូន (In Delivery):</b> <b>${countInDelivery} Orders</b>
━━━━━━━━━━━━━
💵 <b>ទឹកប្រាក់សរុប (Total Invoices):</b>
${totalUsd > 0 ? `• USD: <b>$${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>\n` : ""}${totalKhr > 0 ? `• KHR: <b>៛${totalKhr.toLocaleString()}</b>\n` : ""}━━━━━━━━━━━━━
🛵 <b>ស្ថិតិតាមអ្នកដឹក (Driver Performance):</b>
${driverListText.trim()}
━━━━━━━━━━━━━
⏰ <b>ម៉ោងបង្កើត Report:</b> <code>${escapeTg(typeof formatAppDateTime === "function" ? formatAppDateTime() : new Date().toLocaleString())}</code>
📱 <i>ផ្ញើដោយស្វ័យប្រវត្តិពី Order Tracking System</i>`;

        if (typeof showToast === "function") {
            showToast("កំពុងផ្ញើ Daily Delivery Report ទៅ Telegram...", "info");
        }

        const res = await sendMessage(reportHtml);
        if (res.success) {
            if (typeof Swal !== "undefined") {
                Swal.fire({
                    title: "ផ្ញើ Report បានជោគជ័យ! ✈️✨",
                    text: "របាយការណ៍ Daily Delivery Report ត្រូវបានបញ្ជូនចូល Telegram Group/Channel រួចរាល់!",
                    icon: "success",
                    confirmButtonText: "យល់ព្រម",
                    confirmButtonColor: "#0284c7"
                });
            } else if (typeof showToast === "function") {
                showToast("បានផ្ញើ Report ទៅ Telegram ជោគជ័យ!", "success");
            }
        } else {
            if (typeof Swal !== "undefined") {
                Swal.fire({
                    title: "បរាជ័យក្នុងការផ្ញើ Report ⚠️",
                    text: `មិនអាចផ្ញើទៅ Telegram បានឡើយ: ${res.error || "Unknown error"}។ សូមពិនិត្យ Bot Token និង Chat ID ឡើងវិញ!`,
                    icon: "error",
                    confirmButtonText: "បិទ",
                    confirmButtonColor: "#ef4444"
                });
            } else if (typeof showToast === "function") {
                showToast(`ផ្ញើ Telegram បរាជ័យ: ${res.error}`, "error");
            }
        }

        return res;
    }

    // Public API
    return {
        getConfig,
        saveConfig,
        applySyncedConfig,
        ensureCloudSynced,
        isConfigured,
        sendMessage,
        testConnection,
        getRecentChats,
        queueDeliveryStart,
        flushStartDeliveryQueue,
        sendDeliveryEndReport,
        sendDailySummaryReport
    };
})();

// Attach to window object for global access
window.TelegramNotify = TelegramNotify;
