"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, Entry } from "@/lib/api";
import AppNav from "@/components/AppNav";

function groupByMonth(entries: Entry[]) {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    const date = new Date(entry.entry_date);
    const key = date.toLocaleDateString(undefined, { year: "numeric", month: "long" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }
  return Array.from(groups.entries());
}

export default function TimelinePage() {
  const router = useRouter();
  const { user, accessToken, loading } = useAuth();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (pageNum: number) => {
      if (!accessToken) return;
      setFetching(true);
      setError(null);
      try {
        const res = await api.listEntries(accessToken, { page: pageNum });
        setEntries((prev) => (pageNum === 1 ? res.items : [...prev, ...res.items]));
        setTotalPages(res.pages);
        setPage(pageNum);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't load your timeline.");
      } finally {
        setFetching(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (accessToken) fetchPage(1);
  }, [accessToken, fetchPage]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7FAFC] text-[#6E8499]">
        Loading…
      </main>
    );
  }

  const months = groupByMonth(entries);

  return (
    <main className="min-h-screen bg-[#F7FAFC] text-[#44576A]">
      <AppNav />

      <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-2xl italic">Your timeline</h1>
        <p className="mt-1 text-sm text-[#6E8499]">Every memory, in the order you lived it.</p>

        {error && <p className="mt-6 text-sm text-red-400">{error}</p>}

        {!fetching && entries.length === 0 && !error && (
          <p className="mt-10 rounded-2xl border border-dashed border-[#E6EDF5] bg-[#EEF5FA] p-8 text-center text-sm text-[#6E8499]">
            Nothing here yet. Entries you save will appear on your timeline.
          </p>
        )}

        <div className="mt-8 space-y-10">
          {months.map(([month, monthEntries]) => (
            <div key={month}>
              <h2 className="sticky top-0 z-10 -mx-4 bg-[#F7FAFC]/95 px-4 py-2 font-display text-sm italic text-[#44576A] backdrop-blur sm:-mx-6 sm:px-6">
                {month}
              </h2>

              <ol className="relative mt-3 space-y-5 border-l border-[#E6EDF5] pl-6">
                {monthEntries.map((entry, i) => (
                  <motion.li
                    key={entry.id}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.4, delay: Math.min(i, 5) * 0.03 }}
                    className="relative"
                  >
                    <span className="absolute -left-[29px] top-1.5 h-2 w-2 rounded-full bg-[#B7CDE3]" />
                    <p className="text-xs text-[#6E8499]">
                      {new Date(entry.entry_date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    {entry.title && (
                      <h3 className="mt-0.5 font-display text-base italic">{entry.title}</h3>
                    )}
                    <p className="mt-1 text-sm text-[#44576A]">{entry.content}</p>
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
                  </motion.li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        {page < totalPages && (
          <div className="mt-10 flex justify-center">
            <button
              onClick={() => fetchPage(page + 1)}
              disabled={fetching}
              className="rounded-full border border-[#E6EDF5] bg-[#FFFFFF] px-5 py-2 text-sm text-[#6E8499] transition hover:border-[#AFC8DE] hover:text-[#44576A] disabled:opacity-50"
            >
              {fetching ? "Loading…" : "Load earlier memories"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
