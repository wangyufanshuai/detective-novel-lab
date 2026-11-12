import { expect, test, type Page } from "@playwright/test";

/*
 * /town-play critical path. Each Playwright context gets its own cookie, so
 * every test plays a fresh notebook and never touches a real save.
 *
 * Walking the 3D character to each door is too slow under software WebGL, so
 * world moves (arrive / search / question / challenge) go through the same
 * /api/v1/town-play endpoint the page uses, from inside the page. The UI is
 * then reloaded and checked; panels, signs, forms and keys are driven for real.
 */

type Action = Record<string, unknown> & { kind: string };
type View = { revision: number; worldRevision: number; time: string; investigation: null | { solved: boolean; message?: string; clues: Array<{ id: string; title: string }>; leads: Array<{ sceneId: string; open: number }> } };

async function act(page: Page, action: Action): Promise<View> {
  return page.evaluate(async action => {
    const read = await fetch("/api/v1/town-play").then(r => r.json());
    const view = read.data.view;
    const response = await fetch("/api/v1/town-play", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...action, actionId: crypto.randomUUID(), expectedSessionRevision: view.revision, expectedWorldRevision: view.worldRevision })
    });
    const body = await response.json();
    if (!body.ok) throw new Error(`${action.kind} refused: ${JSON.stringify(body.error ?? body)}`);
    return body.data.view;
  }, action);
}

async function openTown(page: Page) {
  await page.goto("/town-play");
  await expect(page.locator("main[data-ready='true']")).toBeVisible({ timeout: 120_000 });
}

async function startNotebook(page: Page) {
  await openTown(page);
  await page.getByRole("button", { name: "开始河湾手记" }).click();
  await expect(page.locator("main[data-world-state='ready']")).toBeVisible({ timeout: 30_000 });
}

async function reloadTown(page: Page) {
  await page.reload();
  await expect(page.locator("main[data-ready='true'][data-world-state='ready']")).toBeVisible({ timeout: 120_000 });
}

const dialog = (page: Page) => page.locator("dialog[open]");

test.describe("town-play", () => {
  test.describe.configure({ timeout: 240_000 });

  test("fresh notebook: HUD, overview signs, journal and help", async ({ page }) => {
    await startNotebook(page);
    const main = page.locator("main");

    await expect(page.getByLabel("小镇时间")).toContainText("第 1 天");
    await expect(page.getByLabel("随身工具栏").getByRole("button")).toHaveCount(8);
    await expect(main).toContainText("旧桥原图不见了");

    // Overview: one clickable sign per destination; a sign marks the place.
    await page.getByRole("button", { name: /^2\s*地图$/ }).click();
    await expect(main).toHaveAttribute("data-view", "overview");
    const signs = page.locator("button[aria-label^='标记']:visible");
    await expect(signs).toHaveCount(6);
    await page.getByRole("button", { name: /^标记旧书店/ }).click();
    await expect(main).toHaveAttribute("data-view", "explore");
    await expect(main).toContainText("前往 旧书店");
    await page.getByRole("button", { name: "清除地点标记" }).click();
    await expect(main).not.toContainText("前往 旧书店");

    // Journal by key, closed by Escape.
    await page.keyboard.press("j");
    await expect(dialog(page)).toContainText("河湾手记");
    await expect(dialog(page)).toContainText("尚未探访");
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);

    await page.getByRole("button", { name: "探索帮助" }).click();
    await expect(dialog(page)).toContainText("如何探索河湾");
    await dialog(page).getByRole("button", { name: "关闭窗口" }).click();
    await expect(dialog(page)).toHaveCount(0);
  });

  test("case path: open, search, question, board, wrong theory, solve", async ({ page }, testInfo) => {
    await startNotebook(page);

    let view = await act(page, { kind: "arrive", sceneId: "books" });
    view = await act(page, { kind: "case-open" });
    expect(view.investigation?.leads.reduce((sum, lead) => sum + lead.open, 0)).toBe(8);
    for (const targetId of ["rb-search-1", "rb-search-2", "rb-search-8"]) await act(page, { kind: "case-search", targetId });
    await act(page, { kind: "case-question", characterId: "rb-xu-zhiwei" });
    view = await act(page, { kind: "case-challenge", characterId: "rb-xu-zhiwei", evidenceId: "rb-clue-02" });
    expect(view.investigation?.clues).toHaveLength(3);

    await reloadTown(page);
    const tracker = page.getByLabel("案件进度");
    await expect(tracker).toContainText("第七分钟");
    // Narrow screens start with the tracker folded.
    const fold = tracker.locator("button[aria-expanded]").first();
    if (await fold.getAttribute("aria-expanded") === "false") await fold.click();
    // Five unchecked items remain, spread across the other places.
    await expect(tracker).toContainText("处地点有未核对的物品");

    // Case book by key: clues tab counts what was found.
    await page.keyboard.press("k");
    const book = dialog(page).getByLabel("案件本");
    await expect(book.getByRole("button", { name: "物证 3/8" })).toBeVisible();
    await book.getByRole("button", { name: /^证词/ }).click();
    await expect(book).toContainText("许知微");
    await page.keyboard.press("Escape");

    // Board by key: the questioned suspect has a card, and on wide screens a string.
    await page.keyboard.press("b");
    await expect(dialog(page)).toContainText("案件看板");
    const person = dialog(page).locator("[data-board-person='rb-xu-zhiwei']");
    await expect(person).toBeVisible();
    if (testInfo.project.name.includes("desktop")) await expect(dialog(page).locator("svg path")).not.toHaveCount(0);
    await person.click();
    await expect(person).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");

    // Finish the search round and the decisive challenges through the API.
    for (const [sceneId, targetId] of [["cafe", "rb-search-3"], ["police", "rb-search-4"], ["post", "rb-search-5"], ["inn", "rb-search-6"], ["station", "rb-search-7"]]) {
      await act(page, { kind: "arrive", sceneId });
      view = await act(page, { kind: "case-search", targetId });
    }
    expect(view.investigation?.clues).toHaveLength(8);
    expect(view.investigation?.leads).toEqual([]);
    await act(page, { kind: "arrive", sceneId: "books" });
    await act(page, { kind: "case-challenge", characterId: "rb-xu-zhiwei", evidenceId: "rb-clue-07" });
    await act(page, { kind: "arrive", sceneId: "cafe" });
    // A witness must be heard out before evidence is shown to them.
    await act(page, { kind: "case-question", characterId: "rb-song-tang" });
    view = await act(page, { kind: "case-challenge", characterId: "rb-song-tang", evidenceId: "rb-clue-04" });
    const titles = Object.fromEntries(view.investigation!.clues.map(clue => [clue.id, clue.title]));

    await reloadTown(page);
    await page.keyboard.press("k");
    const form = dialog(page).getByLabel("案件本");
    await form.getByRole("button", { name: "整理推断" }).click();

    // A wrong person is refused without revealing the answer.
    await form.getByLabel("谁移走了原图").selectOption("rb-zhou-yan");
    await form.getByRole("button", { name: "引用已取得的全部材料" }).click();
    await form.getByRole("button", { name: /提交这份结论/ }).click();
    await expect(form.getByRole("status")).toBeVisible();
    await expect(form.getByRole("button", { name: "案件归档", exact: true })).toHaveCount(0);

    // The supported theory closes the case.
    await form.getByLabel("谁移走了原图").selectOption("rb-xu-zhiwei");
    const group = (legend: string) => form.locator("fieldset", { has: page.locator("legend", { hasText: legend }) });
    await group("哪些物证解释动机").getByLabel(titles["rb-clue-02"], { exact: true }).check();
    await group("哪些物证证明使用的手法").getByLabel(titles["rb-clue-01"], { exact: true }).check();
    await group("哪些物证证明使用的手法").getByLabel(titles["rb-clue-07"], { exact: true }).check();
    await form.getByRole("button", { name: /提交这份结论/ }).click();
    // The verdict moment: a stamped dossier over the case book.
    const finale = page.getByRole("dialog", { name: "许知微移走了原图" });
    await expect(finale).toBeVisible({ timeout: 15_000 });
    await expect(finale).toContainText("结案");
    await expect(finale).toContainText("新委托 · 第二宗");
    await finale.getByRole("button", { name: "读完整的经过 →" }).click();
    await expect(finale).toHaveCount(0);
    await expect(form.getByRole("button", { name: "案件归档", exact: true })).toBeVisible();
    await expect(form).toContainText("许知微移走了原图");
    await page.keyboard.press("Escape");

    // Case two is offered once case one closes, and opens at its own places.
    const tracker2 = page.getByLabel("案件进度");
    await expect(tracker2).toContainText("新委托 · 第二宗");
    await expect(tracker2).toContainText("旅馆的募捐箱被撬了");
    await act(page, { kind: "arrive", sceneId: "inn" });
    view = await act(page, { kind: "case-open" });
    expect(view.investigation?.solved).toBe(false);
    await reloadTown(page);
    await expect(page.getByLabel("案件进度")).toContainText("借来的凿子");
    await page.keyboard.press("k");
    const book2 = dialog(page).getByLabel("案件本");
    await expect(book2).toContainText("河湾 · 第二宗");
    await book2.getByRole("button", { name: "整理推断" }).click();
    await expect(book2.getByLabel("谁撬开了募捐箱")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("j");
    await expect(dialog(page).getByLabel("已归档的案件")).toContainText("第七分钟");
    await expect(dialog(page).getByLabel("已归档的案件")).toContainText("许知微");
  });
});
