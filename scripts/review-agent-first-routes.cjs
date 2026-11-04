async(page)=>{
  const must=(v,m)=>{if(!v)throw Error(m);},errors=[],consoleErrors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.bringToFront();await page.setViewportSize({width:1280,height:720});await page.reload();
  await page.locator('[data-agent-first][data-world-revision]').waitFor();
  const rev=async()=>Number(await page.locator('[data-agent-first]').getAttribute('data-world-revision'));
  const routes=[];
  for(const [id,label,name]of[
    ['station','河湾车站 站员在核对早班列车的记录。','河湾车站'],
    ['cafe','河湾咖啡馆 等第一壶咖啡的人已经来了。','河湾咖啡馆'],
    ['town-square','河湾广场 街坊们在这里碰面。','广场']]){
    const before=await rev();await page.getByRole('button',{name:'5 地图',exact:true}).click();
    await page.getByRole('button',{name:label,exact:true}).click();
    const button=page.getByRole('button',{name:id==='town-square'?'E 观察广场':`E 到访${name}`,exact:true});
    await button.waitFor({timeout:15000});must(await rev()===before,'Route wrote world before arrival');
    await button.click();await page.waitForFunction(n=>Number(document.querySelector('[data-agent-first]').dataset.worldRevision)===n,before+1);
    if(id!=='town-square')await page.getByRole('button',{name:'E 回到街道',exact:true}).click();
    routes.push({place:id,arrivalCommits:1});
  }
  await page.waitForTimeout(800);
  const map=page.locator('[data-agent-map]'),beforePoint=JSON.parse(await map.getAttribute('data-position')),beforeClick=await rev();
  await map.click({position:{x:850,y:400}});await page.waitForTimeout(1100);
  const afterPoint=JSON.parse(await map.getAttribute('data-position'));
  must(Math.hypot(afterPoint.x-beforePoint.x,afterPoint.y-beforePoint.y)>70,'Ground pointer route failed');
  must(await rev()===beforeClick,'Ground pointer route wrote world');
  const finalRevision=await rev();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-agent-map]').dataset.metrics).samples===600);
  await page.screenshot({path:'output/playwright/agent-first-desktop-final.png'});
  must(errors.length===0&&consoleErrors.length===0,JSON.stringify({errors,consoleErrors}));
  return {passed:true,additionalRoutes:routes,allFivePlacesVisitedAcrossScripts:true,groundPointerRoute:true,
    nativeVisibility:{status:'pending',reason:'This CLI session keeps document.hidden=false even after focus emulation is disabled and its window is minimized. No synthetic visibility override was substituted.'},
    revision:finalRevision,pageErrors:errors,consoleErrors};
}
