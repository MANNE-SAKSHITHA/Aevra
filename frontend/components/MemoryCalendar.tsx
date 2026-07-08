"use client";

import { useMemo, useState } from "react";
import type { Entry } from "@/lib/api";

interface MemoryCalendarProps {
  entries: Entry[];
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function MemoryCalendar({ entries }: MemoryCalendarProps) {
  const [viewDate, setViewDate] = useState(startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(toDateKey(startOfDay(new Date())));

  const memoryDates = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      const date = startOfDay(new Date(entry.entry_date));
      set.add(toDateKey(date));
    }
    return set;
  }, [entries]);

  const selectedEntries = useMemo(() => {
    return entries.filter((entry) => toDateKey(startOfDay(new Date(entry.entry_date))) === selectedDate);
  }, [entries, selectedDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleString("en", { month: "long" });
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const leadingBlankDays = firstDay.getDay();
  const totalCells = Math.ceil((leadingBlankDays + daysInMonth) / 7) * 7;

  const todayKey = toDateKey(startOfDay(new Date()));

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const dayOffset = index - leadingBlankDays + 1;
    const current = new Date(year, month, dayOffset);
    const isCurrentMonth = current.getMonth() === month;
    const key = toDateKey(current);
    const hasMemory = memoryDates.has(key);
    const isToday = key === todayKey;
    const isSelected = key === selectedDate;

    return {
      key,
      current,
      isCurrentMonth,
      hasMemory,
      isToday,
      isSelected,
    };
  });

  return (
    <div className="rounded-[24px] border border-[#E6EDF5] bg-white/80 p-4 shadow-[0_20px_60px_-30px_rgba(68,87,106,0.25)] backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[#6E8499]">Memory Calendar</p>
          <p className="mt-1 text-sm font-medium text-[#44576A]">{monthName} {year}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="rounded-full border border-[#E6EDF5] bg-[#EEF5FA] px-2.5 py-1 text-sm text-[#6E8499]"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => {
              const today = startOfDay(new Date());
              setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelectedDate(toDateKey(today));
            }}
            className="rounded-full border border-[#E6EDF5] bg-[#EEF5FA] px-2.5 py-1 text-sm text-[#6E8499]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="rounded-full border border-[#E6EDF5] bg-[#EEF5FA] px-2.5 py-1 text-sm text-[#6E8499]"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-[0.16em] text-[#6E8499]">
        {DAY_LABELS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map(({ key, current, isCurrentMonth, hasMemory, isToday, isSelected }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setSelectedDate(key);
              setViewDate(new Date(current.getFullYear(), current.getMonth(), 1));
            }}
            className={`relative flex h-9 items-center justify-center rounded-full text-sm transition ${
              isCurrentMonth ? "text-[#44576A]" : "text-[#B8C4D0]"
            } ${isSelected ? "bg-[#D9E7F3] text-[#44576A]" : "hover:bg-[#EEF5FA]"}`}
          >
            <span className={isToday ? "font-semibold" : "font-medium"}>{current.getDate()}</span>
            {hasMemory && (
              <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-[#7DA7CA]" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-[#E6EDF5] bg-[#EEF5FA]/70 p-3">
        <p className="text-sm font-medium text-[#44576A]">
          {new Date(selectedDate).toLocaleDateString("en", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        {selectedEntries.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {selectedEntries.map((entry) => (
              <li key={entry.id} className="rounded-xl bg-white/80 px-3 py-2 text-sm text-[#44576A]">
                {entry.title ? <span className="font-medium">{entry.title}</span> : <span>Memory</span>}
                <div className="mt-1 text-xs text-[#6E8499]">{entry.content}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[#6E8499]">No memories captured on this day yet.</p>
        )}
      </div>
    </div>
  );
}
