// Records a full playthrough at a real player's pace, with the game's own sound.
// Usage: node scripts/record.cjs        (needs `npm run dev` running on http://localhost:5173)
// Writes demo/video.webm, demo/audio.webm and demo/offset.txt (milliseconds the audio starts after the video).
// Join them with:
//   ffmpeg -i demo/video.webm -i demo/audio.webm -filter_complex "[1:a]adelay=OFFSET:all=1,apad[a]" -map 0:v -map "[a]" -c:v libx264 -crf 27 -pix_fmt yuv420p -c:a aac -shortest demo/space-bar-demo.mp4
const { chromium } = require('playwright-core');
const { liftoffByHand, orbitByHand } = require('./e2e.cjs');
const path = require('path'); const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'demo'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PARTS = [['nav-route', 'lor'], ['eng-docking', 'robust'], ['eng-power', 'standard'], ['sci-antenna', 'small'], ['sci-instruments', 'min'], ['nav-disposal', 'leave']];

// The game sends every sound through one master gain into ctx.destination. This tees that into a recorder.
const tap = () => {
  const orig = AudioNode.prototype.connect;
  window.__rec = { chunks: [], start: 0 };
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = orig.call(this, dest, ...rest);
    if (dest instanceof AudioDestinationNode && !window.__rec.tapped) {
      window.__rec.tapped = true;
      const msd = this.context.createMediaStreamDestination();
      orig.call(this, msd);
      const mr = new MediaRecorder(msd.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 160000 });
      mr.ondataavailable = (e) => { if (e.data.size) window.__rec.chunks.push(e.data); };
      mr.onstart = () => { window.__rec.start = Date.now(); };
      window.__rec.stop = () => new Promise((res) => { mr.onstop = res; mr.stop(); });
      mr.start(1000);
    }
    return r;
  };
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
  await ctx.addInitScript(tap);
  const page = await ctx.newPage();
  const t0 = Date.now();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const screenOf = () => page.evaluate(() => document.body.dataset.screen);
  const fly = () => page.evaluate(() => window.__game.fly);
  const hold = async (el, ms = 950) => { await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await page.mouse.down(); await sleep(ms); await page.mouse.up(); };
  const click = async (sel) => { const el = await page.waitForSelector(sel); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 }); await sleep(250); await page.mouse.down(); await sleep(60); await page.mouse.up(); };
  /** a story decision: wait for the options, read, hold one, read the reaction, continue */
  const decide = async (idx) => {
    await page.waitForSelector('.options:not([hidden])', { timeout: 30000 }); await sleep(1400);
    const opts = await page.$$('.option'); await hold(opts[Math.min(idx, opts.length - 1)]);
    await page.waitForSelector('.after .btn.primary', { timeout: 30000 }); await sleep(2300);
    await click('.after .btn.primary');
  };
  /** whatever interrupted the build: read it, deal with it, come back to the pad */
  const settle = async () => {
    for (let guard = 0; guard < 12; guard++) {
      await sleep(700);
      const scr = await screenOf();
      if (scr === 'news') { await sleep(3200); await click('.newsflash .btn.primary'); continue; }
      if (scr === 'scene') { await decide(1); continue; }
      if (scr === 'build' && !(await page.$('.incoming'))) return;
    }
  };

  await page.goto(`${BASE}/?intro=1&seed=12345`);
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ } });
  await page.reload(); await sleep(2500);
  await page.mouse.move(640, 360);
  await click('.gatebtn');
  await sleep(16000); // the opening: night launch, the cut to space, the title
  await click('text=Take the job');
  await sleep(6500); await page.click('.skip-text').catch(() => {}); await sleep(2500);
  await click('.brief-rest .btn.primary');
  for (let i = 0; i < 2; i++) { await page.waitForFunction(() => document.body.dataset.screen === 'scene'); await decide(1); }
  await page.waitForFunction(() => document.body.dataset.screen === 'build'); await sleep(2200);

  // build the rocket, one part at a time
  for (const [q, o] of PARTS) {
    await click(`.slot[data-q="${q}"]`); await sleep(900);
    const part = await page.waitForSelector(`.part[data-o="${o}"]`); await part.hover(); await sleep(900);
    await click(`.part[data-o="${o}"]`); await sleep(1500);
    await settle();
  }
  for (let guard = 0; guard < 6 && (await page.textContent('.btn.rollout')).trim() === 'Continue'; guard++) { await click('.btn.rollout'); await settle(); }
  await sleep(1500);
  await click('.btn.rollout');
  await page.waitForFunction(() => document.body.dataset.screen === 'poll');
  await page.waitForSelector('.btn.launch', { timeout: 30000 }); await sleep(1800);
  await hold(await page.$('.btn.launch'), 1500);

  // liftoff: read the card, press Start, hold the engine, follow the arrow, relight when the stage runs dry
  await page.waitForSelector('.howto .start', { timeout: 30000 }); await sleep(5200);
  await click('.howto .start'); await sleep(1200);
  await liftoffByHand(page);
  // Moon orbit: read the card, press Start, turn the ship round, burn into the band
  await page.waitForSelector('.fly-layer[data-moment="orbit"] .howto .start', { timeout: 60000 }); await sleep(5200);
  await click('.howto .start'); await sleep(900);
  await orbitByHand(page);
  // the landing site
  await page.waitForSelector('.site[data-site="flat"]', { timeout: 20000 }); await sleep(2600);
  await click('.site[data-site="flat"]');
  // the landing: read the card, press Start, then follow the guide arrow and burn when the coach says so
  await page.waitForSelector('.howto .start', { timeout: 30000 }); await sleep(5200);
  await click('.howto .start'); await sleep(900);
  const keys = { ArrowLeft: false, ArrowRight: false, Space: false };
  const set = async (k, want) => { if (keys[k] !== want) { keys[k] = want; await page.keyboard[want ? 'down' : 'up'](k); } };
  for (let guard = 0; guard < 8000; guard++) {
    const f = await fly();
    if (!f || f.moment !== 'landing') { for (const k of Object.keys(keys)) await set(k, false); if (!(await page.$('.fly-layer'))) break; await sleep(40); continue; }
    let off = f.advise.angle - f.angle; while (off > Math.PI) off -= 2 * Math.PI; while (off < -Math.PI) off += 2 * Math.PI;
    await set('ArrowLeft', off < -0.2); await set('ArrowRight', off > 0.2);
    await set('Space', f.advise.engine && Math.abs(off) < 0.45);
    await sleep(25);
  }
  for (const k of Object.keys(keys)) await set(k, false);

  await page.waitForFunction(() => document.body.dataset.screen === 'paper', null, { timeout: 120000 });
  await sleep(5000);
  await click('.paper .btn.primary');
  await page.waitForSelector('.report'); await sleep(3000);
  await page.mouse.wheel(0, 380); await sleep(2500);
  console.log('ended on:', await page.textContent('.report h2'));
  const { b64, start } = await page.evaluate(async () => {
    await window.__rec.stop();
    const buf = new Uint8Array(await new Blob(window.__rec.chunks, { type: 'audio/webm' }).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { b64: btoa(s), start: window.__rec.start };
  });
  fs.writeFileSync(path.join(OUT, 'audio.webm'), Buffer.from(b64, 'base64'));
  fs.writeFileSync(path.join(OUT, 'offset.txt'), String(start - t0));
  const video = await page.video().path();
  await ctx.close(); await browser.close();
  fs.copyFileSync(video, path.join(OUT, 'video.webm')); fs.unlinkSync(video);
  console.log('audio starts', start - t0, 'ms after the video');
})().catch((e) => { console.error('RECORD FAILED', e); process.exit(1); });
