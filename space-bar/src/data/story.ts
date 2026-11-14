import { Decisions } from '../sim/types';

/** Everything here is original fiction written for the game. Names are invented. */
export interface Person { name: string; title: string; hue: number }

export const crews: Person[][] = [
  [{ name: 'Ines Moreau', title: 'Commander', hue: 28 }, { name: 'Kai Bhunjun', title: 'Lunar module pilot', hue: 200 }, { name: 'Tom Okafor', title: 'Command module pilot', hue: 140 }],
  [{ name: 'Rafael Costa', title: 'Commander', hue: 350 }, { name: 'Mei Lin Zhou', title: 'Lunar module pilot', hue: 170 }, { name: 'Dan Whitaker', title: 'Command module pilot', hue: 45 }],
  [{ name: 'Leila Haddad', title: 'Commander', hue: 300 }, { name: 'Sven Lindqvist', title: 'Lunar module pilot', hue: 210 }, { name: 'Joseph Mwangi', title: 'Command module pilot', hue: 90 }],
  [{ name: 'Carmen Ortega', title: 'Commander', hue: 15 }, { name: 'Hiro Tanabe', title: 'Lunar module pilot', hue: 250 }, { name: 'Paul Dufresne', title: 'Command module pilot', hue: 120 }],
  [{ name: 'Naledi Dlamini', title: 'Commander', hue: 330 }, { name: 'Ivan Petrov', title: 'Lunar module pilot', hue: 190 }, { name: 'Grace Adeyemi', title: 'Command module pilot', hue: 60 }],
  [{ name: 'Omar Fadel', title: 'Commander', hue: 40 }, { name: 'Anna Kowalski', title: 'Lunar module pilot', hue: 280 }, { name: 'Luc Beaumont', title: 'Command module pilot', hue: 160 }],
];

export const missionName = (n: number) => `Meridian ${n}`;

export interface Scene {
  who: Person;
  line: string;
  /** What this person says once you commit, per option id. */
  react: Record<string, string>;
  /** Optional extra line that depends on what the team already decided. */
  prelude?: (d: Decisions, tags: string[]) => string | null;
}

const p = (name: string, title: string, hue: number): Person => ({ name, title, hue });
const SEN = p('Sen. Harlan Pike', 'Appropriations Committee', 8);
const FLIGHT = p('Marta Ilves', 'Flight dynamics chief', 205);
const RANGE = p('Teo Baptiste', 'Range safety', 150);
const ENG = p('Priya Nair', 'Lead spacecraft engineer', 35);
const TEST = p('Walt Okoye', 'Test director', 0);
const POWER = p('Sam Duval', 'Power systems', 55);
const GEO = p('Dr. Lena Ortiz', 'Lunar geologist', 280);
const COMMS = p('Ahmed Rahim', 'Communications', 185);
const FD = p('Nolan Reyes', 'Flight director', 100);
const PRESS = p('June Alvarez', 'Public affairs', 320);

export const scenes: Record<string, Scene> = {
  'mgr-funding': {
    who: SEN,
    line: 'Billions of dollars, for rocks. My voters ask me what the Moon has ever done for them. Convince me, or tell me you will manage without.',
    react: {
      full: 'Then you had better deliver. I will be watching every dollar.',
      modest: 'Sensible. Do not make me regret it.',
      none: 'Bold. Do not come back asking for more when it falls over.',
    },
  },
  'nav-route': {
    who: FLIGHT,
    line: 'Every route to the Moon works on paper. Only one works with a rocket we can actually build. Choose, and we live with it for eight years.',
    react: {
      direct: 'One enormous ship. Simple, and as heavy as a cathedral.',
      eor: 'Two launches meeting in the dark. We had better be good at that.',
      lor: 'A tiny lander, left alone in lunar orbit while the crew goes down. Brave. People ignored this idea for a year. Not anymore.',
    },
  },
  'eng-docking': {
    who: ENG,
    line: 'Two spacecraft meeting at thousands of kilometres an hour, in the dark. I can automate it, or I can trust the pilot’s hands. Your call.',
    prelude: (_d, t) => t.includes('route-lor') ? 'Your route lives or dies on this.' : t.includes('route-direct') ? 'Your route never docks, by the way. I am asking in case plans change.' : t.includes('route-eor') ? 'Every launch you chose has to join up in orbit. This matters.' : null,
    react: {
      robust: 'Heavier and more expensive. But it will not panic.',
      basic: 'Light and cheap. It all rests on the pilot’s nerve.',
    },
  },
  'sci-site': {
    who: GEO,
    line: 'On a flat plain we will almost certainly walk away. The highlands hold rock older than anything on Earth. They also hold boulders the size of houses.',
    react: {
      flat: 'Smooth ground. We will learn less, but we will come home.',
      rough: 'Old rock, steep craters. I will take that gamble if you will.',
    },
  },
  'mgr-schedule': {
    who: SEN,
    line: 'The President said before this decade is out. Every month you take, the newspapers care a little less. How hard will you push?',
    react: {
      rush: 'Double shifts. People will be tired. Tired people make mistakes.',
      steady: 'The plan, as written. Steady is not a bad word.',
      cautious: 'Slower, with more reviews at each step. Public patience is not infinite.',
    },
  },
  'eng-cabin': {
    who: TEST,
    line: 'The cabin test caught fire. Pure oxygen, a hatch that opens inward, wiring like a bird’s nest. Nobody was inside. This time. What do we do?',
    prelude: (d) => d['mgr-schedule'] === 'rush' ? 'You told me to rush. This is exactly the gap I am being asked to close.' : d['mgr-schedule'] === 'cautious' ? 'At least you gave me room to breathe.' : null,
    react: {
      redesign: 'Months of delay. Fewer funerals. I will take that trade.',
      fix: 'We fix what we found. I will lose sleep over what we did not.',
      test: 'More testing, schedule intact. Let us hope the cabin holds too.',
    },
  },
  'sci-instruments': {
    who: GEO,
    line: 'We get one trip. Every kilo on the Moon is a kilo that is not fuel. What do we spend it on?',
    prelude: (d) => d['mgr-schedule'] === 'rush' ? 'With your schedule, anything complicated gets very little testing.' : null,
    react: {
      min: 'Rocks and photographs. Humble, and enough to change textbooks.',
      basic: 'Two small experiments that will keep talking long after we leave.',
      full: 'The whole package, and live television. It will be spectacular, if it all works.',
    },
  },
  'sci-antenna': {
    who: COMMS,
    line: 'The dish decides how much of what we find ever reaches Earth. Whatever does not fit through is lost forever.',
    prelude: (_d, t) => t.includes('instruments-full') ? 'That full instrument package will pour out data. Keep that in mind.' : t.includes('instruments-min') ? 'You are not sending much home, so I can be thrifty.' : null,
    react: {
      small: 'Light and cheap. It will carry what it can carry.',
      large: 'A big steerable dish. Heavier, but we will actually hear them.',
    },
  },
  'eng-power': {
    who: POWER,
    line: 'Fuel cells make water and electricity. Every switch the crew flips costs me watts. I can build in a margin, but margin weighs something.',
    prelude: (_d, t) => t.includes('instruments-full') ? 'And those instruments will drink power the whole way.' : null,
    react: {
      standard: 'As designed. No fat, no frills.',
      extra: 'A third fuel cell. More power, and more weight to carry.',
      battery: 'A reserve in case a cell dies. I like having one more way out.',
    },
  },
  'nav-disposal': {
    who: RANGE,
    line: 'The spent rocket stage is still up there with fuel in it. Nothing will clean it up for us later. What should I do with it?',
    react: {
      leave: 'Left where it is. It will be up there long after us.',
      deorbit: 'A burn to bring it down. Costs fuel, but orbit stays clean.',
      solar: 'Out past the Moon and into the Sun’s orbit. Cleanest. Hardest.',
    },
  },
};

/** The two decisions that come before the build, the six spots on the rocket in the order they are listed, and the two special ones. */
export const storyOrder = ['mgr-funding', 'mgr-schedule'];
export const slotOrder = ['nav-route', 'eng-docking', 'eng-power', 'sci-antenna', 'sci-instruments', 'nav-disposal'];
export const CABIN = 'eng-cabin';
export const SITE = 'sci-site';
/** Every decision in the old one-screen-each order. Kept until the build screen replaces it. */
export const sceneOrder = [
  'mgr-funding', 'nav-route', 'eng-docking', 'sci-site',
  'mgr-schedule', 'eng-cabin', 'sci-instruments', 'sci-antenna', 'eng-power',
  'nav-disposal',
];

export const stationOf = (role: string) => ({ manager: 'Program', engineer: 'Spacecraft', navigator: 'Flight dynamics', scientist: 'Science' } as Record<string, string>)[role] ?? role;

/** Newspaper front pages after a flight. */
export const papers = {
  success: { head: 'THEY ARE ON THE MOON', sub: (c: string) => `${c} stand on the surface while the whole world listens.` },
  comms: { head: 'THE LINE WENT DEAD', sub: (c: string) => `Contact with ${c} was lost on the way down. Nobody heard what happened next.` },
  power: { head: 'THE LIGHTS WENT OUT', sub: (c: string) => `${c} lost power a quarter of a million miles from home. Ground control watched the screens go dark.` },
  vehicle: { head: 'MERIDIAN LOST', sub: (c: string) => `${c} died when the spacecraft failed. Congress asks who is responsible.` },
  crash: { head: 'LOST AT THE SURFACE', sub: (c: string) => `${c} reached the Moon and could not slow down in time.` },
};
