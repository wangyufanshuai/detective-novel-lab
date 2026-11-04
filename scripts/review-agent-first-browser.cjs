async (page) => {
  const must=(value,message)=>{if(!value)throw new Error(message);};
  const errors=[],consoleErrors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  page.on('request',r=>{if(r.url().includes('/api/'))requests.push({path:new URL(r.url()).pathname,method:r.method()});});
  await page.bringToFront();await page.context().clearCookies();
  await page.setViewportSize({width:1280,height:720});
  await page.goto('http://127.0.0.1:3187/town-play/agent-first');
  await page.getByRole('button',{name:'开始河湾手记',exact:true}).click();
  const map=page.locator('[data-agent-map]'),root=page.locator('[data-agent-first]');
  await page.waitForFunction(()=>document.querySelector('[data-agent-first]')?.dataset.worldRevision);
  const position=async()=>JSON.parse(await map.getAttribute('data-position'));
  const rev=async()=>Number(await root.getAttribute('data-world-revision'));
  const revision=await rev(),before=await position();
  await page.getByRole('button',{name:'5 地图',exact:true}).click();
  await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');
  must(JSON.stringify(before)===JSON.stringify(await position()),'Map dialog failed to pause movement');
  for(let i=0;i<8;i++)await page.keyboard.press('Tab');
  must(await page.evaluate(()=>document.querySelector('[role="dialog"]').contains(document.activeElement)),'Focus escaped dialog');
  await page.getByRole('button',{name:'旧书店 旧地图与尚未装订完的书页。',exact:true}).click();
  await page.getByRole('button',{name:'E 到访旧书店',exact:true}).waitFor({timeout:15000});
  must(await rev()===revision,'Visual walking wrote world state');
  const arrivedAtDoor=await position();await page.keyboard.press('e');
  await page.getByRole('button',{name:'E 回到街道',exact:true}).waitFor();
  must(await rev()===revision+1,'Arrival did not commit exactly once');
  await page.screenshot({path:'output/playwright/agent-first-interior.png'});
  await page.keyboard.press('e');
  await page.getByRole('button',{name:'1 观察',exact:true}).click();
  await page.getByRole('button',{name:/许知微.*旧书修复师/}).click();
  must(await page.getByText('亲眼所见',{exact:true}).count()===1,'Resident not grounded in same-place observation');
  await page.getByRole('button',{name:'记入笔记',exact:true}).click();
  await page.screenshot({path:'output/playwright/agent-first-resident.png'});
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'6 案件本',exact:true}).click();
  must(await page.getByText(/许知微 · 亲眼见于/).count()===1,'Recorded observation missing');
  await page.screenshot({path:'output/playwright/agent-first-notebook.png'});
  await page.keyboard.press('Escape');await page.reload();
  await page.getByRole('button',{name:'E 到访旧书店',exact:true}).waitFor();
  await page.getByRole('button',{name:'6 案件本',exact:true}).click();
  must(await page.getByText(/许知微 · 亲眼见于/).count()===1,'Device note lost after reload');
  await page.keyboard.press('Escape');
  // Exercise ambiguous success: the server commits, but the response is lost.
  const endpoint='**/api/v1/town-play/agent-first';let intercepted=false;
  await page.route(endpoint,async route=>{
    if(!intercepted&&route.request().method()==='POST'&&route.request().postDataJSON()?.kind==='commit'){
      intercepted=true;await route.fetch();await route.abort('failed');
    }else await route.continue();
  });
  const retryBefore=await rev();
  await page.getByRole('button',{name:'等一刻钟',exact:true}).click();
  await page.getByRole('button',{name:'重连并确认行动',exact:true}).waitFor();
  await page.unroute(endpoint);
  await page.getByRole('button',{name:'重连并确认行动',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'行动尚未确认'}).waitFor({state:'hidden'});
  await page.waitForFunction(n=>Number(document.querySelector('[data-agent-first]').dataset.worldRevision)===n,retryBefore+1);
  must(intercepted&&await rev()===retryBefore+1,'Lost response caused duplicate advance');
  must(await page.locator('header strong').textContent()==='08:20','Retry changed time twice');
  await page.getByRole('button',{name:'等一刻钟',exact:true}).waitFor({state:'visible'});
  await page.screenshot({path:'output/playwright/agent-first-desktop-final.png'});
  const desktop=JSON.parse(await map.getAttribute('data-metrics'));
  must(errors.length===0,JSON.stringify(errors));
  must(requests.every(r=>r.path==='/api/v1/town-play/agent-first'),'Unexpected API used');
  return {passed:true,dialogMovementPaused:true,dialogFocusTrapped:true,localWalkingWrites:0,arrivedAtDoor,
    arrivalCommits:1,interiorEnteredAndExited:true,observedResident:'许知微',noteRestored:true,
    lostCommitResponseRetriedExactlyOnce:true,time:'08:20',revision:await rev(),desktop,
    pageErrors:errors,consoleErrors,expectedNetworkAbort:true,requests};
}
