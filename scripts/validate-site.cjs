'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const pageNames=['index','guide','practice','sources','submit'];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

// Source-level tests inspect the same ordered files the browser loads.
function readPageSource(name){
  const html=read(name);
  const files=[...html.matchAll(/(?:src|href)="\.\/((?:js|css)\/[^"?#]+)"/g)].map(match=>match[1]);
  return html+'\n'+files.map(read).join('\n');
}
function validateSite(){
  const pages=new Map(pageNames.map(name=>[name+'.html',read(name+'.html')]));
  const ids=new Map();
  let footer;
  for(const [name,html] of pages){
    const pageIds=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
    assert.equal(new Set(pageIds).size,pageIds.length,'Duplicate IDs: '+name);
    ids.set(name,new Set(pageIds));
    assert.ok(!/<script\s*>|<style\s*>/i.test(html),'Keep page logic and styles in dedicated files: '+name);
    const nav=html.match(/<nav class="elpa-nav"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav,'Missing navigation: '+name);
    for(const route of pageNames.filter(page=>page!=='submit'))
      assert.ok(nav.includes('href="./'+route+'.html"'),'Missing route '+route+' in '+name);
    assert.equal((nav.match(/class="elpa-nav-github"/g)||[]).length,1,'One GitHub entry: '+name);
    assert.equal((nav.match(/<small lang="en">/g)||[]).length,5,'Bilingual navigation and sharing: '+name);
    assert.ok(html.includes('href="./site.css"'),'Shared CSS missing: '+name);
    assert.ok(nav.includes('https://img.shields.io/github/stars/FuTseYi/HKUST-ELPA?'),'Star badge missing: '+name);
    assert.ok(html.includes('href="./assets/elpa-mark.svg"'),'Favicon missing: '+name);
    const currentFooter=html.match(/<footer class="elpa-footer"[\s\S]*?<\/footer>/)?.[0];
    assert.ok(currentFooter,'Missing footer: '+name);
    if(footer)assert.equal(currentFooter,footer,'Shared footer drift: '+name);
    footer=currentFooter;
    const script=name==='sources.html'?null:'./js/'+path.basename(name,'.html')+'.js';
    if(script)assert.ok(html.includes('src="'+script+'"'),'Page script missing: '+name);
  }
  for(const [name,html] of pages){
    for(const [,raw] of html.matchAll(/(?:src|href|data-demo)="([^"]+)"/g)){
      const url=new URL(raw.replace(/&amp;/g,'&'),'https://elpa.local/'+name);
      if(url.origin!=='https://elpa.local')continue;
      const file=decodeURIComponent(url.pathname).slice(1);
      assert.ok(fs.existsSync(path.join(root,file)),'Missing local resource: '+name+' → '+raw);
      if(url.hash&&ids.has(file))assert.ok(ids.get(file).has(decodeURIComponent(url.hash.slice(1))),'Missing anchor: '+name+' → '+raw);
    }
  }
  for(const file of ['site.css','css/practice.css','css/submit.css']){
    for(const [,raw] of read(file).matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)){
      if(/^(data:|https?:)/.test(raw))continue;
      assert.ok(fs.existsSync(path.resolve(root,path.dirname(file),raw)),'Missing CSS resource: '+file+' → '+raw);
    }
  }
  const documents=['README.md','worker/README.md'];
  for(const dir of ['docs','question-bank']){
    for(const file of fs.readdirSync(path.join(root,dir))){
      if(file.endsWith('.md'))documents.push(dir+'/'+file);
    }
  }
  for(const file of documents){
    for(const [,target] of read(file).matchAll(/\]\(([^\s)]+)\)/g)){
      if(/^(?:[a-z]+:|#)/i.test(target))continue;
      const local=decodeURIComponent(target.split(/[?#]/)[0]);
      assert.ok(fs.existsSync(path.resolve(root,path.dirname(file),local)),'Broken document link: '+file+' → '+target);
    }
  }
  const sources=['questions','fast-track','taxonomy','appearances','advice'].map(name=>read('question-bank/'+name+'.js'));
  const data=vm.runInNewContext(sources.join('\n')+'\n;({banks:BANKS,past:PAST_QUESTION_IDS,aliases:LEGACY_QUESTION_ALIASES,appearances:ELPA_APPEARANCES,advice:ELPA_ADVICE,taxonomy:ELPA_TAXONOMY})',{}, {timeout:1000});
  const questionIds=new Set();
  for(const [key,bank] of Object.entries(data.banks)){
    assert.ok(Array.isArray(bank.items),'Invalid bank '+key);
    for(const item of bank.items){
      const id=key+'-'+item.num;
      assert.ok(!questionIds.has(id),'Duplicate question '+id);
      assert.ok((Number.isSafeInteger(item.num)&&item.num>0)||id==='A-附','Invalid stable ID '+id);
      assert.ok(typeof item.en==='string'&&item.en.trim(),'Missing question text '+id);
      assert.ok(Array.isArray(item.subs),'Invalid follow-ups '+id);
      for(const sub of item.subs)assert.ok(typeof sub.en==='string'&&typeof sub.cn==='string','Invalid bilingual follow-up '+id);
      questionIds.add(id);
    }
  }
  assert.equal(new Set(data.past).size,data.past.length,'Duplicate past-bank IDs');
  for(const id of data.past)assert.ok(questionIds.has(id),'Unknown past-bank question '+id);
  for(const [oldId,id] of Object.entries(data.aliases))assert.ok(questionIds.has(oldId)&&questionIds.has(id),'Broken legacy alias '+oldId);
  for(const [id,appearances] of Object.entries(data.appearances)){
    assert.ok(questionIds.has(id),'Unknown appearance question '+id);
    assert.ok(Array.isArray(appearances),'Invalid appearances '+id);
    const issues=new Set();
    for(const entry of appearances){
      assert.match(entry.term,/^20\d{2} (Spring|Fall)$/,'Invalid term '+id);
      assert.ok(data.taxonomy.examStages[entry.examStage],'Invalid exam stage '+id);
      if(entry.issueNumber!==undefined){
        assert.ok(Number.isSafeInteger(entry.issueNumber)&&entry.issueNumber>0&&!issues.has(entry.issueNumber),'Repeated or invalid issue '+id);
        issues.add(entry.issueNumber);
      }
    }
  }
  const adviceIds=new Set();
  for(const entry of data.advice){
    assert.ok(!adviceIds.has(entry.id)&&entry.title&&entry.body,'Invalid advice '+entry.id);
    assert.ok(data.taxonomy.advicePhases[entry.phase],'Invalid advice phase '+entry.id);
    for(const tag of entry.tags)assert.ok(data.taxonomy.adviceTags[tag],'Invalid advice tag '+entry.id);
    adviceIds.add(entry.id);
  }
  const jpeg=fs.readFileSync(path.join(root,'assets/Administration-Building-14-1536x864.jpg'));
  assert.ok(jpeg.length>8000&&jpeg[0]===255&&jpeg[1]===216&&jpeg.at(-2)===255&&jpeg.at(-1)===217,'Invalid campus JPEG');
  console.log('Validated 5 pages, local resources, '+questionIds.size+' stable question IDs, '+data.advice.length+' advice entries and legacy aliases');
}
if(require.main===module){
  validateSite();
  const files=['submission-config.js'];
  for(const dir of ['js','question-bank','scripts','tests']){
    for(const file of fs.readdirSync(path.join(root,dir)))
      if(/\.(?:js|cjs)$/.test(file))files.push(path.join(dir,file));
  }
  for(const file of files)
    execFileSync(process.execPath,['--check',file],{cwd:root,stdio:'inherit'});
  execFileSync(process.execPath,['--input-type=module','--check'],{
    input:read('worker/src/index.js'),stdio:['pipe','inherit','inherit']
  });
  console.log('JavaScript syntax checks passed');
}
module.exports={readPageSource,validateSite};
