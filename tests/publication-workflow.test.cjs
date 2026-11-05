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
  assert.match(workflow,/actions\/setup-python@v7/);
  assert.match(fs.readFileSync(path.join(__dirname,'../scripts/validate-site.cjs'),'utf8'),/'preview\.py','--build-only'/);
  assert.match(workflow,/node scripts\/validate-site\.cjs\n            node --test/);
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

test('publication trusts the importer result rather than parsing bank files in shell',()=>{
  assert.match(workflow,/node scripts\/import-completed-submission\.cjs/);
  assert.match(workflow,/RECORDED: \$\{\{ steps\.publish\.outputs\.recorded \}\}/);
  assert.doesNotMatch(workflow,/grep -Eq/);
  assert.doesNotMatch(workflow,/echo "recorded=(?:true|false)"/);
});

// Importer-owned publication status, verified with real temp fixtures.
const os=require('node:os');
const {spawnSync}=require('node:child_process');
function importFixture(version,number,question){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'elpa-publication-'));
  try{
    fs.mkdirSync(path.join(dir,'question-bank'));
    for(const name of ['questions.json','appearances.json','advice.json','taxonomy.json'])
      fs.copyFileSync(path.join(__dirname,'../question-bank',name),path.join(dir,'question-bank',name));
    const record=version===1?
      {version:1,term:'2027 Fall',question,subquestions:'',source:'firsthand'}:
      {version:2,kind:'question',term:'2027 Fall',examStage:'start',
        main:{en:question,cn:''},subs:[],source:'firsthand'};
    const marker=Buffer.from(JSON.stringify(record)).toString('base64url');
    const issue={number,title:'[ELPA 投稿] [2027 Fall] Example',
      body:'<!-- elpa-submission-v'+version+':'+marker+' -->'};
    const eventFile=path.join(dir,'event.json'),outputFile=path.join(dir,'output.txt');
    fs.writeFileSync(eventFile,JSON.stringify({issue}));
    const run=()=>{
      fs.writeFileSync(outputFile,'');
      const result=spawnSync(process.execPath,[path.join(__dirname,'../scripts/import-completed-submission.cjs')],
        {cwd:dir,env:{...process.env,GITHUB_EVENT_PATH:eventFile,GITHUB_OUTPUT:outputFile},encoding:'utf8'});
      assert.equal(result.status,0,result.stderr);
      return fs.readFileSync(outputFile,'utf8');
    };
    return {first:run(),second:run()};
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('importer confirms the same v1 Issue when repeated',()=>{
  const result=importFixture(1,900101,'How do you explain your research to visitors in a laboratory?');
  assert.match(result.first,/recorded=true/);
  assert.match(result.second,/recorded=true/);
});
test('importer confirms the same v2 Issue when repeated',()=>{
  const result=importFixture(2,900102,'What strategies help your research team collaborate effectively?');
  assert.match(result.first,/recorded=true/);
  assert.match(result.second,/recorded=true/);
});
test('matching existing v1 question without its Issue is not considered published',()=>{
  const result=importFixture(1,900103,'Explain one of your projects.');
  assert.match(result.first,/result=duplicate/);
  assert.match(result.first,/recorded=false/);
  assert.match(result.second,/recorded=false/);
});

test('one importer entrypoint handles legacy and structured Issues',()=>{
  const importSource=fs.readFileSync(path.join(__dirname,'../scripts/import-completed-submission.cjs'),'utf8');
  assert.match(importSource,/function importV2\(event\)/);
  assert.match(importSource,/elpa-submission-v1:/);
  assert.match(importSource,/elpa-submission-v2:/);
  assert.ok(!fs.existsSync(path.join(__dirname,'../scripts/import-v2-submission.cjs')));
});
