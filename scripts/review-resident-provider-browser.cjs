async(page)=>{
  const must=(value,message)=>{if(!value)throw Error(message);};
  const pageErrors=[],consoleErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.context().clearCookies();await page.setViewportSize({width:1280,height:720});
  await page.goto('http://127.0.0.1:3187/town-play/agent-first');
  await page.getByRole('button',{name:'开始河湾手记',exact:true}).click();
  await page.getByRole('button',{name:'人物观察',exact:true}).click();
  await page.getByRole('button',{name:'启用三日生活',exact:true}).click();
  await page.getByText(/三日生活已启用/).waitFor();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'等一刻钟',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('header strong')?.textContent==='08:15');
  const read=()=>page.evaluate(async()=>{const r=await fetch('/api/v1/town-play/agent-first',{cache:'no-store'});if(!r.ok)throw Error('Observation unavailable');return(await r.json()).data.observation;});
  const first=await read();must(first.life.modelAttemptsReserved===0&&first.simulation.modelCalls===0,'Public visitor initiated a provider attempt');
  must(first.residents.some(p=>p.visibility==='observed'&&p.activity),'No visible real resident activity');
  must(!('providerBudget' in first)&&!JSON.stringify(first).includes('pendingChoices'),'Private provider state leaked');
  await page.reload();await page.getByRole('button',{name:'人物观察',exact:true}).click();
  await page.getByText(/三日生活已启用/).waitFor();
  const second=await read();must(second.worldRevision===first.worldRevision&&second.time==='08:15','Reload altered the clock');
  must(second.life.modelAttemptsReserved===0,'Reload reserved model budget');
  await page.screenshot({path:'output/playwright/resident-provider-v4-panel.png'});
  must(pageErrors.length===0&&consoleErrors.length===0,JSON.stringify({pageErrors,consoleErrors}));
  return {passed:true,explicitOptIn:true,clock:'08:15',reloadReadOnly:true,reservedModelAttempts:0,visibleActivity:true,pageErrors,consoleErrors,
    scope:'Local Windows Chromium, 1280x720, public rules-only path. No live model, physical device, or human acceptance.'};
}
