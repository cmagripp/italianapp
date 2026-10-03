import assert from 'node:assert/strict';
import {loadPlaywright,launchBrowser,ensureServer,boot,gotoRoute,contextOptions} from './lib.mjs';
const {chromium,webkit,devices}=await loadPlaywright(),stop=await ensureServer();
const browser=process.env.COURSE_BROWSER==='webkit'?await webkit.launch({headless:true}):await launchBrowser(chromium);
const context=await browser.newContext(contextOptions(devices['iPhone 13'],{reducedMotion:'reduce'}));
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await boot(page);
 for(const inf of ['addormentarsi','attenersi','farcela']){
  await gotoRoute(page,'/reference/'+encodeURIComponent('v:'+inf));
  const field=page.locator('[data-present-participle]');
  assert.equal(await field.locator('.val').innerText(),'—');
  assert.match(await field.locator('[data-present-participle-note]').innerText(),/rare reflexive or pronominal form needs a reviewed example/);
  assert.equal(await field.getByRole('link',{name:'Accademia della Crusca'}).getAttribute('href'),'https://accademiadellacrusca.it/it/consulenza/sul-participio-presente-di-verbi-riflessivi-e-pronominali/42855');
  console.log('PASS '+inf+' reference explains the unreviewed clitic present participle');
 }
 await gotoRoute(page,'/reference/'+encodeURIComponent('v:offrire'));
 assert.equal(await page.locator('[data-present-participle] .val').innerText(),'offerente');
 assert.equal(await page.locator('[data-present-participle-note]').count(),0);
 console.log('PASS offrire preserves its reviewed base lexical participle');
 await gotoRoute(page,'/reference/'+encodeURIComponent('v:capire'));
 assert.equal(await page.locator('[data-present-participle] .val').innerText(),'capiente');
 assert.match(await page.locator('[data-present-participle-note]').innerText(),/older containment meaning of capire/);
 assert.equal(await page.locator('[data-present-participle-note]').getByRole('link',{name:'Treccani'}).getAttribute('href'),'https://www.treccani.it/vocabolario/capiente/');
 console.log('PASS capire shows the lexical participle’s containment meaning and primary source');
 assert.deepEqual(errors,[]);
}finally{await context.close();await browser.close();await stop();}
