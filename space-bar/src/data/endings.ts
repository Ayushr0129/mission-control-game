import { Cause, Phase } from '../sim/types';

export type EndingId = 'success' | 'comms' | 'power' | 'vehicle' | 'crash' | 'abort' | 'reentry';
export interface Line { who: string; text: string }
export interface Ending {
  id: EndingId; title: string;
  /** shown in the autopsy */
  headline: string; because: string; avoid: string; lessonTag: string; lessonText: string;
  /** radio lines played when the mission reaches this ending */
  lines: Line[];
}

/** Dialogue is original, in the style of public mission radio calls. */
export const ending: Record<EndingId, Ending> = {
  success: {
    id: 'success', title: 'The Eagle has landed', headline: 'Mission accomplished', because: 'Every check held: the mass fit the rocket, power and the link back to Earth stayed within limits, and no component failed.',
    avoid: '', lessonTag: '', lessonText: '',
    lines: [
      { who: 'Houston', text: 'You are go for landing. Good luck down there.' },
      { who: 'Commander', text: 'Roger, Houston. Starting descent. Everything looks good.' },
      { who: 'Houston', text: 'We copy. Your data is solid on the link.' },
      { who: 'Commander', text: 'Contact. Engines off. Houston, we are on the surface.' },
      { who: 'Houston', text: 'We copy you down. Half the world is holding its breath.' },
    ],
  },
  comms: {
    id: 'comms', title: 'Signal lost', headline: 'The link back to Earth failed',
    because: 'The spacecraft produced more data than its antenna could send. The link saturated and ground control lost contact at the moment they needed it most.',
    avoid: 'Match the instruments the Scientist chooses to the antenna. A bigger dish carries more, and a lighter payload needs less.',
    lessonTag: 'data-heavy', lessonText: 'Last time the data link saturated. Check that the antenna can carry what the instruments produce.',
    lines: [
      { who: 'Houston', text: 'You are go for landing. Telemetry is coming in strong.' },
      { who: 'Commander', text: 'Roger, Houston. Starting descent.' },
      { who: 'Houston', text: 'Say again, you are breaking up. Say again.' },
      { who: 'Houston', text: '...do you read? Please respond...' },
      { who: 'Flight', text: 'We have lost the link. We have lost the link.' },
    ],
  },
  power: {
    id: 'power', title: 'Lights out', headline: 'The spacecraft ran out of power',
    because: 'The systems drew more power than the fuel cells could produce. Without power the guidance, the heaters and the radio went dark.',
    avoid: 'Check the power balance in each phase. Heavy instruments draw power the whole way. A spare power source costs mass but buys a margin.',
    lessonTag: 'power-hungry', lessonText: 'Last time the ship ran out of power. Look at what each choice draws, especially the instruments.',
    lines: [
      { who: 'Commander', text: 'Houston, I am seeing the bus voltage dropping.' },
      { who: 'Houston', text: 'Copy. Shed non-essential loads.' },
      { who: 'Commander', text: 'Loads are shed. It is still falling.' },
      { who: 'Commander', text: 'We are losing the cabin. Lights are going.' },
      { who: 'Houston', text: '...' },
    ],
  },
  vehicle: {
    id: 'vehicle', title: 'Vehicle lost', headline: 'The vehicle failed',
    because: 'Either the spacecraft was too heavy for its rocket, or a component failed at the worst moment. Every choice that added risk made that more likely.',
    avoid: 'Check the mass against the rocket. Reliability costs mass, money and days, but the risk of a rushed or unredundant design accumulates.',
    lessonTag: 'risky', lessonText: 'Last time the vehicle failed. Look for choices that add risk or mass, and what the team did to offset it.',
    lines: [
      { who: 'Houston', text: 'Stand by. Go for the burn.' },
      { who: 'Commander', text: 'Roger. I have a warning light. Houston, I have a warning light.' },
      { who: 'Houston', text: 'Copy. We are looking at it.' },
      { who: 'Commander', text: 'It is getting worse. Houston, are you seeing this?' },
    ],
  },
  crash: {
    id: 'crash', title: 'Too fast', headline: 'The landing was too hard',
    because: 'The lander reached the surface faster than its legs could take. The fuel that could have slowed it was already gone.',
    avoid: 'A lighter ship carries more landing fuel. Clean burns at liftoff and at the Moon save fuel for the way down. Start slowing early, and choose the plain until your hands know the way.',
    lessonTag: 'heavy-lander', lessonText: 'Last time the lander came down too fast. A lighter ship and cleaner burns leave more fuel for the landing.',
    lines: [
      { who: 'Houston', text: 'Thirty seconds of fuel.' },
      { who: 'Commander', text: 'Coming down fast. Too fast.' },
      { who: 'Houston', text: 'Abort. Abort.' },
      { who: 'Commander', text: 'No time.' },
      { who: 'Houston', text: '...do you read?' },
    ],
  },
  abort: {
    id: 'abort', title: 'Free return', headline: 'They came home without landing',
    because: 'There was no burn into Moon orbit, so the ship swung round the far side of the Moon on its free-return path and fell back to Earth, the way the trajectory was designed to. The crew is safe. Nobody walked on the Moon.',
    avoid: 'At the Moon, turn the ship to point backwards and burn until the speed is inside the green band. The free return is the safety net, not the mission.',
    lessonTag: 'free-return', lessonText: 'Last time the ship took the free return home. Burn into Moon orbit to land.',
    lines: [
      { who: 'Houston', text: 'We see no burn. You are on the free return.' },
      { who: 'Commander', text: 'Copy. Coming home the long way.' },
      { who: 'Houston', text: 'The Moon will swing you back to us. Good trajectory.' },
      { who: 'Commander', text: 'Not the trip we planned.' },
    ],
  },
  reentry: {
    id: 'reentry', title: 'Lost at entry', headline: 'The ship missed the entry corridor',
    because: 'The ship met the atmosphere at the wrong angle. Too steep, and the heat and the braking are more than the ship and the crew can survive. Too shallow, and it skips off the air back into space, with no way home.',
    avoid: 'Before entry, point the way the arrow says and burn only until the needle is inside the green band. Then let go. If you leave it alone, guidance makes the correction for you.',
    lessonTag: 'corridor', lessonText: 'Last time the ship missed the entry corridor. Burn only until the needle is in the green, then let go.',
    lines: [
      { who: 'Houston', text: 'Entry interface in one minute.' },
      { who: 'Commander', text: 'The angle is wrong. We are outside the corridor.' },
      { who: 'Houston', text: 'Copy. Stand by for blackout.' },
      { who: 'Houston', text: '...do you read? Please respond.' },
    ],
  },
};

export function endingFor(cause: Cause | null): Ending {
  if (!cause) return ending.success;
  if (cause === 'comms') return ending.comms;
  if (cause === 'power') return ending.power;
  if (cause === 'piloting') return ending.crash;
  if (cause === 'abort') return ending.abort;
  if (cause === 'reentry') return ending.reentry;
  return ending.vehicle;
}

/** Maps a failure to the option tags that should show a warning in later runs. */
export const lessonWatch: Record<Cause, string[]> = {
  comms: ['instruments-full', 'terrain-rough', 'dish-small'],
  power: ['instruments-full', 'power-standard'],
  mass: ['route-direct', 'docking-reliable', 'power-extra', 'dish-large'],
  hardware: ['rush', 'cabin-testing', 'terrain-rough'],
  piloting: ['route-direct', 'route-eor', 'instruments-full', 'power-extra', 'dish-large'],
  abort: [],
  reentry: [],
};

export const phaseNames: Record<Phase, string> = {
  launch: 'Launch', coast: 'Translunar coast', orbit: 'Lunar orbit', landing: 'Landing', return: 'Return',
};
