export interface SimulationSource { subject:string; publisher:string; title:string; url:string; usedFor:string }
export const SIMULATION_SOURCES:readonly SimulationSource[]=[
 {subject:'Saturn V',publisher:'NASA',title:'Apollo 12 Saturn V Flight Manual',url:'https://www.nasa.gov/wp-content/uploads/static/history/afj/ap12fj/pdf/a12_sa507-flightmanual.pdf',usedFor:'Overall and stage dimensions, engines and markings'},
 {subject:'Falcon 9',publisher:'SpaceX',title:'Falcon 9 Rideshare specifications',url:'https://www.spacex.com/rideshare/',usedFor:'Height, diameter and fairing dimensions'},
 {subject:'Falcon Heavy',publisher:'SpaceX',title:'Falcon Heavy vehicle overview',url:'https://www.spacex.com/vehicles/falcon-heavy/',usedFor:'Height, width, three-core layout and engines'},
 {subject:'Space Shuttle',publisher:'NASA',title:'The Space Shuttle',url:'https://www.nasa.gov/reference/the-space-shuttle/',usedFor:'Integrated stack, orbiter and booster dimensions'},
 {subject:'Starship',publisher:'SpaceX',title:'Starship vehicle overview',url:'https://www.spacex.com/vehicles/starship/',usedFor:'Current stack, stage dimensions and Raptor counts'},
 {subject:'Earth and Moon',publisher:'NASA/JPL',title:'Planetary Fact Sheet',url:'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',usedFor:'Mass, radius, gravity and rotation constants'},
 {subject:'Atmosphere',publisher:'NASA',title:'U.S. Standard Atmosphere, 1976',url:'https://ntrs.nasa.gov/citations/19770009539',usedFor:'Density, pressure and temperature by altitude'},
 {subject:'Orbital mechanics',publisher:'NASA',title:'Basics of Space Flight: Orbits',url:'https://science.nasa.gov/learn/basics-of-space-flight/chapter5-1/',usedFor:'Educational explanation and orbit terminology'},
];
