"use client";

import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

type RecorderState = "idle" | "recording" | "uploading" | "transcribing" | "error";

export default function VoiceRecorder({
  accessToken,
  onEntryCreated,
}: {
  accessToken: string;
  onEntryCreated: () => void;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        void handleUpload();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch {
      setError("Couldn't access your microphone. Check your browser's permission settings.");
      setState("error");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const handleUpload = async () => {
    setState("uploading");
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const media = await api.uploadVoiceJournal(accessToken, blob, "voice-memory.webm");

      setState("transcribing");
      // Poll until Whisper finishes (or fails) in the background.
      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise((r) => setTimeout(r, 2000));
        const updated = await api.getMedia(accessToken, media.id);
        if (updated.status === "completed") {
          await api.createEntryFromVoiceJournal(accessToken, updated.id);
          onEntryCreated();
          setState("idle");
          return;
        }
        if (updated.status === "failed") {
          throw new ApiError(
            updated.error_message || "Transcription failed. Is Whisper set up?",
            500
          );
        }
      }
      throw new ApiError("Transcription is taking longer than expected.", 500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong recording that.");
      setState("error");
    }
  };

  return (
    <div className="flex items-center gap-3">
      {state === "idle" || state === "error" ? (
        <button
          type="button"
          onClick={startRecording}
          className="flex items-center gap-2 rounded-full border border-[#E6EDF5] bg-[#FFFFFF] px-4 py-2 text-sm text-[#6E8499] transition hover:border-[#AFC8DE] hover:text-[#44576A]"
        >
          <span className="h-2 w-2 rounded-full bg-red-400" />
          Record a voice memory
        </button>
      ) : state === "recording" ? (
        <button
          type="button"
          onClick={stopRecording}
          className="flex items-center gap-2 rounded-full bg-[#FDE2E2] px-4 py-2 text-sm text-red-500 transition hover:bg-[#FCE4E4]"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
          Stop recording
        </button>
      ) : (
        <span className="flex items-center gap-2 text-sm text-[#6E8499]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-ember" />
          {state === "uploading" ? "Uploading…" : "Transcribing…"}
        </span>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
