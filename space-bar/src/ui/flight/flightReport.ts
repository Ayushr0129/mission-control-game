import { FlightEducationState, FlightSample, reportSuggestions } from '../../domain/sim/flightEducation';
import { h } from '../dom';
import { TruthMission, TruthRocket } from '../../data/truth';

const NS='http://www.w3.org/2000/svg';
type Metric='altitudeM'|'speedMps'|'fuelKg';
const COLORS:Record<Metric,string>={altitudeM:'#72c8ed',speedMps:'#f0b45d',fuelKg:'#73d399'};
const LABELS:Record<Metric,string>={altitudeM:'Altitude',speedMps:'Speed',fuelKg:'Fuel'};

function chart(samples:readonly FlightSample[],metric:Metric):SVGSVGElement{
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('class','report-chart');svg.setAttribute('viewBox','0 0 420 130');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${LABELS[metric]} over mission time`);
 const max=Math.max(1,...samples.map(sample=>sample[metric])),duration=Math.max(1,samples.at(-1)?.timeS??1),points=samples.map(sample=>`${20+380*sample.timeS/duration},${110-90*sample[metric]/max}`).join(' ');
 const axis=document.createElementNS(NS,'path');axis.setAttribute('d','M 20 10 V 110 H 410');axis.setAttribute('fill','none');axis.setAttribute('stroke','#526b77');axis.setAttribute('stroke-width','1');
 const line=document.createElementNS(NS,'polyline');line.setAttribute('points',points);line.setAttribute('fill','none');line.setAttribute('stroke',COLORS[metric]);line.setAttribute('stroke-width','3');line.setAttribute('vector-effect','non-scaling-stroke');
 svg.append(axis,line);return svg;
}
const energy=(joules:number)=>joules>=1e9?`${(joules/1e9).toFixed(1)} GJ`:`${(joules/1e6).toFixed(1)} MJ`;
export interface FlightReportContext { mission:TruthMission; rocket:TruthRocket }
export interface FlightReportSnapshot { finalAltitudeM:number; peakAltitudeM:number; peakSpeedMps:number; fuelRemainingKg:number }
export const flightReportSnapshot=(samples:readonly FlightSample[]):FlightReportSnapshot=>({finalAltitudeM:samples.at(-1)?.altitudeM??0,peakAltitudeM:Math.max(0,...samples.map(s=>s.altitudeM)),peakSpeedMps:Math.max(0,...samples.map(s=>s.speedMps)),fuelRemainingKg:samples.at(-1)?.fuelKg??0});
const badge=(status:string)=>h('em',{class:`badge ${status}`},status);

export function flightReport(education:FlightEducationState,context?:FlightReportContext):HTMLElement{
 const samples=education.samples,total=Math.max(1,education.dragLossJ+education.gravityLossJ),dragShare=education.dragLossJ/total*100,gravityShare=education.gravityLossJ/total*100;
 const snapshot=flightReportSnapshot(samples);
 return h('section',{class:'post-flight-report'},h('p',{class:'eyebrow'},'POST-FLIGHT ENGINEERING REPORT'),h('h2',{},'What happened during the flight?'),samples.length>1?h('div',{class:'report-charts'},...(['altitudeM','speedMps','fuelKg'] as Metric[]).map(metric=>h('figure',{},chart(samples,metric),h('figcaption',{},LABELS[metric])))):h('p',{},'The flight ended before enough telemetry could be recorded.'),
  h('div',{class:'energy-report'},h('article',{},h('b',{},'Energy spent climbing against gravity'),h('strong',{},energy(education.gravityLossJ)),h('span',{class:'energy-bar'},h('i',{style:`width:${gravityShare}%`}))),h('article',{},h('b',{},'Energy lost to atmospheric drag'),h('strong',{},energy(education.dragLossJ)),h('span',{class:'energy-bar drag'},h('i',{style:`width:${dragShare}%`})))),
  context&&h('section',{class:'history-comparison'},h('p',{class:'eyebrow'},'COMPARE WITH HISTORY'),h('h3',{},'What really happened'),h('div',{class:'history-columns'},h('article',{},h('b',{},'Historical record'),h('p',{},`${context.mission.name} flew in ${context.mission.year.value} on ${context.rocket.name}.`),h('p',{},`Required end state: ${context.mission.destination.value}. ${context.mission.crewed.value?'Crewed':'Uncrewed'} mission.`),badge(context.mission.year.source.status)),h('article',{},h('b',{},'Your simulated flight'),h('p',{},`Final altitude ${(snapshot.finalAltitudeM/1000).toFixed(1)} km · peak ${(snapshot.peakAltitudeM/1000).toFixed(1)} km.`),h('p',{},`Peak speed ${(snapshot.peakSpeedMps/1000).toFixed(2)} km/s · fuel remaining ${(snapshot.fuelRemainingKg/1000).toFixed(1)} t.`),h('span',{class:'dim'},'These are simulation results, not historical measurements.')))),
  h('div',{class:'report-advice'},h('h3',{},'Try this next time'),...reportSuggestions(education).map(suggestion=>h('p',{},suggestion))));
}
