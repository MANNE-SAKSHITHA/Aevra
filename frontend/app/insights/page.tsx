"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { useAuth } from "@/lib/auth-context";
import {
  api,
  ApiError,
  InsightsResponse,
  Reflection,
  Recommendation,
} from "@/lib/api";
import AppNav from "@/components/AppNav";

const CHART_COLORS = ["#B7CDE3", "#AFC8DE", "#6E8499", "#C7DDEE", "#44576A"];

export default function InsightsPage() {
  const router = useRouter();
  const { user, accessToken, loading } = useAuth();

  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [insightsRes, reflectionsRes, recsRes] = await Promise.all([
        api.getInsights(accessToken),
        api.listReflections(accessToken),
        api.getRecommendations(accessToken),
      ]);
      setInsights(insightsRes);
      setReflections(reflectionsRes);
      setRecommendations(recsRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your insights.");
    }
  }, [accessToken]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onGenerateReflection = async () => {
    if (!accessToken) return;
    setGenerating(true);
    setGenMessage(null);
    try {
      await api.generateReflection(accessToken);
      setGenMessage("Aevra is thinking it over — check back in a few seconds.");
      setTimeout(async () => {
        const updated = await api.listReflections(accessToken);
        setReflections(updated);
      }, 6000);
    } catch (err) {
      setGenMessage(
        err instanceof ApiError ? err.message : "Couldn't generate a reflection right now."
      );
    } finally {
      setGenerating(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7FAFC] text-[#6E8499]">
        Loading…
      </main>
    );
  }

  // Flatten mood_trend into a recharts-friendly shape: one row per period,
  // one column per mood, so multiple <Line> series can share an x-axis.
  const allMoods = new Set<string>();
  insights?.mood_trend.forEach((p) => Object.keys(p.mood_counts).forEach((m) => allMoods.add(m)));
  const moodChartData =
    insights?.mood_trend.map((p) => ({ period: p.period, ...p.mood_counts })) ?? [];

  return (
    <main className="min-h-screen bg-[#F7FAFC] text-[#44576A]">
      <AppNav />

      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-2xl italic">Insights</h1>
        <p className="mt-1 text-sm text-[#6E8499]">Patterns across everything you've written.</p>

        {error && <p className="mt-6 text-sm text-red-400">{error}</p>}

        {insights && (
          <>
            {/* Streak summary */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Current streak", value: `${insights.streak.current_streak_days}d` },
                { label: "Longest streak", value: `${insights.streak.longest_streak_days}d` },
                { label: "Total entries", value: insights.streak.total_entries },
                { label: "Active days", value: insights.streak.active_days },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-[#E6EDF5] bg-[#EEF5FA] p-4 text-center"
                >
                  <p className="font-display text-xl italic text-[#44576A]">{stat.value}</p>
                  <p className="mt-1 text-xs text-[#6E8499]">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Mood trend */}
            {moodChartData.length > 0 && (
              <div className="mt-8 rounded-2xl border border-[#E6EDF5] bg-[#FFFFFF] p-5 shadow-sm">
                <h2 className="font-display text-base italic">Mood over time</h2>
                <div className="mt-4 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={moodChartData}>
                      <CartesianGrid stroke="rgba(127,147,167,0.16)" vertical={false} />
                      <XAxis dataKey="period" stroke="#6E8499" fontSize={11} />
                      <YAxis stroke="#6E8499" fontSize={11} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "#0B0D12",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      {Array.from(allMoods).map((mood, i) => (
                        <Line
                          key={mood}
                          type="monotone"
                          dataKey={mood}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top tags */}
            {insights.top_tags.length > 0 && (
              <div className="mt-6 rounded-2xl border border-[#E6EDF5] bg-[#FFFFFF] p-5 shadow-sm">
                <h2 className="font-display text-base italic">What you write about most</h2>
                <div className="mt-4 h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={insights.top_tags} layout="vertical" margin={{ left: 20 }}>
                      <XAxis type="number" stroke="#6E8499" fontSize={11} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#6E8499"
                        fontSize={11}
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0B0D12",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" fill="#B7CDE3" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}

        {/* Reflections */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base italic">Reflections</h2>
            <button
              onClick={onGenerateReflection}
              disabled={generating}
              className="rounded-full border border-[#E6EDF5] bg-[#EEF5FA] px-3 py-1.5 text-xs text-[#6E8499] transition hover:border-[#AFC8DE] hover:text-[#44576A] disabled:opacity-50"
            >
              {generating ? "Thinking…" : "Generate new"}
            </button>
          </div>
          {genMessage && <p className="mt-2 text-xs text-[#6E8499]">{genMessage}</p>}

          {reflections.length === 0 ? (
            <p className="mt-4 text-sm text-[#6E8499]">
              No reflections yet — write a few entries, then generate one.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {reflections.map((r) => (
                <li key={r.id} className="text-sm italic text-[#44576A]">
                  "{r.content}"
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {recommendations.map((rec, i) => (
              <div key={i} className="rounded-2xl border border-[#E6EDF5] bg-[#EEF5FA] p-4">
                <p className="text-xs uppercase tracking-wide text-[#44576A]">{rec.kind}</p>
                <p className="mt-1 font-display text-sm italic">{rec.title}</p>
                <p className="mt-1 text-xs text-[#6E8499]">{rec.detail}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
