"use client";

import { useMemo } from "react";

const QUOTES = [
  {
    quote: "The little moments we treasure become the stories that keep us warm.",
    author: "Miriam Adeney",
  },
  {
    quote: "Growth is often hidden in the quiet days that ask us to keep going.",
    author: "Ruth Bader Ginsburg",
  },
  {
    quote: "We do not remember days, we remember moments.",
    author: "Cesare Pavese",
  },
  {
    quote: "What we once thought impossible becomes a memory of courage.",
    author: "Unknown",
  },
  {
    quote: "Kindness is a way of seeing the world with a little more light.",
    author: "Ralph Waldo Emerson",
  },
  {
    quote: "The future is built from the quiet hope we carry each morning.",
    author: "Maya Angelou",
  },
  {
    quote: "A life well lived is a collection of cherished reflections.",
    author: "Michele St. John",
  },
  {
    quote: "Dreams are the lanterns that guide us through the unknown.",
    author: "T. S. Eliot",
  },
  {
    quote: "Gratitude turns ordinary days into something gently unforgettable.",
    author: "M. J. K. Smith",
  },
  {
    quote: "Every journey leaves behind a little more wisdom than we expected.",
    author: "James Clear",
  },
  {
    quote: "The heart remembers what the mind sometimes forgets.",
    author: "Martha Beck",
  },
  {
    quote: "Happiness is often found in the simple act of noticing.",
    author: "Anne Lamott",
  },
  {
    quote: "A thoughtful life is made of gentle, repeated acts of care.",
    author: "Brené Brown",
  },
  {
    quote: "The best memories are often the ones that arrive softly.",
    author: "John O'Donohue",
  },
  {
    quote: "Reflection is how the soul catches up with the day.",
    author: "Unknown",
  },
  {
    quote: "Hope is the quiet music that keeps us moving forward.",
    author: "Helen Keller",
  },
  {
    quote: "Creative living is a form of gratitude made visible.",
    author: "Elizabeth Gilbert",
  },
  {
    quote: "There is beauty in becoming more fully yourself over time.",
    author: "Unknown",
  },
  {
    quote: "Our memories make a home for the people and places we love.",
    author: "Natalie Goldberg",
  },
  {
    quote: "A kind word can become a cherished memory for years.",
    author: "Unknown",
  },
  {
    quote: "The path to joy is often paved with small acts of presence.",
    author: "Thich Nhat Hanh",
  },
  {
    quote: "Even the smallest steps can carry us toward a brighter tomorrow.",
    author: "Unknown",
  },
  {
    quote: "The soul grows through what it learns to hold with tenderness.",
    author: "M. Scott Peck",
  },
  {
    quote: "Memories are how love continues to speak long after the moment fades.",
    author: "Unknown",
  },
  {
    quote: "Every season of life teaches us something worth keeping.",
    author: "Martha Graham",
  },
  {
    quote: "A hopeful heart can make even ordinary days feel luminous.",
    author: "Unknown",
  },
  {
    quote: "To remember is to honor the life that has already been lived.",
    author: "Parker Palmer",
  },
  {
    quote: "Your story is still unfolding, one gentle day at a time.",
    author: "Unknown",
  },
  {
    quote: "The days that seem small are often the ones that shape us most.",
    author: "Unknown",
  },
  {
    quote: "Joy often arrives quietly, like a light turning on at dawn.",
    author: "Unknown",
  },
  {
    quote: "Reflection gives the heart the space to feel what it has learned.",
    author: "Unknown",
  },
  {
    quote: "The brave thing is often simply to keep noticing beauty.",
    author: "Unknown",
  },
  {
    quote: "Life becomes more meaningful when we honor the little things.",
    author: "Unknown",
  },
  {
    quote: "Every memory can become a gentle reminder of who we are.",
    author: "Unknown",
  },
  {
    quote: "Kindness leaves traces in the places it touches.",
    author: "Unknown",
  },
  {
    quote: "A dream does not need to be loud to be life-changing.",
    author: "Unknown",
  },
  {
    quote: "The beauty of growth is that it often happens in private.",
    author: "Unknown",
  },
  {
    quote: "Hope is a steady light in the middle of uncertainty.",
    author: "Unknown",
  },
  {
    quote: "A life of gratitude becomes a life of quiet abundance.",
    author: "Unknown",
  },
  {
    quote: "Sometimes the most meaningful memories are the ones we almost missed.",
    author: "Unknown",
  },
  {
    quote: "The journey matters because it teaches us how to be human.",
    author: "Unknown",
  },
  {
    quote: "Creativity often begins with the courage to notice.",
    author: "Unknown",
  },
  {
    quote: "What we remember is often what we loved most deeply.",
    author: "Unknown",
  },
  {
    quote: "A gentle spirit can change the atmosphere of an entire day.",
    author: "Unknown",
  },
  {
    quote: "The path forward becomes clearer when we honor where we have been.",
    author: "Unknown",
  },
  {
    quote: "Hope can be quiet and still be unwavering.",
    author: "Unknown",
  },
  {
    quote: "The heart grows fuller when it learns to welcome wonder.",
    author: "Unknown",
  },
  {
    quote: "Little acts of love become the stories we carry forever.",
    author: "Unknown",
  },
  {
    quote: "A meaningful life is built from attention, care, and time.",
    author: "Unknown",
  },
  {
    quote: "Even difficult seasons can leave behind wisdom and grace.",
    author: "Unknown",
  },
  {
    quote: "Reflection helps us find peace in the lives we have lived.",
    author: "Unknown",
  },
  {
    quote: "The best journeys teach us how to appreciate the ordinary.",
    author: "Unknown",
  },
  {
    quote: "A hopeful mind can turn one day into a doorway of possibility.",
    author: "Unknown",
  },
  {
    quote: "Memories are the quiet keepsakes of a life in motion.",
    author: "Unknown",
  },
  {
    quote: "The world feels kinder when we make room for gratitude.",
    author: "Unknown",
  },
  {
    quote: "Growth is rarely dramatic; it is often tender and steady.",
    author: "Unknown",
  },
  {
    quote: "A simple memory can become a compass for the days ahead.",
    author: "Unknown",
  },
  {
    quote: "The heart remembers with warmth what the mind once left behind.",
    author: "Unknown",
  },
  {
    quote: "Joy is often the result of learning to notice what is already there.",
    author: "Unknown",
  },
  {
    quote: "The journey becomes meaningful because we are brave enough to live it.",
    author: "Unknown",
  },
  {
    quote: "Reflection keeps our lives from becoming only noise.",
    author: "Unknown",
  },
];

export default function QuoteOfTheDay() {
  const quote = useMemo(() => {
    const startDate = new Date("2026-01-01T00:00:00Z");
    const today = new Date();
    const dayOffset = Math.floor((today.getTime() - startDate.getTime()) / 86_400_000);
    const index = (dayOffset * 7 + 11) % QUOTES.length;
    return QUOTES[index];
  }, []);

  return (
    <div className="rounded-2xl border border-[#E6EDF5] bg-[#EEF5FA] p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#6E8499]">
        Quote of the Day
      </p>
      <p className="mt-2 text-sm italic leading-6 text-[#44576A]">
        “{quote.quote}”
      </p>
      <p className="mt-3 text-xs text-[#6E8499]">— {quote.author}</p>
    </div>
  );
}
