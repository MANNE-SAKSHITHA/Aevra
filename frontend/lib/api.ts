import {
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  readAppStore,
  writeAppStore,
} from "./storage";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function getSession(token?: string) {
  const store = readAppStore();
  const auth = store.auth;
  if (!auth) return null;
  if (token && auth.accessToken !== token) return null;
  return auth;
}

function getCurrentUser(token?: string): User {
  const session = getSession(token);
  if (!session) throw new ApiError("Please log in to continue.", 401);

  const user = getRecord<User>("users", session.userId);
  if (!user) throw new ApiError("Your session could not be restored.", 401);
  return user;
}

function sortEntriesDescending(entries: Entry[]) {
  return [...entries].sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
}

function toTagObjects(tagNames: string[] = []) {
  return tagNames.map((name) => ({ id: createId("tag"), name }));
}

export interface User {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  password?: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Entry {
  id: string;
  owner_id: string;
  title: string | null;
  content: string;
  ai_summary: string | null;
  ai_mood: string | null;
  ai_emotion: string | null;
  ai_status: string;
  ai_error: string | null;
  entry_date: string;
  is_favorite: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}

export interface PaginatedEntries {
  items: Entry[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Media {
  id: string;
  owner_id: string;
  entry_id: string | null;
  kind: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  transcript: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "entry" | "tag";
  entry_date: string | null;
  mood: string | null;
  tag_count: number | null;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface MoodTrendPoint {
  period: string;
  mood_counts: Record<string, number>;
}

export interface TagFrequency {
  name: string;
  count: number;
}

export interface WritingStreak {
  current_streak_days: number;
  longest_streak_days: number;
  total_entries: number;
  active_days: number;
}

export interface InsightsResponse {
  mood_trend: MoodTrendPoint[];
  top_tags: TagFrequency[];
  streak: WritingStreak;
  entries_per_month: TagFrequency[];
}

export interface Reflection {
  id: string;
  content: string;
  based_on_entry_count: number;
  created_at: string;
}

export interface Recommendation {
  kind: string;
  title: string;
  detail: string;
  entry_id: string | null;
  tag_name: string | null;
}

export const api = {
  register: async (payload: { full_name: string; password: string }) => {
    const existing = listRecords<User>("users").find((user) => user.full_name === payload.full_name);
    if (existing) {
      throw new ApiError("That name is already taken.", 409);
    }

    const user = createRecord<User>("users", {
      id: createId("user"),
      full_name: payload.full_name,
      password: payload.password,
      role: "user",
      is_active: true,
      is_verified: true,
      created_at: new Date().toISOString(),
    });

    const tokens = {
      access_token: createId("access"),
      refresh_token: createId("refresh"),
      token_type: "bearer",
    };

    const store = readAppStore();
    store.auth = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      userId: user.id,
      fullName: user.full_name,
      createdAt: user.created_at,
    };
    writeAppStore(store);

    return user;
  },

  login: async (fullName: string, password: string) => {
    const user = listRecords<User>("users").find(
      (candidate) => candidate.full_name === fullName && candidate.password === password
    );

    if (!user) {
      throw new ApiError("We couldn’t find that account. Try Maya / password123.", 401);
    }

    const tokens: TokenPair = {
      access_token: createId("access"),
      refresh_token: createId("refresh"),
      token_type: "bearer",
    };

    const store = readAppStore();
    store.auth = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      userId: user.id,
      fullName: user.full_name,
      createdAt: user.created_at,
    };
    writeAppStore(store);

    return tokens;
  },

  me: async (token: string) => {
    return getCurrentUser(token);
  },

  listEntries: async (token: string, params: { page?: number; search?: string; tag?: string } = {}) => {
    const user = getCurrentUser(token);
    const pageSize = 20;
    const entries = sortEntriesDescending(
      listRecords<Entry>("entries").filter((entry) => entry.owner_id === user.id)
    );

    const filtered = entries.filter((entry) => {
      const haystack = `${entry.title ?? ""} ${entry.content} ${entry.tags.map((tag) => tag.name).join(" ")}`.toLowerCase();
      const query = params.search?.toLowerCase() ?? "";
      const tagMatch = params.tag ? entry.tags.some((tag) => tag.name.toLowerCase() === params.tag?.toLowerCase()) : true;
      return haystack.includes(query) && tagMatch;
    });

    const page = params.page && params.page > 0 ? params.page : 1;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      items,
      total: filtered.length,
      page,
      page_size: pageSize,
      pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    } satisfies PaginatedEntries;
  },

  createEntry: async (
    token: string,
    payload: { title?: string; content: string; tags?: string[]; is_favorite?: boolean }
  ) => {
    const user = getCurrentUser(token);
    const entry: Entry = {
      id: createId("entry"),
      owner_id: user.id,
      title: payload.title?.trim() || null,
      content: payload.content.trim(),
      ai_summary: payload.content.trim().slice(0, 80) || null,
      ai_mood: payload.tags?.[0] ?? "calm",
      ai_emotion: payload.tags?.[0] ?? "reflective",
      ai_status: "completed",
      ai_error: null,
      entry_date: new Date().toISOString(),
      is_favorite: payload.is_favorite ?? false,
      is_locked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: toTagObjects(payload.tags ?? []),
    };

    createRecord<Entry>("entries", entry);
    return entry;
  },

  deleteEntry: async (token: string, id: string) => {
    getCurrentUser(token);
    deleteRecord("entries", id);
  },

  semanticSearch: async (token: string, q: string) => {
    const user = getCurrentUser(token);
    const query = q.toLowerCase();
    return listRecords<Entry>("entries")
      .filter((entry) => entry.owner_id === user.id)
      .map((entry) => ({
        entry,
        relevance:
          (entry.title?.toLowerCase().includes(query) ? 2 : 0) +
          (entry.content.toLowerCase().includes(query) ? 1 : 0),
      }))
      .filter((item) => item.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance);
  },

  uploadPhoto: async (token: string, file: File, entryId?: string) => {
    const user = getCurrentUser(token);
    const media: Media = {
      id: createId("media"),
      owner_id: user.id,
      entry_id: entryId ?? null,
      kind: file.type.startsWith("image/") ? "image" : "file",
      file_path: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      duration_seconds: null,
      transcript: null,
      status: "completed",
      error_message: null,
      created_at: new Date().toISOString(),
    };
    createRecord<Media>("media", media);
    return media;
  },

  uploadVoiceJournal: async (token: string, file: Blob, filename = "recording.webm") => {
    const user = getCurrentUser(token);
    const media: Media = {
      id: createId("media"),
      owner_id: user.id,
      entry_id: null,
      kind: "voice",
      file_path: filename,
      mime_type: file.type || "audio/webm",
      size_bytes: file.size,
      duration_seconds: null,
      transcript: "Voice memory captured locally.",
      status: "completed",
      error_message: null,
      created_at: new Date().toISOString(),
    };
    createRecord<Media>("media", media);
    return media;
  },

  getMedia: async (token: string, id: string) => {
    getCurrentUser(token);
    const media = getRecord<Media>("media", id);
    if (!media) throw new ApiError("Media was not found.", 404);
    return media;
  },

  createEntryFromVoiceJournal: async (token: string, mediaId: string) => {
    const user = getCurrentUser(token);
    const media = getRecord<Media>("media", mediaId);
    const entry: Entry = {
      id: createId("entry"),
      owner_id: user.id,
      title: "Voice memory",
      content: media?.transcript || "Voice memory captured locally.",
      ai_summary: "Captured from a voice memory.",
      ai_mood: "reflective",
      ai_emotion: "calm",
      ai_status: "completed",
      ai_error: null,
      entry_date: new Date().toISOString(),
      is_favorite: false,
      is_locked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [{ id: createId("tag"), name: "voice" }],
    };
    createRecord<Entry>("entries", entry);
    return { entry_id: entry.id };
  },

  narrateEntry: async (token: string, entryId: string, useSummary = false) => {
    getCurrentUser(token);
    return {
      media_id: createId("media"),
      status: useSummary ? "completed" : "completed",
    };
  },

  getGraph: async (token: string, limit = 300) => {
    const user = getCurrentUser(token);
    const entries = listRecords<Entry>("entries").filter((entry) => entry.owner_id === user.id);
    const nodes: GraphNode[] = entries.slice(0, limit).map((entry) => ({
      id: entry.id,
      label: entry.title ?? entry.content.slice(0, 20),
      type: "entry",
      entry_date: entry.entry_date,
      mood: entry.ai_mood,
      tag_count: entry.tags.length,
    }));
    const tagNodes = Array.from(new Set(entries.flatMap((entry) => entry.tags.map((tag) => tag.name)))).map(
      (tagName, index) => ({
        id: `tag-${index}`,
        label: tagName,
        type: "tag" as const,
        entry_date: null,
        mood: null,
        tag_count: null,
      })
    );
    const edges = entries.flatMap((entry) =>
      entry.tags.map((tag) => ({ source: entry.id, target: `tag-${tag.name}` }))
    );

    return {
      nodes: [...nodes, ...tagNodes],
      edges,
    } satisfies GraphResponse;
  },

  getInsights: async (token: string) => {
    const user = getCurrentUser(token);
    const entries = listRecords<Entry>("entries").filter((entry) => entry.owner_id === user.id);

    const moodCounts = entries.reduce<Record<string, number>>((acc, entry) => {
      const key = entry.ai_mood || "calm";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const monthMap = new Map<string, number>();
    entries.forEach((entry) => {
      const month = new Date(entry.entry_date).toLocaleDateString(undefined, { month: "short", year: "numeric" });
      monthMap.set(month, (monthMap.get(month) ?? 0) + 1);
    });

    const tagCounts = entries.flatMap((entry) => entry.tags.map((tag) => tag.name));
    const topTags = Array.from(new Map(tagCounts.map((name) => [name, (tagCounts.filter((value) => value === name)).length])).entries()).map(
      ([name, count]) => ({ name, count })
    );

    const sortedEntries = [...entries].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    const streak = sortedEntries.length === 0 ? 1 : Math.min(30, Math.max(1, sortedEntries.length));

    return {
      mood_trend: [
        {
          period: "This month",
          mood_counts: moodCounts,
        },
      ],
      top_tags: topTags.slice(0, 5),
      streak: {
        current_streak_days: streak,
        longest_streak_days: streak,
        total_entries: entries.length,
        active_days: new Set(entries.map((entry) => new Date(entry.entry_date).toDateString())).size,
      },
      entries_per_month: Array.from(monthMap.entries()).map(([name, count]) => ({ name, count })),
    } satisfies InsightsResponse;
  },

  listReflections: async (token: string) => {
    const user = getCurrentUser(token);
    return listRecords<Reflection>("reflections").filter((reflection) => reflection.content.length > 0);
  },

  generateReflection: async (token: string) => {
    getCurrentUser(token);
    const reflection: Reflection = {
      id: createId("reflection"),
      content: "Your memories feel grounded and meaningful today.",
      based_on_entry_count: listRecords<Entry>("entries").length,
      created_at: new Date().toISOString(),
    };
    createRecord<Reflection>("reflections", reflection);
    return { status: "completed" };
  },

  getRecommendations: async (token: string) => {
    getCurrentUser(token);
    const entries = listRecords<Entry>("entries");
    return [
      {
        kind: "prompt",
        title: "Keep writing",
        detail: "Your recent entries show a steady rhythm of reflection.",
        entry_id: entries[0]?.id ?? null,
        tag_name: entries[0]?.tags[0]?.name ?? null,
      },
    ] satisfies Recommendation[];
  },
};

export function storageUrl(relativePath: string) {
  return `local://${relativePath}`;
}
