import './style.css';
import './flight.css';
import './feel.css';
import { content, briefing, eraSources, endingFor, history as realHistory, phaseNames } from './data';
import { crews, missionName, scenes, storyOrder, slotOrder, CABIN, SITE, stationOf, papers, Person } from './data/story';
import { h, fmt, dateStr } from './ui/dom';
import { gaugePanel, worldBar, animateWorld, peakUse, monthYear } from './ui/gauges';
import { sfx, FlightAudio } from './ui/audio';
import { Backdrop, Cue } from './three/backdrop';
import { Flight } from './three/flight';
import { FlyControls } from './ui/flycontrols';
import { Hud, flyLayer, flyNote, autoLink, howTo, coach, controlStrip, ascentHud, aimMark } from './ui/flyhud';
import { AUTOPILOT, landingFuelPreview } from './sim/flight';
import { orbitSetup } from './sim/orbit';
import { liftoffSetup, startAscent, stepAscent, ascentPilot, ascentDone, gradeAscent, guideAngle, stageDry, thrusting } from './sim/ascent';
import { landingSetup } from './sim/landing';
import { siteOverloadsLink } from './sim/simulate';
import { missionLab, preferenceControls, uiText } from './missionlab';
import { historicalCampaign } from './ui/historicalCampaign';
import { SIMULATION_SOURCES } from './data/sources';
import {
  Session, newSession, answer, totalsFor, warningsFor, finishFlight, retry,
  clearLessons, encodeShare, decodeShare, addToBoard, board, daysLeft, survival,
  setPart, neededSlots, pendingInterrupt, markFired, isReady, progressOf, seenEvents, answered, peek,
} from './game/session';
import { dateAt, projectMeters } from './sim/meters';
import { Check, Controls, Decisions, FLOWN, FlownResult, GameEvent, Mark, Meters, Option, PHASES, PhaseResult, Question, Role, Site } from './sim/types';

const { chapter, questions, conflicts } = content;
const app = document.getElementById('app')!;

const roleName: Record<Role | 'crew', string> = { manager: 'Manager', navigator: 'Navigator', engineer: 'Engineer', scientist: 'Scientist', crew: 'The whole crew' };
const roleOwns: Record<Role | 'crew', string> = {
  manager: 'Budget and public trust', navigator: 'The route, the launch and what is left in orbit',
  engineer: 'The spacecraft: strength, reliability, mass and power', scientist: 'What the mission does on arrival', crew: 'Decisions everyone shares',
};

type Screen = 'gate' | 'title' | 'campaign' | 'brief' | 'scene' | 'news' | 'build' | 'poll' | 'paper' | 'report' | 'collapse' | 'done' | 'data' | 'shared' | 'lab';
type Item = { t: 'scene'; qid: string } | { t: 'news'; ev: GameEvent };

const qs = new URLSearchParams(location.search);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Holding a button is the heart of the feel. Reduced motion and ?quick=1 fall back to a plain click. */
const instant = reduce || qs.has('quick');

let s: Session = newSession(seedFromUrl());
let screen: Screen = 'gate';
/** the story decision or news flash on screen right now */
let cur: Item | null = null;
const bd = new Backdrop(document.body);
let introSeen = (() => { try { return sessionStorage.getItem('rttm.intro') === '1' && !qs.has('intro'); } catch { return false; } })();
let cut: Flight | null = null;
let timers: number[] = [];
let sharedView = location.hash.startsWith('#r=') ? decodeShare(location.hash.slice(3)) : null;
if (sharedView) screen = 'shared'; else if (introSeen || qs.has('quick')) { screen = 'title'; introSeen = true; }

// ---- the people we can lose (kept between worlds on purpose)
interface Fallen { mission: number; crew: Person[]; cause: string; date: string }
const FKEY = 'rttm.fallen.v1';
function loadFallen(): Fallen[] { try { return JSON.parse(localStorage.getItem(FKEY) || '[]'); } catch { return []; } }
function saveFallen() { try { localStorage.setItem(FKEY, JSON.stringify(fallen)); } catch { /* storage may be blocked */ } }
let fallen: Fallen[] = loadFallen();
const crewNow = () => crews[fallen.length % crews.length];
const missionNow = () => fallen.length + 1;
interface FlightRecord { mission: number; crew: Person[]; prev: Meters; ok: boolean; date: string }
let lastFlight: FlightRecord | null = null;

function seedFromUrl() { const q = qs.get('seed'); return q ? Number(q) : Math.floor(Math.random() * 1e9); }
function go(next: Screen) { screen = next; render(); window.scrollTo(0, 0); }
function later(fn: () => void, ms: number) { const id = window.setTimeout(fn, ms); timers.push(id); return id; }

function render() {
  timers.forEach((id) => clearTimeout(id)); timers = [];
  document.body.classList.remove('launching');
  if (screen === 'scene' || screen === 'build' || screen === 'poll') { /* these set the build site themselves */ }
  else if (screen === 'brief') bd.showSite(null, 0);
  else if (screen === 'news') bd.showSite(totalsFor(s).tags, progressOf(s));
  else if ((screen === 'paper' || screen === 'report' || screen === 'done') && lastFlight?.ok) { bd.showShip(s.runs[s.runs.length - 1].outcome!.totals.tags); bd.setProgress(1); }
  else bd.showWorld();
  document.body.dataset.screen = screen;
  app.replaceChildren();
  const view = ({ gate, title, campaign: () => historicalCampaign(() => go('title')), brief, scene, news, build, poll, paper, report, collapse, done, data: dataScreen, shared, lab: () => missionLab(() => go('title')) } as Record<Screen, () => HTMLElement>)[screen]();
  app.append(view);
  if (!['gate', 'title', 'lab', 'campaign'].includes(screen)) app.append(h('button', { type: 'button', class: 'global-home', onclick: () => go('title'), 'aria-label': uiText('Back to start page', "Retour à la page d'accueil") }, `⌂ ${uiText('Start', 'Accueil')}`));
  (app.querySelector('h1,h2') as HTMLElement | null)?.focus?.({ preventScroll: true });
}

const btn = (label: string, on: () => void, cls = 'btn') => h('button', { class: cls, type: 'button', onclick: () => { sfx.unlock(); on(); } }, label);
const shell = (...kids: (Node | false | null)[]) => h('main', { class: 'screen' }, ...kids);
const avatar = (p: Person, cls = '') => h('span', { class: `avatar ${cls}`, style: `--hue:${p.hue}`, 'aria-hidden': 'true' }, p.name.split(' ').filter((w) => /^[A-Z]/.test(w) && !w.endsWith('.')).map((w) => w[0]).slice(0, 2).join(''));
const names = (c: Person[]) => `${c[0].name}, ${c[1].name} and ${c[2].name}`;
const surname = (p: Person) => p.name.split(' ').slice(-1)[0];

/**
 * Types text out like a teleprinter, at a fixed number of characters per second measured on the clock,
 * so a slow or busy machine never makes the reading drag. Returns a skip function.
 */
function typeText(el: HTMLElement, text: string, done?: () => void, cps = 75): () => void {
  let finished = false;
  const fin = () => { if (finished) return; finished = true; done?.(); };
  if (instant) { el.textContent = text; fin(); return () => {}; }
  el.textContent = ''; const t0 = performance.now(); let shown = 0;
  const id = window.setInterval(() => {
    const n = Math.min(text.length, Math.floor(((performance.now() - t0) / 1000) * cps));
    if (n !== shown) { if (Math.floor(n / 16) !== Math.floor(shown / 16)) sfx.tick(); shown = n; el.textContent = text.slice(0, n); }
    if (n >= text.length) { clearInterval(id); fin(); }
  }, 30);
  timers.push(id);
  return () => { clearInterval(id); el.textContent = text; fin(); };
}

/** A button you must hold. Decisions have weight. */
function holdButton(el: HTMLButtonElement, onCommit: () => void, ms = 700) {
  if (instant) { el.addEventListener('click', () => { sfx.unlock(); onCommit(); }); return; }
  let t0 = 0, raf = 0, guard = 0, active = false, stopTone: (() => void) | null = null, done = false;
  const set = (p: number) => el.style.setProperty('--p', String(p));
  const cancel = () => { if (!active || done) return; active = false; cancelAnimationFrame(raf); clearTimeout(guard); stopTone?.(); stopTone = null; el.classList.remove('holding'); set(0); };
  const finish = () => { if (done) return; done = true; active = false; cancelAnimationFrame(raf); clearTimeout(guard); stopTone?.(); stopTone = null; el.classList.remove('holding'); set(1); onCommit(); };
  // the timer decides, the frame loop only draws, so a throttled tab cannot trap the player
  const loop = () => { set(Math.min(1, (performance.now() - t0) / ms)); raf = requestAnimationFrame(loop); };
  const start = () => { if (active || done) return; sfx.unlock(); active = true; t0 = performance.now(); el.classList.add('holding'); stopTone = sfx.hold(ms); guard = window.setTimeout(finish, ms); loop(); };
  el.addEventListener('pointerdown', (e) => { if (e.button === 0) start(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, cancel));
  el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); start(); } });
  el.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') cancel(); });
  el.addEventListener('blur', cancel);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

// sound toggle lives outside the screens
const muteBtn = h('button', { class: 'mute', type: 'button', 'aria-label': uiText('Toggle sound', 'Activer ou couper le son'), onclick: () => { muteBtn.textContent = sfx.toggle() ? uiText('Sound off', 'Son coupé') : uiText('Sound on', 'Son activé'); } }, sfx.isMuted() ? uiText('Sound off', 'Son coupé') : uiText('Sound on', 'Son activé'));
document.body.append(muteBtn);
function refreshPreferenceUi() {
  muteBtn.textContent = sfx.isMuted() ? uiText('Sound off', 'Son coupé') : uiText('Sound on', 'Son activé');
  muteBtn.setAttribute('aria-label', uiText('Toggle sound', 'Activer ou couper le son'));
  render();
}
addEventListener('pointerdown', () => sfx.unlock(), { once: true });

// ---------------------------------------------------------------- gate, intro, title
function gate() {
  return shell(h('div', { class: 'gate' },
    h('p', { class: 'eyebrow' }, uiText('A build-and-fly space mission game')),
    h('button', { class: 'gatebtn', type: 'button', onclick: () => { sfx.unlock(); sfx.ambient(true); go('title'); } },
      h('span', { class: 'ring' }), h('b', {}, uiText('Press to begin', 'Appuyer pour commencer')), h('small', {}, uiText('Sound on · headphones recommended', 'Son activé · casque recommandé'))),
    h('button', { class: 'link', onclick: () => { introSeen = true; sfx.unlock(); go('title'); } }, uiText('Skip the intro', "Passer l'introduction")),
    preferenceControls(refreshPreferenceUi, 'title-preferences')));
}

function title() {
  const lessons = s.lessons.length;
  const playing = !introSeen;
  const line = h('div', { class: 'intro-line', 'aria-live': 'polite' });
  const flash = h('div', { class: 'flashfx' });
  const slam = h('div', { class: 'slam', hidden: playing },
    h('p', { class: 'eyebrow wide' }, uiText('A build-and-fly space mission game')),
    h('h1', { tabindex: '-1' }, h('span', { class: 'a' }, 'Space'), h('span', { class: 'b' }, 'Bar')),
    h('p', { class: 'tag chapter' }, h('i', {}), uiText(`Chapter ${chapter.id}: ${chapter.title}`, `Chapitre ${chapter.id} : Course vers la Lune`), h('i', {})),
    h('p', { class: 'sub' }, uiText('Three people will climb into a machine you designed.', 'Trois personnes monteront dans une machine que vous avez conçue.')));
  const menu = h('div', { class: 'menu', hidden: playing },
    h('div', { class: 'row' }, btn(uiText('Open Mission Lab'), () => { sfx.ambient(true); go('lab'); }, 'btn primary big'), btn(uiText('Play historical campaign'), () => { sfx.ambient(true); go('campaign'); }, 'btn ghost'), btn(uiText('Data and sources'), () => go('data'), 'btn ghost')),
    h('p', { class: 'fine' }, uiText('Engineer a complete mission, assemble the vehicle piece by piece, fly an RCS rendezvous, dock and deploy a scientific payload—or enter the historical Moon-race campaign.')),
    preferenceControls(refreshPreferenceUi, 'title-preferences'),
    (lessons > 0 || fallen.length > 0) && h('p', { class: 'fine' },
      fallen.length > 0 && `${fallen.length} crew${fallen.length > 1 ? 's' : ''} lost. `, lessons > 0 && `${lessons} lesson${lessons > 1 ? 's' : ''} remembered. `,
      h('button', { class: 'link', onclick: () => { clearLessons(); fallen = []; saveFallen(); s = newSession(seedFromUrl(), false); render(); } }, 'Forget everything')));
  const skip = h('button', { class: 'skipintro', type: 'button', onclick: () => { bd.skipIntro(); } }, 'Skip intro');
  let fa: FlightAudio | null = null;
  const say = (html: string, cls = '') => { line.className = `intro-line ${cls}`; line.innerHTML = html; void line.offsetWidth; line.classList.add('on'); };
  const cue = (c: Cue) => {
    if (c === 'date') { say('<b>May 25, 1961</b>', 'date'); sfx.radio(); }
    else if (c === 'quote') { say('“…landing a man on the Moon…”<small>President John F. Kennedy to Congress</small>', 'quote'); sfx.radio(); }
    else if (c === 'quote2') { say('“…and returning him safely to the Earth.”', 'quote'); sfx.radio(); }
    else if (c === 'ignition') { say('<b>Eight years.</b>', 'big'); fa = new FlightAudio(); bd.onFrame = ({ thrust }) => fa?.update(0.08 + thrust * 0.95, 0, 0); }
    else if (c === 'liftoff') { say('<b>Three lives.</b>', 'big'); sfx.thud(); }
    else if (c === 'flash') { flash.classList.add('on'); fa?.update(0, 0, 0); fa?.stop(); fa = null; bd.onFrame = undefined; }
    else if (c === 'title') {
      fa?.stop(); fa = null; bd.onFrame = undefined;
      line.replaceChildren(); flash.classList.remove('on'); flash.classList.add('off'); skip.remove();
      slam.hidden = false; slam.classList.add('in'); sfx.thud(); sfx.stinger('win');
      introSeen = true; try { sessionStorage.setItem('rttm.intro', '1'); } catch { /* ignore */ }
    }
    else if (c === 'menu') { menu.hidden = false; menu.classList.add('in'); (menu.querySelector('.btn.primary') as HTMLElement | null)?.focus({ preventScroll: true }); }
  };
  if (playing) {
    bd.playIntro(cue);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); bd.skipIntro(); } };
    addEventListener('keydown', onKey); later(() => removeEventListener('keydown', onKey), 20000);
  } else { slam.classList.add('in'); menu.classList.add('in'); }
  return h('main', { class: 'screen titlescreen' }, line, slam, menu, playing && skip, flash);
}

// ---------------------------------------------------------------- data & sources
function dataScreen() {
  const rows = [
    ...eraSources.map((e) => [e.what, e.label, e.status, e.note]),
    ...content.events.map((e) => [`Event: ${e.headline}`, e.source.label, e.source.status, `Historical date ${e.date}`]),
    ['Briefing quote', briefing.source.label, briefing.source.status, ''],
    ['"What really happened"', 'NASA History Office, Apollo 11 mission summary', 'placeholder', 'Facts entered from public knowledge. Verify before judging.'],
  ];
  return shell(h('h2', { tabindex: '-1' }, 'Data and sources'),
    h('p', { class: 'lede' }, 'All data ships as static files inside the game. Nothing is fetched at play time. Items marked placeholder were entered from public knowledge and will be checked against the official challenge resources. The crew and the people you speak to are fictional.'),
    h('div', { class: 'table', role: 'table' }, ...rows.map((r) => h('div', { class: 'trow', role: 'row' },
      h('b', {}, r[0]), h('span', {}, r[1]), h('em', { class: `badge ${r[2]}` }, r[2]), h('span', { class: 'dim' }, r[3])))),
    h('section',{class:'simulation-credits'},h('p',{class:'eyebrow'},'SIMULATOR SOURCES & CREDITS'),h('h3',{},'Where the numbers come from'),h('p',{},'These sources support the vehicle proportions, planetary constants, atmosphere and learning explanations used by the simulator.'),h('div',{class:'source-cards'},...SIMULATION_SOURCES.map(source=>h('article',{},h('b',{},source.subject),h('a',{href:source.url,target:'_blank',rel:'noreferrer'},`${source.publisher} · ${source.title}`),h('span',{},source.usedFor))))),
    h('p', { class: 'fine' }, 'Visuals are original code-generated diagrams based on published dimensions. Earth and Moon imagery is procedural. NASA material is credited to NASA; SpaceX names and vehicle data are credited to SpaceX.'),
    btn('Back', () => go('title')));
}

// ---------------------------------------------------------------- briefing: who is flying
function brief() {
  const first = s.runs.length === 0 && fallen.length === 0;
  const crew = crewNow();
  const lines = first ? briefing.text : [];
  const mission = missionName(missionNow());
  const para = h('div', { class: 'typed' });
  const rest = h('div', { class: 'brief-rest', hidden: true });
  const startBtn = btn('Begin', beginRun, 'btn primary big');

  const reveal = () => { rest.hidden = false; rest.classList.add('in'); sfx.radio(); };
  const showLines = (i: number) => {
    if (i >= lines.length) { later(reveal, 400); return; }
    const p = h('p', { class: 'lede cinematic' }); para.append(p);
    typeText(p, lines[i], () => later(() => showLines(i + 1), 450), 70);
  };
  if (first) later(() => showLines(0), 300); else later(reveal, 200);

  rest.append(...[
    h('div', { class: 'crewbox' },
      h('p', { class: 'eyebrow' }, `${mission} · your crew`),
      h('div', { class: 'crewrow' }, ...crew.map((c) => h('div', { class: 'crewcard' }, avatar(c, 'lg'), h('b', {}, c.name), h('span', {}, c.title)))),
      h('p', { class: 'lede' }, first ? 'They have families and flight suits and a date with a rocket. They do not know how it will end. You will decide that, one choice at a time.'
        : `${surname(crew[0])}'s crew do not know what happened to the last one. They trust you anyway.`),
      h('p', { class: 'fine' }, 'The crew and everyone you will speak to are fictional.')),
    fallen.length > 0 && memorial(),
    s.lessons.length > 0 && h('section', { class: 'card lessons' }, h('h3', {}, 'What you remember'), ...s.lessons.map((l) => h('p', {}, l.text))),
    s.runs.length === 0 && h('details', { class: 'meters-help' }, h('summary', {}, 'What do the three meters mean?'),
      h('p', {}, h('b', {}, 'Budget. '), briefing.meters.budget), h('p', {}, h('b', {}, 'Public trust. '), briefing.meters.trust),
      h('p', {}, h('b', {}, 'Orbital debris. '), briefing.meters.debris), h('p', { class: 'fine' }, briefing.debrisNote)),
    h('div', { class: 'row' }, startBtn)].filter((x): x is HTMLElement => !!x));

  const skip = h('button', { class: 'link skip-text', onclick: () => { timers.forEach((id) => clearTimeout(id)); para.replaceChildren(...lines.map((t) => h('p', { class: 'lede cinematic' }, t))); reveal(); skip.remove(); } }, 'Skip');
  return shell(worldBar(s.meters), h('div', { class: 'brief' },
    h('p', { class: 'eyebrow' }, first ? briefing.title : `${mission} · ${dateStr(dateAt(chapter, s.meters.day))}`),
    h('h2', { tabindex: '-1' }, first ? 'The goal: land on the Moon and come home' : `${mission}. Try again.`),
    !first && h('p', { class: 'lede' }, `${fmt(daysLeft(s))} days left before the decade ends.`),
    para, first && skip, rest));
}

function memorial() {
  return h('section', { class: 'memorial' }, h('h3', {}, 'Lost'),
    ...fallen.map((f) => h('div', { class: 'lost' }, h('b', {}, missionName(f.mission)), h('span', {}, names(f.crew)), h('small', {}, f.cause))));
}

// ---------------------------------------------------------------- the order of a run
/** Briefing, the two story decisions, then the build. News and the cabin scare interrupt the build. */
function beginRun() { calDay = s.meters.day; openSlot = null; nextStory(); }
function nextStory() {
  const qid = storyOrder.find((q) => !s.current.decisions[q]);
  if (qid) { cur = { t: 'scene', qid }; go('scene'); } else { cur = null; go('build'); }
}
/** show a news flash or the cabin scare; its Continue button comes back to the pad */
function interrupt(it: Item) { cur = it; go(it.t === 'news' ? 'news' : 'scene'); }
/** the Continue button of a story decision or a news flash */
function nextStep() {
  if (cur?.t === 'scene' && storyOrder.includes(cur.qid)) { nextStory(); return; }
  markFired(s); cur = null; go('build');
}
const storyIds = [...storyOrder, CABIN];
const decisionNo = (qid: string) => storyIds.indexOf(qid) + 1;

/**
 * The story calendar. It only ever moves forward: the work takes time whatever you choose.
 * The date the ship will be ready to fly is shown separately, because that one moves both ways.
 */
let calDay = 0;
function today() {
  const target = s.meters.day + totalsFor(s).days * 0.8 * progressOf(s);
  calDay = Math.max(calDay, target);
  return calDay;
}
const readyDay = () => s.meters.day + totalsFor(s).days;
const forecast = () => projectMeters(s.meters, chapter, totalsFor(s), seenEvents(s));

// ---------------------------------------------------------------- a scene: one person, one decision
function plainChips(o: Option): string[] {
  const e = o.effects, c: string[] = [];
  if (e.mass) c.push(e.mass > 0 ? 'Heavier' : 'Lighter');
  if (e.cost) c.push(e.cost > 0 ? 'Costs more' : 'Costs less');
  if (e.days) c.push(e.days > 0 ? 'Slower' : 'Faster');
  if (e.power) c.push('More power');
  if (e.load) c.push('Uses power');
  if (e.data) c.push(e.data > 0 ? 'More data' : 'Less data');
  if (e.comms) c.push('Stronger link');
  if (e.trust) c.push(e.trust > 0 ? 'Public likes it' : 'Public wary');
  if (e.debris) c.push('Leaves debris');
  if (e.risk) c.push(e.risk > 0 ? 'Riskier' : 'Safer');
  return c;
}

/** The ship now lives in the full-screen backdrop. This invisible column just lets you drag it around. */
function stageHit(): HTMLElement {
  const el = h('div', { class: 'stagehit', 'aria-label': 'Your spacecraft in orbit. Drag to turn it.' }, h('span', { class: 'draghint' }, 'Drag to turn the ship'));
  let last = 0, down = false;
  el.addEventListener('pointerdown', (e) => { down = true; last = e.clientX; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (down) { bd.nudge(e.clientX - last); last = e.clientX; } });
  ['pointerup', 'pointercancel'].forEach((ev) => el.addEventListener(ev, () => { down = false; }));
  return el;
}
function scene() {
  const item = cur as Extract<Item, { t: 'scene' }>;
  const q = questions.find((x) => x.id === item.qid)!;
  const sc = scenes[q.id];
  const total = storyIds.length;
  const tagsNow = totalsFor(s).tags;
  const stage = stageHit();
  bd.showSite(tagsNow, progressOf(s));
  const gaugeHost = h('details', { class: 'systems' }, h('summary', {}, 'Ship systems: mass, power, data, cost'), h('div', {}));
  const refresh = () => { (gaugeHost.lastElementChild as HTMLElement).replaceChildren(gaugePanel(totalsFor(s), s.meters.budget, s.meters.day)); };
  refresh();
  const wb = worldBar(forecast(), { label: 'Today', day: today(), note: `Ship ready to fly ${monthYear(readyDay())}`, projected: true });

  const prelude = sc.prelude?.(s.current.decisions, tagsNow);
  const said = h('span', { 'aria-hidden': 'true' }); const saidFull = h('span', { class: 'sr' }, sc.line);
  const quote = h('blockquote', { class: 'said' }, saidFull, said);
  const preludeEl = prelude ? h('p', { class: 'prelude', hidden: true }, prelude) : null;
  const askEl = h('h2', { class: 'ask', tabindex: '-1' }, q.prompt);
  const optsEl = h('div', { class: 'options', hidden: true });
  const hint = h('p', { class: 'hold-hint', hidden: true }, instant ? 'Choose carefully. You cannot undo it.' : 'Hold to commit. You cannot undo it.');
  const after = h('section', { class: 'after', hidden: true, 'aria-live': 'polite' });
  let committed = false;

  const optEls = q.options.map((o, oi) => {
    const warns = warningsFor(s, o.tags);
    const el = h('button', { class: 'option', type: 'button' },
      h('span', { class: 'hold-fill', 'aria-hidden': 'true' }),
      h('span', { class: 'idx', 'aria-hidden': 'true' }, String.fromCharCode(65 + oi)),
      h('span', { class: 'txt' }, h('b', {}, o.label), h('span', { class: 'blurb' }, o.blurb),
        warns.length > 0 && h('span', { class: 'warn' }, 'You remember: ' + warns[0].text)));
    holdButton(el, () => pick(o, el));
    return el;
  });
  optsEl.append(...optEls);

  function pick(o: Option, chosenEl: HTMLElement) {
    if (committed) return; committed = true;
    const before = totalsFor(s);
    answer(s, q.id, o.id);
    const t = totalsFor(s);
    sfx.thud(); document.body.classList.remove('thud'); void document.body.offsetWidth; document.body.classList.add('thud');
    optEls.forEach((el) => { el.disabled = true; el.classList.add(el === chosenEl ? 'chosen' : 'gone'); });
    hint.hidden = true; askEl.classList.add('done'); preludeEl?.classList.add('done'); ctxEl?.classList.add('done');
    chosenEl.append(h('span', { class: 'stamp' }, 'Locked in'));
    bd.setTags(t.tags); bd.jolt(); refresh();
    const fx = h('div', { class: 'lockflash' }); document.body.append(fx); setTimeout(() => fx.remove(), 700);
    // the forecast for launch day moves the moment the choice lands
    animateWorld(wb, forecast());
    const dd = Math.round(t.days - before.days), dc = Math.round(t.cost - before.cost);
    const note = wb.querySelector('.clock-note') as HTMLElement;
    note.textContent = `Ship ready to fly ${monthYear(readyDay())}${dd ? ` (${dd > 0 ? '+' : ''}${dd} days)` : ''}`;
    note.classList.remove('tick'); void note.offsetWidth; note.classList.add('tick', dd > 0 ? 'later' : 'sooner');
    const react = h('p', { class: 'react' });
    const chips = plainChips(o);
    const first = q.why.split(/(?<=[.!?])\s/)[0];
    after.hidden = false;
    after.replaceChildren(
      h('div', { class: 'speaker small' }, avatar(sc.who), h('div', {}, h('b', {}, sc.who.name), h('span', {}, sc.who.title))),
      h('blockquote', { class: 'said react' }, h('span', { class: 'sr' }, sc.react[o.id] ?? ''), react),
      h('div', { class: 'ticker' },
        dd !== 0 && h('i', { class: dd > 0 ? 'bad' : 'good' }, `${dd > 0 ? '+' : ''}${dd} days`),
        dc !== 0 && h('i', { class: dc > 0 ? 'bad' : 'good' }, dc > 0 ? 'Costs more' : 'Costs less'),
        ...chips.filter((c) => !/Costs|Slower|Faster/.test(c)).map((c) => h('i', {}, c))),
      h('p', { class: 'note' }, h('b', {}, 'Ground truth. '), first),
      h('details', { class: 'whywrap' }, h('summary', {}, 'Why this mattered'), h('p', {}, q.why)));
    setTimeout(() => { sfx.radio(); }, 150);
    typeText(react, `“${sc.react[o.id] ?? ''}”`, () => {
      const go2 = btn(q.id === CABIN ? 'Back to the pad' : storyOrder.every((x) => s.current.decisions[x]) ? 'To the launch pad' : 'Continue', nextStep, 'btn primary');
      after.append(h('div', { class: 'row' }, go2)); go2.focus({ preventScroll: true });
    });
    later(() => after.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }), 300);
  }

  const ctxEl = q.context ? h('p', { class: 'context' }, q.context) : null;
  const revealOptions = () => { askEl.classList.add('in'); preludeEl && (preludeEl.hidden = false); optsEl.hidden = false; hint.hidden = false; optsEl.classList.add('in'); };
  const skip = typeText(said, sc.line, () => later(revealOptions, 150));
  quote.addEventListener('click', () => skip());

  const n = decisionNo(q.id);
  return shell(wb, h('div', { class: 'scene' },
    h('section', { class: 'stage-col' }, stage),
    h('section', { class: 'dialog glass' },
      h('div', { class: 'bignum', 'aria-hidden': 'true' }, String(n).padStart(2, '0')),
      h('p', { class: 'beatno' }, h('b', {}, `Decision ${n} / ${total}`), h('span', { class: `chip role-${q.role}` }, roleName[q.role]), h('span', { class: 'dim' }, q.role === 'crew' ? 'Everyone votes. You hold the deciding word.' : `You own: ${roleOwns[q.role]}`)),
      h('div', { class: 'speaker' }, avatar(sc.who, 'lg'), h('div', {}, h('b', {}, sc.who.name), h('span', {}, sc.who.title))),
      quote, preludeEl, askEl, ctxEl, optsEl, hint, after, gaugeHost)));
}

// ---------------------------------------------------------------- the world interrupts
function news() {
  const ev = (cur as Extract<Item, { t: 'news' }>).ev;
  // the news happens in the story's time; the real event it is based on is credited underneath
  const when = dateStr(dateAt(chapter, today()));
  const real = new Date(ev.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const mood = [ev.immediate?.trust ? (ev.immediate.trust > 0 ? 'The public is lifted.' : 'The public is shaken.') : '', ev.immediate?.budget ? (ev.immediate.budget > 0 ? 'Money loosens.' : 'Money gets tighter.') : '', ev.stress?.length ? 'Something out there is going to push on the mission.' : ''].filter(Boolean);
  later(() => sfx.news(), 150);
  return shell(h('div', { class: 'newsflash' },
    h('p', { class: 'flash' }, h('span', { class: 'dot' }), 'The world does not wait'),
    h('p', { class: 'when' }, when),
    h('h2', { tabindex: '-1', class: 'paper-head' }, ev.headline),
    h('p', { class: 'lede paperish' }, ev.body),
    mood.length > 0 && h('p', { class: 'fine' }, mood.join(' ')),
    h('p', { class: 'fine' }, 'You cannot undo it, and you will not know how much it matters until the flight.'),
    h('p', { class: 'fine dim' }, `Based on a real event from ${real}.`),
    h('div', { class: 'row' }, btn('Back to work', nextStep, 'btn primary'))));
}

// ---------------------------------------------------------------- the build: fit parts onto the rocket
/** which spot's parts are laid out; kept between visits so an interruption returns you to where you were */
let openSlot: string | null = null;
function build() {
  const d = s.current.decisions;
  const qOf = (id: string) => questions.find((q) => q.id === id)!;
  const needed = () => neededSlots(s);
  const nextEmpty = () => slotOrder.find((id) => needed().includes(id) && !d[id]) ?? null;
  if (!openSlot || !needed().includes(openSlot)) openSlot = nextEmpty() ?? slotOrder[0];

  const stage = stageHit();
  bd.showSite(totalsFor(s).tags, progressOf(s));
  const wb = worldBar(forecast(), { label: 'Today', day: today(), note: `Ship ready to fly ${monthYear(readyDay())}`, projected: true });
  const slotsEl = h('div', { class: 'slots', role: 'group', 'aria-label': 'Spots on the rocket' });
  const trayEl = h('div', { class: 'tray' });
  const sayEl = h('div', { class: 'fitsay', 'aria-live': 'polite' });
  const warnEl = h('div', { class: 'conflicts', 'aria-live': 'polite' });
  const gaugeHost = h('div', { class: 'systems open' });
  const roll = h('button', { class: 'btn primary big rollout', type: 'button' });
  const rollNote = h('p', { class: 'fine' });
  let busy = false; // an interruption is on its way: hands off the rocket

  const gauges = (preview?: Decisions) => gaugeHost.replaceChildren(
    gaugePanel(preview ? totalsFor(s, preview) : totalsFor(s), s.meters.budget, s.meters.day, preview ? totalsFor(s) : undefined));

  function drawSlots() {
    const need = needed(), hasLander = !!d['nav-route'];
    slotsEl.replaceChildren(...slotOrder.map((id, i) => {
      const q = qOf(id), opt = q.options.find((o) => o.id === d[id]);
      const off = !need.includes(id), locked = id !== 'nav-route' && !hasLander;
      return h('button', {
        class: `slot ${opt ? 'filled' : ''} ${openSlot === id ? 'open' : ''} ${off ? 'off' : ''}`, type: 'button', 'data-q': id,
        disabled: off || locked || busy, 'aria-pressed': String(openSlot === id),
        onclick: () => { sfx.unlock(); openSlot = id; drawSlots(); drawTray(); },
      }, h('span', { class: 'idx', 'aria-hidden': 'true' }, String(i + 1)), h('b', {}, q.slot ?? q.prompt),
        h('span', { class: 'has' }, off ? 'Not needed. Nothing docks with this lander.' : opt ? (opt.part ?? opt.label) : locked ? 'Choose a lander first' : 'Choose a part'));
    }));
  }

  function drawTray() {
    const q = qOf(openSlot!);
    trayEl.replaceChildren(
      h('p', { class: 'tray-ask' }, h('b', {}, q.slot ?? ''), q.prompt),
      ...q.options.map((o) => {
        const warns = warningsFor(s, o.tags), on = d[q.id] === o.id;
        const el = h('button', { class: `part ${on ? 'fitted' : ''}`, type: 'button', 'data-o': o.id, disabled: busy, 'aria-pressed': String(on) },
          h('b', {}, o.part ?? o.label), on && h('em', { class: 'fit-tag' }, 'Fitted'),
          h('span', { class: 'blurb' }, o.blurb),
          h('span', { class: 'chips' }, ...plainChips(o).map((c) => h('i', {}, c))),
          warns.length > 0 && h('span', { class: 'warn' }, 'You remember: ' + warns[0].text));
        el.addEventListener('click', () => fit(q, o));
        const show = () => { if (!busy) gauges({ [q.id]: o.id }); }, hide = () => gauges();
        el.addEventListener('pointerenter', show); el.addEventListener('pointerleave', hide);
        el.addEventListener('focus', show); el.addEventListener('blur', hide);
        return el;
      }),
      h('p', { class: 'note' }, h('b', {}, 'Why it matters. '), q.why.split(/(?<=[.!?])\s/)[0]));
  }

  function drawWarn() {
    const t = totalsFor(s);
    warnEl.replaceChildren(
      ...t.conflicts.map((id) => h('p', { class: 'conflict-warn' }, h('b', {}, 'These do not fit together. '), conflicts.find((c) => c.id === id)!.message)),
      ...(t.mass > t.capacity ? [h('p', { class: 'conflict-warn over' }, h('b', {}, 'Too heavy. '), 'The rocket cannot lift what is on it. It will not reach orbit.')] : []));
  }

  function drawRoll() {
    const filledAll = needed().every((q) => d[q]), more = !!pendingInterrupt(s, true);
    roll.textContent = more ? 'Continue' : 'Roll out to the launch poll';
    roll.disabled = !filledAll || busy;
    rollNote.textContent = !filledAll ? `${needed().filter((q) => !d[q]).length} spot${needed().filter((q) => !d[q]).length > 1 ? 's' : ''} still empty. You can swap any part until you roll out.`
      : more ? 'The rocket is complete. The world is not finished with you yet.' : 'Every spot is filled. Swap anything you like, then roll out.';
  }
  const redraw = () => { drawSlots(); drawTray(); drawWarn(); drawRoll(); gauges(); };

  function fit(q: Question, o: Option) {
    if (busy || d[q.id] === o.id) return;
    sfx.unlock();
    const before = totalsFor(s);
    setPart(s, q.id, o.id);
    const t = totalsFor(s);
    sfx.thud(); bd.setTags(t.tags); bd.jolt(); bd.setProgress(progressOf(s));
    animateWorld(wb, forecast());
    const dd = Math.round(t.days - before.days);
    const note = wb.querySelector('.clock-note') as HTMLElement;
    note.textContent = `Ship ready to fly ${monthYear(readyDay())}${dd ? ` (${dd > 0 ? '+' : ''}${dd} days)` : ''}`;
    note.classList.remove('tick', 'later', 'sooner'); void note.offsetWidth; note.classList.add('tick', dd > 0 ? 'later' : 'sooner');
    const sc = scenes[q.id];
    sayEl.replaceChildren(h('div', { class: 'speaker small' }, avatar(sc.who), h('div', {}, h('b', {}, sc.who.name), h('span', {}, sc.who.title))),
      h('blockquote', { class: 'said react' }, `“${sc.react[o.id] ?? ''}”`));
    later(() => sfx.radio(), 150);
    openSlot = nextEmpty() ?? q.id; // on to the next empty spot; stay put once the rocket is complete
    const it = pendingInterrupt(s);
    if (it) {
      busy = true;
      sayEl.append(h('p', { class: 'incoming' }, h('span', { class: 'dot' }), it.t === 'news' ? 'Stand by. News is coming in.' : 'Stand by. The test director needs you.'));
      later(() => interrupt(it), instant ? 250 : 1900);
    }
    redraw();
  }

  roll.addEventListener('click', () => {
    sfx.unlock();
    const it = pendingInterrupt(s, true);
    if (it) interrupt(it); else if (isReady(s)) go('poll');
  });

  redraw();
  return shell(wb, h('div', { class: 'scene buildscene' },
    h('section', { class: 'stage-col' }, stage),
    h('section', { class: 'dialog glass builder' },
      h('p', { class: 'beatno' }, missionName(missionNow()), h('span', { class: 'chip' }, 'On the pad')),
      h('h2', { tabindex: '-1', class: 'pollhead' }, 'Build the rocket'),
      h('p', { class: 'lede' }, 'Pick a spot, then a part. Watch the gauges. A heavy ship is harder to land.'),
      h('div', { class: 'buildgrid' }, slotsEl, trayEl),
      sayEl, warnEl, gaugeHost,
      h('div', { class: 'row launchrow' }, roll), rollNote)));
}

// ---------------------------------------------------------------- go / no-go
interface Station { who: string; name: string; text: string; caution: boolean }
function pollStations(): Station[] {
  const t = totalsFor(s); const out: Station[] = [];
  const ratio = t.mass / t.capacity, pw = peakUse(t) / t.gen, dataR = t.data / (t.comms + chapter.commsSlack);
  const conflictFor = (r: Role) => t.conflicts.map((id) => conflicts.find((c) => c.id === id)!).find((c) => c.roles[0] === r);
  const cf = (r: Role) => { const c = conflictFor(r); return c ? `Go. But the ${roleName[c.roles.find((x) => x !== r) ?? 'engineer'].toLowerCase()} and I never lined up on this. I should have pushed harder.` : null; };
  const thinFuel = landingFuelPreview(chapter, t) < 0.25;
  out.push({ who: 'Flight dynamics', name: 'Marta Ilves',
    text: ratio > 1 ? 'Go. But I will say it plainly: we are over what the rocket can lift. I am not comfortable.' : ratio > 0.92 ? 'Go. The margins are thinner than I would like.' : cf('navigator') ?? (thinFuel ? 'Go. Landing fuel is thin. Fly her gently.' : 'Go. The trajectory is clean.'), caution: ratio > 0.92 || !!conflictFor('navigator') || thinFuel });
  out.push({ who: 'Spacecraft', name: 'Priya Nair',
    text: cf('engineer') ?? (pw > 1 ? 'Go. But the power budget has no give in it. None.' : t.risk >= 3 ? 'Go. We cut corners and I know exactly where.' : 'Go. She is as ready as we can make her.'), caution: !!conflictFor('engineer') || pw > 1 || t.risk >= 3 });
  out.push({ who: 'Science', name: 'Dr. Lena Ortiz',
    text: cf('scientist') ?? (dataR > 1 ? 'Go. We will not be able to send everything home.' : t.science >= 4 ? 'Go. If it all works, we will rewrite textbooks.' : 'Go. We will bring back what we can.'), caution: !!conflictFor('scientist') || dataR > 1 });
  const low = s.meters.trust < 30 || s.meters.budget < 25;
  out.push({ who: 'Program', name: 'June Alvarez',
    text: cf('manager') ?? (low ? 'Go. The program does not survive another failure. I want that on the record.' : 'Go. The country is watching.'), caution: !!conflictFor('manager') || low });
  return out;
}

function poll() {
  const crew = crewNow(); const t = totalsFor(s);
  const st = pollStations();
  const cautions = st.filter((x) => x.caution).length;
  const list = h('div', { class: 'stations' });
  const launchWrap = h('div', { class: 'row launchrow', hidden: true });
  const stage = stageHit();
  bd.showSite(t.tags, 1);
  const launchDay = readyDay();
  const wb = worldBar(projectMeters(s.meters, chapter, t, s.current.events), { label: 'Launch day', day: launchDay, note: `${fmt(Math.max(0, chapter.deadlineDay - launchDay))} days before the decade ends`, projected: true });
  const risk = 1 - survival(s);

  st.forEach((x, i) => later(() => {
    const row = h('div', { class: `station ${x.caution ? 'caution' : 'go'}` }, h('span', { class: 'who' }, x.who), h('span', { class: 'name' }, x.name),
      h('span', { class: 'say' }, `“${x.text}”`), h('em', { class: 'status' }, x.caution ? 'GO, WITH RESERVATIONS' : 'GO'));
    list.append(row); requestAnimationFrame(() => row.classList.add('in')); x.caution ? sfx.warn() : sfx.go();
  }, 700 + i * 1000));

  later(() => {
    const row = h('div', { class: 'station cmd go' }, h('span', { class: 'who' }, 'Commander'), h('span', { class: 'name' }, crew[0].name),
      h('span', { class: 'say' }, `“${cautions >= 3 ? 'Crew is go. All of us know the odds.' : cautions >= 1 ? 'Crew is go. We know what we are carrying.' : 'Crew is go. Let us do this.'}”`), h('em', { class: 'status' }, 'GO'));
    list.append(row); requestAnimationFrame(() => row.classList.add('in')); sfx.go();
    later(() => {
      const b = h('button', { class: 'btn primary big launch', type: 'button' }, h('span', { class: 'hold-fill', 'aria-hidden': 'true' }), instant ? 'Launch' : 'Hold to launch');
      holdButton(b, doLaunch, 1200);
      launchWrap.hidden = false; launchWrap.append(b, h('p', { class: 'fine' }, 'Once the countdown starts, nothing can be changed.')); b.focus({ preventScroll: true });
      later(() => b.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }), 50);
    }, 600);
  }, 700 + st.length * 1000);

  return shell(wb, h('div', { class: 'scene' },
    h('section', { class: 'stage-col' }, stage),
    h('section', { class: 'dialog glass' },
      h('p', { class: 'beatno' }, missionName(missionNow()), h('span', { class: 'chip' }, 'Launch poll')),
      h('h2', { tabindex: '-1', class: 'pollhead' }, 'Flight director: poll the room'),
      h('div', { class: 'crewline' }, ...crew.map((c) => h('span', {}, avatar(c), h('b', {}, c.name), h('small', {}, c.title)))),
      h('p', { class: 'lede' }, `They are strapped in. Everyone has to say it out loud.`),
      h('p', { class: `odds ${risk > 0.12 ? 'high' : ''}` }, h('b', {}, `${fmt(risk * 100, 1)}%`), h('span', {}, 'chance a part fails on the coast out or the trip home. The liftoff, the Moon and the landing are in your hands.')),
      list, launchWrap)));
}

/** Reduced-motion and ?quick=1 players get the autopilot unless they ask to fly (?fly=1, or the link on each moment). */
let autoFly = instant && !qs.has('fly');
const expose = (o: Record<string, unknown> | null) => { (window as any).__game.fly = o; };

/** Open the flight scene. `done` gets what the player flew once it is over. */
function openFlight(liftoff: Mark, commander: string, done: (flown: FlownResult) => void, startAt?: 'orbit' | 'site') {
  bd.pause();
  const holder = h('div', { class: 'cutwrap' }); document.body.append(holder);
  const site = questions.find((q) => q.id === SITE)!;
  cut = new Flight(holder, {
    tags: totalsFor(s).tags, commander, liftoff, startAt,
    auto: () => autoFly, setAuto: (v) => { autoFly = v; },
    peek: (flown) => peek(s, flown),
    orbitSetup: () => orbitSetup(chapter, totalsFor(s), s.current.events),
    landingSetup: (marks, where, attempt) => landingSetup(chapter, totalsFor(s), s.current.events, marks, where, attempt),
    sites: () => site.options.map((o) => ({
      id: o.id as Site,
      label: o.id === 'flat' ? 'The plain' : 'The highlands',
      blurb: o.id === 'flat' ? 'Flat everywhere. The easier landing.' : 'Rocks, with one flat pad to set down on. A gentler touchdown is needed. More science.',
      locked: siteOverloadsLink(chapter, totalsFor(s), s.current.events, o) ? 'Your antenna cannot carry the extra data from here.' : null,
    })),
    chooseSite: (id) => answer(s, SITE, id),
    ending: endingFor,
    expose,
    onDone: (flown) => { holder.remove(); cut = null; expose(null); done(flown); },
  });
}

function doLaunch() {
  const prev = { ...s.meters }; const crew = crewNow(); const mission = missionNow();
  sfx.ambient(false);
  document.body.classList.add('launching'); // the interface steps aside so you can watch her go
  (document.activeElement as HTMLElement | null)?.blur?.();
  const over = h('div', { class: 'countdown', 'aria-live': 'assertive' }); document.body.append(over);
  const k = qs.has('fast') || instant ? 0.28 : 1;
  ['T minus 3', '2', '1'].forEach((txt, i) => window.setTimeout(() => {
    over.textContent = txt; over.classList.remove('pulse'); void over.offsetWidth; over.classList.add('pulse'); sfx.tick();
  }, i * 900 * k));
  window.setTimeout(() => {
    over.remove();
    flyLiftoff((liftoff) => openFlight(liftoff, `Cdr. ${surname(crew[0])}`, (flown) => {
      const run = finishFlight(s, flown);
      const ok = run.outcome!.success;
      lastFlight = { mission, crew, prev, ok, date: dateStr(dateAt(chapter, s.meters.day)) };
      if (!ok) { fallen.push({ mission, crew, cause: endingFor(run.outcome!.cause).headline, date: lastFlight.date }); saveFallen(); }
      go('paper');
    }));
  }, 3 * 900 * k);
}

/**
 * ?practice=liftoff, ?practice=orbit and ?practice=landing go straight to that moment with a sensible rocket,
 * and come back to it every time. Nothing is saved and nobody is lost: it is for learning the controls.
 */
function practice(what: string) {
  for (const [q, o] of [['mgr-funding', 'modest'], ['mgr-schedule', 'steady'], ['eng-cabin', 'fix']]) answer(s, q, o);
  for (const [q, o] of [['nav-route', 'lor'], ['eng-docking', 'robust'], ['eng-power', 'standard'], ['sci-antenna', 'small'], ['sci-instruments', 'min'], ['nav-disposal', 'leave']]) setPart(s, q, o);
  delete s.current.decisions[SITE];
  autoFly = false; document.body.classList.add('launching');
  const again = () => practice(what);
  if (what === 'liftoff') { bd.showSite(totalsFor(s).tags, 1); flyLiftoff(again); }
  else openFlight('fair', 'Cdr. Practice', again, what === 'orbit' ? 'orbit' : 'site');
}

/**
 * The first flown moment, on the pad: hold the engine, follow the guide arrow as it leans over, and drop the
 * first stage when it runs dry. Nothing here can lose the crew: if the flying goes badly wrong, guidance takes over.
 */
function flyLiftoff(done: (mark: Mark) => void) {
  const setup = liftoffSetup(chapter, totalsFor(s), s.current.events);
  const fa = new FlightAudio();
  let layer = flyLayer(document.body, 'liftoff', '', []);
  let a = startAscent(setup);
  let controls: FlyControls | null = null, hud: Hud | null = null, steps: { set(n: number): void } | null = null, aim: ReturnType<typeof aimMark> | null = null;
  let flying = false, ended = false, toldGuided = false, stuck = 0, raf = 0, last = performance.now();
  const born = last;
  const drawAuto = () => autoLink(layer, autoFly, () => { autoFly = !autoFly; drawAuto(); });
  const start = () => {
    layer.remove(); layer = flyLayer(document.body, 'liftoff', '', []);
    controls = new FlyControls(window);
    hud = ascentHud(layer, setup);
    steps = coach(layer, ['Hold the engine', 'Follow the arrow as it leans', 'Stage empty: let go, press again', 'Hold the arrow to the top']);
    aim = aimMark(layer);
    controlStrip(layer, controls);
    drawAuto(); flying = true; last = performance.now();
  };
  const finish = (mark: Mark, say: string, tone: 'good' | 'ok' | 'bad') => {
    if (ended) return; ended = true;
    controls?.dispose(); controls = null; hud = null; steps = null; aim = null;
    layer.remove(); layer = flyLayer(document.body, 'liftoff', '', []);
    flyNote(layer, say, tone); sfx.thud();
    expose({ moment: 'liftoff', part: 'done', mark });
    window.setTimeout(() => { cancelAnimationFrame(raf); fa.stop(); layer.remove(); expose(null); bd.endPose(); done(mark); }, 1500);
  };
  howTo(layer, 'How to launch', [
    'Hold the engine. The rocket lifts off.',
    'Follow the arrow. It leans over as you climb: turn to stay on it.',
    'When the first stage runs dry, let go and press the engine again. That drops it and lights the next.',
  ], [
    `Climb to ${fmt(setup.targetY)} m. Staying on the arrow and relighting quickly saves fuel for the landing.`,
    ...(setup.twr < 1 ? ['This rocket is over its mass limit.'] : setup.twr < 1.3 ? ['This rocket is heavy. It will climb slowly.'] : []),
  ], setup.warnings, start);
  drawAuto();

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!flying) { // waiting on the card
      expose({ moment: 'liftoff', part: 'card' });
      if (autoFly && now - born > 2500) (layer.querySelector('.howto .start') as HTMLElement | null)?.click();
      bd.poseRocket(0, 0, 0, 0); fa.update(0.05, 0, 0);
      return;
    }
    const hands: Controls = ended || autoFly || !controls ? ascentPilot(a, setup) : controls.state;
    const power = thrusting(a, a.guided ? ascentPilot(a, setup) : hands);
    a = stepAscent(a, hands, dt, setup);
    const guide = guideAngle(setup, a.y);
    bd.poseRocket(a.x, a.y, a.angle, power);
    fa.update(power > 0 ? 0.3 + 0.6 * power : 0.06, 0, 0);
    if (ended) return; // the note is up; the rocket keeps climbing behind it
    let off = guide - a.angle; while (off > Math.PI) off -= 2 * Math.PI; while (off < -Math.PI) off += 2 * Math.PI;
    const p = bd.rocketScreen();
    hud?.set({ fuel: a.stage === 1 ? a.fuel1 / setup.burn1 : 1, stage: a.stage, y: a.y, throttle: hands.throttle });
    steps?.set(a.stage === 2 ? 3 : stageDry(a) ? 2 : a.y < 3 && power === 0 ? 0 : 1);
    aim?.set({ x: p.x, y: p.y, r: p.px * 0.62, guide, aligned: Math.abs(off) < 0.14, show: true });
    expose({ moment: 'liftoff', part: 'fly', y: a.y, targetY: setup.targetY, angle: a.angle, guide, stage: a.stage, dry: stageDry(a), guided: a.guided });
    if (a.guided && !toldGuided) { toldGuided = true; flyNote(layer, 'Guidance has taken over', 'bad'); controls?.letGo(); }
    // a rocket over its mass limit burns and goes nowhere
    stuck = setup.twr < 1 && power > 0 && a.y < 1 ? stuck + dt : stuck;
    if (stuck > 4 || (setup.twr < 1 && a.guided && a.t > 14)) { finish('rough', 'Too heavy to lift', 'bad'); return; }
    if (ascentDone(a, setup)) {
      const mark = autoFly ? AUTOPILOT.liftoff : gradeAscent(a, setup);
      finish(mark, autoFly ? 'Autopilot liftoff' : a.guided ? 'Guidance flew it. That cost fuel.' : mark === 'clean' ? 'Clean liftoff' : mark === 'fair' ? 'A fair liftoff. It cost a little fuel.' : 'A rough liftoff. It cost fuel.',
        mark === 'clean' ? 'good' : mark === 'fair' ? 'ok' : 'bad');
    }
  };
  loop();
}

// ---------------------------------------------------------------- front page, then the investigation
function paper() {
  const f = lastFlight!; const run = s.runs[s.runs.length - 1]; const o = run.outcome!; const end = endingFor(o.cause);
  const p = f.ok ? papers.success : o.cause === 'comms' ? papers.comms : o.cause === 'power' ? papers.power : o.cause === 'piloting' ? papers.crash : papers.vehicle;
  const bar = worldBar({ ...f.prev, day: s.meters.day }); // the front page is dated the day she flew
  later(() => animateWorld(bar, s.meters), 1400);
  later(() => sfx.news(), 200);
  const cn = names(f.crew);
  return shell(bar, h('article', { class: `paper ${f.ok ? 'win' : 'loss'}` },
    h('div', { class: 'mast' }, h('span', {}, 'The Daily Ledger'), h('span', {}, f.date), h('span', {}, missionName(f.mission))),
    h('h2', { class: 'paper-head xl', tabindex: '-1' }, p.head),
    h('p', { class: 'deck' }, p.sub(cn)),
    h('div', { class: 'faces' }, ...f.crew.map((c) => h('figure', { class: f.ok ? '' : 'lostface' }, avatar(c, 'xl'), h('figcaption', {}, h('b', {}, c.name), h('span', {}, c.title))))),
    f.ok ? h('p', { class: 'memo' }, `${surname(f.crew[0])} will be remembered for the first words spoken on another world. You designed the way there.`)
      : h('p', { class: 'memo' }, o.cause === 'piloting' ? `In memory of ${cn}. You built the ship, and your hands were on the controls.` : `In memory of ${cn}. They flew because you decided they should.`),
    h('div', { class: 'row' }, btn(f.ok ? 'Read the full report' : 'Face the investigation', () => go('report'), 'btn primary big'))));
}

/** How the player flew a phase, for the three that are flown. Null for the two that are watched. */
function flownLine(p: PhaseResult): string | null {
  if (!FLOWN.includes(p.phase)) return null;
  const f = p.flown;
  if (f === undefined) return 'Never flown';
  if (typeof f === 'string') return `Flown: ${f}`;
  return f.landed ? `Touched down at ${fmt(f.speed, 1)} m/s with ${fmt(f.fuelLeft * 100)}% fuel left, on the ${f.tries === 1 ? 'first' : 'second'} try`
    : `Came down at ${fmt(f.speed, 1)} m/s`;
}

function delta(label: string, v: number, goodUp: boolean) {
  const good = goodUp ? v >= 0 : v <= 0;
  return h('div', {}, h('span', { class: 'dim' }, label), h('b', { class: good ? 'up' : 'down' }, `${v >= 0 ? '+' : ''}${fmt(v)}`));
}

function report() {
  const f = lastFlight!;
  const run = s.runs[s.runs.length - 1]; const o = run.outcome!; const res = run.resolution!; const end = endingFor(o.cause);
  const bad = o.phases.find((p) => p.checks.some((c) => !c.passed));
  const failedCheck = bad?.checks.find((c) => !c.passed);
  const roleOf = (q: Question) => (q.role === 'crew' ? 'Crew' : roleName[q.role]);
  const ok = o.success;
  // how close each phase came to a limit, so a clean run still shows where it nearly broke
  const what: Record<string, string> = { mass: 'Mass', power: 'Power', comms: 'Data link', hardware: 'Hardware' };
  const tightest = (cs: Check[]) => cs.reduce<Check | null>((a, c) => (!a || c.value / c.limit > a.value / a.limit ? c : a), null);
  const closest = o.phases.filter((p) => p.reached).map((p) => ({ p, c: tightest(p.checks) })).filter((x) => x.c)
    .sort((a, b) => b.c!.value / b.c!.limit - a.c!.value / a.c!.limit)[0];
  const nextBtn = ok ? btn('See the final result', () => go('done'), 'btn primary')
    : s.hardEnd ? btn('Continue', () => go('collapse'), 'btn primary')
    : btn(`Fly ${missionName(missionNow())} with what we learned`, () => { retry(s); sfx.ambient(true); go('brief'); }, 'btn primary');

  return shell(worldBar(s.meters), h('article', { class: `report ${ok ? 'win' : 'loss'}` },
    h('p', { class: 'eyebrow' }, `${missionName(f.mission)} · what happened`),
    h('h2', { tabindex: '-1' }, ok ? end.title : end.headline),
    h('p', { class: 'lede' }, end.because),
    h('ol', { class: 'phases' }, ...o.phases.map((p) => {
      const c = tightest(p.checks); const use = c ? c.value / c.limit : 0;
      return h('li', { class: p.passed ? 'pass' : p.reached ? 'fail' : 'skip' },
        h('b', {}, phaseNames[p.phase]), h('span', {}, p.passed ? 'Passed' : p.reached ? 'Failed' : 'Not reached'),
        p.reached && c && h('div', { class: `margin ${use > 1 ? 'over' : use > 0.88 ? 'tight' : ''}` }, h('i', { style: `width:${Math.min(100, use * 100)}%` })),
        p.reached && c && h('small', {}, `${what[c.kind]} at ${fmt(use * 100)}% of its limit`),
        p.reached && h('small', { class: 'dim' }, flownLine(p) ?? `${fmt(p.failProb * 100, 1)}% chance of a part failing`));
    })),
    ok && closest && h('p', { class: 'closest' }, h('b', {}, 'Closest call. '),
      `${what[closest.c!.kind]} during ${phaseNames[closest.p.phase].toLowerCase()} reached ${fmt((closest.c!.value / closest.c!.limit) * 100)}% of its limit (${fmt(closest.c!.value, 1)} of ${fmt(closest.c!.limit, 1)} ${closest.c!.unit}). ${closest.c!.value / closest.c!.limit > 0.88 ? 'A little more and this crew would not have come home.' : 'There was room to spare there.'}`),
    failedCheck && h('section', { class: 'card' }, h('h3', {}, `What failed: ${failedCheck.label}`),
      h('p', {}, `The mission needed ${fmt(failedCheck.value, 1)} ${failedCheck.unit} but the limit was ${fmt(failedCheck.limit, 1)} ${failedCheck.unit}.`),
      end.avoid && h('p', { class: 'dim' }, end.avoid)),
    o.cause === 'hardware' && h('section', { class: 'card' }, h('h3', {}, `What failed: a component, during ${phaseNames[o.failedPhase!].toLowerCase()}`),
      h('p', {}, `Every system was within its limits, but the design carried risk. This phase had a ${fmt(o.phases.find((p) => p.phase === o.failedPhase)!.failProb * 100)}% chance of failing, and it did.`),
      h('p', { class: 'dim' }, end.avoid)),
    o.totals.conflicts.length > 0 && h('section', { class: 'card' }, h('h3', {}, 'Where the roles pulled against each other'),
      ...o.totals.conflicts.map((id) => h('p', {}, conflicts.find((c) => c.id === id)!.message))),
    o.cause === 'piloting' && h('section', { class: 'card' }, h('h3', {}, 'What failed: the landing'),
      h('p', {}, `Both tries came down too fast. The last one reached the surface at ${fmt(o.flown.landing?.speed ?? 0, 1)} metres per second.`),
      h('p', { class: 'dim' }, end.avoid)),
    !ok && o.cause && s.lessons.some((l) => l.cause === o.cause) && h('section', { class: 'card lesson' }, h('h3', {}, 'Lesson saved'),
      h('p', {}, end.lessonText), h('p', { class: 'fine' }, 'Next time, you will be warned when a choice looks like this one.')),
    h('details', { class: 'card', open: true }, h('summary', {}, 'What the world threw at you'),
      ...run.events.map((e) => {
        const mit = e.mitigatedBy?.some((t) => o.totals.tags.includes(t));
        return h('div', { class: 'headline' }, h('b', {}, `${e.headline} `, mit && h('em', { class: 'badge ok' }, 'you were ready'), !mit && e.stress && h('em', { class: 'badge placeholder' }, 'it hit you')), h('span', {}, e.explain));
      })),
    h('details', { class: 'card', open: true }, h('summary', {}, 'Who chose what'),
      h('p', { class: 'fine' }, 'Now the crew can talk about it without blame.'),
      h('div', { class: 'choices' }, ...answered(run.decisions).map(({ q, opt }) =>
        h('div', { class: 'choice' }, h('span', { class: `chip role-${q.role}` }, roleOf(q)), h('span', {}, q.slot ?? q.prompt), h('b', {}, opt.part ?? opt.label))))),
    h('details', { class: 'card' }, h('summary', {}, 'What this attempt did to the world'),
      h('ul', { class: 'log' }, ...res.log.map((l) => h('li', {}, l))),
      h('div', { class: 'deltas' }, delta('Budget', res.deltas.budget, true), delta('Public trust', res.deltas.trust, true), delta('Debris', res.deltas.debris, false),
        h('div', {}, h('span', { class: 'dim' }, 'Time'), h('b', {}, `+${fmt(res.deltas.days)} days`)))),
    res.late && h('p', { class: 'fine' }, 'The decade had already ended, so the public trust gain was halved.'),
    h('details', { class: 'card history' }, h('summary', {}, 'What really happened'),
      ...realHistory.summary.map((t) => h('p', {}, t)),
      h('div', { class: 'choices' }, ...answered(run.decisions).filter(({ q }) => realHistory.optionByQuestion[q.id]).map(({ q, opt: mine }) => {
        const real = q.options.find((x) => x.id === realHistory.optionByQuestion[q.id])!;
        return h('div', { class: 'cmp' }, h('b', {}, q.prompt), h('span', {}, `You: ${mine.label}`), h('span', { class: real.id === mine.id ? 'same' : '' }, `History: ${real.label}`), h('small', {}, realHistory.notes[q.id]));
      })), h('p', { class: 'fine' }, `Source: ${realHistory.source.label} (${realHistory.source.status})`)),
    h('div', { class: 'row' }, nextBtn)));
}

// ---------------------------------------------------------------- hard end
function collapse() {
  const w = s.hardEnd!;
  const msg = {
    budget: ['The money is gone', 'The program has spent everything it had. Congress will not fund another attempt, and the Moon program is cancelled.'],
    trust: ['The public has lost faith', 'After too many failures, the public and the politicians have turned against the program. It is cancelled.'],
    debris: ['Orbit is too crowded', 'The debris left behind makes new launches too dangerous. Humanity is stuck on the ground.'],
  }[w!];
  sfx.stinger('loss');
  return shell(h('div', { class: 'collapse' }, h('p', { class: 'eyebrow' }, 'The end of the program'), h('h2', { tabindex: '-1' }, msg[0]), h('p', { class: 'lede' }, msg[1]),
    memorial(),
    h('p', {}, `${fallen.length} crew${fallen.length > 1 ? 's' : ''} flew and did not come home. Space exploration ends here, in this world.`),
    h('p', { class: 'fine' }, 'Start again with a fresh world. The lessons you learned are kept, and so is the memory of who was lost.'),
    h('div', { class: 'row' }, btn('Start again', () => { s = newSession(Math.floor(Math.random() * 1e9)); sfx.ambient(true); go('brief'); }, 'btn primary'))));
}

// ---------------------------------------------------------------- chapter complete
function done() {
  const g = s.grade!; const run = s.runs[s.runs.length - 1]; const crew = lastFlight?.crew ?? crewNow();
  addToBoardOnce();
  const link = `${location.origin}${location.pathname}#r=${encodeShare(s)}`;
  const copy = h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(link); copy.textContent = 'Link copied'; } catch { prompt('Copy this link', link); } } }, 'Copy result link');
  return shell(worldBar(s.meters), h('article', { class: 'report win' },
    h('p', { class: 'eyebrow' }, `Chapter ${chapter.id} complete: ${chapter.title}`),
    h('h2', { tabindex: '-1' }, 'One small step'),
    h('p', { class: 'lede' }, `${names(crew)} came home. ${fallen.length > 0 ? `${fallen.length} crew${fallen.length > 1 ? 's' : ''} did not, and the road there was paid for by them.` : 'Nobody was lost on the way. That almost never happens.'}`),
    fallen.length > 0 && memorial(),
    h('div', { class: 'grade' }, h('div', { class: 'letter' }, g.letter), h('div', {},
      h('p', {}, `Score ${fmt(g.score)} · ${s.runs.length} attempt${s.runs.length > 1 ? 's' : ''} · landed ${dateStr(dateAt(chapter, s.meters.day))}`),
      h('p', { class: 'dim' }, `Efficiency ${fmt(g.efficiency)} (budget, time, and not overbuilding). Teamwork ${fmt(g.teamwork * 100)}% of role conflicts avoided. Science return ${fmt(run.outcome!.totals.science)} of 6.`))),
    h('p', { class: 'lede' }, `You landed ${fmt(chapter.deadlineDay - s.meters.day)} days before the decade ended.`),
    h('section', { class: 'card' }, h('h3', {}, 'Leaderboard (this device)'), h('ol', { class: 'board' }, ...board().map((b) => h('li', {}, h('b', {}, b.grade), h('span', {}, `${b.score} pts`), h('span', { class: 'dim' }, `${b.runs} attempt${b.runs > 1 ? 's' : ''}`))))),
    h('div', { class: 'row' }, copy, btn('Back to the report', () => go('report'), 'btn ghost'),
      btn('Play again (fresh world)', () => { s = newSession(Math.floor(Math.random() * 1e9)); go('title'); }, 'btn primary')),
    h('p', { class: 'fine' }, 'Next chapters would carry orbital debris forward, because it never goes away.')));
}
let boarded = -1;
function addToBoardOnce() { if (boarded !== s.baseSeed + s.runs.length) { boarded = s.baseSeed + s.runs.length; addToBoard(s); } }

// ---------------------------------------------------------------- shared result
function shared() {
  const d = sharedView!;
  return shell(h('article', { class: 'report win' }, h('p', { class: 'eyebrow' }, 'Shared result'), h('h2', { tabindex: '-1' }, `Grade ${d.grade}, score ${d.score}`),
    h('p', { class: 'lede' }, `${d.runs} attempt${d.runs > 1 ? 's' : ''}, landed ${dateStr(dateAt(chapter, d.day))}.`),
    h('div', { class: 'choices' }, ...questions.map((q) => { const o = q.options.find((x) => x.id === d.decisions[q.id]); return o && h('div', { class: 'choice' }, h('span', { class: `chip role-${q.role}` }, q.role === 'crew' ? 'Crew' : roleName[q.role]), h('span', {}, q.prompt), h('b', {}, o.label)); })),
    h('div', { class: 'row' }, btn('Play the mission', () => { history.replaceState(null, '', location.pathname); sharedView = null; go('title'); }, 'btn primary'))));
}

render();
// Hooks for automated testing
(window as any).__game = { get s() { return s; }, go, doLaunch, answer, PHASES };
if (['liftoff', 'orbit', 'landing'].includes(qs.get('practice') ?? '')) { introSeen = true; go('title'); practice(qs.get('practice')!); }
