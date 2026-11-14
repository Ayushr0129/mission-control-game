import './missionlab.css';
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { h, fmt } from './ui/dom';
import { performanceOf } from './lab/physics';
import { launchSetupOf } from './lab/launch';
import { LaunchView, LaunchResult, metText } from './lab/launchview';
import { Category, Part, parts, profiles, starter, partsOf, sumsOf, readinessOf, MIN_LIFTOFF_TWR, payloadPartId as payloadOf, baselineFor as baselineOf, scoreMission, launchMeetsMission, DockingResult, ScorePart } from './lab/catalog';

type Tab = 'brief' | 'vehicle' | 'flight' | 'payload' | 'observatory' | 'debrief';
type Language = 'en' | 'fr';
type Theme = 'dark' | 'light';

interface Preferences { language: Language; theme: Theme }
const PREF_KEY = 'spacebar.preferences.v1';
let preferences: Preferences = (() => {
  try { return { language: 'en', theme: 'dark', ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; }
  catch { return { language: 'en', theme: 'dark' }; }
})();

const FR: Record<string, string> = {
  'A build-and-fly space mission game': 'Un jeu de conception et de pilotage de missions spatiales',
  'Open Mission Lab': 'Ouvrir le laboratoire de mission',
  'Play historical campaign': 'Jouer la campagne historique (anglais)',
  'Data and sources': 'Données et sources',
  'Engineer a complete mission, assemble the vehicle piece by piece, fly an RCS rendezvous, dock and deploy a scientific payload—or enter the historical Moon-race campaign.': 'Concevez une mission complète, assemblez le véhicule pièce par pièce, effectuez un rendez-vous avec le RCS, amarrez-vous et déployez une charge utile scientifique — ou découvrez la campagne historique de la course à la Lune.',
  'Mission brief': 'Briefing de mission', 'Vehicle assembly': 'Assemblage du véhicule', 'Flight & docking': 'Vol et amarrage',
  'Payload ops': 'Opérations de charge utile', 'Planetary observatory': 'Observatoire planétaire', 'Mission debrief': 'Bilan de mission',
  'Mission design simulator': 'Simulateur de conception de mission', '← Historical campaign': '← Campagne historique',
  'ACTIVE PROGRAM': 'PROGRAMME ACTIF', 'SIMULATION CLOCK': 'HORLOGE DE SIMULATION', 'LOCAL / OFFLINE': 'LOCAL / HORS LIGNE',
  'Budget committed': 'Budget engagé', 'Wet mass': 'Masse au lancement', 'Power margin': 'Marge de puissance', 'Mission Δv': 'Δv de mission',
  'Earth Climate Watch': 'Veille climatique terrestre', 'Sun-synchronous orbit · 705 km': 'Orbite héliosynchrone · 705 km',
  'Map sea level, aerosols and vegetation every 16 days.': 'Cartographier le niveau marin, les aérosols et la végétation tous les 16 jours.',
  'Lunar Far-Side Relay': 'Relais de la face cachée lunaire', 'Elliptical lunar orbit · 100 × 3,000 km': 'Orbite lunaire elliptique · 100 × 3 000 km',
  'Relay data from the radio-quiet far side of the Moon.': 'Relayer les données depuis la face cachée radio-silencieuse de la Lune.',
  'Mars Sample Scout': "Éclaireur d'échantillons martiens", 'Jezero region · 18.4°N, 77.6°E': 'Région de Jezero · 18,4°N, 77,6°E',
  'Cache cores from an ancient river delta for later return.': "Mettre en cache des carottes d'un ancien delta en vue de leur retour.",
  'Saturn Ring Surveyor': 'Cartographe des anneaux de Saturne', 'Saturn polar orbit · ring plane crossings': 'Orbite polaire de Saturne · traversées du plan des anneaux',
  'Measure ring particles, shepherd moons and magnetosphere.': 'Mesurer les particules des anneaux, les lunes bergères et la magnétosphère.',
  'Structure': 'Structure', 'Propulsion': 'Propulsion', 'Guidance': 'Guidage', 'Power': 'Énergie', 'Communications': 'Communications', 'Payload': 'Charge utile',
  'Payload fairing': 'Coiffe de charge utile', 'Protects the payload through max-Q and is discarded above the sensible atmosphere.': "Protège la charge utile pendant max-Q, puis est larguée au-dessus de l'atmosphère dense.",
  'Docking adapter': "Adaptateur d'amarrage", 'Androgynous capture ring, range sensors and soft-capture latches.': 'Anneau de capture androgyne, capteurs de distance et verrous de capture souple.',
  'Cryogenic propellant tank': 'Réservoir cryogénique', 'High-energy upper-stage propellant. Adds range, but boil-off limits coast time.': "Ergols à haute énergie pour l'étage supérieur. Augmente la portée, mais l'évaporation limite la durée de croisière.",
  'Reusable booster core': 'Premier étage réutilisable', 'Nine throttleable engines provide pad thrust and recovery reserve.': 'Neuf moteurs modulables fournissent la poussée au décollage et la réserve de récupération.',
  'Vacuum transfer engine': 'Moteur de transfert sous vide', 'Expanding nozzle optimized for orbital insertion and departure burns.': "Tuyère optimisée pour l'insertion orbitale et les manœuvres de départ.",
  'Storable-propellant kick stage': 'Étage de départ à ergols stockables', 'A restartable stage for high-energy departure and planetary capture.': 'Un étage rallumable pour les départs à haute énergie et les captures planétaires.',
  'Solar-electric cruise drive': 'Propulsion solaire-électrique', 'Very low thrust over months produces exceptional deep-space delta-v.': 'Une très faible poussée pendant des mois produit un delta-v exceptionnel en espace profond.',
  '16-thruster RCS quad set': 'Ensemble RCS de 16 propulseurs', 'Translation and rotation jets for proximity operations and docking.': "Jets de translation et de rotation pour les opérations de proximité et l'amarrage.",
  'Triple-redundant flight computer': 'Ordinateur de vol triplement redondant', 'Fuses star tracker, inertial and radar data; survives one computer failure.': "Fusionne les données du viseur d'étoiles, de l'inertiel et du radar ; tolère une panne d'ordinateur.",
  'Reaction-wheel assembly': 'Ensemble de roues de réaction', 'Fine pointing without spending propellant; RCS unloads stored momentum.': "Pointage fin sans consommer d'ergols ; le RCS désature le moment accumulé.",
  'Deployable solar wings': 'Ailes solaires déployables', 'Two articulated arrays sized at 1 AU. Output falls with distance from the Sun.': "Deux panneaux articulés dimensionnés à 1 UA. La puissance diminue avec la distance au Soleil.",
  'Radioisotope power unit': 'Générateur radio-isotopique', 'Continuous deep-space power independent of sunlight; high programme cost.': "Puissance continue en espace profond, indépendante du Soleil ; coût de programme élevé.",
  'Compact fission reactor': 'Réacteur à fission compact', 'High, steady output for electric propulsion beyond the useful range of solar arrays.': 'Puissance élevée et stable pour la propulsion électrique au-delà de la portée utile des panneaux solaires.',
  'Lithium-ion battery bank': 'Batterie lithium-ion', 'Buffers eclipse, peak transmitter loads and rover deployment.': "Couvre les éclipses, les pointes de l'émetteur et le déploiement du rover.",
  'High-gain steerable dish': 'Antenne orientable à grand gain', 'High-rate science downlink. Pointing accuracy is part of the link budget.': 'Liaison scientifique à haut débit. La précision de pointage fait partie du bilan de liaison.',
  'Modular relay satellite': 'Satellite relais modulaire', 'Optical crosslinks, X-band relay and a 5-year radiation design life.': 'Liaisons optiques, relais en bande X et durée de vie radiative de cinq ans.',
  'Autonomous geology rover': 'Rover géologique autonome', 'Six-wheel rocker-bogie chassis with coring drill and sample cache.': 'Châssis rocker-bogie à six roues, foreuse et cache à échantillons.',
  'Ring-plane science probe': 'Sonde scientifique des anneaux', 'Dust analyzer, magnetometer, wide-angle imager and armored electronics.': 'Analyseur de poussière, magnétomètre, caméra grand angle et électronique blindée.',
  'MISSION ARCHITECTURE': 'ARCHITECTURE DE MISSION', 'Choose what the mission must accomplish': 'Choisissez ce que la mission doit accomplir',
  'There is no perfect spacecraft. Every instrument, tank and safety margin consumes mass, power, schedule and money. Start with an objective; let the requirements shape the vehicle.': "Il n'existe pas de véhicule spatial parfait. Chaque instrument, réservoir et marge de sécurité consomme de la masse, de l'énergie, du temps et de l'argent. Commencez par un objectif ; laissez les exigences façonner le véhicule.",
  'INTERMISSION / FLIGHT SCHOOL': 'INTERMISSION / ÉCOLE DE VOL', 'Systems thinking': 'Pensée système',
  'A mission objective becomes measurable requirements. Those requirements drive the payload, orbit, launch energy, communications and operations concept.': "Un objectif de mission devient des exigences mesurables. Elles déterminent la charge utile, l'orbite, l'énergie de lancement, les communications et le concept d'opérations.",
  'Continue to assembly': "Continuer vers l'assemblage", 'VEHICLE INTEGRATION': 'INTÉGRATION DU VÉHICULE',
  'Build the flight stack, one component at a time': 'Assemblez le véhicule, un composant à la fois', 'INTEGRATION BAY 04': "BAIE D'INTÉGRATION 04",
  'REMOVE': 'RETIRER', '+ FIT': '+ INSTALLER', 'FLIGHT HOLD': 'VOL SUSPENDU', 'CONFIGURATION READY': 'CONFIGURATION PRÊTE',
  'All mission-critical margins are positive.': 'Toutes les marges critiques de la mission sont positives.',
  'What the margins mean': 'Comprendre les marges', 'Budget is not the only limit. The launch vehicle must lift the wet mass; generation must exceed peak load; and available delta-v must cover the trajectory plus contingency.': "Le budget n'est pas la seule limite. Le lanceur doit soulever la masse au lancement ; la production électrique doit dépasser la pointe de charge ; et le delta-v disponible doit couvrir la trajectoire et la réserve.",
  'Load engineering baseline': 'Charger la configuration de référence', 'Proceed to flight': 'Passer au vol',
  'Select components to begin assembly': "Sélectionnez des composants pour commencer l'assemblage",
  'PARTS': 'PIÈCES', 'BUILD MODE': 'MODE ASSEMBLAGE', 'FLIGHT ENGINEERING': 'INGÉNIERIE DE VOL',
  'Liftoff thrust / weight': 'Poussée / poids au décollage', 'Stack Δv': 'Δv du lanceur', 'Propulsive stages': 'Étages propulsifs', 'liftoff thrust': 'poussée au décollage',
  'Each engine burns the tanks stacked above it, up to the next engine. Spent stages drop away, so the order of the stack decides the delta-v.': "Chaque moteur brûle les réservoirs empilés au-dessus de lui, jusqu'au moteur suivant. Les étages vides sont largués : l'ordre de l'empilement décide du delta-v.",
  'The rocket equation': "L'équation de la fusée", 'Delta-v grows with engine efficiency and with the ratio of full to empty mass, but only logarithmically. That is why rockets stage: dropping empty tanks makes every remaining kilogram of propellant count for more.': "Le delta-v croît avec le rendement du moteur et avec le rapport entre masse pleine et masse vide, mais seulement de façon logarithmique. C'est pourquoi les fusées ont des étages : larguer les réservoirs vides rend chaque kilogramme d'ergol restant plus utile.",
  'Click a component to fit or remove it. Select a fitted stage in the vehicle to inspect or remove it.': "Cliquez sur un composant pour l'installer ou le retirer. Sélectionnez un étage du véhicule pour l'inspecter ou le retirer.",
  'LAUNCH VEHICLE CONFIGURATION': 'CONFIGURATION DU LANCEUR', 'FITTED': 'INSTALLÉ', 'AVAILABLE': 'DISPONIBLE',
  'DRAG PARTS INTO THE STACK · CLICK TO ADD ANOTHER': 'GLISSEZ LES PIÈCES DANS LA FUSÉE · CLIQUEZ POUR EN AJOUTER',
  'DROP HERE': 'DÉPOSER ICI', 'ADD': 'AJOUTER', 'copies fitted': 'exemplaires installés',
  'Drag parts into any highlighted gap. Click a palette part to add another copy; use the arrows or drag fitted parts to reorder them.': "Glissez les pièces dans n'importe quel espace surligné. Cliquez sur une pièce de la palette pour en ajouter une autre ; utilisez les flèches ou faites glisser les pièces installées pour les réordonner.",
  'FLIGHT DYNAMICS': 'DYNAMIQUE DE VOL', 'Fly the rendezvous and dock under RCS': 'Effectuez le rendez-vous et amarrez-vous avec le RCS',
  'SIMULATION LOCKED': 'SIMULATION VERROUILLÉE', 'PROXIMITY OPERATIONS': 'OPÉRATIONS DE PROXIMITÉ', 'RCS flight model active · target motion is relative': 'Modèle de vol RCS actif · mouvement relatif à la cible',
  'ROT −': 'ROT −', 'ROT +': 'ROT +', 'UP': 'HAUT', 'DOWN': 'BAS', 'LEFT': 'GAUCHE', 'RIGHT': 'DROITE',
  'Docking envelope': "Domaine d'amarrage", 'Range < 8 m': 'Distance < 8 m', 'Closure < 0.20 m/s': 'Approche < 0,20 m/s', 'Alignment < 5°': 'Alignement < 5°',
  'Relative motion': 'Mouvement relatif', 'Near another spacecraft, “forward” is not the same as “toward.” Pulse the opposing thruster early: every translation burn must be cancelled before contact.': "Près d'un autre véhicule, « en avant » ne signifie pas « vers la cible ». Déclenchez tôt le propulseur opposé : toute impulsion de translation doit être annulée avant le contact.",
  'Return to assembly': "Retour à l'assemblage", 'Run guided approach': "Lancer l'approche guidée", 'Guidance active…': 'Guidage actif…', 'Reset approach': "Réinitialiser l'approche",
  'VEHICLE NOT READY': 'VÉHICULE NON PRÊT', 'The simulator uses the vehicle you actually assemble. Close every red margin before committing the crew and payload.': "Le simulateur utilise le véhicule réellement assemblé. Résolvez chaque marge rouge avant d'engager l'équipage et la charge utile.",
  'SOFT CAPTURE CONFIRMED': 'CAPTURE SOUPLE CONFIRMÉE', 'PAYLOAD OPERATIONS': 'OPÉRATIONS DE CHARGE UTILE',
  'GUIDANCE ACTIVE': 'GUIDAGE ACTIF', 'propulsion': 'propulsion', 'propellant tank': "réservoir d'ergols", 'flight computer': 'ordinateur de vol', 'power source': "source d'énergie", 'communications': 'communications', 'satellite payload': 'charge utile satellite', 'rover payload': 'charge utile rover', 'probe payload': 'charge utile sonde', 'budget margin': 'marge budgétaire', 'launch mass margin': 'marge de masse au lancement', 'power margin': 'marge de puissance', 'delta-v margin': 'marge de delta-v',
  'Vehicle changed: launch, docking and payload results cleared.': 'Véhicule modifié : résultats du lancement, de l’amarrage et de la charge utile effacés.',
  'Separation electrical circuit': 'Circuit électrique de séparation', 'Command and telemetry link': 'Liaison de commande et télémétrie', 'Positive power balance': 'Bilan de puissance positif', 'Correct payload installed': 'Charge utile correcte installée',
  'DEPLOYMENT COMPLETE': 'DÉPLOIEMENT TERMINÉ', 'ARM + DEPLOY': 'ARMER + DÉPLOYER', 'Commissioning is part of the mission': 'La mise en service fait partie de la mission',
  'Arrival is not success. A payload must separate safely, establish attitude, generate power, acquire a communications link and return scientifically useful data.': "Arriver ne suffit pas. Une charge utile doit se séparer sans danger, établir son attitude, produire de l'énergie, acquérir une liaison et renvoyer des données scientifiquement utiles.",
  'Open planetary observatory': "Ouvrir l'observatoire planétaire", 'PLANETARY OBSERVATORY': 'OBSERVATOIRE PLANÉTAIRE', 'Explore scale, orbits, rings and constellations': 'Explorez les échelles, les orbites, les anneaux et les constellations',
  'EARTH': 'TERRE', 'MOON': 'LUNE', 'MISSION TARGET': 'CIBLE DE MISSION', 'Distances and orbital periods are real reference values; visual sizes and spacing are compressed so the system fits on screen.': "Les distances et périodes orbitales sont des valeurs de référence réelles ; les tailles et espacements visuels sont comprimés pour afficher le système à l'écran.",
  'VR field lesson': 'Leçon de terrain en VR', 'In a supported headset, enter immersive mode and look around the orbital plane. Saturn’s rings are thousands of kilometres wide yet commonly only tens of metres thick.': "Avec un casque compatible, passez en mode immersif et observez le plan orbital. Les anneaux de Saturne mesurent des milliers de kilomètres de large, mais souvent seulement quelques dizaines de mètres d'épaisseur.",
  'Generate mission debrief': 'Générer le bilan de mission', 'POST-MISSION REVIEW': 'REVUE APRÈS MISSION', 'Engineering decisions become evidence': "Les décisions d'ingénierie deviennent des preuves",
  'MISSION PERFORMANCE': 'PERFORMANCE DE MISSION', 'Vehicle': 'Véhicule', 'Cost': 'Coût', 'Deployed and commissioned': 'Déployée et mise en service', 'Not commissioned': 'Non mise en service', 'Docking': 'Amarrage', 'Soft capture confirmed': 'Capture souple confirmée', 'Training incomplete': 'Entraînement incomplet',
  'Flight director log': 'Journal de la direction de vol', 'Complete flight and payload operations to build the evidence log.': 'Terminez le vol et les opérations de charge utile pour constituer le journal de preuves.',
  'Revise the design': 'Réviser la conception', 'Start a new mission': 'Commencer une nouvelle mission', 'FULLSCREEN OBSERVATORY · WEBXR HEADSET NOT DETECTED': 'OBSERVATOIRE PLEIN ÉCRAN · CASQUE WEBXR NON DÉTECTÉ',
  'VR NOT SUPPORTED': 'VR NON PRISE EN CHARGE', 'TARGET': 'CIBLE', 'RANGE': 'DISTANCE', 'CLOSURE': 'APPROCHE', 'ALIGN': 'ALIGNEMENT',
  'GUIDED RCS APPROACH / LVLH': 'APPROCHE RCS GUIDÉE / LVLH', 'RELATIVE NAVIGATION / LVLH': 'NAVIGATION RELATIVE / LVLH', 'SOFT CAPTURE · DOCKING CONFIRMED': 'CAPTURE SOUPLE · AMARRAGE CONFIRMÉ',
};

function savePreferences() { try { localStorage.setItem(PREF_KEY, JSON.stringify(preferences)); } catch { /* optional */ } }
function applyPreferenceDocument() { document.documentElement.lang = preferences.language; document.body.dataset.theme = preferences.theme; }
export function uiText(english: string, french?: string) { return preferences.language === 'fr' ? (french ?? FR[english] ?? english) : english; }
export function preferenceControls(onChange: () => void, className = '') {
  const change = (next: Partial<Preferences>) => { preferences = { ...preferences, ...next }; savePreferences(); applyPreferenceDocument(); onChange(); };
  return h('div', { class: `preference-controls ${className}` },
    h('button', { type: 'button', onclick: () => change({ language: preferences.language === 'en' ? 'fr' : 'en' }), 'aria-label': uiText('Change language', 'Changer de langue') }, preferences.language === 'en' ? 'FR' : 'EN'),
    h('button', { type: 'button', onclick: () => change({ theme: preferences.theme === 'dark' ? 'light' : 'dark' }), 'aria-label': uiText('Change theme', 'Changer de thème') }, preferences.theme === 'dark' ? uiText('Light', 'Clair') : uiText('Dark', 'Sombre')));
}

function translateDynamic(text: string): string {
  if (preferences.language !== 'fr') return text;
  if (FR[text]) return FR[text];
  if (text.startsWith('Resolve: ')) return `À résoudre : ${text.slice(9).split(' · ').map((v) => FR[v] ?? v).join(' · ')}`;
  if (text.startsWith('Return to assembly: ')) return `Retour à l'assemblage : ${text.slice(20).split(', ').map((v) => FR[v] ?? v).join(', ')}`;
  if (/^\d+ COMPONENTS$/.test(text)) return text.replace('COMPONENTS', 'COMPOSANTS');
  if (/^\d+ components ·/.test(text)) return text.replace('components', 'composants');
  if (text.startsWith('MISSION TARGET · ')) return `CIBLE DE MISSION · ${FR[text.slice(17)] ?? text.slice(17)}`;
  if (/^\$[\d.,]+M of \$[\d.,]+M$/.test(text)) return text.replace(' of ', ' sur ');
  if (text.startsWith('Commission the ')) return `Mettre en service ${FR[text.slice(15)] ?? text.slice(15)}`;
  if (text.endsWith(' is operational')) return `${FR[text.slice(0, -15)] ?? text.slice(0, -15)} est opérationnel`;
  if (text.endsWith(' deployed and commissioned.')) return `${FR[text.slice(0, -27)] ?? text.slice(0, -27)} déployé et mis en service.`;
  const dock = text.match(/^Docking achieved with ([\d.,]+)% RCS propellant remaining\.$/);
  if (dock) return `Amarrage réussi avec ${dock[1]} % d'ergols RCS restants.`;
  return text;
}

function localizeTree(root: ParentNode) {
  if (preferences.language !== 'fr') return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = []; while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const raw = node.data, core = raw.trim(); if (!core) continue;
    const translated = translateDynamic(core); if (translated !== core) node.data = raw.replace(core, translated);
  }
}
applyPreferenceDocument();


const tabMeta: { id: Tab; no: string; label: string }[] = [
  { id: 'brief', no: '01', label: 'Mission brief' }, { id: 'vehicle', no: '02', label: 'Vehicle assembly' },
  { id: 'flight', no: '03', label: 'Flight & docking' }, { id: 'payload', no: '04', label: 'Payload ops' },
  { id: 'observatory', no: '05', label: 'Planetary observatory' }, { id: 'debrief', no: '06', label: 'Mission debrief' },
];

interface LabState { profileId: string; partIds: string[]; deployed: boolean; samples: number; notes: string[]; launch: LaunchResult | null; docking: DockingResult | null }
let state: LabState = loadState();
let lastTab: Tab = 'brief';

function loadState(): LabState {
  try {
    const raw = localStorage.getItem('spacebar.missionlab.v1');
    if (raw) return { profileId: 'moon', partIds: [...starter], deployed: false, samples: 0, notes: [], launch: null, docking: null, ...JSON.parse(raw) };
  } catch { /* local storage is optional */ }
  return { profileId: 'moon', partIds: [...starter], deployed: false, samples: 0, notes: [], launch: null, docking: null };
}
function saveState() { try { localStorage.setItem('spacebar.missionlab.v1', JSON.stringify(state)); } catch { /* optional */ } }
/** A changed vehicle voids what the old one flew: the launch, the docking and the deployment have to be flown again. */
function designChanged() {
  if (!state.launch && !state.docking && !state.deployed) return;
  state.launch = null; state.docking = null; state.deployed = false;
  state.notes.push('Vehicle changed: launch, docking and payload results cleared.');
}
const profile = () => profiles.find((p) => p.id === state.profileId) ?? profiles[1];
const payloadPartId = (p = profile()) => payloadOf(p);
const baselineFor = (p = profile()) => baselineOf(p);
const chosen = () => partsOf(state.partIds);
const sums = () => sumsOf(state.partIds, profile());
const has = (tag: string) => chosen().some((p) => p.tags.includes(tag));
const readiness = () => readinessOf(profile(), state.partIds);

export function missionLab(onBack: () => void): HTMLElement {
  let active: Tab = lastTab;
  const root = h('main', { class: 'mission-lab', style: `--mission:${profile().accent}` });
  const content = h('div', { class: 'lab-content' });
  const resources = h('div', { class: 'resource-rail' });
  const renderResources = () => {
    const p = profile(), t = sums();
    const activeProgram = root.querySelector('.lab-topbar > div:first-child b');
    if (activeProgram) activeProgram.textContent = p.name;
    const item = (label: string, value: string, pct: number, bad = false) => h('div', { class: `resource ${bad ? 'limit' : ''}` },
      h('span', {}, label), h('b', {}, value), h('i', {}, h('em', { style: `width:${Math.min(100, Math.max(0, pct))}%` })));
    resources.replaceChildren(
      item('Budget committed', `$${fmt(t.cost, 1)}M / $${p.budget}M`, t.cost / p.budget * 100, t.cost > p.budget),
      item('Wet mass', `${fmt(t.mass, 2)} t / ${p.massCap} t`, t.mass / p.massCap * 100, t.mass > p.massCap),
      item('Power margin', `${fmt(t.power, 2)} kW / ${p.powerNeed} kW`, t.power / p.powerNeed * 100, t.power < p.powerNeed),
      item('Mission Δv', `${fmt(t.deltaV, 2)} / ${p.deltaVNeed} km/s`, t.deltaV / p.deltaVNeed * 100, t.deltaV < p.deltaVNeed));
    root.style.setProperty('--mission', p.accent);
  };
  const nav = h('nav', { class: 'lab-nav', 'aria-label': 'Mission phases' },
    h('div', { class: 'lab-brand' }, h('i', {}), h('div', {}, h('b', {}, 'ORBITAL SYSTEMS LAB'), h('span', {}, 'Mission design simulator'))),
    ...tabMeta.map((t) => h('button', { type: 'button', 'data-tab': t.id, onclick: () => changeTab(t.id) }, h('span', {}, t.no), h('b', {}, t.label))),
    h('button', { type: 'button', class: 'lab-exit', onclick: onBack }, '← Historical campaign'));
  function renderPanel() {
    renderNavLocks();
    renderResources();
    const panel = ({ brief: briefPanel, vehicle: vehiclePanel, flight: flightPanel, payload: payloadPanel, observatory: observatoryPanel, debrief: debriefPanel } as Record<Tab, () => HTMLElement>)[active]();
    content.replaceChildren(panel);
    localizeTree(root);
  }
  function renderNavLocks() {
    nav.querySelectorAll('[data-tab]').forEach((el) => {
      const tab = (el as HTMLElement).dataset.tab, locked = tab === 'payload' && !state.docking;
      el.classList.toggle('active', tab === active); el.classList.toggle('locked', locked);
      (el as HTMLButtonElement).disabled = locked;
      if (locked) el.setAttribute('title', uiText('Dock with the target first', "Amarrez-vous d'abord à la cible")); else el.removeAttribute('title');
    });
  }
  function changeTab(next: Tab) { active = next; lastTab = next; renderPanel(); window.scrollTo(0, 0); }

  function briefPanel() {
    const p = profile();
    const cards = profiles.map((m) => h('button', { class: `mission-card ${m.id === p.id ? 'selected' : ''}`, type: 'button', onclick: () => {
      state.profileId = m.id; state.deployed = false; state.samples = 0; state.launch = null; state.docking = null; saveState(); renderPanel();
    } }, h('span', { class: 'mission-orbit' }, m.id === 'earth' ? '◉' : m.id === 'moon' ? '◐' : m.id === 'mars' ? '●' : '⊚'),
    h('span', {}, h('small', {}, m.destination), h('b', {}, m.name), h('em', {}, m.science)), h('strong', {}, `$${m.budget}M`)));
    return panelShell('MISSION ARCHITECTURE', 'Choose what the mission must accomplish',
      h('p', { class: 'lab-lede' }, 'There is no perfect spacecraft. Every instrument, tank and safety margin consumes mass, power, schedule and money. Start with an objective; let the requirements shape the vehicle.'),
      h('div', { class: 'mission-grid' }, ...cards),
      lesson('Systems thinking', 'A mission objective becomes measurable requirements. Those requirements drive the payload, orbit, launch energy, communications and operations concept.'),
      h('div', { class: 'lab-actions' }, labButton('Continue to assembly', () => changeTab('vehicle'), true)));
  }

  function vehiclePanel() {
    const categories: Category[] = ['Structure', 'Propulsion', 'Guidance', 'Power', 'Communications', 'Payload'];
    const dragType = 'application/x-spacebar-part';
    const addPart = (p: Part, at = state.partIds.length) => {
      state.partIds.splice(Math.max(0, Math.min(at, state.partIds.length)), 0, p.id);
      designChanged(); saveState(); renderPanel();
    };
    const removePart = (index: number) => { state.partIds.splice(index, 1); designChanged(); saveState(); renderPanel(); };
    const startDrag = (ev: DragEvent, partId: string, sourceIndex?: number) => {
      const data = JSON.stringify({ partId, sourceIndex });
      ev.dataTransfer?.setData(dragType, data); ev.dataTransfer?.setData('text/plain', data);
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = sourceIndex == null ? 'copy' : 'move';
      root.classList.add('part-dragging');
    };
    const finishDrag = () => root.classList.remove('part-dragging');
    const dropPart = (ev: DragEvent, insertion: number) => {
      ev.preventDefault(); ev.stopPropagation();
      const raw = ev.dataTransfer?.getData(dragType) || ev.dataTransfer?.getData('text/plain');
      if (!raw) return finishDrag();
      try {
        const data = JSON.parse(raw) as { partId: string; sourceIndex?: number };
        let target = insertion;
        if (typeof data.sourceIndex === 'number') {
          if (data.sourceIndex < target) target--;
          state.partIds.splice(data.sourceIndex, 1);
        }
        state.partIds.splice(Math.max(0, Math.min(target, state.partIds.length)), 0, data.partId);
        designChanged(); saveState(); renderPanel();
      } finally { finishDrag(); }
    };
    const catalogue = h('aside', { class: 'parts-console', 'aria-label': 'Spacecraft parts' },
      h('div', { class: 'parts-console-head' }, h('b', {}, 'PARTS'), h('span', {}, `${parts.length}`)),
      h('p', { class: 'drag-instruction' }, 'DRAG PARTS INTO THE STACK · CLICK TO ADD ANOTHER'),
      h('div', { class: 'part-catalogue' }, ...categories.map((cat) => h('section', {}, h('h4', {}, cat),
        h('div', { class: 'part-tile-grid' }, ...parts.filter((p) => p.category === cat).map((p) => {
          const count = state.partIds.filter((id) => id === p.id).length;
          return h('button', { class: `part-tile ${count ? 'fitted' : ''}`, type: 'button', draggable: 'true', title: `${p.name} · ${p.mass} t · $${p.cost}M`, 'aria-label': `Add ${p.name}`, onclick: () => addPart(p), ondragstart: (ev: DragEvent) => startDrag(ev, p.id), ondragend: finishDrag },
            h('i', { class: `part-render render-${p.id}`, 'aria-hidden': 'true' }),
            h('span', {}, p.short), h('small', {}, count ? `${count} × FITTED` : '+ ADD'));
        }))))));
    const entries = state.partIds.map((id, index) => ({ part: parts.find((p) => p.id === id), index })).filter((entry): entry is { part: Part; index: number } => !!entry.part).reverse();
    const dropZone = (visualGap: number) => {
      const insertion = state.partIds.length - visualGap;
      return h('div', { class: 'stack-drop-zone', ondragover: (ev: DragEvent) => { ev.preventDefault(); if (ev.dataTransfer) ev.dataTransfer.dropEffect = ev.dataTransfer.effectAllowed === 'copy' ? 'copy' : 'move'; }, ondragenter: (ev: DragEvent) => (ev.currentTarget as HTMLElement).classList.add('active'), ondragleave: (ev: DragEvent) => (ev.currentTarget as HTMLElement).classList.remove('active'), ondrop: (ev: DragEvent) => dropPart(ev, insertion) }, h('span', {}, 'DROP HERE'));
    };
    const stackNodes: HTMLElement[] = [dropZone(0)];
    entries.forEach(({ part: p, index }, visualIndex) => {
      stackNodes.push(h('div', { class: `stack-part stack-${p.id} cat-${p.category.toLowerCase()}` },
        h('div', { class: `stack-part-body render-${p.id}`, draggable: 'true', title: p.note, role: 'button', tabindex: '0', 'aria-label': `Move ${p.name}`, ondragstart: (ev: DragEvent) => startDrag(ev, p.id, index), ondragend: finishDrag }, h('span', {}, p.short)),
        h('div', { class: 'stack-callout' }, h('b', {}, p.name), h('small', {}, `${p.mass} t · $${p.cost}M`),
          h('span', {},
            h('button', { type: 'button', 'aria-label': `Move ${p.name} up`, onclick: () => { if (index < state.partIds.length - 1) [state.partIds[index + 1], state.partIds[index]] = [state.partIds[index], state.partIds[index + 1]]; designChanged(); saveState(); renderPanel(); } }, '↑'),
            h('button', { type: 'button', 'aria-label': `Move ${p.name} down`, onclick: () => { if (index > 0) [state.partIds[index - 1], state.partIds[index]] = [state.partIds[index], state.partIds[index - 1]]; designChanged(); saveState(); renderPanel(); } }, '↓'),
            h('button', { type: 'button', 'aria-label': `Remove ${p.name}`, onclick: () => removePart(index) }, '×')))));
      stackNodes.push(dropZone(visualIndex + 1));
    });
    const stack = h('div', { class: 'vehicle-stack', 'aria-label': 'Assembled launch vehicle' },
      h('div', { class: 'stack-axis' }),
      ...(entries.length ? stackNodes : [dropZone(0), h('div', { class: 'empty-stack' }, 'Select components to begin assembly')]));
    const missing = readiness();
    const perf = performanceOf(chosen()), twr = perf.liftoffTwr;
    // stages are listed top first, the way they appear in the stack, numbered in firing order
    const stageRows = perf.stages.map((st, i) => h('li', { class: st.twr < 0.05 && i > 0 ? 'deep-space' : '' },
      h('b', {}, `S${i + 1} · ${st.engine.short}`), h('span', {}, `Δv ${fmt(st.dv, 2)} km/s`),
      h('small', {}, `${st.tanks.length ? `${st.tanks.length} × ${uiText('tank', 'réservoir')} · ` : ''}${fmt(st.prop, 1)} t · ${uiText('TWR', 'P/P')} ${fmt(st.twr, 2)}`))).reverse();
    const engineering = h('aside', { class: 'engineering-console' },
      h('div', { class: 'engineering-title' }, h('span', {}, 'BUILD MODE'), h('b', {}, 'FLIGHT ENGINEERING')),
      h('dl', {}, h('div', {}, h('dt', {}, 'Wet mass'), h('dd', {}, `${fmt(perf.mass, 1)} t`)),
        h('div', { class: twr >= MIN_LIFTOFF_TWR ? 'nominal' : 'warning' }, h('dt', {}, 'Liftoff thrust / weight'), h('dd', {}, fmt(twr, 2))),
        h('div', {}, h('dt', {}, 'Stack Δv'), h('dd', {}, `${fmt(perf.deltaV, 2)} km/s`)),
        h('div', {}, h('dt', {}, 'Propulsive stages'), h('dd', {}, String(perf.stages.length)))),
      perf.stages.length > 0 && h('ol', { class: 'stage-list', 'aria-label': uiText('Stages', 'Étages') }, ...stageRows),
      perf.idleTanks.length > 0 && h('p', { class: 'stage-warning' }, uiText(`${perf.idleTanks.length} tank${perf.idleTanks.length > 1 ? 's have' : ' has'} no engine below to burn ${perf.idleTanks.length > 1 ? 'them' : 'it'}: dead weight.`, `${perf.idleTanks.length} réservoir${perf.idleTanks.length > 1 ? 's' : ''} sans moteur en dessous : masse morte.`)),
      h('p', {}, 'Each engine burns the tanks stacked above it, up to the next engine. Spent stages drop away, so the order of the stack decides the delta-v.'),
      h('div', { class: `readiness ${missing.length ? 'not-ready' : ''}` }, h('b', {}, missing.length ? 'FLIGHT HOLD' : 'CONFIGURATION READY'), h('p', {}, missing.length ? `Resolve: ${missing.join(' · ')}` : 'All mission-critical margins are positive.')));
    return panelShell('VEHICLE INTEGRATION', 'Build the flight stack, one component at a time',
      h('div', { class: 'assembly-layout' }, catalogue, h('section', { class: 'stack-bay' }, h('div', { class: 'bay-head' }, h('span', {}, 'LAUNCH VEHICLE CONFIGURATION'), h('span', {}, `${chosen().length} COMPONENTS`)), stack), engineering),
      lesson('The rocket equation', 'Delta-v grows with engine efficiency and with the ratio of full to empty mass, but only logarithmically. That is why rockets stage: dropping empty tanks makes every remaining kilogram of propellant count for more.'),
      h('div', { class: 'lab-actions' }, labButton('Load engineering baseline', () => { state.partIds = baselineFor(); designChanged(); saveState(); renderPanel(); }), labButton('Proceed to flight', () => changeTab('flight'), true, missing.length > 0)));
  }

  const setClock = (met: number) => { const el = root.querySelector('.sim-clock'); if (el) el.textContent = metText(met); };
  const flightSteps = (step: 1 | 2) => h('ol', { class: 'flight-steps' },
    h('li', { class: step === 1 ? 'active' : 'done' }, h('span', {}, '1'), uiText('Launch to orbit', 'Lancement en orbite')),
    h('li', { class: step === 2 ? 'active' : '' }, h('span', {}, '2'), uiText('Rendezvous and dock', 'Rendez-vous et amarrage')));
  const describeLaunch = (r: LaunchResult): string => {
    const p = profile(), need = p.transferNeed;
    if (r.crashed) return uiText('The vehicle hit the ground. Lean over more gradually, or watch the autopilot fly it once.', "Le véhicule a percuté le sol. Inclinez-vous plus progressivement, ou regardez le pilote automatique le faire une fois.");
    if (!r.orbit) return uiText('Propellant ran out before orbit. Lean over sooner to build speed along the horizon, or add propellant in assembly.', "Les ergols se sont épuisés avant l'orbite. Inclinez-vous plus tôt pour prendre de la vitesse horizontale, ou ajoutez des ergols.");
    const orbit = `${fmt(Math.max(0, r.apo) / 1000)} × ${fmt(r.peri / 1000)} km`;
    if (r.left < need) return uiText(`In orbit (${orbit}), but only ${fmt(r.left, 2)} km/s left and the journey needs ${need}. Fly a cleaner ascent or add propellant.`, `En orbite (${orbit}), mais il ne reste que ${fmt(r.left, 2)} km/s et le voyage en demande ${need}. Volez plus proprement ou ajoutez des ergols.`);
    return uiText(`Orbit ${orbit} after ${metText(r.met).slice(3)}. ${fmt(r.left, 2)} km/s left; the journey needs ${need}.`, `Orbite ${orbit} après ${metText(r.met).slice(3)}. ${fmt(r.left, 2)} km/s restants ; le voyage en demande ${need}.`);
  };

  function launchPanel() {
    const p = profile(), prev = state.launch;
    const host = h('div', { class: 'launch-host' });
    const status = h('div', { class: 'flight-status' }, h('b', {}, uiText('LAUNCH TO ORBIT', 'LANCEMENT EN ORBITE')),
      h('span', {}, prev ? describeLaunch(prev) : uiText(`Reach a stable orbit, lowest point above 150 km, with at least ${p.transferNeed} km/s left for the journey.`, `Atteignez une orbite stable, point bas au-dessus de 150 km, avec au moins ${p.transferNeed} km/s restants pour le voyage.`)));
    const actions = h('div', { class: 'lab-actions' }, labButton('Return to assembly', () => changeTab('vehicle')), labButton(uiText('Restart launch', 'Recommencer le lancement'), () => renderPanel()));
    const wrap = panelShell('FLIGHT DYNAMICS', uiText('Fly your rocket to orbit', 'Pilotez votre fusée en orbite'), flightSteps(1), status, host,
      lesson(uiText('The gravity turn', 'Le virage gravitationnel'), uiText('Orbit is mostly about going sideways fast enough to keep missing the ground: about 7.8 km/s. Climb out of the thick air first, then lean over steadily; every second spent pointing straight up is fuel spent fighting gravity.', "L'orbite, c'est surtout aller assez vite à l'horizontale pour ne jamais retomber : environ 7,8 km/s. Sortez d'abord de l'air dense, puis inclinez-vous régulièrement : chaque seconde passée à la verticale est du carburant dépensé contre la gravité.")),
      actions);
    requestAnimationFrame(() => {
      if (!host.isConnected) return;
      new LaunchView(host, launchSetupOf(chosen()), {
        text: uiText, onClock: setClock,
        onEnd: (r) => {
          state.launch = r; state.docking = null; state.deployed = false;
          state.notes.push(r.orbit ? `Orbit ${fmt(Math.max(0, r.apo) / 1000)} × ${fmt(r.peri / 1000)} km reached${r.guided ? ' by autopilot' : ''} with ${fmt(r.left, 2)} km/s left.` : r.crashed ? 'Launch failed: vehicle lost.' : 'Launch failed: out of propellant short of orbit.');
          saveState();
          const ok = launchMeetsMission(p, r);
          status.replaceChildren(h('b', {}, ok ? uiText('ORBIT ACHIEVED', 'ORBITE ATTEINTE') : r.orbit ? uiText('IN ORBIT · NOT ENOUGH Δv', 'EN ORBITE · Δv INSUFFISANT') : r.crashed ? uiText('VEHICLE LOST', 'VÉHICULE PERDU') : uiText('SUBORBITAL', 'SUBORBITAL')), h('span', {}, describeLaunch(r)));
          status.classList.toggle('good', ok); status.classList.toggle('bad', !ok);
          if (ok) actions.append(labButton(uiText('Continue to rendezvous', 'Passer au rendez-vous'), () => renderPanel(), true));
        },
      });
    });
    return wrap;
  }

  function flightPanel() {
    const missing = readiness();
    if (!missing.length && !launchMeetsMission(profile(), state.launch)) return launchPanel();
    const host = h('div', { class: 'flight-host' });
    let trainer: RcsTrainer | null = null;
    let assistRequested = false;
    const status = h('div', { class: 'flight-status' }, h('b', {}, missing.length ? 'SIMULATION LOCKED' : 'PROXIMITY OPERATIONS'), h('span', {}, missing.length ? `Return to assembly: ${missing.join(', ')}` : 'RCS flight model active · target motion is relative'));
    const controls = h('div', { class: 'rcs-controls' },
      h('div', { class: 'rcs-keymap' }, key('Q', 'ROT −'), key('W', 'UP'), key('E', 'ROT +'), key('A', 'LEFT'), key('S', 'DOWN'), key('D', 'RIGHT')),
      h('div', { class: 'rcs-readout' }, h('span', {}, 'Docking envelope'), h('b', {}, 'Range < 8 m'), h('b', {}, 'Closure < 0.20 m/s'), h('b', {}, 'Alignment < 5°')));
    const guided = labButton('Run guided approach', () => {
      assistRequested = true; guided.disabled = true; guided.textContent = uiText('Guidance active…');
      status.replaceChildren(h('b', {}, uiText('GUIDANCE ACTIVE')), h('span', {}, uiText('RCS guidance is cancelling relative motion and aligning the docking ports.', 'Le guidage RCS annule le mouvement relatif et aligne les ports d’amarrage.')));
      trainer?.engageAssist();
    }, true);
    const wrap = panelShell('FLIGHT DYNAMICS', 'Fly the rendezvous and dock under RCS',
      !missing.length && flightSteps(2), status, host, controls,
      lesson('Relative motion', 'Near another spacecraft, “forward” is not the same as “toward.” Pulse the opposing thruster early: every translation burn must be cancelled before contact.'),
      h('div', { class: 'lab-actions' }, labButton('Return to assembly', () => changeTab('vehicle')), labButton(uiText('Fly the launch again', 'Refaire le lancement'), () => { state.launch = null; state.docking = null; state.deployed = false; saveState(); renderPanel(); }), guided, labButton('Reset approach', () => renderPanel())));
    if (!missing.length) requestAnimationFrame(() => { if (!host.isConnected) return; trainer = new RcsTrainer(host, (result, docking) => {
      state.notes.push(result); state.docking = docking; saveState(); status.replaceChildren(h('b', {}, uiText('SOFT CAPTURE CONFIRMED')), h('span', {}, translateDynamic(result)));
      renderNavLocks();
    }, () => status.replaceChildren(h('b', {}, uiText('RCS PROPELLANT EXHAUSTED', 'ERGOLS RCS ÉPUISÉS')), h('span', {}, uiText('Reset the approach and fly shorter pulses: every burn has to be cancelled by another.', "Réinitialisez l'approche et utilisez des impulsions plus courtes : chaque poussée doit être annulée par une autre.")))); if (assistRequested) trainer.engageAssist(); });
    else host.append(h('div', { class: 'sim-lock' }, h('span', {}, '◈'), h('b', {}, 'VEHICLE NOT READY'), h('p', {}, 'The simulator uses the vehicle you actually assemble. Close every red margin before committing the crew and payload.')));
    return wrap;
  }

  function payloadPanel() {
    const p = profile(), payload = parts.find((x) => x.id === payloadPartId(p))!;
    const launched = launchMeetsMission(p, state.launch), docked = !!state.docking;
    const checks: [string, boolean][] = [
      [uiText('In orbit with Δv for the journey', 'En orbite avec le Δv du voyage'), launched], [uiText('Docked with the target', 'Amarré à la cible'), docked],
      ['Separation electrical circuit', has('computer')], ['Command and telemetry link', has('comms')],
      ['Positive power balance', sums().power >= p.powerNeed], ['Correct payload installed', has(p.payload)],
    ];
    const canDeploy = checks.every(([, ok]) => ok);
    const lockedBecause = !launched ? uiText('FLY THE LAUNCH FIRST', "EFFECTUEZ D'ABORD LE LANCEMENT") : !docked ? uiText('DOCK FIRST', "AMARREZ-VOUS D'ABORD") : uiText('CHECKLIST INCOMPLETE', 'LISTE INCOMPLÈTE');
    const op = p.payload === 'rover' ? h('div', { class: 'rover-field' }, h('div', { class: 'rover' }, '▰─○─○'), h('div', { class: 'terrain-line' }))
      : p.payload === 'satellite' ? h('div', { class: 'orbital-yard' },
        h('div', { class: `station-assembly ${state.deployed ? 'deployed' : ''}` },
          h('div', { class: 'solar-wing wing-a' }), h('div', { class: 'station-truss' }), h('div', { class: 'solar-wing wing-b' }),
          h('div', { class: 'station-spine' }, ...Array.from({ length: 5 }, (_, i) => h('i', { class: `station-module module-${i + 1}` })), h('b', {}, payload.short)),
          h('div', { class: 'station-node node-a' }), h('div', { class: 'station-node node-b' })))
        : h('div', { class: 'satellite-field' }, h('div', { class: `payload-object ${state.deployed ? 'deployed' : ''}` }, h('i', {}), h('b', {}, payload.short), h('i', {})));
    return panelShell('PAYLOAD OPERATIONS', state.deployed ? `${payload.name} is operational` : `Commission the ${payload.name}`,
      h('div', { class: 'payload-layout' }, op, h('section', { class: 'ops-checklist' },
        ...checks.map(([label, ok]) => check(label, ok)),
        h('button', { class: 'deploy-command', type: 'button', disabled: !canDeploy || state.deployed, onclick: () => { if (!canDeploy) return; state.deployed = true; state.samples += p.payload === 'rover' ? 3 : 1; state.notes.push(`${payload.name} deployed and commissioned.`); saveState(); renderPanel(); } }, state.deployed ? 'DEPLOYMENT COMPLETE' : canDeploy ? 'ARM + DEPLOY' : lockedBecause))),
      lesson('Commissioning is part of the mission', 'Arrival is not success. A payload must separate safely, establish attitude, generate power, acquire a communications link and return scientifically useful data.'),
      h('div', { class: 'lab-actions' }, labButton('Open planetary observatory', () => changeTab('observatory'), true)));
  }

  function observatoryPanel() {
    const host = h('div', { class: 'planetarium' });
    const p = profile();
    const facts = [
      ['EARTH', '1.00 AU', '365.26 d', '9.81 m/s²'], ['MOON', '384,400 km', '27.32 d', '1.62 m/s²'],
      ['MARS', '1.52 AU', '686.98 d', '3.71 m/s²'], ['SATURN', '9.58 AU', '29.45 y', '10.44 m/s²'],
    ];
    const wrap = panelShell('PLANETARY OBSERVATORY', 'Explore scale, orbits, rings and constellations',
      h('div', { class: 'observatory-layout' }, host, h('aside', { class: 'planet-facts' }, h('p', { class: 'eyebrow' }, `MISSION TARGET · ${p.destination}`),
        ...facts.map((f) => h('button', { type: 'button', onclick: () => host.dispatchEvent(new CustomEvent('focusplanet', { detail: f[0] })) }, h('b', {}, f[0]), h('span', {}, f[1]), h('span', {}, f[2]), h('span', {}, f[3]))),
        h('p', { class: 'fine' }, 'Distances and orbital periods are real reference values; visual sizes and spacing are compressed so the system fits on screen.'))),
      lesson('VR field lesson', 'In a supported headset, enter immersive mode and look around the orbital plane. Saturn’s rings are thousands of kilometres wide yet commonly only tens of metres thick.'),
      h('div', { class: 'lab-actions' }, labButton('Generate mission debrief', () => changeTab('debrief'), true)));
    requestAnimationFrame(() => { if (host.isConnected) createPlanetarium(host); });
    return wrap;
  }

  function debriefPanel() {
    const p = profile(), t = sums(), missing = readiness();
    const result = scoreMission(p, state.partIds, state.launch, state.docking, state.deployed), score = result.total;
    const why = (x: ScorePart): string => {
      if (x.id === 'vehicle') return missing.length ? uiText(`${missing.length} requirement${missing.length > 1 ? 's' : ''} unresolved`, `${missing.length} exigence${missing.length > 1 ? 's' : ''} non résolue${missing.length > 1 ? 's' : ''}`) : uiText('All requirements met', 'Toutes les exigences satisfaites');
      if (x.id === 'margins') return uiText('Budget, mass, power and Δv headroom', 'Marges de budget, masse, puissance et Δv');
      if (x.id === 'launch') return !state.launch ? uiText('Not flown', 'Non effectué') : !state.launch.orbit ? uiText('Did not reach orbit', "Orbite non atteinte") : `${state.launch.guided ? uiText('Autopilot', 'Pilote automatique') : uiText('Flown by hand', 'Pilotage manuel')} · ${fmt(state.launch.left, 2)} km/s ${uiText('left', 'restants')}`;
      if (x.id === 'docking') return !state.docking ? uiText('Not docked', 'Non amarré') : `${state.docking.guided ? uiText('Guided approach', 'Approche guidée') : uiText('Flown by hand', 'Pilotage manuel')} · ${fmt(state.docking.fuel, 0)}% RCS`;
      return state.deployed ? uiText('Deployed and commissioned', 'Déployée et mise en service') : uiText('Not commissioned', 'Non mise en service');
    };
    const label: Record<ScorePart['id'], [string, string]> = { vehicle: ['Vehicle ready', 'Véhicule prêt'], margins: ['Margins', 'Marges'], launch: ['Launch', 'Lancement'], docking: ['Docking', 'Amarrage'], payload: ['Payload', 'Charge utile'] };
    return panelShell('POST-MISSION REVIEW', 'Engineering decisions become evidence',
      h('div', { class: 'debrief-grid' },
        h('section', { class: 'score-card' }, h('span', {}, 'MISSION PERFORMANCE'), h('b', {}, String(score)), h('small', {}, '/ 100'), h('i', { style: `--score:${score}%` }),
          h('dl', { class: 'score-breakdown' }, ...result.parts.map((x) => h('div', { class: x.points >= x.max ? 'score-full' : x.points > 0 ? 'score-part' : 'score-none' }, h('dt', {}, uiText(...label[x.id]), h('small', {}, why(x))), h('dd', {}, `${x.points} / ${x.max}`))))),
        h('section', { class: 'report-card' }, h('h3', {}, p.name), h('p', {}, p.science),
          h('dl', {}, h('dt', {}, 'Vehicle'), h('dd', {}, `${chosen().length} components · ${fmt(t.mass, 2)} t`), h('dt', {}, 'Cost'), h('dd', {}, `$${fmt(t.cost, 1)}M of $${p.budget}M`), h('dt', {}, 'Payload'), h('dd', {}, state.deployed ? 'Deployed and commissioned' : 'Not commissioned'), h('dt', {}, 'Docking'), h('dd', {}, state.docking ? 'Soft capture confirmed' : 'Training incomplete'))),
        h('section', { class: 'learning-log' }, h('h3', {}, 'Flight director log'), ...(state.notes.length ? state.notes.slice(-5).map((n) => h('p', {}, n)) : [h('p', { class: 'dim' }, 'Complete flight and payload operations to build the evidence log.')]))),
      h('div', { class: 'lab-actions' }, labButton('Revise the design', () => changeTab('vehicle')), labButton('Start a new mission', () => { state = { profileId: 'moon', partIds: [...starter], deployed: false, samples: 0, notes: [], launch: null, docking: null }; saveState(); changeTab('brief'); }, true)));
  }

  root.append(nav, h('section', { class: 'lab-workspace' }, h('header', { class: 'lab-topbar' },
    h('div', {}, h('span', {}, 'ACTIVE PROGRAM'), h('b', {}, profile().name)), h('div', {}, h('span', {}, 'SIMULATION CLOCK'), h('b', { class: 'sim-clock' }, metText(state.launch?.met ?? 0))), h('i', {}, 'LOCAL / OFFLINE'),
    preferenceControls(() => { const replacement = missionLab(onBack); root.replaceWith(replacement); }, 'lab-preferences')), resources, content));
  renderPanel();
  localizeTree(root);
  return root;
}

function panelShell(kicker: string, title: string, ...children: (HTMLElement | false)[]) {
  return h('section', { class: 'lab-panel' }, h('header', { class: 'panel-title' }, h('p', {}, kicker), h('h2', {}, title)), ...children);
}
function lesson(title: string, body: string) { return h('aside', { class: 'lesson-strip' }, h('span', {}, 'INTERMISSION / FLIGHT SCHOOL'), h('div', {}, h('b', {}, title), h('p', {}, body))); }
function labButton(label: string, on: () => void, primary = false, disabled = false) { return h('button', { class: `lab-button ${primary ? 'primary' : ''}`, type: 'button', onclick: on, disabled }, label); }
function key(k: string, label: string) { return h('span', {}, h('kbd', { 'data-rcs': k.toLowerCase() }, k), h('small', {}, label)); }
function check(label: string, ok: boolean) { return h('p', { class: ok ? 'check-ok' : 'check-hold' }, h('span', {}, ok ? '✓' : '!'), label); }

class RcsTrainer {
  /** the craft's probe tip sits 30 px ahead of its centre and the target's ring 54 px behind its own: dock where they meet */
  static PORT = 84;
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private keys = new Set<string>();
  private abort = new AbortController();
  private craft = { x: -210, y: 78, vx: 2.2, vy: -0.12, angle: 14, omega: 0, fuel: 100 };
  private last = performance.now();
  private done = false;
  private failed = false;
  private assisted = false;
  constructor(private host: HTMLElement, private complete: (result: string, docking: DockingResult) => void, private exhausted?: () => void) {
    host.append(this.canvas); this.bind(); this.resize(); requestAnimationFrame((t) => this.frame(t));
  }
  engageAssist() { this.assisted = true; }
  private bind() {
    const signal = this.abort.signal;
    const allowed = new Set(['w', 'a', 's', 'd', 'q', 'e']);
    addEventListener('keydown', (e) => { if (allowed.has(e.key.toLowerCase())) { e.preventDefault(); this.keys.add(e.key.toLowerCase()); } }, { signal });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()), { signal });
    (this.host.closest('.lab-panel') ?? this.host).querySelectorAll('[data-rcs]').forEach((el) => {
      const k = (el as HTMLElement).dataset.rcs!;
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.keys.add(k); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, () => this.keys.delete(k)));
    });
    const ro = new ResizeObserver(() => this.resize()); ro.observe(this.host); signal.addEventListener('abort', () => ro.disconnect());
  }
  private resize() { const r = this.host.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); this.canvas.width = Math.max(1, r.width * d); this.canvas.height = Math.max(1, r.height * d); this.canvas.style.width = `${r.width}px`; this.canvas.style.height = `${r.height}px`; this.ctx.setTransform(d, 0, 0, d, 0, 0); }
  private frame(now: number) {
    if (!this.host.isConnected) { this.abort.abort(); return; }
    const dt = Math.min(.034, (now - this.last) / 1000); this.last = now; this.step(this.assisted ? dt * 2.35 : dt); this.draw(); requestAnimationFrame((t) => this.frame(t));
  }
  private step(dt: number) {
    if (this.done) return;
    const c = this.craft, burn = (this.keys.size > 0 || this.assisted) && c.fuel > 0;
    if (burn) {
      const a = 4.4;
      if (this.assisted) {
        const ax = Math.max(-a, Math.min(a, -.018 * c.x - .72 * c.vx));
        const ay = Math.max(-a, Math.min(a, -.018 * c.y - .72 * c.vy));
        c.vx += ax * dt; c.vy += ay * dt;
        c.omega += Math.max(-24, Math.min(24, -.32 * c.angle - 1.8 * c.omega)) * dt;
        c.fuel = Math.max(0, c.fuel - dt * 1.15);
      } else {
        if (this.keys.has('a')) c.vx -= a * dt; if (this.keys.has('d')) c.vx += a * dt;
        if (this.keys.has('w')) c.vy -= a * dt; if (this.keys.has('s')) c.vy += a * dt;
        if (this.keys.has('q')) c.omega -= 24 * dt; if (this.keys.has('e')) c.omega += 24 * dt;
        c.fuel = Math.max(0, c.fuel - dt * 3.2 * this.keys.size);
      }
    }
    c.x += c.vx * dt * 4; c.y += c.vy * dt * 4; c.angle += c.omega * dt; c.omega *= Math.pow(.96, dt * 60);
    const range = Math.hypot(c.x, c.y), speed = Math.hypot(c.vx, c.vy), align = Math.abs((((c.angle + 180) % 360) + 360) % 360 - 180);
    if (c.fuel <= 0) { this.done = true; this.failed = true; this.exhausted?.(); return; }
    if (range < 8 && speed < .2 && align < 5) { this.done = true; this.complete(`Docking achieved with ${fmt(c.fuel, 1)}% RCS propellant remaining.`, { fuel: c.fuel, guided: this.assisted }); }
    if (range > 440) { c.x = -210; c.y = 78; c.vx = 2.2; c.vy = -.12; }
  }
  private draw() {
    const ctx = this.ctx, w = this.canvas.clientWidth, hgt = this.canvas.clientHeight, cx = Math.min(w * .62, w - 180), cy = hgt * .5;
    ctx.clearRect(0, 0, w, hgt); const g = ctx.createLinearGradient(0, 0, 0, hgt); g.addColorStop(0, '#06111b'); g.addColorStop(1, '#0b1d2b'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hgt);
    ctx.strokeStyle = 'rgba(121,190,232,.22)'; ctx.lineWidth = 1; for (let x = cx % 40; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, hgt); ctx.stroke(); } for (let y = cy % 40; y < hgt; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(35,111,172,.36)'; ctx.beginPath(); ctx.arc(w * .1, hgt * 1.35, hgt * 1.22, Math.PI, Math.PI * 2); ctx.fill();
    this.target(ctx, cx + RcsTrainer.PORT, cy); this.vehicle(ctx, cx + this.craft.x, cy + this.craft.y);
    const r = Math.hypot(this.craft.x, this.craft.y), v = Math.hypot(this.craft.vx, this.craft.vy), a = Math.abs((((this.craft.angle + 180) % 360) + 360) % 360 - 180);
    ctx.font = '12px ui-monospace, monospace'; ctx.fillStyle = '#c3d9e8'; ctx.fillText(uiText(this.assisted ? 'GUIDED RCS APPROACH / LVLH' : 'RELATIVE NAVIGATION / LVLH'), 18, 24);
    [['RANGE', `${fmt(r, 1)} m`, r < 8], ['CLOSURE', `${fmt(v, 2)} m/s`, v < .2], ['ALIGN', `${fmt(a, 1)}°`, a < 5], ['RCS', `${fmt(this.craft.fuel, 1)}%`, this.craft.fuel > 20]].forEach((row, i) => { ctx.fillStyle = row[2] ? '#72e4a0' : '#e8b65b'; ctx.fillText(`${uiText(String(row[0]))}  ${row[1]}`, 18, 50 + i * 20); });
    if (this.done) { ctx.fillStyle = 'rgba(3,14,20,.82)'; ctx.fillRect(0, hgt / 2 - 42, w, 84); ctx.textAlign = 'center'; ctx.font = '600 20px ui-monospace, monospace'; ctx.fillStyle = this.failed ? '#f0a35b' : '#72e4a0'; ctx.fillText(this.failed ? uiText('RCS PROPELLANT EXHAUSTED', 'ERGOLS RCS ÉPUISÉS') : uiText('SOFT CAPTURE · DOCKING CONFIRMED'), w / 2, hgt / 2 + 7); ctx.textAlign = 'left'; }
  }
  private target(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#d8e9f2'; ctx.lineWidth = 2; ctx.strokeRect(-40, -12, 80, 24); ctx.beginPath(); ctx.arc(-45, 0, 9, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(72, 0); ctx.stroke(); ctx.strokeStyle = '#68d7ff'; ctx.beginPath(); ctx.arc(78, 0, 8, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#91e4ff'; ctx.font = '10px ui-monospace'; ctx.fillText(uiText('TARGET'), -21, -20); ctx.restore();
  }
  private vehicle(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(this.craft.angle * Math.PI / 180); ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#5f7785'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(8, -8); ctx.lineTo(-17, -8); ctx.lineTo(-23, 0); ctx.lineTo(-17, 8); ctx.lineTo(8, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#78e2ff'; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(30, 0); ctx.stroke(); ctx.restore();
  }
}

function createPlanetarium(host: HTMLElement) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x01040a);
  const camera = new THREE.PerspectiveCamera(58, 1, .1, 1000); camera.position.set(0, 8, 25);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.xr.enabled = true; host.append(renderer.domElement);
  const stars = new THREE.BufferGeometry(); const points: number[] = []; for (let i = 0; i < 1800; i++) { const r = 80 + Math.random() * 160, a = Math.random() * Math.PI * 2, z = Math.random() * 2 - 1, q = Math.sqrt(1 - z * z); points.push(r * q * Math.cos(a), r * z, r * q * Math.sin(a)); } stars.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xb9cee5, size: .18 })));
  scene.add(new THREE.AmbientLight(0x25354c, .8)); const sun = new THREE.PointLight(0xfff0c7, 1200, 160); sun.position.set(-18, 8, 8); scene.add(sun);
  const bodies: Record<string, THREE.Group> = {};
  const planet = (name: string, radius: number, color: number, x: number, ring = false) => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), new THREE.MeshStandardMaterial({ color, roughness: .88, metalness: 0 })); g.add(m); if (ring) { const r = new THREE.Mesh(new THREE.RingGeometry(radius * 1.35, radius * 2.25, 96), new THREE.MeshStandardMaterial({ color: 0xcdbb91, side: THREE.DoubleSide, transparent: true, opacity: .72 })); r.rotation.x = Math.PI / 2.15; g.add(r); } g.position.x = x; scene.add(g); bodies[name] = g; return g; };
  planet('EARTH', 2.1, 0x2b6c92, -9); planet('MOON', .62, 0xaaa9a5, -5.8); planet('MARS', 1.25, 0xa74f32, .2); planet('SATURN', 3.1, 0xc9aa71, 9.5, true);
  const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, i) => { const a = i / 128 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 13, 0, Math.sin(a) * 4.5); })), new THREE.LineBasicMaterial({ color: 0x2b4d68, transparent: true, opacity: .45 })); scene.add(orbit);
  // orbit camera: drag sideways to circle, up and down to tilt; a planet button flies the camera to that planet
  const focus = new THREE.Vector3(0, 0, 0), aim = new THREE.Vector3(0, 0, 0);
  let dragging = false, px = 0, py = 0, yaw = 0, pitch = 0.32, dist = 25, distTo = 25;
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; px = e.clientX; py = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); });
  renderer.domElement.addEventListener('pointermove', (e) => { if (!dragging) return; yaw -= (e.clientX - px) * .006; pitch = Math.min(1.25, Math.max(-0.35, pitch + (e.clientY - py) * .005)); px = e.clientX; py = e.clientY; });
  ['pointerup', 'pointercancel'].forEach((ev) => renderer.domElement.addEventListener(ev, () => { dragging = false; }));
  host.addEventListener('focusplanet', ((e: CustomEvent<string>) => {
    const b = bodies[e.detail]; if (!b) return;
    const radius = ((b.children[0] as THREE.Mesh).geometry as THREE.SphereGeometry).parameters.radius;
    focus.copy(b.position); distTo = 4 + radius * (b.children.length > 1 ? 4.2 : 3.4);
  }) as EventListener);
  const xr = (navigator as Navigator & { xr?: unknown }).xr;
  const vrControl = xr ? VRButton.createButton(renderer) : h('button', { class: 'lab-vr-button unavailable', type: 'button', onclick: () => host.requestFullscreen?.() }, 'FULLSCREEN OBSERVATORY · WEBXR HEADSET NOT DETECTED');
  vrControl.classList.add('lab-vr-button'); host.append(vrControl); localizeTree(vrControl);
  if (preferences.language === 'fr') { const observer = new MutationObserver(() => localizeTree(vrControl)); observer.observe(vrControl, { childList: true, characterData: true, subtree: true }); }
  const resize = () => { const r = host.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }; const ro = new ResizeObserver(resize); ro.observe(host); resize();
  renderer.setAnimationLoop((time) => { if (!host.isConnected) { renderer.setAnimationLoop(null); ro.disconnect(); renderer.dispose(); return; } const t = time * .0001; Object.values(bodies).forEach((b, i) => b.rotation.y = t * (1 + i * .15)); aim.lerp(focus, .08); dist += (distTo - dist) * .08; camera.position.set(aim.x + Math.sin(yaw) * Math.cos(pitch) * dist, aim.y + Math.sin(pitch) * dist, aim.z + Math.cos(yaw) * Math.cos(pitch) * dist); camera.lookAt(aim); renderer.render(scene, camera); });
}
