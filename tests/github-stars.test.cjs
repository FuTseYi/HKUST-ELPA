'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../github-stars.js'),'utf8');
async function run({cached=null,primary={stargazers_count:12},fallback={value:'2'},failPrimary=false,failFallback=false}={}){
  const count={hidden:true,textContent:''},attributes={},calls=[];
  const link={querySelector:()=>count,setAttribute:(key,value)=>{attributes[key]=value;}};
  let saved=cached===null?null:JSON.stringify(cached);
  vm.runInNewContext(source,{
    document:{querySelector:()=>link},Intl,Date,AbortSignal,
    sessionStorage:{getItem:()=>saved,setItem:(_,value)=>{saved=value;}},
    fetch:async url=>{
      const primaryURL=url.includes('api.github.com');
      calls.push(url);
      return {ok:!(primaryURL?failPrimary:failFallback),json:async()=>primaryURL?primary:fallback};
    }
  });
  await new Promise(setImmediate);
  return {count,attributes,calls,saved:saved&&JSON.parse(saved)};
}
test('official count is preferred and zero is visible',async()=>{
  const result=await run({primary:{stargazers_count:0}});
  assert.equal(result.count.textContent,'0');assert.equal(result.count.hidden,false);
  assert.equal(result.calls.length,1);assert.equal(result.saved.count,0);
});
test('rate-limited or malformed official responses use the fallback',async()=>{
  for(const settings of [{failPrimary:true},{primary:{message:'unavailable'}}]){
    const result=await run(settings);
    assert.equal(result.count.textContent,'2');assert.equal(result.count.hidden,false);
    assert.equal(result.calls.length,2);assert.match(result.calls[1],/img\.shields\.io/);
  }
});
test('both providers unavailable leaves the link usable without a fabricated count',async()=>{
  const result=await run({failPrimary:true,failFallback:true});
  assert.equal(result.count.hidden,true);assert.equal(result.saved,null);
  assert.match(result.attributes['aria-label'],/GitHub/);
});
test('fresh cache avoids requests; expired or future-dated cache refreshes',async()=>{
  const fresh=await run({cached:{count:'2',time:Date.now()-1000}});
  assert.equal(fresh.calls.length,0);assert.equal(fresh.count.textContent,'2');
  for(const time of [Date.now()-3600001,Date.now()+3600000,'not-a-date']){
    const result=await run({cached:{count:999,time}});
    assert.equal(result.calls.length,1);assert.equal(result.count.textContent,'12');
  }
});
