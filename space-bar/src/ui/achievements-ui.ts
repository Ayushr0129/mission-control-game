import { achievements, AchievementId, loadHeld } from '../game/achievements';
import { uiText } from '../prefs';
import { badgeSvg } from './badges';
import { h } from './dom';

/** True only when the URL has ?quick. Reduced-motion players fly `instant` too, but they still earn badges. */
export function quickRun(search: string): boolean { return new URLSearchParams(search).has('quick'); }

const tr = (t: [string, string]) => uiText(t[0], t[1]);
const byId = new Map(achievements.map((a) => [a.id, a]));
/** The badge art. Hidden from screen readers: the name next to it is the accessible text. */
const art = (id: AchievementId) => h('span', { class: 'ach-art', 'aria-hidden': 'true', html: badgeSvg(id) });

const SHOW_MS = 5000, FADE_MS = 400;

/**
 * "Achievement earned" cards, one per badge, stacked in a polite live region. Append it to `document.body`
 * (outside the screen, so a re-render does not wipe it). Each card fades after about 5 s, or when closed;
 * the region removes itself once empty. Null when nothing was earned.
 */
export function earnedToast(ids: AchievementId[]): HTMLElement | null {
  if (!ids.length) return null;
  const region = h('div', { class: 'ach-toasts', role: 'status', 'aria-live': 'polite' });
  const dismiss = (card: HTMLElement) => {
    if (card.classList.contains('out')) return;
    // a keyboard user closing a card moves to the next card's close button, not to <body>
    if (card.contains(document.activeElement)) {
      const next = [...region.querySelectorAll<HTMLElement>('.ach-toast:not(.out) .ach-x')].find((b) => !card.contains(b));
      next?.focus();
    }
    card.classList.add('out');
    window.setTimeout(() => { card.remove(); if (!region.childElementCount) region.remove(); }, FADE_MS);
  };
  // waits while the player is pointing at or focused on a card, so it can be read and closed
  const expire = (card: HTMLElement) => window.setTimeout(() => (card.matches(':hover, :focus-within') ? expire(card) : dismiss(card)), SHOW_MS);
  const cards = ids.map((id) => {
    const a = byId.get(id)!;
    const card = h('div', { class: 'ach-toast' }, art(id),
      h('div', { class: 'ach-toast-text' }, h('small', {}, uiText('Achievement earned', 'Succès débloqué')), h('b', {}, tr(a.name))),
      h('button', { class: 'ach-x', type: 'button', 'aria-label': uiText(`Close: ${a.name[0]}`, `Fermer : ${a.name[1]}`), onclick: () => dismiss(card) }, '×'));
    return card;
  });
  // the region is in the page before the cards arrive, so screen readers announce them
  window.setTimeout(() => { region.append(...cards); cards.forEach(expire); }, 60);
  return region;
}

/**
 * All 13 badges in a modal dialog. Earned ones in colour with their name and description; locked ones dimmed
 * with their hint, named only when they are about the failure endings (which are not secret), "???" otherwise.
 * The caller appends it, calls `showModal()`, and in `onClose` removes it and puts focus back.
 */
export function achievementsPanel(onClose: () => void): HTMLDialogElement {
  const held = new Set(loadHeld().map((x) => x.id));
  const items = achievements.map((a) => {
    const got = held.has(a.id), named = got || a.failure || a.id === 'seen-it-all';
    return h('li', { class: `ach-item ${got ? 'got' : 'locked'}` }, art(a.id),
      h('div', {},
        h('small', { class: 'ach-state' }, got ? uiText('Earned', 'Obtenu') : uiText('Locked', 'À débloquer')),
        h('b', {}, named ? tr(a.name) : '???'),
        h('p', {}, got ? tr(a.desc) : tr(a.hint))));
  });
  const d = h('dialog', { class: 'ach-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ach-title' }, h('div', { class: 'ach-body' },
    h('header', {},
      h('h2', { id: 'ach-title' }, uiText('Achievements', 'Succès')),
      h('span', { class: 'ach-count' }, `${held.size}/${achievements.length}`),
      h('button', { class: 'ach-x', type: 'button', 'aria-label': uiText('Close', 'Fermer'), onclick: onClose }, '×')),
    h('p', { class: 'fine' }, uiText('Earned in the historical campaign. Kept in this browser.', 'Obtenus dans la campagne historique. Gardés dans ce navigateur.')),
    h('ul', { class: 'ach-grid' }, ...items)));
  d.addEventListener('cancel', (e) => { e.preventDefault(); onClose(); }); // Escape
  d.addEventListener('click', (e) => { if (e.target === d) onClose(); }); // a click on the backdrop (the body fills the box)
  return d;
}
