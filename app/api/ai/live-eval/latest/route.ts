import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "outputs", "deepseek-live-eval.json");
    const content = await fs.readFile(filePath, "utf8");
    return NextResponse.json({ ok: true, report: JSON.parse(content) });
  } catch {
    // Live evaluation is optional. A missing artifact is a valid empty state,
    // so the player runtime does not produce a console error during bootstrap.
    return NextResponse.json({ ok: true, report: null, available: false });
  }
}
