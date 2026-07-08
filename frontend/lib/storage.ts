type StorageValue = string | number | boolean | null | StorageValue[] | { [key: string]: StorageValue };

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  fullName: string;
  createdAt: string;
}

export interface AppStore {
  users: StorageValue[];
  entries: StorageValue[];
  reflections: StorageValue[];
  media: StorageValue[];
  auth: AuthSession | null;
}

const STORAGE_KEY = "aevra.local";
const STORAGE_VERSION = "v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function buildSeedStore(): AppStore {
  const now = new Date().toISOString();
  const userId = createId("user");

  return {
    users: [
      {
        id: userId,
        full_name: "Maya",
        password: "password123",
        role: "user",
        is_active: true,
        is_verified: true,
        created_at: now,
      },
    ],
    entries: [
      {
        id: createId("entry"),
        owner_id: userId,
        title: "A calm morning",
        content: "I started the day slowly, watched the light move across the room, and felt grateful for a quiet hour.",
        ai_summary: "A peaceful morning with gratitude and reflection.",
        ai_mood: "calm",
        ai_emotion: "content",
        ai_status: "completed",
        ai_error: null,
        entry_date: now,
        is_favorite: true,
        is_locked: false,
        created_at: now,
        updated_at: now,
        tags: [{ id: createId("tag"), name: "calm" }],
      },
      {
        id: createId("entry"),
        owner_id: userId,
        title: "A bright afternoon",
        content: "I spent the afternoon walking, noticing the small details that made the day feel alive.",
        ai_summary: "A walk that brought energy and presence.",
        ai_mood: "happy",
        ai_emotion: "joyful",
        ai_status: "completed",
        ai_error: null,
        entry_date: new Date(Date.now() - 86_400_000).toISOString(),
        is_favorite: false,
        is_locked: false,
        created_at: new Date(Date.now() - 86_400_000).toISOString(),
        updated_at: new Date(Date.now() - 86_400_000).toISOString(),
        tags: [{ id: createId("tag"), name: "walk" }],
      },
    ],
    reflections: [
      {
        id: createId("reflection"),
        content: "The quietest days often carry the richest memories.",
        based_on_entry_count: 2,
        created_at: now,
      },
    ],
    media: [],
    auth: null,
  };
}

function normalizeStore(raw: unknown): AppStore {
  if (!raw || typeof raw !== "object") {
    return buildSeedStore();
  }

  const parsed = raw as Partial<AppStore>;
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    reflections: Array.isArray(parsed.reflections) ? parsed.reflections : [],
    media: Array.isArray(parsed.media) ? parsed.media : [],
    auth: parsed.auth ?? null,
  };
}

export function readAppStore(): AppStore {
  if (!isBrowser()) {
    return buildSeedStore();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = buildSeedStore();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, ...seeded }));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as { version?: string; [key: string]: unknown };
    if (parsed.version !== STORAGE_VERSION) {
      const migrated = buildSeedStore();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, ...migrated }));
      return migrated;
    }
    return normalizeStore(parsed);
  } catch {
    const seeded = buildSeedStore();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, ...seeded }));
    return seeded;
  }
}

export function writeAppStore(store: AppStore) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, ...store }));
}

export function readAuthSession(): AuthSession | null {
  const store = readAppStore();
  return store.auth;
}

export function writeAuthSession(session: AuthSession | null) {
  const store = readAppStore();
  store.auth = session;
  writeAppStore(store);
}

export function listRecords<T>(collection: "users" | "entries" | "reflections" | "media") {
  const store = readAppStore();
  return (store[collection] as T[]) ?? [];
}

export function createRecord<T extends object>(collection: "users" | "entries" | "reflections" | "media", value: T) {
  const store = readAppStore();
  const nextValue = { ...value } as T;
  const nextCollection = [...(store[collection] as T[]), nextValue];
  store[collection] = nextCollection as unknown as StorageValue[];
  writeAppStore(store);
  return nextValue;
}

export function getRecord<T>(collection: "users" | "entries" | "reflections" | "media", id: string) {
  const records = listRecords<T>(collection);
  return records.find((record) => (record as { id?: string }).id === id) ?? null;
}

export function updateRecord<T extends object>(
  collection: "users" | "entries" | "reflections" | "media",
  id: string,
  updater: (value: T) => T
) {
  const store = readAppStore();
  const currentRecords = (store[collection] as T[]) ?? [];
  const updated = currentRecords.map((record) => {
    if ((record as { id?: string }).id !== id) return record;
    return updater(record);
  });
  store[collection] = updated as unknown as StorageValue[];
  writeAppStore(store);
  return updated.find((record) => (record as { id?: string }).id === id) ?? null;
}

export function deleteRecord(collection: "users" | "entries" | "reflections" | "media", id: string) {
  const store = readAppStore();
  const currentRecords = (store[collection] as Array<{ id?: string }>) ?? [];
  const filtered = currentRecords.filter((record) => record.id !== id);
  store[collection] = filtered as unknown as StorageValue[];
  writeAppStore(store);
}
