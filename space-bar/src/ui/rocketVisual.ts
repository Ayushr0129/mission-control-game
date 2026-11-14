import { PartCategory, partsRepository } from '../data/parts';
import { RocketBlueprint } from '../data/rockets';

const NS='http://www.w3.org/2000/svg';
export type VisualRole='tank'|'interstage'|'engine'|'fairing'|'fin'|'grid-fin'|'landing-leg'|'nose'|'orbiter'|'booster'|'flame'|'marking';
export interface VisualPiece { role:VisualRole; stage:number; count:number }
export interface RocketVisualModel { heightM:number; bodyDiameterM:number; envelopeWidthM:number; coreAspectRatio:number; stageLengthsM:number[]; pieces:VisualPiece[] }

const count=(rocket:RocketBlueprint,category:PartCategory,predicate?:(part:NonNullable<ReturnType<typeof partsRepository.getById>>)=>boolean)=>rocket.stages.flatMap(stage=>stage.partIds).map(id=>partsRepository.getById(id)).filter((part):part is NonNullable<typeof part>=>!!part&&part.category===category&&(!predicate||predicate(part))).length;
export function rocketVisualModel(rocket:RocketBlueprint):RocketVisualModel {
 const pieces:VisualPiece[]=[];
 rocket.stages.forEach((stage,index)=>{
  const parts=stage.partIds.map(id=>partsRepository.getById(id)).filter((part):part is NonNullable<typeof part>=>!!part);
  if(parts.some(part=>part.category===PartCategory.Fuel))pieces.push({role:'tank',stage:index,count:1});
  const engines=parts.filter(part=>part.category===PartCategory.Engine).length;if(engines)pieces.push({role:'engine',stage:index,count:engines});
  if(parts.some(part=>part.category===PartCategory.Separator))pieces.push({role:'interstage',stage:index,count:1});
  if(parts.some(part=>part.category===PartCategory.Fairing))pieces.push({role:'fairing',stage:index,count:1});
  const fins=parts.filter(part=>part.category===PartCategory.Aero&&part.aeroType==='fin').length;if(fins)pieces.push({role:'fin',stage:index,count:Math.max(4,fins)});
  const grids=parts.filter(part=>part.category===PartCategory.Aero&&part.aeroType==='grid-fin').length;if(grids)pieces.push({role:'grid-fin',stage:index,count:4});
  const legs=parts.filter(part=>part.category===PartCategory.Extra&&part.extraType==='landing-leg').length;if(legs)pieces.push({role:'landing-leg',stage:index,count:legs});
 });
 if(rocket.visual.layout==='triple-core')pieces.push({role:'booster',stage:0,count:2});
 if(rocket.visual.layout==='shuttle')pieces.push({role:'booster',stage:0,count:2},{role:'orbiter',stage:1,count:1});
 return{heightM:rocket.heightM,bodyDiameterM:rocket.visual.bodyDiameterM,envelopeWidthM:rocket.visual.envelopeWidthM,coreAspectRatio:rocket.heightM/rocket.visual.bodyDiameterM,stageLengthsM:rocket.stages.map(stage=>stage.lengthM),pieces};
}

function el<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string|number>={}):SVGElementTagNameMap[K]{const node=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));return node;}
function add(parent:SVGElement,...children:SVGElement[]){parent.append(...children);}
const has=(rocket:RocketBlueprint,id:string)=>rocket.stages.some(stage=>stage.partIds.some(partId=>String(partId)===id));
const engineCount=(rocket:RocketBlueprint,stage=0)=>rocket.stages[stage]?.partIds.filter(id=>partsRepository.getById(id)?.category===PartCategory.Engine).length??0;
const gradient=(rocket:RocketBlueprint,name:'body'|'steel'|'flame')=>`url(#${name}-${String(rocket.id)})`;

function engines(group:SVGGElement,rocket:RocketBlueprint,y:number,width:number,stage=0,x=0){
 const n=Math.min(9,Math.max(1,engineCount(rocket,stage))),shown=Math.min(n,5),spacing=width/(shown+1);
 for(let i=0;i<shown;i++){const cx=x-width/2+spacing*(i+1);add(group,el('path',{d:`M ${cx-width*.07} ${y} L ${cx-width*.12} ${y+2.2} L ${cx+width*.12} ${y+2.2} L ${cx+width*.07} ${y} Z`,fill:'#34383a',stroke:'#111','stroke-width':.12}));}
}
function flame(group:SVGGElement,rocket:RocketBlueprint,x:number,y:number,width:number){const p=el('path',{class:'rocket-flame',d:`M ${x-width*.22} ${y} Q ${x} ${y+8} ${x+width*.22} ${y} Z`,fill:gradient(rocket,'flame'),'data-base-width':width});add(group,p);}
function bodyRect(group:SVGGElement,x:number,y:number,width:number,height:number,fill:string,role='tank'){add(group,el('rect',{x:x-width/2,y,width,height,rx:Math.min(.4,width*.08),fill,stroke:'#262b2e','stroke-width':.12,'data-role':role}));}

function drawInline(group:SVGGElement,rocket:RocketBlueprint){
 const base=rocket.heightM,first=rocket.stages[0],accent=rocket.visual.accentColor,fill=gradient(rocket,'body');let used=0;
 rocket.stages.forEach((stage,index)=>{const y=base-used-stage.lengthM;bodyRect(group,0,y,stage.diameterM,stage.lengthM,rocket.id.toString()==='starship'?gradient(rocket,'steel'):fill);add(group,el('line',{x1:-stage.diameterM/2,y1:y+stage.lengthM,x2:stage.diameterM/2,y2:y+stage.lengthM,stroke:accent,'stroke-width':.35}));if(index>0&&has(rocket,index===1&&rocket.id.toString()==='starship'?'hotstage-ring':index===1?'s1-sep':'s2-sep'))bodyRect(group,0,y,stage.diameterM,1.1,accent,'interstage');used+=stage.lengthM;});
 const payload=rocket.heightM-used;
 if(payload>0){const width=rocket.id.toString().startsWith('falcon')?5.2:rocket.stages.at(-1)?.diameterM??first.diameterM;add(group,el('path',{d:`M 0 0 Q ${width/2} ${payload*.35} ${width/2} ${payload} L ${-width/2} ${payload} Q ${-width/2} ${payload*.35} 0 0 Z`,fill:rocket.id.toString()==='starship'?gradient(rocket,'steel'):fill,stroke:'#262b2e','stroke-width':.14,'data-role':'fairing'}));}
 if(rocket.id.toString()==='starship'){add(group,el('path',{d:`M -4.5 39 L -6.1 50 L -4.5 50 Z M 4.5 39 L 6.1 50 L 4.5 50 Z M -4.5 5 L -5.6 18 L -4.5 18 Z M 4.5 5 L 5.6 18 L 4.5 18 Z`,fill:'#30373a','data-role':'fin'}));for(let x=-3.5;x<=3.5;x+=1)add(group,el('line',{x1:x,y1:3,x2:x,y2:121,stroke:'#747c7f','stroke-width':.06}));}
 if(has(rocket,'f9-grid')||has(rocket,'fh-grid'))add(group,el('path',{d:`M ${-first.diameterM/2} ${base-first.lengthM+2} l -1.1 -1.2 v 2.5 l 1.1 1.2 M ${first.diameterM/2} ${base-first.lengthM+2} l 1.1 -1.2 v 2.5 l -1.1 1.2`,fill:'none',stroke:'#25282a','stroke-width':.45,'data-role':'grid-fin'}));
 if(has(rocket,'f9-leg'))add(group,el('path',{d:`M -1.6 ${base-8} L -3.1 ${base} L -4 ${base} M 1.6 ${base-8} L 3.1 ${base} L 4 ${base}`,fill:'none',stroke:'#d9dad5','stroke-width':.55,'data-role':'landing-leg'}));
 if(has(rocket,'saturn-fin'))add(group,el('path',{d:`M -5 ${base-9} L -6.5 ${base} L -5 ${base} Z M 5 ${base-9} L 6.5 ${base} L 5 ${base} Z`,fill:'#f1f0e9',stroke:'#17191c','stroke-width':.2,'data-role':'fin'}));
 engines(group,rocket,base,first.diameterM);flame(group,rocket,0,base+2,first.diameterM);
 if(rocket.id.toString()==='saturn-v'){for(const y of [58,66,86,96])bodyRect(group,0,y,y===86?6.6:10.1,y===86?2:1.6,'#17191c','marking');const text=el('text',{x:1.7,y:77,fill:'#17191c','font-size':3,'font-family':'sans-serif','font-weight':700,transform:'rotate(90 1.7 77)'});text.textContent='USA';add(group,text);add(group,el('path',{d:'M 0 0 L -1.15 4.8 L -1.15 10 L 1.15 10 L 1.15 4.8 Z',fill:'#f4f3ed',stroke:'#17191c','stroke-width':.16}),el('line',{x1:0,y1:-4,x2:0,y2:0,stroke:'#f4f3ed','stroke-width':.35}));}
 if(rocket.id.toString()==='falcon-9'){const text=el('text',{x:.8,y:35,fill:'#17191c','font-size':1.7,'font-family':'sans-serif',transform:'rotate(90 .8 35)'});text.textContent='SPACEX';add(group,text);}
}

function drawHeavy(group:SVGGElement,rocket:RocketBlueprint){drawInline(group,rocket);const core=rocket.stages[0],base=rocket.heightM;for(const x of [-4.15,4.15]){bodyRect(group,x,base-core.lengthM,core.diameterM,core.lengthM,gradient(rocket,'body'),'booster');add(group,el('path',{d:`M ${x} ${base-core.lengthM-5} Q ${x+core.diameterM/2} ${base-core.lengthM-2.5} ${x+core.diameterM/2} ${base-core.lengthM} L ${x-core.diameterM/2} ${base-core.lengthM} Q ${x-core.diameterM/2} ${base-core.lengthM-2.5} ${x} ${base-core.lengthM-5} Z`,fill:gradient(rocket,'body'),stroke:'#262b2e','stroke-width':.12,'data-role':'nose'}));engines(group,rocket,base,core.diameterM,0,x);flame(group,rocket,x,base+2,core.diameterM);}}
function drawShuttle(group:SVGGElement,rocket:RocketBlueprint){const base=rocket.heightM;bodyRect(group,0,9.1,8.4,47.1,'#c66b2b','tank');add(group,el('path',{d:'M 0 0 Q 4.2 4 4.2 9.1 L -4.2 9.1 Q -4.2 4 0 0 Z',fill:'#c66b2b',stroke:'#7b3c18','stroke-width':.18}));for(const x of [-6.2,6.2]){bodyRect(group,x,base-45.5,3.7,45.5,gradient(rocket,'body'),'booster');add(group,el('path',{d:`M ${x} ${base-45.5-4.2} L ${x+1.85} ${base-45.5} L ${x-1.85} ${base-45.5} Z`,fill:'#f4f4ef',stroke:'#444','stroke-width':.12}));flame(group,rocket,x,base+1,3.7);}add(group,el('path',{d:`M 0 15 L -2.8 28 L -2.8 52 L -11.9 52 L -3.2 43 L -3.5 28 L 0 15 Z`,fill:'#f1f1ed',stroke:'#25282a','stroke-width':.2,'data-role':'orbiter'}),el('path',{d:'M -3.4 31 L -10.5 45 L -3 42 Z',fill:'#202427','data-role':'wing'}));engines(group,rocket,base-4,5.2,1,-2.2);}

export interface RocketVisualOptions { className?:string; label?:string; thrustFraction?:number; altitudeM?:number }
export function rocketVisual(rocket:RocketBlueprint,options:RocketVisualOptions={}):SVGSVGElement{
 const margin=Math.max(2,rocket.visual.envelopeWidthM*.12),svg=el('svg',{class:`rocket-visual ${options.className??''}`,viewBox:`${-rocket.visual.envelopeWidthM/2-margin} -5 ${rocket.visual.envelopeWidthM+margin*2} ${rocket.heightM+18}`,role:'img','aria-label':options.label??`${rocket.name}, ${rocket.heightM} metre launch vehicle`,'data-rocket-id':rocket.id});
 const defs=el('defs'),body=el('linearGradient',{id:`body-${String(rocket.id)}`,x1:'0',x2:'1'}),steel=el('linearGradient',{id:`steel-${String(rocket.id)}`,x1:'0',x2:'1'}),flameGradient=el('linearGradient',{id:`flame-${String(rocket.id)}`,x1:'0',y1:'0',x2:'0',y2:'1'});add(body,el('stop',{offset:'0','stop-color':'#7f878a'}),el('stop',{offset:'.28','stop-color':rocket.visual.primaryColor}),el('stop',{offset:'.65','stop-color':'#fff'}),el('stop',{offset:'1','stop-color':'#727a7d'}));add(steel,el('stop',{offset:'0','stop-color':'#5f696d'}),el('stop',{offset:'.45','stop-color':'#d7dcdd'}),el('stop',{offset:'.7','stop-color':'#929a9d'}),el('stop',{offset:'1','stop-color':'#535c60'}));add(flameGradient,el('stop',{offset:'0','stop-color':'#fff3b0'}),el('stop',{offset:'.3','stop-color':'#ff9b37'}),el('stop',{offset:'1','stop-color':'#559cff','stop-opacity':'.15'}));add(defs,body,steel,flameGradient);const group=el('g',{class:'rocket-assembly'});add(svg,defs,group);if(rocket.visual.layout==='shuttle')drawShuttle(group,rocket);else if(rocket.visual.layout==='triple-core')drawHeavy(group,rocket);else drawInline(group,rocket);updateRocketFlames(svg,options.thrustFraction??0,options.altitudeM??0);return svg;
}
export function plumeExpansion(altitudeM:number){return 1+1.4*Math.min(1,Math.max(0,altitudeM)/100000);}
export function updateRocketFlames(svg:SVGSVGElement,thrustFraction:number,altitudeM:number){const thrust=Math.max(0,Math.min(1,thrustFraction)),expansion=plumeExpansion(altitudeM);svg.querySelectorAll<SVGGraphicsElement>('.rocket-flame').forEach(flame=>{flame.style.opacity=thrust>0?String(.35+.65*thrust):'0';flame.style.transformBox='fill-box';flame.style.transformOrigin='top center';flame.style.transform=`scale(${expansion},${.25+.95*thrust})`;});}
export function rocketPartCount(rocket:RocketBlueprint,category:PartCategory){return count(rocket,category);}
