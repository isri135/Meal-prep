"use client";

import { useMemo, useState } from "react";

type Mode = "file" | "url";

export default function HomePage() {
  const [mode, setMode] = useState<Mode>("file");

  // FILE mode
  const [file, setFile] = useState<File | null>(null);

  // URL mode
  const [url, setUrl] = useState("");

  // Output
  const [text, setText] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // used to hard-reset the <input type="file"> when needed
  const [fileInputKey, setFileInputKey] = useState(0);

  const canRun = useMemo(() => {
    if (mode === "file") return !!file;
    return url.trim().length > 0;
  }, [mode, file, url]);

  async function safeJson(res: Response) {
    const raw = await res.text();
    try {
      return { ok: res.ok, status: res.status, data: JSON.parse(raw), raw };
    } catch {
      // keep ok = res.ok so non-JSON success doesn't look like failure
      return { ok: res.ok, status: res.status, data: null, raw };
    }
  }

  async function runTranscribe() {
    setError("");
    setText("");

    // ✅ extra guard: make sure mode matches what user provided
    if (mode === "file") {
      if (!file) {
        setError("Please choose a video/audio file first.");
        return;
      }
    } else {
      if (!url.trim()) {
        setError("Please paste an Instagram or TikTok URL.");
        return;
      }
    }

    setLoading(true);
    try {
      let res: Response;

      if (mode === "file") {
        const fd = new FormData();
        fd.append("file", file!);

        res = await fetch("/api/transcribe", {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch("/api/transcribe-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
      }

      const t = await safeJson(res);

      if (!t.ok) {
        const msg = t.data?.error || `Transcription failed (status ${t.status}).`;

        if (mode === "url") {
          throw new Error(
            msg +
              `\n\nTip: IG/TikTok links often block downloading even for public posts (rate-limits / login checks). If it fails, download the video and use Upload mode.`
          );
        }

        throw new Error(msg + (t.raw ? `\n\n${t.raw.slice(0, 1200)}` : ""));
      }

      const transcript = (t.data?.text ?? t.raw ?? "").toString();
      setText(transcript);

      if (!transcript.trim()) {
        throw new Error("Transcription succeeded but returned empty text.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "#0b0f19",
        color: "#e5e7eb",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Whisper Transcription MVP</h1>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => {
            setMode("file");
            setUrl("");
            setError("");
            setText("");
            // keep file as-is; user may have already selected it
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.16)",
            background: mode === "file" ? "rgba(99,102,241,0.95)" : "rgba(255,255,255,0.10)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Upload file
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("url");
            setFile(null);
            setFileInputKey((k) => k + 1); // reset file input UI
            setError("");
            setText("");
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.16)",
            background: mode === "url" ? "rgba(99,102,241,0.95)" : "rgba(255,255,255,0.10)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Paste IG/TikTok URL
        </button>
      </div>

      {/* Inputs */}
      {mode === "file" ? (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              key={fileInputKey}
              type="file"
              accept="video/*,audio/*"
              onChange={(e) => {
                // ✅ force file mode if a file is picked
                setMode("file");
                setUrl("");
                setFile(e.target.files?.[0] ?? null);
              }}
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
              disabled={!canRun || loading}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(99,102,241,0.95)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                opacity: !canRun || loading ? 0.6 : 1,
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
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={url}
              onChange={(e) => {
                // ✅ force URL mode if user starts typing
                setMode("url");
                setFile(null);
                setFileInputKey((k) => k + 1);
                setUrl(e.target.value);
              }}
              placeholder="Paste Instagram or TikTok URL..."
              style={{
                flex: 1,
                minWidth: 280,
                padding: 10,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.25)",
                color: "#e5e7eb",
                outline: "none",
              }}
            />

            <button
              onClick={runTranscribe}
              disabled={!canRun || loading}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(99,102,241,0.95)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                opacity: !canRun || loading ? 0.6 : 1,
              }}
            >
              {loading ? "Fetching + Transcribing..." : "Transcribe URL"}
            </button>
          </div>

          <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
            Note: URL transcription is best-effort. Many IG/TikTok links block downloads even for public posts.
            If it fails, download the video and use Upload mode.
          </div>
        </>
      )}

      {/* Error */}
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

      {/* Transcript */}
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
        Whisper runs through <code>/api/transcribe</code> and <code>/api/transcribe-url</code> → Python{" "}
        <code>http://127.0.0.1:8001</code> (check <code>/health</code>).
      </p>
    </main>
  );
}