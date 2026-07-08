"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, Entry } from "@/lib/api";
import VoiceRecorder from "@/components/VoiceRecorder";
import AppNav from "@/components/AppNav";
import QuoteOfTheDay from "@/components/QuoteOfTheDay";
import MemoryCalendar from "@/components/MemoryCalendar";

const WELCOME_MESSAGES = [
  "Ready to capture another beautiful memory?",
  "Every memory deserves a place to live.",
  "Your story continues today.",
  "Write something your future self will smile at.",
  "Turn today's moments into tomorrow's memories.",
];

const REFLECTION_QUESTIONS = [
  "What made you smile today?",
  "What are you grateful for today?",
  "What challenged you today?",
  "What memory do you never want to forget?",
  "What would you love to remember about today?",
  "What felt meaningful today?",
  "What moment felt quietly beautiful today?",
  "What are you carrying forward from today?",
  "Where did you feel most like yourself today?",
  "What small kindness touched your day?",
];

const MOOD_OPTIONS = [
  { value: "happy", emoji: "😊", label: "Happy" },
  { value: "calm", emoji: "😌", label: "Calm" },
  { value: "excited", emoji: "🤩", label: "Excited" },
  { value: "sad", emoji: "😔", label: "Sad" },
  { value: "stressed", emoji: "😤", label: "Stressed" },
  { value: "loved", emoji: "❤️", label: "Loved" },
  { value: "tired", emoji: "😴", label: "Tired" },
  { value: "reflective", emoji: "🤔", label: "Reflective" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, accessToken, loading } = useAuth();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>("calm");
  const [selectedMemory, setSelectedMemory] = useState<Entry | null>(null);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const welcomeMessage = useMemo(() => {
    const startDate = new Date("2026-01-01T00:00:00Z");
    const today = new Date();
    const dayOffset = Math.floor((today.getTime() - startDate.getTime()) / 86_400_000);
    return WELCOME_MESSAGES[(dayOffset + 3) % WELCOME_MESSAGES.length];
  }, []);

  const reflectionQuestion = useMemo(() => {
    const startDate = new Date("2026-01-01T00:00:00Z");
    const today = new Date();
    const dayOffset = Math.floor((today.getTime() - startDate.getTime()) / 86_400_000);
    return REFLECTION_QUESTIONS[(dayOffset + 7) % REFLECTION_QUESTIONS.length];
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!accessToken) return;
    setEntriesLoading(true);
    setLoadError(null);
    try {
      const res = await api.listEntries(accessToken);
      setEntries(res.items);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load your entries.");
    } finally {
      setEntriesLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (accessToken) fetchEntries();
  }, [accessToken, fetchEntries]);

  useEffect(() => {
    if (!entries.some((e) => e.ai_status === "pending")) return;
    const id = setInterval(fetchEntries, 4000);
    return () => clearInterval(id);
  }, [entries, fetchEntries]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !content.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.createEntry(accessToken, {
        title: title.trim() || undefined,
        content: content.trim(),
        tags: selectedMood ? [selectedMood] : undefined,
      });
      setContent("");
      setTitle("");
      setSelectedMood("calm");
      await fetchEntries();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save that entry.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!accessToken) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await api.deleteEntry(accessToken, id);
    } catch {
      fetchEntries();
    }
  };

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !accessToken) return;
    setUploadingPhoto(true);
    try {
      const entry = await api.createEntry(accessToken, {
        content: `📷 Photo memory (${file.name})`,
        tags: ["photo"],
      });
      await api.uploadPhoto(accessToken, file, entry.id);
      await fetchEntries();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't upload that photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openRandomMemory = () => {
    if (entries.length === 0) return;
    const randomEntry = entries[Math.floor(Math.random() * entries.length)];
    setSelectedMemory(randomEntry);
  };

  const photoCount = entries.reduce((count, entry) => {
    const hasPhotoTag = entry.tags.some((tag) => tag.name.toLowerCase() === "photo");
    return count + (hasPhotoTag || entry.content.includes("📷") ? 1 : 0);
  }, 0);

  const streakValue = Math.max(1, Math.min(365, entries.length + 4));
  const joinedDays = user?.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86_400_000))
    : 0;

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7FAFC] text-[#6E8499]">
        Loading your journal…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7FAFC] text-[#44576A]">
      <AppNav />

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-4 lg:self-start">
            <MemoryCalendar entries={entries} />
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-[#E6EDF5] bg-white/70 p-5 shadow-[0_20px_60px_-30px_rgba(68,87,106,0.3)] backdrop-blur-xl">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[#6E8499]">
                    {greeting}, {user.full_name || "friend"} ☀️
                  </p>
                  <h1 className="mt-1 font-display text-2xl italic text-[#44576A]">
                    Welcome to your space.
                  </h1>
                  <p className="mt-2 text-sm text-[#6E8499]">{welcomeMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={openRandomMemory}
                  className="rounded-full border border-[#E6EDF5] bg-[#EEF5FA] px-4 py-2 text-sm text-[#6E8499] transition hover:border-[#AFC8DE] hover:text-[#44576A]"
                >
                  ✨ Surprise Me
                </button>
              </div>

              <div className="dashboard-auxiliary mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-[#E6EDF5] bg-[#FFFFFF] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#44576A]">
                    <span>🔥</span>
                    <span>{streakValue} Day Writing Streak</span>
                  </div>
                  <p className="mt-2 text-sm text-[#6E8499]">
                    {streakValue >= 365
                      ? "A full year of thoughtful writing."
                      : streakValue >= 100
                        ? "A remarkable milestone."
                        : streakValue >= 30
                          ? "Your consistency is shining."
                          : "Keep the streak alive today."}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E6EDF5] bg-[#EEF5FA] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#6E8499]">Daily reflection</p>
                  <p className="mt-2 text-sm text-[#44576A]">{reflectionQuestion}</p>
                </div>
              </div>

              <div className="dashboard-auxiliary mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-[#E6EDF5] bg-[#FFFFFF] p-3 text-center">
                  <p className="text-lg font-semibold text-[#44576A]">{entries.length}</p>
                  <p className="text-xs text-[#6E8499]">Memories written</p>
                </div>
                <div className="rounded-2xl border border-[#E6EDF5] bg-[#FFFFFF] p-3 text-center">
                  <p className="text-lg font-semibold text-[#44576A]">{photoCount}</p>
                  <p className="text-xs text-[#6E8499]">Photos saved</p>
                </div>
                <div className="rounded-2xl border border-[#E6EDF5] bg-[#FFFFFF] p-3 text-center">
                  <p className="text-lg font-semibold text-[#44576A]">{streakValue}</p>
                  <p className="text-xs text-[#6E8499]">Current streak</p>
                </div>
                <div className="rounded-2xl border border-[#E6EDF5] bg-[#FFFFFF] p-3 text-center">
                  <p className="text-lg font-semibold text-[#44576A]">{joinedDays}</p>
                  <p className="text-xs text-[#6E8499]">Days since joining</p>
                </div>
              </div>

              <div className="mt-4">
                <QuoteOfTheDay />
              </div>
            </div>

            <div className="dashboard-auxiliary rounded-[24px] border border-[#E6EDF5] bg-white/70 p-4 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#6E8499]">How are you feeling?</p>
                  <p className="text-sm text-[#44576A]">Choose today’s mood before you write.</p>
                </div>
                <div className="rounded-full bg-[#EEF5FA] px-3 py-1 text-sm text-[#6E8499]">
                  {selectedMood ? MOOD_OPTIONS.find((item) => item.value === selectedMood)?.label : "Ready"}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {MOOD_OPTIONS.map((mood) => {
                  const active = selectedMood === mood.value;
                  return (
                    <button
                      key={mood.value}
                      type="button"
                      onClick={() => setSelectedMood(mood.value)}
                      className={`rounded-full px-3 py-2 text-sm transition ${
                        active
                          ? "bg-[#D9E7F3] text-[#44576A]"
                          : "border border-[#E6EDF5] bg-[#FFFFFF] text-[#6E8499] hover:text-[#44576A]"
                      }`}
                    >
                      {mood.emoji} {mood.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] border border-[#E6EDF5] bg-[#FFFFFF]/90 p-5 shadow-[0_20px_60px_-30px_rgba(68,87,106,0.2)] backdrop-blur-xl">
              <p className="text-sm text-[#6E8499]">Write a fresh memory</p>
              <form onSubmit={onCreate} className="mt-3">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="mb-3 w-full bg-transparent text-lg font-medium text-[#44576A] placeholder:text-[#6E8499]/70 outline-none"
                />
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What happened today?"
                  required
                  rows={4}
                  className="w-full resize-none bg-transparent text-sm text-[#44576A] placeholder:text-[#6E8499]/70 outline-none"
                />
                {saveError && <p className="mt-2 text-sm text-red-400">{saveError}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-[#6E8499]">
                    {selectedMood ? `Mood: ${MOOD_OPTIONS.find((item) => item.value === selectedMood)?.label}` : "Choose a mood"}
                  </p>
                  <button
                    type="submit"
                    disabled={saving || !content.trim()}
                    className="rounded-full bg-[#B7CDE3] px-5 py-2 text-sm font-medium text-[#44576A] transition hover:bg-[#AFC8DE] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save memory"}
                  </button>
                </div>
              </form>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {accessToken && (
                <VoiceRecorder accessToken={accessToken} onEntryCreated={fetchEntries} />
              )}

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPhotoSelected}
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="rounded-full border border-[#E6EDF5] bg-[#EEF5FA] px-4 py-2 text-sm text-[#6E8499] transition hover:border-[#AFC8DE] hover:text-[#44576A] disabled:opacity-50"
              >
                {uploadingPhoto ? "Uploading…" : "Add a photo"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {entriesLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-[24px] border border-[#E6EDF5] bg-white/70" />
            ))}
          </div>
        )}
        {loadError && <p className="text-sm text-red-400">{loadError}</p>}
        {!entriesLoading && entries.length === 0 && !loadError && (
          <div className="rounded-[28px] border border-dashed border-[#E6EDF5] bg-[#EEF5FA]/70 p-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FFFFFF] text-2xl shadow-sm">
              ✨
            </div>
            <p className="mt-4 text-lg font-medium text-[#44576A]">Your next memory is waiting to be written.</p>
            <p className="mt-2 text-sm text-[#6E8499]">
              Start with one honest sentence and let the rest unfold naturally.
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="group rounded-[24px] border border-[#E6EDF5] bg-[#FFFFFF]/90 p-5 shadow-[0_18px_50px_-24px_rgba(68,87,106,0.28)] transition hover:-translate-y-0.5 hover:border-[#AFC8DE]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  {entry.title && (
                    <h3 className="font-display text-base italic">{entry.title}</h3>
                  )}
                  <p className="dashboard-entry-content mt-1 text-sm text-[#44576A]">{entry.content}</p>

                  {entry.ai_status === "pending" && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-[#6E8499]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#B7CDE3]" />
                      Aevra is thinking about this memory…
                    </p>
                  )}
                  {entry.ai_status === "completed" && entry.ai_summary && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs italic text-[#6E8499]">
                      <span className="text-[#B7CDE3]">✨</span>
                      {entry.ai_summary}
                    </p>
                  )}
                  {entry.ai_status === "failed" && (
                    <p className="mt-2 text-xs text-[#6E8499]">
                      AI enrichment unavailable — check that Ollama is running.
                    </p>
                  )}

                  <p className="mt-2 text-xs text-[#6E8499]">
                    {new Date(entry.entry_date).toLocaleString()}
                  </p>
                  {(entry.ai_mood || entry.tags.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {entry.ai_mood && (
                        <span className="rounded-full bg-[#B7CDE3]/20 px-2.5 py-0.5 text-xs text-[#44576A]">
                          {entry.ai_mood}
                        </span>
                      )}
                      {entry.tags.map((t) => (
                        <span
                          key={t.id}
                          className="rounded-full bg-[#EEF5FA] px-2.5 py-0.5 text-xs text-[#6E8499]"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onDelete(entry.id)}
                  aria-label="Delete entry"
                  className="shrink-0 rounded-full p-2 text-[#6E8499] opacity-0 transition hover:bg-[#EEF5FA] hover:text-red-500 group-hover:opacity-100"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path
                      d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.5 9.5h6l.5-9.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {selectedMemory && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#44576A]/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-[#E6EDF5] bg-[#FFFFFF] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#6E8499]">Random memory</p>
                <h2 className="mt-1 font-display text-xl italic text-[#44576A]">
                  {selectedMemory.title || "Untitled memory"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMemory(null)}
                className="rounded-full border border-[#E6EDF5] bg-[#EEF5FA] px-3 py-1 text-sm text-[#6E8499]"
              >
                Close
              </button>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#44576A]">{selectedMemory.content}</p>
            <p className="mt-4 text-xs text-[#6E8499]">
              {new Date(selectedMemory.entry_date).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
