async(page)=>{
  const must=(v,m)=>{if(!v)throw Error(m);},errors=[],consoleErrors=[],posts=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/'))posts.push(r.postDataJSON()?.kind);});
  await page.bringToFront();await page.reload();
  await page.getByRole('button',{name:'E 到访旧书店',exact:true}).waitFor();
  const map=page.locator('[data-agent-map]'),root=page.locator('[data-agent-first]');
  const revision=async()=>Number(await root.getAttribute('data-world-revision'));
  const initial=await revision();
  await page.keyboard.down('d');await page.waitForTimeout(400);await page.keyboard.up('d');
  const moved=JSON.parse(await map.getAttribute('data-position'));must(moved.x>750,'Keyboard did not move character');
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-agent-map]').dataset.metrics).samples===600);
  const desktop=JSON.parse(await map.getAttribute('data-metrics'));
  must(await revision()===initial&&posts.length===0,'Render/walking wrote engine state');
  await page.getByRole('button',{name:'继续世界',exact:true}).click();
  await page.getByRole('button',{name:'6 案件本',exact:true}).click();
  await page.waitForTimeout(8500);must(await revision()===initial,'Dialog did not pause world timer');
  await page.keyboard.press('Escape');
  await page.waitForFunction(n=>Number(document.querySelector('[data-agent-first]').dataset.worldRevision)===n,initial+1,{timeout:12000});
  await page.getByRole('button',{name:'暂停世界',exact:true}).click();
  const stopped=await revision();await page.waitForTimeout(8500);
  must(await revision()===stopped,'Paused world continued ticking');
  await page.setViewportSize({width:390,height:844});
  const before=JSON.parse(await map.getAttribute('data-position'));
  const down=page.getByRole('button',{name:'向下',exact:true}),b=await down.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(350);await page.mouse.up();
  const after=JSON.parse(await map.getAttribute('data-position'));must(after.y>before.y+20,'Touch control pointer hold did not move');
  await page.getByRole('button',{name:'3 跟随',exact:true}).click();
  await page.getByRole('button',{name:/许知微.*旧书修复师/}).click();
  await page.getByRole('button',{name:'跟随目击',exact:true}).click();
  must(await page.locator('[data-following]').getAttribute('data-following')==='rb-xu-zhiwei','Follow did not select observed resident');
  await page.getByRole('button',{name:'5 地图',exact:true}).click();
  await page.screenshot({path:'output/playwright/agent-first-narrow-map.png'});
  await page.getByRole('button',{name:'桥畔旅馆 登记簿、旅行箱和还亮着的灯。',exact:true}).click();
  await page.getByRole('button',{name:'E 到访桥畔旅馆',exact:true}).waitFor({timeout:15000});
  const beforeArrival=await revision();
  await page.getByRole('button',{name:'E 到访桥畔旅馆',exact:true}).click();
  await page.getByRole('button',{name:'E 回到街道',exact:true}).waitFor();
  must(await revision()===beforeArrival+1,'Narrow arrival did not commit once');
  await page.waitForFunction(()=>document.querySelector('[data-following]').dataset.following==='');
  await page.getByRole('button',{name:'E 回到街道',exact:true}).click();
  await page.getByRole('button',{name:'2 询问',exact:true}).click();
  await page.getByRole('button',{name:/许知微.*旧书修复师/}).click();
  must(await page.getByText('最后目击',{exact:true}).count()===1,'Departed resident leaked current sighting');
  must(await page.getByText('当前位置未知。',{exact:true}).count()===1,'Departed resident leaked activity');
  must(await page.getByRole('button',{name:'跟随目击',exact:true}).isDisabled(),'Offscreen resident remained followable');
  await page.screenshot({path:'output/playwright/agent-first-narrow-person.png'});
  await page.keyboard.press('Escape');
  // Measure a fresh 600-frame narrow sample after viewport change.
  await page.reload();await page.getByRole('button',{name:'E 到访桥畔旅馆',exact:true}).waitFor();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-agent-map]').dataset.metrics).samples===600);
  const narrow=JSON.parse(await map.getAttribute('data-metrics'));
  const layout=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
    scrollHeight:document.documentElement.scrollHeight,toolbarButtons:[...document.querySelectorAll('[aria-label="侦探工具"] button')].map(b=>({label:b.getAttribute('aria-label'),width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})),
    userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,dpr:devicePixelRatio,
    loadMs:performance.getEntriesByType('navigation')[0].duration}));
  must(layout.scrollWidth===390&&layout.scrollHeight===844,'Narrow layout overflows');
  must(layout.toolbarButtons.length===6&&layout.toolbarButtons.every(b=>b.width>=44&&b.height>=44),'Toolbar not usable at narrow size');
  must(errors.length===0&&consoleErrors.length===0,JSON.stringify({errors,consoleErrors}));
  await page.screenshot({path:'output/playwright/agent-first-narrow-final.png'});
  return {passed:true,keyboardMovement:true,renderAndWalkPosts:0,dialogPausesWorld:true,automaticAdvanceCommits:1,
    pausedForMs:8500,narrowPointerControl:true,narrowArrival:true,followStopsWhenOffscreen:true,lastSeenHidesActivity:true,
    desktop,narrow,layout,pageErrors:errors,consoleErrors,scope:'Windows desktop Chromium resized; no physical mobile, production build, or long soak claim.'};
}
