document.querySelectorAll('.elpa-home-help,.elpa-home-share-help').forEach(help=>{
  help.addEventListener('toggle',()=>{
    if(!help.open)return;
    requestAnimationFrame(()=>{
      if(!help.open)return;
      const card=help.closest('article');
      const navHeight=document.querySelector('.elpa-nav').getBoundingClientRect().height;
      window.scrollTo({
        top:window.scrollY+card.getBoundingClientRect().top-navHeight-16,
        behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'
      });
    });
  });
});

document.querySelectorAll('.elpa-home-demo-play').forEach(button=>{
  const image=button.closest('figure').querySelector('img');
  const poster=image.getAttribute('src');
  button.addEventListener('click',()=>{
    const playing=button.getAttribute('aria-pressed')!=='true';
    image.src=playing?image.dataset.demo:poster;
    button.setAttribute('aria-pressed',String(playing));
    button.textContent=playing?'停止演示 · Stop demo':'播放演示 · Play demo';
  });
  button.closest('details').addEventListener('toggle',event=>{
    if(!event.currentTarget.open&&button.getAttribute('aria-pressed')==='true')button.click();
  });
});
