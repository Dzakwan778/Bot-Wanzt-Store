import React, { useState, useEffect, useRef } from "react";
import { 
  Smartphone, 
  QrCode, 
  Key, 
  RefreshCw, 
  Database, 
  Settings2, 
  Terminal, 
  BookOpen, 
  Plus, 
  PlusCircle,
  Trash2, 
  Edit, 
  CheckCircle2, 
  Cloud,
  CloudOff, 
  Filter,
  Calendar, 
  XCircle, 
  AlertCircle, 
  Send, 
  Save, 
  LogOut, 
  ChevronRight, 
  Search, 
  Copy, 
  Moon, 
  FileText, 
  HelpCircle,
  Sparkles,
  Info,
  BarChart3,
  TrendingUp,
  ArrowUp,
  Zap,
  Image,
  Video,
  Film,
  Receipt,
  Download,
  Layers,
  Edit3,
  Check,
  X,
  Megaphone,
  Users,
  Play,
  Square
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, Category, BotSettings, MessageLog, ConnectionStatus, BotCommand, Transaction } from "./types";

// Helper function to dynamically parse date and time from ORD-RANDOM-DDMMYYYY-HHMM format
export const getParsedDateTime = (orderId: string, transactions?: Transaction[]) => {
  if (!orderId) return "";
  
  if (transactions) {
    const exists = transactions.some(t => t.id.trim().toUpperCase() === orderId.trim().toUpperCase());
    if (!exists) {
      return "Data tidak ditemukan";
    }
  }

  const match = orderId.toUpperCase().match(/^ORD-(\d{4})-(\d{2})(\d{2})(\d{4})-(\d{2})(\d{2})/);
  if (!match) return "Format ID kustom tidak diekstraksi otomatis";
  
  const day = match[2];
  const month = match[3];
  const year = match[4];
  const hour = match[5];
  const minute = match[6];
  
  const indonesianMonths = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const mIndex = parseInt(month, 10) - 1;
  const monthName = (mIndex >= 0 && mIndex < 12) ? indonesianMonths[mIndex] : month;
  
  return `${day} ${monthName} ${year} - Pukul ${hour}:${minute} WIB`;
};

export default function App() {
  // Tabs State
  const [activeTab, setActiveTab] = useState<"catalog" | "settings" | "commands" | "simulator" | "manual" | "stats" | "transactions">("catalog");
  
  // Bot Connection API State
  const [status, setStatus] = useState<ConnectionStatus>({ status: "disconnected" });
  const [phoneInput, setPhoneInput] = useState("");
  const [connectionType, setConnectionType] = useState<"qr" | "pairing">("qr");
  const [isInitializing, setIsInitializing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  
  // Database State
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<BotSettings>({
    storeName: "WANZZ STORE",
    menuImageUrl: "",
    sendMenuWithImage: true,
    welcomeTemplate: "",
    menuTemplate: "",
    listTemplate: "",
    infoTemplate: "",
    fallbackTemplate: "",
    ownerNumber: "",
    ownerTemplate: "",
    orderSuccessTemplate: "",
    whitelistedGroups: [],
    manualBroadcastTargets: [],
    welcomeImageUrl: "",
    infoImageUrl: "",
    fallbackImageUrl: "",
    ownerImageUrl: "",
    orderSuccessImageUrl: ""
  });
  const [initialDbLoaded, setInitialDbLoaded] = useState(false);
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [newGroupIdInput, setNewGroupIdInput] = useState("");

  // Manual Transaction Form States
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txOrderId, setTxOrderId] = useState("");
  const [txProductId, setTxProductId] = useState("");
  const [txVariantId, setTxVariantId] = useState("");
  const [txProductName, setTxProductName] = useState("");
  const [txOriginalPrice, setTxOriginalPrice] = useState<number>(0);
  const [txSellingPrice, setTxSellingPrice] = useState<number>(0);
  const [txQuantity, setTxQuantity] = useState<number>(1);
  const [txPaymentMethod, setTxPaymentMethod] = useState("QRIS"); // QRIS, Dana, Gopay
  const [txBuyerPhone, setTxBuyerPhone] = useState("");
  const [txStatus, setTxStatus] = useState<'Pending' | 'Success' | 'Failed'>("Pending");

  // Payment confirmation states
  const [paymentMethodConfirmTarget, setPaymentMethodConfirmTarget] = useState<Transaction | null>(null);
  const [confirmPaymentMethodVal, setConfirmPaymentMethodVal] = useState<string>("QRIS");

  // Filter & bulk management states for Transactions
  const [txStartDate, setTxStartDate] = useState("");
  const [txEndDate, setTxEndDate] = useState("");
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);

  // Bulk Product selection & category update states
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkTargetCategory, setBulkTargetCategory] = useState<string>("");

  // WhatsApp Broadcast Feature States
  const [broadcastMessage, setBroadcastMessage] = useState<string>("");
  const [broadcastMediaUrl, setBroadcastMediaUrl] = useState<string>("");
  const [broadcastMediaType, setBroadcastMediaType] = useState<"none" | "image" | "video">("none");
  const [broadcastDelay, setBroadcastDelay] = useState<number>(3);
  const [broadcastUploadError, setBroadcastUploadError] = useState<string | null>(null);
  const [broadcastUploadLoading, setBroadcastUploadLoading] = useState<boolean>(false);
  const [selectedBroadcastPhones, setSelectedBroadcastPhones] = useState<string[]>([]);
  const [broadcastSearchQuery, setBroadcastSearchQuery] = useState<string>("");
  const [showManualTargetForm, setShowManualTargetForm] = useState<boolean>(false);
  const [manualTargetName, setManualTargetName] = useState<string>("");
  const [manualTargetPhone, setManualTargetPhone] = useState<string>("");
  const [manualTargetError, setManualTargetError] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [broadcastProgress, setBroadcastProgress] = useState<{
    current: number;
    total: number;
    target: string;
    status: "idle" | "sending" | "success" | "error" | "aborted";
  }>({
    current: 0,
    total: 0,
    target: "",
    status: "idle"
  });
  const [broadcastLogs, setBroadcastLogs] = useState<Array<{
    phone: string;
    name: string;
    status: "success" | "failed";
    error?: string;
    time: string;
  }>>([]);

  // Stats States
  const [statsSearchQuery, setStatsSearchQuery] = useState("");
  const [statsSortField, setStatsSortField] = useState<"searches" | "name" | "category">("searches");
  const [statsSortDirection, setStatsSortDirection] = useState<"asc" | "desc">("desc");

  // Commands Editor Form States
  const [editingCommand, setEditingCommand] = useState<BotCommand | null>(null);
  const [isAddingCommand, setIsAddingCommand] = useState(false);
  const [commandTrigger, setCommandTrigger] = useState("");
  const [commandResponse, setCommandResponse] = useState("");
  const [commandDescription, setCommandDescription] = useState("");
  const [commandMediaType, setCommandMediaType] = useState<"none" | "image" | "video">("none");
  const [commandMediaUrl, setCommandMediaUrl] = useState("");
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [mediaUploadLoading, setMediaUploadLoading] = useState(false);

  // Custom Confirmation Modal State (Handles iframe limits)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText: string;
    cancelText: string;
    type: "danger" | "warning" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    confirmText: "Ya, Lanjutkan",
    cancelText: "Batal",
    type: "warning"
  });

  const triggerConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = "Ya, Lanjutkan",
    cancelText = "Batal",
    type: "danger" | "warning" | "info" = "warning"
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
      confirmText,
      cancelText,
      type
    });
  };

  // Reset Stats function
  const handleResetStats = () => {
    triggerConfirm(
      "Reset Statistik",
      "Apakah Anda yakin ingin me-reset statistik pencarian semua produk menjadi 0 kembali?",
      async () => {
        const resetProducts = products.map(p => ({ ...p, searchCount: 0 }));
        await handleSaveDb(resetProducts);
      },
      "Ya, Reset",
      "Batal",
      "danger"
    );
  };

  // Editing States
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Manual Cloud Sync & Backup States
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: 'success' | 'error' | 'idle';
    message: string;
    timestamp?: string;
  }>({
    type: 'idle',
    message: ''
  });

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    setSyncStatus({ type: 'idle', message: 'Sedang membackup seluruh data ke Cloud Firestore...' });
    try {
      const res = await fetch("/api/backup-now", {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncStatus({
          type: 'success',
          message: 'Semua data berhasil dibackup & disinkronisasikan ke Firestore Cloud secara permanen!',
          timestamp: new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        setSaveMessage({ type: "success", text: "Backup Cloud Firestore berhasil!" });
      } else {
        let errMsg = data.error || "Terjadi kesalahan saat sinkronisasi.";
        if (errMsg.includes("Quota") || errMsg.includes("exhausted") || errMsg.includes("RESOURCE_EXHAUSTED")) {
          errMsg = "Kuota Firestore harian gratis Anda telah habis (Quota Exceeded). Firestore membatasi jumlah operasi penulisan dalam satu hari pada paket gratis Spark. Data lokal Anda aman di server, namun sync ke cloud baru bisa berjalan otomatis setelah kuota di-reset besok hari oleh Firebase.";
        }
        setSyncStatus({
          type: 'error',
          message: errMsg,
          timestamp: new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        setSaveMessage({ type: "error", text: "Backup Cloud Gagal: Kuota Limit Terlampaui" });
      }
    } catch (e: any) {
      setSyncStatus({
        type: 'error',
        message: e.message || "Gagal menghubungi server untuk sinkronisasi.",
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Product Variants Editing States
  const [varId, setVarId] = useState("");
  const [varName, setVarName] = useState("");
  const [varPrice, setVarPrice] = useState<number>(0);
  const [varOriginalPrice, setVarOriginalPrice] = useState<number>(0);
  const [varStock, setVarStock] = useState<number>(10);
  const [varStockType, setVarStockType] = useState<'UNKNOWN' | 'numeric'>("numeric");
  const [editingVarIndex, setEditingVarIndex] = useState<number | null>(null);
  const [varCategory, setVarCategory] = useState("");
  const [varAlternativeCommands, setVarAlternativeCommands] = useState("");
  const [newValCategoryInput, setNewValCategoryInput] = useState("");
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState("");

  // Category Management-related States
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCatIdInput, setNewCatIdInput] = useState("");
  const [newCatNameInput, setNewCatNameInput] = useState("");

  // Message Logs State
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [isClearingLogs, setIsClearingLogs] = useState(false);

  // Live Simulation state
  const [simName, setSimName] = useState("Ahmad");
  const [simMessage, setSimMessage] = useState("");
  const [simChatScope, setSimChatScope] = useState<"whitelisted" | "other_group" | "private">("whitelisted");
  const [simExchange, setSimExchange] = useState<Array<{ sender: string; text: string; time: string; type: "user" | "bot"; imageUrl?: string; videoUrl?: string; isHidetag?: boolean; buttons?: Array<{ id: string; text: string }>; isSingleSelect?: boolean; buttonTitle?: string }>>([
    { sender: "Ahmad (Simulasi)", text: "Halo bot", time: "Baru saja", type: "user" },
    { sender: "Bot Simulasi", text: "Halo Kak Ahmad! 👋\nSelamat datang di WANZZ STORE.\nKetik /menu untuk melihat catalog.", time: "Baru saja", type: "bot" }
  ]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [openListIdx, setOpenListIdx] = useState<number | null>(null);
  const simulationEndRef = useRef<HTMLDivElement>(null);

  // Copy helper alert
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchStatus();
    fetchDatabase();
    fetchLogs();

    // Auto polling
    const statusInterval = setInterval(fetchStatus, 4000);
    const logsInterval = setInterval(fetchLogs, 5000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(logsInterval);
    };
  }, []);

  useEffect(() => {
    if (simulationEndRef.current) {
      simulationEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [simExchange]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Fetch Status from server
  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error("Gagal mengambil status bot:", e);
    }
  };

  // Fetch Database from server
  const fetchDatabase = async () => {
    try {
      const res = await fetch("/api/database");
      if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        setCategories(data.categories || []);
        setProducts(data.products || []);
        
        const loadedSettings = data.settings || {};
        const loadedCommands = data.commands || [];
        if (!loadedSettings.menuTemplate) {
          loadedSettings.menuTemplate = loadedCommands.find((c: any) => c.id === "menu")?.response || "";
        }
        if (!loadedSettings.listTemplate) {
          loadedSettings.listTemplate = loadedCommands.find((c: any) => c.id === "list")?.response || "";
        }
        
        setSettings(loadedSettings);
        setCommands(loadedCommands);
        setTransactions(data.transactions || []);
        setInitialDbLoaded(true);
      }
    } catch (e) {
      console.error("Gagal memuat database:", e);
    }
  };

  // Fetch log history
  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/logs");
      if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error("Gagal memuat log:", e);
    }
  };

  // Connect Bot WA trigger
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInitializing(true);
    try {
      const phoneParam = connectionType === "pairing" ? phoneInput : undefined;
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phoneParam })
      });
      if (res.ok) {
        // Poll status immediately
        setTimeout(fetchStatus, 1500);
      }
    } catch (e) {
      console.error("Gagal melakukan koneksi:", e);
    } finally {
      setIsInitializing(false);
    }
  };

  // Disconnect Bot WA
  const handleDisconnect = () => {
    triggerConfirm(
      "Putuskan Koneksi",
      "Apakah Anda yakin ingin memutus koneksi WhatsApp? Semua data autentikasi di server akan dihapus.",
      async () => {
        setIsDisconnecting(true);
        try {
          const res = await fetch("/api/disconnect", { method: "POST" });
          if (res.ok) {
            fetchStatus();
          }
        } catch (e) {
          console.error("Gagal disconnect:", e);
        } finally {
          setIsDisconnecting(false);
        }
      },
      "Putuskan",
      "Batal",
      "danger"
    );
  };

  // Save current database view back to file database.json
  const handleSaveDb = async (
    updatedProducts?: Product[], 
    updatedSettings?: BotSettings, 
    updatedCategories?: Category[],
    updatedCommands?: BotCommand[],
    updatedTransactions?: Transaction[]
  ) => {
    setIsSavingDb(true);
    setSaveMessage(null);
    try {
      let finalSettings = updatedSettings || settings;
      let finalCommands = updatedCommands || commands;

      // Auto-sync from settings to command objects if settings updated but commands not passed
      if (updatedSettings && !updatedCommands) {
        finalCommands = finalCommands.map(c => {
          if (c.id === "payment") {
            return {
              ...c,
              response: finalSettings.paymentTemplate || c.response,
              mediaUrl: finalSettings.paymentQrisUrl || c.mediaUrl,
              mediaType: finalSettings.paymentQrisUrl ? "image" : c.mediaType
            };
          }
          if (c.id === "menu") {
            return {
              ...c,
              response: finalSettings.menuTemplate || c.response,
              mediaUrl: finalSettings.sendMenuWithImage ? finalSettings.menuImageUrl || c.mediaUrl : "",
              mediaType: finalSettings.sendMenuWithImage && finalSettings.menuImageUrl ? "image" : "none"
            };
          }
          if (c.id === "list") {
            return {
              ...c,
              response: finalSettings.listTemplate || c.response
            };
          }
          return c;
        });
      }

      // Auto-sync from commands to settings if commands updated but settings not passed
      if (updatedCommands && !updatedSettings) {
        const payCmd = updatedCommands.find(c => c.id === "payment");
        const menuCmd = updatedCommands.find(c => c.id === "menu");
        const listCmd = updatedCommands.find(c => c.id === "list");
        const syncSettings = { ...finalSettings };
        if (payCmd) {
          syncSettings.paymentQrisUrl = payCmd.mediaType === "image" ? payCmd.mediaUrl : "";
          syncSettings.paymentTemplate = payCmd.response;
        }
        if (menuCmd) {
          syncSettings.menuImageUrl = menuCmd.mediaType === "image" ? menuCmd.mediaUrl : "";
          syncSettings.sendMenuWithImage = menuCmd.mediaType === "image";
          syncSettings.menuTemplate = menuCmd.response;
        }
        if (listCmd) {
          syncSettings.listTemplate = listCmd.response;
        }
        finalSettings = syncSettings;
      }

      const payload = {
        categories: updatedCategories || categories,
        products: updatedProducts || products,
        settings: finalSettings,
        commands: finalCommands,
        transactions: updatedTransactions || transactions
      };

      const res = await fetch("/api/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSaveMessage({ type: "success", text: "Database berhasil disimpan ke file database.json" });
        if (updatedProducts) setProducts(updatedProducts);
        setSettings(finalSettings);
        if (updatedCategories) setCategories(updatedCategories);
        setCommands(finalCommands);
        if (updatedTransactions) setTransactions(updatedTransactions);
      } else {
        setSaveMessage({ type: "error", text: "Terjadi kesalahan saat menyimpan data." });
      }
    } catch (e) {
      console.error("Gagal simpan db:", e);
      setSaveMessage({ type: "error", text: "Gagal terhubung ke modul backend." });
    } finally {
      setIsSavingDb(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  // Dynamic commands handlers
  const handleAddCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandTrigger) {
      alert("Trigger command wajib diisi.");
      return;
    }

    // Parse and tokenize multiple command triggers separated by commas
    const triggerList = commandTrigger
      .split(",")
      .map(t => t.trim().replace(/^[\/\!\.]+/, "").toLowerCase())
      .filter(Boolean);

    const uniqueTriggers = Array.from(new Set(triggerList));
    if (uniqueTriggers.length === 0) {
      alert("Masukkan setidaknya satu trigger keyword yang valid.");
      return;
    }

    const commandCleanTrigger = uniqueTriggers.join(", ");

    // Check duplicate intersections with existing commands
    const duplicate = commands.find(c => {
      const existingTriggers = c.trigger.split(",").map(t => t.trim().toLowerCase());
      return existingTriggers.some(et => uniqueTriggers.includes(et));
    });

    if (duplicate) {
      alert(`Salah satu trigger sudah dipakai oleh command lain (${duplicate.trigger.split(",").map(t => "."+t.trim()).join(", ")}). Silakan gunakan kata trigger berbeda.`);
      return;
    }

    const newCmd: BotCommand = {
      id: "cmd_" + Date.now(),
      trigger: commandCleanTrigger,
      response: commandResponse,
      description: commandDescription,
      mediaType: commandMediaType,
      mediaUrl: commandMediaUrl
    };

    const updated = [...commands, newCmd];
    handleSaveDb(products, settings, categories, updated);
    
    // reset form
    setIsAddingCommand(false);
    setCommandTrigger("");
    setCommandResponse("");
    setCommandDescription("");
    setCommandMediaType("none");
    setCommandMediaUrl("");
  };

  const handleUpdateCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommand) return;

    if (!commandTrigger) {
      alert("Trigger command wajib diisi.");
      return;
    }

    // Parse and tokenize multiple command triggers separated by commas
    const triggerList = commandTrigger
      .split(",")
      .map(t => t.trim().replace(/^[\/\!\.]+/, "").toLowerCase())
      .filter(Boolean);

    const uniqueTriggers = Array.from(new Set(triggerList));
    if (uniqueTriggers.length === 0) {
      alert("Masukkan setidaknya satu trigger keyword yang valid.");
      return;
    }

    const commandCleanTrigger = uniqueTriggers.join(", ");

    // Check duplicate other than current
    const duplicate = commands.find(c => c.id !== editingCommand.id && (() => {
      const existingTriggers = c.trigger.split(",").map(t => t.trim().toLowerCase());
      return existingTriggers.some(et => uniqueTriggers.includes(et));
    })());

    if (duplicate) {
      alert(`Salah satu trigger sudah dipakai oleh command lain (${duplicate.trigger.split(",").map(t => "."+t.trim()).join(", ")}). Silakan gunakan kata trigger berbeda.`);
      return;
    }

    const updatedCmd: BotCommand = {
      ...editingCommand,
      trigger: commandCleanTrigger,
      response: commandResponse,
      description: commandDescription,
      mediaType: commandMediaType,
      mediaUrl: commandMediaUrl
    };

    const updated = commands.map(c => c.id === editingCommand.id ? updatedCmd : c);
    handleSaveDb(products, settings, categories, updated);

    // reset
    setEditingCommand(null);
    setCommandTrigger("");
    setCommandResponse("");
    setCommandDescription("");
    setCommandMediaType("none");
    setCommandMediaUrl("");
  };

  const handleDeleteCommand = (id: string, trigger: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus command ".${trigger}"?`)) {
      const updated = commands.filter(c => c.id !== id);
      handleSaveDb(products, settings, categories, updated);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      setMediaUploadError("File terlalu besar. Maksimum ukuran adalah 10MB.");
      return;
    }

    setMediaUploadLoading(true);
    setMediaUploadError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setCommandMediaUrl(base64);
      
      // Auto detect mediaType from MIME
      if (file.type.startsWith("image/")) {
        setCommandMediaType("image");
      } else if (file.type.startsWith("video/")) {
        setCommandMediaType("video");
      } else {
        setCommandMediaType("none");
      }
      setMediaUploadLoading(false);
    };

    reader.onerror = () => {
      setMediaUploadError("Gagal membaca file.");
      setMediaUploadLoading(false);
    };

    reader.readAsDataURL(file);
  };

  // Add new product
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editingProduct.id || !editingProduct.name) {
      alert("ID Produk dan Nama Produk wajib diisi.");
      return;
    }

    // Check duplicate
    const exists = products.some(p => p.id.toLowerCase() === editingProduct.id.toLowerCase());
    if (exists) {
      alert("ID Produk sudah ada di database. Silakan ganti ID produk.");
      return;
    }

    const compiledProduct = { ...editingProduct, id: editingProduct.id.toUpperCase() };
    if (compiledProduct.stockType === "UNKNOWN") {
      delete compiledProduct.stock;
    }

    const updated = [...products, compiledProduct];
    handleSaveDb(updated);
    setEditingProduct(null);
    setIsAddingNew(false);
  };

  // Save edited product details
  const handleUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const compiledProduct = { ...editingProduct };
    if (compiledProduct.stockType === "UNKNOWN") {
      delete compiledProduct.stock;
    }

    const updated = products.map(p => p.id === editingProduct.id ? compiledProduct : p);
    handleSaveDb(updated);
    setEditingProduct(null);
  };

  // Delete product
  const handleDeleteProduct = (productId: string) => {
    triggerConfirm(
      "Hapus Produk",
      `Apakah Anda yakin ingin menghapus produk "${productId}" dari katalog database?`,
      () => {
        const updated = products.filter(p => p.id !== productId);
        handleSaveDb(updated);
      },
      "Hapus",
      "Batal",
      "danger"
    );
  };

  // Add new Category
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newCatIdInput.trim().toLowerCase().replace(/\s+/g, "_");
    const cleanName = newCatNameInput.trim();

    if (!cleanId || !cleanName) {
      alert("ID Kategori dan Nama Kategori wajib diisi.");
      return;
    }

    const exists = categories.some(cat => cat.id.toLowerCase() === cleanId);
    if (exists) {
      alert("ID Kategori sudah ada. Silakan gunakan ID kategori lain.");
      return;
    }

    const newCategory: Category = {
      id: cleanId,
      name: cleanName
    };

    const updatedCategories = [...categories, newCategory];
    handleSaveDb(products, settings, updatedCategories);
    setNewCatIdInput("");
    setNewCatNameInput("");
  };

  // Delete Category
  const handleDeleteCategory = (catId: string, catName: string) => {
    const count = products.filter(p => p.category === catId).length;
    if (count > 0) {
      alert(`Kategori "${catName}" tidak dapat dihapus karena masih digunakan oleh ${count} produk. Harap pindahkan atau hapus produk tersebut terlebih dahulu.`);
      return;
    }

    triggerConfirm(
      "Hapus Kategori",
      `Apakah Anda yakin ingin menghapus kategori "${catName}"?`,
      () => {
        const updatedCategories = categories.filter(cat => cat.id !== catId);
        handleSaveDb(products, settings, updatedCategories);
      },
      "Hapus",
      "Batal",
      "danger"
    );
  };

  // Clear logs histories
  const handleClearLogs = async () => {
    setIsClearingLogs(true);
    try {
      const res = await fetch("/api/logs/clear", { method: "POST" });
      if (res.ok) {
        setLogs([]);
      }
    } catch (e) {
      console.error("Gagal bersihkan log:", e);
    } finally {
      setIsClearingLogs(false);
    }
  };

  // Extract distinct customer phone numbers from all transactions
  const customerPhones = React.useMemo(() => {
    const map = new Map<string, { name: string; transactionsCount: number; lastTxDate: string }>();
    const excluded = settings.excludedBroadcastPhones || [];
    
    transactions.forEach(tx => {
      const origPhone = (tx.buyerPhone || tx.customerPhone || "").trim();
      if (!origPhone) return;
      // Clean non-digits for grouping
      let cleanPhone = origPhone.replace(/[^0-9]/g, "");
      if (cleanPhone.startsWith("0")) {
        cleanPhone = "62" + cleanPhone.slice(1);
      } else if (cleanPhone.startsWith("8")) {
        cleanPhone = "62" + cleanPhone;
      }
      if (!cleanPhone) return;
      // Group JIDs are typically 18 digits (e.g. 120363425916568709), phone numbers are <= 14 digits (e.g. 628xxx)
      if (cleanPhone.length > 15) return;
      if (excluded.includes(cleanPhone)) return;
      
      const existingVal = map.get(cleanPhone);
      const name = tx.customerName || "Sobat " + (settings.storeName || "Pelanggan");
      const txDate = tx.timestamp || "";
      if (!existingVal) {
        map.set(cleanPhone, { name, transactionsCount: 1, lastTxDate: txDate });
      } else {
        existingVal.transactionsCount += 1;
        if (txDate > existingVal.lastTxDate) {
          existingVal.lastTxDate = txDate;
          existingVal.name = name;
        }
      }
    });

    const manualTargets = settings.manualBroadcastTargets || [];
    manualTargets.forEach(tgt => {
      let cleanPhone = tgt.phone.replace(/[^0-9]/g, "");
      if (cleanPhone.startsWith("0")) {
        cleanPhone = "62" + cleanPhone.slice(1);
      } else if (cleanPhone.startsWith("8")) {
        cleanPhone = "62" + cleanPhone;
      }
      if (!cleanPhone) return;
      if (excluded.includes(cleanPhone)) return;

      const existingVal = map.get(cleanPhone);
      if (!existingVal) {
        map.set(cleanPhone, { name: tgt.name || "Target Manual", transactionsCount: 0, lastTxDate: "" });
      }
    });

    return Array.from(map.entries()).map(([phone, info]) => ({
      phone,
      ...info
    }));
  }, [transactions, settings.storeName, settings.excludedBroadcastPhones, settings.manualBroadcastTargets]);

  const handleExcludeBroadcastPhone = async (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const currentExcluded = settings.excludedBroadcastPhones || [];
    if (!currentExcluded.includes(cleanPhone)) {
      const updatedExcluded = [...currentExcluded, cleanPhone];
      // Also unselect the phone
      setSelectedBroadcastPhones(prev => prev.filter(p => p !== cleanPhone));
      await handleSaveDb(products, { ...settings, excludedBroadcastPhones: updatedExcluded });
    }
  };

  const handleRestoreBroadcastPhone = async (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const currentExcluded = settings.excludedBroadcastPhones || [];
    const updatedExcluded = currentExcluded.filter(p => p !== cleanPhone);
    await handleSaveDb(products, { ...settings, excludedBroadcastPhones: updatedExcluded });
  };

  const handleAddManualTarget = async () => {
    setManualTargetError(null);
    if (!manualTargetPhone.trim()) {
      setManualTargetError("Nomor WhatsApp wajib diisi");
      return;
    }
    const cleanPhone = manualTargetPhone.replace(/[^0-9]/g, "");
    if (!cleanPhone || cleanPhone.length < 5) {
      setManualTargetError("Format nomor WhatsApp tidak valid");
      return;
    }
    
    // Normalize phone number (starting with 0 to 62, starting with 8 to 628)
    let normalizedPhone = cleanPhone;
    if (normalizedPhone.startsWith("0")) {
      normalizedPhone = "62" + normalizedPhone.slice(1);
    } else if (normalizedPhone.startsWith("8")) {
      normalizedPhone = "62" + normalizedPhone;
    }

    const currentTargets = settings.manualBroadcastTargets || [];
    const duplicate = currentTargets.find(t => {
      let tClean = t.phone.replace(/[^0-9]/g, "");
      if (tClean.startsWith("0")) tClean = "62" + tClean.slice(1);
      else if (tClean.startsWith("8")) tClean = "62" + tClean;
      return tClean === normalizedPhone;
    });

    if (duplicate) {
      setManualTargetError("Nomor ini sudah ada dalam daftar target");
      return;
    }

    const newTarget = {
      name: manualTargetName.trim() || ("Target Manual " + normalizedPhone.slice(-4)),
      phone: normalizedPhone
    };

    const updatedTargets = [...currentTargets, newTarget];
    
    setIsSavingDb(true);
    try {
      await handleSaveDb(products, { ...settings, manualBroadcastTargets: updatedTargets });
      setManualTargetName("");
      setManualTargetPhone("");
      setShowManualTargetForm(false);
      // Auto select the new target phone
      setSelectedBroadcastPhones(prev => {
        if (!prev.includes(normalizedPhone)) {
          return [...prev, normalizedPhone];
        }
        return prev;
      });
    } catch (e) {
      setManualTargetError("Gagal menyimpan target ke database");
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleDeleteManualTarget = async (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const currentTargets = settings.manualBroadcastTargets || [];
    const updatedTargets = currentTargets.filter(t => {
      let tClean = t.phone.replace(/[^0-9]/g, "");
      if (tClean.startsWith("0")) tClean = "62" + tClean.slice(1);
      else if (tClean.startsWith("8")) tClean = "62" + tClean;
      return tClean !== cleanPhone;
    });
    setSelectedBroadcastPhones(prev => prev.filter(p => p !== cleanPhone));
    await handleSaveDb(products, { ...settings, manualBroadcastTargets: updatedTargets });
  };

  const handleConfirmLunasAndPaymentMethod = async () => {
    if (!paymentMethodConfirmTarget) return;
    
    const tx = paymentMethodConfirmTarget;
    
    // Mark as Success, update payment method, and deduct stock
    const updatedTxs = transactions.map(t => {
      if (t.id === tx.id) return { 
        ...t, 
        status: "Success" as const,
        paymentMethod: confirmPaymentMethodVal
      };
      return t;
    });

    const updatedProducts = products.map(p => {
      const isParentDirect = p.id === tx.productId;
      const hasMatchingVar = p.variants && p.variants.some(v => v.id === tx.productId);
      if (isParentDirect || hasMatchingVar) {
        const vars = p.variants || [];
        const matchingVar = vars.find(v => v.id === tx.productId) || (vars.length > 0 ? vars[0] : null);
        if (matchingVar && matchingVar.stockType !== "UNKNOWN") {
          const updatedVars = vars.map(v => {
            if (v.id === matchingVar.id) {
              const currentStock = v.stock !== undefined ? v.stock : 10;
              return { ...v, stock: Math.max(0, currentStock - (tx.quantity || 1)) };
            }
            return v;
          });
          return { ...p, variants: updatedVars };
        }
      }
      return p;
    });

    await handleSaveDb(updatedProducts, undefined, undefined, undefined, updatedTxs);
    
    // Clear state
    setPaymentMethodConfirmTarget(null);
  };

  const handleStartBroadcast = async () => {
    if (selectedBroadcastPhones.length === 0) {
      alert("Silakan pilih minimal satu nomor pelanggan.");
      return;
    }
    if (!broadcastMessage.trim()) {
      alert("Isi pesan promo terlebih dahulu.");
      return;
    }

    if (status.status !== "connected") {
      alert("Bot WhatsApp Anda belum tersambung. Sambungkan bot terlebih dahulu di tab status.");
      return;
    }

    setIsBroadcasting(true);
    setBroadcastLogs([]);
    setBroadcastProgress({
      current: 0,
      total: selectedBroadcastPhones.length,
      target: "",
      status: "sending"
    });

    const targetPhones = [...selectedBroadcastPhones];
    const delayMs = broadcastDelay * 1000;

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targetPhones.length; i++) {
      const phone = targetPhones[i];
      const customer = customerPhones.find(c => c.phone === phone);
      const name = customer ? customer.name : "Pelanggan";

      // Customize message dynamic placeholders
      const personalizedMessage = broadcastMessage
        .replace(/{nama}/gi, name)
        .replace(/{toko}/gi, settings.storeName || "Wanzz Store");

      setBroadcastProgress({
        current: i + 1,
        total: targetPhones.length,
        target: `${name} (${phone})`,
        status: "sending"
      });

      try {
        const response = await fetch("/api/send-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: phone,
            text: personalizedMessage,
            mediaUrl: broadcastMediaUrl || undefined,
            mediaType: broadcastMediaType !== "none" ? broadcastMediaType : undefined
          })
        });

        const resData = await response.json();
        const timeNow = new Date().toLocaleTimeString("id-ID") + " WIB";

        if (response.ok && resData.success) {
          successCount++;
          setBroadcastLogs(prev => [
            { phone, name, status: "success", time: timeNow },
            ...prev
          ]);
        } else {
          failedCount++;
          setBroadcastLogs(prev => [
            { phone, name, status: "failed", error: resData.error || "Gagal kirim", time: timeNow },
            ...prev
          ]);
        }
      } catch (err: any) {
        failedCount++;
        const timeNow = new Date().toLocaleTimeString("id-ID") + " WIB";
        setBroadcastLogs(prev => [
          { phone, name, status: "failed", error: err.message || "Network Error", time: timeNow },
          ...prev
        ]);
      }

      // Add delay between messages (if not the last one)
      if (i < targetPhones.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    setIsBroadcasting(false);
    setBroadcastProgress(prev => ({
      ...prev,
      target: `Broadcast Selesai! ${successCount} Terkirim, ${failedCount} Gagal.`,
      status: "success"
    }));
  };

  // Export transaction logs to CSV
  const filteredTransactions = transactions.filter((tx) => {
    if (!tx.timestamp) return true;
    try {
      const txDate = new Date(tx.timestamp);
      if (isNaN(txDate.getTime())) return true;
      const year = txDate.getFullYear();
      const month = String(txDate.getMonth() + 1).padStart(2, "0");
      const day = String(txDate.getDate()).padStart(2, "0");
      const txFormatted = `${year}-${month}-${day}`;

      if (txStartDate && txFormatted < txStartDate) return false;
      if (txEndDate && txFormatted > txEndDate) return false;
    } catch (e) {
      // safe fallback
    }
    return true;
  });

  const handleExportCSV = () => {
    const headers = [
      "ID Pesanan",
      "Tanggal",
      "Jam",
      "Nama Pelanggan",
      "No HP",
      "Kategori",
      "ID Produk",
      "Nama Produk",
      "Harga Asli (HPP)",
      "Harga Jual",
      "Keuntungan",
      "Metode Bayar",
      "Status"
    ];

    const escapeCSVValue = (val: any, forceTextIfNumeric = false) => {
      if (val === undefined || val === null) return "";
      if (typeof val === "number") {
        return String(val); // Do not alter true numbers so spreadsheet formulas can sum/calculate them
      }
      
      let str = String(val);
      
      // Check if it's a phone number or high-digit code (e.g., starts with +/0 or has only digits, and is at least 5 characters long)
      const sanitized = str.replace(/\s+/g, "");
      const looksNumeric = /^\+?\d+$/.test(sanitized);
      const isHighChanceNumeric = looksNumeric && sanitized.length >= 5;

      if ((forceTextIfNumeric && looksNumeric) || isHighChanceNumeric) {
        // Excel dynamic text expression format to protect leading zeros and prevent scientific notation
        return `="${str.replace(/"/g, '""')}"`;
      }

      str = str.replace(/"/g, '""');
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        str = `"${str}"`;
      }
      return str;
    };

    const lines = [headers.join(",")];

    filteredTransactions.forEach((tx) => {
      const txDate = new Date(tx.timestamp);
      const tanggal = txDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
      const jam = txDate.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
      });

      // Find category name
      const prod = products.find(p => p.id === tx.productId);
      const catObj = prod ? categories.find(c => c.id === prod.category) : null;
      const categoryName = catObj ? catObj.name : "Other Services";

      const originalPrice = tx.originalPrice !== undefined ? tx.originalPrice : (tx.totalPrice || 0);
      const sellingPrice = tx.sellingPrice !== undefined ? tx.sellingPrice : (tx.totalPrice || 0);
      const profit = tx.status === "Success" ? (sellingPrice - originalPrice) : 0;

      const row = [
        tx.id,
        tanggal,
        jam,
        tx.buyerName || tx.buyerPhone || "Pelanggan",
        tx.buyerPhone || "-",
        categoryName,
        tx.productId,
        tx.productName,
        originalPrice,
        sellingPrice,
        profit,
        tx.paymentMethod,
        tx.status
      ];

      // Explicitly protect index 3 (Nama Pelanggan) and index 4 (No HP) as text if they have digits
      lines.push(row.map((val, idx) => escapeCSVValue(val, idx === 3 || idx === 4)).join(","));
    });

    const csvContent = "\uFEFF" + lines.join("\n"); // Add UTF-8 BOM
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `laporan_transaksi_wanzz_store_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

   // Send request message inside simulation sandbox
  const handleSimulateSend = async (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    const activeMsg = customMsg !== undefined ? customMsg : simMessage;
    if (!activeMsg.trim()) return;

    setIsSimulating(true);
    const userMsg = activeMsg;
    if (customMsg === undefined) {
      setSimMessage("");
    }

    // Append user message immediately UI side
    setSimExchange(prev => [...prev, {
      sender: `${simName} (Simulasi)`,
      text: userMsg,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      type: "user"
    }]);

    try {
      const customFrom = simChatScope === "whitelisted" 
        ? "120363425916568709@g.us" 
        : simChatScope === "other_group" 
          ? "120363024847291040@g.us" 
          : "simulated-user@s.whatsapp.net";
      const isGroup = simChatScope !== "private";

      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMsg, 
          senderName: simName, 
          isGroup, 
          customFrom 
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.response) {
          setSimExchange(prev => [...prev, {
            sender: "WANZZ BOT (Auto)",
            text: data.response,
            time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
            type: "bot",
            imageUrl: data.mediaType === "image" ? data.mediaUrl : (data.command === "payment" ? settings.paymentQrisUrl : undefined),
            videoUrl: data.mediaType === "video" ? data.mediaUrl : undefined,
            isHidetag: data.command === "hidetag",
            buttons: data.buttons,
            isSingleSelect: data.isSingleSelect,
            buttonTitle: data.buttonTitle
          }]);
        }
        fetchLogs(); // refresh server side logs as well
        fetchDatabase(); // Refresh product stats/lists instantly
      }
    } catch (err) {
      console.error("Simulate error:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Filter products based on category dropdown and search
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategoryFilter === "all" || p.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800">
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500 rounded-xl text-white shadow-md shadow-emerald-200">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-slate-900 flex items-center gap-2">
                {settings.storeName || "WANZZ STORE"} 
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  WA Bot Panel
                </span>
              </h1>
              <p className="text-xs text-slate-500">Auto-responder WhatsApp Pintar non-AI (Local database)</p>
            </div>
          </div>

          {/* Connection quick badge in header */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">Status Server:</span>
            {status.status === "connected" ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Terhubung: {status.pushName || "Bot"}
              </div>
            ) : status.status === "connecting" ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Masih Menghubungkan
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Belum Terhubung
              </div>
            )}
          </div>
        </div>
      </header>

      {/* DOCK BAR FOR ALERTS */}
      <AnimatePresence>
        {saveMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-18 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center gap-2 max-w-md ${
              saveMessage.type === "success" 
                ? "bg-emerald-500 text-white" 
                : "bg-red-500 text-white"
            }`}
          >
            {saveMessage.type === "success" ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm font-medium">{saveMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT PANEL: WhatsApp Linker Station */}
          <section className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-500" />
                  Koneksi Perangkat
                </h3>
                <span className="text-xs text-slate-400">Baileys Multidevice</span>
              </div>

              {status.error && (
                <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-left flex items-start gap-2.5">
                  <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-amber-900">Keterangan Status Sesi</h5>
                    <p className="mt-1 leading-relaxed text-[11px]">{status.error}</p>
                    <div className="mt-2 text-[10.5px] text-amber-700 bg-amber-100/50 p-2 rounded-lg leading-relaxed">
                      💡 <b>Keterbatasan Sandbox:</b> WhatsApp membatasi koneksi dari cloud server tertentu. Bila gagal tersambung, Anda <b>tetap bisa mengetes fungsi otomatis secara penuh</b> menggunakan fitur <b>Kirim Pesan Simulasi</b> pada tab Simulator terintegrasi.
                    </div>
                  </div>
                </div>
              )}

              {/* Connected view */}
              {status.status === "connected" && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-base">WhatsApp Bot Aktif</h4>
                  <p className="text-xs text-slate-500 mt-1">Sistem siap menangkap pesan otomatis 24 jam</p>

                  <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-left flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Nama Akun:</span>
                      <span className="font-semibold text-slate-800">{status.pushName || "WANZZ BOT"}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">No HP WhatsApp:</span>
                      <span className="font-bold font-mono text-slate-800">{status.phoneNumber || "-"}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Metode:</span>
                      <span className="text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-sm">Linked Device</span>
                    </div>
                  </div>

                  <button
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="mt-6 w-full py-3 px-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isDisconnecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Memutus Sesi...
                      </>
                    ) : (
                      <>
                        <LogOut className="w-4 h-4" />
                        Putuskan Koneksi / Log Out
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Connecting loading State */}
              {status.status === "connecting" && (
                <div className="text-center py-10">
                  <div className="w-14 h-14 mx-auto border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
                  <h4 className="font-bold text-slate-900 text-sm">Menghubungkan Sesi...</h4>
                  <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto">
                    Menunggu respons dari server Baileys. Mohon tunggu sesaat atau gunakan kode pairing di bawah bila diminta.
                  </p>
                  
                  {status.pairingCode && (
                    <div className="mt-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <span className="text-xs text-emerald-700 block mb-1">Kode Pairing WhatsApp Anda:</span>
                      <div className="font-bold text-2xl tracking-wider font-mono text-emerald-800 select-all py-1 bg-white border border-emerald-200 rounded-lg inline-block px-4">
                        {status.pairingCode}
                      </div>
                      <p className="text-[10px] text-emerald-600 mt-2 max-w-xs mx-auto">
                        Cara pakai: Buka WA HP &gt; Perangkat Tertaut &gt; Tautkan Perangkat &gt; Tautkan dengan nomor telepon &gt; Masukkan kode di atas.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleDisconnect}
                    className="mt-6 text-xs text-slate-400 hover:text-red-500 font-medium underline"
                  >
                    Batalkan & Reset Sesi
                  </button>
                </div>
              )}

              {/* Disconnected link panel QR / Pairing Code */}
              {status.status === "disconnected" && (
                <div className="flex flex-col gap-4">
                  {/* Select connection layout type */}
                  <div className="flex p-0.5 rounded-xl bg-slate-100 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setConnectionType("qr")}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        connectionType === "qr" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Scan QR Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setConnectionType("pairing")}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        connectionType === "pairing" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Key className="w-3.5 h-3.5" />
                      Pairing Code
                    </button>
                  </div>

                  {connectionType === "qr" ? (
                    <div className="text-center py-4">
                      {status.qrCode ? (
                        <div className="bg-slate-50 p-4 rounded-2xl inline-block border border-slate-200">
                          <img 
                            src={status.qrCode} 
                            alt="WhatsApp Scan QR" 
                            className="w-48 h-48 mx-auto"
                            referrerPolicy="no-referrer"
                          />
                          <p className="text-[11px] text-slate-500 mt-2 animate-pulse">
                            QR Code aktif. Segera scan dari WhatsApp HP Anda.
                          </p>
                        </div>
                      ) : (
                        <div className="py-8 px-4 rounded-xl border border-dashed border-slate-200 text-slate-400">
                          <QrCode className="w-10 h-10 mx-auto mb-2 opacity-40 animate-pulse" />
                          <p className="text-xs">QR belum digenerate atau sedang memuat.</p>
                          <p className="text-[10px] mt-1 text-slate-400">Klik tombol buat koneksi di bawah.</p>
                        </div>
                      )}

                      <div className="text-left mt-5 bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
                        <span className="text-xs font-bold text-slate-800">Petunjuk scan QR:</span>
                        <ol className="text-[11px] text-slate-600 list-decimal pl-4 flex flex-col gap-1">
                          <li>Buka aplikasi WhatsApp di HP Anda</li>
                          <li>Ketuk Menu <b>(· · ·)</b> kanan atas atau tab Pengaturan</li>
                          <li>Pilih <b>Perangkat Tertaut</b> lalu klik <b>Tautkan Perangkat</b></li>
                          <li>Arahkan kamera HP Anda ke gambar QR Code di atas</li>
                        </ol>
                      </div>

                      <button
                        onClick={handleConnect}
                        disabled={isInitializing}
                        className="mt-5 w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-100 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isInitializing ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        {status.qrCode ? "Generate QR Baru" : "Inisialisasi Sesi WhatsApp"}
                      </button>
                    </div>
                  ) : (
                    <div className="py-2 flex flex-col gap-4">
                      <form onSubmit={handleConnect} className="flex flex-col gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Nomor Telepon Bot (Gunakan Kode Negara)</label>
                          <input
                            type="tel"
                            required
                            placeholder="Contoh: 628123456789 (Jangan pakai + atau spasi)"
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-hidden"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isInitializing}
                          className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {isInitializing ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Key className="w-4 h-4" />
                          )}
                          Dapatkan Pairing Code
                        </button>
                      </form>

                      {status.pairingCode && (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                          <span className="text-xs text-emerald-700 block mb-1">Kode Pairing Anda:</span>
                          <div className="font-bold text-2xl tracking-wider font-mono text-emerald-800 select-all py-1 bg-white border border-emerald-200 rounded-lg inline-block px-4">
                            {status.pairingCode}
                          </div>
                        </div>
                      )}

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
                        <span className="text-xs font-bold text-slate-800">Petunjuk Pairing Code:</span>
                        <ol className="text-[11px] text-slate-600 list-decimal pl-4 flex flex-col gap-1.5">
                          <li>Buka WhatsApp di HP Anda &rarr; Perangkat Tertaut</li>
                          <li>Tekan <b>Tautkan Perangkat</b> lalu ketuk <b>Tautkan dengan nomor telepon saja</b> di bagian bawah</li>
                          <li>Masukkan nomor telepon Bot yang sama</li>
                          <li>Masukkan 8 digit kode pairing yang tampil di atas</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick guide of dynamic triggers */}
            <div className="bg-emerald-950 text-emerald-200 rounded-3xl p-6 border border-emerald-900 shadow-sm">
              <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Daftar Command Aktif
              </h4>
              <p className="text-xs text-emerald-300 leading-relaxed mb-4">
                Bot Anda akan otomatis mendeteksi dan merespons trigger berikut dari chat pelanggan secara instan:
              </p>
              <div className="flex flex-col gap-2.5">
                <div className="flex gap-2.5 items-start">
                  <span className="text-xs bg-emerald-800 text-emerald-100 font-mono px-2 py-0.5 rounded-sm shrink-0">/menu</span>
                  <span className="text-[11.5px]">Menampilkan katalog produk tersusun rapi sesuai kategori (dengan menu image jika aktif).</span>
                </div>
                <div className="flex gap-2.5 items-start">
                  <span className="text-xs bg-emerald-800 text-emerald-100 font-mono px-2 py-0.5 rounded-sm shrink-0">/owner</span>
                  <span className="text-[11.5px]">Menampilkan informasi dan tautan kontak WhatsApp owner resmi bisnis Anda.</span>
                </div>
                <div className="flex gap-2.5 items-start">
                  <span className="text-xs bg-emerald-800 text-emerald-100 font-mono px-2 py-0.5 rounded-sm shrink-0">[NAMA_PRODUK]</span>
                  <span className="text-[11.5px]">Mengetik seperti <b>NETFLIX</b> atau <b>CANVA</b> akan melihat harga, detail, dan deskripsi produk.</span>
                </div>
                <div className="flex gap-2.5 items-start">
                  <span className="text-xs bg-emerald-800 text-emerald-100 font-mono px-2 py-0.5 rounded-sm shrink-0">/info [nama]</span>
                  <span className="text-[11.5px]">Alternatif detail produk secara formal, cth: <b>/info chatgpt</b>.</span>
                </div>
                <div className="flex gap-2.5 items-start">
                  <span className="text-xs bg-emerald-800 text-emerald-100 font-mono px-2 py-0.5 rounded-sm shrink-0">Halo / P</span>
                  <span className="text-[11.5px]">Trigger menyambut (Greeting) menyapa dengan welcome message formal toko.</span>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT PANEL: Workspace Management Cards */}
          <section className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Cloud Backup & Sync Status Panel */}
            {status.isFirebaseEnabled !== false ? (
              <div className="bg-white rounded-3xl p-5 border border-indigo-100 bg-linear-to-r from-white via-indigo-50/10 to-indigo-50/25 shadow-xs flex flex-col gap-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-indigo-500 rounded-xl text-white shadow-md shadow-indigo-150 shrink-0">
                      <Cloud className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        Sinkronisasi & Backup Cloud Firestore
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200">
                          Amankan Data
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                        Klik backup untuk menyimpan seluruh data lokal (Katalog, Template, Command, Transaksi, Statistik) secara permanen ke database Firestore Anda untuk menghindari rollback.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center">
                    <button
                      onClick={handleManualSync}
                      disabled={isManualSyncing}
                      className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-100"
                    >
                      {isManualSyncing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Cloud className="w-3.5 h-3.5" />
                      )}
                      {isManualSyncing ? "Sedang Membackup..." : "Backup Sekarang"}
                    </button>
                  </div>
                </div>

                {/* Sync Status Banner */}
                {syncStatus.message && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className={`p-3 rounded-2xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                      syncStatus.type === "success"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : syncStatus.type === "error"
                        ? "bg-amber-50 border-amber-200 text-amber-800"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    <span className="shrink-0 mt-0.5">
                      {syncStatus.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : syncStatus.type === "error" ? (
                        <CloudOff className="w-4 h-4 text-amber-600" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                      )}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{syncStatus.message}</p>
                      {syncStatus.timestamp && (
                        <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                          Terakhir di-sync: {syncStatus.timestamp} WIB
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-5 border border-slate-200 bg-linear-to-r from-white to-slate-50/50 shadow-xs flex flex-col gap-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100/60 pb-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-slate-500 rounded-xl text-white shadow-md shadow-slate-150 shrink-0">
                      <CloudOff className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        Mode Penyimpanan: Pterodactyl Local Storage
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          100% Mandiri
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                        Bot berjalan mandiri tanpa Firebase Cloud. Semua data tersimpan aman secara otomatis di file <code className="font-mono bg-slate-100 px-1 rounded text-slate-600">database.json</code> server Anda.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center">
                    <span className="py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-1.5 select-none">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Local Active
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Nav Management Tabs */}
            <div className="flex gap-1.5 p-1 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-x-auto">
              <button
                onClick={() => { setActiveTab("catalog"); setEditingProduct(null); setIsAddingNew(false); }}
                className={`flex-1 py-3 px-4 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "catalog" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-850"
                }`}
              >
                <Database className="w-4 h-4" />
                Database Katalog
              </button>
              <button
                onClick={() => { setActiveTab("settings"); setEditingProduct(null); setIsAddingNew(false); }}
                className={`flex-1 py-3 px-4 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "settings" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-850"
                }`}
              >
                <Settings2 className="w-4 h-4" />
                Template Pesan & Auto-Response
              </button>
              <button
                onClick={() => { setActiveTab("commands"); setEditingProduct(null); setIsAddingNew(false); }}
                className={`flex-1 py-3 px-4 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "commands" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-850"
                }`}
              >
                <Zap className="w-4 h-4" />
                Kelola Command
              </button>
              <button
                onClick={() => { setActiveTab("transactions"); setEditingProduct(null); setIsAddingNew(false); }}
                className={`flex-1 py-3 px-4 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "transactions" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-850"
                }`}
              >
                <Receipt className="w-4 h-4" />
                Kelola Transaksi
              </button>
              <button
                onClick={() => { setActiveTab("broadcast"); setEditingProduct(null); setIsAddingNew(false); }}
                className={`flex-1 py-3 px-4 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "broadcast" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-850"
                }`}
              >
                <Megaphone className="w-4 h-4" />
                Broadcast Promo
              </button>
              <button
                onClick={() => { setActiveTab("simulator"); setEditingProduct(null); setIsAddingNew(false); }}
                className={`flex-1 py-3 px-4 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "simulator" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-850"
                }`}
              >
                <Terminal className="w-4 h-4" />
                Simulator & Log Chat
              </button>
              <button
                onClick={() => { setActiveTab("stats"); setEditingProduct(null); setIsAddingNew(false); }}
                className={`flex-1 py-3 px-4 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "stats" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-850"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Statistik Produk
              </button>
              <button
                onClick={() => { setActiveTab("manual"); setEditingProduct(null); setIsAddingNew(false); }}
                className={`flex-1 py-3 px-4 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "manual" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-850"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Panduan Bisnis Flow
              </button>
            </div>

            {/* Content Display Area */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex-1 min-h-[500px]">
              
              {/* TAB 1: CATALOG DATABASE */}
              {activeTab === "catalog" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-6"
                >
                  {isManagingCategories ? (
                    // Category Management Form Panel
                    <div className="animate-fade-in">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                        <div className="flex flex-col">
                          <h4 className="font-bold text-slate-900 text-base font-sans tracking-tight">Kelola Kategori</h4>
                          <p className="text-[10px] text-slate-400 font-sans">Tambah baru atau hapus kategori produk</p>
                        </div>
                        <button
                          onClick={() => { setIsManagingCategories(false); }}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-semibold cursor-pointer border border-slate-200 transition-all font-sans"
                        >
                          Kembali ke Katalog
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Form Tambah Kategori */}
                        <div className="lg:col-span-1 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                          <h5 className="text-xs font-bold text-slate-800 mb-3 block font-sans">Tambah Kategori Baru</h5>
                          <form onSubmit={handleAddCategory} className="flex flex-col gap-3">
                            <div>
                              <label className="text-xs font-bold text-slate-600 block mb-1 font-sans">ID Kategori</label>
                              <input
                                type="text"
                                required
                                placeholder="Cth: streaming, pulsa"
                                value={newCatIdInput}
                                onChange={(e) => setNewCatIdInput(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden font-sans"
                              />
                              <p className="text-[10px] text-slate-400 mt-1 font-sans">Gunakan huruf kecil, tanpa spasi (cth: streaming_premium)</p>
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-600 block mb-1 font-sans">Nama Kategori</label>
                              <input
                                type="text"
                                required
                                placeholder="Cth: Streaming Premium"
                                value={newCatNameInput}
                                onChange={(e) => setNewCatNameInput(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden font-sans"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={isSavingDb}
                              className="w-full px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm mt-1 cursor-pointer disabled:opacity-50 font-sans"
                            >
                              <Plus className="w-4 h-4" />
                              Tambah Kategori
                            </button>
                          </form>
                        </div>

                        {/* List Kategori Terdaftar */}
                        <div className="lg:col-span-2 border border-slate-100 rounded-2xl p-4 bg-white">
                          <h5 className="text-xs font-bold text-slate-800 mb-3 block font-sans">Daftar Kategori Terdaftar</h5>
                          <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
                            {categories.length === 0 ? (
                              <div className="text-center py-10 text-slate-400 text-xs font-sans">
                                Belum ada kategori di database.
                              </div>
                            ) : (
                              categories.map(cat => {
                                const productCount = products.filter(p => p.category === cat.id).length;
                                return (
                                  <div key={cat.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 px-3 py-2.5 rounded-xl text-xs hover:border-slate-200 transition-all font-sans">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-800">{cat.name}</span>
                                      <span className="font-mono text-[10px] text-slate-400 mt-0.5">ID: {cat.id} • {productCount} Produk</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                        className="text-red-500 hover:text-red-700 text-xs bg-red-50 hover:bg-red-100 p-1.5 rounded-lg flex items-center gap-1 transition-all border border-red-100 cursor-pointer"
                                        title="Hapus Kategori"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : editingProduct ? (
                    // Product Edit Form Panel
                    <div>
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="font-bold text-slate-900 text-base">
                          {isAddingNew ? "Tambah Produk Baru" : `Edit Produk: ${editingProduct.id}`}
                        </h4>
                        <button
                          onClick={() => { setEditingProduct(null); setIsAddingNew(false); }}
                          className="text-xs text-slate-400 hover:text-slate-700 font-semibold"
                        >
                          Batal
                        </button>
                      </div>

                      <form onSubmit={isAddingNew ? handleAddProduct : handleUpdateProduct} className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">ID Produk (Unique Code)</label>
                            <input
                              type="text"
                              required
                              disabled={!isAddingNew}
                              placeholder="Cth: NETFLIX, CANVA_ONE"
                              value={editingProduct.id}
                              onChange={(e) => setEditingProduct({ ...editingProduct, id: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden disabled:bg-slate-50 font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Gunakan huruf besar, tanpa spasi (cth: CHATGPT atau NETFLIX)</p>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Nama Produk Layanan</label>
                            <input
                              type="text"
                              required
                              placeholder="Cth: NETFLIX PREMIUM, CANVA PRO"
                              value={editingProduct.name}
                              onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Kategori Produk</label>
                            <select
                              value={editingProduct.category}
                              onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden font-semibold"
                            >
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1 flex justify-between">
                            <span>Detail Produk, Deskripsi, Fitur & Rincian Harga</span>
                            <span className="text-[10px] text-slate-400 font-normal">Tampil saat pelanggan mengetik nama produk</span>
                          </label>
                          <textarea
                            rows={8}
                            required
                            placeholder="Tulis list harga paket, durasi, fitur, dan info garansi di sini..."
                            value={editingProduct.details}
                            onChange={(e) => setEditingProduct({ ...editingProduct, details: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                          />
                        </div>

                        {/* Variant Categories Management per Product */}
                        <div className="border border-slate-200/80 rounded-2xl bg-indigo-50/20 p-4 font-sans">
                          <div className="flex justify-between items-center mb-3">
                            <div>
                              <h5 className="text-[11.5px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="w-4 h-4 text-indigo-600" />
                                Kategori Varian Produk ({editingProduct.variantCategories?.length || 0})
                              </h5>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Definisikan kategori untuk mengelompokkan varian (cth: FAMPLAN, INDPLAN) agar varian produk terkelompok rapi di bot.
                              </p>
                            </div>
                          </div>

                          {(!editingProduct.variantCategories || editingProduct.variantCategories.length === 0) ? (
                            <div className="bg-white border border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400 mb-3">
                              <p className="font-semibold">Belum ada kategori varian khusus untuk produk ini.</p>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {editingProduct.variantCategories.map((cat, catIdx) => (
                                <div key={catIdx} className="flex items-center gap-1.5 bg-white border border-slate-200 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-semibold text-slate-700 shadow-3xs">
                                  {editingCategoryIndex === catIdx ? (
                                    <input
                                      type="text"
                                      value={editingCategoryValue}
                                      onChange={(e) => setEditingCategoryValue(e.target.value.toUpperCase())}
                                      className="px-1.5 py-0.5 border border-indigo-300 rounded text-xs max-w-[100px] focus:outline-hidden text-slate-800 font-bold"
                                      autoFocus
                                    />
                                  ) : (
                                    <span className="font-bold text-slate-800">{cat}</span>
                                  )}
                                  
                                  <div className="flex items-center gap-1 border-l border-slate-100 pl-1.5 ml-1">
                                    {editingCategoryIndex === catIdx ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!editingCategoryValue.trim()) {
                                              alert("Nama kategori tidak boleh kosong.");
                                              return;
                                            }
                                            const updatedCats = [...(editingProduct.variantCategories || [])];
                                            const oldName = updatedCats[catIdx];
                                            const newName = editingCategoryValue.trim().toUpperCase();
                                            
                                            if (updatedCats.some((c, i) => c === newName && i !== catIdx)) {
                                              alert("Kategori dengan nama tersebut sudah ada.");
                                              return;
                                            }
                                            
                                            updatedCats[catIdx] = newName;
                                            
                                            // Rename category in any variants as well!
                                            const updatedVars = (editingProduct.variants || []).map(v => {
                                              if (v.variantCategory === oldName) {
                                                return { ...v, variantCategory: newName };
                                              }
                                              return v;
                                            });
                                            
                                            setEditingProduct({
                                              ...editingProduct,
                                              variantCategories: updatedCats,
                                              variants: updatedVars
                                            });
                                            setEditingCategoryIndex(null);
                                            setEditingCategoryValue("");
                                          }}
                                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                          title="Simpan"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingCategoryIndex(null);
                                            setEditingCategoryValue("");
                                          }}
                                          className="p-1 text-slate-450 hover:bg-slate-50 rounded cursor-pointer"
                                          title="Batal"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingCategoryIndex(catIdx);
                                            setEditingCategoryValue(cat);
                                          }}
                                          className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded cursor-pointer"
                                          title="Ubah Nama Kategori"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updatedCats = editingProduct.variantCategories?.filter((_, i) => i !== catIdx) || [];
                                            const catName = editingProduct.variantCategories?.[catIdx];
                                            
                                            // Remove category from variants as well!
                                            const updatedVars = (editingProduct.variants || []).map(v => {
                                              if (v.variantCategory === catName) {
                                                return { ...v, variantCategory: undefined };
                                              }
                                              return v;
                                            });
                                            
                                            setEditingProduct({
                                              ...editingProduct,
                                              variantCategories: updatedCats,
                                              variants: updatedVars
                                            });
                                          }}
                                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                                          title="Hapus Kategori"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2 max-w-sm">
                            <input
                              type="text"
                              placeholder="Cth: FAMPLAN"
                              value={newValCategoryInput}
                              onChange={(e) => setNewValCategoryInput(e.target.value.toUpperCase())}
                              className="flex-1 px-3 py-1.5 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const cleaned = newValCategoryInput.trim().toUpperCase();
                                if (!cleaned) return;
                                const currentCats = editingProduct.variantCategories || [];
                                if (currentCats.includes(cleaned)) {
                                  alert("Kategori varian ini sudah ditambahkan.");
                                  return;
                                }
                                setEditingProduct({
                                  ...editingProduct,
                                  variantCategories: [...currentCats, cleaned]
                                });
                                setNewValCategoryInput("");
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-all border border-indigo-600 hover:shadow-2xs"
                            >
                              Tambah Kategori
                            </button>
                          </div>
                        </div>

                        {/* Interactive Product Variants Section */}
                        <div className="border border-slate-200/80 rounded-2xl bg-slate-50/50 p-4 font-sans">
                          <div className="flex justify-between items-center mb-3">
                            <div>
                              <h5 className="text-[11.5px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <PlusCircle className="w-4 h-4 text-emerald-600" />
                                Pilihan & Varian Layanan (Sub-Paket / Varian Opsi)
                              </h5>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Tambahkan paket / variasi harga (cth: Netflix 1 Bulan, 3 Bulan, dll.) agar pelanggan bisa memesan kode spesifik di WhatsApp bot.
                              </p>
                            </div>
                          </div>

                          {/* List of current variants */}
                          {(!editingProduct.variants || editingProduct.variants.length === 0) ? (
                            <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center text-xs text-slate-400 mb-4">
                              <p className="font-semibold">Belum ada pilihan varian tipe paket.</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">Layanan di atas dianggap memiliki 1 opsi utama menggunakan Harga & ID utama produk.</p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 mb-4">
                              {editingProduct.variants.map((v, index) => (
                                <div key={index} className="flex flex-col sm:flex-row justify-between sm:items-center bg-white border border-slate-150 p-3 rounded-xl gap-2 hover:border-slate-300 transition-all">
                                  <div className="flex flex-col gap-0.5 animate-fade-in">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-[10.5px] bg-slate-100 text-slate-705 px-2 py-0.5 rounded-md border border-slate-250 select-all">
                                        {v.id}
                                      </span>
                                      <span className="font-bold text-xs text-slate-800">{v.name}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] text-slate-500 font-medium">
                                      {v.variantCategory && (
                                        <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-sm font-extrabold border border-indigo-100 uppercase text-[9px]">
                                          {v.variantCategory}
                                        </span>
                                      )}
                                      {v.alternativeCommands && v.alternativeCommands.length > 0 && (
                                        <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-sm font-extrabold border border-emerald-100 uppercase text-[9px] cursor-help" title="Command alternatif / shortcut">
                                          Cmd: {v.alternativeCommands.join(", ")}
                                        </span>
                                      )}
                                      <span>Harga Jual: <b className="text-indigo-600">Rp{v.price.toLocaleString("id-ID")}</b></span>
                                      <span>Harga Modal: <b className="text-slate-600">Rp{(v.originalPrice || 0).toLocaleString("id-ID")}</b></span>
                                      <span>Stok: <b className="text-slate-700">{v.stockType === "UNKNOWN" ? "Selalu Ready (UNKNOWN)" : `${v.stock !== undefined ? v.stock : 10} unit`}</b></span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setVarId(v.id);
                                        setVarName(v.name);
                                        setVarPrice(v.price);
                                        setVarOriginalPrice(v.originalPrice || v.price);
                                        setVarStock(v.stock !== undefined ? v.stock : 10);
                                        setVarStockType(v.stockType || "numeric");
                                        setVarCategory(v.variantCategory || "");
                                        setVarAlternativeCommands(v.alternativeCommands?.join(", ") || "");
                                        setEditingVarIndex(index);
                                      }}
                                      className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const originalVariants = editingProduct.variants || [];
                                        const updatedVariants = originalVariants.filter((_, idx) => idx !== index);
                                        setEditingProduct({ ...editingProduct, variants: updatedVariants });
                                        if (editingVarIndex === index) {
                                          setVarId("");
                                          setVarName("");
                                          setVarPrice(0);
                                          setVarOriginalPrice(0);
                                          setVarAlternativeCommands("");
                                          setEditingVarIndex(null);
                                        }
                                      }}
                                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-600 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                                    >
                                      Hapus
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Mini Add/Edit Variant Form */}
                          <div className="bg-white border border-slate-150 rounded-xl p-3.5 shadow-sm">
                            <h6 className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1">
                              {editingVarIndex !== null ? "📝 Edit Pilihan Varian" : "➕ Tambah Pilihan Varian baru"}
                            </h6>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="sm:col-span-1">
                                <label className="text-[10px] font-bold text-slate-600 block mb-1">Kode Opsi (Unique)</label>
                                <input
                                  type="text"
                                  placeholder="Cth: NETFLIX_1M"
                                  value={varId}
                                  onChange={(e) => setVarId(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-bold font-mono focus:outline-hidden focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                />
                              </div>
                              <div className="sm:col-span-1">
                                <label className="text-[10px] font-bold text-slate-600 block mb-1">Nama Pilihan Varian</label>
                                <input
                                  type="text"
                                  placeholder="Cth: Netflix 1 Bulan (1 User)"
                                  value={varName}
                                  onChange={(e) => setVarName(e.target.value)}
                                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-400 focus:ring-1 focus:ring-slate-400 font-sans"
                                />
                              </div>
                              <div className="sm:col-span-1">
                                <label className="text-[10px] font-bold text-slate-600 block mb-1">Harga Jual (Rp)</label>
                                <input
                                  type="number"
                                  placeholder="Cth: 20000"
                                  value={varPrice || ""}
                                  onChange={(e) => setVarPrice(parseInt(e.target.value) || 0)}
                                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold text-indigo-600 focus:outline-hidden focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                />
                              </div>
                              <div className="sm:col-span-1">
                                <label className="text-[10px] font-bold text-slate-600 block mb-1">Harga Modal / Asli (Rp)</label>
                                <input
                                  type="number"
                                  placeholder="Cth: 15000"
                                  value={varOriginalPrice || ""}
                                  onChange={(e) => setVarOriginalPrice(parseInt(e.target.value) || 0)}
                                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-600 focus:outline-hidden focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                />
                              </div>
                              <div className="sm:col-span-1">
                                <label className="text-[10px] font-bold text-slate-600 block mb-1">Tipe Stok Varian</label>
                                <select
                                  value={varStockType}
                                  onChange={(e) => setVarStockType(e.target.value as 'UNKNOWN' | 'numeric')}
                                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-slate-400 focus:ring-1 focus:ring-slate-400 font-sans"
                                >
                                  <option value="numeric">Stok tipe jumlah (Pasti)</option>
                                  <option value="UNKNOWN">Stok tipe UNKNOWN (Tidak Pasti)</option>
                                </select>
                              </div>
                              <div className="sm:col-span-1">
                                {varStockType !== "UNKNOWN" ? (
                                  <>
                                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Stok Khusus Varian</label>
                                    <input
                                      type="number"
                                      placeholder="Cth: 10"
                                      value={varStock}
                                      onChange={(e) => setVarStock(parseInt(e.target.value) || 0)}
                                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-slate-400 focus:ring-1 focus:ring-slate-400 font-mono"
                                    />
                                  </>
                                ) : (
                                  <>
                                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Stok Khusus Varian</label>
                                    <div className="w-full px-2.5 py-2 border border-dashed border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-400 font-semibold h-[38px] flex items-center justify-center">
                                      Selalu Ready
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="sm:col-span-1">
                                <label className="text-[10px] font-bold text-slate-600 block mb-1">Kategori Varian</label>
                                <select
                                  value={varCategory}
                                  onChange={(e) => setVarCategory(e.target.value)}
                                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-slate-400 focus:ring-1 focus:ring-slate-400 font-sans"
                                >
                                  <option value="">-- Tanpa Kategori / Lainnya --</option>
                                  {(editingProduct.variantCategories || []).map((catName) => (
                                    <option key={catName} value={catName}>{catName}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="sm:col-span-1">
                                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                                  Command Alternatif / Shortcut <span className="text-rose-500 font-extrabold">*</span>
                                </label>
                                <input
                                  type="text"
                                  placeholder="Cth: netprem, net prem"
                                  value={varAlternativeCommands}
                                  onChange={(e) => setVarAlternativeCommands(e.target.value)}
                                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-slate-400 focus:ring-1 focus:ring-slate-400 font-sans shadow-2xs"
                                />
                              </div>
                            </div>
                            <p className="text-[9.5px] text-slate-400 font-medium mt-2 p-1.5 rounded-lg bg-slate-50 border border-slate-150">
                              💡 <b>Format:</b> Pisahkan beberapa command dengan tanda koma (<code>,</code>). Contoh: <code>netprem, net prem privat</code>. Varian dapat langsung dipesan lewat <code>/order [command]</code>.
                            </p>
                            <div className="flex gap-2 justify-end mt-3 border-t border-slate-100 pt-3">
                              {editingVarIndex !== null && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVarId("");
                                    setVarName("");
                                    setVarPrice(0);
                                    setVarOriginalPrice(0);
                                    setVarStock(10);
                                    setVarStockType("numeric");
                                    setVarCategory("");
                                    setVarAlternativeCommands("");
                                    setEditingVarIndex(null);
                                  }}
                                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-[10.5px] font-bold text-slate-500 hover:text-slate-700 transition-all cursor-pointer bg-slate-50"
                                >
                                  Batal Edit
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!varId || !varName) {
                                    alert("ID Varian dan Nama Varian wajib diisi.");
                                    return;
                                  }

                                  const altCommands = varAlternativeCommands
                                    .split(",")
                                    .map((c) => c.trim().toLowerCase())
                                    .filter(Boolean);

                                  if (altCommands.length === 0) {
                                    alert("Mohon masukkan minimal 1 command alternatif untuk varian ini.");
                                    return;
                                  }

                                  // Validate conflict with other variants in database
                                  for (const p of products) {
                                    const isEditingThisProduct = editingProduct && p.id === editingProduct.id;
                                    const variantsToCheck = isEditingThisProduct
                                      ? (editingProduct.variants || []).filter((_, idx) => idx !== editingVarIndex)
                                      : (p.variants || []);

                                    for (const existingVar of variantsToCheck) {
                                      if (existingVar.alternativeCommands) {
                                        for (const existingCmd of existingVar.alternativeCommands) {
                                          const lowerExist = existingCmd.trim().toLowerCase();
                                          if (altCommands.includes(lowerExist)) {
                                            alert(`Command alternatif "${existingCmd}" sudah digunakan oleh varian "${existingVar.name}" pada produk "${p.name}". Mohon gunakan command lain agar tidak bentrok.`);
                                            return;
                                          }
                                        }
                                      }
                                    }
                                  }

                                  const vList = editingProduct.variants || [];
                                  
                                  const isDuplicate = vList.some((v, idx) => v.id.toUpperCase() === varId.toUpperCase() && idx !== editingVarIndex);
                                  if (isDuplicate) {
                                    alert("ID Varian sudah digunakan pada varian lain di produk ini.");
                                    return;
                                  }

                                  const newV = {
                                    id: varId.toUpperCase().replace(/\s+/g, "_"),
                                    name: varName,
                                    price: varPrice,
                                    originalPrice: varOriginalPrice || varPrice,
                                    stockType: varStockType,
                                    stock: varStockType === "UNKNOWN" ? undefined : varStock,
                                    variantCategory: varCategory || undefined,
                                    alternativeCommands: altCommands
                                  };

                                  let updatedV = [...vList];
                                  if (editingVarIndex !== null) {
                                    updatedV[editingVarIndex] = newV;
                                  } else {
                                    updatedV.push(newV);
                                  }

                                  setEditingProduct({ ...editingProduct, variants: updatedV });
                                  
                                  setVarId("");
                                  setVarName("");
                                  setVarPrice(0);
                                  setVarOriginalPrice(0);
                                  setVarStock(10);
                                  setVarStockType("numeric");
                                  setVarCategory("");
                                  setVarAlternativeCommands("");
                                  setEditingVarIndex(null);
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs border border-emerald-600"
                              >
                                {editingVarIndex !== null ? "Simpan Varian" : "Mendaftarkan Varian"}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3 justify-end mt-4">
                          <button
                            type="button"
                            onClick={() => { setEditingProduct(null); setIsAddingNew(false); }}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                          >
                            Mundurkan
                          </button>
                          <button
                            type="submit"
                            disabled={isSavingDb}
                            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {isAddingNew ? "Tambahkan ke Katalog" : "Simpan Perubahan"}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    // Catalog List View
                    <div>
                      {/* Search and Filters toolbar */}
                      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                        <div className="flex flex-1 w-full gap-3">
                          <div className="relative flex-1">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                            <input
                              type="text"
                              placeholder="Cari nama produk / kode id..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-slate-400"
                            />
                          </div>
                          <select
                            value={selectedCategoryFilter}
                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 focus:outline-hidden"
                          >
                            <option value="all">Semua Kategori</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                          <button
                            onClick={() => {
                              setIsManagingCategories(true);
                            }}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-705 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all text-center w-full md:w-auto cursor-pointer justify-center font-sans font-medium"
                          >
                            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                            Kelola Kategori
                          </button>
                          <button
                            onClick={() => {
                              setIsAddingNew(true);
                              setEditingProduct({
                                id: "",
                                name: "",
                                category: categories[0]?.id || "streaming",
                                details: "",
                                variants: []
                              });
                              setVarId("");
                              setVarName("");
                              setVarPrice(0);
                              setVarOriginalPrice(0);
                              setVarStock(10);
                              setVarStockType("numeric");
                              setEditingVarIndex(null);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all text-center w-full md:w-auto cursor-pointer justify-center font-sans font-medium"
                          >
                            <Plus className="w-4 h-4" />
                            Tambah Produk baru
                          </button>
                        </div>
                      </div>

                      {/* Bulk Category Change Bar */}
                      <AnimatePresence>
                        {selectedProductIds.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-5 overflow-hidden"
                          >
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-705">
                                  📦 {selectedProductIds.length} produk dipilih untuk diubah kategori secara massal
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedProductIds([])}
                                  className="text-[10px] text-rose-500 hover:text-rose-700 font-bold underline cursor-pointer"
                                >
                                  Reset pilihan
                                </button>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <select
                                  value={bulkTargetCategory}
                                  onChange={(e) => setBulkTargetCategory(e.target.value)}
                                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-hidden"
                                >
                                  <option value="">-- Pilih Kategori --</option>
                                  {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!bulkTargetCategory) {
                                      alert("Silakan pilih kategori tujuan terlebih dahulu.");
                                      return;
                                    }
                                    const targetCat = categories.find(c => c.id === bulkTargetCategory);
                                    triggerConfirm(
                                      "Ubah Kategori Secara Massal",
                                      `Apakah Anda yakin ingin memindahkan ${selectedProductIds.length} produk terpilih ke kategori "${targetCat?.name || bulkTargetCategory}"?`,
                                      async () => {
                                        const updatedProds = products.map(prod => {
                                          if (selectedProductIds.includes(prod.id)) {
                                            return { ...prod, category: bulkTargetCategory };
                                          }
                                          return prod;
                                        });
                                        await handleSaveDb(updatedProds);
                                        setSelectedProductIds([]);
                                        setBulkTargetCategory("");
                                      }
                                    );
                                  }}
                                  disabled={!bulkTargetCategory || isSavingDb}
                                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-lg text-xs transition-with-all cursor-pointer shadow-sm"
                                >
                                  {isSavingDb ? "Menyimpan..." : "Ubah Kategori"}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Products List Rendering grouped */}
                      {filteredProducts.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                          <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p className="text-sm font-semibold">Tidak ditemukan produk</p>
                          <p className="text-xs mt-1 max-w-xs mx-auto text-slate-400">Pasangkan keyword filter pencarian lain.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-6">
                          {categories.map(cat => {
                            const catProds = filteredProducts.filter(p => p.category === cat.id);
                            if (catProds.length === 0) return null;
                            
                            const isAllSelected = catProds.length > 0 && catProds.every(p => selectedProductIds.includes(p.id));

                            return (
                              <div key={cat.id} className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={isAllSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          // check all in this category
                                          const itemIds = catProds.map(p => p.id);
                                          setSelectedProductIds(prev => Array.from(new Set([...prev, ...itemIds])));
                                        } else {
                                          // uncheck all in this category
                                          const itemIds = catProds.map(p => p.id);
                                          setSelectedProductIds(prev => prev.filter(id => !itemIds.includes(id)));
                                        }
                                      }}
                                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer w-4 h-4"
                                      title="Pilih seluruh produk di kategori ini"
                                    />
                                    <h5 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5 select-none">
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                      {cat.name}
                                    </h5>
                                  </div>
                                  <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                                    {catProds.length} Item
                                  </span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                  {catProds.map((prod, idx) => (
                                    <motion.div
                                      key={prod.id}
                                      initial={{ opacity: 0, y: 15 }}
                                      whileInView={{ opacity: 1, y: 0 }}
                                      viewport={{ once: true, margin: "-10px" }}
                                      transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.2) }}
                                      className="p-4 hover:bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                                    >
                                      {/* Checkbox for Bulk Actions */}
                                      <div className="md:self-center mr-1 flex items-center">
                                        <input
                                          type="checkbox"
                                          checked={selectedProductIds.includes(prod.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedProductIds((prev) => [...prev, prod.id]);
                                            } else {
                                              setSelectedProductIds((prev) => prev.filter((id) => id !== prod.id));
                                            }
                                          }}
                                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer w-4 h-4"
                                        />
                                      </div>

                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <h6 className="font-bold text-sm text-slate-900">{prod.name}</h6>
                                          <span className="text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 text-slate-600 rounded">
                                            {prod.id}
                                          </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-mono line-clamp-2 mt-1.5 whitespace-pre-wrap max-w-xl">
                                          {prod.details}
                                        </p>
                                        
                                        {prod.variants && prod.variants.length > 0 && (
                                          <div className="flex flex-wrap gap-1.5 mt-2.5 items-center">
                                            <span className="text-[9.5px] uppercase font-black text-slate-400 mr-1 tracking-wider">📦 Opsi Paket:</span>
                                            {prod.variants.map((v, i) => (
                                              <span key={i} className="text-[10px] font-sans font-bold text-indigo-700 bg-indigo-50/50 border border-indigo-100 px-2.5 py-0.5 rounded-lg select-all flex items-center gap-1">
                                                <span>{v.name}</span>
                                                <span className="opacity-50 font-normal text-indigo-400">•</span>
                                                <span className="text-indigo-900 font-black">Rp{v.price.toLocaleString("id-ID")}</span>
                                                {v.stockType === "UNKNOWN" ? (
                                                  <>
                                                    <span className="opacity-20">|</span>
                                                    <span className="text-slate-500 text-[9px] font-medium">Stok: Ready</span>
                                                  </>
                                                ) : (
                                                  v.stock !== undefined && (
                                                    <>
                                                      <span className="opacity-20">|</span>
                                                      <span className="text-slate-500 text-[9px] font-medium">Stok: {v.stock}</span>
                                                    </>
                                                  )
                                                )}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2 mt-3.5 text-[10.5px]">
                                          <span className="flex items-center gap-1 text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-lg font-semibold font-sans">
                                            💵 Harga: <b>{prod.variants && prod.variants.length > 0 ? `Mulai Rp${Math.min(...prod.variants.map(v => v.price || 0)).toLocaleString("id-ID")}` : "Hubungi Admin"}</b>
                                          </span>
                                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold border font-sans ${
                                            (prod.variants && prod.variants.some(v => v.stockType === "UNKNOWN"))
                                              ? "text-teal-700 bg-teal-50 border-teal-150"
                                              : (prod.variants && prod.variants.reduce((acc, v) => acc + (v.stockType === "UNKNOWN" ? 0 : (v.stock ?? 10)), 0)) > 0 
                                                ? "text-indigo-700 bg-indigo-50 border-indigo-150" 
                                                : "text-rose-600 bg-rose-50 border-rose-150"
                                          }`}>
                                            📦 Stok: <b>{
                                              (prod.variants && prod.variants.some(v => v.stockType === "UNKNOWN"))
                                                ? "Tersedia (Ready)"
                                                : (prod.variants && prod.variants.length > 0)
                                                  ? `${prod.variants.reduce((acc, v) => acc + (v.stockType === "UNKNOWN" ? 0 : (v.stock ?? 10)), 0)} unit`
                                                  : "Habis"
                                            }</b>
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 justify-end">
                                        <button
                                          onClick={() => {
                                            setEditingProduct(prod);
                                            setVarId("");
                                            setVarName("");
                                            setVarPrice(0);
                                            setVarOriginalPrice(0);
                                            setVarStock(10);
                                            setEditingVarIndex(null);
                                          }}
                                          className="p-2 border border-slate-200 hover:border-slate-300 rounded-lg hover:bg-white text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                                          title="Edit detail produk"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteProduct(prod.id)}
                                          className="p-2 border border-red-100 hover:border-red-200 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700 transition-all cursor-pointer"
                                          title="Hapus produk"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* TAB 1.5: MANAJEMEN COMMANDS */}
              {activeTab === "commands" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-6"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                    <div className="flex flex-col">
                      <h3 className="font-bold text-slate-900 text-lg font-sans tracking-tight">Manajemen Command Bot</h3>
                      <p className="text-xs text-slate-500 font-sans">Kelola daftar command manual bot, trigger pesan, dan respon multimedia.</p>
                    </div>
                    {!isAddingCommand && !editingCommand && (
                      <button
                        onClick={() => {
                          setIsAddingCommand(true);
                          setCommandTrigger("");
                          setCommandResponse("");
                          setCommandDescription("");
                          setCommandMediaType("none");
                          setCommandMediaUrl("");
                        }}
                        className="text-xs bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-sm border border-slate-705 hover:border-slate-800 transition-all cursor-pointer font-sans"
                      >
                        <Plus className="w-4 h-4" />
                        Tambah Command Baru
                      </button>
                    )}
                  </div>

                  {/* DAFTAR TAG VARIABEL YANG TERSEDIA */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 shadow-xs">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="p-1 px-2 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-md uppercase tracking-wider">Info Tag</span>
                      <h4 className="text-xs font-bold text-slate-800 font-sans">Daftar Tag Variabel yang Tersedia</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                      Gunakan tag variabel di bawah ini di dalam respon teks command Anda. Tag akan otomatis diganti dengan data aslinya secara dinamis saat bot merespon pesan di WhatsApp.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                      <div className="p-3 bg-white border border-slate-150 rounded-xl hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between mb-1.5">
                          <code className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md select-all cursor-pointer" onClick={() => {
                            if (isAddingCommand || editingCommand) {
                              setCommandResponse(prev => prev + " {storeName}");
                            }
                          }} title="Klik untuk menyisipkan ke respon teks">{"{storeName}"}</code>
                          <span className="text-[9px] font-bold text-slate-400">Toko</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Menampilkan nama toko Anda (contoh: <span className="font-semibold text-slate-600">{settings.storeName || "WANZZ STORE"}</span>).</p>
                      </div>

                      <div className="p-3 bg-white border border-slate-150 rounded-xl hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between mb-1.5">
                          <code className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md select-all cursor-pointer" onClick={() => {
                            if (isAddingCommand || editingCommand) {
                              setCommandResponse(prev => prev + " {ownerNumber}");
                            }
                          }} title="Klik untuk menyisipkan ke respon teks">{"{ownerNumber}"}</code>
                          <span className="text-[9px] font-bold text-slate-400">Owner</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Nomor telepon owner lengkap dengan kode negara (contoh: <span className="font-semibold text-slate-600">{settings.ownerNumber || "6285712439395"}</span>).</p>
                      </div>

                      <div className="p-3 bg-white border border-slate-150 rounded-xl hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between mb-1.5">
                          <code className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md select-all cursor-pointer" onClick={() => {
                            if (isAddingCommand || editingCommand) {
                              setCommandResponse(prev => prev + " {catalog}");
                            }
                          }} title="Klik untuk menyisipkan ke respon teks">{"{catalog}"}</code>
                          <span className="text-[9px] font-bold text-slate-400">Katalog</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Format list katalog produk otomatis yang dirangkum berdasarkan kategori aktif.</p>
                      </div>

                      <div className="p-3 bg-white border border-slate-150 rounded-xl hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between mb-1.5">
                          <code className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md select-all cursor-pointer" onClick={() => {
                            if (isAddingCommand || editingCommand) {
                              setCommandResponse(prev => prev + " {name}");
                            }
                          }} title="Klik untuk menyisipkan ke respon teks">{"{name}"}</code>
                          <span className="text-[9px] font-bold text-slate-400">Pengirim</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Menampilkan nama pengirim pesan WhatsApp yang memicu bot secara live.</p>
                      </div>

                      <div className="p-3 bg-white border border-slate-150 rounded-xl hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between mb-1.5">
                          <code className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md select-all cursor-pointer" onClick={() => {
                            if (isAddingCommand || editingCommand) {
                              setCommandResponse(prev => prev + " {price}");
                            }
                          }} title="Klik untuk menyisipkan ke respon teks">{"{price}"}</code>
                          <span className="text-[9px] font-bold text-slate-400">Harga</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Menampilkan nominal harga produk jika dipicu melalui detail produk.</p>
                      </div>

                       <div className="p-3 bg-white border border-slate-150 rounded-xl hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between mb-1.5">
                          <code className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md select-all cursor-pointer" onClick={() => {
                            if (isAddingCommand || editingCommand) {
                              setCommandResponse(prev => prev + " {stock}");
                            }
                          }} title="Klik untuk menyisipkan ke respon teks">{"{stock}"}</code>
                          <span className="text-[9px] font-bold text-slate-400">Stok</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Menampilkan jumlah sisa stok produk aktif di katalog secara real-time.</p>
                      </div>

                      <div className="p-3 bg-white border border-slate-150 rounded-xl hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between mb-1.5">
                          <code className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md select-all cursor-pointer" onClick={() => {
                            if (isAddingCommand || editingCommand) {
                              setCommandResponse(prev => prev + " {orderId}");
                            }
                          }} title="Klik untuk menyisipkan ke respon teks">{"{orderId}"}</code>
                          <span className="text-[9px] font-bold text-slate-400">ID Order</span>
                         </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Menampilkan ID Pemesanan dinamis (contoh: #ORD-1025).</p>
                      </div>

                      <div className="p-3 bg-white border border-slate-150 rounded-xl hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between mb-1.5">
                          <code className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md select-all cursor-pointer" onClick={() => {
                            if (isAddingCommand || editingCommand) {
                              setCommandResponse(prev => prev + " {productName}");
                            }
                          }} title="Klik untuk menyisipkan ke respon teks">{"{productName}"}</code>
                          <span className="text-[9px] font-bold text-slate-400">Produk</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Menampilkan nama produk / layanan pilihan pelanggan.</p>
                      </div>

                      <div className="p-3 bg-white border border-slate-150 rounded-xl hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between mb-1.5">
                          <code className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md select-all cursor-pointer" onClick={() => {
                            if (isAddingCommand || editingCommand) {
                              setCommandResponse(prev => prev + " {categoryName}");
                            }
                          }} title="Klik untuk menyisipkan ke respon teks">{"{categoryName}"}</code>
                          <span className="text-[9px] font-bold text-slate-400">Kategori</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Menampilkan nama kategori produk tersebut di database.</p>
                      </div>

                      <div className="p-3 bg-white border border-slate-150 rounded-xl hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between mb-1.5">
                          <code className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md select-all cursor-pointer" onClick={() => {
                            if (isAddingCommand || editingCommand) {
                              setCommandResponse(prev => prev + " {details}");
                            }
                          }} title="Klik untuk menyisipkan ke respon teks">{"{details}"}</code>
                          <span className="text-[9px] font-bold text-slate-400">Rincian</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Menampilkan rincian penjelasan ataupun spesifikasi produk.</p>
                      </div>

                      <div className="p-3 bg-white border border-slate-150 rounded-xl hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between mb-1.5">
                          <code className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md select-all cursor-pointer" onClick={() => {
                            if (isAddingCommand || editingCommand) {
                              setCommandResponse(prev => prev + " {message}");
                            }
                          }} title="Klik untuk menyisipkan ke respon teks">{"{message}"}</code>
                          <span className="text-[9px] font-bold text-slate-400">Pesan</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Menampilkan pesan teks asli yang dikirim oleh pelanggan ke bot.</p>
                      </div>

                      <div className="p-3 bg-white border border-slate-150 rounded-xl hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between mb-1.5">
                          <code className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md select-all cursor-pointer" onClick={() => {
                            if (isAddingCommand || editingCommand) {
                              setCommandResponse(prev => prev + " {paymentTemplate}");
                            }
                          }} title="Klik untuk menyisipkan ke respon teks">{"{paymentTemplate}"}</code>
                          <span className="text-[9px] font-bold text-slate-400">Metode</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Menyisipkan draf/template rincian rekening instruksi pembayaran.</p>
                      </div>
                    </div>
                    {(isAddingCommand || editingCommand) && (
                      <p className="text-[10px] text-amber-600 mt-2.5 flex items-center gap-1.5 font-medium">
                        <span>💡</span>
                        <span>Tips: Klik salah satu tombol tag berwarna biru di atas untuk menyisipkannya langsung ke posisi akhir teks respon di form di bawah ini!</span>
                      </p>
                    )}
                  </div>

                  {/* Form panel for Add/Edit Command */}
                  {(isAddingCommand || editingCommand) && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="border border-slate-200 rounded-2xl p-5 mb-6 bg-slate-50/50"
                    >
                      <h4 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-500" />
                        {isAddingCommand ? "Buat Command Baru" : `Edit Command ".${editingCommand?.trigger}"`}
                      </h4>

                      <form onSubmit={isAddingCommand ? handleAddCommand : handleUpdateCommand} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">Trigger Keyword (Bisa banyak, pisahkan dengan koma)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-mono font-bold">. / !</span>
                              <input
                                type="text"
                                value={commandTrigger}
                                onChange={(e) => setCommandTrigger(e.target.value)}
                                placeholder="contoh: menu, start, bot, bantuan"
                                className="w-full text-xs font-mono font-bold border border-slate-200 focus:border-slate-400 focus:outline-[0px] rounded-xl pl-9 pr-3 py-2.5 bg-white shadow-xs"
                                required
                              />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Masukkan satu atau lebih keyword dipisahkan koma. Bot mendeteksi command ini jika diawali prefix (., /, atau !).</p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">Deskripsi Singkat</label>
                            <input
                              type="text"
                              value={commandDescription}
                              onChange={(e) => setCommandDescription(e.target.value)}
                              placeholder="Deskripsi fungsi command ini..."
                              className="w-full text-xs border border-slate-200 focus:border-slate-400 focus:outline-[0px] rounded-xl px-3 py-2.5 bg-white shadow-xs"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Hanya ditampilkan pada daftar menu internal dashboard.</p>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-xs font-bold text-slate-700">Respon Pesan Teks</label>
                            <div className="text-[10px] text-slate-400">Variabel: <code className="font-mono bg-slate-100 px-1 rounded font-bold cursor-pointer hover:bg-slate-200" onClick={() => setCommandResponse(prev => prev + " {storeName}")}>{"{storeName}"}</code>, <code className="font-mono bg-slate-100 px-1 rounded font-bold cursor-pointer hover:bg-slate-200" onClick={() => setCommandResponse(prev => prev + " {ownerNumber}")}>{"{ownerNumber}"}</code>, <code className="font-mono bg-slate-100 px-1 rounded font-bold cursor-pointer hover:bg-slate-200" onClick={() => setCommandResponse(prev => prev + " {catalog}")}>{"{catalog}"}</code>, <code className="font-mono bg-slate-100 px-1 rounded font-bold cursor-pointer hover:bg-slate-200" onClick={() => setCommandResponse(prev => prev + " {name}")}>{"{name}"}</code></div>
                          </div>
                          <textarea
                            value={commandResponse}
                            onChange={(e) => setCommandResponse(e.target.value)}
                            placeholder="Tulis draf respon teks trigger di sini..."
                            rows={8}
                            className="w-full text-xs border border-slate-200 focus:border-slate-400 focus:outline-[0px] rounded-xl p-3 bg-white shadow-xs"
                            required
                          />
                        </div>

                        <div className="border-t border-slate-150 pt-4">
                          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                            <Image className="w-3.5 h-3.5 text-slate-500" />
                            Lampiran File Media (Foto / Video)
                          </label>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-[11px] text-slate-500 mb-1">Tipe Media</label>
                              <select
                                value={commandMediaType}
                                onChange={(e) => setCommandMediaType(e.target.value as any)}
                                className="w-full text-xs border border-slate-200 focus:border-slate-400 focus:outline-[0px] rounded-xl px-3 py-2.5 bg-white shadow-xs cursor-pointer"
                              >
                                <option value="none">Tanpa Media (Teks Saja)</option>
                                <option value="image">Gambar / Foto (Image)</option>
                                <option value="video">Video (MP4)</option>
                              </select>
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-[11px] text-slate-500 mb-1">Pilih File Media atau Masukkan URL Base64/Direct</label>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <input
                                    type="text"
                                    value={commandMediaUrl}
                                    onChange={(e) => setCommandMediaUrl(e.target.value)}
                                    placeholder="Tempel tautan asset gambar/video atau unggah file di samping..."
                                    className="w-full text-xs border border-slate-200 focus:border-slate-400 focus:outline-[0px] rounded-xl px-3 py-2.5 bg-white shadow-xs"
                                    disabled={commandMediaType === "none"}
                                  />
                                </div>
                                <label className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2 border rounded-xl shadow-xs transition-all cursor-pointer select-none shrink-0 ${
                                  commandMediaType === "none" ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed" : "bg-white hover:bg-slate-50 text-slate-755 border-slate-200"
                                }`}>
                                  <Film className="w-3.5 h-3.5" />
                                  Unggah File
                                  <input
                                    type="file"
                                    accept={commandMediaType === "image" ? "image/*" : commandMediaType === "video" ? "video/*" : "*"}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    disabled={commandMediaType === "none"}
                                  />
                                </label>
                              </div>
                              {mediaUploadLoading && <p className="text-[10px] text-slate-400 mt-1">Membaca file...</p>}
                              {mediaUploadError && <p className="text-[10px] text-red-500 mt-1">{mediaUploadError}</p>}
                            </div>
                          </div>

                          {commandMediaType !== "none" && commandMediaUrl && (
                            <div className="mt-3 p-3 border border-slate-200 rounded-xl bg-white max-w-sm">
                              <span className="text-[10px] font-bold text-slate-400 block mb-1">Pratinjau Media Lampiran:</span>
                              {commandMediaType === "image" ? (
                                <img
                                  src={commandMediaUrl}
                                  alt="Preview"
                                  className="max-h-32 object-contain rounded-lg border border-slate-100 bg-slate-50"
                                  onError={(e) => {
                                    (e.target as any).src = "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?q=80&w=2629&auto=format&fit=crop";
                                  }}
                                />
                              ) : (
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2">
                                  <Film className="w-5 h-5 text-indigo-505" />
                                  <div className="flex flex-col overflow-hidden">
                                    <span className="text-xs font-bold text-slate-700">Lampiran Video Aktif</span>
                                    <span className="text-[9px] text-slate-400 truncate max-w-xs">{commandMediaUrl.slice(0, 50)}...</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-150 pt-4 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingCommand(false);
                              setEditingCommand(null);
                              setCommandTrigger("");
                              setCommandResponse("");
                              setCommandDescription("");
                              setCommandMediaType("none");
                              setCommandMediaUrl("");
                            }}
                            className="text-xs font-semibold hover:bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl border border-slate-200 cursor-pointer transition-all"
                          >
                            Batal
                          </button>
                          <button
                            type="submit"
                            className="text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl border border-slate-700 shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                          >
                            <Save className="w-4 h-4" />
                            Simpan Command
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}

                  {/* List of Dynamic Commands */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <h4 className="font-bold text-slate-950 text-xs tracking-tight">DAFTAR COMMAND KUSTOM</h4>
                      <span className="text-[10px] text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg font-medium self-start md:self-auto">
                        ℹ️ Kelola respon command kustom buatan Anda di bawah ini. Untuk mengedit pesan sistem bawaan (Sapaan, Menu, Pembayaran, Kontak, dll.), silakan gunakan tab "Template Pesan & Auto-Response".
                      </span>
                    </div>

                    <div className="divide-y divide-slate-150">
                      {commands.filter(c => !["menu", "list", "payment", "owner", "order"].includes(c.id)).length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                          <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-xs">Belum ada command kustom yang terdaftar.</p>
                        </div>
                      ) : (
                        commands.filter(c => !["menu", "list", "payment", "owner", "order"].includes(c.id)).map((cmd) => (
                          <div key={cmd.id} className="p-4 hover:bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all">
                            <div className="flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {cmd.trigger.split(",").map((trig, idx) => (
                                  <span key={idx} className="bg-slate-100 font-mono font-bold text-xs select-all text-slate-805 border border-slate-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                                    <span className="text-slate-400 font-semibold select-none">. / !</span>
                                    {trig.trim()}
                                  </span>
                                ))}
                                
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-0.5 shadow-xs">
                                  ✨ Kustom Baru
                                </span>

                                {cmd.description && (
                                  <span className="text-slate-500 text-[10px] font-semibold">{cmd.description}</span>
                                )}
                                {cmd.mediaType !== "none" && (
                                  <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                                    {cmd.mediaType === "image" ? <Image className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                                    Media {cmd.mediaType === "image" ? "Caption" : "Video"}
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-600 text-xs font-sans whitespace-pre-wrap max-w-2xl line-clamp-2 mt-2 leading-relaxed font-normal bg-slate-50/50 border border-slate-100 rounded-lg p-2 font-mono">
                                {cmd.response}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingCommand(cmd);
                                  setIsAddingCommand(false);
                                  setCommandTrigger(cmd.trigger);
                                  setCommandResponse(cmd.response);
                                  setCommandDescription(cmd.description || "");
                                  setCommandMediaType(cmd.mediaType);
                                  setCommandMediaUrl(cmd.mediaUrl || "");
                                }}
                                className="p-2 border border-slate-200 hover:border-slate-300 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                                title="Edit detail command"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              
                              <button
                                onClick={() => handleDeleteCommand(cmd.id, cmd.trigger)}
                                className="p-2 border border-red-150 hover:border-red-250 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700 transition-all cursor-pointer"
                                title="Hapus command"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 2: AUTORESPONSE TEMPLATE SETTINGS */}
              {activeTab === "settings" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-6"
                >
                  <div className="mb-6 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">Autoreply Template Editor</h4>
                      <p className="text-xs text-slate-500">Sesuaikan sapaan toko, tata letak menu katalog, dan format balasan detail produk.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-6">
                    {/* General Variables card */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                      <span className="font-bold text-slate-800 block mb-2">Tag Variabel yang Tersedia:</span>
                      <p className="text-slate-600 mb-2 leading-relaxed">
                        Anda dapat memakai tag dinamis ini di dalam input teks agar pesan bertransformasi otomatis:
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="p-2 bg-white rounded-lg border border-slate-200"><code className="font-bold text-pink-600 font-mono select-all">&#123;name&#125;</code> &rarr; <span className="text-[10px] text-slate-500">Nama Customer</span></div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200"><code className="font-bold text-pink-600 font-mono select-all">&#123;storeName&#125;</code> &rarr; <span className="text-[10px] text-slate-500">Nama Toko</span></div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200"><code className="font-bold text-pink-600 font-mono select-all">&#123;catalog&#125;</code> &rarr; <span className="text-[10px] text-slate-500">Katalog Produk</span></div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200"><code className="font-bold text-pink-600 font-mono select-all">&#123;productName&#125;</code> &rarr; <span className="text-[10px] text-slate-500">Nama Layanan</span></div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200"><code className="font-bold text-pink-600 font-mono select-all">&#123;categoryName&#125;</code> &rarr; <span className="text-[10px] text-slate-500">Kategori</span></div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200"><code className="font-bold text-pink-600 font-mono select-all">&#123;details&#125;</code> &rarr; <span className="text-[10px] text-slate-500">Rincian Harga</span></div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200"><code className="font-bold text-pink-600 font-mono select-all">&#123;message&#125;</code> &rarr; <span className="text-[10px] text-slate-500">Pesan Pelanggan</span></div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200"><code className="font-bold text-pink-600 font-mono select-all">&#123;ownerNumber&#125;</code> &rarr; <span className="text-[10px] text-slate-500">Nomor Owner</span></div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200"><code className="font-bold text-pink-600 font-mono select-all">&#123;orderId&#125;</code> &rarr; <span className="text-[10px] text-slate-500">ID Pesanan</span></div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200"><code className="font-bold text-pink-600 font-mono select-all">&#123;paymentTemplate&#125;</code> &rarr; <span className="text-[10px] text-slate-500">Template Pembayaran</span></div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200"><code className="font-bold text-pink-600 font-mono select-all">&#123;price&#125;</code> &rarr; <span className="text-[10px] text-slate-500">Harga Layanan</span></div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200"><code className="font-bold text-pink-600 font-mono select-all">&#123;stock&#125;</code> &rarr; <span className="text-[10px] text-slate-500">Stok Layanan</span></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Store settings */}
                      <div className="p-4 rounded-2xl border border-slate-100 flex flex-col gap-4">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-500">Sistem & Identitas</span>
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Nama Toko Bisnis Anda</label>
                          <input
                            type="text"
                            value={settings.storeName}
                            onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Nomor Kontak Owner (WhatsApp)</label>
                          <input
                            type="text"
                            placeholder="Contoh: 628123456789 (Hanya angka)"
                            value={settings.ownerNumber || ""}
                            onChange={(e) => setSettings({ ...settings, ownerNumber: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1 flex justify-between">
                            <span>Kirim Banner Gambar Bersama Menu</span>
                            <input 
                              type="checkbox"
                              checked={settings.sendMenuWithImage}
                              onChange={(e) => setSettings({ ...settings, sendMenuWithImage: e.target.checked })}
                              className="accent-slate-900"
                            />
                          </label>
                          <input
                            type="url"
                            disabled={!settings.sendMenuWithImage}
                            placeholder="Masukkan link gambar menu (Direct Image URL)"
                            value={settings.menuImageUrl || ""}
                            onChange={(e) => setSettings({ ...settings, menuImageUrl: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden disabled:opacity-50 mt-1 mb-2"
                          />
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] text-slate-400 font-medium">Atau unggah file:</span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={!settings.sendMenuWithImage}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setSettings({ ...settings, menuImageUrl: reader.result as string });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 disabled:opacity-50"
                            />
                          </div>
                          {settings.menuImageUrl && (
                            <div className="mt-2 flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-150 animate-fade-in animate-duration-200">
                              <img
                                src={settings.menuImageUrl}
                                alt="Menu Preview"
                                className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-white"
                                referrerPolicy="no-referrer"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-slate-705">Pratinjau Gambar Menu</p>
                                <p className="text-[9px] text-slate-400 truncate">
                                  {settings.menuImageUrl.startsWith("data:") ? "Gambar Terunggah" : settings.menuImageUrl}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSettings({ ...settings, menuImageUrl: "" })}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus foto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="border-t border-slate-100 pt-4 mt-2">
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Whitelist Group WhatsApp
                          </label>
                          <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                            Bot hanya merespon di group whitelisted berikut (opsional, bot selalu merespon personal chat). ID group biasanya berakhiran <code className="font-mono bg-slate-100 px-1 rounded">@g.us</code>.
                          </p>
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={newGroupIdInput}
                              onChange={(e) => setNewGroupIdInput(e.target.value)}
                              placeholder="Masukkan ID Group (contoh: 120363425@g.us)..."
                              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const cleanId = newGroupIdInput.trim();
                                if (!cleanId) return;
                                let targetId = cleanId;
                                if (!cleanId.endsWith("@g.us") && !cleanId.endsWith("@s.whatsapp.net")) {
                                  if (/^\d+$/.test(cleanId) || cleanId.includes("-")) {
                                    targetId = cleanId + "@g.us";
                                  }
                                }
                                if ((settings.whitelistedGroups || []).includes(targetId)) {
                                  setNewGroupIdInput("");
                                  return;
                                }
                                setSettings({
                                  ...settings,
                                  whitelistedGroups: [...(settings.whitelistedGroups || []), targetId]
                                });
                                setNewGroupIdInput("");
                              }}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all"
                            >
                              Tambah
                            </button>
                          </div>
                          
                          {/* List of Whitelisted Groups */}
                          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto border border-slate-100 rounded-xl p-2 bg-slate-50">
                            {(settings.whitelistedGroups || []).length === 0 ? (
                              <span className="text-[10px] text-slate-400 text-center py-2">
                                Belum ada group whitelisted. Bot hanya merespon group default (jika ada) dan chat pribadi.
                              </span>
                            ) : (
                              (settings.whitelistedGroups || []).map((groupId) => (
                                <div key={groupId} className="flex justify-between items-center bg-white border border-slate-100 px-2.5 py-1 rounded-lg text-xs font-mono text-slate-600">
                                  <span className="truncate max-w-[200px]" title={groupId}>{groupId}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSettings({
                                        ...settings,
                                        whitelistedGroups: (settings.whitelistedGroups || []).filter(id => id !== groupId)
                                      });
                                    }}
                                    className="text-red-500 hover:text-red-700 text-[10px] font-bold ml-2 px-1 py-0.5 rounded hover:bg-red-50"
                                  >
                                    Hapus
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Welcome sapaan & Owner Contact */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Welcome Sapaan */}
                        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-xs space-y-3">
                          <span className="font-bold text-xs uppercase tracking-wider text-slate-500">Sapaan Selamat Datang (Greeting)</span>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Draf Teks Sapaan (Tag: &#123;name&#125;, &#123;storeName&#125;)</label>
                            <textarea
                              rows={5}
                              value={settings.welcomeTemplate}
                              onChange={(e) => setSettings({ ...settings, welcomeTemplate: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Banner Gambar Sapaan</label>
                            <input
                              type="url"
                              placeholder="Masukkan URL gambar banner sapaan..."
                              value={settings.welcomeImageUrl || ""}
                              onChange={(e) => setSettings({ ...settings, welcomeImageUrl: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden mb-2"
                            />
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] text-slate-400 font-medium">Atau unggah file:</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setSettings({ ...settings, welcomeImageUrl: reader.result as string });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200"
                              />
                            </div>
                            {settings.welcomeImageUrl && (
                              <div className="mt-2 flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-150 animate-fade-in animate-duration-200">
                                <img
                                  src={settings.welcomeImageUrl}
                                  alt="Greeting Preview"
                                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-white"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold text-slate-705">Pratinjau Banner Sapaan</p>
                                  <p className="text-[9px] text-slate-400 truncate">
                                    {settings.welcomeImageUrl.startsWith("data:") ? "Gambar Terunggah" : settings.welcomeImageUrl}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSettings({ ...settings, welcomeImageUrl: "" })}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus foto"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Owner Contact */}
                        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-xs space-y-3">
                          <span className="font-bold text-xs uppercase tracking-wider text-slate-500">Hubungi Owner (Owner Contact)</span>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Draf Teks Kontak (Tag: &#123;storeName&#125;, &#123;ownerNumber&#125;)</label>
                            <textarea
                              rows={5}
                              value={settings.ownerTemplate || ""}
                              onChange={(e) => setSettings({ ...settings, ownerTemplate: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Banner Gambar Kontak Owner</label>
                            <input
                              type="url"
                              placeholder="Masukkan URL banner gambar kontak owner..."
                              value={settings.ownerImageUrl || ""}
                              onChange={(e) => setSettings({ ...settings, ownerImageUrl: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden mb-2"
                            />
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] text-slate-400 font-medium">Atau unggah file:</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setSettings({ ...settings, ownerImageUrl: reader.result as string });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200"
                              />
                            </div>
                            {settings.ownerImageUrl && (
                              <div className="mt-2 flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-150 animate-fade-in animate-duration-200">
                                <img
                                  src={settings.ownerImageUrl}
                                  alt="Owner Preview"
                                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-white"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold text-slate-705">Pratinjau Banner Owner</p>
                                  <p className="text-[9px] text-slate-400 truncate">
                                    {settings.ownerImageUrl.startsWith("data:") ? "Gambar Terunggah" : settings.ownerImageUrl}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSettings({ ...settings, ownerImageUrl: "" })}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus foto"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Info and Fallback templates */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Info Template */}
                        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-xs space-y-3">
                          <span className="font-bold text-xs uppercase tracking-wider text-slate-500">Info Detail Produk</span>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1 flex justify-between">
                              <span>Draf Teks Detail (Wajib &#123;details&#125;)</span>
                            </label>
                            <textarea
                              rows={5}
                              value={settings.infoTemplate}
                              onChange={(e) => setSettings({ ...settings, infoTemplate: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Gambar Default Detail Produk</label>
                            <input
                              type="url"
                              placeholder="Masukkan URL gambar produk default..."
                              value={settings.infoImageUrl || ""}
                              onChange={(e) => setSettings({ ...settings, infoImageUrl: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden mb-2"
                            />
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] text-slate-400 font-medium">Atau unggah file:</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setSettings({ ...settings, infoImageUrl: reader.result as string });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200"
                              />
                            </div>
                            {settings.infoImageUrl && (
                              <div className="mt-2 flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-150 animate-fade-in animate-duration-200">
                                <img
                                  src={settings.infoImageUrl}
                                  alt="Info Preview"
                                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-white"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold text-slate-705">Pratinjau Gambar Detail</p>
                                  <p className="text-[9px] text-slate-400 truncate">
                                    {settings.infoImageUrl.startsWith("data:") ? "Gambar Terunggah" : settings.infoImageUrl}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSettings({ ...settings, infoImageUrl: "" })}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus foto"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Fallback Template */}
                        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-xs space-y-3">
                          <span className="font-bold text-xs uppercase tracking-wider text-slate-500">Fallback (Kata Kunci Gagal)</span>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Draf Teks Fallback (Tag: &#123;message&#125;, &#123;name&#125;)</label>
                            <textarea
                              rows={5}
                              value={settings.fallbackTemplate}
                              onChange={(e) => setSettings({ ...settings, fallbackTemplate: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Banner Gambar Fallback</label>
                            <input
                              type="url"
                              placeholder="Masukkan URL gambar fallback default..."
                              value={settings.fallbackImageUrl || ""}
                              onChange={(e) => setSettings({ ...settings, fallbackImageUrl: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden mb-2"
                            />
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] text-slate-400 font-medium">Atau unggah file:</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setSettings({ ...settings, fallbackImageUrl: reader.result as string });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200"
                              />
                            </div>
                            {settings.fallbackImageUrl && (
                              <div className="mt-2 flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-150 animate-fade-in animate-duration-200">
                                <img
                                  src={settings.fallbackImageUrl}
                                  alt="Fallback Preview"
                                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-white"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold text-slate-705">Pratinjau Gambar Fallback</p>
                                  <p className="text-[9px] text-slate-400 truncate">
                                    {settings.fallbackImageUrl.startsWith("data:") ? "Gambar Terunggah" : settings.fallbackImageUrl}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSettings({ ...settings, fallbackImageUrl: "" })}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus foto"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Menu and List Catalog templates */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Menu Template */}
                        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-xs space-y-3">
                          <span className="font-bold text-xs uppercase tracking-wider text-slate-500">Tampilan Menu Utama (/menu)</span>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Draf Teks Menu Utama (Tag: &#123;storeName&#125;)</label>
                            <textarea
                              rows={8}
                              value={settings.menuTemplate || ""}
                              onChange={(e) => setSettings({ ...settings, menuTemplate: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                              Digunakan untuk pesan respon utama ketika pelanggan mengetik <b>/menu</b>.
                            </p>
                          </div>
                        </div>

                        {/* List Catalog Template */}
                        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-xs space-y-3">
                          <span className="font-bold text-xs uppercase tracking-wider text-slate-500">Tampilan Daftar Katalog (/list)</span>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Draf Teks Daftar Katalog (Wajib: &#123;catalog&#125;, &#123;storeName&#125;)</label>
                            <textarea
                              rows={8}
                              value={settings.listTemplate || ""}
                              onChange={(e) => setSettings({ ...settings, listTemplate: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                              Digunakan saat pelanggan mengetik <b>/list</b> untuk menampilkan seluruh list produk per kategori.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Payment instructions & Order Success Notification */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Payment Template */}
                        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-xs space-y-3">
                          <span className="font-bold text-xs uppercase tracking-wider text-slate-500">Rincian Pembayaran (Payment Details)</span>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Draf Informasi Rekening / E-Wallet</label>
                            <textarea
                              rows={7}
                              value={settings.paymentTemplate || ""}
                              onChange={(e) => setSettings({ ...settings, paymentTemplate: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Tautan QRIS atau Upload Gambar Pembayaran</label>
                            <input
                              type="text"
                              placeholder="Direct QRIS Image URL atau upload file..."
                              value={settings.paymentQrisUrl || ""}
                              onChange={(e) => setSettings({ ...settings, paymentQrisUrl: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden mb-2"
                            />
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] text-slate-400 font-medium">Atau unggah QRIS:</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setSettings({ ...settings, paymentQrisUrl: reader.result as string });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200"
                              />
                            </div>
                            {settings.paymentQrisUrl && (
                              <div className="mt-2 flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-150 animate-fade-in animate-duration-200">
                                <img
                                  src={settings.paymentQrisUrl}
                                  alt="QRIS Preview"
                                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-white"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold text-slate-705">Pratinjau QRIS / Gambar Pembayaran</p>
                                  <p className="text-[9px] text-slate-400 truncate">
                                    {settings.paymentQrisUrl.startsWith("data:") ? "Gambar Terunggah" : settings.paymentQrisUrl}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSettings({ ...settings, paymentQrisUrl: "" })}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus foto"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Order Success Template Editor */}
                        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-xs space-y-3">
                          <span className="font-bold text-xs uppercase tracking-wider text-slate-500">Format Sukses Order (Order Success)</span>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1 flex justify-between">
                              <span>Format Pesan Balasan Sukses (Tag: &#123;orderId&#125;, &#123;productName&#125;, &#123;price&#125;, &#123;name&#125;, &#123;paymentTemplate&#125;)</span>
                            </label>
                            <textarea
                              rows={7}
                              placeholder="Masukkan draf format pesan ketika order berhasil..."
                              value={settings.orderSuccessTemplate || ""}
                              onChange={(e) => setSettings({ ...settings, orderSuccessTemplate: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Banner Gambar Sukses Order</label>
                            <input
                              type="url"
                              placeholder="Masukkan URL banner order berhasil..."
                              value={settings.orderSuccessImageUrl || ""}
                              onChange={(e) => setSettings({ ...settings, orderSuccessImageUrl: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden mb-2"
                            />
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] text-slate-400 font-medium">Atau unggah file:</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setSettings({ ...settings, orderSuccessImageUrl: reader.result as string });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200"
                              />
                            </div>
                            {settings.orderSuccessImageUrl && (
                              <div className="mt-2 flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-150 animate-fade-in animate-duration-200">
                                <img
                                  src={settings.orderSuccessImageUrl}
                                  alt="Success Preview"
                                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-white"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold text-slate-705">Pratinjau Banner Sukses Order</p>
                                  <p className="text-[9px] text-slate-400 truncate">
                                    {settings.orderSuccessImageUrl.startsWith("data:") ? "Gambar Terunggah" : settings.orderSuccessImageUrl}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSettings({ ...settings, orderSuccessImageUrl: "" })}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus foto"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                    {/* Save actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => fetchDatabase()}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-semibold text-xs cursor-pointer hover:bg-slate-50"
                      >
                        Mundurkan Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveDb(products, settings)}
                        disabled={isSavingDb}
                        className="px-6 py-2.5 rounded-xl bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-slate-100 transition-all disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {isSavingDb ? "Sedang Menyimpan..." : "Simpan Semua Konfigurasi"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: SIMULATOR & LOG TERMINAL */}
              {activeTab === "simulator" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6"
                >
                  
                  {/* Left Section: Live Chat Simulator Device with control options */}
                  <div className="md:col-span-5 flex flex-col gap-3">
                    {/* Simulator Configuration Panel */}
                    <div className="bg-slate-55 border border-slate-200 rounded-3xl p-4 flex flex-col gap-2.5 shadow-xs">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                        <span className="text-xs font-bold text-slate-800">Skenario Simulasi</span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold uppercase select-none">Config</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Nama Pengirim</label>
                          <input
                            type="text"
                            value={simName}
                            onChange={(e) => setSimName(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-400 focus:ring-1 focus:ring-slate-400 bg-white text-slate-800"
                            placeholder="Ahmad"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Lokasi Chat</label>
                          <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white p-0.5 gap-0.5 h-[34px] items-center">
                            <button
                              type="button"
                              onClick={() => setSimChatScope("whitelisted")}
                              className={`flex-1 text-[8.5px] h-full font-bold rounded-lg transition-all cursor-pointer ${
                                simChatScope === "whitelisted" 
                                  ? "bg-emerald-600 text-white shadow-2xs" 
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              Whitelist
                            </button>
                            <button
                              type="button"
                              onClick={() => setSimChatScope("other_group")}
                              className={`flex-1 text-[8.5px] h-full font-bold rounded-lg transition-all cursor-pointer ${
                                simChatScope === "other_group" 
                                  ? "bg-rose-600 text-white shadow-2xs" 
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              Grup Lain
                            </button>
                            <button
                              type="button"
                              onClick={() => setSimChatScope("private")}
                              className={`flex-1 text-[8.5px] h-full font-bold rounded-lg transition-all cursor-pointer ${
                                simChatScope === "private" 
                                  ? "bg-rose-600 text-white shadow-2xs" 
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              Private
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chat Device */}
                    <div className="border border-slate-200 rounded-3xl overflow-hidden flex flex-col bg-[#ece5dd] shadow-inner h-[420px]">
                      
                      {/* Device header banner */}
                      <div className="bg-[#075e54] text-white p-3 flex items-center gap-2.5 shrink-0">
                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 select-none">
                          {simChatScope === "private" ? "W" : "G"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-xs block truncate">
                            {simChatScope === "whitelisted" 
                              ? "Grup Resmi Wanzt Store" 
                              : simChatScope === "other_group" 
                                ? "Grup Komunitas Lain" 
                                : `${settings.storeName} WA BOT`
                            }
                          </span>
                          <span className="text-[10px] text-[#25d366] font-semibold animate-pulse block">
                            {simChatScope === "whitelisted" 
                              ? "● Grup Resmi (120363425916568709@g.us)" 
                              : simChatScope === "other_group" 
                                ? "● Grup Lain (Terblokir)" 
                                : "● Private Chat (Terblokir)"
                            }
                          </span>
                        </div>
                      </div>

                      {/* Device Screen Body messages scroll */}
                      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                        {simExchange.map((chat, idx) => (
                          <div
                            key={idx}
                            className={`max-w-[85%] rounded-xl px-3 py-2 flex flex-col gap-0.5 shadow-2xs leading-relaxed ${
                              chat.type === "user"
                                ? "bg-[#dcf8c6] text-slate-800 self-end rounded-tr-none text-right"
                                : "bg-white text-slate-800 self-start rounded-tl-none pr-6"
                            }`}
                          >
                            <span className="text-[9px] font-bold text-emerald-800/70 select-none">{chat.sender}</span>
                            {chat.imageUrl && (
                              <div className="mt-1 mb-2 bg-slate-50 border border-slate-100 p-1.5 rounded-lg flex flex-col items-center justify-center">
                                <img 
                                  src={chat.imageUrl} 
                                  alt="QRIS Code" 
                                  className="max-h-48 max-w-full rounded-md object-contain"
                                  referrerPolicy="no-referrer"
                                />
                                <span className="text-[8.5px] text-slate-400 uppercase tracking-widest font-bold mt-1 font-mono">Attachment: Image File</span>
                              </div>
                            )}
                            {chat.videoUrl && (
                              <div className="mt-1 mb-2 bg-slate-50 border border-slate-100 p-1.5 rounded-lg flex flex-col items-center justify-center">
                                <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-xl flex items-center gap-2 max-w-full">
                                  <Film className="w-5 h-5 text-indigo-500 shrink-0" />
                                  <div className="flex flex-col text-left overflow-hidden">
                                    <span className="text-[10.5px] font-bold text-slate-700">Attachment: Video File</span>
                                    <span className="text-[9px] text-slate-400 truncate max-w-[130px]">{chat.videoUrl.slice(0, 40)}...</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            <span className="text-xs whitespace-pre-wrap text-left select-all">{chat.text}</span>
                            {chat.isSingleSelect ? (
                              <div className="mt-2.5 border-t border-slate-100 pt-2 text-left font-sans">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenListIdx(openListIdx === idx ? null : idx);
                                  }}
                                  className="w-full py-2 px-3 bg-white hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 active:bg-emerald-100 border border-emerald-100 shadow-2xs rounded-lg flex items-center justify-between text-[11px] font-extrabold transition-all cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                    <span>{chat.buttonTitle || "Daftar List Produk"}</span>
                                  </div>
                                  <span className="text-slate-400 text-xs font-bold font-mono transition-transform duration-200">
                                    {openListIdx === idx ? "▼" : "▶"}
                                  </span>
                                </button>
                                
                                {openListIdx === idx && chat.buttons && chat.buttons.length > 0 && (
                                  <div className="mt-2 bg-emerald-50/40 border border-emerald-100/50 rounded-lg overflow-hidden flex flex-col divide-y divide-emerald-100/30 shadow-xs animate-fadeIn">
                                    <div className="px-2.5 py-1.5 bg-emerald-50 text-[8px] font-bold text-emerald-700 uppercase tracking-widest select-none font-sans text-center">
                                      📱 Pilih Rincian Produk
                                    </div>
                                    {chat.buttons.map((btn: any, btnIdx: number) => (
                                      <button
                                        key={btnIdx}
                                        type="button"
                                        onClick={() => {
                                          handleSimulateSend(undefined, btn.id);
                                          setOpenListIdx(null);
                                        }}
                                        className="w-full py-2 px-3 hover:bg-emerald-50 text-left text-[11px] text-slate-700 hover:text-emerald-950 font-bold flex flex-col cursor-pointer transition-colors"
                                      >
                                        <span className="text-slate-800">{btn.text}</span>
                                        <span className="text-[8px] text-slate-400 font-medium">Ketuk untuk rincian produk ini</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              chat.buttons && chat.buttons.length > 0 && (
                                <div className="mt-2.5 flex flex-col gap-1 border-t border-slate-100 pt-2 bg-slate-50/50 p-1.5 rounded-lg">
                                  <span className="text-[8px] uppercase tracking-wider font-bold text-slate-400 select-none mb-1 text-center font-sans">Tombol Interaktif (Balasan/Buka Menu)</span>
                                  <div className="flex flex-wrap gap-1.5 justify-start">
                                    {chat.buttons.map((btn: any, btnIdx: number) => (
                                      <button
                                        key={btnIdx}
                                        type="button"
                                        onClick={() => {
                                          handleSimulateSend(undefined, btn.id);
                                        }}
                                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 hover:text-emerald-900 border border-emerald-200 cursor-pointer rounded-full text-[10px] font-extrabold flex items-center gap-1 transition-all"
                                      >
                                        <span>{btn.text}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )
                            )}
                            {chat.isHidetag && (
                              <div className="mt-1.5 flex items-center gap-1 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg text-[8.5px] text-indigo-700 font-bold select-none max-w-max">
                                👥 Mentions: All group members (Hidden Tag)
                              </div>
                            )}
                            <span className="text-[9px] text-slate-400 self-end mt-0.5 select-none">{chat.time}</span>
                          </div>
                        ))}
                        {isSimulating && (
                          <div className="bg-white max-w-[40%] rounded-xl px-3 py-2 self-start rounded-tl-none font-bold text-xs text-slate-400 animate-pulse">
                            Membalas otomatis...
                          </div>
                        )}
                        <div ref={simulationEndRef} />
                      </div>

                      {/* Device Keyboard Sender */}
                      <form onSubmit={handleSimulateSend} className="p-2.5 bg-slate-100 border-t border-slate-200 shrink-0 flex gap-2">
                        <div className="flex gap-1 items-center bg-white rounded-full px-3 py-1 flex-1 border border-slate-200 shadow-2xs">
                          <input
                            type="text"
                            required
                            placeholder="Ketik chat cth: /menu atau NETFLIX"
                            value={simMessage}
                            onChange={(e) => setSimMessage(e.target.value)}
                            className="w-full focus:outline-hidden text-xs py-1.5 text-slate-800 bg-transparent"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isSimulating}
                          className="bg-[#075e54] text-white p-2.5 rounded-full hover:bg-[#128c7e] cursor-pointer shadow-xs shrink-0 flex items-center justify-center transition-all disabled:opacity-50"
                        >
                          <Send className="w-4 h-4 ml-0.5" />
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Right Section: Real Server Connection Logs */}
                  <div className="md:col-span-7 flex flex-col gap-4">
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 flex-wrap gap-2">
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">Server Log History</span>
                        <p className="text-[11px] text-slate-400">Riwayat incoming / outgoing dari live bot & simulasi.</p>
                      </div>
                      <button
                        onClick={handleClearLogs}
                        disabled={logs.length === 0 || isClearingLogs}
                        className="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 select-none cursor-pointer disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear Log
                      </button>
                    </div>

                    {/* Logs console */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs flex flex-col flex-1 max-h-[360px]">
                      <div className="bg-slate-900 px-4 py-2 flex items-center gap-2 select-none shrink-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span className="text-[10px] font-mono font-bold text-slate-400 ml-2">Console logs output</span>
                      </div>
                      <div className="bg-slate-950 p-4 font-mono text-xs overflow-y-auto flex-1 flex flex-col gap-2.5 max-h-[320px]">
                        {logs.length === 0 ? (
                          <div className="text-center py-20 text-slate-500 font-mono text-xs">
                            [ System ] Menunggu log... Kosong atau belum ada chat masuk.
                          </div>
                        ) : (
                          logs.map((log) => (
                            <div key={log.id} className="border-b border-slate-900 pb-2 flex flex-col gap-1">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className={`font-bold ${
                                  log.type === "incoming" 
                                    ? "text-sky-400" 
                                    : log.type === "outgoing" 
                                      ? "text-emerald-400" 
                                      : "text-amber-500"
                                }`}>
                                  [{log.type.toUpperCase()}] {log.senderName} ({log.from.split("@")[0]})
                                </span>
                                <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <span className="text-slate-300 break-words font-mono text-xs whitespace-pre-wrap">{log.message}</span>
                              {log.status && (
                                <span className="text-[10px] text-slate-500 italic block mt-0.5">
                                  Action: {log.status}
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB: STATS / ANALYTICS */}
              {activeTab === "stats" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-6"
                >
                  {/* Header */}
                  <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-900 text-white rounded-xl">
                        <BarChart3 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">Statistik Pencarian Produk</h4>
                        <p className="text-xs text-slate-500">Pantau produk dan kategori layanan mana yang paling sering dicari oleh pelanggan Anda secara real-time.</p>
                      </div>
                    </div>
                    <button
                      onClick={handleResetStats}
                      className="px-3.5 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-all cursor-pointer flex items-center justify-center gap-1.5 self-start md:self-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                      Reset Statistik
                    </button>
                  </div>

                  {/* Top Stats Cards */}
                  {(() => {
                    const totalQueries = products.reduce((acc, p) => acc + (p.searchCount || 0), 0);
                    const sortedForStats = [...products].sort((a, b) => (b.searchCount || 0) - (a.searchCount || 0));
                    const topProduct = sortedForStats[0] && (sortedForStats[0].searchCount || 0) > 0 ? sortedForStats[0] : null;

                    const catStats = categories.map(cat => {
                      const catProducts = products.filter(p => p.category === cat.id);
                      const count = catProducts.reduce((acc, p) => acc + (p.searchCount || 0), 0);
                      return { id: cat.id, name: cat.name, count };
                    });
                    const sortedCats = [...catStats].sort((a, b) => b.count - a.count);
                    const topCat = sortedCats[0] && sortedCats[0].count > 0 ? sortedCats[0] : null;

                    // Filtering and Sorting for the Leaderboard
                    const statsFiltered = products.filter(p => {
                      const nameMatch = p.name.toLowerCase().includes(statsSearchQuery.toLowerCase());
                      const catObj = categories.find(c => c.id === p.category);
                      const catMatch = catObj ? catObj.name.toLowerCase().includes(statsSearchQuery.toLowerCase()) : false;
                      return nameMatch || catMatch;
                    });

                    const statsSorted = [...statsFiltered].sort((a, b) => {
                      let valA: any = 0;
                      let valB: any = 0;

                      if (statsSortField === "searches") {
                        valA = a.searchCount || 0;
                        valB = b.searchCount || 0;
                      } else if (statsSortField === "name") {
                        valA = a.name;
                        valB = b.name;
                      } else if (statsSortField === "category") {
                        const catA = categories.find(c => c.id === a.category)?.name || "";
                        const catB = categories.find(c => c.id === b.category)?.name || "";
                        valA = catA;
                        valB = catB;
                      } else if (statsSortField === "profit") {
                        const txsA = transactions.filter(t => t.productId === a.id && t.status === "Success");
                        const valAProfit = txsA.reduce((sum, t) => {
                          const selling = t.sellingPrice !== undefined ? t.sellingPrice : (t.totalPrice || 0);
                          const original = t.originalPrice !== undefined ? t.originalPrice : selling;
                          return sum + (selling - original);
                        }, 0);
                        const txsB = transactions.filter(t => t.productId === b.id && t.status === "Success");
                        const valBProfit = txsB.reduce((sum, t) => {
                          const selling = t.sellingPrice !== undefined ? t.sellingPrice : (t.totalPrice || 0);
                          const original = t.originalPrice !== undefined ? t.originalPrice : selling;
                          return sum + (selling - original);
                        }, 0);
                        valA = valAProfit;
                        valB = valBProfit;
                      }

                      if (typeof valA === "string") {
                        return statsSortDirection === "asc"
                          ? valA.localeCompare(valB)
                          : valB.localeCompare(valA);
                      } else {
                        return statsSortDirection === "asc"
                          ? valA - valB
                          : valB - valA;
                      }
                    });

                    return (
                      <div className="space-y-6">
                        {/* Summary Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-slate-900 text-white font-semibold">
                              <TrendingUp className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Total Pencarian</span>
                              <span className="text-xl font-extrabold text-slate-900 font-mono">{totalQueries}x</span>
                              <span className="text-[10.5px] text-slate-500 block">pencarian kata kunci</span>
                            </div>
                          </div>

                          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-amber-500 text-white">
                              <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600 block">Produk Terpopuler</span>
                              <span className="text-sm font-extrabold text-slate-900 block truncate max-w-[150px]">
                                {topProduct ? topProduct.name : "-"}
                              </span>
                              <span className="text-[10.5px] text-slate-500 block">
                                {topProduct ? `${topProduct.searchCount || 0}x dicari` : "Belum ada pencarian"}
                              </span>
                            </div>
                          </div>

                          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-emerald-600 text-white">
                              <Database className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 block">Kategori Teraktif</span>
                              <span className="text-sm font-extrabold text-slate-900 block truncate max-w-[150px]">
                                {topCat ? topCat.name : "-"}
                              </span>
                              <span className="text-[10.5px] text-slate-500 block">
                                {topCat ? `${topCat.count}x pencarian` : "Belum ada pencarian"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Charts Area */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          {/* Top 5 Products Chart */}
                          <div className="p-5 rounded-2xl border border-slate-150 bg-slate-50 flex flex-col gap-4">
                            <div>
                              <h5 className="text-xs font-bold text-slate-900 block">Grafik Top 5 Produk Paling Sering Dicari</h5>
                              <p className="text-[10.5px] text-slate-500">Perbandingan volume pencarian antar produk terbaik.</p>
                            </div>

                            <div className="space-y-3.5 mt-2 flex-1 flex flex-col justify-center">
                              {sortedForStats.slice(0, 5).some(p => (p.searchCount || 0) > 0) ? (
                                sortedForStats.slice(0, 5).map((p, idx) => {
                                  const maxCount = Math.max(...products.map(pr => pr.searchCount || 0));
                                  const widthPercent = maxCount > 0 ? ((p.searchCount || 0) / maxCount) * 100 : 0;
                                  const totalShare = totalQueries > 0 ? Math.round(((p.searchCount || 0) / totalQueries) * 100) : 0;

                                  return (
                                    <div key={p.id} className="space-y-1">
                                      <div className="flex justify-between text-xs">
                                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                          <span className="w-5 h-5 rounded-md bg-slate-900 text-white font-mono text-[10px] flex items-center justify-center font-bold">
                                            {idx + 1}
                                          </span>
                                          {p.name}
                                        </span>
                                        <span className="font-mono text-slate-500 font-medium">
                                          {p.searchCount || 0}x ({totalShare}%)
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden flex">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${widthPercent}%` }}
                                          transition={{ duration: 0.8, ease: "easeOut" }}
                                          className={`h-full rounded-full ${
                                            idx === 0 ? "bg-slate-900" :
                                            idx === 1 ? "bg-slate-700" :
                                            idx === 2 ? "bg-slate-500" :
                                            idx === 3 ? "bg-slate-400" : "bg-slate-300"
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="text-center py-8 text-slate-400 text-xs">
                                  Belum ada data pencarian produk.
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Category Distribution Chart */}
                          <div className="p-5 rounded-2xl border border-slate-150 bg-slate-50 flex flex-col gap-4">
                            <div>
                              <h5 className="text-xs font-bold text-slate-900 block">Distribusi Minat Kategori</h5>
                              <p className="text-[10.5px] text-slate-500">Pilah minat pelanggan berdasarkan kategori layanan.</p>
                            </div>

                            <div className="space-y-3.5 mt-2 flex-1 flex flex-col justify-center">
                              {sortedCats.some(c => c.count > 0) ? (
                                sortedCats.map((cat, idx) => {
                                  const maxCatVal = Math.max(...catStats.map(c => c.count));
                                  const widthPercent = maxCatVal > 0 ? (cat.count / maxCatVal) * 100 : 0;
                                  const catShare = totalQueries > 0 ? Math.round((cat.count / totalQueries) * 100) : 0;

                                  return (
                                    <div key={cat.id} className="space-y-1">
                                      <div className="flex justify-between text-xs">
                                        <span className="font-bold text-slate-800 truncate max-w-[200px]">
                                          {cat.name}
                                        </span>
                                        <span className="font-mono text-slate-500">
                                          {cat.count}x ({catShare}%)
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${widthPercent}%` }}
                                          transition={{ duration: 0.8, ease: "easeOut" }}
                                          className="h-full rounded-full bg-slate-700"
                                        />
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="text-center py-8 text-slate-400 text-xs">
                                  Belum ada data pencarian kategori.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Leaderboard Table Grid */}
                        <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white">
                          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
                            <div>
                              <h5 className="text-xs font-bold text-slate-900">Peringkat Pencarian Seluruh Produk</h5>
                              <p className="text-[10.5px] text-slate-500">Urutkan dan saring statistik pencarian produk Anda.</p>
                            </div>

                            {/* Stats Search */}
                            <div className="relative max-w-xs w-full">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                              <input
                                type="text"
                                placeholder="Cari nama produk / kategori..."
                                value={statsSearchQuery}
                                onChange={(e) => setStatsSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                              />
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-slate-100 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                                  <th className="py-3 px-4">Rank</th>
                                  <th 
                                    className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
                                    onClick={() => {
                                      if (statsSortField === "name") {
                                        setStatsSortDirection(prev => prev === "asc" ? "desc" : "asc");
                                      } else {
                                        setStatsSortField("name");
                                        setStatsSortDirection("asc");
                                      }
                                    }}
                                  >
                                    Nama Produk {statsSortField === "name" && (statsSortDirection === "asc" ? "▲" : "▼")}
                                  </th>
                                  <th 
                                    className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
                                    onClick={() => {
                                      if (statsSortField === "category") {
                                        setStatsSortDirection(prev => prev === "asc" ? "desc" : "asc");
                                      } else {
                                        setStatsSortField("category");
                                        setStatsSortDirection("asc");
                                      }
                                    }}
                                  >
                                    Kategori {statsSortField === "category" && (statsSortDirection === "asc" ? "▲" : "▼")}
                                  </th>
                                  <th 
                                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
                                    onClick={() => {
                                      if (statsSortField === "searches") {
                                        setStatsSortDirection(prev => prev === "asc" ? "desc" : "asc");
                                      } else {
                                        setStatsSortField("searches");
                                        setStatsSortDirection("desc");
                                      }
                                    }}
                                  >
                                    Jumlah Dicari {statsSortField === "searches" && (statsSortDirection === "asc" ? "▲" : "▼")}
                                  </th>
                                  <th className="py-3 px-4 text-right">% Share</th>
                                  <th 
                                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
                                    onClick={() => {
                                      if (statsSortField === "profit") {
                                        setStatsSortDirection(prev => prev === "asc" ? "desc" : "asc");
                                      } else {
                                        setStatsSortField("profit");
                                        setStatsSortDirection("desc");
                                      }
                                    }}
                                  >
                                    Pendapatan Bersih {statsSortField === "profit" && (statsSortDirection === "asc" ? "▲" : "▼")}
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {statsSorted.length > 0 ? (
                                  statsSorted.map((p, idx) => {
                                    const share = totalQueries > 0 ? ((p.searchCount || 0) / totalQueries) * 105 / 105 * 100 : 0;
                                    const catName = categories.find(c => c.id === p.category)?.name || "Other Services";
                                    
                                    const productSuccessTxs = transactions.filter(t => t.productId === p.id && t.status === "Success");
                                    const productProfit = productSuccessTxs.reduce((sum, t) => {
                                      const selling = t.sellingPrice !== undefined ? t.sellingPrice : (t.totalPrice || 0);
                                      const original = t.originalPrice !== undefined ? t.originalPrice : selling;
                                      return sum + (selling - original);
                                    }, 0);

                                    return (
                                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3.5 px-4 font-bold text-slate-500 font-mono">
                                          #{idx + 1}
                                        </td>
                                        <td className="py-3.5 px-4 font-bold text-slate-900">
                                          {p.name}
                                        </td>
                                        <td className="py-3.5 px-4 text-slate-500">
                                          <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium text-[10.5px]">
                                            {catName}
                                          </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-800 font-mono">
                                          {p.searchCount || 0}x
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono text-slate-500 font-semibold">
                                          {share.toFixed(1)}%
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600 font-mono">
                                          Rp{productProfit.toLocaleString("id-ID")}
                                        </td>
                                      </tr>
                                    );
                                  })
                                ) : (
                                  <tr>
                                    <td colSpan={6} className="py-8 px-4 text-center text-slate-400">
                                      Tidak ada data produk yang cocok dengan pencarian Anda.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {/* TAB: TRANSACTIONS / SALES LEDGER */}
              {activeTab === "transactions" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-6"
                >
                  {/* Header */}
                  <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-900 text-white rounded-xl">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">Kelola Transaksi & Ledger Toko</h4>
                        <p className="text-xs text-slate-500 font-sans">Pantau pesanan otomatis dari WhatsApp, tandai status pembayaran, dan catat penjualan manual cash.</p>
                      </div>
                    </div>
                    
                    {!isAddingTransaction && (
                      <button
                        onClick={() => {
                          setIsAddingTransaction(true);
                          setEditingTxId(null);
                          setTxOrderId("");
                          const firstProd = products[0];
                          setTxProductId(firstProd?.id || "");
                          setTxProductName(firstProd?.name || "");
                          const hasV = firstProd?.variants && firstProd.variants.length > 0;
                          const priceVal = hasV ? (firstProd.variants![0].price || 0) : 0;
                          const origPriceVal = hasV ? (firstProd.variants![0].originalPrice || priceVal) : 0;
                          setTxOriginalPrice(origPriceVal);
                          setTxSellingPrice(priceVal);
                          setTxQuantity(1);
                          setTxPaymentMethod("QRIS");
                          setTxBuyerPhone("");
                          setTxStatus("Pending");
                        }}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer font-sans"
                      >
                        <Plus className="w-4 h-4" />
                        Catat Transaksi Manual
                      </button>
                    )}
                  </div>

                  {/* Manual Transaction Input Form */}
                  {isAddingTransaction && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="border border-slate-200 rounded-2xl p-5 mb-6 bg-slate-50/50"
                    >
                      <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                        <h5 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          {editingTxId !== null ? (
                            <>
                              <Edit className="w-4 h-4 text-indigo-600 animate-pulse" />
                              Edit Catatan Transaksi (ID: {editingTxId})
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 text-emerald-600" />
                              Pencatatan Transaksi Baru (Manual)
                            </>
                          )}
                        </h5>
                        <button
                          onClick={() => {
                            setIsAddingTransaction(false);
                            setEditingTxId(null);
                          }}
                          className="text-xs font-semibold text-slate-400 hover:text-slate-700"
                        >
                          Tutup Form
                        </button>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const trimmedOrderId = txOrderId.trim();
                          const matchedTx = transactions.find(t => t.id.trim().toUpperCase() === trimmedOrderId.toUpperCase());
                          if (!matchedTx) {
                            alert("ID Pesanan tidak valid atau tidak cocok dengan database WhatsApp Bot! Catatan transaksi hanya boleh dibuat dengan ID Pesanan asli yang valid untuk mencegah manipulasi.");
                            return;
                          }

                          // 1. Revert old transaction stock effect if its previous state was Success
                          let updatedProducts = [...products];
                          if (matchedTx.status === "Success") {
                            const parentProd = products.find(p => p.id === matchedTx.productId || (p.variants && p.variants.some(v => v.id === matchedTx.productId)));
                            if (parentProd) {
                              updatedProducts = updatedProducts.map(p => {
                                if (p.id === parentProd.id) {
                                  const vars = p.variants || [];
                                  const matchingVar = vars.find(v => v.id === matchedTx.productId);
                                  if (matchingVar && matchingVar.stockType !== "UNKNOWN") {
                                    const updatedVars = vars.map(v => {
                                      if (v.id === matchingVar.id) {
                                        const currentStock = v.stock !== undefined ? v.stock : 10;
                                        return { ...v, stock: currentStock + (matchedTx.quantity || 1) };
                                      }
                                      return v;
                                    });
                                    return { ...p, variants: updatedVars };
                                  }
                                }
                                return p;
                              });
                            }
                          }

                          // 2. Apply new transaction stock effect if newly saved state is Success
                          if (txStatus === "Success") {
                            const targetId = txVariantId || txProductId;
                            const parentProd = products.find(p => p.id === txProductId || (p.variants && p.variants.some(v => v.id === txProductId)));
                            if (parentProd) {
                              updatedProducts = updatedProducts.map(p => {
                                if (p.id === parentProd.id) {
                                  const vars = p.variants || [];
                                  const matchingVar = vars.find(v => v.id === targetId);
                                  if (matchingVar && matchingVar.stockType !== "UNKNOWN") {
                                    const updatedVars = vars.map(v => {
                                      if (v.id === matchingVar.id) {
                                        const currentStock = v.stock !== undefined ? v.stock : 10;
                                        return { ...v, stock: Math.max(0, currentStock - txQuantity) };
                                      }
                                      return v;
                                    });
                                    return { ...p, variants: updatedVars };
                                  }
                                }
                                return p;
                              });
                            }
                          }

                          // Dynamically parse timestamp from order ID with format ORD-RANDOM-DDMMYYYY-HHMM
                          let finalTimestamp = matchedTx.timestamp || new Date().toISOString();
                          const match = trimmedOrderId.toUpperCase().match(/^ORD-(\d{4})-(\d{2})(\d{2})(\d{4})-(\d{2})(\d{2})/);
                          if (match) {
                            const [_, rand, day, month, year, hour, minute] = match;
                            // Format: YYYY-MM-DDTHH:mm:00+07:00 (Jakarta/WIB format)
                            const dateStr = `${year}-${month}-${day}T${hour}:${minute}:00+07:00`;
                            try {
                              const parsedDate = new Date(dateStr);
                              if (!isNaN(parsedDate.getTime())) {
                                finalTimestamp = parsedDate.toISOString();
                              }
                            } catch (err) {}
                          }

                          const updatedTx: Transaction = {
                            ...matchedTx,
                            customerName: `Pembeli (WA: ${txBuyerPhone})`,
                            customerPhone: txBuyerPhone,
                            productId: txVariantId || txProductId,
                            productName: txProductName,
                            originalPrice: txOriginalPrice,
                            sellingPrice: txSellingPrice,
                            totalPrice: txSellingPrice * txQuantity,
                            quantity: txQuantity,
                            paymentMethod: txPaymentMethod,
                            buyerPhone: txBuyerPhone,
                            status: txStatus,
                            timestamp: finalTimestamp
                          };

                          const updatedTxs = transactions.map(t => t.id.trim().toUpperCase() === trimmedOrderId.toUpperCase() ? updatedTx : t);
                          handleSaveDb(updatedProducts, undefined, undefined, undefined, updatedTxs);
                          setIsAddingTransaction(false);
                          setEditingTxId(null);
                        }}
                        className="space-y-4 font-sans text-xs"
                      >
                        {/* ID Pesanan & Tanggal Jam Otomatis (Paling Atas) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-slate-150">
                          <div>
                            <label className="text-xs font-bold text-slate-800 block mb-1 flex items-center gap-1">
                              <span>ID Pesanan Customer</span>
                              <span className="text-red-500 font-bold">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              readOnly={editingTxId !== null}
                              placeholder="Masukkan ID Pesanan (Cth: ORD-5829-03062026-1641)"
                              value={txOrderId}
                              onChange={(e) => setTxOrderId(e.target.value)}
                              className={`w-full px-3 py-2.5 rounded-xl border text-xs font-mono font-bold focus:ring-2 focus:ring-slate-450 focus:outline-hidden ${
                                editingTxId !== null ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" : "border-slate-200"
                              }`}
                            />
                            <p className="text-[10px] text-slate-450 mt-1">Gunakan kode draf dari pesan pesanan pelanggan di WhatsApp.</p>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-800 block mb-1">Tanggal & Jam Pemesanan (Otomatis)</label>
                            <input
                              type="text"
                              readOnly
                              disabled
                              placeholder="..."
                              value={(() => {
                                if (!txOrderId) return "Menunggu ID pesanan dimasukkan...";
                                return getParsedDateTime(txOrderId, transactions);
                              })()}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-100/85 text-slate-600 font-mono focus:outline-hidden font-semibold"
                            />
                            {txOrderId && getParsedDateTime(txOrderId, transactions) !== "Data tidak ditemukan" && getParsedDateTime(txOrderId) !== "Format ID kustom tidak diekstraksi otomatis" && (
                              <p className="text-[10px] text-emerald-600 font-medium mt-1">✓ Berhasil terisi otomatis dari database & ID Pesanan.</p>
                            )}
                            {txOrderId && getParsedDateTime(txOrderId, transactions) === "Data tidak ditemukan" && (
                              <p className="text-[10px] text-rose-500 font-medium mt-1">⚠️ Data tidak ditemukan di dalam database! Silakan cek kembali agar tidak ada manipulasi.</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Pilih ID Produk</label>
                            <select
                              value={txProductId}
                              onChange={(e) => {
                                const pid = e.target.value;
                                setTxProductId(pid);
                                const prod = products.find(p => p.id === pid);
                                if (prod) {
                                  const hasV = prod.variants && prod.variants.length > 0;
                                  if (hasV) {
                                    const firstVar = prod.variants![0];
                                    setTxVariantId(firstVar.id);
                                    setTxProductName(`${prod.name} - ${firstVar.name}`);
                                    setTxSellingPrice(firstVar.price || 0);
                                    setTxOriginalPrice(firstVar.originalPrice || firstVar.price || 0);
                                  } else {
                                    setTxVariantId("");
                                    setTxProductName(prod.name);
                                    setTxSellingPrice(0);
                                    setTxOriginalPrice(0);
                                  }
                                } else {
                                  setTxVariantId("");
                                  setTxProductName("");
                                  setTxSellingPrice(0);
                                  setTxOriginalPrice(0);
                                }
                              }}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden font-semibold"
                            >
                              <option value="">-- Pilih ID Produk --</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Pilih Variasi Produk</label>
                            <select
                              value={txVariantId}
                              disabled={!txProductId}
                              onChange={(e) => {
                                const vid = e.target.value;
                                setTxVariantId(vid);
                                const prod = products.find(p => p.id === txProductId);
                                if (prod) {
                                  const variant = prod.variants?.find(v => v.id === vid);
                                  if (variant) {
                                    setTxProductName(`${prod.name} - ${variant.name}`);
                                    setTxSellingPrice(variant.price || 0);
                                    setTxOriginalPrice(variant.originalPrice || variant.price || 0);
                                  } else {
                                    setTxProductName(prod.name);
                                    setTxSellingPrice(0);
                                    setTxOriginalPrice(0);
                                  }
                                }
                              }}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden font-semibold disabled:bg-slate-100 disabled:cursor-not-allowed"
                            >
                              <option value="">-- Pilih Variasi --</option>
                              {(() => {
                                const selectedProd = products.find(p => p.id === txProductId);
                                return selectedProd?.variants?.map(v => (
                                  <option key={v.id} value={v.id}>{v.name} (Rp{(v.price || 0).toLocaleString("id-ID")})</option>
                                )) || null;
                              })()}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Nama Produk (Otomatis)</label>
                            <input
                              type="text"
                              required
                              readOnly
                              placeholder="Terisi otomatis..."
                              value={txProductName}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 font-semibold cursor-not-allowed select-none text-slate-600"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Nomor Pembeli (WA)</label>
                            <input
                              type="text"
                              required
                              placeholder="Cth: 08123456789"
                              value={txBuyerPhone}
                              onChange={(e) => setTxBuyerPhone(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Harga Asli (Rp)</label>
                            <input
                              type="number"
                              required
                              min={0}
                              placeholder="Cth: 15000"
                              value={txOriginalPrice}
                              onChange={(e) => setTxOriginalPrice(parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Harga Jual (Rp)</label>
                            <input
                              type="number"
                              required
                              min={0}
                              placeholder="Cth: 20000"
                              value={txSellingPrice}
                              onChange={(e) => setTxSellingPrice(parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Jumlah</label>
                            <input
                              type="number"
                              required
                              min={1}
                              placeholder="Cth: 1"
                              value={txQuantity}
                              onChange={(e) => setTxQuantity(parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Metode Pembayaran</label>
                            <select
                              value={txPaymentMethod}
                              onChange={(e) => setTxPaymentMethod(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-400 focus:outline-hidden font-semibold"
                            >
                              <option value="QRIS">QRIS</option>
                              <option value="Dana">Dana</option>
                              <option value="Gopay">Gopay</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-4 items-center justify-between border-t border-slate-100 pt-3">
                          <div>
                            <span className="text-xs font-bold text-slate-700 mr-3">Status Awal Transaksi:</span>
                            <span className="inline-flex gap-2.5">
                              {(["Pending", "Success", "Failed"] as const).map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => setTxStatus(st)}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    txStatus === st 
                                      ? st === "Success" ? "bg-emerald-600 text-white animate-pulse" : st === "Pending" ? "bg-amber-500 text-white" : "bg-rose-600 text-white"
                                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                  }`}
                                >
                                  {st === "Success" ? "Berhasil / Lunas" : st === "Pending" ? "Menunggu Verifikasi" : "Gagal / Cancel"}
                                </button>
                              ))}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingTransaction(false);
                                setEditingTxId(null);
                              }}
                              className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-sm"
                            >
                              <Save className="w-3.5 h-3.5" />
                              Simpan Transaksi
                            </button>
                          </div>
                        </div>
                      </form>
                    </motion.div>
                  )}

                  {/* Summary Dashboard Scorecards */}
                  {(() => {
                    const lunasTxs = filteredTransactions.filter(t => t.status === "Success");
                    const totalRevenue = lunasTxs.reduce((acc, t) => {
                      const selling = t.sellingPrice !== undefined ? t.sellingPrice : (t.totalPrice || 0);
                      const original = t.originalPrice !== undefined ? t.originalPrice : selling;
                      return acc + (selling - original);
                    }, 0);
                    const totalSalesQty = lunasTxs.reduce((acc, t) => acc + (t.quantity || 1), 0);
                    const pendingCount = filteredTransactions.filter(t => t.status === "Pending").length;
                    const successCount = lunasTxs.length;

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 font-sans">
                        <div className="bg-slate-50/60 hover:bg-slate-50 p-4 border border-slate-200/80 rounded-2xl transition-all shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Total Pendapatan Bersih</span>
                          <h4 className="text-xl font-bold text-emerald-600 font-mono mt-1">Rp{totalRevenue.toLocaleString("id-ID")}</h4>
                          <p className="text-[10px] text-slate-400 mt-1">Total keuntungan bersih (penjualan - HPP)</p>
                        </div>

                        <div className="bg-slate-50/60 hover:bg-slate-50 p-4 border border-slate-200/80 rounded-2xl transition-all shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Jumlah Penjualan</span>
                          <h4 className="text-xl font-bold text-slate-900 font-mono mt-1">{totalSalesQty} unit</h4>
                          <p className="text-[10px] text-slate-400 mt-1">Layanan terkirim ke konsumen</p>
                        </div>

                        <div className="bg-slate-50/60 hover:bg-slate-50 p-4 border border-slate-200/80 rounded-2xl transition-all shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Verifikasi Transfer (Pending)</span>
                          <h4 className="text-xl font-bold text-amber-500 font-mono mt-1">{pendingCount} Pesanan</h4>
                          <p className="text-[10px] text-slate-400 mt-1">Menunggu konfirmasi / lunas</p>
                        </div>

                        <div className="bg-slate-50/60 hover:bg-slate-50 p-4 border border-slate-200/80 rounded-2xl transition-all shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Total Transaksi Lunas</span>
                          <h4 className="text-xl font-bold text-indigo-600 font-mono mt-1">{successCount} Transaksi</h4>
                          <p className="text-[10px] text-slate-400 mt-1">Pesanan sukses di database</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Transaction Logs Table / Lists */}
                  <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-xs font-sans">
                    <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-slate-50/50">
                      <h5 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Log Histori Transaksi Penjualan</h5>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {transactions.length > 0 && (
                          <button
                            onClick={handleExportCSV}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all font-sans"
                            id="btn-export-csv"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            Ekspor CSV
                          </button>
                        )}
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200">
                          {transactions.length} Entri Tercatat
                        </span>
                      </div>
                    </div>

                    {transactions.length === 0 ? (
                      <div className="text-center py-16 text-slate-400">
                        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                        <p className="text-sm font-semibold">Tidak ada transaksi yang tercatat</p>
                        <p className="text-xs mt-1 max-w-xs mx-auto text-slate-400">
                          Pesanan pelanggan dari WhatsApp otomatis akan muncul di sini saat sitem menerima command <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">/beli</code> atau <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">/order</code>.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Filter & Bulk Actions Bar */}
                        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/25 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                          {/* Date Filter Inputs */}
                          <div className="flex flex-wrap items-center gap-2.5">
                            <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                              <Filter className="w-3.5 h-3.5 text-slate-400" />
                              <span>Filter Tanggal:</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={txStartDate}
                                onChange={(e) => setTxStartDate(e.target.value)}
                                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-slate-450 focus:outline-hidden"
                                title="Tanggal Mulai"
                              />
                              <span className="text-slate-400 text-xs font-semibold">s/d</span>
                              <input
                                type="date"
                                value={txEndDate}
                                onChange={(e) => setTxEndDate(e.target.value)}
                                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-slate-450 focus:outline-hidden"
                                title="Tanggal Selesai"
                              />
                            </div>
                            {(txStartDate || txEndDate) && (
                              <button
                                onClick={() => {
                                  setTxStartDate("");
                                  setTxEndDate("");
                                }}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer border border-slate-200"
                              >
                                Reset Filter
                              </button>
                            )}
                          </div>

                          {/* Bulk Actions Block */}
                          <AnimatePresence>
                            {selectedTxIds.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="flex items-center gap-2 self-end md:self-auto"
                              >
                                <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-1 rounded-md">
                                  {selectedTxIds.length} Dicentang
                                </span>
                                <button
                                  onClick={() => {
                                    triggerConfirm(
                                      "Hapus Transaksi Dicentang",
                                      `Apakah Anda yakin ingin menghapus ${selectedTxIds.length} transaksi yang dicentang sekaligus? Pengembalian stok yang terpotong harus disesuaikan secara manual.`,
                                      () => {
                                        const updatedTxs = transactions.filter(t => !selectedTxIds.includes(t.id));
                                        handleSaveDb(products, undefined, undefined, undefined, updatedTxs);
                                        setSelectedTxIds([]);
                                        setSaveMessage({ type: "success", text: `${selectedTxIds.length} transaksi berhasil dihapus!` });
                                      },
                                      "Hapus Semua",
                                      "Batal",
                                      "danger"
                                    );
                                  }}
                                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Hapus Terpilih
                                </button>
                                <button
                                  onClick={() => setSelectedTxIds([])}
                                  className="px-2.5 py-1.5 text-slate-450 hover:text-slate-600 font-semibold rounded-lg text-xs transition-all cursor-pointer"
                                >
                                  Batal
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {filteredTransactions.length === 0 ? (
                          <div className="text-center py-16 text-slate-400 border-t border-slate-100">
                            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400 animate-pulse" />
                            <p className="text-sm font-semibold">Tidak Ada Transaksi di Rentang Tanggal Ini</p>
                            <p className="text-xs mt-1 max-w-xs mx-auto text-slate-450">
                              Tidak ditemukan transaksi dari tanggal <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-650 font-bold font-mono">{txStartDate || "Awal"}</code> sampai <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-650 font-bold font-mono">{txEndDate || "Akhir"}</code>.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-150 text-[10.5px] uppercase font-bold text-slate-500 tracking-wide">
                                  <th className="py-3 px-4 text-center w-10">
                                    <input
                                      type="checkbox"
                                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                                      checked={filteredTransactions.length > 0 && filteredTransactions.every(t => selectedTxIds.includes(t.id))}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          const allFilteredIds = filteredTransactions.map(t => t.id);
                                          setSelectedTxIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                                        } else {
                                          const allFilteredIds = filteredTransactions.map(t => t.id);
                                          setSelectedTxIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                                        }
                                      }}
                                    />
                                  </th>
                                  <th className="py-3 px-4">ID Pesanan</th>
                                  <th className="py-3 px-4">Tanggal</th>
                                  <th className="py-3 px-4">Jam</th>
                                  <th className="py-3 px-4">Nama Pelanggan</th>
                                  <th className="py-3 px-4">Kategori Produk</th>
                                  <th className="py-3 px-4">ID Produk</th>
                                  <th className="py-3 px-4">Produk Layanan</th>
                                  <th className="py-3 px-4 text-right">Harga Asli</th>
                                  <th className="py-3 px-4 text-right">Harga Jual</th>
                                  <th className="py-3 px-4">Metode Pembayaran</th>
                                  <th className="py-3 px-4 text-center">Status</th>
                                  <th className="py-3 px-4 text-center">Aksi Pengelola</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-xs">
                                {filteredTransactions.map((tx) => {
                                  const txDate = new Date(tx.timestamp);
                                  const formattedDate = txDate.toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric"
                                  });
                                  const formattedTime = txDate.toLocaleTimeString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  }) + " WIB";

                                  return (
                                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="py-3 px-4 text-center">
                                        <input
                                          type="checkbox"
                                          className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                                          checked={selectedTxIds.includes(tx.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedTxIds(prev => [...prev, tx.id]);
                                            } else {
                                              setSelectedTxIds(prev => prev.filter(id => id !== tx.id));
                                            }
                                          }}
                                        />
                                      </td>
                                      <td className="py-3 px-4">
                                        <span className="font-mono font-bold text-slate-800 text-[11px] block">{tx.id}</span>
                                      </td>
                                      <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                                        {formattedDate}
                                      </td>
                                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                                    {formattedTime}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-slate-800">{tx.customerName}</div>
                                    <div className="text-[10px] font-mono text-slate-400 mt-0.5 select-all">{tx.customerPhone}</div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="inline-flex px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                      {(() => {
                                        const prod = products.find(p => p.id === tx.productId);
                                        const cat = prod ? categories.find(c => c.id === prod.category) : null;
                                        return cat ? cat.name : (prod?.category || "-");
                                      })()}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-mono text-[10.5px] font-semibold text-slate-500">
                                    {tx.productId || "-"}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="font-semibold text-slate-800 block">{tx.productName}</span>
                                    {tx.quantity > 1 && <span className="text-[10px] text-slate-400">Jumlah: {tx.quantity}x</span>}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono font-semibold text-slate-500">
                                    Rp{(tx.originalPrice || tx.totalPrice || 0).toLocaleString("id-ID")}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600">
                                    Rp{(tx.sellingPrice || tx.totalPrice || 0).toLocaleString("id-ID")}
                                  </td>
                                  <td className="py-3 px-4 font-medium text-slate-600">
                                    {tx.paymentMethod}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                      tx.status === "Success" 
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-150" 
                                        : tx.status === "Pending" 
                                        ? "bg-amber-50 text-amber-700 border-amber-150 animate-pulse" 
                                        : "bg-rose-50 text-rose-700 border-rose-150"
                                    }`}>
                                      {tx.status === "Success" ? "Sukses / Lunas" : tx.status === "Pending" ? "Verifikasi" : "Batal / Failed"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <div className="inline-flex gap-1.5 justify-center">
                                      <button
                                        onClick={() => {
                                          setEditingTxId(tx.id);
                                          setTxOrderId(tx.id);
                                          
                                          // Find parent product and variant
                                          let mainProdId = tx.productId || "";
                                          let variantId = "";
                                          const matchedProdDirect = products.find(p => p.id === tx.productId);
                                          if (matchedProdDirect) {
                                            mainProdId = matchedProdDirect.id;
                                            if (matchedProdDirect.variants && matchedProdDirect.variants.length > 0) {
                                              const suffix = tx.productName.split(" - ")[1];
                                              const matchingVar = matchedProdDirect.variants.find(v => v.name === suffix);
                                              if (matchingVar) {
                                                variantId = matchingVar.id;
                                              } else {
                                                variantId = matchedProdDirect.variants[0].id;
                                              }
                                            }
                                          } else {
                                            const parentProd = products.find(p => p.variants && p.variants.some(v => v.id === tx.productId));
                                            if (parentProd) {
                                              mainProdId = parentProd.id;
                                              variantId = tx.productId;
                                            }
                                          }

                                          setTxProductId(mainProdId);
                                          setTxVariantId(variantId);
                                          setTxProductName(tx.productName || "");
                                          setTxOriginalPrice(tx.originalPrice || 0);
                                          setTxSellingPrice(tx.sellingPrice || tx.totalPrice || 0);
                                          setTxQuantity(tx.quantity || 1);
                                          setTxPaymentMethod(tx.paymentMethod || "QRIS");
                                          setTxBuyerPhone(tx.customerPhone || tx.buyerPhone || "");
                                          setTxStatus(tx.status || "Pending");
                                          setIsAddingTransaction(true);
                                          // Scroll smooth to top form
                                          window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded border border-slate-200 hover:border-indigo-100 transition-all cursor-pointer"
                                        title="Edit Data Transaksi"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>

                                      {tx.status === "Pending" && (
                                        <button
                                          onClick={() => {
                                            setPaymentMethodConfirmTarget(tx);
                                            setConfirmPaymentMethodVal(tx.paymentMethod || "QRIS");
                                          }}
                                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10.5px] font-bold cursor-pointer"
                                          title="Konfirmasi Metode Pembayaran & Selesaikan Transaksi"
                                        >
                                          Lunas
                                        </button>
                                      )}
                                      
                                      {tx.status !== "Failed" && (
                                        <button
                                          onClick={() => {
                                            // Mark as Failed, return stock if it was success
                                            const updatedTxs = transactions.map(t => {
                                              if (t.id === tx.id) return { ...t, status: "Failed" as const };
                                              return t;
                                            });

                                            let updatedProducts = [...products];
                                            if (tx.status === "Success") {
                                              updatedProducts = products.map(p => {
                                                if (p.id === tx.productId) {
                                                  return p.stockType === "UNKNOWN" ? p : { ...p, stock: (p.stock !== undefined ? p.stock : 10) + (tx.quantity || 1) };
                                                }
                                                return p;
                                              });
                                            }

                                            handleSaveDb(updatedProducts, undefined, undefined, undefined, updatedTxs);
                                          }}
                                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-650 hover:text-slate-900 rounded-md text-[10.5px] font-bold cursor-pointer"
                                          title="Batalkan / Tandai transaksi Gagal"
                                        >
                                          Gagal
                                        </button>
                                      )}

                                      <button
                                        onClick={() => {
                                          triggerConfirm(
                                            "Hapus Log Transaksi",
                                            `Apakah Anda yakin ingin menghapus catatan transaksi dengan ID "${tx.id}"? Terkait pengembalian stok harus disesuaikan secara manual.`,
                                            () => {
                                              // Delete transaction log
                                              const updatedTxs = transactions.filter(t => t.id !== tx.id);
                                              handleSaveDb(products, undefined, undefined, undefined, updatedTxs);
                                              setSelectedTxIds(prev => prev.filter(id => id !== tx.id));
                                            }
                                          );
                                        }}
                                        className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded border border-rose-100 transition-all cursor-pointer"
                                        title="Hapus permanen dari laporan"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
                </motion.div>
              )}

              {/* TAB: BROADCAST PROMO MASSAL */}
              {activeTab === "broadcast" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-6"
                >
                  <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4 justify-between">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-5 h-5 text-indigo-505 text-indigo-500" />
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">Broadcast Promo Massal</h4>
                        <p className="text-xs text-slate-500">Kirim pesan promo secara massal ke nomor pelanggan yang pernah melakukan transaksi.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${
                        status.status === "connected" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-150 animate-pulse" 
                          : "bg-amber-50 text-amber-700 border-amber-150"
                      }`}>
                        🔑 Status Bot: {status.status === "connected" ? "Terhubung" : "Terputus"}
                      </span>
                    </div>
                  </div>

                  {/* Placeholders tips */}
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl mb-6 text-indigo-950 text-xs flex gap-3">
                    <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-1 text-indigo-900">💡 Tips Personalisasi Promo:</span>
                      <p className="leading-relaxed">
                        Anda dapat menyisipkan kata kunci pemformat khusus berikut agar pesan terdengar lebih bersahabat: <br />
                        <code className="bg-indigo-150 bg-indigo-200/50 font-mono px-1 rounded font-bold text-indigo-900">{"{nama}"}</code> &rarr; Menampilkan nama pelanggan sesuai transaksi terupdate. <br />
                        <code className="bg-indigo-150 bg-indigo-200/50 font-mono px-1 rounded font-bold text-indigo-900">{"{toko}"}</code> &rarr; Menampilkan nama store Anda <span className="font-semibold">({settings.storeName || "Wanzz Store"})</span>.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* LEFT SIDE: Input Form Promo */}
                    <div className="lg:col-span-5 flex flex-col gap-5">
                      <div className="p-5 border border-slate-200 rounded-2xl bg-slate-50 flex flex-col gap-4">
                        <span className="font-bold text-xs text-slate-705 uppercase tracking-wider block border-b border-slate-200 pb-2 font-sans font-medium">
                          📝 Pengaturan Pesan Promo
                        </span>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] text-slate-500 font-bold">Isi Pesan Promo:</label>
                          <textarea
                            rows={6}
                            placeholder="Contoh: Halo {nama}, dapatkan promo spesial akhir pekan di {toko}! Diskon Netflix Premium hanya Rp5.000 saja hari ini!"
                            value={broadcastMessage}
                            onChange={(e) => setBroadcastMessage(e.target.value)}
                            disabled={isBroadcasting}
                            className="p-3 bg-white rounded-xl text-xs border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 font-medium"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] text-slate-500 font-bold">Tipe Lampiran Media:</label>
                            <select
                              value={broadcastMediaType}
                              onChange={(e) => setBroadcastMediaType(e.target.value as any)}
                              disabled={isBroadcasting}
                              className="p-2 bg-white rounded-lg text-xs border border-slate-200 focus:outline-hidden font-medium"
                            >
                              <option value="none">Tanpa Media</option>
                              <option value="image">Gambar (Image)</option>
                              <option value="video">Video (MP4)</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] text-slate-500 font-bold font-sans">Jeda Kirim (Detik):</label>
                            <input
                              type="number"
                              min={1}
                              max={60}
                              value={broadcastDelay}
                              onChange={(e) => setBroadcastDelay(Number(e.target.value) || 3)}
                              disabled={isBroadcasting}
                              className="p-2 bg-white rounded-lg text-xs border border-slate-200 focus:outline-hidden font-medium"
                              title="Detik jeda tidur antar pengiriman nomer agar aman dari spam bot block."
                            />
                          </div>
                        </div>

                        {broadcastMediaType !== "none" && (
                          <div className="flex flex-col gap-2.5 animate-fade-in bg-slate-50/55 p-3 rounded-xl border border-slate-200">
                            <div className="flex justify-between items-center">
                              <label className="text-[11px] text-slate-500 font-bold">
                                {broadcastMediaType === "image" ? "Unggah Gambar Promo:" : "Unggah Video Promo (MP4):"}
                              </label>
                              {broadcastMediaUrl && (
                                <button
                                  type="button"
                                  onClick={() => setBroadcastMediaUrl("")}
                                  className="text-[10px] text-rose-500 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <X className="w-3 h-3" /> Bersihkan
                                </button>
                              )}
                            </div>

                            {!broadcastMediaUrl ? (
                              <div className="border border-dashed border-slate-300 rounded-xl bg-white p-4 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/10 transition-all relative">
                                <input
                                  type="file"
                                  accept={broadcastMediaType === "image" ? "image/*" : "video/mp4,video/*"}
                                  disabled={isBroadcasting || broadcastUploadLoading}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    if (file.size > 15 * 1024 * 1024) {
                                      setBroadcastUploadError("Ukuran file terlalu besar. Maksimum adalah 15MB.");
                                      return;
                                    }

                                    setBroadcastUploadLoading(true);
                                    setBroadcastUploadError(null);

                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setBroadcastMediaUrl(reader.result as string);
                                      setBroadcastUploadLoading(false);
                                    };
                                    reader.onerror = () => {
                                      setBroadcastUploadError("Gagal membaca file.");
                                      setBroadcastUploadLoading(false);
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                                  {broadcastMediaType === "image" ? (
                                    <Image className="w-6 h-6 text-slate-400" />
                                  ) : (
                                    <Video className="w-6 h-6 text-slate-400" />
                                  )}
                                  <span className="text-xs font-bold text-slate-700">
                                    {broadcastUploadLoading ? "Membaca file..." : `Pilih ${broadcastMediaType === "image" ? "Gambar" : "Video"} Promo`}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    Klik di sini untuk menelusuri folder Anda (Maks 15MB)
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2 bg-white p-2 rounded-lg border border-slate-200">
                                {broadcastMediaType === "image" ? (
                                  <img
                                    src={broadcastMediaUrl}
                                    alt="Pratinjau Gambar Promo"
                                    className="max-h-48 w-full object-contain rounded-lg border border-slate-100 bg-slate-50"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <video
                                    src={broadcastMediaUrl}
                                    controls
                                    className="max-h-48 w-full object-contain rounded-lg border border-slate-100 bg-slate-50"
                                  />
                                )}
                                <div className="flex justify-between items-center text-[10px] text-slate-400 px-1 font-mono">
                                  <span>Format Terdeteksi: {broadcastMediaUrl.split(";")[0]?.split(":")[1] || "MIME"}</span>
                                  <span className="text-emerald-600 font-bold">Siap Kirim</span>
                                </div>
                              </div>
                            )}

                            {broadcastUploadError && (
                              <p className="text-[10px] font-bold text-rose-500">{broadcastUploadError}</p>
                            )}
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-200">
                          {isBroadcasting ? (
                            <div className="flex flex-col gap-2.5 bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100">
                              <div className="flex justify-between items-center text-xs font-bold text-indigo-950">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                                  Memproses Broadcast...
                                </span>
                                <span>{broadcastProgress.current} / {broadcastProgress.total}</span>
                              </div>
                              <div className="w-full bg-slate-200/85 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-indigo-600 h-full transition-all duration-300"
                                  style={{ width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%` }}
                                ></div>
                              </div>
                              <div className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">
                                Mengirim ke: <span className="font-bold text-slate-700">{broadcastProgress.target || "mengambil data..."}</span>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={handleStartBroadcast}
                              disabled={selectedBroadcastPhones.length === 0 || !broadcastMessage.trim() || status.status !== "connected"}
                              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Play className="w-4 h-4 fill-current shrink-0" />
                              Mulai Kirim ke {selectedBroadcastPhones.length} Pelanggan
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT SIDE: Target Customer Checkbox List */}
                    <div className="lg:col-span-7 flex flex-col gap-4 border border-slate-200 rounded-2xl p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-500" />
                            <span className="font-bold text-slate-700 text-xs uppercase tracking-wider font-sans font-medium">
                              Pilih Daftar Pelanggan ({customerPhones.length})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowManualTargetForm(!showManualTargetForm)}
                            disabled={isBroadcasting}
                            className="text-left text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline font-bold flex items-center gap-1 mt-1 cursor-pointer disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5" /> Tambah Target Secara Manual
                          </button>
                        </div>
                        <div className="relative w-full sm:w-48">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            placeholder="Cari nama / nomor..."
                            value={broadcastSearchQuery}
                            onChange={(e) => setBroadcastSearchQuery(e.target.value)}
                            disabled={isBroadcasting}
                            className="w-full pl-8 pr-3 py-1 bg-slate-50 rounded-lg text-xs border border-slate-200 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      {showManualTargetForm && (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col gap-3 animate-fade-in">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Plus className="w-3.5 h-3.5 text-indigo-500 font-bold" /> Tambah Target Secara Manual
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setShowManualTargetForm(false);
                                setManualTargetError(null);
                              }}
                              className="text-[10px] uppercase font-bold text-slate-400 hover:text-slate-605 cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-slate-500 font-bold">Nama Target (Opsional)</label>
                              <input
                                type="text"
                                placeholder="Contoh: Andi Reseller"
                                value={manualTargetName}
                                onChange={(e) => setManualTargetName(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white rounded-lg text-xs border border-slate-200 focus:outline-hidden"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-slate-500 font-bold font-sans">Nomor WhatsApp (Wajib) *</label>
                              <input
                                type="text"
                                placeholder="Contoh: 08123456789 atau 628..."
                                value={manualTargetPhone}
                                onChange={(e) => setManualTargetPhone(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white rounded-lg text-xs border border-slate-200 focus:outline-hidden"
                              />
                            </div>
                          </div>

                          {manualTargetError && (
                            <p className="text-[10px] font-bold text-rose-500 font-sans">{manualTargetError}</p>
                          )}

                          <div className="flex justify-end gap-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                setManualTargetName("");
                                setManualTargetPhone("");
                                setManualTargetError(null);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer transition-all"
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              onClick={handleAddManualTarget}
                              className="px-3.5 py-1 text-[11px] font-bold bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                            >
                              <Check className="w-3 h-3" /> Tambahkan ke Target
                            </button>
                          </div>
                        </div>
                      )}

                      {customerPhones.length === 0 ? (
                        <div className="text-center py-16 text-slate-400 font-medium">
                          <Receipt className="w-10 h-10 mx-auto opacity-30 mb-2" />
                          <p className="text-xs">Belum ada riwayat transaksi</p>
                          <p className="text-[10px] text-slate-400 mt-1">Daftar nomor pelanggan akan muncul otomatis setelah ada pesanan masuk.</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-1 select-none">
                            <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={customerPhones.length > 0 && selectedBroadcastPhones.length === customerPhones.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedBroadcastPhones(customerPhones.map(c => c.phone));
                                  } else {
                                    setSelectedBroadcastPhones([]);
                                  }
                                }}
                                disabled={isBroadcasting}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              Pilih Semua Pelanggan ({customerPhones.length})
                            </label>

                            {selectedBroadcastPhones.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedBroadcastPhones([])}
                                disabled={isBroadcasting}
                                className="text-[10px] text-rose-500 hover:text-rose-705 font-bold cursor-pointer hover:underline disabled:opacity-50 font-sans"
                              >
                                Bersihkan pilihan
                              </button>
                            )}
                          </div>

                          <div className="divide-y divide-slate-105 divide-slate-100 max-h-[350px] overflow-y-auto pr-1.5 custom-scrollbar">
                            {customerPhones
                              .filter(c => {
                                const q = broadcastSearchQuery.trim().toLowerCase();
                                if (!q) return true;
                                return c.name.toLowerCase().includes(q) || c.phone.includes(q);
                              })
                              .map((customer) => {
                                const isSelected = selectedBroadcastPhones.includes(customer.phone);
                                return (
                                  <div key={customer.phone} className="py-2.5 flex items-center justify-between gap-3 text-xs transition-colors hover:bg-slate-50/70">
                                    <label className="flex items-center gap-3 cursor-pointer flex-1 py-1">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedBroadcastPhones(prev => [...prev, customer.phone]);
                                          } else {
                                            setSelectedBroadcastPhones(prev => prev.filter(ph => ph !== customer.phone));
                                          }
                                        }}
                                        disabled={isBroadcasting}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                      />
                                      <div>
                                        <span className="font-bold text-slate-800">{customer.name}</span>
                                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{customer.phone}</div>
                                      </div>
                                    </label>

                                    <div className="flex items-center gap-2">
                                      {customer.transactionsCount === 0 ? (
                                        <span className="text-[10px] font-bold bg-indigo-50/70 border border-indigo-100 text-indigo-650 px-2.5 py-0.5 rounded-full shrink-0">
                                          👤 Target Manual
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold bg-slate-100 border border-slate-150 px-2.5 py-0.5 text-slate-600 rounded-full shrink-0">
                                          🛒 {customer.transactionsCount} Transaksi
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (customer.transactionsCount === 0) {
                                            triggerConfirm(
                                              "Hapus Target Manual",
                                              `Apakah Anda yakin ingin menghapus target manual ${customer.name} (${customer.phone}) secara permanen?`,
                                              () => handleDeleteManualTarget(customer.phone)
                                            );
                                          } else {
                                            triggerConfirm(
                                              "Keluarkan dari Target Broadcast",
                                              `Apakah Anda yakin ingin menyembunyikan pelanggan ${customer.name} (${customer.phone}) dari daftar target broadcast?`,
                                              () => handleExcludeBroadcastPhone(customer.phone)
                                            );
                                          }
                                        }}
                                        disabled={isBroadcasting}
                                        className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded transition-all cursor-pointer disabled:opacity-50 shrink-0"
                                        title={customer.transactionsCount === 0 ? "Hapus target manual secara permanen" : "Keluarkan nomor dari daftar broadcast"}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>

                          {settings.excludedBroadcastPhones && settings.excludedBroadcastPhones.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-100">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                                Nomor yang Dikecualikan ({settings.excludedBroadcastPhones.length})
                              </span>
                              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                                {settings.excludedBroadcastPhones.map((ph) => (
                                  <div key={ph} className="inline-flex items-center gap-1 bg-slate-105 bg-slate-50 border border-slate-200 text-slate-700 text-[10.5px] font-bold pl-2 pr-1 py-0.5 rounded-md transition-all">
                                    <span>{ph}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRestoreBroadcastPhone(ph)}
                                      className="p-0.5 text-slate-500 hover:text-indigo-600 rounded cursor-pointer"
                                      title="Pulihkan nomor ke daftar broadcast"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* BOTTOM LOGGER: Broadcast Progress Logs */}
                  {broadcastLogs.length > 0 && (
                    <div className="mt-6 border border-slate-200 rounded-2xl p-5 animate-fade-in bg-slate-50/50">
                      <div className="flex justify-between items-center border-b border-slate-150 pb-2 mb-3.5">
                        <span className="font-bold text-slate-905 text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 font-sans font-medium">
                          📋 Log Pengiriman Broadcast Saat Ini
                        </span>
                        {broadcastProgress.status !== "sending" && (
                          <button
                            type="button"
                            onClick={() => setBroadcastLogs([])}
                            className="text-[10px] text-slate-400 hover:text-slate-600 font-bold font-sans cursor-pointer"
                          >
                            Bersihkan log broadcast
                          </button>
                        )}
                      </div>

                      <div className="divide-y divide-slate-100 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {broadcastLogs.map((log, lIdx) => (
                          <div key={lIdx} className="py-2 flex items-center justify-between text-xs gap-3">
                            <div className="flex items-center gap-2">
                              {log.status === "success" ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              )}
                              <div>
                                <span className="font-bold text-slate-800">{log.name}</span>
                                <span className="text-slate-400 font-mono text-[10px] ml-1.5">({log.phone})</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {log.status === "success" ? (
                                <span className="text-[10.5px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-2">
                                  Terkirim
                                </span>
                              ) : (
                                <span className="text-[10.5px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded px-2" title={log.error}>
                                  Gagal: {log.error || "Unknown"}
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-slate-400">{log.time}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* TAB 4: MANUAL GUIDE / EXPLANATION */}
              {activeTab === "manual" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-6"
                >
                  <div className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                    <BookOpen className="w-5 h-5 text-emerald-500" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">Panduan Integrasi & Alur Bisnis</h4>
                      <p className="text-xs text-slate-500">Pelajari cara bot Anda bekerja dan bagaimana kustomisasi alurnya.</p>
                    </div>
                  </div>

                  <div className="space-y-6 leading-relaxed max-w-3xl">
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-slate-700 flex gap-3">
                      <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs flex flex-col gap-1.5">
                        <span className="font-bold text-amber-800">Bagaimana Bot Merespons Tanpa AI?</span>
                        <p>
                          Bot ini menggunakan logika <b>rule-based (pencocokan aturan)</b> langsung dengan memindai local database yang ada di tab <b>Database Katalog</b>. Setiap pesan pelanggan dipadankan secara instan dengan Nama/ID produk secara case-insensitive. Jika pas, detail akan terkirim. Jika tidak, dialihkan ke fallback yang memandu costumer ke menu!
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 text-xs">
                      <h5 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
                        <span className="w-1.5 h-3 bg-slate-900 rounded-sm"></span>
                        1. Alur Logika Eksekusi Pesan Masuk
                      </h5>
                      <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col gap-3 font-mono">
                        <div>
                          <span className="text-slate-500 font-sans">[Langkah A] Pelanggan Mengirim Pesan ke Bot</span>
                          <p className="text-slate-750 font-sans mt-1">
                            WhatsApp mendeteksi chat masuk &rarr; masuk ke modul event listener Baileys (<code className="bg-slate-250 px-1 rounded text-red-650">server.ts</code> &gt; <code className="bg-slate-250 px-1 rounded text-red-650">messages.upsert</code>)
                          </p>
                        </div>
                        <div className="border-t border-slate-200 pt-2.5">
                          <span className="text-slate-500 font-sans">[Langkah B] Pencocokan Keyword Aturan (No AI)</span>
                          <ul className="list-disc pl-5 mt-1 text-slate-750 font-sans flex flex-col gap-1">
                            <li>Apakah pesan diawali prefix <b>/</b>, <b>!</b>, atau <b>.</b> diikuti <b>menu</b>? Jika YA, generate format katalog dan kirim.</li>
                            <li>Apakah pesan diawali prefix <b>/</b>, <b>!</b>, atau <b>.</b> diikuti <b>payment</b>, <b>qris</b>, atau <b>bayar</b>? Jika YA, kirim instruksi pembayaran lengkap.</li>
                            <li>Apakah pesan diawali prefix <b>/</b>, <b>!</b>, atau <b>.</b> diikuti sapaan seperti <b>halo</b> atau <b>p</b>? Jika YA, balas dengan Welcome Message.</li>
                            <li>Apakah pesan diawali prefix <b>/</b>, <b>!</b>, atau <b>.</b> diikuti <b>h [pesan]</b>? Jika YA dan dilakukan di grup whitelisted, bot akan mengirimkan pesan tersebut dan men-tag seluruh anggota grup secara tersembunyi (Hide Tag).</li>
                            <li>Apakah pesan diawali prefix <b>/</b>, <b>!</b>, atau <b>.</b> diikuti <b>kick [tag/nomor/reply]</b>? Jika YA dan di grup WhatsApp, bot akan mengeluarkan member tersebut sesuai izin admin.</li>
                            <li>Apakah pesan diawali prefix <b>/</b>, <b>!</b>, atau <b>.</b> diikuti <b>add [nomor]</b>? Jika YA dan di grup WhatsApp, bot akan menambahkan nomor member tersebut ke grup.</li>
                            <li>Apakah pesan diawali prefix <b>/</b>, <b>!</b>, atau <b>.</b> diikuti <b>close</b>? Jika YA dan di grup WhatsApp, bot akan mengubah pengaturan grup agar hanya admin yang dapat mengirim pesan.</li>
                            <li>Apakah pesan diawali prefix <b>/</b>, <b>!</b>, atau <b>.</b> diikuti <b>open</b>? Jika YA dan di grup WhatsApp, bot akan membuka kembali izin mengirim pesan bagi seluruh member grup.</li>
                            <li>Apakah pesan diawali prefix <b>/</b>, <b>!</b>, atau <b>.</b> diikuti <b>online</b>? Jika YA dan di grup WhatsApp, bot akan mencari list anggota grup yang sedang aktif/online saat ini.</li>
                            <li>Apakah pesan adalah <b>Id Produk</b> di database (cth: <b>NETFLIX</b>, <b>CANVA</b>)? Jika YA, kirim rincian harga (bisa diketik langsung tanpa prefix).</li>
                            <li>Bila keyword salah atau command tidak tersedia, bot tetap diam (tidak menjawab sama sekali).</li>
                          </ul>
                        </div>
                      </div>

                      <h5 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2 mt-2">
                        <span className="w-1.5 h-3 bg-slate-900 rounded-sm"></span>
                        2. Cara Mengubah Alur Sesuai Bisnis Anda
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-slate-100 bg-white">
                          <span className="font-bold text-slate-800 text-xs block mb-1">Menambah / Mengubah Data Produk:</span>
                          <p className="text-slate-600 leading-relaxed text-[11px]">
                            Gunakan tab <b>Database Katalog</b> di atas. Anda bisa mengedit list harga, menambahkan promo baru, atau menghapus produk. Klik tombol "Simpan Perubahan Database" di bawah form untuk memicu auto-save ke file JSON di server, membuat bot langsung update harga tanpa restart server!
                          </p>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-100 bg-white">
                          <span className="font-bold text-slate-800 text-xs block mb-1">Mengkustomisasi Teks & Gambar Menu:</span>
                          <p className="text-slate-600 leading-relaxed text-[11px]">
                            Gunakan tab <b>Template Pesan</b> untuk menyulap bahasa dan layout visual sesuai gaya store Anda. Dukungan <i>Menu Image Banner link</i> Unsplash/Pinterest juga sangat interaktif. Tentukan template header dan footer lalu klik Simpan.
                          </p>
                        </div>
                      </div>

                      <h5 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2 mt-2">
                        <span className="w-1.5 h-3 bg-slate-900 rounded-sm"></span>
                        3. Struktur Integrasi File
                      </h5>
                      <p className="text-slate-600">
                        Aplikasi WhatsApp Bot Wanzz Store ini tersusun atas 3 file inti yang saling berkomunikasi:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 border border-slate-200 rounded-xl bg-white flex flex-col gap-1">
                          <span className="font-bold font-mono text-slate-800 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                            server.ts
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Berfungsi sebagai modul Backend NodeJS yang menampung library Baileys, listening chat masuk, mencocokkan product price, dan mengekspos API endpoint ke web.
                          </span>
                        </div>
                        <div className="p-3 border border-slate-200 rounded-xl bg-white flex flex-col gap-1">
                          <span className="font-bold font-mono text-slate-800 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-purple-500" />
                            src/database.json
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Penyimpanan persisten lokal yang menampung data model kategori, katalog produk, dan pengaturan template respons bot yang dapat diedit sewaktu-waktu.
                          </span>
                        </div>
                        <div className="p-3 border border-slate-200 rounded-xl bg-white flex flex-col gap-1">
                          <span className="font-bold font-mono text-slate-800 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-emerald-500" />
                            src/App.tsx
                          </span>
                          <span className="text-[11px] text-slate-500">
                            User Interface (web controller panel) ini yang Anda pakai untuk menyambungkan bot, memindai QR code, menyunting katalog, dan mencoba simulasi chat sandbox.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

            </div>

          </section>

        </div>
      </main>

      {/* FOOTER BAR */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-16 text-xs text-center text-slate-400 select-none">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 {settings.storeName} Auto Responder Manager. All Rights Reserved.</p>
          <p className="mt-1 text-[10px] text-slate-300">Dibuat secara utuh menggunakan Baileys Multi-Device SDK & React</p>
        </div>
      </footer>

      {/* CUSTOM CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden"
            >
              {/* Modal Body */}
              <div className="p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${
                    confirmModal.type === "danger" 
                      ? "bg-red-50 text-red-600" 
                      : confirmModal.type === "info"
                      ? "bg-slate-100 text-slate-800"
                      : "bg-amber-50 text-amber-600"
                  }`}>
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{confirmModal.title}</h4>
                </div>
                
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {confirmModal.message}
                </p>
              </div>

              {/* Modal Actions */}
              <div className="bg-slate-50 px-5 py-3.5 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                >
                  {confirmModal.cancelText}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    confirmModal.onConfirm();
                  }}
                  className={`px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg transition-all cursor-pointer ${
                    confirmModal.type === "danger" 
                      ? "bg-red-600 hover:bg-red-700 shadow-md shadow-red-200" 
                      : confirmModal.type === "info"
                      ? "bg-slate-950 hover:bg-slate-900" 
                      : "bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-200"
                  }`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {paymentMethodConfirmTarget !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-905 text-slate-900 leading-tight">Konfirmasi Metode Pembayaran</h4>
                    <span className="text-[10px] font-mono text-slate-400">ID: {paymentMethodConfirmTarget.id}</span>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-1.5 text-xs text-slate-705 text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Pelanggan:</span>
                    <span className="font-bold text-slate-800">{paymentMethodConfirmTarget.customerName || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Layanan:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[180px]">{paymentMethodConfirmTarget.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Total Tagihan:</span>
                    <span className="font-bold text-indigo-600">Rp{(paymentMethodConfirmTarget.sellingPrice || paymentMethodConfirmTarget.totalPrice || 0).toLocaleString("id-ID")}</span>
                  </div>
                </div>

                <div className="mt-1">
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1.5 uppercase tracking-wider font-sans">
                    Pilih Metode Pembayaran Realisasi:
                  </label>
                  <select
                    value={confirmPaymentMethodVal}
                    onChange={(e) => setConfirmPaymentMethodVal(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-hidden font-bold text-slate-800 bg-white cursor-pointer"
                  >
                    <option value="QRIS">QRIS</option>
                    <option value="Dana">Dana</option>
                    <option value="Gopay">Gopay</option>
                    <option value="OVO">OVO</option>
                    <option value="ShopeePay">ShopeePay</option>
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="Cash / Tunai">Cash / Tunai</option>
                  </select>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="bg-slate-50 px-5 py-3.5 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentMethodConfirmTarget(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLunasAndPaymentMethod}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100 rounded-lg transition-all cursor-pointer"
                >
                  Konfirmasi & Tandai Lunas
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING SCROLL TO TOP BUTTON */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 p-3 rounded-full bg-slate-900 border border-slate-800 text-white shadow-lg cursor-pointer z-40 hover:bg-slate-850 transition-all flex items-center justify-center"
            title="Kembali ke atas"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
