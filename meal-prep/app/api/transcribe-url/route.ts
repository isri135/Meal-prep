import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PY_URL = process.env.PY_WHISPER_URL || "http://127.0.0.1:8000";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const url = body?.url;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing 'url' (string) in request body." }, { status: 400 });
    }

    let pyRes: Response;
    try {
      pyRes = await fetch(`${PY_URL}/transcribe_url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
    } catch (e: any) {
      return NextResponse.json(
        {
          error: "Failed to reach Python service",
          message: e?.message ?? String(e),
          cause: e?.cause?.message ?? String(e?.cause ?? ""),
          tip: `Is the Python server running at ${PY_URL}? Try opening ${PY_URL}/health in your browser.`,
        },
        { status: 502 }
      );
    }

    const raw = await pyRes.text();
    let data: any = null;

    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: `Python returned non-JSON:\n${raw.slice(0, 800)}` },
        { status: 502 }
      );
    }

    if (!pyRes.ok) {
      return NextResponse.json(
        {
          error: data?.detail || data?.error || `Python error (status ${pyRes.status}).`,
          pythonStatus: pyRes.status,
          pythonBodyPreview: raw.slice(0, 1200),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ text: data?.text ?? "" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}