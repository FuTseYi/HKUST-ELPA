'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
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
(async()=>{
  await new Promise(resolve=>serve.listen(0,'127.0.0.1',resolve));
  const host='http://127.0.0.1:'+serve.address().port+'/practice.html';
  let browser;
  try{
    browser=await chromium.launch({headless:true});
    async function newPage(options){
      const page=await browser.newPage(options);
      // UI regressions must not depend on external quotas or create public Issues.
      await page.route('https://img.shields.io/github/stars/**',route=>route.fulfill({
        status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="17" height="20"><text x="5" y="14">2</text></svg>'
      }));
      await page.route('https://challenges.cloudflare.com/**',route=>route.fulfill({
        status:200,contentType:'application/javascript',body:''
      }));
      await page.route('https://hkust-elpa-submissions.futseyi.workers.dev/**',route=>route.abort());
      return page;
    }
    for(const width of [320,375,390,430,700,768,1024,1280]){
      const mobile=width<600;
      const page=await newPage({viewport:{width,height:844},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(host,{waitUntil:'load'});
      await page.waitForSelector('#bankD .qcard',{timeout:20000});
      assert.equal(await page.locator('.elpa-star-count').evaluate(img=>img.complete&&img.naturalWidth>0),true,'Star count badge loads without custom JavaScript');
      if(width===390){
        await page.route('https://img.shields.io/github/stars/**',route=>route.abort());
        await page.reload();
        await page.waitForFunction(()=>document.querySelector('.elpa-star-count').hidden);
        assert.equal(await page.locator('.elpa-nav-github').isVisible(),true,'Repository link remains available if the badge fails');
        await page.waitForSelector('#bankD .qcard');
      }
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
      if(width===1280){
        const progress=await page.evaluate(()=>({
          records:document.getElementById('recordsMenuBtn').closest('.progress-card')!==null,
          done:document.getElementById('doneCount').closest('.progress-card')!==null,
          filters:document.getElementById('sessionFilter').closest('.toolbar')!==null
        }));
        assert.deepEqual(progress,{records:true,done:true,filters:true},'Study progress and search filters should be separate groups');
      }
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
          buttons:[...f.querySelectorAll('.elpa-footer-action')].map(el=>{
            const r=el.getBoundingClientRect(),style=getComputedStyle(el);
            return {text:el.innerText,width:r.width,height:r.height,y:r.y,whiteSpace:style.whiteSpace,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
          }),
          tech:f.querySelector('.elpa-footer-tech')?.textContent,
          left:rect?.left,right:rect?.right,
          scrollWidth:document.documentElement.scrollWidth};
      });
      assert.equal(footer.count,1,'One footer required at '+width);
      assert.equal(footer.caption,undefined,'Personal cohort label removed');
      assert.equal(footer.authorLast,true,'Author credit should be the last footer element');
      assert.equal(footer.actions,2,'Both contribution links must be present');
      assert.deepEqual(footer.buttons.map(b=>b.text.replace(/\s+/g,' ').trim()),['分享考题与经验 Share questions & tips','参与开源共建 Contribute on GitHub']);
      assert.ok(footer.buttons.every(b=>b.height>=28&&b.whiteSpace==='nowrap'&&b.scrollWidth<=b.clientWidth+1),
        'Footer labels must be single-line at '+width+': '+JSON.stringify(footer.buttons));
      assert.ok(Math.abs(footer.buttons[0].y-footer.buttons[1].y)<=1,'Footer buttons not aligned at '+width);
      assert.match(footer.tech,/Built with GitHub · Vercel · Cloudflare/);
      assert.ok(footer.left>=-1&&footer.right<=width+1,
        'Footer escapes mobile viewport at '+width+': '+JSON.stringify(footer));
      assert.ok(footer.scrollWidth<=width+2,'Footer overflows at '+width);
      assert.ok(layout.launcher.left>=0&&layout.launcher.right<=width+1,
        'Launcher escapes the mobile viewport at '+width+': '+JSON.stringify(layout.launcher));
      // The homepage and sources now share the compact footer and mobile layout.
      const homePage=await newPage({viewport:{width,height:844},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
      try{
        await homePage.goto(new URL('/index.html',host).href,{waitUntil:'load'});
        assert.equal(await homePage.locator('.elpa-home-journey li').count(),4);
        assert.equal(await homePage.locator('.elpa-home-feature').count(),4);
        assert.equal(await homePage.locator('.elpa-home-demo').count(),4);
        assert.equal(await homePage.locator('.elpa-home-instructions').count(),2);
        assert.equal(await homePage.locator('.elpa-home-instructions li').count(),6);
        assert.equal(await homePage.locator('.elpa-home-backup-guide').count(),1);
        assert.match(await homePage.locator('#home-practice-title').innerText(),/随机抽题，开口练习/);
        assert.equal(await homePage.locator('.elpa-home-help[open]').count(),0,'Detailed instructions start collapsed');
        const alignment=await homePage.evaluate(()=>{
          const edges=selector=>[...document.querySelectorAll(selector)].map(el=>{
            const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom};
          });
          return {links:edges('.elpa-home-feature-link'),dividers:edges('.elpa-home-help'),
            community:edges('.elpa-home-more-card'),share:edges('.elpa-home-more-card>a')[0],demo:edges('.elpa-home-share-help summary')[0]};
        });
        if(width>700){
          for(const index of [0,2]){
            assert.ok(Math.abs(alignment.links[index].bottom-alignment.links[index+1].bottom)<2,'Feature links align at '+width);
            assert.ok(Math.abs(alignment.dividers[index].top-alignment.dividers[index+1].top)<2,'Feature dividers align at '+width);
          }
          assert.ok(Math.abs(alignment.community[0].bottom-alignment.community[1].bottom)<2,'Community cards align at '+width);
        }
        assert.ok(Math.abs(alignment.share.bottom-alignment.demo.bottom)<2,'Sharing demo stays beside its action at '+width);
        for(const help of await homePage.locator('.elpa-home-help').all()){
          await help.locator('summary').click();
          assert.equal(await help.locator('.elpa-home-demo').isVisible(),true,'Preview is available on request');
          await homePage.waitForFunction(id=>{
            const top=document.getElementById(id).getBoundingClientRect().top;
            const navBottom=document.querySelector('.elpa-nav').getBoundingClientRect().bottom;
            return Math.abs(top-navBottom-16)<2;
          },await help.evaluate(el=>el.closest('.elpa-home-feature').id));
          if(width>700){
            const spansRow=await help.evaluate(el=>{
              const card=el.closest('.elpa-home-feature');
              return Math.abs(card.getBoundingClientRect().width-card.parentElement.getBoundingClientRect().width)<1;
            });
            assert.equal(spansRow,true,'Expanded feature spans the row without stretching a neighboring card');
          }
          await help.locator('summary').focus();
          await homePage.keyboard.press('Enter');
          assert.equal(await help.getAttribute('open'),null,'Keyboard can collapse instructions');
        }
        await homePage.locator('#home-record summary').click();
        const backupGuide=await homePage.locator('.elpa-home-backup-guide').innerText();
        assert.ok(backupGuide.includes('「备份」')&&backupGuide.includes('「恢复」'),'Explain both backup and restore in plain language');
        const plainHome=await homePage.locator('main').innerText();
        assert.doesNotMatch(plainHome,/模拟口语|JSON|Markdown/,'Instructions must stay jargon-free');
        assert.equal(await homePage.locator('.elpa-home-more-card').count(),2);
        assert.equal(await homePage.locator('.elpa-next-primary').count(),0);
        assert.equal(await homePage.locator('.elpa-cta-primary').count(),1,'Only the original hero CTA remains');
        assert.match(await homePage.locator('.elpa-home-more').innerText(),/社区分享/);
        await homePage.locator('#home-record summary').click();
        // Demonstrations load motion only after an explicit play action.
        assert.equal(await homePage.locator('.elpa-home-promo img[src$=".gif"]').count(),0);
        for(const selector of ['#home-practice .elpa-home-help','#home-record .elpa-home-help','.elpa-home-share-help']){
          const details=homePage.locator(selector);
          await details.locator('summary').click();
          const play=details.locator('.elpa-home-demo-play');
          const image=details.locator('.elpa-home-promo img');
          const poster=await image.getAttribute('src');
          await play.click();
          assert.equal(await play.getAttribute('aria-pressed'),'true');
          await homePage.waitForFunction(src=>[...document.images].some(img=>img.getAttribute('src')===src&&img.complete&&img.naturalWidth>0),await image.getAttribute('data-demo'));
          await details.locator('summary').click();
          await homePage.waitForFunction(()=>document.querySelectorAll('.elpa-home-demo-play[aria-pressed="true"]').length===0);
          assert.equal(await image.getAttribute('src'),poster,'Closing instructions stops the demonstration');
        }
        await homePage.locator('.elpa-home-journey a[href="#home-practice"]').click();
        await homePage.waitForFunction(()=>{
          const target=document.querySelector('#home-practice').getBoundingClientRect();
          return target.top>=document.querySelector('.elpa-nav').getBoundingClientRect().bottom && target.top<innerHeight;
        });
        const dimensions=await homePage.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
        assert.ok(dimensions.scroll<=dimensions.width+2,'Home horizontal overflow at '+width+': '+JSON.stringify(dimensions));
        await homePage.goto(new URL('/sources.html',host).href,{waitUntil:'load'});
        assert.equal(await homePage.locator('#official-sources + .elpa-desc').count(),1);
        assert.equal(await homePage.locator('.elpa-resource-tag').count(),4);
        const sourcesDimensions=await homePage.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
        assert.ok(sourcesDimensions.scroll<=sourcesDimensions.width+2,'Sources horizontal overflow at '+width+': '+JSON.stringify(sourcesDimensions));
      }finally{await homePage.close();}


      // Guide flow is tested locally at every responsive width, before any release.
      const guide=await newPage({viewport:{width,height:844},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
      try{
        const guideErrors=[];
        guide.on('pageerror',err=>guideErrors.push(err.message));
        await guide.goto(new URL('/guide.html',host).href,{waitUntil:'load'});
        assert.equal(await guide.locator('#regularGuide').isVisible(),true);
        assert.equal(await guide.locator('#fastGuide').isVisible(),false);
        assert.equal(await guide.locator('#guideAdviceList article').count(),3);
        assert.equal(await guide.locator('#guideAdviceFilters').isVisible(),true);
        await guide.locator('#adviceTagFilter').selectOption('speaking-strategy');
        assert.equal(await guide.locator('#guideAdviceList article').count(),2);
        await guide.locator('#adviceTagFilter').selectOption('');
        await guide.locator('#guideFastTab').click();
        assert.equal(await guide.locator('#fastGuide').isVisible(),true);
        assert.equal(await guide.locator('#regularGuide').isVisible(),false);
        assert.equal(await guide.locator('#guideFastTab').getAttribute('aria-pressed'),'true');
        assert.match(await guide.locator('#fastGuide .elpa-guide-practice').getAttribute('href'),/track=fast-track/);
        assert.equal(await guide.locator('#guideAdviceList article').count(),0);
        assert.equal(await guide.locator('#guideAdviceFilters').isVisible(),false);
        assert.equal(await guide.locator('#guideAdviceEmpty').isVisible(),true);
        assert.match(await guide.locator('#guideAdviceShare').getAttribute('href'),/kind=advice&track=fast-track/);
        if(width===390){
          await guide.evaluate(()=>{
            reviewedAdvice.push({id:'ADV-999',issueNumber:999,track:'fast-track',phase:'before',
              tags:['exam-process'],title:'Browser fixture',body:'Browser-only reviewed advice'});
            selectGuideTrack('fast-track');
          });
          assert.equal(await guide.locator('#guideAdviceList article').count(),1);
          assert.equal(await guide.locator('#guideAdviceFilters').isVisible(),true);
          assert.match(await guide.locator('#guideAdviceList article a').getAttribute('href'),/issues\/999$/);
          const share=await newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
          try{
            await share.goto(new URL(await guide.locator('#guideAdviceShare').getAttribute('href'),host).href,{waitUntil:'load'});
            assert.equal(await share.locator('#tabAdvice').getAttribute('aria-pressed'),'true');
            assert.equal(await share.locator('#adviceTrack').inputValue(),'fast-track');
            assert.equal(await share.locator('#adviceTrack').isVisible(),true);
          }finally{await share.close();}
        }
        const dimensions=await guide.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
        assert.ok(dimensions.scroll<=dimensions.width+2,'Guide horizontal overflow at '+width+': '+JSON.stringify(dimensions));
        await guide.locator('#guideRegularTab').click();
        assert.equal(await guide.locator('#regularGuide').isVisible(),true);
        assert.equal(await guide.locator('#fastGuide').isVisible(),false);
        assert.deepEqual(guideErrors,[],'Guide browser errors at '+width);
      }finally{await guide.close();}

      if(width===390){
        const emptyCategory=await newPage({viewport:{width:390,height:844}});
        try{
          await emptyCategory.goto(new URL('/practice.html?campus=clear-water-bay',host).href,{waitUntil:'load'});
          for(const track of ['regular','fast-track']){
            await emptyCategory.locator('[data-track="'+track+'"]').click();
            assert.equal(await emptyCategory.locator('#categoryEmpty').isVisible(),true);
            for(const selector of ['#toc','#sec-bankD','#sec-bankA','.toolbar'])
              assert.equal(await emptyCategory.locator(selector).isVisible(),false,'Empty category hides '+selector);
            assert.equal(await emptyCategory.locator('#timerDrill').isDisabled(),true);
            const share=new URL(await emptyCategory.locator('#categoryEmptyShare').getAttribute('href'),host);
            assert.equal(share.searchParams.get('campus'),'clear-water-bay');
            assert.equal(share.searchParams.get('track'),track);
          }
          await emptyCategory.locator('[data-campus="nansha"]').click();
          assert.equal(await emptyCategory.locator('#categoryEmpty').isVisible(),false);
          assert.equal(await emptyCategory.locator('.toolbar').isVisible(),true);
          assert.equal(await emptyCategory.locator('#timerDrill').isEnabled(),true);
          await emptyCategory.locator('#searchInput').fill('no-matching-question-for-draw');
          assert.equal(await emptyCategory.locator('#emptyState').isVisible(),true);
          assert.equal(await emptyCategory.locator('#timerDrill').isDisabled(),true);
          await emptyCategory.locator('#searchClear').click();
          assert.equal(await emptyCategory.locator('#timerDrill').isEnabled(),true);
        }finally{await emptyCategory.close();}
        const preview=await newPage({viewport:{width:390,height:844}});
        try{
          await preview.goto(new URL('/submit.html?kind=advice',host).href,{waitUntil:'load'});
          await preview.locator('#adviceTags input').first().check();
          await preview.locator('#adviceTitle').fill('Preview regression');
          await preview.locator('#adviceBody').fill('Original advice content for the local preview regression.');
          await preview.locator('#previewButton').click();
          assert.equal(await preview.locator('#previewPanel').isVisible(),true);
          await preview.locator('#adviceBody').fill('Updated advice content for the local preview regression.');
          assert.equal(await preview.locator('#previewPanel').isVisible(),false,'Editing content invalidates the old preview');
          assert.match(await preview.locator('#submissionMessage').innerText(),/Please preview again/);
          await preview.locator('#previewButton').click();
          assert.match(await preview.locator('#previewPanel').innerText(),/Updated advice content/);
          await preview.locator('#advicePhase').selectOption('after');
          assert.equal(await preview.locator('#previewPanel').isVisible(),false,'Changing metadata invalidates the old preview');
        }finally{await preview.close();}
        // Copied question numbers must follow the same feedback-ranked order
        // as the cards, not the original F-series storage order.
        const numbering=await page.evaluate(()=>{
          setExamChoice('track','fast-track');
          let copied='';
          Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
            writeText:text=>{copied=text;return Promise.resolve();}
          }});
          copyQuestion('F-2');
          const displayed=document.querySelector('#q-F-2 .q-num').textContent;
          const session=document.getElementById('currentBankTitle').textContent;
          const source=document.querySelector('#q-F-2 .recall-mark')?.textContent;
          delete navigator.clipboard;
          setExamChoice('track','regular');
          return {copied,displayed,session,source};
        });
        assert.equal(numbering.displayed,'1');
        assert.match(numbering.copied,new RegExp('第 '+numbering.displayed+' 题'));
        assert.equal(numbering.session,'场次待核实');
        assert.match(numbering.source,/英文根据中文回忆整理/);
        const exportPage=await newPage({viewport:{width:390,height:844}});
        try{
          await exportPage.goto(new URL('/practice.html?track=fast-track',host).href,{waitUntil:'load'});
          const questions=await exportPage.locator('#bankD .q-title > .en,#bankPast .q-title > .en').allTextContents();
          await exportPage.locator('#searchInput').fill('no-matching-question-for-export');
          await exportPage.locator('#recordsMenuBtn').click();
          const download=exportPage.waitForEvent('download');
          await exportPage.locator('#recordsExportBtn').click();
          const markdown=fs.readFileSync(await (await download).path(),'utf8');
          const exported=markdown.split(/\r?\n/).filter(line=>/^### \d+\. /.test(line)).map(line=>line.replace(/^### \d+\. /,''));
          assert.ok(questions.length>0);
          assert.deepEqual(exported,questions,'Export follows displayed ranking and includes the whole category despite filters');
        }finally{await exportPage.close();}
        const feedback=page.locator('#bankD .qcard .question-feedback').first();
        assert.match(await feedback.innerText(),/过往考过 \d+ 次/);
        const link=feedback.locator('a');
        assert.match(await link.innerText(),/我也考过/);
        const contributionHref=await link.getAttribute('href');
        const contrib=await newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
        try{
          await contrib.goto(new URL(contributionHref,host).href,{waitUntil:'load'});
          assert.equal(await contrib.locator('#linkedQuestion').isVisible(),true);
          assert.equal(await contrib.locator('input[value="encounter"][name="contributionIntent"]').isChecked(),true);
          assert.equal(await contrib.evaluate(()=>document.activeElement&&document.activeElement.id),'submissionCampus');
          assert.equal(await contrib.locator('#submissionCampus').inputValue(),'');
          assert.ok(await contrib.locator('#exam-context').evaluate(el=>el.getBoundingClientRect().top>=0&&el.getBoundingClientRect().top<180));
          assert.doesNotMatch(contributionHref,/campus=/);
          assert.equal(await contrib.locator('#mainEnField').isVisible(),false);
          assert.equal(await contrib.locator('#mainCnField').isVisible(),false);
          await contrib.locator('input[value="supplement"][name="contributionIntent"]').check();
          assert.equal(await contrib.locator('input[value="supplement"][name="contributionIntent"]').isChecked(),true);
          assert.equal(await contrib.locator('#supplementQuestionFields').isVisible(),true);
          assert.equal(await contrib.locator('#supplementEn').isEnabled(),true);
          // A deep-linked question stays linked for its own campus, but changing
          // to another campus must clear the incompatible ID before submission.
          await contrib.locator('#submissionCampus').selectOption('nansha');
          assert.equal(await contrib.locator('#linkedQuestion').isVisible(),true);
          await contrib.locator('#submissionCampus').selectOption('clear-water-bay');
          assert.equal(await contrib.locator('#linkedQuestion').isVisible(),false);
          assert.equal(await contrib.locator('#mainEnField').isVisible(),true);
          assert.equal(await contrib.locator('#supplementQuestionFields').isVisible(),false);
          assert.equal(await contrib.locator('#mainCn').getAttribute('required'),null);
        }finally{await contrib.close();}
        await page.click('#practiceLauncher');
        assert.equal(await page.locator('#timerPanel').isVisible(),true);
        assert.equal(await page.locator('#timerDisplay').innerText(),'01:00');
        assert.match(await page.locator('#timerStartPause').innerText(),/开始/);
        const launcherBefore=await page.locator('#practiceLauncherText').innerText();
        assert.match(launcherBefore,/^练习\s+Practice$/,'Opening the panel cannot start the timer');
        await page.click('#timerDrill');
        await page.waitForFunction(()=>!!document.querySelector('.qcard.drill-active'));
        assert.equal(await page.locator('#timerPanel').isVisible(),false);
        assert.equal(await page.locator('#practiceLauncherText').innerText(),launcherBefore,
          'A random draw must not start a countdown');
        assert.equal(await page.locator('#practiceLauncher').isVisible(),true);
        await page.click('#practiceLauncher');
        await page.click('#timerStartPause');
        await page.waitForTimeout(300);
        assert.equal(await page.locator('#timerPanel').isVisible(),false);
        assert.match(await page.locator('#practiceLauncherText').innerText(),/^\d{2}:\d{2}$/,
          'Active countdown should remain visible in the floating launcher');
        await page.click('#practiceLauncher');
        await page.click('#timerStartPause'); // pause
        await page.click('#timerReset');
        // A random draw can move to another page; return to the stable note fixture.
        await page.locator('#pagerFall').getByRole('button',{name:'1',exact:true}).click();
        const note=page.locator('#bankD .qcard .qnote').first();
        await note.locator('.note-toggle').click();
        assert.equal(await note.locator('.md-tab').first().isVisible(),true);
        await note.locator('textarea').fill('ELPA mobile smoke note');
        await page.reload();
        await page.waitForSelector('#bankD .qcard');
        const restored=page.locator('#bankD .qcard .qnote').first();
        await restored.locator('.note-toggle').click();
        assert.equal(await restored.locator('textarea').inputValue(),'ELPA mobile smoke note');
        // Regression: reviewed follow-ups must survive both copy and Markdown export.
        await page.evaluate(()=>{
          const id='D-1';
          BANKS.D.items[0].recallTag='考生回忆，待核实';
          (ELPA_APPEARANCES[id] ||= []).push({issueNumber:99999,term:'2026 Fall',examStage:'start',
            intent:'supplement',subs:[{en:'Community-added follow-up',cn:'社区补充小问'}]});
          ELPA_APPEARANCES[id].push({issueNumber:100000,term:'2026 Fall',examStage:'start',intent:'supplement',alternatives:[{en:'Alternative community phrasing',cn:'另一种社区问法'}]});
          notes[id+'-0']='Community supplement notes';
          window.__elpaCopied='';
          Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
            writeText(text){window.__elpaCopied=text;return Promise.resolve();}
          }});
          renderAll();
        });
        const variant=page.locator('#variants-D-1');
        await variant.locator('.subq-head').click();
        assert.equal(await variant.locator('.subq-cn').first().isVisible(),false,'Alternative translation hidden by default');
        await variant.locator('.translation-toggle').click();
        assert.equal(await variant.locator('.subq-cn').first().isVisible(),true,'Alternative translation revealed on request');
        await variant.locator('.translation-toggle').click();
        assert.equal(await variant.locator('.subq-cn').first().isVisible(),false,'Alternative translation can be hidden again');
        await page.locator('#q-D-1 .copy-btn').click();
        const copied=await page.evaluate(()=>window.__elpaCopied);
        assert.match(copied,/Community-added follow-up/,'Copy must include reviewed follow-ups');
        assert.match(copied,/考生回忆，待核实/,'Copy must retain explicit provenance');
        const downloadPromise=page.waitForEvent('download');
        await page.locator('#recordsMenuBtn').click();
        await page.locator('#recordsExportBtn').click();
        const exported=await downloadPromise;
        const markdown=fs.readFileSync(await exported.path(),'utf8');
        assert.match(markdown,/Community-added follow-up/,'Export must include reviewed follow-ups');
        assert.match(markdown,/Community supplement notes/,'Export must include matching follow-up notes');
        assert.match(markdown,/考生回忆，待核实/,'Export must preserve recorded provenance');
      }
      assert.deepEqual(errors,[],'Browser JS errors at '+width+'px');
      console.log('Browser UI passed at '+width+'px');
      await page.close();
    }
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>serve.close(resolve));
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
