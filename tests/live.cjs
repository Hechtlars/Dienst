const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
  const base=process.env.LIVE_URL;
  assert.ok(base,'LIVE_URL fehlt');
  if(process.env.GITHUB_SHA){
    let deployed;
    for(let attempt=0;attempt<12;attempt++){
      const response=await fetch(new URL('deployment.json?check='+Date.now(),base),{signal:AbortSignal.timeout(10000)});
      if(response.ok){deployed=await response.json();if(deployed.commit===process.env.GITHUB_SHA)break;}
      await new Promise(resolve=>setTimeout(resolve,5000));
    }
    assert.equal(deployed?.commit,process.env.GITHUB_SHA,'Live-Version entspricht nicht dem geprüften Commit');
  }
  const version=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').match(/const APP_VERSION = '([^']+)'/)[1];
  for(const type of [chromium,webkit]){
    const browser=await type.launch();
    try {
      const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Berlin'});
      const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base,{waitUntil:'load'});
      // Beim ersten Aufruf kann die neue Service-Worker-Version die Seite einmal
      // kontrolliert neu laden. Erst nach dieser Aktivierung wird die Live-UI bedient.
      await page.waitForTimeout(1200);
      await page.waitForLoadState('domcontentloaded');
      assert.equal(await page.evaluate(()=>APP_VERSION),version);
      await page.click('#newDuty');
      assert.equal(await page.locator('#modalContent input[type="datetime-local"]').count(),0);
      await page.fill('#dutyDate','2026-10-05');await page.dispatchEvent('#dutyDate','change');
      await page.locator('#saveDuty').scrollIntoViewIfNeeded();await page.click('#saveDuty');
      assert.equal(await page.evaluate(()=>state.duties.length),1);
      await page.reload();assert.equal(await page.evaluate(()=>state.duties[0].date),'2026-10-05');
      await page.click('[data-view="monat"]');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.deepEqual(errors,[]);
      await page.screenshot({path:path.join(__dirname,'live-'+type.name()+'.png'),fullPage:true});
      console.log(type.name()+': Live-Version '+version+', Anlegen, lokale Speicherung und Layout bestanden');
    } finally {await browser.close();}
  }
})().catch(error=>{console.error(error);process.exit(1);});
