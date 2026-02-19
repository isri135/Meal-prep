// app/api/transcribe/route.ts  (or src/app/api/transcribe/route.ts)
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PY_URL = process.env.PY_WHISPER_URL || "http://127.0.0.1:8000";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file upload. Field name must be 'file'." },
        { status: 400 }
      );
    }

    // Basic size guard (adjust as needed)
    const MAX_MB = 60;
    if (file.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Max is ${MAX_MB}MB for now.` },
        { status: 413 }
      );
    }

    // Forward to Python as multipart/form-data
    const fd = new FormData();
    fd.append("file", file, file.name);

    let pyRes: Response;
    try {
      pyRes = await fetch(`${PY_URL}/transcribe`, {
        method: "POST",
        body: fd,
        // IMPORTANT: do NOT set Content-Type manually for FormData
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

    const contentType = pyRes.headers.get("content-type") || "";
    const raw = await pyRes.text();

    // If Python returned JSON, parse it. Otherwise, surface the text for debugging.
    let data: any = null;
    if (contentType.toLowerCase().includes("application/json")) {
      try {
        data = JSON.parse(raw);
      } catch {
        return NextResponse.json(
          { error: `Python said JSON but parsing failed:\n${raw.slice(0, 800)}` },
          { status: 502 }
        );
      }
    }

    if (!pyRes.ok) {
      return NextResponse.json(
        {
          error:
            data?.detail ||
            data?.error ||
            `Python error (status ${pyRes.status}).`,
          pythonStatus: pyRes.status,
          pythonBodyPreview: raw.slice(0, 800),
        },
        { status: 502 }
      );
    }

    const text = data?.text ?? raw; // in case Python returns plain text
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
