async(page)=>{
  const must=(v,m)=>{if(!v)throw Error(m);},errors=[],consoleErrors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.bringToFront();await page.context().clearCookies();await page.setViewportSize({width:1280,height:720});
  await page.goto('http://127.0.0.1:3187/town-play/agent-first');await page.getByRole('button',{name:'开始河湾手记',exact:true}).click();
  await page.getByRole('button',{name:'人物观察',exact:true}).click();await page.getByRole('button',{name:'启用三日生活',exact:true}).click();
  await page.getByText(/三日生活已启用/).waitFor();await page.keyboard.press('Escape');await page.getByRole('button',{name:'等一刻钟',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-agent-first]')?.dataset.worldRevision==='2');
  await page.getByRole('button',{name:'人物观察',exact:true}).click();
  const panel=page.locator('[role=dialog]');must((await panel.innerText()).includes('有来源候选'),'Candidate count is not visible in the player-safe life panel');
  must(!((await panel.innerText()).includes('PRIVATE_SENTINEL')),'Private memory leaked into player panel');
  await page.screenshot({path:'output/playwright/resident-cognition-panel.png'});
  must(errors.length===0&&consoleErrors.length===0,JSON.stringify({errors,consoleErrors}));
  return{passed:true,proposalSummaryVisible:true,privateMemoryAbsent:true,worldRevision:'2',pageErrors:errors,consoleErrors,
    scope:'Local Windows Chromium at 1280x720; rules mode only; no model call or human acceptance.'};
}
