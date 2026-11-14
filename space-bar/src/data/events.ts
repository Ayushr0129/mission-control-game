import { GameEvent } from '../sim/types';

const S = (label: string, url?: string) => ({ label, url, status: 'placeholder' as const });

/** Historical events, drawn at random each run. Dates and facts must be verified against NASA History. */
export const events: GameEvent[] = [
  {
    id: 'apollo1-fire', date: '1967-01-27', weight: 1,
    headline: 'Fire in a launch rehearsal capsule',
    body: 'Three astronauts are killed in a ground test. Congress demands answers and the public is shaken.',
    immediate: { trust: -10 },
    stress: [{ phase: 'launch', kind: 'hardware', amount: 0.04 }, { phase: 'orbit', kind: 'hardware', amount: 0.02 }],
    mitigatedBy: ['cabin-redesign'], mitigation: 0.9,
    explain: 'After Apollo 1, NASA redesigned the cabin, hatch and materials, which delayed crewed flights by about 21 months. A team that already redesigned the cabin felt much less of it.',
    source: S('NASA History: Apollo 204 Review Board', 'https://history.nasa.gov/'),
  },
  {
    id: 'congress-review', date: '1963-09-01', weight: 1,
    headline: 'Congress debates the cost of the Moon',
    body: 'Critics say the money would be better spent on Earth. Appropriations are in doubt.',
    immediate: { budget: -10, trust: -3 },
    explain: 'The Moon program was never universally popular. Funding had to be defended again and again.',
    source: S('NASA History Office, budget history', 'https://history.nasa.gov/'),
  },
  {
    id: 'solar-activity', date: '1968-11-01', weight: 1,
    headline: 'The Sun is getting active',
    body: 'Forecasters warn of strong solar activity during the next window.',
    stress: [{ phase: 'coast', kind: 'power', amount: 3 }, { phase: 'return', kind: 'power', amount: 2 }, { phase: 'landing', kind: 'comms', amount: 1 }],
    mitigatedBy: ['power-extra', 'battery'], mitigation: 0.7,
    explain: 'Solar storms disturb radio links and degrade power systems. A spare power source gave the crew a reserve through the coast.',
    source: S('NASA Heliophysics / Solar cycle 20 records', 'https://www.nasa.gov/'),
  },
  {
    id: 'tracking-gap', date: '1969-07-20', weight: 1,
    headline: 'Wind at a tracking station',
    body: 'Gusts at a ground tracking dish may interrupt the link at a bad moment.',
    stress: [{ phase: 'orbit', kind: 'comms', amount: 1 }, { phase: 'landing', kind: 'comms', amount: 1.5 }],
    mitigatedBy: ['dish-large'], mitigation: 0.8,
    explain: 'In 1969 the pictures from the Moon were collected by several stations on different continents because one station alone was never enough. A bigger dish on the spacecraft made the link easier to catch.',
    source: S('NASA: Apollo 11 television and tracking network', 'https://www.nasa.gov/'),
  },
  {
    id: 'program-alarms', date: '1969-07-20', weight: 1,
    headline: 'Computer overload alarms during descent',
    body: 'The landing computer is asked to do more than it was designed for, right as the lander descends.',
    stress: [{ phase: 'landing', kind: 'hardware', amount: 0.07 }],
    mitigatedBy: ['terrain-flat'], mitigation: 0.6,
    explain: 'During the real landing the guidance computer flashed overload alarms and mission control had to decide in seconds. A flatter site left the crew with less to do and less to compute.',
    source: S('NASA: Apollo 11 Flight Journal', 'https://history.nasa.gov/afj/'),
  },
  {
    id: 'apollo8-boost', date: '1968-12-24', weight: 1,
    headline: 'A crew circles the Moon on Christmas Eve',
    body: 'Photographs of Earth rising above the lunar horizon reach homes around the world.',
    immediate: { trust: 8 },
    explain: 'Apollo 8 was the first crewed flight to orbit the Moon, and it lifted public support at a critical time.',
    source: S('NASA: Apollo 8 mission overview', 'https://www.nasa.gov/'),
  },
];
