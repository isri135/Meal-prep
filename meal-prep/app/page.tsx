"use client";

import { useState } from "react";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function runTranscribe() {
    setError("");
    setText("");

    if (!file) {
      setError("Please choose a video/audio file first.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: fd,
      });

      const raw = await res.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Server returned non-JSON (status ${res.status}):\n${raw.slice(0, 400)}`);
      }

      if (!res.ok) throw new Error(data?.error || "Transcription failed.");

      setText(data.text || "");
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24, background: "#0b0f19", color: "#e5e7eb" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Whisper Transcription MVP</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="file"
          accept="video/*,audio/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{
            flex: 1,
            minWidth: 280,
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(0,0,0,0.25)",
            color: "#e5e7eb",
          }}
        />

        <button
          onClick={runTranscribe}
          disabled={!file || loading}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(99,102,241,0.95)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 700,
            opacity: !file || loading ? 0.6 : 1,
          }}
        >
          {loading ? "Transcribing..." : "Transcribe"}
        </button>
      </div>

      {file && (
        <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12 }}>
          Selected: <b>{file.name}</b> ({Math.round(file.size / 1024 / 1024)} MB)
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.12)",
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Transcript</div>
        <textarea
          value={text}
          readOnly
          placeholder="Transcript will appear here..."
          style={{
            width: "100%",
            minHeight: 260,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(0,0,0,0.25)",
            color: "#e5e7eb",
            outline: "none",
          }}
        />
      </div>

      <p style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
        Make sure Python service is running on <code>http://127.0.0.1:8000</code> (check <code>/health</code>).
      </p>
    </main>
  );
}
