"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";

const LINKS = [
  { href: "/dashboard", label: "Journal" },
  { href: "/timeline", label: "Timeline" },
  { href: "/graph", label: "Memory Graph" },
  { href: "/insights", label: "Insights" },
];

const SOUND_OPTIONS = [
  { id: "gentle-rain", label: "Gentle Rain", emoji: "🌦️", description: "Soft, steady drizzle" },
  { id: "heavy-rain", label: "Heavy Rain", emoji: "🌧️", description: "Warm, immersive downpour" },
  { id: "thunderstorm", label: "Thunderstorm", emoji: "⛈️", description: "Low, distant thunder" },
  { id: "ocean", label: "Ocean Waves", emoji: "🌊", description: "Breathing, rolling surf" },
  { id: "forest-birds", label: "Forest Birds", emoji: "🪶", description: "Birdsong in the pines" },
  { id: "river", label: "Flowing River", emoji: "🏞️", description: "Gentle water current" },
  { id: "fireplace", label: "Fireplace", emoji: "🔥", description: "Soft crackling warmth" },
  { id: "wind", label: "Wind Through Trees", emoji: "🌬️", description: "Whispering branches" },
  { id: "cafe", label: "Café Ambience", emoji: "☕", description: "Quiet, cozy chatter" },
  { id: "library", label: "Library Ambience", emoji: "📚", description: "Muted, reflective hush" },
  { id: "piano", label: "Soft Piano", emoji: "🎹", description: "Tender notes" },
  { id: "lofi", label: "Lo-fi Instrumental", emoji: "🎧", description: "Warm, mellow loop" },
  { id: "white-noise", label: "White Noise", emoji: "💫", description: "Even, neutral hush" },
  { id: "brown-noise", label: "Brown Noise", emoji: "🌫️", description: "Deep, earthy rumble" },
  { id: "crickets", label: "Night Crickets", emoji: "🦗", description: "Quiet evening field" },
];

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [ambientOpen, setAmbientOpen] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.35);
  const [playbackState, setPlaybackState] = useState<"idle" | "playing" | "paused">("idle");
  const [elapsedTime, setElapsedTime] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const storedReadingMode = localStorage.getItem("aevra:reading-mode") === "true";
    const storedSound = localStorage.getItem("aevra:ambient-sound");
    const storedVolume = Number(localStorage.getItem("aevra:ambient-volume") ?? "0.35");
    const storedPlaying = localStorage.getItem("aevra:ambient-playing") === "true";
    setReadingMode(storedReadingMode);
    setActiveSound(storedSound);
    setVolume(Number.isFinite(storedVolume) ? storedVolume : 0.35);
    if (storedSound && storedPlaying) {
      void startAmbient(storedSound, false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("reading-mode", readingMode);
    localStorage.setItem("aevra:reading-mode", String(readingMode));
  }, [readingMode]);

  useEffect(() => {
    localStorage.setItem("aevra:ambient-volume", String(volume));
  }, [volume]);

  useEffect(() => {
    return () => {
      stopAmbient();
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopAmbient = () => {
    clearTimer();
    for (const node of nodesRef.current) {
      try {
        node.disconnect();
      } catch {
        // ignore cleanup failures
      }
    }
    nodesRef.current = [];
    if (masterGainRef.current) {
      try {
        masterGainRef.current.disconnect();
      } catch {
        // ignore cleanup failures
      }
      masterGainRef.current = null;
    }
    setPlaybackState("idle");
    setElapsedTime(0);
    setActiveSound(null);
    localStorage.setItem("aevra:ambient-playing", "false");
  };

  const getAudioContext = () => {
    if (typeof window === "undefined") return null;
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    return audioContextRef.current;
  };

  const startTimer = () => {
    clearTimer();
    timerRef.current = window.setInterval(() => {
      setElapsedTime((value) => value + 1);
    }, 1000);
  };

  const fadeMasterGain = (target: number, duration = 0.18) => {
    const audioContext = audioContextRef.current;
    const masterGain = masterGainRef.current;
    if (!audioContext || !masterGain) return;
    masterGain.gain.cancelScheduledValues(audioContext.currentTime);
    masterGain.gain.setTargetAtTime(target, audioContext.currentTime, duration);
  };

  const startAmbient = async (soundId: string, shouldReset = true) => {
    const audioContext = getAudioContext();
    if (!audioContext) return;

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    if (masterGainRef.current) {
      try {
        masterGainRef.current.disconnect();
      } catch {
        // ignore cleanup failures
      }
      masterGainRef.current = null;
    }

    for (const node of nodesRef.current) {
      try {
        node.disconnect();
      } catch {
        // ignore cleanup failures
      }
    }
    nodesRef.current = [];

    const masterGain = audioContext.createGain();
    masterGain.gain.value = 0.0001;
    masterGain.connect(audioContext.destination);
    masterGainRef.current = masterGain;
    fadeMasterGain(volume, 0.2);

    const nodes: AudioNode[] = [];

    const addNoise = (filterType: BiquadFilterType, frequency: number, gainValue: number) => {
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * 0.35;
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = audioContext.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = frequency;
      const noiseGain = audioContext.createGain();
      noiseGain.gain.value = gainValue;
      source.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(masterGain);
      source.start();
      nodes.push(source, filter, noiseGain);
    };

    switch (soundId) {
      case "gentle-rain": {
        addNoise("lowpass", 1600, 0.015);
        const shimmer = audioContext.createOscillator();
        shimmer.type = "sine";
        shimmer.frequency.value = 180;
        const shimmerGain = audioContext.createGain();
        shimmerGain.gain.value = 0.006;
        shimmer.connect(shimmerGain);
        shimmerGain.connect(masterGain);
        shimmer.start();
        nodes.push(shimmer, shimmerGain);
        break;
      }
      case "heavy-rain": {
        addNoise("bandpass", 900, 0.035);
        const low = audioContext.createOscillator();
        low.type = "sawtooth";
        low.frequency.value = 90;
        const lowGain = audioContext.createGain();
        lowGain.gain.value = 0.007;
        low.connect(lowGain);
        lowGain.connect(masterGain);
        low.start();
        nodes.push(low, lowGain);
        break;
      }
      case "thunderstorm": {
        addNoise("highpass", 700, 0.04);
        const pulse = audioContext.createOscillator();
        pulse.type = "triangle";
        pulse.frequency.value = 110;
        const pulseGain = audioContext.createGain();
        pulseGain.gain.value = 0.01;
        pulse.connect(pulseGain);
        pulseGain.connect(masterGain);
        pulse.start();
        nodes.push(pulse, pulseGain);
        break;
      }
      case "ocean": {
        const main = audioContext.createOscillator();
        main.type = "sine";
        main.frequency.value = 180;
        const drift = audioContext.createOscillator();
        drift.type = "sine";
        drift.frequency.value = 0.08;
        const driftGain = audioContext.createGain();
        driftGain.gain.value = 26;
        const mainGain = audioContext.createGain();
        mainGain.gain.value = 0.025;
        drift.connect(driftGain);
        driftGain.connect(main.frequency);
        main.connect(mainGain);
        mainGain.connect(masterGain);
        main.start();
        drift.start();
        nodes.push(main, drift, driftGain, mainGain);
        break;
      }
      case "forest-birds": {
        addNoise("bandpass", 1800, 0.012);
        const chirp = audioContext.createOscillator();
        chirp.type = "triangle";
        chirp.frequency.value = 520;
        const chirpGain = audioContext.createGain();
        chirpGain.gain.value = 0.008;
        chirp.connect(chirpGain);
        chirpGain.connect(masterGain);
        chirp.start();
        nodes.push(chirp, chirpGain);
        break;
      }
      case "river": {
        addNoise("lowpass", 1400, 0.018);
        const glide = audioContext.createOscillator();
        glide.type = "sine";
        glide.frequency.value = 120;
        const glideGain = audioContext.createGain();
        glideGain.gain.value = 0.01;
        glide.connect(glideGain);
        glideGain.connect(masterGain);
        glide.start();
        nodes.push(glide, glideGain);
        break;
      }
      case "fireplace": {
        addNoise("bandpass", 1100, 0.026);
        const pop = audioContext.createOscillator();
        pop.type = "sawtooth";
        pop.frequency.value = 140;
        const popGain = audioContext.createGain();
        popGain.gain.value = 0.004;
        pop.connect(popGain);
        popGain.connect(masterGain);
        pop.start();
        nodes.push(pop, popGain);
        break;
      }
      case "wind": {
        addNoise("highpass", 900, 0.028);
        const sweep = audioContext.createOscillator();
        sweep.type = "sine";
        sweep.frequency.value = 220;
        const sweepGain = audioContext.createGain();
        sweepGain.gain.value = 0.004;
        sweep.connect(sweepGain);
        sweepGain.connect(masterGain);
        sweep.start();
        nodes.push(sweep, sweepGain);
        break;
      }
      case "cafe": {
        addNoise("bandpass", 1200, 0.02);
        const hum = audioContext.createOscillator();
        hum.type = "sine";
        hum.frequency.value = 110;
        const humGain = audioContext.createGain();
        humGain.gain.value = 0.005;
        hum.connect(humGain);
        humGain.connect(masterGain);
        hum.start();
        nodes.push(hum, humGain);
        break;
      }
      case "library": {
        addNoise("lowpass", 900, 0.018);
        const tone = audioContext.createOscillator();
        tone.type = "triangle";
        tone.frequency.value = 330;
        const toneGain = audioContext.createGain();
        toneGain.gain.value = 0.005;
        tone.connect(toneGain);
        toneGain.connect(masterGain);
        tone.start();
        nodes.push(tone, toneGain);
        break;
      }
      case "piano": {
        const tone = audioContext.createOscillator();
        tone.type = "triangle";
        tone.frequency.value = 440;
        const toneGain = audioContext.createGain();
        toneGain.gain.value = 0.011;
        tone.connect(toneGain);
        toneGain.connect(masterGain);
        tone.start();
        nodes.push(tone, toneGain);
        break;
      }
      case "lofi": {
        const tone = audioContext.createOscillator();
        tone.type = "sawtooth";
        tone.frequency.value = 220;
        const toneGain = audioContext.createGain();
        toneGain.gain.value = 0.008;
        tone.connect(toneGain);
        toneGain.connect(masterGain);
        tone.start();
        nodes.push(tone, toneGain);
        break;
      }
      case "white-noise": {
        addNoise("lowpass", 1600, 0.028);
        break;
      }
      case "brown-noise": {
        addNoise("lowpass", 600, 0.03);
        break;
      }
      case "crickets": {
        addNoise("highpass", 1800, 0.008);
        const pulse = audioContext.createOscillator();
        pulse.type = "square";
        pulse.frequency.value = 1800;
        const pulseGain = audioContext.createGain();
        pulseGain.gain.value = 0.003;
        pulse.connect(pulseGain);
        pulseGain.connect(masterGain);
        pulse.start();
        nodes.push(pulse, pulseGain);
        break;
      }
      default:
        break;
    }

    nodesRef.current = nodes;
    setActiveSound(soundId);
    setPlaybackState("playing");
    if (shouldReset) {
      setElapsedTime(0);
    }
    startTimer();
    localStorage.setItem("aevra:ambient-sound", soundId);
    localStorage.setItem("aevra:ambient-playing", "true");
  };

  const pauseAmbient = () => {
    const masterGain = masterGainRef.current;
    if (!masterGain) return;
    clearTimer();
    fadeMasterGain(0.0001, 0.16);
    setPlaybackState("paused");
    localStorage.setItem("aevra:ambient-playing", "false");
  };

  const resumeAmbient = () => {
    if (!masterGainRef.current) return;
    fadeMasterGain(volume, 0.18);
    setPlaybackState("playing");
    startTimer();
    localStorage.setItem("aevra:ambient-playing", "true");
  };

  const toggleAmbient = (soundId: string) => {
    if (playbackState === "playing" && activeSound === soundId) {
      pauseAmbient();
      return;
    }
    if (playbackState === "paused" && activeSound === soundId) {
      resumeAmbient();
      return;
    }
    void startAmbient(soundId);
  };

  const toggleReadingMode = () => {
    setReadingMode((value) => !value);
  };

  const currentSound = SOUND_OPTIONS.find((sound) => sound.id === activeSound);
  const progress = Math.min(100, Math.max(0, (elapsedTime / 180) * 100));

  return (
    <header className="border-b border-[#E6EDF5] bg-[#F7FAFC]/95">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-display text-lg italic text-[#44576A]">
            Aevra
          </Link>
          <nav className="hidden gap-1 sm:flex">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-[#D9E7F3] text-[#44576A] shadow-sm"
                      : "text-[#6E8499] hover:bg-[#EEF5FA] hover:text-[#44576A]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleReadingMode}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              readingMode
                ? "bg-[#D9E7F3] text-[#44576A]"
                : "border border-[#E6EDF5] bg-[#FFFFFF] text-[#6E8499] hover:text-[#44576A]"
            }`}
          >
            {readingMode ? "Reading On" : "Reading Mode"}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setAmbientOpen((value) => !value)}
              className="rounded-full border border-[#E6EDF5] bg-[#FFFFFF] p-2 text-lg text-[#6E8499] transition hover:text-[#44576A]"
              aria-label="Ambient sounds"
            >
              🎧
            </button>

            {ambientOpen && (
              <div className="absolute right-0 top-12 z-20 w-80 rounded-2xl border border-[#E6EDF5] bg-[#FFFFFF]/95 p-4 shadow-lg backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#44576A]">Ambient Sounds</p>
                    <p className="text-xs text-[#6E8499]">Immersive soundscapes for your writing ritual.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAmbientOpen(false)}
                    className="text-sm text-[#6E8499]"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-3 rounded-2xl border border-[#E6EDF5] bg-[#EEF5FA]/70 p-3 text-sm text-[#44576A]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{currentSound?.label ?? "No sound selected"}</p>
                      <p className="text-xs text-[#6E8499]">{currentSound?.description ?? "Pick a scene"}</p>
                    </div>
                    <div className="text-xl">{currentSound?.emoji ?? "🎧"}</div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#D9E7F3]">
                    <div className="h-full rounded-full bg-[#B7CDE3] transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-[#6E8499]">
                    <span>{playbackState === "playing" ? "Now playing" : playbackState === "paused" ? "Paused" : "Ready"}</span>
                    <span>{Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, "0")}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (playbackState === "playing") {
                        pauseAmbient();
                      } else if (playbackState === "paused" && activeSound) {
                        resumeAmbient();
                      } else if (activeSound) {
                        void startAmbient(activeSound);
                      }
                    }}
                    className="rounded-full bg-[#D9E7F3] px-3 py-2 text-sm text-[#44576A]"
                  >
                    {playbackState === "playing" ? "Pause" : playbackState === "paused" ? "Resume" : "Play"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopAmbient();
                      setAmbientOpen(false);
                    }}
                    className="rounded-full border border-[#E6EDF5] bg-[#FFFFFF] px-3 py-2 text-sm text-[#6E8499]"
                  >
                    Stop
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {SOUND_OPTIONS.map((sound) => {
                    const isActive = activeSound === sound.id && playbackState === "playing";
                    return (
                      <button
                        key={sound.id}
                        type="button"
                        onClick={() => toggleAmbient(sound.id)}
                        className={`rounded-2xl px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "bg-[#D9E7F3] text-[#44576A]"
                            : "bg-[#EEF5FA] text-[#6E8499] hover:text-[#44576A]"
                        }`}
                      >
                        <div className="font-medium">{sound.emoji} {sound.label}</div>
                        <div className="mt-1 text-[11px] text-[#6E8499]">{sound.description}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <label htmlFor="ambient-volume" className="text-xs uppercase tracking-[0.2em] text-[#6E8499]">
                    Volume
                  </label>
                  <input
                    id="ambient-volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                    className="mt-2 w-full accent-[#B7CDE3]"
                  />
                </div>
              </div>
            )}
          </div>

          <span className="hidden text-sm text-[#6E8499] sm:inline">{user?.full_name}</span>
          <button
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="rounded-full border border-[#E6EDF5] bg-[#FFFFFF] px-4 py-1.5 text-sm text-[#6E8499] transition hover:border-[#AFC8DE] hover:text-[#44576A]"
          >
            Log out
          </button>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-4 pb-3 sm:hidden">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
                active ? "bg-[#D9E7F3] text-[#44576A]" : "text-[#6E8499] hover:text-[#44576A]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
