"use client";

import { use, useState } from "react";


export default function HomePage() {
  const [url, setUrl] = useState("");
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setError("");
    setText("");

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const raw = await res.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Server returned non-JSON:\n${raw.slice(0, 400)}`);
      }

      if (!res.ok) throw new Error(data?.error || "Failed");

      setText(data.text || "");
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24, background: "#0b0f19", color: "#e5e7eb" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>URL → Extracted Text</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste Instagram/TikTok URL..."
          style={{
            flex: 1,
            minWidth: 280,
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(0,0,0,0.25)",
            color: "#e5e7eb",
            outline: "none",
          }}
        />

        <button
          onClick={run}
          disabled={!url.trim() || loading}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(99,102,241,0.95)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 700,
            opacity: !url.trim() || loading ? 0.6 : 1,
          }}
        >
          {loading ? "Running..." : "Run extractor"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(239,68,68,0.12)" }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Output</div>
        <textarea
          value={text}
          readOnly
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
        Make sure the Python server is running on <code>http://127.0.0.1:8000</code>.
      </p>
    </main>
  );
}
