document.querySelector('.elpa-nav').addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
  const route = path => path.replace(/\/index\.html$/, '/');
  if (link.origin !== location.origin || route(link.pathname) !== route(location.pathname) || link.search !== location.search || link.hash) return;
  event.preventDefault();
  if (location.hash) history.replaceState(history.state, '', link.pathname + link.search);
  window.scrollTo({top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
});


/* One persistent shell for public reading and practice routes.
   Each route remains a complete, directly accessible static document. */
const elpaRoutes = new Set(['index.html', 'guide.html', 'practice.html', 'sources.html']);
const elpaBase = new URL('./', location.href).pathname;
const elpaRoute = url => {
  const pathname = url.pathname === elpaBase ? elpaBase + 'index.html' : url.pathname;
  const name = pathname.slice(elpaBase.length);
  return pathname.startsWith(elpaBase) && elpaRoutes.has(name) && !name.includes('/') ? name : null;
};
const elpaCurrentRoute = () => elpaRoute(new URL(location.href));
let elpaActiveRoute = elpaCurrentRoute();
const elpaCache = new Map();
const elpaLoadedScripts = new Set([...document.querySelectorAll('script[src]')].map(tag => new URL(tag.src).href));
const elpaPracticeStyle = document.querySelector('link[rel="stylesheet"][href*="practice.css"]') || null;
let elpaPracticeSheet = elpaPracticeStyle;
let elpaNavigating = false;

if (elpaActiveRoute) {
  elpaCache.set(elpaActiveRoute, {
    main: document.getElementById('main'),
    bodyClass: document.body.className,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || '',
    scripts: [],
  });
}

async function elpaLoadRoute(url, route) {
  if (elpaCache.has(route)) return elpaCache.get(route);
  const response = await fetch(url.href);
  if (!response.ok) throw new Error('Unable to retrieve ' + url.href);
  const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
  const main = parsed.getElementById('main');
  if (!main || !parsed.querySelector('.elpa-nav') || !parsed.querySelector('.elpa-footer'))
    throw new Error('Invalid site document');
  const page = {
    main,
    bodyClass: parsed.body.className,
    title: parsed.title,
    description: parsed.querySelector('meta[name="description"]')?.content || '',
    scripts: [...parsed.querySelectorAll('script[src]')]
      .map(tag => new URL(tag.getAttribute('src'), url.href).href)
      .filter(src => !src.includes('/assets/js/site.js')),
  };
  if (route === 'practice.html' && !elpaPracticeSheet) {
    const style = parsed.querySelector('link[rel="stylesheet"][href*="practice.css"]');
    if (!style) throw new Error('Missing practice stylesheet');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL(style.getAttribute('href'), url.href).href;
    link.media = 'not all';
    document.head.append(link);
    await new Promise((resolve, reject) => {
      link.addEventListener('load', resolve, {once:true});
      link.addEventListener('error', () => reject(new Error('Unable to load practice styles')), {once:true});
    });
    elpaPracticeSheet = link;
  }
  elpaCache.set(route, page);
  return page;
}

function elpaLoadScript(src) {
  if (elpaLoadedScripts.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => { elpaLoadedScripts.add(src); resolve(); };
    script.onerror = () => reject(new Error('Unable to load page script: ' + src));
    document.body.append(script);
  });
}

function elpaSetCurrentNav(route) {
  for (const link of document.querySelectorAll('.elpa-nav a[href]')) {
    const active = elpaRoute(new URL(link.href)) === route;
    link.classList.toggle('active', active && !link.classList.contains('elpa-nav-submit'));
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

async function elpaActivate(page, route, scroll) {
  const current = elpaActiveRoute;
  if (current === 'practice.html' && route !== current)
    window.dispatchEvent(new Event('elpa:practice-leave'));
  if (elpaPracticeSheet) elpaPracticeSheet.media = route === 'practice.html' ? 'all' : 'not all';
  document.getElementById('main').replaceWith(page.main);
  document.body.className = page.bodyClass;
  document.title = page.title;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = page.description;
  elpaSetCurrentNav(route);
  for (const src of page.scripts) await elpaLoadScript(src);
  elpaActiveRoute = route;
  requestAnimationFrame(() => scrollTo({top:scroll, behavior:'instant'}));
}

async function elpaNavigate(url, {pop=false, scroll=0}={}) {
  const route = elpaRoute(url);
  if (!route || elpaNavigating) {
    location.assign(url.href);
    return;
  }
  elpaNavigating = true;
  try {
    const page = await elpaLoadRoute(url, route);
    if (!pop) {
      history.replaceState({...history.state, elpaScroll:scrollY}, '', location.href);
      history.pushState({elpaScroll:0}, '', url.href);
    }
    await elpaActivate(page, route, scroll);
  } catch (error) {
    location.assign(url.href);
  } finally {
    elpaNavigating = false;
  }
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 ||
      event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
      link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
  const url = new URL(link.href);
  const route = elpaRoute(url);
  if (!elpaActiveRoute || !route || url.origin !== location.origin || url.search || url.hash ||
      route === elpaActiveRoute || elpaNavigating) return;
  event.preventDefault();
  void elpaNavigate(url);
});
window.addEventListener('popstate', event => {
  const url = new URL(location.href);
  if (elpaActiveRoute && elpaRoute(url) && elpaRoute(url) !== elpaActiveRoute)
    void elpaNavigate(url, {pop:true, scroll:event.state?.elpaScroll || 0});
});
