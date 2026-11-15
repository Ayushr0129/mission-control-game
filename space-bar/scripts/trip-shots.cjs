// Screenshots of each moment of the trip on autopilot. Usage: node scripts/trip-shots.cjs [width height]
const { chromium } = require('playwright-core');
const { open, toPoll, shot, sleep, BASIC } = require('./e2e.cjs');
(async () => {
  const [w, h] = process.argv.slice(2).map(Number);
  const tag = w ? `-${w}` : '';
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await open(browser, '', w ? { width: w, height: h } : undefined);
  await toPoll(page, BASIC);
  await page.waitForSelector('.btn.launch'); await sleep(300); await page.click('.btn.launch');
  const want = [
    ['tli', 'card'], ['tli', 'fly'], ['tli', 'done'], ['coast-out', 0.3], ['coast-out', 0.85], ['orbit', 'fly'],
    ['tei', 'fly'], ['coast-home', 0.5], ['corridor', 'card'], ['corridor', 'fly'], ['reentry', 0.2], ['reentry', 0.8],
  ];
  let i = 0; const t0 = Date.now();
  while (i < want.length && Date.now() - t0 < 300000) {
    const f = await page.evaluate(() => window.__game.fly);
    const [m, p] = want[i];
    let hit = false;
    if (f && m.startsWith('coast') && f.moment === 'coast') hit = (m === 'coast-out') === (f.path === 'out') && f.frac >= p;
    else if (m === 'reentry') { if (await page.$('.fly-layer[data-moment="reentry"]')) { await sleep(p === 0.2 ? 2500 : 7000); hit = true; } }
    else if (f && f.moment === m && f.part === p) hit = true;
    if (hit) { if (m !== 'reentry') await sleep(m === 'tli' && p === 'fly' ? 1500 : 300); await shot(page, `trip${tag}-${String(i).padStart(2, '0')}-${m}-${p}`); console.log('shot', m, p); i++; }
    await sleep(60);
  }
  console.log('errors:', page.errors.join(' | ') || 'none');
  await browser.close();
})();
