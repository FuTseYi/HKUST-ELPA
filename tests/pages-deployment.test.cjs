'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('Pages and Vercel publish the identical Python-built site directory',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/deploy-pages.yml'),'utf8');
  const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  assert.equal(vercel.outputDirectory,'_site');
  assert.match(workflow,/node scripts\/validate-site\.cjs/);
  assert.match(workflow,/node --test/);
  assert.match(workflow,/python -m unittest discover/);
  assert.match(fs.readFileSync(path.join(root,'scripts/validate-site.cjs'),'utf8'),/preview\.py','--build-only'/);
  assert.match(workflow,/actions\/upload-pages-artifact@v5[\s\S]*?path: _site/);
  assert.match(workflow,/actions\/deploy-pages@v5/);
});

test('Pages handles manual pushes and owner-approved Issue publication without unsafe checkout',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/deploy-pages.yml'),'utf8');
  assert.match(workflow,/push:\n    branches: \[main\]/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/workflow_run:\n    workflows: \["Publish completed ELPA submissions"\]/);
  assert.match(workflow,/workflow_run\.conclusion == 'success'/);
  assert.match(workflow,/workflow_run\.event == 'issues'/);
  assert.match(workflow,/github\.sha != github\.event\.workflow_run\.head_sha/);
  assert.match(workflow,/ref: main/);
  assert.doesNotMatch(workflow,/ref:\s*\$\{\{.*head_sha/);
  assert.match(workflow,/pages: write\n  id-token: write/);
  assert.match(workflow,/group: elpa-pages-deployment/);
});
