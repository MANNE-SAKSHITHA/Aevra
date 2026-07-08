import Link from "next/link";
import VideoHero from "@/components/VideoHero";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F7FAFC] text-[#44576A]">
      {/* faint ember glow anchored top-center, quiet ambience rather than a
          loud gradient hero background */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[#B7CDE3]/25 blur-[140px]"
      />

      <section className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pb-16 pt-16 sm:px-6 sm:pt-24 lg:pt-28">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-[#6E8499] sm:mb-4">
          An AI memory journal
        </p>

        <h1 className="text-balance text-center font-display text-4xl italic leading-[1.05] text-[#44576A] sm:text-5xl lg:text-6xl">
          Your life, beautifully remembered.
        </h1>

        <p className="mt-5 max-w-xl text-center text-sm text-[#6E8499] sm:mt-6 sm:text-base">
          Aevra turns your days, in text, voice, and photos, into a living
          archive you can search, revisit, and hear narrated back to you.
        </p>

        <div className="mt-10 w-full sm:mt-12">
          <VideoHero />
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 sm:mt-12 sm:flex-row sm:gap-4">
          <Link
            href="/register"
            className="w-full rounded-full bg-[#B7CDE3] px-7 py-3 text-center text-sm font-medium text-[#44576A] transition hover:bg-[#AFC8DE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#44576A] sm:w-auto"
          >
            Start your journal
          </Link>
          <Link
            href="/login"
            className="w-full rounded-full border border-[#E6EDF5] px-7 py-3 text-center text-sm font-medium text-[#44576A] transition hover:border-[#AFC8DE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B7CDE3] sm:w-auto"
          >
            Log in
          </Link>
        </div>
      </section>
    </main>
  );
}
