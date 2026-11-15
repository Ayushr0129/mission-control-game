import './prefs.css';
import { h } from './ui/dom';

/** The English / French switch on the title screen. Saved in this browser. */
type Language = 'en' | 'fr';
const PREF_KEY = 'spacebar.preferences.v1';
let language: Language = (() => {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}').language === 'fr' ? 'fr' : 'en'; } catch { return 'en'; }
})();

/** French for the title screen's own words. Anything with its own French passed to uiText() needs no entry here. */
const FR: Record<string, string> = {
  'A build-and-fly space mission game': 'Un jeu de conception et de pilotage de missions spatiales',
  'Take the job': 'Accepter la mission',
  'Data and sources': 'Données et sources',
  'Build the rocket. Steer it with the arrow keys, fire the engine with the space bar. Three people are counting on you.': 'Construisez la fusée. Pilotez-la avec les flèches, allumez le moteur avec la barre d’espace. Trois personnes comptent sur vous.',
  'Change language': 'Changer de langue',
};

function save() { try { localStorage.setItem(PREF_KEY, JSON.stringify({ language })); } catch { /* optional */ } }
function applyToDocument() { document.documentElement.lang = language; }
export function uiText(english: string, french?: string) { return language === 'fr' ? (french ?? FR[english] ?? english) : english; }
export function preferenceControls(onChange: () => void, className = '') {
  return h('div', { class: `preference-controls ${className}` },
    h('button', { type: 'button', 'aria-label': uiText('Change language', 'Changer de langue'), onclick: () => { language = language === 'en' ? 'fr' : 'en'; save(); applyToDocument(); onChange(); } }, language === 'en' ? 'FR' : 'EN'));
}
applyToDocument();
