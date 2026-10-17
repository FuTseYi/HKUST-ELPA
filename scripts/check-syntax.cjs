'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function check(file,module=false){
  const args=module?['--input-type=module','--check']:['--check',file];
  const result=spawnSync(process.execPath,args,{
    cwd:root,input:module?fs.readFileSync(path.join(root,file),'utf8'):undefined,encoding:'utf8'
  });
  if(result.error)throw result.error;
  if(result.status!==0)throw Error('Syntax error in '+file+'\n'+result.stderr);
}
for(const dir of ['js','question-bank','scripts','tests']){
  for(const file of fs.readdirSync(path.join(root,dir))){
    if(/\.(?:js|cjs)$/.test(file))check(path.join(dir,file));
  }
}
for(const file of ['submission-config.js','github-stars.js'])check(file);
check('worker/src/index.js',true);
console.log('JavaScript syntax checks passed');
