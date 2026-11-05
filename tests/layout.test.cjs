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
  for(const page of ['guide','sources']){
    const fragment=fs.readFileSync(path.join(root,'content/pages',page+'.html'),'utf8').trim();
    assert.ok(fragment.startsWith('<main id="main">')&&fragment.endsWith('</main>'));
    assert.ok(read(page+'.html').includes(fragment));
  }
  assert.ok(read('guide.html').includes('src="./assets/js/guide.js"'));
  assert.ok(read('guide.html').includes('src="./question-bank/taxonomy.js"'));
  assert.ok(!read('sources.html').includes('src="./assets/js/index.js"'));
});
