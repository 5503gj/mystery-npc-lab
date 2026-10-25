const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
(async()=>{
 const p=await port(),base=`http://127.0.0.1:${p}`;
 const server=spawn(process.env.PYTHON||'python',['-u','server.py'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,MYSTERY_PORT:String(p),OLLAMA_URL:'http://127.0.0.1:1/api/chat'},stdio:'ignore'});
 let browser;
 try{
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,50));}
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/status',r=>r.fulfill({json:{ollama:false}}));
 await page.route('**/api/chat',async r=>{await r.fulfill({json:{ok:true,answer:'<img src=x onerror="window.modelXss=1">'}})});
 for(const file of ['index.html','liufang.html','ye-pusa.html']){
  await page.goto(`${base}/${file}`);await page.locator('#input').fill('<img src=x onerror="window.userXss=1">');await page.locator('#composer button').click();
  await page.waitForFunction(()=>document.querySelector('#chat').textContent.includes('window.modelXss'));
  assert.equal(await page.evaluate(()=>!!window.userXss||!!window.modelXss),false);
  assert.equal(await page.locator('#chat img').count(),0);
 }
 // Deliberately ignore browser abort: old response must not be committed to the new view.
 await page.unroute('**/api/chat');let release;
 await page.route('**/api/chat',async r=>{await new Promise(res=>release=res);try{await r.fulfill({json:{ok:true,answer:'OLD_VIEW_RESPONSE'}})}catch{}});
 await page.goto(base+'/ye-pusa.html');await page.locator('#input').fill('你后悔吗');await page.locator('#composer button').click();
 await page.waitForFunction(()=>conversation.busy);await page.locator('[data-npc="huanglili"]').click();release();
 await page.waitForTimeout(100);assert.ok(!(await page.locator('#chat').innerText()).includes('OLD_VIEW_RESPONSE'));
 assert.equal(await page.evaluate(()=>state.bonds.huanglili),57);
 await page.unroute('**/api/chat');await page.route('**/api/chat',r=>r.fulfill({json:{ok:false}}));
 await page.goto(base+'/liufang.html');const q='我尊重你的选择';
 async function ask(text){await page.locator('#input').fill(text);await page.locator('#composer button').click();await page.waitForFunction(()=>!conversation.busy);}
 await ask(q);assert.equal(await page.evaluate(()=>bonds['陈明遇|陈稷']),52);
 await ask(q);assert.equal(await page.evaluate(()=>bonds['陈明遇|陈稷']),52);
 await page.selectOption('#listenerSelect','陈阎芙蓉');await ask('你害怕什么');
 assert.equal(await page.evaluate(()=>bonds['陈明遇|陈稷']),52);
 assert.equal(await page.evaluate(()=>bonds['陈明遇|陈阎芙蓉']),51);
 assert.deepEqual(errors,[]);console.log('Browser regressions passed: 3-page XSS, late response, pair isolation, duplicate awards, fallback.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
