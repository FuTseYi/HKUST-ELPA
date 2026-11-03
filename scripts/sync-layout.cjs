'use strict';
/* Shared static layout, rendered into committed HTML. No deployment build required. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pages=['index','guide','practice','submit','sources'];
const navPattern=/<nav class="elpa-nav"[\s\S]*?<\/nav>/;
const footerPattern=/<footer class="elpa-footer"[\s\S]*?<\/footer>/;
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

function renderNavigation(page){
  let nav=read('site-parts/nav.html');
  if(page==='submit'){
    // Preserve the existing compact logo and selected sharing action.
    nav=nav.replace('width="38" height="38"','width="29" height="29"');
    nav=nav.replace('<a class="elpa-nav-submit" href="./submit.html">',
      '<a class="elpa-nav-submit" aria-current="page" href="./submit.html">');
  }else{
    const link='<a href="./'+page+'.html">';
    if(!nav.includes(link))throw Error('Missing navigation link: '+page);
    nav=nav.replace(link,'<a href="./'+page+'.html" class="active" aria-current="page">');
  }
  return nav.trimEnd();
}
function renderPage(page,source){
  const footer=read('site-parts/footer.html').trimEnd();
  if((source.match(new RegExp(navPattern.source,'g'))||[]).length!==1 ||
     (source.match(new RegExp(footerPattern.source,'g'))||[]).length!==1)
    throw Error('Expected one navigation and footer in '+page+'.html');
  return source.replace(navPattern,renderNavigation(page))
    .replace(footerPattern,footer);
}
function run(check){
  for(const page of pages){
    const file=page+'.html',original=read(file),rendered=renderPage(page,original);
    if(check){
      if(rendered!==original)throw Error(file+' layout is out of sync. Run npm run sync:layout.');
    }else if(rendered!==original)fs.writeFileSync(path.join(root,file),rendered);
  }
  console.log(check?'Shared layout is synchronized':'Shared layout updated');
}
if(require.main===module)run(!process.argv.includes('--write'));
module.exports={renderNavigation,renderPage};
