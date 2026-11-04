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
  const nextFrame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const comparePixels=async(before,after)=>page.evaluate(async encoded=>{
    const decoded=[];
    for(const value of encoded){
      const bitmap=await createImageBitmap(await(await fetch('data:image/png;base64,'+value)).blob(),{colorSpaceConversion:'none'});
      const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),context=canvas.getContext('2d');
      context.drawImage(bitmap,0,0);decoded.push(context.getImageData(0,0,canvas.width,canvas.height));bitmap.close();
    }
    if(decoded[0].width!==decoded[1].width||decoded[0].height!==decoded[1].height)throw new Error('Mode restore image dimensions differ');
    let maximum=0,total=0,changedPixels=0;
    for(let i=0;i<decoded[0].data.length;i+=4){
      let changed=false;
      for(let c=0;c<3;c++){const delta=Math.abs(decoded[0].data[i+c]-decoded[1].data[i+c]);maximum=Math.max(maximum,delta);total+=delta;changed ||=delta>0;}
      if(changed)changedPixels++;
    }
    return {maximumChannelDifference8bit:maximum,meanChannelDifference8bit:total/(decoded[0].width*decoded[0].height*3),changedPixels,pixels:decoded[0].width*decoded[0].height};
  },[before.toString('base64'),after.toString('base64')]);
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
  await page.screenshot({path: 'outputs/blender-v10-browser-desktop.png'});
  await page.getByRole('combobox', {name: '镜头'}).selectOption('hero-detail');
  const heroCamera = await page.evaluate(() => window.roomReview.camera);
  await page.screenshot({path: 'outputs/blender-v10-browser-hero.png'});
  await page.getByRole('combobox',{name:'镜头'}).selectOption('joinery-detail');
  const joineryCamera=await page.evaluate(()=>window.roomReview.camera);
  const joineryDetail=await benchmark();
  await page.screenshot({path:'outputs/blender-v10-browser-joinery.png'});
  await page.getByRole('combobox', {name: '镜头'}).selectOption('arrival');
  const arrivalCamera = await page.evaluate(() => window.roomReview.camera);
  await page.getByRole('combobox', {name: '镜头'}).selectOption('ceiling');
  const ceilingCamera = await page.evaluate(() => window.roomReview.camera);
  await page.getByRole('combobox', {name: '镜头'}).selectOption('production');
  await page.getByRole('button', {name: '重置视角'}).click();
  const resetCamera = await page.evaluate(() => window.roomReview.camera);
  // Match the authored 1600x900 film gate before comparing lighting methods.
  await page.setViewportSize({width:1600,height:1070});
  await nextFrame();
  const lightingComparison={reference:'renders/production.png',camera:await page.evaluate(()=>window.roomReview.camera),
    canvas:await page.locator('canvas').boundingBox(),bakedMode:await page.evaluate(()=>window.roomReview.lightingMode)};
  await page.locator('canvas').screenshot({path:'outputs/blender-v10-browser-matched-baked.png'});
  await page.getByRole('button',{name:'对比实时布光'}).click();
  await nextFrame();
  lightingComparison.dynamicMode=await page.evaluate(()=>window.roomReview.lightingMode);
  await page.locator('canvas').screenshot({path:'outputs/blender-v10-browser-matched-dynamic.png'});
  await page.getByRole('button',{name:'返回烘焙光照'}).click();
  await page.getByRole('combobox',{name:'镜头'}).selectOption('hero-detail');
  await nextFrame();
  lightingComparison.heroCamera=await page.evaluate(()=>window.roomReview.camera);
  lightingComparison.heroCanvas=await page.locator('canvas').boundingBox();
  await page.locator('canvas').screenshot({path:'outputs/blender-v10-browser-matched-baked-hero.png'});
  await page.getByRole('button',{name:'对比实时布光'}).click();
  await nextFrame();
  await page.locator('canvas').screenshot({path:'outputs/blender-v10-browser-matched-dynamic-hero.png'});
  await page.getByRole('button',{name:'返回烘焙光照'}).click();
  await page.getByRole('combobox',{name:'镜头'}).selectOption('lens-macro');
  await nextFrame();
  lightingComparison.lensCamera=await page.evaluate(()=>window.roomReview.camera);
  lightingComparison.lensCanvas=await page.locator('canvas').boundingBox();
  const lensMacro=await benchmark();
  await page.locator('canvas').screenshot({path:'outputs/blender-v10-browser-matched-baked-lens.png'});
  await page.getByRole('button',{name:'对比实时布光'}).click();
  await nextFrame();
  await page.locator('canvas').screenshot({path:'outputs/blender-v10-browser-matched-dynamic-lens.png'});
  await page.getByRole('button',{name:'返回烘焙光照'}).click();
  await page.getByRole('combobox',{name:'镜头'}).selectOption('production');
  await page.setViewportSize({width:1440,height:960});
  await nextFrame();
  await page.getByRole('button', {name: '查看 Blender 渲染'}).click();
  const comparisonVisible = await page.locator('#offline').isVisible();
  await page.screenshot({path: 'outputs/blender-v10-browser-comparison.png'});
  await page.getByRole('button', {name: '返回实时模型'}).click();
  const comparisonReturned = await page.locator('canvas').isVisible();

  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.setViewportSize({width: 390, height: 844});
  await page.reload();
  await ready();
  const mobileViewport = await benchmark();
  const mobilePickStatus = await clickHero();
  await page.screenshot({path: 'outputs/blender-v10-browser-mobile.png', fullPage: true});
  await page.evaluate(() => window.roomReview.loseContext());
  await page.waitForFunction(() => window.roomReview.contextLost === true);
  const contextLostFallback = {
    visible: await page.locator('#offline').isVisible(),
    status: await page.locator('#status').textContent(),
    metrics: await page.evaluate(() => window.roomReview.readMetrics())
  };
  await page.screenshot({path: 'outputs/blender-v10-browser-fallback.png', fullPage: true});
  const userAgent = await page.evaluate(() => navigator.userAgent);
  // Keep large CPU image decodes after all frame-interval measurements.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1600,height:1070});
  await page.goto(url);await ready();
  const modeRestoration=[];
  for(const camera of ['production','hero-detail','lens-macro','joinery-detail']){
    await page.locator('#camera').selectOption(camera);await nextFrame();
    const before=await page.locator('canvas').screenshot();
    await page.getByRole('button',{name:'对比实时布光'}).click();await nextFrame();
    const dynamic=await page.locator('canvas').screenshot();
    await page.getByRole('button',{name:'返回烘焙光照'}).click();await nextFrame();
    const restored=await page.locator('canvas').screenshot();
    const pixels=await comparePixels(before,restored);
    const measurement={camera,...pixels,comparisonChangesPixels:!before.equals(dynamic)};
    // One code value accommodates raster rounding; material/lighting changes
    // exceed this by orders of magnitude. Inspect every pixel, not a sample.
    measurement.passed=pixels.maximumChannelDifference8bit<=1&&pixels.meanChannelDifference8bit<.001&&measurement.comparisonChangesPixels;
    modeRestoration.push(measurement);
  }
  if(modeRestoration.some(r=>!r.passed))throw new Error('Lighting comparison did not restore the room: '+JSON.stringify(modeRestoration));
  const report = {
    capturedAt: new Date().toISOString(),
    scope: 'isolated local art viewer; headless Chromium on laptop GPU; static scene only',
    measurementOrder:'All frame intervals precede CPU pixel-difference analysis.',
    userAgent, desktop, mobileViewport, lensMacro,joineryDetail,modeRestoration,
    controls: {desktopPickStatus, mobilePickStatus, heroCamera, joineryCamera, arrivalCamera, ceilingCamera, resetCamera, comparisonVisible, comparisonReturned},
    contextLostFallback, lightingComparison, warnings, errors,
    externalRequests: requests.filter(value => !value.startsWith(new URL(url).origin + '/') && !value.startsWith('blob:' + new URL(url).origin + '/') && !value.startsWith('data:image/')),
    limitations: ['390x844 is viewport emulation on the same laptop, not physical phone testing.', 'Frame intervals cover ten seconds of a static scene and exclude the game application.', 'PBR and total diffuse are baked; local static reflections have no parallax correction or moving objects.'],
    humanApproval: false,
    runtimeEligible: false
  };
  if (errors.length || warnings.length || desktop.overflow || mobileViewport.overflow || !comparisonVisible || !comparisonReturned || !contextLostFallback.visible) {
    throw new Error('Browser review failed: ' + JSON.stringify(report));
  }
  await page.setViewportSize({width: 1440, height: 960});
  await page.getByRole('combobox',{name:'镜头'}).selectOption('production');
  return report;
}


