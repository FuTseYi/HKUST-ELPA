document.querySelector('.elpa-nav').addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
  const route = path => path.replace(/\/index\.html$/, '/');
  if (link.origin !== location.origin || route(link.pathname) !== route(location.pathname) || link.search !== location.search || link.hash) return;
  event.preventDefault();
  if (location.hash) history.replaceState(history.state, '', link.pathname + link.search);
  window.scrollTo({top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
});
