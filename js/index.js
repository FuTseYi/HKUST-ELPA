document.querySelectorAll('.elpa-home-help').forEach(help=>{
  help.addEventListener('toggle',()=>{
    if(!help.open)return;
    requestAnimationFrame(()=>{
      if(!help.open)return;
      const card=help.closest('.elpa-home-feature');
      const navHeight=document.querySelector('.elpa-nav').getBoundingClientRect().height;
      window.scrollTo({
        top:window.scrollY+card.getBoundingClientRect().top-navHeight-16,
        behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'
      });
    });
  });
});
