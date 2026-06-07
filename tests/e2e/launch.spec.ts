import { expect, test, type Page } from "@playwright/test";

async function clickMapLocation(page: Page, title: string) {
  await page.locator(`.mapTile[title="${title}"]`).evaluate((element) => (element as HTMLElement).click());
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
  await expect(page.locator(".actorPin")).toHaveCount(8);
  await expect(page.getByTestId("deduction-graph").locator('[data-node-type="evidence"].locked').first()).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
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
  await expect(page.getByTestId("deduction-graph").locator('[data-node-type="evidence"].unlocked').first()).toBeVisible();

  await page.getByRole("button", { name: "询问 NPC" }).click();
  await expect(page.locator(".aiSafetyStrip").getByText("Prompt Safe: Yes")).toBeVisible();

  await page.locator('select').filter({ has: page.locator('option[value="npc-06"]') }).last().selectOption("npc-06");
  await page.getByPlaceholder("动机").fill("林澈告诉陆执，明早会公开旧剧院修缮款原始票据。");
  await page.getByPlaceholder("手法").fill("陆执在镇档案馆用舞台配重锤击杀林澈，再伪装成灯架坠落事故。");
  for (const checkbox of await page.locator(".checkRow input").all()) await checkbox.check();
  await page.getByRole("button", { name: "判定推理" }).click();
  await expect(page.getByText("推理成立", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "生成解答篇" }).click();
  await expect(page.locator(".revealBox")).toContainText("凶手：陆执");
  await expect(page.getByTestId("deduction-graph").locator('[data-node-type="conclusion"]')).toBeVisible();

  await page.reload();
  await expect(page.locator(".revealBox")).toContainText("凶手：陆执");
});

test("replay advances the 24h timeline", async ({ page }) => {
  const badge = page.locator(".timeBadge");
  await expect(badge).toHaveText("08:00");
  await page.getByRole("button", { name: /Play Replay/ }).click();
  await expect(badge).not.toHaveText("08:00", { timeout: 3_000 });
  await page.getByRole("button", { name: /Pause Replay/ }).click();
});
