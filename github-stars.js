(() => {
  const link=document.querySelector('.elpa-nav-github');
  if(!link)return;
  const label='觉得有用？去 GitHub 点个 Star';
  link.title=label;
  link.setAttribute('aria-label',label+'（新窗口打开）');
  const count=link.querySelector('.elpa-star-count');
  const key='elpa-github-stars';
  const valid=value=>(Number.isInteger(value)&&value>=0)||(typeof value==='string'&&/^\d+(?:[.,]\d+)*[kmb]?$/i.test(value));
  const show=value=>{
    count.textContent=typeof value==='number'?new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(value):value;
    count.hidden=false;
    link.setAttribute('aria-label',label+' · '+value+' stars（新窗口打开）');
  };
  let cached;
  try{cached=JSON.parse(sessionStorage.getItem(key));}catch(_){}
  if(cached&&valid(cached.count)&&Number.isFinite(cached.time)&&cached.time<=Date.now()&&Date.now()-cached.time<3600000){
    show(cached.count);
    return;
  }
  fetch('https://api.github.com/repos/FuTseYi/HKUST-ELPA',{
    headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(5000)
  }).then(response=>{
    if(!response.ok)throw new Error('GitHub unavailable');
    return response.json();
  }).then(data=>{
    if(!Number.isInteger(data.stargazers_count)||data.stargazers_count<0)throw new Error('Invalid star count');
    return data.stargazers_count;
  }).catch(()=>fetch('https://img.shields.io/github/stars/FuTseYi/HKUST-ELPA.json',{
    signal:AbortSignal.timeout(5000)
  }).then(response=>{
    if(!response.ok)throw new Error('Star count unavailable');
    return response.json();
  }).then(data=>{
    if(!valid(data.value))throw new Error('Invalid star count');
    return data.value;
  })).then(value=>{
    show(value);
    try{sessionStorage.setItem(key,JSON.stringify({count:value,time:Date.now()}));}catch(_){}
  }).catch(()=>{});
})();
