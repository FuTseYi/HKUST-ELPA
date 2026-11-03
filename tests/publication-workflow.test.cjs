'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/publish-completed-submission.yml'),'utf8');

test('only owner-completed closures publish; reopening only changes review labels',()=>{
  assert.match(workflow,/types: \[closed, reopened\]/);
  assert.match(workflow,/github\.event\.issue\.state_reason == 'completed'/);
  assert.match(workflow,/github\.event\.sender\.login == 'FuTseYi'/);
  assert.match(workflow,/startsWith\(github\.event\.issue\.title, '\[ELPA 投稿\]'\)/);
  assert.match(workflow,/if: \$\{\{ github\.event\.action == 'closed' && github\.event\.issue\.state_reason == 'completed' && github\.event\.sender\.login == 'FuTseYi' \}\}/);
  assert.doesNotMatch(workflow,/submission:approved/);
});

test('submission jobs queue and retry from clean main without forced writes',()=>{
  assert.match(workflow,/group: elpa-question-bank-publication\n  queue: max/);
  assert.match(workflow,/git reset --hard origin\/main/);
  assert.match(workflow,/git clean -fd -- question-bank\//);
  assert.match(workflow,/git push origin HEAD:main/);
  assert.doesNotMatch(workflow,/git push[^\n]*--force/);
});

test('publication keeps data validation and does not introduce another deploy path',()=>{
  assert.match(workflow,/scripts\/check-submission-diff\.cjs/);
  assert.match(workflow,/npm run check\n            npm test/);
  assert.doesNotMatch(workflow,/VERCEL_DEPLOY_HOOK_URL/);
  assert.match(workflow,/if: \$\{\{ failure\(\) && steps\.publish\.outcome == 'failure' \}\}/);
});

test('labels represent review and data status independently',()=>{
  for(const label of ['submission:pending','submission:published','submission:failed'])
    assert.ok(workflow.includes(label),label+' missing');
  assert.match(workflow,/gh label create submission:published/);
  assert.match(workflow,/gh label create submission:failed/);
  assert.match(workflow,/if \[\[ "\$EVENT_ACTION" == "reopened" \]\]; then[\s\S]*?add submission:pending[\s\S]*?remove submission:failed/);
  assert.match(workflow,/if \[\[ "\$CLOSE_REASON" == "completed" && "\$CLOSING_USER" == "FuTseYi" && "\$RECORDED" == "true" \]\]; then\n              add submission:published/);
  assert.match(workflow,/if ! gh issue view[\s\S]*?grep -Fxq 'submission:published'; then/);
  assert.match(workflow,/steps\.publish\.outcome == 'failure'/);
});

test('an unchanged import is published only for a complete recorded Issue ID',()=>{
  assert.match(workflow,/recorded=true/);
  assert.match(workflow,/recorded=false/);
  assert.match(workflow,/Issue #\$\{ISSUE_NUMBER\}\(\[\^\[:digit:\]\]\|\$\)/);
  assert.match(workflow,/issueNumber/);
});
