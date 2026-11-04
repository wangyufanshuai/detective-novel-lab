async page => {
  // Preserve complete unmodified PNGs for every bounded comparison, including failures.
  const compare=async(a,b)=>page.evaluate(async values=>{
    const frames=[];
    for(const value of values){
      const bitmap=await createImageBitmap(await(await fetch('data:image/png;base64,'+value)).blob(),{colorSpaceConversion:'none'});
      const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');
      ctx.drawImage(bitmap,0,0);frames.push(ctx.getImageData(0,0,canvas.width,canvas.height));bitmap.close();
    }
    let maximum=0,total=0,count=0,minX=1600,minY=900,maxX=-1,maxY=-1,peak=null;
    for(let i=0;i<frames[0].data.length;i+=4){
      let changed=false;
      for(let c=0;c<3;c++){
        const d=Math.abs(frames[0].data[i+c]-frames[1].data[i+c]);total+=d;changed ||=d>0;
        if(d>maximum){maximum=d;peak={x:i/4%1600,y:Math.floor(i/4/1600),channel:c,a:frames[0].data[i+c],b:frames[1].data[i+c]};}
      }
      if(changed){count++;const x=i/4%1600,y=Math.floor(i/4/1600);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
    }
    return {maximum,mean:total/(1600*900*3),changedPixels:count,bounds:count?[minX,minY,maxX,maxY]:null,peak};
  },[a.toString('base64'),b.toString('base64')]);
  const nextFrame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const results=[];
  await page.setViewportSize({width:1600,height:1070});
  for(const phase of ['current','reload']){
    if(phase==='reload'){await page.reload();await page.waitForFunction(()=>window.roomReview?.ready===true);}
    for(const camera of (phase==='current'?['paper-detail','paper-detail']:['production','hero-detail','lens-macro','joinery-detail','paper-detail'])){
      await page.locator('#camera').selectOption(camera);await nextFrame();
      const id=results.length,prefix=`outputs/blender-v11-mode-${phase}-${id}-${camera}`;
      const before=await page.locator('canvas').screenshot({path:prefix+'-before.png'});
      const stationary=await page.locator('canvas').screenshot({path:prefix+'-stationary.png'});
      await page.evaluate(()=>window.roomReview.setLightingMode('dynamic'));await nextFrame();
      await page.locator('canvas').screenshot({path:prefix+'-dynamic.png'});
      await page.evaluate(()=>window.roomReview.setLightingMode('baked'));await nextFrame();
      const after=await page.locator('canvas').screenshot({path:prefix+'-after.png'});
      const later=await page.locator('canvas').screenshot({path:prefix+'-later.png'});
      results.push({phase,camera,prefix,stationary:await compare(before,stationary),restored:await compare(before,after),later:await compare(after,later)});
    }
  }
  return {assetSha256:await page.evaluate(()=>window.roomReview.assetSha256),results};
}
