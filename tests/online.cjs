const {open,assert}=require('./online-harness.cjs');
(async()=>{const {page,errors,requests,url,close}=await open();try{
 await page.goto(url);await page.locator('[data-action=key]').click();await page.locator('[data-action=footprint]').click();
 for(const question of ['停电时你在哪里？','钥匙在谁手上？']){await page.locator('#input').fill(question);await page.locator('#composer button').click();await page.waitForFunction(()=>!document.querySelector('#composer button').disabled);}
 assert.match(await page.locator('#modelBadge').innerText(),/在线规则模式/);
 await page.locator('#view-notebook').click();await page.waitForFunction(()=>document.querySelectorAll('.evidence-item').length===4);
 await page.getByRole('button',{name:'运行调查助手',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.director-tools li.done').length===4);
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出 JSON',exact:true}).click()]);assert.match(download.suggestedFilename(),/\.json$/);
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 for(const name of ['liufang.html','ye-pusa.html']){await page.goto(url+name);await page.locator('#view-notebook').waitFor();}
 assert.equal(requests.filter(r=>r.url.includes('/api/')).length,0);assert.deepEqual(errors,[]);
 console.log('Online NPC passed: subdirectory paths, repeated rules chat, real notebook, export, all pages, responsive, zero API requests.');
}finally{await close();}})().catch(error=>{console.error(error);process.exitCode=1;});
