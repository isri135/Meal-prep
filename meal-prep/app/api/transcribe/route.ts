import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PY_URL = process.env.PY_WHISPER_URL || "http://127.0.0.1:8001";

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

    const fd = new FormData();
    fd.append("file", file, file.name);

    let pyRes: Response;
    try {
      pyRes = await fetch(`${PY_URL}/transcribe`, {
        method: "POST",
        body: fd,
      });
    } catch (e: any) {
      return NextResponse.json(
        {
          error: "Failed to reach Python service",
          message: e?.message ?? String(e),
          tip: `Is the Python server running at ${PY_URL}? Try opening ${PY_URL}/health`,
        },
        { status: 502 }
      );
    }

    const raw = await pyRes.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      // ok - python might return plain text
    }

    if (!pyRes.ok) {
      return NextResponse.json(
        {
          error: data?.detail || data?.error || `Python error (status ${pyRes.status}).`,
          pythonStatus: pyRes.status,
          pythonBodyPreview: raw.slice(0, 2000),
        },
        { status: pyRes.status }
      );
    }

    return NextResponse.json({ text: data?.text ?? raw });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}