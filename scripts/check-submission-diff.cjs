'use strict';
const {execFileSync}=require('node:child_process');

const allowed=new Set([
  'question-bank/questions.json',
  'question-bank/appearances.json',
  'question-bank/advice.json',
  'question-bank/community-submissions.md',
  'question-bank/community-advice.md'
]);
function checkSubmissionFiles(files){
  if(!files.length)throw Error('No submission changes staged');
  for(const file of files){
    if(!allowed.has(file))throw Error('Unexpected submission file: '+file);
  }
}
if(require.main===module){
  const files=execFileSync('git',['diff','--cached','--name-only','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
  checkSubmissionFiles(files);
  console.log('Submission diff limited to reviewed data files');
}
module.exports={checkSubmissionFiles};
