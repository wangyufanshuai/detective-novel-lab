import { NextRequest, NextResponse } from "next/server";
import {
  createFallbackNovelSimulationExplanation,
  validateNovelSimulationExplanation,
  type NovelSimulationExplanation,
  type NovelSimulationStep,
  type Provider
} from "@/lib/engine";

type ExplainBody = {
  provider?: Provider;
  step?: NovelSimulationStep;
};

const providerConfig = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"
  },
  siliconflow: {
    apiKey: process.env.SILICONFLOW_API_KEY,
    baseUrl: process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1",
    model: process.env.SILICONFLOW_MODEL || "deepseek-ai/DeepSeek-V3.2-Exp"
  }
};

function extractJsonObject(value: string) {
  const cleaned = value.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model response did not contain a JSON object.");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

function normalizeExplanation(raw: Record<string, unknown>, fallback: NovelSimulationExplanation, step: NovelSimulationStep): NovelSimulationExplanation {
  const allowedEvidenceIds = new Set(step.evidence.map((item) => item.id));
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : fallback.id,
    stepId: step.id,
    explanation: typeof raw.explanation === "string" && raw.explanation.trim() ? raw.explanation.trim() : fallback.explanation,
    uncertainty: typeof raw.uncertainty === "number" ? Math.max(0, Math.min(1, raw.uncertainty)) : fallback.uncertainty,
    evidenceIds: Array.isArray(raw.evidenceIds) ? raw.evidenceIds.map(String).filter((id) => allowedEvidenceIds.has(id)) : fallback.evidenceIds,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String).slice(0, 6) : fallback.warnings
  };
}

async function callModel(body: ExplainBody, step: NovelSimulationStep, fallback: NovelSimulationExplanation, repairErrors?: string[]) {
  const provider = body.provider || (process.env.AI_PROVIDER as Provider) || "deepseek";
  const config = providerConfig[provider] || providerConfig.deepseek;
  if (!config.apiKey) return { mock: true, explanation: fallback };
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1500,
      messages: [
        {
          role: "system",
          content: "Explain an already selected deterministic novel-simulation action. Do not select another action, create an event, predict later chapters, or change state. Output JSON only."
        },
        {
          role: "user",
          content: `Return fields id, stepId, explanation, uncertainty, evidenceIds, warnings.
Evidence ids must come only from the supplied step evidence.
Step:
${JSON.stringify({
  id: step.id,
  title: step.title,
  summary: step.summary,
  provenance: step.provenance,
  selectedCandidate: step.candidates.find((candidate) => candidate.id === step.selectedCandidateId),
  triggeredRuleIds: step.triggeredRuleIds,
  evidence: step.evidence.map((item) => ({ id: item.id, quote: item.source.quote, summary: item.source.summary }))
}, null, 2)}
Validation errors to repair:
${repairErrors?.join("\n") || "none"}`
        }
      ]
    })
  });
  if (!response.ok) throw new Error(`Model API returned ${response.status}.`);
  const data = await response.json();
  return {
    mock: false,
    explanation: normalizeExplanation(extractJsonObject(data?.choices?.[0]?.message?.content || ""), fallback, step)
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExplainBody;
    if (!body.step) throw new Error("Simulation step is required.");
    const fallback = createFallbackNovelSimulationExplanation(body.step);
    let explanation = fallback;
    let validation = validateNovelSimulationExplanation(explanation, body.step);
    let mock = true;
    let repaired = false;
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = await callModel(body, body.step, fallback, attempt ? validation.errors : undefined);
        mock = result.mock;
        explanation = result.explanation;
        validation = validateNovelSimulationExplanation(explanation, body.step);
        repaired = attempt > 0;
        if (result.mock || validation.valid) break;
      }
    } catch {
      explanation = fallback;
      validation = validateNovelSimulationExplanation(explanation, body.step);
      mock = true;
      repaired = true;
    }
    if (!validation.valid) {
      explanation = fallback;
      validation = validateNovelSimulationExplanation(explanation, body.step);
      mock = true;
      repaired = true;
    }
    return NextResponse.json({ ok: true, data: { mock, explanation, validation, repaired } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: "NOVEL_SIMULATION_EXPLAIN_FAILED", message: error instanceof Error ? error.message : "Unknown error" } },
      { status: 400 }
    );
  }
}
