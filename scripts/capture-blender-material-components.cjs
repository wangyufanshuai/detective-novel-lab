async(page)=>{
  await page.reload();await page.waitForFunction(()=>window.roomReview?.ready===true);
  await page.setViewportSize({width:1600,height:1070});await page.locator('#camera').selectOption('lens-macro');
  const captures=[];
  for(const mode of ['baked','albedo','lightmap','geometry-normal']){
    await page.evaluate(mode=>{
      const {THREE,loaded,materials}=window.roomReview.diagnostic;
      const material=materials.find(m=>m.name==='Room Baked PBR');
      let replacement=material;
      if(mode==='albedo')replacement=new THREE.MeshBasicMaterial({map:material.map});
      if(mode==='lightmap')replacement=new THREE.MeshBasicMaterial({map:material.lightMap,color:0xffffff});
      if(mode==='geometry-normal')replacement=new THREE.MeshNormalMaterial();
      loaded.traverse(obj=>{if(obj.isMesh&&(obj.material.name==='Room Baked PBR'||obj.userData.probeOriginal)){
        obj.userData.probeOriginal=material;obj.material=replacement;
      }});
      window.roomReview.diagnostic.draw();
    },mode);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const file=`outputs/blender-v8-grip-${mode}.png`;
    await page.locator('canvas').screenshot({path:file});captures.push({mode,file});
  }
  const assetSha256=await page.evaluate(()=>window.roomReview.assetSha256);
  await page.reload();await page.waitForFunction(()=>window.roomReview?.ready===true);
  return {scope:'v8 actual GLB material diagnosis; no asset mutation',assetSha256,captures};
}
