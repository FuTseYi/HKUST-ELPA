async page => {
 const root='http://127.0.0.1:8765/promotion/2026-10-17/';
 const out='promotion/2026-10-17/';
 const sets=[
  {id:'01-overview',num:'01',en:'YOUR ELPA STARTING POINT',title:'口语备考，<br>从这里开始。',desc:'考试指南、考生经验、题库与练习记录，一处整理。',shot:'home',tags:['GZ / HK 校区','常规 ELPA / Fast Track','中英导航共存','无需注册'],note:'Student-built · Unofficial · Open source'},
  {id:'02-practice',num:'02',en:'LESS SEARCHING. MORE SPEAKING.',title:'抽一道题，<br>认真说一遍。',desc:'按范围筛题，随机抽题，用计时工具练习表达。',shot:'practice-5',tags:['按校区与场次筛选','随机抽取一道题','模拟 / 倒计时 / 正计时','练后标记掌握状态'],note:'Practise aloud · Build your own rhythm'},
  {id:'03-notes',num:'03',en:'MAKE EVERY PRACTICE COUNT',title:'把回答思路，<br>留给下一次练习。',desc:'题目旁写笔记，记录薄弱点，让每次复习有迹可循。',shot:'notes-5',tags:['逐题记录回答思路','标记练习状态','当前浏览器自动保存','支持备份与导出'],note:'Your notes · Your progress · Saved locally'},
  {id:'04-share',num:'04',en:'BY STUDENTS. FOR STUDENTS.',title:'你的一次分享，<br>是下一位的起点。',desc:'留下考题回忆或备考经验，一起完善这份资源。',shot:'share-4',tags:['贡献考题与提示小问','分享备考经验','无需注册即可填写','投稿公开 · 复核收录'],note:'Share questions & tips · Help the next student'}
 ];
 const stages={practice:[['先选好练习范围','Choose your campus, assessment and filters.'],['打开练习工具','Mock exam, countdown or stopwatch.'],['随机抽题，专注一道','Draw a question from the current filtered results.'],['点击开始，开口回答','Start the timer and practise aloud.'],['查看剩余时间与练习阶段','Mock mode: 1 min preparation + 2 min speaking.']],notes:[['找到一道想练的题','Keep your thinking next to the question.'],['展开「我的笔记」','Open Notes to start your outline.'],['写下思路与改进点','Save an outline, examples and what to improve.'],['标记为「练习中」','Track what you are working on.'],['刷新之后，笔记仍在','Saved in this browser · Back up before moving devices.']],share:[['考题与经验，都可以分享','Two ways to contribute: questions or advice.'],['填写校区、场次和题目','Example input only · No submission is sent.'],['也可以切到「分享经验」','Share preparation tips or exam reflections.'],['选主题，写下你的经验','Example content shown for demonstration.'],['先预览，再确认分享','Preview shown · Public submissions are reviewed.']]};
 function html(s,step){
  const caption=step?`<div class="step"><b>0${step.n}</b><div><strong>${step.zh}</strong><small>${step.en}</small></div><em>${step.n} / 5</em></div>`:`<div class="tags">${s.tags.map((x,i)=>`<div><b>0${i+1}</b>${x}</div>`).join('')}</div>`;
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;width:1080px;height:1440px;background:#f3f6fa;color:#183353;font-family:'Microsoft YaHei','Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
  .top{height:360px;background:#192e4e;color:#fff;padding:38px 48px;position:relative;overflow:hidden}.top:after{content:'${s.num}';position:absolute;right:34px;top:54px;font:200 270px 'Segoe UI';color:#ffffff06;line-height:1}
  .brand{display:flex;align-items:center;gap:12px;font:700 24px 'Segoe UI';letter-spacing:.6px}.brand img{width:34px;height:34px;background:#f3f6fa;border-radius:7px;padding:3px}.brand span{margin-left:auto;font:13px 'Segoe UI';letter-spacing:2px;color:#b8c9e0}
  .kicker{font:600 14px 'Segoe UI';letter-spacing:2.4px;color:#eecd77;margin-top:29px}h1{font-size:53px;line-height:1.28;letter-spacing:-1px;margin:12px 0 15px;font-weight:700;position:relative;z-index:1}p{font-size:21px;color:#c5d4e7;margin:0;position:relative;z-index:1}
  .screen{margin:30px 48px 0;border:1px solid #d6e0ec;border-radius:16px;overflow:hidden;box-shadow:0 15px 40px #1c355012;background:#fff}.bar{height:32px;display:flex;align-items:center;padding:0 14px;background:#fff;border-bottom:1px solid #e5ebf2;gap:6px}.dot{height:6px;width:6px;border-radius:50%;background:#c5d0dd}.url{margin:auto;font:12px 'Segoe UI';color:#74849a}.screen>img{display:block;width:982px;height:auto}
  .tags{margin:28px 48px 0;display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #d7e1ee}.tags div{font-size:21px;padding:20px 0 0;display:flex;gap:16px;align-items:center}.tags b{font:600 13px 'Segoe UI';color:#ad7b22}
  .step{margin:32px 48px 0;display:flex;align-items:center;gap:22px}.step>b{font:300 56px 'Segoe UI';color:#ae7d28}.step strong{font-size:28px;display:block;line-height:1.4}.step small{display:block;font:18px 'Segoe UI';color:#6a7c92;margin-top:7px}.step em{margin-left:auto;font:16px 'Segoe UI';color:#8998aa;white-space:nowrap}
  footer{position:absolute;left:48px;right:48px;top:1315px;border-top:1px solid #d7e1ee;padding-top:22px;display:flex;justify-content:space-between;align-items:center}footer strong{font:600 24px 'Segoe UI';letter-spacing:-.3px}footer small{display:block;font:13px 'Segoe UI';color:#6b7d93;margin-top:10px}.credit{text-align:right;font:13px 'Segoe UI';color:#6b7d93;line-height:1.8}.credit b{color:#193552;font-weight:600}
  </style><div class="top"><div class="brand"><img src="http://127.0.0.1:8765/assets/elpa-mark.svg">HKUST-ELPA<span>SPEAKING PREPARATION</span></div><div class="kicker">${s.en}</div><h1>${s.title}</h1><p>${s.desc}</p></div><div class="screen"><div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><span class="url">hkust-elpa.vercel.app</span></div><img src="${root}raw/${step?step.shot:s.shot}.png"></div>${caption}<footer><div><strong>hkust-elpa.vercel.app</strong><small>${s.note}</small></div><div class="credit">面向 HKUST 与 HKUST(GZ) 同学<br>Initiated by <b>Shine</b> · 非官方备考资源</div></footer>`;
 }
 await page.setViewportSize({width:1080,height:1440});
 for(const s of sets){await page.setContent(html(s));await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:out+s.id+'.png'});}
 for(const [kind,list] of Object.entries(stages)){
  const s=sets.find(s=>s.id.endsWith(kind));
  for(let i=0;i<list.length;i++){await page.setContent(html(s,{n:i+1,zh:list[i][0],en:list[i][1],shot:kind+'-'+(i+1)}));await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:out+'frames/'+kind+'-'+(i+1)+'.png'});}
 }
 return 'Rendered four 1080 x 1440 posters and fifteen annotated demo frames.';
}
