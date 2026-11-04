async (page) => {
  await page.waitForFunction(()=>window.roomReview?.ready===true);
  await page.setViewportSize({width:1600,height:1070});
  await page.locator('#camera').selectOption('hero-detail');
  const results=[];
  for(const mode of ['baked','no-normal','no-specular','raw-light','dynamic','albedo']){
    await page.evaluate(mode=>window.roomReview.diagnostic.mode(mode),mode);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const file=`outputs/blender-shading-${mode}.png`;
    await page.locator('canvas').screenshot({path:file});
    results.push({mode,file});
  }
  return {scope:'read-only v5 material diagnostic; not performance or acceptance',results,errors:await page.evaluate(()=>window.roomReview.errors)};
}
