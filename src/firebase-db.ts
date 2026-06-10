import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  collection, 
  deleteDoc 
} from "firebase/firestore";

const configPath = path.join(process.cwd(), "firebase-applet-config.json");

let firestoreDb: any = null;

export function isFirebaseEnabled(): boolean {
  if (process.env.DISABLE_FIREBASE === "true") {
    return false;
  }
  return fs.existsSync(configPath);
}

export function getFirestoreDb() {
  if (!isFirebaseEnabled()) {
    return null;
  }
  if (!firestoreDb) {
    try {
      const configRaw = fs.readFileSync(configPath, "utf-8");
      const firebaseConfig = JSON.parse(configRaw);
      const app = initializeApp(firebaseConfig);
      firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    } catch (e) {
      console.error("Failed to initialize Firebase:", e);
    }
  }
  return firestoreDb;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: "server_admin",
      email: "server@default.internal",
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('[Firebase Error Detail]:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Reads the latest snapshot from Firestore if Firebase is enabled.
 * Returns null if database is empty or not enabled.
 */
export async function syncFromFirestore(): Promise<any> {
  const db = getFirestoreDb();
  if (!db) return null;

  try {
    const data: any = {
      categories: [],
      products: [],
      settings: {},
      commands: [],
      transactions: []
    };

    // Get settings document
    let settingsDoc;
    try {
      settingsDoc = await getDoc(doc(db, "settings", "bot_settings"));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "settings/bot_settings");
    }

    if (settingsDoc.exists()) {
      data.settings = settingsDoc.data();
    } else {
      data.settings = null;
    }

    // Get categories collection
    let categoriesSnap;
    try {
      categoriesSnap = await getDocs(collection(db, "categories"));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "categories");
    }
    categoriesSnap.forEach((docSnap) => {
      data.categories.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Get products collection
    let productsSnap;
    try {
      productsSnap = await getDocs(collection(db, "products"));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "products");
    }
    productsSnap.forEach((docSnap) => {
      data.products.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Get commands collection
    let commandsSnap;
    try {
      commandsSnap = await getDocs(collection(db, "commands"));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "commands");
    }
    commandsSnap.forEach((docSnap) => {
      data.commands.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Get transactions collection
    let transactionsSnap;
    try {
      transactionsSnap = await getDocs(collection(db, "transactions"));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "transactions");
    }
    transactionsSnap.forEach((docSnap) => {
      data.transactions.push({ id: docSnap.id, ...docSnap.data() });
    });

    // If there is no settings doc and collections are empty, consider as unseeded.
    if (!data.settings && data.categories.length === 0 && data.products.length === 0) {
      return null;
    }

    if (!data.settings) data.settings = {};

    return data;
  } catch (err) {
    console.error("Error reading from Firestore:", err);
    throw err;
  }
}

/**
 * Syncs memory database format back to Cloud Firestore with delta calculation and delete handling.
 */
export async function syncToFirestore(data: any): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  try {
    // 1. Save settings document
    if (data.settings) {
      try {
        await setDoc(doc(db, "settings", "bot_settings"), data.settings, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, "settings/bot_settings");
      }
    }

    // 2. Sync collections
    const syncCollection = async (colName: string, items: any[]) => {
      if (!items || !Array.isArray(items)) return;

      // Read current keys to detect deletions
      let existingSnap;
      try {
        existingSnap = await getDocs(collection(db, colName));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, colName);
      }
      
      const existingIds = new Set(existingSnap.docs.map(d => d.id));
      const newIds = new Set(items.map(item => item.id).filter(id => !!id));

      // Delete items no longer present
      for (const id of existingIds) {
        if (!newIds.has(id)) {
          try {
            await deleteDoc(doc(db as any, colName, id as string));
          } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, `${colName}/${id}`);
          }
        }
      }

      // Upsert new/updated items
      for (const item of items) {
        if (!item.id) continue;
        const { id, ...rest } = item;
        try {
          await setDoc(doc(db as any, colName, id as string), rest, { merge: true });
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `${colName}/${id}`);
        }
      }
    };

    if (data.categories) await syncCollection("categories", data.categories);
    if (data.products) await syncCollection("products", data.products);
    if (data.commands) await syncCollection("commands", data.commands);
    if (data.transactions) await syncCollection("transactions", data.transactions);

    console.log("Firestore successfully synchronized!");
  } catch (err) {
    console.error("Error syncing to Firestore:", err);
    throw err;
  }
}
