// Local session storage using IndexedDB.
// Saves completed monitoring sessions so users can look back at past results.
// Nothing leaves the browser — this is purely local-first.
//
// Each session stores: averages, peaks, timestamps, duration, edge region.
// Future: could sync to a backend if we ever add accounts.

const DB_NAME = 'netpulse';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

export interface SavedSession {
  id: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  colo: string;
  avgDownload: number;
  avgUpload: number;
  bestDownload: number;
  bestUpload: number;
  lowestPing: number;
  peakJitter: number;
  avgStability: number;
  sampleCount: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('startedAt', 'startedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSession(session: SavedSession): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(session);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB might not be available (private browsing, etc.)
    // Silently fail — the app works fine without persistence.
    console.warn('Could not save session to IndexedDB');
  }
}

export async function getRecentSessions(limit = 10): Promise<SavedSession[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('startedAt');

    return new Promise((resolve, reject) => {
      const results: SavedSession[] = [];
      // Walk backwards (newest first)
      const cursor = index.openCursor(null, 'prev');

      cursor.onsuccess = () => {
        const c = cursor.result;
        if (c && results.length < limit) {
          results.push(c.value as SavedSession);
          c.continue();
        } else {
          db.close();
          resolve(results);
        }
      };
      cursor.onerror = () => {
        db.close();
        reject(cursor.error);
      };
    });
  } catch {
    return [];
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch {
    // same — fail silently
  }
}
