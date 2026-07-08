"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Full-width-on-mobile, framed-on-desktop intro video.
 *
 * Responsiveness notes:
 * - The wrapper has no fixed pixel width; it scales with the viewport via
 *   `w-full` + a `max-w-*` clamp, so it reflows correctly on phones,
 *   tablets, laptops, and large desktop monitors alike.
 * - `aspect-video` (16:9, matching the source file) keeps the frame's shape
 *   stable at every width instead of letterboxing or cropping unexpectedly.
 * - `playsInline` is required for autoplay to work on iOS Safari; without it
 *   iPhones force fullscreen playback instead of inline hero video.
 * - Respects `prefers-reduced-motion`: instead of autoplaying, the video
 *   shows its poster frame with an explicit play button.
 */
export default function VideoHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);

    if (!query.matches && videoRef.current) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-4xl px-4 sm:px-6">
      <div
        className="
          group relative w-full overflow-hidden
          aspect-video
          rounded-none sm:rounded-2xl
          border-0 sm:border sm:border-[#E6EDF5]
          shadow-none sm:shadow-[0_40px_120px_-40px_rgba(175,200,222,0.35)]
          animate-surface
        "
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          src="/videos/aevra-intro.mp4"
          poster="/images/aevra-intro-poster.jpg"
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="Aevra introduction video"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Signature light-leak sweep, once on load. Purely decorative,
            so it's aria-hidden and skipped entirely under reduced motion. */}
        {!reducedMotion && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-lightleak bg-gradient-to-r from-transparent via-ember/40 to-transparent blur-md"
          />
        )}

        {/* Bottom vignette so the play control always has contrast to sit on */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent"
        />

        <button
          type="button"
          onClick={togglePlayback}
          aria-label={isPlaying ? "Pause introduction video" : "Play introduction video"}
          className="
            absolute bottom-3 left-3 sm:bottom-5 sm:left-5
            flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center
            rounded-full border border-[#E6EDF5] bg-[#FFFFFF]/80 backdrop-blur-md
            text-[#44576A] transition
            hover:bg-[#EEF5FA] focus-visible:outline focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-[#B7CDE3]
          "
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
              <rect x="2" y="1" width="3.4" height="12" rx="0.8" />
              <rect x="8.6" y="1" width="3.4" height="12" rx="0.8" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
              <path d="M2 1.2c0-.9 1-1.5 1.8-1L12 6.1c.8.5.8 1.7 0 2.1L3.8 13.8c-.8.5-1.8-.1-1.8-1V1.2Z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
