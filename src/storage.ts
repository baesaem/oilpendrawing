import { DEFAULT_SETTINGS, type Drawing, type ProviderId, type Settings } from './types';

const SETTINGS_KEY = 'oilpen.settings.v1';

/** 설정은 localStorage(기억하기 켬) 또는 sessionStorage(끔)에 저장. 서버로는 절대 보내지 않음. */
export function loadSettings(): Settings {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        const providers = { ...DEFAULT_SETTINGS.providers };
        for (const id of Object.keys(providers) as ProviderId[]) {
          providers[id] = { ...providers[id], ...(parsed.providers?.[id] ?? {}) };
        }
        return { ...DEFAULT_SETTINGS, ...parsed, providers };
      }
    } catch {
      /* 손상된 값은 무시 */
    }
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: Settings) {
  const raw = JSON.stringify(s);
  try {
    if (s.rememberKeys) {
      localStorage.setItem(SETTINGS_KEY, raw);
      sessionStorage.removeItem(SETTINGS_KEY);
    } else {
      sessionStorage.setItem(SETTINGS_KEY, raw);
      localStorage.removeItem(SETTINGS_KEY);
    }
  } catch {
    /* 저장 불가 환경이면 메모리에서만 유지 */
  }
}

/* ---------- 이력: IndexedDB ---------- */

const DB_NAME = 'oilpen';
const STORE = 'drawings';
const MAX_HISTORY = 30;

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((res, rej) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export async function listDrawings(): Promise<Drawing[]> {
  try {
    const all = await tx<Drawing[]>('readonly', (s) => s.getAll());
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function putDrawing(d: Drawing): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(d));
    const all = await listDrawings();
    for (const old of all.slice(MAX_HISTORY)) await deleteDrawing(old.id);
  } catch {
    /* 저장 실패는 치명적이지 않음 */
  }
}

export async function deleteDrawing(id: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}
