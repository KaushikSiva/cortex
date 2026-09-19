class CortexPCM extends AudioWorkletProcessor {
 constructor(){super();this.pending=[];this.phase=0;this.speaking=false;this.quiet=0;}
 process(inputs){
  const x=inputs[0]?.[0];if(!x)return true;
  // Stream mono signed PCM16 at 16 kHz regardless of hardware sample rate.
  for(const sample of x){this.phase+=16000/sampleRate;if(this.phase>=1){this.phase-=1;this.pending.push(Math.max(-32768,Math.min(32767,Math.round(sample*32767))));}}
  while(this.pending.length>=1280){
   const pcm=Int16Array.from(this.pending.splice(0,1280));let sum=0;for(const v of pcm)sum+=(v/32768)**2;const rms=Math.sqrt(sum/pcm.length);
   if(rms>.012){this.quiet=0;if(!this.speaking){this.speaking=true;this.port.postMessage({type:'speech_start'});}}
   else if(this.speaking){this.quiet+=80;}
   this.port.postMessage({type:'audio',buffer:pcm.buffer,rms},[pcm.buffer]);
   if(this.speaking&&this.quiet>=640){this.speaking=false;this.port.postMessage({type:'speech_end'});}
  }
  return true;
 }
}
registerProcessor('cortex-pcm',CortexPCM);
