import { createSound } from './sound.js';

const find = (id) => document.getElementById(id);
const chapters = [...document.querySelectorAll('.chapter')];
const links = [...document.querySelectorAll('.phase-index a')];
const viewport = find('viewport');
const consolePanel = viewport.closest('.console');
const canvas = find('scene');
const poster = find('poster');
const status = find('scene-status');
const toggle = find('enable-scene');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-width: 850px) and (min-height: 541px)');
const sound = createSound(find('sound'));
const art = { earth: 'earth.webp', mars: 'mars.webp', transit: 'transit.svg' };
let active = -1;
let queued = 0;
let viewer;
let opening = false;
let panelVisible = true;

function update() {
  queued = 0;
  const boundary = compact.matches
    ? Math.min(innerHeight - 32, Math.max(innerHeight * .55, consolePanel.getBoundingClientRect().bottom + 32))
    : innerHeight * .45;
  let next = 0;
  for (let i = 1; i < chapters.length; i++) {
    if (chapters[i].getBoundingClientRect().top > boundary) break;
    next = i;
  }
  if (next !== active) {
    const chapter = chapters[next];
    const { art: illustration, distance } = chapter.dataset;
    links.forEach((link, index) => {
      if (index === next) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    find('view-label').textContent = illustration === 'transit' ? 'DEEP SPACE' : illustration.toUpperCase();
    viewport.dataset.art = illustration;
    const source = './assets/' + art[illustration];
    if (poster.getAttribute('src') !== source) poster.src = source;
    find('distance').firstChild.nodeValue = distance + ' ';
    find('route-progress').value = Number(distance);
    active = next;
    viewer?.show(next);
  }
  const bounds = chapters[next].getBoundingClientRect();
  viewer?.position(Math.max(0, Math.min(1, (boundary - bounds.top) / bounds.height)));
}

function schedule() {
  if (!queued) queued = requestAnimationFrame(update);
}

addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', schedule);
addEventListener('hashchange', schedule);
new ResizeObserver(([entry]) => {
  const height = entry.borderBoxSize[0].blockSize;
  document.documentElement.style.setProperty('--console-height', height + 'px');
  schedule();
}).observe(consolePanel);
const observer = new IntersectionObserver(([entry]) => {
  panelVisible = entry.isIntersecting;
  viewer?.setVisible(panelVisible && !document.hidden);
});
observer.observe(viewport);

function showPoster(message = 'Illustrated view') {
  canvas.hidden = true;
  poster.hidden = false;
  status.textContent = message;
}

function closeViewer(message) {
  viewer?.dispose();
  viewer = undefined;
  toggle.setAttribute('aria-pressed', 'false');
  toggle.textContent = 'Enable 3D';
  showPoster(message);
}

toggle.hidden = false;
toggle.addEventListener('click', async () => {
  if (viewer) return closeViewer();
  if (opening) return;
  opening = true;
  toggle.disabled = true;
  status.textContent = 'Starting 3D…';
  try {
    const { createViewer } = await import('./scene.js');
    viewer = createViewer({
      canvas, viewport, reducedMotion,
      pending: () => showPoster('Loading 3D model…'),
      ready: () => {
        canvas.hidden = false;
        poster.hidden = true;
        status.textContent = '3D view';
      },
      failed: () => showPoster('Model unavailable · change phase or retry 3D'),
      lost: () => closeViewer('3D interrupted · try again'),
    });
    toggle.setAttribute('aria-pressed', 'true');
    toggle.textContent = 'Use illustration';
    viewer.setVisible(panelVisible && !document.hidden);
    viewer.show(Math.max(active, 0));
    schedule();
  } catch {
    closeViewer('3D unavailable · illustration shown');
  } finally {
    opening = false;
    toggle.disabled = false;
  }
});

document.addEventListener('visibilitychange', () => {
  viewer?.setVisible(panelVisible && !document.hidden);
  sound.setVisible(!document.hidden);
});
addEventListener('pagehide', (event) => {
  if (event.persisted) {
    viewer?.setVisible(false);
    sound.setVisible(false);
  } else {
    viewer?.dispose();
    sound.dispose();
  }
});
addEventListener('pageshow', () => {
  viewer?.setVisible(panelVisible && !document.hidden);
  sound.setVisible(!document.hidden);
  schedule();
});
schedule();
