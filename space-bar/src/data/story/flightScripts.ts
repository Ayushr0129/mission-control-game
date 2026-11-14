export interface StoryLine { id:string; event:string; speaker:string; text:string; priority:number }
export const FLIGHT_SCRIPT:readonly StoryLine[]=[
  {id:'ready',event:'FLIGHT_READY',speaker:'Flight Director Elena Ward',text:'All stations, this is Flight. We are committed to the mission.',priority:1},
  {id:'liftoff',event:'ASCENT',speaker:'CAPCOM Malik Okafor',text:'Liftoff confirmed. Keep the guidance corridor centered.',priority:1},
  {id:'maxq',event:'MAX_Q',speaker:'Booster Anika Rao',text:'Dynamic pressure is peaking. Hold attitude and watch structural load.',priority:2},
  {id:'orbit',event:'ORBIT',speaker:'GUIDO Theo Martin',text:'You are orbital. Verify periapsis before committing onward.',priority:1},
  {id:'tli',event:'MANEUVER_TRANS_LUNAR_INJECTION',speaker:'Flight Director Elena Ward',text:'TLI complete. The crew is now committed to the lunar coast.',priority:1},
  {id:'blackout',event:'BLACKOUT',speaker:'CAPCOM Malik Okafor',text:'Expected communications blackout. Fly the checklist.',priority:3},
  {id:'failure',event:'FLIGHT_FAILURE',speaker:'Flight Director Elena Ward',text:'Secure the vehicle. Record every parameter; the programme learns from this.',priority:4},
];
export function storyForEvents(events:readonly string[]):StoryLine[] { return FLIGHT_SCRIPT.filter(line=>events.includes(line.event)).sort((a,b)=>b.priority-a.priority); }
