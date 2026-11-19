import { ChatMessage, Contact, LocalIdentity, NetworkProfileId } from '../types/pulselink';

const DB_NAME = 'pulselink_offline_store';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';
const STATE_KEY = 'snapshot_v1';

export interface PersistedPulseLinkState {
  identity: LocalIdentity;
  contacts: Contact[];
  messages: ChatMessage[];
  networkProfile: NetworkProfileId;
  dataSaverMode: boolean;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadPersistedState(): Promise<PersistedPulseLinkState | null> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(STATE_KEY);
      req.onsuccess = () => resolve((req.result as PersistedPulseLinkState) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      return raw ? (JSON.parse(raw) as PersistedPulseLinkState) : null;
    } catch {
      return null;
    }
  }
}

export async function savePersistedState(state: PersistedPulseLinkState): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(state, STATE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {
      // Storage quota full; keep running in memory
    }
  }
}

export async function clearPersistedState(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(STATE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(STATE_KEY);
  } catch {
    // ignore
  }
}
