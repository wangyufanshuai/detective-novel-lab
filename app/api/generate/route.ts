import { NextRequest, NextResponse } from "next/server";
import { DeductionCase, createFallbackCase, validateCase } from "@/lib/engine";

type Provider = "deepseek" | "siliconflow";

type GenerateBody = {
  provider?: Provider;
  stage: string;
  stageLabel?: string;
  brief: string;
  currentDraft?: Record<string, string>;
  selectedCaseType?: string;
  hiddenTruthMode?: boolean;
  userDirection?: string;
  lengthTarget?: string;
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

const jsonSchemaInstruction = `Only output one JSON object. Do not output Markdown or explanation.
Required top-level fields: id,title,theme,premise,publicCaseFile,truth,characters,evidence,scenes,relationships,logicPuzzle.
truth: culpritId,motive,method,opportunity,decisiveEvidenceIds,trueTimeline.
trueTimeline item: id,time,event,characterIds,isPublic,source,publicVersion,contradictedByEvidenceIds.
characters item: id,name,role,publicBio,secret,motive,means,opportunity,isCulprit,alibi,initialStatement,knowledgeScope,liePolicy,contradictionTriggers.
evidence item: id,title,location,visibleDescription,trueMeaning,relatedCharacterIds,relatedTime,discoverable,isKey,unlocks,contradicts,supportsConclusion,discoveryDifficulty.
logicPuzzle: suspectMatrix,exclusionChains,criticalReasoningChain,redHerrings,requiredClueOrder.
Hard requirements: exactly one culprit; at least three suspects; at least three discoverable key clues; every non-culprit needs discoverable exclusion evidence; public testimony/timeline must contain contradictions discoverable by evidence; every critical reasoning step must be backed by discoverable evidence.`;

const stageInstructions: Record<string, string> = {
  gameTruthSeed: `Generate a playable fair-play detective case. ${jsonSchemaInstruction}`,
  gameLogicRepair: `Repair the provided structured case JSON so it passes the local rule engine. Keep the same theme, but adjust characters, clues, timeline, and logicPuzzle if needed. ${jsonSchemaInstruction}`,
  gameCaseFile:
    "Rewrite the structured case into a player-visible case file. Do not reveal the culprit, hidden truth, true clue meanings, or full exclusion chain. Include case summary, public character information, searchable scenes, initial clues, and investigation goals.",
  gameDialogue:
    "Generate one character reply using the case structure, character knowledge scope, discovered evidence, and player question. The reply may hide or evade, but must not reveal author-only truth.",
  gameEvidenceChallenge:
    "Generate a character response to evidence-based interrogation. Follow the provided local rule result. If the evidence hits a contradiction, the character may evade, partially admit, or revise testimony. Do not change the rule conclusion.",
  gameJudgement:
    "Explain the local rule judgement in natural language. Do not change the rule result. If the player failed, explain missing pieces without revealing the full truth.",
  gameSolutionReveal:
    "The player passed the rule judgement. Generate the complete solution: culprit, motive, method, true timeline, key evidence chain, exclusion reasons, and red herring explanations.",
  quickSynopsis:
    "Generate a Chinese fair-play mystery story synopsis from the user outline, about 1200-2000 Chinese characters. Include title, visible synopsis, main characters, central puzzle, hidden truth, culprit motive, trick, fair clues, red herrings, and possible fixes.",
  quickOutline:
    "Convert the confirmed synopsis into a chapter outline for full-text generation, including chapter goals, scenes, clues, red herrings, and reveal points.",
  quickChapter:
    "Generate only the requested chapter prose. Follow the confirmed synopsis, outline, and previous text. Do not output meta commentary."
};

function extractJsonObject(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("The model did not return a parseable JSON object.");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function buildMessages(body: GenerateBody) {
  const context = Object.entries(body.currentDraft || {})
    .filter(([, value]) => value?.trim())
    .map(([key, value]) => `[${key}]\n${value}`)
    .join("\n\n");

  return [
    {
      role: "system",
      content:
        "You are the case generator for Deduction Engine. Principle: structured truth first, deterministic rules first, prose follows structure. Fair-play logic is mandatory. There must be exactly one culprit. The timeline must be coherent. Do not imitate any specific living or dead author's recognizable style."
    },
    {
      role: "user",
      content: `Stage: ${body.stageLabel || body.stage}
Stage instruction: ${stageInstructions[body.stage] || "Continue generating mystery content."}
Brief: ${body.brief || "Generate a modern fair-play detective case."}
Case type: ${body.selectedCaseType || "random"}
Length target: ${body.lengthTarget || "3000-6000 Chinese characters"}
User direction: ${body.userDirection || "none"}

Current draft:
${context || "none"}`
    }
  ];
}

async function callModel(body: GenerateBody) {
  const provider = body.provider || (process.env.AI_PROVIDER as Provider) || "deepseek";
  const config = providerConfig[provider] || providerConfig.deepseek;

  if (!config.apiKey) {
    return { mock: true, content: "", json: createFallbackCase(body.brief) };
  }

  const wantsJson = body.stage === "gameTruthSeed" || body.stage === "gameLogicRepair";
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: buildMessages(body),
      response_format: wantsJson ? { type: "json_object" } : undefined,
      temperature: wantsJson ? 0.28 : 0.7,
      max_tokens: body.stage === "quickChapter" || wantsJson ? 8192 : 4096
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Model API returned ${response.status}: ${detail}`);
  }

  const data = await response.json();
  return {
    mock: false,
    content: data?.choices?.[0]?.message?.content || "",
    json: null
  };
}

async function generateValidatedCase(body: GenerateBody) {
  let lastCase: DeductionCase | null = null;
  let lastValidation = null as ReturnType<typeof validateCase> | null;
  let lastContent = "";
  let mock = false;
  let lastParseError = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await callModel({
      ...body,
      stage: attempt === 0 ? "gameTruthSeed" : "gameLogicRepair",
      stageLabel: attempt === 0 ? "gameTruthSeed" : `gameLogicRepair-${attempt}`,
      currentDraft:
        attempt === 0
          ? body.currentDraft
          : {
              structuredCase: JSON.stringify(lastCase, null, 2),
              rawModelOutput: lastContent,
              parseError: lastParseError,
              validationIssues: JSON.stringify(lastValidation?.issues || [], null, 2)
            }
    });

    mock = result.mock;
    lastContent = result.mock ? JSON.stringify(result.json, null, 2) : result.content;
    try {
      lastCase = (result.mock ? result.json : extractJsonObject(result.content)) as DeductionCase;
      lastParseError = "";
    } catch (error) {
      lastCase = null;
      lastValidation = {
        valid: false,
        errors: [`JSON parse failed: ${error instanceof Error ? error.message : "unknown parse error"}`],
        warnings: [],
        issues: [`JSON parse failed: ${error instanceof Error ? error.message : "unknown parse error"}`],
        suspectMatrix: [],
        timelineContradictions: [],
        reasoningCoverage: { requiredEvidenceIds: [], coveredEvidenceIds: [], missingEvidenceIds: [], coverageRatio: 0 },
        fixSuggestions: ["Return a single valid JSON object matching the schema."]
      };
      lastParseError = error instanceof Error ? error.message : "unknown parse error";
      continue;
    }

    lastValidation = validateCase(lastCase);
    if (lastValidation.valid) {
      return { mock, content: lastContent, json: lastCase, validation: lastValidation, repaired: attempt > 0 };
    }
  }

  return { mock, content: lastContent, json: lastCase, validation: lastValidation, repaired: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateBody;

    if (body.stage === "gameTruthSeed") {
      const result = await generateValidatedCase(body);
      if (!result.json || !result.validation) {
        throw new Error("Case generation failed without a structured result.");
      }
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.stage === "gameLogicRepair") {
      const result = await callModel(body);
      const deductionCase = (result.mock ? result.json : extractJsonObject(result.content)) as DeductionCase;
      const validation = validateCase(deductionCase);
      return NextResponse.json({
        ok: true,
        mock: result.mock,
        content: result.mock ? JSON.stringify(deductionCase, null, 2) : result.content,
        json: deductionCase,
        validation
      });
    }

    const result = await callModel(body);

    if (result.mock) {
      const fallback = createFallbackCase(body.brief);
      const content =
        body.stage === "gameCaseFile"
          ? fallback.publicCaseFile
          : body.stage === "gameSolutionReveal"
            ? "Solution: the culprit is Lu Qing. The motive is hiding data fraud and embezzlement. The method is a power-switch surveillance gap plus a staged telescope calibration clue."
            : "No API key is available. The app is using Showcase / mock mode.";
      return NextResponse.json({ ok: true, mock: true, content });
    }

    return NextResponse.json({ ok: true, mock: false, content: result.content });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
