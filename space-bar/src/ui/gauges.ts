import { content } from '../data';
import { Meters, Phase, Totals } from '../sim/types';
import { dateAt } from '../sim/meters';
import { landingFuelPreview } from '../sim/flight';
import { h, fmt, dateStr } from './dom';

const ch = content.chapter;

function status(ratio: number) { return ratio > 1 ? 'bad' : ratio > 0.88 ? 'warn' : 'ok'; }

function bar(label: string, hint: string, value: number, limit: number, unit: string, prev?: number, flip = false) {
  const ratio = limit > 0 ? value / limit : 0;
  const cls = status(ratio);
  const el = h('div', { class: `gauge ${cls}`, title: hint },
    h('div', { class: 'g-top' }, h('span', { class: 'g-label' }, label),
      h('span', { class: 'g-val' }, `${fmt(value, 1)} / ${fmt(limit, 1)} ${unit}`)),
    h('div', { class: 'g-track', role: 'meter', 'aria-label': label, 'aria-valuenow': fmt(value, 1), 'aria-valuemax': fmt(limit, 1) },
      h('div', { class: 'g-fill', style: `width:${Math.min(100, ratio * 100)}%` }),
      prev !== undefined && h('div', { class: 'g-ghost', style: `left:${Math.min(100, (prev / limit) * 100)}%` })),
    h('div', { class: 'g-note' }, cls === 'bad' ? 'Over the limit' : cls === 'warn' ? 'Nearly full' : 'Within limits'));
  void flip;
  return el;
}

/** Spare landing fuel. Unlike the other gauges, more is better. */
function fuelBar(frac: number, prev?: number) {
  const cls = frac < 0.25 ? 'bad' : frac < 0.5 ? 'warn' : 'ok';
  return h('div', { class: `gauge fuel ${cls}`, title: 'How much spare fuel this build leaves for the landing. A lighter ship has more.' },
    h('div', { class: 'g-top' }, h('span', { class: 'g-label' }, 'Landing fuel'), h('span', { class: 'g-val' }, `${fmt(frac * 100)}% spare`)),
    h('div', { class: 'g-track', role: 'meter', 'aria-label': 'Landing fuel', 'aria-valuenow': fmt(frac * 100), 'aria-valuemax': '100' },
      h('div', { class: 'g-fill', style: `width:${Math.max(2, frac * 100)}%` }),
      prev !== undefined && h('div', { class: 'g-ghost', style: `left:${Math.min(100, prev * 100)}%` })),
    h('div', { class: 'g-note' }, cls === 'bad' ? 'Very tight' : cls === 'warn' ? 'Tight' : 'Comfortable'));
}

export function peakUse(t: Totals) { return Math.max(...(['coast', 'orbit', 'landing', 'return'] as Phase[]).map((p) => t.load * ch.phaseLoad[p])); }

/** Spacecraft resource gauges. `prev` shows a ghost marker for the option being hovered. */
export function gaugePanel(t: Totals, budgetLeft: number, day: number, prev?: Totals) {
  const arrive = dateAt(ch, day + t.days);
  return h('div', { class: 'gauges' },
    bar('Mass', 'Spacecraft mass against what the rocket can lift to the Moon', t.mass, t.capacity, 't', prev?.mass),
    fuelBar(landingFuelPreview(ch, t), prev ? landingFuelPreview(ch, prev) : undefined),
    bar('Power', 'Peak power used in any phase against power generated', peakUse(t), t.gen, 'kW', prev ? peakUse(prev) : undefined),
    bar('Data link', 'Data produced on the surface against the antenna capacity', t.data, t.comms + ch.commsSlack, 'Mb/s', prev?.data),
    bar('Cost of this attempt', 'Budget this attempt would spend against what the program has left', t.cost, Math.max(1, budgetLeft), 'pts', prev?.cost),
    h('div', { class: 'gauge days' }, h('div', { class: 'g-top' }, h('span', { class: 'g-label' }, 'Time'), h('span', { class: 'g-val' }, `${fmt(t.days)} days`)),
      h('div', { class: 'g-note' }, `Ready around ${dateStr(arrive)}`)));
}

function meterRow(label: string, value: number, cls: string, hint: string, bad: 'low' | 'high') {
  const danger = bad === 'low' ? value < 20 : value > 80;
  return h('div', { class: `meter ${cls} ${danger ? 'danger' : ''}`, title: hint },
    h('span', { class: 'm-label' }, label),
    h('div', { class: 'm-track', role: 'meter', 'aria-label': label, 'aria-valuenow': fmt(value), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('div', { class: 'm-fill', style: `width:${Math.max(0, Math.min(100, value))}%` })),
    h('span', { class: 'm-val' }, fmt(value)));
}

export interface ClockOpts {
  /** small label above the date */
  label?: string;
  /** the calendar day to show; defaults to the meters' day */
  day?: number;
  /** replaces the "days until the decade ends" line */
  note?: string;
  /** the meters are a forecast for launch day, not the present */
  projected?: boolean;
}
export const monthYear = (day: number) => dateAt(ch, day).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** The three world meters + calendar. */
export function worldBar(m: Meters, o: ClockOpts = {}) {
  const day = o.day ?? m.day;
  const daysLeft = Math.max(0, ch.deadlineDay - day);
  return h('header', { class: `worldbar ${o.projected ? 'projected' : ''}` },
    h('div', { class: 'meters' },
      meterRow(o.projected ? 'Budget at launch' : 'Budget', m.budget, 'budget', 'Program funds. At 0 the program is cancelled.', 'low'),
      meterRow(o.projected ? 'Trust at launch' : 'Public trust', m.trust, 'trust', 'Support from the public and politicians. At 0 the program is cancelled.', 'low'),
      meterRow('Orbital debris', m.debris, 'debris', 'How cluttered Earth orbit is. At 100 launches are too dangerous.', 'high')),
    h('div', { class: 'clock' }, o.label && h('small', {}, o.label), h('b', {}, dateStr(dateAt(ch, day))), h('span', { class: 'clock-note' }, o.note ?? `${fmt(daysLeft)} days until the decade ends`)));
}

/** Slide the three world meters from one state to another, so a result is felt rather than read. */
export function animateWorld(bar: HTMLElement, to: Meters) {
  const vals = [to.budget, to.trust, to.debris];
  bar.querySelectorAll('.meter').forEach((el, i) => {
    const v = Math.max(0, Math.min(100, vals[i]));
    const fill = el.querySelector('.m-fill') as HTMLElement, num = el.querySelector('.m-val') as HTMLElement;
    const from = parseFloat(num.textContent || '0');
    fill.style.width = `${v}%`;
    const danger = i === 2 ? v > 80 : v < 20; el.classList.toggle('danger', danger);
    el.classList.remove('dropped', 'rose', 'same'); void (el as HTMLElement).offsetWidth;
    el.classList.add(Math.round(v) < Math.round(from) ? 'dropped' : Math.round(v) > Math.round(from) ? 'rose' : 'same');
    const d = Math.round(v) - Math.round(from);
    if (d !== 0) { // a number that flies off the meter, so the change is impossible to miss
      const fly = h('span', { class: `m-delta ${(i === 2 ? d < 0 : d > 0) ? 'good' : 'bad'}` }, `${d > 0 ? '+' : ''}${d}`);
      el.append(fly); setTimeout(() => fly.remove(), 1800);
    }
    const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 900); num.textContent = String(Math.round(from + (v - from) * k)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
