async(page)=>{
  const must=(value,message)=>{if(!value)throw Error(message);};const pageErrors=[],consoleErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.context().clearCookies();await page.setViewportSize({width:1280,height:800});
  await page.goto('http://127.0.0.1:3187/town-play/agent-first');await page.getByRole('button',{name:'开始河湾手记',exact:true}).click();
  await page.getByRole('button',{name:'人物观察',exact:true}).click();await page.getByRole('button',{name:'启用三日生活',exact:true}).click();
  await page.getByRole('button',{name:'按目标安排',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[aria-label="生活安排"] button:last-child')?.getAttribute('aria-pressed')==='true');
  await page.keyboard.press('Escape');
  // Use only the ordinary owned visitor command surface. No world/appointment
  // admin reads, scenario injection, resident teleports or fixture saves.
  const act=action=>page.evaluate(async action=>{
    const endpoint='/api/v1/town-play/agent-first';const current=(await(await fetch(endpoint,{cache:'no-store'})).json()).data.observation;
    const intent={schema:'agent-first-intent.v1',actionId:crypto.randomUUID(),expectedSessionRevision:current.revision,expectedWorldRevision:current.worldRevision,reason:'Browser visitor observes cafe life',sourceRefs:[current.sourceRef],action};
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'commit',intent})});const result=await response.json();
    if(!response.ok||!result.ok)throw Error(JSON.stringify(result.error));return result.data.observation;
  },action);
  let observation=await act({kind:'arrive',sceneId:'cafe'}),waiting=null,meeting=null;
  for(let i=0;i<120;i++){
    must(observation.life.modelAttemptsReserved===0,'Visitor called a model');
    must(!JSON.stringify(observation).includes('sourceEventIds')&&!JSON.stringify(observation).includes('lastProposalDay'),'Private appointment ledger leaked');
    const seen=observation.residents.filter(p=>p.visibility==='observed');
    const w=seen.find(p=>p.activity==='等候街坊赴约'),m=seen.find(p=>p.activity==='赴约交谈');
    if(w&&!waiting)waiting={name:w.name,day:observation.day,time:observation.time};
    if(m){meeting={name:m.name,day:observation.day,time:observation.time};break;}
    observation=await act({kind:'wait',minutes:15});
  }
  must(meeting,'No naturally generated appointment meeting was witnessed within 30 game hours');
  await page.reload();await page.getByRole('button',{name:'人物观察',exact:true}).click();
  const visible=observation.residents.find(p=>p.visibility==='observed'&&p.activity==='赴约交谈');
  await page.getByRole('button',{name:new RegExp(visible.name+'.*'+visible.role)}).click();
  must((await page.locator('article').innerText()).includes('赴约交谈'),'Actual meeting not rendered in player UI');
  await page.locator('article').scrollIntoViewIfNeeded();
  await page.screenshot({path:'output/playwright/resident-appointments-v6-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.locator('article').scrollIntoViewIfNeeded();
  must(await page.evaluate(()=>document.documentElement.scrollWidth===390),'Narrow overflow');await page.screenshot({path:'output/playwright/resident-appointments-v6-narrow.png'});
  must(pageErrors.length===0&&consoleErrors.length===0,JSON.stringify({pageErrors,consoleErrors}));
  return{passed:true,naturalNewSave:true,ordinaryVisitorCommands:true,waiting,meeting,actualActivityRendered:true,reservedModelAttempts:0,widths:[1280,390],pageErrors,consoleErrors,
    scope:'Local Windows Chromium, public observations only. Narrow viewport is not a physical phone; no live model or human acceptance.'};
}
