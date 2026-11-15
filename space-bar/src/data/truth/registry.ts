export interface SourceDocument {
  id: string;
  title: string;
  url: string;
  localPath: string;
}

export const SOURCE_DOCUMENTS: readonly SourceDocument[] = [
  { id: 'nasa-mercury', title: 'Project Mercury', url: 'https://www.nasa.gov/project-mercury/', localPath: 'data/sources/nasa-project-mercury.source' },
  { id: 'nasa-mercury-summary', title: 'Mercury Crewed Flights Summary', url: 'https://www.nasa.gov/missions/project-mercury/mercury-crewed-flights-summary/', localPath: 'data/sources/nasa-mercury-crewed-flights.source' },
  { id: 'nasa-sputnik', title: 'Sputnik Ushers in the Space Age', url: 'https://www.nasa.gov/history/65-years-ago-sputnik-ushers-in-the-space-age/', localPath: 'data/sources/nasa-sputnik.source' },
  { id: 'nasa-sts31', title: 'STS-31', url: 'https://www.nasa.gov/mission/sts-31/', localPath: 'data/sources/nasa-sts-31.source' },
  { id: 'nasa-apollo11', title: 'Apollo 11 Mission Overview', url: 'https://www.nasa.gov/mission/apollo-11/', localPath: 'data/sources/nasa-apollo-11.source' },
  { id: 'spacex-f9', title: 'Falcon 9', url: 'https://www.spacex.com/vehicles/falcon-9/', localPath: 'data/sources/spacex-falcon-9.source' },
  { id: 'spacex-mission', title: 'SpaceX Mission Milestones', url: 'https://www.spacex.com/mission/', localPath: 'data/sources/spacex-mission.source' },
  { id: 'spacex-fh', title: 'Falcon Heavy', url: 'https://www.spacex.com/vehicles/falcon-heavy/', localPath: 'data/sources/spacex-falcon-heavy.source' },
  { id: 'nasa-shuttle', title: 'The Space Shuttle', url: 'https://www.nasa.gov/reference/the-space-shuttle/', localPath: 'data/sources/nasa-space-shuttle.source' },
  { id: 'spacex-starship', title: 'Starship', url: 'https://www.spacex.com/vehicles/starship/', localPath: 'data/sources/spacex-starship.source' },
  { id: 'nasa-psyche', title: 'Psyche Mission Overview', url: 'https://science.nasa.gov/mission/psyche/mission-overview/', localPath: 'data/sources/nasa-psyche.source' },
  { id: 'nasa-ussa76', title: 'U.S. Standard Atmosphere 1976', url: 'https://ntrs.nasa.gov/citations/19770009539', localPath: 'docs/PHYSICS.md' },
  { id: 'physics-equations', title: 'Space Bar Physics Equations', url: 'docs/PHYSICS.md', localPath: 'docs/PHYSICS.md' },
  { id: 'todo', title: 'Unverified data queue', url: 'docs/DATA-TODO.md', localPath: 'docs/DATA-TODO.md' },
] as const;

export const sourceDocumentIds = new Set(SOURCE_DOCUMENTS.map(({ id }) => id));
