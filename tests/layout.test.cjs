'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {read:readArtifact}=require('../scripts/validate-site.cjs');
const read=file=>readArtifact(file).replace(/\?v=[a-f0-9]{12}(?=")/g,'');

test('all five built pages reuse homepage chrome with one selected navigation link',()=>{
  const footer=read('index.html').match(/<footer class="elpa-footer"[\s\S]*?<\/footer>/)[0];
  for(const page of ['index','guide','practice','submit','sources']){
    const html=read(page+'.html');
    const nav=html.match(/<nav class="elpa-nav"[\s\S]*?<\/nav>/)[0];
    assert.equal((nav.match(/aria-current="page"/g)||[]).length,1);
    assert.ok(nav.includes('aria-current="page"'));
    assert.equal(html.match(/<footer class="elpa-footer"[\s\S]*?<\/footer>/)[0],footer);
  }
});

test('practice palette aliases reuse the global design tokens',()=>{
  const site=read('assets/css/site.css'),practice=read('assets/css/practice.css');
  for(const [local,global] of [
    ['bg','site-bg'],['ink','site-ink'],['line','site-line'],
    ['brand','site-navy'],['brand-2','site-blue']
  ]){
    assert.ok(site.includes('--'+global+':'),'Missing shared token: '+global);
    assert.ok(practice.includes('--'+local+': var(--'+global+');'),
      'Local palette must reuse '+global);
  }
});

test('three source entrypoints generate five complete published pages',()=>{
  assert.deepEqual(fs.readdirSync(root).filter(name=>name.endsWith('.html')).sort(),
    ['index.html','practice.html','submit.html']);
  for(const page of ['practice','submit']){
    const source=fs.readFileSync(path.join(root,page+'.html'),'utf8');
    assert.ok(source.includes('<!-- shared-nav -->'));
    assert.ok(source.includes('<!-- shared-footer -->'));
    assert.doesNotMatch(source,/<nav class="elpa-nav"|<footer class="elpa-footer"/);
  }
  const homepage=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const page of ['guide','sources']){
    const pattern=new RegExp('<template data-page="'+page+'">\\s*(<main id="main">[\\s\\S]*?<\\/main>)\\s*<\\/template>');
    const fragment=homepage.match(pattern)?.[1];
    assert.ok(fragment,'Missing authored '+page+' template in homepage');
    if(page==='guide'){
      assert.ok(read('guide.html').includes(fragment.split('<section class="elpa-advice-section"')[0]));
      assert.match(read('guide.html'),/class="elpa-advice-card" data-track="regular"/);
      assert.doesNotMatch(read('guide.html'),/id="sec-advice" hidden/);
    }else{
      assert.ok(read(page+'.html').includes(fragment));
    }
  }
  assert.doesNotMatch(read('index.html'),/<template data-page=/);
  assert.ok(read('guide.html').includes('src="./assets/js/guide.js"'));
  assert.ok(read('guide.html').includes('src="./question-bank/taxonomy.js"'));
  assert.ok(!read('sources.html').includes('src="./assets/js/index.js"'));
});

test('persistent shell navigation has no artificial opacity flash',()=>{
  const css=read('assets/css/site.css');
  assert.doesNotMatch(css,/@keyframes elpa-enter|main\{animation:elpa-enter/);
});

test('public shell handles reading and practice routes with native fallbacks',()=>{
  const source=fs.readFileSync(path.join(root,'assets/js/site.js'),'utf8');
  assert.match(source,/history\.pushState/);
  assert.match(source,/popstate/);
  assert.match(source,/DOMParser/);
  assert.match(source,/new URL\('\.\/'/);
  assert.doesNotMatch(source,/swup|Swup|npm install/i);
  const css=read('assets/css/site.css');
  assert.match(css,/min-height:100svh/);
  assert.match(css,/\.elpa-body > #main \{ flex:1 0 auto/);
  assert.match(css,/\.page-practice > #main \{ min-height:100svh/);
});
