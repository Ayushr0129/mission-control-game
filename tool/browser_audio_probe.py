"""Observe native Web Audio calls in disposable browser tests, not game code."""
AUDIO_PROBE = r"""
(() => {
  const probe = window.__missionAudio = {
    starts:0, loopStarts:0, musicStarts:0, musicLoops:new Set(), stops:0, resumeCalls:0, blockResume:false,
    contexts:[], gains:[], activeLoops:new Set(), durations:[], lastStartState:null
  };
  const NativeContext=window.AudioContext;
  if(!NativeContext || !window.AudioBufferSourceNode) { probe.unsupported=true; return; }
  const resume=NativeContext.prototype.resume;
  NativeContext.prototype.resume=function(...args) {
    probe.resumeCalls++;
    if(probe.blockResume) return Promise.reject(new DOMException('Activation blocked for test','NotAllowedError'));
    return resume.apply(this,args);
  };
  const gain=NativeContext.prototype.createGain;
  NativeContext.prototype.createGain=function(...args) {
    const node=gain.apply(this,args);probe.gains.push(node);return node;
  };
  const Context=function(...args) {
    const context=new NativeContext(...args);probe.contexts.push(context);return context;
  };
  Context.prototype=NativeContext.prototype;
  window.AudioContext=Context;
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args) {
    probe.starts++;probe.lastStartState=this.context.state;
    probe.durations.push(this.buffer?.duration ?? 0);
    if(this.loop) { if(this.buffer.duration>10) {probe.musicStarts++;probe.musicLoops.add(this);} else {probe.loopStarts++;probe.activeLoops.add(this);} }
    return start.apply(this,args);
  };
  const stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.stop=function(...args) {
    probe.stops++;probe.activeLoops.delete(this);probe.musicLoops.delete(this);return stop.apply(this,args);
  };
})();
"""
