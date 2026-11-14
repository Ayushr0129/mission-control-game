import { Chapter } from '../sim/types';

/**
 * Chapter 1: the 1960s Moon landing.
 * Numbers marked "placeholder" are from memory of public NASA figures and MUST be checked
 * against the official challenge resources (available Nov 13) before the final demo.
 */
export const chapter1: Chapter = {
  id: 1, title: 'Race to the Moon', years: '1961-1969',
  base: {
    mass: 30, capacity: 48.6, // Saturn V translunar-injection capacity ~48.6 t (placeholder, verify)
    gen: 10, load: 8, data: 2, comms: 3, cost: 12, days: 600, debris: 2,
  },
  scale: { mass: 3, power: 1.5, load: 1.5, data: 1, comms: 1, cost: 5, days: 90, trust: 5, debris: 3 },
  phaseLoad: { launch: 0, coast: 0.8, orbit: 1.0, landing: 1.15, return: 0.8 },
  baseFail: { launch: 0.02, coast: 0.015, orbit: 0.02, landing: 0.04, return: 0.025 },
  riskWeight: { launch: 0.8, coast: 0.4, orbit: 1, landing: 1.6, return: 0.8 },
  riskPerPoint: 0.012,
  commsSlack: 1,
  startDate: '1961-05-25', // Kennedy's speech to Congress
  deadlineDay: 3141,       // 1969-12-31: "before this decade is out"
  start: { budget: 60, trust: 52, debris: 2 },
  trustDecayPerDay: 0.012,
  trustPerScience: 2, trustOnSuccess: 34, trustOnSuccessQuiet: 22,
  trustOnFailure: 22, trustFailureCap: 40, // a single failure never removes more than 40 points
  debrisOnFailure: 6, debrisPerLaunch: 2,
  budgetPerAppropriation: 0.003, // meter points per $M per year (game tuning)
  // NASA appropriations by calendar year, $M nominal. PLACEHOLDER: from memory, verify with NASA History Office.
  appropriations: { 1961: 964, 1962: 1825, 1963: 3673, 1964: 5100, 1965: 5250, 1966: 5175, 1967: 4966, 1968: 4587, 1969: 3991 },
  eventsPerRun: 2,
};

export const briefing = {
  title: 'May 25, 1961',
  text: [
    'President Kennedy has just told Congress that the United States should land a man on the Moon and return him safely to Earth before the decade is out.',
    'Nobody has done anything like it. Four weeks ago the first American flew for fifteen minutes. The rocket does not exist yet. The computer that could fly it does not exist yet.',
    'You are the mission team. You have a budget, a public that is not sure the Moon is worth it, and until the end of 1969.',
  ],
  meters: {
    budget: 'The money and materials the program has left. Congress adds more every year, but every mission attempt spends it. At zero, the program is cancelled.',
    trust: 'Support from the public and politicians. It fades every day you take, a success restores a lot, and a failure costs a lot. At zero, the program is cancelled.',
    debris: 'How cluttered Earth orbit is. Higher is worse. At 100, orbit is too dangerous to launch into.',
  },
  debrisNote: 'In the real 1960s there were only hundreds of tracked objects in orbit. This chapter amplifies the effect on purpose so you can feel what leaving things in orbit does over time.',
  source: { label: 'Kennedy, Special Message to Congress on Urgent National Needs, 25 May 1961 (NASA History)', status: 'placeholder' as const },
};

export const eraSources = [
  { what: 'NASA appropriations by year', label: 'NASA Historical Data Books / NASA budget history', status: 'placeholder', note: 'Figures typed from memory. Replace after Nov 13 resources.' },
  { what: 'Public trust starting value', label: 'Gallup space spending polls, 1960s (outside source)', status: 'placeholder', note: 'Polls showed public support was lukewarm for most of the 1960s. 52 is a game value.' },
  { what: 'Orbital debris', label: 'NASA Orbital Debris Program Office', status: 'placeholder', note: 'Real counts were tiny in the 1960s. Amplified for gameplay and stated in the briefing.' },
  { what: 'Launch vehicle capacity', label: 'NASA Saturn V fact sheets', status: 'placeholder', note: '48.6 t to translunar injection.' },
];
