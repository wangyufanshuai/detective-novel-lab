async(page)=>{
  const must=(value,message)=>{if(!value)throw Error(message);};
  const pageErrors=[],consoleErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.context().clearCookies();await page.setViewportSize({width:1280,height:800});
  await page.goto('http://127.0.0.1:3187/town-play/agent-first');
  await page.getByRole('button',{name:'开始河湾手记',exact:true}).click();
  await page.getByRole('button',{name:'人物观察',exact:true}).click();
  await page.getByRole('button',{name:'启用三日生活',exact:true}).click();await page.getByText(/三日生活已启用/).waitFor();
  const schedule=page.getByRole('button',{name:'按日程生活',exact:true}),goals=page.getByRole('button',{name:'按目标安排',exact:true});
  must(await schedule.getAttribute('aria-pressed')==='true','Existing default schedule changed');
  await goals.click();await page.waitForFunction(()=>document.querySelector('[aria-label="生活安排"] button:last-child')?.getAttribute('aria-pressed')==='true');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'等一刻钟',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('header strong')?.textContent==='08:15');
  const read=()=>page.evaluate(async()=>{const r=await fetch('/api/v1/town-play/agent-first',{cache:'no-store'});if(!r.ok)throw Error('Observation unavailable');return(await r.json()).data.observation;});
  const first=await read();must(first.life.plannerMode==='offline-agent'&&first.life.modelAttemptsReserved===0&&first.simulation.modelCalls===0,'Goal mode started a model attempt');
  must(first.residents.some(p=>p.visibility==='observed'&&p.activity),'Missing actual resident activity');
  must(!JSON.stringify(first).includes('commitmentId')&&!JSON.stringify(first).includes('credits'),'Private goal state leaked');
  await page.reload();await page.getByRole('button',{name:'人物观察',exact:true}).click();await page.getByRole('group',{name:'生活安排'}).waitFor();
  const reloaded=await read();must(reloaded.time==='08:15'&&reloaded.worldRevision===first.worldRevision&&reloaded.life.plannerMode==='offline-agent','Reload lost mode or changed clock');
  must(await goals.getAttribute('aria-pressed')==='true','Mode not selected after reload');
  await goals.scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/resident-agenda-v5-desktop.png'});
  await page.setViewportSize({width:390,height:844});await goals.scrollIntoViewIfNeeded();
  must(await page.evaluate(()=>document.documentElement.scrollWidth===390),'Narrow overflow');
  const group=await page.getByRole('group',{name:'生活安排'}).boundingBox();must(group&&group.width<=390&&group.x>=0,'Mode controls overflow');
  await page.screenshot({path:'output/playwright/resident-agenda-v5-narrow.png'});
  await schedule.click();await page.waitForFunction(()=>document.querySelector('[aria-label="生活安排"] button:first-child')?.getAttribute('aria-pressed')==='true');
  const final=await read();must(final.time==='08:15'&&final.life.plannerMode==='rules'&&final.life.modelAttemptsReserved===0,'Switch changed clock or failed');
  must(pageErrors.length===0&&consoleErrors.length===0,JSON.stringify({pageErrors,consoleErrors}));
  return {passed:true,defaultRules:true,modeSwitch:true,goalModeClock:'08:15',reloadPreservesMode:true,switchBackWithoutTick:true,reservedModelAttempts:0,widths:[1280,390],pageErrors,consoleErrors,
    scope:'Local Windows Chromium; 390px resized viewport, not a physical phone. Deterministic goal mode, no live model or human approval.'};
}
