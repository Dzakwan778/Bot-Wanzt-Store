import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import makeWASocket, { useMultiFileAuthState, DisconnectReason, proto, generateWAMessageFromContent } from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import { isFirebaseEnabled, syncFromFirestore, syncToFirestore } from "./src/firebase-db.js";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Set up paths
const DB_PATH = path.join(process.cwd(), "src", "database.json");
const AUTH_DIR = path.join(process.cwd(), "baileys_auth_info");

interface MessageLog {
  id: string;
  from: string;
  senderName: string;
  message: string;
  timestamp: string;
  type: "incoming" | "outgoing" | "system";
  status?: string;
}

const lidCache = new Map<string, string>();

function resolveLidToPn(jid: string): string {
  if (!jid) return jid;
  if (jid.endsWith("@lid")) {
    const rawLid = jid.split("@")[0] || "";
    const cleanLid = rawLid.split(":")[0];
    
    // Check in-memory cache first
    if (lidCache.has(cleanLid)) {
      return `${lidCache.get(cleanLid)}@s.whatsapp.net`;
    }
    
    try {
      const authDir = path.join(process.cwd(), "baileys_auth_info");
      if (fs.existsSync(authDir)) {
        const files = fs.readdirSync(authDir);
        for (const file of files) {
          if (file.startsWith("lid-mapping-") && file.endsWith(".json")) {
            const filePath = path.join(authDir, file);
            const content = fs.readFileSync(filePath, "utf-8").trim().replace(/['"]/g, "");
            if (content === cleanLid) {
              const pn = file.replace("lid-mapping-", "").replace(".json", "");
              // Write to cache
              lidCache.set(cleanLid, pn);
              return `${pn}@s.whatsapp.net`;
            }
          }
        }
      }
    } catch (e) {
      console.error("Error resolving LID to PN:", e);
    }
  }
  return jid;
}

// Bot Manager State
class WhatsAppBotManager {
  status: "disconnected" | "connecting" | "connected" = "disconnected";
  qrCode: string = "";
  pairingCode: string = "";
  phoneNumber: string = "";
  pushName: string = "";
  logs: MessageLog[] = [];
  sock: any = null;
  error: string = "";
  reconnectAttempts: number = 0;
  maxReconnectAttempts: number = 5;
  presencesMap: Record<string, Set<string>> = {};
  spamTracker: Record<string, { lastMessage: string; count: number; cooldownUntil: number; warned: boolean }> = {};
  cachedDb: any = null;
  private isSyncingFirebase: boolean = false;

  addLog(log: Omit<MessageLog, "id" | "timestamp">) {
    const fullLog: MessageLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.logs.unshift(fullLog);
    if (this.logs.length > 200) {
      this.logs.pop();
    }
  }

  getDb() {
    const defaultCommands = [
      {
        id: "menu",
        trigger: "menu",
        response: `╭ 🌙 {storeName} MENU 🌙
┃ ✦ Welcome to {storeName}
┃ ✦ Fast Response • Trusted • Cheap
┃ ✦ Premium Apps, Streaming & More
╰━━━━━━━━━━━━━━━━━━━━━╯

📂 MENU

• /List
• /Payment
• /Owner
• /Tutor (produk)
• COMING SOON

━━━━━━━━━━━━━━━━━━
📌 Ketik nama produk untuk lihat detail
📌 Contoh: NETFLIX / CANVA / CHATGPT
━━━━━━━━━━━━━━━━━━`,
        mediaUrl: "",
        mediaType: "none",
        description: "Menampilkan pesan utama / menu utama bot"
      },
      {
        id: "list",
        trigger: "list",
        response: `╭ 🌙 {storeName} LIST 🌙 
┃ ✦ Welcome to {storeName}
┃ ✦ Fast Response • Trusted • Cheap
┃ ✦ Premium Apps, Streaming & More
╰━━━━━━━━━━━━━━━━━━━━━╯

📂 *𝗖𝗔𝗧𝗔𝗟𝗢𝗚 𝗣𝗥𝗢𝗗𝗨𝗞*

{catalog}
━━━━━━━━━━━━━━━━━━
📌 *Ketik nama produk untuk lihat detail*
📌 *Contoh: NETFLIX / CANVA / CHATGPT*
━━━━━━━━━━━━━━━━━━`,
        mediaUrl: "",
        mediaType: "none",
        description: "Menampilkan daftar katalog produk yang terbagi per kategori"
      },
      {
        id: "payment",
        trigger: "payment",
        response: `╭━━━〔 💳 PEMBAYARAN 〕━━━╮

📱 DANA
08123456789

📱 OVO
08123456789

📱 GOPAY
08123456789

🌍 PAYPAL
Coming Soon

✅ QRIS tersedia
Silakan scan QRIS di atas.

📸 Setelah transfer,
kirim bukti pembayaran ke owner.

╰━━━━━━━━━━━━━━━━━━╯`,
        mediaUrl: "",
        mediaType: "none",
        description: "Menampilkan informasi pembayaran dan QRIS"
      },
      {
        id: "owner",
        trigger: "owner",
        response: `╭━━━〔 👤 OWNER CONTACT 〕━━━╮

Berikut adalah nomor kontak Owner Resmi *{storeName}*:

📱 *WhatsApp:* +{ownerNumber}
🔗 *Link Chat:* https://wa.me/{ownerNumber}

Silakan hubungi owner untuk keperluan bisnis, keluhan transaksi, atau mendaftar kemitraan/reseller.

╰━━━━━━━━━━━━━━━━━━━━╯`,
        mediaUrl: "",
        mediaType: "none",
        description: "Menampilkan informasi kontak/WhatsApp owner"
      }
    ];

    if (this.cachedDb) {
      // Return cached in-memory DB instantly (fast & quota friendly!)
      return this.cachedDb;
    }

    try {
      if (fs.existsSync(DB_PATH)) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        let updated = false;
        if (!data.commands) {
          data.commands = defaultCommands;
          updated = true;
        }
        if (!data.transactions) {
          data.transactions = [];
          updated = true;
        }
        if (data.products && Array.isArray(data.products)) {
          data.products.forEach((p: any) => {
            if (p.stock === undefined) {
              p.stock = 10;
              updated = true;
            }
            if (p.price === undefined) {
              p.price = 0;
              updated = true;
            }
          });
        }
        
        this.cachedDb = data;
        if (updated) {
          this.saveDb(this.cachedDb);
        }

        // Trigger safe non-blocking background Firestore updates
        this.asyncFirebaseLoad();

        return this.cachedDb;
      }
    } catch (e) {
      console.error("Error reading database:", e);
    }

    const fallbackDb = { categories: [], products: [], settings: {}, commands: defaultCommands, transactions: [] };
    this.cachedDb = fallbackDb;
    this.asyncFirebaseLoad();
    return fallbackDb;
  }

  async asyncFirebaseLoad() {
    if (!isFirebaseEnabled() || this.isSyncingFirebase) {
      return;
    }
    this.isSyncingFirebase = true;
    try {
      console.log("[Firebase] Connecting to Firebase Cloud Firestore...");
      const cloudData = await syncFromFirestore();
      if (cloudData) {
        // Last-Write-Wins timestamp-based sync logic to prevent stale rollbacks
        const localTimeStr = this.cachedDb?.settings?.lastUpdated || "";
        const cloudTimeStr = cloudData.settings?.lastUpdated || "";

        const localTime = localTimeStr ? new Date(localTimeStr).getTime() : 0;
        const cloudTime = cloudTimeStr ? new Date(cloudTimeStr).getTime() : 0;

        console.log(`[Firebase] Timestamp Compare -> Local: ${localTimeStr || "None"} (${localTime}) vs Cloud: ${cloudTimeStr || "None"} (${cloudTime})`);

        if (cloudTime > localTime) {
          console.log("[Firebase] Cloud Firestore database is newer. Syncing cloud data to local cache.");
          this.cachedDb = cloudData;
          fs.writeFileSync(DB_PATH, JSON.stringify(cloudData, null, 2), "utf-8");
        } else if (localTime > cloudTime) {
          console.log("[Firebase] Local cache database is newer than Cloud Firestore. Seeding newer local data to Cloud Firestore.");
          await syncToFirestore(this.cachedDb);
        } else {
          console.log("[Firebase] Local cache and Cloud Firestore are perfectly in sync.");
        }
      } else {
        // Cloud is unseeded, upload our local cache to seed it!
        console.log("[Firebase] Cloud Firestore is empty. Seeding local database up to Cloud Firestore...");
        await syncToFirestore(this.cachedDb);
      }
    } catch (e) {
      console.error("[Firebase] Error during background synchronization:", e);
    } finally {
      this.isSyncingFirebase = false;
    }
  }

  saveDb(data: any) {
    try {
      // Ensure settings exists and set automated timestamp to prevent stale rollbacks
      if (!data.settings) {
        data.settings = {};
      }
      data.settings.lastUpdated = new Date().toISOString();

      this.cachedDb = data;
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
      if (isFirebaseEnabled()) {
        syncToFirestore(data).then(() => {
          console.log("[Firebase] Cloud Firestore updated successfully!");
        }).catch((err) => {
          console.error("[Firebase] Asynchronous write to Firestore failed:", err);
        });
      }
      return true;
    } catch (e) {
      console.error("Error writing database:", e);
      return false;
    }
  }

  // Auto clean stale auth keys if needed
  async disconnect() {
    this.status = "disconnected";
    this.qrCode = "";
    this.pairingCode = "";
    this.phoneNumber = "";
    this.pushName = "";
    this.error = "";
    this.reconnectAttempts = 0;

    if (this.sock) {
      try {
        this.sock.logout();
        this.sock.end(undefined);
      } catch (err) {
        console.error("Error during socket logout:", err);
      }
      this.sock = null;
    }

    try {
      // Clean auth session directory
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        console.log("Auth directory wiped successfully");
      }
    } catch (e) {
      console.error("Error deleting auth dir:", e);
    }

    this.addLog({
      from: "System",
      senderName: "System",
      message: "WhatsApp session disconnected & logged out.",
      type: "system",
      status: "Disconnected",
    });
  }

  async initialize(pairingPhone?: string) {
    // If already connecting or connected, don't re-init unless explicit disconnect
    if (this.status === "connected" && !pairingPhone) {
      return;
    }

    this.status = "connecting";
    this.qrCode = "";
    this.pairingCode = "";
    this.error = "";

    // Clear any existing socket event listeners and connection cleanly before re-initializing
    if (this.sock) {
      try {
        console.log("Terminating existing socket connection before re-initializing...");
        if (this.sock.ev) {
          const ev = this.sock.ev;
          if (typeof ev.removeAllListeners === "function") {
            ev.removeAllListeners("connection.update");
            ev.removeAllListeners("creds.update");
            ev.removeAllListeners("messages.upsert");
            ev.removeAllListeners("presence.update");
          }
        }
        if (typeof this.sock.end === "function") {
          this.sock.end(undefined);
        }
      } catch (err) {
        console.error("Failed to end old socket during re-init:", err);
      }
      this.sock = null;
    }

    this.addLog({
      from: "System",
      senderName: "System",
      message: pairingPhone 
        ? `Menghubungkan via Pairing Code ke nomor ${pairingPhone}...` 
        : "Menghubungkan bot & memuat credentials...",
      type: "system",
      status: "Connecting",
    });

    try {
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }) as any,
        browser: ["Ubuntu", "Chrome", "110.0.0"],
      });

      // Credential Update Event
      this.sock.ev.on("creds.update", saveCreds);

      // Connection Update Event
      this.sock.ev.on("connection.update", async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            // Generate QR data URL for react
            this.qrCode = await QRCode.toDataURL(qr);
            this.status = "disconnected"; // QR available, waiting for scan
            this.error = "";
          } catch (err) {
            console.error("Failed to generate QR Code image:", err);
            this.qrCode = qr; // Fallback to raw string
          }
        }

        if (connection === "connecting") {
          this.status = "connecting";
        }

        if (connection === "open") {
          this.status = "connected";
          this.qrCode = "";
          this.pairingCode = "";
          this.reconnectAttempts = 0;
          this.error = "";
          
          // Capture user details
          const userJid = this.sock.user?.id;
          this.phoneNumber = userJid ? userJid.split(":")[0] : "";
          this.pushName = this.sock.user?.name || "Wanzz Store Bot";

          this.addLog({
            from: "System",
            senderName: "System",
            message: `Bot berhasil terhubung! Login sebagai: ${this.pushName} (${this.phoneNumber})`,
            type: "system",
            status: "Connected",
          });
        }

        if (connection === "close") {
          const errCode = (lastDisconnect?.error as any)?.output?.statusCode || (lastDisconnect?.error as any)?.statusCode;
          const errorMessage = lastDisconnect?.error?.message || String(lastDisconnect?.error || "Unknown Network / Protocol Error");
          
          const isLoggedOut = errCode === DisconnectReason.loggedOut || 
                             errorMessage.includes("Unauthorized") || 
                             errorMessage.includes("unauthorized") ||
                             errCode === 401 ||
                             errCode === 403;

          const isQrTimeout = errorMessage.includes("QR refs attempts ended") || 
                              errorMessage.includes("attempts ended");

          const isStreamError = errorMessage.includes("Stream Errored") || 
                                errorMessage.includes("restart required") ||
                                errorMessage.includes("515") ||
                                errCode === 515 ||
                                (lastDisconnect?.error as any)?.data?.tag === "stream:error" ||
                                (lastDisconnect?.error as any)?.data?.attrs?.code === "515";

          const shouldReconnect = !isLoggedOut && !isQrTimeout && errCode !== DisconnectReason.badSession;
          
          console.log(`Connection closed (code: ${errCode}). Status details: ${isStreamError ? 'Stream transition' : errorMessage}`);
          
          this.qrCode = "";
          this.pairingCode = "";

          // CRITICAL: Clean up current socket and listeners immediately to prevent duplicate events or memory leaks
          if (this.sock) {
            try {
              if (this.sock.ev) {
                if (typeof this.sock.ev.removeAllListeners === "function") {
                  this.sock.ev.removeAllListeners("connection.update");
                  this.sock.ev.removeAllListeners("creds.update");
                  this.sock.ev.removeAllListeners("messages.upsert");
                  this.sock.ev.removeAllListeners("presence.update");
                }
              }
              if (typeof this.sock.end === "function") {
                this.sock.end(undefined);
              }
            } catch (e) {
              console.error("Error cleaning up closed socket in handler:", e);
            }
            this.sock = null;
          }

          if (isQrTimeout) {
            this.status = "disconnected";
            this.error = "Batas waktu QR Code terlampaui (QR refs attempts ended). Silakan muat ulang halaman atau klik tombol hubungkan kembali.";
            this.addLog({
              from: "System",
              senderName: "System",
              message: "Batas waktu pemindaian QR Code dari WhatsApp telah berakhir. Hubungkan kembali manual.",
              type: "system",
              status: "QR Timeout",
            });
          } else if (shouldReconnect) {
            if (isStreamError) {
              // Stream errors (code 515) are transient websocket drops. We handle them by resetting reconnectAttempts
              // to ensure infinite auto-recovery.
              this.reconnectAttempts = 0;
            } else {
              this.reconnectAttempts++;
            }

            if (isStreamError || this.reconnectAttempts <= this.maxReconnectAttempts) {
              this.status = "connecting";
              
              let reconnectReasonMessage = errorMessage;
              if (isStreamError) {
                reconnectReasonMessage = "Stream Errored / Restart Required (Code 515)";
              }
              
              const attemptsText = isStreamError ? "Otomatis" : `${this.reconnectAttempts}/${this.maxReconnectAttempts}`;
              this.error = `Koneksi Bermasalah: ${reconnectReasonMessage} (Mencoba menghubungkan ulang [${attemptsText}])`;
              
              this.addLog({
                from: "System",
                senderName: "System",
                message: `Mencoba menghubungkan kembali ([${attemptsText}]) karena: ${reconnectReasonMessage}`,
                type: "system",
                status: "Reconnecting",
              });

              setTimeout(() => this.initialize(), isStreamError ? 2000 : 5000); // Retry reconnect in 2s for stream errors
            } else {
              this.status = "disconnected";
              this.error = `Gagal Terhubung: ${errorMessage}. Batas percobaan hubungkan ulang terlampaui.`;
              
              this.addLog({
                from: "System",
                senderName: "System",
                message: `Gagal menyambung otomatis: ${errorMessage}. Silakan klik tombol 'Hubungkan' secara manual.`,
                type: "system",
                status: "Failed",
              });
            }
          } else {
            this.status = "disconnected";
            
            if (isLoggedOut) {
              this.error = "Terputus: Sesi tidak sah atau telah keluar (Unauthorized / Logged Out).";
            } else {
              this.error = `Koneksi Terputus: ${errorMessage}. Sesi dibersihkan.`;
            }

            // Clean credentials to allow fresh start next time
            if (fs.existsSync(AUTH_DIR)) {
              try {
                fs.rmSync(AUTH_DIR, { recursive: true, force: true });
              } catch (e) {
                console.error("Failed to clean authorization directory:", e);
              }
            }

            this.addLog({
              from: "System",
              senderName: "System",
              message: `Koneksi WhatsApp dihentikan: ${errorMessage}. Kredensial dibersihkan untuk keamanan.`,
              type: "system",
              status: "Session Reset",
            });
          }
        }
      });

      // Messages Upsert (Incoming chat listener)
      this.sock.ev.on("messages.upsert", async (m: any) => {
        if (m.type !== "notify") return;
        for (const msg of m.messages) {
          // Normalize LID JIDs to real Phone Numbers if present
          if (msg.key) {
            if (msg.key.remoteJid && msg.key.remoteJid.endsWith("@lid")) {
              msg.key.remoteJid = resolveLidToPn(msg.key.remoteJid);
            }
            if (msg.key.participant && msg.key.participant.endsWith("@lid")) {
              msg.key.participant = resolveLidToPn(msg.key.participant);
            }
          }
          if (msg.participant && msg.participant.endsWith("@lid")) {
            msg.participant = resolveLidToPn(msg.participant);
          }

          // Guard criteria: skip groups, self-messages (temporarily allowed based on user request)
          if (msg.message) {
            const from = msg.key.remoteJid;
            if (!from) continue;

            // Track sender as active/online in this group if it is a group message
            if (from.endsWith("@g.us") && msg.key.participant) {
              const participantJid = msg.key.participant;
              if (!this.presencesMap) {
                this.presencesMap = {};
              }
              if (!this.presencesMap[from]) {
                this.presencesMap[from] = new Set();
              }
              this.presencesMap[from].add(participantJid);
            }

            // Extract content
            let body = msg.message.conversation || 
                       msg.message.extendedTextMessage?.text || 
                       msg.message.imageMessage?.caption || "";

            if (!body && msg.message) {
              if (msg.message.buttonsResponseMessage) {
                body = msg.message.buttonsResponseMessage.selectedButtonId || "";
              } else if (msg.message.listResponseMessage) {
                body = msg.message.listResponseMessage.singleSelectReply?.selectedRowId || "";
              } else if (msg.message.templateButtonReplyMessage) {
                body = msg.message.templateButtonReplyMessage.selectedId || "";
              } else if (msg.message.interactiveResponseMessage) {
                try {
                  const interMsg = msg.message.interactiveResponseMessage;
                  if (interMsg.nativeFlowResponseMessage?.paramsJson) {
                    body = JSON.parse(interMsg.nativeFlowResponseMessage.paramsJson).id || "";
                  }
                } catch (e) {
                  console.error("Error parsing interactiveResponseMessage:", e);
                }
              }
            }
            
            const senderName = msg.pushName || "Pelanggan";

            if (body) {
              await this.handleIncomingMessage(from, body, senderName, false, msg);
            }
          }
        }
      });

      // Presence Update (Track online members of groups)
      this.sock.ev.on("presence.update", (json: any) => {
        try {
          const from = json.id; // group JID or personal user JID
          if (!from) return;
          const presences = json.presences;
          if (!presences) return;

          for (const [memberId, presenceData] of Object.entries(presences)) {
            const data = presenceData as any;
            const isOnline = data?.lastKnownPresence === "composing" || 
                             data?.lastKnownPresence === "available" || 
                             data?.lastKnownPresence === "recording";
            
            const groupJid = from.endsWith("@g.us") ? from : "global";
            if (!this.presencesMap) {
              this.presencesMap = {};
            }
            if (!this.presencesMap[groupJid]) {
              this.presencesMap[groupJid] = new Set();
            }

            if (isOnline) {
              this.presencesMap[groupJid].add(memberId);
            } else {
              if (data?.lastKnownPresence === "unavailable") {
                this.presencesMap[groupJid].delete(memberId);
              }
            }
          }
        } catch (err) {
          console.error("Error handling presence.update event:", err);
        }
      });

      // Request pairing code if phone number is provided
      if (pairingPhone && !this.sock.authState?.creds?.registered) {
        // Delay slightly for socket setup
        setTimeout(async () => {
          try {
            const cleanedPhone = pairingPhone.replace(/[^0-9]/g, "");
            console.log(`Requesting pairing code for ${cleanedPhone}...`);
            const pCode = await this.sock.requestPairingCode(cleanedPhone);
            this.pairingCode = pCode;
            this.status = "connecting"; // Set structure to connecting
            this.addLog({
              from: "System",
              senderName: "System",
              message: `Pairing Code Berhasil Dibuat: ${pCode}. Masukkan kode ini ke WhatsApp Anda.`,
              type: "system",
              status: "Pairing Code Generated",
            });
          } catch (err: any) {
            console.error("Failed to generate pairing code:", err);
            this.error = "Gagal membuat pairing code. Pastikan format nomor benar (gunakan kode negara, cth: 6281xx).";
            this.status = "disconnected";
            this.addLog({
              from: "System",
              senderName: "System",
              message: `Gagal membuat Pairing Code: ${err.message || err}`,
              type: "system",
              status: "Pairing Failed",
            });
          }
        }, 2000);
      }

    } catch (err: any) {
      console.error("Error creating Baileys socket:", err);
      this.status = "disconnected";
      this.error = err.message || String(err);
    }
  }

  // Command & Product response processor
  async handleIncomingMessage(
    from: string, 
    messageText: string, 
    senderName: string, 
    isSimulation: boolean = false,
    rawMsg?: any
  ): Promise<{ response: string; command: string; status: string; hasImage: boolean; mediaUrl?: string; mediaType?: string; buttons?: Array<{ id: string; text: string }>; isSingleSelect?: boolean; buttonTitle?: string }> {
    
    const db = this.getDb();
    const settings = db.settings;
    const text = messageText.trim();
    const lowerText = text.toLowerCase();

    let responseText = "";
    let statusText = "Unhandled";
    let matchedCommand = "none";
    let hasImage = false;
    let mediaUrlToSend = "";
    let mediaTypeToSend = "";

    // 1. Log incoming message
    if (!isSimulation) {
      this.addLog({
        from,
        senderName,
        message: text,
        type: "incoming",
        status: "Received",
      });
    }

    // 1b. Spam Protection
    const now = Date.now();
    if (!this.spamTracker) {
      this.spamTracker = {};
    }
    if (!this.spamTracker[from]) {
      this.spamTracker[from] = { lastMessage: "", count: 0, cooldownUntil: 0, warned: false };
    }

    const tracker = this.spamTracker[from];

    // Check if user is currently on cooldown
    if (tracker.cooldownUntil > now) {
      const remainingMinutes = Math.ceil((tracker.cooldownUntil - now) / 60000);
      const blockedResponse = `🛡️ *SISTEM ANTI-SPAM*\n\nMaaf, Anda dideteksi melakukan spamming. Bot dinonaktifkan sementara untuk Anda.\nSilakan coba lagi dalam *${remainingMinutes} menit*.`;
      return {
        response: blockedResponse,
        command: "spam_blocked",
        status: "Blocked",
        hasImage: false
      };
    }

    // Track consecutive duplicate messages
    if (tracker.lastMessage === text) {
      tracker.count += 1;
    } else {
      tracker.lastMessage = text;
      tracker.count = 1;
    }

    // Trigger cooldown if count reaches 5
    if (tracker.count >= 5) {
      tracker.cooldownUntil = now + 5 * 60 * 1000; // 5 minutes block
      tracker.count = 0; // reset
      tracker.warned = true;

      const cooldownWarning = `⚠️ *SISTEM ANTI-SPAM*\n\nAnda mengirimkan pesan yang sama sebanyak 5 kali berturut-turut.\n*Bot ditangguhkan sementara selama 5 menit* untuk menjaga performa server.\nSilakan coba lagi beberapa saat lagi!`;

      // Send the WhatsApp notification immediately if live connected
      if (!isSimulation && this.sock && this.status === "connected") {
        try {
          await this.sock.sendMessage(from, { text: cooldownWarning });
        } catch (err) {
          console.error("Failed to send cooldown warning to WA:", err);
        }
      }

      return {
        response: cooldownWarning,
        command: "spam_triggered",
        status: "Spam Blocked",
        hasImage: false
      };
    }

    // Helper to format templates safely
    const format = (template: string, vars: Record<string, string>) => {
      let res = template;
      for (const [k, v] of Object.entries(vars)) {
        res = res.replace(new RegExp(`{${k}}`, "g"), v);
      }
      return res;
    };

    // Check for required prefixes: /, !, or . for non-catalog commands
    const hasPrefix = text.startsWith("/") || text.startsWith("!") || text.startsWith(".");
    const commandText = hasPrefix ? text.substring(1).trim() : "";
    const lowerCommandText = commandText.toLowerCase();

    // 2. Identify Command / Triggers (must be prefixed with /, !, or .)
    const isHideTagCommand = hasPrefix && (lowerCommandText === "h" || lowerCommandText.startsWith("h ") || lowerCommandText.startsWith("h\n"));
    const isGreeting = hasPrefix && ["halo", "p", "hi", "hello", "hei", "start", "bot", "bantuan", "help"].includes(lowerCommandText);
    const isMenuTrigger = hasPrefix && lowerCommandText === "menu";
    const isOwnerTrigger = hasPrefix && lowerCommandText === "owner";
    const isPaymentTrigger = hasPrefix && ["payment", "qris", "bayar"].includes(lowerCommandText);
    const isIdGrupTrigger = hasPrefix && lowerCommandText === "idgrup";
    const isKickTrigger = hasPrefix && (lowerCommandText === "kick" || lowerCommandText.startsWith("kick "));
    const isAddTrigger = hasPrefix && (lowerCommandText === "add" || lowerCommandText.startsWith("add "));
    const isCloseTrigger = hasPrefix && lowerCommandText === "close";
    const isOpenTrigger = hasPrefix && lowerCommandText === "open";
    const isOnlineTrigger = hasPrefix && lowerCommandText === "online";
    const isInfoCommand = hasPrefix && lowerCommandText.startsWith("info");
    const isOrderTrigger = hasPrefix && (lowerCommandText.startsWith("order") || lowerCommandText.startsWith("beli"));

    // Group products & compile catalog layout for potential list or dynamic catalog template variables
    let catalogText = "";
    for (const cat of db.categories) {
      const catProducts = db.products.filter((p: any) => p.category === cat.id);
      if (catProducts.length > 0) {
        catalogText += `\n🎬 *${cat.name.toUpperCase()}*\n`;
        catProducts.forEach((p: any) => {
          catalogText += `┊ ${p.name.toUpperCase()}\n`;
        });
      }
    }

    // Try to find matching command in commands db first (e.g. .list, /list, /menu, !bayar triggers)
    const matchedCommandObj = hasPrefix ? (db.commands || []).find((c: any) => {
      const triggers = c.trigger.split(",").map((t: string) => t.trim().toLowerCase());
      return triggers.includes(lowerCommandText);
    }) : null;

    const commandVars = {
      storeName: settings.storeName || "WANZZ STORE",
      ownerNumber: settings.ownerNumber || "6285712439395",
      catalog: catalogText,
      name: senderName,
    };

    // Check if command is owner-only (now allowed for Owner and Group Admins)
    const isOwnerOnlyCommand = isKickTrigger || isAddTrigger || isCloseTrigger || isOpenTrigger || isOnlineTrigger;
    let isSenderOwner = false;
    let isSenderAdmin = false;

    if (isOwnerOnlyCommand) {
      if (isSimulation) {
        const lowerSimSender = senderName.toLowerCase();
        isSenderOwner = lowerSimSender.includes("owner");
        isSenderAdmin = lowerSimSender.includes("admin");
      } else {
        const rawOwnerPhone = settings.ownerNumber || "6285712439395";
        const cleanOwnerPhone = rawOwnerPhone.replace(/[^0-9]/g, "");

        let senderPhone = "";
        if (from.endsWith("@g.us")) {
          senderPhone = rawMsg?.key?.participant ? rawMsg.key.participant.split("@")[0] : "";
        } else {
          senderPhone = from.split("@")[0];
        }
        const cleanSenderPhone = senderPhone.replace(/[^0-9]/g, "");
        isSenderOwner = cleanSenderPhone === cleanOwnerPhone;

        const isGroup = from.endsWith("@g.us");
        if (isGroup && !isSenderOwner && this.sock) {
          try {
            const metadata = await this.sock.groupMetadata(from);
            const senderJid = rawMsg?.key?.participant || "";
            const senderParticipant = metadata.participants.find((p: any) => p.id === senderJid);
            isSenderAdmin = senderParticipant?.admin !== undefined && senderParticipant?.admin !== null;
          } catch (err) {
            console.error("Error checking sender admin status:", err);
          }
        }
      }
    }

    const isAuthorized = isSenderOwner || isSenderAdmin;

    if (isOwnerOnlyCommand && !isAuthorized) {
      matchedCommand = "owner_restricted";
      statusText = "Owner Restricted Command";
      responseText = "Command Khusus Owner!";
    } else if (matchedCommandObj) {
      matchedCommand = lowerCommandText;
      statusText = `Sent ${matchedCommandObj.trigger.split(",")[0].trim()}`;
      responseText = format(matchedCommandObj.response, commandVars);
      hasImage = matchedCommandObj.mediaType === "image";
      mediaUrlToSend = matchedCommandObj.mediaUrl || "";
      mediaTypeToSend = matchedCommandObj.mediaType || "none";
    } else if (isGreeting) {
      matchedCommand = "greeting";
      statusText = "Sent Welcome";
      responseText = format(settings.welcomeTemplate, {
        name: senderName,
        storeName: settings.storeName,
      });
      if (settings.welcomeImageUrl) {
        hasImage = true;
        mediaUrlToSend = settings.welcomeImageUrl;
        mediaTypeToSend = "image";
      }
    } else if (isHideTagCommand) {
      const isGroup = from.endsWith("@g.us");
      if (isGroup) {
        matchedCommand = "hidetag";
        statusText = "Sent HideTag Message";
        let msg = "";
        if (commandText.substring(1).startsWith("\n") || commandText.substring(1).startsWith(" ")) {
          msg = commandText.substring(2).trim();
        } else {
          msg = commandText.substring(1).trim();
        }
        responseText = msg;
      } else {
        matchedCommand = "hidetag_restricted";
        statusText = "HideTag Personal Ignore";
        responseText = "";
      }
    } else if (isMenuTrigger) {
      matchedCommand = "menu";
      statusText = "Sent Menu";
      hasImage = settings.sendMenuWithImage;

      responseText = format(settings.menuTemplate, {
        storeName: settings.storeName,
        catalog: catalogText,
      });
      if (hasImage) {
        mediaUrlToSend = settings.menuImageUrl || "";
        mediaTypeToSend = "image";
      }
    } else if (isOwnerTrigger) {
      matchedCommand = "owner";
      statusText = "Sent Owner Contact";
      responseText = format(settings.ownerTemplate || "Hubungi owner kami di nomor: {ownerNumber}", {
        storeName: settings.storeName,
        ownerNumber: settings.ownerNumber || "628123456789",
      });
      if (settings.ownerImageUrl) {
        hasImage = true;
        mediaUrlToSend = settings.ownerImageUrl;
        mediaTypeToSend = "image";
      }
    } else if (isPaymentTrigger) {
      matchedCommand = "payment";
      statusText = "Sent Payment Info";
      hasImage = !!settings.paymentQrisUrl;
      responseText = format(settings.paymentTemplate || "Konfigurasi pembayaran belum diset.", {
        storeName: settings.storeName,
      });
      if (hasImage) {
        mediaUrlToSend = settings.paymentQrisUrl || "";
        mediaTypeToSend = "image";
      }
    } else if (isIdGrupTrigger) {
      matchedCommand = "idgrup";
      statusText = "Sent Group ID";
      const isGroup = from.endsWith("@g.us");
      if (isGroup) {
        responseText = `ID Grup: ${from}`;
      } else {
        responseText = "di luar grup";
      }
    } else if (isKickTrigger) {
      const isGroup = from.endsWith("@g.us");
      if (!isGroup) {
        responseText = "❌ Command ini hanya dapat digunakan di dalam grup!";
        matchedCommand = "kick_outside_group";
        statusText = "Kick Private Chat Ignored";
      } else {
        let targetJid: string | null = null;
        let targetMentionOrNum = "";

        if (isSimulation) {
          const kickArg = commandText.substring(4).trim();
          if (kickArg.startsWith("@")) {
            targetMentionOrNum = kickArg;
            const digits = kickArg.replace(/[^0-9]/g, "");
            targetJid = digits ? `${digits}@s.whatsapp.net` : "628123456789@s.whatsapp.net";
          } else if (kickArg) {
            let digits = kickArg.replace(/[^0-9]/g, "");
            if (digits.startsWith("0")) {
              digits = "62" + digits.substring(1);
            }
            targetMentionOrNum = `@${digits}`;
            targetJid = digits ? `${digits}@s.whatsapp.net` : null;
          } else {
            targetMentionOrNum = "@628123456789";
            targetJid = "628123456789@s.whatsapp.net";
          }
        } else {
          const contextInfo = rawMsg?.message?.extendedTextMessage?.contextInfo;
          const quotedParticipant = contextInfo?.participant;
          const mentionedJids = contextInfo?.mentionedJid || [];
          
          if (quotedParticipant) {
            targetJid = quotedParticipant;
            const phone = quotedParticipant.split("@")[0];
            targetMentionOrNum = `@${phone}`;
          } else if (mentionedJids.length > 0) {
            targetJid = mentionedJids[0];
            const phone = targetJid.split("@")[0];
            targetMentionOrNum = `@${phone}`;
          } else {
            const kickArg = commandText.substring(4).trim();
            let digits = kickArg.replace(/[^0-9]/g, "");
            if (digits.startsWith("0")) {
              digits = "62" + digits.substring(1);
            }
            if (digits) {
              targetJid = `${digits}@s.whatsapp.net`;
              targetMentionOrNum = `@${digits}`;
            }
          }
        }

        if (!targetJid) {
          responseText = `⚠️ *Format Kick Salah*\n\nSilakan tag/menyebut member, reply chat member, atau masukkan nomor member yang ingin dikeluarkan.\n\nContoh:\n*!kick @628123456789*\n*!kick 08123456789*`;
          matchedCommand = "kick_empty";
          statusText = "Sent Kick Usage Help";
        } else {
          // Identify bot and owner JIDs/numbers
          const rawOwnerPhone = settings.ownerNumber || "6285712439395";
          const cleanOwnerPhone = rawOwnerPhone.replace(/[^0-9]/g, "");
          const ownerId = `${cleanOwnerPhone}@s.whatsapp.net`;

          let botId = "";
          if (!isSimulation && this.sock?.user?.id) {
            botId = this.sock.user.id.split(":")[0] + "@s.whatsapp.net";
          }

          const isTargetBot = (botId && targetJid === botId) || (isSimulation && (targetMentionOrNum.toLowerCase().includes("bot") || targetJid?.includes("bot") || targetJid === `${this.sock?.user?.id?.split(":")[0]}@s.whatsapp.net`));
          const isTargetOwner = (targetJid === ownerId) || (isSimulation && (targetMentionOrNum.toLowerCase().includes("owner") || targetJid?.includes("owner")));

          if (isTargetBot) {
            responseText = "Tidak Dapat Menggunakan Fitur Tersebut Ke Nomer Bot!";
            matchedCommand = "kick_bot_self";
            statusText = "Kick Bot Attempt Blocked";
          } else if (isTargetOwner) {
            if (isSenderOwner) {
              responseText = "Tidak dapat mengeluarkan Owner (Mencoba mengeluarkan diri sendiri).";
              matchedCommand = "kick_owner_self";
              statusText = "Owner Self Kick Prevented";
            } else {
              // Admin tries to kick Owner -> Demote admin!
              if (isSimulation) {
                responseText = "⚠️ Gagal mengeluarkan Owner! Jabatan Anda sebagai Admin telah dicabut (diturunkan menjadi anggota biasa) karena mencoba mengeluarkan Owner.";
                matchedCommand = "kick_owner_demote";
                statusText = "Simulated Demotion of Sender";
              } else {
                try {
                  const senderJid = rawMsg?.key?.participant || "";
                  if (senderJid) {
                    await this.sock.groupParticipantsUpdate(from, [senderJid], "demote");
                  }
                  responseText = "⚠️ Gagal mengeluarkan Owner! Jabatan Anda sebagai Admin telah dicabut (diturunkan menjadi anggota biasa) karena mencoba mengeluarkan Owner.";
                  matchedCommand = "kick_owner_demote";
                  statusText = "Admin Demoted for Kicking Owner";
                } catch (err) {
                  console.error("Failed to demote admin trying to kick owner:", err);
                  responseText = "⚠️ Gagal mengeluarkan Owner! Jabatan Anda sebagai Admin telah dicabut (diturunkan menjadi anggota biasa) karena mencoba mengeluarkan Owner.";
                  matchedCommand = "kick_owner_demote_error";
                  statusText = "Admin Demotion Error";
                }
              }
            }
          } else if (isSimulation) {
            const lowerArg = commandText.toLowerCase();
            if (lowerArg.includes("noadmin") || lowerArg.includes("bukanadmin")) {
              responseText = `[Bot bukan admin] ${targetMentionOrNum} Tidak Dapat Di Keluarkan Dikarenakan Bot Bukan Admin Grup. Jadikan Bot Sebagai Admin Grup!`;
              statusText = "Simulated Kick Non-Admin";
              matchedCommand = "kick_bot_not_admin";
            } else if (lowerArg.includes("gagal") || lowerArg.includes("admin") || lowerArg.includes("owner")) {
              responseText = `[Gagal] ${targetMentionOrNum} Tidak Dapat Di Keluarkan!`;
              statusText = "Simulated Kick Fail";
              matchedCommand = "kick_target_is_admin";
            } else {
              responseText = `[Berhasil] ${targetMentionOrNum} Berhasil Di Keluarkan!`;
              statusText = "Simulated Kick Success";
              matchedCommand = "kick_success";
            }
          } else {
            try {
              const metadata = await this.sock.groupMetadata(from);
              const botId = this.sock.user.id.split(":")[0] + "@s.whatsapp.net";
              
              const botParticipant = metadata.participants.find((p: any) => p.id === botId);
              const targetParticipant = metadata.participants.find((p: any) => p.id === targetJid);
              
              const isBotAdmin = botParticipant?.admin !== undefined && botParticipant?.admin !== null;
              const isTargetAdmin = targetParticipant?.admin !== undefined && targetParticipant?.admin !== null;

              if (!isBotAdmin) {
                responseText = `[Bot bukan admin] ${targetMentionOrNum} Tidak Dapat Di Keluarkan Dikarenakan Bot Bukan Admin Grup. Jadikan Bot Sebagai Admin Grup!`;
                matchedCommand = "kick_bot_not_admin";
                statusText = "Kick Failed: Bot Not Admin";
              } else if (isTargetAdmin) {
                responseText = `[Gagal] ${targetMentionOrNum} Tidak Dapat Di Keluarkan!`;
                matchedCommand = "kick_target_is_admin";
                statusText = "Kick Failed: Target is Admin";
              } else {
                try {
                  await this.sock.groupParticipantsUpdate(from, [targetJid], "remove");
                  responseText = `[Berhasil] ${targetMentionOrNum} Berhasil Di Keluarkan!`;
                  matchedCommand = "kick_success";
                  statusText = `Kick Successful: ${targetJid}`;
                } catch (err) {
                  console.error("Baileys groupParticipantsUpdate remove failed:", err);
                  responseText = `[Gagal] ${targetMentionOrNum} Tidak Dapat Di Keluarkan!`;
                  matchedCommand = "kick_failed";
                  statusText = `Kick Failed: ${targetJid}`;
                }
              }
            } catch (err) {
              console.error("Failed to fetch group metadata or perform kick:", err);
              responseText = `[Gagal] ${targetMentionOrNum} Tidak Dapat Di Keluarkan!`;
              matchedCommand = "kick_error";
              statusText = `Kick Error: ${err}`;
            }
          }
        }
      }
    } else if (isAddTrigger) {
      const isGroup = from.endsWith("@g.us");
      if (!isGroup) {
        responseText = "❌ Command ini hanya dapat digunakan di dalam grup!";
        matchedCommand = "add_outside_group";
        statusText = "Add Private Chat Ignored";
      } else {
        let targetJid: string | null = null;
        let targetMentionOrNum = "";

        const addArg = commandText.substring(3).trim();
        let digits = addArg.replace(/[^0-9]/g, "");
        if (digits.startsWith("0")) {
          digits = "62" + digits.substring(1);
        }
        if (digits) {
          targetJid = `${digits}@s.whatsapp.net`;
          targetMentionOrNum = `@${digits}`;
        }

        if (!targetJid) {
          responseText = `⚠️ *Format Add Salah*\n\nSilakan masukkan nomor member yang ingin ditambahkan.\n\nContoh:\n*!add 08123456789* atau */add 628123456789*`;
          matchedCommand = "add_empty";
          statusText = "Sent Add Usage Help";
        } else {
          if (isSimulation) {
            const lowerArg = commandText.toLowerCase();
            if (lowerArg.includes("noadmin") || lowerArg.includes("bukanadmin")) {
              responseText = `[Bot bukan admin] ${targetMentionOrNum} Tidak Dapat Di Tambahkan Dikarenakan Bot Bukan Admin Grup. Jadikan Bot Sebagai Admin Grup!`;
              statusText = "Simulated Add Non-Admin";
              matchedCommand = "add_bot_not_admin";
            } else if (lowerArg.includes("gagal") || lowerArg.includes("admin") || lowerArg.includes("owner")) {
              responseText = `[Gagal] ${targetMentionOrNum} Tidak Dapat Di Tambahkan!`;
              statusText = "Simulated Add Fail";
              matchedCommand = "add_fail";
            } else {
              responseText = `[Berhasil] ${targetMentionOrNum} Berhasil Di Tambahkan!`;
              statusText = "Simulated Add Success";
              matchedCommand = "add_success";
            }
          } else {
            try {
              const metadata = await this.sock.groupMetadata(from);
              const botId = this.sock.user.id.split(":")[0] + "@s.whatsapp.net";
              
              const botParticipant = metadata.participants.find((p: any) => p.id === botId);
              const isBotAdmin = botParticipant?.admin !== undefined && botParticipant?.admin !== null;

              if (!isBotAdmin) {
                responseText = `[Bot bukan admin] ${targetMentionOrNum} Tidak Dapat Di Tambahkan Dikarenakan Bot Bukan Admin Grup. Jadikan Bot Sebagai Admin Grup!`;
                matchedCommand = "add_bot_not_admin";
                statusText = "Add Failed: Bot Not Admin";
              } else {
                try {
                  await this.sock.groupParticipantsUpdate(from, [targetJid], "add");
                  responseText = `[Berhasil] ${targetMentionOrNum} Berhasil Di Tambahkan!`;
                  matchedCommand = "add_success";
                  statusText = `Add Successful: ${targetJid}`;
                } catch (err) {
                  console.error("Baileys groupParticipantsUpdate add failed:", err);
                  responseText = `[Gagal] ${targetMentionOrNum} Tidak Dapat Di Tambahkan!`;
                  matchedCommand = "add_failed";
                  statusText = `Add Failed: ${targetJid}`;
                }
              }
            } catch (err) {
              console.error("Failed to fetch group metadata or perform add:", err);
              responseText = `[Gagal] ${targetMentionOrNum} Tidak Dapat Di Tambahkan!`;
              matchedCommand = "add_error";
              statusText = `Add Error: ${err}`;
            }
          }
        }
      }
    } else if (isCloseTrigger) {
      const isGroup = from.endsWith("@g.us");
      if (!isGroup) {
        responseText = "Command hanya berlaku di grup!";
        matchedCommand = "group_close_private";
        statusText = "Close Private Chat Ignored";
      } else {
        if (isSimulation) {
          const lowerArg = commandText.toLowerCase();
          if (lowerArg.includes("noadmin") || lowerArg.includes("bukanadmin")) {
            responseText = "Tidak Dapat Menutup/Membuka Grup Dikarenakan Bot Bukan Admin Grup. Jadikan Bot Sebagai Admin Grup!";
            statusText = "Simulated Close Non-Admin";
            matchedCommand = "close_bot_not_admin";
          } else if (lowerArg.includes("gagal")) {
            responseText = "Tidak Dapat Menutup/Membuka Grup Dikarenakan Bot Bukan Admin Grup. Jadikan Bot Sebagai Admin Grup!";
            statusText = "Simulated Close Fail";
            matchedCommand = "close_fail";
          } else {
            responseText = "Grup di tutup, grup akan di buka kembali segera.";
            statusText = "Simulated Close Success";
            matchedCommand = "close_success";
          }
        } else {
          try {
            const metadata = await this.sock.groupMetadata(from);
            const botId = this.sock.user.id.split(":")[0] + "@s.whatsapp.net";
            const botParticipant = metadata.participants.find((p: any) => p.id === botId);
            const isBotAdmin = botParticipant?.admin !== undefined && botParticipant?.admin !== null;

            if (!isBotAdmin) {
              responseText = "Tidak Dapat Menutup/Membuka Grup Dikarenakan Bot Bukan Admin Grup. Jadikan Bot Sebagai Admin Grup!";
              matchedCommand = "close_bot_not_admin";
              statusText = "Close Failed: Bot Not Admin";
            } else {
              try {
                await this.sock.groupSettingUpdate(from, "announcement");
                responseText = "Grup di tutup, grup akan di buka kembali segera.";
                matchedCommand = "close_success";
                statusText = "Close Group Success";
              } catch (err) {
                console.error("Baileys groupSettingUpdate close failed:", err);
                responseText = "Tidak Dapat Menutup/Membuka Grup Dikarenakan Bot Bukan Admin Grup. Jadikan Bot Sebagai Admin Grup!";
                matchedCommand = "close_failed";
                statusText = "Close Group Failed";
              }
            }
          } catch (err) {
            console.error("Failed to fetch group metadata or perform close:", err);
            responseText = "Tidak Dapat Menutup/Membuka Grup Dikarenakan Bot Bukan Admin Grup. Jadikan Bot Sebagai Admin Grup!";
            matchedCommand = "close_error";
            statusText = "Close Group Error";
          }
        }
      }
    } else if (isOpenTrigger) {
      const isGroup = from.endsWith("@g.us");
      if (!isGroup) {
        responseText = "Command hanya berlaku di grup!";
        matchedCommand = "group_open_private";
        statusText = "Open Private Chat Ignored";
      } else {
        const idTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
        const hour = new Date(idTime).getHours();
        let timeGreeting = "malam";
        if (hour >= 4 && hour < 10) {
          timeGreeting = "pagi";
        } else if (hour >= 10 && hour < 15) {
          timeGreeting = "siang";
        } else if (hour >= 15 && hour < 18) {
          timeGreeting = "sore";
        }

        const openResponseMsg = `Selamat ${timeGreeting}, grup telah di buka kembali, silahkan bertransaksi dengan bijak`;

        if (isSimulation) {
          const lowerArg = commandText.toLowerCase();
          if (lowerArg.includes("noadmin") || lowerArg.includes("bukanadmin")) {
            responseText = "Tidak Dapat Menutup/Membuka Grup Dikarenakan Bot Bukan Admin Grup. Jadikan Bot Sebagai Admin Grup!";
            statusText = "Simulated Open Non-Admin";
            matchedCommand = "open_bot_not_admin";
          } else {
            responseText = openResponseMsg;
            statusText = "Simulated Open Success";
            matchedCommand = "open_success";
          }
        } else {
          try {
            const metadata = await this.sock.groupMetadata(from);
            const botId = this.sock.user.id.split(":")[0] + "@s.whatsapp.net";
            const botParticipant = metadata.participants.find((p: any) => p.id === botId);
            const isBotAdmin = botParticipant?.admin !== undefined && botParticipant?.admin !== null;

            if (!isBotAdmin) {
              responseText = "Tidak Dapat Menutup/Membuka Grup Dikarenakan Bot Bukan Admin Grup. Jadikan Bot Sebagai Admin Grup!";
              matchedCommand = "open_bot_not_admin";
              statusText = "Open Failed: Bot Not Admin";
            } else {
              try {
                await this.sock.groupSettingUpdate(from, "not_announcement");
                responseText = openResponseMsg;
                matchedCommand = "open_success";
                statusText = "Open Group Success";
              } catch (err) {
                console.error("Baileys groupSettingUpdate open failed:", err);
                responseText = "Tidak Dapat Menutup/Membuka Grup Dikarenakan Bot Bukan Admin Grup. Jadikan Bot Sebagai Admin Grup!";
                matchedCommand = "open_failed";
                statusText = "Open Group Failed";
              }
            }
          } catch (err) {
            console.error("Failed to fetch group metadata or perform open:", err);
            responseText = "Tidak Dapat Menutup/Membuka Grup Dikarenakan Bot Bukan Admin Grup. Jadikan Bot Sebagai Admin Grup!";
            matchedCommand = "open_error";
            statusText = "Open Group Error";
          }
        }
      }
    } else if (isOnlineTrigger) {
      const isGroup = from.endsWith("@g.us");
      if (!isGroup) {
        responseText = "Command hanya berlaku di grup!";
        matchedCommand = "group_online_private";
        statusText = "Online Private Chat Ignored";
      } else {
        matchedCommand = "online";
        statusText = "Sent Group Online Status";
        if (isSimulation) {
          responseText = `🟢 *ANGGOTA ONLINE (SIMULATION)*\n\nTerdapat *3* anggota yang sedang online:\n1. @628123456789 (Ahmad)\n2. @628987654321 (Budi)\n3. @628555555555 (Siti)\n\n_Silakan bertransaksi dengan aman!_`;
        } else {
          try {
            const onlineSet = this.presencesMap[from];
            if (!onlineSet || onlineSet.size === 0) {
              const cleanSenderName = senderName || "Pelanggan";
              const cleanSenderPhone = from.split("@")[0];
              responseText = `🟢 *ANGGOTA ONLINE*\n\nTerdapat *1* anggota yang terdeteksi aktif/online saat ini:\n1. @${cleanSenderPhone} (${cleanSenderName})\n\n_Catatan: Anggota lain akan terdeteksi online saat mereka mengirim pesan atau aktif mengetik._`;
            } else {
              const membersList = Array.from(onlineSet);
              let listStr = "";
              membersList.forEach((mJid, idx) => {
                const phone = mJid.split("@")[0];
                listStr += `${idx + 1}. @${phone}\n`;
              });
              responseText = `🟢 *ANGGOTA ONLINE*\n\nTerdapat *${membersList.length}* anggota yang aktif/online baru-baru ini:\n\n${listStr}\n_Silakan bertransaksi dengan aman!_`;
            }
          } catch (err) {
            console.error("Failed to compile online state:", err);
            responseText = "⚠️ Gagal mengambil daftar anggota online.";
          }
        }
      }
    } else if (isOrderTrigger) {
      let orderProductKey = "";
      if (lowerCommandText.startsWith("order")) {
        orderProductKey = commandText.substring(5).trim().toLowerCase();
      } else if (lowerCommandText.startsWith("beli")) {
        orderProductKey = commandText.substring(4).trim().toLowerCase();
      }

      if (!orderProductKey) {
        matchedCommand = "order_empty";
        statusText = "Sent Order Help";
        responseText = `⚠️ *Format Pemesanan Salah*\n\nSilakan masukkan nama produk yang ingin Anda beli.\n\nContoh:\n*!order NETFLIX* atau */beli YT PREMIUM*`;
      } else {
        let matchedProduct: any = null;
        let matchedVariant: any = null;

        // 1. Try to find if orderProductKey directly matches a variant's ID, Name, or Alternative Commands (case-insensitive) for exact matches
        for (const p of db.products) {
          if (p.variants && p.variants.length > 0) {
            const v = p.variants.find((v: any) => {
              const idL = v.id.toLowerCase();
              const nameL = v.name.toLowerCase();
              const parentL = p.name.toLowerCase();
              const combinedL = `${parentL} ${nameL}`;
              const combinedL2 = `${parentL} - ${nameL}`;
              const matchAlt = v.alternativeCommands && Array.isArray(v.alternativeCommands)
                ? v.alternativeCommands.some((cmd: string) => cmd.trim().toLowerCase() === orderProductKey.trim().toLowerCase())
                : false;
              return idL === orderProductKey || 
                     nameL === orderProductKey || 
                     combinedL === orderProductKey || 
                     combinedL2 === orderProductKey ||
                     matchAlt;
            });
            if (v) {
              matchedProduct = p;
              matchedVariant = v;
              break;
            }
          }
        }

        // 2. Clear & resilient token-based fuzzy matching
        if (!matchedProduct) {
          const normalizeString = (str: string) => {
            return str
              .toLowerCase()
              .replace(/[^a-z0-9]/g, " ")
              .replace(/\b3bu\b/g, " 3 bulan buyer ")
              .replace(/\b1bu\b/g, " 1 bulan buyer ")
              .replace(/\b3b\b|\b3bln\b|\b3bul\b/g, " 3 bulan ")
              .replace(/\b1b\b|\b1bln\b|\b1bul\b/g, " 1 bulan ")
              .replace(/\b2b\b|\b2bln\b|\b2bul\b/g, " 2 bulan ")
              .replace(/\byt\b/g, " youtube ")
              .replace(/\bnf\b/g, " netflix ")
              .replace(/\bsp\b|\bspot\b/g, " spotify ")
              .replace(/\bdis\b/g, " disney ")
              .replace(/\bml\b/g, " mobile legends ")
              .replace(/\bff\b/g, " free fire ")
              .replace(/\bprem\b/g, " premium ")
              .replace(/\bfam\b/g, " famplan ")
              .replace(/\bind\b/g, " indplan ")
              .replace(/\bse\b|\bsel\b/g, " seller ")
              .replace(/\bby\b|\bbuy\b/g, " buyer ");
          };

          const userNormalized = normalizeString(orderProductKey);
          const userTokens = userNormalized.split(/\s+/).filter(Boolean);

          if (userTokens.length > 0) {
            let bestVariant: any = null;
            let bestProduct: any = null;
            let maxMatchPct = 0;

            for (const p of db.products) {
              if (p.variants && p.variants.length > 0) {
                for (const v of p.variants) {
                  const variantNormalized = normalizeString(`${p.id} ${p.name} ${v.id} ${v.name}`);
                  
                  let matchCount = 0;
                  for (const token of userTokens) {
                    if (variantNormalized.includes(token)) {
                      matchCount++;
                    }
                  }
                  
                  const matchPct = matchCount / userTokens.length;
                  // Require at least 2 tokens matched if user typed multiple tokens to prevent single letter matches
                  const minRequiredMatches = userTokens.length >= 2 ? 2 : 1;
                  if (matchPct > maxMatchPct && matchCount >= minRequiredMatches) {
                    maxMatchPct = matchPct;
                    bestVariant = v;
                    bestProduct = p;
                  }
                }
              }
            }

            if (maxMatchPct >= 0.8) {
              matchedProduct = bestProduct;
              matchedVariant = bestVariant;
            }
          }
        }

        // 3. If no variant matched, match top-level product by Name or ID
        if (!matchedProduct) {
          matchedProduct = db.products.find((p: any) => {
            const nameLower = p.name.toLowerCase();
            const idLower = p.id.toLowerCase();
            return nameLower === orderProductKey || idLower === orderProductKey || (nameLower.includes(orderProductKey) && orderProductKey.length > 2);
          });

          // If matched a parent product and it has variants, we require a variant selection
          if (matchedProduct && matchedProduct.variants && matchedProduct.variants.length > 0) {
            matchedCommand = "order_need_variant";
            statusText = `Order Variant Needed: ${matchedProduct.name}`;
            responseText = `harap pilih varian, ketik ${matchedProduct.name} untuk melihat varian!`;
            matchedProduct = null; // Prevent proceeding with generic booking
          }
        }

        if (!matchedProduct) {
          if (matchedCommand !== "order_need_variant") {
            matchedCommand = "order_not_found";
            statusText = `Order Not Found: ${orderProductKey}`;
            responseText = ""; // Silent response per user request
          }
        } else {
          const isUnknown = matchedProduct.stockType === "UNKNOWN";
          let stock = 10;
          if (matchedVariant) {
            stock = matchedVariant.stock !== undefined ? matchedVariant.stock : (matchedProduct.stock !== undefined ? matchedProduct.stock : 10);
          } else {
            stock = matchedProduct.stock !== undefined ? matchedProduct.stock : 10;
          }

          if (!isUnknown && stock <= 0) {
            const displayName = matchedVariant ? `${matchedProduct.name} (${matchedVariant.name})` : matchedProduct.name;
            matchedCommand = "order_out_of_stock";
            statusText = `Order Out of Stock: ${displayName}`;
            responseText = `⚠️ *Stok Habis*\n\nMohon maaf Kak, untuk saat ini stok produk *${displayName}* sedang kosong.\n\nSilakan tanyakan kepada admin (+${settings.ownerNumber || "6285712439395"}) kapan produk ini restock. Terimakasih! 🙏`;
          } else {
            // No automated stock deduction or database saving in db.transactions!
            // Format ORD-DDMMYYYY-HHMM-RANDOM to embed date & time
            const now = new Date();
            const targetTimezoneOffset = 7; // WIB (UTC+7)
            const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
            const jakartaTime = new Date(utcTime + (3600000 * targetTimezoneOffset));

            const dayStr = String(jakartaTime.getDate()).padStart(2, '0');
            const monthStr = String(jakartaTime.getMonth() + 1).padStart(2, '0');
            const yearStr = String(jakartaTime.getFullYear());
            const hourStr = String(jakartaTime.getHours()).padStart(2, '0');
            const minuteStr = String(jakartaTime.getMinutes()).padStart(2, '0');
            const randStr = Math.floor(1000 + Math.random() * 9000);

            // Place verification random code at the beginning
            const orderId = `ORD-${randStr}-${dayStr}${monthStr}${yearStr}-${hourStr}${minuteStr}`;

            // Save the transaction to database
            let participantJid = rawMsg?.key?.participant || rawMsg?.participant || "";
            if (!participantJid || participantJid.endsWith("@g.us")) {
              if (from.endsWith("@g.us")) {
                participantJid = settings.ownerNumber ? `${settings.ownerNumber.replace(/[^0-9]/g, "")}@s.whatsapp.net` : "6285712439395@s.whatsapp.net";
              } else {
                participantJid = from;
              }
            }
            const buyerPhoneNum = participantJid.split("@")[0] || "";

            const resolvedPrice = matchedVariant ? (matchedVariant.price || 0) : (matchedProduct.price || 0);
            const resolvedOriginalPrice = matchedVariant ? (matchedVariant.originalPrice || matchedVariant.price || 0) : (matchedProduct.price || 0);
            const resolvedName = matchedVariant ? `${matchedProduct.name} - ${matchedVariant.name}` : matchedProduct.name;
            const resolvedProdId = matchedVariant ? matchedVariant.id : matchedProduct.id;

            const newTx = {
              id: orderId,
              customerName: senderName || "Pelanggan Terdaftar",
              customerPhone: buyerPhoneNum,
              productId: resolvedProdId,
              productName: resolvedName,
              quantity: 1,
              totalPrice: resolvedPrice,
              originalPrice: resolvedOriginalPrice,
              sellingPrice: resolvedPrice,
              paymentMethod: "QRIS",
              buyerPhone: buyerPhoneNum,
              status: "Pending",
              timestamp: now.toISOString()
            };

            db.transactions = [newTx, ...(db.transactions || [])];
            this.saveDb(db);

            matchedCommand = "order_success";
            statusText = `Order Successful: ${orderId}`;
            
            const defaultOrderSuccessTemplate = "╭━━━〔 🛒 ORDER BERHASIL 〕━━━╮\n■ *No. Order:* #{orderId}\n■ *Produk:* {productName}\n■ *Harga:* {price}\n■ *Status:* Menunggu Pembayaran\n■ *Nama:* {name}\n━━━━━━━━━━━━━━━━━━\n\n{paymentTemplate}\n\n━━━━━━━━━━━━━━━━━━\n📌 *Kirim bukti transfer ke WhatsApp Owner (+{ownerNumber}) dan sebutkan No Order Anda untuk verifikasi instan!*\n╰━━━━━━━━━━━━━━━━━━━━━━╯";
            const currentTemplate = settings.orderSuccessTemplate || defaultOrderSuccessTemplate;
            
            responseText = currentTemplate
              .replace(/{orderId}/g, orderId)
              .replace(/{productName}/g, resolvedName)
              .replace(/{price}/g, `Rp${resolvedPrice.toLocaleString("id-ID")}`)
              .replace(/{name}/g, senderName)
              .replace(/{paymentTemplate}/g, settings.paymentTemplate || "Konfigurasi pembayaran belum diset.")
              .replace(/{ownerNumber}/g, settings.ownerNumber || "6285712439395");

            if (settings.orderSuccessImageUrl) {
              hasImage = true;
              mediaUrlToSend = settings.orderSuccessImageUrl;
              mediaTypeToSend = "image";
            }
          }
        }
      }
    } else {
      // Check if user specifically searched inside info command e.g., "/info DISNEY"
      let productSearchKey = "";
      if (isInfoCommand) {
        productSearchKey = commandText.substring(4).trim().toLowerCase();
      } else {
        // Direct matching e.g., check if the text is exactly a product name/ID (case-insensitive)
        productSearchKey = lowerText;
      }

      // Exact or partial name matching in products
      const matchedProduct = db.products.find((p: any) => {
        const nameLower = p.name.toLowerCase();
        const idLower = p.id.toLowerCase();
        return nameLower === productSearchKey || idLower === productSearchKey || nameLower.includes(productSearchKey) && productSearchKey.length > 2;
      });

      if (matchedProduct) {
        matchedCommand = `info:${matchedProduct.id}`;
        statusText = `Sent Info ${matchedProduct.name}`;
        
        // Find category name
        const catObj = db.categories.find((c: any) => c.id === matchedProduct.category);
        const catName = catObj ? catObj.name : "Other Services";

        // Increment product search statistic
        matchedProduct.searchCount = (matchedProduct.searchCount || 0) + 1;
        this.saveDb(db);

        let detailsText = "";
        if (matchedProduct.variants && matchedProduct.variants.length > 0) {
          detailsText += `PILIHAN / VARIAN LAYANAN:`;
          
          const categoriesList = matchedProduct.variantCategories || [];
          const usedCategories = Array.from(new Set(
            matchedProduct.variants
              .map((v: any) => v.variantCategory)
              .filter((cat: any) => cat)
          )) as string[];

          const allCategories = [...categoriesList];
          usedCategories.forEach(cat => {
            if (!allCategories.includes(cat)) {
              allCategories.push(cat);
            }
          });

          const grouped: Record<string, any[]> = {};
          allCategories.forEach(cat => {
            grouped[cat] = [];
          });
          const uncategorized: any[] = [];

          matchedProduct.variants.forEach((v: any) => {
            if (v.variantCategory) {
              if (!grouped[v.variantCategory]) {
                grouped[v.variantCategory] = [];
              }
              grouped[v.variantCategory].push(v);
            } else {
              uncategorized.push(v);
            }
          });

          // Print categorized categories
          allCategories.forEach(cat => {
            const list = grouped[cat] || [];
            if (list.length > 0) {
              detailsText += `\n${cat.toUpperCase()}\n`;
              list.forEach((v: any) => {
                const subName = v.name;
                const displayName = subName.toLowerCase().includes(matchedProduct.name.toLowerCase())
                  ? subName
                  : `${matchedProduct.name} ${subName}`;
                detailsText += `📍\n└ ${displayName} : Rp${v.price.toLocaleString("id-ID")}\n`;
              });
            }
          });

          // Print any uncategorized variants
          if (uncategorized.length > 0) {
            detailsText += `\nLAINNYA\n`;
            uncategorized.forEach((v: any) => {
              const subName = v.name;
              const displayName = subName.toLowerCase().includes(matchedProduct.name.toLowerCase())
                ? subName
                : `${matchedProduct.name} ${subName}`;
              detailsText += `📍\n└ ${displayName} : Rp${v.price.toLocaleString("id-ID")}\n`;
            });
          }
        }

        if (matchedProduct.details) {
          if (detailsText) {
            detailsText += `\n\n${matchedProduct.details}`;
          } else {
            detailsText = matchedProduct.details;
          }
        }

        const priceStr = matchedProduct.variants && matchedProduct.variants.length > 0
          ? `Mulai Rp${Math.min(...matchedProduct.variants.map((v: any) => v.price || 0)).toLocaleString("id-ID")}`
          : (matchedProduct.price ? `Rp${matchedProduct.price.toLocaleString("id-ID")}` : "Free / Hubungi Admin");

        const stockStr = matchedProduct.stockType === "UNKNOWN"
          ? "Tersedia (Ready)"
          : (matchedProduct.stock !== undefined ? matchedProduct.stock : 10) > 0 
            ? `${matchedProduct.stock !== undefined ? matchedProduct.stock : 10} unit` 
            : "Habis";

        const templateToUse = (settings.infoTemplate || "").replace(/\/menu/g, "/list");
        responseText = format(templateToUse, {
          productName: matchedProduct.name,
          categoryName: catName,
          details: detailsText,
          storeName: settings.storeName,
          price: priceStr,
          stock: stockStr,
        });

        const infoImage = matchedProduct.image || settings.infoImageUrl;
        if (infoImage) {
          hasImage = true;
          mediaUrlToSend = infoImage;
          mediaTypeToSend = "image";
        }
      }
    }

    if (!responseText && matchedCommand === "none") {
      // Per user request, if command is not available or product name is not available, the bot remains silent.
      matchedCommand = "none";
      statusText = "Ignored (No Match)";
      responseText = "";
    }

    // Apply strict group whitelist restriction unless it is a product order command
    const isGroup = from.endsWith("@g.us");
    if (isGroup) {
      const whitelistedGroups = settings.whitelistedGroups || ["120363425916568709@g.us"];
      const isTargetGroup = whitelistedGroups.includes(from);
      if (!isTargetGroup && matchedCommand !== "none" && !isOrderTrigger) {
        matchedCommand = "restricted";
        statusText = "Rejected Group";
        hasImage = false;
        responseText = `Bot tidak dapat di gunakan pada grup ini, silahkan bergabung ke grup resmi Wanzt Store:\n\nhttps://chat.whatsapp.com/K9MGibqDNqrI0MfmuAjjM8`;
      }
    }

    // 3. Dispatch response through WhatsApp (if connected and NOT simulation)
    if (!isSimulation && responseText && this.sock && this.status === "connected") {
      try {
        const sendWithImageCheck = async (imageUrl: string, captionText: string) => {
          if (imageUrl.startsWith("data:")) {
            const matched = imageUrl.match(/^data:image\/([a-zA-Z0-9+-\/]+);base64,(.+)$/);
            if (matched) {
              const mime = matched[1];
              const base64Content = matched[2];
              const buffer = Buffer.from(base64Content, "base64");
              await this.sock.sendMessage(from, {
                image: buffer,
                caption: captionText,
                mimetype: mime || "image/png"
              });
              return true;
            }
          } else if (imageUrl) {
            await this.sock.sendMessage(from, {
              image: { url: imageUrl },
              caption: captionText,
            });
            return true;
          }
          return false;
        };

        // Try finding matching command in custom commands list to inspect if it contains photo or video
        const customCommandObj = (db.commands || []).find((c: any) => {
          const triggers = c.trigger.split(",").map((t: string) => t.trim().toLowerCase());
          return triggers.includes(matchedCommand);
        });
        if (customCommandObj && customCommandObj.mediaType && customCommandObj.mediaType !== "none" && customCommandObj.mediaUrl) {
          const mediaUrl = customCommandObj.mediaUrl;
          const mediaType = customCommandObj.mediaType;
          const isBase64 = mediaUrl.startsWith("data:");
          let mediaBuffer: Buffer | null = null;
          let mime = "";

          if (isBase64) {
            const matched = mediaUrl.match(/^data:([a-zA-Z0-9-\/]+);base64,(.+)$/);
            if (matched) {
              mime = matched[1];
              mediaBuffer = Buffer.from(matched[2], "base64");
            }
          }

          if (mediaType === "image") {
            if (mediaBuffer) {
              await this.sock.sendMessage(from, {
                image: mediaBuffer,
                caption: responseText,
                mimetype: mime || "image/png"
              });
            } else {
              await this.sock.sendMessage(from, {
                image: { url: mediaUrl },
                caption: responseText,
              });
            }
          } else if (mediaType === "video") {
            if (mediaBuffer) {
              await this.sock.sendMessage(from, {
                video: mediaBuffer,
                caption: responseText,
                mimetype: mime || "video/mp4"
              });
            } else {
              await this.sock.sendMessage(from, {
                video: { url: mediaUrl },
                caption: responseText,
              });
            }
          }
        } else if (matchedCommand === "menu" && settings.sendMenuWithImage && settings.menuImageUrl) {
          // Send image with menu caption
          await this.sock.sendMessage(from, {
            image: { url: settings.menuImageUrl },
            caption: responseText,
          });
        } else if (matchedCommand === "payment" && settings.paymentQrisUrl) {
          const qrisUrl = settings.paymentQrisUrl;
          if (qrisUrl.startsWith("data:")) {
            const matched = qrisUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
            if (matched) {
              const mime = matched[1];
              const base64Content = matched[2];
              const buffer = Buffer.from(base64Content, "base64");
              await this.sock.sendMessage(from, {
                image: buffer,
                caption: responseText,
                mimetype: `image/${mime}`
              });
            } else {
              await this.sock.sendMessage(from, { text: responseText });
            }
          } else {
            await this.sock.sendMessage(from, {
              image: { url: qrisUrl },
              caption: responseText,
            });
          }
        } else if (matchedCommand === "greeting" && settings.welcomeImageUrl) {
          const sent = await sendWithImageCheck(settings.welcomeImageUrl, responseText);
          if (!sent) await this.sock.sendMessage(from, { text: responseText });
        } else if (matchedCommand === "owner" && settings.ownerImageUrl) {
          const sent = await sendWithImageCheck(settings.ownerImageUrl, responseText);
          if (!sent) await this.sock.sendMessage(from, { text: responseText });
        } else if (matchedCommand === "order_success" && settings.orderSuccessImageUrl) {
          const sent = await sendWithImageCheck(settings.orderSuccessImageUrl, responseText);
          if (!sent) await this.sock.sendMessage(from, { text: responseText });
        } else if (matchedCommand === "fallback" && settings.fallbackImageUrl) {
          const sent = await sendWithImageCheck(settings.fallbackImageUrl, responseText);
          if (!sent) await this.sock.sendMessage(from, { text: responseText });
        } else if (matchedCommand && matchedCommand.startsWith("info:")) {
          const prodId = matchedCommand.split(":")[1];
          const productObj = db.products.find((p: any) => p.id === prodId);
          const infoImage = (productObj && productObj.image) || settings.infoImageUrl;
          if (infoImage) {
            const sent = await sendWithImageCheck(infoImage, responseText);
            if (!sent) await this.sock.sendMessage(from, { text: responseText });
          } else {
            await this.sock.sendMessage(from, { text: responseText });
          }
        } else if (matchedCommand === "hidetag") {
          let mentions: string[] = [];
          try {
            const groupMetadata = await this.sock.groupMetadata(from);
            if (groupMetadata && groupMetadata.participants) {
              mentions = groupMetadata.participants.map((p: any) => p.id);
            }
          } catch (err) {
            console.error("Error fetching group participants for hidetag:", err);
          }
          await this.sock.sendMessage(from, { text: responseText, mentions });

        } else if (matchedCommand.startsWith("kick") || matchedCommand.startsWith("add")) {
          const mentions: string[] = [];
          const matches = responseText.match(/@\d+/g);
          if (matches) {
            for (const match of matches) {
              const phone = match.substring(1);
              mentions.push(`${phone}@s.whatsapp.net`);
            }
          }
          await this.sock.sendMessage(from, { text: responseText, mentions });
        } else {
          // General text message
          await this.sock.sendMessage(from, { text: responseText });
        }

        // Add to log
        this.addLog({
          from,
          senderName: this.pushName,
          message: responseText,
          type: "outgoing",
          status: statusText,
        });

      } catch (err) {
        console.error("Error sending WhatsApp message:", err);
        // Fallback send text if media fails
        try {
          await this.sock.sendMessage(from, { text: responseText });
          this.addLog({
            from,
            senderName: this.pushName,
            message: responseText,
            type: "outgoing",
            status: `${statusText} (Text Fallback)`,
          });
        } catch (subErr) {
          console.error("Even text fallback failed:", subErr);
        }
      }
    }

    // Return metrics for UI simulation
    return {
      response: responseText,
      command: matchedCommand,
      status: statusText,
      hasImage,
      mediaUrl: mediaUrlToSend,
      mediaType: mediaTypeToSend,
    };
  }
}

const botManager = new WhatsAppBotManager();

// On server start, auto boot connection if authorization file credentials exist
if (fs.existsSync(path.join(AUTH_DIR, "creds.json"))) {
  console.log("Found existing credentials in", AUTH_DIR, "reconnecting automatically...");
  botManager.initialize();
}

// ---------------- API ENDPOINTS ----------------

// Get Bot Status
app.get("/api/status", (req, res) => {
  res.json({
    status: botManager.status,
    qrCode: botManager.qrCode,
    pairingCode: botManager.pairingCode,
    phoneNumber: botManager.phoneNumber,
    pushName: botManager.pushName,
    error: botManager.error,
    isFirebaseEnabled: isFirebaseEnabled(),
  });
});

// Trigger connection (QR mode or Pairing code mode)
app.post("/api/connect", (req, res) => {
  const { phoneNumber } = req.body;
  botManager.initialize(phoneNumber);
  res.json({ success: true, message: "Koneksi bot berhasil diinisialisasi" });
});

// Disconnect bot
app.post("/api/disconnect", async (req, res) => {
  await botManager.disconnect();
  res.json({ success: true, message: "WhatsApp ditiadakan & session di-reset" });
});

// Fetch Database
app.get("/api/database", (req, res) => {
  res.json(botManager.getDb());
});

// Save Database changes
app.post("/api/database", (req, res) => {
  const success = botManager.saveDb(req.body);
  if (success) {
    res.json({ success: true, message: "Database berhasil diperbarui dan disimpan" });
  } else {
    res.status(500).json({ success: false, error: "Gagal menyimpan database" });
  }
});

// Get Message Logs
app.get("/api/logs", (req, res) => {
  res.json(botManager.logs);
});

// Send Message (manual/broadcast)
app.post("/api/send-message", async (req, res) => {
  const { to, text, mediaUrl, mediaType } = req.body;
  if (!to || !text) {
    return res.status(400).json({ error: "Nomor tujuan (to) dan isi pesan (text) wajib diisi" });
  }

  // Ensure bot is initialized and sock exists
  if (!botManager.sock) {
    return res.status(400).json({ error: "WhatsApp belum terhubung. Silakan hubungkan bot terlebih dahulu di tab status." });
  }

  try {
    let jid = to.trim();
    if (!jid.endsWith("@s.whatsapp.net") && !jid.endsWith("@g.us")) {
      let clean = jid.replace(/[^0-9]/g, "");
      if (clean.length > 14) {
        const resolved = resolveLidToPn(`${clean}@lid`);
        jid = resolved.endsWith("@lid") ? `${clean}@s.whatsapp.net` : resolved;
      } else {
        if (clean.startsWith("0")) {
          clean = "62" + clean.slice(1);
        } else if (clean.startsWith("8")) {
          clean = "62" + clean;
        }
        jid = `${clean}@s.whatsapp.net`;
      }
    }

    if (mediaUrl && (mediaType === "image" || mediaType === "video")) {
      const isBase64 = mediaUrl.startsWith("data:");
      if (isBase64) {
        const matched = mediaUrl.match(/^data:([a-zA-Z0-9-\/]+);base64,(.+)$/) || mediaUrl.match(/^data:image\/([a-zA-Z0-9+-\/]+);base64,(.+)$/);
        if (matched) {
          const mime = matched[1];
          const base64Content = matched[2];
          const buffer = Buffer.from(base64Content, "base64");
          await botManager.sock.sendMessage(jid, {
            [mediaType]: buffer,
            caption: text,
            mimetype: mime || (mediaType === "image" ? "image/png" : "video/mp4")
          });
        } else {
          await botManager.sock.sendMessage(jid, {
            [mediaType]: { url: mediaUrl },
            caption: text
          });
        }
      } else {
        await botManager.sock.sendMessage(jid, {
          [mediaType]: { url: mediaUrl },
          caption: text
        });
      }
    } else {
      await botManager.sock.sendMessage(jid, { text });
    }

    botManager.addLog({
      from: "Broadcast manual",
      senderName: botManager.pushName || "WANZZ BOT",
      message: `${text}${mediaUrl ? `\n[Media: ${mediaUrl}]` : ""}`,
      type: "outgoing",
      status: "Berhasil",
    });

    res.json({ success: true, message: "Pesan berhasil dikirim" });
  } catch (err: any) {
    console.error("Gagal mengirim pesan manual:", err);
    res.status(500).json({ error: err.message || "Gagal mengirim pesan" });
  }
});

// Clear Logs
app.post("/api/logs/clear", (req, res) => {
  botManager.logs = [];
  res.json({ success: true });
});

// Simulate receiving/answering a command to test without real phone link
app.post("/api/simulate", async (req, res) => {
  const { message, senderName, isGroup, customFrom } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Pesan tidak boleh kosong" });
  }

  const name = senderName || "Pelanggan Simulasi";
  let from = isGroup ? "120363024847291040@g.us" : "simulated-user@s.whatsapp.net";
  if (customFrom) {
    from = customFrom;
  }

  // Process simulated behavior
  const result = await botManager.handleIncomingMessage(from, message, name, true);

  // Storing simulated exchange inside in-memory logs for presentation UI
  if (result.response) {
    botManager.addLog({
      from: "Simulasi (" + name + ")",
      senderName: name,
      message: message,
      type: "incoming",
      status: "Simulated",
    });

    botManager.addLog({
      from: "Simulasi Bot",
      senderName: botManager.pushName || "WANZZ BOT",
      message: result.response,
      type: "outgoing",
      status: result.status,
    });
  }

  res.json({
    success: true,
    ...result,
  });
});

// Manual Backup to Firestore Route
app.post("/api/backup-now", async (req, res) => {
  if (!isFirebaseEnabled()) {
    return res.status(400).json({ success: false, error: "Firebase Firestore belum dikonfigurasi pada environment ini" });
  }
  try {
    const dbData = botManager.getDb();
    await syncToFirestore(dbData);
    res.json({ success: true, message: "Semua data berhasil dibackup ke Cloud Firestore!" });
  } catch (e: any) {
    console.error("[Manual Backup Error]:", e);
    res.status(500).json({ success: false, error: e.message || "Gagal melakukan backup manual ke Firestore" });
  }
});

// Vite & Static file hosting for dev / production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server WhatsApp Bot Wanzz Store berjalan di http://localhost:${PORT}`);
  });
}

startServer();
