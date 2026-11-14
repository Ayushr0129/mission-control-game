import { ConflictRule, Question } from '../sim/types';

// Effects are relative points (see chapter1.scale). Every option is defensible: nothing is "the" answer.
export const questions: Question[] = [
  // ---------------- Manager ----------------
  {
    id: 'mgr-funding', role: 'manager', kind: 'story', chapter: 1,
    prompt: 'Congress is reviewing the Moon program budget. What do we ask for?',
    context: 'Every dollar must be defended in front of senators who are not sure the Moon is worth it.',
    why: 'Asking for more money pays for development, but hearings take weeks and spend political goodwill. Asking for nothing is fast, but you build with what you have.',
    options: [
      { id: 'full', label: 'Ask for the full amount', blurb: 'Long hearings, but the program is properly funded.', effects: { cost: -2, trust: -1, days: 1 }, tags: ['funded'] },
      { id: 'modest', label: 'Ask for a modest increase', blurb: 'A smaller ask passes quickly.', effects: { cost: -1 }, tags: [] },
      { id: 'none', label: 'Make do with what we have', blurb: 'No hearings. No new money.', effects: { days: -1 }, tags: [] },
    ],
  },
  {
    id: 'mgr-schedule', role: 'manager', kind: 'story', chapter: 1,
    prompt: 'The deadline is "before this decade is out". How hard do we push the schedule?',
    why: 'Schedule pressure saves days, and days matter because public attention fades every day. But rushed testing leaves hidden problems.',
    options: [
      { id: 'rush', label: 'Rush', blurb: 'Shorter tests, double shifts.', effects: { days: -2, risk: 2, cost: 1 }, tags: ['rush'] },
      { id: 'steady', label: 'Steady pace', blurb: 'Follow the plan.', effects: {}, tags: [] },
      { id: 'cautious', label: 'Cautious', blurb: 'More reviews before each step.', effects: { days: 2, risk: -1, cost: 1 }, tags: ['cautious'] },
    ],
  },
  // ---------------- Navigator ----------------
  {
    id: 'nav-route', role: 'navigator', kind: 'part', chapter: 1, slot: 'Lander',
    prompt: 'How do we reach the Moon?',
    context: 'NASA argued about this for a year. All three plans can work.',
    why: 'Each route trades vehicle size against complexity. Direct ascent needs a rocket bigger than any ever built. A separate lander is lighter but needs two spacecraft to meet in space.',
    options: [
      { id: 'direct', label: 'Direct ascent', part: 'One giant lander', blurb: 'One huge vehicle lands and returns. The simplest plan.', effects: { mass: 4, cost: 3, days: 1 }, tags: ['route-direct'] },
      { id: 'eor', label: 'Earth-orbit rendezvous', part: 'Giant lander, built in orbit', blurb: 'Assemble the ship in Earth orbit from several launches.', effects: { mass: 2, cost: 2, days: 2, risk: 1, debris: 1 }, tags: ['route-eor'] },
      { id: 'lor', label: 'Lunar-orbit rendezvous', part: 'Small separate lander', blurb: 'A small lander separates from the mother ship at the Moon.', effects: { mass: -2, cost: -1, days: -1, risk: 2 }, tags: ['route-lor'] },
    ],
  },
  {
    id: 'nav-disposal', role: 'navigator', kind: 'part', chapter: 1, slot: 'Spent stage',
    prompt: 'The spent upper rocket stage is still up there. What happens to it?',
    why: 'Anything left in orbit stays there, and it can hit future spacecraft. Disposing of it costs fuel, mass and sometimes an extra manoeuvre.',
    options: [
      { id: 'leave', label: 'Leave it in orbit', part: 'Nothing: leave it in orbit', blurb: 'Nothing extra to carry or do.', effects: { debris: 4 }, tags: ['stage-left'] },
      { id: 'deorbit', label: 'Burn it back into the atmosphere', part: 'Deorbit motors', blurb: 'Reserve fuel for a disposal burn.', effects: { mass: 1, cost: 1 }, tags: ['stage-deorbit'] },
      { id: 'solar', label: 'Slingshot it past the Moon into solar orbit', part: 'Slingshot kit', blurb: 'Cleanest, but an extra manoeuvre.', effects: { mass: 1, days: 1, risk: 1 }, tags: ['stage-solar'] },
    ],
  },
  // ---------------- Engineer ----------------
  {
    id: 'eng-docking', role: 'engineer', kind: 'part', chapter: 1, slot: 'Docking',
    prompt: 'How do the spacecraft join up in space?',
    context: 'Not every route needs docking at all.',
    why: 'Docking is a hard problem. An automated system is reliable but heavy and expensive. Manual docking by a trained crew is lighter, but relies on practice.',
    options: [
      { id: 'robust', label: 'Automated docking system', blurb: 'Heavier, costly, forgiving.', effects: { mass: 1, cost: 2, days: 1, risk: -1 }, tags: ['docking-reliable'] },
      { id: 'basic', label: 'Manual docking by the crew', blurb: 'Light and cheap. Depends on pilot skill.', effects: {}, tags: ['docking-basic'] },
    ],
  },
  {
    id: 'eng-cabin', role: 'engineer', kind: 'story', chapter: 1,
    prompt: 'A safety scare shows a problem with the crew cabin. What now?',
    context: 'Testing found a fire hazard in the cabin materials and hatch.',
    why: 'A full redesign is the safest and slowest. A targeted fix covers the known problem. Pressing on with more testing is quick, but unknown problems stay unknown.',
    options: [
      { id: 'redesign', label: 'Full redesign', blurb: 'New materials, new hatch.', effects: { risk: -3, days: 3, cost: 2, mass: 1 }, tags: ['cabin-redesign'] },
      { id: 'fix', label: 'Targeted fix', blurb: 'Fix what we found.', effects: { risk: -1, days: 1, cost: 1 }, tags: ['cabin-fix'] },
      { id: 'test', label: 'Continue with extra testing', blurb: 'Keep the schedule.', effects: { risk: 1, phaseRisk: { launch: 1 } }, tags: ['cabin-testing'] },
    ],
  },
  {
    id: 'eng-power', role: 'engineer', kind: 'part', chapter: 1, slot: 'Power',
    prompt: 'How do we power the spacecraft?',
    why: 'Power is generated by fuel cells. Anything the crew switches on draws power, in every phase of flight. Extra generation costs mass. A battery gives a reserve if something goes wrong.',
    options: [
      { id: 'standard', label: 'Standard fuel cells', blurb: 'As designed.', effects: {}, tags: ['power-standard'] },
      { id: 'extra', label: 'Add a third fuel cell', blurb: 'More power. More mass.', effects: { power: 2, mass: 1, cost: 1 }, tags: ['power-extra'] },
      { id: 'battery', label: 'Add a backup battery', blurb: 'A reserve if a cell fails.', effects: { power: 1, mass: 1, risk: -1 }, tags: ['battery'] },
    ],
  },
  // ---------------- Scientist ----------------
  {
    id: 'sci-site', role: 'scientist', kind: 'flight', chapter: 1,
    prompt: 'Where do we land?',
    why: 'A flat site is much safer to land on. Rougher terrain holds more interesting rock and more to learn, but the landing is harder and more data comes back.',
    options: [
      { id: 'flat', label: 'Flat, safe plain', blurb: 'Smooth ground. Scientifically ordinary.', effects: { phaseRisk: { landing: -2 } }, tags: ['terrain-flat'] },
      { id: 'rough', label: 'Interesting highland terrain', blurb: 'Old rock, craters, boulders.', effects: { phaseRisk: { landing: 2 }, data: 1, science: 2 }, tags: ['terrain-rough'] },
    ],
  },
  {
    id: 'sci-instruments', role: 'scientist', kind: 'part', chapter: 1, slot: 'Science',
    prompt: 'What do we take to study the Moon?',
    why: 'Instruments produce data, and data needs power to run and a link to send it home. Whatever is not sent back is lost.',
    options: [
      { id: 'min', label: 'Rocks and photos only', blurb: 'Bring samples back. Nothing runs on the surface.', effects: { cost: -1, science: 0 }, tags: ['instruments-min'] },
      { id: 'basic', label: 'Seismometer and laser reflector', blurb: 'Two small experiments that keep running after we leave.', effects: { data: 1, science: 1 }, tags: ['instruments-basic'] },
      { id: 'full', label: 'Full package with live TV', blurb: 'The most science, the heaviest data stream, and the whole world watching live.', effects: { data: 3, load: 1, mass: 1, cost: 1, science: 4, trust: 2 }, tags: ['instruments-full', 'livestream'] },
    ],
  },
  {
    id: 'sci-antenna', role: 'scientist', kind: 'part', chapter: 1, slot: 'Antenna',
    prompt: 'Which antenna links the Moon to Earth?',
    why: 'The antenna sets how much data can be sent back. A bigger dish carries more but is heavier and costs more.',
    options: [
      { id: 'small', label: 'Small antenna', blurb: 'Light and cheap.', effects: {}, tags: ['dish-small'] },
      { id: 'large', label: 'Large steerable dish', blurb: 'Carries much more data.', effects: { comms: 2, mass: 1, cost: 1 }, tags: ['dish-large'] },
    ],
  },
];

// Mismatches between roles. Triggering these is what the teamwork score counts.
export const conflicts: ConflictRule[] = [
  { id: 'lor-docking', all: ['route-lor', 'docking-basic'], roles: ['navigator', 'engineer'],
    effects: { phaseRisk: { orbit: 3, return: 2 } },
    message: 'The route needs two spacecraft to meet at the Moon, but the docking system relies on pilot skill alone.' },
  { id: 'eor-docking', all: ['route-eor', 'docking-basic'], roles: ['navigator', 'engineer'],
    effects: { phaseRisk: { orbit: 2 } },
    message: 'Assembling the ship in Earth orbit needs reliable docking, but the Engineer chose manual docking.' },
  { id: 'data-link', all: ['instruments-full', 'dish-small'], roles: ['scientist'],
    effects: {},
    message: 'The full instrument package makes more data than a small antenna can send.' },
  { id: 'rush-payload', all: ['rush', 'instruments-full'], roles: ['manager', 'scientist'],
    effects: { risk: 1 },
    message: 'A rushed schedule left too little time to test the most complex payload.' },
];
