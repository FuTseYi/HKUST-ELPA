'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'};
const serve=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost');
  const pathname=decodeURIComponent(url.pathname==='/'?'/practice.html':url.pathname);
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    response.writeHead(404).end('Not found');return;
  }
  response.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(response);
});
function chromeBinary(){
  for(const command of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
    try{return execFileSync('which',[command],{encoding:'utf8'}).trim();}catch(_){}
  }
  throw new Error('A system Chromium/Chrome binary is required for the smoke test');
}
(async()=>{
  await new Promise(resolve=>serve.listen(0,'127.0.0.1',resolve));
  const host='http://127.0.0.1:'+serve.address().port+'/practice.html';
  const browser=await chromium.launch({headless:true,executablePath:chromeBinary(),
    args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    for(const width of [320,375,390,430,1280]){
      const mobile=width<600;
      const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(host,{waitUntil:'load'});
      await page.waitForSelector('#bankD .qcard',{timeout:20000});
      const layout=await page.evaluate(()=>{
        const full=document.documentElement.scrollWidth,view=document.documentElement.clientWidth;
        const card=document.querySelector('#bankD .qcard');
        const buttons=[...card.querySelectorAll('.q-actions button')];
        const rects=buttons.map(button=>{
          const r=button.getBoundingClientRect(),style=getComputedStyle(button);
          return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,
            marginTop:style.marginTop,marginBottom:style.marginBottom};
        });
        const launcher=document.getElementById('practiceLauncher').getBoundingClientRect();
        return {full,view,rects,launcher:{left:launcher.left,right:launcher.right,bottom:launcher.bottom},
          noteEdit:getComputedStyle(card.querySelector('.qnote .md-tab')).display,
          cardWidth:card.getBoundingClientRect().width};
      });
      assert.ok(layout.full<=layout.view+2,
        'Unexpected horizontal page overflow at '+width+'px: '+JSON.stringify(layout));
      assert.ok(layout.rects.length>=2,'Question controls missing at '+width);
      assert.ok(layout.rects.every(r=>r.width>=60&&r.height>=32),
        'Card controls undersized at '+width+': '+JSON.stringify(layout.rects));
      assert.ok(layout.rects.every(r=>Math.abs(r.y-layout.rects[0].y)<4),
        'Question controls must share one tidy row at '+width+': '+JSON.stringify(layout.rects));
      assert.ok(layout.rects.every((r,i)=>i===0||r.x>=layout.rects[i-1].right-2),
        'Question controls overlap at '+width+': '+JSON.stringify(layout.rects));
      assert.ok(layout.rects.every(r=>r.marginTop==='0px'&&r.marginBottom==='0px'&&r.height===40),
        'All card buttons must have identical zero margins and 40px height at '+width+': '+JSON.stringify(layout.rects));
      assert.equal(layout.noteEdit,'none','Note editing controls should be collapsed');
      const footer=await page.evaluate(()=>{
        const f=document.querySelector('footer.elpa-footer');
        const rect=f?.getBoundingClientRect();
        return {count:document.querySelectorAll('footer.elpa-footer').length,
          caption:f?.querySelector('.elpa-footer-cohort')?.textContent,
          authorLast:f?.lastElementChild?.lastElementChild?.classList.contains('elpa-footer-identity'),
          flow:[...f?.querySelectorAll('.elpa-footer-inner > *')||[]].map(el=>el.className),
          actions:f?.querySelectorAll('.elpa-footer-action').length||0,
          left:rect?.left,right:rect?.right,
          scrollWidth:document.documentElement.scrollWidth};
      });
      assert.equal(footer.count,1,'One footer required at '+width);
      assert.equal(footer.caption,'2026 Fall MPhil');
      assert.equal(footer.authorLast,true,'Author credit should be the last footer element');
      assert.equal(footer.actions,2,'Both contribution links must be present');
      assert.ok(footer.left>=-1&&footer.right<=width+1,
        'Footer escapes mobile viewport at '+width+': '+JSON.stringify(footer));
      assert.ok(footer.scrollWidth<=width+2,'Footer overflows at '+width);
      assert.ok(layout.launcher.left>=0&&layout.launcher.right<=width+1,
        'Launcher escapes the mobile viewport at '+width+': '+JSON.stringify(layout.launcher));

      if(width===390){
        const feedback=page.locator('#bankD .qcard .question-feedback').first();
        assert.match(await feedback.innerText(),/考过 \d+ 次/);
        const link=feedback.locator('a');
        assert.match(await link.innerText(),/我也考过/);
        const contributionHref=await link.getAttribute('href');
        const contrib=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
        try{
          await contrib.goto(new URL(contributionHref,host).href,{waitUntil:'load'});
          assert.equal(await contrib.locator('#linkedQuestion').isVisible(),true);
          assert.equal(await contrib.locator('input[value="encounter"][name="contributionIntent"]').isChecked(),true);
          assert.equal(await contrib.locator('#mainEnField').isVisible(),false);
          assert.equal(await contrib.locator('#mainCnField').isVisible(),false);
          await contrib.locator('input[value="supplement"][name="contributionIntent"]').check();
          assert.equal(await contrib.locator('input[value="supplement"][name="contributionIntent"]').isChecked(),true);
          await contrib.locator('#unlinkQuestion').click();
          assert.equal(await contrib.locator('#mainEnField').isVisible(),true);
          assert.equal(await contrib.locator('#mainCn').getAttribute('required'),null);
        }finally{await contrib.close();}
        await page.click('#practiceLauncher');
        assert.equal(await page.locator('#timerPanel').isVisible(),true);
        assert.equal(await page.locator('#timerDisplay').innerText(),'01:00');
        assert.match(await page.locator('#timerStartPause').innerText(),/开始/);
        const launcherBefore=await page.locator('#practiceLauncherText').innerText();
        assert.equal(launcherBefore,'练习','Opening the panel cannot start the timer');
        await page.click('#timerDrill');
        await page.waitForFunction(()=>!!document.querySelector('.qcard.drill-active'));
        assert.equal(await page.locator('#timerPanel').isVisible(),false);
        assert.equal(await page.locator('#practiceLauncherText').innerText(),'练习',
          'A random draw must not start a countdown');
        assert.equal(await page.locator('#practiceLauncher').isVisible(),true);
        await page.click('#practiceLauncher');
        await page.click('#timerStartPause');
        await page.waitForTimeout(300);
        assert.equal(await page.locator('#timerPanel').isVisible(),false);
        assert.notEqual(await page.locator('#practiceLauncherText').innerText(),'练习',
          'Active countdown should remain visible in the floating launcher');
        await page.click('#practiceLauncher');
        await page.click('#timerStartPause'); // pause
        await page.click('#timerReset');
        const note=page.locator('#bankD .qcard .qnote').first();
        await note.locator('.note-toggle').click();
        assert.equal(await note.locator('.md-tab').first().isVisible(),true);
        await note.locator('textarea').fill('ELPA mobile smoke note');
        await page.reload();
        await page.waitForSelector('#bankD .qcard');
        const restored=page.locator('#bankD .qcard .qnote').first();
        await restored.locator('.note-toggle').click();
        assert.equal(await restored.locator('textarea').inputValue(),'ELPA mobile smoke note');
      }
      assert.deepEqual(errors,[],'Browser JS errors at '+width+'px');
      console.log('Browser UI passed at '+width+'px');
      await page.close();
    }
  }finally{
    await browser.close();
    await new Promise(resolve=>serve.close(resolve));
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
