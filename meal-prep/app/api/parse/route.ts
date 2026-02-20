import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = "http://127.0.0.1:8000/parse";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // validate input
    if (!body.transcript || typeof body.transcript !== "string") {
      return NextResponse.json(
        { error: "Missing transcript" },
        { status: 400 }
      );
    }

    // call FastAPI service
    const response = await fetch(FASTAPI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcript: body.transcript,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: "Parser service failed", detail: text },
        { status: 500 }
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (err) {
    console.error("Parse route error:", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}