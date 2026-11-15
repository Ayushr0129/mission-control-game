// Plays the game end to end in the Chrome installed on this machine.
// Usage: node scripts/e2e.cjs [stage ...]     stages: build phone auto fly pad idle crash heavy retry phonefly (default: all)
// Needs the game running: `npm run dev` (http://localhost:5173), or set BASE to another address.
// Uses ?quick=1 so story decisions and the launch commit on a click instead of a hold.
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'e2e-out'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stages = process.argv.slice(2).length ? process.argv.slice(2) : ['build', 'phone', 'auto', 'fly', 'pad', 'idle', 'crash', 'heavy', 'retry', 'phonefly'];
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}`); if (!ok) failures++; };

const BASIC = { 'nav-route': 'lor', 'eng-docking': 'robust', 'eng-power': 'standard', 'sci-antenna': 'small', 'sci-instruments': 'min', 'nav-disposal': 'leave' };
const HEAVY = { 'nav-route': 'direct', 'eng-power': 'extra', 'sci-antenna': 'large', 'sci-instruments': 'full', 'nav-disposal': 'solar' };

async function open(browser, query, viewport = { width: 1280, height: 720 }) {
  const page = await browser.newPage({ viewport });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|GPU stall|WebGL/.test(m.text())) page.errors.push(m.text()); });
  await page.goto(`${BASE}/?seed=12345&quick=1${query ? '&' + query : ''}`);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  await page.reload(); await sleep(1500);
  return page;
}
const screenOf = (page) => page.evaluate(() => document.body.dataset.screen);
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });

/** answer the story decision on screen with option `idx`, then continue */
async function answerScene(page, idx = 0) {
  await page.waitForSelector('.options:not([hidden])');
  const opts = await page.$$('.option'); await opts[Math.min(idx, opts.length - 1)].click();
  await page.waitForSelector('.after .btn.primary'); await page.click('.after .btn.primary');
}
/** deal with whatever interrupted the build until the build screen is back */
async function settle(page, cabinIdx = 1) {
  for (let guard = 0; guard < 12; guard++) {
    await sleep(450);
    const scr = await screenOf(page);
    if (scr === 'news') { await page.click('.newsflash .btn.primary'); continue; }
    if (scr === 'scene') { await answerScene(page, cabinIdx); continue; }
    if (scr === 'build' && !(await page.$('.incoming'))) return;
  }
  throw new Error('the build never came back');
}
async function toBuild(page) {
  await page.click('text=Take the job'); await sleep(400);
  await page.click('.skip-text').catch(() => {});
  await page.waitForSelector('.brief-rest.in'); await page.click('.brief-rest .btn.primary');
  for (let i = 0; i < 2; i++) { await page.waitForFunction(() => document.body.dataset.screen === 'scene'); await answerScene(page, i === 0 ? 1 : 1); await sleep(150); }
  await page.waitForFunction(() => document.body.dataset.screen === 'build');
}
async function fit(page, q, o) {
  await page.click(`.slot[data-q="${q}"]`); await page.click(`.part[data-o="${o}"]`);
  await settle(page);
}
async function buildAll(page, parts) {
  await fit(page, 'nav-route', parts['nav-route']);
  for (const [q, o] of Object.entries(parts)) if (q !== 'nav-route') await fit(page, q, o);
  for (let guard = 0; guard < 6; guard++) { // let the world finish interrupting
    const label = (await page.textContent('.btn.rollout')).trim();
    if (label !== 'Continue') break;
    await page.click('.btn.rollout'); await settle(page);
  }
}
async function toPoll(page, parts) {
  await toBuild(page); await buildAll(page, parts);
  await page.click('.btn.rollout');
  await page.waitForFunction(() => document.body.dataset.screen === 'poll');
}

const run = {
  async build(browser) {
    console.log('build screen');
    const page = await open(browser);
    await toBuild(page); await sleep(600);
    await shot(page, 'build-1-empty');
    check(await page.$eval('.slot[data-q="eng-power"]', (e) => e.disabled), 'other spots wait for a lander');
    check(await page.$eval('.btn.rollout', (e) => e.disabled), 'cannot roll out an empty rocket');
    await fit(page, 'nav-route', 'lor');
    await fit(page, 'eng-docking', 'basic');
    check(!!(await page.$('.conflict-warn')), 'small lander with manual docking warns at once');
    check((await page.evaluate(() => window.__game.s.current.fired)) === 1, 'the first news interrupted after the second part');
    await fit(page, 'eng-docking', 'robust');
    check(!(await page.$('.conflict-warn')), 'swapping the docking clears the warning');
    check((await page.evaluate(() => window.__game.s.current.fired)) === 1, 'a swap does not bring another interruption');
    await fit(page, 'eng-power', 'standard');
    check((await page.evaluate(() => window.__game.s.current.decisions['eng-cabin'])) !== undefined, 'the cabin scare interrupted after the third part');
    await shot(page, 'build-2-half');
    await fit(page, 'sci-antenna', 'small'); await fit(page, 'sci-instruments', 'min'); await fit(page, 'nav-disposal', 'leave');
    check((await page.evaluate(() => window.__game.s.current.fired)) === 3, 'all three interruptions have happened');
    await fit(page, 'nav-route', 'direct');
    check(/Not needed/.test(await page.textContent('.slot[data-q="eng-docking"]')), 'docking is not needed on the lander that never docks');
    check((await page.evaluate(() => window.__game.s.current.decisions['eng-docking'])) === undefined, 'the fitted docking system came off');
    await fit(page, 'nav-route', 'lor'); await fit(page, 'eng-docking', 'robust');
    check((await page.textContent('.btn.rollout')).trim() === 'Roll out to the launch poll', 'the button offers the roll-out');
    await shot(page, 'build-3-full');
    await page.click('.btn.rollout'); await page.waitForFunction(() => document.body.dataset.screen === 'poll');
    check(true, 'rolled out to the launch poll');
    check(page.errors.length === 0, 'no page errors' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
    await page.close();
  },
  async phone(browser) {
    console.log('phone width');
    const page = await open(browser, '', { width: 390, height: 844 });
    await toBuild(page); await sleep(600);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= 390), 'no sideways scroll on the build screen');
    await fit(page, 'nav-route', 'lor'); await sleep(300);
    await shot(page, 'phone-build');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= 390), 'still no sideways scroll after fitting a part');
    check(page.errors.length === 0, 'no page errors' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
    await page.close();
  },
  async auto(browser) {
    console.log('a whole flight on autopilot');
    const page = await open(browser);
    await toPoll(page, BASIC); await launch(page);
    await page.waitForSelector('.fly-layer[data-moment="liftoff"]', { timeout: 20000 });
    await shot(page, 'auto-1-liftoff');
    await page.waitForSelector('.fly-layer[data-moment="landing"]', { timeout: 90000 }); await sleep(2500);
    await shot(page, 'auto-2-landing');
    await toReport(page);
    const o = await lastOutcome(page);
    check(o.cause !== 'piloting', `the autopilot never loses the landing (ended: ${o.success ? 'landed' : o.failedPhase + ' / ' + o.cause})`);
    check(!o.success ? ['coast', 'return'].includes(o.failedPhase) : o.flown.landing.landed === true, 'a failure, if any, is on the coast or the trip home');
    check(o.flown.liftoff === 'fair', 'the autopilot earns a fair liftoff, not a clean one');
    await shot(page, 'auto-3-report');
    check(page.errors.length === 0, 'no page errors' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
    await page.close();
  },
  async fly(browser) {
    console.log('a whole flight by hand');
    const page = await open(browser, 'fly=1');
    await toPoll(page, BASIC); await launch(page);
    await page.waitForSelector('.fly-layer[data-moment="liftoff"]', { timeout: 20000 });
    await page.waitForSelector('.howto .start', { timeout: 20000 }); await sleep(400);
    await shot(page, 'fly-1a-liftoff-card');
    await page.click('.howto .start'); await sleep(300);
    check((await fly(page)).y === 0, 'the rocket waits on the pad until the engine is held');
    await liftoffByHand(page, path.join(OUT, 'fly-1b-liftoff.png'));
    await page.waitForSelector('.fly-note', { timeout: 10000 });
    check(/Clean liftoff/.test(await page.textContent('.fly-note')), `staying on the arrow and relighting at once is a clean liftoff (${await page.textContent('.fly-note')})`);
    await startCard(page, 'tli', 'fly-1c-tli-card');
    await burnByHand(page, 'tli', path.join(OUT, 'fly-1d-tli.png'));
    await page.waitForSelector('.fly-note', { timeout: 10000 });
    check(/Clean burn/.test(await page.textContent('.fly-note')), `the burn to the Moon, flown into the band, is clean (${await page.textContent('.fly-note')})`);
    await page.waitForSelector('.fly-layer[data-moment="coast"]', { timeout: 10000 }); await sleep(1500);
    const c0 = await fly(page); await page.click('.warp-btn[data-warp="faster"]'); await sleep(200);
    check((await fly(page)).warp === c0.warp * 10, `the warp button speeds up time (${c0.warp} → ${(await fly(page)).warp})`);
    check(/^\d{3}:\d{2}:\d{2}$/.test((await page.textContent('.trip-clock .met')).trim()), 'the mission clock runs on the coast');
    await shot(page, 'fly-1e-coast'); await page.keyboard.press('Escape');
    await page.waitForSelector('.fly-layer[data-moment="orbit"] .howto .start', { timeout: 40000 }); await sleep(400);
    await shot(page, 'fly-2a-orbit-card');
    await page.click('.howto .start');
    await burnByHand(page, 'orbit', path.join(OUT, 'fly-2b-orbit.png'));
    await page.waitForSelector('.fly-note', { timeout: 10000 });
    check(/Clean burn/.test(await page.textContent('.fly-note')), `turning round and stopping in the band is a clean burn (${await page.textContent('.fly-note')})`);
    await page.waitForSelector('.site[data-site="flat"]', { timeout: 20000 }); await sleep(300);
    await shot(page, 'fly-3-site');
    await page.click('.site[data-site="flat"]');
    await page.waitForSelector('.fly-layer[data-moment="landing"]', { timeout: 20000 });
    await page.waitForSelector('.howto .start', { timeout: 20000 }); await sleep(400);
    await shot(page, 'fly-4a-card');
    check((await page.$$('.howto li')).length === 3, 'the how-to card lists three steps');
    await page.click('.howto .start');
    await landByHand(page, 'fly-4b-landing');
    await sleep(2500); await shot(page, 'fly-5-down');
    await startCard(page, 'orbit', 'fly-5b-tei-card');
    await burnByHand(page, 'tei', path.join(OUT, 'fly-5c-tei.png'));
    await page.waitForSelector('.fly-layer[data-moment="coast"]', { timeout: 20000 }); await sleep(800); await page.keyboard.press('Escape');
    await startCard(page, 'corridor', 'fly-6a-corridor-card');
    await corridorByHand(page, path.join(OUT, 'fly-6b-corridor.png'));
    await page.waitForSelector('.fly-layer[data-moment="reentry"]', { timeout: 10000 }); await sleep(3000); await shot(page, 'fly-6c-reentry');
    await toReport(page);
    const o = await lastOutcome(page);
    check(o.flown.liftoff === 'clean' && o.flown.orbit === 'clean' && o.flown.tli === 'clean' && o.flown.tei === 'clean', `the clean burns were recorded (${o.flown.liftoff}, ${o.flown.tli}, ${o.flown.orbit}, ${o.flown.tei})`);
    check(o.flown.reentry && o.flown.reentry.ok && o.flown.reentry.angle >= -7.5 && o.flown.reentry.angle <= -5.5, `the ship entered inside the corridor (${JSON.stringify(o.flown.reentry)})`);
    check(o.flown.landing && o.flown.landing.landed === true && o.flown.landing.tries === 1, `landed by hand on the first try (${JSON.stringify(o.flown.landing)})`);
    check((await page.evaluate(() => window.__game.s.runs.at(-1).decisions['sci-site'])) === 'flat', 'the landing site was recorded');
    const text = await page.textContent('.report');
    check(/Flown: clean/.test(text) && /on the first try/.test(text) && /Burn to the Moon: clean/.test(text) && /entered the air at/.test(text), 'the report shows how each moment was flown');
    await shot(page, 'fly-6-report');
    check(page.errors.length === 0, 'no page errors' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
    await page.close();
  },
  async pad(browser) {
    console.log('landing on the highlands pad by hand');
    const page = await open(browser, 'fly=1');
    await toPoll(page, BASIC); await launch(page);
    await page.waitForSelector('.fly-layer[data-moment="liftoff"]', { timeout: 20000 });
    await page.click('.fly-auto'); // let the autopilot take liftoff and orbit, then take over for the landing
    await page.waitForSelector('.fly-layer[data-moment="orbit"] .fly-note', { timeout: 150000 });
    await page.click('.fly-auto'); // hands back on before the landing
    await page.waitForSelector('.site[data-site="rough"]', { timeout: 90000 }); await sleep(300);
    await page.click('.site[data-site="rough"]');
    await page.waitForSelector('.howto .start', { timeout: 20000 }); await sleep(300);
    check(/pad/i.test(await page.textContent('.howto h3')), 'the card explains the pad');
    await page.click('.howto .start');
    await landByHand(page, 'pad-landing');
    await startCard(page, 'orbit'); await startCard(page, 'corridor'); // hands off on the way home
    await toReport(page);
    const o = await lastOutcome(page);
    check(o.flown.landing && o.flown.landing.landed === true && o.flown.landing.site === 'rough', `landed on the pad (${JSON.stringify(o.flown.landing)})`);
    check(page.errors.length === 0, 'no page errors' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
    await page.close();
  },
  async idle(browser) {
    console.log('a flight nobody touches: the free return');
    const page = await open(browser, 'fly=1');
    await toPoll(page, BASIC); await launch(page);
    await page.waitForSelector('.howto .start', { timeout: 20000 }); await sleep(300); await page.click('.howto .start'); // Start the liftoff, then hands off
    await page.waitForSelector('.fly-note', { timeout: 60000 });
    check(/Guidance/.test(await page.textContent('.fly-note')), 'with nobody flying, guidance takes the liftoff');
    await startCard(page, 'tli');
    await page.waitForFunction(() => window.__game.fly && window.__game.fly.moment === 'tli' && window.__game.fly.part === 'done', null, { timeout: 60000, polling: 50 });
    check(/late burn/i.test(await page.textContent('.fly-note')), 'with nobody flying, the ship makes the burn to the Moon late, by itself');
    await startCard(page, 'orbit');
    await page.waitForFunction(() => window.__game.fly && window.__game.fly.moment === 'orbit' && window.__game.fly.part === 'done', null, { timeout: 60000, polling: 50 });
    check(/free return/i.test(await page.textContent('.fly-note')), 'with no burn at the Moon, the free return takes the ship home');
    await page.waitForFunction(() => window.__game.fly && window.__game.fly.moment === 'coast' && window.__game.fly.path === 'free' && window.__game.fly.frac > 0.3, null, { timeout: 60000, polling: 100 });
    await shot(page, 'idle-1-free-return');
    check(!(await page.$('.site')), 'no landing site is offered');
    await startCard(page, 'corridor');
    await toReport(page);
    const o = await lastOutcome(page);
    check(o.cause === 'abort' && o.failedPhase === 'orbit', `the mission ends as a free return (${o.failedPhase} / ${o.cause})`);
    check(o.flown.freeReturn === true && !o.flown.landing && o.flown.reentry && o.flown.reentry.ok, `nobody landed, and the crew came home inside the corridor (${JSON.stringify(o.flown.reentry)})`);
    check(page.paperHead === 'HOME, BUT NOT ON THE MOON', `the front page reports the abort (${page.paperHead})`);
    check((await page.evaluate(() => JSON.parse(localStorage.getItem('rttm.fallen.v1') || '[]').length)) === 0, 'nobody is added to the memorial');
    const text = await page.textContent('.report');
    check(/Skipped/.test(text), 'the report shows the Moon orbit and landing as skipped');
    await shot(page, 'idle-2-report');
    check(page.errors.length === 0, 'no page errors' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
    await page.close();
  },
  async crash(browser) {
    console.log('a landing nobody flies');
    const page = await open(browser, 'fly=1');
    await toPoll(page, BASIC); await launch(page);
    await page.waitForSelector('.fly-layer[data-moment="liftoff"]', { timeout: 20000 });
    await page.click('.fly-auto'); // the autopilot flies until the Moon
    await page.waitForSelector('.fly-layer[data-moment="orbit"] .fly-note', { timeout: 120000 });
    await page.click('.fly-auto'); // then hands off
    await page.waitForSelector('.site[data-site="flat"]', { timeout: 90000 }); await sleep(200);
    await page.click('.site[data-site="flat"]');
    await page.waitForSelector('.howto .start', { timeout: 20000 }); await sleep(300); await page.click('.howto .start');
    await page.waitForFunction(() => window.__game.fly && window.__game.fly.moment === 'abort', null, { timeout: 60000, polling: 50 });
    await sleep(600); await shot(page, 'crash-1-abort');
    await toReport(page);
    const o = await lastOutcome(page);
    check(o.cause === 'piloting' && o.failedPhase === 'landing', `the lander is lost at the landing (${o.failedPhase} / ${o.cause})`);
    check(o.flown.landing && o.flown.landing.tries === 2, 'only after the second try');
    check(/The landing was too hard/.test(await page.textContent('.report h2')), 'the report names the hard landing');
    const text = await page.textContent('.report');
    check(/What failed: the landing/.test(text) && /Lesson saved/.test(text), 'the report explains the landing and saves the lesson');
    check(page.paperHead === 'LOST AT THE SURFACE', `the front page reports the crash (${page.paperHead})`);
    check(page.errors.length === 0, 'no page errors' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
    await page.close();
  },
  async retry(browser) {
    console.log('trying again after a failure');
    const page = await open(browser);
    await toPoll(page, HEAVY); await launch(page); await toReport(page);
    await page.click('.report .row .btn.primary'); // "Fly ... with what we learned"
    await page.waitForFunction(() => document.body.dataset.screen === 'brief'); await sleep(500);
    await page.click('.brief-rest .btn.primary');
    for (let i = 0; i < 2; i++) { await page.waitForFunction(() => document.body.dataset.screen === 'scene'); await answerScene(page, 1); await sleep(150); }
    await page.waitForFunction(() => document.body.dataset.screen === 'build'); await sleep(500);
    const d = await page.evaluate(() => window.__game.s.current.decisions);
    check(d['nav-route'] === 'direct' && d['sci-instruments'] === 'full' && !d['sci-site'] && !d['eng-cabin'], 'the rocket is as it was left; the cabin scare and the site are new');
    check((await page.textContent('.btn.rollout')).trim() === 'Continue', 'the world still has its three interruptions to make');
    check(!!(await page.$('.conflict-warn.over')), 'the build warns that the rocket is too heavy');
    check(!!(await page.$('.part .warn, .slot')), 'the build screen is up');
    await shot(page, 'retry-1-build');
    await fit(page, 'sci-instruments', 'min'); await fit(page, 'eng-power', 'standard'); await fit(page, 'sci-antenna', 'small'); await fit(page, 'nav-disposal', 'leave');
    for (let guard = 0; guard < 6 && (await page.textContent('.btn.rollout')).trim() === 'Continue'; guard++) { await page.click('.btn.rollout'); await settle(page); }
    check(!(await page.$('.conflict-warn.over')), 'lighter parts clear the warning');
    await page.click('.btn.rollout'); await page.waitForFunction(() => document.body.dataset.screen === 'poll');
    check((await page.evaluate(() => window.__game.s.runs.length)) === 1 && (await page.evaluate(() => window.__game.s.current.no)) === 2, 'the second attempt is ready to launch');
    check(page.errors.length === 0, 'no page errors' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
    await page.close();
  },
  async phonefly(browser) {
    console.log('flying at phone width');
    const page = await open(browser, '', { width: 390, height: 844 });
    await toPoll(page, BASIC); await launch(page);
    await page.waitForSelector('.fly-layer[data-moment="liftoff"] .strip', { timeout: 30000 }); await sleep(5000);
    await shot(page, 'phonefly-1-liftoff');
    await page.waitForSelector('.fly-layer[data-moment="coast"] .warp', { timeout: 60000 }); await sleep(2000);
    await shot(page, 'phonefly-1b-coast');
    for (const sel of ['.warp', '.trip-readout', '.trip-clock', '.trip-why']) {
      const r = await page.$eval(sel, (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right }; });
      check(r.l >= 0 && r.r <= 390, `${sel} fits the screen on the coast`);
    }
    await page.waitForSelector('.fly-layer[data-moment="orbit"] .strip', { timeout: 60000 }); await sleep(2500);
    await shot(page, 'phonefly-2-orbit');
    await page.waitForSelector('.site', { timeout: 30000 }); await sleep(300);
    await shot(page, 'phonefly-3-site');
    await page.waitForSelector('.howto', { timeout: 30000 }); await sleep(500);
    await shot(page, 'phonefly-4a-card');
    await page.waitForSelector('.fly-layer[data-moment="landing"] .land-readout', { timeout: 30000 }); await sleep(5000);
    await shot(page, 'phonefly-4-landing');
    const strip = await page.$eval('.strip', (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right }; });
    check(strip.l >= 0 && strip.r <= 390, 'the on-screen controls fit the screen');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= 390), 'no sideways scroll while flying');
    const box = await page.$eval('.fly-layer[data-moment="landing"] .land-readout', (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right }; });
    check(box.l >= 0 && box.r <= 390, 'the landing readout fits the screen');
    await toReport(page);
    check(page.errors.length === 0, 'no page errors' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
    await page.close();
  },
  async heavy(browser) {
    console.log('a rocket too heavy to fly');
    const page = await open(browser);
    await toPoll(page, HEAVY); await shot(page, 'heavy-1-poll'); await launch(page);
    await toReport(page);
    const o = await lastOutcome(page);
    check(o.failedPhase === 'launch' && o.cause === 'mass', `it fails at liftoff for its mass (${o.failedPhase} / ${o.cause})`);
    check((await page.evaluate(() => window.__game.s.runs.at(-1).decisions['sci-site'])) === undefined, 'no landing site was ever picked');
    const text = await page.textContent('.report');
    check(!/undefined|NaN/.test(text), 'the report reads cleanly with no site chosen');
    await shot(page, 'heavy-2-report');
    check(page.errors.length === 0, 'no page errors' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
    await page.close();
  },
};
const fly = (page) => page.evaluate(() => window.__game.fly);
/** Press Start on a moment's "how to" card, once it is up. */
async function startCard(page, moment, shotName) {
  await page.waitForSelector(`.fly-layer[data-moment="${moment}"] .howto .start`, { timeout: 120000 }); await sleep(400);
  if (shotName) await shot(page, shotName);
  await page.click('.howto .start'); await sleep(200);
}
/** Fly a speed burn with the keyboard: turn the nose to the arrow, hold the engine, let go inside the band. tli and tei speed up; orbit slows down. */
async function burnByHand(page, moment, shotName) {
  const keys = { ArrowLeft: false, ArrowRight: false, Space: false };
  const set = async (k, want) => { if (keys[k] !== want) { keys[k] = want; await page.keyboard[want ? 'down' : 'up'](k); } };
  const up = moment !== 'orbit';
  let shots = 0;
  for (let guard = 0; guard < 3000; guard++) {
    const f = await page.evaluate(() => window.__game.fly);
    if (!f || f.moment !== moment || f.part !== 'fly') { for (const k of Object.keys(keys)) await set(k, false); if (!f || f.moment !== moment || f.part === 'done') break; await sleep(40); continue; }
    await set('ArrowRight', f.off > 0.2); await set('ArrowLeft', f.off < -0.2);
    const w = f.hi - f.lo, short = up ? f.speed < f.lo + w * 0.35 : f.speed > f.hi - w * 0.35;
    const burning = Math.abs(f.off) < 0.25 && short;
    await set('Space', burning);
    if (shotName && shots === 0 && burning && f.t > 1) { shots++; await page.screenshot({ path: shotName }); }
    await sleep(20);
  }
  for (const k of Object.keys(keys)) await set(k, false);
}
const orbitByHand = (page, shotName) => burnByHand(page, 'orbit', shotName);
/** Fly the entry correction: point where the arrow says, burn until the needle sits in the middle of the corridor. */
async function corridorByHand(page, shotName) {
  const keys = { ArrowLeft: false, ArrowRight: false, Space: false };
  const set = async (k, want) => { if (keys[k] !== want) { keys[k] = want; await page.keyboard[want ? 'down' : 'up'](k); } };
  let shots = 0;
  for (let guard = 0; guard < 3000; guard++) {
    const f = await page.evaluate(() => window.__game.fly);
    if (!f || f.moment !== 'corridor' || f.part !== 'fly') { for (const k of Object.keys(keys)) await set(k, false); if (!f || f.moment !== 'corridor' || f.part === 'done') break; await sleep(40); continue; }
    const off = f.aim - f.ship, mid = (f.lo + f.hi) / 2;
    await set('ArrowRight', f.aim !== 0 && off > 0.2); await set('ArrowLeft', f.aim !== 0 && off < -0.2);
    const burning = f.aim !== 0 && Math.abs(off) < 0.25 && Math.abs(f.angle - mid) > 0.3;
    await set('Space', burning);
    if (shotName && shots === 0 && burning) { shots++; await page.screenshot({ path: shotName }); }
    await sleep(20);
  }
  for (const k of Object.keys(keys)) await set(k, false);
}
/** Fly the liftoff with the keyboard: hold the engine, turn to stay on the guide arrow, relight when the stage runs dry. */
async function liftoffByHand(page, shotName) {
  const keys = { ArrowLeft: false, ArrowRight: false, Space: false };
  const set = async (k, want) => { if (keys[k] !== want) { keys[k] = want; await page.keyboard[want ? 'down' : 'up'](k); } };
  let shots = 0;
  for (let guard = 0; guard < 4000; guard++) {
    const f = await page.evaluate(() => window.__game.fly);
    if (!f || f.moment !== 'liftoff' || f.part !== 'fly') { for (const k of Object.keys(keys)) await set(k, false); if (!f || f.moment !== 'liftoff' || f.part === 'done') break; await sleep(40); continue; }
    if (f.dry) { await set('Space', false); await sleep(60); await set('Space', true); await sleep(60); continue; }
    await set('Space', true);
    const off = f.guide - f.angle;
    await set('ArrowLeft', off < -0.1); await set('ArrowRight', off > 0.1);
    if (shotName && shots === 0 && f.y > 250) { shots++; await page.screenshot({ path: shotName }); }
    await sleep(25);
  }
  for (const k of Object.keys(keys)) await set(k, false);
}
/** Fly the landing with the keyboard, the way the coach says: turn to the guide arrow, burn when it says burn. */
async function landByHand(page, shotName) {
  const keys = { ArrowLeft: false, ArrowRight: false, Space: false };
  const set = async (k, want) => { if (keys[k] !== want) { keys[k] = want; await page.keyboard[want ? 'down' : 'up'](k); } };
  let shots = 0;
  for (let guard = 0; guard < 6000; guard++) {
    const f = await fly(page);
    if (!f || f.moment !== 'landing') { for (const k of Object.keys(keys)) await set(k, false); if (!(await page.$('.fly-layer'))) break; await sleep(40); continue; }
    let off = f.advise.angle - f.angle; while (off > Math.PI) off -= 2 * Math.PI; while (off < -Math.PI) off += 2 * Math.PI;
    await set('ArrowLeft', off < -0.2); await set('ArrowRight', off > 0.2);
    await set('Space', f.advise.engine && Math.abs(off) < 0.45);
    if (shotName && shots === 0 && f.h < 200) { shots++; await shot(page, shotName); }
    if (shotName && shots === 1 && f.h < 40) { shots++; await shot(page, shotName + '-low'); }
    await sleep(25);
  }
  for (const k of Object.keys(keys)) await set(k, false);
}
const lastOutcome = (page) => page.evaluate(() => { const o = window.__game.s.runs.at(-1).outcome; return { success: o.success, failedPhase: o.failedPhase, cause: o.cause, flown: o.flown }; });
async function launch(page) { await page.waitForSelector('.btn.launch', { timeout: 30000 }); await sleep(300); await page.click('.btn.launch'); }
async function toReport(page) {
  await page.waitForFunction(() => document.body.dataset.screen === 'paper', null, { timeout: 180000 }); await sleep(600);
  page.paperHead = (await page.textContent('.paper-head')).trim();
  await page.click('.paper .btn.primary'); await page.waitForSelector('.report'); await sleep(400);
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  for (const st of stages) {
    if (!run[st]) { console.log(`(no stage called ${st})`); continue; }
    try { await run[st](browser); } catch (e) { failures++; console.log('  FAIL', st, 'stopped:', e.message.split('\n')[0]); }
  }
  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
module.exports = { open, toBuild, toPoll, buildAll, fit, settle, shot, check, sleep, screenOf, landByHand, liftoffByHand, orbitByHand, burnByHand, corridorByHand, startCard, BASIC, HEAVY, run };
