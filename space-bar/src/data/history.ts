import { SourceRef } from '../sim/types';

/** "What really happened": each real choice per question. All items are PLACEHOLDER until verified against NASA History. */
export const history: { optionByQuestion: Record<string, string>; notes: Record<string, string>; summary: string[]; source: SourceRef } = {
  optionByQuestion: {
    'nav-route': 'lor', 'sci-site': 'flat', 'sci-instruments': 'basic', 'sci-antenna': 'large',
    'eng-cabin': 'redesign', 'eng-docking': 'basic',
    'nav-disposal': 'solar', 'mgr-schedule': 'steady', 'mgr-funding': 'full', 'eng-power': 'extra',
  },
  notes: {
    'nav-route': 'NASA chose lunar-orbit rendezvous in 1962 after a long internal debate, mainly because it needed a smaller rocket.',
    'sci-site': 'Apollo 11 landed on the Sea of Tranquility, a smooth plain chosen for safety. Even so, the crew had to fly past a boulder field by hand.',
    'sci-instruments': 'Apollo 11 left a seismometer and a laser reflector, and returned about 22 kg of lunar samples.',
    'sci-antenna': 'Pictures from the Moon were received by several large dishes around the world, including one in Australia.',
    'eng-cabin': 'After the Apollo 1 fire in January 1967 the cabin, hatch and materials were redesigned. Crewed flights paused for about 21 months.',
    'eng-docking': 'Docking was flown by hand by trained crews, practised on Gemini flights and tested on Apollo 9 and 10.',
    'nav-disposal': 'The Saturn V upper stage was sent past the Moon into solar orbit.',
    'mgr-schedule': 'The program kept a demanding pace but stopped to fix the cabin after the fire.',
    'mgr-funding': 'NASA budgets peaked in the mid 1960s, then declined.',
    'eng-power': 'The Apollo service module used three fuel cells.',
  },
  summary: [
    'Apollo 11 launched on 16 July 1969 and landed on the Moon on 20 July 1969, about six months before the end of the decade.',
    'The program took roughly eight years and cost an estimated 25 billion dollars at the time. It was not always popular: for most of the 1960s polls showed Americans doubted it was worth the money.',
    'It nearly failed on the way down. Alarms from the landing computer and a boulder field meant the commander flew the last stretch by hand, with little fuel to spare.',
  ],
  source: { label: 'NASA History Office, Apollo 11 mission summary', url: 'https://history.nasa.gov/', status: 'placeholder' },
};
