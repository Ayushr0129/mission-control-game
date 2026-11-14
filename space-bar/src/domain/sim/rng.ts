export interface SeededRng {seed:number;next():number}
export function seededRng(seed:number):SeededRng{let state=seed>>>0;return{seed,next(){state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;}};}
