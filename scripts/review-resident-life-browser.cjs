async(page)=>{
  const must=(v,m)=>{if(!v)throw Error(m);},errors=[],consoleErrors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.bringToFront();await page.context().clearCookies();await page.setViewportSize({width:1280,height:720});
  await page.goto('http://127.0.0.1:3187/town-play/agent-first');await page.getByRole('button',{name:'开始河湾手记',exact:true}).click();
  await page.getByRole('button',{name:'人物观察',exact:true}).click();
  const enable=page.getByRole('button',{name:'启用三日生活',exact:true});await enable.click();
  await page.getByText(/三日生活已启用/).waitFor();
  await page.screenshot({path:'output/playwright/resident-life-desktop.png'});
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'等一刻钟',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('header strong')?.textContent==='08:15');
  await page.getByRole('button',{name:'人物观察',exact:true}).click();
  const observation=await page.evaluate(async()=>{const r=await fetch('/api/v1/town-play/agent-first',{cache:'no-store'});return(await r.json()).data.observation;});
  const actor=observation.residents.find(p=>p.visibility==='observed'&&p.activity);must(actor,'No real visible activity to inspect');
  await page.getByRole('button',{name:new RegExp(actor.name+'.*'+actor.role)}).click();
  const article=page.locator('article');must((await article.innerText()).includes(actor.activity),'Real resident activity not shown');
  await page.screenshot({path:'output/playwright/resident-life-observation.png'});
  await page.keyboard.press('Escape');await page.reload();
  await page.getByRole('button',{name:'人物观察',exact:true}).click();await page.getByText(/三日生活已启用/).waitFor();
  must(await page.getByRole('button',{name:'启用三日生活',exact:true}).count()===0,'Policy install lost on reload');
  await page.setViewportSize({width:390,height:844});await page.getByText(/三日生活已启用/).scrollIntoViewIfNeeded();
  await page.screenshot({path:'output/playwright/resident-life-narrow.png'});
  must(await page.evaluate(()=>document.documentElement.scrollWidth===390),'Narrow page overflow');
  must(errors.length===0&&consoleErrors.length===0,JSON.stringify({errors,consoleErrors}));
  await page.keyboard.press('Escape');
  return{passed:true,explicitOptIn:true,realActivity:true,gameTime:'08:15',reloadPreservesLife:true,widths:[1280,390],pageErrors:errors,consoleErrors,
    scope:'Desktop Chromium with resized narrow viewport. No phone or human acceptance.'};
}
