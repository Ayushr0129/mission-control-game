// Checks that a part failing on the coast hands the map over to the failure scene and the right ending.
// Usage: node scripts/coastfail.cjs   (needs `npm run dev`)
const { chromium } = require('playwright-core');
const { open, toPoll, shot, sleep, check, BASIC } = require('./e2e.cjs');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await open(browser);
  await toPoll(page, BASIC);
  // find a seed where a part fails on the way out, with the burns the autopilot flies
  const seed = await page.evaluate(async () => {
    const m = await import('/src/game/session.ts');
    const s = window.__game.s;
    for (let n = 1; n < 5000; n++) {
      s.current.seed = n;
      const o = m.peek(s, { liftoff: 'fair', tli: 'fair' });
      if (!o.success && o.failedPhase === 'coast' && (o.cause === 'hardware' || o.cause === 'power')) return n;
    }
    return null;
  });
  check(seed !== null, `found a seed that fails on the coast (${seed})`);
  await page.waitForSelector('.btn.launch'); await sleep(300); await page.click('.btn.launch');
  await page.waitForSelector('.fly-layer[data-moment="coast"]', { timeout: 90000 }); await sleep(1500);
  check(await page.evaluate(() => !document.querySelector('.trip-map').hidden), 'the coast plays on the map');
  await page.waitForFunction(() => !document.querySelector('.fly-layer[data-moment="coast"]'), null, { timeout: 60000 });
  await sleep(1500);
  check(await page.evaluate(() => document.querySelector('.trip-map').hidden), 'the map steps aside for the failure scene');
  await shot(page, 'coastfail-1-scene');
  await page.waitForFunction(() => document.body.dataset.screen === 'paper', null, { timeout: 120000 });
  const o = await page.evaluate(() => { const r = window.__game.s.runs.at(-1).outcome; return { failedPhase: r.failedPhase, cause: r.cause }; });
  check(o.failedPhase === 'coast', `the mission is lost on the coast (${o.failedPhase} / ${o.cause})`);
  check(page.errors.length === 0, 'no page errors' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
  await browser.close();
})();
