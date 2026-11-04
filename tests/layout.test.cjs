'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {renderNavigation,renderPage}=require('../scripts/sync-layout.cjs');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('all five pages are derived from one navigation and footer',()=>{
  for(const page of ['index','guide','practice','submit','sources']){
    const html=read(page+'.html');
    assert.equal(renderPage(page,html),html,'Unsynchronized shared layout: '+page);
    const nav=renderNavigation(page);
    assert.equal((nav.match(/aria-current="page"/g)||[]).length,1);
    if(page==='submit')assert.match(nav,/elpa-nav-submit" aria-current="page"/);
    else assert.ok(nav.includes('href="./'+page+'.html" class="active" aria-current="page"'));
  }
});
test('generated layout replaces drift instead of adding another independent copy',()=>{
  const html=read('guide.html');
  const tampered=html.replace('Speaking Preparation','Outdated Branding');
  assert.notEqual(tampered,html);
  assert.equal(renderPage('guide',tampered),html);
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
