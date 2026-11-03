import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { serve } from '../scripts/serve.mjs';

let browser, server, base;
before(async () => {
  server = serve();
  await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ channel: process.env.ATLAS_BROWSER, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function mission(t, options = {}) {
  const page = await browser.newPage({ reducedMotion: 'reduce', ...options });
  t.after(() => page.close());
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'warning') errors.push(message.text()); });
  await page.goto(base);
  return { page, errors };
}

async function phase(page, id) {
  const selector = 'nav a[href="#' + id + '"]';
  await page.locator(selector).click();
  await page.waitForFunction((s) => document.querySelector(s).getAttribute('aria-current') === 'location', selector);
}

test('desktop mission, keyboard navigation, telemetry and opt-in audio', async (t) => {
  const { page, errors } = await mission(t, { viewport: { width: 1440, height: 900 } });
  assert.equal(await page.locator('h1').count(), 1);
  const startup = await page.evaluate(() => performance.getEntriesByType('resource').map(({ name }) => name));
  assert.ok(!startup.some((url) => /\.glb|scene-|\.mp3/.test(url)));
  assert.ok(startup.every((url) => url.startsWith(base)));
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').textContent(), 'Skip to mission');
  await page.keyboard.press('Enter');
  await page.locator('.chapter a').first().press('Enter');
  await page.waitForFunction(() => location.hash === '#ignition' && document.querySelector('nav [aria-current]').hash === '#ignition');
  await phase(page, 'orbit');
  assert.equal(await page.locator('#route-progress').getAttribute('value'), '216');
  await page.locator('#orbit summary').press('Enter');
  assert.ok(await page.locator('#orbit details').getAttribute('open') !== null);
  await phase(page, 'arrival');
  assert.equal(await page.locator('#route-progress').getAttribute('value'), '225');
  await page.getByRole('link', { name: 'Return to Earth' }).click();
  await page.waitForFunction(() => document.querySelector('nav [aria-current]').hash === '#earth');
  await page.getByRole('button', { name: 'Sound off' }).click();
  await page.getByRole('button', { name: 'Sound on', pressed: true }).click();
  await page.getByRole('button', { name: 'Sound off', pressed: false }).waitFor();
  assert.deepEqual(errors, []);
});

test('mobile deep link, touch controls and readable layout', async (t) => {
  const { page, errors } = await mission(t, { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  await page.goto(base + '/#descent');
  await page.waitForFunction(() => document.querySelector('nav [aria-current]').hash === '#descent');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360);
  const header = await page.locator('#descent h2').boundingBox();
  const panel = await page.locator('.console').boundingBox();
  assert.ok(header.y >= panel.y + panel.height, 'Heading should not be hidden by the console');
  await page.locator('nav a[href="#arrival"]').tap();
  await page.waitForFunction(() => document.querySelector('nav [aria-current]').hash === '#arrival');
  assert.equal(await page.locator('#poster').getAttribute('src'), './assets/mars.webp');
  assert.deepEqual(errors, []);
});

test('3D models load by phase, abort failures fall back and retry works', async (t) => {
  const { page, errors } = await mission(t);
  const models = () => page.evaluate(() => performance.getEntriesByType('resource')
    .map((resource) => resource.name.split('/').at(-1))
    .filter((name) => name.endsWith('.glb')));
  const state = page.locator('#scene-status');
  await page.getByRole('button', { name: 'Enable 3D' }).click();
  await state.getByText('3D view', { exact: true }).waitFor();
  assert.ok(await page.locator('#scene').isVisible());
  assert.deepEqual(await models(), ['earth-scene.glb']);

  await phase(page, 'ignition');
  await page.waitForFunction(() => performance.getEntriesByType('resource').some((r) => r.name.endsWith('moon-scene.glb')));
  await phase(page, 'transit');
  await state.getByText('3D view', { exact: true }).waitFor();
  assert.ok((await models()).includes('astronaut-scene.glb'));
  await page.evaluate(() => {
    const fetchModel = window.fetch;
    window.fetch = (url, options) => String(url).endsWith('/mars-scene.glb')
      ? Promise.reject(new TypeError('Simulated network error'))
      : fetchModel(url, options);
    window.restoreFetch = () => { window.fetch = fetchModel; };
  });
  await phase(page, 'orbit');
  await state.getByText(/Model unavailable/).waitFor();
  assert.ok(await page.locator('#poster').isVisible());
  await page.getByRole('button', { name: 'Use illustration' }).click();
  await page.evaluate(() => window.restoreFetch());
  await page.getByRole('button', { name: 'Enable 3D' }).click();
  await state.getByText('3D view', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Use illustration' }).click();
  assert.ok(await page.locator('#poster').isVisible());
  assert.deepEqual(errors, []);
});

test('mission remains navigable with JavaScript disabled', async (t) => {
  const { page } = await mission(t, { javaScriptEnabled: false });
  await page.getByRole('link', { name: 'Begin mission' }).click();
  assert.ok(page.url().endsWith('#ignition'));
  await page.locator('#ignition summary').click();
  assert.equal(await page.locator('#ignition details').getAttribute('open'), '');
});
