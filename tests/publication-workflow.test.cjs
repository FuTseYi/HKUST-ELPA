'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/publish-completed-submission.yml'),'utf8');
test('owner-completed closure is the only publishing event',()=>{
  assert.match(workflow,/types: \[closed\]/);
  assert.match(workflow,/github\.event\.sender\.login == 'FuTseYi'/);
  assert.match(workflow,/github\.event\.issue\.state_reason == 'completed'/);
  assert.match(workflow,/github\.event\.issue\.state == 'closed'/);
  assert.doesNotMatch(workflow,/submission:approved/);
});
test('submission jobs queue and clean previous attempts before retrying',()=>{
  assert.match(workflow,/group: elpa-question-bank-publication\n  queue: max/);
  assert.match(workflow,/git reset --hard origin\/main/);
  assert.match(workflow,/git clean -fd -- question-bank\//);
  assert.match(workflow,/git push origin HEAD:main/);
  assert.doesNotMatch(workflow,/git push[^\n]*--force/);
});
test('data publication verifies changes without a second deployment path',()=>{
  assert.match(workflow,/scripts\/check-submission-diff\.cjs/);
  assert.match(workflow,/npm run check\n            npm test/);
  assert.doesNotMatch(workflow,/VERCEL_DEPLOY_HOOK_URL/);
  assert.match(workflow,/if: failure\(\)/);
});
