import { expect, test, type Page } from "@playwright/test";

async function clickMapLocation(page: Page, title: string) {
  const aliases: Record<string, string> = {
    "Old Theater": "旧剧院",
    "Black Pine Inn": "黑松旅店"
  };
  await page.locator(`.mapTile[title="${aliases[title] || title}"]`).evaluate((element) => (element as HTMLElement).click());
}

async function clickInspectorTab(page: Page, name: string) {
  const aliases: Record<string, string> = {
    Logic: "逻辑",
    Investigation: "调查",
    Events: "事件",
    People: "人物"
  };
  await page.getByTestId("inspector-rail").getByRole("button", { name: aliases[name] || name, exact: true }).click();
}

async function dismissOnboarding(page: Page) {
  const overlay = page.getByTestId("onboarding-overlay");
  await overlay.waitFor({ state: "visible", timeout: 2_000 }).catch(() => undefined);
  if (await overlay.isVisible()) {
    await overlay.getByRole("button").last().dispatchEvent("click");
    await expect(overlay).toBeHidden();
  }
  await page.evaluate(() => {
    localStorage.setItem("detective-town-onboarding-v1", JSON.stringify({ dismissed: true, wrongTheorySubmitted: false }));
  });
}

async function discoverArchiveEvidence(page: Page) {
  await clickMapLocation(page, "Old Theater");
  await expect(page.locator(".checkRow")).toHaveCount(1);
  await clickMapLocation(page, "雨棚集市");
  await expect(page.locator(".checkRow")).toHaveCount(2);
  for (let index = 0; index < 4; index += 1) {
    await clickMapLocation(page, "镇档案馆");
    await expect(page.locator(".checkRow")).toHaveCount(index + 3);
  }
  await clickMapLocation(page, "雾灯广场");
  await expect(page.locator(".checkRow")).toHaveCount(7);
  await clickMapLocation(page, "Black Pine Inn");
  await expect(page.locator(".checkRow")).toHaveCount(8);
  await clickMapLocation(page, "钟楼");
  await expect(page.locator(".checkRow")).toHaveCount(9);
}

test.beforeEach(async ({ page }, testInfo) => {
  const usesServerApis = testInfo.title.includes("novel world graph") || testInfo.title.includes("persistent agent town");
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("detective-town-e2e-initialized")) {
      localStorage.removeItem("detective-town-onboarding-v1");
      sessionStorage.setItem("detective-town-e2e-initialized", "true");
    }
  });
  if (!usesServerApis) {
    await page.route("**/api/**", async (route) => {
      throw new Error(`Static demo attempted an API request: ${route.request().url()}`);
    });
  } else {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("detective-town-novel-world-e2e-initialized")) {
        localStorage.removeItem("detective-town-novel-world-project-v2");
        indexedDB.deleteDatabase("detective-town-novel-workbench-v4");
        sessionStorage.setItem("detective-town-novel-world-e2e-initialized", "true");
      }
    });
  }
  await page.goto(usesServerApis ? "/" : "/?runtime=static");
});

test("novel world graph sample project opens a complete workbench", async ({ page }) => {
  test.setTimeout(45_000);
  await page.evaluate(async () => {
    localStorage.removeItem("detective-town-novel-world-project-v2");
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("detective-town-novel-workbench-v4");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
  await dismissOnboarding(page);
  await page.getByTestId("open-world-graph").click();
  await expect(page.getByTestId("sample-project-panel")).toContainText("Rain Gate Sample");
  await page.getByTestId("load-sample-novel").click();
  await expect(page.getByTestId("chapter-queue-summary")).toContainText("5");
  await expect(page.getByTestId("chapter-queue-summary")).toContainText("ready");
  await expect(page.getByTestId("workbench-summary")).toContainText("Merged graph");
  await expect(page.getByTestId("audit-flow")).toContainText("Issue Queue");
  await expect(page.getByTestId("audit-flow")).toContainText("View Mode");
  await expect(page.getByTestId("replay-state-summary")).toContainText("fidelity");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Replay" }).click();
  await expect(page.getByTestId("replay-provenance-summary")).toContainText("source");
  await expect(page.getByTestId("replay-provenance-summary")).toContainText("replay gaps");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Game" }).click();
  await expect(page.getByTestId("novel-game-canvas").locator("canvas")).toBeVisible();
  await expect(page.getByTestId("novel-game-legend")).toContainText("actors");
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("novel world graph analyzes three chapters, merges changes and restores local project", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.removeItem("detective-town-novel-world-project-v2");
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("detective-town-novel-workbench-v4");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
  await dismissOnboarding(page);
  await page.route("**/api/v1/command/novel/evidence-index", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}") as { chapter?: { id?: string; order?: number; title?: string; rawText?: string } };
    const chapter = body.chapter || {};
    const text = chapter.rawText || "Lin Yao enters Rain Gate City.\n\nShen Qiu watches the sealed gate.";
    const paragraphs = text.split(/\n\s*\n|(?<=。)\s*\n/).map((item, index) => ({
      id: `${chapter.id || "chapter-1"}-p-${index + 1}`,
      index: index + 1,
      text: item.trim(),
      charStart: index * 40,
      charEnd: index * 40 + item.trim().length
    })).filter((item) => item.text);
    const first = paragraphs[0] || { id: `${chapter.id || "chapter-1"}-p-1`, index: 1, text: "Lin Yao enters Rain Gate City.", charStart: 0, charEnd: 30 };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          mock: true,
          repaired: false,
          chapter: {
            chapterId: chapter.id || "chapter-1",
            order: chapter.order || 1,
            title: chapter.title || "Chapter",
            rawText: text,
            paragraphs,
            updatedAt: "2026-06-09T00:00:00.000Z"
          },
          index: {
            chapterId: chapter.id || "chapter-1",
            paragraphCount: paragraphs.length,
            snippets: [{
              id: `evidence-${chapter.id || "chapter-1"}-p-1`,
              source: {
                chapterId: chapter.id || "chapter-1",
                paragraphId: first.id,
                quote: first.text.slice(0, 80),
                summary: "Paragraph-level source used by the E2E evidence index.",
                confidence: 0.9
              },
              keywords: ["source", "chapter"]
            }],
            warnings: []
          }
        }
      })
    });
  });
  await page.route("**/api/v1/command/novel/analyze", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}") as { title?: string; chapter?: { id?: string; order?: number; title?: string }; paragraphs?: Array<{ id: string; text: string }> };
    const title = body.chapter?.title || body.title || "";
    const chapterNumber = body.chapter?.order || (title.includes("2") ? 2 : title.includes("3") ? 3 : 1);
    const chapterId = body.chapter?.id || `chapter-${chapterNumber}`;
    const paragraph = body.paragraphs?.[0] || { id: `${chapterId}-p-1`, text: "Lin Yao enters Rain Gate City." };
    const sourceEvidence = {
      id: `source-${chapterId}-p-1`,
      source: {
        chapterId,
        paragraphId: paragraph.id,
        quote: paragraph.text.slice(0, 80),
        summary: "E2E paragraph evidence for extracted graph data.",
        confidence: 0.88
      },
      keywords: ["graph", "evidence"]
    };
    const linId = chapterNumber === 1 ? "char-lin-yao" : "char-lin-renamed";
    const extraEntity = chapterNumber >= 2
      ? [
          { id: "faction-qingyun", kind: "faction", name: "Qingyun Sect", role: "Local sect", summary: "Orders the city sealed.", traits: ["powerful"], x: 70, y: 30, tension: 81, evidence: [sourceEvidence] },
          { id: "char-mei", kind: "character", name: "Mei", role: "Market witness", summary: "Tracks the public effect of the lockdown.", traits: ["observant"], x: 62, y: 68, tension: 55, evidence: [sourceEvidence] },
          { id: "concept-lin-yao-rumor", kind: "concept", name: "Lin Yao", role: "Public rumor", summary: "A public name duplicate used for audit merge review.", traits: ["rumor"], x: 66, y: 72, tension: 42, evidence: [sourceEvidence] }
        ]
      : [];
    const extraEvent = chapterNumber >= 3
      ? [{ id: "event-formation", order: 2, timeLabel: "night", title: "Formation wakes", summary: "Underground lines answer the jade slip.", locationEntityId: "loc-rain-gate", participantEntityIds: ["item-jade-slip"], causes: ["resonance"], consequences: ["market panic"], publicKnowledge: true, evidence: [sourceEvidence] }]
      : [];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          mock: true,
          repaired: false,
          validation: { valid: true, errors: [], warnings: [] },
          themeCandidates: [
            { id: "theme-public-pressure", name: "Public pressure", category: "institutionOrganization", aliases: ["lockdown pressure"], status: "pending" },
            { id: "theme-oath-trust", name: "Oath trust", category: "valueBelief", aliases: ["public oath"], status: "pending" }
          ],
          themeSignals: [
            {
              id: `theme-signal-${chapterId}-will`,
              themeId: "theme-personal-will",
              chapterId,
              chapterOrder: chapterNumber,
              direction: chapterNumber >= 3 ? "transform" : "intensify",
              intensity: 62 + chapterNumber * 6,
              summary: chapterNumber === 1 ? "Lin Yao's private caution becomes an active choice at the sealed gate." : "External pressure forces Lin Yao to revise what action is possible.",
              uncertainty: 0.16,
              relatedCharacterIds: [linId],
              relatedEventIds: ["event-1"],
              relatedFactionIds: [],
              competingInterpretations: [],
              evidence: [sourceEvidence]
            },
            {
              id: `theme-signal-${chapterId}-public`,
              themeId: "theme-public-pressure",
              chapterId,
              chapterOrder: chapterNumber,
              direction: chapterNumber >= 2 ? "contested" : "unclear",
              intensity: chapterNumber >= 2 ? 78 : 35,
              summary: chapterNumber >= 2 ? "The lockdown can be read as civic protection or sect coercion." : "Public pressure is only beginning to appear.",
              uncertainty: chapterNumber >= 2 ? 0.2 : 0.38,
              relatedCharacterIds: [linId, "char-shen-qiu"],
              relatedEventIds: ["event-1"],
              relatedFactionIds: chapterNumber >= 2 ? ["faction-qingyun"] : [],
              competingInterpretations: chapterNumber >= 2 ? ["The city protects residents", "The sect coerces the city"] : [],
              evidence: [sourceEvidence]
            }
          ],
          characterStates: [
            {
              id: `state-${chapterId}-${linId}`,
              characterEntityId: linId,
              chapterId,
              chapterOrder: chapterNumber,
              summary: chapterNumber === 1 ? "Lin Yao enters as a cautious outsider." : "Sect pressure changes Lin Yao's immediate objective and social exposure.",
              dimensions: {
                goal: { summary: "Protect and decode the jade slip.", direction: "changed", intensity: 72 },
                belief: { summary: "Official orders require evidence before trust.", direction: "changed", intensity: 68 },
                relationships: { summary: "Shen Qiu becomes a conditional ally.", direction: "up", intensity: 66 },
                bodyCapability: { summary: "No definite physical change is supported.", direction: "unknown", intensity: 0 },
                socialPosition: { summary: "Moves from outsider to watched suspect.", direction: "down", intensity: 82 }
              },
              evidence: [sourceEvidence],
              uncertainty: 0.14
            },
            {
              id: `state-${chapterId}-char-shen-qiu`,
              characterEntityId: "char-shen-qiu",
              chapterId,
              chapterOrder: chapterNumber,
              summary: "Shen Qiu's duty conflicts with the evidence he observes.",
              dimensions: {
                goal: { summary: "Verify the old case pattern.", direction: "changed", intensity: 70 },
                belief: { summary: "Law without evidence is insufficient.", direction: "changed", intensity: 76 },
                relationships: { summary: "Mutual testing with Lin Yao intensifies.", direction: "changed", intensity: 67 },
                bodyCapability: { summary: "No definite capability change is supported.", direction: "unknown", intensity: 0 },
                socialPosition: { summary: "His official role is placed under pressure.", direction: "down", intensity: 64 }
              },
              evidence: [sourceEvidence],
              uncertainty: 0.18
            },
            ...(chapterNumber >= 2 ? [{
              id: `state-${chapterId}-char-mei`,
              characterEntityId: "char-mei",
              chapterId,
              chapterOrder: chapterNumber,
              summary: "Mei becomes a witness to the public consequences.",
              dimensions: {
                goal: { summary: "Understand the market panic.", direction: "changed", intensity: 55 },
                belief: { summary: "The lockdown is not routine.", direction: "changed", intensity: 58 },
                relationships: { summary: "No definite relationship change.", direction: "unknown", intensity: 0 },
                bodyCapability: { summary: "No definite capability change.", direction: "unknown", intensity: 0 },
                socialPosition: { summary: "Moves into a witness role.", direction: "up", intensity: 60 }
              },
              evidence: [sourceEvidence],
              uncertainty: 0.24
            }] : [])
          ],
          graph: {
            id: `e2e-world-${chapterNumber}`,
            title: `Rain Gate ${chapterNumber}`,
            genreTone: "Eastern fantasy / mystery",
            premise: "Lin Yao carries a jade slip into a sealed city.",
            observerBrief: "Observe how characters, factions, places, and events move the world.",
            warnings: [],
            entities: [
              { id: linId, kind: "character", name: "Lin Yao", role: "Outsider", summary: chapterNumber >= 2 ? "Hides the jade slip record." : "Carries the cracked jade slip.", traits: chapterNumber >= 2 ? ["careful", "secretive"] : ["careful"], x: 32, y: 62, tension: 68 + chapterNumber, evidence: [sourceEvidence] },
              { id: "char-shen-qiu", kind: "character", name: "Shen Qiu", role: "City warden", summary: "Finds the old case pattern.", traits: ["law keeper"], x: 52, y: 48, tension: 74, evidence: [sourceEvidence] },
              { id: "loc-rain-gate", kind: "location", name: "Rain Gate City", role: "Border city", summary: "The gate formation glows in rain.", traits: ["sealed"], x: 42, y: 54, tension: 64, evidence: [sourceEvidence] },
              { id: "item-jade-slip", kind: "item", name: "Cracked Jade Slip", role: "Key clue", summary: "Connects to the old case.", traits: ["broken"], x: 28, y: 64, tension: 88, evidence: [sourceEvidence] },
              ...extraEntity
            ],
            relationships: [
              { id: "rel-lin-shen", fromEntityId: linId, toEntityId: "char-shen-qiu", label: "mutual testing", polarity: "neutral", evidence: "Shen Qiu does not hand Lin Yao over.", evidenceSnippets: [sourceEvidence], strength: 58 }
            ],
            events: [
              { id: "event-1", order: 1, timeLabel: "rain night", title: chapterNumber === 1 ? "Lin Yao enters" : "Sect pressure rises", summary: "The chapter advances the city lockdown.", locationEntityId: "loc-rain-gate", participantEntityIds: [linId], causes: ["jade slip"], consequences: ["lockdown"], publicKnowledge: true, evidence: [sourceEvidence] },
              ...extraEvent
            ],
            development: [
              { id: "dev-1", title: "Lockdown conflict", trigger: "The sect demands answers.", likelyOutcome: "Shen Qiu may cooperate with Lin Yao.", involvedEntityIds: [linId, "char-shen-qiu"], tension: 82, unresolvedQuestion: "What happened in the old case?", evidence: [sourceEvidence] }
            ]
          }
        }
      })
    });
  });
  await page.route("**/api/v1/command/novel/blueprint", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}") as { project?: { mergedGraph?: { entities?: Array<{ id: string; kind: string; name: string }>; events?: Array<{ id: string; title: string }> } }; chapters?: Array<{ chapterId: string; paragraphs: Array<{ id: string; text: string }> }>; afterChapterId?: string; options?: { wordCountRange?: string; narrativePerspective?: string; pacing?: string } };
    const entities = body.project?.mergedGraph?.entities || [];
    const events = body.project?.mergedGraph?.events || [];
    const lin = entities.find((entity) => entity.name === "Lin Yao")?.id || entities[0]?.id || "";
    const shen = entities.find((entity) => entity.name === "Shen Qiu")?.id || entities[1]?.id || "";
    const loc = entities.find((entity) => entity.kind === "location")?.id;
    const latestEvent = events[events.length - 1]?.id;
    const chapter = body.chapters?.[body.chapters.length - 1];
    const paragraph = chapter?.paragraphs?.[0];
    const blueprintEvidence = chapter && paragraph ? [{
      id: "blueprint-source-e2e",
      source: {
        chapterId: chapter.chapterId,
        paragraphId: paragraph.id,
        quote: paragraph.text.slice(0, 80),
        summary: "Blueprint suggestion is grounded in the latest analyzed paragraph.",
        confidence: 0.86
      },
      keywords: ["blueprint", "source"]
    }] : [];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          mock: true,
          repaired: false,
          validation: { valid: true, errors: [], warnings: [] },
          blueprint: {
            id: "blueprint-e2e",
            afterChapterId: body.afterChapterId,
            targetChapterTitle: "Chapter 4 - Market Oath",
            wordCountRange: body.options?.wordCountRange || "2500-4000 words",
            narrativePerspective: body.options?.narrativePerspective || "close third person",
            pacing: body.options?.pacing || "balanced",
            chapterGoal: "Make Lin Yao and Shen Qiu choose whether to expose the jade slip record.",
            sceneBeats: [
              { id: "beat-market", order: 1, title: "Market resonance", purpose: "Open on the public consequence of the formation.", locationEntityId: loc, involvedEntityIds: [lin, shen].filter(Boolean), sourceEventIds: latestEvent ? [latestEvent] : [], tension: 72, outcome: "The city sees the conflict.", evidence: blueprintEvidence },
              { id: "beat-warden", order: 2, title: "Warden bargain", purpose: "Force Shen Qiu to protect or arrest Lin Yao.", locationEntityId: loc, involvedEntityIds: [lin, shen].filter(Boolean), sourceEventIds: latestEvent ? [latestEvent] : [], tension: 84, outcome: "Their alliance becomes conditional.", evidence: blueprintEvidence }
            ],
            characterMotivations: ["Lin Yao wants the jade slip record decoded.", "Shen Qiu wants proof before breaking city law."],
            conflictEscalation: ["The sect order becomes public pressure.", "The formation answer creates a deadline."],
            foreshadowingPayoffs: [
              { id: "payoff-slip", setup: "The cracked jade slip resonates below the market.", payoff: "Reveal one readable oath line but hide the signer.", relatedEntityIds: [lin].filter(Boolean), relatedEventIds: latestEvent ? [latestEvent] : [], urgency: "high", evidence: blueprintEvidence }
            ],
            writingRisks: [
              { id: "risk-summary", severity: "medium", message: "The chapter could explain the sect politics too directly.", mitigation: "Put the politics into a public arrest scene.", relatedEntityIds: [shen].filter(Boolean), evidence: blueprintEvidence }
            ],
            summary: "Read-only next chapter plan.",
            warnings: []
          }
        }
      })
    });
  });
  await page.route("**/api/v1/command/novel/ask", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}") as {
      project?: { mergedGraph?: { entities?: Array<{ id: string; kind: string; name: string }>; events?: Array<{ id: string; title: string }> } };
      chapters?: Array<{ chapterId: string; title: string; paragraphs: Array<{ id: string; text: string }> }>;
      question?: string;
      throughChapterId?: string;
    };
    const question = body.question || "";
    const chapter = body.chapters?.[0];
    const paragraph = chapter?.paragraphs?.[0];
    const lin = body.project?.mergedGraph?.entities?.find((entity) => entity.name === "Lin Yao")?.id || "char-lin-yao";
    const event = body.project?.mergedGraph?.events?.[0]?.id || "event-1";
    const refused = /后文|future|next/i.test(question);
    const evidenceHits = !refused && chapter && paragraph ? [{
      id: "ask-hit-e2e",
      sourceType: "causal-claim",
      sourceId: "causal-e2e",
      label: "Lin Yao -> city pressure",
      summary: "The city watches Lin Yao because the jade slip and sealed gate make him politically risky.",
      chapterId: chapter.chapterId,
      paragraphId: paragraph.id,
      quote: paragraph.text.slice(0, 80),
      confidence: 0.88,
      relatedObjectIds: [lin, event],
      score: 42
    }] : [];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          mock: true,
          repaired: false,
          queryPlan: {
            id: "ask-plan-e2e",
            question,
            kind: refused ? "unsupported" : "causality",
            throughChapterId: body.throughChapterId,
            normalizedTerms: question.split(/\s+/).filter(Boolean),
            entityIds: [lin],
            eventIds: [event],
            themeIds: ["theme-public-pressure"],
            causalClaimIds: [],
            refusedReason: refused ? "Question asks for future information." : undefined
          },
          evidenceHits,
          answer: refused ? {
            id: "ask-answer-refused",
            question,
            status: "refused",
            answer: "This asks beyond analyzed chapters, so the workbench refuses to predict later plot.",
            summaryBullets: ["No future prediction is generated."],
            evidenceHitIds: [],
            relatedObjectIds: [],
            warnings: ["Only analyzed chapters are allowed."]
          } : {
            id: "ask-answer-e2e",
            question,
            status: "answered",
            answer: "Lin Yao is watched because the cracked jade slip and sealed gate attach public risk to his arrival.",
            summaryBullets: ["The answer cites the first imported paragraph.", "The related objects remain clickable."],
            evidenceHitIds: ["ask-hit-e2e"],
            relatedObjectIds: [lin, event],
            warnings: []
          },
          validation: { valid: true, errors: [], warnings: [] }
        }
      })
    });
  });
  await page.route("**/api/v1/command/novel/simulation/explain", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}") as { step?: { id: string; evidence?: Array<{ id: string }>; selectedCandidateId?: string; candidates?: Array<{ id: string; label: string; ruleReasons: string[] }> } };
    const step = body.step;
    const candidate = step?.candidates?.find((item) => item.id === step.selectedCandidateId);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          mock: true,
          repaired: false,
          validation: { valid: true, errors: [], warnings: [] },
          explanation: {
            id: "simulation-explanation-e2e",
            stepId: step?.id,
            explanation: `${candidate?.label || "The selected action"} follows the deterministic source-checkpoint and evidence rules.`,
            uncertainty: 0.12,
            evidenceIds: step?.evidence?.map((item) => item.id) || [],
            warnings: []
          }
        }
      })
    });
  });

  await page.getByTestId("open-world-graph").click();
  await expect(page.getByTestId("world-graph-workbench")).toBeVisible();
  await page.getByTestId("whole-book-import-panel").locator("summary").click();
  const wholeBook = [
    "第一章 Rain Gate",
    "Lin Yao enters Rain Gate with the cracked jade slip. Shen Qiu watches the sealed gate.",
    "",
    "第二章 Sect Order",
    "Qingyun Sect orders the city sealed and demands the outsider be surrendered.",
    "",
    "第三章 Underground Lines",
    "The jade slip wakes underground lines below the market and panic spreads.",
    "",
    "第四章 Market Oath",
    "A public oath scene exposes pressure between the city and the sect.",
    "",
    "第五章 Warden Choice",
    "Shen Qiu must decide whether law or evidence controls the next move.",
    "",
    "第六章",
    "short"
  ].join("\n");
  await page.getByTestId("whole-book-title").fill("Steel Import E2E");
  await page.getByTestId("whole-book-text").fill(wholeBook);
  await page.getByTestId("create-import-preview").click();
  await expect(page.getByTestId("whole-book-import-preview")).toContainText("6 candidates");
  await page.getByTestId("import-candidate-title-1").fill("Edited Opening");
  await page.getByTestId("remove-import-candidate-6").click();
  await page.getByTestId("confirm-import-preview").click();
  await expect(page.getByTestId("chapter-queue").getByRole("button").filter({ hasText: /Edited Opening|第二章|第三章|第四章|第五章/ })).toHaveCount(5);
  await page.getByTestId("batch-size-select").selectOption("3");
  await page.getByTestId("run-next-batch").click();
  await expect(page.getByTestId("whole-book-progress")).toContainText("Analyzed");
  await expect(page.getByTestId("batch-chapter-list")).toContainText("ready", { timeout: 20_000 });
  await page.getByTestId("run-next-batch").click();
  await expect(page.getByTestId("batch-chapter-list")).toContainText("ready", { timeout: 20_000 });
  await expect(page.getByTestId("audit-view")).toBeVisible();
  await expect(page.getByTestId("audit-view")).toContainText("Trust Score");
  await expect(page.getByTestId("correction-mode-pill")).toContainText("Original Extracted Graph");
  await expect(page.getByTestId("audit-metrics")).toContainText("Evidence coverage");
  await expect(page.getByTestId("audit-issue-queue")).toBeVisible();
  await page.getByTestId("quick-rename-entity").click();
  await expect(page.getByTestId("correction-inspector")).toContainText("rename-entity");
  await expect(page.getByTestId("correction-mode-pill")).toContainText("Corrected View");
  await expect(page.getByTestId("audit-applied-corrections")).toContainText("rename-entity");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Map" }).click();
  await expect(page.getByTestId("novel-world-canvas")).toContainText("(Corrected)");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Audit" }).click();
  await page.getByTestId("quick-replace-evidence").click();
  await expect(page.getByTestId("correction-inspector")).toContainText("replace-evidence");
  await page.getByTestId("quick-hide-causal").click();
  await expect(page.getByTestId("correction-inspector")).toContainText("hide-object");
  await page.getByTestId("quick-merge-entity").click();
  await expect(page.getByTestId("correction-inspector")).toContainText("merge-entities");
  await page.locator('[data-testid^="applied-correction-manual-rename-"]').first().click();
  await page.getByTestId("correction-revert-selected").click();
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Map" }).click();
  await expect(page.getByTestId("novel-world-canvas")).not.toContainText("(Corrected)");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Game" }).click();
  await expect(page.getByTestId("novel-game-view")).toBeVisible();
  await expect(page.getByTestId("novel-game-canvas").locator("canvas")).toBeVisible();
  await expect(page.getByTestId("novel-game-legend")).toContainText("locations");
  await page.getByRole("button", { name: "Create Grounded Replay" }).click();
  await expect(page.getByTestId("novel-game-legend")).toContainText("actors");
  await page.getByTestId("novel-game-canvas").locator('button[data-testid^="game-actor-"]').first().click();
  await expect(page.getByTestId("game-selection-inspector")).toContainText("Game Selection");
  await expect(page.getByTestId("game-selection-inspector")).toContainText("Sprite:");
  await expect(page.getByTestId("game-selection-inspector")).toContainText("Palette");
  await page.getByTestId("game-step").click();
  await expect(page.getByTestId("novel-game-legend")).toContainText("1 event markers");
  await expect(page.getByTestId("novel-game-legend")).toContainText("visual effects");
  const gameCanvasMetrics = await page.getByTestId("novel-game-canvas").evaluate((element) => {
    const canvas = element.querySelector("canvas");
    return {
      width: canvas?.width || 0,
      height: canvas?.height || 0,
      dataUrlLength: canvas?.toDataURL("image/png").length || 0
    };
  });
  expect(gameCanvasMetrics.width).toBeGreaterThan(0);
  expect(gameCanvasMetrics.height).toBeGreaterThan(0);
  expect(gameCanvasMetrics.dataUrlLength).toBeGreaterThan(5_000);
  await page.getByTestId("game-label-mode").selectOption("focus");
  await page.getByTestId("game-evidence-heat").click();
  await page.getByTestId("game-motion-trails").click();
  await page.getByTestId("game-pixel-scale").getByRole("button", { name: "2x pixels" }).click();
  const toggledGameCanvasMetrics = await page.getByTestId("novel-game-canvas").evaluate((element) => {
    const canvas = element.querySelector("canvas");
    return {
      width: canvas?.width || 0,
      height: canvas?.height || 0,
      dataUrlLength: canvas?.toDataURL("image/png").length || 0
    };
  });
  expect(toggledGameCanvasMetrics.width).toBeGreaterThan(0);
  expect(toggledGameCanvasMetrics.height).toBeGreaterThan(0);
  expect(toggledGameCanvasMetrics.dataUrlLength).toBeGreaterThan(5_000);
  await page.getByTestId("novel-game-canvas").locator('button[data-testid^="game-event-"]').first().click();
  await expect(page.getByTestId("simulation-step-inspector")).toContainText("Replay evidence");
  await expect(page.getByTestId("simulation-candidates")).toContainText("source-checkpoint");
  await expect(page.getByTestId("simulation-step-inspector")).toContainText("Visual:");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Replay" }).click();
  await expect(page.getByTestId("replay-checkpoints")).toContainText("next checkpoint");
  await expect(page.getByTestId("replay-event-stream")).toContainText("source");
  await page.getByTestId("simulation-explain").click();
  await expect(page.getByTestId("simulation-explanation")).toContainText("deterministic source-checkpoint");
  await expect(page.getByTestId("replay-comparison")).toContainText("Fidelity");
  await page.getByTestId("replay-back").click();
  await expect(page.getByTestId("replay-event-stream")).not.toContainText("Evidence-guided replay matched");
  await page.getByTestId("replay-step").click();
  await page.getByTestId("simulation-intervention-actor").selectOption({ index: 1 });
  await page.getByTestId("simulation-intervention-kind").selectOption("knowledge");
  await page.getByTestId("simulation-intervention-value").selectOption("false");
  await page.getByTestId("apply-simulation-intervention").click();
  await page.getByTestId("replay-step").click();
  await expect(page.getByTestId("replay-event-stream")).toContainText("counterfactual");
  await expect(page.getByTestId("simulation-run-panel")).toContainText("Short Branch");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Game" }).click();
  await expect(page.getByTestId("novel-game-canvas").locator(".gameHitEvent.counterfactual")).toHaveCount(1);
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Ask" }).click();
  await expect(page.getByTestId("ask-view")).toBeVisible();
  await page.getByTestId("ask-question-input").fill("Lin Yao 为什么被关注？");
  await page.getByTestId("ask-book-submit").click();
  await expect(page.getByTestId("ask-answer-panel")).toContainText("Lin Yao is watched");
  await expect(page.getByTestId("ask-evidence-list")).toContainText("causal-claim");
  await page.getByTestId("ask-evidence-ask-hit-e2e").click();
  await expect(page.getByTestId("ask-evidence-inspector")).toContainText("Ask evidence");
  await expect(page.getByTestId("ask-related-objects")).toContainText("Lin Yao");
  await page.getByTestId("ask-question-input").fill("后文会怎样？");
  await page.getByTestId("ask-book-submit").click();
  await expect(page.getByTestId("ask-answer-panel")).toContainText("refuses to predict");
  await expect(page.getByTestId("ask-history-panel")).toContainText("后文会怎样？");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Causality" }).click();
  await expect(page.getByTestId("causality-view")).toBeVisible();
  await expect(page.getByTestId("causality-view").locator(".causalClaimNode").first()).toBeVisible();
  await page.getByTestId("causality-view").locator(".causalClaimNode").first().click();
  await expect(page.getByTestId("causal-claim-inspector")).toContainText("Causal claim evidence");
  await page.getByTestId("causality-view").locator(".causalEdgeButton").first().click();
  await expect(page.getByTestId("causal-edge-inspector")).toContainText("Causal edge evidence");
  const causalPinButtons = page.getByTestId("causal-focus-panel").locator('button[data-testid^="pin-causal-chain-"]');
  await causalPinButtons.first().click();
  await expect(page.getByTestId("causal-focus-panel")).toContainText("1/3 pinned");
  const causalGap = page.getByTestId("causality-view").locator(".causalGap.missing").first();
  if (await causalGap.count()) {
    await causalGap.click();
    await expect(page.getByTestId("causal-gap-inspector")).toContainText("Withheld causal link");
  }
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Theme Pressure" }).click();
  await expect(page.getByTestId("theme-pressure-view")).toBeVisible();
  await expect(page.getByTestId("theme-pressure-view").locator(".themeSignalNode").first()).toBeVisible();
  await page.getByTestId("theme-pressure-view").locator(".themeSignalNode").first().click();
  await expect(page.getByTestId("theme-signal-inspector")).toContainText("Theme pressure evidence");
  await expect(page.getByTestId("theme-signal-inspector")).toContainText("Direction:");
  await page.getByTestId("theme-name-theme-public-pressure").fill("Civic pressure");
  await page.getByTestId("confirm-theme-theme-public-pressure").click();
  await page.getByTestId("pin-theme-theme-personal-will").click();
  await page.getByTestId("pin-theme-theme-institution-organization").click();
  await page.getByTestId("pin-theme-theme-public-pressure").click();
  await page.getByTestId("pin-theme-theme-value-belief").click();
  await expect(page.getByTestId("theme-focus-panel")).toContainText("4/4 pinned");
  await page.getByTestId("merge-theme-theme-oath-trust").click();
  await page.getByTestId("hide-theme-theme-material-survival").click();
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Character Arc" }).click();
  await expect(page.getByTestId("character-arc-view")).toBeVisible();
  await expect(page.getByTestId("character-arc-view").locator(".arcStateNode").first()).toBeVisible();
  await page.getByTestId("character-arc-view").locator(".arcStateNode").first().click();
  await expect(page.getByTestId("character-state-inspector")).toContainText("Goal");
  await expect(page.getByTestId("character-state-inspector")).toContainText("Character state evidence");
  const pinButtons = page.getByTestId("character-focus-panel").locator('button[data-testid^="pin-character-"]');
  await pinButtons.nth(0).click();
  await pinButtons.nth(1).click();
  await pinButtons.nth(2).click();
  await expect(page.getByTestId("character-focus-panel")).toContainText("3/3 pinned");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Map" }).click();
  await expect(page.getByTestId("novel-world-canvas").locator(".worldNode")).toHaveCount(6);
  await page.getByTestId("novel-world-canvas").locator(".worldNode").filter({ hasText: "Shen Qiu" }).click();
  await expect(page.getByTestId("novel-world-inspector")).toContainText("Shen Qiu");
  await expect(page.getByTestId("novel-world-inspector")).toContainText(/chapter-.*-p-1/);
  await page.getByTestId("novel-relationship-list").locator("button").first().click();
  await expect(page.getByTestId("novel-world-inspector")).toContainText("mutual testing");
  await expect(page.getByTestId("novel-world-inspector")).toContainText("confidence");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Events" }).click();
  await page.getByTestId("novel-event-timeline").locator("button").first().click();
  await expect(page.getByTestId("novel-world-inspector")).toContainText(/Lin Yao enters|Sect pressure rises/);
  await page.getByTestId("novel-change-list").locator("button").first().click();
  await expect(page.getByTestId("novel-world-inspector")).toContainText(/added|changed|merged/);
  await page.getByTestId("novel-development-list").first().click();
  await expect(page.getByTestId("novel-world-inspector")).toContainText("Lockdown conflict");
  const thirdChapterValue = await page.getByTestId("chapter-filter").locator("option", { hasText: "第三章" }).getAttribute("value");
  await page.getByTestId("chapter-filter").selectOption(thirdChapterValue || "all");
  await expect(page.getByTestId("novel-event-timeline")).toContainText("Formation wakes");
  await page.getByTestId("world-inspector-tabs").getByRole("button", { name: "Writer" }).click();
  await expect(page.getByTestId("novel-writer-panel")).toBeVisible();
  await page.getByTestId("blueprint-target-mode").selectOption("latest");
  await page.getByTestId("blueprint-pacing").selectOption("high-tension");
  await page.getByTestId("generate-blueprint").click();
  await expect(page.getByTestId("blueprint-result")).toContainText("Chapter 4 - Market Oath");
  await page.getByTestId("blueprint-scene-beats").locator("button").first().click();
  await expect(page.getByTestId("blueprint-detail")).toContainText("Market resonance");
  await expect(page.getByTestId("blueprint-detail")).toContainText("Blueprint suggestion is grounded");
  await page.getByTestId("blueprint-payoff-list").locator("button").first().click();
  await expect(page.getByTestId("blueprint-detail")).toContainText("readable oath line");
  await page.getByTestId("blueprint-risk-list").locator("button").first().click();
  await expect(page.getByTestId("blueprint-detail")).toContainText("public arrest scene");
  await page.getByTestId("world-inspector-tabs").getByRole("button", { name: "Simulation" }).click();
  await expect(page.getByTestId("simulation-decision-panel")).toContainText("Rules choose actions");
  await expect(page.getByTestId("simulation-decision-panel")).toContainText("counterfactual branch active");
  await page.getByTestId("world-inspector-tabs").getByRole("button", { name: "Writer" }).click();
  await page.getByTestId("novel-writer-panel").getByRole("button", { name: "Export" }).click();
  await expect(page.getByTestId("blueprint-export")).toContainText("Chapter 4 - Market Oath");
  await page.getByTestId("novel-writer-panel").getByRole("button", { name: "Copy" }).click();
  await expect(page.getByTestId("blueprint-export")).toContainText("targetChapterTitle");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Game" }).click();
  await page.reload();
  await page.getByTestId("open-world-graph").click();
  await expect(page.getByTestId("chapter-queue")).toContainText("ready");
  await expect(page.getByTestId("long-text-evidence-panel")).toContainText("IndexedDB");
  await expect(page.getByTestId("novel-game-view")).toBeVisible();
  await expect(page.getByTestId("novel-game-canvas").locator("canvas")).toBeVisible();
  await expect(page.getByTestId("novel-game-canvas").locator(".gameHitEvent.counterfactual")).toHaveCount(1);
  await expect(page.getByTestId("game-label-mode")).toHaveValue("focus");
  await expect(page.getByTestId("game-evidence-heat")).toContainText("Off");
  await expect(page.getByTestId("game-motion-trails")).toContainText("Off");
  await expect(page.getByTestId("game-pixel-scale").getByRole("button", { name: "2x pixels" })).toHaveClass(/active/);
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Replay" }).click();
  await expect(page.getByTestId("simulation-run-panel")).toContainText("Short Branch");
  await expect(page.getByTestId("replay-event-stream")).toContainText("counterfactual");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Ask" }).click();
  await expect(page.getByTestId("ask-history-panel")).toContainText("Lin Yao 为什么被关注？");
  await expect(page.getByTestId("ask-history-panel")).toContainText("后文会怎样？");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Causality" }).click();
  await expect(page.getByTestId("causality-view")).toBeVisible();
  await expect(page.getByTestId("causal-focus-panel")).toContainText("1/3 pinned");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Theme Pressure" }).click();
  await expect(page.getByTestId("theme-name-theme-public-pressure")).toHaveValue("Civic pressure");
  await expect(page.getByTestId("theme-focus-panel")).toContainText("4/4 pinned");
  await page.getByTestId("world-view-tabs").getByRole("button", { name: "Events" }).click();
  await expect(page.getByTestId("novel-event-timeline")).toBeVisible();
  await expect(page.getByTestId("character-focus-panel")).toContainText("3/3 pinned");
  await expect(page.getByTestId("blueprint-result")).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("persistent agent town runs, scores agents and extracts a playable case", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("/?runtime=server");
  await dismissOnboarding(page);
  await page.locator(".settingsDrawer summary").click();
  await page.getByLabel("Seed").fill(`persistent-e2e-${testInfo.project.name}`);
  await page.getByLabel("Case Mode").selectOption("generated");
  await page.getByRole("button", { name: /Reset \/ Create Town/ }).click();
  await expect(page.getByTestId("pixel-map")).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => page.locator(".actorPin").count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(18);

  await page.getByTestId("open-persistent-town").click();
  await expect(page.getByTestId("persistent-town-panel")).toBeVisible();
  await expect(page.getByTestId("review-summary")).toContainText("案件导演台", { timeout: 20_000 });
  await expect(page.getByTestId("director-agent-count")).toContainText("20", { timeout: 20_000 });
  await page.getByTestId("persistent-town-panel").getByRole("button", { name: "开始", exact: true }).click();
  await expect(page.getByTestId("agent-state-panel")).toContainText("NPC 档案", { timeout: 20_000 });
  await expect(page.getByTestId("agent-state-panel")).toContainText("传播记忆", { timeout: 20_000 });
  await expect(page.getByTestId("agent-action-candidates")).toContainText("行动评分", { timeout: 20_000 });
  await expect(page.getByTestId("agent-action-candidates")).toContainText(/调查|传闻|不在场|施压|掩盖/, { timeout: 20_000 });

  for (let index = 0; index < 3; index += 1) {
    await page.getByTestId("persistent-town-panel").getByRole("button", { name: "单步" }).click();
  }

  await expect(page.getByTestId("emergence-queue")).toContainText("压力", { timeout: 20_000 });
  await expect(page.getByTestId("emergence-queue")).toContainText("事件支撑");
  await expect(page.getByTestId("emergence-queue")).toContainText(/动机|手段|机会|形成中/);
  await expect(page.getByTestId("scenario-runner")).toBeVisible();
  await page.getByTestId("scenario-runner").getByRole("button", { name: "运行默认场景" }).click();
  await expect(page.getByTestId("review-summary")).toContainText("案件导演台", { timeout: 20_000 });
  await expect(page.getByTestId("review-summary")).toContainText("场景", { timeout: 20_000 });
  await expect(page.getByTestId("scenario-runner")).toContainText("Selected agent resource branch", { timeout: 25_000 });
  await expect(page.getByTestId("scenario-check-list")).toContainText("通过", { timeout: 20_000 });
  await expect(page.getByTestId("branch-comparison")).toContainText("NPC 变化", { timeout: 20_000 });
  await expect(page.getByTestId("time-machine")).toContainText("事件 +", { timeout: 20_000 });
  await expect(page.getByTestId("snapshot-timeline")).toContainText("Tick", { timeout: 20_000 });
  await expect(page.getByTestId("snapshot-diff-details")).toContainText("NPC 变化", { timeout: 20_000 });
  await expect(page.getByTestId("benchmark-dashboard")).toBeVisible();
  await expect(page.getByTestId("benchmark-dashboard")).toContainText(/通过率|基准报告/);

  let rollbackDialogMessage = "";
  page.once("dialog", async (dialog) => {
    rollbackDialogMessage = dialog.message();
    await dialog.dismiss();
  });
  await page.getByTestId("time-machine").getByRole("button", { name: "回滚到起点快照" }).click();
  expect(rollbackDialogMessage).toContain("回滚");

  const agentPanelOverflow = await page.getByTestId("persistent-town-panel").evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(agentPanelOverflow).toBeLessThanOrEqual(1);
  await page.getByTestId("emergence-queue").getByRole("button", { name: "抽取可玩案件" }).first().click();
  await expect(page.getByTestId("status-line")).toContainText("Playable case extracted", { timeout: 20_000 });
  await expect(page.getByTestId("inspector-rail").locator("button.active")).toContainText("调查");
});

test("guides a first-time player and persists dismissal", async ({ page }) => {
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.getByTestId("onboarding-overlay")).toBeVisible();
  await expect(page.getByTestId("guided-task-list")).toContainText("观察案发窗口");
  await expect(page.getByTestId("map-legend")).toContainText("可搜索");
  await expect(page.getByTestId("investigation-stage-bar")).toBeVisible();
  await expect(page.getByTestId("inspector-summary")).toBeVisible();
  await expect(page.locator(".actorPin")).toHaveCount(8);

  await page.getByTestId("onboarding-overlay").getByRole("button", { name: "开始当前步骤" }).click();
  await expect(page.locator(".timeBadge")).toHaveText("21:47");
  await expect(page.locator(".eventRow.selected")).toBeVisible();
  await expect(page.locator(".mapTile.spotlight")).toBeVisible();

  await page.getByRole("button", { name: "关闭引导" }).click();
  await expect(page.getByTestId("onboarding-overlay")).toBeHidden();
  await page.reload();
  await expect(page.getByTestId("onboarding-overlay")).toBeHidden();
  await page.getByTestId("guided-task-list").getByRole("button", { name: /帮助/ }).dispatchEvent("click");
  await expect(page.getByTestId("onboarding-overlay")).toBeVisible();
});

test("loads a playable premium town without server APIs", async ({ page }) => {
  await dismissOnboarding(page);
  await expect(page.getByTestId("value-proposition")).toContainText("AI");
  await expect(page.getByTestId("suggested-action")).toContainText("当前建议行动");
  await expect(page.getByTestId("inspector-rail")).toBeVisible();
  await expect(page.getByTestId("evidence-notebook")).toBeVisible();
  await expect(page.getByTestId("inspector-rail").locator("button.active")).toContainText("调查");
  const ordinaryTileTabIndex = await page.locator('.mapTile[title="grass"]').first().getAttribute("tabindex");
  expect(ordinaryTileTabIndex).toBe("-1");
  await clickInspectorTab(page, "Logic");
  await expect(page.getByTestId("proof-tour")).toBeVisible();
  await expect(page.getByTestId("proof-tour")).toContainText("玩家证明");
  await expect(page.getByTestId("deduction-graph").locator('[data-node-type="evidence"].locked').first()).toBeVisible();
  await expect(page.getByTestId("emergence-proof")).toBeVisible();
  await expect(page.getByTestId("emergence-proof")).toContainText("Locked hidden world event");
  await expect(page.getByTestId("emergence-proof")).not.toContainText("culpritId");
  await expect(page.getByTestId("causal-trace")).toContainText("Causal Trace");
  await expect(page.locator(".causalDetails")).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("case library switches all four static templates", async ({ page }) => {
  await dismissOnboarding(page);
  await page.locator(".settingsDrawer summary").click();
  const select = page.getByTestId("case-template-select");
  await expect(page.getByTestId("case-library-meta")).toContainText("4 premium templates");
  await select.selectOption("archive-blunt");
  await expect(page.locator("body")).toContainText("档案馆钝器误导案");
  await clickInspectorTab(page, "Logic");
  await expect(page.getByTestId("causal-trace")).toContainText("未揭示的因果节点");

  await select.selectOption("clocktower-locked-room");
  await expect(page.getByTestId("deduction-graph")).toBeVisible();
  await expect(page.locator(".actorPin")).toHaveCount(8);
  await expect(page.getByTestId("deduction-graph")).toBeVisible();

  await select.selectOption("clinic-poison");
  await expect(page.getByTestId("deduction-graph")).toBeVisible();
  await select.selectOption("greenhouse-blade");
  await expect(page.getByTestId("case-library-meta")).toContainText("blade case");
  await expect(page.locator("body")).toContainText("Greenhouse pruning blade case");
  await expect(page.locator(".actorPin")).toHaveCount(8);
  await expect(page.getByTestId("deduction-graph")).toBeVisible();
  await clickInspectorTab(page, "Events");
  await expect(page.locator(".eventRow")).not.toHaveCount(0);
  await clickInspectorTab(page, "Logic");
  await expect(page.getByTestId("causal-trace")).toBeVisible();
  await expect(page.getByTestId("proof-tour")).toBeVisible();
});

test("search, interrogate and solve use the local rule engine", async ({ page }) => {
  await dismissOnboarding(page);
  await discoverArchiveEvidence(page);
  await expect(page.getByTestId("toast-stack")).toBeVisible();

  await expect(page.locator(".evidenceList button.found").first()).toBeVisible();
  await expect(page.getByTestId("evidence-notebook")).toContainText("Evidence Notebook");
  await expect(page.getByTestId("evidence-notebook").locator(".notebookCard:not(.locked)").first()).toBeVisible();
  await page.getByTestId("evidence-notebook").locator(".notebookCard:not(.locked)").first().getByRole("button").last().click();
  await expect(page.getByTestId("toast-stack")).toBeVisible();
  await expect(page.getByTestId("evidence-use-hint").first()).toBeVisible();
  await expect(page.getByTestId("evidence-use-hint").first()).toBeVisible();
  await clickInspectorTab(page, "Logic");
  await expect(page.getByTestId("proof-tour")).toContainText("玩家证明");
  await expect(page.getByTestId("deduction-graph").locator('[data-node-type="evidence"].unlocked').first()).toBeVisible();
  await page.getByTestId("deduction-graph").locator('[data-node-type="evidence"].unlocked').first().dispatchEvent("click");
  await expect(page.getByTestId("graph-explanation-card")).toContainText("Evidence established");
  await expect(page.getByTestId("graph-explanation-card")).toContainText("Source events");

  await clickInspectorTab(page, "People");
  await page.locator(".suspectRow").first().click();
  await expect(page.getByTestId("suspect-explanation-card")).toBeVisible();

  await clickInspectorTab(page, "Investigation");
  await page.getByTestId("inspector-rail").getByRole("button", { name: "询问 NPC" }).click();
  await expect(page.locator(".aiSafetyStrip").getByText("Prompt Safe: Yes")).toBeVisible();
  await expect(page.getByTestId("toast-stack")).toBeVisible();
  await expect(page.locator(".aiSafetyStrip")).toContainText("Contradiction:");

  await page.locator("select").filter({ has: page.locator('option[value="npc-02"]') }).last().selectOption("npc-02");
  await page.locator("button.primaryButton.full").filter({ hasText: "判定推理" }).click();
  await expect(page.getByTestId("judgement-result")).toBeVisible();
  await expect(page.getByTestId("next-step-advice")).toBeVisible();
  await expect(page.getByTestId("theory-gap-cards")).toContainText("缺口类型");
  await expect(page.getByTestId("theory-gap-cards")).not.toContainText("陆执");
  await page.getByTestId("theory-gap-cards").locator(".gapCard").first().click();
  await expect(page.getByTestId("inspector-summary")).toBeVisible();

  await clickInspectorTab(page, "Investigation");
  await page.locator("select").filter({ has: page.locator('option[value="npc-06"]') }).last().selectOption("npc-06");
  await page.getByPlaceholder("动机").fill("林澈准备公开旧剧院修缮款票据，陆执会失去剧院和名声。");
  await page.getByPlaceholder("手法").fill("陆执在镇档案馆用舞台配重锤击杀林澈，再伪装成灯架坠落事故。");
  for (const checkbox of await page.locator(".checkRow input").all()) await checkbox.check();
  await page.locator("button.primaryButton.full").filter({ hasText: "判定推理" }).click();
  await expect(page.getByTestId("toast-stack")).toBeVisible();
  await expect(page.getByTestId("judgement-result")).toBeVisible();
  await page.getByTestId("judgement-result").getByRole("button", { name: "生成解答篇" }).click();
  await expect(page.locator(".revealBox")).toBeVisible();
  await expect(page.getByTestId("deduction-graph").locator('[data-node-type="conclusion"]')).toBeVisible();
  await clickInspectorTab(page, "Logic");
  await expect(page.getByTestId("emergence-proof-metrics")).toContainText("Hard logic");
  await expect(page.getByTestId("proof-tour")).toContainText("唯一结论");
  await expect(page.getByTestId("emergence-proof")).toContainText("Case extracted from world log");
  await expect(page.getByTestId("solution-chain")).toBeVisible();

  await page.reload();
  await clickInspectorTab(page, "Logic");
  await expect(page.locator(".revealBox")).toBeVisible();
});

test("map hover card and NPC state markers explain investigation context", async ({ page }) => {
  await dismissOnboarding(page);
  await page.locator('.mapTile[title="镇档案馆"]').first().hover();
  await expect(page.getByTestId("location-hover-card")).toContainText("镇档案馆");
  await expect(page.getByTestId("location-hover-card")).toContainText("证据进度");
  await expect(page.getByTestId("location-hover-card").getByRole("button")).toBeVisible();
  await clickMapLocation(page, "镇档案馆");
  await expect(page.getByTestId("toast-stack")).toBeVisible();
  await clickInspectorTab(page, "Investigation");
  await page.locator(".actorPin").first().click();
  await expect(page.getByTestId("npc-popover-card")).toBeVisible();
  await expect(page.getByTestId("npc-popover-card").getByRole("button", { name: "询问 NPC" })).toBeVisible();
  await page.getByTestId("inspector-rail").getByRole("button", { name: "询问 NPC" }).click();
  await expect(page.locator(".actorPin.actor-questioned").first()).toBeVisible();
});

test("causal trace node jumps timeline and event selection", async ({ page }) => {
  await dismissOnboarding(page);
  const badge = page.locator(".timeBadge");
  await expect(badge).toHaveText("08:00");
  await clickInspectorTab(page, "Logic");
  await page.locator(".causalDetails summary").click();
  await page.getByTestId("causal-trace").locator("button").filter({ hasText: "22:05" }).click();
  await expect(badge).toHaveText("22:05");
  await clickInspectorTab(page, "Events");
  await expect(page.locator(".eventRow.selected")).toBeVisible();
});

test("replay advances the 24h timeline", async ({ page }) => {
  await dismissOnboarding(page);
  const badge = page.locator(".timeBadge");
  await expect(badge).toHaveText("08:00");
  await page.getByRole("button", { name: /Play Replay/ }).click();
  await expect(badge).not.toHaveText("08:00", { timeout: 3_000 });
  await page.getByRole("button", { name: /Pause Replay/ }).click();
});

test("authoring workbench explains validation blockers", async ({ page }) => {
  await dismissOnboarding(page);
  await page.evaluate(() => localStorage.removeItem("detective-town-authoring-v1"));
  await page.evaluate(() => localStorage.removeItem("detective-town-case-gallery-v1"));
  await page.reload();
  await dismissOnboarding(page);
  await page.getByTestId("open-authoring").click();
  await expect(page.getByTestId("authoring-workbench")).toBeVisible();
  await expect(page.getByTestId("authoring-rule-report")).toContainText("Pass");
  await expect(page.getByTestId("authoring-validation-checklist")).toContainText("Schema");
  await expect(page.getByTestId("authoring-validation-checklist")).toContainText("Playable Runtime");
  await expect(page.getByTestId("authoring-proof-audit")).toContainText("Proof Audit");

  await page.getByTestId("authoring-title").fill("Author Test Case");
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await page.getByTestId("authoring-evidence-description").fill("Author test evidence description that keeps the original logic chain.");
  await expect(page.getByTestId("authoring-rule-report")).toContainText("Pass");

  await page.reload();
  await page.getByTestId("open-authoring").click();
  await expect(page.getByTestId("authoring-title")).toHaveValue("Author Test Case");

  await page.getByTestId("save-to-gallery").click();
  await expect(page.getByTestId("case-gallery-panel")).toBeVisible();
  const savedGalleryCard = page.getByTestId("case-gallery-card").filter({ hasText: "Author Test Case" });
  await expect(savedGalleryCard).toContainText("Runnable");
  await expect(savedGalleryCard).toContainText("Hard logic");
  await savedGalleryCard.getByRole("button", { name: "Load into Authoring" }).click();
  await page.getByRole("button", { name: "Case", exact: true }).click();
  await expect(page.getByTestId("authoring-title")).toHaveValue("Author Test Case");
  await page.getByTestId("export-gallery-json").click();
  await expect(page.getByTestId("authoring-export-text")).toContainText('"version": 1');
  await expect(page.getByTestId("authoring-export-text")).toContainText('"entries"');
  await page.getByRole("button", { name: "Gallery", exact: true }).click();
  await savedGalleryCard.getByTestId("delete-gallery-entry").click();
  await expect(page.getByTestId("case-gallery-card").filter({ hasText: "Author Test Case" })).toHaveCount(0);
  await expect(page.getByTestId("case-gallery-empty")).toContainText("No local drafts");

  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await page.getByTestId("delete-authoring-evidence").click();
  await expect(page.getByTestId("authoring-rule-report")).toContainText("Fail");
  await expect(page.locator(".statusBox").last()).toContainText("仍被引用");
  await expect(page.locator(".runDraftBlocker")).toContainText("Blocked:");
  await page.locator(".runDraftBlocker").click();
  await expect(page.getByRole("button", { name: "Evidence", exact: true })).toHaveClass(/active/);
  await expect(page.getByTestId("run-authoring-draft")).toBeDisabled();
  await page.getByTestId("save-to-gallery").click();
  const invalidGalleryCard = page.getByTestId("case-gallery-card").filter({ hasText: "Author Test Case" });
  await expect(invalidGalleryCard).toContainText("Blocked");
  await expect(invalidGalleryCard.getByRole("button", { name: "Run Draft" })).toBeDisabled();

  await page.getByRole("button", { name: "Load Premium Template" }).click();
  await expect(page.getByTestId("run-authoring-draft")).toBeEnabled();
  await page.getByRole("button", { name: "Export Markdown" }).click();
  await expect(page.getByTestId("authoring-export-text")).toContainText("Playable Case Summary");

  await page.getByRole("button", { name: "Case" }).click();
  await page.getByTestId("authoring-title").fill("Author Test Case");
  await page.getByTestId("run-authoring-draft").click();
  await expect(page.getByTestId("pixel-map").locator(".mapTile")).toHaveCount(504);
  await expect(page.locator("body")).toContainText("Author Test Case");
});

test("mobile layout has no page-level horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await dismissOnboarding(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByTestId("pixel-map")).toBeVisible();
  await expect(page.getByTestId("inspector-rail")).toBeVisible();
});
