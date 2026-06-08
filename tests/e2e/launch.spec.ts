import { expect, test, type Page } from "@playwright/test";

async function clickMapLocation(page: Page, title: string) {
  await page.locator(`.mapTile[title="${title}"]`).evaluate((element) => (element as HTMLElement).click());
}

async function clickInspectorTab(page: Page, name: string) {
  await page.getByTestId("inspector-rail").getByRole("button", { name, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    throw new Error(`Static demo attempted an API request: ${route.request().url()}`);
  });
  await page.goto("/?runtime=static");
  await expect(page.getByTestId("pixel-map").locator(".mapTile")).toHaveCount(504);
});

test("loads a playable premium town without server APIs", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "推理小镇" })).toBeVisible();
  await expect(page.getByTestId("suggested-action")).toContainText("当前建议行动");
  await expect(page.locator(".actorPin")).toHaveCount(8);
  await expect(page.getByTestId("inspector-rail")).toBeVisible();
  await expect(page.getByRole("button", { name: "事件" })).toHaveClass(/active/);
  await clickInspectorTab(page, "逻辑");
  await expect(page.getByTestId("deduction-graph").locator('[data-node-type="evidence"].locked').first()).toBeVisible();
  await expect(page.getByTestId("causal-trace")).toContainText("Causal Trace");
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("case library switches all three static templates", async ({ page }) => {
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

  await expect(page.locator(".evidenceList button.found").first()).toBeVisible();
  await expect(page.locator(".evidenceImpact").first()).toBeVisible();
  await clickInspectorTab(page, "逻辑");
  await expect(page.getByTestId("deduction-graph").locator('[data-node-type="evidence"].unlocked').first()).toBeVisible();

  await clickInspectorTab(page, "调查");
  await page.getByRole("button", { name: "询问 NPC" }).click();
  await expect(page.locator(".aiSafetyStrip").getByText("Prompt Safe: Yes")).toBeVisible();
  await expect(page.locator(".aiSafetyStrip")).toContainText("Contradiction:");

  await page.locator('select').filter({ has: page.locator('option[value="npc-02"]') }).last().selectOption("npc-02");
  await page.getByRole("button", { name: "判定推理" }).click();
  await expect(page.getByTestId("judgement-result")).toContainText("推理不成立");
  await expect(page.locator(".gapHints")).toContainText("缺口类型");

  await page.locator('select').filter({ has: page.locator('option[value="npc-06"]') }).last().selectOption("npc-06");
  await page.getByPlaceholder("动机").fill("林澈准备公开旧剧院修缮款票据，陆执会失去剧院和名声。");
  await page.getByPlaceholder("手法").fill("陆执在镇档案馆用舞台配重锤击杀林澈，再伪装成灯架坠落事故。");
  for (const checkbox of await page.locator(".checkRow input").all()) await checkbox.check();
  await page.getByRole("button", { name: "判定推理" }).click();
  await expect(page.getByText("推理成立", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "生成解答篇" }).click();
  await expect(page.locator(".revealBox")).toContainText("凶手：陆执");
  await expect(page.getByTestId("deduction-graph").locator('[data-node-type="conclusion"]')).toBeVisible();

  await page.reload();
  await clickInspectorTab(page, "逻辑");
  await expect(page.locator(".revealBox")).toContainText("凶手：陆执");
});

test("causal trace node jumps timeline and event selection", async ({ page }) => {
  const badge = page.locator(".timeBadge");
  await expect(badge).toHaveText("08:00");
  await clickInspectorTab(page, "逻辑");
  await page.getByTestId("causal-trace").locator("button").filter({ hasText: "22:05" }).click();
  await expect(badge).toHaveText("22:05");
  await clickInspectorTab(page, "事件");
  await expect(page.locator(".eventRow.selected")).toBeVisible();
});

test("replay advances the 24h timeline", async ({ page }) => {
  const badge = page.locator(".timeBadge");
  await expect(badge).toHaveText("08:00");
  await page.getByRole("button", { name: /Play Replay/ }).click();
  await expect(badge).not.toHaveText("08:00", { timeout: 3_000 });
  await page.getByRole("button", { name: /Pause Replay/ }).click();
});

test("authoring workbench validates, persists, exports and runs a draft", async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem("detective-town-authoring-v1"));
  await page.reload();
  await page.getByTestId("open-authoring").click();
  await expect(page.getByTestId("authoring-workbench")).toBeVisible();
  await expect(page.getByTestId("authoring-rule-report")).toContainText("Pass");

  await page.getByTestId("authoring-title").fill("雾灯镇：作者测试案");
  await page.getByRole("button", { name: "Evidence" }).click();
  await page.getByTestId("authoring-evidence-description").fill("作者测试版证据描述，仍然保持原始逻辑链。");
  await expect(page.getByTestId("authoring-rule-report")).toContainText("Pass");

  await page.reload();
  await page.getByTestId("open-authoring").click();
  await expect(page.getByTestId("authoring-title")).toHaveValue("雾灯镇：作者测试案");

  await page.getByRole("button", { name: "Evidence" }).click();
  await page.getByTestId("delete-authoring-evidence").click();
  await expect(page.getByTestId("authoring-rule-report")).toContainText("Fail");
  await expect(page.locator(".statusBox").last()).toContainText("仍被引用");
  await page.locator(".issueItem.error").first().click();
  await expect(page.getByRole("button", { name: "Evidence", exact: true })).toHaveClass(/active/);
  await expect(page.getByTestId("run-authoring-draft")).toBeDisabled();

  await page.getByRole("button", { name: "Load Premium Template" }).click();
  await expect(page.getByTestId("run-authoring-draft")).toBeEnabled();
  await page.getByRole("button", { name: "Export JSON" }).click();
  await expect(page.getByTestId("authoring-export-text")).toContainText("caseFromLog");

  await page.getByRole("button", { name: "Case" }).click();
  await page.getByTestId("authoring-title").fill("雾灯镇：作者测试案");
  await page.getByTestId("run-authoring-draft").click();
  await expect(page.getByTestId("pixel-map").locator(".mapTile")).toHaveCount(504);
  await expect(page.locator("body")).toContainText("雾灯镇：作者测试案");
});
