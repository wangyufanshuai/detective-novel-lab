import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "outputs", "deepseek-live-eval.json");
    const content = await fs.readFile(filePath, "utf8");
    return NextResponse.json({ ok: true, report: JSON.parse(content) });
  } catch {
    return NextResponse.json({ ok: false, error: "No live eval report found" }, { status: 404 });
  }
}
