import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const { url } = await req.json();
        if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

        const py = await fetch("http://127.0.0.1:8000/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });

        const text = await py.text();
        let data: any;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return NextResponse.json(
                { error: "Failed to parse response from Python backend" }, 
                { status: 500 }
            );
        }

        if (!py.ok) {
            return NextResponse.json({ error: data?.detail || data?.error| "Python error" }, { status: 502 });
    }

    return NextResponse.json({ text: data.text ?? "" });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unkown error" }, { status: 500 });
}
}