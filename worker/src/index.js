/* Anonymous ELPA submissions: minimal, fail-closed Cloudflare Worker.
 * Deploy separately from GitHub Pages. Secrets must never enter this repository.
 */
// Only production origins, never preview domains or wildcard subdomains.
const ORIGINS = new Set(['https://futseyi.github.io', 'https://hkust-elpa.vercel.app']);
const OWNER = 'FuTseYi';
const REPO = 'HKUST-ELPA';
const MAX_BODY_BYTES = 24576;

function json(payload, status = 200, origin = false) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(origin ? {
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      } : {})
    }
  });
}
function invalid(message, status = 400, origin = false) {
  return json({ok:false,message}, status, origin);
}
async function readLimitedJSON(request) {
  if (!request.body) throw new Error('missing body');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new Error('payload too large');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let i = 0;
  for (const chunk of chunks) {bytes.set(chunk,i);i+=chunk.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
function validText(value, min, max) {
  return typeof value === 'string' &&
    value.trim().length >= min && value.trim().length <= max &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
}
function encodeBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let ascii = '';
  for (const byte of bytes) ascii += String.fromCharCode(byte);
  return btoa(ascii).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
/* v2 values are validated again by the GitHub importer; don't trust browser checks. */
const ADVICE_TAGS = new Set([
  'exam-process','speaking-strategy','time-management','stress-management',
  'english-expression','ai-learning','exam-experience'
]);
const EXAM_STAGES = new Set(['start','mid','end']);
const ADVICE_PHASES = new Set(['before','during','after']);
function validV2(body) {
  if(!body||body.version!==2||!validText(body.turnstileToken,1,2048)) return false;
  if(body.kind==='question')
    return /^20\d{2} (Spring|Fall)$/.test(body.term||'') &&
      EXAM_STAGES.has(body.examStage) && body.main &&
      validText(body.main.en,8,1000) && validText(body.main.cn,4,1000) &&
      Array.isArray(body.subs) && body.subs.length<=20 &&
      body.subs.every(s=>s&&validText(s.en,1,400)&&validText(s.cn,1,400)) &&
      ['firsthand','secondhand'].includes(body.source);
  if(body.kind==='advice')
    return ADVICE_PHASES.has(body.phase) &&
      Array.isArray(body.tags) && body.tags.length>=1 && body.tags.length<=4 &&
      new Set(body.tags).size===body.tags.length && body.tags.every(tag=>ADVICE_TAGS.has(tag)) &&
      validText(body.title,4,120) && validText(body.body,20,6000);
  return false;
}
function cleanV2(body){
  if(body.kind==='question')return {
    version:2,kind:'question',term:body.term,examStage:body.examStage,
    main:{en:body.main.en.trim(),cn:body.main.cn.trim()},
    subs:body.subs.map(s=>({en:s.en.trim(),cn:s.cn.trim()})),source:body.source
  };
  return {version:2,kind:'advice',phase:body.phase,tags:[...body.tags],
    title:body.title.trim(),body:body.body.trim()};
}
const mdQuote=t=>String(t).split('\n').map(s=>'> '+s.replace(/</g,'&lt;')).join('\n');
function formatV2(record){
  if(record.kind==='advice'){
    return {
      title:'[ELPA 投稿] [备考经验] '+record.title.replace(/\s+/g,' ').slice(0,65),
      body:['## ELPA 备考经验投稿（待审核）','',
        '> 公开匿名投稿；内容为个人经验，尚未经核实。',
        '', '**阶段：** '+record.phase,
        '**主题标签：** '+record.tags.join(', '),
        '', '### 标题',mdQuote(record.title),'',
        '### 正文',mdQuote(record.body),'',
        '<!-- elpa-submission-v2:'+encodeBase64Url(JSON.stringify(record))+' -->'].join('\n')
    };
  }
  const lines=[
    '## ELPA 考题投稿（待审核）','',
    '> 公开匿名投稿；考生回忆非学校官方原题。',
    '', '**考试学期：** '+record.term,
    '**考试阶段：** '+record.examStage,
    '**来源：** '+(record.source==='firsthand'?'本人亲历':'同学转述'),
    '', '### 主问题 / English',mdQuote(record.main.en),
    '', '### 主问题 / 中文',mdQuote(record.main.cn),'',
    '### 提示小问（'+record.subs.length+'）'
  ];
  for(const [i,sub] of record.subs.entries())lines.push('','**小问 '+(i+1)+' / English**',mdQuote(sub.en),
    '**小问 '+(i+1)+' / 中文**',mdQuote(sub.cn));
  if(!record.subs.length)lines.push('> 未记录');
  lines.push('','<!-- elpa-submission-v2:'+encodeBase64Url(JSON.stringify(record))+' -->');
  return {title:'[ELPA 投稿] ['+record.term+'/'+record.examStage+'] '+
    record.main.en.replace(/\s+/g,' ').slice(0,65),body:lines.join('\n')};
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const originOK = ORIGINS.has(origin);
    if (request.method === 'GET' && url.pathname === '/health')
      return json({ok:true,service:'elpa-submission'});
    if (url.pathname !== '/submit') return json({ok:false,message:'Not found'},404);
    if (!originOK) return json({ok:false,message:'Forbidden'},403);
    if (request.method === 'OPTIONS')
      return new Response(null,{status:204,headers:{
        'Access-Control-Allow-Origin':origin,'Vary':'Origin',
        'Access-Control-Allow-Methods':'POST, OPTIONS',
        'Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'
      }});
    // All subsequent errors inherit the verified request origin, not a wildcard.
    const reject=(message,status=400)=>invalid(message,status,origin);
    if (request.method !== 'POST') return reject('Method not allowed',405);
    if (env.SUBMISSIONS_DISABLED !== 'false') return reject('投稿暂时关闭，请稍后再试。',503);
    // The API only operates in an explicitly selected mode.
    const testMode = env.SUBMISSION_MODE === 'test';
    if (!testMode && env.SUBMISSION_MODE !== 'public')
      return reject('投稿服务尚未开放。',503);
    if (testMode) {
      const deadline = Number(env.SUBMISSION_TEST_DEADLINE_MS);
      if (!/^\d{13}$/.test(String(env.SUBMISSION_TEST_DEADLINE_MS || '')) ||
          !Number.isSafeInteger(deadline) || Date.now() >= deadline)
        return reject('本次测试窗口已结束。',503);
    }
    if (!env.GITHUB_TOKEN || !env.TURNSTILE_SECRET || !env.SUBMISSION_LIMITER)
      return reject('投稿服务尚未配置完成。',503);
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || ''))
      return reject('仅支持 JSON 格式。',415);
    const length = Number(request.headers.get('Content-Length')||0);
    if (length > MAX_BODY_BYTES) return reject('内容过长。',413);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    try {
      const limited = await env.SUBMISSION_LIMITER.limit({key:ip});
      if (!limited.success) return reject('提交过于频繁，请稍后再试。',429);
    } catch {
      return reject('投稿服务暂时繁忙。',503); // fail closed
    }
    let body;
    try {body = await readLimitedJSON(request);}
    catch {return reject('投稿数据无效或内容过长。',400);}
    const isV2=body&&body.version===2;
    let turnstileToken;
    if(isV2){
      if(testMode)return reject('测试窗口仅接受指定旧版测试内容。',403);
      if(!validV2(body))return reject('请检查双语内容、分类和字符长度。');
      turnstileToken=body.turnstileToken;
    }else{
      const {term,question,subquestions,source,turnstileToken:token} = body || {};
      const termOK = typeof term==='string' && (/^20\d{2} (Spring|Fall)$/.test(term) || term==='Other / Unknown');
      if (!termOK || !validText(question,8,1000) ||
          !validText(subquestions,0,2000) ||
          !['firsthand','secondhand'].includes(source) ||
          !validText(token,1,2048))
        return reject('请检查必填项、内容格式和字符长度。');
      if (testMode &&
         (question.trim() !== env.SUBMISSION_TEST_QUESTION ||
          term !== '2026 Fall' || subquestions.trim() !== '' || source !== 'firsthand'))
        return reject('测试窗口只接收指定测试内容。',403);
      turnstileToken=token;
    }
    // Never send unverified submissions to GitHub.
    let verified;
    try {
      const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:turnstileToken,remoteip:ip}),
        signal:AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('Turnstile unavailable');
      verified=await response.json();
    }catch{
      return reject('人机验证暂不可用，请稍后重试。',503);
    }
    if (!verified.success || verified.hostname!==new URL(origin).hostname || verified.action!=='elpa_submit')
      return reject('人机验证失败或已过期，请重试。',403);
    let title,issueBody;
    if(isV2){
      ({title,body:issueBody}=formatV2(cleanV2(body)));
    }else{
      // Legacy issue shape must remain unchanged for still-pending v1 reports.
      const {term,question,subquestions,source}=body;
      const record={version:1,term,question:question.trim(),subquestions:subquestions.trim(),source};
      const encoded=encodeBase64Url(JSON.stringify(record));
      const quoted=(t)=>t.split('\n').map(s=>'> '+s).join('\n');
      issueBody=[
        '## ELPA 新题投稿（待审核）','',
        '> 本 Issue 为公开匿名投稿。**未审核，不代表正式题库或官方原题。**','',
        '**场次：** '+term,
        '**来源：** '+(source==='firsthand'?'本人亲历':'同学转述'),
        '', '### 主问题',quoted(record.question),
        '', '### 提示小问',
        record.subquestions?quoted(record.subquestions):'> 未记录',
        '', '<!-- elpa-submission-v1:'+encoded+' -->'
      ].join('\n');
      title='[ELPA 投稿] ['+term+'] '+record.question.replace(/\s+/g,' ').slice(0,70);
    }
    let github;
    try {
      const response=await fetch('https://api.github.com/repos/'+OWNER+'/'+REPO+'/issues',{
        method:'POST',
        headers:{
          'Authorization':'Bearer '+env.GITHUB_TOKEN,
          'Accept':'application/vnd.github+json',
          'X-GitHub-Api-Version':'2022-11-28',
          'User-Agent':'HKUST-ELPA-Submission'
        },
        body:JSON.stringify({title,body:issueBody,labels:['submission:pending']}),
        signal:AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('GitHub issue create failed: '+response.status);
      github=await response.json();
    }catch(e){
      console.error('Submission delivery failed',String(e));
      return reject('投稿暂时未能保存，请稍后重试。',503);
    }
    return json({ok:true,issueUrl:github.html_url},201,origin);
  }
};
