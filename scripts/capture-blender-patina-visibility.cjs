async(page)=>{
  await page.reload();await page.waitForFunction(()=>window.roomReview?.ready===true);
  await page.setViewportSize({width:1600,height:1070});const captures=[];
  for(const camera of ['production','hero-detail','lens-macro','joinery-detail','paper-detail']){
    await page.locator('#camera').selectOption(camera);
    for(const enabled of [true,false]){
      await page.evaluate(enabled=>window.roomReview.setAreaVisibilityEnabled(enabled),enabled);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const file=`outputs/blender-v11-${camera}-visibility-${enabled?'on':'off'}.png`;
      await page.locator('canvas').screenshot({path:file});captures.push({camera,enabled,file});
    }
  }
  const report=await page.evaluate(()=>({assetSha256:window.roomReview.assetSha256,visibility:window.roomReview.staticAreaVisibility,errors:window.roomReview.errors}));
  await page.reload();await page.waitForFunction(()=>window.roomReview?.ready===true);
  return {scope:'same authored camera, identical full direct specular; only static visibility maps change',...report,captures};
}
