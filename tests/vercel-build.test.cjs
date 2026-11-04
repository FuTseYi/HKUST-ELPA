'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('Vercel serves the same Python static build validated in CI',()=>{
  const root=path.resolve(__dirname,'..');
  const settings=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  assert.equal(settings.framework,null);
  assert.equal(settings.buildCommand,'python3 scripts/build-site.py --output output/site');
  assert.equal(settings.outputDirectory,'output/site');
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/site-checks.yml'),'utf8');
  assert.match(workflow,/python scripts\/build-site\.py --output output\/site/);
  assert.match(workflow,/ELPA_SITE_ROOT: output\/site/);
});
