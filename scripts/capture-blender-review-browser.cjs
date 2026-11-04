async (page) => {
  const url = page.url();
  if (new URL(url).hostname !== '127.0.0.1') throw new Error('Open the local Blender review server before capture.');
  const warnings = [], errors = [], requests = [];
  page.on('console', message => {
    if (message.type() === 'warning') warnings.push(message.text());
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('request', request => requests.push(request.url()));
  const ready = async () => page.waitForFunction(() => window.roomReview?.ready === true);
  const benchmark = async () => {
    await page.evaluate(() => window.roomReview.resetMetrics());
    await page.waitForFunction(() => window.roomReview.frameTimes.reduce((a, b) => a + b, 0) >= 10000, null, {timeout: 30000});
    return page.evaluate(() => window.roomReview.readMetrics());
  };
  const clickHero = async () => {
    const probe = await page.evaluate(() => window.roomReview.probeHero());
    const box = await page.locator('canvas').boundingBox();
    if (!box || !probe.name?.includes('hero-evidence-table')) throw new Error('Hero is not pickable from the production camera.');
    await page.mouse.click(box.x + (probe.ndc[0] + 1) * box.width / 2, box.y + (1 - probe.ndc[1]) * box.height / 2);
    return page.locator('#status').textContent();
  };

  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.setViewportSize({width: 1440, height: 960});
  await page.goto(url);
  await ready();
  const desktop = await benchmark();
  const desktopPickStatus = await clickHero();
  await page.screenshot({path: 'outputs/blender-v3-browser-desktop.png'});
  await page.getByRole('combobox', {name: '镜头'}).selectOption('arrival');
  const arrivalCamera = await page.evaluate(() => window.roomReview.camera);
  await page.getByRole('combobox', {name: '镜头'}).selectOption('ceiling');
  const ceilingCamera = await page.evaluate(() => window.roomReview.camera);
  await page.getByRole('combobox', {name: '镜头'}).selectOption('production');
  await page.getByRole('button', {name: '重置视角'}).click();
  const resetCamera = await page.evaluate(() => window.roomReview.camera);
  await page.getByRole('button', {name: '查看 Blender 渲染'}).click();
  const comparisonVisible = await page.locator('#offline').isVisible();
  await page.screenshot({path: 'outputs/blender-v3-browser-comparison.png'});
  await page.getByRole('button', {name: '返回实时模型'}).click();
  const comparisonReturned = await page.locator('canvas').isVisible();

  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.setViewportSize({width: 390, height: 844});
  await page.reload();
  await ready();
  const mobileViewport = await benchmark();
  const mobilePickStatus = await clickHero();
  await page.screenshot({path: 'outputs/blender-v3-browser-mobile.png', fullPage: true});
  await page.evaluate(() => window.roomReview.loseContext());
  await page.waitForFunction(() => window.roomReview.contextLost === true);
  const contextLostFallback = {
    visible: await page.locator('#offline').isVisible(),
    status: await page.locator('#status').textContent(),
    metrics: await page.evaluate(() => window.roomReview.readMetrics())
  };
  await page.screenshot({path: 'outputs/blender-v3-browser-fallback.png', fullPage: true});
  const userAgent = await page.evaluate(() => navigator.userAgent);
  const report = {
    capturedAt: new Date().toISOString(),
    scope: 'isolated local art viewer; headless Chromium on laptop GPU; static scene only',
    userAgent, desktop, mobileViewport,
    controls: {desktopPickStatus, mobilePickStatus, arrivalCamera, ceilingCamera, resetCamera, comparisonVisible, comparisonReturned},
    contextLostFallback, warnings, errors,
    externalRequests: requests.filter(value => !value.startsWith(new URL(url).origin + '/')),
    limitations: ['390x844 is viewport emulation on the same laptop, not physical phone testing.', 'Frame intervals cover ten seconds of a static scene and exclude the game application.', 'Procedural materials and offline lighting have not been baked into this GLB.'],
    humanApproval: false,
    runtimeEligible: false
  };
  if (errors.length || warnings.length || desktop.overflow || mobileViewport.overflow || !comparisonVisible || !comparisonReturned || !contextLostFallback.visible) {
    throw new Error('Browser review failed: ' + JSON.stringify(report));
  }
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.setViewportSize({width: 1440, height: 960});
  await page.goto(url);
  await ready();
  return report;
}
