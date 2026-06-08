import { expect, test, type Page } from "@playwright/test";

async function clickMapLocation(page: Page, title: string) {
  await page.locator(`.mapTile[title="${title}"]`).evaluate((element) => (element as HTMLElement).click());
}

async function clickInspectorTab(page: Page, name: string) {
  await page.getByTestId("inspector-rail").getByRole("button", { name, exact: true }).click();
}

async function dismissOnboarding(page: Page) {
  const overlay = page.getByTestId("onboarding-overlay");
  await overlay.waitFor({ state: "visible", timeout: 2_000 }).catch(() => undefined);
  if (await overlay.isVisible()) {
    await overlay.getByRole("button", { name: "关闭引导" }).dispatchEvent("click");
    await expect(overlay).toBeHidden();
  }
  await page.evaluate(() => {
    localStorage.setItem("detective-town-onboarding-v1", JSON.stringify({ dismissed: true, wrongTheorySubmitted: false }));
  });
}

async function discoverArchiveEvidence(page: Page) {
  await clickMapLocation(page, "旧剧院");
  await expect(page.locator(".checkRow")).toHaveCount(1);
  await clickMapLocation(page, "雨棚集市");
  await expect(page.locator(".checkRow")).toHaveCount(2);
  for (let index = 0; index < 4; index += 1) {
    await clickMapLocation(page, "镇档案馆");
    await expect(page.locator(".checkRow")).toHaveCount(index + 3);
  }
  await clickMapLocation(page, "雾灯广场");
  await expect(page.locator(".checkRow")).toHaveCount(7);
  await clickMapLocation(page, "黑松旅店");
  await expect(page.locator(".checkRow")).toHaveCount(8);
  await clickMapLocation(page, "钟楼");
  await expect(page.locator(".checkRow")).toHaveCount(9);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("detective-town-e2e-initialized")) {
      localStorage.removeItem("detective-town-onboarding-v1");
      sessionStorage.setItem("detective-town-e2e-initialized", "true");
    }
  });
  await page.route("**/api/**", async (route) => {
    throw new Error(`Static demo attempted an API request: ${route.request().url()}`);
  });
  await page.goto("/?runtime=static");
  await expect(page.getByTestId("pixel-map").locator(".mapTile")).toHaveCount(504);
});

test("guides a first-time player and persists dismissal", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "推理小镇" })).toBeVisible();
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
  await expect(page.getByTestId("value-proposition")).toContainText("案件不是 AI 编的");
  await expect(page.getByTestId("suggested-action")).toContainText("当前建议行动");
  await expect(page.getByTestId("inspector-rail")).toBeVisible();
  await expect(page.locator(".eventMore")).toBeVisible();
  await expect(page.getByTestId("inspector-rail").getByRole("button", { name: "事件" })).toHaveClass(/active/);
  await clickInspectorTab(page, "逻辑");
  await expect(page.getByTestId("deduction-graph").locator('[data-node-type="evidence"].locked').first()).toBeVisible();
  await expect(page.getByTestId("causal-trace")).toContainText("Causal Trace");
  await expect(page.locator(".causalDetails")).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("case library switches all three static templates", async ({ page }) => {
  await dismissOnboarding(page);
  await page.locator(".settingsDrawer summary").click();
  const select = page.getByTestId("case-template-select");
  await select.selectOption("archive-blunt");
  await expect(page.locator("body")).toContainText("档案馆钝器误导案");
  await clickInspectorTab(page, "逻辑");
  await expect(page.getByTestId("causal-trace")).toContainText("未揭示的因果节点");

  await select.selectOption("clocktower-locked-room");
  await expect(page.locator("body")).toContainText("钟楼密室时间案");
  await expect(page.locator(".actorPin")).toHaveCount(8);
  await expect(page.getByTestId("deduction-graph")).toBeVisible();

  await select.selectOption("clinic-poison");
  await expect(page.locator("body")).toContainText("诊所毒杀证词案");
  await clickInspectorTab(page, "事件");
  await expect(page.locator(".eventRow")).not.toHaveCount(0);
  await clickInspectorTab(page, "逻辑");
  await expect(page.getByTestId("causal-trace")).toContainText("案件因果链");
});

test("search, interrogate and solve use the local rule engine", async ({ page }) => {
  await dismissOnboarding(page);
  await discoverArchiveEvidence(page);
  await expect(page.getByTestId("toast-stack")).toBeVisible();

  await expect(page.locator(".evidenceList button.found").first()).toBeVisible();
  await expect(page.getByTestId("evidence-use-hint").first()).toBeVisible();
  await expect(page.getByTestId("evidence-use-hint").first()).toContainText(/质询|证词|证据链/);
  await clickInspectorTab(page, "逻辑");
  await expect(page.getByTestId("deduction-graph").locator('[data-node-type="evidence"].unlocked').first()).toBeVisible();
  await page.getByTestId("deduction-graph").locator('[data-node-type="evidence"].unlocked').first().dispatchEvent("click");
  await expect(page.getByTestId("graph-explanation-card")).toContainText("证据成立");
  await expect(page.getByTestId("graph-explanation-card")).toContainText("来源事件");

  await clickInspectorTab(page, "人物");
  await page.locator(".suspectRow").first().click();
  await expect(page.getByTestId("suspect-explanation-card")).toContainText(/已由|仍需发现排除证据/);

  await clickInspectorTab(page, "调查");
  await page.getByTestId("inspector-rail").getByRole("button", { name: "询问 NPC" }).click();
  await expect(page.locator(".aiSafetyStrip").getByText("Prompt Safe: Yes")).toBeVisible();
  await expect(page.getByTestId("toast-stack")).toBeVisible();
  await expect(page.locator(".aiSafetyStrip")).toContainText("Contradiction:");

  await page.locator("select").filter({ has: page.locator('option[value="npc-02"]') }).last().selectOption("npc-02");
  await page.getByRole("button", { name: "判定推理" }).click();
  await expect(page.getByTestId("judgement-result")).toContainText("推理不成立");
  await expect(page.getByTestId("next-step-advice")).toBeVisible();
  await expect(page.getByTestId("theory-gap-cards")).toContainText("缺口类型");
  await expect(page.getByTestId("theory-gap-cards")).not.toContainText("陆执");
  await page.getByTestId("theory-gap-cards").locator(".gapCard").first().click();
  await expect(page.getByTestId("inspector-summary")).toBeVisible();

  await page.locator("select").filter({ has: page.locator('option[value="npc-06"]') }).last().selectOption("npc-06");
  await page.getByPlaceholder("动机").fill("林澈准备公开旧剧院修缮款票据，陆执会失去剧院和名声。");
  await page.getByPlaceholder("手法").fill("陆执在镇档案馆用舞台配重锤击杀林澈，再伪装成灯架坠落事故。");
  for (const checkbox of await page.locator(".checkRow input").all()) await checkbox.check();
  await page.getByRole("button", { name: "判定推理" }).click();
  await expect(page.getByTestId("toast-stack")).toBeVisible();
  await expect(page.getByTestId("judgement-result").getByText("推理成立", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "生成解答篇" }).click();
  await expect(page.locator(".revealBox")).toContainText("凶手：陆执");
  await expect(page.getByTestId("deduction-graph").locator('[data-node-type="conclusion"]')).toBeVisible();
  await expect(page.getByTestId("solution-chain")).toContainText("已发现证据如何推出结论");

  await page.reload();
  await clickInspectorTab(page, "逻辑");
  await expect(page.locator(".revealBox")).toContainText("凶手：陆执");
});

test("map hover card and NPC state markers explain investigation context", async ({ page }) => {
  await dismissOnboarding(page);
  await page.locator('.mapTile[title="镇档案馆"]').first().hover();
  await expect(page.getByTestId("location-hover-card")).toContainText("镇档案馆");
  await expect(page.getByTestId("location-hover-card")).toContainText("证据进度");
  await clickMapLocation(page, "镇档案馆");
  await expect(page.getByTestId("toast-stack")).toBeVisible();
  await clickInspectorTab(page, "调查");
  await page.locator(".actorPin").first().click();
  await expect(page.getByTestId("npc-popover-card")).toBeVisible();
  await page.getByTestId("inspector-rail").getByRole("button", { name: "询问 NPC" }).click();
  await expect(page.locator(".actorPin.actor-questioned").first()).toBeVisible();
});

test("causal trace node jumps timeline and event selection", async ({ page }) => {
  await dismissOnboarding(page);
  const badge = page.locator(".timeBadge");
  await expect(badge).toHaveText("08:00");
  await clickInspectorTab(page, "逻辑");
  await page.locator(".causalDetails summary").click();
  await page.getByTestId("causal-trace").locator("button").filter({ hasText: "22:05" }).click();
  await expect(badge).toHaveText("22:05");
  await clickInspectorTab(page, "事件");
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
  await page.reload();
  await dismissOnboarding(page);
  await page.getByTestId("open-authoring").click();
  await expect(page.getByTestId("authoring-workbench")).toBeVisible();
  await expect(page.getByTestId("authoring-rule-report")).toContainText("Pass");
  await expect(page.getByTestId("authoring-validation-checklist")).toContainText("Schema");
  await expect(page.getByTestId("authoring-validation-checklist")).toContainText("Playable Runtime");

  await page.getByTestId("authoring-title").fill("雾灯镇：作者测试案");
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await page.getByTestId("authoring-evidence-description").fill("作者测试版证据描述，仍然保持原始逻辑链。");
  await expect(page.getByTestId("authoring-rule-report")).toContainText("Pass");

  await page.reload();
  await page.getByTestId("open-authoring").click();
  await expect(page.getByTestId("authoring-title")).toHaveValue("雾灯镇：作者测试案");

  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await page.getByTestId("delete-authoring-evidence").click();
  await expect(page.getByTestId("authoring-rule-report")).toContainText("Fail");
  await expect(page.locator(".statusBox").last()).toContainText("仍被引用");
  await expect(page.locator(".runDraftBlocker")).toContainText("阻断原因");
  await page.locator(".runDraftBlocker").click();
  await expect(page.getByRole("button", { name: "Evidence", exact: true })).toHaveClass(/active/);
  await expect(page.getByTestId("run-authoring-draft")).toBeDisabled();

  await page.getByRole("button", { name: "Load Premium Template" }).click();
  await expect(page.getByTestId("run-authoring-draft")).toBeEnabled();
  await page.getByRole("button", { name: "Export Markdown" }).click();
  await expect(page.getByTestId("authoring-export-text")).toContainText("Playable Case Summary");

  await page.getByRole("button", { name: "Case" }).click();
  await page.getByTestId("authoring-title").fill("雾灯镇：作者测试案");
  await page.getByTestId("run-authoring-draft").click();
  await expect(page.getByTestId("pixel-map").locator(".mapTile")).toHaveCount(504);
  await expect(page.locator("body")).toContainText("雾灯镇：作者测试案");
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
